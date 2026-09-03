// =====================================================================
// Encabezado corporativo "Sistema de Gestión Integrado" (SGI) para los PDF reales
// (comprobante y maestro): dibujado como vectores (no como imagen de fondo),
// construido a partir del HTML/SVG de referencia que entregó Metalium --
// mismas coordenadas relativas (viewBox de referencia: 1400 x 173), mismos
// colores y misma estructura de filas -- ver también src/ui/encabezado-svg.js,
// que dibuja exactamente lo mismo para la vista en pantalla.
//
// Estructura (4 filas, no 5 -- "SISTEMA DE GESTIÓN INTEGRADO" y "CÓDIGO"
// comparten la fila superior, uno al lado del otro):
//   Fila 1 (azul):   SISTEMA DE GESTIÓN INTEGRADO | CÓDIGO | valor
//   Fila 2 (blanca): FECHA | valor
//   Fila 3 (blanca): REVISIÓN | valor
//   Fila 4 (azul):   RRH | METALIUM
// A la izquierda, en toda la altura: el logo; a su derecha, el nombre del
// documento (centrado en el alto de las filas 2+3+4, no en el alto total).
//
// Se usa desde `comprobante-pdf` y `maestro-pdf` (vía _shared/pdf-comprobante.ts
// y _shared/pdf-maestro.ts). Compartir este dibujo evita tener el mismo
// código de geometría duplicado en los dos generadores.
// =====================================================================

import { PDFFont, PDFImage, PDFPage, rgb } from 'npm:pdf-lib@1.17.1';

export const AZUL = rgb(0.1059, 0.6078, 0.8471); // #1B9BD8
const BORDE = rgb(0.4196, 0.4588, 0.5647); // #6B7590 -- cortes diagonales principales
const BORDE_ACC = rgb(0.3608, 0.6980, 0.8784); // #5CB2E0 -- acento de esos cortes, dentro de las franjas azules
const BORDE_SEP = rgb(0.5294, 0.5686, 0.6667); // #8791AA -- separador horizontal fecha | revisión
const BORDE_EXT = rgb(0.1059, 0.1373, 0.2510); // #1B2340 -- borde exterior
const GRIS = rgb(0.2392, 0.2588, 0.3451); // #3D4258 -- etiquetas FECHA/REVISIÓN (sobre blanco)
const VAL = rgb(0.3373, 0.3529, 0.4510); // #565A73 -- valores FECHA/REVISIÓN (sobre blanco)
const NEGRO = rgb(0, 0, 0);
const BLANCO = rgb(1, 1, 1);

export interface EncabezadoFuentes {
  regularItalic: PDFFont; // valores FECHA/REVISIÓN
  boldItalic: PDFFont; // etiquetas ("SISTEMA...", "CÓDIGO", "RRH") y valores fuertes (código, METALIUM)
  bold: PDFFont; // nombre del documento (una sola línea, sin itálica)
  regular: PDFFont; // (sin uso actualmente, se deja por compatibilidad)
}

export interface EncabezadoOpts {
  pageWidth: number;
  M: number;
  yTop: number; // borde superior del encabezado (coordenada PDF, y-arriba)
  HH?: number; // alto total del encabezado (default: mantiene la proporción exacta de la referencia, ANCHO*173/1400)
  codigo: string;
  fecha: string;
  revision?: string; // default '00'
  titulo: string; // nombre del documento, en una sola línea, ej. "Comprobante de solicitud - Ingreso"
  piezaIzq?: string; // default 'RRH'
  piezaDer?: string; // default 'METALIUM'
}

/** Formatea una fecha como DD/MM/YYYY (igual que formatDate() del frontend). */
export function fechaCortaDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Dibuja el encabezado en `page` y devuelve el y (coordenada PDF) del borde
 * inferior del encabezado, para que el llamador siga dibujando debajo. */
