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
import { pesos, fechaCorta } from '../ui/solicitud-format.js';
import { renderTrabajadorPerfil } from './trabajador-perfil.js';
import { TIPOS_CONTRATO, DOTACION_CODIGOS } from '../config.js';
import { nuevoLibroSgc, hojaSgc, descargarLibroSgc } from '../ui/xlsx-sgc.js';

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
const parseFecha = (v) => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
};
const parseBool = (v) => {
  if (v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === 'si' || s === 'sí' || s === 'true' || s === '1' || s === 'x';
};
// Acepta el valor tal cual está en TIPOS_CONTRATO sin importar mayúsculas ni
// espacios extra; si no calza con ninguno de los 3, devuelve undefined
// (distinto de null: "no reconocido", no "vacío a propósito") para que la
// fila se pueda marcar con advertencia en vez de perder el dato en silencio
// -- la columna tiene un check constraint en la BD, así que un valor
// inventado haría fallar el upsert completo si se dejara pasar.
const normTexto = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const parseTipoContrato = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = normTexto(v);
  const match = TIPOS_CONTRATO.find(t => normTexto(t) === n);
  return match ?? undefined;
};
// Si la planilla trae un "Nombre completo" / "Nombre" de una sola columna
// (formato antiguo), se separa con la misma convención que usa la migración
// 0015 para separar los trabajadores que ya existían: la última palabra es
// el apellido materno, la anterior el paterno, el resto son los nombres.
// Es una suposición -- best-effort, igual que en la BD -- así que después
// conviene revisar a mano los casos dudosos en la tabla.
const partirNombreCompleto = (v) => {
  const palabras = String(v ?? '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!palabras.length) return { nombres: null, apellido_paterno: null, apellido_materno: null };
  if (palabras.length === 1) return { nombres: palabras[0], apellido_paterno: null, apellido_materno: null };
  if (palabras.length === 2) return { nombres: palabras[0], apellido_paterno: palabras[1], apellido_materno: null };
  return {
    nombres: palabras.slice(0, -2).join(' '),
    apellido_paterno: palabras[palabras.length - 2],
    apellido_materno: palabras[palabras.length - 1]
  };
};
// Nombre completo para mostrar en la vista previa de importación, armado
// igual que el trigger armar_nombre_trabajador() de la BD (migración 0015).
const nombreCompletoDeFila = (f) => [f.nombres, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ') || '—';

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
    <p class="hint">La planilla debe seguir el formato de la plantilla maestra. Se cargan todos los trabajadores: los existentes se actualizan por RUT y los nuevos se crean.
      El tipo de contrato, la fecha de término de contrato e "Indefinido" también se pueden editar acá mismo, fila por fila.</p>
    <div id="import-zone"></div>
    <div class="table-wrap" style="margin-top:14px;">
      <table class="data-table">
        <thead><tr><th>RUT</th><th>Nombres</th><th>Apellido Paterno</th><th>Apellido Materno</th><th>Cargo</th><th>Centro</th><th>Tipo de contrato</th><th>Fecha término contrato</th><th>Indefinido</th><th>Anexo renovación</th><th></th></tr></thead>
        <tbody id="trab-tbody"></tbody>
      </table>
    </div>`;

  container.querySelector('#btn-plantilla').addEventListener('click', descargarPlantilla);
  container.querySelector('#btn-export').addEventListener('click', exportar);
  container.querySelector('#file-import').addEventListener('change', (e) => {
    if (e.target.files?.[0]) importar(e.target.files[0], container);
  });

  pintarTabla(container);
}

function optsContratoTabla(sel) {
  return '<option value="">—</option>' +
    TIPOS_CONTRATO.map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join('');
}

function pintarTabla(container) {
  const tbody = container.querySelector('#trab-tbody');
  tbody.innerHTML = trabajadores.map(t => `
    <tr data-id="${t.id}" class="${t.activo ? '' : 'row-inactivo'}">
      <td class="mono">${escapeHtml(t.rut || '—')}</td>
      <td><input type="text" class="t-input" data-field="nombres" value="${escapeHtml(t.nombres || '')}" placeholder="Nombres"></td>
      <td><input type="text" class="t-input" data-field="apellido_paterno" value="${escapeHtml(t.apellido_paterno || '')}" placeholder="Apellido paterno"></td>
      <td><input type="text" class="t-input" data-field="apellido_materno" value="${escapeHtml(t.apellido_materno || '')}" placeholder="Apellido materno"></td>
      <td>${escapeHtml(t.cargo || '—')}</td>
      <td>${escapeHtml(idToCentro.get(t.centro_costo_id)?.nombre || '—')}</td>
      <td><select class="t-input" data-field="tipo_contrato">${optsContratoTabla(t.tipo_contrato)}</select></td>
      <td><input type="date" class="t-input" data-field="fecha_termino_contrato" value="${t.fecha_termino_contrato || ''}" ${t.contrato_indefinido ? 'disabled' : ''}></td>
      <td class="u-center"><input type="checkbox" class="t-input" data-field="contrato_indefinido" ${t.contrato_indefinido ? 'checked' : ''}></td>
      <td class="u-center" title="Se prende solo al fijar Obra o Faena y se apaga solo al aprobarse una Renovación para este trabajador. Bloquea crear traslados mientras esté prendido.">
        <input type="checkbox" class="t-input" data-field="requiere_anexo_renovacion" ${t.requiere_anexo_renovacion ? 'checked' : ''}>
        ${t.requiere_anexo_renovacion ? '<span class="badge badge-danger">Bloquea traslado</span>' : ''}
      </td>
      <td><button class="link-btn" data-perfil="${t.id}">Ver perfil ▸</button></td>
    </tr>`).join('');

  tbody.querySelectorAll('.t-input').forEach(el => {
    const ev = el.type === 'checkbox' ? 'change' : 'change';
    el.addEventListener(ev, async () => {
      const tr = el.closest('tr');
      const id = tr.dataset.id;
      const field = el.dataset.field;
      const value = el.type === 'checkbox' ? el.checked : (el.value.trim() || null);
      const patch = { [field]: value };
      if (field === 'contrato_indefinido' && value) patch.fecha_termino_contrato = null; // indefinido no lleva fecha
      try {
        await Data.actualizarTrabajador(id, patch);
        const t = trabajadores.find(x => x.id === id);
        Object.assign(t, patch);
        // tipo_contrato dispara un trigger en la BD (marcar_requiere_anexo_renovacion,
        // migración 0013) que puede prender requiere_anexo_renovacion solo; nombres/
        // apellido_paterno/apellido_materno arman trabajadores.nombre solos (migración
        // 0015) -- en los dos casos se recarga la fila para reflejar el valor calculado
        // por la base sin esperar a un refresh completo.
        if (['tipo_contrato', 'nombres', 'apellido_paterno', 'apellido_materno'].includes(field)) {
          try { Object.assign(t, await Data.trabajadorPorId(id)); } catch { /* se mantiene lo que ya había */ }
        }
        Toast.success('Guardado', '');
        pintarTabla(container);
      } catch (e) {
        console.error('[trabajadores] actualizar', e);
        Toast.error('Error', 'No se pudo guardar.');
      }
    });
  });

  tbody.querySelectorAll('[data-perfil]').forEach(btn => {
    btn.addEventListener('click', () => renderTrabajadorPerfil(container, btn.dataset.perfil, 'trabajadores'));
  });
}

const HEADERS = ['RUT', 'Nombres', 'Apellido Paterno', 'Apellido Materno', 'Profesión', 'Cargo', 'Código Centro Costo', 'Nombre Centro Costo', 'Sueldo Líquido Pactado', 'Tipo de Contrato', 'Fecha Término Contrato', 'Contrato Indefinido'];

// Formato de cada columna en los Excel con el diseño del SGC (ui/xlsx-sgc.js).
// Los títulos son HEADERS tal cual: el importador los reconoce por nombre.
const FORMATO_COLUMNAS = {
  'RUT':                    { icono: 'id-card', px: 120, estilo: 'fuerte' },
  'Nombres':                { icono: 'user', px: 140, estilo: 'normal' },
  'Apellido Paterno':       { icono: 'user', px: 125, estilo: 'normal' },
  'Apellido Materno':       { icono: 'user', px: 125, estilo: 'normal' },
  'Profesión':              { icono: 'graduation-cap', px: 140, estilo: 'normal' },
  'Cargo':                  { icono: 'briefcase', px: 145, estilo: 'normal' },
  'Código Centro Costo':    { icono: 'hash', px: 120, alinear: 'centro', estilo: 'normal' },
  'Nombre Centro Costo':    { icono: 'building-2', px: 175, estilo: 'normal' },
  'Sueldo Líquido Pactado': { icono: 'banknote', px: 125, alinear: 'centro', estilo: 'normal', numFmt: '"$" #,##0' },
  'Tipo de Contrato':       { icono: 'file-signature', px: 125, estilo: 'normal' },
  'Fecha Término Contrato': { icono: 'calendar-x', px: 125, alinear: 'centro', estilo: 'normal' },
  'Contrato Indefinido':    { icono: 'infinity', px: 120, estilo: 'pildora' }
};
const columnasXlsx = () => HEADERS.map(h => ({ titulo: h, ...FORMATO_COLUMNAS[h] }));
const IDX_TIPO_CONTRATO = HEADERS.indexOf('Tipo de Contrato');
const IDX_INDEFINIDO = HEADERS.indexOf('Contrato Indefinido');

const FECHA_CHILE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' });
const hoyIso = () => FECHA_CHILE.format(new Date());                       // AAAA-MM-DD
const hoyDMY = () => hoyIso().split('-').reverse().join('/');              // DD/MM/AAAA

// Encabezado + identificación del registro (sección 1) de cada Excel.
function docDotacion(cual, fichasExtra, tituloTabla) {
  const { codigo, titulo } = DOTACION_CODIGOS[cual];
  const fecha = hoyDMY();
  return {
    encabezado: { titulo, codigo, fecha, revision: '00' },
    pie: { codigo, nombre: titulo },
    secciones: [
      { titulo: 'Identificación del registro', fichas: [
        { etiqueta: 'Registro', valor: titulo, icono: 'file-text' },
        { etiqueta: 'Fecha del documento', valor: fecha, icono: 'calendar-days' },
        { etiqueta: 'Código', valor: codigo, icono: 'barcode' },
        { etiqueta: 'Revisión', valor: '00', icono: 'settings' },
        ...fichasExtra
      ] },
      { titulo: tituloTabla, tabla: true }
    ]
  };
}

async function conBoton(id, texto, fn) {
  const btn = document.getElementById(id);
  const original = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = texto; }
  try { await fn(); } finally { if (btn) { btn.disabled = false; btn.textContent = original; } }
}

async function descargarPlantilla() {
  await conBoton('btn-plantilla', 'Generando...', async () => {
    try {
      const c0 = centros[0];
      const ejemplos = [
        ['12.345.678-9', 'Juan', 'Pérez', 'González', 'Constructor Civil', 'Maestro Albañil', c0?.codigo != null ? String(c0.codigo) : '10', c0?.nombre ?? '', 650000, 'Obra o Faena', '2027-03-31', 'No'],
        ['98.765.432-1', 'María', 'Soto', 'Rojas', 'Prevencionista', 'Jefe de Terreno', '', '', 1200000, 'Indefinido', '', 'Sí']
      ];
      const wb = nuevoLibroSgc();

      // Hoja 1 (la que lee el importador): la tabla para llenar
      await hojaSgc(wb, {
        nombreHoja: 'Trabajadores',
        doc: docDotacion('plantilla', [
          { etiqueta: 'Clave de carga', valor: 'RUT (si existe se actualiza; si es nuevo se crea)', icono: 'id-card' },
          { etiqueta: 'Instrucciones', valor: 'Ver la hoja "Instrucciones"', icono: 'list-checks' }
        ], 'Detalle del registro'),
        columnas: columnasXlsx(),
        filas: ejemplos,
        filasVacias: 18,
        conPie: false,        // la tabla crece hacia abajo: el pie va solo en la impresión
        autofiltro: false,
        validaciones: [
          { columna: IDX_TIPO_CONTRATO, lista: TIPOS_CONTRATO },
          { columna: IDX_INDEFINIDO, lista: ['Sí', 'No'] }
        ]
      });

      // Hoja 2: instrucciones + centros de costo válidos
      const docInst = docDotacion('plantilla', [], 'Centros de costo válidos');
      docInst.secciones[0] = { titulo: 'Instrucciones de llenado', fichas: [
        { etiqueta: 'Dotación completa', valor: 'Carga la dotación COMPLETA, no solo los trabajadores nuevos.', icono: 'users', ancho: 'completo' },
        { etiqueta: 'RUT', valor: 'Es la clave: si ya existe en el sistema se ACTUALIZA; si es nuevo se CREA. Antes de aplicar, la app muestra trabajador por trabajador qué cambia.', icono: 'id-card', ancho: 'completo' },
        { etiqueta: 'Nombres y apellidos', valor: '"Nombres", "Apellido Paterno" y "Apellido Materno" van en columnas separadas. "Apellido Materno" puede ir vacío; "Nombres" y "Apellido Paterno" no deberían quedar vacíos.', icono: 'user', ancho: 'completo' },
        { etiqueta: 'Código Centro Costo', valor: 'Debe coincidir con uno de la tabla "Centros de costo válidos", más abajo.', icono: 'hash', ancho: 'completo' },
        { etiqueta: 'Sueldo Líquido Pactado', valor: 'Número, sin $ ni puntos (ej.: 650000).', icono: 'banknote', ancho: 'completo' },
        { etiqueta: 'Tipo de Contrato', valor: 'Plazo Fijo / Obra o Faena / Indefinido (vacío si no se conoce). Si queda en "Obra o Faena", el sistema exige un anexo de renovación antes de poder trasladar a ese trabajador.', icono: 'file-signature', ancho: 'completo' },
        { etiqueta: 'Fecha Término Contrato', valor: 'Formato AAAA-MM-DD. Se deja vacía si el contrato es indefinido.', icono: 'calendar-x', ancho: 'completo' },
        { etiqueta: 'Contrato Indefinido', valor: 'Sí / No. Si es "Sí", el trabajador no entra al aviso de próximos vencimientos.', icono: 'infinity', ancho: 'completo' },
        { etiqueta: 'Filas de ejemplo', valor: 'Las 2 filas de ejemplo de la hoja "Trabajadores" se deben borrar o reemplazar antes de importar.', icono: 'message-square', ancho: 'completo' }
      ] };
      await hojaSgc(wb, {
        nombreHoja: 'Instrucciones',
        doc: docInst,
        columnas: [
          { titulo: 'Código', icono: 'hash', px: 200, alinear: 'centro', estilo: 'fuerte' },
          { titulo: 'Nombre', icono: 'building-2', px: 700, estilo: 'normal' }
        ],
        filas: centros.map(c => [String(c.codigo), c.nombre]),
        autofiltro: false,
        vacia: 'No hay centros de costo registrados.'
      });

      await descargarLibroSgc(wb, 'Plantilla_Trabajadores_SSI-RRHH.xlsx');
      Toast.success('Plantilla descargada', 'Llénala y súbela con "Importar planilla".');
    } catch (e) {
      console.error('[trabajadores] plantilla', e);
      Toast.error('Error', 'No se pudo generar la plantilla.');
    }
  });
}

async function exportar() {
  await conBoton('btn-export', 'Generando...', async () => {
    try {
      const filas = trabajadores.map((t, i) => [
        i + 1,
        t.rut,
        t.nombres ?? '',
        t.apellido_paterno ?? '',
        t.apellido_materno ?? '',
        t.profesion ?? '',
        t.cargo ?? '',
        idToCentro.get(t.centro_costo_id)?.codigo != null ? String(idToCentro.get(t.centro_costo_id).codigo) : '',
        idToCentro.get(t.centro_costo_id)?.nombre ?? '',
        t.sueldo_liquido ?? '',
        t.tipo_contrato ?? '',
        t.fecha_termino_contrato ?? '',
        t.contrato_indefinido ? 'Sí' : 'No'
      ]);
      const nCentros = new Set(trabajadores.map(t => t.centro_costo_id).filter(Boolean)).size;
      const wb = nuevoLibroSgc();
      await hojaSgc(wb, {
        nombreHoja: 'Trabajadores',
        doc: docDotacion('maestro', [
          { etiqueta: 'Total de registros', valor: `${trabajadores.length} trabajador(es)`, icono: 'database' },
          { etiqueta: 'Centros de costo', valor: `${nCentros} centro(s) con dotación`, icono: 'building-2' }
        ], 'Detalle del registro'),
        columnas: [{ titulo: 'N°', px: 46, alinear: 'centro', estilo: 'numero' }, ...columnasXlsx()],
        filas,
        vacia: 'No hay trabajadores en el maestro.'
      });
      await descargarLibroSgc(wb, `Maestro_Trabajadores_${hoyIso()}.xlsx`);
      Toast.success('Maestro exportado', '');
    } catch (e) {
      console.error('[trabajadores] exportar', e);
      Toast.error('Error', 'No se pudo generar el maestro de trabajadores.');
    }
  });
}

/**
 * Fila (0-based, absoluta en la hoja) donde están los títulos de la tabla:
 * la primera que tenga una celda "RUT". Las planillas con el diseño del SGC
 * traen el encabezado como imagen arriba, así que los títulos no están en la
 * fila 1; las planillas antiguas (títulos en la fila 1) siguen funcionando.
 */
function filaDeTitulos(ws) {
  if (!ws || !ws['!ref']) return null;
  const rango = XLSX.utils.decode_range(ws['!ref']);
  for (let r = rango.s.r; r <= Math.min(rango.e.r, rango.s.r + 80); r++) {
    for (let c = rango.s.c; c <= rango.e.c; c++) {
      const celda = ws[XLSX.utils.encode_cell({ r, c })];
      if (celda && celda.v != null && normKey(celda.v) === 'rut') return r;
    }
  }
  return null;
}

async function importar(file, container) {
  const zone = container.querySelector('#import-zone');
  zone.innerHTML = '<div class="view-loading">Leyendo planilla...</div>';
  let parsed;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    // La hoja con la tabla: la llamada "Trabajadores" o, si no, la primera.
    const nombreHoja = wb.SheetNames.find(n => normKey(n) === 'trabajadores') ?? wb.SheetNames[0];
    const ws = wb.Sheets[nombreHoja];
    const fila0 = filaDeTitulos(ws);
    parsed = XLSX.utils.sheet_to_json(ws, fila0 != null ? { defval: null, range: fila0 } : { defval: null });
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
    const indefinido = parseBool(pick(rn, 'contrato indefinido', 'indefinido'));
    const tipoContratoCrudo = pick(rn, 'tipo de contrato', 'tipo contrato');
    const tipoContrato = parseTipoContrato(tipoContratoCrudo);
    const tipoContratoInvalido = tipoContrato === undefined; // valor presente pero no reconocido
    const prev = porRut.get(normRut(rut));
    // Nombres: se prefieren las 3 columnas separadas. Si la planilla no trae
    // ninguna de las 3 pero sí trae "Nombre completo" / "Nombre" (formato
    // antiguo), se separa automático con partirNombreCompleto() -- así una
    // planilla vieja se puede seguir importando sin tener que rehacerla.
    let nombres = txt(pick(rn, 'nombres', 'nombre(s)'));
    let apellidoPaterno = txt(pick(rn, 'apellido paterno', 'apellido pat', 'apellido pat.'));
    let apellidoMaterno = txt(pick(rn, 'apellido materno', 'apellido mat', 'apellido mat.'));
    if (!nombres && !apellidoPaterno && !apellidoMaterno) {
      const completo = txt(pick(rn, 'nombre completo', 'nombre'));
      if (completo) {
        const partido = partirNombreCompleto(completo);
        nombres = partido.nombres;
        apellidoPaterno = partido.apellido_paterno;
        apellidoMaterno = partido.apellido_materno;
      }
    }
    const fila = {
      rut,
      nombres,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      profesion: txt(pick(rn, 'profesion')),
      cargo: txt(pick(rn, 'cargo')),
      sueldo_liquido: parseMoney(pick(rn, 'sueldo liquido pactado', 'sueldo liquido', 'sueldo')),
      centro_costo_id: codigo ? (codigoToId.get(codigo) ?? null) : null,
      // Si no se reconoce el valor, no se toca el tipo_contrato ya guardado -- se
      // reenvía el mismo valor que ya tenía (en vez de omitir la clave) para que
      // TODAS las filas del lote manden siempre las mismas columnas: así el
      // upsert masivo nunca queda con una fila de forma distinta a las demás
      // por culpa de un dato mal tipeado, sin importar el orden de las filas
      // en la planilla ni si el trabajador es nuevo (prev == null) o existente.
      tipo_contrato: tipoContratoInvalido ? (prev?.tipo_contrato ?? null) : tipoContrato,
      contrato_indefinido: indefinido,
      fecha_termino_contrato: indefinido ? null : parseFecha(pick(rn, 'fecha termino contrato', 'fecha de termino de contrato', 'fecha termino')),
      _codigo: codigo
    };
    const cambios = [];
    if (prev) {
      const cmp = (campo, label, fmt = (x) => x) => {
        if (fila[campo] === undefined) return; // no viene en la planilla / no se reconoció -- no se compara ni se toca
        const a = prev[campo] ?? null, b = fila[campo] ?? null;
        if (String(a ?? '') !== String(b ?? '')) cambios.push(`${label}: ${fmt(a) || '—'} → ${fmt(b) || '—'}`);
      };
      cmp('nombres', 'Nombres');
      cmp('apellido_paterno', 'Apellido Paterno');
      cmp('apellido_materno', 'Apellido Materno');
      cmp('cargo', 'Cargo');
      cmp('profesion', 'Profesión');
      cmp('sueldo_liquido', 'Sueldo', pesos);
      cmp('tipo_contrato', 'Tipo de contrato');
      cmp('fecha_termino_contrato', 'Fecha término', fechaCorta);
      cmp('contrato_indefinido', 'Indefinido', (v) => (v ? 'Sí' : 'No'));
      if (String(prev.centro_costo_id ?? '') !== String(fila.centro_costo_id ?? '')) {
        cambios.push(`Centro: ${idToCentro.get(prev.centro_costo_id)?.codigo || '—'} → ${fila._codigo || '—'}`);
      }
    }
    items.push({
      fila, estado: !prev ? 'nuevo' : (cambios.length ? 'modificado' : 'sin_cambios'), cambios,
      codigoInvalido: !!codigo && !codigoToId.has(codigo),
      tipoContratoInvalido
    });
  }

  const nuevos = items.filter(i => i.estado === 'nuevo');
  const modif = items.filter(i => i.estado === 'modificado');
  const iguales = items.filter(i => i.estado === 'sin_cambios');
  const aplicar = [...nuevos, ...modif];
  const conError = items.filter(i => i.codigoInvalido);
  const conAvisoTipo = items.filter(i => i.tipoContratoInvalido);

  const badge = (e) => e === 'nuevo' ? '<span class="badge badge-success">Nuevo</span>'
    : e === 'modificado' ? '<span class="badge badge-warning">Modificado</span>'
    : '<span class="badge badge-neutral">Sin cambios</span>';

  const filasHtml = items.map(i => `
    <tr class="${i.estado === 'sin_cambios' ? 'row-inactivo' : ''}">
      <td class="mono">${escapeHtml(i.fila.rut)}</td>
      <td>${escapeHtml(nombreCompletoDeFila(i.fila))}</td>
      <td>${badge(i.estado)}</td>
      <td>${i.cambios.length ? escapeHtml(i.cambios.join(' · ')) : (i.estado === 'nuevo' ? 'Alta de trabajador' : '—')}${i.codigoInvalido ? ' <span class="badge badge-danger">código de centro inexistente</span>' : ''}${i.tipoContratoInvalido ? ' <span class="badge badge-danger">tipo de contrato no reconocido, se deja como estaba</span>' : ''}</td>
    </tr>`).join('');

  zone.innerHTML = `
    <div class="import-resumen">
      <span class="badge badge-success">${nuevos.length} nuevos</span>
      <span class="badge badge-warning">${modif.length} modificados</span>
      <span class="badge badge-neutral">${iguales.length} sin cambios</span>
      ${conAvisoTipo.length ? `<span class="badge badge-danger">${conAvisoTipo.length} con tipo de contrato no reconocido</span>` : ''}
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
