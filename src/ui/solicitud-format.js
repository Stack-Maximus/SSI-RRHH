/**
 * Helpers de presentación compartidos por las vistas de solicitudes.
 */

import { escapeHtml } from './utils.js';
import { TIPO_SOLICITUD_META } from '../config.js';

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
  const d = new Date(iso);
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
      return `${escapeHtml(trab())} · ${d.sueldo_actual != null ? pesos(d.sueldo_actual) : '—'} → ${d.sueldo_nuevo != null ? pesos(d.sueldo_nuevo) : '—'}`;
    case 'bono':
      return `${escapeHtml(trab())} · ${escapeHtml(d.tipo_bono || 'Bono')}${d.monto != null ? ' · ' + pesos(d.monto) : ''}`;
    case 'cambio_cargo':
      return `${escapeHtml(trab())} · ${escapeHtml(d.cargo_actual || '—')} → ${escapeHtml(d.cargo_nuevo || '—')}`;
    case 'renovacion':
      return `${escapeHtml(trab())} · ${d.indefinido ? 'pasa a indefinido' : 'hasta ' + escapeHtml(d.nueva_fecha_termino || d.nuevo_plazo || '—')}`;
    case 'desvinculacion':
      return `${escapeHtml(trab())} · ${escapeHtml(d.causal || 'Desvinculación')}${d.fecha_desvinculacion ? ' · ' + escapeHtml(d.fecha_desvinculacion) : ''}`;
    default:
      return escapeHtml(trab());
  }
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
        ['Horario', d.horario],
        ['Fecha de ingreso', d.fecha_ingreso],
        ['Cliente', d.cliente]
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
        ['Bono nocturno', d.bono_nocturno?.aplica ? `Sí (${d.bono_nocturno.porcentaje ?? '—'} · ${d.bono_nocturno.periodo ?? '—'})` : 'No'],
        ['Bono trato', d.bono_trato?.aplica ? `Sí (${d.bono_trato.monto != null ? pesos(d.bono_trato.monto) : '—'} · ${d.bono_trato.dias_asignacion ?? '—'} días)` : 'No']
      ];
      break;
    case 'aumento_sueldo':
      pares = [
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
    case 'renovacion':
      pares = [
        ['Fecha de término actual', d.fecha_termino_actual],
        ['Nueva condición', d.indefinido ? 'Pasa a indefinido (sin fecha de término)' : null],
        ['Nueva fecha de término', d.indefinido ? null : d.nueva_fecha_termino],
        ['Nuevo plazo', d.indefinido ? null : d.nuevo_plazo],
        ['Motivo', d.motivo]
      ];
      break;
    case 'desvinculacion':
      pares = [
        ['Causal', d.causal],
        ['Fecha de desvinculación', d.fecha_desvinculacion],
        ['Observaciones', d.observaciones]
      ];
      break;
    default:
      pares = [];
  }
  return pares.filter(([, v]) => v !== null && v !== undefined && v !== '');
}

/** Detalle completo (campos del JSONB) según tipo, como lista de definiciones (HTML) */
export function detalleHtml(sol) {
  const items = detallePares(sol)
    .map(([k, v]) => `<div class="dl-row"><span class="dl-k">${k}</span><span class="dl-v">${escapeHtml(String(v))}</span></div>`)
    .join('');
  return `<div class="dl">${items || '<span class="muted">Sin detalle.</span>'}</div>`;
}

/** Detalle completo, como texto plano de una línea (para exportar a Excel) */
export function detalleTexto(sol) {
  return detallePares(sol).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
}
