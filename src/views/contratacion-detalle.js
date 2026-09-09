/**
 * Detalle de una contratación (RRHH / admin) · datos del candidato (editables
 * mientras no esté contratada), checklist de documentos según tipo de
 * trabajador con subida a Storage, y cierre del proceso ("Marcar contratado"),
 * que crea/actualiza el trabajador en el maestro y lo vincula a la contratación.
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast, Confirm } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { fechaCorta } from '../ui/solicitud-format.js';
import {
  estadoContratacionBadge, canalLabel, tipoTrabajadorLabel, checklistParaTipo, progresoDocumentos
} from '../ui/contratacion-format.js';

const CANALES = [['recomendacion', 'Recomendación'], ['reclutamiento_seleccion', 'Reclutamiento y selección']];
const TIPOS = [['administrativo', 'Administrativo'], ['operativo', 'Operativo']];

export async function renderContratacionDetalle(container, contratacionId, backView) {
  container.innerHTML = '<div class="view-loading">Cargando contratación...</div>';

  let c, sol, checklist, documentos, centros;
  try {
    c = await Data.contratacionPorId(contratacionId);
    [sol, checklist, documentos, centros] = await Promise.all([
      Data.solicitudPorId(c.solicitud_id),
      Data.checklistDocumentos(),
      Data.documentosDeContratacion(contratacionId),
      Data.listCentrosAdmin()
    ]);
  } catch (e) {
    console.error('[contratacion-detalle]', e);
    Toast.error('Error', 'No se pudo cargar la contratación.');
    container.innerHTML = `<button class="link-btn" id="volver">← Volver</button><div class="empty-state">No se pudo cargar la contratación.</div>`;
    container.querySelector('#volver').addEventListener('click', () => window.Router.go(backView));
    return;
  }

  const centrosMap = new Map(centros.map(c2 => [c2.id, c2]));
  const cerrada = c.estado === 'contratado' || c.estado === 'anulada';
  const prog = progresoDocumentos(checklist, documentos, c.tipo_trabajador);
  const docPorItem = new Map(documentos.map(d => [d.checklist_item_id, d]));

  const dl = (pares) => `<div class="dl">${pares.filter(([, v]) => v != null && v !== '').map(([k, v]) =>
    `<div class="dl-row"><span class="dl-k">${escapeHtml(k)}</span><span class="dl-v">${escapeHtml(String(v))}</span></div>`).join('')}</div>`;

  const datosSolicitud = [
    ['Código', sol.codigo],
    ['Cargo', sol.detalle?.cargo],
    ['Centro de costo', centrosMap.get(sol.centro_origen_id)?.nombre],
    ['Cliente', sol.detalle?.cliente],
    ['Fecha de ingreso a obra', sol.detalle?.fecha_ingreso]
  ];

  const editable = !cerrada;
  const campo = (label, field, value, type = 'text') => `
    <div class="form-field"><label class="form-label">${label}</label>
      <input type="${type}" class="k-input" data-field="${field}" value="${escapeHtml(value ?? '')}" ${editable ? '' : 'disabled'}></div>`;
  const selectField = (label, field, opts, value) => `
    <div class="form-field"><label class="form-label">${label}</label>
      <select class="k-input" data-field="${field}" ${editable ? '' : 'disabled'}>
        ${opts.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('')}
      </select></div>`;

  const checklistHtml = prog.items.map(item => {
    const doc = docPorItem.get(item.id);
    const subido = !!doc;
    return `
      <div class="chk-row ${subido ? 'chk-ok' : ''}">
        <div class="chk-info">
          <div class="chk-nombre">${subido ? '✅' : (item.obligatorio ? '⬜' : '◽')} ${escapeHtml(item.nombre)}
            ${item.obligatorio ? '<span class="badge badge-neutral">Obligatorio</span>' : '<span class="badge badge-neutral">Opcional</span>'}
            ${item.requerido_homologacion ? '<span class="badge badge-info" title="Visible para el prevencionista (homologación)">SST</span>' : ''}
          </div>
          ${subido ? `<div class="muted">
              <button class="link-btn" data-doc="${doc.storage_path}">${escapeHtml(doc.nombre_archivo)}</button>
              · subido ${fechaCorta(doc.created_at)}
            </div>` : '<div class="muted">Sin subir.</div>'}
        </div>
        ${editable ? `<label class="btn btn-secondary" style="cursor:pointer;">${subido ? 'Reemplazar' : 'Subir'}
            <input type="file" data-item="${item.id}" hidden accept=".pdf,.png,.jpg,.jpeg,.docx,.doc"></label>` : ''}
      </div>`;
  }).join('');

  container.innerHTML = `
    <button class="link-btn" id="volver">← Volver</button>
    <div class="detalle-head">
      <span class="sol-id">${escapeHtml(c.nombre_candidato)}</span>
      ${estadoContratacionBadge(c.estado)}
    </div>

    <div class="detalle-grid">
      <div class="card">
        <h3>Datos de la contratación</h3>
        <div class="form-grid-2">
          ${campo('Nombre completo', 'nombre_candidato', c.nombre_candidato)}
          ${campo('RUT', 'rut_candidato', c.rut_candidato)}
        </div>
        <div class="form-grid-2">
          ${campo('Teléfono', 'telefono_candidato', c.telefono_candidato)}
          ${campo('Correo', 'email_candidato', c.email_candidato, 'email')}
        </div>
        <div class="form-grid-2">
          ${selectField('Canal', 'canal', CANALES, c.canal)}
          ${selectField('Tipo de trabajador', 'tipo_trabajador', TIPOS, c.tipo_trabajador)}
        </div>
        ${editable ? `<div class="form-actions"><button class="btn btn-primary" id="guardar-datos">Guardar cambios</button></div>` : ''}
      </div>
      <div class="card"><h3>Solicitud de origen</h3>${dl(datosSolicitud)}</div>
    </div>

    <div class="card">
      <h3>Checklist de documentos · ${tipoTrabajadorLabel(c.tipo_trabajador)}</h3>
      <div class="bar-row" style="grid-template-columns:140px 1fr 60px;margin-bottom:10px;">
        <span class="bar-label">Obligatorios</span>
        <div class="bar-track"><div class="bar-fill" style="width:${prog.obligTotal ? (100 * prog.obligCompletos / prog.obligTotal) : 0}%"></div></div>
        <span class="bar-val">${prog.obligCompletos}/${prog.obligTotal}</span>
      </div>
      <div class="checklist-list">${checklistHtml || '<span class="muted">Sin ítems para este tipo de trabajador.</span>'}</div>
    </div>

    ${!cerrada ? `<div class="card">
      <h3>Cerrar proceso</h3>
      <p class="hint">Al marcar como contratado se crea (o actualiza, por RUT) el trabajador en el maestro y queda vinculado a esta contratación.</p>
      <div class="sol-acciones">
        <button class="btn btn-danger" id="anular">Anular contratación</button>
        <button class="btn btn-primary" id="marcar-contratado">Marcar como contratado</button>
      </div>
    </div>` : ''}
  `;

  container.querySelector('#volver').addEventListener('click', () => window.Router.go(backView));

  container.querySelectorAll('[data-doc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const url = await Data.urlDocumentoContratacion(btn.dataset.doc);
        window.open(url, '_blank');
      } catch (e) {
        console.error('[contratacion-detalle] url', e);
        Toast.error('Error', 'No se pudo abrir el documento.');
      }
    });
  });

  container.querySelectorAll('input[type="file"][data-item]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const file = inp.files?.[0];
      if (!file) return;
      // Si este ítem es el Contrato de Trabajo y todavía no estaba subido,
      // esta subida es justo el evento que cierra el plazo de RRHH (arranca
      // el de homologación) -- se detecta ANTES de subir, para no confundir
      // "primera vez" con un simple reemplazo del mismo documento.
      const item = checklist.find(c => c.id === inp.dataset.item);
      const esPrimerContrato = item?.codigo === 'contrato_trabajo' && !docPorItem.has(inp.dataset.item);
      try {
        await Data.subirDocumentoContratacion(contratacionId, inp.dataset.item, file, state.user.id);
        Toast.success('Documento subido', file.name);
        if (esPrimerContrato) Data.notificarEvento('rrhh_cerrado', { contratacion_id: contratacionId }); // fire-and-forget
        renderContratacionDetalle(container, contratacionId, backView);
      } catch (e) {
        console.error('[contratacion-detalle] subir', e);
        Toast.error('Error', e.message || 'No se pudo subir el documento.');
      }
    });
  });

  const guardarBtn = container.querySelector('#guardar-datos');
  if (guardarBtn) {
    guardarBtn.addEventListener('click', async () => {
      const patch = {};
      container.querySelectorAll('.k-input').forEach(el => { patch[el.dataset.field] = el.value.trim() || null; });
      if (!patch.nombre_candidato) { Toast.warning('Falta el nombre', ''); return; }
      guardarBtn.disabled = true; guardarBtn.textContent = 'Guardando...';
      try {
        await Data.actualizarContratacion(contratacionId, patch);
        Toast.success('Guardado', '');
        renderContratacionDetalle(container, contratacionId, backView);
      } catch (e) {
        console.error('[contratacion-detalle] guardar', e);
        Toast.error('Error', e.message || 'No se pudo guardar.');
        guardarBtn.disabled = false; guardarBtn.textContent = 'Guardar cambios';
      }
    });
  }

  const anularBtn = container.querySelector('#anular');
  if (anularBtn) {
    anularBtn.addEventListener('click', async () => {
      const ok = await Confirm.ask({
        title: '¿Anular esta contratación?', variant: 'danger',
        text: 'Esta contratación quedará marcada como anulada.', confirmText: 'Anular'
      });
      if (!ok) return;
      try {
        await Data.anularContratacion(contratacionId);
        Toast.success('Contratación anulada', '');
        renderContratacionDetalle(container, contratacionId, backView);
      } catch (e) {
        console.error('[contratacion-detalle] anular', e);
        Toast.error('Error', e.message || 'No se pudo anular.');
      }
    });
  }

  const marcarBtn = container.querySelector('#marcar-contratado');
  if (marcarBtn) {
    marcarBtn.addEventListener('click', async () => {
      if (!prog.completo) {
        const seguir = await Confirm.ask({
          title: 'Faltan documentos obligatorios',
          text: `Van ${prog.obligCompletos}/${prog.obligTotal} documentos obligatorios. ¿Marcar como contratado igual?`,
          variant: 'danger', confirmText: 'Marcar igual'
        });
        if (!seguir) return;
      } else {
        const ok = await Confirm.ask({
          title: '¿Marcar como contratado?',
          text: 'Se creará o actualizará el trabajador en el maestro (por RUT) y quedará vinculado.',
          variant: 'success', confirmText: 'Confirmar'
        });
        if (!ok) return;
      }
      if (!c.rut_candidato) {
        Toast.warning('Falta el RUT', 'Ingresa el RUT del candidato antes de marcarlo como contratado.');
        return;
      }
      marcarBtn.disabled = true; marcarBtn.textContent = 'Guardando...';
      try {
        await Data.marcarContratado(contratacionId, {
          rut: c.rut_candidato,
          nombre: c.nombre_candidato,
          cargo: sol.detalle?.cargo || null,
          centro_costo_id: sol.centro_origen_id,
          sueldo_liquido: sol.detalle?.sueldo_liquido ?? null,
          // Copia el tipo de contrato elegido en la solicitud de ingreso al
          // maestro del trabajador (migración 0013) -- si queda en "Obra o
          // Faena", el trigger de la BD prende requiere_anexo_renovacion solo.
          tipo_contrato: sol.detalle?.tipo_contrato || null
        });
        Toast.success('Trabajador contratado', c.nombre_candidato);
        renderContratacionDetalle(container, contratacionId, backView);
      } catch (e) {
        console.error('[contratacion-detalle] marcar contratado', e);
        Toast.error('Error', e.message || 'No se pudo cerrar la contratación.');
        marcarBtn.disabled = false; marcarBtn.textContent = 'Marcar como contratado';
      }
    });
  }
}
