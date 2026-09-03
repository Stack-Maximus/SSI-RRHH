/**
 * Vista "Solicitudes" (RRHH / admin) · todas las solicitudes del sistema,
 * con filtro por estado, búsqueda y detalle expandible.
 * Reutilizable para "Historial" (solo finalizadas) vía el parámetro fijo.
 */

import ExcelJS from 'exceljs';
import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { estadoBadge, decisionBadge, tipoLabel, fechaCorta, resumen, detalleHtml, detalleTexto } from '../ui/solicitud-format.js';
import { TIPO_SOLICITUD_META, MAESTRO_SOLICITUDES_CODIGO, DOCUMENTO_CODIGOS } from '../config.js';
import { renderComprobante } from './comprobante.js';
import { encabezadoSvg, ajustarTextosEncabezado } from '../ui/encabezado-svg.js';
// Necesario para que .eh-svg text tenga font-family (Poppins/Arial) -- ver
// headerPngDataUri() más abajo, que además tiene que fijarlo inline porque
// esta hoja de estilos no viaja cuando se serializa solo el <svg>.
import '../styles/comprobante.css';

let _sols = [], _centros, _trab, _perfiles, _container;

export function renderSolicitudes(container) {
  return cargar(container, { soloFinalizadas: false, titulo: 'Todas las solicitudes', backView: 'solicitudes' });
}
export function renderHistorial(container) {
  return cargar(container, { soloFinalizadas: true, titulo: 'Solicitudes finalizadas', backView: 'historial' });
}

async function cargar(container, opts) {
  _container = container;
  container.innerHTML = '<div class="view-loading">Cargando solicitudes...</div>';
  try {
    const [sols, centros] = await Promise.all([Data.listTodasSolicitudes(), Data.listCentrosAdmin()]);
    _sols = opts.soloFinalizadas ? sols.filter(s => s.estado === 'aprobada' || s.estado === 'rechazada') : sols;
    _centros = new Map(centros.map(c => [c.id, c]));
    [_trab, _perfiles] = await Promise.all([
      Data.trabajadoresPorId(_sols.map(s => s.trabajador_id)),
      Data.perfilesPorId(_sols.map(s => s.solicitante_id))
    ]);
  } catch (e) {
    console.error('[solicitudes]', e);
    Toast.error('Error', 'No se pudieron cargar las solicitudes.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar las solicitudes.</div>';
    return;
  }

  const tabs = opts.soloFinalizadas
    ? [['todas', 'Todas'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']]
    : [['todas', 'Todas'], ['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']];

  container.innerHTML = `
    <div class="sol-toolbar">
      <div class="filter-tabs" id="filtros">
        ${tabs.map((t, i) => `<button class="filter-tab ${i === 0 ? 'active' : ''}" data-f="${t[0]}">${t[1]}</button>`).join('')}
      </div>
      <div class="sol-acciones">
        <input type="search" id="buscar" class="search-box" placeholder="Buscar código o solicitante...">
        <button class="btn btn-secondary" id="btn-maestro-excel">Exportar maestro (Excel)</button>
        <button class="btn btn-secondary" id="btn-maestro-pdf">⬇️ Exportar maestro (PDF)</button>
      </div>
    </div>
    <div id="sol-list"></div>`;

  container.querySelector('#btn-maestro-excel').addEventListener('click', exportarMaestro);
  container.querySelector('#btn-maestro-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Generando PDF...';
    try {
      await Data.descargarMaestroPdf();
    } catch (err) {
      console.error('[solicitudes] maestro pdf', err);
      Toast.error('Error', err.message || 'No se pudo generar el PDF del maestro.');
    } finally {
      btn.disabled = false; btn.textContent = '⬇️ Exportar maestro (PDF)';
    }
  });

  let filtro = 'todas', q = '';
  const pintar = () => {
    const list = _sols.filter(s => {
      if (filtro !== 'todas' && s.estado !== filtro) return false;
      if (q) {
        const sol = (_perfiles.get(s.solicitante_id)?.nombre || '').toLowerCase();
        const txt = (s.codigo || '').toLowerCase() + ' ' + sol;
        if (!txt.includes(q)) return false;
      }
      return true;
    });
    document.getElementById('sol-list').innerHTML = list.length ? grid(list) : '<div class="empty-state">No hay solicitudes que coincidan.</div>';
    wireDetalles(opts.backView);
  };

  container.querySelectorAll('#filtros .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#filtros .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtro = btn.dataset.f;
      pintar();
    });
  });
  container.querySelector('#buscar').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); pintar(); });

  pintar();
}

