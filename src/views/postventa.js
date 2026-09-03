/**
 * Postventa · vista principal.
 */
import { supabase } from "../core/supabase.js";
import { Toast } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";
import { renderTicketPostventa } from "./postventa-ticket.js";

const SEVERIDAD_LABELS = { s1_critica: "S1 · Crítica", s2_alta: "S2 · Alta", s3_media: "S3 · Media", s4_cosmetica: "S4 · Cosmética" };
const SEVERIDAD_BADGE = { s1_critica: "badge-danger", s2_alta: "badge-warning", s3_media: "badge-info", s4_cosmetica: "badge-neutral" };
const ESTADO_LABELS = {
  reportado: "Reportado", triage: "En triage", asignado: "Asignado", en_inspeccion: "En inspección",
  en_plan: "En plan", en_aprobacion: "En aprobación", en_ejecucion: "En ejecución",
  en_verificacion: "En verificación", cerrado: "Cerrado",
};
const FASE_LABELS = { servicio_activo: "Servicio activo", pendiente_recepcion_definitiva: "Pendiente RD", post_garantia_legal: "Post-garantía · legal", fuera_de_plazo: "Fuera de plazo" };
const FASE_BADGE = { servicio_activo: "badge-success", pendiente_recepcion_definitiva: "badge-warning", post_garantia_legal: "badge-warning", fuera_de_plazo: "badge-danger" };

