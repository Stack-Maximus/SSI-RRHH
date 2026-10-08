/**
 * Excel con el diseño "Concept 3" (mismo diseño que los PDF del SGC).
 *
 * Cada hoja se arma así:
 *  - Arriba, UNA imagen con el encabezado (logo, panel azul, tarjeta de
 *    Código/Fecha/Revisión), la sección 1 con sus fichas y la barra de la
 *    sección de la tabla. Se dibuja con el mismo motor que el PDF
 *    (supabase/functions/_shared/sgc-layout.js) y las mismas tipografías,
 *    así que es idéntica al documento PDF.
 *  - Debajo, la tabla como CELDAS REALES (se puede filtrar, ordenar, copiar
 *    y volver a importar): fila de títulos azul con degradado e íconos,
 *    filas cebra, "píldora" para el estado, bordes finos.
 *  - Al final, el pie (línea con acento cian + METALIUM | código | nombre)
 *    como imagen, y el mismo pie con "Página X de N" en la impresión.
 *
 * Uso:
 *   const wb = nuevoLibroSgc();
 *   await hojaSgc(wb, { nombreHoja, doc, columnas, filas });
 *   await descargarLibroSgc(wb, 'archivo.xlsx');
 *
 * doc = { encabezado:{titulo,codigo,fecha,revision}, pie:{codigo,nombre},
 *         secciones:[ {titulo, fichas:[...]} ..., {titulo, tabla:true} ] }
 * columnas = [{ titulo, icono, px, alinear:'centro'|'izq', estilo:
 *   'numero'|'fuerte'|'normal'|'pildora', numFmt }]
 *
 * Las imágenes van con anclaje de una celda (conservan su tamaño en px) y
 * el archivo pasa por corregirAnclajeImagenes() -- ver xlsx-anclaje.js: sin
 * ese paso Excel descarta las imágenes sin avisar.
 */

import ExcelJS from 'exceljs';
import { componerCabecera, pie as piePrims, PAL, TABLA } from '../../supabase/functions/_shared/sgc-layout.js';
import { asegurarFuentes, medidor, pngDeRegion, pngDeIcono } from './sgc-render.js';
import { corregirAnclajeImagenes } from './xlsx-anclaje.js';

const EMU = 9525; // EMU por píxel
const MARGEN_PX = 22; // columnas A y final (margen de la "hoja")
const FUENTE_CELDAS = 'Segoe UI';
const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase();
const pxAPt = (px) => Math.round(px * 0.75 * 100) / 100;

// Degradado de la fila de títulos (el mismo de encabezadoTabla en sgc-layout.js)
const DEGRADADO_TITULOS = [[0, '#003174'], [0.72, '#00357B'], [0.87, '#0058A6'], [1, '#0A7FC3']];
function colorEn(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [o0, c0] = stops[i], [o1, c1] = stops[i + 1];
    if (t <= o1) {
      const f = (t - o0) / ((o1 - o0) || 1);
      const a = c0.replace('#', ''), b = c1.replace('#', '');
      const mezcla = [0, 2, 4].map((j) => {
        const v = Math.round(parseInt(a.slice(j, j + 2), 16) * (1 - f) + parseInt(b.slice(j, j + 2), 16) * f);
        return v.toString(16).padStart(2, '0');
      }).join('');
      return '#' + mezcla.toUpperCase();
    }
  }
  return stops[stops.length - 1][1];
}

// Medición de texto de celdas (para el alto de cada fila con texto largo).
let ctxCeldas = null;
function anchoTextoCelda(txt, pt, negrita) {
  if (!ctxCeldas) ctxCeldas = document.createElement('canvas').getContext('2d');
  ctxCeldas.font = `${negrita ? 700 : 400} ${pt * 4 / 3}px "${FUENTE_CELDAS}", "Segoe UI", Arial, sans-serif`;
  return ctxCeldas.measureText(txt).width * 1.06; // margen por diferencias de fuente
}
function lineasCelda(txt, pt, negrita, anchoPx) {
  let n = 0;
  for (const parrafo of String(txt ?? '').split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) { n++; continue; }
    let linea = '';
    let k = 1;
    for (const p of palabras) {
      const prueba = linea ? linea + ' ' + p : p;
      if (linea && anchoTextoCelda(prueba, pt, negrita) > anchoPx) { k++; linea = p; } else linea = prueba;
    }
    n += k;
  }
  return Math.max(1, n);
}

export function nuevoLibroSgc() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SSI-RRHH · Metalium';
  wb.created = new Date();
  return wb;
}

