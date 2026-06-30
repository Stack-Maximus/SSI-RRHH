/**
 * Helpers de presentación compartidos por las vistas de solicitudes.
 */

import { escapeHtml } from './utils.js';

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
  return tipo === 'traslado' ? '🔁 Traslado' : '➕ Ingreso';
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
  if (sol.tipo === 'ingreso') {
    const cargo = d.cargo || 'Cargo';
    const cant = d.cantidad || 1;
    return `${escapeHtml(cargo)} × ${cant} · ${escapeHtml(cen(sol.centro_origen_id))}`;
  }
  const trab = trabMap.get(sol.trabajador_id)?.nombre || 'Trabajador';
  return `${escapeHtml(trab)} · ${escapeHtml(cen(sol.centro_origen_id))} → ${escapeHtml(cen(sol.centro_destino_id))}`;
}

/** Detalle completo (campos del JSONB) según tipo, como lista de definiciones */
export function detalleHtml(sol) {
  const d = sol.detalle || {};
  let pares;
  if (sol.tipo === 'ingreso') {
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
  } else {
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
  }
  const items = pares
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<div class="dl-row"><span class="dl-k">${k}</span><span class="dl-v">${escapeHtml(String(v))}</span></div>`)
    .join('');
  return `<div class="dl">${items || '<span class="muted">Sin detalle.</span>'}</div>`;
}
