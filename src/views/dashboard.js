/**
 * Vista "Dashboard" (admin) · métricas del sistema:
 * volumen por estado/tipo, tasa de aprobación, tiempos de respuesta por
 * aprobador y volumen por centro de costo. Calcula sobre las solicitudes.
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

function dur(ms) {
  if (ms == null || isNaN(ms)) return '—';
  const h = ms / 3600000;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
  if (h < 48) return (Math.round(h * 10) / 10).toString().replace('.0', '') + ' h';
  return (Math.round((h / 24) * 10) / 10).toString().replace('.0', '') + ' d';
}

function barras(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return `<div class="bars">${items.map(i => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(i.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct(i.value, max)}%"></div></div>
      <div class="bar-val">${i.value}</div>
    </div>`).join('')}</div>`;
}

export async function renderDashboard(container) {
  container.innerHTML = '<div class="view-loading">Calculando métricas...</div>';

  let sols, centros, perfiles;
  try {
    const [s, c] = await Promise.all([Data.listTodasSolicitudes(), Data.listCentrosAdmin()]);
    sols = s;
    centros = new Map(c.map(x => [x.id, x]));
    const aprobadorIds = sols.flatMap(x => (x.aprobaciones || []).map(a => a.aprobador_id));
    perfiles = await Data.perfilesPorId(aprobadorIds);
  } catch (e) {
    console.error('[dashboard]', e);
    Toast.error('Error', 'No se pudieron calcular las métricas.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar las métricas.</div>';
    return;
  }

  if (!sols.length) {
    container.innerHTML = '<div class="empty-state"><div class="placeholder-icon">📊</div><p>Todavía no hay solicitudes para analizar.</p></div>';
    return;
  }

  // --- agregados ---
  const total = sols.length;
  const porEstado = { pendiente: 0, aprobada: 0, rechazada: 0 };
  const porTipo = { ingreso: 0, traslado: 0 };
  const porCentro = new Map();
  sols.forEach(s => {
    porEstado[s.estado] = (porEstado[s.estado] || 0) + 1;
    porTipo[s.tipo] = (porTipo[s.tipo] || 0) + 1;
    const cn = centros.get(s.centro_origen_id)?.nombre || '—';
    porCentro.set(cn, (porCentro.get(cn) || 0) + 1);
  });
  const finalizadas = porEstado.aprobada + porEstado.rechazada;
  const tasaAprob = pct(porEstado.aprobada, finalizadas);

  // tiempos de respuesta por aprobador (aprobaciones ya decididas)
  const porAprob = new Map();
  sols.forEach(s => (s.aprobaciones || []).forEach(a => {
    if (!a.decidido_at || !a.asignado_at) return;
    const ms = new Date(a.decidido_at) - new Date(a.asignado_at);
    if (isNaN(ms) || ms < 0) return;
    const cur = porAprob.get(a.aprobador_id) || { sum: 0, n: 0 };
    cur.sum += ms; cur.n += 1;
    porAprob.set(a.aprobador_id, cur);
  }));
  const filasAprob = [...porAprob.entries()]
    .map(([id, v]) => ({ nombre: perfiles.get(id)?.nombre || '—', n: v.n, avg: v.sum / v.n }))
    .sort((a, b) => a.avg - b.avg);
  const avgGlobal = filasAprob.length
    ? filasAprob.reduce((acc, f) => acc + f.avg * f.n, 0) / filasAprob.reduce((acc, f) => acc + f.n, 0)
    : null;

  const topCentros = [...porCentro.entries()]
    .map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Total solicitudes</div><div class="kpi-value">${total}</div></div>
      <div class="kpi-card"><div class="kpi-label">Pendientes</div><div class="kpi-value">${porEstado.pendiente || 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Aprobadas</div><div class="kpi-value">${porEstado.aprobada || 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Rechazadas</div><div class="kpi-value">${porEstado.rechazada || 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Tasa de aprobación</div><div class="kpi-value">${tasaAprob}%</div><div class="kpi-meta">sobre ${finalizadas} finalizadas</div></div>
      <div class="kpi-card"><div class="kpi-label">Tiempo prom. de respuesta</div><div class="kpi-value">${dur(avgGlobal)}</div><div class="kpi-meta">por aprobación</div></div>
    </div>

    <div class="dash-cols">
      <div class="card">
        <h3>Por tipo</h3>
        ${barras([{ label: 'Ingreso', value: porTipo.ingreso || 0 }, { label: 'Traslado', value: porTipo.traslado || 0 }])}
      </div>
      <div class="card">
        <h3>Volumen por centro (top)</h3>
        ${topCentros.length ? barras(topCentros) : '<span class="muted">Sin datos.</span>'}
      </div>
    </div>

    <div class="card">
      <h3>Tiempo de respuesta por aprobador</h3>
      ${filasAprob.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Aprobador</th><th>Decisiones</th><th>Tiempo promedio</th></tr></thead>
          <tbody>${filasAprob.map(f => `<tr><td>${escapeHtml(f.nombre)}</td><td>${f.n}</td><td>${dur(f.avg)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : '<span class="muted">Todavía no hay aprobaciones resueltas.</span>'}
    </div>`;
}
