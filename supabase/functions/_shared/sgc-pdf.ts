// =====================================================================
// sgc-pdf.ts · Pintor PDF (pdf-lib) del diseño "Concept 3".
//
// Toma las primitivas que arma _shared/sgc-layout.js (en unidades "u" del
// concepto, eje Y hacia abajo) y las dibuja en páginas A4 vectoriales:
// rellenos, trazos, degradados (sombreado axial de PDF recortado a la
// forma), íconos, texto con las fuentes incrustadas y el logo.
// Lo usan pdf-comprobante.ts y pdf-maestro.ts (y por ellos, las Edge
// Functions comprobante-pdf, maestro-pdf y notificar).
// =====================================================================

import {
  PDFDocument, PDFPage, PDFFont, PDFImage, PDFName, PDFDict, PDFOperator, PDFOperatorNames, PDFNumber,
  rgb, pushGraphicsState, popGraphicsState, moveTo, lineTo, appendBezierCurve, closePath, clip, endPath,
  LineCapStyle,
} from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { ANCHO, ALTO, ICONOS as ICONOS_SGC } from './sgc-layout.js';
import { FUENTES_SGC_B64 } from './fuentes-sgc.ts';
import { logoBytes } from './logo.ts';

export const ANCHO_PT = 595.28;
export const ALTO_PT = 841.89;
const K = ANCHO_PT / ANCHO; // pt por u
const ICONOS: Record<string, string> = ICONOS_SGC;

function b64ABytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function color(hex: string) {
  const h = hex.replace('#', '');
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}
function colorArr(hex: string) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

// Caracteres que traen las fuentes (subconjunto latino). El resto se
// reemplaza para no terminar en un glifo vacío.
const PERMITIDOS = /[ -~ -ÿ–—‘’“”•…€™→]/;
export function limpiarTexto(t: string): string {
  let out = '';
  for (const ch of String(t ?? '')) {
    if (PERMITIDOS.test(ch)) out += ch;
    else if (ch === '\t') out += ' ';
    else if (/[‐-‒−]/.test(ch)) out += '-';
    else if (/\s/.test(ch)) out += ' ';
    else out += '?';
  }
  return out;
}

export interface PintorPdf {
  doc: PDFDocument;
  medir: (txt: string, f: string, s: number) => number;
  nuevaPagina: () => PDFPage;
  pintar: (page: PDFPage, prims: any[]) => void;
}

