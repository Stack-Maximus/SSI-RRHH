/**
 * Vista "Cargos" (admin) · administrar la lista de cargos que aparece en los
 * formularios de solicitud (crear, renombrar, activar/desactivar).
 *
 * "Importar planilla" (mismo patrón que Trabajadores, ver trabajadores.js):
 * lee un Excel con una columna "Cargo", limpia espacios/duplicados, compara
 * contra los cargos ya guardados y muestra una vista previa (altas /
 * reactivaciones / renombres / sin cambios / a desactivar) ANTES de aplicar
 * nada. Pensado para cargar de una vez un listado "aprobado" (ej. el
 * organigrama oficial): lo que ya existe pero no aparece en la planilla se
 * ofrece para desactivar (no se borra -- mismo criterio "activo" que el
 * resto del sistema), pero cada fila trae su propio checkbox por si algún
 * cargo hay que dejarlo igual aunque no venga en esa planilla puntual.
 */

import * as XLSX from 'xlsx';
import { Data } from '../db/data.js';
import { Toast, Confirm } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';

let cargos = [];

// normaliza encabezados: minúsculas, sin acentos, espacios simples (igual que trabajadores.js)
const normKey = (k) => String(k).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
function pick(rowNorm, ...alias) {
  for (const a of alias) if (rowNorm[a] !== undefined) return rowNorm[a];
  return undefined;
}
// Limpia un nombre de cargo: recorta, colapsa espacios repetidos y pareja los
// espacios alrededor de "/" (ej. "Modelador/Proyectista " -> "Modelador / Proyectista").
function limpiarNombre(v) {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ');
}
const normComparar = (v) => limpiarNombre(v).toLowerCase();

