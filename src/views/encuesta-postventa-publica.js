/**
 * Encuesta de cierre de un ticket de Postventa — sin sesión, de un solo uso.
 */
import { supabase } from "../core/supabase.js";

export async function renderEncuestaPostventaPublica(token) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="encuesta-screen"><div class="encuesta-card"><div class="encuesta-estado"><p>Cargando...</p></div></div></div>`;

  const { data, error } = await supabase.rpc("obtener_encuesta_postventa", { p_token: token });

  if (error || !data || !data.length) {
    mostrarEstado({
      icono: "🔒",
      titulo: "Este enlace ya no es válido",
      texto: "Puede que ya hayas respondido, o que el enlace haya vencido.",
    });
    return;
  }

  const { numero_ticket } = data[0];
  let satisfaccion = null;

  document.getElementById("app").innerHTML = `
    <div class="encuesta-screen">
      <div class="encuesta-card">
        <div class="encuesta-header">
          <div class="logo-badge">M</div>
          <h1>¿Cómo fue la solución?</h1>
          <p>Ticket ${escapeHtmlLocal(numero_ticket)} — Metalium SpA</p>
        </div>

        <div class="nps-pregunta">
          <div class="nps-pregunta-texto">En una escala de 1 a 7, ¿qué tan conforme quedaste con la solución?</div>
          <div class="nps-escala" id="satisf-escala">
            ${Array.from({ length: 7 }, (_, i) => i + 1)
              .map((n) => `<button type="button" class="nps-btn" data-satisf="${n}">${n}</button>`)
              .join("")}
          </div>
          <div class="nps-labels"><span>Nada conforme</span><span>Muy conforme</span></div>
        </div>

        <textarea class="encuesta-comentario" id="pv-comentario" placeholder="¿Algo más que quieras contarnos? (opcional)"></textarea>

        <button class="btn btn-primary" id="btn-enviar-satisf" style="width:100%; margin-top:16px;">Enviar</button>
      </div>
    </div>
  `;

  document.querySelectorAll(".nps-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      satisfaccion = Number(btn.dataset.satisf);
      document.querySelectorAll(".nps-btn").forEach((b) => b.classList.toggle("activa", Number(b.dataset.satisf) === satisfaccion));
    });
  });

  document.getElementById("btn-enviar-satisf").addEventListener("click", async () => {
    if (!satisfaccion) {
      alert("Por favor selecciona un puntaje antes de enviar.");
      return;
    }
    const btn = document.getElementById("btn-enviar-satisf");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    const comentario = document.getElementById("pv-comentario").value.trim() || null;
    const { data: ok, error: errResp } = await supabase.rpc("responder_encuesta_postventa", {
      p_token: token,
      p_satisfaccion: satisfaccion,
      p_comentario: comentario,
    });

    if (errResp || !ok) {
      btn.disabled = false;
      btn.textContent = "Enviar";
      alert("No pudimos registrar tu respuesta. Intenta nuevamente.");
      return;
    }

    mostrarEstado({ icono: "✅", titulo: "¡Gracias!", texto: "Tu opinión quedó registrada." });
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
