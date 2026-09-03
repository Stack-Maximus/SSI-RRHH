/**
 * Evaluación de Personal · vista principal.
 * - Si el usuario tiene rol 'rrhh' en este módulo: panel de gestión (ciclos + asignaciones + todas las evaluaciones)
 * - Si no: "Mis evaluaciones" — solo las filas donde aparece como evaluado o evaluador
 */

import { supabase } from "../core/supabase.js";
import { state } from "../core/state.js";
import { Toast, Confirm } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";
import { renderAutoevaluacion } from "./personal-autoevaluacion.js";
import { renderPDI } from "./personal-pdi.js";
import {
  ESTADO_LABELS,
  ESTADO_BADGE,
  PDI_VISIBLE,
  accionDisponible,
} from "./personal-flujo.js";

const EXPORTABLES = ["consolidada", "entregada_trabajador", "cerrada_conforme", "cerrada_disconformidad", "archivada"];

/**
 * Desde cuándo el propio evaluado puede bajarse su expediente. Es la misma
 * lista que eva_expediente_descargable() en la base.
 *
 * 'consolidada' está en EXPORTABLES pero NO acá: en ese estado los puntajes ya
 * existen y RRHH puede exportar, pero el trabajador todavía no ha recibido su
 * resultado, y el orden del flujo es parte del diseño.
 */
const DESCARGABLE_EVALUADO = ["entregada_trabajador", "resultados_aceptados", "reunion_agendada",
  "reunion_realizada", "reflexiones_enviadas", "pendiente_firmas", "cerrada_conforme",
  "cerrada_disconformidad", "archivada"];

export async function renderPersonal(container) {
  const rol = state.accesos.find((a) => a.modulo === "personal")?.rol;
  const esRRHH = state.user.esAdmin || rol === "rrhh";
  container.innerHTML = `<div class="view-loading">Cargando...</div>`;

  // El rol de Crecimiento y Bienestar no evalúa a nadie: su pantalla es el
  // seguimiento de los planes de desarrollo ya acordados.
  if (rol === "crecimiento_bienestar" && !esRRHH) {
    const { renderBienestar } = await import("./personal-bienestar.js");
    await renderBienestar(container);
    return;
  }

  if (esRRHH) {
    await renderPanelRRHH(container);
  } else {
    await renderMisEvaluaciones(container);
  }
}

/**
 * Abre lo que corresponda según el paso del flujo. Una sola puerta para las dos
 * vistas (panel de RRHH y "Mis evaluaciones"), así nunca se desincronizan.
 */
async function abrirPaso(container, evaluacion, modo) {
  if (modo === "autoevaluacion" || modo === "evaluador") {
    renderAutoevaluacion(container, evaluacion, modo);
    return;
  }
  if (modo === "resultado") {
    const { renderResultadoEvaluado } = await import("./personal-resultado.js");
    await renderResultadoEvaluado(container, evaluacion.id);
    return;
  }
  if (modo === "agendar") {
    const { abrirModalAgendarReunion } = await import("./personal-reunion.js");
    await abrirModalAgendarReunion(evaluacion, () => window.Router.go("personal"));
    return;
  }
  if (modo === "realizada") {
    const { abrirModalReunionRealizada } = await import("./personal-reunion.js");
    await abrirModalReunionRealizada(evaluacion, () => window.Router.go("personal"));
    return;
  }
  if (modo === "acta") {
    const { renderActa } = await import("./personal-acta.js");
    await renderActa(container, evaluacion.id);
    return;
  }
  if (modo === "plan") {
    const { renderPlanAccion } = await import("./personal-plan-accion.js");
    const { data: completa } = await supabase
      .from("eva_evaluaciones")
      .select("*, evaluado:evaluado_id(nombre, cargo), evaluador:evaluador_id(nombre), ciclo:ciclo_id(titulo)")
      .eq("id", evaluacion.id)
      .single();
    await renderPlanAccion(container, completa || evaluacion);
  }
}

