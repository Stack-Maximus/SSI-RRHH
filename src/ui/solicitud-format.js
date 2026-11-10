/**
 * Helpers de presentación compartidos por las vistas de solicitudes.
 *
 * Los formularios cambiaron en oct. 2026 (ver nueva-solicitud.js), pero acá
 * se siguen mostrando también los campos antiguos (Horario, sueldos y bonos
 * de traslado, sueldo actual/nuevo de aumento, etc.): las solicitudes ya
 * creadas los tienen guardados y no se reescriben. Como detallePares() omite
 * los valores vacíos, una solicitud nueva simplemente no muestra esas filas.
 * Espejo en Deno: supabase/functions/_shared/solicitud-detalle.ts.
 */

import { escapeHtml } from './utils.js';
import { state } from '../core/state.js';
import { TIPO_SOLICITUD_META, TIPO_RENOVACION_LABELS } from '../config.js';
import { esAprobacionAutomatica } from '../../supabase/functions/_shared/sgc-documentos.js';

export { esAprobacionAutomatica };
/** Etiqueta de una etapa de aprobación en las filas ("Aprobador 2" o "Aprobación automática"). */
export const etiquetaEtapa = (a) => (esAprobacionAutomatica(a) ? 'Aprobación automática' : `Aprobador ${a.orden}`);
import { Data } from '../db/data.js';
import { Toast } from './toast.js';

export function estadoBadge(estado) {
  const map = {
    pendiente: ['badge-warning', 'Pendiente'],
    aprobada:  ['badge-success', 'Aprobada'],
    rechazada: ['badge-danger',  'Rechazada'],
    borrador:  ['badge-neutral', 'Borrador']
  };
  const [cls, label] = map[estado] || ['badge-neutral', estado];
  return `<span class="badge ${cls}">${label}</span>`;
}

export function decisionBadge(decision) {
  const map = {
    pendiente: ['badge-warning', 'Pendiente'],
    aprobado:  ['badge-success', 'Aprobado'],
    rechazado: ['badge-danger',  'Rechazado']
  };
  const [cls, label] = map[decision] || ['badge-neutral', decision];
  return `<span class="badge ${cls}">${label}</span>`;
}

export function tipoLabel(tipo) {
  const m = TIPO_SOLICITUD_META[tipo];
  return m ? `${m.icon} ${m.label}` : (tipo || '—');
}

