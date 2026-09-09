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

/**
 * Fecha en que una solicitud terminó de aprobarse (la más tardía entre sus
 * aprobaciones con decision='aprobado') -- inicio del plazo de RRHH en el
 * dashboard "SLA Contratación". Solo tiene sentido para solicitudes que ya
 * están con estado='aprobada' (ahí todas sus aprobaciones son 'aprobado').
 */
export function fechaAprobacionCompleta(sol) {
  const decididas = (sol.aprobaciones || []).filter(a => a.decision === 'aprobado' && a.decidido_at);
  if (!decididas.length) return null;
  return decididas.reduce((max, a) => (!max || a.decidido_at > max) ? a.decidido_at : max, null);
}

/**
 * Agrupa filas de un dashboard de SLA por una clave (tipo, responsable...) y
 * calcula sus métricas agregadas (total, en curso, atrasadas, promedio de
 * días hábiles, cumplimiento). Cada fila debe traer {finalizado, dias}.
 */
export function agregarPorClave(filas, slaDias, keyFn, labelFn) {
  const grupos = new Map();
  filas.forEach(f => {
    const key = keyFn(f);
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(f);
  });
  return [...grupos.entries()].map(([key, items]) => {
    const finalizadasG = items.filter(f => f.finalizado);
    const enCursoG = items.filter(f => !f.finalizado);
    const atrasadasG = enCursoG.filter(f => f.dias > slaDias);
    const cumplidasG = finalizadasG.filter(f => f.dias <= slaDias);
    const promedioG = finalizadasG.length
      ? Math.round((finalizadasG.reduce((acc, f) => acc + f.dias, 0) / finalizadasG.length) * 10) / 10
      : null;
    const cumplimientoG = finalizadasG.length ? pct(cumplidasG.length, finalizadasG.length) : null;
    return {
      key, label: labelFn(key),
      total: items.length, enCurso: enCursoG.length, atrasadas: atrasadasG.length,
      promedio: promedioG, cumplimiento: cumplimientoG
    };
  }).sort((a, b) => {
    if (b.atrasadas !== a.atrasadas) return b.atrasadas - a.atrasadas;
    const pa = a.promedio == null ? -1 : a.promedio, pb = b.promedio == null ? -1 : b.promedio;
    return pb !== pa ? pb - pa : b.total - a.total;
  });
}
