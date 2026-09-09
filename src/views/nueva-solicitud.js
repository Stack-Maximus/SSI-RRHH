/**
 * Vista "Nueva solicitud" · formularios de Ingreso, Traslado (rol solicitante)
 * y Aumento de sueldo / Bono / Cambio de cargo / Renovación (rol supervisor,
 * sobre trabajadores ya contratados). El segmento de tipos visibles depende
 * del rol (TIPOS_SOLICITUD_POR_ROL en config.js). Ingreso/Traslado llaman a
 * crear_solicitud(); los 4 tipos de cambio llaman a crear_solicitud_cambio()
 * (aprueba solo el administrador de obra del centro del trabajador). Los
 * campos propios de cada tipo se guardan en `detalle` (JSONB).
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { TIPOS_SOLICITUD_POR_ROL, TIPO_SOLICITUD_META, TIPOS_CONTRATO, CAUSALES_DESVINCULACION } from '../config.js';

let centros = [];
let trabajadores = [];
let cargos = [];

const TURNOS = ['Diurno', 'Nocturno'];
const TIPOS_BONO = ['Bono Trato', 'Bono Nocturno', 'Bono Producción', 'Bono Responsabilidad', 'Otro'];

// Tipos que se crean vía crear_solicitud_cambio() (sobre un trabajador ya contratado)
const TIPOS_CAMBIO = ['aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion'];

const num = (v) => (v === '' || v == null ? null : Number(v));
const txt = (v) => (v && String(v).trim() ? String(v).trim() : null);

function optsCentros(sel) {
  return centros.map(c =>
    `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.codigo} · ${c.nombre}</option>`
  ).join('');
}
function optsContrato() { return TIPOS_CONTRATO.map(t => `<option>${t}</option>`).join(''); }
function optsTurno()    { return TURNOS.map(t => `<option>${t}</option>`).join(''); }
function optsBono()     { return TIPOS_BONO.map(t => `<option>${t}</option>`).join(''); }
function optsCausales() { return CAUSALES_DESVINCULACION.map(t => `<option>${t}</option>`).join(''); }
function optsCargos(sel) {
  return '<option value="">— Seleccionar cargo —</option>' +
    cargos.map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
}
function optsTrabajadores() {
  return trabajadores.map(t =>
    `<option value="${t.id}">${t.nombre}${t.cargo ? ' · ' + t.cargo : ''}</option>`
  ).join('');
}
function selectTrabajador(id = 'trab-select') {
  return `
    <div class="form-section"><div class="form-field">
      <label class="form-label">Trabajador <span class="req">*</span></label>
      <select name="trabajador_id" id="${id}" required>
        <option value="">— Seleccionar trabajador —</option>${optsTrabajadores()}
      </select>
    </div></div>`;
}

export async function renderNuevaSolicitud(container) {
  container.innerHTML = '<div class="view-loading">Cargando datos...</div>';
  try {
    [centros, trabajadores, cargos] = await Promise.all([Data.centros(), Data.trabajadores(), Data.cargos()]);
  } catch (e) {
    console.error('[nueva-solicitud]', e);
    Toast.error('Error', 'No se pudieron cargar centros o trabajadores.');
    centros = centros || []; trabajadores = trabajadores || []; cargos = cargos || [];
  }

  if (centros.length === 0) {
    container.innerHTML = `<div class="placeholder"><div class="placeholder-icon">🏗️</div>
      <h2>Faltan centros de costo</h2>
      <p class="lead">Carga los centros de costo (seed_real.sql o el panel de administración) antes de crear solicitudes.</p></div>`;
    return;
  }

  const tiposVisibles = TIPOS_SOLICITUD_POR_ROL[state.user.role] || ['ingreso', 'traslado'];
  const segmentos = tiposVisibles.map((t, i) => {
    const m = TIPO_SOLICITUD_META[t];
    return `<button type="button" class="segment-btn ${i === 0 ? 'active' : ''}" data-tipo="${t}">
      <span class="segment-icon">${m.icon}</span><span>${m.label}</span>
      <span class="segment-desc">${m.desc}</span>
    </button>`;
  }).join('');

  container.innerHTML = `
    <div class="view-form">
      <div class="form-card">
        <div class="form-section">
          <label class="form-label">Tipo de solicitud</label>
          <div class="segment-control" id="tipo-control">${segmentos}</div>
        </div>
        <form id="sol-form" autocomplete="off">
          <div id="form-body"></div>
          <div id="sol-error" class="form-error" hidden></div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="sol-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="sol-submit">Crear solicitud</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let tipo = tiposVisibles[0];
  renderBody(tipo);

  container.querySelectorAll('#tipo-control .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#tipo-control .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tipo = btn.dataset.tipo;
      renderBody(tipo);
    });
  });

  container.querySelector('#sol-cancel').addEventListener('click', () => window.Router.go('inicio'));
  container.querySelector('#sol-form').addEventListener('submit', (e) => onSubmit(e, () => tipo));
}

function renderBody(tipo) {
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
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Crear solicitud'; }

  body.innerHTML = (builders[tipo] || bodyIngreso)();
  if (tipo === 'traslado') wireTraslado();
  if (tipo === 'aumento_sueldo') wireAumentoSueldo();
  if (tipo === 'cambio_cargo') wireCambioCargo();
  if (tipo === 'renovacion') wireRenovacion();
}

/* ---------------- INGRESO ---------------- */
function bodyIngreso() {
  const miCentro = state.user.centroCostoId || '';
  return `
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Cargo <span class="req">*</span></label>
        <select name="cargo" required>${optsCargos('')}</select></div>
      <div class="form-field"><label class="form-label">Cantidad <span class="req">*</span></label>
        <input type="number" name="cantidad" required min="1" value="1"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Centro de Costo (obra) <span class="req">*</span></label>
        <select name="centro_costo" required>${optsCentros(miCentro)}</select></div>
      <div class="form-field"><label class="form-label">Cliente</label>
        <input type="text" name="cliente" placeholder="Ej: SACYR"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Tipo de contrato</label>
        <select name="tipo_contrato">${optsContrato()}</select></div>
      <div class="form-field"><label class="form-label">Plazo</label>
        <input type="text" name="plazo" placeholder="Ej: 3 meses"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Turno</label>
        <select name="turno">${optsTurno()}</select></div>
      <div class="form-field"><label class="form-label">Sueldo líquido pactado</label>
        <input type="number" name="sueldo_liquido" min="0" placeholder="Ej: 800000"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Horario</label>
        <input type="text" name="horario" placeholder="Ej: Lunes a Sábado 08:00 a 18:00"></div>
      <div class="form-field"><label class="form-label">Fecha de ingreso a obra</label>
        <input type="date" name="fecha_ingreso"></div>
    </div></div>
    <div class="form-section"><div class="form-field"><label class="form-label">Motivo / observaciones</label>
      <textarea name="motivo" placeholder="Opcional"></textarea></div></div>
  `;
}