function grid(list) {
  return `<div class="sol-grid">${list.map(card).join('')}</div>`;
}

function card(s) {
  const solicitante = _perfiles.get(s.solicitante_id)?.nombre || '—';
  const aprob = (s.aprobaciones || []).filter(a => a.decision === 'aprobado').length;
  const total = (s.aprobaciones || []).length;
  const steps = (s.aprobaciones || []).map(a => `<div class="sol-step">Aprobador ${a.orden} ${decisionBadge(a.decision)}</div>`).join('');
  return `
    <div class="sol-card">
      <div class="sol-card-top">
        <span class="sol-id">${s.codigo || '—'}</span>
        <span class="sol-tipo">${tipoLabel(s.tipo)}</span>
        ${estadoBadge(s.estado)}
      </div>
      <div class="sol-resumen">${resumen(s, _centros, _trab)}</div>
      <div class="sol-detalle muted">Solicitante: ${escapeHtml(solicitante)} · ${fechaCorta(s.created_at)} · ${aprob}/${total} aprobada(s)</div>
      <button class="link-btn" data-toggle>Ver detalle ▾</button>
      <div class="sol-expand" hidden>
        ${detalleHtml(s)}
        <div class="sol-steps" style="margin-top:10px;">${steps || '<span class="muted">Sin aprobadores</span>'}</div>
        ${s.motivo ? `<div class="sol-motivo">"${escapeHtml(s.motivo)}"</div>` : ''}
        <button class="link-btn" data-comprobante="${s.id}">📄 Ver comprobante</button>
      </div>
    </div>`;
}

// Colores de marca (mismos que el encabezado del PDF y los correos), para que
// el maestro en Excel se vea como parte del mismo sistema y no como una
// planilla suelta. Formato ARGB (8 hex: alfa + RGB) que pide ExcelJS.
const XL_AZUL = 'FF1B9BD8';
const XL_GRIS_ETIQUETA = 'FF8791AA';
const XL_GRIS_TEXTO = 'FF3D4258';
const XL_ZEBRA = 'FFF6F9FC';
const XL_VERDE_BG = 'FFE5F6EA', XL_VERDE_FG = 'FF1A7F37';
const XL_ROJO_BG = 'FFFBE9E9', XL_ROJO_FG = 'FFB91C1C';
const XL_AMBAR_BG = 'FFFFF4E0', XL_AMBAR_FG = 'FF92610C';

function estadoColorXl(estado) {
  if (estado === 'aprobada') return { bg: XL_VERDE_BG, fg: XL_VERDE_FG };
  if (estado === 'rechazada') return { bg: XL_ROJO_BG, fg: XL_ROJO_FG };
  return { bg: XL_AMBAR_BG, fg: XL_AMBAR_FG }; // pendiente u otro estado futuro
}

/** Logo Metalium como data URI (mismo archivo .png que usa la vista en
 * pantalla), para incrustarlo en el encabezado del Excel. Si por algún
 * motivo no carga, el maestro se genera igual -- el logo nunca bloquea la
 * exportación. */
async function logoDataUriMaestro() {
  try {
    const res = await fetch('/Metalium_Logo_Header.png');
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[solicitudes] no se pudo cargar el logo para el Excel del maestro', e);
    return null;
  }
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('no se pudo cargar la imagen'));
    img.src = src;
  });
}

