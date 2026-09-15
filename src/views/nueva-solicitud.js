/**
 * Vista "Nueva solicitud" · formularios de Ingreso, Traslado (rol solicitante)
 * y Aumento de sueldo / Bono / Cambio de cargo / Renovación (rol supervisor,
 * sobre trabajadores ya contratados). El segmento de tipos visibles depende
 * del rol (TIPOS_SOLICITUD_POR_ROL en config.js). Ingreso/Traslado llaman a
 * crear_solicitud(); los 4 tipos de cambio llaman a crear_solicitud_cambio()
 * (aprueba solo el administrador de obra del centro del trabajador). Los
 * campos propios de cada tipo se guardan en `detalle` (JSONB).
 *
 * MODO EDICIÓN: cuando Router.go('nueva-solicitud', {editId}) trae un id
 * (ver mis-solicitudes.js), esta misma vista carga esa solicitud y reusa
 * los mismos formularios, pero:
 *  - Precarga cada campo con lo ya guardado (detalle + motivo).
 *  - Bloquea tipo / trabajador / centro(s) -- son los que definen quién
 *    aprueba, no se pueden tocar en una edición (ver migración 0017).
 *  - Al enviar, llama a Data.editarSolicitud() en vez de crear una nueva.
 * Las funciones build*() (validación + armado de `detalle`) son EXACTAMENTE
 * las mismas en los dos modos -- no hace falta duplicarlas: en modo edición
 * los campos fijos viajan como <input type="hidden"> con el mismo `name`,
 * así que f.campo.value sigue funcionando igual.
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { TIPOS_SOLICITUD_POR_ROL, TIPO_SOLICITUD_META, TIPOS_CONTRATO, CAUSALES_DESVINCULACION } from '../config.js';

let centros = [];
let trabajadores = [];
let cargos = [];
// Distinto de null mientras se está editando una solicitud existente en vez
// de crear una nueva: { id, tipo }. Lo consultan renderBody/onSubmit para
// saber qué formulario mostrar (fijo vs. editable) y qué hacer al enviar.
let editando = null;

// 3 turnos fijos, cada uno con su horario de Lunes a Jueves y su horario
// (distinto, jornada reducida) del Viernes -- se guarda el texto completo
// tal cual en detalle.turno (mismo criterio que el resto del formulario:
// sin tabla de códigos aparte, el texto ya es autoexplicativo en el
// comprobante, el Excel maestro, etc.).
const TURNOS = [
  'Lunes a Jueves 08:00 a 17:30 · Viernes 08:00 a 17:00',
  'Lunes a Jueves 07:30 a 17:00 · Viernes 07:30 a 16:30',
  'Lunes a Jueves 21:00 a 06:00 · Viernes 22:00 a 06:00 (Turno Noche)'
];
const TIPOS_BONO = ['Bono Trato', 'Bono Nocturno', 'Bono Producción', 'Bono Responsabilidad', 'Otro'];

// Tipos que se crean vía crear_solicitud_cambio() (sobre un trabajador ya contratado)
const TIPOS_CAMBIO = ['aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion'];

const num = (v) => (v === '' || v == null ? null : Number(v));
const txt = (v) => (v && String(v).trim() ? String(v).trim() : null);
// Insignia que marca un campo bloqueado en modo edición (define quién
// aprueba, así que no se puede tocar después de creada -- ver 0017).
const BADGE_FIJO = '<span class="badge badge-neutral" title="No se puede cambiar al editar: define quién debe aprobar">🔒 fijo</span>';

function optsCentros(sel) {
  return centros.map(c =>
    `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.codigo} · ${c.nombre}</option>`
  ).join('');
}
function optsContrato(sel = '') { return TIPOS_CONTRATO.map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join(''); }
function optsTurno(sel = '')    { return TURNOS.map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join(''); }
function optsBono(sel = '')     { return TIPOS_BONO.map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join(''); }
function optsCausales(sel = '') { return CAUSALES_DESVINCULACION.map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join(''); }
function optsCargos(sel) {
  return '<option value="">— Seleccionar cargo —</option>' +
    cargos.map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
}
function optsTrabajadores() {
  return trabajadores.map(t =>
    `<option value="${t.id}">${t.nombre}${t.cargo ? ' · ' + t.cargo : ''}</option>`
  ).join('');
}
/**
 * Selector de trabajador. En modo edición (`fijoNombre` no es null) se
 * reemplaza por un texto deshabilitado + un <input type="hidden"> con el
 * mismo `name` -- así el trabajador se sigue leyendo igual (f.trabajador_id.value)
 * sin depender de que siga existiendo en la lista de trabajadores ACTIVOS
 * (podría haber sido desvinculado después de creada esta solicitud).
 */
