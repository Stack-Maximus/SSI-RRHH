/**
 * Vista "Mis solicitudes" · las solicitudes que creó el usuario, con su estado
 * y el avance de las aprobaciones.
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast, Confirm } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { estadoBadge, decisionBadge, tipoLabel, fechaCorta, resumen } from '../ui/solicitud-format.js';
import { nombreCandidatoRecl } from '../ui/contratacion-format.js';
import { renderComprobante } from './comprobante.js';

export async function renderMisSolicitudes(container) {
  container.innerHTML = '<div class="view-loading">Cargando...</div>';

  let sols, centrosMap, trabMap, reclutPendientes;
  try {
    const [misSol, centros, reclut] = await Promise.all([
      Data.misSolicitudes(state.user.id), Data.centros(), Data.misReclutamientosPendientes()
    ]);
    sols = misSol;
    centrosMap = new Map(centros.map(c => [c.id, c]));
    trabMap = await Data.trabajadoresPorId(sols.map(s => s.trabajador_id));
    reclutPendientes = reclut;
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

  // Editable solo mientras siga pendiente y ningún aprobador haya decidido
  // todavía -- el RPC editar_solicitud() (migración 0017) revalida esto
  // mismo server-side, esto es solo para no mostrar el botón de más.
  const puedeEditar = (s) => s.estado === 'pendiente' && (s.aprobaciones || []).every(a => a.decision === 'pendiente');

  const solMap = new Map(sols.map(s => [s.id, s]));
  const panelCandidatos = reclutPendientes.length
    ? `<div class="recl-pendientes">${reclutPendientes.map(r => panelReclutamiento(r, solMap.get(r.solicitud_id))).join('')}</div>`
    : '';

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
          <span>
            ${puedeEditar(s) ? `<button class="link-btn" data-editar="${s.id}">✏️ Editar</button>` : ''}
            <button class="link-btn" data-comprobante="${s.id}">📄 Ver comprobante</button>
          </span>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    ${panelCandidatos}
    <div class="sol-toolbar">
      <span class="muted">${sols.length} solicitud(es)</span>
      <button class="btn btn-primary" id="ir-nueva">Nueva solicitud</button>
    </div>
    <div class="sol-grid">${cards}</div>`;

  container.querySelector('#ir-nueva')?.addEventListener('click', () => window.Router.go('nueva-solicitud'));
  container.querySelectorAll('[data-comprobante]').forEach(btn => {
    btn.addEventListener('click', () => renderComprobante(container, btn.dataset.comprobante, 'mis-solicitudes'));
  });
  container.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => window.Router.go('nueva-solicitud', { editId: btn.dataset.editar }));
  });

  wireReclutamiento(container, reclutPendientes);
}

/** Panel destacado: candidatos que RRHH envió para una solicitud de ingreso propia,
 * esperando que el solicitante elija uno o los rechace (ver migración 0018). */
function panelReclutamiento(r, sol) {
  const cands = (r.candidatos || []).map(c => `
    <div class="cand-row" data-cand="${c.id}" data-recl="${r.id}">
      <div>
        <b>${escapeHtml(nombreCandidatoRecl(c))}</b>
        ${c.cv_storage_path
          ? `<button class="link-btn" data-ver-cv="${c.cv_storage_path}">📄 ${escapeHtml(c.cv_nombre_archivo || 'CV')}</button>`
          : '<span class="muted">Sin CV</span>'}
      </div>
      <div class="sol-acciones">
        <button class="btn btn-danger" data-decidir="rechazado">Rechazar</button>
        <button class="btn btn-primary" data-decidir="elegido">Elegir</button>
      </div>
    </div>`).join('');

  return `
    <div class="card recl-pendiente-card">
      <h3>🧑‍💼 Candidatos para tu solicitud ${escapeHtml(sol?.codigo || '—')}</h3>
      <p class="hint">RRHH envió estos candidatos para la vacante. Revisa el CV de cada uno y elige uno, o recházalos si ninguno calza.</p>
      <div class="cand-list">${cands}</div>
    </div>`;
}

function wireReclutamiento(container, reclutPendientes) {
  const reclMap = new Map(reclutPendientes.map(r => [r.id, r]));

  container.querySelectorAll('[data-ver-cv]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const url = await Data.urlCvCandidato(btn.dataset.verCv);
        window.open(url, '_blank');
      } catch (e) {
        console.error('[mis-solicitudes] cv', e);
        Toast.error('Error', 'No se pudo abrir el CV.');
      }
    });
  });

  container.querySelectorAll('.cand-row[data-cand][data-recl]').forEach(row => {
    const candidatoId = row.dataset.cand;
    const reclutamientoId = row.dataset.recl;
    row.querySelectorAll('[data-decidir]').forEach(btn => {
      btn.addEventListener('click', () => decidirCandidato(row, candidatoId, reclutamientoId, btn.dataset.decidir, reclMap, container));
    });
  });
}

async function decidirCandidato(row, candidatoId, reclutamientoId, decision, reclMap, container) {
  const recl = reclMap.get(reclutamientoId);
  const cand = recl?.candidatos.find(c => c.id === candidatoId);
  const nombre = cand ? nombreCandidatoRecl(cand) : 'este candidato';
  const esElegir = decision === 'elegido';

  const ok = await Confirm.ask({
    title: esElegir ? `¿Elegir a ${nombre}?` : `¿Rechazar a ${nombre}?`,
    text: esElegir
      ? 'Se creará la contratación y RRHH va a continuar el proceso desde ahí.'
      : 'Esta decisión no se puede deshacer.',
    variant: esElegir ? 'success' : 'danger',
    confirmText: esElegir ? 'Elegir' : 'Rechazar'
  });
  if (!ok) return;

  // Si este es el único candidato pendiente de la tanda y lo rechazamos, el
  // proceso pasa a 'todos_rechazados' del lado del servidor -- se calcula
  // acá (con la lista ya cargada) para saber qué aviso disparar después, ya
  // que reclutamiento_decidir_candidato() no devuelve el estado resultante.
  const eraElUltimoPendiente = (recl?.candidatos.length || 0) <= 1;

  row.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    await Data.reclutamientoDecidir(candidatoId, decision);
    if (esElegir) {
      Data.notificarEvento('reclutamiento_elegido', { reclutamiento_id: reclutamientoId }); // fire-and-forget
      Toast.success('Candidato elegido', 'Se creó la contratación -- ya avisamos a RRHH.');
    } else if (eraElUltimoPendiente) {
      Data.notificarEvento('reclutamiento_todos_rechazados', { reclutamiento_id: reclutamientoId }); // fire-and-forget
      Toast.info('Candidato rechazado', 'Rechazaste a todos -- avisamos a RRHH para que envíe otra tanda.');
    } else {
      Toast.success('Candidato rechazado', '');
    }
    renderMisSolicitudes(container);
  } catch (e) {
    console.error('[mis-solicitudes] decidir candidato', e);
    Toast.error('Error', e.message || 'No se pudo registrar la decisión.');
    row.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}
