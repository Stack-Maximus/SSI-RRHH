/**
 * Vista "SLA Homologación" (prevencionista / admin) · mide cuánto se
 * demora la homologación SST de cada contratación, desde que RRHH sube el
 * Contrato de Trabajo hasta que el prevencionista autoriza el ingreso del
 * trabajador a la obra designada. Meta: 8 días hábiles por proceso (ver
 * src/utils/dias-habiles.js).
 *
 * RLS ya limita qué contrataciones ve cada prevencionista (solo las de
 * su(s) centro(s) de costo asignados, migración 0009); admin ve todas.
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { fechaCorta } from '../ui/solicitud-format.js';
import { diasHabilesEntre } from '../utils/dias-habiles.js';
import { pct, barras, slaBadge, prioridadFila } from '../ui/sla-format.js';

const SLA_DIAS = 8;

export async function renderDashboardPrevencion(container) {
  container.innerHTML = '<div class="view-loading">Calculando tiempos de homologación...</div>';

  let contrataciones, solicitudes, centros, fechasContrato, perfiles;
  try {
    [contrataciones, solicitudes, centros] = await Promise.all([
      Data.listContrataciones(),
      Data.solicitudesIngresoAprobadas(),
      Data.listCentrosAdmin()
    ]);
    fechasContrato = await Data.fechasContratoSubido(contrataciones.map(c => c.id));
    perfiles = await Data.perfilesPorId(contrataciones.map(c => c.homologacion_aprobada_por));
  } catch (e) {
    console.error('[dashboard-prevencion]', e);
    Toast.error('Error', 'No se pudieron calcular los tiempos de homologación.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar los tiempos de homologación.</div>';
    return;
  }

  // El plazo de homologación solo corre para contrataciones que ya tienen
  // el Contrato de Trabajo subido (es el disparador); antes de eso todavía
  // está en el tramo de RRHH (ver dashboard "SLA Contratación").
  const conContrato = contrataciones
    .filter(c => c.estado !== 'anulada' && fechasContrato.has(c.id))
    .map(c => ({ c, inicio: fechasContrato.get(c.id) }));

  if (!conContrato.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="placeholder-icon">🛡️</div>
      <p>Todavía no hay contrataciones con el Contrato de Trabajo subido para medir homologación.</p>
    </div>`;
    return;
  }

  const solMap = new Map(solicitudes.map(s => [s.id, s]));
  const centrosMap = new Map(centros.map(c => [c.id, c]));
  const ahora = new Date();

  const filas = conContrato.map(({ c, inicio }) => {
    const finalizado = !!c.homologacion_aprobada_at;
    const dias = diasHabilesEntre(inicio, finalizado ? c.homologacion_aprobada_at : ahora);
    const sol = solMap.get(c.solicitud_id);
    const centro = sol ? (centrosMap.get(sol.centro_origen_id)?.nombre || '—') : '—';
    return { c, finalizado, dias, centro, inicio };
  });

  const finalizadas = filas.filter(f => f.finalizado);
  const enCurso = filas.filter(f => !f.finalizado);
  const atrasadas = enCurso.filter(f => f.dias > SLA_DIAS);
  const cumplidas = finalizadas.filter(f => f.dias <= SLA_DIAS);
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
    const pa = prioridadFila(a, SLA_DIAS), pb = prioridadFila(b, SLA_DIAS);
    return pa !== pb ? pa - pb : b.dias - a.dias;
  });

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">En homologación</div><div class="kpi-value">${conContrato.length}</div><div class="kpi-meta">con contrato subido</div></div>
      <div class="kpi-card"><div class="kpi-label">En curso</div><div class="kpi-value">${enCurso.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Atrasadas</div><div class="kpi-value">${atrasadas.length}</div><div class="kpi-meta">más de ${SLA_DIAS} días hábiles</div></div>
      <div class="kpi-card"><div class="kpi-label">Cumplimiento SLA</div><div class="kpi-value">${finalizadas.length ? tasaCumplimiento + '%' : '—'}</div><div class="kpi-meta">sobre ${finalizadas.length} finalizada(s)</div></div>
      <div class="kpi-card"><div class="kpi-label">Promedio días hábiles</div><div class="kpi-value">${promedioDias != null ? promedioDias : '—'}</div><div class="kpi-meta">meta: ${SLA_DIAS} días hábiles</div></div>
    </div>

    <div class="dash-cols">
      <div class="card">
        <h3>Homologaciones por centro de costo</h3>
        ${topCentros.length ? barras(topCentros) : '<span class="muted">Sin datos.</span>'}
      </div>
      <div class="card">
        <h3>¿Qué se mide?</h3>
        <p class="hint">Desde que RRHH sube el Contrato de Trabajo hasta que el prevencionista autoriza el ingreso del trabajador a la obra designada. Meta: máximo ${SLA_DIAS} días hábiles (no cuenta fines de semana ni feriados de Chile).</p>
      </div>
    </div>

    <div class="card">
      <h3>Detalle por contratación</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Candidato</th><th>Centro de costo</th><th>Contrato subido</th><th>Estado</th><th>SLA</th></tr></thead>
          <tbody>${ordenadas.map(f => `
            <tr>
              <td>${escapeHtml(f.c.nombre_candidato)}</td>
              <td>${escapeHtml(f.centro)}</td>
              <td>${fechaCorta(f.inicio)}</td>
              <td>${f.finalizado ? `Autorizado (${escapeHtml(perfiles.get(f.c.homologacion_aprobada_por)?.nombre || '—')})` : 'En curso'}</td>
              <td>${slaBadge(f.dias, f.finalizado, SLA_DIAS)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}
