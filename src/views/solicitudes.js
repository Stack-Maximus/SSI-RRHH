/**
 * Vista "Solicitudes" (RRHH / admin) · todas las solicitudes del sistema,
 * con filtro por estado, búsqueda y detalle expandible.
 * Reutilizable para "Historial" (solo finalizadas) vía el parámetro fijo.
 */

import { Data } from '../db/data.js';
import { Toast, Confirm } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { estadoBadge, decisionBadge, tipoLabel, fechaCorta, resumen, detalleHtml, detalleTexto } from '../ui/solicitud-format.js';
import { TIPO_SOLICITUD_META, MAESTRO_SOLICITUDES_CODIGO, DOCUMENTO_CODIGOS, TIPOS_SOLICITUD_SIN_DOCUMENTO } from '../config.js';
import { progresoDocumentosTraslado } from '../ui/traslado-format.js';
import { state } from '../core/state.js';
import { renderComprobante } from './comprobante.js';
import { aprobacionesEnTurno, esperaDesde, esperaBadge, recordar } from '../ui/aprobacion-turno.js';
import { nuevoLibroSgc, hojaSgc, descargarLibroSgc } from '../ui/xlsx-sgc.js';
import { documentoMaestro, fechaHora, duracion } from '../../supabase/functions/_shared/sgc-documentos.js';
import { TIPO_LABELS } from '../../supabase/functions/_shared/solicitud-detalle.ts';

let _sols = [], _centros, _trab, _perfiles, _checklist = [], _docsTraslado = new Map(), _rechazosTraslado = new Map(), _backView, _container;

export function renderSolicitudes(container) {
  return cargar(container, { soloFinalizadas: false, titulo: 'Todas las solicitudes', backView: 'solicitudes' });
}
export function renderHistorial(container) {
  return cargar(container, { soloFinalizadas: true, titulo: 'Solicitudes finalizadas', backView: 'historial' });
}

async function cargar(container, opts) {
  _container = container;
  _backView = opts.backView;
  container.innerHTML = '<div class="view-loading">Cargando solicitudes...</div>';
  try {
    const [sols, centros, checklist] = await Promise.all([Data.listTodasSolicitudes(), Data.listCentrosAdmin(), Data.checklistDocumentos()]);
    _sols = opts.soloFinalizadas ? sols.filter(s => s.estado === 'aprobada' || s.estado === 'rechazada') : sols;
    _centros = new Map(centros.map(c => [c.id, c]));
    _checklist = checklist;
    const trasladoAprobadaIds = _sols.filter(s => s.tipo === 'traslado' && s.estado === 'aprobada').map(s => s.id);
    [_trab, _perfiles, _docsTraslado, _rechazosTraslado] = await Promise.all([
      Data.trabajadoresPorId(_sols.map(s => s.trabajador_id)),
      Data.perfilesPorId(_sols.map(s => s.solicitante_id)),
      Data.documentosTrasladoPorSolicitud(trasladoAprobadaIds),
      // Solo interesa acá el rechazo con documento(s) marcado(s) (migración
      // 0016) -- lo único que le toca corregir a RRHH; el resto del motivo
      // de rechazo se ve en Homologación SST.
      Data.rechazosPorSolicitudTraslado(trasladoAprobadaIds)
    ]);
  } catch (e) {
    console.error('[solicitudes]', e);
    Toast.error('Error', 'No se pudieron cargar las solicitudes.');
    container.innerHTML = '<div class="empty-state">No se pudieron cargar las solicitudes.</div>';
    return;
  }

  const tabs = opts.soloFinalizadas
    ? [['todas', 'Todas'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']]
    : [['todas', 'Todas'], ['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']];

  container.innerHTML = `
    <div class="sol-toolbar">
      <div class="filter-tabs" id="filtros">
        ${tabs.map((t, i) => `<button class="filter-tab ${i === 0 ? 'active' : ''}" data-f="${t[0]}">${t[1]}</button>`).join('')}
      </div>
      <div class="sol-acciones">
        <input type="search" id="buscar" class="search-box" placeholder="Buscar código o solicitante...">
        <button class="btn btn-secondary" id="btn-maestro-excel">Exportar maestro (Excel)</button>
        <button class="btn btn-secondary" id="btn-maestro-pdf">⬇️ Exportar maestro (PDF)</button>
      </div>
    </div>
    <div id="sol-list"></div>`;

  container.querySelector('#btn-maestro-excel').addEventListener('click', exportarMaestro);
  container.querySelector('#btn-maestro-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Generando PDF...';
    try {
      await Data.descargarMaestroPdf();
    } catch (err) {
      console.error('[solicitudes] maestro pdf', err);
      Toast.error('Error', err.message || 'No se pudo generar el PDF del maestro.');
    } finally {
      btn.disabled = false; btn.textContent = '⬇️ Exportar maestro (PDF)';
    }
  });

  let filtro = 'todas', q = '';
  const pintar = () => {
    const list = _sols.filter(s => {
      if (filtro !== 'todas' && s.estado !== filtro) return false;
      if (q) {
        const sol = (_perfiles.get(s.solicitante_id)?.nombre || '').toLowerCase();
        const txt = (s.codigo || '').toLowerCase() + ' ' + sol;
        if (!txt.includes(q)) return false;
      }
      return true;
    });
    document.getElementById('sol-list').innerHTML = list.length ? grid(list) : '<div class="empty-state">No hay solicitudes que coincidan.</div>';
    wireDetalles(opts.backView);
    wireAcciones();
  };

  container.querySelectorAll('#filtros .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#filtros .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtro = btn.dataset.f;
      pintar();
    });
  });
  container.querySelector('#buscar').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); pintar(); });

  pintar();
}

