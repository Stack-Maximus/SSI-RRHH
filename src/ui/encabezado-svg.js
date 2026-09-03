/**
 * Réplica en pantalla (SVG) del encabezado corporativo "Sistema de Gestión
 * Integrado" (SGI) -- construido a partir del HTML/SVG de referencia que entregó
 * Metalium (fuente de verdad geométrica): mismo viewBox (1400 x 173), mismas
 * coordenadas, mismos colores y mismo font (Poppins) que ese archivo, solo
 * parametrizando el texto dinámico (código, fecha, revisión, título).
 *
 * Estructura (4 filas, no 5 -- "SISTEMA DE GESTIÓN INTEGRADO" y "CÓDIGO"
 * comparten la misma fila superior, uno al lado del otro):
 *   Fila 1 (y 0..32,   azul):  SISTEMA DE GESTIÓN INTEGRADO | CÓDIGO | valor
 *   Fila 2 (y 32..78,  blanca): FECHA | valor
 *   Fila 3 (y 78..125, blanca): REVISIÓN | valor
 *   Fila 4 (y 125..173,azul):  RRH | METALIUM
 * A la izquierda, en toda la altura: el logo, y a su derecha el nombre del
 * documento (centrado en el alto de las filas 2+3+4, no en el alto total).
 *
 * Los tres cortes diagonales (logo|título, título|código, etiqueta|valor)
 * comparten la misma pendiente constante -- ver `PENDIENTE`.
 *
 * Ver supabase/functions/_shared/pdf-encabezado.ts, que dibuja lo mismo para
 * el PDF descargable con esta misma geometría (expresada en puntos PDF).
 */

const ANCHO = 1400;
const HH = 173;
const PENDIENTE = 45 / 173; // dx/dy de los tres cortes diagonales (constante medida en la referencia)
const xAt = (topFrac, y) => topFrac * ANCHO - PENDIENTE * y;

const FRAC_LOGO = 365 / 1400; // borde logo | título (y borde izq. de la fila "sistema+código")
const FRAC_C2 = 941 / 1400; // borde título | cuadro código/fecha/revisión
const FRAC_DIV = 1202 / 1400; // divisoria etiqueta | valor dentro del cuadro
const xLogo = (y) => xAt(FRAC_LOGO, y);
const xC2 = (y) => xAt(FRAC_C2, y);
const xDiv = (y) => xAt(FRAC_DIV, y);

const AZUL = '#1B9BD8';
const BORDE = '#6B7590'; // cortes diagonales principales
const BORDE_ACC = '#5CB2E0'; // acento sutil de esos mismos cortes, dentro de las franjas azules
const BORDE_SEP = '#8791AA'; // separador horizontal fecha | revisión
const BORDE_EXT = '#1B2340'; // borde exterior del encabezado
const GRIS = '#3D4258'; // etiquetas FECHA/REVISIÓN (sobre blanco)
const VAL = '#565A73'; // valores FECHA/REVISIÓN (sobre blanco)
const NEGRO = '#000000';
const BLANCO = '#ffffff';

// Filas: y0/y1 exactos (medidos en la referencia), no fracciones.
const FILAS = [
  { key: 'sistema_codigo', y0: 0, y1: 32, bg: AZUL, xIzq: xLogo },
  { key: 'fecha', y0: 32, y1: 78, bg: null, xIzq: xC2 },
  { key: 'revision', y0: 78, y1: 125, bg: null, xIzq: xC2 },
  { key: 'rrh_metalium', y0: 125, y1: 173, bg: AZUL, xIzq: xC2 },
];
const [F_SC, F_FEC, F_REV, F_RM] = FILAS;
const yc = (f) => (f.y0 + f.y1) / 2;
const n2 = (v) => v.toFixed(2);

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let uidSeq = 0;

/**
 * Devuelve el markup SVG (string) del encabezado, listo para insertar con
 * innerHTML. Después hay que llamar a `ajustarTextosEncabezado(svgEl)` una
 * vez insertado en el DOM, para que los textos largos (título, código) se
 * reduzcan de tamaño y no se salgan de su celda.
 */