/* ---------------- TRASLADO ---------------- */
function bodyTraslado() {
  return `
    ${selectTrabajador('trab-select')}
    <div id="trab-alerta-contrato" class="form-error" hidden></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Cargo</label>
        <select name="cargo" id="trab-cargo">${optsCargos('')}</select></div>
      <div class="form-field"><label class="form-label">Fecha de traslado</label>
        <input type="date" name="fecha_traslado"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Obra origen <span class="req">*</span></label>
        <select name="centro_origen" id="trab-origen" required>${optsCentros('')}</select></div>
      <div class="form-field"><label class="form-label">Obra destino <span class="req">*</span></label>
        <select name="centro_destino" required>
          <option value="">— Seleccionar destino —</option>${optsCentros('')}</select></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Sueldo líquido actual (pactado)</label>
        <input type="number" name="sueldo_liquido_actual" id="trab-sueldo" min="0"></div>
      <div class="form-field"><label class="form-label">Nuevo sueldo líquido</label>
        <input type="number" name="nuevo_sueldo_liquido" min="0"></div>
    </div></div>
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Turno</label>
        <select name="turno">${optsTurno()}</select></div>
      <div class="form-field"><label class="form-label">Horario</label>
        <input type="text" name="horario" placeholder="Ej: Lunes a Sábado..."></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Modificaciones contractuales</label>
      <textarea name="modificaciones" placeholder="Detalle de cambios en el contrato (opcional)"></textarea>
    </div></div>

    <div class="form-section">
      <label class="form-label">Bonos (marcar solo los que aplican)</label>
      <label class="bono-toggle"><input type="checkbox" id="chk-nocturno"> Aplica Bono Nocturno</label>
      <div class="bono-fields" id="fields-nocturno" hidden>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Porcentaje B. Nocturno</label>
            <input type="number" name="bn_porcentaje" step="0.01" min="0" placeholder="Ej: 0.30"></div>
          <div class="form-field"><label class="form-label">Período de asignación</label>
            <input type="text" name="bn_periodo" placeholder="Ej: mensual / 3 meses"></div>
        </div>
      </div>
      <label class="bono-toggle"><input type="checkbox" id="chk-trato"> Aplica Bono Trato</label>
      <div class="bono-fields" id="fields-trato" hidden>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Monto Bono Trato</label>
            <input type="number" name="bt_monto" min="0"></div>
          <div class="form-field"><label class="form-label">Días de asignación</label>
            <input type="number" name="bt_dias" min="0"></div>
        </div>
      </div>
    </div>
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
  const toggle = (chkId, fieldsId) => {
    const chk = document.getElementById(chkId);
    chk.addEventListener('change', () => { document.getElementById(fieldsId).hidden = !chk.checked; });
  };
  toggle('chk-nocturno', 'fields-nocturno');
  toggle('chk-trato', 'fields-trato');
}

/* ---------------- AUMENTO DE SUELDO ---------------- */
function bodyAumentoSueldo() {
  return `
    ${selectTrabajador('cam-trab')}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Sueldo líquido actual</label>
        <input type="number" id="cam-sueldo-actual" disabled placeholder="Se completa al elegir el trabajador"></div>
      <div class="form-field"><label class="form-label">Nuevo sueldo líquido <span class="req">*</span></label>
        <input type="number" name="sueldo_nuevo" required min="0"></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Fecha efectiva</label>
      <input type="date" name="fecha_efectiva"></div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional"></textarea></div></div>
  `;
}
function wireAumentoSueldo() {
  document.getElementById('cam-trab').addEventListener('change', (e) => {
    const t = trabajadores.find(x => x.id === e.target.value);
    document.getElementById('cam-sueldo-actual').value = t?.sueldo_liquido ?? '';
  });
}

/* ---------------- BONO ---------------- */
function bodyBono() {
  return `
    ${selectTrabajador('bono-trab')}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Tipo de bono <span class="req">*</span></label>
        <select name="tipo_bono" required>${optsBono()}</select></div>
      <div class="form-field"><label class="form-label">Monto <span class="req">*</span></label>
        <input type="number" name="monto" required min="0"></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Período / fecha</label>
      <input type="text" name="periodo" placeholder="Ej: octubre 2026 / pago único"></div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional"></textarea></div></div>
  `;
}

/* ---------------- CAMBIO DE CARGO ---------------- */
function bodyCambioCargo() {
  return `
    ${selectTrabajador('cc-trab')}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Cargo actual</label>
        <input type="text" id="cc-cargo-actual" disabled placeholder="Se completa al elegir el trabajador"></div>
      <div class="form-field"><label class="form-label">Cargo nuevo <span class="req">*</span></label>
        <select name="cargo_nuevo" required>${optsCargos('')}</select></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Fecha efectiva</label>
      <input type="date" name="fecha_efectiva"></div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional"></textarea></div></div>
  `;
}
function wireCambioCargo() {
  document.getElementById('cc-trab').addEventListener('change', (e) => {
    const t = trabajadores.find(x => x.id === e.target.value);
    document.getElementById('cc-cargo-actual').value = t?.cargo ?? '';
  });
}

/* ---------------- RENOVACIÓN ---------------- */
function bodyRenovacion() {
  return `
    ${selectTrabajador('ren-trab')}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Tipo de contrato actual</label>
        <select id="ren-contrato-actual" disabled>${optsContrato()}</select></div>
      <div class="form-field"><label class="form-label">Fecha de término actual</label>
        <input type="date" name="fecha_termino_actual"></div>
    </div></div>
    <div class="form-section">
      <label class="bono-toggle"><input type="checkbox" id="ren-indefinido"> El contrato pasa a <strong>indefinido</strong> (sin fecha de término, se puede seguir renovando sin límite)</label>
    </div>
    <div class="form-section" id="ren-fechas-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Nueva fecha de término</label>
        <input type="date" name="nueva_fecha_termino"></div>
      <div class="form-field"><label class="form-label">Nuevo plazo (si no hay fecha exacta)</label>
        <input type="text" name="nuevo_plazo" placeholder="Ej: 3 meses más"></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Motivo</label>
      <textarea name="motivo" placeholder="Opcional"></textarea></div></div>
  `;
}
function wireRenovacion() {
  document.getElementById('ren-trab').addEventListener('change', () => {
    // El maestro de trabajadores hoy no guarda tipo de contrato; queda como referencia editable.
  });
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

/* ---------------- DESVINCULACIÓN ---------------- */
function bodyDesvinculacion() {
  return `
    ${selectTrabajador('des-trab')}
    <div class="form-section"><div class="form-grid-2">
      <div class="form-field"><label class="form-label">Causal <span class="req">*</span></label>
        <select name="causal" required>${optsCausales()}</select></div>
      <div class="form-field"><label class="form-label">Fecha de desvinculación <span class="req">*</span></label>
        <input type="date" name="fecha_desvinculacion" required></div>
    </div></div>
    <div class="form-section"><div class="form-field">
      <label class="form-label">Observaciones</label>
      <textarea name="observaciones" placeholder="Detalle adicional (opcional)"></textarea></div></div>
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
