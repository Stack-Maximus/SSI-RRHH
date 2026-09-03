/**
 * Formulario de calificación de un área sobre un proveedor: solo ve los
 * criterios de SU área (filtrados por aplica='ambas' o la categoría de la
 * evaluación). Al enviar, si las 6 áreas ya calificaron, dispara la
 * consolidación automática (total ponderado, veto, clasificación A-B-C-D).
 */

import { supabase } from "../core/supabase.js";
import { Toast, Confirm } from "../ui/toast.js";
import { escapeHtml } from "../ui/utils.js";

const AREAS = ["gol", "gfc", "gi", "go", "gsst", "rrhh"];

export async function renderCalificarProveedor(container, evaluacion, area) {
  container.innerHTML = `<div class="view-loading">Cargando formulario...</div>`;

  const { data: criterios } = await supabase
    .from("prov_criterios")
    .select("*")
    .eq("area", area)
    .or(`aplica.eq.ambas,aplica.eq.${evaluacion.categoria_aplicada}`)
    .order("orden");

  const respuestas = {};

  const filas = (criterios || [])
    .map((c) => {
      const botones = [1, 2, 3, 4, 5]
        .map((n) => `<button type="button" class="escala-btn" data-criterio="${c.codigo}" data-nota="${n}">${n}</button>`)
        .join("");
      return `
      <div class="criterio-row" data-criterio-row="${c.codigo}">
        <div class="criterio-texto">
          ${escapeHtml(c.texto)}
          ${c.veto ? '<span class="badge badge-danger" style="margin-left:8px;">Criterio con veto</span>' : ""}
        </div>
        <div class="escala-selector">
          ${botones}
          <label style="margin-left:12px; font-size:12.5px; display:flex; align-items:center; gap:4px;">
            <input type="checkbox" data-na="${c.codigo}" style="width:auto;"> No aplica
          </label>
        </div>
        <textarea class="criterio-comentario" data-comentario="${c.codigo}"
                  placeholder="Comentario / evidencia (obligatorio si marcas 'No aplica' o nota 1-2)"></textarea>
      </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="view-form eva-form">
      <button class="btn btn-secondary" id="btn-volver-prov" style="margin-bottom:16px;">← Volver</button>
      <div class="card">
        <h3>${escapeHtml(evaluacion.proveedor?.razon_social || "Proveedor")}</h3>
        <p class="lead" style="margin-bottom:16px;">Calificando como área ${area.toUpperCase()}</p>
        ${filas}
        <div class="eva-sticky-footer">
          <span class="eva-progreso" id="eva-progreso"></span>
          <button class="btn btn-primary" id="btn-enviar-prov">Enviar calificación</button>
        </div>
      </div>
    </div>
  `;

  function actualizarProgreso() {
    const total = (criterios || []).length;
    const respondidos = Object.keys(respuestas).filter((k) => respuestas[k]?.nota || respuestas[k]?.na).length;
    document.getElementById("eva-progreso").textContent = `${respondidos} / ${total} criterios`;
  }
  actualizarProgreso();

  container.querySelectorAll(".escala-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const codigo = btn.dataset.criterio;
      const nota = Number(btn.dataset.nota);
      respuestas[codigo] = { ...(respuestas[codigo] || {}), nota, na: false };
      container.querySelectorAll(`[data-criterio-row="${codigo}"] .escala-btn`).forEach((b) => {
        b.classList.toggle("selected", Number(b.dataset.nota) === nota);
      });
      container.querySelector(`[data-na="${codigo}"]`).checked = false;
      actualizarProgreso();
    });
  });

  container.querySelectorAll("[data-na]").forEach((chk) => {
    chk.addEventListener("change", () => {
      const codigo = chk.dataset.na;
      respuestas[codigo] = { ...(respuestas[codigo] || {}), na: chk.checked, nota: chk.checked ? null : respuestas[codigo]?.nota };
      if (chk.checked) {
        container.querySelectorAll(`[data-criterio-row="${codigo}"] .escala-btn`).forEach((b) => b.classList.remove("selected"));
      }
      actualizarProgreso();
    });
  });

  container.querySelectorAll(".criterio-comentario").forEach((ta) => {
    ta.addEventListener("input", () => {
      const codigo = ta.dataset.comentario;
      respuestas[codigo] = { ...(respuestas[codigo] || {}), comentario: ta.value };
    });
  });

  document.getElementById("btn-volver-prov").addEventListener("click", () => window.Router.go("proveedores"));

  document.getElementById("btn-enviar-prov").addEventListener("click", async () => {
    await enviarCalificacion({ evaluacion, area, criterios: criterios || [], respuestas });
  });
}

