/**
 * Vista "Mis solicitudes" · las solicitudes que creó el usuario, con su estado
 * y el avance de las aprobaciones.
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { estadoBadge, decisionBadge, tipoLabel, fechaCorta, resumen } from '../ui/solicitud-format.js';
import { renderComprobante } from './comprobante.js';

export async function renderMisSolicitudes(container) {
  container.innerHTML = '<div class="view-loading">Cargando...</div>';

  let sols, centrosMap, trabMap;
  try {
    const [misSol, centros] = await Promise.all([Data.misSolicitudes(state.user.id), Data.centros()]);
    sols = misSol;
    centrosMap = new Map(centros.map(c => [c.id, c]));
    trabMap = await Data.trabajadoresPorId(sols.map(s => s.trabajador_id));
  } catch (e) {
    console.error('[mis-solicitudes]', e);
    Toast.error('Error', 'No se pudieron cargar tus solicitudes.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar las solicitudes.</div>';
    return;
  }

  if (!sols.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="placeholder-icon">📄</div>
        <p>Todavía no creaste solicitudes.</p>
        <button class="btn btn-primary" id="ir-nueva">Crear una solicitud</button>
      </div>`;
    container.querySelector('#ir-nueva')?.addEventListener('click', () => window.Router.go('nueva-solicitud'));
    return;
  }

  const cards = sols.map(s => {
    const steps = (s.aprobaciones || []).map(a =>
      `<div class="sol-step">Aprobador ${a.orden} ${decisionBadge(a.decision)}</div>`
    ).join('');
    return `
      <div class="sol-card" data-sol="${s.id}">
        <div class="sol-card-top">
          <span class="sol-id">${s.codigo || '—'}</span>
          <span class="sol-tipo">${tipoLabel(s.tipo)}</span>
          ${estadoBadge(s.estado)}
        </div>
        <div class="sol-resumen">${resumen(s, centrosMap, trabMap)}</div>
        <div class="sol-steps">${steps || '<span class="muted">Sin aprobadores asignados</span>'}</div>
        <div class="sol-foot">
          <span class="muted">Creada el ${fechaCorta(s.created_at)}</span>
          <button class="link-btn" data-comprobante="${s.id}">📄 Ver comprobante</button>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="sol-toolbar">
      <span class="muted">${sols.length} solicitud(es)</span>
      <button class="btn btn-primary" id="ir-nueva">Nueva solicitud</button>
    </div>
    <div class="sol-grid">${cards}</div>`;

  container.querySelector('#ir-nueva')?.addEventListener('click', () => window.Router.go('nueva-solicitud'));
  container.querySelectorAll('[data-comprobante]').forEach(btn => {
    btn.addEventListener('click', () => renderComprobante(container, btn.dataset.comprobante, 'mis-solicitudes'));
  });
}