export function encabezadoSvg({ codigo, fecha, revision = '00', titulo, logoSrc = '/Metalium_Logo_Header.png' }) {
  // Logo: centrado en el alto completo del encabezado (igual que la referencia).
  const logoX = 48;
  const logoW = 225;
  const logoAspecto = 110 / 527; // alto/ancho del PNG que usamos (recorte propio)
  const logoH = logoW * logoAspecto;
  const logoY = HH / 2 - logoH / 2;

  // Título: centrado en el alto de las filas 2+3+4 (no en el alto total),
  // arrancando justo después del corte logo|título.
  const midYTitulo = (F_FEC.y0 + HH) / 2;
  const tituloX = xLogo(midYTitulo) + 40;
  const tituloMaxW = Math.max(xC2(midYTitulo) - tituloX - 10, 60);

  const texto = (contenido, { x, y, size, italic = true, bold = false, color = NEGRO, anchor = 'middle', letterSpacing, maxw }) => {
    const id = `eh-t${uidSeq++}`;
    return `<text id="${id}" ${maxw != null ? `data-maxw="${n2(maxw)}"` : ''} x="${n2(x)}" y="${n2(y)}" font-size="${size}" ${letterSpacing ? `letter-spacing="${letterSpacing}"` : ''} font-style="${italic ? 'italic' : 'normal'}" font-weight="${bold ? '700' : '400'}" fill="${color}" text-anchor="${anchor}" dominant-baseline="middle">${esc(contenido)}</text>`;
  };
  const centrado = (contenido, xa, xb, yC, size, opts) =>
    texto(contenido, { x: (xa + xb) / 2, y: yC, size, maxw: xb - xa - 8, ...opts });

  const rowBg = (f) =>
    f.bg
      ? `<polygon fill="${f.bg}" points="${n2(f.xIzq(f.y0))},${n2(f.y0)} ${ANCHO},${n2(f.y0)} ${ANCHO},${n2(f.y1)} ${n2(f.xIzq(f.y1))},${n2(f.y1)}"/>`
      : '';

  // Acento sutil (color más claro) de los cortes diagonales, solo dentro de
  // las franjas azules (donde el corte oscuro principal se ve menos nítido
  // sobre el color saturado) -- igual que en la referencia.
  const accentLine = (xFn, y0, y1) => `<line x1="${n2(xFn(y0))}" y1="${n2(y0)}" x2="${n2(xFn(y1))}" y2="${n2(y1)}" stroke="${BORDE_ACC}" stroke-width="1"/>`;

  const textos = [
    centrado('SISTEMA DE GESTIÓN INTEGRADO', xLogo(yc(F_SC)), xC2(yc(F_SC)), yc(F_SC), 15, { bold: true, color: BLANCO, letterSpacing: 1 }),
    centrado('CÓDIGO', xC2(yc(F_SC)), xDiv(yc(F_SC)), yc(F_SC), 15, { bold: true, color: BLANCO }),
    centrado(codigo || '—', xDiv(yc(F_SC)), ANCHO, yc(F_SC), 15, { bold: true, color: BLANCO }),
    centrado('FECHA', xC2(yc(F_FEC)), xDiv(yc(F_FEC)), yc(F_FEC), 14.5, { bold: true, color: GRIS }),
    centrado(fecha || '—', xDiv(yc(F_FEC)), ANCHO, yc(F_FEC), 16, { color: VAL }),
    centrado('REVISIÓN', xC2(yc(F_REV)), xDiv(yc(F_REV)), yc(F_REV), 14.5, { bold: true, color: GRIS }),
    centrado(revision, xDiv(yc(F_REV)), ANCHO, yc(F_REV), 16, { color: VAL }),
    centrado('RRH', xC2(yc(F_RM)), xDiv(yc(F_RM)), yc(F_RM), 15, { bold: true, color: BLANCO }),
    centrado('METALIUM', xDiv(yc(F_RM)), ANCHO, yc(F_RM), 15, { bold: true, color: BLANCO }),
  ].join('');

  const tituloTexto = texto(titulo, { x: tituloX, y: midYTitulo, size: 24, italic: false, bold: true, color: NEGRO, anchor: 'start', maxw: tituloMaxW });

  return `<svg class="eh-svg" viewBox="0 0 ${ANCHO} ${HH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Sistema de Gestión Integrado · Metalium">
    <rect x="0" y="0" width="${ANCHO}" height="${HH}" fill="${BLANCO}"/>
    ${FILAS.map(rowBg).join('')}
    ${accentLine(xC2, F_SC.y0, F_SC.y1)}
    ${accentLine(xDiv, F_SC.y0, F_SC.y1)}
    ${accentLine(xDiv, F_RM.y0, F_RM.y1)}
    <line x1="${n2(xC2(F_FEC.y1))}" y1="${n2(F_FEC.y1)}" x2="${ANCHO}" y2="${n2(F_FEC.y1)}" stroke="${BORDE_SEP}" stroke-width="1"/>
    <image href="${logoSrc}" x="${logoX}" y="${n2(logoY)}" width="${logoW}" height="${n2(logoH)}"/>
    ${tituloTexto}
    <line x1="${n2(xLogo(0))}" y1="0" x2="${n2(xLogo(HH))}" y2="${HH}" stroke="${BORDE}" stroke-width="1.3"/>
    <line x1="${n2(xC2(0))}" y1="0" x2="${n2(xC2(HH))}" y2="${HH}" stroke="${BORDE}" stroke-width="1.3"/>
    <line x1="${n2(xDiv(0))}" y1="0" x2="${n2(xDiv(HH))}" y2="${HH}" stroke="${BORDE}" stroke-width="1.3"/>
    ${textos}
    <rect x="0.75" y="0.75" width="${ANCHO - 1.5}" height="${HH - 1.5}" fill="none" stroke="${BORDE_EXT}" stroke-width="1.5"/>
  </svg>`;
}

/** Reduce el font-size de los textos marcados con data-maxw hasta que quepan
 * en su celda. Llamar una vez tras insertar el SVG en el DOM. */
export function ajustarTextosEncabezado(svgEl) {
  if (!svgEl) return;
  svgEl.querySelectorAll('text[data-maxw]').forEach((el) => {
    const maxW = parseFloat(el.dataset.maxw);
    let size = parseFloat(el.getAttribute('font-size'));
    if (!size || !maxW) return;
    try {
      let guard = 0;
      while (size > 8 && el.getComputedTextLength() > maxW && guard < 60) {
        size -= 0.5;
        el.setAttribute('font-size', size.toFixed(2));
        guard++;
      }
    } catch {
      /* getComputedTextLength puede fallar si el SVG aún no está en el layout */
    }
  });
}
