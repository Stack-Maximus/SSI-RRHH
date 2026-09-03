/**
 * Reporte público de fallas de Postventa — sin sesión, vía
 * https://.../?reportar=TOKEN (link recurrente por obra, vigente durante
 * toda la garantía — a diferencia de las encuestas, este NO se marca "usado").
 */

import { supabase } from "../core/supabase.js";

export async function renderReportarFalla(token) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="encuesta-screen"><div class="encuesta-card"><div class="encuesta-estado"><p>Cargando...</p></div></div></div>`;

  const { data, error } = await supabase.rpc("obtener_info_reporte_postventa", { p_token: token });

  if (error || !data || !data.length) {
    console.error("[reportar-falla] Error al obtener info del link:", error);
    mostrarEstado({
      icono: "🔒",
      titulo: "Este enlace no es válido",
      texto: "Puede que el link esté mal copiado o que la garantía de la obra ya haya finalizado. Contacta a tu ejecutivo de proyecto en Metalium.",
    });
    return;
  }

  const { obra, tipologias } = data[0];

  const opcionesTipologia = (tipologias || [])
    .map((t) => `<option value="${t.codigo}">${escapeHtmlLocal(t.nombre)}</option>`)
    .join("");

  document.getElementById("app").innerHTML = `
    <div class="encuesta-screen">
      <div class="encuesta-card">
        <div class="encuesta-header">
          <div class="logo-badge">M</div>
          <h1>Reportar un problema</h1>
          <p>Obra: ${escapeHtmlLocal(obra)} — Metalium SpA</p>
        </div>

        <form id="form-reportar">
          <div class="form-field">
            <label class="form-label">Tu nombre<span class="req">*</span></label>
            <input type="text" id="rep-nombre" required>
          </div>
          <div class="form-grid-2">
            <div class="form-field">
              <label class="form-label">¿Cuál es tu rol?</label>
              <select id="rep-rol">
                <option value="propietario">Propietario</option>
                <option value="administrador">Administrador</option>
                <option value="arrendatario">Arrendatario</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div class="form-field">
              <label class="form-label">Teléfono</label>
              <input type="tel" id="rep-telefono">
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">Correo</label>
            <input type="email" id="rep-correo">
          </div>
          <div class="form-field">
            <label class="form-label">Tipo de problema<span class="req">*</span></label>
            <select id="rep-tipologia" required><option value="">Selecciona...</option>${opcionesTipologia}</select>
          </div>
          <div class="form-field">
            <label class="form-label">Ubicación<span class="req">*</span></label>
            <input type="text" id="rep-ubicacion" required placeholder="Ej: Baño segundo piso, fachada norte...">
          </div>
          <div class="form-field">
            <label class="form-label">Describe el problema<span class="req">*</span></label>
            <textarea id="rep-descripcion" class="encuesta-comentario" required placeholder="Mientras más detalle, más rápido podemos ayudarte"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Enviar reporte</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("form-reportar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    const nombre = document.getElementById("rep-nombre").value.trim();

    const { data: numeroTicket, error: errRpc } = await supabase.rpc("reportar_ticket_postventa", {
      p_token: token,
      p_datos: {
        cliente: nombre,
        reportante: nombre,
        rol_reportante: document.getElementById("rep-rol").value,
        correo: document.getElementById("rep-correo").value.trim() || null,
        telefono: document.getElementById("rep-telefono").value.trim() || null,
        tipologia: document.getElementById("rep-tipologia").value,
        ubicacion: document.getElementById("rep-ubicacion").value.trim(),
        descripcion: document.getElementById("rep-descripcion").value.trim(),
      },
    });

    // -------- diagnóstico: mira esto en la consola del navegador (F12) --------
    console.log("[reportar] numeroTicket:", numeroTicket);
    console.log("[reportar] error:", errRpc);
    // ---------------------------------------------------------------------------

    if (errRpc || !numeroTicket) {
      btn.disabled = false;
      btn.textContent = "Enviar reporte";
      alert("No pudimos registrar tu reporte. Intenta nuevamente en unos minutos.");
      return;
    }

    mostrarEstado({
      icono: "✅",
      titulo: "¡Reporte recibido!",
      texto: `Tu número de seguimiento es ${numeroTicket}. Nos pondremos en contacto contigo dentro de las próximas 24 horas.`,
    });
  });
}

function mostrarEstado({ icono, titulo, texto }) {
  document.getElementById("app").innerHTML = `
    <div class="encuesta-screen">
      <div class="encuesta-card">
        <div class="encuesta-estado">
          <div class="icono">${icono}</div>
          <h2>${titulo}</h2>
          <p>${texto}</p>
        </div>
      </div>
    </div>
  `;
}

function escapeHtmlLocal(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
