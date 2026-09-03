/**
 * Plan de Desarrollo Individual (PDI) — vive dentro de una evaluación de
 * personal ya entregada. RRHH y el evaluador lo construyen junto al
 * trabajador (normalmente en una entrevista); el evaluado solo lo puede
 * ver, no editarlo unilateralmente.
 */

import { supabase } from "../core/supabase.js";
import { state } from "../core/state.js";
import { Toast, Confirm } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";

import { PDI_ESTADO_LABELS as ESTADO_LABELS, PDI_ESTADO_BADGE as ESTADO_BADGE } from "./personal-flujo.js";

export async function renderPDI(container, evaluacion) {
  container.innerHTML = `<div class="view-loading">Cargando PDI...</div>`;

  const [{ data: acciones, error }, { data: perfiles }] = await Promise.all([
    supabase.from("eva_pdi").select("*").eq("evaluacion_id", evaluacion.id).order("nro"),
    supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  if (error) {
    container.innerHTML = `<div class="placeholder error"><h2>Error</h2><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  const rolPersonal = state.accesos.find((a) => a.modulo === "personal")?.rol;
  const puedeEditar = state.user.esAdmin || rolPersonal === "rrhh" || evaluacion.evaluador_id === state.user.id;

  const filas = (acciones || []).length
    ? acciones
        .map(
          (a) => `
      <tr>
        <td>${a.nro ?? "—"}</td>
        <td>${escapeHtml(a.dimension_criterio || "—")}</td>
        <td>${escapeHtml(a.accion_smart || "—")}</td>
        <td>${escapeHtml(a.responsable_apoyo || "—")}</td>
        <td>${formatDate(a.fecha_cierre) || "—"}</td>
        <td><span class="badge ${ESTADO_BADGE[a.estado_accion] || "badge-neutral"}">${ESTADO_LABELS[a.estado_accion] || a.estado_accion}</span></td>
        <td>${puedeEditar ? `<button class="btn btn-secondary" data-editar-pdi="${a.id}">Editar</button>` : "—"}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="empty-state">Sin acciones de desarrollo registradas todavía.</td></tr>`;

  container.innerHTML = `
    <div class="view-form">
      <button class="btn btn-secondary" id="btn-volver-pdi" style="margin-bottom:16px;">← Volver</button>

      <div class="card">
        <h3>Plan de Desarrollo Individual</h3>
        <p class="lead">${escapeHtml(evaluacion.evaluado?.nombre || "—")} — ${escapeHtml(evaluacion.ciclo?.titulo || "")}</p>

        ${
          puedeEditar
            ? `
        <div class="form-grid-2" style="margin-top:16px;">
          <div class="form-field"><label class="form-label">Fecha de entrevista</label><input type="date" id="pdi-fecha-entrevista" value="${evaluacion.fecha_entrevista || ""}"></div>
          <div class="form-field"><label class="form-label">Cierre estimado del PDI</label><input type="date" id="pdi-fecha-cierre-estimada" value="${evaluacion.fecha_cierre_pdi_estimada || ""}"></div>
        </div>
        <button class="btn btn-secondary" id="btn-guardar-fechas-pdi">Guardar fechas</button>
        `
            : `
        <div class="stat-row"><span>Fecha de entrevista</span><span>${formatDate(evaluacion.fecha_entrevista) || "—"}</span></div>
        <div class="stat-row"><span>Cierre estimado</span><span>${formatDate(evaluacion.fecha_cierre_pdi_estimada) || "—"}</span></div>
        `
        }
      </div>

      <div class="card" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Acciones de desarrollo</h3>
          ${puedeEditar ? `<button class="btn btn-primary" id="btn-agregar-pdi">+ Agregar acción</button>` : ""}
        </div>
        <table class="data-table">
          <thead><tr><th>N°</th><th>Dimensión/criterio</th><th>Acción SMART</th><th>Apoyo</th><th>Cierre</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <p class="hint" style="margin-top:8px;">Cada acción admite hasta 2 controles de seguimiento (fecha + observación) — se registran al editarla.</p>
      </div>
    </div>
  `;

  document.getElementById("btn-volver-pdi").addEventListener("click", () => window.Router.go("personal"));

  if (!puedeEditar) return;

  document.getElementById("btn-agregar-pdi").addEventListener("click", () => abrirModalAccionPDI(evaluacion, perfiles || [], (acciones || []).length));
  document.getElementById("btn-guardar-fechas-pdi").addEventListener("click", () => guardarFechasPDI(evaluacion));

  container.querySelectorAll("[data-editar-pdi]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = acciones.find((x) => x.id === btn.dataset.editarPdi);
      abrirModalEditarPDI(evaluacion, a);
    });
  });
}

async function guardarFechasPDI(evaluacion) {
  const { error } = await supabase
    .from("eva_evaluaciones")
    .update({
      fecha_entrevista: document.getElementById("pdi-fecha-entrevista").value || null,
      fecha_cierre_pdi_estimada: document.getElementById("pdi-fecha-cierre-estimada").value || null,
    })
    .eq("id", evaluacion.id);

  if (error) {
    Toast.error("Error al guardar", error.message);
    return;
  }
  Toast.success("Fechas guardadas", "");
}

function abrirModalAccionPDI(evaluacion, perfiles, nroActual) {
  const opciones = perfiles.map((p) => `<option value="${escapeHtml(p.nombre)}">${escapeHtml(p.nombre)}</option>`).join("");

  Modal.open({
    title: "Nueva acción de desarrollo",
    content: `
      <form id="form-accion-pdi">
        <div class="form-field">
          <label class="form-label">Dimensión o criterio que trabaja</label>
          <input type="text" id="pdi-dimension" placeholder="Ej: Comunicación efectiva">
        </div>
        <div class="form-field">
          <label class="form-label">Acción SMART<span class="req">*</span></label>
          <textarea id="pdi-accion" required style="width:100%; min-height:70px;" placeholder="Específica, medible, alcanzable, relevante y con plazo"></textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Responsable de apoyo</label><select id="pdi-responsable"><option value="">Sin asignar</option>${opciones}</select></div>
          <div class="form-field"><label class="form-label">Recursos necesarios</label><input type="text" id="pdi-recursos"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Fecha de inicio</label><input type="date" id="pdi-fecha-inicio"></div>
          <div class="form-field"><label class="form-label">Fecha de cierre</label><input type="date" id="pdi-fecha-cierre"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-pdi">Cancelar</button>
          <button type="submit" class="btn btn-primary">Agregar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-pdi").addEventListener("click", Modal.close);
  document.getElementById("form-accion-pdi").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("eva_pdi").insert({
      evaluacion_id: evaluacion.id,
      nro: nroActual + 1,
      dimension_criterio: document.getElementById("pdi-dimension").value.trim() || null,
      accion_smart: document.getElementById("pdi-accion").value.trim(),
      responsable_apoyo: document.getElementById("pdi-responsable").value || null,
      recursos: document.getElementById("pdi-recursos").value.trim() || null,
      fecha_inicio: document.getElementById("pdi-fecha-inicio").value || null,
      fecha_cierre: document.getElementById("pdi-fecha-cierre").value || null,
      estado_accion: "pendiente",
    });

    if (error) {
      Toast.error("Error al agregar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Acción agregada", "");
    await recargarPDI(evaluacion);
  });
}

function abrirModalEditarPDI(evaluacion, accion) {
  Modal.open({
    title: "Editar acción de desarrollo",
    size: "lg",
    content: `
      <p class="lead" style="margin-bottom:12px;">${escapeHtml(accion.accion_smart)}</p>
      <form id="form-editar-pdi">
        <div class="form-field">
          <label class="form-label">Estado</label>
          <select id="pdi-estado">
            <option value="pendiente" ${accion.estado_accion === "pendiente" ? "selected" : ""}>Pendiente</option>
            <option value="en_curso" ${accion.estado_accion === "en_curso" ? "selected" : ""}>En curso</option>
            <option value="completada" ${accion.estado_accion === "completada" ? "selected" : ""}>Completada</option>
          </select>
        </div>
        <h4 style="margin:14px 0 8px;">Control 1</h4>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Fecha</label><input type="date" id="pdi-control1-fecha" value="${accion.control_1_fecha || ""}"></div>
          <div class="form-field"><label class="form-label">Observación</label><input type="text" id="pdi-control1-obs" value="${escapeHtml(accion.control_1_obs || "")}"></div>
        </div>
        <h4 style="margin:14px 0 8px;">Control 2</h4>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Fecha</label><input type="date" id="pdi-control2-fecha" value="${accion.control_2_fecha || ""}"></div>
          <div class="form-field"><label class="form-label">Observación</label><input type="text" id="pdi-control2-obs" value="${escapeHtml(accion.control_2_obs || "")}"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-editar-pdi">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-editar-pdi").addEventListener("click", Modal.close);
  document.getElementById("form-editar-pdi").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("eva_pdi")
      .update({
        estado_accion: document.getElementById("pdi-estado").value,
        control_1_fecha: document.getElementById("pdi-control1-fecha").value || null,
        control_1_obs: document.getElementById("pdi-control1-obs").value.trim() || null,
        control_2_fecha: document.getElementById("pdi-control2-fecha").value || null,
        control_2_obs: document.getElementById("pdi-control2-obs").value.trim() || null,
      })
      .eq("id", accion.id);

    if (error) {
      Toast.error("Error al guardar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Acción actualizada", "");
    await recargarPDI(evaluacion);
  });
}

/** Recarga la misma ficha de PDI, con la evaluación ya actualizada. */
async function recargarPDI(evaluacion) {
  const { data: evalActualizada } = await supabase
    .from("eva_evaluaciones")
    .select("*, evaluado:evaluado_id(nombre), evaluador:evaluador_id(nombre), ciclo:ciclo_id(titulo)")
    .eq("id", evaluacion.id)
    .single();

  if (evalActualizada) {
    await renderPDI(document.getElementById("content"), evalActualizada);
  } else {
    window.Router.go("personal");
  }
}
