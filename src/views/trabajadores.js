/**
 * Vista "Trabajadores" (admin) · maestro de la dotación.
 *  - Exportar: descarga el maestro actual en Excel (refleja traslados aprobados).
 *  - Importar: sube la planilla del ERP, muestra trabajador por trabajador qué
 *    cambia (nuevo / modificado / sin cambios) y, al confirmar, aplica el upsert.
 */

import * as XLSX from 'xlsx';
import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { pesos } from '../ui/solicitud-format.js';

let trabajadores = [], centros = [];
let porRut = new Map();          // rut normalizado -> trabajador
let codigoToId = new Map();      // código centro -> id
let idToCentro = new Map();      // id -> {codigo, nombre}

const normRut = (v) => String(v ?? '').replace(/[.\s]/g, '').toUpperCase();
const parseMoney = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  const n = Number(s);
  return isNaN(n) ? null : Math.round(n);
};
const txt = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

// normaliza encabezados: minúsculas, sin acentos, espacios simples
const normKey = (k) => String(k).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
function pick(rowNorm, ...alias) {
  for (const a of alias) if (rowNorm[a] !== undefined) return rowNorm[a];
  return undefined;
}

export async function renderTrabajadores(container) {
  container.innerHTML = '<div class="view-loading">Cargando dotación...</div>';
  try {
    [trabajadores, centros] = await Promise.all([Data.todosTrabajadores(), Data.listCentrosAdmin()]);
  } catch (e) {
    console.error('[trabajadores]', e);
    Toast.error('Error', 'No se pudo cargar la dotación.');
    container.innerHTML = '<div class="empty-state">No se pudo cargar la dotación.</div>';
    return;
  }
  porRut = new Map(trabajadores.map(t => [normRut(t.rut), t]));
  codigoToId = new Map(centros.map(c => [String(c.codigo), c.id]));
  idToCentro = new Map(centros.map(c => [c.id, c]));

  container.innerHTML = `
    <div class="sol-toolbar">
      <span class="muted">${trabajadores.length} trabajador(es) en el maestro</span>
      <div class="sol-acciones">
        <button class="btn btn-secondary" id="btn-plantilla">Descargar plantilla</button>
        <button class="btn btn-secondary" id="btn-export">Descargar maestro (Excel)</button>
        <label class="btn btn-primary" style="cursor:pointer;">
          Importar planilla
          <input type="file" id="file-import" accept=".xlsx,.xls" hidden>
        </label>
      </div>
    </div>
    <p class="hint">La planilla debe seguir el formato de la plantilla maestra. Se cargan todos los trabajadores: los existentes se actualizan por RUT y los nuevos se crean.</p>
    <div id="import-zone"></div>`;

  container.querySelector('#btn-plantilla').addEventListener('click', descargarPlantilla);
  container.querySelector('#btn-export').addEventListener('click', exportar);
  container.querySelector('#file-import').addEventListener('change', (e) => {
    if (e.target.files?.[0]) importar(e.target.files[0], container);
  });
}

const HEADERS = ['RUT', 'Nombre Completo', 'Profesión', 'Cargo', 'Código Centro Costo', 'Nombre Centro Costo', 'Sueldo Líquido Pactado'];

