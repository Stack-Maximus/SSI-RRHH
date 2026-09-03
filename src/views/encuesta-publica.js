/**
 * Encuesta pública de satisfacción — sin sesión, vía ?encuesta=TOKEN
 */
import { supabase } from "../core/supabase.js";

const NOMBRES_DIMENSION = {
  D1: "Calidad de la obra y los trabajos entregados",
  D2: "Cumplimiento de plazos e hitos comprometidos",
  D3: "Comunicación y capacidad de respuesta del equipo",
  D4: "Seguridad, orden y limpieza en la faena",
  D5: "Gestión administrativa: estados de pago y documentación",
  D6: "Postventa y tratamiento de observaciones",
};

export async function renderEncuestaPublica(token) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="encuesta-screen"><div class="encuesta-card"><div class="encuesta-estado"><p>Cargando...</p></div></div></div>`;

  const { data, error } = await supabase.rpc("obtener_encuesta_satisfaccion", { p_token: token });

  if (error || !data || !data.length) {
    mostrarEstado({
      icono: "🔒",
      titulo: "Este enlace ya no es válido",
      texto: "Puede que ya hayas respondido esta encuesta, o que el enlace haya vencido. Si crees que esto es un error, contacta a tu ejecutivo de proyecto en Metalium.",
    });
    return;
  }

  const { obra, dimensiones } = data[0];
  const respuestas = {};
  let nps = null;

  const filasDimension = (dimensiones || [])
    .map(
      (d) => `
    <div class="dimension-rating" data-dim-row="${d.codigo}">
      <div class="dimension-rating-label">${NOMBRES_DIMENSION[d.codigo] || d.nombre}</div>
      <div class="estrellas">
        ${[1, 2, 3, 4, 5]
          .map((n) => `<button type="button" class="estrella-btn" data-dim="${d.codigo}" data-valor="${n}">★</button>`)
          .join("")}
      </div>
    </div>`
    )
    .join("");

  document.getElementById("app").innerHTML = `
    <div class="encuesta-screen">
      <div class="encuesta-card">
        <div class="encuesta-header">
          <div class="logo-badge">M</div>
          <h1>¿Cómo fue tu experiencia?</h1>
          <p>Obra: ${escapeHtmlLocal(obra)} — Metalium SpA</p>
        </div>

        ${filasDimension}

        <div class="nps-pregunta">
          <div class="nps-pregunta-texto">¿Qué tan probable es que recomiendes a Metalium a otra persona u empresa?</div>
          <div class="nps-escala" id="nps-escala">
            ${Array.from({ length: 11 }, (_, i) => `<button type="button" class="nps-btn" data-nps="${i}">${i}</button>`).join("")}
          </div>
          <div class="nps-labels"><span>Nada probable</span><span>Muy probable</span></div>
        </div>

        <textarea class="encuesta-comentario" id="encuesta-comentario" placeholder="¿Algo que quieras contarnos? (opcional)"></textarea>

        <div style="margin-top:20px;">
          <button class="btn btn-primary" id="btn-enviar-encuesta" style="width:100%;">Enviar</button>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll(".estrella-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dim = btn.dataset.dim;
      const valor = Number(btn.dataset.valor);
      respuestas[dim] = valor;
      document.querySelectorAll(`[data-dim-row="${dim}"] .estrella-btn`).forEach((b) => {
        b.classList.toggle("activa", Number(b.dataset.valor) <= valor);
      });
    });
  });

  document.querySelectorAll(".nps-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      nps = Number(btn.dataset.nps);
      document.querySelectorAll(".nps-btn").forEach((b) => b.classList.toggle("activa", Number(b.dataset.nps) === nps));
    });
  });

  document.getElementById("btn-enviar-encuesta").addEventListener("click", async () => {
    const faltantes = (dimensiones || []).filter((d) => !respuestas[d.codigo]);
    if (faltantes.length || nps === null) {
      alert("Por favor califica todas las dimensiones y la pregunta de recomendación antes de enviar.");
      return;
    }

    const btn = document.getElementById("btn-enviar-encuesta");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    const notasLower = {};
    Object.entries(respuestas).forEach(([k, v]) => (notasLower[k.toLowerCase()] = v));

    const comentario = document.getElementById("encuesta-comentario").value.trim() || null;

    const { data: ok, error: errResp } = await supabase.rpc("responder_encuesta_satisfaccion", {
      p_token: token,
      p_notas: notasLower,
      p_nps: nps,
      p_comentario: comentario,
    });

    if (errResp || !ok) {
      btn.disabled = false;
      btn.textContent = "Enviar";
      alert("No pudimos registrar tu respuesta. Intenta nuevamente en unos minutos.");
      return;
    }

    mostrarEstado({
      icono: "✅",
      titulo: "¡Gracias por tu tiempo!",
      texto: "Tu opinión nos ayuda a mejorar. Si marcaste algún punto crítico, alguien de Metalium se pondrá en contacto contigo pronto.",
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
