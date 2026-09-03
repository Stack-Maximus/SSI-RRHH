/**
 * Ficha de gestión de una No Conformidad: clasificación → contención →
 * causa raíz (guiada con 5 porqués, u otro método) → plan de acciones →
 * verificación de eficacia → cierre. Una vez cerrada, queda en solo lectura.
 */

import { supabase } from "../core/supabase.js";
import { Toast, Confirm } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";

const SEVERIDAD_LABELS = { critica: "Crítica", mayor: "Mayor", menor: "Menor", observacion: "Observación" };
const ESTADO_LABELS = {
  registrada: "Registrada", clasificada: "Clasificada", contenida: "Contenida", en_analisis: "En análisis",
  en_implementacion: "En implementación", en_verificacion: "En verificación", cerrada: "Cerrada", reabierta: "Reabierta",
};
const ESTADOS_CERRADOS = ["cerrada"];

export async function renderNoConformidadDetalle(container, nc) {
  container.innerHTML = `<div class="view-loading">Cargando ficha...</div>`;

  const [{ data: acciones }, { data: verificaciones }, { data: perfiles }] = await Promise.all([
    supabase.from("nc_acciones").select("*, responsable:responsable_id(nombre)").eq("nc_id", nc.id).order("plazo"),
    supabase.from("nc_verificaciones").select("*, verificador:verificador_id(nombre)").eq("nc_id", nc.id).order("fecha", { ascending: false }),
    supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  const estaCerrada = ESTADOS_CERRADOS.includes(nc.estado);

  const ESTADO_ACCION_BADGE = { pendiente: "badge-neutral", en_proceso: "badge-warning", completada: "badge-success" };

  const filasAcciones = (acciones || []).length
    ? acciones
        .map(
          (a) => `
      <tr>
        <td>${escapeHtml(a.tipo || "—")}</td>
        <td>${escapeHtml(a.accion || "—")}</td>
        <td>${escapeHtml(a.responsable?.nombre || "—")}</td>
        <td>${formatDate(a.plazo)}</td>
        <td><span class="badge ${ESTADO_ACCION_BADGE[a.estado] || "badge-neutral"}">${escapeHtml(a.estado)}</span></td>
        <td>${!estaCerrada ? `<button class="btn btn-secondary" data-actualizar-accion="${a.id}">Actualizar</button>` : "—"}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty-state">Sin acciones registradas todavía.</td></tr>`;

  const filasVerificaciones = (verificaciones || []).length
    ? verificaciones
        .map(
          (v) => `
      <tr>
        <td>${formatDate(v.fecha)}</td>
        <td>${escapeHtml(v.verificador?.nombre || "—")}</td>
        <td><span class="badge ${v.resultado === "eficaz" ? "badge-success" : "badge-danger"}">${v.resultado === "eficaz" ? "Eficaz" : "No eficaz"}</span></td>
        <td>${escapeHtml(v.evidencia || "—")}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty-state">Sin verificaciones todavía.</td></tr>`;

  container.innerHTML = `
    <div class="view-form">
      <button class="btn btn-secondary" id="btn-volver-nc" style="margin-bottom:16px;">← Volver</button>

      ${
        estaCerrada
          ? `<div class="card" style="margin-bottom:16px; background:var(--surface-2); border-color:var(--border-s);">
              <p class="lead" style="margin:0;">🔒 Esta No Conformidad está <strong>cerrada</strong> — queda en solo lectura, no se pueden agregar más acciones ni verificaciones.</p>
            </div>`
          : ""
      }

      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div>
            <h3>${escapeHtml(nc.folio)}</h3>
            <p class="lead">${escapeHtml(nc.obra_proceso || "—")}</p>
          </div>
          <span class="badge badge-info">${ESTADO_LABELS[nc.estado] || nc.estado}</span>
        </div>

        <p style="margin-bottom:12px;"><strong>Descripción:</strong> ${escapeHtml(nc.descripcion)}</p>
        <div class="stat-row"><span>Requisito incumplido</span><span>${escapeHtml(nc.requisito_incumplido || "—")}</span></div>
        <div class="stat-row"><span>Partida / elemento</span><span>${escapeHtml(nc.partida_elemento || "—")}</span></div>
        <div class="stat-row"><span>Severidad</span><span>${nc.severidad ? SEVERIDAD_LABELS[nc.severidad] : "Sin clasificar"}</span></div>
        <div class="stat-row"><span>Atribuible a</span><span>${escapeHtml(nc.atribuible_a || "—")}</span></div>
        <div class="stat-row"><span>Contención</span><span>${escapeHtml(nc.contencion || "—")}</span></div>
        <div class="stat-row"><span>Causa raíz</span><span>${escapeHtml(nc.causa_raiz || "—")}</span></div>

        ${
          !estaCerrada
            ? `<div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
                ${nc.estado === "registrada" ? `<button class="btn btn-primary" id="btn-clasificar">Clasificar</button>` : ""}
                ${["clasificada"].includes(nc.estado) ? `<button class="btn btn-primary" id="btn-contener">Registrar contención</button>` : ""}
                ${["contenida", "en_analisis"].includes(nc.estado) ? `<button class="btn btn-primary" id="btn-causa-raiz">Análisis de causa raíz</button>` : ""}
              </div>`
            : ""
        }
      </div>

      <div class="card" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Plan de acciones</h3>
          ${!estaCerrada && !["registrada", "clasificada"].includes(nc.estado) ? `<button class="btn btn-secondary" id="btn-agregar-accion">+ Agregar acción</button>` : ""}
        </div>
        <table class="data-table">
          <thead><tr><th>Tipo</th><th>Acción</th><th>Responsable</th><th>Plazo</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filasAcciones}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Verificación de eficacia</h3>
          ${!estaCerrada && ((nc.estado === "en_verificacion") || (acciones || []).length > 0) ? `<button class="btn btn-secondary" id="btn-verificar">+ Registrar verificación</button>` : ""}
        </div>
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Verificador</th><th>Resultado</th><th>Evidencia</th></tr></thead>
          <tbody>${filasVerificaciones}</tbody>
        </table>
        ${!estaCerrada ? `<p class="hint" style="margin-top:8px;">Si una verificación queda "No eficaz", la NC se reabre automáticamente — no hace falta hacerlo a mano.</p>` : ""}
      </div>
    </div>
  `;

  document.getElementById("btn-volver-nc").addEventListener("click", () => window.Router.go("no_conformidades"));

  document.getElementById("btn-clasificar")?.addEventListener("click", () => abrirModalClasificar(nc));
  document.getElementById("btn-contener")?.addEventListener("click", () => abrirModalContencion(nc));
  document.getElementById("btn-causa-raiz")?.addEventListener("click", () => abrirModalCausaRaiz(nc));
  document.getElementById("btn-agregar-accion")?.addEventListener("click", () => abrirModalAccion(nc, perfiles || []));
  document.getElementById("btn-verificar")?.addEventListener("click", () => abrirModalVerificacion(nc, perfiles || []));

  container.querySelectorAll("[data-actualizar-accion]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const accion = (acciones || []).find((a) => a.id === btn.dataset.actualizarAccion);
      abrirModalActualizarAccion(accion);
    });
  });
}

function abrirModalActualizarAccion(accion) {
  Modal.open({
    title: "Actualizar acción",
    content: `
      <p class="lead" style="margin-bottom:12px;">${escapeHtml(accion.accion)}</p>
      <form id="form-actualizar-accion">
        <div class="form-field">
          <label class="form-label">Estado<span class="req">*</span></label>
          <select id="act-accion-estado" required>
            <option value="pendiente" ${accion.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
            <option value="en_proceso" ${accion.estado === "en_proceso" ? "selected" : ""}>En proceso</option>
            <option value="completada" ${accion.estado === "completada" ? "selected" : ""}>Completada</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Evidencia de implementación</label>
          <textarea id="act-accion-evidencia" style="width:100%; min-height:80px;">${escapeHtml(accion.evidencia_implementacion || "")}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-act-accion">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-act-accion").addEventListener("click", Modal.close);
  document.getElementById("form-actualizar-accion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("nc_acciones")
      .update({
        estado: document.getElementById("act-accion-estado").value,
        evidencia_implementacion: document.getElementById("act-accion-evidencia").value.trim() || null,
      })
      .eq("id", accion.id);

    if (error) {
      Toast.error("Error al actualizar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Acción actualizada", "");
    await recargarFicha(accion.nc_id);
  });
}

function abrirModalClasificar(nc) {
  Modal.open({
    title: "Clasificar No Conformidad",
    content: `
      <form id="form-clasificar">
        <div class="form-field">
          <label class="form-label">Severidad<span class="req">*</span></label>
          <select id="clas-severidad" required>
            <option value="critica">Crítica</option>
            <option value="mayor">Mayor</option>
            <option value="menor" selected>Menor</option>
            <option value="observacion">Observación</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Atribuible a<span class="req">*</span></label>
          <input type="text" id="clas-atribuible" required placeholder="Área Metalium, subcontratista o proveedor">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-clas">Cancelar</button>
          <button type="submit" class="btn btn-primary">Clasificar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-clas").addEventListener("click", Modal.close);
  document.getElementById("form-clasificar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("nc_registro")
      .update({
        severidad: document.getElementById("clas-severidad").value,
        atribuible_a: document.getElementById("clas-atribuible").value.trim(),
        estado: "clasificada",
      })
      .eq("id", nc.id);
    if (error) {
      Toast.error("Error", error.message);
      return;
    }
    Modal.close();
    Toast.success("NC clasificada", "");
    await recargarFicha(nc.id);
  });
}

function abrirModalContencion(nc) {
  Modal.open({
    title: "Registrar contención",
    content: `
      <form id="form-contencion">
        <div class="form-field">
          <label class="form-label">Acción de contención inmediata<span class="req">*</span></label>
          <textarea id="cont-texto" required style="width:100%; min-height:80px;" placeholder="Qué se hizo de inmediato para controlar el problema mientras se investiga la causa"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-cont">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-cont").addEventListener("click", Modal.close);
  document.getElementById("form-contencion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("nc_registro")
      .update({ contencion: document.getElementById("cont-texto").value.trim(), estado: "contenida" })
      .eq("id", nc.id);
    if (error) {
      Toast.error("Error", error.message);
      return;
    }
    Modal.close();
    Toast.success("Contención registrada", "");
    await recargarFicha(nc.id);
  });
}

function abrirModalCausaRaiz(nc) {
  Modal.open({
    title: "Análisis de causa raíz",
    content: `
      <form id="form-causa">
        <div class="form-field">
          <label class="form-label">Método</label>
          <select id="causa-metodo">
            <option value="cinco_porques">5 porqués (guiado)</option>
            <option value="ishikawa">Ishikawa / espina de pescado</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div id="bloque-cinco-porques">
          <div class="form-field"><label class="form-label">1. ¿Por qué ocurrió?</label><input type="text" id="porque-1"></div>
          <div class="form-field"><label class="form-label">2. ¿Por qué?</label><input type="text" id="porque-2"></div>
          <div class="form-field"><label class="form-label">3. ¿Por qué?</label><input type="text" id="porque-3"></div>
          <div class="form-field"><label class="form-label">4. ¿Por qué?</label><input type="text" id="porque-4"></div>
          <div class="form-field"><label class="form-label">5. ¿Por qué? (causa raíz)</label><input type="text" id="porque-5"></div>
        </div>
        <div id="bloque-otro" style="display:none;">
          <div class="form-field">
            <label class="form-label">Causa raíz identificada</label>
            <textarea id="causa-libre" style="width:100%; min-height:80px;"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-causa">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `,
  });

  const selectMetodo = document.getElementById("causa-metodo");
  selectMetodo.addEventListener("change", () => {
    const esGuiado = selectMetodo.value === "cinco_porques";
    document.getElementById("bloque-cinco-porques").style.display = esGuiado ? "block" : "none";
    document.getElementById("bloque-otro").style.display = esGuiado ? "none" : "block";
  });

  document.getElementById("btn-cancelar-causa").addEventListener("click", Modal.close);
  document.getElementById("form-causa").addEventListener("submit", async (e) => {
    e.preventDefault();
    const metodo = selectMetodo.value;
    let causaRaiz;

    if (metodo === "cinco_porques") {
      const porques = [1, 2, 3, 4, 5].map((n) => document.getElementById(`porque-${n}`).value.trim()).filter(Boolean);
      causaRaiz = porques.map((p, i) => `${i + 1}. ${p}`).join(" → ");
    } else {
      causaRaiz = document.getElementById("causa-libre").value.trim();
    }

    if (!causaRaiz) {
      Toast.warning("Falta información", "Completa al menos el análisis antes de guardar.");
      return;
    }

    const { error } = await supabase
      .from("nc_registro")
      .update({ metodo_causa_raiz: metodo, causa_raiz: causaRaiz, estado: "en_analisis" })
      .eq("id", nc.id);

    if (error) {
      Toast.error("Error", error.message);
      return;
    }
    Modal.close();
    Toast.success("Causa raíz registrada", "Ahora agrega el plan de acciones.");
    await recargarFicha(nc.id);
  });
}

function abrirModalAccion(nc, perfiles) {
  const opciones = perfiles.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");

  Modal.open({
    title: "Agregar acción",
    content: `
      <form id="form-accion-nc">
        <div class="form-field">
          <label class="form-label">Tipo<span class="req">*</span></label>
          <select id="accion-tipo" required>
            <option value="correccion">Corrección</option>
            <option value="accion_correctiva">Acción correctiva</option>
            <option value="preventiva_om">Preventiva / mejora</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Acción<span class="req">*</span></label>
          <textarea id="accion-texto" required style="width:100%; min-height:70px;"></textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Responsable</label><select id="accion-responsable"><option value="">Sin asignar</option>${opciones}</select></div>
          <div class="form-field"><label class="form-label">Plazo</label><input type="date" id="accion-plazo"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-accion">Cancelar</button>
          <button type="submit" class="btn btn-primary">Agregar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-accion").addEventListener("click", Modal.close);
  document.getElementById("form-accion-nc").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("nc_acciones").insert({
      nc_id: nc.id,
      tipo: document.getElementById("accion-tipo").value,
      accion: document.getElementById("accion-texto").value.trim(),
      responsable_id: document.getElementById("accion-responsable").value || null,
      plazo: document.getElementById("accion-plazo").value || null,
      estado: "pendiente",
    });
    if (error) {
      Toast.error("Error al agregar", error.message);
      return;
    }

    if (nc.estado === "en_analisis") {
      await supabase.from("nc_registro").update({ estado: "en_implementacion" }).eq("id", nc.id);
    }

    Modal.close();
    Toast.success("Acción agregada", "");
    await recargarFicha(nc.id);
  });
}

function abrirModalVerificacion(nc, perfiles) {
  const opciones = perfiles.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");

  Modal.open({
    title: "Registrar verificación de eficacia",
    content: `
      <form id="form-verificacion">
        <div class="form-field">
          <label class="form-label">Verificador<span class="req">*</span></label>
          <select id="verif-verificador" required><option value="">Selecciona...</option>${opciones}</select>
        </div>
        <div class="form-field">
          <label class="form-label">Resultado<span class="req">*</span></label>
          <select id="verif-resultado" required>
            <option value="eficaz">Eficaz — el problema no se repite</option>
            <option value="no_eficaz">No eficaz — el problema persiste</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Evidencia</label>
          <textarea id="verif-evidencia" style="width:100%; min-height:70px;"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-verif">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-verif").addEventListener("click", Modal.close);
  document.getElementById("form-verificacion").addEventListener("submit", async (e) => {
    e.preventDefault();

    const resultado = document.getElementById("verif-resultado").value;
    const ok = await Confirm.ask({
      title: resultado === "no_eficaz" ? "¿Confirmar que no fue eficaz?" : "¿Confirmar cierre de la NC?",
      text: resultado === "no_eficaz" ? "La NC se reabrirá automáticamente." : "La NC quedará cerrada.",
      confirmText: "Confirmar",
    });
    if (!ok) return;

    const { error: errVerif } = await supabase.from("nc_verificaciones").insert({
      nc_id: nc.id,
      verificador_id: document.getElementById("verif-verificador").value,
      resultado,
      evidencia: document.getElementById("verif-evidencia").value.trim() || null,
    });

    if (errVerif) {
      Toast.error("Error al guardar", errVerif.message);
      return;
    }

    if (resultado === "eficaz") {
      await supabase.from("nc_registro").update({ estado: "cerrada" }).eq("id", nc.id);
    }

    Modal.close();
    Toast.success("Verificación registrada", "");
    await recargarFicha(nc.id);
  });
}

/** Recarga la ficha de la misma NC ya actualizada, sin volver a la lista. */
async function recargarFicha(ncId) {
  const { data: ncActualizada } = await supabase.from("nc_registro").select("*").eq("id", ncId).single();
  if (ncActualizada) {
    await renderNoConformidadDetalle(document.getElementById("content"), ncActualizada);
  } else {
    window.Router.go("no_conformidades");
  }
}
