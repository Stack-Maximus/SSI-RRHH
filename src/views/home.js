/**
 * Panel principal · selector de módulos.
 */
import { state } from "../core/state.js";
import { NAV_META } from "../config.js";
import { escapeHtml } from "../ui/utils.js";

export function renderHome(container) {
  const u = state.user;
  const firstName = (u.name || "").split(" ")[0];

  const TODOS_LOS_MODULOS = ["personal", "proveedores", "satisfaccion", "no_conformidades", "postventa"];
  const modulos = u.esAdmin ? TODOS_LOS_MODULOS : state.accesos.map((a) => a.modulo);

  const tarjetas = modulos.length
    ? modulos
        .map((modulo) => {
          const meta = NAV_META[modulo] || { icon: "•", label: modulo };
          return `
        <button class="kpi-card modulo-card" data-view="${modulo}">
          <div class="modulo-card-icon">${meta.icon}</div>
          <div class="kpi-label">${escapeHtml(meta.label)}</div>
        </button>`;
        })
        .join("")
    : `<div class="empty-state">
        <p>Todavía no tienes ningún módulo asignado.</p>
        <p class="hint">Pídele a Calidad o a RRHH que te dé acceso.</p>
      </div>`;

  container.innerHTML = `
    <div class="view-home">
      <div class="welcome-card">
        <div>
          <h2>Hola, ${escapeHtml(firstName)}</h2>
          <p class="lead">Elige el módulo con el que quieres trabajar.</p>
        </div>
      </div>

      <div class="kpi-grid">
        ${tarjetas}
      </div>
    </div>
  `;

  container.querySelectorAll(".modulo-card").forEach((btn) => {
    btn.addEventListener("click", () => window.Router.go(btn.dataset.view));
  });
}
