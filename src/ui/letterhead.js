/**
 * Encabezado corporativo Metalium — «Sistema de Gestión Interno».
 *
 * Es el mismo encabezado que ya usas en tus formularios, dibujado en un canvas
 * y devuelto como PNG para poder incrustarlo en la primera fila de cualquier
 * Excel exportado. (ExcelJS acepta png/jpeg/gif, no SVG: de ahí el canvas.)
 *
 * LAS COORDENADAS SON LAS TUYAS
 *
 * Están copiadas una a una del SVG que me pasaste — viewBox 0 0 1400 173 — así
 * que el resultado es el mismo dibujo, no una interpretación:
 *
 *   franja azul fila 1     polígono 365,0 · 1400,0 · 1400,32 · 357,32
 *   franja azul fila 4     polígono 908,125 · 1400,125 · 1400,173 · 896,173
 *   diagonales principales 365→320 · 941→896 · 1202→1157   (#6B7590, 1.3)
 *   diagonales suaves      941→933 · 1202→1194 · 1169→1157 (#5CB2E0, 1)
 *   separador horizontal   921,78 → 1400,78                (#8791AA, 1)
 *   borde exterior         #1B2340, 1.5
 *
 * Las cuatro filas del bloque de la derecha quedan así:
 *
 *   SISTEMA DE GESTIÓN INTERNO   │ CÓDIGO   │ valor      (azul, texto blanco)
 *                                │ FECHA    │ valor      (blanco)
 *                                │ REVISIÓN │ valor      (blanco)
 *                                │ RRH      │ METALIUM   (azul, texto blanco)
 *
 * SE DIBUJA A ESCALA 2×
 *
 * El canvas mide 2800 × 346 (el doble del viewBox) y todas las coordenadas se
 * multiplican por ESCALA. Un PNG a 1400 px de ancho se ve pixelado al imprimir
 * el Excel; al doble, no. Si algún día hace falta más nitidez, se sube ESCALA y
 * nada más.
 *
 * Para reutilizarlo en otro formulario no hay que tocar este archivo: se le
 * pasan `titulo`, `codigo`, `fecha`, `revision` y `area`.
 */

import logoUrl from "../assets/logo-metalium.png";

// Medidas del original, tal cual el viewBox.
const W = 1400;
const H = 173;
const ESCALA = 2;

const AZUL = "#1B9BD8";
const AZUL_SUAVE = "#5CB2E0";
const GRIS_DIV = "#6B7590";
const GRIS_DIV_H = "#8791AA";
const BORDE = "#1B2340";
const TXT_LBL = "#3D4258";
const TXT_VAL = "#565A73";

/**
 * El texto de la banda superior. Va aparte porque es lo único del encabezado
 * que no cambia entre formularios y conviene tenerlo en un solo lugar.
 *
 * OJO: en el SVG que me pasaste dice «SISTEMA DE GESTIÓN iNTERNO», con la i
 * minúscula. Lo escribí en mayúscula porque parece un desliz de tipeo y va
 * impreso en todos los documentos; si era a propósito, cambia esta línea.
 */
const BANDA_SUPERIOR = "SISTEMA DE GESTIÓN INTERNO";

const POS = {
  titulo: { x: 378, y: 104, size: 24, weight: 700, italic: false, color: "#000000", align: "left", maxWidth: 500 },

  sistema: { x: 649, y: 17, size: 15, weight: 700, italic: true, color: "#ffffff", align: "center", spacing: 1, maxWidth: 560 },

  codigoLabel: { x: 1067, y: 17, size: 15, weight: 700, italic: true, color: "#ffffff", align: "center", maxWidth: 230 },
  codigoValor: { x: 1299, y: 17, size: 15, weight: 700, italic: true, color: "#ffffff", align: "center", maxWidth: 185 },

  fechaLabel: { x: 1057, y: 55, size: 14.5, weight: 700, italic: true, color: TXT_LBL, align: "center", maxWidth: 230 },
  fechaValor: { x: 1294, y: 56, size: 16, weight: 400, italic: true, color: TXT_VAL, align: "center", maxWidth: 185 },

  revisionLabel: { x: 1045, y: 101, size: 14.5, weight: 700, italic: true, color: TXT_LBL, align: "center", maxWidth: 230 },
  revisionValor: { x: 1288, y: 102, size: 16, weight: 400, italic: true, color: TXT_VAL, align: "center", maxWidth: 185 },

  areaLabel: { x: 1032, y: 149, size: 15, weight: 700, italic: true, color: "#ffffff", align: "center", maxWidth: 230 },
  empresaValor: { x: 1281, y: 149, size: 15, weight: 700, italic: true, color: "#ffffff", align: "center", maxWidth: 185 },
};

// Caja del logo en el original. El logo real tiene proporción 4,79 y la caja
// del SVG 4,09: se ajusta a lo alto y se conserva la proporción, porque un
// logo estirado es lo primero que se nota en un documento corporativo.
const LOGO = { x: 48, y: 59, h: 55 };