// Mismo viewBox que src/ui/encabezado-svg.js (fuente de verdad geométrica).
const EH_ANCHO = 1400, EH_ALTO = 173;
// Geometría del logo, IDÉNTICA a la de encabezadoSvg() -- duplicada acá
// porque el <image> del logo, anidado dentro de ese SVG, no se rasteriza de
// forma confiable al convertir el encabezado a PNG (ver punto 2 más abajo),
// así que se dibuja aparte con estas mismas coordenadas.
const EH_LOGO_X = 48, EH_LOGO_W = 225, EH_LOGO_ASPECTO = 110 / 527;
const EH_LOGO_H = EH_LOGO_W * EH_LOGO_ASPECTO;
const EH_LOGO_Y = EH_ALTO / 2 - EH_LOGO_H / 2;
// Ancho de la imagen del encabezado ya incrustada en el Excel (px) -- el
// alto sale del mismo aspecto que encabezadoSvg() (1400 x 173).
const HEADER_IMG_W = 950;
const HEADER_IMG_H = Math.round(HEADER_IMG_W * (EH_ALTO / EH_ANCHO));
// Alto de fila necesario para no recortar la imagen: 1 punto = 96/72 px.
const HEADER_ROW_HEIGHT_PT = Math.ceil(HEADER_IMG_H * 72 / 96) + 3;

/**
 * Rasteriza a PNG el mismo encabezado corporativo "Sistema de Gestión
 * Integrado" que se usa en pantalla y en el PDF (src/ui/encabezado-svg.js),
 * para incrustarlo como imagen en el Excel del maestro -- ExcelJS no sabe
 * dibujar SVG ni el corte diagonal directamente, así que se genera una vez
 * por exportación con el mismo SVG que usa el resto del sistema.
 *
 * Ojo con 3 detalles NO obvios (que no tiran error -- hay que mirar el
 * resultado para notarlos), encontrados al verificar esto en un browser real:
 *  1) encabezadoSvg() no trae width/height (solo viewBox): al decodificar
 *     ese SVG como Image() para dibujarlo en el canvas, el navegador le da
 *     un tamaño intrínseco muy chico por defecto (300x37) y se pierde
 *     nitidez/detalle del texto chico. Se fijan width/height explícitos
 *     antes de serializar.
 *  2) El <image> del logo, anidado DENTRO de ese SVG, no se pinta de forma
 *     confiable cuando el SVG se decodifica vía Image()+canvas (a diferencia
 *     de navegarlo como documento aparte, donde sí aparece). Se compone el
 *     logo aparte, dibujándolo como una 2da imagen sobre el mismo canvas.
 *  3) El font-family (Poppins/Arial, ver comprobante.css) vive en una hoja
 *     de estilos EXTERNA que no viaja al serializar solo el <svg> -- el
 *     texto cae al serif por defecto del navegador si no se fija como
 *     estilo inline (con el valor ya computado en el DOM real) antes de
 *     serializar.
 */
async function headerPngDataUri({ codigo, fecha, revision, titulo, logoSrc }) {
  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-99999px';
  holder.style.top = '0';
  holder.style.width = `${EH_ANCHO}px`;
  holder.innerHTML = encabezadoSvg({ codigo, fecha, revision, titulo });
  document.body.appendChild(holder);
  try {
    const svgEl = holder.querySelector('.eh-svg');
    if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* no bloquea */ } }
    ajustarTextosEncabezado(svgEl);

    svgEl.setAttribute('width', String(EH_ANCHO));
    svgEl.setAttribute('height', String(EH_ALTO));
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const textoRef = svgEl.querySelector('text');
    const fuente = textoRef ? getComputedStyle(textoRef).fontFamily : '';
    if (fuente) svgEl.style.fontFamily = fuente;

    const xml = new XMLSerializer().serializeToString(svgEl);
    const svgUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));

    const scale = 2; // 2x para que se vea nítido dentro del Excel
    const outW = EH_ANCHO * scale, outH = EH_ALTO * scale;
    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(await cargarImagen(svgUri), 0, 0, outW, outH);

    if (logoSrc) {
      try {
        const logoImg = await cargarImagen(logoSrc);
        ctx.drawImage(logoImg, EH_LOGO_X * scale, EH_LOGO_Y * scale, EH_LOGO_W * scale, EH_LOGO_H * scale);
      } catch (e) {
        console.warn('[solicitudes] no se pudo componer el logo en el encabezado del Excel', e);
      }
    }

    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(holder);
  }
}

