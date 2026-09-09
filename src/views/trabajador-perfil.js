/**
 * "Perfil del trabajador" · datos base + próximo vencimiento de contrato +
 * historial de solicitudes/anexos hechos sobre él (traslado, aumento de
 * sueldo, bono, cambio de cargo, renovación). Cada anexo linkea a su
 * comprobante. Se llega acá desde "Trabajadores" (drill-down, no es una
 * vista propia del router).
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { estadoBadge, decisionBadge, tipoLabel, fechaCorta, resumen, pesos } from '../ui/solicitud-format.js';
import { renderComprobante } from './comprobante.js';

function diasHasta(fechaISO) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(fechaISO + 'T00:00:00');
  return Math.round((f - hoy) / 86400000);
}

function vencimientoHtml(t) {
  if (t.contrato_indefinido) return '<span class="badge badge-success">Indefinido</span>';
  if (!t.fecha_termino_contrato) return '<span class="badge badge-neutral">Sin registrar</span>';
  const dias = diasHasta(t.fecha_termino_contrato);
  const fecha = fechaCorta(t.fecha_termino_contrato);
  if (dias < 0) return `<span class="badge badge-danger">Vencido · ${fecha}</span>`;
  if (dias <= 15) return `<span class="badge badge-danger">${fecha} · en ${dias} día(s)</span>`;
  if (dias <= 30) return `<span class="badge badge-warning">${fecha} · en ${dias} día(s)</span>`;
  return `<span class="badge badge-neutral">${fecha}</span>`;
}

export async function renderTrabajadorPerfil(container, trabajadorId, backView) {
  container.innerHTML = '<div class="view-loading">Cargando perfil...</div>';

  let t, sols, centros, perfiles;
  try {
    [t, sols, centros] = await Promise.all([
      Data.trabajadorPorId(trabajadorId),
      Data.solicitudesDeTrabajador(trabajadorId),
      Data.listCentrosAdmin()
    ]);
    perfiles = await Data.perfilesPorId(sols.map(s => s.solicitante_id));
  } catch (e) {
    console.error('[trabajador-perfil]', e);
    Toast.error('Error', 'No se pudo cargar el perfil del trabajador.');
    container.innerHTML = `<button class="link-btn" id="volver">← Volver</button><div class="empty-state">No se pudo cargar el perfil.</div>`;
    container.querySelector('#volver').addEventListener('click', () => window.Router.go(backView));
    return;
  }

  const centrosMap = new Map(centros.map(c => [c.id, c]));
  const centro = centrosMap.get(t.centro_costo_id);

  const timeline = sols.map(s => {
    const solicitante = perfiles.get(s.solicitante_id)?.nombre || '—';
    const steps = (s.aprobaciones || []).map(a => `<div class="sol-step">Aprobador ${a.orden} ${decisionBadge(a.decision)}</div>`).join('');
    return `
      <div class="sol-card" data-sol="${s.id}">
        <div class="sol-card-top">
          <span class="sol-id">${escapeHtml(s.codigo || '—')}</span>
          <span class="sol-tipo">${tipoLabel(s.tipo)}</span>
          ${estadoBadge(s.estado)}
        </div>
        <div class="sol-resumen">${resumen(s, centrosMap, new Map())}</div>
        <div class="sol-steps">${steps || '<span class="muted">Sin aprobadores asignados</span>'}</div>
        <div class="sol-foot">
          <span class="muted">Solicitado por ${escapeHtml(solicitante)} · ${fechaCorta(s.created_at)}</span>
          <button class="link-btn" data-comprobante="${s.id}">📄 Ver comprobante</button>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <button class="link-btn" id="volver">← Volver</button>
    <div class="detalle-head">
      <span class="sol-id">${escapeHtml(t.nombre)}</span>
      ${t.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-neutral">Inactivo</span>'}
    </div>

    <div class="card">
      <h3>Datos del trabajador</h3>
      <div class="dl">
        <div class="dl-row"><span class="dl-k">RUT</span><span class="dl-v">${escapeHtml(t.rut || '—')}</span></div>
        <div class="dl-row"><span class="dl-k">Cargo</span><span class="dl-v">${escapeHtml(t.cargo || '—')}</span></div>
        <div class="dl-row"><span class="dl-k">Profesión</span><span class="dl-v">${escapeHtml(t.profesion || '—')}</span></div>
        <div class="dl-row"><span class="dl-k">Centro de costo</span><span class="dl-v">${escapeHtml(centro?.nombre || '—')}</span></div>
        <div class="dl-row"><span class="dl-k">Sueldo líquido pactado</span><span class="dl-v">${t.sueldo_liquido != null ? pesos(t.sueldo_liquido) : '—'}</span></div>
        <div class="dl-row"><span class="dl-k">Tipo de contrato</span><span class="dl-v">${escapeHtml(t.tipo_contrato || '—')}</span></div>
        <div class="dl-row"><span class="dl-k">Vencimiento de contrato</span><span class="dl-v">${vencimientoHtml(t)}</span></div>
        ${t.requiere_anexo_renovacion ? `<div class="dl-row"><span class="dl-k">Anexo de renovación</span><span class="dl-v"><span class="badge badge-danger">Pendiente -- bloquea traslado</span></span></div>` : ''}
      </div>
    </div>

    <div class="card">
      <h3>Solicitudes y anexos (${sols.length})</h3>
      ${timeline ? `<div class="sol-grid">${timeline}</div>` : '<span class="muted">Todavía no hay solicitudes registradas para este trabajador.</span>'}
    </div>
  `;

  container.querySelector('#volver').addEventListener('click', () => window.Router.go(backView));
  container.querySelectorAll('[data-comprobante]').forEach(btn => {
    btn.addEventListener('click', () => renderComprobante(
      container, btn.dataset.comprobante,
      () => renderTrabajadorPerfil(container, trabajadorId, backView)
    ));
  });
}