function descargarPlantilla() {
  const c0 = centros[0];
  const aoa = [
    HEADERS,
    ['12.345.678-9', 'Juan Pérez González', 'Constructor Civil', 'Maestro Albañil', c0?.codigo ?? '10', c0?.nombre ?? '', 650000],
    ['98.765.432-1', 'María Soto Rojas', 'Prevencionista', 'Jefe de Terreno', '', '', 1200000]
  ];
  const wsT = XLSX.utils.aoa_to_sheet(aoa);
  wsT['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 26 }, { wch: 20 }];

  const inst = [
    ['PLANTILLA MAESTRA DE TRABAJADORES · SSI-RRHH Metalium'],
    [],
    ['Carga la dotación COMPLETA (no solo los nuevos).'],
    ['El RUT es la clave: si ya existe en el sistema se ACTUALIZA; si es nuevo se CREA.'],
    ['Antes de aplicar, la app te muestra trabajador por trabajador qué cambia.'],
    ['El "Código Centro Costo" debe coincidir con uno de la lista de abajo.'],
    ['"Sueldo Líquido Pactado": número, sin $ ni puntos (ej: 650000).'],
    [],
    ['CÓDIGOS DE CENTRO DE COSTO VÁLIDOS'],
    ['Código', 'Nombre'],
    ...centros.map(c => [String(c.codigo), c.nombre])
  ];
  const wsI = XLSX.utils.aoa_to_sheet(inst);
  wsI['!cols'] = [{ wch: 16 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsT, 'Trabajadores');
  XLSX.utils.book_append_sheet(wb, wsI, 'Instrucciones');
  XLSX.writeFile(wb, 'Plantilla_Trabajadores_SSI-RRHH.xlsx');
  Toast.success('Plantilla descargada', 'Llénala y súbela con "Importar planilla".');
}

function exportar() {
  const filas = trabajadores.map(t => ({
    'RUT': t.rut,
    'Nombre Completo': t.nombre,
    'Profesión': t.profesion,
    'Cargo': t.cargo,
    'Código Centro Costo': idToCentro.get(t.centro_costo_id)?.codigo ?? '',
    'Nombre Centro Costo': idToCentro.get(t.centro_costo_id)?.nombre ?? '',
    'Sueldo Líquido Pactado': t.sueldo_liquido ?? ''
  }));
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trabajadores');
  const hoy = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Maestro_Trabajadores_${hoy}.xlsx`);
  Toast.success('Maestro exportado', '');
}

async function importar(file, container) {
  const zone = container.querySelector('#import-zone');
  zone.innerHTML = '<div class="view-loading">Leyendo planilla...</div>';
  let parsed;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    parsed = XLSX.utils.sheet_to_json(ws, { defval: null });
  } catch (e) {
    console.error('[trabajadores] parse', e);
    Toast.error('Archivo inválido', 'No se pudo leer la planilla.');
    zone.innerHTML = '';
    return;
  }

  // Normalizar filas y comparar con el maestro actual
  const items = [];
  for (const raw of parsed) {
    const rn = {};
    for (const k in raw) rn[normKey(k)] = raw[k];
    const rut = txt(pick(rn, 'rut'));
    if (!rut) continue; // fila sin RUT, se ignora
    const codigo = txt(pick(rn, 'codigo centro costo', 'codigo cc', 'codigo centro de costo'));
    const fila = {
      rut,
      nombre: txt(pick(rn, 'nombre completo', 'nombre')),
      profesion: txt(pick(rn, 'profesion')),
      cargo: txt(pick(rn, 'cargo')),
      sueldo_liquido: parseMoney(pick(rn, 'sueldo liquido pactado', 'sueldo liquido', 'sueldo')),
      centro_costo_id: codigo ? (codigoToId.get(codigo) ?? null) : null,
      _codigo: codigo
    };
    const prev = porRut.get(normRut(rut));
    const cambios = [];
    if (prev) {
      const cmp = (campo, label, fmt = (x) => x) => {
        const a = prev[campo] ?? null, b = fila[campo] ?? null;
        if (String(a ?? '') !== String(b ?? '')) cambios.push(`${label}: ${fmt(a) || '—'} → ${fmt(b) || '—'}`);
      };
      cmp('nombre', 'Nombre');
      cmp('cargo', 'Cargo');
      cmp('profesion', 'Profesión');
      cmp('sueldo_liquido', 'Sueldo', pesos);
      if (String(prev.centro_costo_id ?? '') !== String(fila.centro_costo_id ?? '')) {
        cambios.push(`Centro: ${idToCentro.get(prev.centro_costo_id)?.codigo || '—'} → ${fila._codigo || '—'}`);
      }
    }
    items.push({ fila, estado: !prev ? 'nuevo' : (cambios.length ? 'modificado' : 'sin_cambios'), cambios, codigoInvalido: !!codigo && !codigoToId.has(codigo) });
  }

  const nuevos = items.filter(i => i.estado === 'nuevo');
  const modif = items.filter(i => i.estado === 'modificado');
  const iguales = items.filter(i => i.estado === 'sin_cambios');
  const aplicar = [...nuevos, ...modif];
  const conError = items.filter(i => i.codigoInvalido);

  const badge = (e) => e === 'nuevo' ? '<span class="badge badge-success">Nuevo</span>'
    : e === 'modificado' ? '<span class="badge badge-warning">Modificado</span>'
    : '<span class="badge badge-neutral">Sin cambios</span>';

  const filasHtml = items.map(i => `
    <tr class="${i.estado === 'sin_cambios' ? 'row-inactivo' : ''}">
      <td class="mono">${escapeHtml(i.fila.rut)}</td>
      <td>${escapeHtml(i.fila.nombre || '—')}</td>
      <td>${badge(i.estado)}</td>
      <td>${i.cambios.length ? escapeHtml(i.cambios.join(' · ')) : (i.estado === 'nuevo' ? 'Alta de trabajador' : '—')}${i.codigoInvalido ? ' <span class="badge badge-danger">código de centro inexistente</span>' : ''}</td>
    </tr>`).join('');

  zone.innerHTML = `
    <div class="import-resumen">
      <span class="badge badge-success">${nuevos.length} nuevos</span>
      <span class="badge badge-warning">${modif.length} modificados</span>
      <span class="badge badge-neutral">${iguales.length} sin cambios</span>
      ${conError.length ? `<span class="badge badge-danger">${conError.length} con código de centro inválido</span>` : ''}
    </div>
    <div class="table-wrap" style="margin:12px 0;max-height:460px;overflow:auto;">
      <table class="data-table">
        <thead><tr><th>RUT</th><th>Nombre</th><th>Estado</th><th>Cambios</th></tr></thead>
        <tbody>${filasHtml}</tbody>
      </table>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="imp-cancel">Cancelar</button>
      <button class="btn btn-primary" id="imp-aplicar" ${aplicar.length ? '' : 'disabled'}>
        Aplicar ${aplicar.length} cambio(s)
      </button>
    </div>`;

  zone.querySelector('#imp-cancel').addEventListener('click', () => { zone.innerHTML = ''; container.querySelector('#file-import').value = ''; });
  zone.querySelector('#imp-aplicar').addEventListener('click', async () => {
    const btn = zone.querySelector('#imp-aplicar');
    btn.disabled = true; btn.textContent = 'Aplicando...';
    const rows = aplicar.map(i => {
      const f = { ...i.fila }; delete f._codigo; return f;
    });
    try {
      await Data.upsertTrabajadores(rows);
      Toast.success('Maestro actualizado', `${rows.length} trabajador(es) aplicados.`);
      renderTrabajadores(container);
    } catch (e) {
      console.error('[trabajadores] upsert', e);
      Toast.error('Error', e.message || 'No se pudo aplicar la carga.');
      btn.disabled = false; btn.textContent = `Aplicar ${rows.length} cambio(s)`;
    }
  });
}
