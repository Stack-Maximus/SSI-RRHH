/**
 * Vista de inicio: tarjeta de bienvenida + accesos según rol + estado del proyecto.
 * Usa las clases compartidas de views.css (welcome-card, kpi-grid, card, roadmap-list).
 */

import { state } from '../core/state.js';
import { ROLES, NAV_META, ROLE_LABELS } from '../config.js';
import { escapeHtml } from '../ui/utils.js';

export function renderInicio(container) {
  const u = state.user;
  const rol = ROLE_LABELS[u.role] || u.role;

  // Accesos rápidos = el resto del menú del rol (sin "inicio")
  const accesos = ROLES[u.role].menu
    .filter(v => v !== 'inicio')
    .map(v => {
      const m = NAV_META[v];
      return `
        <button class="kpi-card" data-go="${v}" style="cursor:pointer;text-align:left;border:1px solid var(--border);">
          <div class="kpi-label">${m.icon} Acceso</div>
          <div class="kpi-value" style="font-size:18px;">${m.label}</div>
        </button>`;
    }).join('');

  container.innerHTML = `
    <div class="welcome-card">
      <h2>Hola, ${escapeHtml(u.name)}</h2>
      <p class="lead">Sistema de Solicitudes de Ingreso y Traslado · Rol: ${rol}</p>
    </div>

    <div class="kpi-grid">${accesos}</div>

    <div class="card">
      <h3>Estado del proyecto</h3>
      <ul class="roadmap-list">
        <li><span class="tag">OK</span> Autenticación, roles y seguridad (RLS) — funcionando.</li>
        <li><span class="tag">OK</span> Base de datos y motor de aprobaciones — listos.</li>
        <li><span class="tag">F4</span> Próximo: crear solicitudes de ingreso y traslado.</li>
        <li><span class="tag">F5</span> Bandeja de aprobación con tiempos de respuesta.</li>
        <li><span class="tag">F7</span> Panel admin, importador de Excel y dashboard.</li>
      </ul>
    </div>
  `;

  container.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => window.Router.go(btn.dataset.go));
  });
}
