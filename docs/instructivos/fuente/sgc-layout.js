// =====================================================================
// sgc-layout.js · Diseño "Concept 3" de los documentos exportables
// (Comprobante y Maestro de solicitudes en PDF, y las piezas gráficas de
// los Excel de Solicitudes y Trabajadores).
//
// UNA sola fuente de verdad para la geometría, los colores y la
// tipografía del diseño, usada por los tres "pintores":
//   - supabase/functions/_shared/sgc-pdf.ts  (pdf-lib, Edge Functions)
//   - src/ui/sgc-render.js                   (SVG en pantalla y canvas
//                                             para las imágenes del Excel)
// El frontend importa este mismo archivo con una ruta relativa
// (../../supabase/functions/_shared/sgc-layout.js) -- no hay copia
// "espejo" que se pueda desincronizar.
//
// Unidades: todo se mide en "u" = 1 píxel del concepto de referencia
// (Concept 3_CORREGIDO.pdf, que mide 1416 u de ancho). Una hoja A4
// vertical son 1416 u x 2002,6 u; el pintor de PDF escala por
// 595,28 / 1416 pt por u. Las medidas de abajo se tomaron del concepto
// (bordes, colores y alturas de mayúscula medidos sobre la imagen a
// 200 ppp), no son estimaciones a ojo.
//
// Primitivas que devuelve este módulo (coordenadas absolutas en u, eje Y
// hacia abajo, igual que SVG):
//   { t:'path', d, fill, stroke, sw, op }  -- d usa solo M/L/C/Z absolutos;
//        fill puede ser un color '#rrggbb' o un degradado lineal
//        { lin:[x1,y1,x2,y2], stops:[[0,'#..'],[1,'#..']] }
//   { t:'text', x, y, txt, f, s, c, a, op } -- y = línea base; a = 'start'|
//        'middle'|'end'; f = clave de FUENTES
//   { t:'icon', name, x, y, size, c, sw }   -- ícono Lucide (caja de 24)
//   { t:'img', key, x, y, w, h }            -- 'logo'
// =====================================================================

export const ANCHO = 1416;
export const ALTO = 1416 * 841.89 / 595.28; // A4 vertical (≈ 2002,6 u)

export const PAL = {
  fondo: '#F7F9FB',
  blanco: '#FFFFFF',
  borde: '#E2EAF2',
  sombra: '#0B2A5B',
  navy: '#021659',          // texto fuerte (valores, datos en negrita)
  texto: '#3A5A85',         // texto regular de la tabla
  azulEtiqueta: '#0A64B4',  // etiquetas de las fichas
  azulIcono: '#0050A2',
  iconoCard: '#0A2466',
  etiquetaCard: '#1B4C86',
  valorCardSuave: '#3A5A80',
  cian: '#08B7F7',
  amarillo: '#FFC000',
  amarilloBarra: '#FFC300',
  ficha: '#F1F6FA',
  separador: '#D4DFE9',
  divisor: '#E6EEF5',
  filaAlterna: '#F0F5F9',
  lineaTabla: '#E3EBF2',
  pildora: '#D9F0FA',
  pildoraTexto: '#05205F',
  pieAcento: '#00BDF8',
  pieLinea: '#A9C3DB',
  pieFuerte: '#00417D',
  pieTexto: '#557AA2',
  pieSep: '#9AB0C8',
};

export const FUENTES = {
  mBlack: { family: 'SGC Montserrat', weight: 900 },
  mBold:  { family: 'SGC Montserrat', weight: 700 },
  f400:   { family: 'SGC Fira Sans', weight: 400 },
  f500:   { family: 'SGC Fira Sans', weight: 500 },
  f600:   { family: 'SGC Fira Sans', weight: 600 },
  f700:   { family: 'SGC Fira Sans', weight: 700 },
};

// ---------------------------------------------------------------------
// Utilidades geométricas (solo M/L/C/Z absolutos, para que el pintor de
// PDF pueda recortar degradados sin un parser de SVG completo).
// ---------------------------------------------------------------------
const K = 0.5523; // aproximación de un cuarto de círculo con una Bézier
const n2 = (v) => Math.round(v * 100) / 100;

/** Rectángulo con esquinas redondeadas; r = número o [sup-izq, sup-der, inf-der, inf-izq]. */
export function rectRed(x, y, w, h, r = 0) {
  const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
  const p = [];
  p.push(`M${n2(x + a)} ${n2(y)}`);
  p.push(`L${n2(x + w - b)} ${n2(y)}`);
  if (b) p.push(`C${n2(x + w - b + b * K)} ${n2(y)} ${n2(x + w)} ${n2(y + b - b * K)} ${n2(x + w)} ${n2(y + b)}`);
  p.push(`L${n2(x + w)} ${n2(y + h - c)}`);
  if (c) p.push(`C${n2(x + w)} ${n2(y + h - c + c * K)} ${n2(x + w - c + c * K)} ${n2(y + h)} ${n2(x + w - c)} ${n2(y + h)}`);
  p.push(`L${n2(x + d)} ${n2(y + h)}`);
  if (d) p.push(`C${n2(x + d - d * K)} ${n2(y + h)} ${n2(x)} ${n2(y + h - d + d * K)} ${n2(x)} ${n2(y + h - d)}`);
  p.push(`L${n2(x)} ${n2(y + a)}`);
  if (a) p.push(`C${n2(x)} ${n2(y + a - a * K)} ${n2(x + a - a * K)} ${n2(y)} ${n2(x + a)} ${n2(y)}`);
  p.push('Z');
  return p.join(' ');
}

