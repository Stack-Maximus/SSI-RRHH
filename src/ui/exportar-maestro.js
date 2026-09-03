/**
 * Maestro del ciclo de evaluación · RRH-FOR-EVA-002
 *
 * El expediente individual responde «cómo le fue a esta persona». Este responde
 * «cómo va el ciclo, y quién no ha hecho lo suyo».
 *
 * EL ORDEN NO ES DECORATIVO
 *
 * Lo primero que aparece después del resumen es la lista de quienes NO se
 * autoevaluaron. Es lo único del documento sobre lo que se puede actuar hoy: el
 * resto es fotografía. Si fuera al final, detrás de la nómina completa, nadie la
 * miraría — que es exactamente lo que pasa con los informes que empiezan por los
 * totales.
 *
 * Cada fila de esa lista trae los días que lleva habilitado el período y el
 * nombre de su jefatura, porque «falta» no mueve a nadie y «falta hace 25 días,
 * y su jefe es fulano» sí.
 *
 * CÓMO SE SABE QUIÉN NO SE AUTOEVALUÓ
 *
 * No por la fecha de envío: ese campo viene vacío en filas que sí tienen
 * autoevaluación (ver el comentario de migracion_eva_maestro_ciclo.sql, con los
 * números medidos). Se decide por evidencia y la base devuelve `como_consta`
 * diciendo cómo lo supo. Las filas que digan «sin fecha registrada» aparecen
 * marcadas: el dato existe pero incompleto, y conviene arreglarlo.
 */

import { supabase } from "../core/supabase.js";
import {
  DOCS, NAVY, LIGHT, ALERTA_BG, ALERTA_TXT, GRAY_TEXT,
  nuevoLibro, filaSeccion, filaEncabezado, filaDato, filaEtiqueta, ponerPie, descargar,
  fecha, bordeCelda,
} from "./xlsx-metalium.js";
import { CATEGORIA_LABELS, ESTADO_LABELS } from "../views/personal-flujo.js";

const n2 = (v) => (v == null ? "—" : Number(v).toFixed(2).replace(".", ","));

const ACUERDO = {
  conforme: "Conforme",
  parcialmente: "Parcialmente",
  no_conforme: "No conforme",
};