function grid(list) {
  return `<div class="sol-grid">${list.map(card).join('')}</div>`;
}

function card(s) {
  const solicitante = _perfiles.get(s.solicitante_id)?.nombre || '—';
  const aprob = (s.aprobaciones || []).filter(a => a.decision === 'aprobado').length;
  const total = (s.aprobaciones || []).length;
  const enTurno = new Set(aprobacionesEnTurno(s));
  const steps = (s.aprobaciones || []).map(a =>
    `<div class="sol-step ${enTurno.has(a) ? 'sol-step-turno' : ''}">Aprobador ${a.orden} ${decisionBadge(a.decision)}${enTurno.has(a) ? ' ' + esperaBadge(esperaDesde(s, a)) : ''}</div>`).join('');
  return `
    <div class="sol-card" data-sol="${s.id}">
      <div class="sol-card-top">
        <span class="sol-id">${s.codigo || '—'}</span>
        <span class="sol-tipo">${tipoLabel(s.tipo)}</span>
        ${estadoBadge(s.estado)}
        ${badgeRechazoTraslado(s)}
      </div>
      <div class="sol-resumen">${resumen(s, _centros, _trab)}</div>
      <div class="sol-detalle muted">Solicitante: ${escapeHtml(solicitante)} · ${fechaCorta(s.created_at)} · ${aprob}/${total} aprobada(s)</div>
      <button class="link-btn" data-toggle>Ver detalle ▾</button>
      <div class="sol-expand" hidden>
        ${detalleHtml(s)}
        <div class="sol-steps" style="margin-top:10px;">${steps || '<span class="muted">Sin aprobadores</span>'}</div>
        ${enTurno.size ? `<button class="link-btn btn-recordar" data-recordar="${s.id}" title="Correo personalizado al aprobador al que le toca decidir">🔔 Recordar al aprobador</button>` : ''}
        ${s.motivo ? `<div class="sol-motivo">"${escapeHtml(s.motivo)}"</div>` : ''}
        <button class="link-btn" data-comprobante="${s.id}">📄 Ver comprobante</button>
        ${accionesRRHH(s)}
      </div>
    </div>`;
}

/**
 * Acción de RRHH para cerrar su plazo de SLA en el detalle expandido de la
 * tarjeta (solo si la solicitud ya está aprobada): en traslado, checklist
 * de 3 documentos con subida inline; en los otros 4 tipos sin documento
 * propio, el botón "Marcar como procesado". Ingreso no tiene acción acá --
 * su documento (Contrato de Trabajo) se sube desde "Contratación".
 */
function accionesRRHH(s) {
  if (s.estado !== 'aprobada') return '';
  if (s.tipo === 'traslado') return accionTraslado(s);
  if (TIPOS_SOLICITUD_SIN_DOCUMENTO.includes(s.tipo)) return accionGenerica(s);
  return '';
}

/**
 * Último rechazo de homologación de un traslado que además tiene
 * documento(s) marcado(s) (migración 0016) -- es el único caso en que le
 * toca corregir algo a RRHH; el resto de los rechazos (sin documento
 * marcado) son asunto de Prevención con el solicitante y se ven en
 * Homologación SST, no acá.
 */
function ultimoRechazoDocTraslado(solicitudId) {
  return [...(_rechazosTraslado.get(solicitudId) || [])].reverse().find(r => r.documentos.length > 0) || null;
}

