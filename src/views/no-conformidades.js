/**
 * No Conformidades · vista principal.
 * Panel único (sin distinción de roles todavía): dashboard, registro de NC,
 * auditorías (con generación automática de NC por hallazgo), y el gate de
 * calidad para liberación de obras.
 */

import { supabase } from "../core/supabase.js";
import { Toast } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";
import { renderNoConformidadDetalle } from "./no-conformidad-detalle.js";

const SEVERIDAD_LABELS = { critica: "Crítica", mayor: "Mayor", menor: "Menor", observacion: "Observación" };
const SEVERIDAD_BADGE = { critica: "badge-danger", mayor: "badge-warning", menor: "badge-info", observacion: "badge-neutral" };
const ORIGEN_LABELS = { interna_auditoria: "Auditoría interna", interna_obra: "Interna de obra", externa_cliente: "Cliente externo" };
const ESTADO_LABELS = {
  registrada: "Registrada", clasificada: "Clasificada", contenida: "Contenida", en_analisis: "En análisis",
  en_implementacion: "En implementación", en_verificacion: "En verificación", cerrada: "Cerrada", reabierta: "Reabierta",
};
const ESTADO_BADGE = {
  registrada: "badge-neutral", clasificada: "badge-warning", contenida: "badge-warning", en_analisis: "badge-info",
  en_implementacion: "badge-info", en_verificacion: "badge-info", cerrada: "badge-success", reabierta: "badge-danger",
};
const GATE_LABELS = { en_inspeccion: "En inspección", retenida: "Retenida", liberada: "Liberada", liberada_condicionada: "Liberada condicionada" };
const GATE_BADGE = { en_inspeccion: "badge-neutral", retenida: "badge-danger", liberada: "badge-success", liberada_condicionada: "badge-warning" };

