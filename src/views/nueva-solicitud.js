/**
 * Vista "Nueva solicitud" · formularios de Ingreso, Traslado, y Aumento de
 * sueldo / Cambio de cargo / Cambio de turno / Renovación / Desvinculación
 * (esta última tanda, sobre un trabajador ya contratado). El rol `solicitante` ve los 7
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
 * Ajustes de fines de oct. 2026 (NOTAS sección 21): al elegir el tipo se
 * abre un MODAL con sus campos (Cancelar / Crear solicitud; al crear se
 * cierra y vuelve al Inicio); Traslado ya no pide Turno; nuevo tipo Cambio
 * de turno; Desvinculación con causal "Ausentismo" y adjunto obligatorio en
 * "Renuncia voluntaria"; todos los formularios avisan el plazo de RRHH (3
 * días hábiles) y las fechas de ingreso / traslado / efectiva no se pueden
 * pedir antes de hoy + 3 días hábiles.
 *
 * MODO EDICIÓN: cuando Router.go('nueva-solicitud', {editId}) trae un id
 * (ver mis-solicitudes.js), esta misma vista carga esa solicitud y reusa
 * los mismos formularios, pero:
 *  - Precarga cada campo con lo ya guardado (detalle + motivo).
 *  - Bloquea tipo / trabajador / centro(s) -- son los que definen quién
 *    aprueba, no se pueden tocar en una edición (ver migración 0017).
 *  - Al enviar, llama a Data.editarSolicitud() en vez de crear una nueva.
 *  - Se muestra en la página (no en el modal), como antes.
 * Las funciones build*() (validación + armado de `detalle`) son EXACTAMENTE
 * las mismas en los dos modos -- no hace falta duplicarlas: en modo edición
 * los campos fijos viajan como <input type="hidden"> con el mismo `name`,
 * así que f.campo.value sigue funcionando igual.
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { Modal } from '../ui/modal.js';
import { escapeHtml } from '../ui/utils.js';
import {
  TIPOS_SOLICITUD_POR_ROL, TIPO_SOLICITUD_META, TIPOS_CONTRATO_INGRESO, CAUSALES_DESVINCULACION,
  CAUSALES_CON_ADJUNTO, ADJUNTO_SOLICITUD, TURNOS, TIPO_RENOVACION_LABELS, DIAS_HABILES_PROCESO_RRHH
} from '../config.js';
import { sumarDiasHabiles, fechaLocalISO } from '../utils/dias-habiles.js';

let centros = [];
let trabajadores = [];
let cargos = [];
// Distinto de null mientras se está editando una solicitud existente en vez
// de crear una nueva: { id, tipo }. Lo consultan renderBody/onSubmit para
// saber qué formulario mostrar (fijo vs. editable) y qué hacer al enviar.
let editando = null;
// Adjunto ya guardado de la solicitud que se está editando (Desvinculación):
// si no se elige un archivo nuevo, se conserva este.
let adjuntoPrevio = null;
// Primera fecha que se puede pedir como fecha de ingreso / traslado /
// efectiva: hoy + DIAS_HABILES_PROCESO_RRHH días hábiles ('YYYY-MM-DD',
// hora local). Se recalcula cada vez que se abre la vista.
let fechaMin = '';

// TURNOS vive en config.js (lo comparten Ingreso y Cambio de turno). El
// turno ya define el horario, por eso Ingreso no tiene un campo "Horario"
// aparte (se quitó en oct. 2026); Traslado tampoco pide turno desde oct. 2026
// (para cambiar el turno de alguien está el tipo Cambio de turno).
const COLACIONES = ['30 minutos', '60 minutos'];

// Tipos que se crean vía crear_solicitud_cambio() (sobre un trabajador ya contratado)
const TIPOS_CAMBIO = ['aumento_sueldo', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion'];

const PLAZO = DIAS_HABILES_PROCESO_RRHH;

/** 'YYYY-MM-DD' -> "lunes 2 de noviembre" (sin pasar por UTC). */
function fechaLarga(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
}

/**
 * Aviso del plazo de RRHH (en TODOS los formularios, a pedido -- oct. 2026).
 * Con `campo`, además explica desde qué fecha se puede pedir ese campo.
 */
const avisoPlazo = (queCosa, campo = null) => `
    <div class="form-section"><div class="form-info aviso-plazo">
      ⏱️ Una vez aprobada la solicitud, RRHH tiene un plazo máximo de <b>${PLAZO} días hábiles</b> para procesar ${queCosa}.
      ${campo ? `Por eso la ${campo} no puede ser antes del <b>${fechaLarga(fechaMin)}</b>.` : ''}
    </div></div>`;

