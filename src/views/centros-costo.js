/**
 * Vista "Centros de costo" (admin) · listar/crear/editar obras y asignar
 * el administrador de obra de cada una (que es el aprobador del centro).
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';

export async function renderCentrosCosto(container) {
  container.innerHTML = '<div class="view-loading">Cargando centros...</div>';

  let centros, usuarios;
  try {
    [centros, usuarios] = await Promise.all([Data.listCentrosAdmin(), Data.listUsuarios()]);
  } catch (e) {
    console.error('[centros]', e);
    Toast.error('Error', 'No se pudieron cargar los centros de costo.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar los centros.</div>';
    return;
  }

  const optsAdmin = (sel) =>
    `<option value="">— Sin asignar —</option>` +
    usuarios.filter(u => u.activo).map(u =>
      `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${escapeHtml(u.nombre || u.email)}</option>`).join('');

  // El prevencionista responsable de homologar cambia según el centro de
  // costo: se asigna acá, igual que el administrador de obra. Se listan
  // los usuarios con rol prevencionista; si todavía no se creó ninguno,
  // se muestran todos los usuarios activos como respaldo.
  const prevencionistas = usuarios.filter(u => u.activo && u.rol === 'prevencionista');
  const optsPrevencionista = (sel) =>
    `<option value="">— Sin asignar —</option>` +
    (prevencionistas.length ? prevencionistas : usuarios.filter(u => u.activo)).map(u =>
      `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${escapeHtml(u.nombre || u.email)}</option>`).join('');

  const rows = centros.map(c => `
    <tr data-id="${c.id}" class="${c.activo ? '' : 'row-inactivo'}">
      <td class="mono">${escapeHtml(c.codigo)}</td>
      <td><input type="text" class="c-input" data-field="nombre" value="${escapeHtml(c.nombre)}"></td>
      <td><select class="c-input" data-field="admin_obra_id">${optsAdmin(c.admin_obra_id)}</select></td>
      <td><select class="c-input" data-field="prevencionista_id">${optsPrevencionista(c.prevencionista_id)}</select></td>
      <td class="u-center"><input type="checkbox" class="c-input" data-field="activo" ${c.activo ? 'checked' : ''}></td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="form-card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 12px;">Nuevo centro de costo</h3>
      <div class="form-grid-3">
        <div class="form-field"><label class="form-label">Código <span class="req">*</span></label>
          <input type="text" id="nc-codigo" placeholder="Ej: 30"></div>
        <div class="form-field"><label class="form-label">Nombre <span class="req">*</span></label>
          <input type="text" id="nc-nombre" placeholder="Ej: OBRA NUEVA"></div>
        <div class="form-field"><label class="form-label">Administrador de obra</label>
          <select id="nc-admin">${optsAdmin('')}</select></div>
      </div>
      <div class="form-grid-3" style="margin-top:10px;">
        <div class="form-field"><label class="form-label">Prevencionista (homologación)</label>
          <select id="nc-prevencionista">${optsPrevencionista('')}</select></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" id="nc-crear">Crear centro</button></div>
    </div>

    <div class="sol-toolbar"><span class="muted">${centros.length} centro(s)</span></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Código</th><th>Nombre</th><th>Administrador de obra</th><th>Prevencionista (homologación)</th><th>Activo</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Crear
  container.querySelector('#nc-crear').addEventListener('click', async () => {
    const codigo = container.querySelector('#nc-codigo').value.trim();
    const nombre = container.querySelector('#nc-nombre').value.trim();
    const admin_obra_id = container.querySelector('#nc-admin').value || null;
    const prevencionista_id = container.querySelector('#nc-prevencionista').value || null;
    if (!codigo || !nombre) { Toast.warning('Faltan datos', 'Código y nombre son obligatorios.'); return; }
    try {
      await Data.crearCentro({ codigo, nombre, admin_obra_id, prevencionista_id });
      Toast.success('Centro creado', '');
      renderCentrosCosto(container);
    } catch (e) {
      console.error('[centros] crear', e);
      Toast.error('Error', e.message?.includes('duplicate') ? 'Ya existe un centro con ese código.' : 'No se pudo crear el centro.');
    }
  });

  // Editar inline (auto-guardar)
  container.querySelectorAll('.c-input').forEach(el => {
    const ev = el.type === 'text' ? 'blur' : 'change';
    el.addEventListener(ev, async () => {
      const tr = el.closest('tr');
      const id = tr.dataset.id;
      const field = el.dataset.field;
      let value;
      if (el.type === 'checkbox') value = el.checked;
      else value = el.value.trim() === '' ? (['admin_obra_id', 'prevencionista_id'].includes(field) ? null : el.value) : el.value;
      if (['admin_obra_id', 'prevencionista_id'].includes(field) && el.value === '') value = null;

      try {
        await Data.actualizarCentro(id, { [field]: value });
        if (field === 'activo') tr.classList.toggle('row-inactivo', !value);
        Toast.success('Guardado', '');
      } catch (e) {
        console.error('[centros] update', e);
        Toast.error('Error', 'No se pudo guardar.');
      }
    });
  });
}
