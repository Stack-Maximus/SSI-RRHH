/**
 * Vista de solicitudes en FILAS (nov. 2026, a pedido: "que no sean en esos
 * recuadros, sino tipo fila"). Lo usan Mis solicitudes, Bandeja,
 * Solicitudes e Historial.
 *
 * Cada solicitud es una fila con 4 columnas (Solicitud · Descripción ·
 * Estado · Acciones) y, debajo, su detalle plegado (.sol-expand) que se abre
 * con "Ver detalle". Se mantiene la clase .sol-card en cada fila para no
 * cambiar el resto de la lógica de las vistas (que busca .sol-card[data-sol]).
 * Estilos: .sol-filas en styles/solicitudes.css.
 */

export const TXT_VER = 'Ver detalle ▾';
export const TXT_OCULTAR = 'Ocultar detalle ▴';

/** Contenedor con encabezado de columnas + las filas ya armadas. clase 'acc-anchas' = columna de acciones más ancha (Bandeja: Aprobar/Rechazar). */
export function tablaFilas(filasHtml, { columnas = ['Solicitud', 'Descripción', 'Estado', 'Acciones'], clase = '' } = {}) {
  return `
    <div class="sol-grid sol-filas ${clase}" role="table">
      <div class="sol-filas-head" role="row">${columnas.map(c => `<span role="columnheader">${c}</span>`).join('')}</div>
      ${filasHtml}
    </div>`;
}

/**
 * Una fila. Todo el contenido llega ya armado (y escapado) desde la vista.
 *  - id: data-sol de la fila
 *  - codigo, tipo: columna 1
 *  - descripcion, sub: columna 2 (sub = línea chica gris debajo)
 *  - estado: columna 3
 *  - acciones: columna 4 (se agrega solo el botón "Ver detalle" si hay detalle)
 *  - detalle: panel plegado que ocupa todo el ancho
 *  - attrs: atributos extra para el div de la fila (ej. data-apr="...")
 */
export function fila({ id, codigo, tipo, descripcion, sub = '', estado = '', acciones = '', detalle = '', attrs = '' }) {
  return `
    <div class="sol-card sol-fila" role="row" data-sol="${id}" ${attrs}>
      <div class="fila-id"><span class="sol-id">${codigo || '—'}</span><span class="sol-tipo">${tipo || ''}</span></div>
      <div class="fila-desc"><div class="sol-resumen">${descripcion || '—'}</div>${sub ? `<div class="fila-sub muted">${sub}</div>` : ''}</div>
      <div class="fila-estado">${estado}</div>
      <div class="fila-acc">${acciones}${detalle ? `<button class="link-btn" data-toggle>${TXT_VER}</button>` : ''}</div>
      ${detalle ? `<div class="sol-expand" hidden>${detalle}</div>` : ''}
    </div>`;
}

/** Abre/cierra el detalle de la fila del botón. */
export function alternarDetalle(btn, abrir = null) {
  const panel = btn.closest('.sol-card')?.querySelector('.sol-expand');
  if (!panel) return;
  const abrirlo = abrir ?? panel.hidden;
  panel.hidden = !abrirlo;
  btn.textContent = abrirlo ? TXT_OCULTAR : TXT_VER;
}

/** Engancha los botones "Ver detalle" dentro de root. */
export function wireFilas(root) {
  root.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', () => alternarDetalle(btn)));
}
