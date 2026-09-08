/**
 * Helpers compartidos por los dashboards de SLA (SLA Contratación · RRHH y
 * SLA Homologación · Prevención): barras horizontales y badge de
 * cumplimiento según días hábiles transcurridos.
 */

import { escapeHtml } from './utils.js';

export function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; }

export function barras(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return `<div class="bars">${items.map(i => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(i.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct(i.value, max)}%"></div></div>
      <div class="bar-val">${i.value}</div>
    </div>`).join('')}</div>`;
}

/**
 * Badge de cumplimiento de SLA según días hábiles transcurridos.
 *   finalizado=true  -> el proceso ya terminó (cumplió el plazo o quedó fuera de plazo)
 *   finalizado=false -> sigue en curso (a tiempo, vence hoy, o ya atrasado)
 */
export function slaBadge(dias, finalizado, slaDias) {
  const etiqueta = `${dias} d.h.`;
  if (finalizado) {
    return dias <= slaDias
      ? `<span class="badge badge-success">Cumplió · ${etiqueta}</span>`
      : `<span class="badge badge-danger">Fuera de plazo · ${etiqueta}</span>`;
  }
  if (dias > slaDias) return `<span class="badge badge-danger">Atrasado · ${etiqueta}</span>`;
  if (dias === slaDias) return `<span class="badge badge-warning">Vence hoy · ${etiqueta}</span>`;
  return `<span class="badge badge-info">En curso · ${etiqueta}</span>`;
}

/** Orden para las tablas de detalle: primero lo urgente (en curso atrasado), luego en curso al día, luego finalizado fuera de plazo, luego finalizado a tiempo. */
export function prioridadFila(f, slaDias) {
  if (!f.finalizado && f.dias > slaDias) return 0;
  if (!f.finalizado) return 1;
  if (f.dias > slaDias) return 2;
  return 3;
}
