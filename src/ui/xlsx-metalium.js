/**
 * El formato común de los Excel del SGC: membrete, colores, tablas y pie.
 *
 * Existe porque hay más de un documento —el expediente individual y el maestro
 * del ciclo— y «el mismo estandarizado» tiene que ser literalmente el mismo
 * código, no dos copias que se parecen hoy y divergen en tres meses.
 *
 * Quien agregue un documento nuevo sólo escribe su contenido:
 *
 *     const { wb, sheet } = await nuevoLibro({ nombreHoja, cols, doc });
 *     ... filas ...
 *     ponerPie(sheet, doc);
 *     await descargar(wb, "nombre.xlsx");
 *
 * CONTROL DOCUMENTAL
 *
 * La numeración es RRH-FOR-EVA-NNN, con NNN correlativo dentro de la familia
 * EVA. Los códigos vigentes están en DOCS, abajo: es el único lugar donde se
 * escriben, para que no haya dos documentos con el mismo correlativo.
 */

import ExcelJS from "exceljs";
import { generarEncabezadoCorporativo, LETTERHEAD_ASPECT } from "./letterhead.js";
import { corregirAnclajeImagenes } from "./xlsx-anclaje.js";

export const NAVY = "FF0B1E5C";
export const ACCENT = "FF009BDB";
export const LIGHT = "FFF3F7FC";
export const BORDER = "FFE3E9F2";
export const GRAY_TEXT = "FF595959";
export const ALERTA_BG = "FFFDF2F2";
export const ALERTA_TXT = "FF7A1F1F";

/**
 * La confidencialidad sale de la hoja 01 · PORTADA de RRHHFOREVAAD001_v2:
 * «RESERVADO — Ley 19.628 y Ley 21.719. Uso restringido a RRHH, la jefatura
 * directa y Bienestar y Crecimiento».
 *
 * En el maestro es aún más pertinente que en el expediente individual: ahí va
 * la nómina completa con las notas de todo el mundo.
 */
const CONFIDENCIAL =
  "RESERVADO — Datos personales protegidos por la Ley 19.628 y la Ley 21.719. " +
  "Uso restringido a Recursos Humanos, la jefatura directa y Bienestar y Crecimiento. " +
  "No reenviar ni difundir fuera de ese ámbito.";

/** Correlativos vigentes de la familia EVA. Un código, un documento. */
export const DOCS = {
  expediente: {
    codigo: "RRH-FOR-EVA-001",
    titulo: "Evaluación de Desempeño",
    revision: "02",
    area: "RRH",
    confidencialidad: CONFIDENCIAL,
  },
  maestro: {
    codigo: "RRH-FOR-EVA-002",
    titulo: "Maestro del ciclo de evaluación",
    revision: "00",
    area: "RRH",
    confidencialidad:
      CONFIDENCIAL + " Contiene la nómina completa del ciclo con sus calificaciones.",
  },
};

/** dd/mm/aaaa, el formato del encabezado. */
export function hoy() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function fecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function fechaHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${fecha(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const clp = (v) => (v == null ? "—" : "$" + Number(v).toLocaleString("es-CL"));

// ---------------------------------------------------------------------------

export function bordeCelda(cell) {
  cell.border = {
    top: { style: "thin", color: { argb: BORDER } },
    bottom: { style: "thin", color: { argb: BORDER } },
    left: { style: "thin", color: { argb: BORDER } },
    right: { style: "thin", color: { argb: BORDER } },
  };
}

/** Banda azul marino de título de sección, a lo ancho de la tabla. */
export function filaSeccion(sheet, texto, ultimaCol) {
  const row = sheet.addRow([texto]);
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > ultimaCol) return;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
  });
  sheet.mergeCells(row.number, 1, row.number, ultimaCol);
  row.height = 22;
  return row;
}

/** Encabezado celeste de una tabla. */
export function filaEncabezado(sheet, celdas) {
  const row = sheet.addRow(celdas);
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > celdas.length) return;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER } } };
  });
  // Con wrapText, dos líneas de 10 pt no caben en 26.
  row.height = 30;
  return row;
}

/** Fila de datos con cebra y bordes. */
export function filaDato(sheet, celdas, i, ultimaCol = celdas.length) {
  const row = sheet.addRow(celdas);
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > ultimaCol) return;
    if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    cell.font = { size: 10 };
    // wrapText siempre: sin él, «El expediente ya avanzó, sin fecha registrada»
    // se corta a media frase en una columna de 22 y el lector no sabe que falta
    // texto — que es peor que verlo en dos líneas.
    cell.alignment = { vertical: "middle", wrapText: true };
    bordeCelda(cell);
  });
  return row;
}

