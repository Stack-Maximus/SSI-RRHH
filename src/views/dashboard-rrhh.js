/**
 * Vista "SLA Contratación" (RRHH / admin) · mide cuánto se demora RRHH en
 * armar y subir el Contrato de Trabajo de cada contratación, desde que se
 * crea la contratación hasta que se sube ese documento. Meta: 3 días
 * hábiles por proceso (ver src/utils/dias-habiles.js).
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { fechaCorta } from '../ui/solicitud-format.js';
import { diasHabilesEntre } from '../utils/dias-habiles.js';
import { pct, barras, slaBadge, prioridadFila } from '../ui/sla-format.js';

const SLA_DIAS = 3;

export async function renderDashboardRRHH(container) {
  container.innerHTML = '<div class="view-loading">Calculando tiempos de contratación...</div>';

  let contrataciones, solicitudes, centros, fechasContrato, perfiles;
  try {
    [contrataciones, solicitudes, centros] = await Promise.all([
      Data.listContrataciones(),
      Data.solicitudesIngresoAprobadas(),
      Data.listCentrosAdmin()
    ]);
    [fechasContrato, perfiles] = await Promise.all([
      Data.fechasContratoSubido(contrataciones.map(c => c.id)),
      Data.perfilesPorId(contrataciones.map(c => c.creada_por))
    ]);
  } catch (e) {
    console.error('[dashboard-rrhh]', e);
    Toast.error('Error', 'No se pudieron calcular los tiempos de contratación.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar los tiempos de contratación.</div>';
    return;
  }

  const vigentes = contrataciones.filter(c => c.estado !== 'anulada');

  if (!vigentes.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="placeholder-icon">⏱️</div>
      <p>Todavía no hay contrataciones para medir.</p>
    </div>`;
    return;
  }

  const solMap = new Map(solicitudes.map(s => [s.id, s]));
  const centrosMap = new Map(centros.map(c => [c.id, c]));
  const ahora = new Date();

  const filas = vigentes.map(c => {
    const fechaFin = fechasContrato.get(c.id) || null;
    const finalizado = !!fechaFin;
    const dias = diasHabilesEntre(c.created_at, fechaFin || ahora);
    const sol = solMap.get(c.solicitud_id);
    const centro = sol ? (centrosMap.get(sol.centro_origen_id)?.nombre || '—') : '—';
    const responsable = perfiles.get(c.creada_por)?.nombre || '—';
    return { c, finalizado, dias, centro, responsable };
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

  // Tiempos por integrante de RRHH: "responsable" = quien creó la contratación
  // (el dueño del caso de principio a fin en el flujo de RRHH).
  const porResponsable = new Map();
  filas.forEach(f => {
    if (!porResponsable.has(f.responsable)) porResponsable.set(f.responsable, []);
    porResponsable.get(f.responsable).push(f);
  });
  const tablaResponsables = [...porResponsable.entries()].map(([nombre, items]) => {
    const finalizadasP = items.filter(f => f.finalizado);
    const enCursoP = items.filter(f => !f.finalizado);
    const atrasadasP = enCursoP.filter(f => f.dias > SLA_DIAS);
    const cumplidasP = finalizadasP.filter(f => f.dias <= SLA_DIAS);
    const promedioP = finalizadasP.length
      ? Math.round((finalizadasP.reduce((acc, f) => acc + f.dias, 0) / finalizadasP.length) * 10) / 10
      : null;
    const cumplimientoP = finalizadasP.length ? pct(cumplidasP.length, finalizadasP.length) : null;
    return { nombre, total: items.length, enCurso: enCursoP.length, atrasadas: atrasadasP.length, promedio: promedioP, cumplimiento: cumplimientoP };
  }).sort((a, b) => {
    if (b.atrasadas !== a.atrasadas) return b.atrasadas - a.atrasadas;
    const pa = a.promedio == null ? -1 : a.promedio, pb = b.promedio == null ? -1 : b.promedio;
    return pb !== pa ? pb - pa : b.total - a.total;
  });

  const ordenadas = [...filas].sort((a, b) => {
    const pa = prioridadFila(a, SLA_DIAS), pb = prioridadFila(b, SLA_DIAS);
    return pa !== pb ? pa - pb : b.dias - a.dias;
  });

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Contrataciones</div><div class="kpi-value">${vigentes.length}</div><div class="kpi-meta">no anuladas</div></div>
      <div class="kpi-card"><div class="kpi-label">En curso</div><div class="kpi-value">${enCurso.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Atrasadas</div><div class="kpi-value">${atrasadas.length}</div><div class="kpi-meta">más de ${SLA_DIAS} días hábiles</div></div>
      <div class="kpi-card"><div class="kpi-label">Cumplimiento SLA</div><div class="kpi-value">${finalizadas.length ? tasaCumplimiento + '%' : '—'}</div><div class="kpi-meta">sobre ${finalizadas.length} finalizada(s)</div></div>
      <div class="kpi-card"><div class="kpi-label">Promedio días hábiles</div><div class="kpi-value">${promedioDias != null ? promedioDias : '—'}</div><div class="kpi-meta">meta: ${SLA_DIAS} días hábiles</div></div>
    </div>

    <div class="dash-cols">
      <div class="card">
        <h3>Contrataciones por centro de costo</h3>
        ${topCentros.length ? barras(topCentros) : '<span class="muted">Sin datos.</span>'}
      </div>
      <div class="card">
        <h3>¿Qué se mide?</h3>
        <p class="hint">Desde que RRHH crea la contratación hasta que sube el Contrato de Trabajo firmado. Meta: máximo ${SLA_DIAS} días hábiles (no cuenta fines de semana ni feriados de Chile).</p>
      </div>
    </div>

    <div class="card">
      <h3>Tiempos por integrante de RRHH</h3>
      <p class="hint">Responsable = quien creó la contratación en el sistema. Promedio y cumplimiento se calculan sobre sus casos ya finalizados (contrato subido); "Atrasadas" son casos suyos todavía en curso que ya pasaron los ${SLA_DIAS} días hábiles.</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>RRHH</th><th>Contrataciones</th><th>En curso</th><th>Atrasadas</th><th>Promedio días hábiles</th><th>Cumplimiento SLA</th></tr></thead>
          <tbody>${tablaResponsables.map(r => `
            <tr>
              <td>${escapeHtml(r.nombre)}</td>
              <td>${r.total}</td>
              <td>${r.enCurso}</td>
              <td>${r.atrasadas > 0 ? `<span class="badge badge-danger">${r.atrasadas}</span>` : '0'}</td>
              <td>${r.promedio != null ? r.promedio : '—'}</td>
              <td>${r.cumplimiento != null ? r.cumplimiento + '%' : '—'}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>Detalle por contratación</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Candidato</th><th>Centro de costo</th><th>Responsable</th><th>Inicio</th><th>Estado</th><th>SLA</th></tr></thead>
          <tbody>${ordenadas.map(f => `
            <tr>
              <td>${escapeHtml(f.c.nombre_candidato)}</td>
              <td>${escapeHtml(f.centro)}</td>
              <td>${escapeHtml(f.responsable)}</td>
              <td>${fechaCorta(f.c.created_at)}</td>
              <td>${f.finalizado ? 'Contrato subido' : 'En curso'}</td>
              <td>${slaBadge(f.dias, f.finalizado, SLA_DIAS)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}