/**
 * Campo de fecha con el mínimo de hoy + 3 días hábiles.
 *  - modo 'bloquear': el calendario no deja elegir días anteriores (atributo
 *    min) y, si se escribe una fecha anterior a mano, el formulario no se
 *    envía (setCustomValidity + validación en build*()).
 *  - modo 'avisar': deja cualquier fecha, pero si es anterior al mínimo
 *    muestra una advertencia (Desvinculación: la fecha la fija la causal,
 *    p. ej. el último día que indica la carta de renuncia).
 */
function campoFecha(name, label, valor, { requerido = false, modo = 'bloquear' } = {}) {
  return `<div class="form-field"><label class="form-label">${label}${requerido ? ' <span class="req">*</span>' : ''}</label>
        <input type="date" name="${name}" data-fecha-min="${modo}" ${modo === 'bloquear' ? `min="${fechaMin}"` : ''} ${requerido ? 'required' : ''} value="${valor || ''}">
        <p class="form-hint">${modo === 'bloquear' ? `Desde el ${fechaLarga(fechaMin)}` : `Ideal: desde el ${fechaLarga(fechaMin)}`} (${PLAZO} días hábiles)</p>
        <div class="fecha-aviso" hidden></div></div>`;
}

/** Revisa los campos de fecha con mínimo al cambiar (y al abrir, para las ediciones). */
function wireFechas(root) {
  root.querySelectorAll('input[data-fecha-min]').forEach(inp => {
    const aviso = inp.parentElement.querySelector('.fecha-aviso');
    const revisar = () => {
      const antes = inp.value && inp.value < fechaMin;
      const bloquea = inp.dataset.fechaMin === 'bloquear';
      const msg = antes
        ? (bloquea
          ? `RRHH necesita hasta ${PLAZO} días hábiles: elige una fecha desde el ${fechaLarga(fechaMin)}.`
          : `Ojo: es antes de los ${PLAZO} días hábiles que RRHH puede necesitar para procesarla (${fechaLarga(fechaMin)}).`)
        : '';
      inp.setCustomValidity(antes && bloquea ? msg : '');
      aviso.hidden = !antes;
      aviso.className = 'fecha-aviso ' + (bloquea ? 'fecha-aviso-error' : 'fecha-aviso-warn');
      aviso.textContent = msg;
    };
    inp.addEventListener('input', revisar);
    inp.addEventListener('change', revisar);
    revisar();
  });
}

/** Validación de la fecha mínima en build*() (por si el navegador no respeta `min`). */
function exigirFechaMin(valor, queFecha) {
  if (valor && valor < fechaMin) {
    throw `La ${queFecha} no puede ser antes del ${fechaLarga(fechaMin)}: RRHH necesita hasta ${PLAZO} días hábiles para procesar la solicitud.`;
  }
}

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
  adjuntoPrevio = null;
  fechaMin = fechaLocalISO(sumarDiasHabiles(new Date(), PLAZO));
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

  if (editando) renderEdicion(container, solEditar);
  else renderSelectorTipos(container);
}

/**
 * Crear (oct. 2026, a pedido): la vista muestra solo las tarjetas de tipo;
 * al elegir una se abre un modal con los campos de ese tipo y los botones
 * Cancelar / Crear solicitud. Al crearla se cierra el modal y se vuelve al
 * Inicio, igual que antes.
 */
function renderSelectorTipos(container) {
  const tiposVisibles = TIPOS_SOLICITUD_POR_ROL[state.user.role] || ['ingreso', 'traslado'];
  container.innerHTML = `
    <div class="view-form view-tipos">
      <div class="form-card">
        <div class="tipos-intro">
          <h2 class="tipos-titulo">¿Qué necesitas solicitar?</h2>
          <p class="form-hint">Elige el tipo de solicitud: se abre una ventana con sus campos. Al crearla, vuelves al inicio.</p>
        </div>
        <div class="segment-control tipo-grid" id="tipo-control">${tiposVisibles.map(t => {
          const m = TIPO_SOLICITUD_META[t];
          return `<button type="button" class="segment-btn tipo-card" data-tipo="${t}">
            <span class="segment-icon">${m.icon}</span><span>${m.label}</span>
            <span class="segment-desc">${m.desc}</span>
            <span class="tipo-card-ir" aria-hidden="true">→</span>
          </button>`;
        }).join('')}</div>
        <div class="form-info">⏱️ Una vez aprobada, RRHH tiene un plazo máximo de <b>${PLAZO} días hábiles</b> para procesar cada solicitud. Por eso las fechas de ingreso, traslado o cambio se pueden pedir desde el <b>${fechaLarga(fechaMin)}</b>.</div>
      </div>
    </div>`;

  container.querySelectorAll('#tipo-control .tipo-card').forEach(btn => {
    btn.addEventListener('click', () => abrirFormulario(btn.dataset.tipo));
  });
}

