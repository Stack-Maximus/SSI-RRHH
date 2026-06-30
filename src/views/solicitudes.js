/**
 * Vista "Solicitudes" (RRHH / admin) · todas las solicitudes del sistema,
 * con filtro por estado, búsqueda y detalle expandible.
 * Reutilizable para "Historial" (solo finalizadas) vía el parámetro fijo.
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { estadoBadge, decisionBadge, tipoLabel, fechaCorta, resumen, detalleHtml } from '../ui/solicitud-format.js';

let _sols = [], _centros, _trab, _perfiles;

export function renderSolicitudes(container) {
  return cargar(container, { soloFinalizadas: false, titulo: 'Todas las solicitudes' });
}
export function renderHistorial(container) {
  return cargar(container, { soloFinalizadas: true, titulo: 'Solicitudes finalizadas' });
}

async function cargar(container, opts) {
  container.innerHTML = '<div class="view-loading">Cargando solicitudes...</div>';
  try {
    const [sols, centros] = await Promise.all([Data.listTodasSolicitudes(), Data.listCentrosAdmin()]);
    _sols = opts.soloFinalizadas ? sols.filter(s => s.estado === 'aprobada' || s.estado === 'rechazada') : sols;
    _centros = new Map(centros.map(c => [c.id, c]));
    [_trab, _perfiles] = await Promise.all([
      Data.trabajadoresPorId(_sols.map(s => s.trabajador_id)),
      Data.perfilesPorId(_sols.map(s => s.solicitante_id))
    ]);
  } catch (e) {
    console.error('[solicitudes]', e);
    Toast.error('Error', 'No se pudieron cargar las solicitudes.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar las solicitudes.</div>';
    return;
  }

  const tabs = opts.soloFinalizadas
    ? [['todas', 'Todas'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']]
    : [['todas', 'Todas'], ['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']];

  container.innerHTML = `
    <div class="sol-toolbar">
      <div class="filter-tabs" id="filtros">
        ${tabs.map((t, i) => `<button class="filter-tab ${i === 0 ? 'active' : ''}" data-f="${t[0]}">${t[1]}</button>`).join('')}
      </div>
      <input type="search" id="buscar" class="search-box" placeholder="Buscar código o solicitante...">
    </div>
    <div id="sol-list"></div>`;

  let filtro = 'todas', q = '';
  const pintar = () => {
    const list = _sols.filter(s => {
      if (filtro !== 'todas' && s.estado !== filtro) return false;
      if (q) {
        const sol = (_perfiles.get(s.solicitante_id)?.nombre || '').toLowerCase();
        const txt = (s.codigo || '').toLowerCase() + ' ' + sol;
        if (!txt.includes(q)) return false;
      }
      return true;
    });
    document.getElementById('sol-list').innerHTML = list.length ? grid(list) : '<div class="empty-state">No hay solicitudes que coincidan.</div>';
    wireDetalles();
  };

  container.querySelectorAll('#filtros .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#filtros .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtro = btn.dataset.f;
      pintar();
    });
  });
  container.querySelector('#buscar').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); pintar(); });

  pintar();
}

function grid(list) {
  return `<div class="sol-grid">${list.map(card).join('')}</div>`;
}

function card(s) {
  const solicitante = _perfiles.get(s.solicitante_id)?.nombre || '—';
  const aprob = (s.aprobaciones || []).filter(a => a.decision === 'aprobado').length;
  const total = (s.aprobaciones || []).length;
  const steps = (s.aprobaciones || []).map(a => `<div class="sol-step">Aprobador ${a.orden} ${decisionBadge(a.decision)}</div>`).join('');
  return `
    <div class="sol-card">
      <div class="sol-card-top">
        <span class="sol-id">${s.codigo || '—'}</span>
        <span class="sol-tipo">${tipoLabel(s.tipo)}</span>
        ${estadoBadge(s.estado)}
      </div>
      <div class="sol-resumen">${resumen(s, _centros, _trab)}</div>
      <div class="sol-detalle muted">Solicitante: ${escapeHtml(solicitante)} · ${fechaCorta(s.created_at)} · ${aprob}/${total} aprobada(s)</div>
      <button class="link-btn" data-toggle>Ver detalle ▾</button>
      <div class="sol-expand" hidden>
        ${detalleHtml(s)}
        <div class="sol-steps" style="margin-top:10px;">${steps || '<span class="muted">Sin aprobadores</span>'}</div>
        ${s.motivo ? `<div class="sol-motivo">"${escapeHtml(s.motivo)}"</div>` : ''}
      </div>
    </div>`;
}

function wireDetalles() {
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.nextElementSibling;
      const abierto = !panel.hidden;
      panel.hidden = abierto;
      btn.textContent = abierto ? 'Ver detalle ▾' : 'Ocultar detalle ▴';
    });
  });
}
