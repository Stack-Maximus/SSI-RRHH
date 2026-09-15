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
import {
  estadoContratacionBadge, canalLabel, tipoTrabajadorLabel,
  estadoReclutamientoBadge, decisionCandidatoBadge, nombreCandidatoRecl
} from '../ui/contratacion-format.js';
import { renderContratacionDetalle } from './contratacion-detalle.js';

const CANALES = [['recomendacion', 'Recomendación'], ['reclutamiento_seleccion', 'Reclutamiento y selección']];
const TIPOS = [['administrativo', 'Administrativo'], ['operativo', 'Operativo']];

export async function renderContrataciones(container) {
  container.innerHTML = '<div class="view-loading">Cargando contrataciones...</div>';

  let solicitudes, contratMap, centros, perfiles, rechazos, reclutMap, candMap;
  try {
    solicitudes = await Data.solicitudesIngresoAprobadas();
    [contratMap, centros, reclutMap] = await Promise.all([
      Data.contratacionesPorSolicitud(solicitudes.map(s => s.id)),
      Data.listCentrosAdmin(),
      Data.reclutamientosPorSolicitud(solicitudes.map(s => s.id))
    ]);
    perfiles = await Data.perfilesPorId(solicitudes.map(s => s.solicitante_id));
    // Para avisar acá mismo cuando Prevención rechazó la homologación por un
    // problema de documento (ver migración 0016) -- solo eso le corresponde
    // a RRHH corregir; el resto de los motivos de rechazo quedan en Homologación SST.
    rechazos = await Data.rechazosPorContratacion([...contratMap.values()].flat().map(c => c.id));
    candMap = await Data.candidatosDeReclutamiento([...reclutMap.values()].flat().map(r => r.id));
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
    <p class="hint">Cada tarjeta es una solicitud de ingreso aprobada. Inicia una contratación directa por cada
      persona a contratar, o un proceso de Reclutamiento y selección para que el solicitante elija entre varios
      candidatos; puedes combinar ambos si la solicitud pide varias vacantes.</p>
    <div class="sol-grid" id="contr-grid"></div>`;

  const grid = container.querySelector('#contr-grid');
  grid.innerHTML = solicitudes
    .map(s => cardSolicitud(s, contratMap.get(s.id) || [], centrosMap, perfiles, rechazos, reclutMap.get(s.id) || [], candMap))
    .join('');

  wireCards(container, solicitudes, centrosMap);
}

function cardSolicitud(s, contrataciones, centrosMap, perfiles, rechazosMap, reclutamientos, candMap) {
  const solicitante = perfiles.get(s.solicitante_id)?.nombre || '—';
  const cantidad = s.detalle?.cantidad || 1;
  const rows = contrataciones.map(c => {
    // El último rechazo de homologación con documento(s) marcado(s) es lo
    // único que le toca corregir a RRHH -- el resto de los rechazos (sin
    // documento marcado) son asunto de Prevención con el solicitante.
    const ultimoRechazoDoc = [...(rechazosMap.get(c.id) || [])].reverse().find(r => r.documentos.length > 0);
    return `
    <div class="contr-row" data-ver="${c.id}">
      <div>
        <b>${escapeHtml(c.nombre_candidato)}</b>
        <span class="muted"> · ${canalLabel(c.canal)} · ${tipoTrabajadorLabel(c.tipo_trabajador)}</span>
        ${ultimoRechazoDoc ? '<span class="badge badge-danger" title="Prevención marcó un documento en el último rechazo de homologación">⚠️ Revisar documento</span>' : ''}
      </div>
      <div>${estadoContratacionBadge(c.estado)} <button class="link-btn" data-ver-btn="${c.id}">Ver ▸</button></div>
    </div>`;
  }).join('');

  const reclBloque = reclutamientos.map(r => reclCard(r, candMap.get(r.id) || [])).join('');

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
      ${reclBloque}
      <button class="btn btn-secondary" data-iniciar-recl="${s.id}">+ Iniciar reclutamiento y selección</button>
      <div class="form-card" data-form-recl="${s.id}" hidden style="margin-top:4px;"></div>
    </div>`;
}

/** Tarjeta de un proceso de Reclutamiento y selección dentro de la tarjeta de la solicitud. */
function reclCard(r, candidatos) {
  // Solo se puede agregar una tanda nueva si todavía no hay ninguna (proceso
  // recién creado) o si la última se rechazó completa -- mientras queden
  // candidatos pendientes de decisión, el botón se oculta (ver misma
  // revalidación server-side en reclutamiento_agregar_candidatos, migración 0018).
  const puedeAgregar = r.estado !== 'candidato_elegido' && (candidatos.length === 0 || r.estado === 'todos_rechazados');
  const rows = candidatos.map(c => `
    <div class="cand-row" data-cand="${c.id}">
      <div>
        <b>${escapeHtml(nombreCandidatoRecl(c))}</b>
        ${c.cv_storage_path
          ? `<button class="link-btn" data-ver-cv="${c.cv_storage_path}">📄 ${escapeHtml(c.cv_nombre_archivo || 'CV')}</button>`
          : '<span class="muted">Sin CV</span>'}
      </div>
      <div>${decisionCandidatoBadge(c.decision)}</div>
    </div>`).join('');

  return `
    <div class="recl-card" data-recl="${r.id}">
      <div class="recl-card-top">
        <span>🧑‍💼 Reclutamiento y selección</span>
        ${estadoReclutamientoBadge(r.estado)}
        <span class="muted">${tipoTrabajadorLabel(r.tipo_trabajador)}</span>
      </div>
      ${rows ? `<div class="cand-list">${rows}</div>` : '<span class="muted">Todavía sin candidatos.</span>'}
      ${puedeAgregar ? `
        <button class="link-btn" data-agregar-cand="${r.id}">${candidatos.length === 0 ? '+ Agregar candidatos' : '+ Agregar otra tanda'}</button>
        <div class="form-card" data-form-cand="${r.id}" hidden style="margin-top:4px;"></div>` : ''}
    </div>`;
}

function formIniciarRecl(solicitudId) {
  return `
    <div class="form-field"><label class="form-label">Tipo de trabajador <span class="req">*</span></label>
      <select data-f="tipo_trabajador">${TIPOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    <p class="hint">Después de crear el proceso, agrega los candidatos (nombre + CV) para que el solicitante elija.</p>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" data-cancelar-recl="${solicitudId}">Cancelar</button>
      <button type="button" class="btn btn-primary" data-crear-recl="${solicitudId}">Crear proceso</button>
    </div>`;
}

function filaCandidato() {
  return `
    <div class="cand-form-row" data-row>
      <button type="button" class="link-btn cand-form-remove" data-quitar-row title="Quitar candidato">✕</button>
      <div class="form-grid-2">
        <div class="form-field"><label class="form-label">Nombres <span class="req">*</span></label>
          <input type="text" data-cf="nombres" placeholder="Juan"></div>
        <div class="form-field"><label class="form-label">Apellido paterno <span class="req">*</span></label>
          <input type="text" data-cf="apellido_paterno" placeholder="Pérez"></div>
      </div>
      <div class="form-grid-2">
        <div class="form-field"><label class="form-label">Apellido materno</label>
          <input type="text" data-cf="apellido_materno" placeholder="González"></div>
        <div class="form-field"><label class="form-label">CV <span class="req">*</span></label>
          <input type="file" data-cf="cv" accept=".pdf,.png,.jpg,.jpeg,.docx,.doc"></div>
      </div>
    </div>`;
}

function formAgregarCandidatos(reclutamientoId) {
  return `
    <div class="cand-form-list" data-cand-rows>${filaCandidato()}</div>
    <div class="form-actions" style="justify-content:space-between;">
      <button type="button" class="link-btn" data-mas-candidato="${reclutamientoId}">+ Agregar otro candidato</button>
      <div>
        <button type="button" class="btn btn-secondary" data-cancelar-cand="${reclutamientoId}">Cancelar</button>
        <button type="button" class="btn btn-primary" data-enviar-cand="${reclutamientoId}">Enviar candidatos</button>
      </div>
    </div>`;
}

function formIniciar(solicitudId) {
  return `
    <div class="form-grid-2">
      <div class="form-field"><label class="form-label">Nombres <span class="req">*</span></label>
        <input type="text" data-f="nombres" placeholder="Juan"></div>
      <div class="form-field"><label class="form-label">Apellido paterno <span class="req">*</span></label>
        <input type="text" data-f="apellido_paterno" placeholder="Pérez"></div>
    </div>
    <div class="form-grid-2">
      <div class="form-field"><label class="form-label">Apellido materno</label>
        <input type="text" data-f="apellido_materno" placeholder="González"></div>
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

  // ---- Reclutamiento y selección ----
  container.querySelectorAll('[data-iniciar-recl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const solId = btn.dataset.iniciarRecl;
      const card = btn.closest('.sol-card');
      const formEl = card.querySelector(`[data-form-recl="${solId}"]`);
      formEl.hidden = !formEl.hidden;
      if (!formEl.hidden && !formEl.dataset.wired) {
        formEl.innerHTML = formIniciarRecl(solId);
        formEl.dataset.wired = '1';
        formEl.querySelector('[data-cancelar-recl]').addEventListener('click', () => { formEl.hidden = true; });
        formEl.querySelector('[data-crear-recl]').addEventListener('click', () => crearReclutamiento(formEl, solId, container));
      }
    });
  });

  container.querySelectorAll('[data-ver-cv]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const url = await Data.urlCvCandidato(btn.dataset.verCv);
        window.open(url, '_blank');
      } catch (e) {
        console.error('[contrataciones] cv', e);
        Toast.error('Error', 'No se pudo abrir el CV.');
      }
    });
  });

  container.querySelectorAll('[data-agregar-cand]').forEach(btn => {
    btn.addEventListener('click', () => {
      const reclId = btn.dataset.agregarCand;
      const card = btn.closest('.recl-card');
      const formEl = card.querySelector(`[data-form-cand="${reclId}"]`);
      formEl.hidden = !formEl.hidden;
      if (!formEl.hidden && !formEl.dataset.wired) {
        formEl.innerHTML = formAgregarCandidatos(reclId);
        formEl.dataset.wired = '1';
        wireFormCandidatos(formEl, reclId, container);
      }
    });
  });
}

/** Wiring del mini-formulario de candidatos (filas repetibles) -- separado de wireCards
 * porque se re-arma cada vez que se abre (no vive en el HTML inicial de la tarjeta). */
function wireFormCandidatos(formEl, reclutamientoId, container) {
  const rowsEl = formEl.querySelector('[data-cand-rows]');
  const wireQuitar = (row) => {
    row.querySelector('[data-quitar-row]').addEventListener('click', () => {
      if (rowsEl.children.length > 1) row.remove();
      else row.querySelectorAll('input').forEach(i => { i.value = ''; }); // última fila: se limpia en vez de desaparecer
    });
  };
  rowsEl.querySelectorAll('[data-row]').forEach(wireQuitar);

  formEl.querySelector('[data-mas-candidato]').addEventListener('click', () => {
    rowsEl.insertAdjacentHTML('beforeend', filaCandidato());
    wireQuitar(rowsEl.lastElementChild);
  });
  formEl.querySelector('[data-cancelar-cand]').addEventListener('click', () => { formEl.hidden = true; });
  formEl.querySelector('[data-enviar-cand]').addEventListener('click', () => enviarCandidatos(formEl, reclutamientoId, container));
}

async function crearContratacion(formEl, solicitudId, container) {
  const val = (f) => formEl.querySelector(`[data-f="${f}"]`).value.trim();
  const nombres = val('nombres');
  const apellidoPaterno = val('apellido_paterno');
  const apellidoMaterno = val('apellido_materno');
  if (!nombres || !apellidoPaterno) {
    Toast.warning('Falta el nombre', 'Indica al menos los nombres y el apellido paterno del candidato.');
    return;
  }
  const nombreCompleto = [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ');

  const btn = formEl.querySelector('[data-crear]');
  btn.disabled = true; btn.textContent = 'Creando...';
  try {
    const contrat = await Data.iniciarContratacion({
      solicitud_id: solicitudId,
      nombres_candidato: nombres,
      apellido_paterno_candidato: apellidoPaterno,
      apellido_materno_candidato: apellidoMaterno || null,
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
      Toast.success('Contratación iniciada', `${nombreCompleto} · se avisó al prevencionista para la homologación`);
    }
    renderContrataciones(container);
  } catch (e) {
    console.error('[contrataciones] crear', e);
    Toast.error('Error', e.message || 'No se pudo iniciar la contratación.');
    btn.disabled = false; btn.textContent = 'Crear contratación';
  }
}

async function crearReclutamiento(formEl, solicitudId, container) {
  const tipo = formEl.querySelector('[data-f="tipo_trabajador"]').value;
  const btn = formEl.querySelector('[data-crear-recl]');
  btn.disabled = true; btn.textContent = 'Creando...';
  try {
    await Data.iniciarReclutamiento({ solicitud_id: solicitudId, tipo_trabajador: tipo }, state.user.id);
    Toast.success('Proceso creado', 'Ahora agrega los candidatos (nombre + CV) para enviárselos al solicitante.');
    renderContrataciones(container);
  } catch (e) {
    console.error('[contrataciones] iniciar reclutamiento', e);
    Toast.error('Error', e.message || 'No se pudo iniciar el proceso.');
    btn.disabled = false; btn.textContent = 'Crear proceso';
  }
}

async function enviarCandidatos(formEl, reclutamientoId, container) {
  const filas = [...formEl.querySelectorAll('[data-row]')];
  const items = [];
  for (const fila of filas) {
    const nombres = fila.querySelector('[data-cf="nombres"]').value.trim();
    const apellidoPaterno = fila.querySelector('[data-cf="apellido_paterno"]').value.trim();
    const apellidoMaterno = fila.querySelector('[data-cf="apellido_materno"]').value.trim();
    const file = fila.querySelector('[data-cf="cv"]').files?.[0] || null;
    if (!nombres && !apellidoPaterno && !file) continue; // fila que quedó vacía -- se ignora, no es error
    if (!nombres || !apellidoPaterno) {
      Toast.warning('Falta un dato', 'Cada candidato necesita al menos nombres y apellido paterno.');
      return;
    }
    if (!file) {
      Toast.warning('Falta el CV', `Sube el CV de ${nombres} ${apellidoPaterno}.`);
      return;
    }
    items.push({ nombres, apellido_paterno: apellidoPaterno, apellido_materno: apellidoMaterno || null, file });
  }
  if (!items.length) {
    Toast.warning('Sin candidatos', 'Agrega al menos un candidato con su CV.');
    return;
  }

  const btn = formEl.querySelector('[data-enviar-cand]');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    // Sube primero los CV a Storage y recién después registra los candidatos
    // (mismo orden que subirDocumentoContratacion / subirCvCandidato).
    const candidatos = [];
    for (const it of items) {
      const { cv_storage_path, cv_nombre_archivo } = await Data.subirCvCandidato(reclutamientoId, it.file);
      candidatos.push({
        nombres: it.nombres, apellido_paterno: it.apellido_paterno, apellido_materno: it.apellido_materno,
        cv_storage_path, cv_nombre_archivo
      });
    }
    await Data.agregarCandidatosReclutamiento(reclutamientoId, candidatos);
    Data.notificarEvento('reclutamiento_opciones', { reclutamiento_id: reclutamientoId }); // fire-and-forget
    Toast.success('Candidatos enviados', `Se avisó al solicitante (${candidatos.length} candidato${candidatos.length === 1 ? '' : 's'}).`);
    renderContrataciones(container);
  } catch (e) {
    console.error('[contrataciones] agregar candidatos', e);
    Toast.error('Error', e.message || 'No se pudieron agregar los candidatos.');
    btn.disabled = false; btn.textContent = 'Enviar candidatos';
  }
}