function abrirFormulario(tipo) {
  const m = TIPO_SOLICITUD_META[tipo];
  Modal.open({
    title: `${m.icon} ${escapeHtml(m.label)}`,
    size: 'lg',
    // No se cierra con un clic afuera ni con Esc: se perdería lo escrito.
    descartable: false,
    content: `
      <form id="sol-form" class="sol-form-modal" autocomplete="off">
        <p class="form-hint">${escapeHtml(m.desc)}.</p>
        <div id="form-body"></div>
        <div id="sol-error" class="form-error" hidden></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="sol-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="sol-submit">Crear solicitud</button>
        </div>
      </form>`
  });
  renderBody(tipo, null);
  document.getElementById('sol-cancel').addEventListener('click', () => Modal.close());
  document.getElementById('sol-form').addEventListener('submit', (e) => onSubmit(e, () => tipo));
  document.querySelector('#form-body select, #form-body input:not([type=hidden]), #form-body textarea')?.focus();
}

/**
 * Editar: se mantiene en la página (no en modal) -- se llega desde "Mis
 * solicitudes" con un tipo ya fijo, y Cancelar/Guardar vuelven allá.
 */
function renderEdicion(container, solEditar) {
  const m = TIPO_SOLICITUD_META[editando.tipo];
  container.innerHTML = `
    <div class="view-form">
      <div class="form-card">
        <p class="form-hint">✏️ Estás editando <b>${escapeHtml(solEditar.codigo || 'esta solicitud')}</b>. Los cambios se guardan sobre la misma solicitud, no se crea una nueva.</p>
        <div class="form-section">
          <label class="form-label">Tipo de solicitud</label>
          <div class="segment-control">
            <button type="button" class="segment-btn active" disabled>
              <span class="segment-icon">${m.icon}</span><span>${m.label}</span>
              <span class="segment-desc">No se puede cambiar el tipo al editar</span>
            </button>
          </div>
        </div>
        <form id="sol-form" autocomplete="off">
          <div id="form-body"></div>
          <div id="sol-error" class="form-error" hidden></div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="sol-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="sol-submit">Guardar cambios</button>
          </div>
        </form>
      </div>
    </div>
  `;
  renderBody(editando.tipo, solEditar);
  container.querySelector('#sol-cancel').addEventListener('click', () => window.Router.go('mis-solicitudes'));
  container.querySelector('#sol-form').addEventListener('submit', (e) => onSubmit(e, () => editando.tipo));
}

// Formulario de cada tipo: `body` arma el HTML, `build` valida y arma el
// payload. Un tipo que no está acá (Bono) ya no se puede crear ni editar.
// (Las funciones de abajo son declaraciones, así que ya existen al evaluar esto.)
const FORMULARIOS = {
  ingreso:        { body: bodyIngreso,        build: buildIngreso },
  traslado:       { body: bodyTraslado,       build: buildTraslado },
  aumento_sueldo: { body: bodyAumentoSueldo,  build: buildAumentoSueldo },
  cambio_cargo:   { body: bodyCambioCargo,    build: buildCambioCargo },
  cambio_turno:   { body: bodyCambioTurno,    build: buildCambioTurno },
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
  // El selector "Tipo de renovación" y la causal de desvinculación siguen
  // siendo interactivos en modo edición -- lo único fijo es el trabajador y
  // el/los centro(s).
  if (tipo === 'renovacion') wireTipoRenovacion();
  if (tipo === 'desvinculacion') wireDesvinculacion();
  wireFechas(body);
}

/* ---------------- INGRESO ---------------- */
function bodyIngreso(sol) {
  const v = sol?.detalle || {};
  const centroId = sol ? sol.centro_origen_id : (state.user.centroCostoId || '');
  const nombreCentro = editando ? (centros.find(c => c.id === centroId)?.nombre || '(centro no disponible)') : null;
  return `
    ${avisoPlazo('el ingreso', 'fecha de ingreso')}
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
      ${campoFecha('fecha_ingreso', 'Fecha de ingreso a obra', v.fecha_ingreso)}
    </div></div>
    <div class="form-section"><div class="form-field"><label class="form-label">Motivo / observaciones</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(sol?.motivo || '')}</textarea></div></div>
  `;
}

