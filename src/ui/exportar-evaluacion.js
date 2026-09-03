/**
 * Exporta el expediente de una evaluación de personal a un .xlsx con la
 * identidad corporativa Metalium.
 *
 * Los datos de control documental NO son inventados: salen de la hoja
 * 01 · PORTADA de RRHHFOREVAAD001_v2, que dice literalmente
 *
 *   «RRHH-FOR-EVA-AD-001 · v2.0 (revisión 02) — agosto 2026»
 *   «RESERVADO — Ley 19.628 y Ley 21.719. Uso restringido a RRHH, la jefatura
 *    directa y Bienestar y Crecimiento»
 *
 * Esa segunda línea es la razón por la que el archivo lleva pie de página. El
 * documento contiene datos personales de un trabajador y su tratamiento está
 * regulado; un expediente que sale del sistema sin decirlo es un expediente que
 * alguien reenvía sin pensarlo.
 *
 * QUIÉN LO DESCARGA
 *
 * Tres pantallas usan este módulo: la lista de RRHH, la pantalla «Tu
 * evaluación» del propio trabajador y su Ficha. Para que las tres no repitan la
 * consulta, `cargarExpediente()` vive acá y devuelve todo armado.
 */

import { supabase } from "../core/supabase.js";
import {
  DOCS, NAVY, LIGHT, GRAY_TEXT,
  nuevoLibro, filaSeccion, filaEncabezado, filaEtiqueta, ponerPie, descargar,
  hoy, fechaHora, bordeCelda,
} from "./xlsx-metalium.js";
// personal-flujo.js es sólo constantes, sin imports ni DOM: es la fuente única
// de las etiquetas del flujo. Duplicarlas acá sería el camino seguro a que un
// día el Excel diga «satisfactorio» y la pantalla «Satisfactorio».
import { CATEGORIA_LABELS, ESTADO_LABELS } from "../views/personal-flujo.js";

// El control documental vive en xlsx-metalium.js, junto al correlativo de los
// demás documentos de la familia EVA: un código, un documento.
const DOC = DOCS.expediente;

const ROL_FIRMA = {
  trabajador: "Trabajador evaluado",
  supervisor: "Jefatura directa",
  rrhh: "Recursos Humanos",
  bienestar: "Bienestar y Crecimiento",
};

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

let catalogoCache = null;
async function catalogo() {
  if (catalogoCache) return catalogoCache;
  const [{ data: dimensiones }, { data: criterios }] = await Promise.all([
    supabase.from("eva_dimensiones").select("codigo, nombre, peso, orden").order("peso", { ascending: false }),
    supabase.from("eva_criterios").select("codigo, texto_criterio, dimension_codigo, orden").order("orden"),
  ]);
  catalogoCache = { dimensiones: dimensiones || [], criterios: criterios || [] };
  return catalogoCache;
}

/**
 * Trae todo lo que el expediente necesita. Lo que la persona no tenga permiso
 * de ver simplemente vuelve vacío por RLS — no revienta.
 */
export async function cargarExpediente(evaluacionId) {
  const [{ dimensiones, criterios }, resEv, resAuto, resSup, resFirmas] = await Promise.all([
    catalogo(),
    supabase
      .from("eva_evaluaciones")
      .select("*, evaluado:evaluado_id(nombre), evaluador:evaluador_id(nombre), ciclo:ciclo_id(titulo, tipo_periodo)")
      .eq("id", evaluacionId)
      .single(),
    supabase.from("eva_detalle_auto").select("*").eq("evaluacion_id", evaluacionId),
    supabase.from("eva_detalle_sup").select("*").eq("evaluacion_id", evaluacionId),
    supabase.from("eva_firmas").select("*").eq("evaluacion_id", evaluacionId).order("firmado_en"),
  ]);

  if (resEv.error) throw resEv.error;

  const detalleAuto = {};
  (resAuto.data || []).forEach((d) => (detalleAuto[d.criterio_codigo] = d));
  const detalleSup = {};
  (resSup.data || []).forEach((d) => (detalleSup[d.criterio_codigo] = d));

  return {
    evaluacion: resEv.data,
    dimensiones,
    criterios,
    detalleAuto,
    detalleSup,
    firmas: resFirmas.data || [],
  };
}

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------