/** Badge chico para el encabezado de la tarjeta, visible sin expandir el detalle. */
function badgeRechazoTraslado(s) {
  if (s.tipo !== 'traslado') return '';
  return ultimoRechazoDocTraslado(s.id)
    ? '<span class="badge badge-danger" title="Prevención marcó un documento en el último rechazo de homologación">⚠️ Revisar documento</span>'
    : '';
}

function accionTraslado(s) {
  const documentos = _docsTraslado.get(s.id) || [];
  const prog = progresoDocumentosTraslado(_checklist, documentos);
  const rechazosS = _rechazosTraslado.get(s.id) || [];
  const ultimoRechazoDoc = ultimoRechazoDocTraslado(s.id);
  const docsConProblema = new Set(ultimoRechazoDoc?.documentos || []);
  const checklistMap = new Map(_checklist.map(i => [i.id, i]));
  const aviso = ultimoRechazoDoc ? `
    <div class="sol-accion" style="border-left:3px solid #dc2626;">
      <h4>⚠️ Prevención rechazó la homologación</h4>
      <p class="hint">El ${fechaCorta(ultimoRechazoDoc.created_at)} se marcó un problema con:
        <b>${ultimoRechazoDoc.documentos.map(id => escapeHtml(checklistMap.get(id)?.nombre || '—')).join(', ')}</b>.
        Revísalo(s) y vuelve a subir el documento corregido.</p>
      <p class="hint">"${escapeHtml(ultimoRechazoDoc.motivo)}"</p>
      ${rechazosS.length > 1 ? `<p class="hint muted">Este traslado lleva ${rechazosS.length} rechazo(s) de homologación en total.</p>` : ''}
    </div>` : '';
  const filas = prog.items.map(item => {
    const doc = prog.docPorItem.get(item.id);
    return `
      <div class="chk-row ${doc ? 'chk-ok' : ''}">
        <div class="chk-info">
          <div class="chk-nombre">${doc ? '✅' : '⬜'} ${escapeHtml(item.nombre)}${docsConProblema.has(item.id) ? ' <span class="badge badge-danger" title="Prevención marcó este documento en el último rechazo">⚠️ Revisar</span>' : ''}</div>
          ${doc
            ? `<div class="muted"><button class="link-btn" data-doc-traslado="${doc.storage_path}">${escapeHtml(doc.nombre_archivo)}</button> · subido ${fechaCorta(doc.created_at)}</div>`
            : '<div class="muted">Sin subir.</div>'}
        </div>
        <label class="btn btn-secondary" style="cursor:pointer;">${doc ? 'Reemplazar' : 'Subir'}
          <input type="file" data-subir-traslado="${s.id}:${item.id}" hidden accept=".pdf,.png,.jpg,.jpeg,.docx,.doc"></label>
      </div>`;
  }).join('');
  return `
    ${aviso}
    <div class="sol-accion">
      <h4>Documentos para homologación (Prevención)</h4>
      <div class="checklist-list">${filas}</div>
    </div>`;
}

function accionGenerica(s) {
  if (s.procesado_rrhh_at) {
    return `<div class="sol-accion"><p class="hint">✅ Procesado por RRHH el ${fechaCorta(s.procesado_rrhh_at)}.</p></div>`;
  }
  return `<div class="sol-accion">
    <button class="btn btn-primary" data-marcar-procesado="${s.id}">Marcar como procesado</button>
  </div>`;
}

/** Reemplaza en el DOM una sola tarjeta ya renderizada (tras una acción de
 * RRHH), dejando su panel de detalle abierto -- evita recargar toda la
 * grilla y perder el resto de los paneles que el usuario tenía abiertos. */
function reRenderCard(s) {
  const old = document.querySelector(`.sol-card[data-sol="${s.id}"]`);
  if (!old) return;
  old.outerHTML = card(s);
  const fresh = document.querySelector(`.sol-card[data-sol="${s.id}"]`);
  if (!fresh) return;
  fresh.querySelector('.sol-expand').hidden = false;
  fresh.querySelector('[data-toggle]').textContent = 'Ocultar detalle ▴';
  wireDetalles(_backView, fresh);
  wireAcciones(fresh);
}

/** "Maestro de solicitudes" en Excel, con el diseño del SGC ("Concept 3",
 * el mismo del PDF): encabezado + sección 1 (identificación del registro)
 * como imagen y la sección 2 como tabla real, una fila por solicitud con su
 * detalle y el detalle/tiempos de cada aprobación. Siempre trae el universo
 * completo (no solo lo que está filtrado en pantalla). Ver ui/xlsx-sgc.js. */
