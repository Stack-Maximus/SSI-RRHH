/**
 * Vista "Checklist de documentos" (admin) · catálogo de documentos del
 * proceso de Contratación. Define en qué checklist aparece cada documento
 * (administrativo / operativo), si es obligatorio y si el prevencionista
 * (SST) debe verlo para homologar.
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';

export async function renderChecklistDocumentos(container) {
  container.innerHTML = '<div class="view-loading">Cargando checklist...</div>';

  let items;
  try {
    items = await Data.listChecklistAdmin();
  } catch (e) {
    console.error('[checklist-documentos]', e);
    Toast.error('Error', 'No se pudo cargar el checklist.');
    container.innerHTML = '<div class="empty-state">No se pudo cargar el checklist.</div>';
    return;
  }

  const chk = (checked) => checked ? 'checked' : '';
  const rows = items.map(i => `
    <tr data-id="${i.id}" class="${i.activo ? '' : 'row-inactivo'}">
      <td><input type="text" class="k-input" data-field="nombre" value="${escapeHtml(i.nombre)}"></td>
      <td class="u-center"><input type="checkbox" class="k-input" data-field="aplica_administrativo" ${chk(i.aplica_administrativo)}></td>
      <td class="u-center"><input type="checkbox" class="k-input" data-field="aplica_operativo" ${chk(i.aplica_operativo)}></td>
      <td class="u-center"><input type="checkbox" class="k-input" data-field="obligatorio" ${chk(i.obligatorio)}></td>
      <td class="u-center"><input type="checkbox" class="k-input" data-field="requerido_homologacion" ${chk(i.requerido_homologacion)}></td>
      <td class="u-center"><input type="checkbox" class="k-input" data-field="activo" ${chk(i.activo)}></td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="form-card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 12px;">Nuevo documento</h3>
      <div class="form-grid-2">
        <div class="form-field"><label class="form-label">Código (único, sin espacios) <span class="req">*</span></label>
          <input type="text" id="nc-codigo" placeholder="ej: certificado_afp"></div>
        <div class="form-field"><label class="form-label">Nombre <span class="req">*</span></label>
          <input type="text" id="nc-nombre" placeholder="Ej: Certificado de afiliación AFP"></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" id="nc-crear">Agregar documento</button></div>
      <p class="hint">Marca en la tabla si aplica a administrativo, a operativo, si es obligatorio y si el
        prevencionista necesita verlo para homologar. Desactívalo (en vez de borrarlo) para sacarlo de los
        checklists nuevos sin perder el historial de los ya subidos.</p>
    </div>

    <div class="sol-toolbar"><span class="muted">${items.length} documento(s) en el catálogo</span></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Nombre</th><th>Administrativo</th><th>Operativo</th><th>Obligatorio</th><th>SST / Homologación</th><th>Activo</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  container.querySelector('#nc-crear').addEventListener('click', async () => {
    const codigo = container.querySelector('#nc-codigo').value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const nombre = container.querySelector('#nc-nombre').value.trim();
    if (!codigo || !nombre) { Toast.warning('Faltan datos', 'Completa código y nombre.'); return; }
    try {
      await Data.crearChecklistItem({ codigo, nombre, orden: (items.length + 1) * 10 });
      Toast.success('Documento agregado', '');
      renderChecklistDocumentos(container);
    } catch (e) {
      console.error('[checklist-documentos] crear', e);
      Toast.error('Error', e.message?.includes('duplicate') ? 'Ya existe un documento con ese código.' : 'No se pudo agregar.');
    }
  });

  container.querySelectorAll('.k-input').forEach(el => {
    const ev = el.type === 'text' ? 'blur' : 'change';
    el.addEventListener(ev, async () => {
      const tr = el.closest('tr');
      const id = tr.dataset.id;
      const field = el.dataset.field;
      const value = el.type === 'checkbox' ? el.checked : el.value.trim();
      if (field === 'nombre' && !value) { Toast.warning('Nombre vacío', 'El documento no puede quedar sin nombre.'); return; }
      try {
        await Data.actualizarChecklistItem(id, { [field]: value });
        if (field === 'activo') tr.classList.toggle('row-inactivo', !value);
        Toast.success('Guardado', '');
      } catch (e) {
        console.error('[checklist-documentos] update', e);
        Toast.error('Error', 'No se pudo guardar el cambio.');
      }
    });
  });
}
