/**
 * "Comprobante" de una solicitud (registro con el diseño corporativo) ·
 * sirve para los 6 tipos (ingreso, traslado, aumento_sueldo, bono,
 * cambio_cargo, renovación). Esta vista es la vitrina en pantalla; el PDF
 * real para descargar/adjuntar lo arma la Edge Function `comprobante-pdf`
 * (mismo diseño -- encabezado Metalium + Código/Folio -- reutilizado
 * también en el correo de aprobación a RRHH). No se usa una librería de
 * PDF en el frontend a propósito, para no engordar el bundle.
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml, formatDate } from '../ui/utils.js';
import { estadoBadge, decisionBadge, tipoLabel, fechaCorta, detalleHtml } from '../ui/solicitud-format.js';
import { DOCUMENTO_CODIGOS } from '../config.js';
import { encabezadoSvg, ajustarTextosEncabezado } from '../ui/encabezado-svg.js';

function dur(ms) {
  if (ms == null || isNaN(ms)) return '—';
  const h = ms / 3600000;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
  if (h < 48) return (Math.round(h * 10) / 10).toString().replace('.0', '') + ' h';
  return (Math.round((h / 24) * 10) / 10).toString().replace('.0', '') + ' d';
}

function fechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function goBack(back) {
  if (typeof back === 'function') back();
  else window.Router.go(back);
}

/**
 * @param {*} backView Vista a la que vuelve el botón "← Volver": una clave de
 *   Router.go (string, ej. 'mis-solicitudes') o una función (ej. para volver
 *   a un drill-down como el Perfil del trabajador, que no es una vista propia).
 */
export async function renderComprobante(container, solicitudId, backView) {
  container.innerHTML = '<div class="view-loading">Cargando comprobante...</div>';

  let sol, aprobaciones, centros, trab, perfiles;
  try {
    sol = await Data.solicitudPorId(solicitudId);
    aprobaciones = (await Data.aprobacionesDe([solicitudId])).sort((a, b) => a.orden - b.orden);
    const [c] = await Promise.all([Data.listCentrosAdmin()]);
    centros = new Map(c.map(x => [x.id, x]));
    trab = sol.trabajador_id ? await Data.trabajadoresPorId([sol.trabajador_id]) : new Map();
    perfiles = await Data.perfilesPorId([sol.solicitante_id, ...aprobaciones.map(a => a.aprobador_id)]);
  } catch (e) {
    console.error('[comprobante]', e);
    Toast.error('Error', 'No se pudo cargar el comprobante.');
    container.innerHTML = `<button class="link-btn" id="volver">← Volver</button><div class="empty-state">No se pudo cargar el comprobante.</div>`;
    container.querySelector('#volver').addEventListener('click', () => goBack(backView));
    return;
  }

  const solicitante = perfiles.get(sol.solicitante_id);
  const trabajador = sol.trabajador_id ? trab.get(sol.trabajador_id) : null;
  const centroOrigen = centros.get(sol.centro_origen_id)?.nombre;
  const centroDestino = centros.get(sol.centro_destino_id)?.nombre;
  const docCod = DOCUMENTO_CODIGOS[sol.tipo];

  const filasAprob = aprobaciones.map(a => {
    const ms = a.tiempo_respuesta != null
      ? a.tiempo_respuesta * 1000
      : (a.decidido_at && a.asignado_at ? new Date(a.decidido_at) - new Date(a.asignado_at) : null);
    return `
      <tr>
        <td>${a.orden}</td>
        <td>${escapeHtml(perfiles.get(a.aprobador_id)?.nombre || '—')}</td>
        <td>${decisionBadge(a.decision)}</td>
        <td>${fechaHora(a.asignado_at)}</td>
        <td>${a.decidido_at ? fechaHora(a.decidido_at) : '—'}</td>
        <td>${dur(ms)}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="no-print">
      <button class="link-btn" id="volver">← Volver</button>
    </div>

    <div class="comprobante">
      <div class="comprobante-toolbar no-print">
        <span class="muted">Folio ${escapeHtml(sol.folio || sol.codigo || '—')}</span>
        <button class="btn btn-primary" id="descargar-pdf">⬇️ Descargar PDF</button>
      </div>

      <div class="comprobante-encabezado">
        ${encabezadoSvg({
          codigo: docCod?.codigo || '—',
          fecha: formatDate(new Date().toISOString()),
          titulo: `Comprobante de solicitud - ${tipoLabel(sol.tipo)}`,
        })}
      </div>

      <div class="comprobante-top">
        <div><span class="dl-k">Estado</span><div>${estadoBadge(sol.estado)}</div></div>
        <div><span class="dl-k">Folio</span><div>${escapeHtml(sol.folio || '—')}</div></div>
        <div><span class="dl-k">N° de solicitud</span><div>${escapeHtml(sol.codigo || '—')}</div></div>
        <div><span class="dl-k">Creada el</span><div>${fechaHora(sol.created_at)}</div></div>
        <div><span class="dl-k">Fecha de emisión</span><div>${fechaCorta(new Date().toISOString())}</div></div>
      </div>

      <div class="card">
        <h3>Datos de la solicitud</h3>
        <div class="dl">
          <div class="dl-row"><span class="dl-k">Solicitante</span><span class="dl-v">${escapeHtml(solicitante?.nombre || '—')}${solicitante?.email ? ' · ' + escapeHtml(solicitante.email) : ''}</span></div>
          <div class="dl-row"><span class="dl-k">Fecha de creación</span><span class="dl-v">${fechaHora(sol.created_at)}</span></div>
          ${trabajador ? `<div class="dl-row"><span class="dl-k">Trabajador</span><span class="dl-v">${escapeHtml(trabajador.nombre)}${trabajador.cargo ? ' · ' + escapeHtml(trabajador.cargo) : ''}</span></div>` : ''}
          ${centroOrigen ? `<div class="dl-row"><span class="dl-k">Centro de costo${centroDestino ? ' (origen)' : ''}</span><span class="dl-v">${escapeHtml(centroOrigen)}</span></div>` : ''}
          ${centroDestino ? `<div class="dl-row"><span class="dl-k">Centro de costo (destino)</span><span class="dl-v">${escapeHtml(centroDestino)}</span></div>` : ''}
        </div>
      </div>

      <div class="card">
        <h3>Detalle</h3>
        ${detalleHtml(sol)}
        ${sol.motivo ? `<div class="sol-motivo">"${escapeHtml(sol.motivo)}"</div>` : ''}
      </div>

      <div class="card">
        <h3>Aprobaciones</h3>
        ${filasAprob ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Orden</th><th>Aprobador</th><th>Decisión</th><th>Asignado</th><th>Decidido</th><th>Tiempo de respuesta</th></tr></thead>
            <tbody>${filasAprob}</tbody>
          </table>
        </div>` : '<span class="muted">Sin aprobadores asignados.</span>'}
      </div>

      <div class="comprobante-foot">Metalium · Documento generado por el sistema · ${fechaCorta(new Date().toISOString())}</div>
    </div>
  `;

  ajustarTextosEncabezado(container.querySelector('.eh-svg'));

  container.querySelector('#volver').addEventListener('click', () => goBack(backView));
  container.querySelector('#descargar-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Generando PDF...';
    try {
      await Data.descargarComprobantePdf(solicitudId);
    } catch (err) {
      console.error('[comprobante] descargar PDF', err);
      Toast.error('Error', err.message || 'No se pudo generar el PDF.');
    } finally {
      btn.disabled = false; btn.textContent = '⬇️ Descargar PDF';
    }
  });
}
