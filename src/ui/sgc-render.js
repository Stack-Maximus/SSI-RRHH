/**
 * Pintores del navegador para el diseño "Concept 3" de los documentos
 * exportables (la geometría vive en supabase/functions/_shared/sgc-layout.js,
 * el mismo archivo que usa el PDF de las Edge Functions):
 *
 *  - svgDePagina(): una página como <svg> (vista "Comprobante" en pantalla).
 *  - pngDeRegion(): un recorte rasterizado a PNG (encabezado, barras de
 *    sección y fichas que van como imagen en los Excel).
 *  - medidor(): mide texto con las mismas fuentes que el PDF (Montserrat y
 *    Fira Sans, servidas desde /fonts y declaradas en styles/sgc-doc.css).
 */

import { ANCHO, ALTO, FUENTES, ICONOS } from '../../supabase/functions/_shared/sgc-layout.js';

const LOGO_SRC = '/Metalium_Logo_Header.png';

let fuentesListas = null;
/** Espera a que las 6 tipografías estén cargadas (necesario para el canvas). */
export function asegurarFuentes() {
  if (!fuentesListas) {
    fuentesListas = Promise.all(Object.values(FUENTES).map((f) =>
      document.fonts.load(`${f.weight} 32px "${f.family}"`, 'ÁÉÍÓÚáéíóúÑñ°')
    )).catch((e) => { console.warn('[sgc-render] fuentes', e); });
  }
  return fuentesListas;
}

const cssFuente = (f, s) => `${FUENTES[f].weight} ${s}px "${FUENTES[f].family}", sans-serif`;

let ctxMedida = null;
/** medir(texto, claveFuente, tamaño) -> ancho en u (mismas unidades que el layout). */
export function medidor() {
  if (!ctxMedida) ctxMedida = document.createElement('canvas').getContext('2d');
  const cache = new Map();
  return (txt, f, s) => {
    const k = f + '|' + txt;
    let w = cache.get(k);
    if (w == null) {
      ctxMedida.font = cssFuente(f, 100);
      w = ctxMedida.measureText(String(txt ?? '')).width / 100;
      cache.set(k, w);
    }
    return w * s;
  };
}

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Página completa como SVG (viewBox en u; se escala al ancho del contenedor). */
export function svgDePagina(prims, { alto = ALTO, clase = 'sgc-pagina' } = {}) {
  const defs = [];
  const cuerpo = [];
  let g = 0;
  for (const p of prims) {
    if (p.t === 'path') {
      let fill = 'none';
      if (p.fill && typeof p.fill === 'object') {
        const id = `sgcg${++g}_${Math.random().toString(36).slice(2, 7)}`;
        const [x1, y1, x2, y2] = p.fill.lin;
        defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${
          p.fill.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`);
        fill = `url(#${id})`;
      } else if (p.fill) fill = p.fill;
      const op = p.op != null && p.op < 1 ? ` opacity="${p.op}"` : '';
      const st = p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 1}" stroke-linecap="round"` : '';
      cuerpo.push(`<path d="${p.d}" fill="${fill}"${st}${op}/>`);
    } else if (p.t === 'text') {
      const f = FUENTES[p.f];
      const anchor = p.a === 'middle' ? 'middle' : p.a === 'end' ? 'end' : 'start';
      const op = p.op != null && p.op < 1 ? ` opacity="${p.op}"` : '';
      cuerpo.push(`<text xml:space="preserve" style="white-space:pre" x="${p.x}" y="${p.y}" font-family="${f.family}" font-weight="${f.weight}" font-size="${p.s}" fill="${p.c}" text-anchor="${anchor}"${op}>${esc(p.txt)}</text>`);
    } else if (p.t === 'icon') {
      const d = ICONOS[p.name] || ICONOS['file-text'];
      cuerpo.push(`<path d="${d}" transform="translate(${p.x} ${p.y}) scale(${p.size / 24})" fill="none" stroke="${p.c}" stroke-width="${p.sw ?? 2}" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else if (p.t === 'img' && p.key === 'logo') {
      cuerpo.push(`<image href="${LOGO_SRC}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="none"/>`);
    }
  }
  return `<svg class="${clase}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${alto}" role="img"><defs>${defs.join('')}</defs>${cuerpo.join('')}</svg>`;
}

let logoImg = null;
function cargarLogo() {
  if (!logoImg) {
    logoImg = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = LOGO_SRC;
    });
  }
  return logoImg;
}

/** Pinta primitivas en un contexto 2D ya escalado a u. */
async function pintarCanvas(ctx, prims) {
  const logo = await cargarLogo();
  for (const p of prims) {
    ctx.save();
    if (p.op != null && p.op < 1) ctx.globalAlpha = p.op;
    if (p.t === 'path') {
      const path = new Path2D(p.d);
      if (p.fill && typeof p.fill === 'object') {
        const [x1, y1, x2, y2] = p.fill.lin;
        const gr = ctx.createLinearGradient(x1, y1, x2, y2);
        p.fill.stops.forEach(([o, c]) => gr.addColorStop(o, c));
        ctx.fillStyle = gr; ctx.fill(path);
      } else if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(path); }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw ?? 1; ctx.lineCap = 'round'; ctx.stroke(path); }
    } else if (p.t === 'text') {
      ctx.font = cssFuente(p.f, p.s);
      ctx.fillStyle = p.c;
      ctx.textAlign = p.a === 'middle' ? 'center' : p.a === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(String(p.txt ?? ''), p.x, p.y);
    } else if (p.t === 'icon') {
      ctx.translate(p.x, p.y);
      ctx.scale(p.size / 24, p.size / 24);
      ctx.strokeStyle = p.c; ctx.lineWidth = p.sw ?? 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(ICONOS[p.name] || ICONOS['file-text']));
    } else if (p.t === 'img' && p.key === 'logo' && logo) {
      ctx.drawImage(logo, p.x, p.y, p.w, p.h);
    }
    ctx.restore();
  }
}

/**
 * Rasteriza la región [x0,y0]-[x1,y1] (en u) de un conjunto de primitivas.
 * Devuelve { dataUrl, ancho, alto } en píxeles "1x" (ancho = (x1-x0)*escala);
 * la imagen se genera a 2x para que se vea nítida en Excel.
 */
export async function pngDeRegion(prims, { x0, y0, x1, y1, escala, fondo = '#F7F9FB' }) {
  await asegurarFuentes();
  const ancho = Math.round((x1 - x0) * escala), alto = Math.round((y1 - y0) * escala);
  const sobre = 2;
  const canvas = document.createElement('canvas');
  canvas.width = ancho * sobre; canvas.height = alto * sobre;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fondo; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(escala * sobre, escala * sobre);
  ctx.translate(-x0, -y0);
  await pintarCanvas(ctx, prims);
  return { dataUrl: canvas.toDataURL('image/png'), ancho, alto };
}

/** Un ícono suelto como PNG (para los títulos de columna del Excel). */
export async function pngDeIcono(nombre, { px = 18, color = '#FFFFFF', sw = 1.9 } = {}) {
  const sobre = 3;
  const canvas = document.createElement('canvas');
  canvas.width = px * sobre; canvas.height = px * sobre;
  const ctx = canvas.getContext('2d');
  ctx.scale(px * sobre / 24, px * sobre / 24);
  ctx.strokeStyle = color; ctx.lineWidth = sw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(ICONOS[nombre] || ICONOS['file-text']));
  return canvas.toDataURL('image/png');
}