export async function renderCargos(container) {
  container.innerHTML = '<div class="view-loading">Cargando cargos...</div>';

  try {
    cargos = await Data.listCargosAdmin();
  } catch (e) {
    console.error('[cargos]', e);
    Toast.error('Error', 'No se pudieron cargar los cargos.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar los cargos.</div>';
    return;
  }

  pintar(container);
}

function pintar(container) {
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
        <div class="form-field" style="display:flex;align-items:flex-end;gap:10px;">
          <button class="btn btn-primary" id="nc-crear">Agregar cargo</button>
          <label class="btn btn-secondary" style="cursor:pointer;">
            Importar planilla
            <input type="file" id="cg-file-import" accept=".xlsx,.xls" hidden>
          </label>
        </div>
      </div>
      <p class="hint">Los cargos activos son los que aparecen en el desplegable de las solicitudes. Desactiva uno (en vez de borrarlo) para sacarlo de la lista sin perder el historial.</p>
      <p class="hint">"Importar planilla" lee una columna "Cargo" (ej. el organigrama en Excel), limpia espacios/duplicados y te muestra qué va a cambiar antes de aplicar nada.</p>
    </div>
    <div id="cg-import-zone"></div>

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

  container.querySelector('#cg-file-import').addEventListener('change', (e) => {
    if (e.target.files?.[0]) importarPlanilla(e.target.files[0], container);
  });
}

/** Lee la planilla, limpia los nombres y arma la vista previa (no aplica nada todavía). */
async function importarPlanilla(file, container) {
  const zone = container.querySelector('#cg-import-zone');
  zone.innerHTML = '<div class="view-loading">Leyendo planilla...</div>';

  let parsed;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    // Toma la primera hoja que tenga una columna reconocible como "Cargo"
    // (por si la planilla trae, como esta, una segunda hoja de "Notas").
    let filas = null;
    for (const nombreHoja of wb.SheetNames) {
      const json = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { defval: null });
      if (json.length && Object.keys(json[0]).some(k => ['cargo', 'nombre', 'puesto'].includes(normKey(k)))) {
        filas = json;
        break;
      }
    }
    if (!filas) throw new Error('No se encontró una columna "Cargo" en la planilla.');
    parsed = filas;
  } catch (e) {
    console.error('[cargos] parse', e);
    Toast.error('Archivo inválido', e.message || 'No se pudo leer la planilla.');
    zone.innerHTML = '';
    container.querySelector('#cg-file-import').value = '';
    return;
  }

  // ---- Limpiar + deduplicar (conserva la primera aparición de cada nombre) ----
  const vistos = new Set();
  const aprobados = []; // [{nombre}] ya limpios y sin duplicados
  let vacias = 0, duplicadas = 0;
  for (const raw of parsed) {
    const rn = {};
    for (const k in raw) rn[normKey(k)] = raw[k];
    const crudo = pick(rn, 'cargo', 'nombre', 'puesto');
    const nombre = limpiarNombre(crudo);
    if (!nombre) { vacias++; continue; }
    const clave = nombre.toLowerCase();
    if (vistos.has(clave)) { duplicadas++; continue; }
    vistos.add(clave);
    aprobados.push(nombre);
  }

  if (!aprobados.length) {
    Toast.error('Planilla vacía', 'No se encontró ningún cargo para importar.');
    zone.innerHTML = '';
    container.querySelector('#cg-file-import').value = '';
    return;
  }

  // ---- Comparar contra los cargos ya guardados ----
  const porNombreNorm = new Map(cargos.map(c => [normComparar(c.nombre), c]));
  const aprobadosSet = new Set(aprobados.map(n => n.toLowerCase()));

  const altas = [];        // nombre nuevo, no existe ni parecido -> crear
  const reactivar = [];    // existe pero estaba inactivo (mismo nombre exacto) -> activar
  const renombrar = [];    // existe con otra capitalización/espacios -> corregir nombre (+activar si hacía falta)
  const sinCambios = [];   // ya existe, activo, mismo nombre exacto
  for (const nombre of aprobados) {
    const prev = porNombreNorm.get(nombre.toLowerCase());
    if (!prev) { altas.push({ nombre }); continue; }
    if (prev.nombre !== nombre) { renombrar.push({ id: prev.id, de: prev.nombre, a: nombre, activarTambien: !prev.activo }); continue; }
    if (!prev.activo) { reactivar.push({ id: prev.id, nombre }); continue; }
    sinCambios.push({ nombre });
  }
  // A desactivar: cargos hoy activos cuyo nombre (normalizado) NO está en la planilla aprobada.
  const aDesactivar = cargos
    .filter(c => c.activo && !aprobadosSet.has(normComparar(c.nombre)))
    .map(c => ({ id: c.id, nombre: c.nombre }));

  renderPreview(zone, container, { altas, reactivar, renombrar, sinCambios, aDesactivar, vacias, duplicadas });
}