let logoCache = null;
function cargarLogo() {
  if (logoCache) return Promise.resolve(logoCache);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      logoCache = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = logoUrl;
  });
}

const e = (v) => v * ESCALA;

function poligono(ctx, puntos, color) {
  ctx.beginPath();
  puntos.forEach(([x, y], i) => (i ? ctx.lineTo(e(x), e(y)) : ctx.moveTo(e(x), e(y))));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function linea(ctx, x1, y1, x2, y2, color, grosor) {
  ctx.beginPath();
  ctx.moveTo(e(x1), e(y1));
  ctx.lineTo(e(x2), e(y2));
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor * ESCALA;
  ctx.stroke();
}

function texto(ctx, campo, valor) {
  if (valor == null || valor === "") return;
  const { x, y, size, weight, italic, color, align, spacing, maxWidth } = campo;
  ctx.save();
  ctx.font = `${italic ? "italic " : ""}${weight} ${e(size)}px Poppins, Arial, Helvetica, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  // El SVG usa dominant-baseline="middle" en todos los textos.
  ctx.textBaseline = "middle";
  // letterSpacing existe en Chrome/Edge modernos; donde no, se dibuja sin él en
  // lugar de fallar. Sólo afecta a la banda superior.
  if (spacing && "letterSpacing" in ctx) ctx.letterSpacing = `${e(spacing)}px`;
  if (maxWidth) ctx.fillText(String(valor), e(x), e(y), e(maxWidth));
  else ctx.fillText(String(valor), e(x), e(y));
  ctx.restore();
}

/**
 * @param {object} d
 * @param {string} d.titulo    Nombre del documento, en el hueco central.
 * @param {string} d.codigo    Código del formulario en el control documental.
 * @param {string} d.fecha     Fecha ya formateada (dd/mm/aaaa).
 * @param {string} d.revision  Número de revisión. Por defecto "00".
 * @param {string} d.area      Área responsable, en la franja azul de abajo.
 * @returns {Promise<Blob>} PNG de 2800 × 346.
 */
export async function generarEncabezadoCorporativo(d) {
  if (document.fonts?.ready) await document.fonts.ready;

  const logo = await cargarLogo();

  const canvas = document.createElement("canvas");
  canvas.width = e(W);
  canvas.height = e(H);
  const ctx = canvas.getContext("2d");

  // Fondo blanco explícito: el canvas nace transparente, y un PNG con
  // transparencia dentro de un Excel deja ver la cuadrícula por debajo.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, e(W), e(H));

  // Franjas azules
  poligono(ctx, [[365, 0], [1400, 0], [1400, 32], [357, 32]], AZUL);
  poligono(ctx, [[908, 125], [1400, 125], [1400, 173], [896, 173]], AZUL);

  // Divisores suaves dentro de las franjas azules
  linea(ctx, 941, 0, 933, 32, AZUL_SUAVE, 1);
  linea(ctx, 1202, 0, 1194, 32, AZUL_SUAVE, 1);
  linea(ctx, 1169, 125, 1157, 173, AZUL_SUAVE, 1);

  // Separador horizontal entre FECHA y REVISIÓN
  linea(ctx, 921, 78, 1400, 78, GRIS_DIV_H, 1);

  // Las tres diagonales principales
  linea(ctx, 365, 0, 320, 173, GRIS_DIV, 1.3);
  linea(ctx, 941, 0, 896, 173, GRIS_DIV, 1.3);
  linea(ctx, 1202, 0, 1157, 173, GRIS_DIV, 1.3);

  // Logo, ajustado a lo alto conservando la proporción real
  const logoAncho = (LOGO.h * logo.naturalWidth) / logo.naturalHeight;
  ctx.drawImage(logo, e(LOGO.x), e(LOGO.y), e(logoAncho), e(LOGO.h));

  // Textos
  texto(ctx, POS.titulo, d.titulo);
  texto(ctx, POS.sistema, BANDA_SUPERIOR);
  texto(ctx, POS.codigoLabel, "CÓDIGO");
  texto(ctx, POS.codigoValor, d.codigo);
  texto(ctx, POS.fechaLabel, "FECHA");
  texto(ctx, POS.fechaValor, d.fecha);
  texto(ctx, POS.revisionLabel, "REVISIÓN");
  texto(ctx, POS.revisionValor, d.revision ?? "00");
  texto(ctx, POS.areaLabel, d.area ?? "RRH");
  texto(ctx, POS.empresaValor, "METALIUM");

  // Borde exterior, al final para que quede por encima de las franjas
  ctx.strokeStyle = BORDE;
  ctx.lineWidth = 1.5 * ESCALA;
  ctx.strokeRect(e(0.75), e(0.75), e(W - 1.5), e(H - 1.5));

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export const LETTERHEAD_ASPECT = W / H;
