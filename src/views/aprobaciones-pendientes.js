/**
 * Vista "Aprobaciones pendientes" (RRHH / admin) · oct. 2026, a pedido.
 *
 * Una tarjeta por aprobador que tiene solicitudes esperando SU decisión (la
 * aprobación es secuencial: solo cuenta el turno vigente de cada solicitud),
 * con cuánto lleva esperando cada una. El botón "🔔 Enviar recordatorio"
 * le manda un correo personalizado (Edge Function notificar,
 * 'recordatorio_aprobador'): lo saluda por su nombre, lista SUS solicitudes
 * con el tiempo de cada una y ajusta el tono según la más antigua.
 *
 * Para no saturar a nadie, la función no deja repetir el recordatorio al
 * mismo aprobador antes de RECORDATORIO_ENFRIAMIENTO_HORAS (config.js);
 * acá solo se muestra (y se deshabilita el botón) con el registro de
 * recordatorios_aprobacion (migración 0022).
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { tipoLabel, resumen } from '../ui/solicitud-format.js';
import { aprobacionesEnTurno, esperaDesde, nivelEspera, esperaBadge, ETIQUETA_NIVEL } from '../ui/aprobacion-turno.js';
import { RECORDATORIO_ENFRIAMIENTO_HORAS } from '../config.js';

const fechaHora = (iso) => new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export async function renderAprobacionesPendientes(container) {
  container.innerHTML = '<div class="view-loading">Revisando aprobaciones pendientes...</div>';

  let sols, centrosMap, trabMap, perfiles, recordatorios;
  try {
    const [pend, centros, rec] = await Promise.all([
      Data.solicitudesPendientes(),
      Data.centros(),
      Data.recordatoriosRecientes(Math.max(24, RECORDATORIO_ENFRIAMIENTO_HORAS)).catch(() => [])
    ]);
    sols = pend;
    recordatorios = rec;
    centrosMap = new Map(centros.map(c => [c.id, c]));
    const aprobadorIds = sols.flatMap(s => (s.aprobaciones || []).map(a => a.aprobador_id));
    [trabMap, perfiles] = await Promise.all([
      Data.trabajadoresPorId(sols.map(s => s.trabajador_id)),
      Data.perfilesPorId([...aprobadorIds, ...sols.map(s => s.solicitante_id), ...rec.map(r => r.enviado_por)])
    ]);
  } catch (e) {
    console.error('[aprobaciones-pendientes]', e);
    Toast.error('Error', 'No se pudieron cargar las aprobaciones pendientes.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar las aprobaciones pendientes.</div>';
    return;
  }

  // aprobador_id -> [{ sol, desde, espera }]
  const porAprobador = new Map();
  sols.forEach(sol => {
    aprobacionesEnTurno(sol).forEach(apr => {
      const desde = esperaDesde(sol, apr);
      if (!porAprobador.has(apr.aprobador_id)) porAprobador.set(apr.aprobador_id, []);
      porAprobador.get(apr.aprobador_id).push({ sol, desde, espera: nivelEspera(desde) });
    });
  });

  if (!porAprobador.size) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="placeholder-icon">✅</div>
        <p>No hay solicitudes esperando aprobación.</p>
      </div>`;
    return;
  }

  const grupos = [...porAprobador.entries()].map(([aprobadorId, items]) => {
    items.sort((a, b) => new Date(a.desde) - new Date(b.desde));
    return { aprobadorId, items, masAntigua: items[0] };
  }).sort((a, b) => new Date(a.masAntigua.desde) - new Date(b.masAntigua.desde));

  const totalSol = grupos.reduce((n, g) => n + g.items.length, 0);
  const criticas = grupos.reduce((n, g) => n + g.items.filter(i => i.espera.nivel === 'critica').length, 0);
  const masLarga = grupos[0].masAntigua.espera;

  const ultimoRecordatorio = (aprobadorId) =>
    recordatorios.find(r => r.aprobador_id === aprobadorId) || null;

  const tarjeta = (g) => {
    const p = perfiles.get(g.aprobadorId);
    const ult = ultimoRecordatorio(g.aprobadorId);
    const proximo = ult ? new Date(new Date(ult.created_at).getTime() + RECORDATORIO_ENFRIAMIENTO_HORAS * 36e5) : null;
    const bloqueado = proximo && proximo > new Date();
    const quien = ult ? (perfiles.get(ult.enviado_por)?.nombre || 'alguien') : '';
    const filas = g.items.map(({ sol, desde }) => `
      <tr>
        <td><b>${escapeHtml(sol.codigo || '—')}</b>${sol.folio ? `<div class="muted">${escapeHtml(sol.folio)}</div>` : ''}</td>
        <td>${tipoLabel(sol.tipo)}</td>
        <td>${resumen(sol, centrosMap, trabMap)}</td>
        <td>${escapeHtml(perfiles.get(sol.solicitante_id)?.nombre || '—')}</td>
        <td>${fechaHora(desde)}</td>
        <td>${esperaBadge(desde)}</td>
      </tr>`).join('');
    return `
      <div class="card apr-pend-card" data-aprobador="${g.aprobadorId}">
        <div class="apr-pend-top">
          <div>
            <h3>${escapeHtml(p?.nombre || 'Aprobador')}</h3>
            <div class="muted">${escapeHtml(p?.email || '')}</div>
          </div>
          <div class="apr-pend-resumen">
            <span class="badge badge-neutral">${g.items.length} pendiente${g.items.length === 1 ? '' : 's'}</span>
            ${esperaBadge(g.masAntigua.desde, 'Más antigua: ')}
          </div>
          <div class="apr-pend-accion">
            <button class="btn btn-primary" data-recordar-aprobador="${g.aprobadorId}" ${bloqueado ? 'disabled' : ''}>🔔 Enviar recordatorio</button>
            ${ult ? `<span class="muted apr-pend-ult">Último: ${fechaHora(ult.created_at)} · ${escapeHtml(quien)}${bloqueado ? ` · otro desde las ${proximo.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}` : ''}</span>` : ''}
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>N° / Folio</th><th>Tipo</th><th>Detalle</th><th>Solicitante</th><th>Esperando desde</th><th>Espera</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;
  };

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Aprobadores con pendientes</div><div class="kpi-value">${grupos.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Solicitudes esperando</div><div class="kpi-value">${totalSol}</div></div>
      <div class="kpi-card"><div class="kpi-label">Críticas</div><div class="kpi-value">${criticas}</div><div class="kpi-meta">3 días hábiles o más</div></div>
      <div class="kpi-card"><div class="kpi-label">Espera más larga</div><div class="kpi-value">${masLarga.dias >= 1 ? `${masLarga.dias} d.h.` : escapeHtml(masLarga.texto)}</div><div class="kpi-meta">${ETIQUETA_NIVEL[masLarga.nivel]}</div></div>
    </div>
    <div class="card">
      <p class="form-hint">Solo aparece el aprobador al que le toca decidir (la aprobación es por turnos). El recordatorio llega por correo con un mensaje personalizado: su nombre, cada solicitud con el tiempo que lleva esperando y un tono según la más antigua (al día, atrasada o crítica), con un botón directo a su bandeja. Se puede enviar uno cada ${RECORDATORIO_ENFRIAMIENTO_HORAS} horas por aprobador.</p>
    </div>
    ${grupos.map(tarjeta).join('')}`;

  container.querySelectorAll('[data-recordar-aprobador]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.recordarAprobador;
      btn.disabled = true; btn.textContent = 'Enviando...';
      try {
        const r = await Data.recordarAprobador({ aprobador_id: id });
        Toast.success('Recordatorio enviado', `Le escribimos a ${(r?.destinatarios || []).join(', ') || perfiles.get(id)?.nombre || 'el aprobador'}.`);
        renderAprobacionesPendientes(container);
      } catch (e) {
        console.error('[aprobaciones-pendientes] recordar', e);
        Toast.error('No se envió el recordatorio', e.message || '');
        btn.disabled = false; btn.textContent = '🔔 Enviar recordatorio';
      }
    });
  });
}
