// =====================================================================
// Generador del PDF del "Maestro de solicitudes": listado tabular de
// TODAS las solicitudes (los 6 tipos), con el encabezado "Sistema de
// Gestión Integrado" en cada página (ver _shared/pdf-encabezado.ts) y el
// código de formulario RRH-FOR-SOL-001. Complementa (no reemplaza) la
// exportación a Excel, que trae el detalle completo fila por fila -- acá
// va un resumen pensado para imprimir.
// =====================================================================

import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { logoBytes } from './logo.ts';
import { dibujarEncabezado, fechaCortaDDMMYYYY } from './pdf-encabezado.ts';
import { MAESTRO_SOLICITUDES_CODIGO, TIPO_LABELS } from './solicitud-detalle.ts';

const NAVY = rgb(0.039, 0.173, 0.353);
const GRIS = rgb(0.4, 0.45, 0.5);
const M = 34;
const ANCHO_PAG = 842; // A4 apaisado (landscape): 842 x 595
const ALTO_PAG = 595;
const ANCHO = ANCHO_PAG - 2 * M;

export interface FilaMaestro {
  folio: string | null;
  codigo: string | null;
  tipo: string;
  estado: string;
  solicitante: string;
  trabajador: string;
  centro: string;
  creada: string;
  aprobResumen: string;
}

const COLS = [
  { key: 'folio', label: 'Folio', w: 90 },
  { key: 'tipo', label: 'Tipo', w: 90 },
  { key: 'estado', label: 'Estado', w: 65 },
  { key: 'solicitante', label: 'Solicitante', w: 120 },
  { key: 'trabajador', label: 'Trabajador', w: 120 },
  { key: 'centro', label: 'Centro de costo', w: 130 },
  { key: 'creada', label: 'Creada', w: 75 },
  { key: 'aprobResumen', label: 'Aprobaciones', w: 82 },
] as const;

export async function construirMaestroPdf(filas: FilaMaestro[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fuentes = {
    regular: await doc.embedFont(StandardFonts.HelveticaOblique),
    regularItalic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await doc.embedPng(logoBytes());

  let page = doc.addPage([ANCHO_PAG, ALTO_PAG]);
  let y = ALTO_PAG - M;

  const encabezadoPagina = () => {
    const yBot = dibujarEncabezado(page, fuentes, logo, {
      pageWidth: ANCHO_PAG, M, yTop: y,
      codigo: MAESTRO_SOLICITUDES_CODIGO,
      fecha: fechaCortaDDMMYYYY(new Date()),
      titulo: `Maestro de solicitudes (${filas.length})`,
    });
    // Nota: antes había una línea celeste (#29abe2) acá, resabio del banner
    // viejo -- no existe en el encabezado de referencia, así que se sacó.
    y = yBot - 14;
    encabezadoTabla();
  };

  const encabezadoTabla = () => {
    page.drawRectangle({ x: M, y: y - 4, width: ANCHO, height: 14, color: NAVY });
    let x = M;
    COLS.forEach((c) => {
      page.drawText(c.label, { x: x + 3, y: y - 1, size: 7.5, font: bold, color: rgb(1, 1, 1) });
      x += c.w;
    });
    y -= 18;
  };

  encabezadoPagina();

  let zebra = false;
  for (const f of filas) {
    if (y < M + 20) {
      page = doc.addPage([ANCHO_PAG, ALTO_PAG]);
      y = ALTO_PAG - M;
      encabezadoPagina();
    }
    if (zebra) {
      page.drawRectangle({ x: M, y: y - 3, width: ANCHO, height: 13, color: rgb(0.97, 0.98, 0.99) });
    }
    zebra = !zebra;

    let x = M;
    const vals: Record<string, string> = {
      folio: f.folio || f.codigo || '—',
      tipo: TIPO_LABELS[f.tipo] ?? f.tipo,
      estado: f.estado,
      solicitante: f.solicitante,
      trabajador: f.trabajador || '—',
      centro: f.centro || '—',
      creada: f.creada,
      aprobResumen: f.aprobResumen,
    };
    COLS.forEach((c) => {
      const texto = String(vals[c.key] ?? '').slice(0, Math.floor(c.w / 4.4));
      page.drawText(texto, { x: x + 2, y, size: 7.5, font, color: rgb(0, 0, 0) });
      x += c.w;
    });
    y -= 13;
  }

  doc.getPages().forEach((p) => {
    p.drawText(`Metalium · Documento generado por el sistema · ${new Date().toLocaleDateString('es-CL')}`, { x: M, y: 18, size: 7, font, color: GRIS });
  });

  return doc.save();
}