export async function renderPostventa(container) {
  container.innerHTML = `<div class="view-loading">Cargando...</div>`;

  const [{ data: obras }, { data: tickets, error }] = await Promise.all([
    supabase.from("pv_obras").select("*").order("fecha_activacion", { ascending: false }),
    supabase.from("pv_tickets").select("*").order("fecha_reporte", { ascending: false }).limit(50),
  ]);

  if (error) {
    container.innerHTML = `<div class="placeholder error"><h2>Error</h2><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  const abiertos = (tickets || []).filter((t) => t.estado !== "cerrado").length;
  const legales = (tickets || []).filter((t) => t.fase_garantia === "post_garantia_legal" && t.estado !== "cerrado").length;
  const fueraDePlazo = (tickets || []).filter((t) => t.fase_garantia === "fuera_de_plazo").length;
  const criticos = (tickets || []).filter((t) => t.severidad === "s1_critica" && t.estado !== "cerrado").length;

  const filasObras = (obras || []).length
    ? obras
        .map(
          (o) => `
      <tr>
        <td>${escapeHtml(o.obra)}</td>
        <td>${escapeHtml(o.cliente || "—")}</td>
        <td>${formatDate(o.fecha_activacion)}</td>
        <td>${formatDate(o.fecha_fin_garantia)}</td>
        <td>${o.fecha_recepcion_definitiva ? formatDate(o.fecha_recepcion_definitiva) : '<span class="badge badge-warning">Pendiente</span>'}</td>
        <td>
          <button class="btn btn-secondary" data-ver-link="${o.id}">Ver link</button>
          ${!o.fecha_recepcion_definitiva ? `<button class="btn btn-secondary" data-registrar-rd="${o.id}">Registrar RD</button>` : ""}
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty-state">Aún no hay obras activadas.</td></tr>`;

  const FASE_FILTRO_OPCIONES = [
    ["", "Todas las fases"],
    ["servicio_activo", "Servicio activo"],
    ["pendiente_recepcion_definitiva", "Pendiente RD"],
    ["post_garantia_legal", "Post-garantía · legal"],
    ["fuera_de_plazo", "Fuera de plazo"],
  ];

  container.innerHTML = `
    <div class="view-postventa">
      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card"><div class="kpi-label">Tickets abiertos</div><div class="kpi-value">${abiertos}</div></div>
        <div class="kpi-card"><div class="kpi-label">Críticos (S1) abiertos</div><div class="kpi-value">${criticos}</div></div>
        <div class="kpi-card"><div class="kpi-label">En evaluación legal</div><div class="kpi-value">${legales}</div></div>
        <div class="kpi-card"><div class="kpi-label">Fuera de plazo</div><div class="kpi-value">${fueraDePlazo}</div></div>
      </div>

      <div style="margin-bottom:16px;">
        <button class="btn btn-primary" id="btn-nueva-obra">+ Nueva obra</button>
      </div>

      <div class="card">
        <h3>Obras con postventa activo</h3>
        <table class="data-table">
          <thead><tr><th>Obra</th><th>Cliente</th><th>Recepción Provisoria</th><th>Fin servicio activo</th><th>Recepción Definitiva</th><th></th></tr></thead>
          <tbody>${filasObras}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Tickets (últimos 50)</h3>
          <select id="filtro-fase" style="width:auto;">
            ${FASE_FILTRO_OPCIONES.map(([v, label]) => `<option value="${v}">${label}</option>`).join("")}
          </select>
        </div>
        <table class="data-table">
          <thead><tr><th>Folio</th><th>Obra</th><th>Severidad</th><th>Fase garantía</th><th>Estado</th><th></th></tr></thead>
          <tbody id="tbody-tickets">${filasTicketsHtml(tickets || [])}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-nueva-obra").addEventListener("click", abrirModalNuevaObra);
  container.querySelectorAll("[data-ver-link]").forEach((btn) => {
    btn.addEventListener("click", () => mostrarLinkReporte(btn.dataset.verLink));
  });
  container.querySelectorAll("[data-registrar-rd]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalRegistrarRD(btn.dataset.registrarRd));
  });

  function wireGestionarButtons(lista) {
    container.querySelectorAll("[data-gestionar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = lista.find((x) => x.id === btn.dataset.gestionar);
        renderTicketPostventa(container, t);
      });
    });
  }
  wireGestionarButtons(tickets || []);

  document.getElementById("filtro-fase").addEventListener("change", (e) => {
    const filtro = e.target.value;
    const filtrados = filtro ? (tickets || []).filter((t) => t.fase_garantia === filtro) : tickets || [];
    document.getElementById("tbody-tickets").innerHTML = filasTicketsHtml(filtrados);
    wireGestionarButtons(filtrados);
  });
}

function filasTicketsHtml(lista) {
  return lista.length
    ? lista
        .map(
          (t) => `
      <tr>
        <td>${escapeHtml(t.numero_ticket)}</td>
        <td>${escapeHtml(t.obra)}</td>
        <td><span class="badge ${SEVERIDAD_BADGE[t.severidad] || "badge-neutral"}">${SEVERIDAD_LABELS[t.severidad] || t.severidad}</span></td>
        <td><span class="badge ${FASE_BADGE[t.fase_garantia] || "badge-neutral"}">${FASE_LABELS[t.fase_garantia] || "—"}</span></td>
        <td><span class="badge badge-neutral">${ESTADO_LABELS[t.estado] || t.estado}</span></td>
        <td><button class="btn btn-primary" data-gestionar="${t.id}">Gestionar</button></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty-state">Ningún ticket coincide con este filtro.</td></tr>`;
}

function abrirModalNuevaObra() {
  Modal.open({
    title: "Nueva obra — activar postventa",
    content: `
      <form id="form-nueva-obra">
        <div class="form-field">
          <label class="form-label">Nombre de la obra<span class="req">*</span></label>
          <input type="text" id="obra-nombre" required placeholder="Ej: QUI01 — Edificio Quilpué">
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Centro de costo</label><input type="text" id="obra-cc"></div>
          <div class="form-field"><label class="form-label">Cliente</label><input type="text" id="obra-cliente"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Fecha Recepción Provisoria<span class="req">*</span></label>
            <input type="date" id="obra-rp" required>
          </div>
          <div class="form-field">
            <label class="form-label">Fin servicio activo (12 meses)<span class="req">*</span></label>
            <input type="date" id="obra-fin" required>
          </div>
        </div>
        <p class="hint" style="margin-bottom:12px;">La responsabilidad legal (3/5/10 años según el tipo de falla) se calcula sola desde la fecha de Recepción Definitiva — que se registra por separado, cuando ocurra.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-obra">Cancelar</button>
          <button type="submit" class="btn btn-primary">Activar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-obra").addEventListener("click", Modal.close);
  document.getElementById("form-nueva-obra").addEventListener("submit", async (e) => {
    e.preventDefault();

    const { data: obra, error } = await supabase
      .from("pv_obras")
      .insert({
        obra: document.getElementById("obra-nombre").value.trim(),
        centro_costo: document.getElementById("obra-cc").value.trim() || null,
        cliente: document.getElementById("obra-cliente").value.trim() || null,
        fecha_activacion: document.getElementById("obra-rp").value,
        fecha_fin_garantia: document.getElementById("obra-fin").value,
      })
      .select()
      .single();

    if (error) {
      Toast.error("Error al activar la obra", error.message);
      return;
    }

    const { error: errToken } = await supabase.from("postventa_accesos_obra").insert({ obra: obra.obra, obra_id: obra.id, activo: true });

    if (errToken) {
      Toast.error("Obra creada, pero falló el link de reporte", errToken.message);
    } else {
      Toast.success("Obra activada", "Ya puedes ver y compartir su link de reporte.");
    }
    Modal.close();
    window.Router.go("postventa");
  });
}

async function mostrarLinkReporte(obraId) {
  const { data: acceso } = await supabase.from("postventa_accesos_obra").select("token").eq("obra_id", obraId).eq("activo", true).maybeSingle();

  if (!acceso) {
    Toast.error("Sin link activo", "Esta obra no tiene un link de reporte activo.");
    return;
  }

  const url = `${window.location.origin}${window.location.pathname}?reportar=${acceso.token}`;

  Modal.open({
    title: "Link de reporte de la obra",
    content: `
      <p class="lead" style="margin-bottom:12px;">Este link es <strong>permanente</strong> mientras dure la garantía — el mismo sirve para todos los reportes de esta obra:</p>
      <input type="text" readonly value="${url}" id="link-obra"
             style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:12.5px; margin-bottom:16px;">
      <div class="form-actions">
        <button type="button" class="btn btn-primary" id="btn-copiar-link-obra">Copiar link</button>
      </div>
    `,
  });
  document.getElementById("btn-copiar-link-obra").addEventListener("click", () => {
    document.getElementById("link-obra").select();
    navigator.clipboard.writeText(url);
    Toast.success("Copiado", "El link quedó en tu portapapeles.");
  });
}

function abrirModalRegistrarRD(obraId) {
  Modal.open({
    title: "Registrar Recepción Definitiva",
    content: `
      <p class="lead" style="margin-bottom:12px;">Desde esta fecha empiezan a correr los plazos legales (3/5/10 años según el tipo de falla) para todos los reportes que lleguen después del servicio activo.</p>
      <form id="form-registrar-rd">
        <div class="form-field">
          <label class="form-label">Fecha de Recepción Definitiva<span class="req">*</span></label>
          <input type="date" id="rd-fecha" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-rd">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-rd").addEventListener("click", Modal.close);
  document.getElementById("form-registrar-rd").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("pv_obras")
      .update({ fecha_recepcion_definitiva: document.getElementById("rd-fecha").value })
      .eq("id", obraId);

    if (error) {
      Toast.error("Error al registrar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Recepción Definitiva registrada", "Los plazos legales ya se calculan desde esta fecha.");
    window.Router.go("postventa");
  });
}