/** Polígono cerrado; radios opcionales por vértice (esquinas redondeadas). */
export function poligono(pts, radios = null) {
  if (!radios) return 'M' + pts.map(([x, y]) => `${n2(x)} ${n2(y)}`).join(' L') + ' Z';
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const r = radios[i] || 0;
    const [px, py] = pts[(i - 1 + n) % n];
    const [nx, ny] = pts[(i + 1) % n];
    if (!r) { out.push(`${out.length ? 'L' : 'M'}${n2(x)} ${n2(y)}`); continue; }
    const l1 = Math.hypot(px - x, py - y), l2 = Math.hypot(nx - x, ny - y);
    const ax = x + (px - x) / l1 * r, ay = y + (py - y) / l1 * r;
    const bx = x + (nx - x) / l2 * r, by = y + (ny - y) / l2 * r;
    out.push(`${out.length ? 'L' : 'M'}${n2(ax)} ${n2(ay)}`);
    out.push(`C${n2(ax + (x - ax) * K)} ${n2(ay + (y - ay) * K)} ${n2(bx + (x - bx) * K)} ${n2(by + (y - by) * K)} ${n2(bx)} ${n2(by)}`);
  }
  out.push('Z');
  return out.join(' ');
}

const linea = (x1, y1, x2, y2) => `M${n2(x1)} ${n2(y1)} L${n2(x2)} ${n2(y2)}`;

function sombra(prims, x, y, w, h, r) {
  // Sombra suave del concepto: dos capas muy transparentes, corridas hacia
  // abajo. Mismo resultado en PDF, SVG y canvas (sin filtros de desenfoque).
  prims.push({ t: 'path', d: rectRed(x - 1.5, y + 1, w + 3, h + 4, r + 1.5), fill: PAL.sombra, op: 0.035 });
  prims.push({ t: 'path', d: rectRed(x - 0.5, y + 0.5, w + 1, h + 2, r + 0.5), fill: PAL.sombra, op: 0.04 });
}

