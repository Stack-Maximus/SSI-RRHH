/**
 * Vista "Bandeja de aprobación" · solicitudes pendientes de aprobación POR este usuario.
 * Al aprobar/rechazar, la BD recalcula el estado de la solicitud y registra el tiempo.
 */

import { state } from '../core/state.js';
import { Data } from '../db/data.js';
import { Toast, Confirm } from '../ui/toast.js';
import { tipoLabel, fechaCorta, resumen, detalleHtml } from '../ui/solicitud-format.js';
import { escapeHtml } from '../ui/utils.js';
import { tablaFilas, fila, wireFilas } from '../ui/filas.js';
import { renderComprobante } from './comprobante.js';

export async function renderBandeja(container) {
  container.innerHTML = '<div class="view-loading">Cargando bandeja...</div>';

  let items, centrosMap, trabMap;
  try {
    const [pend, centros] = await Promise.all([Data.bandejaPendientes(state.user.id), Data.centros()]);
    items = pend;
    centrosMap = new Map(centros.map(c => [c.id, c]));
    trabMap = await Data.trabajadoresPorId(items.map(i => i.sol.trabajador_id));
  } catch (e) {
    console.error('[bandeja]', e);
    Toast.error('Error', 'No se pudo cargar la bandeja.');
    container.innerHTML = '<div class="empty-state">No se pudo cargar la bandeja.</div>';
    return;
  }

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="placeholder-icon">✅</div>
        <p>No tienes solicitudes pendientes de aprobación.</p>
      </div>`;
    return;
  }

  // Nov. 2026: en filas (ver ui/filas.js) en vez de tarjetas. El detalle
  // completo queda en "Ver detalle"; Aprobar / Rechazar siempre a la vista.
  const cards = items.map(it => {
    const s = it.sol;
    return fila({
      id: s.id,
      attrs: `data-apr="${it.aprobacionId}"`,
      codigo: escapeHtml(s.codigo || '—'),
      tipo: tipoLabel(s.tipo),
      descripcion: resumen(s, centrosMap, trabMap),
      sub: `Solicitada el ${fechaCorta(s.created_at)}`,
      estado: `<span>Tu turno: aprobador ${it.orden}</span>`,
      acciones: `
        <button class="link-btn" data-comprobante="${s.id}">📄 Comprobante</button>
        <button class="btn btn-danger btn-sm" data-act="rechazar">Rechazar</button>
        <button class="btn btn-primary btn-sm" data-act="aprobar">Aprobar</button>`,
      detalle: `
        ${detalleHtml(s)}
        ${s.motivo ? `<div class="sol-motivo">"${escapeHtml(s.motivo)}"</div>` : ''}`
    });
  }).join('');

  container.innerHTML = `
    <div class="sol-toolbar"><span class="muted">${items.length} pendiente(s)</span></div>
    ${tablaFilas(cards, { clase: 'acc-anchas' })}`;
  wireFilas(container);

  container.querySelectorAll('.sol-card').forEach(card => {
    const aprId = card.dataset.apr;
    const solId = card.dataset.sol;
    card.querySelector('[data-act="aprobar"]').addEventListener('click', () => decidir(aprId, solId, 'aprobado', container));
    card.querySelector('[data-act="rechazar"]').addEventListener('click', () => decidir(aprId, solId, 'rechazado', container));
  });
  container.querySelectorAll('[data-comprobante]').forEach(btn => {
    btn.addEventListener('click', () => renderComprobante(container, btn.dataset.comprobante, 'bandeja'));
  });
}

async function decidir(aprobacionId, solicitudId, decision, container) {
  const esRechazo = decision === 'rechazado';
  const ok = await Confirm.ask({
    title: esRechazo ? '¿Rechazar la solicitud?' : '¿Aprobar?',
    text: esRechazo
      ? 'Si rechazás, la solicitud completa queda rechazada.'
      : 'Tu aprobación queda registrada. Si faltan otros aprobadores, sigue pendiente hasta que todos aprueben.',
    variant: esRechazo ? 'danger' : 'success',
    confirmText: esRechazo ? 'Rechazar' : 'Aprobar'
  });
  if (!ok) return;

  try {
    await Data.decidir(aprobacionId, decision);
    // Cierre (a solicitante + RRHH si quedó aprobada/rechazada) y, si sigue pendiente, aviso al siguiente turno
    Data.notificar('cambio_estado', solicitudId);
    Data.notificar('pendiente_aprobador', solicitudId);
    Toast.success(esRechazo ? 'Solicitud rechazada' : 'Aprobación registrada', '');
    renderBandeja(container); // recargar la bandeja
  } catch (e) {
    console.error('[bandeja] decidir:', e);
    Toast.error('Error', e.message || 'No se pudo registrar la decisión.');
  }
}
