/**
 * Formulario de calificación: lo usan tanto el trabajador (autoevaluación) como
 * su jefatura (evaluación).
 *
 * Los criterios YA NO son siempre los 30. Se piden a eva_criterios_de_evaluacion,
 * que devuelve los que aplican a la familia del cargo de la persona: a un Jornal
 * no se le pregunta por «cumplimiento de plazos legales y reportes obligatorios»
 * si RRHH marcó que eso no le toca.
 *
 * Dos cosas que se siguen de eso y conviene tener presentes al leer este archivo:
 *
 *   · El caché es POR EVALUACIÓN, no global. Antes se cacheaba el catálogo
 *     completo una vez; ahora dos personas de familias distintas ven conjuntos
 *     distintos, y un caché global les daría el de quien abrió primero.
 *   · El promedio de cada dimensión divide por los criterios que se calificaron,
 *     no por 6. Eso hace que quitar criterios ajuste solo y el total ponderado
 *     siga dando lo mismo. Pero una dimensión con CERO criterios daría 0/0 y el
 *     total saldría NaN: la base lo impide con un trigger, y acá igual se filtran
 *     las dimensiones vacías por si acaso.
 *
 * La pantalla de conformidad que vivía acá se fue a personal-resultado.js: el
 * flujo nuevo la parte en etapas (ver resultados → acusar recibo → reunión 1:1
 * → recién ahí las preguntas de cierre), y mezclarla con este formulario
 * dejaba de tener sentido. El modo "conformidad" se mantiene como alias para
 * no romper ningún enlace viejo.
 */

import { supabase } from "../core/supabase.js";
import { Toast, Confirm } from "../ui/toast.js";
import { escapeHtml } from "../ui/utils.js";

/** Caché por evaluación: cada familia tiene su propio conjunto de criterios. */
const catalogoCache = new Map();

async function cargarCatalogo(evaluacionId) {
  if (catalogoCache.has(evaluacionId)) return catalogoCache.get(evaluacionId);

  const [{ data: dimensiones }, { data: criterios, error }] = await Promise.all([
    supabase.from("eva_dimensiones").select("*").order("orden"),
    supabase.rpc("eva_criterios_de_evaluacion", { p_evaluacion_id: evaluacionId }),
  ]);

  // Si la función todavía no existe (falta la migración del filtro por cargo),
  // se cae al catálogo completo en lugar de dejar el formulario en blanco.
  let lista = criterios;
  if (error || !lista) {
    const { data: todos } = await supabase.from("eva_criterios").select("*").order("orden");
    lista = todos || [];
  }

  // Una dimensión sin criterios no se dibuja: no hay nada que preguntar y su
  // promedio sería una división por cero.
  const dims = (dimensiones || []).filter((d) => lista.some((c) => c.dimension_codigo === d.codigo));

  const cat = { dimensiones: dims, criterios: lista };
  catalogoCache.set(evaluacionId, cat);
  return cat;
}

export async function renderAutoevaluacion(container, evaluacion, modo) {
  if (modo === "conformidad" || modo === "resultado") {
    const { renderResultadoEvaluado } = await import("./personal-resultado.js");
    await renderResultadoEvaluado(container, evaluacion.id);
    return;
  }

  container.innerHTML = `<div class="view-loading">Cargando formulario...</div>`;

  const { dimensiones, criterios } = await cargarCatalogo(evaluacion.id);
  const tablaDetalle = modo === "autoevaluacion" ? "eva_detalle_auto" : "eva_detalle_sup";
  const campoComentario = modo === "autoevaluacion" ? "comentario" : "comentario_evidencia";

  const { data: existentes } = await supabase.from(tablaDetalle).select("*").eq("evaluacion_id", evaluacion.id);

  const respuestas = {};
  (existentes || []).forEach((d) => {
    respuestas[d.criterio_codigo] = { nota: d.nota, comentario: d[campoComentario] };
  });

  const bloques = dimensiones
    .map((dim) => {
      const criteriosDim = criterios.filter((c) => c.dimension_codigo === dim.codigo);
      const filas = criteriosDim
        .map((c) => {
          const prev = respuestas[c.codigo] || {};
          const botones = [1, 2, 3, 4, 5]
            .map(
              (n) => `
            <button type="button" class="escala-btn ${prev.nota === n ? "selected" : ""}"
                    data-criterio="${c.codigo}" data-nota="${n}">${n}</button>`
            )
            .join("");
          return `
          <div class="criterio-row" data-criterio-row="${c.codigo}">
            <div class="criterio-texto">${escapeHtml(c.texto_criterio)}</div>
            <div class="escala-selector">${botones}</div>
            <textarea class="criterio-comentario" data-comentario="${c.codigo}"
                      placeholder="Comentario (obligatorio si la nota es 1 o 2)">${escapeHtml(prev.comentario || "")}</textarea>
          </div>`;
        })
        .join("");

      return `
      <div class="dimension-block">
        <div class="dimension-header">
          <h3>${escapeHtml(dim.nombre)}</h3>
          <span class="dimension-peso">Peso ${Math.round(dim.peso * 100)}%</span>
        </div>
        ${filas}
      </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="view-form eva-form">
      <button class="btn btn-secondary" id="btn-volver-eva" style="margin-bottom:16px;">← Volver</button>
      <div class="card">
        ${bloques}
        <div class="eva-sticky-footer">
          <span class="eva-progreso" id="eva-progreso"></span>
          <button class="btn btn-primary" id="btn-enviar-eva">
            ${modo === "autoevaluacion" ? "Enviar autoevaluación" : "Enviar evaluación"}
          </button>
        </div>
      </div>
    </div>
  `;

  function actualizarProgreso() {
    const total = criterios.length;
    const respondidos = Object.keys(respuestas).filter((k) => respuestas[k]?.nota).length;
    document.getElementById("eva-progreso").textContent = `${respondidos} / ${total} criterios calificados`;
  }
  actualizarProgreso();

  container.querySelectorAll(".escala-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const codigo = btn.dataset.criterio;
      const nota = Number(btn.dataset.nota);
      respuestas[codigo] = { ...(respuestas[codigo] || {}), nota };
      container.querySelectorAll(`[data-criterio-row="${codigo}"] .escala-btn`).forEach((b) => {
        b.classList.toggle("selected", Number(b.dataset.nota) === nota);
      });
      actualizarProgreso();
    });
  });

  container.querySelectorAll(".criterio-comentario").forEach((ta) => {
    ta.addEventListener("input", () => {
      const codigo = ta.dataset.comentario;
      respuestas[codigo] = { ...(respuestas[codigo] || {}), comentario: ta.value };
    });
  });

  document.getElementById("btn-volver-eva").addEventListener("click", () => window.Router.go("personal"));

  document.getElementById("btn-enviar-eva").addEventListener("click", async () => {
    await enviarFormulario({ evaluacion, modo, criterios, dimensiones, respuestas, tablaDetalle, campoComentario });
  });
}

