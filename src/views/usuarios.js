/**
 * Vista "Usuarios" (admin) · listar usuarios y gestionar su autorización:
 * rol, centro de costo, marca de Gerente de Operaciones / Gerente de
 * Prevención y activo/inactivo. El alta de la identidad (Auth) se hace
 * invitando desde Supabase; acá se gestiona solo el perfil/permisos.
 *
 * Gerente de Prevención (migración 0016) recibe copia por correo de todo
 * rechazo de homologación SST, sea cual sea el centro de costo -- a
 * diferencia de Gerente de Operaciones, no es aprobador de nada, así que
 * no participa del flujo de "Nueva solicitud".
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { ROLE_LABELS } from '../config.js';
import { escapeHtml } from '../ui/utils.js';

const ROLES = ['solicitante', 'supervisor', 'aprobador', 'rrhh', 'prevencionista', 'admin'];

export async function renderUsuarios(container) {
  container.innerHTML = '<div class="view-loading">Cargando usuarios...</div>';

  let usuarios, centros;
  try {
    [usuarios, centros] = await Promise.all([Data.listUsuarios(), Data.centros()]);
  } catch (e) {
    console.error('[usuarios]', e);
    Toast.error('Error', 'No se pudieron cargar los usuarios.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar los usuarios.</div>';
    return;
  }

  const optsCentros = (sel) =>
    `<option value="">— Sin centro —</option>` +
    centros.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.codigo} · ${escapeHtml(c.nombre)}</option>`).join('');
  const optsRol = (sel) =>
    ROLES.map(r => `<option value="${r}" ${r === sel ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('');

  const rows = usuarios.map(u => `
    <tr data-id="${u.id}" class="${u.activo ? '' : 'row-inactivo'}">
      <td>
        <div class="u-nombre">${escapeHtml(u.nombre || '—')}</div>
        <div class="u-email muted">${escapeHtml(u.email || '')}</div>
      </td>
      <td><select class="u-input" data-field="rol">${optsRol(u.rol)}</select></td>
      <td><select class="u-input" data-field="centro_costo_id">${optsCentros(u.centro_costo_id)}</select></td>
      <td class="u-center"><input type="checkbox" class="u-input" data-field="es_gerente_operaciones" ${u.es_gerente_operaciones ? 'checked' : ''}></td>
      <td class="u-center"><input type="checkbox" class="u-input" data-field="es_gerente_prevencion" ${u.es_gerente_prevencion ? 'checked' : ''}></td>
      <td class="u-center"><input type="checkbox" class="u-input" data-field="activo" ${u.activo ? 'checked' : ''}></td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="form-card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 12px;">Invitar usuario</h3>
      <div class="form-grid-2">
        <div class="form-field"><label class="form-label">Correo <span class="req">*</span></label>
          <input type="email" id="inv-email" placeholder="persona@metalium.cl"></div>
        <div class="form-field"><label class="form-label">Nombre</label>
          <input type="text" id="inv-nombre" placeholder="Nombre y apellido"></div>
      </div>
      <div class="form-grid-2">
        <div class="form-field"><label class="form-label">Rol</label>
          <select id="inv-rol">${optsRol('solicitante')}</select></div>
        <div class="form-field"><label class="form-label">Centro de costo</label>
          <select id="inv-centro">${optsCentros('')}</select></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" id="inv-enviar">Enviar invitación</button></div>
      <p class="hint">Se envía un correo Metalium para que la persona defina su propia contraseña. El rol y centro quedan pre-asignados.</p>
    </div>

    <div class="sol-toolbar">
      <span class="muted">${usuarios.length} usuario(s)</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Centro de costo</th><th>Gerente Op.</th><th>Gerente Prev.</th><th>Activo</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Invitar
  container.querySelector('#inv-enviar').addEventListener('click', async () => {
    const btn = container.querySelector('#inv-enviar');
    const email = container.querySelector('#inv-email').value.trim();
    const nombre = container.querySelector('#inv-nombre').value.trim();
    const rol = container.querySelector('#inv-rol').value;
    const centro_costo_id = container.querySelector('#inv-centro').value || null;
    if (!email) { Toast.warning('Falta el correo', 'Ingresa el correo de la persona.'); return; }

    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      await Data.invitarUsuario({ email, nombre, rol, centro_costo_id });
      Toast.success('Invitación enviada', `Se envió un correo a ${email}.`);
      renderUsuarios(container);
    } catch (e) {
      console.error('[usuarios] invitar', e);
      Toast.error('No se pudo invitar', e.message || 'Error al enviar la invitación.');
      btn.disabled = false; btn.textContent = 'Enviar invitación';
    }
  });

  container.querySelectorAll('.u-input').forEach(el => {
    el.addEventListener('change', async () => {
      const tr = el.closest('tr');
      const id = tr.dataset.id;
      const field = el.dataset.field;
      let value;
      if (el.type === 'checkbox') value = el.checked;
      else value = el.value === '' ? null : el.value;

      try {
        await Data.actualizarUsuario(id, { [field]: value });
        if (field === 'activo') tr.classList.toggle('row-inactivo', !value);
        Toast.success('Guardado', '');
      } catch (e) {
        console.error('[usuarios] update', e);
        Toast.error('Error', 'No se pudo guardar el cambio.');
        renderUsuarios(container); // revertir visualmente recargando
      }
    });
  });
}