export async function cargarMaestro(cicloId) {
  const [{ data: filas, error: e1 }, { data: resumen, error: e2 }] = await Promise.all([
    supabase.rpc("eva_maestro_ciclo", { p_ciclo_id: cicloId }),
    supabase.rpc("eva_maestro_resumen", { p_ciclo_id: cicloId }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { filas: filas || [], resumen: (resumen || [])[0] || null };
}

export async function exportarMaestroExcel({ filas, resumen }) {
  const doc = DOCS.maestro;
  // Apaisado: son once columnas de nómina. En vertical no entran.
  const cols = [26, 22, 20, 22, 11, 11, 11, 18, 9, 9, 22];
  const { wb, sheet, ultimaCol } = await nuevoLibro({
    nombreHoja: "Maestro del ciclo",
    cols,
    doc,
    orientacion: "landscape",
  });

  // ---------------------------------------------------------------- el ciclo
  filaSeccion(sheet, "EL CICLO", ultimaCol);
  filaEtiqueta(sheet, "Ciclo", resumen?.ciclo_titulo || "—", ultimaCol);
  filaEtiqueta(sheet, "Estado del ciclo", resumen?.ciclo_estado || "—", ultimaCol);
  filaEtiqueta(sheet, "Se habilitó el", fecha(resumen?.fecha_apertura), ultimaCol);
  filaEtiqueta(sheet, "Cierre de autoevaluación", fecha(resumen?.fecha_cierre_autoeval), ultimaCol);
  filaEtiqueta(sheet, "Cierre de evaluación", fecha(resumen?.fecha_cierre_evaluacion), ultimaCol);
  sheet.addRow([]);

  // --------------------------------------------------------------- el avance
  filaSeccion(sheet, "AVANCE", ultimaCol);
  filaEncabezado(sheet, ["Indicador", "Cantidad", "", "", "", "", "", "", "", "", ""]);
  const avance = [
    ["Evaluaciones asignadas", resumen?.asignadas ?? 0],
    ["Se autoevaluaron", resumen?.autoevaluadas ?? 0],
    ["NO se autoevaluaron", resumen?.sin_autoevaluar ?? 0],
    ["Evaluadas por la jefatura", resumen?.evaluadas_por_jefatura ?? 0],
    ["Consolidadas", resumen?.consolidadas ?? 0],
    ["Cerradas", resumen?.cerradas ?? 0],
    ["Con disconformidad o conformidad parcial", resumen?.con_disconformidad ?? 0],
    ["Promedio general (evaluación de jefatura)", n2(resumen?.promedio_general)],
    ["Líneas de PDI comprometidas", resumen?.lineas_pdi ?? 0],
  ];
  avance.forEach(([k, v], i) => {
    const r = filaDato(sheet, [k, v], i, 2);
    // La única cifra que se destaca es la que hay que resolver.
    if (k.startsWith("NO se autoevaluaron") && Number(v) > 0) {
      [1, 2].forEach((c) => {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALERTA_BG } };
        r.getCell(c).font = { size: 10, bold: true, color: { argb: ALERTA_TXT } };
      });
    }
  });
  sheet.addRow([]);

  // ------------------------------------------- lo accionable: los que faltan
  const faltan = filas.filter((f) => !f.se_autoevaluo);

  filaSeccion(sheet, "PENDIENTES DE AUTOEVALUACIÓN", ultimaCol);

  if (!faltan.length) {
    const r = sheet.addRow(["Todos los trabajadores del ciclo completaron su autoevaluación."]);
    sheet.mergeCells(r.number, 1, r.number, ultimaCol);
    r.getCell(1).font = { size: 10, italic: true, color: { argb: GRAY_TEXT } };
  } else {
    if (resumen?.autoeval_vencida) {
      const av = sheet.addRow([
        `El plazo de autoevaluación venció el ${fecha(resumen.fecha_cierre_autoeval)} y ` +
          `${faltan.length === 1 ? "queda 1 persona" : `quedan ${faltan.length} personas`} sin autoevaluarse.`,
      ]);
      sheet.mergeCells(av.number, 1, av.number, ultimaCol);
      av.getCell(1).font = { size: 10, bold: true, color: { argb: ALERTA_TXT } };
      av.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALERTA_BG } };
      av.getCell(1).alignment = { vertical: "middle" };
      av.height = 20;
    }

    filaEncabezado(sheet, [
      "Trabajador", "Cargo", "Familia", "Jefatura que evalúa",
      "Días habilitado", "Estado", "", "", "", "", "",
    ]);
    faltan
      .slice()
      .sort((a, b) => (b.dias_habilitado ?? 0) - (a.dias_habilitado ?? 0))
      .forEach((f, i) => {
        const r = filaDato(
          sheet,
          [
            f.nombre, f.cargo || "—", f.familia_nombre || "—", f.evaluador_nombre || "—",
            f.dias_habilitado ?? "—", ESTADO_LABELS[f.estado] || f.estado,
          ],
          i,
          6
        );
        r.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
      });
  }
  sheet.addRow([]);

  // ------------------------------------------------------- la nómina entera
  filaSeccion(sheet, "ESTADO DE CADA EVALUACIÓN", ultimaCol);
  filaEncabezado(sheet, [
    "Trabajador", "Cargo", "Familia", "Jefatura que evalúa", "Autoevaluó",
    "Total auto", "Total jefatura", "Categoría", "Firmas", "PDI", "Estado",
  ]);

  filas.forEach((f, i) => {
    const r = filaDato(
      sheet,
      [
        f.nombre,
        f.cargo || "—",
        f.familia_nombre || "—",
        f.evaluador_nombre || "—",
        f.se_autoevaluo ? "Sí" : "NO",
        n2(f.total_auto),
        n2(f.total_sup),
        CATEGORIA_LABELS[f.categoria] || f.categoria || "—",
        `${f.firmas ?? 0} de 4`,
        f.lineas_pdi ?? 0,
        ESTADO_LABELS[f.estado] || f.estado,
      ],
      i,
      ultimaCol
    );
    [5, 6, 7, 9, 10].forEach((c) => (r.getCell(c).alignment = { horizontal: "center", vertical: "middle" }));
    if (!f.se_autoevaluo) {
      r.getCell(5).font = { size: 10, bold: true, color: { argb: ALERTA_TXT } };
      r.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALERTA_BG } };
    }
  });
  sheet.addRow([]);

  // ---------------------------- las filas cuyo dato de autoevaluación cojea
  const sinFecha = filas.filter((f) => f.se_autoevaluo && f.como_consta !== "Fecha de envío registrada");
  if (sinFecha.length) {
    filaSeccion(sheet, "REVISAR: AUTOEVALUACIONES SIN FECHA DE ENVÍO", ultimaCol);
    const nota = sheet.addRow([
      `${sinFecha.length === 1 ? "Una evaluación consta" : `${sinFecha.length} evaluaciones constan`} como autoevaluada ` +
        `pero sin la fecha en que se envió. Se cuentan como autoevaluadas —hay evidencia de que lo están— pero el ` +
        `registro queda incompleto: pasa cuando la fila entró por carga masiva o por una corrección directa en la base, ` +
        `no por el formulario.`,
    ]);
    sheet.mergeCells(nota.number, 1, nota.number, ultimaCol);
    nota.getCell(1).font = { size: 9, color: { argb: GRAY_TEXT } };
    nota.getCell(1).alignment = { wrapText: true, vertical: "top" };
    nota.height = 30;

    // «Cómo consta» es una frase, no una etiqueta: se le dan tres columnas.
    const encRev = filaEncabezado(sheet, ["Trabajador", "Cómo consta", "", "", "Estado", "", "", "", "", "", ""]);
    sheet.mergeCells(encRev.number, 2, encRev.number, 4);
    sinFecha.forEach((f, i) => {
      const r = filaDato(sheet, [f.nombre, f.como_consta, "", "", ESTADO_LABELS[f.estado] || f.estado], i, 5);
      sheet.mergeCells(r.number, 2, r.number, 4);
    });
  }

  ponerPie(sheet, doc, ultimaCol);

  const ciclo = (resumen?.ciclo_titulo || "ciclo").replace(/\s+/g, "_");
  await descargar(wb, `${doc.codigo}_Maestro_${ciclo}.xlsx`);
}

/** Carga y genera de una vez. Devuelve el resumen para poder avisar qué salió. */
export async function descargarMaestro(cicloId) {
  const datos = await cargarMaestro(cicloId);
  await exportarMaestroExcel(datos);
  return datos.resumen;
}
