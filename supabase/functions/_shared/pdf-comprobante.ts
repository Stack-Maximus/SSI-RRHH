// =====================================================================
// Generador del PDF de "Comprobante de solicitud" (los 6 tipos), con el
// encabezado "Sistema de Gestión Integrado" (logo + nombre del documento +
// cuadro Código/Fecha/Revisión + pie RRH/Metalium), dibujado como vectores
// -- ver _shared/pdf-encabezado.ts para la geometría compartida con el
// maestro. Usado por la Edge Function `comprobante-pdf` (descarga directa
// desde la app) y por `notificar` (adjunto del correo de aprobación a RRHH).
// =====================================================================

import { PDFDocument, PDFPage, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { logoBytes } from './logo.ts';
import { dibujarEncabezado, fechaCortaDDMMYYYY } from './pdf-encabezado.ts';
import { DOCUMENTO_CODIGOS, TIPO_LABELS, detalleLineas } from './solicitud-detalle.ts';

const NAVY = rgb(0.039, 0.173, 0.353); // #0a2c5a
const GRIS = rgb(0.4, 0.45, 0.5);
const M = 50;

export interface ComprobanteData {
  sol: any;
  cmap: Map<any, any>;
  aprs: any[];
  pmap: Map<any, any>;
  trabNombre: string | null;
}

export async function construirComprobantePdf(data: ComprobanteData): Promise<Uint8Array> {
  const { sol, cmap, aprs, pmap, trabNombre } = data;
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fuentes = {
    regular: await doc.embedFont(StandardFonts.HelveticaOblique),
    regularItalic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await doc.embedPng(logoBytes());

  let y = 842 - M;

  const nuevaPagina = () => {
    page = doc.addPage([595, 842]);
    y = 842 - M;
  };
  const espacio = (min = 60) => {
    if (y < min) nuevaPagina();
  };

  // ---- Encabezado ----
  const docCod = DOCUMENTO_CODIGOS[sol.tipo];
  const tipoTxt = TIPO_LABELS[sol.tipo] ?? sol.tipo;
  const yBot = dibujarEncabezado(page, fuentes, logo, {
    pageWidth: 595, M, yTop: y,
    codigo: docCod?.codigo ?? '—',
    fecha: fechaCortaDDMMYYYY(new Date()),
    titulo: `Comprobante de solicitud - ${tipoTxt}`,
  });
  // Nota: antes había una línea celeste (#29abe2) acá, resabio del banner
  // viejo -- no existe en el encabezado de referencia, así que se sacó.
  y = yBot - 22;

  // ---- Helpers de texto ----
  const kv = (k: string, v: string) => {
    espacio();
    page.drawText(k, { x: M, y, size: 10, font: bold, color: GRIS });
    page.drawText(v || '—', { x: 210, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 16;
  };
  const seccion = (titulo: string) => {
    espacio(80);
    y -= 4;
    page.drawText(titulo, { x: M, y, size: 12, font: bold, color: NAVY });
    y -= 18;
  };
  const sep = () => {
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: 545, y: y + 6 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
    y -= 12;
  };

  // ---- Datos generales ----
  kv('Estado', String(sol.estado ?? '—').toUpperCase());
  kv('Folio', sol.folio ?? '—');
  kv('N° de solicitud', sol.codigo ?? '—');
  kv('Solicitante', pmap.get(sol.solicitante_id)?.nombre ?? '—');
  if (sol.tipo === 'traslado') {
    kv('Trabajador', trabNombre ?? '—');
    kv('Obra origen', cmap.get(sol.centro_origen_id)?.nombre ?? '—');
    kv('Obra destino', cmap.get(sol.centro_destino_id)?.nombre ?? '—');
  } else if (sol.tipo === 'ingreso') {
    kv('Centro solicitado', cmap.get(sol.centro_origen_id)?.nombre ?? '—');
  } else {
    kv('Trabajador', trabNombre ?? '—');
    kv('Centro de costo', cmap.get(sol.centro_origen_id)?.nombre ?? '—');
  }
  kv('Creada', (sol.created_at ?? '').toString().slice(0, 10));
  kv('Fecha de emisión', new Date().toLocaleDateString('es-CL'));
  sep();

  // ---- Detalle ----
  seccion('Detalle');
  const lineas = detalleLineas(sol);
  if (!lineas.length) kv('', 'Sin detalle.');
  for (const [k, v] of lineas) kv(k, v);
  if (sol.motivo) kv('Motivo', String(sol.motivo));
  sep();

  // ---- Aprobaciones (tabla) ----
  seccion('Aprobaciones');
  if (!aprs.length) {
    kv('', 'Sin aprobadores asignados.');
  } else {
    const cols = [
      { x: M, w: 20, label: '#' },
      { x: M + 20, w: 140, label: 'Aprobador' },
      { x: M + 160, w: 70, label: 'Decisión' },
      { x: M + 230, w: 105, label: 'Asignado' },
      { x: M + 335, w: 105, label: 'Decidido' },
      { x: M + 440, w: 65, label: 'T. resp.' },
    ];
    espacio(100);
    cols.forEach((c) => page.drawText(c.label, { x: c.x, y, size: 8, font: bold, color: GRIS }));
    y -= 4;
    page.drawLine({ start: { x: M, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
    y -= 13;

    const dur = (ms: number | null) => {
      if (ms == null || isNaN(ms)) return '—';
      const h = ms / 3600000;
      if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
      if (h < 48) return (Math.round(h * 10) / 10) + ' h';
      return (Math.round((h / 24) * 10) / 10) + ' d';
    };
    const fechaHora = (iso: string | null) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    for (const a of aprs.sort((x: any, z: any) => x.orden - z.orden)) {
      espacio(60);
      const ms = a.tiempo_respuesta != null
        ? a.tiempo_respuesta * 1000
        : (a.decidido_at && a.asignado_at ? new Date(a.decidido_at).getTime() - new Date(a.asignado_at).getTime() : null);
      const vals = [
        String(a.orden),
        (pmap.get(a.aprobador_id)?.nombre ?? '—').slice(0, 24),
        String(a.decision ?? 'pendiente'),
        fechaHora(a.asignado_at),
        a.decidido_at ? fechaHora(a.decidido_at) : '—',
        dur(ms),
      ];
      cols.forEach((c, i) => page.drawText(vals[i], { x: c.x, y, size: 8.5, font, color: rgb(0, 0, 0) }));
      y -= 14;
    }
  }

  // ---- Pie ----
  const piePagina = (p: PDFPage) => {
    p.drawText(
      `Metalium · Documento generado por el sistema · ${new Date().toLocaleDateString('es-CL')}`,
      { x: M, y: 30, size: 8, font, color: GRIS }
    );
  };
  doc.getPages().forEach(piePagina);

  return doc.save();
}