async function enviarCalificacion({ evaluacion, area, criterios, respuestas }) {
  const faltantes = criterios.filter((c) => !respuestas[c.codigo]?.nota && !respuestas[c.codigo]?.na);
  if (faltantes.length) {
    Toast.warning("Formulario incompleto", `Faltan ${faltantes.length} criterios por calificar o marcar "No aplica".`);
    return;
  }

  const sinComentario = criterios.filter((c) => {
    const r = respuestas[c.codigo];
    return (r.na || r.nota <= 2) && !r.comentario?.trim();
  });
  if (sinComentario.length) {
    Toast.warning("Falta justificar", 'Toda nota 1-2 o "No aplica" necesita un comentario.');
    return;
  }

  const ok = await Confirm.ask({
    title: "¿Enviar calificación?",
    text: "No podrás editar tus respuestas después de enviarlas.",
    confirmText: "Enviar",
  });
  if (!ok) return;

  const filas = criterios.map((c) => ({
    evaluacion_id: evaluacion.id,
    area,
    criterio_codigo: c.codigo,
    nota: respuestas[c.codigo].na ? null : respuestas[c.codigo].nota,
    na: !!respuestas[c.codigo].na,
    justificacion_na: respuestas[c.codigo].na ? respuestas[c.codigo].comentario : null,
    comentario: !respuestas[c.codigo].na ? respuestas[c.codigo].comentario || null : null,
  }));

  await supabase.from("prov_detalle").delete().eq("evaluacion_id", evaluacion.id).eq("area", area);
  const { error: errIns } = await supabase.from("prov_detalle").insert(filas);
  if (errIns) {
    Toast.error("Error al guardar", errIns.message);
    return;
  }

  const calificadas = filas.filter((f) => f.nota != null);
  const notaArea = calificadas.length ? calificadas.reduce((acc, f) => acc + f.nota, 0) / calificadas.length : null;

  await supabase
    .from("prov_evaluaciones")
    .update({ [`nota_${area}`]: notaArea ? Math.round(notaArea * 100) / 100 : null, estado: "en_evaluacion" })
    .eq("id", evaluacion.id);

  Toast.success("Calificación enviada", "Tu área quedó registrada.");

  await intentarConsolidar(evaluacion.id);

  window.Router.go("proveedores");
}

/**
 * Revisa si las 6 áreas ya calificaron y, si es así, consolida: total
 * ponderado, veto, clasificación A-B-C-D. Se puede llamar automáticamente
 * al enviar la sexta calificación, o manualmente desde el botón
 * "Reintentar consolidación" del panel del Comité si por algún motivo no
 * se disparó sola.
 */
export async function intentarConsolidar(evaluacionId) {
  const { data, error } = await supabase.rpc("intentar_consolidar_proveedor", { p_evaluacion_id: evaluacionId });
  console.log("[consolidar] resultado RPC:", data, error);

  if (error) {
    Toast.error("Error al consolidar", error.message);
    return false;
  }

  if (data?.consolidado) {
    Toast.info("Evaluación consolidada", "Las 6 áreas ya calificaron — pasa a revisión del comité.");
    return true;
  }

  if (data?.motivo === "faltan_areas") {
    console.log("[consolidar] Áreas presentes:", data.areas_presentes);
    return false; // normal mientras falten áreas por calificar
  }

  Toast.warning("No se pudo consolidar", data?.motivo || "Motivo desconocido");
  return false;
}