async function enviarFormulario({ evaluacion, modo, criterios, dimensiones, respuestas, tablaDetalle, campoComentario }) {
  const faltantes = criterios.filter((c) => !respuestas[c.codigo]?.nota);
  if (faltantes.length) {
    Toast.warning("Formulario incompleto", `Faltan ${faltantes.length} criterios por calificar.`);
    return;
  }

  const sinComentarioObligatorio = criterios.filter((c) => {
    const r = respuestas[c.codigo];
    return r.nota <= 2 && !r.comentario?.trim();
  });
  if (sinComentarioObligatorio.length) {
    Toast.warning("Falta justificar", "Toda nota de 1 o 2 necesita un comentario.");
    return;
  }

  const ok = await Confirm.ask({
    title: modo === "autoevaluacion" ? "¿Enviar autoevaluación?" : "¿Enviar evaluación?",
    text: "No podrás editar las respuestas después de enviarlas.",
    confirmText: "Enviar",
  });
  if (!ok) return;

  const filas = criterios.map((c) => ({
    evaluacion_id: evaluacion.id,
    criterio_codigo: c.codigo,
    nota: respuestas[c.codigo].nota,
    [campoComentario]: respuestas[c.codigo].comentario || null,
  }));

  await supabase.from(tablaDetalle).delete().eq("evaluacion_id", evaluacion.id);
  const { error: errorInsert } = await supabase.from(tablaDetalle).insert(filas);
  if (errorInsert) {
    Toast.error("Error al guardar", errorInsert.message);
    return;
  }

  const promedios = {};
  dimensiones.forEach((dim) => {
    const criteriosDim = criterios.filter((c) => c.dimension_codigo === dim.codigo);
    const suma = criteriosDim.reduce((acc, c) => acc + respuestas[c.codigo].nota, 0);
    promedios[dim.codigo] = suma / criteriosDim.length;
  });
  const totalPonderado = dimensiones.reduce((acc, dim) => acc + promedios[dim.codigo] * dim.peso, 0);

  const prefijo = modo === "autoevaluacion" ? "prom_auto_" : "prom_sup_";
  const updateFields = {};
  dimensiones.forEach((dim) => {
    updateFields[`${prefijo}${dim.codigo.toLowerCase()}`] = Math.round(promedios[dim.codigo] * 100) / 100;
  });

  if (modo === "autoevaluacion") {
    updateFields.total_auto = Math.round(totalPonderado * 100) / 100;
    updateFields.estado = "autoevaluacion_enviada";
    updateFields.fecha_envio_autoeval = new Date().toISOString();
  } else {
    const { data: evalRow } = await supabase
      .from("eva_evaluaciones")
      .select("prom_auto_tc,prom_auto_ss,prom_auto_dl,prom_auto_vh,prom_auto_cm,total_auto")
      .eq("id", evaluacion.id)
      .single();

    dimensiones.forEach((dim) => {
      const campoAuto = `prom_auto_${dim.codigo.toLowerCase()}`;
      const campoBrecha = `brecha_${dim.codigo.toLowerCase()}`;
      if (evalRow?.[campoAuto] != null) {
        updateFields[campoBrecha] = Math.round((promedios[dim.codigo] - evalRow[campoAuto]) * 100) / 100;
      }
    });

    updateFields.total_sup = Math.round(totalPonderado * 100) / 100;
    updateFields.estado = "consolidada";
    updateFields.fecha_envio_evaluacion = new Date().toISOString();

    if (evalRow?.total_auto != null) {
      updateFields.brecha_total = Math.round((totalPonderado - evalRow.total_auto) * 100) / 100;
    }

    const { data: catData } = await supabase.rpc("eva_categoria_y_decision", { p_promedio: totalPonderado });
    if (catData && catData[0]) {
      updateFields.categoria = catData[0].categoria;
      updateFields.decision_asociada = catData[0].decision_asociada;
    }
  }

  const { error: errorUpdate } = await supabase.from("eva_evaluaciones").update(updateFields).eq("id", evaluacion.id);

  if (errorUpdate) {
    Toast.error("Error al actualizar", errorUpdate.message);
    return;
  }

  Toast.success(
    "Enviado correctamente",
    modo === "autoevaluacion" ? "Tu autoevaluación fue registrada." : "La evaluación fue consolidada."
  );
  window.Router.go("personal");
}