// ---------------------------------------------------------------------
// Texto: ajuste en líneas con la función de medición del pintor
// (medir(texto, claveFuente, tamaño) -> ancho en u).
// ---------------------------------------------------------------------
export function partirLineas(texto, medir, f, s, anchoMax) {
  const lineas = [];
  for (const parrafo of String(texto ?? '').split(/\r?\n/)) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) { lineas.push(''); continue; }
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? actual + ' ' + p : p;
      if (medir(prueba, f, s) <= anchoMax || !actual) {
        actual = prueba;
        // palabra sola más larga que el ancho: se corta a la fuerza
        while (medir(actual, f, s) > anchoMax && actual.length > 1) {
          let corte = actual.length - 1;
          while (corte > 1 && medir(actual.slice(0, corte), f, s) > anchoMax) corte--;
          lineas.push(actual.slice(0, corte));
          actual = actual.slice(corte);
        }
      } else {
        lineas.push(actual);
        actual = p;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

/** Recorta con "…" para que quepa en una línea. */
export function recortar(texto, medir, f, s, anchoMax) {
  let t = String(texto ?? '');
  if (medir(t, f, s) <= anchoMax) return t;
  while (t.length > 1 && medir(t + '…', f, s) > anchoMax) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

// ---------------------------------------------------------------------
// Fondo de página
// ---------------------------------------------------------------------
export function fondoPagina(alto = ALTO) {
  return [
    { t: 'path', d: rectRed(0, 0, ANCHO, alto, 0), fill: PAL.fondo },
    // brillos diagonales tenues de la esquina superior derecha
    { t: 'path', d: poligono([[1352, 0], [1390, 0], [1416, 36], [1416, 88]]), fill: PAL.blanco, op: 0.55 },
    { t: 'path', d: poligono([[1398, 0], [1416, 0], [1416, 22]]), fill: PAL.blanco, op: 0.7 },
  ];
}

// ---------------------------------------------------------------------
// Encabezado (logo | panel azul con sistema + título + sigla | Código,
// Fecha, Revisión). Ocupa y = 45 … 305 (alto 260 u) desde `y0`.
// ---------------------------------------------------------------------
export const SISTEMA_NOMBRE = 'SISTEMA DE GESTIÓN DE CALIDAD';
export const SISTEMA_SIGLA = 'SGC';

export function encabezado(o, medir, y0 = 45) {
  const p = [];
  const dy = y0 - 45;
  const Y = (v) => v + dy;
  // Bordes inclinados del panel azul (medidos): x = x0 - (y - 45) * m
  const m = 0.2232;
  const xNavy = (y) => 984.9 - (y - 45) * m;

  // tarjeta del logo (su borde derecho queda bajo el panel)
  sombra(p, 33, Y(45), 400, 255.5, 9);
  p.push({ t: 'path', d: rectRed(33, Y(45), 400, 255.5, 9), fill: PAL.blanco, stroke: PAL.borde, sw: 1.2 });
  // logo + marca registrada
  p.push({ t: 'img', key: 'logo', x: 59, y: Y(140), w: 293, h: 61.2 });
  p.push({ t: 'text', x: 353, y: Y(153), txt: '®', f: 'f500', s: 23, c: '#0E1F5B' });

  // tarjeta Código / Fecha / Revisión
  sombra(p, 948, Y(67), 436.5, 233.5, 10);
  p.push({ t: 'path', d: rectRed(948, Y(67), 436.5, 233.5, 10), fill: PAL.blanco, stroke: PAL.borde, sw: 1.2 });

  // franja cian (va DEBAJO del panel: solo asoma su borde derecho)
  const c0 = xNavy(45), c1 = xNavy(305);
  p.push({ t: 'path', d: poligono([[c0 - 30, Y(45)], [c0 + 21.8, Y(45)], [c1 + 22.6, Y(305)], [c1 - 30, Y(305)]], [0, 9, 9, 0]),
    fill: { lin: [c0, Y(45), c1 + 20, Y(305)], stops: [[0, '#05B4F6'], [1, '#0ABCFA']] } });

  // panel azul: degradado diagonal (más oscuro abajo a la izquierda,
  // más claro abajo a la derecha, como en el concepto)
  const panel = [[392.5, Y(45)], [xNavy(45), Y(45)], [xNavy(305), Y(305)], [355.7, Y(305)], [392.5, Y(238)]];
  p.push({ t: 'path', d: poligono(panel, [0, 2, 6, 0, 0]),
    fill: { lin: [392, Y(45), 985, Y(305)], stops: [[0, '#00255F'], [0.42, '#003A83'], [0.78, '#00559F'], [1, '#006EBA']] } });
  // facetas del panel: una más clara al centro, una más oscura abajo a la izquierda
  p.push({ t: 'path', d: poligono([[520, Y(150)], [xNavy(150) - 4, Y(150)], [xNavy(245) - 4, Y(245)], [470, Y(245)]]), fill: PAL.blanco, op: 0.035 });
  p.push({ t: 'path', d: poligono([[392.5, Y(238)], [610, Y(238)], [690, Y(305)], [355.7, Y(305)]]), fill: '#00133F', op: 0.28 });
  p.push({ t: 'path', d: poligono([[600, Y(52)], [xNavy(52) - 6, Y(52)], [xNavy(118) - 6, Y(118)], [650, Y(118)]]), fill: PAL.blanco, op: 0.025 });

  // textos del panel
  const xTxt = 444;
  p.push({ t: 'text', x: xTxt, y: Y(101.1), txt: o.sistema || SISTEMA_NOMBRE, f: 'mBlack', s: 21.8, c: PAL.blanco });
  const anchoTitulo = xNavy(166) - 22 - xTxt;
  let s = 31.9, lineas;
  for (; s >= 22; s -= 0.5) {
    lineas = partirLineas(String(o.titulo || '').toUpperCase(), medir, 'mBold', s, anchoTitulo);
    if (lineas.length <= 2 && lineas.every((l) => medir(l, 'mBold', s) <= anchoTitulo)) break;
  }
  if (lineas.length > 2) lineas = [lineas[0], recortar(lineas.slice(1).join(' '), medir, 'mBold', s, anchoTitulo)];
  const bases = lineas.length === 1 ? [187] : [166.4, 166.4 + 42 * (s / 31.9)];
  lineas.forEach((l, i) => {
    p.push({ t: 'text', x: xTxt + 1.2, y: Y(bases[i] + 1.6), txt: l, f: 'mBold', s, c: '#000F33', op: 0.32 });
    p.push({ t: 'text', x: xTxt, y: Y(bases[i]), txt: l, f: 'mBold', s, c: PAL.blanco });
  });
  p.push({ t: 'path', d: rectRed(xTxt, Y(271), 76, 7, 1.5), fill: PAL.amarilloBarra });
  p.push({ t: 'text', x: 556, y: Y(282.3), txt: o.sigla || SISTEMA_SIGLA, f: 'mBlack', s: 21.1, c: PAL.blanco });

  // filas de la tarjeta Código / Fecha / Revisión
  const filas = [
    { icono: 'file-text', et: 'CÓDIGO', val: o.codigo, fuerte: true },
    { icono: 'calendar-days', et: 'FECHA', val: o.fecha },
    { icono: 'refresh-cw', et: 'REVISIÓN', val: o.revision ?? '00' },
  ];
  const centros = [107, 183.5, 260];
  const largo = filas.some((fi) => medir(String(fi.val ?? ''), 'f700', 24) > 1370 - 1221);
  const xSep = largo ? 1187 : 1197, xVal = largo ? 1204 : 1221;
  [146.2, 221.6].forEach((yy) => p.push({ t: 'path', d: linea(1016, Y(yy), 1368, Y(yy)), stroke: '#DCE6EF', sw: 1.5 }));
  filas.forEach((fi, i) => {
    const yc = Y(centros[i]);
    p.push({ t: 'icon', name: fi.icono, x: 1035, y: yc - 21, size: 42, c: PAL.iconoCard, sw: 1.9 });
    p.push({ t: 'text', x: 1100.5, y: yc + 6.4, txt: fi.et, f: 'f500', s: 18.6, c: PAL.etiquetaCard });
    p.push({ t: 'path', d: linea(xSep, yc - 22, xSep, yc + 22), stroke: '#D5DFE9', sw: 1.6 });
    let sv = 24;
    const val = String(fi.val ?? '—');
    while (sv > 16 && medir(val, 'f700', sv) > 1372 - xVal) sv -= 0.5;
    const v = recortar(val, medir, 'f700', sv, 1372 - xVal);
    p.push({ t: 'text', x: xVal, y: yc + sv * 0.34, txt: v, f: 'f700', s: sv, c: fi.fuerte ? PAL.navy : PAL.valorCardSuave });
  });
  return { prims: p, alto: 260 };
}

// ---------------------------------------------------------------------
// Barra de sección: pestaña amarilla con el número, banda azul con el
// título y banda celeste con franjas diagonales al final. Alto 59,5 u.
// ---------------------------------------------------------------------
export const ALTO_BARRA = 59.5;

export function barraSeccion(numero, titulo, y0, medir) {
  const p = [];
  const h = ALTO_BARRA;
  const mA = 0.576, mN = 0.717, mF = 0.58;
  const tituloTxt = String(titulo).toUpperCase();
  const sT = 24.3;
  const finTitulo = 152.5 + medir(tituloTxt, 'mBold', sT);
  const xe = Math.max(finTitulo + 122, 632.7);
  const yb = y0 + 16.3; // la banda celeste arranca más abajo que la azul

  // banda celeste: degradado + franjas + remate
  const fx = (x0, y) => x0 + (y - yb) * mF;
  const finBanda = 1172.4;
  p.push({ t: 'path', d: poligono([[xe - 30, yb], [finBanda, yb], [fx(finBanda, y0 + h), y0 + h], [xe - 30, y0 + h]]),
    fill: { lin: [xe, 0, finBanda, 0], stops: [[0, '#C8DBEC'], [1, '#DEE9F3']] } });
  [[1188.4, 18], [1218.4, 18.5], [1247.9, 19.5]].forEach(([x0, w]) => {
    p.push({ t: 'path', d: poligono([[x0, yb], [x0 + w, yb], [fx(x0 + w, y0 + h), y0 + h], [fx(x0, y0 + h), y0 + h]]), fill: '#E6EEF6' });
  });
  p.push({ t: 'path', d: poligono([[1278.4, yb], [1364, yb], [1383.5, y0 + h], [fx(1278.4, y0 + h), y0 + h]], [0, 4, 6, 0]), fill: '#EBF1F7' });

  // banda azul
  const xA0 = 94.9, xA1 = xA0 + h * mA;
  p.push({ t: 'path', d: poligono([[xA0 - 2, y0], [xe, y0], [xe + h * mN, y0 + h], [xA1 - 2, y0 + h]]),
    fill: { lin: [xA0, 0, xe + h * mN, 0], stops: [[0, '#001D56'], [0.62, '#00286A'], [0.9, '#003C84'], [1, '#00539F']] } });
  p.push({ t: 'path', d: linea(xe - 0.6, y0 + 0.5, xe + h * mN - 0.6, y0 + h - 0.5), stroke: '#3AA7DE', sw: 2.2 });

  // pestaña amarilla
  p.push({ t: 'path', d: poligono([[34.5, y0], [xA0, y0], [xA1, y0 + h], [34.5, y0 + h]], [4, 0, 0, 4]), fill: PAL.amarillo });
  p.push({ t: 'text', x: 67.5, y: y0 + 42.9, txt: String(numero), f: 'mBlack', s: 36, c: '#0B1F4F', a: 'middle' });

  // título
  p.push({ t: 'text', x: 152.5, y: y0 + 38.5, txt: tituloTxt, f: 'mBold', s: sT, c: PAL.blanco });
  return { prims: p, alto: h };
}

// ---------------------------------------------------------------------
// Tarjeta de fichas (sección "Identificación del registro" y similares):
// fichas en 2 columnas con ícono, separador, etiqueta y valor. Una ficha
// con { ancho: 'completo' } ocupa las dos columnas (textos largos).
// ---------------------------------------------------------------------
const FICHA = {
  x: [50.5, 723], w: 645, wFull: 1317.5, h: 88, gap: 15.6,
  iconCx: 47.5, iconSize: 44, sepX: 94, txtX: 113.5,
  etBase: 27.5, valBase: 62, sEt: 20.1, sVal: 25.2, lhVal: 30,
};

/** Arma las filas de fichas (sin dibujar) para saber su alto. */
export function medirFichas(campos, medir) {
  const filas = [];
  let i = 0;
  while (i < campos.length) {
    const c = campos[i];
    if (c.ancho === 'completo') { filas.push([c]); i++; continue; }
    const sig = campos[i + 1];
    if (sig && sig.ancho !== 'completo') { filas.push([c, sig]); i += 2; }
    else { filas.push([c]); i++; }
  }
  return filas.map((fila) => {
    const anchoTxt = (fila.length === 1 && fila[0].ancho === 'completo' ? FICHA.wFull : FICHA.w) - FICHA.txtX - 22;
    const lineas = fila.map((c) => partirLineas(c.valor ?? '—', medir, 'f700', FICHA.sVal, anchoTxt));
    const n = Math.max(...lineas.map((l) => l.length));
    return { fila, lineas, h: FICHA.h + (n - 1) * FICHA.lhVal };
  });
}

export function tarjetaFichas(filasMedidas, y0, desde = 0, hasta = filasMedidas.length) {
  const p = [];
  const filas = filasMedidas.slice(desde, hasta);
  const altoFichas = filas.reduce((a, f) => a + f.h, 0) + (filas.length - 1) * FICHA.gap;
  const h = 16.5 + altoFichas + 17.5;
  sombra(p, 33, y0, 1351.5, h, 10);
  p.push({ t: 'path', d: rectRed(33, y0, 1351.5, h, 10), fill: PAL.blanco, stroke: PAL.borde, sw: 1.3 });
  let y = y0 + 16.5;
  filas.forEach((fm, idx) => {
    const dos = fm.fila.length === 2;
    if (dos) {
      const yTop = idx === 0 ? y : y - FICHA.gap / 2, yBot = idx === filas.length - 1 ? y + fm.h : y + fm.h + FICHA.gap / 2;
      p.push({ t: 'path', d: linea(709, yTop, 709, yBot), stroke: PAL.divisor, sw: 1.5 });
    }
    fm.fila.forEach((c, j) => {
      const completo = !dos && c.ancho === 'completo';
      const x = completo ? FICHA.x[0] : FICHA.x[j];
      const w = completo ? FICHA.wFull : FICHA.w;
      p.push({ t: 'path', d: rectRed(x, y, w, fm.h, 8), fill: PAL.ficha });
      const yc = y + Math.min(44, fm.h / 2);
      p.push({ t: 'icon', name: c.icono || 'file-text', x: x + FICHA.iconCx - FICHA.iconSize / 2, y: yc - FICHA.iconSize / 2, size: FICHA.iconSize, c: PAL.azulIcono, sw: c.icono === 'barcode' ? 2.3 : 1.75 });
      p.push({ t: 'path', d: linea(x + FICHA.sepX, y + 18, x + FICHA.sepX, y + fm.h - 18), stroke: PAL.separador, sw: 1.6 });
      p.push({ t: 'text', x: x + FICHA.txtX, y: y + FICHA.etBase, txt: c.etiqueta, f: 'f600', s: FICHA.sEt, c: PAL.azulEtiqueta });
      fm.lineas[j].forEach((l, k) => {
        p.push({ t: 'text', x: x + FICHA.txtX, y: y + FICHA.valBase + k * FICHA.lhVal, txt: l, f: 'f700', s: FICHA.sVal, c: PAL.navy });
      });
    });
    y += fm.h + FICHA.gap;
  });
  return { prims: p, alto: h };
}

// ---------------------------------------------------------------------
// Tabla: encabezado azul con íconos, filas cebra, píldora para el estado.
// columnas: [{ titulo, icono, w (u), alinear:'izq'|'centro', estilo:
//   'fuerte'|'normal'|'pildora'|'numero' }]
// ---------------------------------------------------------------------
export const TABLA = { x: 38.5, w: 1342, hHead: 87, hMin: 88, lh: 24.5, sReg: 18.5, sBold: 19.5, sHead: 19.2, pad: 26 };

export function anchosColumnas(columnas) {
  // reparte el ancho de la tabla en proporción a los pesos `w`
  const total = columnas.reduce((a, c) => a + c.w, 0);
  let x = TABLA.x;
  return columnas.map((c) => {
    const w = c.w / total * TABLA.w;
    const r = { ...c, x, w };
    x += w;
    return r;
  });
}

export function encabezadoTabla(cols, y0, medir, tam = TABLA) {
  const p = [];
  const h = TABLA.hHead;
  p.push({ t: 'path', d: rectRed(TABLA.x, y0, TABLA.w, h, [10, 10, 0, 0]),
    fill: { lin: [TABLA.x, 0, TABLA.x + TABLA.w, 0], stops: [[0, '#003174'], [0.72, '#00357B'], [0.87, '#0058A6'], [1, '#0A7FC3']] } });
  // reflejo diagonal arriba a la derecha
  const xr = TABLA.x + TABLA.w;
  p.push({ t: 'path', d: poligono([[xr - 150, y0], [xr - 10, y0], [xr, y0 + 10], [xr, y0 + 30], [xr - 205, y0 + h], [xr - 260, y0 + h]], [0, 0, 0, 0, 0, 0]), fill: PAL.blanco, op: 0.05 });
  cols.forEach((c, i) => {
    if (i > 0) p.push({ t: 'path', d: linea(c.x, y0, c.x, y0 + h), stroke: '#2D6AA1', sw: 1.4, op: 0.85 });
    // la palabra más larga del título tiene que caber entera: se achica la
    // letra (hasta 15 u) y, si aun así no cabe, la columna va sin ícono
    const palabras = String(c.titulo).split(/\s+/);
    const cabe = (ancho, s) => palabras.every((w) => medir(w, 'f600', s) <= ancho) && partirLineas(c.titulo, medir, 'f600', s, ancho).length <= 2;
    let conIcono = !!c.icono, sH = tam.sHead ?? TABLA.sHead;
    const anchoCon = () => c.w - 63 - 10, anchoSin = () => c.w - 16;
    while (conIcono && !cabe(anchoCon(), sH) && sH > 15) sH -= 0.5;
    if (conIcono && !cabe(anchoCon(), sH)) { conIcono = false; sH = tam.sHead ?? TABLA.sHead; }
    while (!conIcono && !cabe(anchoSin(), sH) && sH > 13) sH -= 0.5;
    const xTxt = conIcono ? c.x + 63 : c.x;
    const lineas = partirLineas(c.titulo, medir, 'f600', sH, conIcono ? anchoCon() : anchoSin()).slice(0, 2);
    const lh = 23.5 * sH / TABLA.sHead;
    const base0 = y0 + h / 2 + sH * 0.33 - (lineas.length - 1) * lh / 2;
    if (conIcono) p.push({ t: 'icon', name: c.icono, x: c.x + 17, y: y0 + h / 2 - 18, size: 36, c: PAL.blanco, sw: 1.9 });
    lineas.forEach((l, k) => {
      p.push({ t: 'text', x: conIcono ? xTxt : c.x + c.w / 2, y: base0 + k * lh, txt: l, f: 'f600', s: sH, c: PAL.blanco, a: conIcono ? 'start' : 'middle' });
    });
  });
  return { prims: p, alto: h };
}

/** Mide una fila: líneas de cada celda y alto resultante. */
export function medirFila(cols, valores, medir, tam = TABLA) {
  const celdas = cols.map((c, i) => {
    const v = valores[i] == null || valores[i] === '' ? '—' : String(valores[i]);
    const f = c.estilo === 'normal' ? 'f400' : 'f700';
    let s = f === 'f400' ? tam.sReg : tam.sBold;
    const ancho = c.estilo === 'pildora' ? c.w - 37 - 22 : c.w - (c.alinear === 'centro' ? 16 : TABLA.pad + 14);
    const minimo = s * 0.8;
    while (s > minimo && v.split(/\s+/).some((w) => medir(w, f, s) > ancho)) s -= 0.5;
    let lineas = partirLineas(v, medir, f, s, ancho);
    if (lineas.length > 4) lineas = [...lineas.slice(0, 3), recortar(lineas.slice(3).join(' '), medir, f, s, ancho)];
    return { v, f, s, lineas };
  });
  const n = Math.max(1, ...celdas.map((c) => c.lineas.length));
  const lh = tam.lh ?? TABLA.lh;
  return { celdas, lh, h: Math.max(tam.hMin ?? TABLA.hMin, (tam.padV ?? 39) + n * lh) };
}

export function filaTabla(cols, fm, y0, indice, ultima) {
  const p = [];
  const h = fm.h;
  const fondo = indice % 2 === 1 ? PAL.filaAlterna : PAL.blanco;
  p.push({ t: 'path', d: rectRed(TABLA.x, y0, TABLA.w, h, ultima ? [0, 0, 10, 10] : 0), fill: fondo });
  cols.forEach((c, i) => {
    if (i > 0) p.push({ t: 'path', d: linea(c.x, y0, c.x, y0 + h), stroke: PAL.lineaTabla, sw: 1.5 });
    const cel = fm.celdas[i];
    const n = cel.lineas.length;
    const lh = fm.lh ?? TABLA.lh;
    const base0 = y0 + h / 2 + cel.s * 0.345 - (n - 1) * lh / 2;
    if (c.estilo === 'pildora') {
      const pw = c.w - 37, ph = Math.max(h - 20, 30);
      p.push({ t: 'path', d: rectRed(c.x + 18.5, y0 + (h - ph) / 2, pw, ph, 6), fill: PAL.pildora });
      cel.lineas.forEach((l, k) => p.push({ t: 'text', x: c.x + c.w / 2, y: base0 + k * lh, txt: l, f: 'f700', s: cel.s, c: PAL.pildoraTexto, a: 'middle' }));
      return;
    }
    const centro = c.alinear === 'centro';
    const color = c.estilo === 'normal' ? PAL.texto : (c.estilo === 'numero' ? '#1A396C' : PAL.navy);
    cel.lineas.forEach((l, k) => p.push({
      t: 'text', x: centro ? c.x + c.w / 2 : c.x + TABLA.pad, y: base0 + k * lh, txt: l, f: cel.f, s: cel.s, c: color, a: centro ? 'middle' : 'start',
    }));
  });
  return { prims: p, alto: h };
}

/** Fila única para una tabla sin registros: un mensaje centrado. */
export function filaVacia(texto, y0) {
  return [
    { t: 'path', d: rectRed(TABLA.x, y0, TABLA.w, TABLA.hMin, [0, 0, 10, 10]), fill: PAL.blanco },
    { t: 'text', x: TABLA.x + TABLA.w / 2, y: y0 + TABLA.hMin / 2 + TABLA.sReg * 0.345, txt: texto, f: 'f500', s: TABLA.sReg, c: PAL.pieTexto, a: 'middle' },
  ];
}

/** Borde exterior de la tabla (se dibuja al final, sobre las filas). */
export function bordeTabla(y0, h, cerrada = true) {
  return [{ t: 'path', d: rectRed(TABLA.x, y0, TABLA.w, h, cerrada ? [10, 10, 10, 10] : [10, 10, 0, 0]), stroke: '#DCE5EE', sw: 1.3 }];
}

// ---------------------------------------------------------------------
// Pie: línea con acento cian + "METALIUM | código | nombre" + página
// ---------------------------------------------------------------------
export function pie(codigo, nombre, pagina, total, medir, alto = ALTO, conPagina = true) {
  const p = [];
  const yl = alto - 93;
  p.push({ t: 'path', d: linea(38, yl, 1380, yl), stroke: PAL.pieLinea, sw: 1.5 });
  p.push({ t: 'path', d: rectRed(38, yl - 2.2, 58, 4.4, 2.2), fill: PAL.pieAcento });
  const yb = yl + 35.5;
  const s = 18;
  let x = 38.6;
  const tramo = (txt, f, c) => { p.push({ t: 'text', x, y: yb, txt, f, s, c }); x += medir(txt, f, s); };
  tramo('METALIUM', 'f700', PAL.pieFuerte);
  tramo(' | ', 'f400', PAL.pieSep);
  tramo(codigo, 'f400', PAL.pieTexto);
  tramo(' | ', 'f400', PAL.pieSep);
  tramo(nombre, 'f400', PAL.pieTexto);
  if (conPagina) p.push({ t: 'text', x: 1376, y: yb, txt: total > 1 ? `Página ${pagina} de ${total}` : `Página ${pagina}`, f: 'f400', s, c: PAL.pieTexto, a: 'end' });
  return p;
}

// ---------------------------------------------------------------------
// Composición de un documento completo en páginas A4: encabezado en cada
// página, secciones con barra + contenido, tabla que se corta entre
// páginas repitiendo su fila de títulos, y pie con número de página.
//
// doc = { encabezado:{titulo,codigo,fecha,revision}, pie:{codigo,nombre},
//         secciones:[ {titulo, fichas:[...]} | {titulo, tabla:{columnas,filas}} ] }
// ---------------------------------------------------------------------
const Y_CONTENIDO = 332;    // primera barra de sección, bajo el encabezado
const Y_LIMITE = ALTO - 122; // lo más abajo que puede llegar el contenido

export function componerDocumento(doc, medir) {
  const paginas = [];
  let prims = null;
  let y = 0;
  const nueva = () => {
    prims = [...fondoPagina(), ...encabezado(doc.encabezado, medir).prims];
    paginas.push(prims);
    y = Y_CONTENIDO;
  };
  nueva();

  doc.secciones.forEach((sec, i) => {
    const num = i + 1;
    const GAP_BARRA = 20, GAP_SECCION = 30;
    if (sec.fichas) {
      const filas = medirFichas(sec.fichas, medir);
      const altoTotal = ALTO_BARRA + GAP_BARRA + 34 + filas.reduce((a, f) => a + f.h, 0) + (filas.length - 1) * FICHA.gap;
      if (y > Y_CONTENIDO && y + altoTotal > Y_LIMITE && Y_CONTENIDO + altoTotal <= Y_LIMITE) nueva();
      let desde = 0;
      while (desde < filas.length) {
        const disponible = Y_LIMITE - (y + ALTO_BARRA + GAP_BARRA) - 34;
        let hasta = desde, acum = 0;
        while (hasta < filas.length && acum + filas[hasta].h + (hasta > desde ? FICHA.gap : 0) <= disponible) {
          acum += filas[hasta].h + (hasta > desde ? FICHA.gap : 0); hasta++;
        }
        if (hasta === desde) {
          if (y > Y_CONTENIDO) { nueva(); continue; }
          hasta = desde + 1; // una ficha más alta que la página: se dibuja igual
        }
        prims.push(...barraSeccion(num, desde === 0 ? sec.titulo : `${sec.titulo} (cont.)`, y, medir).prims);
        y += ALTO_BARRA + GAP_BARRA;
        const t = tarjetaFichas(filas, y, desde, hasta);
        prims.push(...t.prims);
        y += t.alto + GAP_SECCION;
        desde = hasta;
        if (desde < filas.length) nueva();
      }
    } else if (sec.tabla) {
      const cols = anchosColumnas(sec.tabla.columnas);
      const tam = { ...TABLA, ...(sec.tabla.tam || {}) };
      const filas = sec.tabla.filas.map((v) => medirFila(cols, v, medir, tam));
      const altoTabla = ALTO_BARRA + 21 + TABLA.hHead + filas.reduce((a, f) => a + f.h, 0);
      const cabeEnHojaNueva = Y_CONTENIDO + altoTabla <= Y_LIMITE;
      if (y > Y_CONTENIDO && ((y + altoTabla > Y_LIMITE && cabeEnHojaNueva && filas.length <= 8) ||
          y + ALTO_BARRA + 21 + TABLA.hHead + (filas[0]?.h ?? TABLA.hMin) > Y_LIMITE)) nueva();
      prims.push(...barraSeccion(num, sec.titulo, y, medir).prims);
      y += ALTO_BARRA + 21;
      let k = 0;
      let continuacion = false;
      do {
        if (continuacion) { nueva(); }
        const yTabla = y;
        prims.push(...encabezadoTabla(cols, y, medir, tam).prims);
        y += TABLA.hHead;
        const inicio = k;
        if (!filas.length) {
          prims.push(...filaVacia(sec.tabla.vacia || 'Sin registros.', y));
          y += TABLA.hMin;
        }
        while (k < filas.length && (y + filas[k].h <= Y_LIMITE || k === inicio)) {
          const ultimaEnPagina = k === filas.length - 1 || y + filas[k].h + (filas[k + 1]?.h ?? 0) > Y_LIMITE;
          prims.push(...filaTabla(cols, filas[k], y, k, ultimaEnPagina).prims);
          y += filas[k].h;
          k++;
        }
        prims.push(...bordeTabla(yTabla, y - yTabla));
        y += GAP_SECCION;
        continuacion = k < filas.length;
      } while (continuacion);
    }
  });

  const total = paginas.length;
  paginas.forEach((pg, i) => pg.push(...pie(doc.pie.codigo, doc.pie.nombre, i + 1, total, medir)));
  return paginas;
}

// ---------------------------------------------------------------------
// Cabecera para los Excel: encabezado, secciones de fichas y la barra de
// la sección de la tabla, sin cortes de página (en el Excel esto va como
// una imagen y la tabla son celdas reales). Devuelve las primitivas y la
// coordenada y donde empieza la tabla.
// ---------------------------------------------------------------------
export function componerCabecera(doc, medir) {
  const prims = [...encabezado(doc.encabezado, medir).prims];
  let y = Y_CONTENIDO;
  let yTabla = null;
  doc.secciones.forEach((sec, i) => {
    if (yTabla != null) return;
    prims.push(...barraSeccion(i + 1, sec.titulo, y, medir).prims);
    if (sec.fichas) {
      y += ALTO_BARRA + 20;
      const t = tarjetaFichas(medirFichas(sec.fichas, medir), y);
      prims.push(...t.prims);
      y += t.alto + 30;
    } else {
      y += ALTO_BARRA + 21;
      yTabla = y;
    }
  });
  return { prims, yTabla: yTabla ?? y };
}

// ---------------------------------------------------------------------
// Íconos por etiqueta (para las fichas de detalle del comprobante)
// ---------------------------------------------------------------------
export function iconoParaCampo(etiqueta) {
  const e = String(etiqueta || '').toLowerCase();
  if (/registro/.test(e)) return 'file-text';
  if (/código/.test(e)) return 'barcode';
  if (/revisión/.test(e)) return 'settings';
  if (/total/.test(e)) return 'database';
  if (/folio|n° de solicitud|n°/.test(e)) return 'hash';
  if (/estado|decisión/.test(e)) return 'circle-check';
  if (/solicitante/.test(e)) return 'user';
  if (/trabajador|candidato/.test(e)) return 'hard-hat';
  if (/obra|centro|cliente/.test(e)) return 'building-2';
  if (/cargo/.test(e)) return 'briefcase';
  if (/cantidad/.test(e)) return 'users';
  if (/sueldo|monto|bono/.test(e)) return 'banknote';
  if (/tipo de contrato|contrato/.test(e)) return 'file-signature';
  if (/tipo de renovación|renovación|condición/.test(e)) return 'refresh-cw';
  if (/hito/.test(e)) return 'flag';
  if (/colación/.test(e)) return 'utensils';
  if (/turno|horario|plazo|tiempo/.test(e)) return 'clock';
  if (/período|periodo/.test(e)) return 'calendar-range';
  if (/creación|creada|asignado|decidido/.test(e)) return 'calendar-clock';
  if (/fecha/.test(e)) return 'calendar-days';
  if (/causal/.test(e)) return 'tag';
  if (/motivo|observaci|modificaci/.test(e)) return 'message-square';
  if (/etapa/.test(e)) return 'truck';
  return 'file-text';
}



// ---------------------------------------------------------------------
// Íconos (Lucide, licencia ISC -- https://lucide.dev): trazos de 2 u en
// una caja de 24 x 24, convertidos a un solo path por ícono (con los
// flags de arco separados, para el lector de paths de pdf-lib). "barcode"
// se redibujó con 7 barras para parecerse al del concepto.
// ---------------------------------------------------------------------
export const ICONOS = {
  'file-text': 'M6 22a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2.4 2.4 0 0 1 1.704 .706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1 -2 2zM14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8',
  'calendar-days': 'M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01',
  'refresh-cw': 'M3 12a9 9 0 0 1 9 -9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1 -9 9 9.75 9.75 0 0 1 -6.74 -2.74L3 16M8 16H3v5',
  'barcode': 'M3 5v14M6 5v14M8.5 5v14M11.5 5v14M14.5 5v14M17 5v14M20 5v14',
  'settings': 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1 -2.33 4.033 2.34 2.34 0 0 0 -3.319 1.915 2.34 2.34 0 0 1 -4.659 0 2.34 2.34 0 0 0 -3.32 -1.915 2.34 2.34 0 0 1 -2.33 -4.033 2.34 2.34 0 0 0 0 -3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319 -1.915M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z',
  'database': 'M3 5a9 3 0 1 0 18 0a9 3 0 1 0 -18 0zM3 5V19A9 3 0 0 0 21 19V5M3 12A9 3 0 0 0 21 12',
  'truck': 'M14 18V6a2 2 0 0 0 -2 -2H4a2 2 0 0 0 -2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1 -1v-3.65a1 1 0 0 0 -.22 -.624l-3.48 -4.35A1 1 0 0 0 17.52 8H14M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0zM5 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z',
  'building': 'M12 10h.01M12 14h.01M12 6h.01M16 10h.01M16 14h.01M16 6h.01M8 10h.01M8 14h.01M8 6h.01M9 22v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-16a2 2 0 0 1 2 -2z',
  'building-2': 'M10 12h4M10 8h4M14 21v-3a2 2 0 0 0 -4 0v3M6 10H4a2 2 0 0 0 -2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2 -2V9a2 2 0 0 0 -2 -2h-2M6 21V5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16',
  'layers': 'M12.83 2.18a2 2 0 0 0 -1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58 -3.9a1 1 0 0 0 0 -1.83zM2 12a1 1 0 0 0 .58 .91l8.6 3.91a2 2 0 0 0 1.65 0l8.58 -3.9A1 1 0 0 0 22 12M2 17a1 1 0 0 0 .58 .91l8.6 3.91a2 2 0 0 0 1.65 0l8.58 -3.9A1 1 0 0 0 22 17',
  'circle-check': 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM16 9l-5.5 5.5L8 12',
  'user': 'M19 21v-2a4 4 0 0 0 -4 -4H9a4 4 0 0 0 -4 4v2M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z',
  'users': 'M16 21v-2a4 4 0 0 0 -4 -4H6a4 4 0 0 0 -4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0 -3 -3.87M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z',
  'tag': 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0 -2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58 -6.58a2.426 2.426 0 0 0 0 -3.42zM7 7.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0z',
  'hash': 'M4 9L20 9M4 15L20 15M10 3L8 21M16 3L14 21',
  'clock': 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM12 6v6l4 2',
  'briefcase': 'M16 20V4a2 2 0 0 0 -2 -2h-4a2 2 0 0 0 -2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z',
  'banknote': 'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2zM10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0zM6 12h.01M18 12h.01',
  'list-checks': 'M13 5h8M13 12h8M13 19h8M3 17l2 2 4 -4M3 7l2 2 4 -4',
  'user-check': 'M16 11l2 2 4 -4M16 21v-2a4 4 0 0 0 -4 -4H6a4 4 0 0 0 -4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z',
  'calendar-clock': 'M16 14v2.2l1.6 1M16 2v3M21 7.338V5a2 2 0 0 0 -2 -2H5a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h2.338M3 9h5.859M8 2v3M10 16a6 6 0 1 0 12 0a6 6 0 1 0 -12 0z',
  'timer': 'M10 2L14 2M12 14L15 11M4 14a8 8 0 1 0 16 0a8 8 0 1 0 -16 0z',
  'id-card': 'M13 19a4 4 0 0 0 -8 0M16 10h2M16 14h2M6 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0zM4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z',
  'graduation-cap': 'M21.42 10.922a1 1 0 0 0 -.019 -1.838L12.83 5.18a2 2 0 0 0 -1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0zM22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5',
  'file-signature': 'M14.364 13.634a2 2 0 0 0 -.506 .854l-.837 2.87a.5 .5 0 0 0 .62 .62l2.87 -.837a2 2 0 0 0 .854 -.506l4.013 -4.009a1 1 0 0 0 -3.004 -3.004zM14.487 7.858A1 1 0 0 1 14 7V2M20 19.645V20a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2.4 2.4 0 0 1 1.704 .706l2.516 2.516M8 18h1',
  'calendar-x': 'M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM3 9h18M14 13l-4 4M10 13l4 4',
  'infinity': 'M6 16c5 0 7 -8 12 -8a4 4 0 0 1 0 8c-5 0 -7 -8 -12 -8a4 4 0 1 0 0 8',
  'message-square': 'M22 17a2 2 0 0 1 -2 2H6.828a2 2 0 0 0 -1.414 .586l-2.202 2.202A.71 .71 0 0 1 2 21.286V5a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2z',
  'map-pin': 'M20 10c0 4.993 -5.539 10.193 -7.399 11.799a1 1 0 0 1 -1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z',
  'clipboard-list': 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2h2M12 11h4M12 16h4M8 11h.01M8 16h.01',
  'hard-hat': 'M10 10V5a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v5M14 6a6 6 0 0 1 6 6v3M4 15v-3a6 6 0 0 1 6 -6M3 15h18a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1z',
  'arrow-left-right': 'M8 3 4 7l4 4M4 7h16M16 21l4 -4 -4 -4M20 17H4',
  'calendar-range': 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM16 2v3M3 9h18M8 2v3M17 13h-6M13 17H7M7 13h.01M17 17h.01',
  'scroll-text': 'M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0 -2 -2H4M8 21h12a2 2 0 0 0 2 -2v-1a1 1 0 0 0 -1 -1H11a1 1 0 0 0 -1 1v1a2 2 0 1 1 -4 0V5a2 2 0 1 0 -4 0v2a1 1 0 0 0 1 1h3',
  'badge-check': 'M3.85 8.62a4 4 0 0 1 4.78 -4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1 -4.77 4.78 4 4 0 0 1 -6.75 0 4 4 0 0 1 -4.78 -4.77 4 4 0 0 1 0 -6.76ZM16 9l-5.5 5.5L8 12',
  'circle-dollar-sign': 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6',
  'flag': 'M4 22V4a1 1 0 0 1 .4 -.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067 -.8A1 1 0 0 1 20 4v10a1 1 0 0 1 -.4 .8A6 6 0 0 1 16 16c-3 0 -5 -2 -8 -2a6 6 0 0 0 -4 1.528',
  'utensils': 'M3 2v7c0 1.1 .9 2 2 2h4a2 2 0 0 0 2 -2V2M7 2v20M21 15V2a5 5 0 0 0 -5 5v6c0 1.1 .9 2 2 2h3Zm0 0v7',
  'house': 'M15 21v-8a1 1 0 0 0 -1 -1h-4a1 1 0 0 0 -1 1v8M3 10a2 2 0 0 1 .709 -1.528l7 -6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2z',
  'trending-up': 'M16 7h6v6M22 7l-8.5 8.5 -5 -5L2 17',
  'shield-check': 'M20 13c0 5 -3.5 7.5 -7.66 8.95a1 1 0 0 1 -.67 -.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1 -1c2 0 4.5 -1.2 6.24 -2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4 -4',
  'circle-x': 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM15 9l-6 6M9 9l6 6',
  'circle-dot': 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0zM2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z'
};
