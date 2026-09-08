/**
 * Vista "Homologación SST" (prevencionista / admin) · bandeja de solo lectura
 * con las contrataciones en curso. De cada una se destacan primero los
 * documentos del checklist marcados como "requerido para homologación"
 * (Contrato + Cédula/Pasaporte) y, además, se puede abrir el resto del
 * expediente del trabajador (el resto del checklist de contratación) por si
 * se necesita revisar algún otro documento puntual.
 */

import { Data } from '../db/data.js';
import { Toast, Confirm } from '../ui/toast.js';
import { escapeHtml } from '../ui/utils.js';
import { fechaCorta } from '../ui/solicitud-format.js';
import { estadoContratacionBadge, canalLabel, tipoTrabajadorLabel, checklistParaTipo } from '../ui/contratacion-format.js';
import { state } from '../core/state.js';

export async function renderHomologacion(container) {
  container.innerHTML = '<div class="view-loading">Cargando homologaciones...</div>';

  let contrataciones, checklist;
  try {
    [contrataciones, checklist] = await Promise.all([Data.listContrataciones(), Data.checklistDocumentos()]);
  } catch (e) {
    console.error('[homologacion]', e);
    Toast.error('Error', 'No se pudo cargar la homologación.');
    container.innerHTML = '<div class="empty-state">No se pudo cargar la homologación.</div>';
    return;
  }

  const enCurso = contrataciones.filter(c => c.estado !== 'anulada');

  if (!enCurso.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="placeholder-icon">🦺</div>
      <p>No hay contrataciones en curso todavía.</p>
    </div>`;
    return;
  }

  container.innerHTML = `
    <p class="hint">Se destacan primero los documentos requeridos para homologación. El resto del expediente
      del trabajador queda disponible para abrir por si necesitas revisar algún otro documento.</p>
    <div class="sol-grid" id="hom-grid"></div>`;

  const grid = container.querySelector('#hom-grid');
  grid.innerHTML = enCurso.map(c => card(c)).join('');

  grid.querySelectorAll('[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => verDetalle(container, btn.dataset.ver, contrataciones, checklist));
  });
}

function card(c) {
  return `
    <div class="sol-card">
      <div class="sol-card-top">
        <span class="sol-id">${escapeHtml(c.nombre_candidato)}</span>
        ${estadoContratacionBadge(c.estado)}
      </div>
      <div class="sol-detalle muted">${canalLabel(c.canal)} · ${tipoTrabajadorLabel(c.tipo_trabajador)}</div>
      <button class="link-btn" data-ver="${c.id}">Ver documentos ▸</button>
    </div>`;
}

async function verDetalle(container, contratacionId, contrataciones, checklist) {
  container.innerHTML = '<div class="view-loading">Cargando documentos...</div>';
  const c = contrataciones.find(x => x.id === contratacionId);
  let documentos;
  try {
    documentos = await Data.documentosDeContratacion(contratacionId);
  } catch (e) {
    console.error('[homologacion] detalle', e);
    Toast.error('Error', 'No se pudieron cargar los documentos.');
    documentos = [];
  }

  const todos = checklistParaTipo(checklist, c.tipo_trabajador);
  const principales = todos.filter(i => i.requerido_homologacion);
  const otros = todos.filter(i => !i.requerido_homologacion);
  const docPorItem = new Map(documentos.map(d => [d.checklist_item_id, d]));

  const fila = (item) => {
    const doc = docPorItem.get(item.id);
    const disparaSla = item.codigo === 'contrato_trabajo'
      ? ' <span class="badge badge-info">Inicia el plazo de homologación</span>' : '';
    return `
      <div class="chk-row ${doc ? 'chk-ok' : ''}">
        <div class="chk-info">
          <div class="chk-nombre">${doc ? '✅' : '⬜'} ${escapeHtml(item.nombre)}${disparaSla}</div>
          ${doc
            ? `<div class="muted"><button class="link-btn" data-doc="${doc.storage_path}">${escapeHtml(doc.nombre_archivo)}</button> · subido ${fechaCorta(doc.created_at)}</div>`
            : '<div class="muted">Aún no lo sube RRHH.</div>'}
        </div>
      </div>`;
  };

  const faltantesPrincipales = principales.filter(i => !docPorItem.has(i.id)).length;
  const autorizada = !!c.homologacion_aprobada_at;
  const accionAutorizacion = c.estado === 'anulada' ? '' : autorizada
    ? `<div class="card"><p class="hint">✅ Ingreso a obra autorizado el ${fechaCorta(c.homologacion_aprobada_at)}.</p></div>`
    : `<div class="card">
        <h3>Autorización de ingreso a obra</h3>
        ${faltantesPrincipales > 0
          ? `<p class="hint">⚠️ Aún ${faltantesPrincipales === 1 ? 'falta 1 documento requerido' : `faltan ${faltantesPrincipales} documentos requeridos`} para homologación.</p>`
          : '<p class="hint">Ya están los documentos requeridos para homologación. Revísalos y, si todo está en regla, autoriza el ingreso.</p>'}
        <button class="btn btn-primary" id="autorizar-ingreso">Autorizar ingreso a obra</button>
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
    ${accionAutorizacion}`;

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
        c.homologacion_aprobada_at = new Date().toISOString();
        c.homologacion_aprobada_por = state.user.id;
        verDetalle(container, contratacionId, contrataciones, checklist);
      } catch (e) {
        console.error('[homologacion] autorizar', e);
        Toast.error('Error', e.message || 'No se pudo autorizar el ingreso.');
        btnAutorizar.disabled = false; btnAutorizar.textContent = 'Autorizar ingreso a obra';
      }
    });
  }
}
