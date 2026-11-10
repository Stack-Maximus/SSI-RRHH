/**
 * PDF del Comprobante y del Maestro de solicitudes generados EN EL NAVEGADOR
 * (nov. 2026). Antes los entregaban las Edge Functions comprobante-pdf y
 * maestro-pdf, y si la versión desplegada en Supabase quedaba atrasada el
 * PDF salía con el diseño viejo aunque la pantalla mostrara el nuevo. Ahora
 * se usan exactamente los mismos archivos que dibujan la vista previa
 * (sgc-documentos.js + sgc-layout.js) y el mismo pintor PDF de las Edge
 * Functions (_shared/sgc-pdf.ts, con pdf-lib y las fuentes incrustadas):
 * lo que se ve es lo que se descarga.
 *
 * pdf-lib, las fuentes y el logo se cargan recién al apretar "Descargar"
 * (import dinámico), así no pesan en la carga normal de la app. Los
 * "npm:pdf-lib@..." de los archivos de Deno los resuelve vite.config.js.
 *
 * Nombre del archivo: "<código del documento> - <N° de folio>.pdf"
 * (ej. "RRH-FOR-TRA-002 - RRH-TRA-000005.pdf"); el Maestro, que no tiene
 * folio, lleva la fecha: "RRH-FOR-SOL-001 - 09-11-2026.pdf".
 */

import { DOCUMENTO_CODIGOS, MAESTRO_SOLICITUDES_CODIGO } from '../../supabase/functions/_shared/solicitud-detalle.ts';
import { esAprobacionAutomatica } from '../../supabase/functions/_shared/sgc-documentos.js';

const limpiarNombre = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

export function nombreComprobante(sol) {
  const codigo = DOCUMENTO_CODIGOS[sol?.tipo]?.codigo || 'RRH';
  const folio = sol?.folio || sol?.codigo || 'sin folio';
  return limpiarNombre(`${codigo} - ${folio}`) + '.pdf';
}

export function nombreMaestro(fecha = new Date()) {
  const dmy = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(fecha).replace(/\//g, '-');
  return `${MAESTRO_SOLICITUDES_CODIGO} - ${dmy}.pdf`;
}

function descargarBytes(bytes, nombre) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Comprobante de una solicitud. Recibe los mismos datos que usa la vista previa. */
export async function descargarComprobantePdf({ sol, cmap, aprs, pmap, trabNombre }) {
  const { construirComprobantePdf } = await import('../../supabase/functions/_shared/pdf-comprobante.ts');
  const bytes = await construirComprobantePdf({ sol, cmap, aprs, pmap, trabNombre });
  descargarBytes(bytes, nombreComprobante(sol));
}

// Igual que dur() de supabase/functions/maestro-pdf/index.ts
function dur(ms) {
  if (ms == null || isNaN(ms)) return '';
  const h = ms / 3600000;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
  if (h < 48) return (Math.round(h * 10) / 10) + ' h';
  return (Math.round((h / 24) * 10) / 10) + ' d';
}

/**
 * Maestro de solicitudes. Arma las mismas filas que la Edge Function
 * maestro-pdf a partir de lo que ya cargó la vista Solicitudes:
 *  - sols: solicitudes con sus .aprobaciones (Data.listTodasSolicitudes)
 *  - centros: Map id -> centro; trab: Map id -> trabajador; perfiles: Map id -> perfil
 */
export async function descargarMaestroPdf({ sols, centros, trab, perfiles }) {
  const FECHA_CHILE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' });
  const filas = [...sols]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((s) => {
      const propias = s.aprobaciones || [];
      const aprobadas = propias.filter((a) => a.decision === 'aprobado').length;
      const totalMs = propias.reduce((acc, a) => {
        const ms = a.tiempo_respuesta != null
          ? a.tiempo_respuesta * 1000
          : (a.decidido_at && a.asignado_at ? new Date(a.decidido_at).getTime() - new Date(a.asignado_at).getTime() : 0);
        return acc + (ms || 0);
      }, 0);
      return {
        folio: s.folio,
        codigo: s.codigo,
        tipo: s.tipo,
        estado: s.estado,
        solicitante: perfiles.get(s.solicitante_id)?.nombre ?? '—',
        trabajador: s.trabajador_id ? (trab.get(s.trabajador_id)?.nombre ?? '—') : '',
        centro: centros.get(s.centro_origen_id)?.nombre ?? '',
        creada: s.created_at ? FECHA_CHILE.format(new Date(s.created_at)) : '',
        aprobResumen: propias.length && propias.every(esAprobacionAutomatica) ? 'Automática'
          : propias.length ? `${aprobadas}/${propias.length} · ${dur(totalMs) || '—'}` : 'Sin aprob.',
      };
    });
  const { construirMaestroPdf } = await import('../../supabase/functions/_shared/pdf-maestro.ts');
  const bytes = await construirMaestroPdf(filas);
  descargarBytes(bytes, nombreMaestro());
}
