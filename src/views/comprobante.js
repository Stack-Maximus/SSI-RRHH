/**
 * "Comprobante" de una solicitud (todos los tipos) con el diseño del SGC
 * ("Concept 3"). La pantalla dibuja EXACTAMENTE las mismas páginas que el
 * PDF: el contenido sale de sgc-documentos.js, la geometría (y los cortes
 * de página) de sgc-layout.js y el detalle por tipo de solicitud-detalle.ts
 * -- los mismos archivos que usa la Edge Function `comprobante-pdf` (que
 * genera el PDF para descargar y el adjunto del correo de aprobación). Acá
 * cada página se pinta como SVG (ui/sgc-render.js).
 */

import { Data } from '../db/data.js';
import { Toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { componerDocumento } from '../../supabase/functions/_shared/sgc-layout.js';
import { documentoComprobante } from '../../supabase/functions/_shared/sgc-documentos.js';
import { TIPO_LABELS, DOCUMENTO_CODIGOS, detalleLineas } from '../../supabase/functions/_shared/solicitud-detalle.ts';
import { asegurarFuentes, medidor, svgDePagina } from '../ui/sgc-render.js';

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
    const [c] = await Promise.all([Data.listCentrosAdmin(), asegurarFuentes()]);
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

  const doc = documentoComprobante(
    {
      sol,
      cmap: centros,
      aprs: aprobaciones,
      pmap: perfiles,
      trabNombre: sol.trabajador_id ? (trab.get(sol.trabajador_id)?.nombre ?? null) : null,
    },
    { tipoLabels: TIPO_LABELS, documentoCodigos: DOCUMENTO_CODIGOS, detalleLineas }
  );
  const paginas = componerDocumento(doc, medidor());

  container.innerHTML = `
    <div class="no-print">
      <button class="link-btn" id="volver">← Volver</button>
    </div>

    <div class="sgc-visor">
      <div class="comprobante-toolbar no-print">
        <span class="muted">Folio ${escapeHtml(sol.folio || sol.codigo || '—')} · ${paginas.length} página${paginas.length === 1 ? '' : 's'}</span>
        <button class="btn btn-primary" id="descargar-pdf">⬇️ Descargar PDF</button>
      </div>
      <div class="sgc-paginas">
        ${paginas.map((prims, i) => `<div class="sgc-hoja" aria-label="Página ${i + 1} de ${paginas.length}">${svgDePagina(prims)}</div>`).join('')}
      </div>
    </div>
  `;

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
