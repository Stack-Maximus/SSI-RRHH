/**
 * Shell · estructura permanente de la app (sidebar + topbar + slot #content).
 * Adaptado de GOL: mismos estilos y comportamiento responsive (drawer en mobile).
 */

import { state } from './state.js';
import { ROLES, NAV_META } from '../config.js';
import { roleLabel, initials, escapeHtml } from '../ui/utils.js';

export const Shell = {
  render() {
    const u = state.user;
    if (!u) return;

    const allowedViews = ROLES[u.role].menu;
    const navHTML = allowedViews.map(view => {
      const meta = NAV_META[view];
      const isActive = state.currentView === view ? 'active' : '';
      return `
        <button class="nav-item ${isActive}" data-view="${view}">
          <span class="nav-icon">${meta.icon}</span>
          <span class="nav-label">${meta.label}</span>
        </button>`;
    }).join('');

    document.getElementById('app').innerHTML = `
      <div id="app-shell">
        <div id="sidebar-overlay" class="sidebar-overlay"></div>

        <aside id="sidebar">
          <button class="sidebar-close-btn" id="sidebar-close" aria-label="Cerrar menú">×</button>

          <div class="sidebar-brand">
            <div class="sidebar-brand-logo"><img src="/Logo_Metalium.png" alt="Metalium" /></div>
            <div class="sidebar-brand-text">
              <div class="name">SSI-RRHH</div>
              <div class="sub">Metalium SpA</div>
            </div>
          </div>

          <div class="sidebar-section-title">Navegación</div>
          <nav class="sidebar-nav" id="sidebar-nav">${navHTML}</nav>

          <div class="sidebar-footer">
            <div class="kv"><span>Versión</span><span>0.1</span></div>
            <div class="kv"><span>Rol</span><span>${roleLabel(u.role)}</span></div>
          </div>
        </aside>

        <header id="topbar">
          <div class="topbar-left">
            <button class="hamburger-btn" id="hamburger-btn" aria-label="Abrir menú">
              <span></span><span></span><span></span>
            </button>
            <div>
              <h1 class="topbar-title" id="topbar-title">Inicio</h1>
              <p class="topbar-subtitle" id="topbar-subtitle"></p>
            </div>
          </div>
          <div class="topbar-right">
            <button class="topbar-icon-btn" id="refresh-btn" title="Actualizar vista">↻</button>
            <button class="user-chip" id="user-chip-btn" title="Cerrar sesión">
              <div class="user-avatar">${initials(u.name)}</div>
              <div class="user-info">
                <div class="name">${escapeHtml(u.name)}</div>
                <div class="role">${roleLabel(u.role)}</div>
              </div>
            </button>
          </div>
        </header>

        <main id="content"></main>
      </div>
    `;

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        window.Router.go(btn.dataset.view);
        Shell.closeSidebar();
      });
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
      window.Router.go(state.currentView);
    });
    document.getElementById('user-chip-btn').addEventListener('click', () => window.Auth.logout());

    document.getElementById('hamburger-btn').addEventListener('click', Shell.toggleSidebar);
    document.getElementById('sidebar-close').addEventListener('click', Shell.closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', Shell.closeSidebar);
  },

  toggleSidebar() {
    document.getElementById('app-shell').classList.toggle('sidebar-open');
  },

  closeSidebar() {
    document.getElementById('app-shell')?.classList.remove('sidebar-open');
  },

  updateNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === state.currentView);
    });
  },

  setTitle(title, subtitle) {
    const t = document.getElementById('topbar-title');
    const s = document.getElementById('topbar-subtitle');
    if (t) t.textContent = title;
    if (s) s.textContent = subtitle || '';
  }
};
