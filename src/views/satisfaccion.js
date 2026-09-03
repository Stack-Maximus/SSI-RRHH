/**
 * Satisfacción del Cliente · vista principal.
 */
import { supabase } from "../core/supabase.js";
import { Toast } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";

const TIPO_LABELS = { cierre: "Cierre de obra", pulso: "Pulso semestral", postventa: "Postventa", campania: "Campaña anual" };
const ESTADO_INV_BADGE = { enviada: "badge-neutral", recordada: "badge-warning", respondida: "badge-success", vencida: "badge-danger", gestionada: "badge-info" };

export async function renderSatisfaccion(container) {
  container.innerHTML = `<div class="view-loading">Cargando...</div>`;

  const [{ data: respuestas }, { data: alertas }, { data: invitaciones }, { data: clientes }] = await Promise.all([
    supabase.from("sat_respuestas").select("isc, nps, semaforo"),
    supabase.from("sat_alertas").select("*").in("estado", ["abierta", "en_proceso"]).order("fecha_alerta", { ascending: false }),
    supabase
      .from("sat_invitaciones")
      .select("*, contacto:contacto_id(nombre, cliente:cliente_id(mandante))")
      .order("fecha_envio", { ascending: false })
      .limit(30),
    supabase.from("sat_clientes").select("*, sat_contactos(*)").order("mandante"),
  ]);

  const totalResp = (respuestas || []).length;
  const iscProm = totalResp ? (respuestas.reduce((a, r) => a + (r.isc || 0), 0) / totalResp).toFixed(2) : "—";
  const npsProm = totalResp ? Math.round(respuestas.reduce((a, r) => a + (r.nps || 0), 0) / totalResp) : "—";
  const alertasAbiertas = (alertas || []).length;

  const filasAlertas = (alertas || []).length
    ? alertas
        .map((a) => {
          const venceEn = a.sla_48h ? new Date(a.sla_48h) : null;
          const vencida = venceEn && venceEn < new Date();
          return `
      <tr>
        <td>${escapeHtml(a.obra || "—")}</td>
        <td>${escapeHtml(a.dimension_critica || "—")}</td>
        <td><span class="badge ${vencida ? "badge-danger" : "badge-warning"}">${venceEn ? formatDate(a.sla_48h) : "—"}${vencida ? " (vencido)" : ""}</span></td>
        <td><span class="badge badge-neutral">${escapeHtml(a.estado)}</span></td>
        <td><button class="btn btn-secondary" data-gestionar-alerta="${a.id}">Gestionar</button></td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="empty-state">Sin alertas abiertas 🎉</td></tr>`;

  const filasInvitaciones = (invitaciones || []).length
    ? invitaciones
        .map(
          (i) => `
      <tr>
        <td>${escapeHtml(i.folio)}</td>
        <td>${escapeHtml(i.obra)}</td>
        <td>${escapeHtml(i.contacto?.cliente?.mandante || "—")}</td>
        <td>${TIPO_LABELS[i.tipo_encuesta] || i.tipo_encuesta}</td>
        <td><span class="badge ${ESTADO_INV_BADGE[i.estado] || "badge-neutral"}">${escapeHtml(i.estado)}</span></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty-state">Aún no se han enviado invitaciones.</td></tr>`;

  container.innerHTML = `
    <div class="view-satisfaccion">
      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card"><div class="kpi-label">ISC promedio</div><div class="kpi-value">${iscProm}</div></div>
        <div class="kpi-card"><div class="kpi-label">NPS promedio</div><div class="kpi-value">${npsProm}</div></div>
        <div class="kpi-card"><div class="kpi-label">Respuestas totales</div><div class="kpi-value">${totalResp}</div></div>
        <div class="kpi-card"><div class="kpi-label">Alertas abiertas</div><div class="kpi-value">${alertasAbiertas}</div></div>
      </div>

      <div style="margin-bottom:16px;">
        <button class="btn btn-primary" id="btn-nueva-invitacion">+ Nueva invitación</button>
        <button class="btn btn-secondary" id="btn-nuevo-cliente">+ Nuevo cliente</button>
      </div>

      <div class="card">
        <h3>Alertas de recovery (SLA 48h)</h3>
        <table class="data-table">
          <thead><tr><th>Obra</th><th>Dimensión crítica</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filasAlertas}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3>Funnel de invitaciones (últimas 30)</h3>
        <table class="data-table">
          <thead><tr><th>Folio</th><th>Obra</th><th>Cliente</th><th>Tipo</th><th>Estado</th></tr></thead>
          <tbody>${filasInvitaciones}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-nueva-invitacion").addEventListener("click", () => abrirModalNuevaInvitacion(clientes || []));
  document.getElementById("btn-nuevo-cliente").addEventListener("click", abrirModalNuevoCliente);
  container.querySelectorAll("[data-gestionar-alerta]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalGestionarAlerta(btn.dataset.gestionarAlerta, alertas));
  });
}

function abrirModalNuevoCliente() {
  Modal.open({
    title: "Nuevo cliente",
    content: `
      <form id="form-nuevo-cliente">
        <div class="form-field">
          <label class="form-label">Mandante<span class="req">*</span></label>
          <input type="text" id="cli-mandante" required>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">RUT</label><input type="text" id="cli-rut"></div>
          <div class="form-field"><label class="form-label">Contraparte comercial</label><input type="text" id="cli-contraparte"></div>
        </div>
        <h4 style="margin:16px 0 8px;">Primer contacto</h4>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Nombre<span class="req">*</span></label><input type="text" id="cont-nombre" required></div>
          <div class="form-field"><label class="form-label">Cargo</label><input type="text" id="cont-cargo"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Correo</label><input type="email" id="cont-correo"></div>
          <div class="form-field"><label class="form-label">Teléfono</label><input type="text" id="cont-telefono"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-cliente">Cancelar</button>
          <button type="submit" class="btn btn-primary">Crear</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-cliente").addEventListener("click", Modal.close);
  document.getElementById("form-nuevo-cliente").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { data: cliente, error } = await supabase
      .from("sat_clientes")
      .insert({
        mandante: document.getElementById("cli-mandante").value.trim(),
        rut: document.getElementById("cli-rut").value.trim() || null,
        contraparte_comercial: document.getElementById("cli-contraparte").value.trim() || null,
      })
      .select()
      .single();

    if (error) {
      Toast.error("Error al crear el cliente", error.message);
      return;
    }

    const { error: errCont } = await supabase.from("sat_contactos").insert({
      cliente_id: cliente.id,
      nombre: document.getElementById("cont-nombre").value.trim(),
      cargo: document.getElementById("cont-cargo").value.trim() || null,
      correo: document.getElementById("cont-correo").value.trim() || null,
      telefono: document.getElementById("cont-telefono").value.trim() || null,
    });

    if (errCont) {
      Toast.error("Cliente creado, pero falló el contacto", errCont.message);
    } else {
      Toast.success("Cliente creado", "Ya puedes enviarle invitaciones.");
    }
    Modal.close();
    window.Router.go("satisfaccion");
  });
}

function abrirModalNuevaInvitacion(clientes) {
  const opcionesContacto = clientes
    .flatMap((c) => (c.sat_contactos || []).map((ct) => `<option value="${ct.id}">${escapeHtml(c.mandante)} — ${escapeHtml(ct.nombre)}</option>`))
    .join("");

  if (!opcionesContacto) {
    Toast.warning("Sin clientes", "Primero crea un cliente con al menos un contacto.");
    return;
  }

  Modal.open({
    title: "Nueva invitación a encuesta",
    content: `
      <form id="form-nueva-invitacion">
        <div class="form-field">
          <label class="form-label">Contacto<span class="req">*</span></label>
          <select id="inv-contacto" required><option value="">Selecciona...</option>${opcionesContacto}</select>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Obra<span class="req">*</span></label>
            <input type="text" id="inv-obra" required>
          </div>
          <div class="form-field">
            <label class="form-label">Tipo de encuesta<span class="req">*</span></label>
            <select id="inv-tipo" required>
              <option value="cierre">Cierre de obra</option>
              <option value="pulso">Pulso semestral</option>
              <option value="postventa">Postventa</option>
              <option value="campania">Campaña anual</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-inv">Cancelar</button>
          <button type="submit" class="btn btn-primary">Generar invitación</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-inv").addEventListener("click", Modal.close);
  document.getElementById("form-nueva-invitacion").addEventListener("submit", async (e) => {
    e.preventDefault();

    const folio = `SAT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data: invitacion, error } = await supabase
      .from("sat_invitaciones")
      .insert({
        folio,
        obra: document.getElementById("inv-obra").value.trim(),
        contacto_id: document.getElementById("inv-contacto").value,
        tipo_encuesta: document.getElementById("inv-tipo").value,
        estado: "enviada",
      })
      .select()
      .single();

    if (error) {
      Toast.error("Error al crear la invitación", error.message);
      return;
    }

    const { data: tokenRow, error: errToken } = await supabase
      .from("encuestas_token")
      .insert({ modulo: "satisfaccion", tipo: invitacion.tipo_encuesta, referencia_id: invitacion.id })
      .select()
      .single();

    if (errToken) {
      Toast.error("Invitación creada, pero falló el link", errToken.message);
      Modal.close();
      window.Router.go("satisfaccion");
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}?encuesta=${tokenRow.token}`;

    Modal.open({
      title: "Invitación generada",
      content: `
        <p class="lead" style="margin-bottom:12px;">Copia y envía este link al cliente (por correo, WhatsApp, etc.):</p>
        <input type="text" readonly value="${url}" id="link-generado"
               style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:12.5px; margin-bottom:16px;">
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="btn-copiar-link">Copiar link</button>
        </div>
      `,
    });
    document.getElementById("btn-copiar-link").addEventListener("click", () => {
      document.getElementById("link-generado").select();
      navigator.clipboard.writeText(url);
      Toast.success("Copiado", "El link quedó en tu portapapeles.");
    });

    window.Router.go("satisfaccion");
  });
}

async function abrirModalGestionarAlerta(alertaId, alertasActuales) {
  const alerta = (alertasActuales || []).find((a) => a.id === alertaId);
  if (!alerta) return;

  Modal.open({
    title: "Gestionar alerta de recovery",
    content: `
      <p class="lead" style="margin-bottom:12px;">Obra: <strong>${escapeHtml(alerta.obra || "—")}</strong></p>
      <form id="form-gestionar-alerta">
        <div class="form-field">
          <label class="form-label">Causa raíz</label>
          <textarea id="alerta-causa" style="width:100%; min-height:70px;">${escapeHtml(alerta.causa_raiz || "")}</textarea>
        </div>
        <div class="form-field">
          <label class="form-label">Acción tomada</label>
          <textarea id="alerta-accion" style="width:100%; min-height:70px;">${escapeHtml(alerta.accion || "")}</textarea>
        </div>
        <div class="form-field">
          <label class="form-label">Estado</label>
          <select id="alerta-estado">
            <option value="abierta" ${alerta.estado === "abierta" ? "selected" : ""}>Abierta</option>
            <option value="en_proceso" ${alerta.estado === "en_proceso" ? "selected" : ""}>En proceso</option>
            <option value="cerrada" ${alerta.estado === "cerrada" ? "selected" : ""}>Cerrada</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-alerta">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-alerta").addEventListener("click", Modal.close);
  document.getElementById("form-gestionar-alerta").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevoEstado = document.getElementById("alerta-estado").value;

    const { error } = await supabase
      .from("sat_alertas")
      .update({
        causa_raiz: document.getElementById("alerta-causa").value.trim() || null,
        accion: document.getElementById("alerta-accion").value.trim() || null,
        estado: nuevoEstado,
        contacto_realizado_fecha: nuevoEstado !== "abierta" ? new Date().toISOString() : alerta.contacto_realizado_fecha,
        cierre_verificado: nuevoEstado === "cerrada",
      })
      .eq("id", alertaId);

    if (error) {
      Toast.error("Error al guardar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Alerta actualizada", "");
    window.Router.go("satisfaccion");
  });
}
