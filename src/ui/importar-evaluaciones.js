/**
 * Importación masiva de asignaciones de evaluación (evaluado + evaluador)
 * dentro de un ciclo, vía plantilla Excel. Usa el correo como identificador
 * único — más confiable que el nombre, que puede repetirse o tener errores
 * de tipeo.
 */

import ExcelJS from "exceljs";
import { supabase } from "../core/supabase.js";

/** Genera y descarga la plantilla vacía con un ejemplo. */
export async function descargarPlantillaImportacion() {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Asignaciones");

  sheet.columns = [
    { header: "Correo evaluado", key: "evaluado", width: 32 },
    { header: "Correo evaluador", key: "evaluador", width: 32 },
    { header: "Cargo del evaluador", key: "cargo", width: 28 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.addRow({ evaluado: "trabajador@metalium.cl", evaluador: "jefatura@metalium.cl", cargo: "Jefe de Administración" });

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "Plantilla_Asignacion_Evaluaciones.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Lee el archivo subido y devuelve las filas crudas: [{evaluado, evaluador, cargo}, ...]
 * (todavía sin resolver contra la base de datos).
 */
async function leerFilas(file) {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];

  const filas = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const evaluado = String(row.getCell(1).value || "").trim().toLowerCase();
    const evaluador = String(row.getCell(2).value || "").trim().toLowerCase();
    const cargo = String(row.getCell(3).value || "").trim();
    if (evaluado || evaluador) {
      filas.push({ fila: rowNumber, evaluado, evaluador, cargo });
    }
  });
  return filas;
}

/**
 * Procesa el archivo completo: lee, resuelve los correos contra perfiles
 * reales, valida, e inserta en bloque las filas válidas.
 * @returns {Promise<{creadas: number, errores: string[]}>}
 */
export async function importarAsignaciones(file, cicloId) {
  const filas = await leerFilas(file);

  if (!filas.length) {
    return { creadas: 0, errores: ["El archivo no tiene filas para procesar."] };
  }

  const correosUnicos = [...new Set(filas.flatMap((f) => [f.evaluado, f.evaluador]).filter(Boolean))];

  const { data: perfilesEncontrados, error: errBusqueda } = await supabase.rpc("buscar_perfiles_por_correo", {
    p_correos: correosUnicos,
  });

  if (errBusqueda) {
    return { creadas: 0, errores: [`Error al buscar los correos: ${errBusqueda.message}`] };
  }

  const mapaCorreoId = {};
  (perfilesEncontrados || []).forEach((p) => (mapaCorreoId[p.correo.toLowerCase()] = p));

  const validas = [];
  const errores = [];

  filas.forEach((f) => {
    const evaluadoPerfil = mapaCorreoId[f.evaluado];
    const evaluadorPerfil = mapaCorreoId[f.evaluador];

    if (!f.evaluado || !f.evaluador) {
      errores.push(`Fila ${f.fila}: falta el correo del evaluado o del evaluador.`);
      return;
    }
    if (!evaluadoPerfil) {
      errores.push(`Fila ${f.fila}: no se encontró un usuario activo con el correo "${f.evaluado}".`);
      return;
    }
    if (!evaluadorPerfil) {
      errores.push(`Fila ${f.fila}: no se encontró un usuario activo con el correo "${f.evaluador}".`);
      return;
    }
    if (evaluadoPerfil.id === evaluadorPerfil.id) {
      errores.push(`Fila ${f.fila}: el evaluado y el evaluador no pueden ser la misma persona.`);
      return;
    }

    validas.push({
      ciclo_id: cicloId,
      evaluado_id: evaluadoPerfil.id,
      evaluador_id: evaluadorPerfil.id,
      cargo_evaluador: f.cargo || null,
      estado: "asignada",
    });
  });

  if (!validas.length) {
    return { creadas: 0, errores };
  }

  const { error: errInsert } = await supabase.from("eva_evaluaciones").insert(validas);

  if (errInsert) {
    errores.push(`Error al guardar en la base de datos: ${errInsert.message}`);
    return { creadas: 0, errores };
  }

  return { creadas: validas.length, errores };
}
