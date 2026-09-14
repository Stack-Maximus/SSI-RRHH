/**
 * Vista "Homologación SST" (prevencionista / admin) · bandeja de solo
 * lectura con los dos orígenes que puede homologar un prevencionista:
 *
 *   - Contrataciones de INGRESO de su centro de costo (checklist completo
 *     de contratación, destacando Contrato de Trabajo + Cédula).
 *   - Solicitudes de TRASLADO aprobadas hacia su centro de costo (checklist
 *     fijo de 3 documentos: Contrato de Trabajo, Anexo de Contrato, Cédula).
 *
 * En ambos casos se puede "Autorizar ingreso a obra" una vez que los
 * documentos están completos -- mismo botón, mismo criterio de auditoría
 * (quién y cuándo), solo que actualiza una tabla distinta según el origen.
 *
 * También se puede "Rechazar homologación" (ver migración 0016): motivo
 * obligatorio y, opcionalmente, marcar qué documento(s) del checklist
 * tienen el problema. El caso NO cambia de estado -- sigue pendiente, así
 * que una vez que RRHH corrija lo que corresponda (o el prevencionista
 * reconsidere) se puede volver a autorizar o rechazar de nuevo (cada
 * rechazo extiende el plazo del caso 3 días hábiles más, acumulable, ver
 * dashboard-prevencion.js). El rechazo se le avisa siempre al solicitante
 * original y al Gerente de Prevención; a RRHH solo si se marcó algún
 * documento (Edge Function `notificar`, tipo 'homologacion_rechazada').
 */

import { Data } from '../db/data.js';
import { Toast, Confirm } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { fechaCorta } from '../ui/solicitud-format.js';
import { estadoContratacionBadge, canalLabel, tipoTrabajadorLabel, checklistParaTipo } from '../ui/contratacion-format.js';
import { progresoDocumentosTraslado } from '../ui/traslado-format.js';
import { state } from '../core/state.js';

