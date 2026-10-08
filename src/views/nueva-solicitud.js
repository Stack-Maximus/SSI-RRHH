/**
 * Vista "Nueva solicitud" · formularios de Ingreso, Traslado, y Aumento de
 * sueldo / Cambio de cargo / Renovación / Desvinculación (esta última tanda,
 * sobre un trabajador ya contratado). El rol `solicitante` ve los 6
 * (unificado -- antes los "de cambio" eran solo de `supervisor`, ver
 * migración 0019); el segmento de tipos visibles según el rol sigue viviendo
 * en TIPOS_SOLICITUD_POR_ROL (config.js). Ingreso/Traslado llaman a
 * crear_solicitud(); los tipos de cambio llaman a crear_solicitud_cambio()
 * (aprueba solo el administrador de obra del centro del trabajador). Los
 * campos propios de cada tipo se guardan en `detalle` (JSONB).
 *
 * Ajustes de oct. 2026 (a pedido, ver NOTAS sección 16): Ingreso sin
 * "Obra o Faena" ni Horario, con turno "Artículo 22" y Horario de colación;
 * Traslado sin sueldos, sin Horario y sin Bonos; Aumento de sueldo pide solo
 * el monto del aumento; el tipo Bono ya no se crea; Renovación toma el tipo
 * de contrato del trabajador y pide el tipo de renovación; Desvinculación
 * sin causal disciplinaria. Las solicitudes antiguas conservan sus campos
 * tal cual (solicitud-format.js los sigue mostrando).
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
import {
  TIPOS_SOLICITUD_POR_ROL, TIPO_SOLICITUD_META, TIPOS_CONTRATO_INGRESO, CAUSALES_DESVINCULACION,
  TIPO_RENOVACION_LABELS, DIAS_HABILES_PROCESO_RRHH
} from '../config.js';

let centros = [];
let trabajadores = [];
let cargos = [];
// Distinto de null mientras se está editando una solicitud existente en vez
// de crear una nueva: { id, tipo }. Lo consultan renderBody/onSubmit para
// saber qué formulario mostrar (fijo vs. editable) y qué hacer al enviar.
let editando = null;

// 3 turnos fijos, cada uno con su horario de Lunes a Jueves y su horario
// (distinto, jornada reducida) del Viernes, más "Artículo 22" (trabajador
// excluido de la limitación de jornada, Art. 22 del Código del Trabajo: sin
// horario fijo). Se guarda el texto completo tal cual en detalle.turno
// (mismo criterio que el resto del formulario: sin tabla de códigos aparte,
// el texto ya es autoexplicativo en el comprobante, el Excel maestro, etc.).
// El turno ya define el horario, por eso Ingreso y Traslado no tienen un
// campo "Horario" aparte (se quitó en oct. 2026).
const TURNOS = [
  'Lunes a Jueves 08:00 a 17:30 · Viernes 08:00 a 17:00',
  'Lunes a Jueves 07:30 a 17:00 · Viernes 07:30 a 16:30',
  'Lunes a Jueves 21:00 a 06:00 · Viernes 22:00 a 06:00 (Turno Noche)',
  'Artículo 22 (sin limitación de jornada)'
];
const COLACIONES = ['30 minutos', '60 minutos'];

// Tipos que se crean vía crear_solicitud_cambio() (sobre un trabajador ya contratado)
const TIPOS_CAMBIO = ['aumento_sueldo', 'cambio_cargo', 'renovacion', 'desvinculacion'];

const avisoPlazo = (queCosa) => `
    <div class="form-section"><div class="form-info">
      ⏱️ Desde que la solicitud queda aprobada, ${queCosa} tiene una demora de hasta <b>${DIAS_HABILES_PROCESO_RRHH} días hábiles</b> como máximo.
    </div></div>`;

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
/**
 * <option>s de una lista fija. Si `sel` trae un valor que ya no está en la
 * lista (una solicitud antigua que se está editando: "Obra o Faena" en un
 * Ingreso, la causal disciplinaria, un turno viejo...), se agrega igual
 * como opción elegida -- editar no debe cambiar en silencio un dato ya
 * guardado. Con `placeholder`, la primera opción queda vacía (obliga a elegir).
 */