async function exportarMaestro() {
  const btn = document.getElementById('btn-maestro-excel');
  btn.disabled = true; btn.textContent = 'Generando...';
  try {
    const [sols, centros] = await Promise.all([Data.listTodasSolicitudes(), Data.listCentrosAdmin()]);
    const centrosMap = new Map(centros.map(c => [c.id, c]));
    const [trab, perfiles] = await Promise.all([
      Data.trabajadoresPorId(sols.map(s => s.trabajador_id)),
      Data.perfilesPorId(sols.flatMap(s => [s.solicitante_id, ...(s.aprobaciones || []).map(a => a.aprobador_id)]))
    ]);
    const maxAprob = Math.max(0, ...sols.map(s => (s.aprobaciones || []).length));
    const capital = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
    const fechaChile = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' });

    // Identificación del registro: la misma del PDF del maestro (sgc-documentos.js)
    const doc = documentoMaestro(
      sols.map(s => ({ creada: s.created_at ? fechaChile.format(new Date(s.created_at)) : '' })),
      { tipoLabels: TIPO_LABELS, codigoMaestro: MAESTRO_SOLICITUDES_CODIGO }
    );

    const columnas = [
      { titulo: 'N°', px: 46, alinear: 'centro', estilo: 'numero' },
      { titulo: 'Folio', icono: 'hash', px: 150, estilo: 'fuerte' },
      { titulo: 'N° de solicitud', icono: 'clipboard-list', px: 140, estilo: 'normal' },
      { titulo: 'Tipo', icono: 'tag', px: 140, estilo: 'normal' },
      { titulo: 'Código de formulario', icono: 'barcode', px: 150, estilo: 'normal' },
      { titulo: 'Estado', icono: 'circle-check', px: 120, estilo: 'pildora' },
      { titulo: 'Solicitante', icono: 'user', px: 175, estilo: 'normal' },
      { titulo: 'Trabajador', icono: 'hard-hat', px: 180, estilo: 'normal' },
      { titulo: 'Centro origen', icono: 'building-2', px: 180, estilo: 'normal' },
      { titulo: 'Centro destino', icono: 'building-2', px: 180, estilo: 'normal' },
      { titulo: 'Fecha de creación', icono: 'calendar-clock', px: 150, alinear: 'centro', estilo: 'normal' },
      { titulo: 'Detalle', icono: 'file-text', px: 380, estilo: 'normal' },
      { titulo: 'Motivo', icono: 'message-square', px: 240, estilo: 'normal' },
    ];
    for (let i = 1; i <= maxAprob; i++) {
      columnas.push(
        { titulo: `Aprobador ${i}`, icono: 'user-check', px: 175, estilo: 'fuerte' },
        { titulo: `Decisión ${i}`, icono: 'circle-check', px: 125, estilo: 'pildora' },
        { titulo: `Asignado ${i}`, icono: 'calendar-clock', px: 150, alinear: 'centro', estilo: 'normal' },
        { titulo: `Decidido ${i}`, icono: 'calendar-days', px: 150, alinear: 'centro', estilo: 'normal' },
        { titulo: `Tiempo de respuesta ${i}`, icono: 'timer', px: 150, alinear: 'centro', estilo: 'normal' },
      );
    }

    const filas = sols.map((s, idx) => {
      const aprobs = (s.aprobaciones || []).slice().sort((a, b) => a.orden - b.orden);
      const fila = [
        idx + 1,
        s.folio || '',
        s.codigo || '',
        TIPO_LABELS[s.tipo] || s.tipo,
        DOCUMENTO_CODIGOS[s.tipo]?.codigo || '',
        capital(s.estado),
        perfiles.get(s.solicitante_id)?.nombre || '',
        trab.get(s.trabajador_id)?.nombre || '',
        centrosMap.get(s.centro_origen_id)?.nombre || '',
        centrosMap.get(s.centro_destino_id)?.nombre || '',
        s.created_at ? fechaHora(s.created_at) : '',
        detalleTexto(s),
        s.motivo || '',
      ];
      for (let i = 1; i <= maxAprob; i++) {
        const a = aprobs[i - 1];
        const ms = a?.tiempo_respuesta != null
          ? a.tiempo_respuesta * 1000
          : (a?.decidido_at && a?.asignado_at ? new Date(a.decidido_at) - new Date(a.asignado_at) : null);
        fila.push(
          a ? (perfiles.get(a.aprobador_id)?.nombre || '') : '',
          a ? capital(a.decision) : '',
          a?.asignado_at ? fechaHora(a.asignado_at) : '',
          a?.decidido_at ? fechaHora(a.decidido_at) : '',
          a && ms != null ? duracion(ms) : '',
        );
      }
      return fila;
    });

    const wb = nuevoLibroSgc();
    await hojaSgc(wb, {
      nombreHoja: 'Maestro de solicitudes',
      doc,
      columnas,
      filas,
      vacia: 'No hay solicitudes registradas.',
    });
    const hoy = fechaChile.format(new Date());
    await descargarLibroSgc(wb, `Maestro_Solicitudes_${hoy}.xlsx`);

    Toast.success('Maestro exportado', `${filas.length} solicitud(es).`);
  } catch (e) {
    console.error('[solicitudes] exportar maestro', e);
    Toast.error('Error', 'No se pudo generar el maestro de solicitudes.');
  } finally {
    btn.disabled = false; btn.textContent = 'Exportar maestro (Excel)';
  }
}

