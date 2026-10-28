import '../src/styles/main.css';
import { state } from '../src/core/state.js';
import { Data } from '../src/db/data.js';
import { Shell } from '../src/core/shell.js';
import { Router } from '../src/core/router.js';
import { Toast, Confirm } from '../src/ui/toast.js';
import { renderLogin } from '../src/views/login.js';
import { renderForgotPassword } from '../src/views/forgot-password.js';
import * as F from './fixtures.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const mapBy = (rows, key) => { const m = new Map(); rows.forEach(r => { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(clone(r)); }); return m; };
const solsCon = (filtro) => F.SOLICITUDES.filter(filtro).map(s => clone(s)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
const noop = async () => {};

Object.assign(Data, {
  centros: async () => F.CENTROS.map(({ id, codigo, nombre }) => ({ id, codigo, nombre })),
  trabajadores: async () => clone(F.TRABAJADORES),
  todosTrabajadores: async () => clone(F.TRABAJADORES),
  cargos: async () => [...F.CARGOS],
  listCentrosAdmin: async () => clone(F.CENTROS),
  solicitudPorId: async (id) => clone(F.SOLICITUDES.find(s => s.id === id)),
  aprobacionesDe: async (ids) => clone(F.APROBACIONES.filter(a => ids.includes(a.solicitud_id))),
  trabajadoresPorId: async (ids) => new Map(ids.filter(Boolean).map(id => [id, clone(F.TMAP.get(id))]).filter(([, t]) => t)),
  perfilesPorId: async (ids) => new Map(ids.filter(Boolean).map(id => [id, clone(F.PMAP.get(id))]).filter(([, p]) => p)),
  misSolicitudes: async (uid) => solsCon(s => s.solicitante_id === uid),
  misReclutamientosPendientes: async () => state.user?.id !== 'u-sol' ? [] :
    F.RECLUTAMIENTOS.filter(r => r.estado === 'esperando_seleccion').map(r => ({ ...clone(r), candidatos: clone(F.CANDIDATOS.filter(c => c.reclutamiento_id === r.id && c.decision === 'pendiente')) })),
  bandejaPendientes: async (uid) => {
    const out = [];
    F.SOLICITUDES.filter(s => s.estado === 'pendiente').forEach(s => {
      const pend = s.aprobaciones.filter(a => a.decision === 'pendiente');
      if (!pend.length) return;
      const min = Math.min(...pend.map(a => a.orden));
      pend.filter(a => a.orden === min && a.aprobador_id === uid).forEach(a => out.push({ aprobacionId: a.id, orden: a.orden, sol: clone(s) }));
    });
    return out.sort((x, y) => new Date(x.sol.created_at) - new Date(y.sol.created_at));
  },
  listTodasSolicitudes: async () => solsCon(() => true),
  checklistDocumentos: async () => clone(F.CHECKLIST),
  documentosTrasladoPorSolicitud: async (ids) => mapBy(F.DOCS_TRASLADO.filter(d => ids.includes(d.solicitud_id)), 'solicitud_id'),
  rechazosPorSolicitudTraslado: async () => new Map(),
  rechazosPorContratacion: async () => new Map(),
  solicitudesIngresoAprobadas: async () => solsCon(s => s.tipo === 'ingreso' && s.estado === 'aprobada'),
  solicitudesAprobadasPorTipo: async (tipos) => solsCon(s => tipos.includes(s.tipo) && s.estado === 'aprobada'),
  contratacionesPorSolicitud: async (ids) => mapBy(F.CONTRATACIONES.filter(c => ids.includes(c.solicitud_id)), 'solicitud_id'),
  reclutamientosPorSolicitud: async (ids) => mapBy(F.RECLUTAMIENTOS.filter(r => ids.includes(r.solicitud_id)), 'solicitud_id'),
  candidatosDeReclutamiento: async (ids) => mapBy(F.CANDIDATOS.filter(c => ids.includes(c.reclutamiento_id)), 'reclutamiento_id'),
  contratacionPorId: async (id) => clone(F.CONTRATACIONES.find(c => c.id === id)),
  documentosDeContratacion: async (id) => clone(F.DOCS_CONTRATACION.filter(d => d.contratacion_id === id)),
  listContrataciones: async () => clone(F.CONTRATACIONES),
  fechasContratoSubido: async (ids) => new Map(F.DOCS_CONTRATACION.filter(d => ids.includes(d.contratacion_id) && d.checklist_item_id === 'k-contrato_trabajo').map(d => [d.contratacion_id, d.created_at])),
  decidir: noop, notificar: noop, notificarEvento: noop, notificarContratacion: noop,
  crearSolicitud: async () => ({ id: 'nuevo', codigo: 'SOL-2026-0425' }), crearSolicitudCambio: async () => ({ id: 'nuevo', codigo: 'SOL-2026-0425' }),
  editarSolicitud: noop, reclutamientoDecidir: noop, marcarProcesadoRRHH: noop, subirDocumentoTraslado: noop,
  iniciarContratacion: async () => ({ id: 'kx' }), iniciarReclutamiento: async () => ({ id: 'rx' }), agregarCandidatosReclutamiento: noop, subirCvCandidato: async () => 'x',
  actualizarContratacion: noop, anularContratacion: noop, marcarContratado: noop, subirDocumentoContratacion: noop,
  autorizarIngresoObra: noop, autorizarIngresoObraTraslado: noop, rechazarHomologacionIngreso: async () => 'r', rechazarHomologacionTraslado: async () => 'r',
  urlCvCandidato: async () => '#', urlDocumentoTraslado: async () => '#', urlDocumentoContratacion: async () => '#',
  descargarComprobantePdf: noop, descargarMaestroPdf: noop,
  // administración
  listUsuarios: async () => clone(F.PERFILES).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  actualizarUsuario: noop, invitarUsuario: noop,
  crearCentro: noop, actualizarCentro: noop,
  listCargosAdmin: async () => clone(F.CARGOS_ADMIN), crearCargo: noop, actualizarCargo: noop,
  listChecklistAdmin: async () => clone(F.CHECKLIST), crearChecklistItem: noop, actualizarChecklistItem: noop,
  trabajadorPorId: async (id) => clone(F.TMAP.get(id)), actualizarTrabajador: noop, upsertTrabajadores: noop,
  solicitudesDeTrabajador: async (tid) => solsCon(s => s.trabajador_id === tid),
});

window.Auth = {
  login: (e) => e.preventDefault(), logout: noop, showLogin: renderLogin, showForgotPassword: renderForgotPassword,
  requestPasswordReset: (e) => e.preventDefault(),
};
window.Shell = Shell; window.Router = Router; window.Toast = Toast; window.Confirm = Confirm;

window.__login = () => renderLogin();
window.__forgot = () => renderForgotPassword();
window.__as = (userId, role) => {
  const p = F.PMAP.get(userId);
  state.user = { id: p.id, name: p.nombre, role: role || p.rol, email: p.email, centroCostoId: p.centro_costo_id || null, esGerente: !!p.es_gerente_operaciones };
  state.currentView = 'inicio';
  Shell.render();
  Router.go('inicio');
};
window.__go = (view, params) => Router.go(view, params);
window.__ready = true;