/* ---------------- TRASLADO ---------------- */
// Sin sueldos, sin Horario, sin Bonos (oct. 2026) y sin Turno (oct. 2026:
// para cambiar el turno está el tipo Cambio de turno). Un traslado antiguo
// que tenga turno lo conserva al editarse (input oculto turno_previo).
function bodyTraslado(sol) {
  const v = sol?.detalle || {};
  const nombreOrigen = editando ? (centros.find(c => c.id === sol.centro_origen_id)?.nombre || '(centro no disponible)') : null;
  const nombreDestino = editando ? (centros.find(c => c.id === sol.centro_destino_id)?.nombre || '(centro no disponible)') : null;
  return `
    ${avisoPlazo('el traslado', 'fecha de traslado')}
    ${selectTrabajador('trab-select', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div id="trab-alerta-contrato" class="form-error" hidden></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Cargo</label>
        <select name="cargo" id="trab-cargo">${optsCargos(v.cargo || '')}</select></div>
      ${campoFecha('fecha_traslado', 'Fecha de traslado', v.fecha_traslado)}
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
    ${v.turno ? `<input type="hidden" name="turno_previo" value="${escapeHtml(v.turno)}">` : ''}
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
    ${avisoPlazo('el aumento de sueldo')}
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
    ${avisoPlazo('el cambio de cargo', 'fecha efectiva')}
    ${selectTrabajador('cc-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Cargo actual</label>
        <input type="text" id="cc-cargo-actual" disabled placeholder="Se completa al elegir el trabajador" value="${escapeHtml(v.cargo_actual || '')}"></div>
      <div class="form-field"><label class="form-label">Cargo nuevo <span class="req">*</span></label>
        <select name="cargo_nuevo" required>${optsCargos(v.cargo_nuevo || '')}</select></div>
    </div></div>
    <div class="form-section">${campoFecha('fecha_efectiva', 'Fecha efectiva', v.fecha_efectiva)}</div>
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

/* ---------------- CAMBIO DE TURNO ---------------- */
// Nuevo en oct. 2026: solo el trabajador y el turno nuevo (+ motivo
// opcional). Aprueba el administrador de obra del centro del trabajador.
function bodyCambioTurno(sol) {
  const v = sol?.detalle || {};
  return `
    ${avisoPlazo('el cambio de turno')}
    ${selectTrabajador('tur-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-field">
      <label class="form-label">Turno nuevo <span class="req">*</span></label>
      <select name="turno_nuevo" required>${optsLista(TURNOS, v.turno_nuevo || '', '— Seleccionar turno —')}</select>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional">${escapeHtml(v.motivo || '')}</textarea></div></div>
  `;
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
    ${avisoPlazo('la renovación')}
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
// oct. 2026: causal "Ausentismo" nueva y, con "Renuncia voluntaria", es
// obligatorio adjuntar la carta de renuncia firmada (CAUSALES_CON_ADJUNTO).
// Para el resto de las causales el adjunto es opcional. La base de datos
// revalida la obligatoriedad (trigger de la migración 0022).
function bodyDesvinculacion(sol) {
  const v = sol?.detalle || {};
  adjuntoPrevio = v.adjunto?.path ? v.adjunto : null;
  const causal = v.causal || CAUSALES_DESVINCULACION[0];
  return `
    ${avisoPlazo('la desvinculación')}
    ${selectTrabajador('des-trab', sol?.trabajador_id || '', editando ? sol._trabajadorNombre : null)}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Causal <span class="req">*</span></label>
        <select name="causal" id="des-causal" required>${optsCausales(causal)}</select></div>
      ${campoFecha('fecha_desvinculacion', 'Fecha de desvinculación', v.fecha_desvinculacion, { requerido: true, modo: 'avisar' })}
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label" id="des-adjunto-label">Documento de respaldo</label>
      ${adjuntoPrevio ? `<p class="form-hint">📎 Ya adjuntaste <b>${escapeHtml(adjuntoPrevio.nombre || 'un documento')}</b>. Elige otro archivo solo si quieres reemplazarlo.</p>` : ''}
      <input type="file" name="adjunto" id="des-adjunto" accept="${ADJUNTO_SOLICITUD.accept}">
      <p class="form-hint" id="des-adjunto-hint"></p>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Observaciones</label>
      <textarea name="observaciones" placeholder="Detalle adicional (opcional)">${escapeHtml(v.observaciones || '')}</textarea></div></div>
  `;
}
const MB_MAX = Math.round(ADJUNTO_SOLICITUD.maxBytes / (1024 * 1024));
/** Según la causal: etiqueta, obligatoriedad y ayuda del campo adjunto. */
function wireDesvinculacion() {
  const sel = document.getElementById('des-causal');
  const label = document.getElementById('des-adjunto-label');
  const hint = document.getElementById('des-adjunto-hint');
  const aplicar = () => {
    const obligatorio = CAUSALES_CON_ADJUNTO.includes(sel.value);
    label.innerHTML = obligatorio
      ? 'Carta de renuncia firmada <span class="req">*</span>'
      : 'Documento de respaldo';
    hint.textContent = obligatorio
      ? `Obligatorio para ${sel.value}. PDF, imagen o Word, hasta ${MB_MAX} MB.`
      : `Opcional. PDF, imagen o Word, hasta ${MB_MAX} MB.`;
  };
  sel.addEventListener('change', aplicar);
  aplicar();
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

  // Archivo adjunto (Desvinculación): se sube primero al bucket privado y la
  // solicitud guarda solo su ruta. Si después falla el guardado, el archivo
  // queda huérfano en la carpeta del usuario (no lo puede ver nadie más).
  const archivo = payload._archivo;
  delete payload._archivo;
  const subirAdjunto = async () => {
    if (!archivo) return;
    btn.textContent = 'Subiendo documento...';
    payload.detalle.adjunto = await Data.subirAdjuntoSolicitud(archivo, state.user.id);
  };

  if (editando) {
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      await subirAdjunto();
      btn.textContent = 'Guardando...';
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
    await subirAdjunto();
    btn.textContent = 'Creando...';
    const sol = TIPOS_CAMBIO.includes(tipo)
      ? await Data.crearSolicitudCambio(payload)
      : await Data.crearSolicitud(payload);
    if (sol?.id) Data.notificar('pendiente_aprobador', sol.id); // fire-and-forget
    Toast.success('Solicitud creada', `${sol?.codigo || ''} quedó pendiente de aprobación.`);
    Modal.close();
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
  exigirFechaMin(f.fecha_ingreso.value, 'fecha de ingreso');
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
  exigirFechaMin(f.fecha_traslado.value, 'fecha de traslado');

  const detalle = {
    cargo: txt(f.cargo.value),
    fecha_traslado: f.fecha_traslado.value || null,
    modificaciones_contractuales: txt(f.modificaciones.value)
  };
  // Solo traslados antiguos (el formulario ya no pide turno).
  if (f.turno_previo?.value) detalle.turno = f.turno_previo.value;

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
  exigirFechaMin(f.fecha_efectiva.value, 'fecha efectiva');
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

function buildCambioTurno(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  if (!f.turno_nuevo.value) throw 'Selecciona el turno nuevo.';
  return {
    tipo: 'cambio_turno',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      turno_nuevo: f.turno_nuevo.value,
      motivo: txt(f.motivo.value)
    }
  };
}

function buildDesvinculacion(f) {
  if (!f.trabajador_id.value) throw 'Selecciona el trabajador.';
  if (!f.causal.value) throw 'Selecciona la causal.';
  if (!f.fecha_desvinculacion.value) throw 'Indica la fecha de desvinculación.';
  const archivo = f.adjunto.files?.[0] || null;
  if (archivo && archivo.size > ADJUNTO_SOLICITUD.maxBytes) throw `El documento pesa más de ${MB_MAX} MB.`;
  if (CAUSALES_CON_ADJUNTO.includes(f.causal.value) && !archivo && !adjuntoPrevio) {
    throw `Adjunta la carta de renuncia firmada: es obligatoria para ${f.causal.value}.`;
  }
  return {
    tipo: 'desvinculacion',
    trabajador_id: f.trabajador_id.value,
    detalle: {
      causal: f.causal.value,
      fecha_desvinculacion: f.fecha_desvinculacion.value,
      observaciones: txt(f.observaciones.value),
      // Si se eligió un archivo nuevo, onSubmit lo sube y reemplaza esto.
      adjunto: adjuntoPrevio
    },
    _archivo: archivo
  };
}
