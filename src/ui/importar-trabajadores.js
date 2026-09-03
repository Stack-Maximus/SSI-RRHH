/**
 * Importación masiva de trabajadores: crea la cuenta de Auth (vía la
 * Edge Function create-user), el perfil, y sus accesos iniciales, todo
 * en una sola fila del Excel. No se define contraseña — cada trabajador
 * recibe su propio link de invitación, devuelto al final del proceso.
 */

import ExcelJS from "exceljs";
import { supabase } from "../core/supabase.js";

const MODULOS = ["personal", "proveedores", "satisfaccion", "no_conformidades", "postventa"];

export async function descargarPlantillaTrabajadores() {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Trabajadores");

  sheet.columns = [
    { header: "Correo", key: "correo", width: 30 },
    { header: "Nombre", key: "nombre", width: 26 },
    { header: "Cargo", key: "cargo", width: 22 },
    { header: "Rol Personal", key: "personal", width: 16 },
    { header: "Rol Proveedores", key: "proveedores", width: 16 },
    { header: "Rol Satisfacción", key: "satisfaccion", width: 16 },
    { header: "Rol No Conformidades", key: "no_conformidades", width: 20 },
    { header: "Rol Postventa", key: "postventa", width: 16 },
  ];

  sheet.getRow(1).font = { bold: true };

  // El cargo dejó de ser texto libre: de él se deduce la familia, y de la familia
  // salen los cursos obligatorios del puesto. Un cargo tecleado a mano que no
  // coincida con el catálogo deja a la persona sin nada de eso, sin avisar. La
  // plantilla trae la lista en una segunda hoja y valida contra ella.
  const { data: cargos } = await supabase
    .from("eva_cargos_catalogo")
    .select("nombre, familia_codigo")
    .order("familia_codigo")
    .order("nombre");

  const listaCargos = (cargos || []).map((c) => c.nombre);
  const primerCargo = listaCargos[0] || "";

  if (listaCargos.length) {
    const hojaCargos = wb.addWorksheet("Cargos válidos");
    hojaCargos.columns = [
      { header: "Cargo", key: "nombre", width: 38 },
      { header: "Familia", key: "familia", width: 12 },
    ];
    hojaCargos.getRow(1).font = { bold: true };
    (cargos || []).forEach((c) => hojaCargos.addRow({ nombre: c.nombre, familia: c.familia_codigo }));

    // Excel limita la validación por fórmula a 255 caracteres, y 54 cargos no
    // caben: se apunta al rango de la otra hoja en lugar de listarlos inline.
    const rango = `'Cargos válidos'!$A$2:$A$${listaCargos.length + 1}`;
    for (let fila = 2; fila <= 400; fila++) {
      sheet.getCell(`C${fila}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [rango],
        showErrorMessage: true,
        errorTitle: "Cargo no válido",
        error: "Elige un cargo de la hoja «Cargos válidos». De él depende la batería de cursos del puesto.",
      };
    }
  }

  sheet.addRow({
    correo: "trabajador@metalium.cl",
    nombre: "Nombre Completo",
    cargo: primerCargo,
    personal: "empleado",
    proveedores: "",
    satisfaccion: "",
    no_conformidades: "",
    postventa: "",
  });

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "Plantilla_Trabajadores.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function leerFilas(file) {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];

  const filas = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const correo = String(row.getCell(1).value || "").trim();
    if (!correo) return;

    filas.push({
      fila: rowNumber,
      correo,
      nombre: String(row.getCell(2).value || "").trim(),
      cargo: String(row.getCell(3).value || "").trim(),
      roles: {
        personal: String(row.getCell(4).value || "").trim(),
        proveedores: String(row.getCell(5).value || "").trim(),
        satisfaccion: String(row.getCell(6).value || "").trim(),
        no_conformidades: String(row.getCell(7).value || "").trim(),
        postventa: String(row.getCell(8).value || "").trim(),
      },
    });
  });
  return filas;
}

/**
 * Procesa el archivo: crea cada trabajador SECUENCIALMENTE (uno por uno,
 * no en paralelo) para no saturar la Edge Function, y sigue con la
 * siguiente fila aunque una falle.
 * @returns {Promise<{creados: number, errores: string[], invitaciones: {correo, nombre, link}[]}>}
 */
export async function importarTrabajadores(file) {
  const filas = await leerFilas(file);

  if (!filas.length) {
    return { creados: 0, errores: ["El archivo no tiene filas para procesar."], invitaciones: [] };
  }

  // Se valida el cargo contra el catálogo ANTES de crear a nadie. Si se dejara
  // pasar, la persona quedaría creada y sin familia, y eso no da error en ningún
  // momento: simplemente el motor de PDI no le propone nada de su puesto.
  const { data: cargosCat } = await supabase.from("eva_cargos_catalogo").select("nombre");
  const norm = (t) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const validos = new Map((cargosCat || []).map((c) => [norm(c.nombre), c.nombre]));

  const cargosMalos = [];
  for (const f of filas) {
    if (!f.cargo) continue;
    const encontrado = validos.get(norm(f.cargo));
    if (encontrado) {
      f.cargo = encontrado; // se guarda con la grafía exacta del catálogo
    } else {
      cargosMalos.push(`Fila ${f.fila}: el cargo «${f.cargo}» no está en el catálogo.`);
    }
  }

  if (cargosMalos.length) {
    return {
      creados: 0,
      errores: [
        "No se creó a nadie: hay cargos que el catálogo no reconoce. Si se importaran así, esas personas quedarían " +
          "sin familia de cargo y el motor de PDI no les propondría los cursos obligatorios de su puesto — sin dar " +
          "ningún error. Corrige el archivo con la hoja «Cargos válidos» de la plantilla.",
        ...cargosMalos,
      ],
      invitaciones: [],
    };
  }

  let creados = 0;
  const errores = [];
  const invitaciones = [];

  for (const f of filas) {
    if (!f.nombre) {
      errores.push(`Fila ${f.fila}: falta el nombre.`);
      continue;
    }

    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email: f.correo,
        nombre: f.nombre,
        cargo: f.cargo || null,
        redirectTo: window.location.origin + window.location.pathname,
      },
    });

    if (error || data?.error) {
      errores.push(`Fila ${f.fila} (${f.correo}): ${data?.error || error.message}`);
      continue;
    }

    const nuevoId = data.id;
    const accesos = MODULOS.map((m) => (f.roles[m] ? { usuario_id: nuevoId, modulo: m, rol: f.roles[m] } : null)).filter(Boolean);

    if (accesos.length) {
      await supabase.from("modulo_accesos").insert(accesos);
    }

    if (data.link) {
      // El correo con el link ya se envía solo (create-user inserta la
      // notificación, que dispara el trigger de Postgres) — no hace
      // falta ni conviene llamarlo también desde aquí.
      invitaciones.push({ correo: f.correo, nombre: f.nombre, link: data.link });
    }

    creados++;
  }

  return { creados, errores, invitaciones };
}