export async function renderNoConformidades(container) {
  container.innerHTML = `<div class="view-loading">Cargando...</div>`;

  const [{ data: ncs, error }, { data: auditorias }, { data: gates }] = await Promise.all([
    supabase.from("nc_registro").select("*").order("fecha_deteccion", { ascending: false }).limit(50),
    supabase.from("nc_auditorias").select("*").order("fecha_planificada", { ascending: false }).limit(20),
    supabase.from("nc_entregas_liberacion").select("*").order("fecha_programada", { ascending: false }).limit(20),
  ]);

  if (error) {
    container.innerHTML = `<div class="placeholder error"><h2>Error</h2><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  const abiertas = (ncs || []).filter((n) => !["cerrada"].includes(n.estado)).length;
  const criticasMayores = (ncs || []).filter((n) => ["critica", "mayor"].includes(n.severidad) && n.estado !== "cerrada").length;
  const reabiertas = (ncs || []).filter((n) => n.estado === "reabierta").length;
  const gatesRetenidos = (gates || []).filter((g) => g.estado_gate === "retenida").length;

  const filasNC = (ncs || []).length
    ? ncs
        .map(
          (n) => `
      <tr>
        <td>${escapeHtml(n.folio)}</td>
        <td>${ORIGEN_LABELS[n.tipo_origen] || n.tipo_origen}</td>
        <td>${escapeHtml(n.obra_proceso || "—")}</td>
        <td>${n.severidad ? `<span class="badge ${SEVERIDAD_BADGE[n.severidad]}">${SEVERIDAD_LABELS[n.severidad]}</span>` : '<span class="badge badge-neutral">Sin clasificar</span>'}</td>
        <td><span class="badge ${ESTADO_BADGE[n.estado] || "badge-neutral"}">${ESTADO_LABELS[n.estado] || n.estado}</span></td>
        <td><button class="btn btn-primary" data-gestionar="${n.id}">Gestionar</button></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty-state">Aún no hay no conformidades registradas.</td></tr>`;

  const filasAuditorias = (auditorias || []).length
    ? auditorias
        .map(
          (a) => `
      <tr>
        <td>${escapeHtml(a.codigo || "—")}</td>
        <td>${escapeHtml(a.area_proceso || "—")}</td>
        <td>${escapeHtml(a.tipo || "—")}</td>
        <td>${formatDate(a.fecha_planificada)}</td>
        <td><span class="badge badge-neutral">${escapeHtml(a.estado)}</span></td>
        <td>${a.n_hallazgos_criticos + a.n_hallazgos_mayores + a.n_hallazgos_menores + a.n_hallazgos_obs}</td>
        <td><button class="btn btn-secondary" data-auditoria="${a.id}">Ver / registrar hallazgos</button></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="empty-state">Aún no hay auditorías programadas.</td></tr>`;

  const filasGates = (gates || []).length
    ? gates
        .map(
          (g) => `
      <tr>
        <td>${escapeHtml(g.obra)}</td>
        <td>${escapeHtml(g.hito)}</td>
        <td>${formatDate(g.fecha_programada)}</td>
        <td><span class="badge ${GATE_BADGE[g.estado_gate] || "badge-neutral"}">${GATE_LABELS[g.estado_gate] || g.estado_gate}</span></td>
        <td><button class="btn btn-secondary" data-gate="${g.id}">Revisar</button></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty-state">Aún no hay entregas programadas.</td></tr>`;

  container.innerHTML = `
    <div class="view-nc">
      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card"><div class="kpi-label">NC abiertas</div><div class="kpi-value">${abiertas}</div></div>
        <div class="kpi-card"><div class="kpi-label">Críticas/Mayores abiertas</div><div class="kpi-value">${criticasMayores}</div></div>
        <div class="kpi-card"><div class="kpi-label">Reabiertas</div><div class="kpi-value">${reabiertas}</div></div>
        <div class="kpi-card"><div class="kpi-label">Gates retenidos</div><div class="kpi-value">${gatesRetenidos}</div></div>
      </div>

      <div style="margin-bottom:16px; display:flex; gap:10px;">
        <button class="btn btn-primary" id="btn-registrar-nc">+ Registrar NC</button>
        <button class="btn btn-secondary" id="btn-nueva-auditoria">+ Programar auditoría</button>
        <button class="btn btn-secondary" id="btn-nueva-inspeccion">+ Nueva inspección de entrega</button>
      </div>

      <div class="card">
        <h3>No Conformidades (últimas 50)</h3>
        <table class="data-table">
          <thead><tr><th>Folio</th><th>Origen</th><th>Obra/proceso</th><th>Severidad</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filasNC}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3>Auditorías</h3>
        <table class="data-table">
          <thead><tr><th>Código</th><th>Área/proceso</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Hallazgos</th><th></th></tr></thead>
          <tbody>${filasAuditorias}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3>Gate de calidad — entregas de obra</h3>
        <table class="data-table">
          <thead><tr><th>Obra</th><th>Hito</th><th>Fecha programada</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filasGates}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-registrar-nc").addEventListener("click", abrirModalRegistrarNC);
  document.getElementById("btn-nueva-auditoria").addEventListener("click", abrirModalNuevaAuditoria);
  document.getElementById("btn-nueva-inspeccion").addEventListener("click", abrirModalNuevaInspeccion);

  container.querySelectorAll("[data-gestionar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nc = ncs.find((n) => n.id === btn.dataset.gestionar);
      renderNoConformidadDetalle(container, nc);
    });
  });
  container.querySelectorAll("[data-auditoria]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = auditorias.find((x) => x.id === btn.dataset.auditoria);
      abrirModalRegistrarHallazgos(a);
    });
  });
  container.querySelectorAll("[data-gate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const g = gates.find((x) => x.id === btn.dataset.gate);
      abrirModalRevisarGate(g);
    });
  });
}

function abrirModalRegistrarNC() {
  Modal.open({
    title: "Registrar No Conformidad",
    content: `
      <form id="form-nc">
        <div class="form-field">
          <label class="form-label">Origen<span class="req">*</span></label>
          <select id="nc-origen" required>
            <option value="interna_obra">Interna de obra</option>
            <option value="interna_auditoria">Auditoría interna</option>
            <option value="externa_cliente">Cliente externo</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Obra o proceso<span class="req">*</span></label>
          <input type="text" id="nc-obra" required>
        </div>
        <div class="form-field">
          <label class="form-label">Descripción del hallazgo<span class="req">*</span></label>
          <textarea id="nc-descripcion" required style="width:100%; min-height:80px;"></textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Requisito incumplido</label><input type="text" id="nc-requisito"></div>
          <div class="form-field"><label class="form-label">Partida / elemento</label><input type="text" id="nc-partida"></div>
        </div>
        <p class="hint" style="margin-bottom:12px;">La severidad y a quién es atribuible se definen en la clasificación, dentro de la ficha de la NC una vez registrada.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-nc">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-nc").addEventListener("click", Modal.close);
  document.getElementById("form-nc").addEventListener("submit", async (e) => {
    e.preventDefault();
    const folio = `NC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { error } = await supabase.from("nc_registro").insert({
      folio,
      tipo_origen: document.getElementById("nc-origen").value,
      obra_proceso: document.getElementById("nc-obra").value.trim(),
      descripcion: document.getElementById("nc-descripcion").value.trim(),
      requisito_incumplido: document.getElementById("nc-requisito").value.trim() || null,
      partida_elemento: document.getElementById("nc-partida").value.trim() || null,
      severidad: "menor",
      estado: "registrada",
    });

    if (error) {
      Toast.error("Error al registrar", error.message);
      return;
    }
    Modal.close();
    Toast.success("NC registrada", `Folio ${folio}`);
    window.Router.go("no_conformidades");
  });
}

function abrirModalNuevaAuditoria() {
  Modal.open({
    title: "Programar auditoría",
    content: `
      <form id="form-auditoria">
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Código</label><input type="text" id="aud-codigo" placeholder="Ej: AUD-2026-01"></div>
          <div class="form-field">
            <label class="form-label">Tipo<span class="req">*</span></label>
            <select id="aud-tipo" required>
              <option value="programa_anual">Programa anual</option>
              <option value="cruzada">Cruzada</option>
              <option value="extraordinaria">Extraordinaria</option>
            </select>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Área o proceso a auditar<span class="req">*</span></label>
          <input type="text" id="aud-area" required>
        </div>
        <div class="form-field">
          <label class="form-label">Fecha planificada<span class="req">*</span></label>
          <input type="date" id="aud-fecha" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-aud">Cancelar</button>
          <button type="submit" class="btn btn-primary">Programar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-aud").addEventListener("click", Modal.close);
  document.getElementById("form-auditoria").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("nc_auditorias").insert({
      codigo: document.getElementById("aud-codigo").value.trim() || null,
      tipo: document.getElementById("aud-tipo").value,
      area_proceso: document.getElementById("aud-area").value.trim(),
      fecha_planificada: document.getElementById("aud-fecha").value,
      estado: "planificada",
    });
    if (error) {
      Toast.error("Error al programar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Auditoría programada", "");
    window.Router.go("no_conformidades");
  });
}

/**
 * Registrar hallazgos de una auditoría — cada hallazgo se ingresa con su
 * propia severidad y descripción, y al guardar se genera automáticamente
 * una No Conformidad por cada uno (sin pasar por "+ Registrar NC" aparte).
 */
function abrirModalRegistrarHallazgos(auditoria) {
  Modal.open({
    title: `Hallazgos — ${auditoria.codigo || auditoria.area_proceso}`,
    size: "lg",
    content: `
      <form id="form-hallazgos">
        <div class="form-field">
          <label class="form-label">Fecha real de ejecución</label>
          <input type="date" id="hall-fecha">
        </div>
        <div id="lista-hallazgos"></div>
        <button type="button" class="btn btn-secondary" id="btn-agregar-hallazgo" style="margin-bottom:16px;">+ Agregar hallazgo</button>
        <p class="hint" style="margin-bottom:12px;">Cada hallazgo que agregues aquí genera automáticamente una No Conformidad registrada, con este origen marcado como "Auditoría interna" — no necesitas crearla aparte.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-hall">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar y generar NC</button>
        </div>
      </form>
    `,
  });

  let contador = 0;

  function agregarFilaHallazgo() {
    contador++;
    const id = contador;
    const div = document.createElement("div");
    div.className = "criterio-row";
    div.dataset.hallazgoRow = id;
    div.innerHTML = `
      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label">Severidad</label>
          <select data-hall-severidad="${id}">
            <option value="critica">Crítica</option>
            <option value="mayor">Mayor</option>
            <option value="menor" selected>Menor</option>
            <option value="observacion">Observación</option>
          </select>
        </div>
        <div class="form-field" style="display:flex; align-items:flex-end;">
          <button type="button" class="btn btn-secondary" data-quitar-hallazgo="${id}">Quitar este hallazgo</button>
        </div>
      </div>
      <div class="form-field">
        <label class="form-label">Descripción del hallazgo</label>
        <textarea data-hall-descripcion="${id}" style="width:100%; min-height:60px;" placeholder="Qué se encontró exactamente"></textarea>
      </div>
    `;
    document.getElementById("lista-hallazgos").appendChild(div);
    div.querySelector(`[data-quitar-hallazgo="${id}"]`).addEventListener("click", () => div.remove());
  }

  document.getElementById("btn-agregar-hallazgo").addEventListener("click", agregarFilaHallazgo);
  agregarFilaHallazgo(); // parte con una fila lista para llenar

  document.getElementById("btn-cancelar-hall").addEventListener("click", Modal.close);
  document.getElementById("form-hallazgos").addEventListener("submit", async (e) => {
    e.preventDefault();

    const filas = [...document.querySelectorAll("#lista-hallazgos [data-hallazgo-row]")];
    const hallazgos = filas
      .map((div) => {
        const id = div.dataset.hallazgoRow;
        return {
          severidad: div.querySelector(`[data-hall-severidad="${id}"]`).value,
          descripcion: div.querySelector(`[data-hall-descripcion="${id}"]`).value.trim(),
        };
      })
      .filter((h) => h.descripcion);

    const conteos = { critica: 0, mayor: 0, menor: 0, observacion: 0 };
    hallazgos.forEach((h) => conteos[h.severidad]++);

    const { error: errAud } = await supabase
      .from("nc_auditorias")
      .update({
        fecha_real: document.getElementById("hall-fecha").value || null,
        n_hallazgos_criticos: conteos.critica,
        n_hallazgos_mayores: conteos.mayor,
        n_hallazgos_menores: conteos.menor,
        n_hallazgos_obs: conteos.observacion,
        estado: "realizada",
      })
      .eq("id", auditoria.id);

    if (errAud) {
      Toast.error("Error al guardar la auditoría", errAud.message);
      return;
    }

    let ncsCreadas = 0;
    for (const h of hallazgos) {
      const folio = `NC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}-${ncsCreadas}`;
      const { error: errNc } = await supabase.from("nc_registro").insert({
        folio,
        tipo_origen: "interna_auditoria",
        obra_proceso: auditoria.area_proceso,
        descripcion: h.descripcion,
        severidad: h.severidad,
        estado: "registrada",
      });
      if (!errNc) ncsCreadas++;
    }

    Modal.close();
    Toast.success(
      "Hallazgos guardados",
      ncsCreadas > 0 ? `Se generaron ${ncsCreadas} No Conformidad(es) automáticamente.` : "No se registraron hallazgos con descripción."
    );
    window.Router.go("no_conformidades");
  });
}

function abrirModalNuevaInspeccion() {
  Modal.open({
    title: "Nueva inspección de entrega",
    content: `
      <form id="form-inspeccion">
        <div class="form-field">
          <label class="form-label">Obra<span class="req">*</span></label>
          <input type="text" id="insp-obra" required>
        </div>
        <div class="form-field">
          <label class="form-label">Hito<span class="req">*</span></label>
          <select id="insp-hito" required>
            <option value="pre_entrega">Pre-entrega</option>
            <option value="recepcion_provisoria">Recepción Provisoria</option>
            <option value="recepcion_definitiva">Recepción Definitiva</option>
            <option value="hito_interno">Hito interno</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Fecha programada<span class="req">*</span></label>
          <input type="date" id="insp-fecha" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-insp">Cancelar</button>
          <button type="submit" class="btn btn-primary">Programar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-insp").addEventListener("click", Modal.close);
  document.getElementById("form-inspeccion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("nc_entregas_liberacion").insert({
      obra: document.getElementById("insp-obra").value.trim(),
      hito: document.getElementById("insp-hito").value,
      fecha_programada: document.getElementById("insp-fecha").value,
      estado_gate: "en_inspeccion",
    });
    if (error) {
      Toast.error("Error al programar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Inspección programada", "");
    window.Router.go("no_conformidades");
  });
}

async function abrirModalRevisarGate(gate) {
  const { data: puedeLiberar } = await supabase.rpc("puede_liberar_gate", { p_obra: gate.obra });

  const { data: ncBloqueantes } = await supabase
    .from("nc_registro")
    .select("folio, severidad, estado")
    .eq("obra_proceso", gate.obra)
    .in("severidad", ["critica", "mayor"])
    .neq("estado", "cerrada");

  const listaBloqueantes = (ncBloqueantes || []).length
    ? `<ul>${ncBloqueantes.map((n) => `<li>${escapeHtml(n.folio)} — ${SEVERIDAD_LABELS[n.severidad]} (${ESTADO_LABELS[n.estado]})</li>`).join("")}</ul>`
    : "";

  Modal.open({
    title: `${escapeHtml(gate.obra)} — ${escapeHtml(gate.hito)}`,
    content: `
      ${
        puedeLiberar
          ? `<div class="stat-row"><span>Estado</span><strong style="color:var(--success, #16a34a);">Sin NC críticas/mayores abiertas — puede liberarse</strong></div>`
          : `<div class="form-error" style="margin-bottom:12px;">Hay NC críticas o mayores sin cerrar vinculadas a esta obra — el gate debe quedar retenido:</div>${listaBloqueantes}`
      }
      <div class="form-actions" style="margin-top:16px;">
        <button type="button" class="btn btn-secondary" id="btn-cerrar-aprobar">Cerrar</button>
        ${puedeLiberar ? `<button type="button" class="btn btn-primary" id="btn-liberar">Liberar</button>` : `<button type="button" class="btn btn-secondary" id="btn-retener">Marcar retenida</button>`}
      </div>
    `,
  });

  document.getElementById("btn-cerrar-aprobar").addEventListener("click", Modal.close);

  const btnLiberar = document.getElementById("btn-liberar");
  if (btnLiberar) {
    btnLiberar.addEventListener("click", async () => {
      const { error } = await supabase
        .from("nc_entregas_liberacion")
        .update({ estado_gate: "liberada", folio_approval: `GATE-${Date.now().toString().slice(-6)}` })
        .eq("id", gate.id);
      if (error) {
        Toast.error("Error", error.message);
        return;
      }
      Modal.close();
      Toast.success("Gate liberado", "");
      window.Router.go("no_conformidades");
    });
  }

  const btnRetener = document.getElementById("btn-retener");
  if (btnRetener) {
    btnRetener.addEventListener("click", async () => {
      const { error } = await supabase.from("nc_entregas_liberacion").update({ estado_gate: "retenida" }).eq("id", gate.id);
      if (error) {
        Toast.error("Error", error.message);
        return;
      }
      Modal.close();
      Toast.success("Gate retenido", "La obra no puede entregarse hasta cerrar las NC pendientes.");
      window.Router.go("no_conformidades");
    });
  }
}
