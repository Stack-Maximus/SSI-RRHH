/**
 * Vista "SLA Homologación" (prevencionista / admin) · mide cuánto se
 * demora la homologación SST de cada caso, desde que RRHH deja los
 * documentos listos hasta que el prevencionista autoriza el ingreso del
 * trabajador a la obra:
 *
 *   - ingreso: desde que se sube el Contrato de Trabajo hasta que se
 *     autoriza el ingreso a la obra de la solicitud (centro de origen,
 *     el único centro que tiene ingreso).
 *   - traslado: desde que se completan los 3 documentos (Contrato de
 *     Trabajo, Anexo de Contrato, Cédula) hasta que se autoriza el
 *     ingreso a la obra DESTINO (la obra nueva a la que llega).
 *
 * Meta: 9 días hábiles por proceso (ver src/utils/dias-habiles.js). Cada
 * vez que Prevención rechaza un caso (motivo obligatorio, ver
 * homologacion.js), su plazo se extiende 3 días hábiles más -- acumulable
 * si se rechaza más de una vez. Esa extensión NO se guarda en una columna:
 * se calcula acá mismo contando filas de `homologacion_rechazos` para
 * cada caso (migración 0016), así no hay un contador aparte que se pueda
 * desincronizar de la auditoría real.
 *
 * RLS ya limita qué casos ve cada prevencionista (solo los de su(s)
 * centro(s) de costo asignados -- origen para ingreso, destino para
 * traslado, migraciones 0009 y 0012); admin ve todos.
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { fechaCorta, tipoLabel } from '../ui/solicitud-format.js';
import { diasHabilesEntre } from '../utils/dias-habiles.js';
import { pct, barras, slaBadge, prioridadFila } from '../ui/sla-format.js';
import { progresoDocumentosTraslado } from '../ui/traslado-format.js';

const SLA_DIAS = 9;
const EXTENSION_DIAS_POR_RECHAZO = 3;

export async function renderDashboardPrevencion(container) {
  container.innerHTML = '<div class="view-loading">Calculando tiempos de homologación...</div>';

  let contrataciones, solIngreso, solTraslado, centros, checklist, fechasContrato, docsTraslado, rechazosIngreso, rechazosTraslado;
  try {
    [contrataciones, solIngreso, solTraslado, centros, checklist] = await Promise.all([
      Data.listContrataciones(),
      Data.solicitudesIngresoAprobadas(),
      Data.solicitudesAprobadasPorTipo(['traslado']),
      Data.listCentrosAdmin(),
      Data.checklistDocumentos()
    ]);
    [fechasContrato, docsTraslado, rechazosIngreso, rechazosTraslado] = await Promise.all([
      Data.fechasContratoSubido(contrataciones.map(c => c.id)),
      Data.documentosTrasladoPorSolicitud(solTraslado.map(s => s.id)),
      Data.rechazosPorContratacion(contrataciones.map(c => c.id)),
      Data.rechazosPorSolicitudTraslado(solTraslado.map(s => s.id))
    ]);
  } catch (e) {
    console.error('[dashboard-prevencion]', e);
    Toast.error('Error', 'No se pudieron calcular los tiempos de homologación.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar los tiempos de homologación.</div>';
    return;
  }

  const centrosMap = new Map(centros.map(c => [c.id, c]));
  const ahora = new Date();
  const filas = [];
  const autorizadoPorIds = new Set();

  // El plazo de homologación de ingreso solo corre para contrataciones que
  // ya tienen el Contrato de Trabajo subido (es el disparador); antes de
  // eso todavía está en el tramo de RRHH (ver dashboard "SLA Contratación").
  const solIngresoMap = new Map(solIngreso.map(s => [s.id, s]));
  contrataciones
    .filter(c => c.estado !== 'anulada' && fechasContrato.has(c.id))
    .forEach(c => {
      const sol = solIngresoMap.get(c.solicitud_id);
      const inicio = fechasContrato.get(c.id);
      const finalizado = !!c.homologacion_aprobada_at;
      if (c.homologacion_aprobada_por) autorizadoPorIds.add(c.homologacion_aprobada_por);
      filas.push({
        tipo: 'ingreso', titulo: c.nombre_candidato,
        centro: sol ? (centrosMap.get(sol.centro_origen_id)?.nombre || '—') : '—',
        inicio, finalizado, fin: c.homologacion_aprobada_at,
        dias: diasHabilesEntre(inicio, finalizado ? c.homologacion_aprobada_at : ahora),
        autorizadoPorId: c.homologacion_aprobada_por || null,
        rechazos: (rechazosIngreso.get(c.id) || []).length
      });
    });

  // El plazo de homologación de traslado solo corre para solicitudes que ya
  // tienen los 3 documentos completos.
  solTraslado.forEach(s => {
    const prog = progresoDocumentosTraslado(checklist, docsTraslado.get(s.id) || []);
    if (!prog.completo) return;
    const inicio = prog.fechaCompleto;
    const finalizado = !!s.homologacion_traslado_aprobada_at;
    if (s.homologacion_traslado_aprobada_por) autorizadoPorIds.add(s.homologacion_traslado_aprobada_por);
    filas.push({
      tipo: 'traslado', titulo: s.detalle?.cargo ? `Traslado · ${s.detalle.cargo}` : 'Traslado',
      centro: centrosMap.get(s.centro_destino_id)?.nombre || '—',
      inicio, finalizado, fin: s.homologacion_traslado_aprobada_at,
      dias: diasHabilesEntre(inicio, finalizado ? s.homologacion_traslado_aprobada_at : ahora),
      autorizadoPorId: s.homologacion_traslado_aprobada_por || null,
      rechazos: (rechazosTraslado.get(s.id) || []).length
    });
  });

  if (!filas.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="placeholder-icon">🛡️</div>
      <p>Todavía no hay casos con documentos listos para medir homologación.</p>
    </div>`;
    return;
  }

  const perfiles = await Data.perfilesPorId([...autorizadoPorIds]).catch(() => new Map());

  // Meta efectiva de cada caso: la base (SLA_DIAS) más 3 días hábiles por
  // cada vez que se rechazó (acumulable) -- así "Atrasadas" y "Cumplimiento
  // SLA" ya consideran la extensión, caso por caso.
  filas.forEach(f => { f.metaEfectiva = SLA_DIAS + EXTENSION_DIAS_POR_RECHAZO * f.rechazos; });
  const totalRechazos = filas.reduce((acc, f) => acc + f.rechazos, 0);
  const casosConRechazo = filas.filter(f => f.rechazos > 0).length;

  const finalizadas = filas.filter(f => f.finalizado);
  const enCurso = filas.filter(f => !f.finalizado);
  const atrasadas = enCurso.filter(f => f.dias > f.metaEfectiva);
  const cumplidas = finalizadas.filter(f => f.dias <= f.metaEfectiva);
  const tasaCumplimiento = pct(cumplidas.length, finalizadas.length);
  const promedioDias = finalizadas.length
    ? Math.round((finalizadas.reduce((acc, f) => acc + f.dias, 0) / finalizadas.length) * 10) / 10
    : null;

  const porCentro = new Map();
  filas.forEach(f => porCentro.set(f.centro, (porCentro.get(f.centro) || 0) + 1));
  const topCentros = [...porCentro.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  const ordenadas = [...filas].sort((a, b) => {
    const pa = prioridadFila(a, a.metaEfectiva), pb = prioridadFila(b, b.metaEfectiva);
    return pa !== pb ? pa - pb : b.dias - a.dias;
  });

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">En homologación</div><div class="kpi-value">${filas.length}</div><div class="kpi-meta">con documentos listos</div></div>
      <div class="kpi-card"><div class="kpi-label">En curso</div><div class="kpi-value">${enCurso.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Atrasadas</div><div class="kpi-value">${atrasadas.length}</div><div class="kpi-meta">sobre su meta (${SLA_DIAS} d.h. + ${EXTENSION_DIAS_POR_RECHAZO} por rechazo)</div></div>
      <div class="kpi-card"><div class="kpi-label">Rechazos</div><div class="kpi-value">${totalRechazos}</div><div class="kpi-meta">${casosConRechazo} caso(s) con al menos 1 rechazo</div></div>
      <div class="kpi-card"><div class="kpi-label">Cumplimiento SLA</div><div class="kpi-value">${finalizadas.length ? tasaCumplimiento + '%' : '—'}</div><div class="kpi-meta">sobre ${finalizadas.length} finalizada(s)</div></div>
      <div class="kpi-card"><div class="kpi-label">Promedio días hábiles</div><div class="kpi-value">${promedioDias != null ? promedioDias : '—'}</div><div class="kpi-meta">meta base: ${SLA_DIAS} días hábiles</div></div>
    </div>

    <div class="dash-cols">
      <div class="card">
        <h3>Homologaciones por centro de costo</h3>
        ${topCentros.length ? barras(topCentros) : '<span class="muted">Sin datos.</span>'}
      </div>
      <div class="card">
        <h3>¿Qué se mide?</h3>
        <p class="hint">En <b>ingreso</b>: desde que RRHH sube el Contrato de Trabajo hasta que se autoriza el ingreso a la obra. En <b>traslado</b>: desde que se completan los 3 documentos hasta que se autoriza el ingreso a la obra DESTINO (la obra nueva a la que llega el trabajador). Meta: ${SLA_DIAS} días hábiles (no cuenta fines de semana ni feriados de Chile). Si Prevención rechaza un caso (con motivo obligatorio), su plazo se extiende ${EXTENSION_DIAS_POR_RECHAZO} días hábiles más -- acumulable si se rechaza más de una vez.</p>
      </div>
    </div>

    <div class="card">
      <h3>Detalle por caso</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tipo</th><th>Persona / cargo</th><th>Centro de costo</th><th>Documentos listos</th><th>Rechazos</th><th>Estado</th><th>SLA</th></tr></thead>
          <tbody>${ordenadas.map(f => `
            <tr>
              <td>${tipoLabel(f.tipo)}</td>
              <td>${escapeHtml(f.titulo)}</td>
              <td>${escapeHtml(f.centro)}</td>
              <td>${fechaCorta(f.inicio)}</td>
              <td>${f.rechazos > 0 ? `<span class="badge badge-warning">${f.rechazos}</span>` : '0'}</td>
              <td>${f.finalizado ? `Autorizado (${escapeHtml(perfiles.get(f.autorizadoPorId)?.nombre || '—')})` : 'En curso'}</td>
              <td>${slaBadge(f.dias, f.finalizado, f.metaEfectiva)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}