export async function exportarEvaluacionExcel({ evaluacion, dimensiones, criterios, detalleAuto, detalleSup, firmas = [] }) {
  // El membrete, los anchos y la corrección del anclaje los pone el módulo
  // común: es lo que hace que este documento y el maestro sean literalmente el
  // mismo formato y no dos que se parecen.
  const COLS = [28, 38, 15, 14, 33];
  const { wb, sheet, ultimaCol } = await nuevoLibro({ nombreHoja: "Evaluación", cols: COLS, doc: DOC });

  // -------------------------------------------------------------------------
  filaSeccion(sheet, "DATOS DEL TRABAJADOR", ultimaCol);

  const datos = [
    ["Nombre", evaluacion.evaluado?.nombre || "—"],
    ["Cargo", evaluacion.cargo_actual || "—"],
    ["RUT", evaluacion.rut || "—"],
    ["Fecha de ingreso", evaluacion.fecha_ingreso || "—"],
    ["Centro de trabajo", evaluacion.centro_trabajo || "—"],
    ["Ciclo evaluado", evaluacion.ciclo?.titulo || "—"],
    ["Evaluador", evaluacion.evaluador?.nombre || "—"],
    ["Cargo del evaluador", evaluacion.cargo_evaluador || "—"],
  ];
  datos.forEach(([label, valor]) => filaEtiqueta(sheet, label, valor, ultimaCol));
  sheet.addRow([]);

  // -------------------------------------------------------------------------
  filaSeccion(sheet, "RESULTADOS POR DIMENSIÓN", ultimaCol);

  // Etiquetas cortas: «Prom. Autoevaluación» en una columna de 13 caracteres se
  // corta a media palabra, y el encabezado recortado es peor que el abreviado.
  filaEncabezado(sheet, ["Dimensión", "Peso", "Autoevaluación", "Evaluador", "Brecha"]);

  dimensiones.forEach((dim, i) => {
    const codigoDim = dim.codigo.toLowerCase();
    const promAuto = evaluacion[`prom_auto_${codigoDim}`];
    const promSup = evaluacion[`prom_sup_${codigoDim}`];
    const brecha = evaluacion[`brecha_${codigoDim}`];
    const r = sheet.addRow([
      dim.nombre,
      `${Math.round(dim.peso * 100)}%`,
      promAuto ?? "—",
      promSup ?? "—",
      brecha ?? "—",
    ]);
    if (i % 2 === 1) {
      r.eachCell({ includeEmpty: true }, (c, col) => {
        if (col <= 5) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
      });
    }
    r.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 5) bordeCelda(c);
    });
    r.getCell(1).font = { size: 10 };
    r.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    [2, 3, 4, 5].forEach((col) => {
      r.getCell(col).alignment = { horizontal: "center", vertical: "middle" };
    });
  });
  sheet.addRow([]);

  // -------------------------------------------------------------------------
  filaSeccion(sheet, "RESULTADO FINAL", ultimaCol);

  const finales = [
    ["Total Autoevaluación", evaluacion.total_auto ?? "—"],
    ["Total Evaluación", evaluacion.total_sup ?? "—"],
    ["Brecha Total", evaluacion.brecha_total ?? "—"],
    // La categoría se guarda como 'por_debajo' o 'satisfactorio': el valor
    // interno no va en un documento que firma una persona.
    ["Categoría", CATEGORIA_LABELS[evaluacion.categoria] || evaluacion.categoria || "—"],
    ["Decisión asociada", evaluacion.decision_asociada ?? "—"],
    ["Estado del expediente", ESTADO_LABELS[evaluacion.estado] || evaluacion.estado || "—"],
  ];
  finales.forEach(([label, valor]) => filaEtiqueta(sheet, label, valor, ultimaCol, true));
  sheet.addRow([]);

  // -------------------------------------------------------------------------
  filaSeccion(sheet, "DETALLE POR CRITERIO", ultimaCol);

  filaEncabezado(sheet, ["Dimensión", "Criterio", "Nota Auto", "Nota Sup", "Comentario del evaluador"]);

  dimensiones.forEach((dim) => {
    const criteriosDim = criterios.filter((c) => c.dimension_codigo === dim.codigo);
    criteriosDim.forEach((c, i) => {
      const auto = detalleAuto?.[c.codigo];
      const sup = detalleSup?.[c.codigo];
      const r = sheet.addRow([
        dim.nombre,
        c.texto_criterio,
        auto?.nota ?? "—",
        sup?.nota ?? "—",
        sup?.comentario_evidencia || auto?.comentario || "",
      ]);
      if (i % 2 === 1) {
        r.eachCell({ includeEmpty: true }, (cell, col) => {
          if (col <= 5) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
        });
      }
      r.getCell(1).alignment = { wrapText: true, vertical: "middle" };
      r.getCell(2).alignment = { wrapText: true, vertical: "middle" };
      r.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(5).alignment = { wrapText: true, vertical: "middle" };
      r.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col <= 5) bordeCelda(cell);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Firmas. Sólo si hay alguna: una sección de firmas vacía en un expediente
  // todavía abierto se lee como que faltan, no como que no corresponden aún.
  if (firmas.length) {
    sheet.addRow([]);
    filaSeccion(sheet, "ACTA DE CIERRE · FIRMAS REGISTRADAS", ultimaCol);

    filaEncabezado(sheet, ["Rol", "Nombre declarado", "RUT", "Fecha y hora", "Declaración"]);

    firmas.forEach((f, i) => {
      const r = sheet.addRow([
        ROL_FIRMA[f.rol_firmante] || f.rol_firmante,
        f.nombre_declarado || "—",
        f.rut_declarado || "—",
        fechaHora(f.firmado_en),
        f.declaracion_texto || "",
      ]);
      if (i % 2 === 1) {
        r.eachCell({ includeEmpty: true }, (cell, col) => {
          if (col <= 5) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
        });
      }
      // La declaración son ~10 líneas envueltas. Sin alineación superior en
      // TODAS las celdas, el rol y el nombre quedan pegados al fondo de la fila
      // y no se lee a quién pertenece la declaración de al lado.
      r.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col > 5) return;
        cell.alignment = { wrapText: true, vertical: "top" };
        cell.font = { size: 9 };
        bordeCelda(cell);
      });
      r.getCell(1).font = { size: 9, bold: true };
    });

    if (firmas.length < 4) {
      const faltan = sheet.addRow([
        `Acta incompleta: ${firmas.length} de 4 firmas. Faltan ` +
          Object.keys(ROL_FIRMA)
            .filter((rol) => !firmas.some((f) => f.rol_firmante === rol))
            .map((rol) => ROL_FIRMA[rol])
            .join(", ") +
          ".",
      ]);
      sheet.mergeCells(faltan.number, 1, faltan.number, 5);
      faltan.getCell(1).font = { size: 9, italic: true, color: { argb: GRAY_TEXT } };
      faltan.getCell(1).alignment = { wrapText: true, vertical: "middle" };
      faltan.height = 20;
    }
  }

  ponerPie(sheet, DOC, ultimaCol);

  const persona = (evaluacion.evaluado?.nombre || "trabajador").replace(/\s+/g, "_");
  const ciclo = (evaluacion.ciclo?.titulo || "").replace(/\s+/g, "_");
  await descargar(wb, `${DOC.codigo}_${persona}${ciclo ? "_" + ciclo : ""}.xlsx`);
}

/**
 * Atajo para las pantallas: carga y genera de una vez. Devuelve el nombre de la
 * persona para poder decirlo en el aviso de éxito.
 */
export async function descargarExpediente(evaluacionId) {
  const datos = await cargarExpediente(evaluacionId);
  await exportarEvaluacionExcel(datos);
  return datos.evaluacion.evaluado?.nombre || null;
}