function selectTrabajador(id = 'trab-select', valorSel = '', fijoNombre = null) {
  if (fijoNombre !== null) {
    return `
      <div class="form-section"><div class="form-field">
        <label class="form-label">Trabajador ${BADGE_FIJO}</label>
        <input type="text" value="${escapeHtml(fijoNombre)}" disabled>
        <input type="hidden" name="trabajador_id" value="${valorSel}">
      </div></div>`;
  }
  return `
    <div class="form-section"><div class="form-field">
      <label class="form-label">Trabajador <span class="req">*</span></label>
      <select name="trabajador_id" id="${id}" required>
        <option value="">— Seleccionar trabajador —</option>${optsTrabajadores()}
      </select>
    </div></div>`;
}

export async function renderNuevaSolicitud(container, params) {
  container.innerHTML = '<div class="view-loading">Cargando datos...</div>';
  editando = null;
  let solEditar = null;

  try {
    [centros, trabajadores, cargos] = await Promise.all([Data.centros(), Data.trabajadores(), Data.cargos()]);
  } catch (e) {
    console.error('[nueva-solicitud]', e);
    Toast.error('Error', 'No se pudieron cargar centros o trabajadores.');
    centros = centros || []; trabajadores = trabajadores || []; cargos = cargos || [];
  }

  if (params?.editId) {
    try {
      solEditar = await Data.solicitudPorId(params.editId);
      if (solEditar.solicitante_id !== state.user.id) throw new Error('Esta solicitud no te pertenece.');
      if (solEditar.estado !== 'pendiente') throw new Error('Esta solicitud ya no se puede editar (no está pendiente).');
      const aprs = await Data.aprobacionesDe([solEditar.id]);
      if (aprs.some(a => a.decision !== 'pendiente')) {
        throw new Error('Esta solicitud ya no se puede editar: al menos un aprobador ya tomó una decisión.');
      }
      if (solEditar.trabajador_id) {
        const mapa = await Data.trabajadoresPorId([solEditar.trabajador_id]);
        solEditar._trabajadorNombre = mapa.get(solEditar.trabajador_id)?.nombre || '(trabajador no disponible)';
      }
      editando = { id: solEditar.id, tipo: solEditar.tipo };
    } catch (e) {
      console.error('[nueva-solicitud] editar', e);
      Toast.error('No se puede editar', e.message || 'No se pudo cargar la solicitud.');
      window.Router.go('mis-solicitudes');
      return;
    }
  }

  if (centros.length === 0) {
    container.innerHTML = `<div class="placeholder"><div class="placeholder-icon">🏗️</div>
      <h2>Faltan centros de costo</h2>
      <p class="lead">Carga los centros de costo (seed_real.sql o el panel de administración) antes de crear solicitudes.</p></div>`;
    return;
  }

  const tiposVisibles = TIPOS_SOLICITUD_POR_ROL[state.user.role] || ['ingreso', 'traslado'];
  const tipoInicial = editando ? editando.tipo : tiposVisibles[0];

  const segmentoHtml = editando ? `
    <div class="form-section">
      <label class="form-label">Tipo de solicitud</label>
      <div class="segment-control">
        <button type="button" class="segment-btn active" disabled>
          <span class="segment-icon">${TIPO_SOLICITUD_META[tipoInicial].icon}</span><span>${TIPO_SOLICITUD_META[tipoInicial].label}</span>
          <span class="segment-desc">No se puede cambiar el tipo al editar</span>
        </button>
      </div>
    </div>` : `
    <div class="form-section">
      <label class="form-label">Tipo de solicitud</label>
      <div class="segment-control" id="tipo-control">${tiposVisibles.map((t, i) => {
        const m = TIPO_SOLICITUD_META[t];
        return `<button type="button" class="segment-btn ${i === 0 ? 'active' : ''}" data-tipo="${t}">
          <span class="segment-icon">${m.icon}</span><span>${m.label}</span>
          <span class="segment-desc">${m.desc}</span>
        </button>`;
      }).join('')}</div>
    </div>`;

  container.innerHTML = `
    <div class="view-form">
      <div class="form-card">
        ${editando ? `<p class="hint">✏️ Estás editando <b>${escapeHtml(solEditar.codigo || 'esta solicitud')}</b>. Los cambios se guardan sobre la misma solicitud, no se crea una nueva.</p>` : ''}
        ${segmentoHtml}
        <form id="sol-form" autocomplete="off">
          <div id="form-body"></div>
          <div id="sol-error" class="form-error" hidden></div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="sol-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="sol-submit">${editando ? 'Guardar cambios' : 'Crear solicitud'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let tipo = tipoInicial;
  renderBody(tipo, solEditar);

  if (!editando) {
    container.querySelectorAll('#tipo-control .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#tipo-control .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tipo = btn.dataset.tipo;
        renderBody(tipo, null);
      });
    });
  }

  container.querySelector('#sol-cancel').addEventListener('click', () => window.Router.go(editando ? 'mis-solicitudes' : 'inicio'));
  container.querySelector('#sol-form').addEventListener('submit', (e) => onSubmit(e, () => tipo));
}

function renderBody(tipo, sol) {
  const body = document.getElementById('form-body');
  const builders = {
    ingreso: bodyIngreso,
    traslado: bodyTraslado,
    aumento_sueldo: bodyAumentoSueldo,
    bono: bodyBono,
    cambio_cargo: bodyCambioCargo,
    renovacion: bodyRenovacion,
    desvinculacion: bodyDesvinculacion
  };
  // Cada tipo arranca con el botón habilitado -- traslado es el único que
  // puede volver a deshabilitarlo (ver wireTraslado) si el trabajador
  // elegido requiere un anexo de renovación al día.
  const submitBtn = document.getElementById('sol-submit');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = editando ? 'Guardar cambios' : 'Crear solicitud'; }

  body.innerHTML = (builders[tipo] || bodyIngreso)(sol);

  if (!editando) {
    if (tipo === 'traslado') wireTraslado();
    if (tipo === 'aumento_sueldo') wireAumentoSueldo();
    if (tipo === 'cambio_cargo') wireCambioCargo();
    if (tipo === 'renovacion') wireRenovacion();
  } else {
    // Estos dos widgets (toggle "indefinido" y los checkboxes de bono) siguen
    // siendo interactivos en modo edición -- lo único fijo es el trabajador y
    // el/los centro(s), no estos campos.
    if (tipo === 'traslado') wireBonoToggles();
    if (tipo === 'renovacion') wireRenovacionIndefinido();
  }
}

/* ---------------- INGRESO ---------------- */
function bodyIngreso(sol) {
  const v = sol?.detalle || {};
  const centroId = sol ? sol.centro_origen_id : (state.user.centroCostoId || '');
  const nombreCentro = editando ? (centros.find(c => c.id === centroId)?.nombre || '(centro no disponible)') : null;
  return `
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Cargo <span class="req">*</span></label>
        <select name="cargo" required>${optsCargos(v.cargo || '')}</select></div>
      <div class="form-field"><label class="form-label">Cantidad <span class="req">*</span></label>
        <input type="number" name="cantidad" required min="1" value="${v.cantidad ?? 1}"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Centro de Costo (obra) ${editando ? BADGE_FIJO : '<span class="req">*</span>'}</label>
        ${editando
          ? `<input type="text" value="${escapeHtml(nombreCentro)}" disabled><input type="hidden" name="centro_costo" value="${centroId}">`
          : `<select name="centro_costo" required>${optsCentros(centroId)}</select>`}</div>
      <div class="form-field"><label class="form-label">Cliente</label>
        <input type="text" name="cliente" placeholder="Ej: SACYR" value="${escapeHtml(v.cliente || '')}"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Tipo de contrato</label>
        <select name="tipo_contrato">${optsContrato(v.tipo_contrato)}</select></div>
      <div class="form-field"><label class="form-label">Plazo</label>
        <input type="text" name="plazo" placeholder="Ej: 3 meses" value="${escapeHtml(v.plazo || '')}"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Turno</label>
        <select name="turno">${optsTurno(v.turno)}</select></div>
      <div class="form-field"><label class="form-label">Sueldo líquido pactado</label>
        <input type="number" name="sueldo_liquido" min="0" placeholder="Ej: 800000" value="${v.sueldo_liquido ?? ''}"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Horario</label>
        <input type="text" name="horario" placeholder="Ej: Lunes a Sábado 08:00 a 18:00" value="${escapeHtml(v.horario || '')}"></div>
      <div class="form-field"><label class="form-label">Fecha de ingreso a obra</label>
        <input type="date" name="fecha_ingreso" value="${v.fecha_ingreso || ''}"></div>
    </div></div>
    <div class="form-section"><div class="form-field"><label class="form-label">Motivo / observaciones</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(sol?.motivo || '')}</textarea></div></div>
  `;
}

/* ---------------- TRASLADO ---------------- */
function bodyTraslado(sol) {
  const v = sol?.detalle || {};
  const bn = v.bono_nocturno || {};
  const bt = v.bono_trato || {};
  const nombreOrigen = editando ? (centros.find(c => c.id === sol.centro_origen_id)?.nombre || '(centro no disponible)') : null;
  const nombreDestino = editando ? (centros.find(c => c.id === sol.centro_destino_id)?.nombre || '(centro no disponible)') : null;
  return `
    ${selectTrabajador('trab-select', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div id="trab-alerta-contrato" class="form-error" hidden></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Cargo</label>
        <select name="cargo" id="trab-cargo">${optsCargos(v.cargo || '')}</select></div>
      <div class="form-field"><label class="form-label">Fecha de traslado</label>
        <input type="date" name="fecha_traslado" value="${v.fecha_traslado || ''}"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Obra origen ${editando ? BADGE_FIJO : '<span class="req">*</span>'}</label>
        ${editando
          ? `<input type="text" value="${escapeHtml(nombreOrigen)}" disabled><input type="hidden" name="centro_origen" value="${sol.centro_origen_id}">`
          : `<select name="centro_origen" id="trab-origen" required>${optsCentros('')}</select>`}</div>
      <div class="form-field"><label class="form-label">Obra destino ${editando ? BADGE_FIJO : '<span class="req">*</span>'}</label>
        ${editando
          ? `<input type="text" value="${escapeHtml(nombreDestino)}" disabled><input type="hidden" name="centro_destino" value="${sol.centro_destino_id}">`
          : `<select name="centro_destino" required><option value="">— Seleccionar destino —</option>${optsCentros('')}</select>`}</div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Sueldo líquido actual (pactado)</label>
        <input type="number" name="sueldo_liquido_actual" id="trab-sueldo" min="0" value="${v.sueldo_liquido_actual ?? ''}"></div>
      <div class="form-field"><label class="form-label">Nuevo sueldo líquido</label>
        <input type="number" name="nuevo_sueldo_liquido" min="0" value="${v.nuevo_sueldo_liquido ?? ''}"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Turno</label>
        <select name="turno">${optsTurno(v.turno)}</select></div>
      <div class="form-field"><label class="form-label">Horario</label>
        <input type="text" name="horario" placeholder="Ej: Lunes a Sábado..." value="${escapeHtml(v.horario || '')}"></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Modificaciones contractuales</label>
      <textarea name="modificaciones" placeholder="Detalle de cambios en el contrato (opcional)">${escapeHtml(v.modificaciones_contractuales || '')}</textarea>
    </div></div>

    <div class="form-section">
      <label class="form-label">Bonos (marcar solo los que aplican)</label>
      <label class="bono-toggle"><input type="checkbox" id="chk-nocturno" ${bn.aplica ? 'checked' : ''}> Aplica Bono Nocturno</label>
      <div class="bono-fields" id="fields-nocturno" ${bn.aplica ? '' : 'hidden'}>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Porcentaje B. Nocturno</label>
            <input type="number" name="bn_porcentaje" step="0.01" min="0" placeholder="Ej: 0.30" value="${bn.porcentaje ?? ''}"></div>
          <div class="form-field"><label class="form-label">Período de asignación</label>
            <input type="text" name="bn_periodo" placeholder="Ej: mensual / 3 meses" value="${escapeHtml(bn.periodo || '')}"></div>
        </div>
      </div>
      <label class="bono-toggle"><input type="checkbox" id="chk-trato" ${bt.aplica ? 'checked' : ''}> Aplica Bono Trato</label>
      <div class="bono-fields" id="fields-trato" ${bt.aplica ? '' : 'hidden'}>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Monto Bono Trato</label>
            <input type="number" name="bt_monto" min="0" value="${bt.monto ?? ''}"></div>
          <div class="form-field"><label class="form-label">Días de asignación</label>
            <input type="number" name="bt_dias" min="0" value="${bt.dias_asignacion ?? ''}"></div>
        </div>
      </div>
    </div>
  `;
}

function wireBonoToggles() {
  const toggle = (chkId, fieldsId) => {
    const chk = document.getElementById(chkId);
    if (!chk) return;
    chk.addEventListener('change', () => { document.getElementById(fieldsId).hidden = !chk.checked; });
  };
  toggle('chk-nocturno', 'fields-nocturno');
  toggle('chk-trato', 'fields-trato');
}

function wireTraslado() {
  const sel = document.getElementById('trab-select');
  const alerta = document.getElementById('trab-alerta-contrato');
  const submitBtn = document.getElementById('sol-submit');
  sel.addEventListener('change', () => {
    const t = trabajadores.find(x => x.id === sel.value);
    if (!t) { alerta.hidden = true; submitBtn.disabled = false; return; }
    const selCargo = document.getElementById('trab-cargo');
    const cargoTrab = t.cargo || '';
    if (cargoTrab && !cargos.includes(cargoTrab)) {
      selCargo.insertAdjacentHTML('beforeend', `<option>${cargoTrab}</option>`);
    }
    selCargo.value = cargoTrab;
    document.getElementById("trab-sueldo").value = t.sueldo_liquido ?? '';
    if (t.centro_costo_id) document.getElementById('trab-origen').value = t.centro_costo_id;

    // Contrato "Obra o Faena" sin anexo de renovación al día: bloquea el
    // traslado (a pedido explícito del cliente -- el sistema no deja
    // avanzar hasta que se apruebe una Renovación para este trabajador).
    // La base de datos también lo bloquea (trigger, migración 0013) por si
    // este chequeo del cliente se salta por algún motivo.
    if (t.requiere_anexo_renovacion) {
      alerta.hidden = false;
      alerta.textContent = `${t.nombre} tiene contrato "Obra o Faena" y no tiene un anexo de renovación al día. Antes de trasladarlo, un supervisor o el administrador debe crear una solicitud de Renovación para este trabajador y esperar a que se apruebe.`;
      submitBtn.disabled = true;
    } else {
      alerta.hidden = true;
      submitBtn.disabled = false;
    }
  });
  wireBonoToggles();
}

/* ---------------- AUMENTO DE SUELDO ---------------- */
function bodyAumentoSueldo(sol) {
  const v = sol?.detalle || {};
  return `
    ${selectTrabajador('cam-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Sueldo líquido actual</label>
        <input type="number" id="cam-sueldo-actual" disabled placeholder="Se completa al elegir el trabajador" value="${v.sueldo_actual ?? ''}"></div>
      <div class="form-field"><label class="form-label">Nuevo sueldo líquido <span class="req">*</span></label>
        <input type="number" name="sueldo_nuevo" required min="0" value="${v.sueldo_nuevo ?? ''}"></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Fecha efectiva</label>
      <input type="date" name="fecha_efectiva" value="${v.fecha_efectiva || ''}"></div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(v.motivo || '')}</textarea></div></div>
  `;
}
function wireAumentoSueldo() {
  document.getElementById('cam-trab').addEventListener('change', (e) => {
    const t = trabajadores.find(x => x.id === e.target.value);
    document.getElementById('cam-sueldo-actual').value = t?.sueldo_liquido ?? '';
  });
}

/* ---------------- BONO ---------------- */
function bodyBono(sol) {
  const v = sol?.detalle || {};
  return `
    ${selectTrabajador('bono-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Tipo de bono <span class="req">*</span></label>
        <select name="tipo_bono" required>${optsBono(v.tipo_bono || '')}</select></div>
      <div class="form-field"><label class="form-label">Monto <span class="req">*</span></label>
        <input type="number" name="monto" required min="0" value="${v.monto ?? ''}"></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Período / fecha</label>
      <input type="text" name="periodo" placeholder="Ej: octubre 2026 / pago único" value="${escapeHtml(v.periodo || '')}"></div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(v.motivo || '')}</textarea></div></div>
  `;
}

/* ---------------- CAMBIO DE CARGO ---------------- */
function bodyCambioCargo(sol) {
  const v = sol?.detalle || {};
  return `
    ${selectTrabajador('cc-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Cargo actual</label>
        <input type="text" id="cc-cargo-actual" disabled placeholder="Se completa al elegir el trabajador" value="${escapeHtml(v.cargo_actual || '')}"></div>
      <div class="form-field"><label class="form-label">Cargo nuevo <span class="req">*</span></label>
        <select name="cargo_nuevo" required>${optsCargos(v.cargo_nuevo || '')}</select></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Fecha efectiva</label>
      <input type="date" name="fecha_efectiva" value="${v.fecha_efectiva || ''}"></div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(v.motivo || '')}</textarea></div></div>
  `;
}
function wireCambioCargo() {
  document.getElementById('cc-trab').addEventListener('change', (e) => {
    const t = trabajadores.find(x => x.id === e.target.value);
    document.getElementById('cc-cargo-actual').value = t?.cargo ?? '';
  });
}

/* ---------------- RENOVACIÓN ---------------- */
function bodyRenovacion(sol) {
  const v = sol?.detalle || {};
  return `
    ${selectTrabajador('ren-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Tipo de contrato actual</label>
        <select id="ren-contrato-actual" disabled>${optsContrato()}</select></div>
      <div class="form-field"><label class="form-label">Fecha de término actual</label>
        <input type="date" name="fecha_termino_actual" value="${v.fecha_termino_actual || ''}"></div>
    </div></div>
    <div class="form-section">
      <label class="bono-toggle"><input type="checkbox" id="ren-indefinido" ${v.indefinido ? 'checked' : ''}> El contrato pasa a <strong>indefinido</strong> (sin fecha de término, se puede seguir renovando sin límite)</label>
    </div>
    <div class="form-section" id="ren-fechas-section" ${v.indefinido ? 'hidden' : ''}><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Nueva fecha de término</label>
        <input type="date" name="nueva_fecha_termino" value="${v.nueva_fecha_termino || ''}"></div>
      <div class="form-field"><label class="form-label">Nuevo plazo (si no hay fecha exacta)</label>
        <input type="text" name="nuevo_plazo" placeholder="Ej: 3 meses más" value="${escapeHtml(v.nuevo_plazo || '')}"></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(v.motivo || '')}</textarea></div></div>
  `;
}
function wireRenovacionIndefinido() {
  const chk = document.getElementById('ren-indefinido');
  const seccionFechas = document.getElementById('ren-fechas-section');
  const form = document.getElementById('sol-form');
  chk.addEventListener('change', () => {
    seccionFechas.hidden = chk.checked;
    if (chk.checked) {
      form.nueva_fecha_termino.value = '';
      form.nuevo_plazo.value = '';
    }
  });
}
function wireRenovacion() {
  document.getElementById('ren-trab').addEventListener('change', () => {
    // El maestro de trabajadores hoy no guarda tipo de contrato; queda como referencia editable.
  });
  wireRenovacionIndefinido();
}

/* ---------------- DESVINCULACIÓN ---------------- */
function bodyDesvinculacion(sol) {
  const v = sol?.detalle || {};
  return `
    ${selectTrabajador('des-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Causal <span class="req">*</span></label>
        <select name="causal" required>${optsCausales(v.causal || '')}</select></div>
      <div class="form-field"><label class="form-label">Fecha de desvinculación <span class="req">*</span></label>
        <input type="date" name="fecha_desvinculacion" required value="${v.fecha_desvinculacion || ''}"></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Observaciones</label>
      <textarea name="observaciones" placeholder="Detalle adicional (opcional)">${escapeHtml(v.observaciones || '')}</textarea></div></div>
  `;
}

/* ---------------- SUBMIT ---------------- */
async function onSubmit(e, getTipo) {
  e.preventDefault();
  const tipo = getTipo();
  const f = e.target;
  const errorEl = document.getElementById('sol-error');
  const btn = document.getElementById('sol-submit');
  errorEl.hidden = true;

  const BUILDERS = {
    ingreso: buildIngreso,
    traslado: buildTraslado,
    aumento_sueldo: buildAumentoSueldo,
    bono: buildBono,
    cambio_cargo: buildCambioCargo,
    renovacion: buildRenovacion,
    desvinculacion: buildDesvinculacion
  };

  let payload;
  try {
    payload = BUILDERS[tipo](f);
  } catch (msg) {
    errorEl.textContent = msg; errorEl.hidden = false; return;
  }

  if (editando) {
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      await Data.editarSolicitud(editando.id, { motivo: payload.motivo, detalle: payload.detalle });
      Toast.success('Solicitud actualizada', '');
      window.Router.go('mis-solicitudes');
    } catch (err) {
      console.error('[nueva-solicitud] editar:', err);
      errorEl.textContent = err.message || 'No se pudieron guardar los cambios.';
      errorEl.hidden = false;
      btn.disabled = false; btn.textContent = 'Guardar cambios';
    }
    return;
  }

  btn.disabled = true; btn.textContent = 'Creando...';
  try {
    const sol = TIPOS_CAMBIO.includes(tipo)
      ? await Data.crearSolicitudCambio(payload)
      : await Data.crearSolicitud(payload);
    if (sol?.id) Data.notificar('pendiente_aprobador', sol.id); // fire-and-forget
    Toast.success('Solicitud creada', `${sol?.codigo || ''} quedó pendiente de aprobación.`);
    window.Router.go('inicio');
  } catch (err) {
    console.error('[nueva-solicitud] crear:', err);
    errorEl.textContent = err.message || 'No se pudo crear la solicitud.';
    errorEl.hidden = false;
    btn.disabled = false; btn.textContent = 'Crear solicitud';
  }
}

function buildIngreso(f) {
  if (!txt(f.cargo.value)) throw 'Indica el cargo.';
  if (!num(f.cantidad.value)) throw 'Indica la cantidad.';
  if (!f.centro_costo.value) throw 'Selecciona el centro de costo.';
  return {
    tipo: 'ingreso',
    trabajador_id: null,
    centro_origen_id: f.centro_costo.value,
    centro_destino_id: null,
    motivo: txt(f.motivo.value),
    detalle: {
      cargo: txt(f.cargo.value),
      cantidad: num(f.cantidad.value),
      sueldo_liquido: num(f.sueldo_liquido.value),
      tipo_contrato: f.tipo_contrato.value,
      plazo: txt(f.plazo.value),
      turno: f.turno.value,
      horario: txt(f.horario.value),
      fecha_ingreso: f.fecha_ingreso.value || null,
      cliente: txt(f.cliente.value)
    }
  };
}

function buildTraslado(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  if (!f.centro_origen.value) throw 'Selecciona la obra de origen.';
  if (!f.centro_destino.value) throw 'Selecciona la obra de destino.';
  if (f.centro_origen.value === f.centro_destino.value) throw 'La obra de destino debe ser distinta a la de origen.';

  const detalle = {
    cargo: txt(f.cargo.value),
    fecha_traslado: f.fecha_traslado.value || null,
    modificaciones_contractuales: txt(f.modificaciones.value),
    turno: f.turno.value,
    horario: txt(f.horario.value),
    sueldo_liquido_actual: num(f.sueldo_liquido_actual.value),
    nuevo_sueldo_liquido: num(f.nuevo_sueldo_liquido.value),
    bono_nocturno: document.getElementById('chk-nocturno').checked
      ? { aplica: true, porcentaje: num(f.bn_porcentaje.value), periodo: txt(f.bn_periodo.value) }
      : { aplica: false },
    bono_trato: document.getElementById('chk-trato').checked
      ? { aplica: true, monto: num(f.bt_monto.value), dias_asignacion: num(f.bt_dias.value) }
      : { aplica: false }
  };

  return {
    tipo: 'traslado',
    trabajador_id: f.trabajador_id.value,
    centro_origen_id: f.centro_origen.value,
    centro_destino_id: f.centro_destino.value,
    motivo: null,
    detalle
  };
}

function buildAumentoSueldo(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  if (!num(f.sueldo_nuevo.value)) throw 'Indica el nuevo sueldo líquido.';
  const t = trabajadores.find(x => x.id === f.trabajador_id.value);
  return {
    tipo: 'aumento_sueldo',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      sueldo_actual: t?.sueldo_liquido ?? null,
      sueldo_nuevo: num(f.sueldo_nuevo.value),
      fecha_efectiva: f.fecha_efectiva.value || null,
      motivo: txt(f.motivo.value)
    }
  };
}

function buildBono(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  if (!num(f.monto.value)) throw 'Indica el monto del bono.';
  return {
    tipo: 'bono',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      tipo_bono: f.tipo_bono.value,
      monto: num(f.monto.value),
      periodo: txt(f.periodo.value),
      motivo: txt(f.motivo.value)
    }
  };
}

function buildCambioCargo(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  if (!f.cargo_nuevo.value) throw 'Selecciona el cargo nuevo.';
  const t = trabajadores.find(x => x.id === f.trabajador_id.value);
  return {
    tipo: 'cambio_cargo',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      cargo_actual: t?.cargo ?? null,
      cargo_nuevo: f.cargo_nuevo.value,
      fecha_efectiva: f.fecha_efectiva.value || null,
      motivo: txt(f.motivo.value)
    }
  };
}

function buildRenovacion(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  const indefinido = document.getElementById('ren-indefinido').checked;
  if (!indefinido && !f.nueva_fecha_termino.value && !txt(f.nuevo_plazo.value)) {
    throw 'Indica la nueva fecha de término, el nuevo plazo, o marca que pasa a indefinido.';
  }
  return {
    tipo: 'renovacion',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      fecha_termino_actual: f.fecha_termino_actual.value || null,
      indefinido,
      nueva_fecha_termino: indefinido ? null : (f.nueva_fecha_termino.value || null),
      nuevo_plazo: indefinido ? null : txt(f.nuevo_plazo.value),
      motivo: txt(f.motivo.value)
    }
  };
}

function buildDesvinculacion(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  if (!f.causal.value) throw 'Selecciona la causal.';
  if (!f.fecha_desvinculacion.value) throw 'Indica la fecha de desvinculación.';
  return {
    tipo: 'desvinculacion',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      causal: f.causal.value,
      fecha_desvinculacion: f.fecha_desvinculacion.value,
      observaciones: txt(f.observaciones.value)
    }
  };
}
