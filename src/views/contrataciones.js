/**
 * Vista "Contratación" (RRHH / admin) · arranca después de que una solicitud
 * de ingreso queda APROBADA. Desde acá se inicia la contratación de cada
 * persona (canal + tipo de trabajador, editable), se hace seguimiento del
 * checklist de documentos y se marca como contratado al cerrar el proceso.
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast, Confirm } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { fechaCorta, resumen } from '../ui/solicitud-format.js';
import { estadoContratacionBadge, canalLabel, tipoTrabajadorLabel } from '../ui/contratacion-format.js';
import { renderContratacionDetalle } from './contratacion-detalle.js';

const CANALES = [['recomendacion', 'Recomendación'], ['reclutamiento_seleccion', 'Reclutamiento y selección']];
const TIPOS = [['administrativo', 'Administrativo'], ['operativo', 'Operativo']];

export async function renderContrataciones(container) {
  container.innerHTML = '<div class="view-loading">Cargando contrataciones...</div>';

  let solicitudes, contratMap, centros, perfiles;
  try {
    solicitudes = await Data.solicitudesIngresoAprobadas();
    [contratMap, centros] = await Promise.all([
      Data.contratacionesPorSolicitud(solicitudes.map(s => s.id)),
      Data.listCentrosAdmin()
    ]);
    perfiles = await Data.perfilesPorId(solicitudes.map(s => s.solicitante_id));
  } catch (e) {
    console.error('[contrataciones]', e);
    Toast.error('Error', 'No se pudieron cargar las contrataciones.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar las contrataciones.</div>';
    return;
  }

  const centrosMap = new Map(centros.map(c => [c.id, c]));

  if (!solicitudes.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="placeholder-icon">💼</div>
      <p>Todavía no hay solicitudes de ingreso aprobadas para iniciar contratación.</p>
    </div>`;
    return;
  }

  container.innerHTML = `
    <p class="hint">Cada tarjeta es una solicitud de ingreso aprobada. Inicia una contratación por cada persona a
      contratar para esa vacante; puedes iniciar más de una si la solicitud pide varias.</p>
    <div class="sol-grid" id="contr-grid"></div>`;

  const grid = container.querySelector('#contr-grid');
  grid.innerHTML = solicitudes.map(s => cardSolicitud(s, contratMap.get(s.id) || [], centrosMap, perfiles)).join('');

  wireCards(container, solicitudes, centrosMap);
}

function cardSolicitud(s, contrataciones, centrosMap, perfiles) {
  const solicitante = perfiles.get(s.solicitante_id)?.nombre || '—';
  const cantidad = s.detalle?.cantidad || 1;
  const rows = contrataciones.map(c => `
    <div class="contr-row" data-ver="${c.id}">
      <div>
        <b>${escapeHtml(c.nombre_candidato)}</b>
        <span class="muted"> · ${canalLabel(c.canal)} · ${tipoTrabajadorLabel(c.tipo_trabajador)}</span>
      </div>
      <div>${estadoContratacionBadge(c.estado)} <button class="link-btn" data-ver-btn="${c.id}">Ver ▸</button></div>
    </div>`).join('');

  return `
    <div class="sol-card" data-sol="${s.id}">
      <div class="sol-card-top">
        <span class="sol-id">${s.codigo || '—'}</span>
        <span class="sol-tipo">➕ Ingreso</span>
      </div>
      <div class="sol-resumen">${resumen(s, centrosMap, new Map())}</div>
      <div class="sol-detalle muted">Solicitante: ${escapeHtml(solicitante)} · ${fechaCorta(s.created_at)} · ${contrataciones.length}/${cantidad} contratación(es) iniciada(s)</div>
      ${rows ? `<div class="contr-list">${rows}</div>` : ''}
      <button class="btn btn-secondary" data-iniciar="${s.id}">+ Iniciar contratación</button>
      <div class="form-card" data-form="${s.id}" hidden style="margin-top:4px;"></div>
    </div>`;
}

function formIniciar(solicitudId) {
  return `
    <div class="form-grid-2">
      <div class="form-field"><label class="form-label">Nombre completo <span class="req">*</span></label>
        <input type="text" data-f="nombre" placeholder="Nombre y apellidos"></div>
      <div class="form-field"><label class="form-label">RUT</label>
        <input type="text" data-f="rut" placeholder="12.345.678-9"></div>
    </div>
    <div class="form-grid-2">
      <div class="form-field"><label class="form-label">Teléfono</label>
        <input type="text" data-f="telefono"></div>
      <div class="form-field"><label class="form-label">Correo</label>
        <input type="email" data-f="email"></div>
    </div>
    <div class="form-grid-2">
      <div class="form-field"><label class="form-label">Canal <span class="req">*</span></label>
        <select data-f="canal">${CANALES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-label">Tipo de trabajador <span class="req">*</span></label>
        <select data-f="tipo">${TIPOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" data-cancelar="${solicitudId}">Cancelar</button>
      <button type="button" class="btn btn-primary" data-crear="${solicitudId}">Crear contratación</button>
    </div>`;
}

function wireCards(container, solicitudes, centrosMap) {
  container.querySelectorAll('[data-iniciar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const solId = btn.dataset.iniciar;
      const card = btn.closest('.sol-card');
      const formEl = card.querySelector(`[data-form="${solId}"]`);
      formEl.hidden = !formEl.hidden;
      if (!formEl.hidden && !formEl.dataset.wired) {
        formEl.innerHTML = formIniciar(solId);
        formEl.dataset.wired = '1';
        formEl.querySelector(`[data-cancelar]`).addEventListener('click', () => { formEl.hidden = true; });
        formEl.querySelector(`[data-crear]`).addEventListener('click', () => crearContratacion(formEl, solId, container));
      }
    });
  });

  container.querySelectorAll('[data-ver-btn], .contr-row').forEach(el => {
    el.addEventListener('click', (e) => {
      const id = e.target.closest('[data-ver-btn]')?.dataset.verBtn || el.dataset.ver;
      if (!id) return;
      renderContratacionDetalle(container, id, 'contrataciones');
    });
  });
}

async function crearContratacion(formEl, solicitudId, container) {
  const val = (f) => formEl.querySelector(`[data-f="${f}"]`).value.trim();
  const nombre = val('nombre');
  if (!nombre) { Toast.warning('Falta el nombre', 'Indica el nombre del candidato.'); return; }

  const btn = formEl.querySelector('[data-crear]');
  btn.disabled = true; btn.textContent = 'Creando...';
  try {
    const contrat = await Data.iniciarContratacion({
      solicitud_id: solicitudId,
      nombre_candidato: nombre,
      rut_candidato: val('rut') || null,
      telefono_candidato: val('telefono') || null,
      email_candidato: val('email') || null,
      canal: val('canal'),
      tipo_trabajador: val('tipo')
    }, state.user.id);
    // Avisa al prevencionista del centro para que arranque la homologación SST.
    const notif = await Data.notificarContratacion(contrat.id);
    if (notif?.skipped) {
      Toast.warning('Contratación iniciada', 'No se pudo avisar al prevencionista: este centro de costo todavía no tiene uno asignado (asígnalo en "Centros de costo").');
    } else {
      Toast.success('Contratación iniciada', `${nombre} · se avisó al prevencionista para la homologación`);
    }
    renderContrataciones(container);
  } catch (e) {
    console.error('[contrataciones] crear', e);
    Toast.error('Error', e.message || 'No se pudo iniciar la contratación.');
    btn.disabled = false; btn.textContent = 'Crear contratación';
  }
}
