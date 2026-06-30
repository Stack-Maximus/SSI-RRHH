/**
 * Vista "Nueva solicitud" · formularios reales de Ingreso y Traslado,
 * según el Excel de RRHH. Llama a crear_solicitud(); los campos propios
 * de cada tipo se guardan en `detalle` (JSONB).
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';

let centros = [];
let trabajadores = [];
let cargos = [];

const TIPOS_CONTRATO = ['Plazo Fijo', 'Obra o Faena', 'Indefinido'];
const TURNOS = ['Diurno', 'Nocturno'];

const num = (v) => (v === '' || v == null ? null : Number(v));
const txt = (v) => (v && String(v).trim() ? String(v).trim() : null);

function optsCentros(sel) {
  return centros.map(c =>
    `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.codigo} · ${c.nombre}</option>`
  ).join('');
}
function optsContrato() { return TIPOS_CONTRATO.map(t => `<option>${t}</option>`).join(''); }
function optsTurno()    { return TURNOS.map(t => `<option>${t}</option>`).join(''); }
function optsCargos(sel) {
  return '<option value="">— Seleccionar cargo —</option>' +
    cargos.map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
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

  container.innerHTML = `
    <div class="view-form">
      <div class="form-card">
        <div class="form-section">
          <label class="form-label">Tipo de solicitud</label>
          <div class="segment-control" id="tipo-control">
            <button type="button" class="segment-btn active" data-tipo="ingreso">
              <span class="segment-icon">➕</span><span>Ingreso</span>
              <span class="segment-desc">Pedir personal nuevo a la obra</span>
            </button>
            <button type="button" class="segment-btn" data-tipo="traslado">
              <span class="segment-icon">🔁</span><span>Traslado</span>
              <span class="segment-desc">Mover a un trabajador entre obras</span>
            </button>
          </div>
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

  let tipo = 'ingreso';
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
  body.innerHTML = tipo === 'ingreso' ? bodyIngreso() : bodyTraslado();
  if (tipo === 'traslado') wireTraslado();
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
  const optsTrab = trabajadores.map(t =>
    `<option value="${t.id}">${t.nombre}${t.cargo ? ' · ' + t.cargo : ''}</option>`
  ).join('');
  return `
    <div class="form-section"><div class="form-field">
      <label class="form-label">Trabajador <span class="req">*</span></label>
      <select name="trabajador_id" id="trab-select" required>
        <option value="">— Seleccionar trabajador —</option>${optsTrab}
      </select>
    </div></div>
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
  sel.addEventListener('change', () => {
    const t = trabajadores.find(x => x.id === sel.value);
    if (!t) return;
    const selCargo = document.getElementById('trab-cargo');
    const cargoTrab = t.cargo || '';
    if (cargoTrab && !cargos.includes(cargoTrab)) {
      selCargo.insertAdjacentHTML('beforeend', `<option>${cargoTrab}</option>`);
    }
    selCargo.value = cargoTrab;
    document.getElementById("trab-sueldo").value = t.sueldo_liquido ?? '';
    if (t.centro_costo_id) document.getElementById('trab-origen').value = t.centro_costo_id;
  });
  const toggle = (chkId, fieldsId) => {
    const chk = document.getElementById(chkId);
    chk.addEventListener('change', () => { document.getElementById(fieldsId).hidden = !chk.checked; });
  };
  toggle('chk-nocturno', 'fields-nocturno');
  toggle('chk-trato', 'fields-trato');
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
    payload = (tipo === 'ingreso') ? buildIngreso(f) : buildTraslado(f);
  } catch (msg) {
    errorEl.textContent = msg; errorEl.hidden = false; return;
  }

  btn.disabled = true; btn.textContent = 'Creando...';
  try {
    const sol = await Data.crearSolicitud(payload);
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