export async function renderHomologacion(container) {
  container.innerHTML = '<div class="view-loading">Cargando homologaciones...</div>';

  let contrataciones, solTraslado, checklist, trabajadores, centros, docsTraslado;
  try {
    [contrataciones, solTraslado, checklist, centros] = await Promise.all([
      Data.listContrataciones(),
      Data.solicitudesAprobadasPorTipo(['traslado']),
      Data.checklistDocumentos(),
      Data.listCentrosAdmin()
    ]);
    [trabajadores, docsTraslado] = await Promise.all([
      Data.trabajadoresPorId(solTraslado.map(s => s.trabajador_id)),
      Data.documentosTrasladoPorSolicitud(solTraslado.map(s => s.id))
    ]);
  } catch (e) {
    console.error('[homologacion]', e);
    Toast.error('Error', 'No se pudo cargar la homologación.');
    container.innerHTML = '<div class="empty-state">No se pudo cargar la homologación.</div>';
    return;
  }

  const ctx = { contrataciones, solTraslado, checklist, trabajadores, centros, docsTraslado };
  const enCursoIngreso = contrataciones.filter(c => c.estado !== 'anulada');

  if (!enCursoIngreso.length && !solTraslado.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="placeholder-icon">🦺</div>
      <p>No hay contrataciones ni traslados en curso todavía.</p>
    </div>`;
    return;
  }

  const items = [
    ...enCursoIngreso.map(c => ({ tipo: 'ingreso', id: c.id, fecha: c.created_at, c })),
    ...solTraslado.map(s => ({ tipo: 'traslado', id: s.id, fecha: s.created_at, s }))
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  container.innerHTML = `
    <p class="hint">Se destacan primero los documentos requeridos para homologación. En ingreso, el resto del expediente
      del trabajador queda disponible para abrir por si necesitas revisar algún otro documento.</p>
    <div class="sol-grid" id="hom-grid"></div>`;

  const grid = container.querySelector('#hom-grid');
  grid.innerHTML = items.map(it => it.tipo === 'ingreso' ? cardIngreso(it.c) : cardTraslado(it.s, trabajadores, centros)).join('');

  grid.querySelectorAll('[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [tipo, id] = btn.dataset.ver.split(':');
      if (tipo === 'ingreso') verDetalleIngreso(container, id, ctx);
      else verDetalleTraslado(container, id, ctx);
    });
  });
}

function cardIngreso(c) {
  return `
    <div class="sol-card">
      <div class="sol-card-top">
        <span class="sol-id">${escapeHtml(c.nombre_candidato)}</span>
        ${estadoContratacionBadge(c.estado)}
      </div>
      <div class="sol-detalle muted">➕ Ingreso · ${canalLabel(c.canal)} · ${tipoTrabajadorLabel(c.tipo_trabajador)}</div>
      <button class="link-btn" data-ver="ingreso:${c.id}">Ver documentos ▸</button>
    </div>`;
}

function cardTraslado(s, trabajadores, centros) {
  const centrosMap = centros instanceof Map ? centros : new Map(centros.map(c => [c.id, c]));
  const nombre = trabajadores.get(s.trabajador_id)?.nombre || 'Trabajador';
  const badge = s.homologacion_traslado_aprobada_at
    ? '<span class="badge badge-success">Autorizado</span>'
    : '<span class="badge badge-warning">Pendiente</span>';
  const origen = centrosMap.get(s.centro_origen_id)?.nombre || '—';
  const destino = centrosMap.get(s.centro_destino_id)?.nombre || '—';
  return `
    <div class="sol-card">
      <div class="sol-card-top">
        <span class="sol-id">${escapeHtml(nombre)}</span>
        ${badge}
      </div>
      <div class="sol-detalle muted">🔁 Traslado · ${escapeHtml(origen)} → ${escapeHtml(destino)}</div>
      <button class="link-btn" data-ver="traslado:${s.id}">Ver documentos ▸</button>
    </div>`;
}

function filaDoc(item, doc, notaExtra = '') {
  return `
    <div class="chk-row ${doc ? 'chk-ok' : ''}">
      <div class="chk-info">
        <div class="chk-nombre">${doc ? '✅' : '⬜'} ${escapeHtml(item.nombre)}${notaExtra}</div>
        ${doc
          ? `<div class="muted"><button class="link-btn" data-doc="${doc.storage_path}">${escapeHtml(doc.nombre_archivo)}</button> · subido ${fechaCorta(doc.created_at)}</div>`
          : '<div class="muted">Aún no lo sube RRHH.</div>'}
      </div>
    </div>`;
}

/**
 * Historial de rechazos de un caso (ingreso o traslado), más reciente
 * primero -- con el motivo y, si aplica, qué documentos se marcaron como
 * el problema (esos son los que además le avisan a RRHH, ver Edge
 * Function `notificar`). No se muestra nada si el caso nunca se rechazó.
 */
function historialRechazos(rechazos, checklistMap, perfilesMap) {
  if (!rechazos.length) return '';
  const fila = (r) => {
    const nombres = (r.documentos || []).map(id => checklistMap.get(id)?.nombre || '—');
    return `
      <div class="chk-row">
        <div class="chk-info">
          <div class="chk-nombre">🚫 Rechazado el ${fechaCorta(r.created_at)} · ${escapeHtml(perfilesMap.get(r.rechazado_por)?.nombre || '—')}</div>
          <div class="muted">"${escapeHtml(r.motivo)}"</div>
          ${nombres.length ? `<div class="muted">Documento(s) marcado(s): ${nombres.map(n => escapeHtml(n)).join(', ')}</div>` : ''}
        </div>
      </div>`;
  };
  return `
    <div class="card">
      <h3>Historial de rechazos (${rechazos.length})</h3>
      <div class="checklist-list">${[...rechazos].reverse().map(fila).join('')}</div>
    </div>`;
}

/**
 * Formulario inline (oculto hasta que se pide rechazar) con el motivo
 * obligatorio y el checklist de documentos para marcar el problema, si
 * corresponde. `items` son los mismos documentos que ya se muestran como
 * "Documentos para homologación" en el detalle (principales en ingreso,
 * los 3 fijos en traslado).
 */
function formRechazo(items) {
  const filas = items.map(i => `
    <label class="chk-row" style="cursor:pointer;">
      <input type="checkbox" class="rech-doc" value="${i.id}" style="margin-right:8px;">
      <span>${escapeHtml(i.nombre)}</span>
    </label>`).join('');
  return `
    <div class="form-field">
      <label class="form-label">Motivo del rechazo <span class="req">*</span></label>
      <textarea id="rech-motivo" rows="3" placeholder="Explica por qué se rechaza la homologación..."></textarea>
    </div>
    <div class="form-field">
      <label class="form-label">¿Alguno de estos documentos tiene el problema? (opcional)</label>
      <p class="hint" style="margin:2px 0 6px;">Si marcas al menos uno, además se le avisa a RRHH para que lo corrija o reemplace.</p>
      <div class="checklist-list">${filas}</div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" id="rech-cancelar">Cancelar</button>
      <button type="button" class="btn btn-danger" id="rech-confirmar">Rechazar homologación</button>
    </div>`;
}

async function verDetalleIngreso(container, contratacionId, ctx) {
  container.innerHTML = '<div class="view-loading">Cargando documentos...</div>';
  const c = ctx.contrataciones.find(x => x.id === contratacionId);
  let documentos, rechazos, perfilesMap;
  try {
    [documentos, rechazos] = await Promise.all([
      Data.documentosDeContratacion(contratacionId),
      Data.rechazosPorContratacion([contratacionId]).then(m => m.get(contratacionId) || [])
    ]);
    perfilesMap = await Data.perfilesPorId(rechazos.map(r => r.rechazado_por)).catch(() => new Map());
  } catch (e) {
    console.error('[homologacion] detalle ingreso', e);
    Toast.error('Error', 'No se pudieron cargar los documentos.');
    documentos = []; rechazos = []; perfilesMap = new Map();
  }

  const todos = checklistParaTipo(ctx.checklist, c.tipo_trabajador);
  const principales = todos.filter(i => i.requerido_homologacion);
  const otros = todos.filter(i => !i.requerido_homologacion);
  const docPorItem = new Map(documentos.map(d => [d.checklist_item_id, d]));
  const checklistMap = new Map(ctx.checklist.map(i => [i.id, i]));

  const fila = (item) => filaDoc(item, docPorItem.get(item.id),
    item.codigo === 'contrato_trabajo' ? ' <span class="badge badge-info">Inicia el plazo de homologación</span>' : '');

  const faltantesPrincipales = principales.filter(i => !docPorItem.has(i.id)).length;
  const autorizada = !!c.homologacion_aprobada_at;
  const accionAutorizacion = c.estado === 'anulada' ? '' : autorizada
    ? `<div class="card"><p class="hint">✅ Ingreso a obra autorizado el ${fechaCorta(c.homologacion_aprobada_at)}.</p></div>`
    : `<div class="card">
        <h3>Autorización de ingreso a obra</h3>
        ${faltantesPrincipales > 0
          ? `<p class="hint">⚠️ Aún ${faltantesPrincipales === 1 ? 'falta 1 documento requerido' : `faltan ${faltantesPrincipales} documentos requeridos`} para homologación.</p>`
          : '<p class="hint">Ya están los documentos requeridos para homologación. Revísalos y, si todo está en regla, autoriza el ingreso; si algo no corresponde, rechaza indicando el motivo.</p>'}
        <div class="form-actions" style="justify-content:flex-start;">
          <button class="btn btn-primary" id="autorizar-ingreso">Autorizar ingreso a obra</button>
          <button class="btn btn-danger" id="mostrar-rechazo">Rechazar homologación</button>
        </div>
        <div id="rechazo-form" hidden style="margin-top:14px;">${formRechazo(principales)}</div>
      </div>`;

  container.innerHTML = `
    <button class="link-btn" id="volver">← Volver</button>
    <div class="detalle-head">
      <span class="sol-id">${escapeHtml(c.nombre_candidato)}</span>
      ${estadoContratacionBadge(c.estado)}
    </div>
    <div class="card">
      <h3>Documentos para homologación</h3>
      <div class="checklist-list">${principales.map(fila).join('') || '<span class="muted">No hay documentos marcados como requeridos para homologación en este checklist.</span>'}</div>
    </div>
    <div class="card">
      <details>
        <summary style="cursor:pointer;font-weight:600;">Otros documentos del trabajador (${otros.length})</summary>
        <p class="hint" style="margin-top:8px;">Resto del expediente de contratación, por si necesitas revisar algo puntual que no es parte del checklist estándar de homologación.</p>
        <div class="checklist-list" style="margin-top:10px;">${otros.map(fila).join('') || '<span class="muted">No hay más documentos en este checklist.</span>'}</div>
      </details>
    </div>
    ${accionAutorizacion}
    ${historialRechazos(rechazos, checklistMap, perfilesMap)}`;

  container.querySelector('#volver').addEventListener('click', () => window.Router.go('homologacion'));
  container.querySelectorAll('[data-doc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const url = await Data.urlDocumentoContratacion(btn.dataset.doc);
        window.open(url, '_blank');
      } catch (e) {
        console.error('[homologacion] url', e);
        Toast.error('Error', 'No se pudo abrir el documento.');
      }
    });
  });

  const btnAutorizar = container.querySelector('#autorizar-ingreso');
  if (btnAutorizar) {
    btnAutorizar.addEventListener('click', async () => {
      const ok = await Confirm.ask({
        title: 'Autorizar ingreso a obra',
        text: `¿Confirmas que ${c.nombre_candidato} queda autorizado para ingresar a la obra designada?`,
        variant: 'primary',
        confirmText: 'Autorizar'
      });
      if (!ok) return;
      btnAutorizar.disabled = true; btnAutorizar.textContent = 'Autorizando...';
      try {
        await Data.autorizarIngresoObra(c.id, state.user.id);
        Toast.success('Ingreso autorizado', `${c.nombre_candidato} ya puede ingresar a la obra.`);
        Data.notificarEvento('homologacion_autorizada', { contratacion_id: c.id }); // fire-and-forget
        c.homologacion_aprobada_at = new Date().toISOString();
        c.homologacion_aprobada_por = state.user.id;
        verDetalleIngreso(container, contratacionId, ctx);
      } catch (e) {
        console.error('[homologacion] autorizar ingreso', e);
        Toast.error('Error', e.message || 'No se pudo autorizar el ingreso.');
        btnAutorizar.disabled = false; btnAutorizar.textContent = 'Autorizar ingreso a obra';
      }
    });
  }

  const btnMostrarRechazo = container.querySelector('#mostrar-rechazo');
  if (btnMostrarRechazo) {
    btnMostrarRechazo.addEventListener('click', () => {
      container.querySelector('#rechazo-form').hidden = false;
      btnMostrarRechazo.hidden = true;
      container.querySelector('#autorizar-ingreso').hidden = true;
    });
    const btnRechConfirmar = container.querySelector('#rech-confirmar');
    container.querySelector('#rech-cancelar').addEventListener('click', () => verDetalleIngreso(container, contratacionId, ctx));
    btnRechConfirmar.addEventListener('click', async () => {
      const motivo = container.querySelector('#rech-motivo').value.trim();
      if (!motivo) { Toast.warning('Falta el motivo', 'Indica por qué se rechaza la homologación.'); return; }
      const checklistItemIds = [...container.querySelectorAll('.rech-doc:checked')].map(i => i.value);
      const ok = await Confirm.ask({
        title: 'Rechazar homologación',
        text: `Se rechaza la homologación de ${c.nombre_candidato}. El plazo del caso se extiende 3 días hábiles más. ¿Confirmas?`,
        variant: 'danger',
        confirmText: 'Rechazar'
      });
      if (!ok) return;
      // No usar e.currentTarget acá: tras el `await` de Confirm.ask() el evento original
      // ya terminó su despacho y el navegador lo deja en null -- por eso btnRechConfirmar
      // se capturó ANTES, en una variable normal (mismo motivo por el que el resto de este
      // archivo usa btnAutorizar de la misma forma).
      btnRechConfirmar.disabled = true; btnRechConfirmar.textContent = 'Rechazando...';
      try {
        await Data.rechazarHomologacionIngreso(c.id, state.user.id, motivo, checklistItemIds);
        Toast.success('Homologación rechazada', 'Se avisó a quien solicitó el ingreso.');
        Data.notificarEvento('homologacion_rechazada', { contratacion_id: c.id }); // fire-and-forget
        verDetalleIngreso(container, contratacionId, ctx);
      } catch (err) {
        console.error('[homologacion] rechazar ingreso', err);
        Toast.error('Error', err.message || 'No se pudo registrar el rechazo.');
        btnRechConfirmar.disabled = false; btnRechConfirmar.textContent = 'Rechazar homologación';
      }
    });
  }
}

async function verDetalleTraslado(container, solicitudId, ctx) {
  container.innerHTML = '<div class="view-loading">Cargando documentos...</div>';
  const s = ctx.solTraslado.find(x => x.id === solicitudId);
  const centrosMap = new Map(ctx.centros.map(c => [c.id, c]));
  const nombre = ctx.trabajadores.get(s.trabajador_id)?.nombre || 'Trabajador';

  let documentos, rechazos, perfilesMap;
  try {
    const map = await Data.documentosTrasladoPorSolicitud([solicitudId]);
    documentos = map.get(solicitudId) || [];
    ctx.docsTraslado.set(solicitudId, documentos); // refresca el caché local de la bandeja
    rechazos = await Data.rechazosPorSolicitudTraslado([solicitudId]).then(m => m.get(solicitudId) || []);
    perfilesMap = await Data.perfilesPorId(rechazos.map(r => r.rechazado_por)).catch(() => new Map());
  } catch (e) {
    console.error('[homologacion] detalle traslado', e);
    Toast.error('Error', 'No se pudieron cargar los documentos.');
    documentos = []; rechazos = []; perfilesMap = new Map();
  }

  const prog = progresoDocumentosTraslado(ctx.checklist, documentos);
  const fila = (item) => filaDoc(item, prog.docPorItem.get(item.id));
  const checklistMap = new Map(ctx.checklist.map(i => [i.id, i]));

  const autorizada = !!s.homologacion_traslado_aprobada_at;
  const accionAutorizacion = autorizada
    ? `<div class="card"><p class="hint">✅ Ingreso a obra autorizado el ${fechaCorta(s.homologacion_traslado_aprobada_at)}.</p></div>`
    : `<div class="card">
        <h3>Autorización de ingreso a obra</h3>
        ${prog.faltantes.length > 0
          ? `<p class="hint">⚠️ Aún ${prog.faltantes.length === 1 ? 'falta 1 documento' : `faltan ${prog.faltantes.length} documentos`}.</p>`
          : '<p class="hint">Ya están los 3 documentos. Revísalos y, si todo está en regla, autoriza el ingreso; si algo no corresponde, rechaza indicando el motivo.</p>'}
        <div class="form-actions" style="justify-content:flex-start;">
          <button class="btn btn-primary" id="autorizar-ingreso">Autorizar ingreso a obra</button>
          <button class="btn btn-danger" id="mostrar-rechazo">Rechazar homologación</button>
        </div>
        <div id="rechazo-form" hidden style="margin-top:14px;">${formRechazo(prog.items)}</div>
      </div>`;

  container.innerHTML = `
    <button class="link-btn" id="volver">← Volver</button>
    <div class="detalle-head">
      <span class="sol-id">${escapeHtml(nombre)}</span>
      ${autorizada ? '<span class="badge badge-success">Autorizado</span>' : '<span class="badge badge-warning">Pendiente</span>'}
    </div>
    <p class="hint">Traslado: ${escapeHtml(centrosMap.get(s.centro_origen_id)?.nombre || '—')} → ${escapeHtml(centrosMap.get(s.centro_destino_id)?.nombre || '—')}</p>
    <div class="card">
      <h3>Documentos para homologación</h3>
      <p class="hint">Estos 3 documentos, una vez completos, inician el plazo de homologación.</p>
      <div class="checklist-list">${prog.items.map(fila).join('')}</div>
    </div>
    ${accionAutorizacion}
    ${historialRechazos(rechazos, checklistMap, perfilesMap)}`;

  container.querySelector('#volver').addEventListener('click', () => window.Router.go('homologacion'));
  container.querySelectorAll('[data-doc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const url = await Data.urlDocumentoTraslado(btn.dataset.doc);
        window.open(url, '_blank');
      } catch (e) {
        console.error('[homologacion] url traslado', e);
        Toast.error('Error', 'No se pudo abrir el documento.');
      }
    });
  });

  const btnAutorizar = container.querySelector('#autorizar-ingreso');
  if (btnAutorizar) {
    btnAutorizar.addEventListener('click', async () => {
      const ok = await Confirm.ask({
        title: 'Autorizar ingreso a obra',
        text: `¿Confirmas que ${nombre} queda autorizado para ingresar a la obra destino?`,
        variant: 'primary',
        confirmText: 'Autorizar'
      });
      if (!ok) return;
      btnAutorizar.disabled = true; btnAutorizar.textContent = 'Autorizando...';
      try {
        await Data.autorizarIngresoObraTraslado(s.id, state.user.id);
        Toast.success('Ingreso autorizado', `${nombre} ya puede ingresar a la obra.`);
        Data.notificarEvento('homologacion_autorizada', { solicitud_id: s.id }); // fire-and-forget
        s.homologacion_traslado_aprobada_at = new Date().toISOString();
        s.homologacion_traslado_aprobada_por = state.user.id;
        verDetalleTraslado(container, solicitudId, ctx);
      } catch (e) {
        console.error('[homologacion] autorizar traslado', e);
        Toast.error('Error', e.message || 'No se pudo autorizar el ingreso.');
        btnAutorizar.disabled = false; btnAutorizar.textContent = 'Autorizar ingreso a obra';
      }
    });
  }

  const btnMostrarRechazo = container.querySelector('#mostrar-rechazo');
  if (btnMostrarRechazo) {
    btnMostrarRechazo.addEventListener('click', () => {
      container.querySelector('#rechazo-form').hidden = false;
      btnMostrarRechazo.hidden = true;
      container.querySelector('#autorizar-ingreso').hidden = true;
    });
    const btnRechConfirmar = container.querySelector('#rech-confirmar');
    container.querySelector('#rech-cancelar').addEventListener('click', () => verDetalleTraslado(container, solicitudId, ctx));
    btnRechConfirmar.addEventListener('click', async () => {
      const motivo = container.querySelector('#rech-motivo').value.trim();
      if (!motivo) { Toast.warning('Falta el motivo', 'Indica por qué se rechaza la homologación.'); return; }
      const checklistItemIds = [...container.querySelectorAll('.rech-doc:checked')].map(i => i.value);
      const ok = await Confirm.ask({
        title: 'Rechazar homologación',
        text: `Se rechaza la homologación de ${nombre}. El plazo del caso se extiende 3 días hábiles más. ¿Confirmas?`,
        variant: 'danger',
        confirmText: 'Rechazar'
      });
      if (!ok) return;
      // Mismo motivo que en verDetalleIngreso: btnRechConfirmar se capturó antes del
      // `await` porque e.currentTarget queda en null una vez que el evento terminó de
      // despacharse.
      btnRechConfirmar.disabled = true; btnRechConfirmar.textContent = 'Rechazando...';
      try {
        await Data.rechazarHomologacionTraslado(s.id, state.user.id, motivo, checklistItemIds);
        Toast.success('Homologación rechazada', 'Se avisó a quien solicitó el traslado.');
        Data.notificarEvento('homologacion_rechazada', { solicitud_id: s.id }); // fire-and-forget
        verDetalleTraslado(container, solicitudId, ctx);
      } catch (err) {
        console.error('[homologacion] rechazar traslado', err);
        Toast.error('Error', err.message || 'No se pudo registrar el rechazo.');
        btnRechConfirmar.disabled = false; btnRechConfirmar.textContent = 'Rechazar homologación';
      }
    });
  }
}
