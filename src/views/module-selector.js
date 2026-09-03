import { state } from "../core/state.js";
import { Auth } from "../core/auth.js";
import { MODULOS, ICONOS } from "../config.js";
import { escapeHtml } from "../ui/utils.js";

export function renderModuleSelector() {
  const app = document.getElementById("app");

  const disponibles = MODULOS.filter((m) =>
    state.accesos.some((a) => a.modulo === m.modulo)
  );

  const saludo = state.user?.nombre
    ? `Hola, ${escapeHtml(state.user.nombre)}`
    : "Sistema de gestión de calidad";

  const tarjetas = disponibles.length
    ? disponibles
        .map(
          (m) => `
      <button class="module-card" data-modulo="${m.modulo}">
        <div class="module-card-icon">${m.icono}</div>
        <div class="module-card-title">${escapeHtml(m.titulo)}</div>
        <div class="module-card-desc">${escapeHtml(m.descripcion)}</div>
      </button>`
        )
        .join("")
    : `<p class="shell-empty">Todavía no tienes ningún módulo asignado. Pídele a Calidad o a RRHH que te dé acceso.</p>`;

  app.innerHTML = `
    <div class="shell">
      <div class="shell-header">
        <div class="shell-header-brand">
          <div class="shell-header-badge">${ICONOS.shieldCheck}</div>
          <div>
            <div class="shell-header-title">Metalium</div>
            <div class="shell-header-subtitle">${saludo}</div>
          </div>
        </div>
        <button id="btn-logout" class="shell-logout">${ICONOS.logOut} Cerrar sesión</button>
      </div>

      <div class="module-grid">
        ${tarjetas}
      </div>
    </div>
  `;

  document.getElementById("btn-logout").addEventListener("click", Auth.logout);

  document.querySelectorAll(".module-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.moduloActivo = card.dataset.modulo;
      renderModuloPlaceholder(state.moduloActivo);
    });
  });
}

// Placeholder — cada módulo se construye como su propia vista en src/views/
// y se conecta aquí a medida que se desarrolla.
function renderModuloPlaceholder(modulo) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="shell">
      <button id="btn-volver" class="shell-logout" style="color: var(--mtl-text); margin-bottom: 16px;">
        ← Volver al selector
      </button>
      <p>Módulo «${escapeHtml(modulo)}» — pantallas por construir.</p>
    </div>
  `;
  document.getElementById("btn-volver").addEventListener("click", () => {
    state.moduloActivo = null;
    renderModuleSelector();
  });
}