export function dibujarEncabezado(page: PDFPage, fuentes: EncabezadoFuentes, logo: PDFImage, opts: EncabezadoOpts): number {
  const { pageWidth, M, yTop, codigo, fecha, titulo } = opts;
  const ANCHO = pageWidth - 2 * M;
  // Mantiene la proporción exacta alto/ancho de la referencia (173/1400) salvo
  // que el llamador fuerce un HH distinto.
  const HH = opts.HH ?? ANCHO * (173 / 1400);
  const revision = opts.revision ?? '00';
  const piezaIzq = opts.piezaIzq ?? 'RRH';
  const piezaDer = opts.piezaDer ?? 'METALIUM';
  const xRight = M + ANCHO;
  const yBot = yTop - HH;
  const esc = ANCHO / 1400; // factor de escala: puntos PDF por unidad de la referencia

  const fillQuad = (pts: [number, number][], color: ReturnType<typeof rgb>) => {
    const toLocalY = (y: number) => yTop - y; // ancla en (0, yTop): y local crece hacia abajo
    const [p0, ...rest] = pts;
    let path = `M ${p0[0]} ${toLocalY(p0[1])} `;
    for (const p of rest) path += `L ${p[0]} ${toLocalY(p[1])} `;
    path += 'Z';
    page.drawSvgPath(path, { x: 0, y: yTop, color });
  };
  const strokeLine = (x1: number, y1: number, x2: number, y2: number, thickness: number, color = BORDE) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  };
  const fitSize = (f: PDFFont, text: string, maxWidth: number, start: number, min: number) => {
    let s = start;
    while (s > min && f.widthOfTextAtSize(text, s) > maxWidth) s -= 0.25;
    return s;
  };

  // Los tres cortes diagonales principales comparten la misma pendiente
  // (medida exacta de la referencia: 45/173 de desplazamiento horizontal por
  // cada unidad vertical). PENDIENTE ya es un cociente longitud/longitud
  // (puntos PDF de x por punto PDF de y): como (yTop-y) está en puntos PDF
  // y HH = ANCHO*173/1400 por defecto, NO hay que multiplicar por esc de
  // nuevo aquí (esc ya "está" implícito en cómo se relacionan ANCHO y HH).
  const PENDIENTE = 45 / 173;
  const xAt = (topFrac: number, y: number) => (M + topFrac * ANCHO) - PENDIENTE * (yTop - y);
  const xLogo = (y: number) => xAt(365 / 1400, y); // borde logo | título (y borde izq. de la fila "sistema+código")
  const xC2 = (y: number) => xAt(941 / 1400, y); // borde título | cuadro código/fecha/revisión
  const xDiv = (y: number) => xAt(1202 / 1400, y); // divisoria etiqueta | valor

  // Filas: y0/y1 exactos según la referencia (0,32,78,125,173 sobre 173),
  // convertidos a coordenadas PDF (y-arriba, ancladas en yTop).
  const yOf = (yRef: number) => yTop - yRef * (HH / 173);
  const filas = [
    { key: 'sistema_codigo', y0: yOf(0), y1: yOf(32), bg: AZUL as ReturnType<typeof rgb> | null, xIzq: xLogo },
    { key: 'fecha', y0: yOf(32), y1: yOf(78), bg: null as ReturnType<typeof rgb> | null, xIzq: xC2 },
    { key: 'revision', y0: yOf(78), y1: yOf(125), bg: null as ReturnType<typeof rgb> | null, xIzq: xC2 },
    { key: 'rrh_metalium', y0: yOf(125), y1: yOf(173), bg: AZUL as ReturnType<typeof rgb> | null, xIzq: xC2 },
  ];
  const [fSC, fFecha, fRevision, fRM] = filas;
  const yc = (f: { y0: number; y1: number }) => (f.y0 + f.y1) / 2;

  // ---- Logo (izquierda, centrado en el alto completo) y título ----
  fillQuad([[M, yBot], [xC2(yBot), yBot], [xC2(yTop), yTop], [M, yTop]], BLANCO);
  const logoW = 225 * esc, logoH = logoW * (logo.height / logo.width);
  const midY = (yTop + yBot) / 2;
  page.drawImage(logo, { x: M + 48 * esc, y: midY - logoH / 2, width: logoW, height: logoH });
  const midYTitulo = (fFecha.y0 + yBot) / 2; // centro de las filas 2+3+4 (no del alto total)
  const tituloX = xLogo(midYTitulo) + 40 * esc;
  const tituloMaxW = Math.max(xC2(midYTitulo) - tituloX - 10 * esc, 60);
  const sT = fitSize(fuentes.bold, titulo, tituloMaxW, 24 * esc, 7);
  page.drawText(titulo, { x: tituloX, y: midYTitulo - sT * 0.35, size: sT, font: fuentes.bold, color: NEGRO });

  // ---- Bandas del bloque derecho ----
  for (const f of filas) {
    if (f.bg) fillQuad([[f.xIzq(f.y0), f.y0], [xRight, f.y0], [xRight, f.y1], [f.xIzq(f.y1), f.y1]], f.bg);
  }
  // Los tres cortes diagonales principales, en toda la altura.
  strokeLine(xLogo(yBot), yBot, xLogo(yTop), yTop, 1.3 * esc);
  strokeLine(xC2(yBot), yBot, xC2(yTop), yTop, 1.3 * esc);
  strokeLine(xDiv(yBot), yBot, xDiv(yTop), yTop, 1.3 * esc);
  // Acento sutil de esos mismos cortes, solo dentro de las franjas azules.
  strokeLine(xC2(fSC.y1), fSC.y1, xC2(fSC.y0), fSC.y0, 1 * esc, BORDE_ACC);
  strokeLine(xDiv(fSC.y1), fSC.y1, xDiv(fSC.y0), fSC.y0, 1 * esc, BORDE_ACC);
  strokeLine(xDiv(fRM.y1), fRM.y1, xDiv(fRM.y0), fRM.y0, 1 * esc, BORDE_ACC);
  // Separador horizontal entre FECHA y REVISIÓN.
  strokeLine(xC2(fFecha.y1), fFecha.y1, xRight, fFecha.y1, 1 * esc, BORDE_SEP);
  // Borde exterior.
  strokeLine(M, yBot, xRight, yBot, 1.5 * esc, BORDE_EXT);
  strokeLine(M, yTop, xRight, yTop, 1.5 * esc, BORDE_EXT);
  strokeLine(xRight, yBot, xRight, yTop, 1.5 * esc, BORDE_EXT);
  strokeLine(M, yBot, M, yTop, 1.5 * esc, BORDE_EXT);

  // ---- Texto de cada banda ----
  const centrado = (texto: string, xa: number, xb: number, yC: number, size: number, f: PDFFont, color: ReturnType<typeof rgb>) => {
    const w = f.widthOfTextAtSize(texto, size);
    page.drawText(texto, { x: xa + ((xb - xa) - w) / 2, y: yC - size * 0.35, size, font: f, color });
  };
  const celda = (texto: string, xa: number, xb: number, yC: number, sizeMax: number, f: PDFFont, color: ReturnType<typeof rgb>, pad: number) => {
    const maxW = (xb - xa) - pad * 2;
    const s = fitSize(f, texto, maxW, sizeMax, sizeMax * 0.5);
    const x = xa + ((xb - xa) - f.widthOfTextAtSize(texto, s)) / 2;
    page.drawText(texto, { x, y: yC - s * 0.35, size: s, font: f, color });
  };
  const padCelda = 6 * esc;

  centrado('SISTEMA DE GESTIÓN INTEGRADO', xLogo(yc(fSC)), xC2(yc(fSC)), yc(fSC), 15 * esc, fuentes.boldItalic, BLANCO);
  celda('CÓDIGO', xC2(yc(fSC)), xDiv(yc(fSC)), yc(fSC), 15 * esc, fuentes.boldItalic, BLANCO, padCelda);
  celda(codigo, xDiv(yc(fSC)), xRight, yc(fSC), 15 * esc, fuentes.boldItalic, BLANCO, padCelda);
  celda('FECHA', xC2(yc(fFecha)), xDiv(yc(fFecha)), yc(fFecha), 14.5 * esc, fuentes.boldItalic, GRIS, padCelda);
  celda(fecha, xDiv(yc(fFecha)), xRight, yc(fFecha), 16 * esc, fuentes.regularItalic, VAL, padCelda);
  celda('REVISIÓN', xC2(yc(fRevision)), xDiv(yc(fRevision)), yc(fRevision), 14.5 * esc, fuentes.boldItalic, GRIS, padCelda);
  celda(revision, xDiv(yc(fRevision)), xRight, yc(fRevision), 16 * esc, fuentes.regularItalic, VAL, padCelda);
  celda(piezaIzq, xC2(yc(fRM)), xDiv(yc(fRM)), yc(fRM), 15 * esc, fuentes.boldItalic, BLANCO, padCelda);
  celda(piezaDer, xDiv(yc(fRM)), xRight, yc(fRM), 15 * esc, fuentes.boldItalic, BLANCO, padCelda);

  return yBot;
}