export function fechaCorta(iso) {
  if (!iso) return '';
  // Una fecha sola ('YYYY-MM-DD') se lee en hora local: new Date('2026-11-02')
  // la toma como medianoche UTC y en Chile mostraba el día anterior.
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.exec(String(iso));
  const d = soloFecha ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function pesos(n) {
  if (n == null || n === '') return '';
  return '$' + Number(n).toLocaleString('es-CL');
}

/** Resumen de una línea para la tarjeta */
export function resumen(sol, centrosMap, trabMap) {
  const cen = (id) => (centrosMap.get(id)?.nombre || '—');
  const d = sol.detalle || {};
  const trab = () => trabMap.get(sol.trabajador_id)?.nombre || 'Trabajador';
  switch (sol.tipo) {
    case 'ingreso': {
      const cargo = d.cargo || 'Cargo';
      const cant = d.cantidad || 1;
      return `${escapeHtml(cargo)} × ${cant} · ${escapeHtml(cen(sol.centro_origen_id))}`;
    }
    case 'traslado':
      return `${escapeHtml(trab())} · ${escapeHtml(cen(sol.centro_origen_id))} → ${escapeHtml(cen(sol.centro_destino_id))}`;
    case 'aumento_sueldo':
      if (d.monto_aumento != null) return `${escapeHtml(trab())} · aumento de ${pesos(d.monto_aumento)}${d.fecha_efectiva ? ' desde el ' + escapeHtml(fechaCorta(d.fecha_efectiva)) : ''}`;
      return `${escapeHtml(trab())} · ${d.sueldo_actual != null ? pesos(d.sueldo_actual) : '—'} → ${d.sueldo_nuevo != null ? pesos(d.sueldo_nuevo) : '—'}`;
    case 'bono':
      return `${escapeHtml(trab())} · ${escapeHtml(d.tipo_bono || 'Bono')}${d.monto != null ? ' · ' + pesos(d.monto) : ''}`;
    case 'cambio_cargo':
      return `${escapeHtml(trab())} · ${escapeHtml(d.cargo_actual || '—')} → ${escapeHtml(d.cargo_nuevo || '—')}`;
    case 'cambio_turno':
      return `${escapeHtml(trab())} · nuevo turno: ${escapeHtml(d.turno_nuevo || '—')}`;
    case 'renovacion':
      if (d.tipo_renovacion === 'obra_faena') return `${escapeHtml(trab())} · por obra o faena: ${escapeHtml(d.hito_obra || '—')}`;
      return `${escapeHtml(trab())} · ${d.indefinido ? 'pasa a indefinido' : 'hasta ' + escapeHtml(d.nueva_fecha_termino || d.nuevo_plazo || '—')}`;
    case 'desvinculacion':
      return `${escapeHtml(trab())} · ${escapeHtml(d.causal || 'Desvinculación')}${d.fecha_desvinculacion ? ' · ' + escapeHtml(fechaCorta(d.fecha_desvinculacion)) : ''}`;
    default:
      return escapeHtml(trab());
  }
}

/**
 * Descripción legible de una solicitud de INGRESO (nov. 2026, a pedido):
 * se usa donde antes solo aparecía el código (candidatos que envía RRHH,
 * tarjetas de Contratación), porque "SSI-RRHH-2026-0003" no dice de qué
 * vacante se trata. Ej.: "Maestro Albañil · 2 vacantes · Obra 25 LIRAY ·
 * ingreso desde el 15-11-2026". Devuelve HTML ya escapado.
 */
export function descripcionIngreso(sol, centrosMap) {
  if (!sol) return 'solicitud de ingreso';
  const d = sol.detalle || {};
  const cant = Number(d.cantidad) || 1;
  const c = centrosMap?.get(sol.centro_origen_id);
  const nombreObra = c?.nombre ? String(c.nombre) : '';
  const obra = c ? `Obra ${c.codigo ?? ''}${nombreObra ? ' ' + (nombreObra.length > 60 ? nombreObra.slice(0, 59) + '…' : nombreObra) : ''}`.trim() : '';
  return [
    escapeHtml(d.cargo || 'Cargo sin indicar'),
    `${cant} vacante${cant === 1 ? '' : 's'}`,
    obra ? escapeHtml(obra) : null,
    d.fecha_ingreso ? `ingreso desde el ${escapeHtml(fechaCorta(d.fecha_ingreso))}` : null
  ].filter(Boolean).join(' · ');
}

/** Pares [etiqueta, valor] del detalle (JSONB) según tipo. Base compartida de detalleHtml() y detalleTexto(). */
export function detallePares(sol) {
  const d = sol.detalle || {};
  let pares;
  switch (sol.tipo) {
    case 'ingreso':
      pares = [
        ['Cargo', d.cargo],
        ['Cantidad', d.cantidad],
        ['Sueldo líquido', d.sueldo_liquido != null ? pesos(d.sueldo_liquido) : null],
        ['Tipo de contrato', d.tipo_contrato],
        ['Plazo', d.plazo],
        ['Turno', d.turno],
        ['Horario de colación', d.colacion],
        ['Horario', d.horario],
        ['Fecha de ingreso', d.fecha_ingreso],
        ['Cliente', d.cliente],
        [ETIQUETA_CVS, cvsDe(sol).length ? `${cvsDe(sol).length} archivo${cvsDe(sol).length === 1 ? '' : 's'}` : null]
      ];
      break;
    case 'traslado':
      pares = [
        ['Cargo', d.cargo],
        ['Fecha de traslado', d.fecha_traslado],
        ['Modificaciones', d.modificaciones_contractuales],
        ['Turno', d.turno],
        ['Horario', d.horario],
        ['Sueldo líquido actual', d.sueldo_liquido_actual != null ? pesos(d.sueldo_liquido_actual) : null],
        ['Nuevo sueldo líquido', d.nuevo_sueldo_liquido != null ? pesos(d.nuevo_sueldo_liquido) : null],
        // Bonos: solo traslados antiguos los tienen (el formulario ya no los pide).
        ['Bono nocturno', !d.bono_nocturno ? null : d.bono_nocturno.aplica ? `Sí (${d.bono_nocturno.porcentaje ?? '—'} · ${d.bono_nocturno.periodo ?? '—'})` : 'No'],
        ['Bono trato', !d.bono_trato ? null : d.bono_trato.aplica ? `Sí (${d.bono_trato.monto != null ? pesos(d.bono_trato.monto) : '—'} · ${d.bono_trato.dias_asignacion ?? '—'} días)` : 'No']
      ];
      break;
    case 'aumento_sueldo':
      pares = [
        ['Monto del aumento', d.monto_aumento != null ? pesos(d.monto_aumento) : null],
        ['Sueldo líquido actual', d.sueldo_actual != null ? pesos(d.sueldo_actual) : null],
        ['Nuevo sueldo líquido', d.sueldo_nuevo != null ? pesos(d.sueldo_nuevo) : null],
        ['Fecha efectiva', d.fecha_efectiva],
        ['Motivo', d.motivo]
      ];
      break;
    case 'bono':
      pares = [
        ['Tipo de bono', d.tipo_bono],
        ['Monto', d.monto != null ? pesos(d.monto) : null],
        ['Período / fecha', d.periodo],
        ['Motivo', d.motivo]
      ];
      break;
    case 'cambio_cargo':
      pares = [
        ['Cargo actual', d.cargo_actual],
        ['Cargo nuevo', d.cargo_nuevo],
        ['Fecha efectiva', d.fecha_efectiva],
        ['Motivo', d.motivo]
      ];
      break;
    case 'cambio_turno':
      pares = [
        ['Turno nuevo', d.turno_nuevo],
        ['Motivo', d.motivo]
      ];
      break;
    case 'renovacion':
      if (d.tipo_renovacion) {
        pares = [
          ['Tipo de contrato actual', d.tipo_contrato_actual],
          ['Fecha de término actual', d.fecha_termino_actual],
          ['Tipo de renovación', TIPO_RENOVACION_LABELS[d.tipo_renovacion] || d.tipo_renovacion],
          ['Fecha de culminación', d.tipo_renovacion === 'plazo' ? d.nueva_fecha_termino : null],
          ['Hito de la obra', d.tipo_renovacion === 'obra_faena' ? d.hito_obra : null],
          ['Motivo', d.motivo]
        ];
      } else {
        // Renovaciones creadas antes de oct. 2026 (sin tipo_renovacion).
        pares = [
          ['Fecha de término actual', d.fecha_termino_actual],
          ['Nueva condición', d.indefinido ? 'Pasa a indefinido (sin fecha de término)' : null],
          ['Nueva fecha de término', d.indefinido ? null : d.nueva_fecha_termino],
          ['Nuevo plazo', d.indefinido ? null : d.nuevo_plazo],
          ['Motivo', d.motivo]
        ];
      }
      break;
    case 'desvinculacion':
      pares = [
        ['Causal', d.causal],
        ['Fecha de desvinculación', d.fecha_desvinculacion],
        [ETIQUETA_ADJUNTO, d.adjunto?.nombre || (d.adjunto?.path ? 'Documento adjunto' : null)],
        ['Observaciones', d.observaciones]
      ];
      break;
    default:
      pares = [];
  }
  return pares.filter(([, v]) => v !== null && v !== undefined && v !== '');
}

const ETIQUETA_ADJUNTO = 'Documento adjunto';
const ETIQUETA_CVS = 'CV de candidatos';

/** CV que adjuntó quien solicitó el Ingreso (nov. 2026): [{ path, nombre, ... }]. */
export function cvsDe(sol) {
  const c = sol?.detalle?.cvs;
  return Array.isArray(c) ? c.filter(x => x?.path) : [];
}
/** ¿Puede abrir los CV? RRHH y admin, y quien creó la solicitud (Storage
 * aplica la misma regla: puede_ver_adjunto_solicitud, migración 0022). */
function puedeVerCvs(sol) {
  return ['rrhh', 'admin'].includes(state.user?.role) || sol?.solicitante_id === state.user?.id;
}
/**
 * Lista de CV como botones que abren cada archivo (URL firmada, ver
 * instalarVisorAdjuntos). A quien no los puede abrir solo se le dice cuántos
 * hay. Devuelve '' si la solicitud no trae CV.
 */
export function cvsHtml(sol, { titulo = true } = {}) {
  const cvs = cvsDe(sol);
  if (!cvs.length) return '';
  const encabezado = titulo ? `<div class="cv-titulo">📎 ${ETIQUETA_CVS} enviados por quien solicitó (${cvs.length})</div>` : '';
  if (!puedeVerCvs(sol)) return `${encabezado}<div class="muted">Los ve RRHH.</div>`;
  return `${encabezado}<div class="cv-docs">${cvs.map(c =>
    `<button type="button" class="link-btn" data-ver-adjunto="${escapeHtml(c.path)}" title="Abrir">📄 ${escapeHtml(c.nombre || 'CV')}</button>`).join('')}</div>`;
}

/** Detalle completo (campos del JSONB) según tipo, como lista de definiciones (HTML) */
export function detalleHtml(sol) {
  const path = sol.detalle?.adjunto?.path;
  const items = detallePares(sol)
    .map(([k, v]) => {
      // El adjunto se muestra como botón: abre una URL firmada de 5 minutos
      // (el bucket es privado, ver instalarVisorAdjuntos()).
      const valor = k === ETIQUETA_ADJUNTO && path
        ? `<button type="button" class="link-btn" data-ver-adjunto="${escapeHtml(path)}">📎 ${escapeHtml(String(v))}</button>`
        : k === ETIQUETA_CVS
          ? `<span class="cv-en-detalle">${cvsHtml(sol, { titulo: false }) || escapeHtml(String(v))}</span>`
          : escapeHtml(String(v));
      return `<div class="dl-row"><span class="dl-k">${k}</span><span class="dl-v">${valor}</span></div>`;
    })
    .join('');
  return `<div class="dl">${items || '<span class="muted">Sin detalle.</span>'}</div>`;
}

/** Detalle completo, como texto plano de una línea (para exportar a Excel) */
export function detalleTexto(sol) {
  return detallePares(sol).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
}

/**
 * Clic en cualquier [data-ver-adjunto] (botón que arma detalleHtml()): pide
 * una URL firmada del bucket privado 'solicitud-adjuntos' y la abre en otra
 * pestaña. Storage solo la entrega a quien puede ver esa solicitud (quien la
 * creó, sus aprobadores, RRHH y admin -- políticas de la migración 0022).
 * Se instala una sola vez desde main.js (delegado en document).
 */
export function instalarVisorAdjuntos() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest?.('[data-ver-adjunto]');
    if (!btn) return;
    e.preventDefault();
    // Se abre la pestaña ANTES del await para que el navegador no la bloquee
    // como ventana emergente; después se le asigna la URL.
    const win = window.open('', '_blank');
    try {
      const url = await Data.urlAdjuntoSolicitud(btn.dataset.verAdjunto);
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch (err) {
      console.error('[adjunto]', err);
      win?.close();
      Toast.error('No se pudo abrir el documento', err.message || '');
    }
  });
}