function wireDetalles(backView, root = document) {
  root.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.nextElementSibling;
      const abierto = !panel.hidden;
      panel.hidden = abierto;
      btn.textContent = abierto ? 'Ver detalle ▾' : 'Ocultar detalle ▴';
    });
  });
  root.querySelectorAll('[data-comprobante]').forEach(btn => {
    btn.addEventListener('click', () => renderComprobante(_container, btn.dataset.comprobante, backView));
  });
}

/** Wiring de las acciones de RRHH (subir documentos de traslado, marcar
 * como procesado). root acota el querySelectorAll a una sola tarjeta
 * recién reemplazada (ver reRenderCard) o a todo el documento (grilla completa). */
function wireAcciones(root = document) {
  root.querySelectorAll('[data-recordar]').forEach(btn => {
    btn.addEventListener('click', () => recordar(btn));
  });

  root.querySelectorAll('input[type="file"][data-subir-traslado]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const file = inp.files?.[0];
      if (!file) return;
      const [solicitudId, checklistItemId] = inp.dataset.subirTraslado.split(':');
      // ¿Ya estaban los 3 documentos ANTES de esta subida? Si no, y quedan
      // completos DESPUÉS, esta subida es la que cierra el plazo de RRHH.
      const completoAntes = progresoDocumentosTraslado(_checklist, _docsTraslado.get(solicitudId) || []).completo;
      try {
        await Data.subirDocumentoTraslado(solicitudId, checklistItemId, file, state.user.id);
        Toast.success('Documento subido', file.name);
        const map = await Data.documentosTrasladoPorSolicitud([solicitudId]);
        _docsTraslado.set(solicitudId, map.get(solicitudId) || []);
        const completoDespues = progresoDocumentosTraslado(_checklist, _docsTraslado.get(solicitudId) || []).completo;
        if (!completoAntes && completoDespues) Data.notificarEvento('rrhh_cerrado', { solicitud_id: solicitudId }); // fire-and-forget
        const s = _sols.find(x => x.id === solicitudId);
        if (s) reRenderCard(s);
      } catch (e) {
        console.error('[solicitudes] subir documento traslado', e);
        Toast.error('Error', e.message || 'No se pudo subir el documento.');
      }
    });
  });

  root.querySelectorAll('[data-doc-traslado]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const url = await Data.urlDocumentoTraslado(btn.dataset.docTraslado);
        window.open(url, '_blank');
      } catch (e) {
        console.error('[solicitudes] url documento traslado', e);
        Toast.error('Error', 'No se pudo abrir el documento.');
      }
    });
  });

  root.querySelectorAll('[data-marcar-procesado]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const solicitudId = btn.dataset.marcarProcesado;
      const s = _sols.find(x => x.id === solicitudId);
      if (!s) return;
      const ok = await Confirm.ask({
        title: 'Marcar como procesado',
        text: `¿Confirmas que ya se procesó esta solicitud de ${tipoLabel(s.tipo)}? Esto cierra el plazo de SLA de RRHH.`,
        variant: 'primary', confirmText: 'Marcar como procesado'
      });
      if (!ok) return;
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        await Data.marcarProcesadoRRHH(solicitudId, state.user.id);
        Toast.success('Solicitud procesada', '');
        Data.notificarEvento('rrhh_cerrado', { solicitud_id: solicitudId }); // fire-and-forget
        s.procesado_rrhh_at = new Date().toISOString();
        s.procesado_rrhh_por = state.user.id;
        reRenderCard(s);
      } catch (e) {
        console.error('[solicitudes] marcar procesado', e);
        Toast.error('Error', e.message || 'No se pudo marcar como procesado.');
        btn.disabled = false; btn.textContent = 'Marcar como procesado';
      }
    });
  });
}
