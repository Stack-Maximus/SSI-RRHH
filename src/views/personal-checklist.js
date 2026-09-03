/**
 * Checklist de la entrevista one-to-one — Hoja 10 de la planilla oficial,
 * pauta RRHH-INS-EVA-AD-002.
 *
 * Son 24 ítems en tres bloques y cada bloque se llena en su momento del flujo:
 *
 *   antes    → al agendar la entrevista (lo que hay que preparar)
 *   durante  → al marcarla como realizada (el guion de 6 etapas)
 *   despues  → al definir el plan y cerrar (el trámite del expediente)
 *
 * Tres respuestas posibles por ítem, igual que en la planilla: SÍ / NO / N/A,
 * con observaciones. Los N/A no cuentan en el denominador del cumplimiento;
 * los NO son los que quedan como pendientes de regularizar.
 *
 * Esto es la pauta de trabajo del evaluador, no un documento dirigido al
 * evaluado: en la planilla es una hoja del expediente y acá el evaluado no la
 * ve (lo garantiza RLS, no solo la interfaz).
 */

import { supabase } from "../core/supabase.js";
import { state } from "../core/state.js";
import { Toast } from "../ui/toast.js";
import { escapeHtml } from "../ui/utils.js";
import { CHECKLIST_BLOQUES, CHECKLIST_RESPUESTAS } from "./personal-flujo.js";

let cacheItems = null;

async function cargarItems() {
  if (cacheItems) return cacheItems;
  const { data } = await supabase
    .from("eva_checklist_items")
    .select("codigo, bloque, orden, texto, obligatorio")
    .eq("activo", true)
    .order("orden");
  cacheItems = data || [];
  return cacheItems;
}

/**
 * Devuelve el HTML del checklist de un bloque, ya con lo respondido antes.
 * @param {string} evaluacionId
 * @param {"antes"|"durante"|"despues"} bloque
 * @param {{soloLectura?: boolean}} opciones
 */
export async function checklistHTML(evaluacionId, bloque, { soloLectura = false } = {}) {
  const [items, { data: respuestas }] = await Promise.all([
    cargarItems(),
    supabase.from("eva_checklist_respuestas").select("item_codigo, cumplido, observaciones").eq("evaluacion_id", evaluacionId),
  ]);

  const delBloque = items.filter((i) => i.bloque === bloque);
  if (!delBloque.length) {
    return `<div class="ficha-seccion-vacia">
      No hay ítems de checklist cargados. Falta correr <code>database/migracion_eva_flujo_bienestar.sql</code>
      y <code>database/migracion_eva_acta_v2.sql</code>.
    </div>`;
  }

  const previas = {};
  (respuestas || []).forEach((r) => (previas[r.item_codigo] = r));

  const meta = CHECKLIST_BLOQUES[bloque];
  const respondidos = delBloque.filter((i) => previas[i.codigo]?.cumplido).length;
  const oblig = delBloque.filter((i) => i.obligatorio);
  const obligOk = oblig.filter((i) => previas[i.codigo]?.cumplido === "si").length;

  return `
    <div class="checklist" data-checklist="${escapeHtml(bloque)}" data-evaluacion="${escapeHtml(evaluacionId)}">
      <div class="checklist-head">
        <div>
          <h4>${escapeHtml(meta.titulo)}</h4>
          <p class="hint">${escapeHtml(meta.subtitulo)}</p>
        </div>
        <span class="checklist-contador" data-contador>${respondidos} de ${delBloque.length}</span>
      </div>

      ${oblig.length
        ? `<p class="checklist-nota-oblig">
             ${obligOk} de ${oblig.length} ítems obligatorios cumplidos. Los marcados
             <span class="checklist-marca-oblig">obligatorio</span> son los que la pauta exige para considerar la
             entrevista realizada conforme (RRHH-INS-EVA-AD-002).
           </p>`
        : ""}

      ${delBloque
        .map((i) => {
          const prev = previas[i.codigo] || {};
          return `
        <div class="checklist-item ${prev.cumplido === "no" ? "is-no" : ""} ${
          i.obligatorio && prev.cumplido !== "si" ? "is-oblig-pendiente" : ""
        }" data-item="${escapeHtml(i.codigo)}">
          <span class="checklist-codigo">${escapeHtml(i.codigo)}</span>
          <div class="checklist-cuerpo">
            <p class="checklist-texto">
              ${escapeHtml(i.texto)}
              ${i.obligatorio ? `<span class="checklist-marca-oblig">obligatorio</span>` : ""}
            </p>
            <div class="checklist-opciones" role="group" aria-label="${escapeHtml(i.texto)}">
              ${CHECKLIST_RESPUESTAS.map(
                (r) => `
                <label class="checklist-opcion ${prev.cumplido === r.valor ? `is-sel is-${r.valor}` : ""}">
                  <input type="radio" name="chk-${escapeHtml(i.codigo)}" value="${r.valor}"
                         ${prev.cumplido === r.valor ? "checked" : ""} ${soloLectura ? "disabled" : ""}>
                  <span>${r.label}</span>
                </label>`
              ).join("")}
            </div>
            <input type="text" class="checklist-obs" data-obs placeholder="Observación (opcional)"
                   value="${escapeHtml(prev.observaciones || "")}" ${soloLectura ? "disabled" : ""}>
          </div>
        </div>`;
        })
        .join("")}

      ${
        soloLectura
          ? ""
          : `<p class="hint" style="margin-top:10px;">
              Se guarda junto con el resto del formulario. Un ítem en <strong>No</strong> no bloquea nada, pero queda
              registrado como pendiente de regularizar en el expediente.
             </p>`
      }
    </div>`;
}