function optsLista(lista, sel = '', placeholder = null) {
  const items = sel && !lista.includes(sel) ? [...lista, sel] : lista;
  return (placeholder !== null ? `<option value="">${placeholder}</option>` : '') +
    items.map(t => `<option ${t === sel ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
}
function optsContrato(sel = '') { return optsLista(TIPOS_CONTRATO_INGRESO, sel); }
function optsTurno(sel = '')    { return optsLista(TURNOS, sel); }
function optsColacion(sel = '') { return optsLista(COLACIONES, sel, '— Seleccionar —'); }
function optsCausales(sel = '') { return optsLista(CAUSALES_DESVINCULACION, sel); }
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
      // Un tipo que ya no tiene formulario (Bono, quitado en oct. 2026) no se
      // puede editar -- sigue su curso de aprobación normal tal como se creó.
      if (!FORMULARIOS[solEditar.tipo]) throw new Error(`Las solicitudes de ${TIPO_SOLICITUD_META[solEditar.tipo]?.label || solEditar.tipo} ya no se editan desde el sistema.`);
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

// Formulario de cada tipo: `body` arma el HTML, `build` valida y arma el
// payload. Un tipo que no está acá (Bono) ya no se puede crear ni editar.
// (Las funciones de abajo son declaraciones, así que ya existen al evaluar esto.)
const FORMULARIOS = {
  ingreso:        { body: bodyIngreso,        build: buildIngreso },
  traslado:       { body: bodyTraslado,       build: buildTraslado },
  aumento_sueldo: { body: bodyAumentoSueldo,  build: buildAumentoSueldo },
  cambio_cargo:   { body: bodyCambioCargo,    build: buildCambioCargo },
  renovacion:     { body: bodyRenovacion,     build: buildRenovacion },
  desvinculacion: { body: bodyDesvinculacion, build: buildDesvinculacion }
};

function renderBody(tipo, sol) {
  const body = document.getElementById('form-body');
  // Cada tipo arranca con el botón habilitado -- traslado es el único que
  // puede volver a deshabilitarlo (ver wireTraslado) si el trabajador
  // elegido requiere un anexo de renovación al día.
  const submitBtn = document.getElementById('sol-submit');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = editando ? 'Guardar cambios' : 'Crear solicitud'; }

  body.innerHTML = (FORMULARIOS[tipo] || FORMULARIOS.ingreso).body(sol);

  if (!editando) {
    if (tipo === 'traslado') wireTraslado();
    if (tipo === 'cambio_cargo') wireCambioCargo();
    if (tipo === 'renovacion') wireRenovacion();
  }
  // El selector "Tipo de renovación" sigue siendo interactivo en modo
  // edición -- lo único fijo es el trabajador y el/los centro(s).
  if (tipo === 'renovacion') wireTipoRenovacion();
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
      <div class="form-field"><label class="form-label">Horario de colación <span class="req">*</span></label>
        <select name="colacion" required>${optsColacion(v.colacion || '')}</select></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Sueldo líquido pactado</label>
        <input type="number" name="sueldo_liquido" min="0" placeholder="Ej: 800000" value="${v.sueldo_liquido ?? ''}"></div>
      <div class="form-field"><label class="form-label">Fecha de ingreso a obra</label>
        <input type="date" name="fecha_ingreso" value="${v.fecha_ingreso || ''}"></div>
    </div></div>
    <div class="form-section"><div class="form-field"><label class="form-label">Motivo / observaciones</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(sol?.motivo || '')}</textarea></div></div>
  `;
}

/* ---------------- TRASLADO ---------------- */
// Sin sueldos, sin Horario (lo define el turno) y sin Bonos (oct. 2026).
function bodyTraslado(sol) {
  const v = sol?.detalle || {};
  const nombreOrigen = editando ? (centros.find(c => c.id === sol.centro_origen_id)?.nombre || '(centro no disponible)') : null;
  const nombreDestino = editando ? (centros.find(c => c.id === sol.centro_destino_id)?.nombre || '(centro no disponible)') : null;
  return `
    ${avisoPlazo('el traslado')}
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
    <div class="form-section"><div class="form-field">
      <label class="form-label">Turno</label>
      <select name="turno">${optsTurno(v.turno)}</select>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Modificaciones contractuales</label>
      <textarea name="modificaciones" placeholder="Detalle de cambios en el contrato (opcional)">${escapeHtml(v.modificaciones_contractuales || '')}</textarea>
    </div></div>
  `;
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
}

/* ---------------- AUMENTO DE SUELDO ---------------- */
// Solo el monto del aumento (oct. 2026): ya no se muestra ni se pide el
// sueldo actual, el nuevo sueldo ni la fecha efectiva. Al editar una
// solicitud antigua (sueldo_actual -> sueldo_nuevo) se precarga la diferencia.
function bodyAumentoSueldo(sol) {
  const v = sol?.detalle || {};
  const montoPrevio = v.monto_aumento ??
    (v.sueldo_nuevo != null && v.sueldo_actual != null ? v.sueldo_nuevo - v.sueldo_actual : '');
  return `
    ${selectTrabajador('cam-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-field">
      <label class="form-label">Monto del aumento de sueldo ($) <span class="req">*</span></label>
      <input type="number" name="monto_aumento" required min="1" step="1" placeholder="Ej: 50000" value="${montoPrevio}">
      <p class="hint">¿En cuánto se quiere aumentar el sueldo? Escribe solo el monto del aumento, no el sueldo final.</p>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(v.motivo || '')}</textarea></div></div>
  `;
}

/* ---------------- CAMBIO DE CARGO ---------------- */
function bodyCambioCargo(sol) {
  const v = sol?.detalle || {};
  return `
    ${avisoPlazo('el cambio de cargo')}
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
// Tipo de renovación que corresponde por defecto al contrato actual del
// trabajador (se puede cambiar: p. ej. un plazo fijo que se renueva por obra).
const RENOVACION_POR_CONTRATO = { 'Plazo Fijo': 'plazo', 'Obra o Faena': 'obra_faena' };
const SIN_CONTRATO_REGISTRADO = 'No registrado en el maestro';

/** Tipo de renovación de una solicitud ya guardada (las antiguas no traen tipo_renovacion). */
function tipoRenovacionDe(v) {
  if (v.tipo_renovacion) return v.tipo_renovacion;
  if (v.indefinido) return 'indefinido';
  if (v.nueva_fecha_termino || v.nuevo_plazo) return 'plazo';
  return '';
}

function bodyRenovacion(sol) {
  const v = sol?.detalle || {};
  const tipoRen = tipoRenovacionDe(v);
  const optsTipoRen = '<option value="">— Seleccionar tipo de renovación —</option>' +
    Object.entries(TIPO_RENOVACION_LABELS)
      .map(([k, l]) => `<option value="${k}" ${k === tipoRen ? 'selected' : ''}>${l}</option>`).join('');
  return `
    ${selectTrabajador('ren-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Tipo de contrato actual</label>
        <input type="text" name="tipo_contrato_actual" id="ren-contrato-actual" readonly
          placeholder="Se completa al elegir el trabajador" value="${escapeHtml(v.tipo_contrato_actual || '')}"></div>
      <div class="form-field"><label class="form-label">Fecha de término actual</label>
        <input type="date" name="fecha_termino_actual" id="ren-fecha-actual" value="${v.fecha_termino_actual || ''}"></div>
    </div></div>
    <div id="ren-aviso-indefinido" class="form-info" hidden></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Tipo de renovación <span class="req">*</span></label>
      <select name="tipo_renovacion" id="ren-tipo" required>${optsTipoRen}</select>
    </div></div>
    <div class="form-section" id="ren-sec-plazo" ${tipoRen === 'plazo' ? '' : 'hidden'}><div class="form-field">
      <label class="form-label">Fecha de culminación <span class="req">*</span></label>
      <input type="date" name="nueva_fecha_termino" value="${v.nueva_fecha_termino || ''}">
    </div></div>
    <div class="form-section" id="ren-sec-obra" ${tipoRen === 'obra_faena' ? '' : 'hidden'}><div class="form-field">
      <label class="form-label">Hito de la obra <span class="req">*</span></label>
      <input type="text" name="hito_obra" maxlength="300" placeholder="Ej: Término de obra gruesa Torre B" value="${escapeHtml(v.hito_obra || '')}">
      <p class="hint">El hito con el que termina el contrato (escríbelo como lo indica el anexo).</p>
    </div></div>
    <div class="form-section" id="ren-sec-indefinido" ${tipoRen === 'indefinido' ? '' : 'hidden'}>
      <p class="hint">El contrato queda sin fecha de término.</p>
    </div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(v.motivo || '')}</textarea></div></div>
  `;
}
/** Muestra solo el campo que pide el tipo de renovación elegido (create y edición). */
function wireTipoRenovacion() {
  const sel = document.getElementById('ren-tipo');
  const secciones = { plazo: 'ren-sec-plazo', obra_faena: 'ren-sec-obra', indefinido: 'ren-sec-indefinido' };
  const aplicar = () => {
    Object.entries(secciones).forEach(([k, id]) => { document.getElementById(id).hidden = sel.value !== k; });
  };
  sel.addEventListener('change', aplicar);
  aplicar();
}
/** Al elegir el trabajador: tipo de contrato y fecha de término actuales, tomados del maestro. */
function wireRenovacion() {
  document.getElementById('ren-trab').addEventListener('change', (e) => {
    const t = trabajadores.find(x => x.id === e.target.value);
    const contrato = t?.contrato_indefinido ? 'Indefinido' : (t?.tipo_contrato || '');
    document.getElementById('ren-contrato-actual').value = t ? (contrato || SIN_CONTRATO_REGISTRADO) : '';
    document.getElementById('ren-fecha-actual').value = t && !t.contrato_indefinido ? (t.fecha_termino_contrato || '') : '';

    const aviso = document.getElementById('ren-aviso-indefinido');
    aviso.hidden = contrato !== 'Indefinido';
    aviso.textContent = contrato === 'Indefinido'
      ? `ℹ️ Según el maestro de Trabajadores, ${t.nombre} ya tiene contrato indefinido.` : '';

    const sel = document.getElementById('ren-tipo');
    sel.value = RENOVACION_POR_CONTRATO[contrato] || '';
    sel.dispatchEvent(new Event('change'));
  });
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

  let payload;
  try {
    if (!FORMULARIOS[tipo]) throw 'Este tipo de solicitud ya no está disponible.';
    payload = FORMULARIOS[tipo].build(f);
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
  if (!f.colacion.value) throw 'Selecciona el horario de colación.';
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
      colacion: f.colacion.value,
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
    turno: f.turno.value
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
  const monto = num(f.monto_aumento.value);
  if (!monto || monto <= 0) throw 'Indica el monto del aumento (mayor a cero).';
  return {
    tipo: 'aumento_sueldo',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      monto_aumento: monto,
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

// `nueva_fecha_termino` e `indefinido` mantienen el nombre de antes a
// propósito: son los que lee el trigger de la base al aprobarse (0008, y su
// reemplazo en 0020), así una renovación "a plazo" o "indefinida" actualiza
// el maestro de Trabajadores igual que siempre.
function buildRenovacion(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  const tipoRen = f.tipo_renovacion.value;
  if (!TIPO_RENOVACION_LABELS[tipoRen]) throw 'Selecciona el tipo de renovación.';
  const fechaActual = f.fecha_termino_actual.value || null;
  const fechaNueva = f.nueva_fecha_termino.value || null;
  const hito = txt(f.hito_obra.value);
  if (tipoRen === 'plazo') {
    if (!fechaNueva) throw 'Indica la fecha de culminación del contrato.';
    if (fechaActual && fechaNueva <= fechaActual) throw 'La fecha de culminación debe ser posterior a la fecha de término actual.';
  }
  if (tipoRen === 'obra_faena' && !hito) throw 'Indica el hito de la obra con el que termina el contrato.';
  return {
    tipo: 'renovacion',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      tipo_contrato_actual: f.tipo_contrato_actual.value === SIN_CONTRATO_REGISTRADO ? null : txt(f.tipo_contrato_actual.value),
      fecha_termino_actual: fechaActual,
      tipo_renovacion: tipoRen,
      nueva_fecha_termino: tipoRen === 'plazo' ? fechaNueva : null,
      hito_obra: tipoRen === 'obra_faena' ? hito : null,
      indefinido: tipoRen === 'indefinido',
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