async function renderPanelRRHH(container) {
  const { data: ciclos, error } = await supabase
    .from("eva_ciclos")
    .select("*")
    .order("fecha_apertura", { ascending: false });

  if (error) {
    container.innerHTML = `<div class="placeholder error"><h2>Error al cargar ciclos</h2><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  const { data: evaluaciones } = await supabase
    .from("eva_evaluaciones")
    .select(
      "id, estado, evaluador_id, evaluado_id, evaluado:evaluado_id(id, nombre, cargo, activo, es_admin), " +
        "evaluador:evaluador_id(nombre), ciclo:ciclo_id(titulo)"
    )
    .order("id", { ascending: false })
    .limit(50);

  const filasCiclos = ciclos.length
    ? ciclos
        .map(
          (c) => `
      <tr>
        <td>${escapeHtml(c.titulo)}</td>
        <td>${escapeHtml(c.tipo_periodo)}</td>
        <td><span class="badge badge-neutral">${escapeHtml(c.estado)}</span></td>
        <td>${formatDate(c.fecha_apertura)} – ${formatDate(c.fecha_cierre_ciclo)}</td>
        <td>
          <button class="btn btn-secondary" data-asignar="${c.id}">+ Asignar evaluación</button>
          <button class="btn btn-secondary" data-importar="${c.id}">Importar masivo</button>
          <button class="btn btn-secondary" data-maestro="${c.id}" title="Estado del ciclo completo y quiénes no se han autoevaluado">📋 Maestro</button>
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty-state">Aún no hay ciclos creados.</td></tr>`;

  const filasEval = (evaluaciones || []).length
    ? evaluaciones
        .map((e) => {
          // Si quien mira es el evaluador de esa fila, ve la acción que le toca
          // en el flujo (evaluar, agendar la 1:1, marcarla realizada, definir el plan).
          const miAccion = e.evaluador_id === state.user.id ? accionDisponible(e, false) : null;
          const puedeEntregar = e.estado === "consolidada";
          const puedePDI = PDI_VISIBLE.includes(e.estado);
          const puedeExportar = EXPORTABLES.includes(e.estado);
          return `
      <tr>
        <td>
          ${
            e.evaluado?.id
              ? `<button class="link-perfil" data-ficha-eval="${e.id}" title="Ver la ficha de ${escapeHtml(e.evaluado.nombre || "")}"><span>${escapeHtml(e.evaluado.nombre || "—")}</span></button>`
              : escapeHtml(e.evaluado?.nombre || "—")
          }
        </td>
        <td>${escapeHtml(e.evaluador?.nombre || "—")}</td>
        <td>${escapeHtml(e.ciclo?.titulo || "—")}</td>
        <td><span class="badge ${ESTADO_BADGE[e.estado] || "badge-neutral"}">${ESTADO_LABELS[e.estado] || e.estado}</span></td>
        <td>
          ${e.evaluado?.id ? `<button class="btn btn-secondary" data-ficha-eval="${e.id}">Ficha</button>` : ""}
          ${miAccion ? `<button class="btn btn-primary" data-paso="${e.id}" data-modo="${miAccion.modo}">${miAccion.texto}</button>` : ""}
          ${puedeEntregar ? `<button class="btn btn-primary" data-entregar="${e.id}">Entregar resultado</button>` : ""}
          ${puedePDI ? `<button class="btn btn-secondary" data-pdi="${e.id}">PDI</button>` : ""}
          ${puedeExportar ? `<button class="btn btn-secondary" data-exportar="${e.id}">📄 Exportar</button>` : ""}
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="empty-state">Aún no hay evaluaciones asignadas.</td></tr>`;

  container.innerHTML = `
    <div class="view-personal-rrhh">
      <div style="margin-bottom:16px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn-primary" id="btn-nuevo-ciclo">+ Nuevo ciclo</button>
        <button class="btn btn-secondary" id="btn-mi-evolucion">📈 Ver mi evolución</button>
        <button class="btn btn-secondary" id="btn-seguimiento-pdi">🌱 Seguimiento de planes</button>
        <button class="btn btn-secondary" id="btn-criterios-cargo">🎯 Criterios por cargo</button>
      </div>

      <div class="card">
        <h3>Ciclos de evaluación</h3>
        <table class="data-table">
          <thead><tr><th>Título</th><th>Tipo</th><th>Estado</th><th>Período</th><th></th></tr></thead>
          <tbody>${filasCiclos}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3>Evaluaciones asignadas (últimas 50)</h3>
        <table class="data-table">
          <thead><tr><th>Evaluado</th><th>Evaluador</th><th>Ciclo</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>${filasEval}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-nuevo-ciclo").addEventListener("click", abrirModalNuevoCiclo);
  engancharMiEvolucion(container);

  // El panel de seguimiento es la vista propia del rol de Crecimiento y
  // Bienestar, pero RRHH y el admin también necesitan poder mirarlo.
  document.getElementById("btn-seguimiento-pdi").addEventListener("click", async () => {
    const { renderBienestar } = await import("./personal-bienestar.js");
    await renderBienestar(container);
  });

  document.getElementById("btn-criterios-cargo")?.addEventListener("click", async () => {
    const { renderCriteriosCargo } = await import("./personal-criterios-cargo.js");
    await renderCriteriosCargo(container);
  });

  container.querySelectorAll("[data-ficha-eval]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const e = evaluaciones.find((x) => x.id === btn.dataset.fichaEval);
      if (!e?.evaluado?.id) return;
      const { renderFichaTrabajador } = await import("./trabajador-ficha.js");
      await renderFichaTrabajador(container, e.evaluado, { volver: () => window.Router.go("personal") });
    });
  });

  container.querySelectorAll("[data-asignar]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalAsignar(btn.dataset.asignar));
  });
  container.querySelectorAll("[data-importar]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalImportarMasivo(btn.dataset.importar));
  });
  container.querySelectorAll("[data-exportar]").forEach((btn) => {
    btn.addEventListener("click", () => manejarExportar(btn.dataset.exportar, btn));
  });

  container.querySelectorAll("[data-maestro]").forEach((btn) => {
    btn.addEventListener("click", () => manejarMaestro(btn.dataset.maestro, btn));
  });
  container.querySelectorAll("[data-paso]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const e = evaluaciones.find((x) => x.id === btn.dataset.paso);
      if (e) abrirPaso(container, e, btn.dataset.modo);
    });
  });
  container.querySelectorAll("[data-entregar]").forEach((btn) => {
    btn.addEventListener("click", () => manejarEntregarResultado(btn.dataset.entregar));
  });
  container.querySelectorAll("[data-pdi]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { data: evalCompleta } = await supabase
        .from("eva_evaluaciones")
        .select("*, evaluado:evaluado_id(nombre), evaluador:evaluador_id(nombre), ciclo:ciclo_id(titulo)")
        .eq("id", btn.dataset.pdi)
        .single();
      if (evalCompleta) renderPDI(container, evalCompleta);
    });
  });
}

async function manejarEntregarResultado(evaluacionId) {
  const ok = await Confirm.ask({
    title: "¿Entregar el resultado al trabajador?",
    text:
      "Va a poder ver su evaluación completa y confirmar que la recibió. Después de esa confirmación te toca " +
      "agendar la reunión 1:1; las preguntas de conformidad se le habilitan recién cuando la reunión se realice.",
    confirmText: "Entregar",
  });
  if (!ok) return;

  const { error } = await supabase
    .from("eva_evaluaciones")
    .update({ estado: "entregada_trabajador" })
    .eq("id", evaluacionId);

  if (error) {
    Toast.error("Error al entregar", error.message);
    return;
  }
  Toast.success("Resultado entregado", "El trabajador fue notificado.");
  window.Router.go("personal");
}

function abrirModalNuevoCiclo() {
  Modal.open({
    title: "Nuevo ciclo de evaluación",
    content: `
      <form id="form-nuevo-ciclo">
        <div class="form-field">
          <label class="form-label">Título<span class="req">*</span></label>
          <input type="text" id="ciclo-titulo" required placeholder="Ej: 2026-S2">
        </div>
        <div class="form-field">
          <label class="form-label">Tipo de período<span class="req">*</span></label>
          <select id="ciclo-tipo" required>
            <option value="1er_semestre">1er semestre</option>
            <option value="2do_semestre">2do semestre</option>
            <option value="anual">Anual</option>
            <option value="periodo_prueba">Período de prueba</option>
            <option value="extraordinaria_pmd">Extraordinaria / PMD</option>
          </select>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Apertura</label>
            <input type="date" id="ciclo-apertura">
          </div>
          <div class="form-field">
            <label class="form-label">Cierre autoevaluación</label>
            <input type="date" id="ciclo-cierre-auto">
          </div>
          <div class="form-field">
            <label class="form-label">Cierre evaluación</label>
            <input type="date" id="ciclo-cierre-eval">
          </div>
          <div class="form-field">
            <label class="form-label">Cierre del ciclo</label>
            <input type="date" id="ciclo-cierre">
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-ciclo">Cancelar</button>
          <button type="submit" class="btn btn-primary">Crear ciclo</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-ciclo").addEventListener("click", Modal.close);
  document.getElementById("form-nuevo-ciclo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("eva_ciclos").insert({
      titulo: document.getElementById("ciclo-titulo").value.trim(),
      tipo_periodo: document.getElementById("ciclo-tipo").value,
      fecha_apertura: document.getElementById("ciclo-apertura").value || null,
      fecha_cierre_autoeval: document.getElementById("ciclo-cierre-auto").value || null,
      fecha_cierre_evaluacion: document.getElementById("ciclo-cierre-eval").value || null,
      fecha_cierre_ciclo: document.getElementById("ciclo-cierre").value || null,
      estado: "planificado",
    });
    if (error) {
      Toast.error("Error al crear el ciclo", error.message);
      return;
    }
    Modal.close();
    Toast.success("Ciclo creado", "Ya puedes asignar evaluaciones.");
    window.Router.go("personal");
  });
}