const escFooter = (t) => String(t ?? '').replace(/&/g, '&&');

/**
 * Agrega una hoja con el diseño. Devuelve { sheet, filaTitulos, primeraFila,
 * ultimaFila, columnaInicial } (filas/columnas 1-based de ExcelJS).
 *
 * Opciones extra:
 *  - filasVacias: n filas vacías con el formato de la tabla (plantillas).
 *  - conPie: dibuja el pie como imagen bajo la tabla (por defecto true).
 *  - autofiltro: (por defecto true).
 *  - validaciones: [{ columna (índice 0-based), lista: [...] }] -- listas
 *    desplegables en las filas de datos (y en las vacías).
 *  - vacia: texto de la fila única cuando no hay registros.
 */
export async function hojaSgc(wb, { nombreHoja, doc, columnas, filas, filasVacias = 0, conPie = true, autofiltro = true, validaciones = [], vacia = 'Sin registros.' }) {
  await asegurarFuentes();
  const medir = medidor();

  // ---- Anchos: la tabla define la escala k (px por u del concepto) ----
  let anchos = columnas.map((c) => c.px);
  let W = anchos.reduce((a, b) => a + b, 0);
  const MIN_W = TABLA.w * 0.8;
  if (W < MIN_W) { anchos = anchos.map((w) => Math.round(w * MIN_W / W)); W = anchos.reduce((a, b) => a + b, 0); }
  // La cabecera se escala para que su ancho coincida con el de la tabla, como
  // en el concepto (hasta 1,3x). Una tabla más ancha que eso (ej. el maestro
  // de solicitudes, con las columnas de cada aprobador) deja la cabecera a
  // escala 1 y sigue hacia la derecha.
  const k = W / TABLA.w > 1.3 ? 1 : Math.max(0.8, W / TABLA.w);
  const ptDato = Math.min(11, Math.round((10 + (k - 0.8) * 4) * 2) / 2);   // 10 a 11 pt
  const ptTitulo = ptDato;

  const sheet = wb.addWorksheet(nombreHoja, {
    views: [{ showGridLines: false, zoomScale: 100 }],
    properties: { tabColor: { argb: argb('#003174') } },
  });
  const nCols = columnas.length;
  const colIni = 2; // la tabla empieza en B (A es margen)
  sheet.getColumn(1).width = MARGEN_PX / 7;
  anchos.forEach((px, i) => { sheet.getColumn(colIni + i).width = px / 7; });
  sheet.getColumn(colIni + nCols).width = MARGEN_PX / 7;

  const imagenes = new Map();
  const idImagen = async (clave, generar) => {
    if (!imagenes.has(clave)) imagenes.set(clave, wb.addImage({ base64: await generar(), extension: 'png' }));
    return imagenes.get(clave);
  };
  // x en u del concepto -> desplazamiento dentro de la columna A, de modo que
  // TABLA.x (38,5 u) caiga justo donde empieza la columna B.
  const anclaX = (x0u) => Math.round((MARGEN_PX - (TABLA.x - x0u) * k) * EMU);

  // ---- 1) Cabecera como imagen ----
  const { prims, yTabla } = componerCabecera(doc, medir);
  const X0 = 26, X1 = 1392, Y0 = 34;
  const cab = await pngDeRegion(prims, { x0: X0, y0: Y0, x1: X1, y1: yTabla, escala: k, fondo: PAL.fondo });
  const idCab = wb.addImage({ base64: cab.dataUrl, extension: 'png' });
  sheet.addImage(idCab, { tl: { nativeCol: 0, nativeColOff: anclaX(X0), nativeRow: 0, nativeRowOff: 0 }, ext: { width: cab.ancho, height: cab.alto }, editAs: 'oneCell' });
  // filas que ocupa la imagen (Excel limita cada fila a 409 pt)
  let fila = 1;
  let resto = cab.alto;
  while (resto > 0) {
    const px = Math.min(resto, 400);
    sheet.getRow(fila).height = pxAPt(px);
    resto -= px; fila++;
  }

  // ---- 2) Fila de títulos ----
  const filaTitulos = fila;
  const altoTitulos = Math.round(TABLA.hHead * k);
  const rT = sheet.getRow(filaTitulos);
  rT.height = pxAPt(altoTitulos);
  const iconoPx = Math.round(24 * k);
  const iconoX = Math.round(10 * k);
  let xAcum = 0;
  for (let i = 0; i < nCols; i++) {
    const c = columnas[i];
    const cell = rT.getCell(colIni + i);
    const t0 = xAcum / W, t1 = (xAcum + anchos[i]) / W;
    xAcum += anchos[i];
    cell.value = c.titulo;
    cell.fill = { type: 'gradient', gradient: 'angle', degree: 0, stops: [
      { position: 0, color: { argb: argb(colorEn(DEGRADADO_TITULOS, t0)) } },
      { position: 1, color: { argb: argb(colorEn(DEGRADADO_TITULOS, t1)) } },
    ] };
    cell.font = { name: FUENTE_CELDAS, size: ptTitulo, bold: true, color: { argb: 'FFFFFFFF' } };
    // indent: cada nivel son 3 espacios de la fuente normal (~10 px en Excel)
    const indentTitulo = Math.ceil((iconoX + iconoPx + 8) / 10);
    const conIcono = !!c.icono && anchos[i] >= indentTitulo * 10 + 45;
    cell.alignment = conIcono
      ? { vertical: 'middle', horizontal: 'left', wrapText: true, indent: indentTitulo }
      : { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = i > 0 ? { left: { style: 'thin', color: { argb: argb('#2D6AA1') } } } : {};
    if (conIcono) {
      const id = await idImagen('icono:' + c.icono, () => pngDeIcono(c.icono, { px: iconoPx, color: '#FFFFFF', sw: 1.9 }));
      sheet.addImage(id, {
        tl: { nativeCol: colIni - 1 + i, nativeColOff: iconoX * EMU, nativeRow: filaTitulos - 1, nativeRowOff: Math.round((altoTitulos - iconoPx) / 2) * EMU },
        ext: { width: iconoPx, height: iconoPx }, editAs: 'oneCell',
      });
    }
  }

  // ---- 3) Filas de datos ----
  const altoMin = Math.round(56 * k);
  const lhPx = ptDato * 4 / 3 * 1.36;
  const indentDato = k >= 1 ? 2 : 1; // ~10 px por nivel
  const bordeV = { style: 'thin', color: { argb: argb(PAL.lineaTabla) } };
  const bordeExt = { style: 'thin', color: { argb: argb('#DCE5EE') } };
  const totalFilas = filas.length + filasVacias;
  const primeraFila = filaTitulos + 1;
  for (let r = 0; r < totalFilas; r++) {
    const valores = filas[r] || null;
    const row = sheet.getRow(primeraFila + r);
    const fondo = r % 2 === 1 ? PAL.filaAlterna : PAL.blanco;
    let lineas = 1;
    for (let i = 0; i < nCols; i++) {
      const c = columnas[i];
      const cell = row.getCell(colIni + i);
      const v = valores ? valores[i] : null;
      if (valores) cell.value = v == null || v === '' ? (c.vacio ?? '') : v;
      const negrita = c.estilo === 'fuerte' || c.estilo === 'numero' || c.estilo === 'pildora';
      const color = c.estilo === 'normal' || !c.estilo ? PAL.texto : c.estilo === 'numero' ? '#1A396C' : c.estilo === 'pildora' ? PAL.pildoraTexto : PAL.navy;
      cell.font = { name: FUENTE_CELDAS, size: ptDato, bold: negrita, color: { argb: argb(color) } };
      const centro = c.alinear === 'centro' || c.estilo === 'pildora';
      cell.alignment = centro
        ? { vertical: 'middle', horizontal: 'center', wrapText: true }
        : { vertical: 'middle', horizontal: 'left', wrapText: true, indent: indentDato };
      const fondoCelda = c.estilo === 'pildora' && valores && v != null && v !== '' ? PAL.pildora : fondo;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fondoCelda) } };
      if (c.numFmt) cell.numFmt = c.numFmt;
      const ultima = r === totalFilas - 1;
      cell.border = {
        left: i === 0 ? bordeExt : bordeV,
        right: i === nCols - 1 ? bordeExt : undefined,
        bottom: ultima ? bordeExt : undefined,
      };
      if (valores && v != null && v !== '') {
        const txt = typeof v === 'number' && c.numFmt ? v.toLocaleString('es-CL') : String(v);
        const disponible = anchos[i] - (centro ? 12 : indentDato * 10 + 10);
        lineas = Math.max(lineas, lineasCelda(txt, ptDato, negrita, disponible));
      }
    }
    row.height = pxAPt(Math.max(altoMin, Math.ceil(lineas * lhPx + 2 * Math.round(15 * k))));
  }
  let ultimaFila = primeraFila + Math.max(totalFilas, 1) - 1;
  if (!totalFilas) {
    // tabla vacía: una fila con el mensaje centrado a lo ancho
    const row = sheet.getRow(primeraFila);
    sheet.mergeCells(primeraFila, colIni, primeraFila, colIni + nCols - 1);
    const cell = row.getCell(colIni);
    cell.value = vacia;
    cell.font = { name: FUENTE_CELDAS, size: ptDato, color: { argb: argb(PAL.pieTexto) } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    cell.border = { left: bordeExt, right: bordeExt, bottom: bordeExt };
    row.height = pxAPt(altoMin);
  }

  // Listas desplegables
  for (const { columna, lista } of validaciones) {
    const letra = sheet.getColumn(colIni + columna).letter;
    const hasta = Math.max(ultimaFila, primeraFila + 499);
    for (let r = primeraFila; r <= hasta; r++) {
      sheet.getCell(`${letra}${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`"${lista.join(',')}"`],
        showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Valor no reconocido',
        error: `Use uno de: ${lista.join(' / ')}`,
      };
    }
  }

  // ---- 4) Pie como imagen ----
  let filaFin = ultimaFila;
  if (conPie) {
    const filaHueco = ultimaFila + 1;
    sheet.getRow(filaHueco).height = pxAPt(Math.round(24 * k));
    const altoRef = 200;
    const pPie = piePrims(doc.pie.codigo, doc.pie.nombre, 1, 1, medir, altoRef, false);
    const yl = altoRef - 93;
    const img = await pngDeRegion(pPie, { x0: X0, y0: yl - 12, x1: X1, y1: yl + 50, escala: k, fondo: PAL.fondo });
    const id = wb.addImage({ base64: img.dataUrl, extension: 'png' });
    const filaPie = filaHueco + 1;
    sheet.getRow(filaPie).height = pxAPt(img.alto);
    sheet.addImage(id, { tl: { nativeCol: 0, nativeColOff: anclaX(X0), nativeRow: filaPie - 1, nativeRowOff: 0 }, ext: { width: img.ancho, height: img.alto }, editAs: 'oneCell' });
    filaFin = filaPie;
  }

  // ---- 5) Fondo de la "hoja" (gris muy claro del concepto) ----
  const ultimaCol = colIni + nCols;
  const filaFondoFin = filaFin + 1;
  sheet.getRow(filaFondoFin).height = pxAPt(Math.round(18 * k));
  for (let r = 1; r <= filaFondoFin; r++) {
    const row = sheet.getRow(r);
    for (let cI = 1; cI <= ultimaCol; cI++) {
      const cell = row.getCell(cI);
      if (!cell.fill || cell.fill.type === undefined) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PAL.fondo) } };
    }
  }

  // ---- 6) Impresión ----
  if (autofiltro && filas.length) {
    sheet.autoFilter = { from: { row: filaTitulos, column: colIni }, to: { row: filaTitulos, column: colIni + nCols - 1 } };
  }
  const ultimaLetra = sheet.getColumn(ultimaCol).letter;
  const muyAncha = W > 2600; // ajustada a una hoja quedaría ilegible
  sheet.pageSetup = {
    paperSize: 9,
    orientation: W > 1500 ? 'landscape' : 'portrait',
    ...(muyAncha ? { fitToPage: false, scale: 55 } : { fitToPage: true, fitToWidth: 1, fitToHeight: 0 }),
    horizontalCentered: true,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.55, header: 0.2, footer: 0.25 },
    // el pie-imagen queda fuera del área de impresión: al imprimir, el pie
    // (con el número de página) lo pone el pie de página de Excel, en cada hoja
    printArea: `A1:${ultimaLetra}${ultimaFila + 1}`,
    printTitlesRow: `${filaTitulos}:${filaTitulos}`,
  };
  sheet.headerFooter = {
    oddFooter: `&L&"${FUENTE_CELDAS},Bold"&8&K00417DMETALIUM&"${FUENTE_CELDAS},Regular"&K9AB0C8 | &K557AA2${escFooter(doc.pie.codigo)}&K9AB0C8 | &K557AA2${escFooter(doc.pie.nombre)}` +
      `&R&"${FUENTE_CELDAS},Regular"&8&K557AA2Página &P de &N`,
  };

  return { sheet, filaTitulos, primeraFila, ultimaFila, columnaInicial: colIni };
}

/** Escribe el libro (con el anclaje de imágenes corregido) y lo descarga. */
export async function descargarLibroSgc(wb, nombreArchivo) {
  const buffer = await corregirAnclajeImagenes(await wb.xlsx.writeBuffer());
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
