/**
 * Router · cambia entre vistas dentro de #content.
 * Valida el acceso según rol, actualiza el título del topbar y el item activo.
 * Adaptado de GOL. Varias vistas son placeholders por ahora.
 */

import { state } from './state.js';
import { ROLES } from '../config.js';
import { Toast } from '../ui/toast.js';
import { Shell } from './shell.js';

import { renderInicio } from '../views/inicio.js';
import { renderNuevaSolicitud } from '../views/nueva-solicitud.js';
import { renderMisSolicitudes } from '../views/mis-solicitudes.js';
import { renderBandeja } from '../views/bandeja.js';
import { renderUsuarios } from '../views/usuarios.js';
import { renderCentrosCosto } from '../views/centros-costo.js';
import { renderCargos } from '../views/cargos.js';
import { renderSolicitudes, renderHistorial } from '../views/solicitudes.js';
import { renderDashboard } from '../views/dashboard.js';
import { renderTrabajadores } from '../views/trabajadores.js';
import { renderContrataciones } from '../views/contrataciones.js';
import { renderHomologacion } from '../views/homologacion.js';
import { renderChecklistDocumentos } from '../views/checklist-documentos.js';
import { renderDashboardRRHH } from '../views/dashboard-rrhh.js';
import { renderDashboardPrevencion } from '../views/dashboard-prevencion.js';
import { makePlaceholder } from '../views/placeholder.js';

const VIEWS = {
  'inicio':               renderInicio,
  'nueva-solicitud':      renderNuevaSolicitud,
  'mis-solicitudes':      renderMisSolicitudes,
  'bandeja':              renderBandeja,
  'solicitudes':          renderSolicitudes,
  'historial':            renderHistorial,
  'contrataciones':       renderContrataciones,
  'homologacion':         renderHomologacion,
  'checklist-documentos': renderChecklistDocumentos,
  'dashboard-rrhh':       renderDashboardRRHH,
  'dashboard-prevencion': renderDashboardPrevencion,
  'usuarios':             renderUsuarios,
  'centros-costo':        renderCentrosCosto,
  'cargos':               renderCargos,
  'trabajadores':         renderTrabajadores,
  'kpis':                 renderDashboard
};

const TITLES = {
  'inicio':               ['Inicio', 'Resumen de tu actividad'],
  'nueva-solicitud':      ['Nueva solicitud', 'Crear una solicitud de ingreso o traslado'],
  'mis-solicitudes':      ['Mis solicitudes', 'Solicitudes que creaste y su estado'],
  'bandeja':              ['Bandeja de aprobación', 'Solicitudes pendientes de tu aprobación'],
  'solicitudes':          ['Solicitudes', 'Todas las solicitudes'],
  'historial':            ['Historial', 'Solicitudes finalizadas'],
  'contrataciones':       ['Contratación', 'Ingresos aprobados en proceso de contratación'],
  'homologacion':         ['Homologación SST', 'Documentos de contratación para homologar ante el cliente'],
  'checklist-documentos': ['Checklist de documentos', 'Catálogo de documentos del proceso de contratación'],
  'dashboard-rrhh':       ['SLA Contratación', 'Tiempos de armado de contrato · meta: 3 días hábiles'],
  'dashboard-prevencion': ['SLA Homologación', 'Tiempos de homologación SST · meta: 8 días hábiles'],
  'usuarios':             ['Usuarios', 'Gestión de cuentas y roles'],
  'centros-costo':        ['Centros de costo', 'Obras y administradores de obra'],
  'cargos':               ['Cargos', 'Lista de cargos para las solicitudes'],
  'trabajadores':         ['Trabajadores', 'Personal de la empresa'],
  'kpis':                 ['Dashboard', 'Métricas y tiempos de respuesta']
};

export const Router = {
  go(view) {
    if (!state.user) return;

    const allowed = ROLES[state.user.role].menu;
    if (!allowed.includes(view)) {
      Toast.warning('Acceso denegado', 'Tu rol no tiene acceso a esa vista.');
      view = allowed[0];
    }

    state.currentView = view;
    const [title, subtitle] = TITLES[view] || [view, ''];
    Shell.setTitle(title, subtitle);
    Shell.updateNav();

    const content = document.getElementById('content');
    content.innerHTML = '<div class="view-loading">Cargando...</div>';

    try {
      const renderFn = VIEWS[view];
      if (!renderFn) throw new Error(`Vista no registrada: ${view}`);
      renderFn(content);
    } catch (e) {
      console.error(`[router] Error en vista ${view}:`, e);
      content.innerHTML = `
        <div class="placeholder error">
          <div class="placeholder-icon">⚠️</div>
          <h2>Error al cargar la vista</h2>
          <p class="lead">${e.message || 'Error desconocido'}</p>
          <p class="hint">Revisa la consola del navegador (F12) para más detalles.</p>
        </div>
      `;
    }
  }
};
