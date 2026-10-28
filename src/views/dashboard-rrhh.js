/**
 * Vista "SLA Contratación" (RRHH / admin) · mide cuánto se demora RRHH en
 * cerrar su parte de CUALQUIER solicitud (todos los tipos), desde que la
 * solicitud queda totalmente aprobada hasta que RRHH cierra su trámite:
 *
 *   - ingreso: se sube el Contrato de Trabajo de cada contratación (puede
 *     haber varias por solicitud si pide más de una vacante; las vacantes
 *     sin iniciar todavía cuentan como "en curso" desde el día de la
 *     aprobación, para no perder de vista contrataciones que ni siquiera
 *     han arrancado).
 *   - traslado: se completan los 3 documentos requeridos (Contrato de
 *     Trabajo, Anexo de Contrato, Cédula) para que Prevención homologue.
 *   - aumento de sueldo / bono / cambio de cargo / cambio de turno /
 *     renovación / desvinculación: RRHH marca la solicitud como procesada
 *     (no tienen documento propio).
 *
 * Meta: 3 días hábiles por proceso (ver src/utils/dias-habiles.js).
 *
 * Reclutamiento y selección (oct. 2026): tiene su propia meta, 5 días
 * hábiles por tanda para enviar candidatos, que se reinicia con cada
 * rechazo total (ver ui/reclutamiento-sla.js) -- va en una tabla aparte.
 * Por eso, en ingreso, una contratación que salió de un reclutamiento mide
 * los 3 días del contrato desde que el solicitante ELIGIÓ al candidato (no
 * desde la aprobación), y las vacantes con un reclutamiento en curso no
 * cuentan como "sin iniciar".
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { fechaCorta, tipoLabel } from '../ui/solicitud-format.js';
import { diasHabilesEntre } from '../utils/dias-habiles.js';
import { pct, barras, slaBadge, prioridadFila, fechaAprobacionCompleta, agregarPorClave } from '../ui/sla-format.js';
import { progresoDocumentosTraslado } from '../ui/traslado-format.js';
import { TIPOS_SOLICITUD_SIN_DOCUMENTO, DIAS_HABILES_PROCESO_RRHH } from '../config.js';
import { ciclosReclutamiento, resumenReclutamiento, SLA_RECLUTAMIENTO } from '../ui/reclutamiento-sla.js';

// Mismo valor que el aviso "hasta 3 días hábiles" de Traslado / Cambio de cargo.
const SLA_DIAS = DIAS_HABILES_PROCESO_RRHH;
const TIPOS_GENERICOS = TIPOS_SOLICITUD_SIN_DOCUMENTO;
const TODOS_LOS_TIPOS = ['ingreso', 'traslado', ...TIPOS_GENERICOS];
const SIN_INICIAR = '— (sin iniciar)';

export async function renderDashboardRRHH(container) {
  container.innerHTML = '<div class="view-loading">Calculando tiempos de RRHH...</div>';

  let sols, contrataciones, centros, checklist, fechasContrato, docsTraslado, reclutMap, candMap;
  try {
    [sols, contrataciones, centros, checklist] = await Promise.all([
      Data.solicitudesAprobadasPorTipo(TODOS_LOS_TIPOS),
      Data.listContrataciones(),
      Data.listCentrosAdmin(),
      Data.checklistDocumentos()
    ]);
    const trasladoIds = sols.filter(s => s.tipo === 'traslado').map(s => s.id);
    const ingresoIds = sols.filter(s => s.tipo === 'ingreso').map(s => s.id);
    [fechasContrato, docsTraslado, reclutMap] = await Promise.all([
      Data.fechasContratoSubido(contrataciones.map(c => c.id)),
      Data.documentosTrasladoPorSolicitud(trasladoIds),
      Data.reclutamientosPorSolicitud(ingresoIds)
    ]);
    candMap = await Data.candidatosDeReclutamiento([...reclutMap.values()].flat().map(r => r.id));
  } catch (e) {
    console.error('[dashboard-rrhh]', e);
    Toast.error('Error', 'No se pudieron calcular los tiempos de RRHH.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar los tiempos de RRHH.</div>';
    return;
  }

  const centrosMap = new Map(centros.map(c => [c.id, c]));
  const solPorTipo = new Map(TODOS_LOS_TIPOS.map(t => [t, []]));
  sols.forEach(s => solPorTipo.get(s.tipo)?.push(s));

  const contratMap = new Map();
  contrataciones.filter(c => c.estado !== 'anulada').forEach(c => {
    if (!contratMap.has(c.solicitud_id)) contratMap.set(c.solicitud_id, []);
    contratMap.get(c.solicitud_id).push(c);
  });

  const ahora = new Date();
  const filas = [];
  const responsableIds = new Set();

  // ---- ingreso: 1 fila por contratación real + placeholders "sin iniciar"
  //      por cada vacante de la solicitud que todavía no tiene contratación ----
  solPorTipo.get('ingreso').forEach(s => {
    const inicio = fechaAprobacionCompleta(s);
    if (!inicio) return; // dato inconsistente -- no debería pasar con estado='aprobada'
    const centro = centrosMap.get(s.centro_origen_id)?.nombre || '—';
    const cantidad = s.detalle?.cantidad || 1;
    const propias = contratMap.get(s.id) || [];

    const reclutamientos = reclutMap.get(s.id) || [];
    propias.forEach(c => {
      const fin = fechasContrato.get(c.id) || null;
      if (c.creada_por) responsableIds.add(c.creada_por);
      // Salió de un reclutamiento: el plazo del contrato corre desde que el
      // solicitante eligió al candidato (antes corría el de reclutamiento).
      const desdeEleccion = reclutamientos.some(r => r.contratacion_id === c.id) && c.created_at;
      filas.push({
        tipo: 'ingreso', titulo: c.nombre_candidato, centro, inicio: desdeEleccion || inicio,
        fin, finalizado: !!fin, iniciado: true, responsableId: c.creada_por || null
      });
    });

    // Vacantes con un reclutamiento todavía sin candidato elegido: se miden
    // en la tabla de reclutamiento, no como "sin iniciar".
    const reclAbiertos = reclutamientos.filter(r => r.estado !== 'candidato_elegido').length;
    const faltan = Math.max(0, cantidad - propias.length - reclAbiertos);
    for (let i = 0; i < faltan; i++) {
      filas.push({
        tipo: 'ingreso', titulo: `${s.detalle?.cargo || 'Cargo'} (vacante sin iniciar)`, centro, inicio,
        fin: null, finalizado: false, iniciado: false, responsableId: null
      });
    }
  });

  // ---- traslado: 1 fila por solicitud, cierre = 3 documentos completos ----
  solPorTipo.get('traslado').forEach(s => {
    const inicio = fechaAprobacionCompleta(s);
    if (!inicio) return;
    const centro = centrosMap.get(s.centro_origen_id)?.nombre || '—';
    const docs = docsTraslado.get(s.id) || [];
    const prog = progresoDocumentosTraslado(checklist, docs);
    if (prog.ultimoResponsable) responsableIds.add(prog.ultimoResponsable);
    filas.push({
      tipo: 'traslado', titulo: s.detalle?.cargo ? `Traslado · ${s.detalle.cargo}` : 'Traslado', centro, inicio,
      fin: prog.fechaCompleto, finalizado: prog.completo, iniciado: docs.length > 0,
      responsableId: prog.ultimoResponsable
    });
  });

  // ---- 4 tipos genéricos: 1 fila por solicitud, cierre = botón "Marcar como procesado" ----
  TIPOS_GENERICOS.forEach(tipo => {
    solPorTipo.get(tipo).forEach(s => {
      const inicio = fechaAprobacionCompleta(s);
      if (!inicio) return;
      const centro = centrosMap.get(s.centro_origen_id)?.nombre || '—';
      if (s.procesado_rrhh_por) responsableIds.add(s.procesado_rrhh_por);
      filas.push({
        tipo, titulo: tipoLabel(tipo), centro, inicio,
        fin: s.procesado_rrhh_at || null, finalizado: !!s.procesado_rrhh_at,
        iniciado: !!s.procesado_rrhh_at, responsableId: s.procesado_rrhh_por || null
      });
    });
  });

  if (!filas.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="placeholder-icon">⏱️</div>
      <p>Todavía no hay solicitudes aprobadas para medir.</p>
    </div>`;
    return;
  }

  // ---- Reclutamiento y selección: 1 fila por ciclo (tanda) de búsqueda ----
  const solIngresoMap = new Map(solPorTipo.get('ingreso').map(s => [s.id, s]));
  const filasRecl = [];
  [...reclutMap.values()].flat().forEach(r => {
    const s = solIngresoMap.get(r.solicitud_id);
    const cands = candMap.get(r.id) || [];
    const res = resumenReclutamiento(r, cands, ahora);
    ciclosReclutamiento(r, cands, ahora).forEach(c => {
      if (r.creado_por) responsableIds.add(r.creado_por);
      filasRecl.push({
        ...c,
        folio: s?.folio || s?.codigo || '—',
        cargo: s?.detalle?.cargo || '—',
        centro: centrosMap.get(s?.centro_origen_id)?.nombre || '—',
        etapa: c.finalizado ? `Tanda ${c.tanda} enviada` : res.etapa,
        responsableId: r.creado_por || null
      });
    });
  });

  const perfiles = await Data.perfilesPorId([...responsableIds]).catch(() => new Map());
  filas.forEach(f => {
    f.dias = diasHabilesEntre(f.inicio, f.fin || ahora);
    f.responsable = f.responsableId ? (perfiles.get(f.responsableId)?.nombre || '—') : SIN_INICIAR;
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

  const tablaTipos = agregarPorClave(filas, SLA_DIAS, f => f.tipo, tipoLabel);
  const tablaResponsables = agregarPorClave(filas.filter(f => f.iniciado), SLA_DIAS, f => f.responsable, k => k);

  const ordenadas = [...filas].sort((a, b) => {
    const pa = prioridadFila(a, SLA_DIAS), pb = prioridadFila(b, SLA_DIAS);
    return pa !== pb ? pa - pb : b.dias - a.dias;
  });

  const filaAgregada = (r) => `
    <tr>
      <td>${escapeHtml(r.label)}</td>
      <td>${r.total}</td>
      <td>${r.enCurso}</td>
      <td>${r.atrasadas > 0 ? `<span class="badge badge-danger">${r.atrasadas}</span>` : '0'}</td>
      <td>${r.promedio != null ? r.promedio : '—'}</td>
      <td>${r.cumplimiento != null ? r.cumplimiento + '%' : '—'}</td>
    </tr>`;

  const estadoTexto = (f) => {
    if (f.finalizado) return f.tipo === 'ingreso' ? 'Contrato subido' : f.tipo === 'traslado' ? 'Documentos completos' : 'Procesado';
    return f.iniciado ? 'En curso' : 'Sin iniciar';
  };

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Solicitudes</div><div class="kpi-value">${filas.length}</div><div class="kpi-meta">todos los tipos, ya aprobadas</div></div>
      <div class="kpi-card"><div class="kpi-label">En curso</div><div class="kpi-value">${enCurso.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Atrasadas</div><div class="kpi-value">${atrasadas.length}</div><div class="kpi-meta">más de ${SLA_DIAS} días hábiles</div></div>
      <div class="kpi-card"><div class="kpi-label">Cumplimiento SLA</div><div class="kpi-value">${finalizadas.length ? tasaCumplimiento + '%' : '—'}</div><div class="kpi-meta">sobre ${finalizadas.length} finalizada(s)</div></div>
      <div class="kpi-card"><div class="kpi-label">Promedio días hábiles</div><div class="kpi-value">${promedioDias != null ? promedioDias : '—'}</div><div class="kpi-meta">meta: ${SLA_DIAS} días hábiles</div></div>
    </div>

    <div class="dash-cols">
      <div class="card">
        <h3>Solicitudes por centro de costo</h3>
        ${topCentros.length ? barras(topCentros) : '<span class="muted">Sin datos.</span>'}
      </div>
      <div class="card">
        <h3>¿Qué se mide?</h3>
        <p class="hint">Desde que la solicitud queda totalmente aprobada hasta que RRHH cierra su parte: en <b>ingreso</b> al subir el Contrato de Trabajo (si el candidato salió de un reclutamiento, desde que el solicitante lo eligió), en <b>traslado</b> al completar Contrato + Anexo de Contrato + Cédula, y en el resto de los tipos al marcarla como procesada. Meta: máximo ${SLA_DIAS} días hábiles (no cuenta fines de semana ni feriados de Chile).</p>
      </div>
    </div>

    <div class="card">
      <h3>Tiempos por tipo de solicitud</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tipo</th><th>Solicitudes</th><th>En curso</th><th>Atrasadas</th><th>Promedio días hábiles</th><th>Cumplimiento SLA</th></tr></thead>
          <tbody>${tablaTipos.map(filaAgregada).join('')}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>Tiempos por integrante de RRHH</h3>
      <p class="hint">Responsable = quien creó la contratación (ingreso), quien subió el último documento (traslado) o quien marcó la solicitud como procesada (el resto). Los casos aún sin iniciar no se atribuyen a nadie todavía y no entran en esta tabla, pero sí cuentan en los KPIs y en el detalle de abajo.</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>RRHH</th><th>Solicitudes</th><th>En curso</th><th>Atrasadas</th><th>Promedio días hábiles</th><th>Cumplimiento SLA</th></tr></thead>
          <tbody>${tablaResponsables.map(filaAgregada).join('')}</tbody>
        </table>
      </div>
    </div>

    ${tablaReclutamiento(filasRecl, perfiles)}

    <div class="card">
      <h3>Detalle por solicitud</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tipo</th><th>Persona / cargo</th><th>Centro de costo</th><th>Responsable</th><th>Inicio</th><th>Estado</th><th>SLA</th></tr></thead>
          <tbody>${ordenadas.map(f => `
            <tr>
              <td>${tipoLabel(f.tipo)}</td>
              <td>${escapeHtml(f.titulo)}</td>
              <td>${escapeHtml(f.centro)}</td>
              <td>${escapeHtml(f.responsable)}</td>
              <td>${fechaCorta(f.inicio)}</td>
              <td>${estadoTexto(f)}</td>
              <td>${slaBadge(f.dias, f.finalizado, SLA_DIAS)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

/** Tabla de ciclos de Reclutamiento y selección (meta: SLA_RECLUTAMIENTO días hábiles por tanda). */
function tablaReclutamiento(filas, perfiles) {
  if (!filas.length) return '';
  const enCurso = filas.filter(f => !f.finalizado);
  const atrasados = enCurso.filter(f => f.dias > SLA_RECLUTAMIENTO);
  const cerrados = filas.filter(f => f.finalizado);
  const cumplidos = cerrados.filter(f => f.dias <= SLA_RECLUTAMIENTO);
  const promedio = cerrados.length
    ? Math.round((cerrados.reduce((a, f) => a + f.dias, 0) / cerrados.length) * 10) / 10
    : null;
  const ordenadas = [...filas].sort((a, b) => {
    const pa = prioridadFila(a, SLA_RECLUTAMIENTO), pb = prioridadFila(b, SLA_RECLUTAMIENTO);
    return pa !== pb ? pa - pb : b.dias - a.dias;
  });
  return `
    <div class="card">
      <h3>Reclutamiento y selección <span class="muted">· ${filas.length} tanda(s)</span></h3>
      <p class="hint">Desde que RRHH crea el proceso (o desde que el solicitante rechaza a todos los candidatos de una tanda) hasta que RRHH envía la tanda siguiente. Meta: máximo ${SLA_RECLUTAMIENTO} días hábiles por tanda; el plazo se reinicia con cada rechazo total. Mientras el solicitante revisa candidatos, el reloj de RRHH no corre.</p>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Buscando ahora</div><div class="kpi-value">${enCurso.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">Atrasadas</div><div class="kpi-value">${atrasados.length}</div><div class="kpi-meta">más de ${SLA_RECLUTAMIENTO} días hábiles</div></div>
        <div class="kpi-card"><div class="kpi-label">Cumplimiento</div><div class="kpi-value">${cerrados.length ? pct(cumplidos.length, cerrados.length) + '%' : '—'}</div><div class="kpi-meta">sobre ${cerrados.length} tanda(s) enviada(s)</div></div>
        <div class="kpi-card"><div class="kpi-label">Promedio días hábiles</div><div class="kpi-value">${promedio != null ? promedio : '—'}</div><div class="kpi-meta">meta: ${SLA_RECLUTAMIENTO} días hábiles</div></div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Solicitud</th><th>Cargo</th><th>Centro de costo</th><th>Tanda</th><th>Responsable</th><th>Inicio</th><th>Estado</th><th>SLA</th></tr></thead>
          <tbody>${ordenadas.map(f => `
            <tr>
              <td>${escapeHtml(f.folio)}</td>
              <td>${escapeHtml(f.cargo)}</td>
              <td>${escapeHtml(f.centro)}</td>
              <td>${f.tanda}${f.tanda > 1 ? ' <span class="muted">(reinicio)</span>' : ''}</td>
              <td>${escapeHtml(f.responsableId ? (perfiles.get(f.responsableId)?.nombre || '—') : '—')}</td>
              <td>${fechaCorta(f.inicio)}</td>
              <td>${escapeHtml(f.etapa)}</td>
              <td>${slaBadge(f.dias, f.finalizado, SLA_RECLUTAMIENTO)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}