/** Enciende la interacción visual (marcar la opción elegida, resaltar los «No»). */
export function engancharChecklist(root) {
  root.querySelectorAll(".checklist-item").forEach((item) => {
    item.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        item.querySelectorAll(".checklist-opcion").forEach((op) => {
          op.classList.remove("is-sel", "is-si", "is-no", "is-na");
        });
        const label = radio.closest(".checklist-opcion");
        label.classList.add("is-sel", `is-${radio.value}`);
        item.classList.toggle("is-no", radio.value === "no");
        actualizarContador(item.closest(".checklist"));
      });
    });
  });
}

function actualizarContador(bloque) {
  if (!bloque) return;
  const cont = bloque.querySelector("[data-contador]");
  if (!cont) return;
  const total = bloque.querySelectorAll(".checklist-item").length;
  const hechos = [...bloque.querySelectorAll(".checklist-item")].filter((i) => i.querySelector('input[type="radio"]:checked')).length;
  cont.textContent = `${hechos} de ${total}`;
}

/**
 * Guarda lo respondido de un bloque. Sube solo los ítems que tienen respuesta:
 * dejar uno en blanco no borra lo que hubiera antes.
 */
export async function guardarChecklist(root, evaluacionId, bloque) {
  const cont = root.querySelector(`.checklist[data-checklist="${bloque}"]`);
  if (!cont) return { ok: true, guardados: 0 };

  const filas = [];
  cont.querySelectorAll(".checklist-item").forEach((item) => {
    const marcado = item.querySelector('input[type="radio"]:checked');
    if (!marcado) return;
    filas.push({
      evaluacion_id: evaluacionId,
      item_codigo: item.dataset.item,
      cumplido: marcado.value,
      observaciones: item.querySelector("[data-obs]")?.value.trim() || null,
      registrado_por: state.user?.id || null,
    });
  });

  if (!filas.length) return { ok: true, guardados: 0 };

  const { error } = await supabase
    .from("eva_checklist_respuestas")
    .upsert(filas, { onConflict: "evaluacion_id,item_codigo" });

  if (error) {
    Toast.error("No se pudo guardar el checklist", error.message);
    return { ok: false, guardados: 0 };
  }
  return { ok: true, guardados: filas.length };
}

/**
 * Resumen de cumplimiento, como el pie de la hoja del checklist.
 *
 * La v2.0 de la pauta marca qué ítems son obligatorios y dice que sin ellos «la
 * entrevista no se considera realizada conforme a la pauta». Antes este resumen
 * contaba todo por igual, así que un evaluador podía ir 22 de 24 e ir
 * incumpliendo justamente los dos que importaban. Ahora lo obligatorio se
 * cuenta y se muestra aparte.
 */
export async function resumenChecklistHTML(evaluacionId) {
  const { data, error } = await supabase.rpc("eva_checklist_resumen", { p_evaluacion_id: evaluacionId });
  if (error || !data?.length) return "";

  const totalAplicables = data.reduce((a, b) => a + (b.total - b.no_aplica), 0);
  const totalCumplidos = data.reduce((a, b) => a + b.cumplidos, 0);
  const totalNo = data.reduce((a, b) => a + b.no_cumplidos, 0);
  const oblig = data.reduce((a, b) => a + (b.obligatorios || 0), 0);
  const obligOk = data.reduce((a, b) => a + (b.obligatorios_cumplidos || 0), 0);
  // conforme_pauta viene por bloque; conforme de verdad es cuando lo están todos.
  const conforme = oblig > 0 && data.every((b) => b.conforme_pauta);

  return `
    <div class="checklist-resumen">
      <div class="checklist-resumen-total">
        <span class="eva-total-label">Cumplimiento de la pauta</span>
        <strong>${totalCumplidos} de ${totalAplicables}</strong>
        <span class="hint">ítems cumplidos sobre los aplicables${totalNo ? ` · ${totalNo} pendiente${totalNo === 1 ? "" : "s"} de regularizar` : ""}</span>
      </div>

      ${oblig
        ? `<div class="checklist-oblig ${conforme ? "is-ok" : "is-falta"}">
             <span class="checklist-oblig-icono" aria-hidden="true">${conforme ? "✓" : "!"}</span>
             <div>
               <strong>${obligOk} de ${oblig} ítems obligatorios</strong>
               <span class="hint">${
                 conforme
                   ? "La entrevista se considera realizada conforme a la pauta."
                   : `Faltan ${oblig - obligOk}. Sin ellos la entrevista no se considera realizada conforme a la pauta ` +
                     `(RRHH-INS-EVA-AD-002). No bloquea el cierre, pero queda registrado en el expediente.`
               }</span>
             </div>
           </div>`
        : ""}

      <div class="checklist-resumen-bloques">
        ${data
          .map((b) => {
            const meta = CHECKLIST_BLOQUES[b.bloque];
            const aplicables = b.total - b.no_aplica;
            const faltanOblig = (b.obligatorios || 0) - (b.obligatorios_cumplidos || 0);
            return `
            <div class="checklist-resumen-bloque">
              <span class="hint">${escapeHtml(meta?.titulo || b.bloque)}</span>
              <strong>${b.cumplidos}/${aplicables || b.total}</strong>
              ${faltanOblig ? `<span class="badge badge-danger">${faltanOblig} obligatorio${faltanOblig === 1 ? "" : "s"} sin cumplir</span>` : ""}
              ${b.no_cumplidos ? `<span class="badge badge-danger">${b.no_cumplidos} en No</span>` : ""}
              ${b.respondidos < b.total ? `<span class="badge badge-warning">${b.total - b.respondidos} sin responder</span>` : ""}
            </div>`;
          })
          .join("")}
      </div>
    </div>`;
}