/** Par etiqueta / valor, con el valor combinado hasta el final de la tabla. */
export function filaEtiqueta(sheet, label, valor, ultimaCol, destacado = false) {
  const row = sheet.addRow([label, valor]);
  row.getCell(1).font = { bold: true, size: 10, color: { argb: GRAY_TEXT } };
  row.getCell(2).font = destacado
    ? { bold: true, size: 11, color: { argb: NAVY } }
    : { size: 10 };
  // Sin esto, un número queda alineado a la derecha del bloque combinado y
  // aparece a media hoja de su etiqueta.
  row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  sheet.mergeCells(row.number, 2, row.number, ultimaCol);
  bordeCelda(row.getCell(1));
  bordeCelda(row.getCell(2));
  return row;
}

// ---------------------------------------------------------------------------

/**
 * Crea el libro con el membrete puesto en la primera fila.
 *
 * @param {object} o
 * @param {string} o.nombreHoja
 * @param {number[]} o.cols   Anchos en caracteres. De ellos sale el ancho del
 *                            membrete, así que se fijan una sola vez.
 * @param {object} o.doc      Una entrada de DOCS.
 */
export async function nuevoLibro({ nombreHoja, cols, doc, orientacion = "portrait" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SGC Metalium";
  wb.created = new Date();

  const sheet = wb.addWorksheet(nombreHoja, {
    pageSetup: { paperSize: 9, orientation: orientacion, fitToPage: true, fitToWidth: 1 },
  });
  sheet.columns = cols.map((width) => ({ width }));

  const blob = await generarEncabezadoCorporativo({
    titulo: doc.titulo,
    codigo: doc.codigo,
    fecha: hoy(),
    revision: doc.revision,
    area: doc.area,
  });
  const imgId = wb.addImage({ buffer: await blob.arrayBuffer(), extension: "png" });

  // Ancho de una columna de Excel en píxeles: ancho_en_caracteres × 7 + 5.
  const anchoImg = cols.reduce((t, w) => t + w * 7 + 5, 0);
  const altoImg = Math.round(anchoImg / LETTERHEAD_ASPECT);
  sheet.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: anchoImg, height: altoImg } });
  // La altura de fila va en puntos, no en píxeles: 1 px = 0,75 pt.
  sheet.getRow(1).height = Math.round(altoImg * 0.75);
  sheet.addRow([]);

  return { wb, sheet, ultimaCol: cols.length };
}

/** Pie de control documental y confidencialidad, en la hoja y en la impresión. */
export function ponerPie(sheet, doc, ultimaCol) {
  sheet.addRow([]);

  const pieDoc = sheet.addRow([
    `${doc.codigo} · revisión ${doc.revision} · ${doc.area} · Emitido el ${hoy()} desde SGC Metalium`,
  ]);
  sheet.mergeCells(pieDoc.number, 1, pieDoc.number, ultimaCol);
  pieDoc.getCell(1).font = { size: 9, bold: true, color: { argb: NAVY } };
  pieDoc.getCell(1).alignment = { vertical: "middle" };

  const pieConf = sheet.addRow([doc.confidencialidad]);
  sheet.mergeCells(pieConf.number, 1, pieConf.number, ultimaCol);
  pieConf.getCell(1).font = { size: 9, color: { argb: ALERTA_TXT } };
  pieConf.getCell(1).alignment = { wrapText: true, vertical: "top" };
  pieConf.height = 42;
  pieConf.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALERTA_BG } };
  pieConf.getCell(1).border = { left: { style: "medium", color: { argb: ALERTA_TXT } } };

  // La misma advertencia impresa: quien imprime el documento y lo deja sobre un
  // escritorio no ve la celda de arriba.
  sheet.headerFooter.oddFooter =
    `&L&"Poppins,Regular"&8${doc.codigo} · rev. ${doc.revision}` +
    `&C&8RESERVADO · Ley 19.628 y Ley 21.719&R&8Página &P de &N`;
}

/**
 * Escribe el archivo y lo descarga.
 *
 * El paso por corregirAnclajeImagenes() no es opcional: sin él Excel descarta el
 * membrete y el documento sale sin encabezado, sin avisar. Ver xlsx-anclaje.js.
 */
export async function descargar(wb, nombreArchivo) {
  const buffer = await corregirAnclajeImagenes(await wb.xlsx.writeBuffer());
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