function renderPreview(zone, container, r) {
  const fila = (icono, texto, extra = '') => `<tr><td style="width:28px;">${icono}</td><td>${texto}</td><td>${extra}</td></tr>`;

  const filasAltas = r.altas.map(a => fila('🆕', escapeHtml(a.nombre)));
  const filasReactivar = r.reactivar.map(a => fila('♻️', escapeHtml(a.nombre), '<span class="badge badge-neutral">estaba inactivo</span>'));
  const filasRenombrar = r.renombrar.map(a => fila('✏️', `${escapeHtml(a.de)} → <b>${escapeHtml(a.a)}</b>`, a.activarTambien ? '<span class="badge badge-neutral">y se activa</span>' : ''));
  const filasDesactivar = r.aDesactivar.map(a => `
    <tr>
      <td style="width:28px;"><input type="checkbox" class="cg-desact-chk" data-id="${a.id}" checked></td>
      <td>${escapeHtml(a.nombre)}</td>
      <td><span class="badge badge-warning">no está en la planilla</span></td>
    </tr>`);

  const seccion = (titulo, filas, vacio) => filas.length ? `
    <div style="margin-top:14px;">
      <h4 style="margin:0 0 6px;">${titulo} (${filas.length})</h4>
      <div class="table-wrap"><table class="data-table"><tbody>${filas.join('')}</tbody></table></div>
    </div>` : vacio;

  zone.innerHTML = `
    <div class="form-card">
      <div class="import-resumen">
        <span class="badge badge-success">${r.altas.length} nuevos</span>
        <span class="badge badge-neutral">${r.reactivar.length} a reactivar</span>
        <span class="badge badge-neutral">${r.renombrar.length} a renombrar</span>
        <span class="badge badge-neutral">${r.sinCambios.length} sin cambios</span>
        ${r.aDesactivar.length ? `<span class="badge badge-warning">${r.aDesactivar.length} a desactivar</span>` : ''}
        ${r.duplicadas ? `<span class="badge badge-neutral">${r.duplicadas} duplicado(s) en la planilla, se ignoraron</span>` : ''}
      </div>
      ${seccion('🆕 Cargos nuevos', filasAltas, '')}
      ${seccion('♻️ Se reactivan', filasReactivar, '')}
      ${seccion('✏️ Se renombran', filasRenombrar, '')}
      ${r.aDesactivar.length ? `
        <div style="margin-top:14px;">
          <h4 style="margin:0 0 6px;">⚠️ Activos hoy pero no están en la planilla (${r.aDesactivar.length})</h4>
          <p class="hint">Se desactivarán (no se borran) los que dejes marcados. Destildá los que quieras conservar igual.</p>
          <div class="table-wrap"><table class="data-table"><tbody>${filasDesactivar.join('')}</tbody></table></div>
        </div>` : ''}
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cg-imp-cancelar">Cancelar</button>
        <button type="button" class="btn btn-primary" id="cg-imp-aplicar">Aplicar cambios</button>
      </div>
    </div>`;

  zone.querySelector('#cg-imp-cancelar').addEventListener('click', () => {
    zone.innerHTML = '';
    container.querySelector('#cg-file-import').value = '';
  });

  zone.querySelector('#cg-imp-aplicar').addEventListener('click', async () => {
    const idsDesactivar = [...zone.querySelectorAll('.cg-desact-chk:checked')].map(chk => chk.dataset.id);
    const totalCambios = r.altas.length + r.reactivar.length + r.renombrar.length + idsDesactivar.length;
    if (!totalCambios) { Toast.info('Nada que aplicar', 'No hay cambios seleccionados.'); return; }

    if (idsDesactivar.length) {
      const ok = await Confirm.ask({
        title: `¿Desactivar ${idsDesactivar.length} cargo(s)?`,
        variant: 'danger',
        text: 'Dejan de aparecer en el desplegable de solicitudes. No se borran: se pueden reactivar después desde esta misma tabla.',
        confirmText: 'Desactivar y aplicar'
      });
      if (!ok) return;
    }

    const btn = zone.querySelector('#cg-imp-aplicar');
    btn.disabled = true; btn.textContent = 'Aplicando...';
    let hechos = 0;
    const errores = [];
    try {
      for (const a of r.altas) {
        try { await Data.crearCargo(a.nombre); hechos++; } catch (e) { errores.push(`${a.nombre}: ${e.message || 'error'}`); }
      }
      for (const a of r.reactivar) {
        try { await Data.actualizarCargo(a.id, { activo: true }); hechos++; } catch (e) { errores.push(`${a.nombre}: ${e.message || 'error'}`); }
      }
      for (const a of r.renombrar) {
        try {
          const patch = { nombre: a.a };
          if (a.activarTambien) patch.activo = true;
          await Data.actualizarCargo(a.id, patch);
          hechos++;
        } catch (e) { errores.push(`${a.de}: ${e.message || 'error'}`); }
      }
      for (const id of idsDesactivar) {
        try { await Data.actualizarCargo(id, { activo: false }); hechos++; } catch (e) { errores.push(`(desactivar) ${id}: ${e.message || 'error'}`); }
      }

      if (errores.length) {
        console.error('[cargos] importar - errores:', errores);
        Toast.warning('Importado con errores', `${hechos} cambio(s) aplicados, ${errores.length} fallaron (revisa la consola).`);
      } else {
        Toast.success('Planilla importada', `${hechos} cambio(s) aplicados.`);
      }
      renderCargos(container);
    } catch (e) {
      console.error('[cargos] importar', e);
      Toast.error('Error', e.message || 'No se pudo completar la importación.');
      btn.disabled = false; btn.textContent = 'Aplicar cambios';
    }
  });
}