async function abrirModalAsignar(cicloId) {
  // eva_candidatos_a_evaluar() trae a todos los activos con la marca de si su
  // cargo se evalúa. Se pide a la base y no se replica la regla acá: la
  // deducción del cargo a familia y la marca de evaluable viven en un solo lugar.
  const { data: candidatos, error: errCand } = await supabase.rpc("eva_candidatos_a_evaluar");

  let gente = candidatos;
  if (errCand || !gente) {
    // Sin la migración de cargos no evaluables, se cae al listado plano.
    const { data } = await supabase.from("perfiles").select("id, nombre, cargo").eq("activo", true).order("nombre");
    gente = (data || []).map((p) => ({ perfil_id: p.id, nombre: p.nombre, cargo: p.cargo, evaluable: true }));
  }

  // Quien tiene un cargo que no se evalúa aparece igual, DESHABILITADO y con el
  // motivo. Sacarlo de la lista sin explicación haría que RRHH lo buscara
  // pensando que falta cargarlo.
  const opcionesEvaluado = gente
    .map((p) => {
      const etiqueta = `${escapeHtml(p.nombre)}${p.cargo ? " — " + escapeHtml(p.cargo) : ""}`;
      return p.evaluable === false
        ? `<option value="${p.perfil_id}" disabled>${etiqueta} · no se evalúa</option>`
        : `<option value="${p.perfil_id}">${etiqueta}</option>`;
    })
    .join("");

  // Como evaluador no hay restricción: el Gerente General evalúa a sus gerencias.
  const opcionesEvaluador = gente
    .map(
      (p) =>
        `<option value="${p.perfil_id}" data-cargo="${escapeHtml(p.cargo || "")}">${escapeHtml(p.nombre)}${
          p.cargo ? " — " + escapeHtml(p.cargo) : ""
        }</option>`
    )
    .join("");

  const noEvaluables = gente.filter((p) => p.evaluable === false);

  Modal.open({
    title: "Asignar evaluación",
    content: `
      <form id="form-asignar">
        <div class="form-field">
          <label class="form-label">Trabajador a evaluar<span class="req">*</span></label>
          <select id="asig-evaluado" required><option value="">Selecciona...</option>${opcionesEvaluado}</select>
          ${noEvaluables.length
            ? `<p class="hint" style="margin-top:5px;">
                 ${noEvaluables.map((p) => escapeHtml(p.nombre)).join(", ")} ${noEvaluables.length === 1 ? "aparece" : "aparecen"}
                 en gris: su cargo no se evalúa. ${escapeHtml(noEvaluables[0].motivo || "")}
               </p>`
            : ""}
        </div>
        <div class="form-field">
          <label class="form-label">Evaluador (jefatura)<span class="req">*</span></label>
          <select id="asig-evaluador" required><option value="">Selecciona...</option>${opcionesEvaluador}</select>
        </div>
        <div class="form-field">
          <label class="form-label">Cargo del evaluador</label>
          <input type="text" id="asig-cargo-evaluador" placeholder="Se llena al elegir al evaluador">
          <p class="hint" style="margin-top:5px;">
            Se completa solo con el cargo que tiene en su perfil. Se puede corregir si firma en representación de otro rol.
          </p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-asig">Cancelar</button>
          <button type="submit" class="btn btn-primary">Asignar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-asig").addEventListener("click", Modal.close);

  // El cargo del evaluador era el último campo de cargo escrito a mano. Ahora
  // sale del perfil: se autocompleta al elegir, y queda editable.
  const selEvaluador = document.getElementById("asig-evaluador");
  const inpCargoEval = document.getElementById("asig-cargo-evaluador");
  selEvaluador.addEventListener("change", () => {
    const cargo = selEvaluador.selectedOptions[0]?.dataset.cargo || "";
    if (!inpCargoEval.value.trim() || inpCargoEval.dataset.autollenado === "1") {
      inpCargoEval.value = cargo;
      inpCargoEval.dataset.autollenado = "1";
    }
  });
  inpCargoEval.addEventListener("input", () => {
    inpCargoEval.dataset.autollenado = "0";
  });
  document.getElementById("form-asignar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const evaluado_id = document.getElementById("asig-evaluado").value;
    const evaluador_id = document.getElementById("asig-evaluador").value;

    if (evaluado_id === evaluador_id) {
      Toast.error("Error", "El trabajador y el evaluador no pueden ser la misma persona.");
      return;
    }

    // El cargo y la familia se CONGELAN al asignar la evaluación. Antes no se
    // guardaban y el motor los deducía en vivo del perfil: si la persona cambiaba
    // de cargo después, un expediente ya firmado empezaba a decir que se había
    // evaluado con otra batería de cursos. Ahora el expediente conserva con qué
    // cargo y qué familia se evaluó en su momento.
    const { data: perfilEvaluado } = await supabase
      .from("perfiles")
      .select("cargo, familia_codigo")
      .eq("id", evaluado_id)
      .single();

    let familiaCongelada = perfilEvaluado?.familia_codigo || null;
    if (!familiaCongelada && perfilEvaluado?.cargo) {
      const { data: delCatalogo } = await supabase
        .from("eva_cargos_catalogo")
        .select("familia_codigo")
        .eq("nombre", perfilEvaluado.cargo)
        .maybeSingle();
      familiaCongelada = delCatalogo?.familia_codigo || null;
    }

    const { error } = await supabase.from("eva_evaluaciones").insert({
      ciclo_id: cicloId,
      evaluado_id,
      evaluador_id,
      cargo_evaluador: document.getElementById("asig-cargo-evaluador").value.trim() || null,
      cargo_actual: perfilEvaluado?.cargo || null,
      familia_codigo: familiaCongelada,
      estado: "asignada",
    });

    if (error) {
      Toast.error("Error al asignar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Evaluación asignada", "Ya aparece en el listado.");
    window.Router.go("personal");
  });
}

function abrirModalImportarMasivo(cicloId) {
  Modal.open({
    title: "Importar asignaciones masivamente",
    content: `
      <p class="lead" style="margin-bottom:12px;">
        1. Descarga la plantilla, complétala con el correo del evaluado, el correo del evaluador, y el cargo del evaluador (una fila por asignación).<br>
        2. Sube el archivo completo aquí abajo.
      </p>
      <button type="button" class="btn btn-secondary" id="btn-descargar-plantilla" style="margin-bottom:16px;">⬇ Descargar plantilla</button>

      <div class="form-field">
        <label class="form-label">Archivo completado (.xlsx)</label>
        <input type="file" id="archivo-importar" accept=".xlsx">
      </div>

      <div id="resultado-importacion" style="margin-top:12px;"></div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-cerrar-importar">Cerrar</button>
        <button type="button" class="btn btn-primary" id="btn-procesar-importar">Importar</button>
      </div>
    `,
  });

  document.getElementById("btn-cerrar-importar").addEventListener("click", Modal.close);

  document.getElementById("btn-descargar-plantilla").addEventListener("click", async () => {
    const { descargarPlantillaImportacion } = await import("../ui/importar-evaluaciones.js");
    await descargarPlantillaImportacion();
  });

  document.getElementById("btn-procesar-importar").addEventListener("click", async () => {
    const input = document.getElementById("archivo-importar");
    const resultadoDiv = document.getElementById("resultado-importacion");
    const btn = document.getElementById("btn-procesar-importar");

    if (!input.files || !input.files[0]) {
      Toast.warning("Falta el archivo", "Selecciona el archivo completado antes de importar.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Importando...";
    resultadoDiv.innerHTML = "";

    try {
      const { importarAsignaciones } = await import("../ui/importar-evaluaciones.js");
      const { creadas, errores } = await importarAsignaciones(input.files[0], cicloId);

      const listaErrores = errores.length
        ? `<div class="form-error" style="margin-top:10px;">
            <strong>${errores.length} fila(s) con problemas:</strong>
            <ul style="margin:6px 0 0; padding-left:20px;">${errores.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
          </div>`
        : "";

      resultadoDiv.innerHTML = `
        <div class="stat-row"><span>Asignaciones creadas</span><strong>${creadas}</strong></div>
        ${listaErrores}
      `;

      if (creadas > 0) {
        Toast.success("Importación completada", `${creadas} asignación(es) creada(s).`);
      }
    } catch (e) {
      Toast.error("Error al importar", e.message || "Revisa que el archivo tenga el formato correcto.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Importar";
    }
  });
}

/**
 * Maestro del ciclo. El aviso de éxito dice cuántos faltan por autoevaluarse:
 * es el dato por el que se descarga el documento, y tenerlo antes de abrirlo
 * ahorra el viaje.
 */
async function manejarMaestro(cicloId, btn) {
  const texto = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando...";
  try {
    const { descargarMaestro } = await import("../ui/exportar-maestro.js");
    const res = await descargarMaestro(cicloId);
    const faltan = res?.sin_autoevaluar ?? 0;
    if (faltan > 0) {
      Toast.warning(
        `${faltan === 1 ? "Falta 1 persona" : `Faltan ${faltan} personas`} por autoevaluarse`,
        res?.autoeval_vencida ? "El plazo de autoevaluación ya venció." : "El plazo sigue abierto."
      );
    } else {
      Toast.success("Maestro descargado", "Todo el ciclo tiene su autoevaluación hecha.");
    }
  } catch (e) {
    console.error("[personal] Error al generar el maestro:", e);
    Toast.error("No se pudo generar el maestro", e.message || "Error desconocido");
  } finally {
    btn.disabled = false;
    btn.textContent = texto;
  }
}

async function manejarExportar(evaluacionId, btn) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando...";

  try {
    // La carga vive en el módulo de exportación: las tres pantallas que
    // descargan el expediente — esta, «Tu evaluación» y la Ficha — usan la
    // misma consulta en lugar de tener cada una su copia.
    const { descargarExpediente } = await import("../ui/exportar-evaluacion.js");
    const nombre = await descargarExpediente(evaluacionId);
    Toast.success("Expediente descargado", nombre ? `Evaluación de ${nombre}.` : "");
  } catch (e) {
    console.error("[personal] Error al exportar:", e);
    Toast.error("Error al exportar", e.message || "Error desconocido");
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

/** Atajo a la propia ficha: cada persona puede ver su evolución en el tiempo. */
const BOTON_MI_EVOLUCION = `
  <div style="margin-bottom:16px;">
    <button class="btn btn-primary" id="btn-mi-evolucion">📈 Ver mi evolución</button>
  </div>`;

function engancharMiEvolucion(container) {
  const btn = document.getElementById("btn-mi-evolucion");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", state.user.id).single();
    if (!perfil) {
      Toast.error("No se pudo abrir tu ficha", "No encontramos tu perfil.");
      return;
    }
    const { renderFichaTrabajador } = await import("./trabajador-ficha.js");
    await renderFichaTrabajador(container, perfil, { volver: () => window.Router.go("personal") });
  });
}

async function renderMisEvaluaciones(container) {
  const uid = state.user.id;
  const { data: evaluaciones, error } = await supabase
    .from("eva_evaluaciones")
    .select("*, ciclo:ciclo_id(titulo), evaluado:evaluado_id(nombre), evaluador:evaluador_id(nombre)")
    .or(`evaluado_id.eq.${uid},evaluador_id.eq.${uid}`)
    .order("id", { ascending: false });

  if (error) {
    container.innerHTML = `<div class="placeholder error"><h2>Error</h2><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  if (!evaluaciones || !evaluaciones.length) {
    container.innerHTML = `
      ${BOTON_MI_EVOLUCION}
      <div class="empty-state"><p>No tienes evaluaciones asignadas todavía.</p></div>`;
    engancharMiEvolucion(container);
    return;
  }

  const filas = evaluaciones
    .map((e) => {
      const soyEvaluado = e.evaluado_id === uid;
      const rolTexto = soyEvaluado ? "Mi autoevaluación" : `Evaluar a ${escapeHtml(e.evaluado?.nombre || "—")}`;
      const accion = accionDisponible(e, soyEvaluado);
      const vePDI = PDI_VISIBLE.includes(e.estado);
      // Si es su propia evaluación, desde que RRHH le entregó el resultado.
      // Si es de alguien a quien evalúa, en los mismos estados que ya exporta
      // RRHH. La base decide de verdad; acá sólo se dibuja o no el botón.
      const veExpediente = soyEvaluado
        ? DESCARGABLE_EVALUADO.includes(e.estado)
        : EXPORTABLES.includes(e.estado);
      return `
      <tr>
        <td>${escapeHtml(e.ciclo?.titulo || "—")}</td>
        <td>${rolTexto}</td>
        <td><span class="badge ${ESTADO_BADGE[e.estado] || "badge-neutral"}">${ESTADO_LABELS[e.estado] || e.estado}</span></td>
        <td>
          ${accion ? `<button class="btn btn-secondary" data-abrir="${e.id}" data-modo="${accion.modo}">${accion.texto}</button>` : ""}
          ${vePDI ? `<button class="btn btn-secondary" data-pdi-mis="${e.id}">PDI</button>` : ""}
          ${veExpediente ? `<button class="btn btn-secondary" data-exportar="${e.id}">⬇ Excel</button>` : ""}
          ${!accion && !vePDI && !veExpediente ? "—" : ""}
        </td>
      </tr>`;
    })
    .join("");

  container.innerHTML = `
    ${BOTON_MI_EVOLUCION}
    <div class="card">
      <h3>Mis evaluaciones</h3>
      <table class="data-table">
        <thead><tr><th>Ciclo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;

  engancharMiEvolucion(container);

  container.querySelectorAll("[data-abrir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = evaluaciones.find((e) => e.id === btn.dataset.abrir);
      if (ev) abrirPaso(container, ev, btn.dataset.modo);
    });
  });

  container.querySelectorAll("[data-pdi-mis]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = evaluaciones.find((e) => e.id === btn.dataset.pdiMis);
      renderPDI(container, ev);
    });
  });

  container.querySelectorAll("[data-exportar]").forEach((btn) => {
    btn.addEventListener("click", () => manejarExportar(btn.dataset.exportar, btn));
  });
}


