/**
 * Vista "Cargos" (admin) · administrar la lista de cargos que aparece en los
 * formularios de solicitud (crear, renombrar, activar/desactivar).
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';

export async function renderCargos(container) {
  container.innerHTML = '<div class="view-loading">Cargando cargos...</div>';

  let cargos;
  try {
    cargos = await Data.listCargosAdmin();
  } catch (e) {
    console.error('[cargos]', e);
    Toast.error('Error', 'No se pudieron cargar los cargos.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar los cargos.</div>';
    return;
  }

  const rows = cargos.map(c => `
    <tr data-id="${c.id}" class="${c.activo ? '' : 'row-inactivo'}">
      <td><input type="text" class="c-input" data-field="nombre" value="${escapeHtml(c.nombre)}"></td>
      <td class="u-center"><input type="checkbox" class="c-input" data-field="activo" ${c.activo ? 'checked' : ''}></td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="form-card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 12px;">Nuevo cargo</h3>
      <div class="form-grid-2">
        <div class="form-field"><label class="form-label">Nombre del cargo <span class="req">*</span></label>
          <input type="text" id="nc-nombre" placeholder="Ej: Maestro Albañil"></div>
        <div class="form-field" style="display:flex;align-items:flex-end;">
          <button class="btn btn-primary" id="nc-crear">Agregar cargo</button></div>
      </div>
      <p class="hint">Los cargos activos son los que aparecen en el desplegable de las solicitudes. Desactiva uno (en vez de borrarlo) para sacarlo de la lista sin perder el historial.</p>
    </div>

    <div class="sol-toolbar"><span class="muted">${cargos.length} cargo(s)</span></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Activo</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  container.querySelector('#nc-crear').addEventListener('click', async () => {
    const nombre = container.querySelector('#nc-nombre').value.trim();
    if (!nombre) { Toast.warning('Falta el nombre', 'Escribe el nombre del cargo.'); return; }
    try {
      await Data.crearCargo(nombre);
      Toast.success('Cargo agregado', '');
      renderCargos(container);
    } catch (e) {
      console.error('[cargos] crear', e);
      Toast.error('Error', e.message?.includes('duplicate') ? 'Ya existe un cargo con ese nombre.' : 'No se pudo agregar el cargo.');
    }
  });

  container.querySelectorAll('.c-input').forEach(el => {
    const ev = el.type === 'text' ? 'blur' : 'change';
    el.addEventListener(ev, async () => {
      const tr = el.closest('tr');
      const id = tr.dataset.id;
      const field = el.dataset.field;
      const value = el.type === 'checkbox' ? el.checked : el.value.trim();
      if (field === 'nombre' && !value) { Toast.warning('Nombre vacío', 'El cargo no puede quedar sin nombre.'); return; }
      try {
        await Data.actualizarCargo(id, { [field]: value });
        if (field === 'activo') tr.classList.toggle('row-inactivo', !value);
        Toast.success('Guardado', '');
      } catch (e) {
        console.error('[cargos] update', e);
        Toast.error('Error', e.message?.includes('duplicate') ? 'Ya existe un cargo con ese nombre.' : 'No se pudo guardar.');
      }
    });
  });
}