export async function crearPintorPdf(): Promise<PintorPdf> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fuentes: Record<string, PDFFont> = {};
  for (const [k, b64] of Object.entries(FUENTES_SGC_B64)) {
    // Las fuentes ya vienen recortadas: se incrustan tal cual (subset:false).
    // Con subset:true, pdf-lib + fontkit pierde glifos en Fira Sans.
    fuentes[k] = await doc.embedFont(b64ABytes(b64), { subset: false });
  }
  const logo: PDFImage = await doc.embedPng(logoBytes());
  const medir = (txt: string, f: string, s: number) => fuentes[f].widthOfTextAtSize(limpiarTexto(txt), s);

  const nuevaPagina = () => {
    const page = doc.addPage([ANCHO_PT, ALTO_PT]);
    // uniones redondeadas para los trazos (íconos) en toda la página
    page.pushOperators(PDFOperator.of(PDFOperatorNames.SetLineJoinStyle, [PDFNumber.of(1)]));
    return page;
  };

  const sombreados = new WeakMap<PDFPage, number>();
  const rellenarDegradado = (page: PDFPage, d: string, g: any, op?: number) => {
    const n = (sombreados.get(page) ?? 0) + 1;
    sombreados.set(page, n);
    const nombre = `SgcSh${n}`;
    const stops: [number, string][] = g.stops;
    let fn: any;
    if (stops.length === 2) {
      fn = doc.context.obj({ FunctionType: 2, Domain: [0, 1], C0: colorArr(stops[0][1]), C1: colorArr(stops[1][1]), N: 1 });
    } else {
      const funcs = [], bounds = [], encode = [];
      for (let i = 0; i < stops.length - 1; i++) {
        funcs.push(doc.context.obj({ FunctionType: 2, Domain: [0, 1], C0: colorArr(stops[i][1]), C1: colorArr(stops[i + 1][1]), N: 1 }));
        if (i > 0) bounds.push(stops[i][0]);
        encode.push(0, 1);
      }
      fn = doc.context.obj({ FunctionType: 3, Domain: [0, 1], Functions: funcs, Bounds: bounds, Encode: encode });
    }
    const [x1, y1, x2, y2] = g.lin;
    const sh = doc.context.obj({
      ShadingType: 2, ColorSpace: 'DeviceRGB',
      Coords: [x1 * K, ALTO_PT - y1 * K, x2 * K, ALTO_PT - y2 * K],
      Function: fn, Extend: [true, true],
    });
    const ref = doc.context.register(sh);
    const res = page.node.normalizedEntries().Resources;
    let dict = res.lookupMaybe(PDFName.of('Shading'), PDFDict);
    if (!dict) { dict = doc.context.obj({}); res.set(PDFName.of('Shading'), dict); }
    dict.set(PDFName.of(nombre), ref);

    const ops: any[] = [pushGraphicsState()];
    if (op != null && op < 1) {
      const gs = doc.context.obj({ Type: 'ExtGState', ca: op, CA: op });
      const gsName = page.node.newExtGState('SgcGs', doc.context.register(gs));
      ops.push(PDFOperator.of(PDFOperatorNames.SetGraphicsStateParams, [gsName]));
    }
    const re = /([MLCZ])([^MLCZ]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d))) {
      const v = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (m[1] === 'M') ops.push(moveTo(v[0] * K, ALTO_PT - v[1] * K));
      else if (m[1] === 'L') ops.push(lineTo(v[0] * K, ALTO_PT - v[1] * K));
      else if (m[1] === 'C') ops.push(appendBezierCurve(v[0] * K, ALTO_PT - v[1] * K, v[2] * K, ALTO_PT - v[3] * K, v[4] * K, ALTO_PT - v[5] * K));
      else if (m[1] === 'Z') ops.push(closePath());
    }
    ops.push(clip(), endPath(), PDFOperator.of(PDFOperatorNames.ShadingFill, [PDFName.of(nombre)]), popGraphicsState());
    page.pushOperators(...ops);
  };

  const pintar = (page: PDFPage, prims: any[]) => {
    for (const p of prims) {
      if (p.t === 'path') {
        if (p.fill && typeof p.fill === 'object') rellenarDegradado(page, p.d, p.fill, p.op);
        else if (p.fill) page.drawSvgPath(p.d, { x: 0, y: ALTO_PT, scale: K, color: color(p.fill), opacity: p.op ?? 1 });
        if (p.stroke) {
          page.drawSvgPath(p.d, {
            x: 0, y: ALTO_PT, scale: K, borderColor: color(p.stroke), borderWidth: p.sw ?? 1,
            borderOpacity: p.op ?? 1, borderLineCap: LineCapStyle.Round,
          });
        }
      } else if (p.t === 'text') {
        const txt = limpiarTexto(p.txt);
        if (!txt) continue;
        const f = fuentes[p.f];
        const w = f.widthOfTextAtSize(txt, p.s);
        const x = p.a === 'middle' ? p.x - w / 2 : p.a === 'end' ? p.x - w : p.x;
        page.drawText(txt, { x: x * K, y: ALTO_PT - p.y * K, size: p.s * K, font: f, color: color(p.c), opacity: p.op ?? 1 });
      } else if (p.t === 'icon') {
        const d = ICONOS[p.name] ?? ICONOS['file-text'];
        page.drawSvgPath(d, {
          x: p.x * K, y: ALTO_PT - p.y * K, scale: (p.size / 24) * K,
          borderColor: color(p.c), borderWidth: p.sw ?? 2, borderLineCap: LineCapStyle.Round,
        });
      } else if (p.t === 'img' && p.key === 'logo') {
        page.drawImage(logo, { x: p.x * K, y: ALTO_PT - (p.y + p.h) * K, width: p.w * K, height: p.h * K });
      }
    }
  };

  return { doc, medir, nuevaPagina, pintar };
}

/** Arma el PDF completo de un documento (ver componerDocumento en sgc-layout.js). */
export async function pdfDeDocumento(componer: (medir: any) => any[][]): Promise<Uint8Array> {
  const pintor = await crearPintorPdf();
  const paginas = componer(pintor.medir);
  for (const prims of paginas) pintor.pintar(pintor.nuevaPagina(), prims);
  return pintor.doc.save();
}