/** "Maestro de solicitudes": exporta TODAS las solicitudes (los 6 tipos), con su
 * detalle y el detalle/tiempos de cada aprobación, a un Excel con el mismo
 * lenguaje visual del PDF y los correos -- colores de marca, logo, y el
 * Estado resaltado por color -- más el código de formulario propio de cada
 * tipo (misma tabla que usa el PDF, ver DOCUMENTO_CODIGOS en config.js).
 * Siempre trae el universo completo (no solo lo que está filtrado en pantalla). */
async function exportarMaestro() {
  const btn = document.getElementById('btn-maestro-excel');
  btn.disabled = true; btn.textContent = 'Generando...';
  try {
    const [sols, centros] = await Promise.all([Data.listTodasSolicitudes(), Data.listCentrosAdmin()]);
    const centrosMap = new Map(centros.map(c => [c.id, c]));
    const [trab, perfiles] = await Promise.all([
      Data.trabajadoresPorId(sols.map(s => s.trabajador_id)),
      Data.perfilesPorId(sols.flatMap(s => [s.solicitante_id, ...(s.aprobaciones || []).map(a => a.aprobador_id)]))
    ]);

    const maxAprob = Math.max(0, ...sols.map(s => (s.aprobaciones || []).length));
    const durTexto = (ms) => {
      if (ms == null || isNaN(ms)) return '';
      const h = ms / 3600000;
      if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
      if (h < 48) return (Math.round(h * 10) / 10) + ' h';
      return (Math.round((h / 24) * 10) / 10) + ' d';
    };

    // Definición de columnas (orden fijo) -- "Código de formulario" es nueva:
    // el código SGC (ej. RRH-FOR-CON-006) que le corresponde al tipo de esa fila.
    const columnas = [
      { header: 'Folio', width: 16, key: 'folio' },
      { header: 'N° de solicitud', width: 16, key: 'codigo' },
      { header: 'Tipo', width: 16, key: 'tipo' },
      { header: 'Código de formulario', width: 20, key: 'codigoFormulario' },
      { header: 'Estado', width: 12, key: 'estado' },
      { header: 'Solicitante', width: 22, key: 'solicitante' },
      { header: 'Trabajador', width: 22, key: 'trabajador' },
      { header: 'Centro origen', width: 20, key: 'centroOrigen' },
      { header: 'Centro destino', width: 20, key: 'centroDestino' },
      { header: 'Fecha de creación', width: 20, key: 'creada' },
      { header: 'Detalle', width: 55, key: 'detalle' },
      { header: 'Motivo', width: 28, key: 'motivo' },
    ];
    for (let i = 1; i <= maxAprob; i++) {
      columnas.push(
        { header: `Aprobador ${i}`, width: 20, key: `aprobador${i}` },
        { header: `Decisión ${i}`, width: 12, key: `decision${i}` },
        { header: `Asignado ${i}`, width: 20, key: `asignado${i}` },
        { header: `Decidido ${i}`, width: 20, key: `decidido${i}` },
        { header: `Tiempo respuesta ${i}`, width: 15, key: `tiempo${i}` },
      );
    }

    const filas = sols.map(s => {
      const aprobs = (s.aprobaciones || []).slice().sort((a, b) => a.orden - b.orden);
      const fila = {
        folio: s.folio || '',
        codigo: s.codigo || '',
        tipo: TIPO_SOLICITUD_META[s.tipo]?.label || s.tipo,
        codigoFormulario: DOCUMENTO_CODIGOS[s.tipo]?.codigo || '',
        estado: s.estado,
        solicitante: perfiles.get(s.solicitante_id)?.nombre || '',
        trabajador: trab.get(s.trabajador_id)?.nombre || '',
        centroOrigen: centrosMap.get(s.centro_origen_id)?.nombre || '',
        centroDestino: centrosMap.get(s.centro_destino_id)?.nombre || '',
        creada: s.created_at ? new Date(s.created_at).toLocaleString('es-CL') : '',
        detalle: detalleTexto(s),
        motivo: s.motivo || ''
      };
      for (let i = 1; i <= maxAprob; i++) {
        const a = aprobs[i - 1];
        const ms = a?.tiempo_respuesta != null
          ? a.tiempo_respuesta * 1000
          : (a?.decidido_at && a?.asignado_at ? new Date(a.decidido_at) - new Date(a.asignado_at) : null);
        fila[`aprobador${i}`] = a ? (perfiles.get(a.aprobador_id)?.nombre || '') : '';
        fila[`decision${i}`] = a ? a.decision : '';
        fila[`asignado${i}`] = a?.asignado_at ? new Date(a.asignado_at).toLocaleString('es-CL') : '';
        fila[`decidido${i}`] = a?.decidido_at ? new Date(a.decidido_at).toLocaleString('es-CL') : '';
        fila[`tiempo${i}`] = durTexto(ms);
      }
      return fila;
    });

    const hoy = new Date();
    const nCols = columnas.length;
    const estadoCol = columnas.findIndex(c => c.key === 'estado') + 1; // 1-based

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SSI-RRHH · Metalium';
    wb.created = hoy;
    const ws = wb.addWorksheet('Maestro de solicitudes', { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.columns = columnas.map(c => ({ width: c.width }));

    // ---- Fila 1: encabezado corporativo (mismo diseño que el PDF/pantalla,
    // ver headerPngDataUri arriba) ----
    ws.getRow(1).height = HEADER_ROW_HEIGHT_PT;
    try {
      const logo = await logoDataUriMaestro();
      const fecha = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
      const headerPng = await headerPngDataUri({
        codigo: MAESTRO_SOLICITUDES_CODIGO,
        fecha,
        revision: '00',
        titulo: 'Maestro de solicitudes',
        logoSrc: logo,
      });
      const imgId = wb.addImage({ base64: headerPng, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: HEADER_IMG_W, height: HEADER_IMG_H } });
    } catch (e) {
      // El maestro se exporta igual sin el encabezado -- nunca bloquea la descarga.
      console.warn('[solicitudes] no se pudo generar el encabezado corporativo del Excel', e);
    }

    // ---- Fila 2: cantidad de solicitudes ----
    // Sin fusionar y alineada a la izquierda (celda A2, bajo el logo): así
    // queda visible de entrada sin tener que desplazarse, sin importar
    // cuántas columnas de "Aprobador N" termine teniendo la planilla.
    const cCant = ws.getCell(2, 1);
    cCant.value = `${filas.length} solicitud(es)`;
    cCant.font = { italic: true, size: 9, color: { argb: XL_GRIS_ETIQUETA } };
    cCant.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(2).height = 16;

    // ---- Fila 3: encabezados de columna ----
    const headerRow = ws.getRow(3);
    columnas.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_AZUL } };
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    headerRow.height = 26;
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nCols } };

    // ---- Filas de datos: zebra + "Estado" resaltado por color ----
    filas.forEach((fila, idx) => {
      const r = ws.getRow(4 + idx);
      const zebra = idx % 2 === 1;
      columnas.forEach((c, i) => {
        const cell = r.getCell(i + 1);
        cell.value = fila[c.key] ?? '';
        cell.font = { size: 10, color: { argb: XL_GRIS_TEXTO } };
        cell.alignment = { vertical: 'top', wrapText: c.key === 'detalle' || c.key === 'motivo' };
        if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_ZEBRA } };
      });
      const ce = r.getCell(estadoCol);
      const { bg, fg } = estadoColorXl(fila.estado);
      ce.value = fila.estado ? fila.estado.charAt(0).toUpperCase() + fila.estado.slice(1) : '';
      ce.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      ce.font = { bold: true, size: 10, color: { argb: fg } };
      ce.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Maestro_Solicitudes_${hoy.toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    Toast.success('Maestro exportado', `${filas.length} solicitud(es).`);
  } catch (e) {
    console.error('[solicitudes] exportar maestro', e);
    Toast.error('Error', 'No se pudo generar el maestro de solicitudes.');
  } finally {
    btn.disabled = false; btn.textContent = 'Exportar maestro (Excel)';
  }
}

function wireDetalles(backView) {
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.nextElementSibling;
      const abierto = !panel.hidden;
      panel.hidden = abierto;
      btn.textContent = abierto ? 'Ver detalle ▾' : 'Ocultar detalle ▴';
    });
  });
  document.querySelectorAll('[data-comprobante]').forEach(btn => {
    btn.addEventListener('click', () => renderComprobante(_container, btn.dataset.comprobante, backView));
  });
}
