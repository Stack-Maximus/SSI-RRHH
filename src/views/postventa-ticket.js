/**
 * Ficha de gestión de un ticket de Postventa: triage, plan de acción con
 * costos, y cierre con Acta de Conformidad (que dispara la encuesta final).
 * Después de cada acción, se queda en la misma ficha ya actualizada.
 */

import { supabase } from "../core/supabase.js";
import { Toast, Confirm } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";

const FASE_LABELS = { servicio_activo: "Servicio activo", pendiente_recepcion_definitiva: "Pendiente RD", post_garantia_legal: "Post-garantía · evaluación legal", fuera_de_plazo: "Fuera de plazo" };
const FASE_BADGE = { servicio_activo: "badge-success", pendiente_recepcion_definitiva: "badge-warning", post_garantia_legal: "badge-warning", fuera_de_plazo: "badge-danger" };

export async function renderTicketPostventa(container, ticket) {
  container.innerHTML = `<div class="view-loading">Cargando ficha...</div>`;

  const [{ data: plan }, { data: perfiles }] = await Promise.all([
    supabase.from("pv_plan_accion").select("*, responsable:responsable_id(nombre)").eq("ticket_id", ticket.id).order("nro_actividad"),
    supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  const costoTotalPlan = (plan || []).reduce((acc, p) => acc + (p.costo_total || 0), 0);

  const filasPlan = (plan || []).length
    ? plan
        .map(
          (p) => `
      <tr>
        <td>${p.nro_actividad ?? "—"}</td>
        <td>${escapeHtml(p.actividad || "—")}</td>
        <td>${escapeHtml(p.responsable?.nombre || "—")}</td>
        <td>${formatDate(p.fecha_planificada)}</td>
        <td>$${(p.costo_total || 0).toLocaleString("es-CL")}</td>
        <td><span class="badge badge-neutral">${escapeHtml(p.estado)}</span></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty-state">Sin actividades planificadas todavía.</td></tr>`;

  const puedeTriagear = ticket.estado === "reportado";
  const puedeCerrar = !["cerrado"].includes(ticket.estado) && (plan || []).length > 0;

  container.innerHTML = `
    <div class="view-form">
      <button class="btn btn-secondary" id="btn-volver-pv" style="margin-bottom:16px;">← Volver</button>

      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div>
            <h3>${escapeHtml(ticket.numero_ticket)}</h3>
            <p class="lead">${escapeHtml(ticket.obra)} — ${escapeHtml(ticket.ubicacion || "—")}</p>
          </div>
          <span class="badge ${FASE_BADGE[ticket.fase_garantia] || "badge-neutral"}">${FASE_LABELS[ticket.fase_garantia] || "—"}</span>
        </div>

        ${
          ticket.fase_garantia === "pendiente_recepcion_definitiva"
            ? `<div class="form-error" style="margin-bottom:12px;">El servicio activo de 12 meses ya terminó, pero esta obra todavía no tiene registrada su Recepción Definitiva — no se puede calcular el plazo legal exacto hasta que se registre. Avísale a Operaciones que la regularice.</div>`
            : ""
        }
        ${
          ticket.fase_garantia === "post_garantia_legal"
            ? `<div class="form-error" style="margin-bottom:12px;">Este reporte llegó fuera del servicio activo de 12 meses, pero dentro del plazo de responsabilidad legal. Debe evaluarse con el Gerente de Operaciones y el asesor legal antes de proceder.</div>`
            : ""
        }
        ${
          ticket.fase_garantia === "fuera_de_plazo"
            ? `<div class="form-error" style="margin-bottom:12px;">Este reporte llegó después del plazo legal aplicable a esta tipología — probablemente no tiene respaldo para exigir cobertura, evalúa si corresponde continuar.</div>`
            : ""
        }

        <p style="margin-bottom:16px;"><strong>Descripción:</strong> ${escapeHtml(ticket.descripcion_falla)}</p>

        <div class="stat-row"><span>Reportante</span><span>${escapeHtml(ticket.reportante || "—")} (${escapeHtml(ticket.rol_reportante || "—")})</span></div>
        <div class="stat-row"><span>Contacto</span><span>${escapeHtml(ticket.correo || "—")} · ${escapeHtml(ticket.telefono || "—")}</span></div>
        <div class="stat-row"><span>Severidad</span><span>${escapeHtml(ticket.severidad || "Sin triage")}</span></div>
        <div class="stat-row"><span>Imputabilidad</span><span>${escapeHtml(ticket.imputabilidad || "—")}</span></div>

        ${puedeTriagear ? `<button class="btn btn-primary" id="btn-triage" style="margin-top:12px;">Hacer triage y asignar</button>` : ""}
      </div>

      <div class="card" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Plan de acción</h3>
          <button class="btn btn-secondary" id="btn-agregar-actividad">+ Agregar actividad</button>
        </div>
        <table class="data-table">
          <thead><tr><th>N°</th><th>Actividad</th><th>Responsable</th><th>Fecha</th><th>Costo</th><th>Estado</th></tr></thead>
          <tbody>${filasPlan}</tbody>
        </table>
        <div class="stat-row" style="margin-top:8px;"><span>Costo total planificado</span><strong>$${costoTotalPlan.toLocaleString("es-CL")}</strong></div>
      </div>

      ${
        puedeCerrar
          ? `<div class="card" style="margin-top:20px;">
              <h3>Cierre</h3>
              <p class="lead" style="margin-bottom:12px;">Cuando el trabajo esté terminado y verificado en terreno, genera el Acta de Conformidad para cerrar el ticket.</p>
              <button class="btn btn-primary" id="btn-generar-acta">Generar Acta de Conformidad</button>
            </div>`
          : ""
      }
    </div>
  `;

  document.getElementById("btn-volver-pv").addEventListener("click", () => window.Router.go("postventa"));

  if (puedeTriagear) {
    document.getElementById("btn-triage").addEventListener("click", () => abrirModalTriage(ticket, perfiles || []));
  }
  document.getElementById("btn-agregar-actividad").addEventListener("click", () => abrirModalActividad(ticket, perfiles || [], (plan || []).length));
  if (puedeCerrar) {
    document.getElementById("btn-generar-acta").addEventListener("click", () => abrirModalActa(ticket, perfiles || []));
  }
}

/** Recarga la misma ficha del ticket, ya actualizada, sin volver a la lista. */
async function recargarFicha(container, ticketId) {
  const { data: ticketActualizado } = await supabase.from("pv_tickets").select("*").eq("id", ticketId).single();
  if (ticketActualizado) {
    await renderTicketPostventa(container, ticketActualizado);
  } else {
    window.Router.go("postventa");
  }
}

function abrirModalTriage(ticket, perfiles) {
  const opciones = perfiles.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");

  Modal.open({
    title: "Triage del ticket",
    content: `
      <form id="form-triage">
        <div class="form-field">
          <label class="form-label">Severidad<span class="req">*</span></label>
          <select id="triage-severidad" required>
            <option value="s1_critica">S1 · Crítica</option>
            <option value="s2_alta">S2 · Alta</option>
            <option value="s3_media">S3 · Media</option>
            <option value="s4_cosmetica">S4 · Cosmética</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Imputabilidad<span class="req">*</span></label>
          <select id="triage-imputabilidad" required>
            <option value="garantia">Garantía (cargo Metalium)</option>
            <option value="no_imputable">No imputable (cargo cliente)</option>
            <option value="mixta">Mixta</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Responsable técnico<span class="req">*</span></label>
          <select id="triage-responsable" required><option value="">Selecciona...</option>${opciones}</select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-triage">Cancelar</button>
          <button type="submit" class="btn btn-primary">Asignar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-triage").addEventListener("click", Modal.close);
  document.getElementById("form-triage").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("pv_tickets")
      .update({
        severidad: document.getElementById("triage-severidad").value,
        imputabilidad: document.getElementById("triage-imputabilidad").value,
        responsable_id: document.getElementById("triage-responsable").value,
        fecha_asignacion: new Date().toISOString().slice(0, 10),
        estado: "asignado",
      })
      .eq("id", ticket.id);

    if (error) {
      Toast.error("Error al asignar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Ticket asignado", "");
    await recargarFicha(document.getElementById("content"), ticket.id);
  });
}

function abrirModalActividad(ticket, perfiles, nroActual) {
  const opciones = perfiles.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");

  Modal.open({
    title: "Nueva actividad del plan de acción",
    content: `
      <form id="form-actividad">
        <div class="form-field">
          <label class="form-label">Actividad<span class="req">*</span></label>
          <input type="text" id="act-descripcion" required>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Responsable</label><select id="act-responsable"><option value="">Sin asignar</option>${opciones}</select></div>
          <div class="form-field"><label class="form-label">Fecha planificada</label><input type="date" id="act-fecha"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Costo materiales</label><input type="number" id="act-costo-mat" min="0" step="1"></div>
          <div class="form-field"><label class="form-label">Costo HH/subcontrato</label><input type="number" id="act-costo-hh" min="0" step="1"></div>
        </div>
        <div class="form-field">
          <label class="form-label">Materiales / recursos necesarios</label>
          <textarea id="act-materiales" style="width:100%; min-height:60px;"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-act">Cancelar</button>
          <button type="submit" class="btn btn-primary">Agregar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-act").addEventListener("click", Modal.close);
  document.getElementById("form-actividad").addEventListener("submit", async (e) => {
    e.preventDefault();
    const costoMat = Number(document.getElementById("act-costo-mat").value) || 0;
    const costoHH = Number(document.getElementById("act-costo-hh").value) || 0;

    const { error } = await supabase.from("pv_plan_accion").insert({
      ticket_id: ticket.id,
      nro_actividad: nroActual + 1,
      actividad: document.getElementById("act-descripcion").value.trim(),
      responsable_id: document.getElementById("act-responsable").value || null,
      fecha_planificada: document.getElementById("act-fecha").value || null,
      materiales_recursos: document.getElementById("act-materiales").value.trim() || null,
      costo_materiales: costoMat,
      costo_hh_subcontrato: costoHH,
      costo_total: costoMat + costoHH,
      estado: "planificada",
    });

    if (error) {
      Toast.error("Error al agregar la actividad", error.message);
      return;
    }

    if (ticket.estado === "asignado") {
      await supabase.from("pv_tickets").update({ estado: "en_plan", fecha_plan_accion: new Date().toISOString().slice(0, 10) }).eq("id", ticket.id);
    }

    Modal.close();
    Toast.success("Actividad agregada", "");
    await recargarFicha(document.getElementById("content"), ticket.id);
  });
}

function abrirModalActa(ticket, perfiles) {
  const opciones = perfiles.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");

  Modal.open({
    title: "Acta de Conformidad",
    content: `
      <form id="form-acta">
        <div class="form-field">
          <label class="form-label">Descripción de los trabajos realizados<span class="req">*</span></label>
          <textarea id="acta-descripcion" required style="width:100%; min-height:70px;"></textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Responsable técnico</label><select id="acta-responsable"><option value="">Selecciona...</option>${opciones}</select></div>
          <div class="form-field"><label class="form-label">Fecha de término</label><input type="date" id="acta-fecha-termino" required></div>
        </div>
        <h4 style="margin:14px 0 8px;">Firma del cliente</h4>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Nombre<span class="req">*</span></label><input type="text" id="acta-firmante-nombre" required></div>
          <div class="form-field"><label class="form-label">RUT</label><input type="text" id="acta-firmante-rut"></div>
        </div>
        <div class="form-field"><label class="form-label">Cargo / relación con la obra</label><input type="text" id="acta-firmante-cargo"></div>
        <p class="hint" style="margin-bottom:12px;">Al guardar, el ticket queda cerrado y se genera automáticamente el link de la encuesta de satisfacción de cierre.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-acta">Cancelar</button>
          <button type="submit" class="btn btn-primary">Cerrar ticket</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-acta").addEventListener("click", Modal.close);
  document.getElementById("form-acta").addEventListener("submit", async (e) => {
    e.preventDefault();

    const ok = await Confirm.ask({ title: "¿Cerrar este ticket?", text: "Esta acción no se puede deshacer.", confirmText: "Cerrar ticket" });
    if (!ok) return;

    const { error: errActa } = await supabase.from("pv_actas_conformidad").insert({
      ticket_id: ticket.id,
      descripcion_trabajos: document.getElementById("acta-descripcion").value.trim(),
      responsable_tecnico_id: document.getElementById("acta-responsable").value || null,
      fecha_termino_trabajos: document.getElementById("acta-fecha-termino").value,
      firmante_cliente_nombre: document.getElementById("acta-firmante-nombre").value.trim(),
      firmante_cliente_rut: document.getElementById("acta-firmante-rut").value.trim() || null,
      firmante_cliente_cargo: document.getElementById("acta-firmante-cargo").value.trim() || null,
      fecha_firma: new Date().toISOString().slice(0, 10),
    });

    if (errActa) {
      Toast.error("Error al generar el acta", errActa.message);
      return;
    }

    await supabase
      .from("pv_tickets")
      .update({ estado: "cerrado", fecha_acta_conformidad: new Date().toISOString().slice(0, 10) })
      .eq("id", ticket.id);

    const { data: tokenRow, error: errToken } = await supabase
      .from("encuestas_token")
      .insert({ modulo: "postventa", tipo: "encuesta_cierre_ticket", referencia_id: ticket.id })
      .select()
      .single();

    Modal.close();

    if (errToken) {
      Toast.success("Ticket cerrado", "Pero falló la generación del link de encuesta.");
      await recargarFicha(document.getElementById("content"), ticket.id);
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}?encuesta_postventa=${tokenRow.token}`;

    Modal.open({
      title: "Ticket cerrado",
      content: `
        <p class="lead" style="margin-bottom:12px;">Comparte este link con el cliente para conocer su satisfacción con la solución:</p>
        <input type="text" readonly value="${url}" id="link-cierre"
               style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:12.5px; margin-bottom:16px;">
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="btn-copiar-cierre">Copiar link</button>
        </div>
      `,
    });
    document.getElementById("btn-copiar-cierre").addEventListener("click", () => {
      document.getElementById("link-cierre").select();
      navigator.clipboard.writeText(url);
      Toast.success("Copiado", "");
    });
  });
}
