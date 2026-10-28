// =====================================================================
// sgc-instructivo.js · Composición de un INSTRUCTIVO con el diseño
// "Concept 3" del SGC, sobre las piezas de sgc-layout.js (encabezado,
// barras de sección, fichas, tablas y pie). Agrega bloques propios de un
// instructivo: párrafos con **negritas**, pasos numerados, capturas de
// pantalla, avisos, listas y subtítulos, todo dentro de la tarjeta blanca
// de cada sección, con cortes de página.
// =====================================================================

import {
  ALTO, PAL, rectRed, poligono, fondoPagina, encabezado, barraSeccion, ALTO_BARRA,
  medirFichas, tarjetaFichas, pie, TABLA, anchosColumnas, encabezadoTabla, medirFila, filaTabla, bordeTabla,
} from './sgc-layout.js';

const Y_CONTENIDO = 332;
const Y_LIMITE = ALTO - 122;
const GAP_BARRA = 20;
const GAP_SECCION = 30;
const CARD = { x: 33, w: 1351.5, padT: 30, padB: 30, padX: 44 };
const X0 = CARD.x + CARD.padX;           // 77
const ANCHO_UTIL = CARD.w - 2 * CARD.padX; // 1263.5
const GAP_BLOQUE = 24;
// u por píxel CSS de las capturas (tomadas a 2x): la vista completa (1116 px) ocupa el ancho útil
const ESCALA_PX = 1.13;

export const TXT = { s: 21, lh: 31, c: '#1F3A64', cFuerte: '#021659' };

const linea = (x1, y1, x2, y2) => `M${x1} ${y1} L${x2} ${y2}`;
// círculo con 4 curvas de Bézier (el relleno con degradado del PDF solo entiende M/L/C/Z)
function circulo(cx, cy, r) {
  const k = 0.5523 * r;
  return `M${cx - r} ${cy} C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} ` +
    `C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} Z`;
}
function sombra(p, x, y, w, h, r) {
  p.push({ t: 'path', d: rectRed(x - 1.5, y + 1, w + 3, h + 4, r + 1.5), fill: PAL.sombra, op: 0.035 });
  p.push({ t: 'path', d: rectRed(x - 0.5, y + 0.5, w + 1, h + 2, r + 0.5), fill: PAL.sombra, op: 0.04 });
}

// ---------------------------------------------------------------------
// Texto enriquecido: **negrita** dentro de un párrafo
// ---------------------------------------------------------------------
function trozos(texto) {
  const out = [];
  String(texto ?? '').split(/(\*\*[^*]+\*\*)/).forEach((p) => {
    if (!p) return;
    const negrita = p.startsWith('**') && p.endsWith('**');
    const t = negrita ? p.slice(2, -2) : p;
    // separar en palabras conservando a qué fuente pertenecen
    t.split(/(\s+)/).forEach((w) => { if (w) out.push({ w, negrita, esp: /^\s+$/.test(w) }); });
  });
  return out;
}

/** Parte un texto con **negritas** en líneas de ancho máximo. Devuelve [[{txt,f,x}]].
 *  Los trozos pegados sin espacio (ej. "**negrita**." o "(**texto**)") se
 *  tratan como una sola palabra: nunca se corta la línea entre ellos. */
export function partirRico(texto, medir, s, anchoMax, fReg = 'f400', fBold = 'f700') {
  const lineas = [];
  for (const parrafo of String(texto ?? '').split('\n')) {
    // agrupar en "palabras" (secuencias de trozos sin espacio entre sí)
    const palabras = [];
    let actual = null;
    for (const t of trozos(parrafo)) {
      if (t.esp) { actual = null; continue; }
      const f = t.negrita ? fBold : fReg;
      const pieza = { txt: t.w, f, w: medir(t.w, f, s) };
      if (!actual) { actual = { piezas: [], w: 0 }; palabras.push(actual); }
      actual.piezas.push(pieza); actual.w += pieza.w;
    }
    const esp = medir(' ', fReg, s);
    let linea = [], x = 0;
    for (const pal of palabras) {
      const sep = linea.length ? esp : 0;
      if (linea.length && x + sep + pal.w > anchoMax) { lineas.push(linea); linea = []; x = 0; }
      if (linea.length) {
        linea.push({ txt: ' ', f: fReg, x }); x += esp;
      }
      for (const pz of pal.piezas) { linea.push({ txt: pz.txt, f: pz.f, x }); x += pz.w; }
    }
    lineas.push(linea);
  }
  // unir trozos contiguos de la misma fuente (menos primitivas de texto)
  return lineas.map((l) => {
    const out = [];
    for (const t of l) {
      const ult = out[out.length - 1];
      if (ult && ult.f === t.f) ult.txt += t.txt; else out.push({ ...t });
    }
    return out.filter((t) => t.txt.trim());
  });
}
function pintarRico(p, lineas, x, yBase, s, lh, color, colorFuerte) {
  lineas.forEach((l, k) => l.forEach((t) => {
    if (!t.txt) return;
    p.push({ t: 'text', x: x + t.x, y: yBase + k * lh, txt: t.txt.replace(/\s+$/, ''), f: t.f, s, c: t.f === 'f700' || t.f === 'f600' ? colorFuerte : color });
  }));
}

// ---------------------------------------------------------------------
// Bloques: cada uno sabe medirse (alto) y dibujarse en una y dada
// ---------------------------------------------------------------------
const BLOQUES = {
  roles: {
    // "Lo usan: [Rol] [Rol]" · píldoras con los roles que usan el módulo
    medir(b, m) {
      b._lbl = m('LO USAN', 'f700', 15.5);
      let x = X0 + 30 + b._lbl + 18;
      b._pills = b.items.map((r) => {
        const w = m(r, 'f600', 17.5) + 30;
        const pill = { r, x, w };
        x += w + 10;
        return pill;
      });
      return 34;
    },
    dibujar(b, y) {
      const p = [{ t: 'icon', name: 'users', x: X0, y: y + 5, size: 22, c: '#557AA2', sw: 2.2 }];
      p.push({ t: 'text', x: X0 + 30, y: y + 22.5, txt: 'LO USAN', f: 'f700', s: 15.5, c: '#557AA2' });
      for (const pl of b._pills) {
        p.push({ t: 'path', d: rectRed(pl.x, y, pl.w, 34, 17), fill: '#EAF2FA', stroke: '#C9DCEE', sw: 1.1 });
        p.push({ t: 'text', x: pl.x + pl.w / 2, y: y + 23.3, txt: pl.r, f: 'f600', s: 17.5, c: '#00357B', a: 'middle' });
      }
      return p;
    },
  },
  texto: {
    medir(b, m) { b._l = partirRico(b.txt, m, TXT.s, ANCHO_UTIL); return b._l.length * TXT.lh - (TXT.lh - TXT.s) + 4; },
    dibujar(b, y) { const p = []; pintarRico(p, b._l, X0, y + TXT.s * 0.82, TXT.s, TXT.lh, TXT.c, TXT.cFuerte); return p; },
  },
  sub: {
    medir(b, m) { return 34; },
    dibujar(b, y) {
      return [
        { t: 'path', d: rectRed(X0, y + 7, 7, 24, 2), fill: PAL.amarillo },
        { t: 'text', x: X0 + 20, y: y + 27, txt: b.txt, f: 'mBold', s: 23, c: PAL.navy },
      ];
    },
  },
  paso: {
    // un paso numerado: círculo azul con el número + texto (título en negrita opcional)
    medir(b, m) {
      const ancho = ANCHO_UTIL - 66;
      b._lt = b.titulo ? partirRico(`**${b.titulo}**`, m, 22, ancho) : [];
      b._l = b.txt ? partirRico(b.txt, m, TXT.s, ancho) : [];
      const hT = b._lt.length ? b._lt.length * 30 : 0;
      const hX = b._l.length ? b._l.length * TXT.lh - (TXT.lh - TXT.s) : 0;
      return Math.max(44, hT + (hT && hX ? 6 : 0) + hX + 8);
    },
    dibujar(b, y) {
      const p = [];
      const cx = X0 + 21, cy = y + 21;
      p.push({ t: 'path', d: circulo(cx, cy, 21), fill: { lin: [cx - 21, cy - 21, cx + 21, cy + 21], stops: [[0, '#00255F'], [1, '#00559F']] } });
      p.push({ t: 'text', x: cx, y: cy + 7.6, txt: String(b.n), f: 'mBlack', s: 21, c: PAL.blanco, a: 'middle' });
      let yy = y + 4;
      if (b._lt.length) { pintarRico(p, b._lt, X0 + 66, yy + 18.5, 22, 30, TXT.cFuerte, TXT.cFuerte); yy += b._lt.length * 30 + 6; }
      if (b._l.length) pintarRico(p, b._l, X0 + 66, yy + TXT.s * 0.82, TXT.s, TXT.lh, TXT.c, TXT.cFuerte);
      return p;
    },
  },
  item: {
    medir(b, m) { b._l = partirRico(b.txt, m, TXT.s, ANCHO_UTIL - 34); return b._l.length * TXT.lh - (TXT.lh - TXT.s) + 2; },
    dibujar(b, y) {
      const p = [{ t: 'path', d: rectRed(X0 + 4, y + 7, 9, 9, 2), fill: PAL.cian }];
      pintarRico(p, b._l, X0 + 34, y + TXT.s * 0.82, TXT.s, TXT.lh, TXT.c, TXT.cFuerte);
      return p;
    },
  },
  aviso: {
    medir(b, m) {
      const ancho = ANCHO_UTIL - 110;
      b._lt = b.titulo ? partirRico(`**${b.titulo}**`, m, 21, ancho) : [];
      b._l = partirRico(b.txt, m, 20, ancho);
      const h = (b._lt.length ? b._lt.length * 29 + 4 : 0) + b._l.length * 29 - 9;
      return Math.max(72, h + 36);
    },
    dibujar(b, y, h) {
      const p = [];
      const E = {
        info:    { fondo: '#EAF5FC', borde: '#CFE6F5', acento: '#08B7F7', icono: 'info', c: '#0A64B4' },
        alerta:  { fondo: '#FFF7E1', borde: '#F6E3AE', acento: '#FFC300', icono: 'triangle-alert', c: '#9A6A00' },
        consejo: { fondo: '#EEF7F0', borde: '#CFE7D5', acento: '#2FA35B', icono: 'lightbulb', c: '#1E7A40' },
        correo:  { fondo: '#F1F6FA', borde: '#DCE7F1', acento: '#00357B', icono: 'mail', c: '#00357B' },
      }[b.tipo || 'info'];
      p.push({ t: 'path', d: rectRed(X0, y, ANCHO_UTIL, h, 8), fill: E.fondo, stroke: E.borde, sw: 1.2 });
      p.push({ t: 'path', d: rectRed(X0, y, 7, h, [8, 0, 0, 8]), fill: E.acento });
      p.push({ t: 'icon', name: E.icono, x: X0 + 32, y: y + 19, size: 34, c: E.c, sw: 2 });
      let yy = y + 18;
      if (b._lt.length) { pintarRico(p, b._lt, X0 + 88, yy + 18, 21, 29, TXT.cFuerte, TXT.cFuerte); yy += b._lt.length * 29 + 4; }
      pintarRico(p, b._l, X0 + 88, yy + 17, 20, 29, TXT.c, TXT.cFuerte);
      return p;
    },
  },
  img2: {
    // dos capturas lado a lado, a la misma altura
    medir(b, m, maxAlto) {
      const pad = 12, gap = 34;
      const natA = b.a.w / 2 * ESCALA_PX, natB = b.b.w / 2 * ESCALA_PX;
      const rA = b.a.w / b.a.h, rB = b.b.w / b.b.h;
      let H = Math.min(natA / rA, natB / rB);
      const anchoMax = ANCHO_UTIL - gap - 4 * pad;
      if (H * (rA + rB) > anchoMax) H = anchoMax / (rA + rB);
      const capH = b.pie ? 38 : 0;
      H = Math.min(H, b.maxAlto ?? 520, maxAlto - 2 * pad - capH);
      b._H = H; b._wa = H * rA; b._wb = H * rB; b._pad = pad; b._gap = gap;
      return H + 2 * pad + capH;
    },
    dibujar(b, y) {
      const p = [];
      const pad = b._pad, H = b._H;
      const total = b._wa + b._wb + 4 * pad + b._gap;
      let x = X0 + (ANCHO_UTIL - total) / 2;
      for (const [im, w] of [[b.a, b._wa], [b.b, b._wb]]) {
        p.push({ t: 'path', d: rectRed(x, y, w + 2 * pad, H + 2 * pad, 8), fill: '#F4F8FB', stroke: '#D5E1EC', sw: 1.4 });
        p.push({ t: 'img', key: im.src, x: x + pad, y: y + pad, w, h: H });
        p.push({ t: 'path', d: rectRed(x + pad, y + pad, w, H, 0), stroke: '#C9D7E5', sw: 1 });
        x += w + 2 * pad + b._gap;
      }
      if (b.pie) p.push({ t: 'text', x: X0 + ANCHO_UTIL / 2, y: y + H + 2 * pad + 27, txt: `Figura ${b.nFig} · ${b.pie}`, f: 'f500', s: 18, c: '#557AA2', a: 'middle' });
      return p;
    },
  },
  lado: {
    // captura a un lado y texto (pasos o lista) al otro
    medir(b, m, maxAlto) {
      const pad = 12, gap = 40;
      const nat = b.w / 2 * ESCALA_PX;
      let w = Math.min(b.ancho ?? Math.min(nat, 600), 760);
      let h = w * b.h / b.w;
      const capH = b.pie ? 38 : 0;
      const limite = Math.min(b.maxAlto ?? 980, maxAlto - 2 * pad - capH);
      if (h > limite) { h = limite; w = h * b.w / b.h; }
      b._w = w; b._h = h; b._pad = pad; b._cap = capH;
      b._capW = b.pie ? m(`Figura 00 · ${b.pie}`, 'f500', 18) : 0;
      const tw = ANCHO_UTIL - (w + 2 * pad) - gap;
      b._tx = X0 + (b.lado === 'der' ? 0 : w + 2 * pad + gap);
      b._ix = b.lado === 'der' ? X0 + ANCHO_UTIL - (w + 2 * pad) : X0;
      b._tw = tw;
      const sangria = b.estilo === 'texto' ? 0 : b.estilo === 'pasos' ? 60 : 34;
      b._intro = b.intro ? partirRico(b.intro, m, TXT.s, tw) : [];
      b._items = (b.items || []).map((it) => {
        const titulo = typeof it === 'object' ? it.titulo : null;
        const txt = typeof it === 'object' ? it.txt : it;
        const lt = titulo ? partirRico(`**${titulo}**`, m, 22, tw - sangria) : [];
        const l = txt ? partirRico(txt, m, TXT.s, tw - sangria) : [];
        const hT = lt.length ? lt.length * 30 : 0;
        const hX = l.length ? l.length * TXT.lh - (TXT.lh - TXT.s) : 0;
        const hh = b.estilo === 'pasos' ? Math.max(42, hT + (hT && hX ? 6 : 0) + hX + 6) : hT + hX + 2;
        return { lt, l, h: hh };
      });
      const gapIt = b.estilo === 'pasos' ? 18 : 12;
      const hIntro = b._intro.length ? b._intro.length * TXT.lh - (TXT.lh - TXT.s) + 16 : 0;
      const hText = hIntro + b._items.reduce((a, it) => a + it.h, 0) + Math.max(0, b._items.length - 1) * gapIt;
      b._gapIt = gapIt; b._hIntro = hIntro;
      return Math.max(h + 2 * pad + capH, hText);
    },
    dibujar(b, y) {
      const p = [];
      const W = b._w + 2 * b._pad, H = b._h + 2 * b._pad;
      p.push({ t: 'path', d: rectRed(b._ix, y, W, H, 8), fill: '#F4F8FB', stroke: '#D5E1EC', sw: 1.4 });
      p.push({ t: 'img', key: b.src, x: b._ix + b._pad, y: y + b._pad, w: b._w, h: b._h });
      p.push({ t: 'path', d: rectRed(b._ix + b._pad, y + b._pad, b._w, b._h, 0), stroke: '#C9D7E5', sw: 1 });
      if (b.pie) {
        const ancha = (b._capW ?? 0) > W;
        p.push({ t: 'text', x: ancha ? b._ix : b._ix + W / 2, y: y + H + 27, txt: `Figura ${b.nFig} · ${b.pie}`, f: 'f500', s: 18, c: '#557AA2', a: ancha ? 'start' : 'middle' });
      }
      let yy = y;
      if (b._intro.length) { pintarRico(p, b._intro, b._tx, yy + TXT.s * 0.82, TXT.s, TXT.lh, TXT.c, TXT.cFuerte); yy += b._hIntro; }
      b._items.forEach((it, i) => {
        if (b.estilo === 'pasos') {
          const cx = b._tx + 20, cy = yy + 20;
          p.push({ t: 'path', d: circulo(cx, cy, 20), fill: { lin: [cx - 20, cy - 20, cx + 20, cy + 20], stops: [[0, '#00255F'], [1, '#00559F']] } });
          p.push({ t: 'text', x: cx, y: cy + 7.2, txt: String((b.desde ?? 1) + i), f: 'mBlack', s: 20, c: PAL.blanco, a: 'middle' });
          let y2 = yy + 3;
          if (it.lt.length) { pintarRico(p, it.lt, b._tx + 60, y2 + 18.5, 22, 30, TXT.cFuerte, TXT.cFuerte); y2 += it.lt.length * 30 + 6; }
          if (it.l.length) pintarRico(p, it.l, b._tx + 60, y2 + TXT.s * 0.82, TXT.s, TXT.lh, TXT.c, TXT.cFuerte);
        } else if (b.estilo === 'texto') {
          pintarRico(p, it.l, b._tx, yy + TXT.s * 0.82, TXT.s, TXT.lh, TXT.c, TXT.cFuerte);
        } else {
          p.push({ t: 'path', d: rectRed(b._tx + 4, yy + 7, 9, 9, 2), fill: PAL.cian });
          let y2 = yy;
          if (it.lt.length) { pintarRico(p, it.lt, b._tx + 34, y2 + 18.5, 22, 30, TXT.cFuerte, TXT.cFuerte); y2 += it.lt.length * 30; }
          pintarRico(p, it.l, b._tx + 34, y2 + TXT.s * 0.82, TXT.s, TXT.lh, TXT.c, TXT.cFuerte);
        }
        yy += it.h + b._gapIt;
      });
      return p;
    },
  },
  img: {
    medir(b, m, maxAlto) {
      const pad = 12;
      let w = Math.min(b.ancho ?? (b.w / 2 * ESCALA_PX + 2 * pad), ANCHO_UTIL) - 2 * pad;
      let h = w * b.h / b.w;
      const capH = b.pie ? 38 : 0;
      const limite = Math.min(b.maxAlto ?? 700, maxAlto - 2 * pad - capH);
      if (h > limite) { h = limite; w = h * b.w / b.h; }
      b._w = w; b._h = h; b._pad = pad; b._cap = capH;
      return h + 2 * pad + capH;
    },
    dibujar(b, y) {
      const p = [];
      const W = b._w + 2 * b._pad, H = b._h + 2 * b._pad;
      const x = X0 + (ANCHO_UTIL - W) / 2;
      p.push({ t: 'path', d: rectRed(x, y, W, H, 8), fill: '#F4F8FB', stroke: '#D5E1EC', sw: 1.4 });
      p.push({ t: 'img', key: b.src, x: x + b._pad, y: y + b._pad, w: b._w, h: b._h });
      p.push({ t: 'path', d: rectRed(x + b._pad, y + b._pad, b._w, b._h, 0), stroke: '#C9D7E5', sw: 1 });
      if (b.pie) {
        p.push({ t: 'text', x: X0 + ANCHO_UTIL / 2, y: y + H + 27, txt: `Figura ${b.nFig} · ${b.pie}`, f: 'f500', s: 18, c: '#557AA2', a: 'middle' });
      }
      return p;
    },
  },
};

// Expande los bloques "compuestos" en unidades que no se cortan entre páginas.
function unidades(bloques) {
  const out = [];
  let nFig = 0;
  for (const b of bloques) {
    if (b.t === 'pasos') {
      b.items.forEach((it, i) => out.push({ t: 'paso', n: (b.desde ?? 1) + i, titulo: it.titulo, txt: it.txt, gap: 18 }));
    } else if (b.t === 'lista') {
      b.items.forEach((txt) => out.push({ t: 'item', txt, gap: 12 }));
    } else if (b.t === 'texto') {
      String(b.txt).split(/\n\n+/).forEach((txt) => out.push({ t: 'texto', txt }));
    } else if (b.t === 'img' || b.t === 'img2' || b.t === 'lado') {
      out.push({ ...b, nFig: ++nFig });
    } else out.push({ ...b });
  }
  return out;
}

// ---------------------------------------------------------------------
// Composición de páginas
// ---------------------------------------------------------------------
export function componerInstructivo(doc, medir) {
  const paginas = [];
  let prims = null;
  let y = 0;
  let nFigura = 0;
  const nueva = () => {
    prims = [...fondoPagina(), ...encabezado(doc.encabezado, medir).prims];
    paginas.push(prims);
    y = Y_CONTENIDO;
  };
  nueva();

  doc.secciones.forEach((sec, iSec) => {
    const num = iSec + 1;
    if (sec.fichas) {
      const filas = medirFichas(sec.fichas, medir);
      const t0 = tarjetaFichas(filas, 0);
      if (y > Y_CONTENIDO && y + ALTO_BARRA + GAP_BARRA + t0.alto > Y_LIMITE) nueva();
      sec._pag = paginas.length;
      prims.push(...barraSeccion(num, sec.titulo, y, medir).prims);
      y += ALTO_BARRA + GAP_BARRA;
      const t = tarjetaFichas(filas, y);
      prims.push(...t.prims);
      y += t.alto + GAP_SECCION;
      return;
    }
    if (sec.tabla) {
      const cols = anchosColumnas(sec.tabla.columnas);
      const tam = { ...TABLA, ...(sec.tabla.tam || {}) };
      const filas = sec.tabla.filas.map((v) => medirFila(cols, v, medir, tam));
      const altoTabla = ALTO_BARRA + 21 + TABLA.hHead + filas.reduce((a, f) => a + f.h, 0);
      const cabeEnHojaNueva = Y_CONTENIDO + altoTabla <= Y_LIMITE;
      if (y > Y_CONTENIDO && (
        y + ALTO_BARRA + 21 + TABLA.hHead + (filas[0]?.h ?? 0) * Math.min(3, filas.length) > Y_LIMITE ||
        // una tabla que cabe entera en una hoja nueva no se parte
        (cabeEnHojaNueva && y + altoTabla > Y_LIMITE)
      )) nueva();
      sec._pag = paginas.length;
      prims.push(...barraSeccion(num, sec.titulo, y, medir).prims);
      y += ALTO_BARRA + 21;
      let k = 0;
      do {
        if (k > 0) nueva();
        const yT = y;
        prims.push(...encabezadoTabla(cols, y, medir, tam).prims);
        y += TABLA.hHead;
        const ini = k;
        while (k < filas.length && (y + filas[k].h <= Y_LIMITE || k === ini)) {
          const ultima = k === filas.length - 1 || y + filas[k].h + (filas[k + 1]?.h ?? 0) > Y_LIMITE;
          prims.push(...filaTabla(cols, filas[k], y, k, ultima).prims);
          y += filas[k].h; k++;
        }
        prims.push(...bordeTabla(yT, y - yT));
        y += GAP_SECCION;
      } while (k < filas.length);
      return;
    }

    // Sección de bloques dentro de la tarjeta blanca
    const us = unidades(sec.roles ? [{ t: 'roles', items: sec.roles, gap: 22 }, ...sec.bloques] : sec.bloques);
    if (sec.roles && us[1]) us[1] = { ...us[1], gap: 22 };
    us.forEach((u) => { if (u.t === 'img' || u.t === 'img2' || u.t === 'lado') u.nFig = ++nFigura; });
    const maxAltoUnidad = Y_LIMITE - (Y_CONTENIDO + ALTO_BARRA + GAP_BARRA + CARD.padT + CARD.padB);
    us.forEach((u) => { u._alto = BLOQUES[u.t].medir(u, medir, maxAltoUnidad); });

    // "sub" y "roles" se quedan con la unidad siguiente
    const pegada = (u) => u.t === 'sub' || u.t === 'roles';
    const altoJunto = (k) => pegada(us[k]) && us[k + 1] ? us[k]._alto + (us[k + 1].gap ?? GAP_BLOQUE) + us[k + 1]._alto : us[k]._alto;
    // título de sección: que quede al menos con la primera unidad
    const primera = us[0] ? altoJunto(0) : 0;
    const total = ALTO_BARRA + GAP_BARRA + CARD.padT + CARD.padB +
      us.reduce((a, u, k) => a + u._alto + (k ? (u.gap ?? GAP_BLOQUE) : 0), 0);
    const disponible = Y_LIMITE - y;
    // las capturas se pueden achicar hasta 35 % para caber (ver más abajo)
    const esImg = (u) => ['img', 'img2', 'lado'].includes(u.t);
    const achicable = us.reduce((a, u) => a + (esImg(u) ? u._alto * 0.25 : 0), 0);
    const u0 = us[0] && pegada(us[0]) ? us[1] : us[0];
    const primeraMin = u0 && esImg(u0) ? primera - u0._alto * 0.25 : primera;
    if (y > Y_CONTENIDO && (
      y + ALTO_BARRA + GAP_BARRA + CARD.padT + primeraMin + CARD.padB > Y_LIMITE ||
      // una sección que cabe entera en una hoja nueva no se parte si acá quedaría menos de la mitad
      (total - achicable > disponible && Y_CONTENIDO + total <= Y_LIMITE && disponible < total * 0.5)
    )) nueva();
    let tituloSec = sec.titulo;
    let i = 0;
    const achicar = (u, libre) => {
      if (!esImg(u) || libre < 0.75 * u._alto || libre <= 260) return false;
      const alto = BLOQUES[u.t].medir(u, medir, libre);
      if (alto <= libre) { u._alto = alto; return true; }
      BLOQUES[u.t].medir(u, medir, maxAltoUnidad);
      return false;
    };
    while (i < us.length) {
      // la barra va solo si cabe al menos la primera unidad (achicando si es captura)
      const libre0 = Y_LIMITE - (y + ALTO_BARRA + GAP_BARRA + CARD.padT + CARD.padB);
      const cabePrimera = () => pegada(us[i])
        ? (us[i + 1] && esImg(us[i + 1]) && achicar(us[i + 1], libre0 - us[i]._alto - (us[i + 1].gap ?? GAP_BLOQUE)))
        : achicar(us[i], libre0);
      if (y > Y_CONTENIDO && altoJunto(i) > libre0 && !cabePrimera()) { nueva(); continue; }
      const marca = prims.length, yBarra = y, pagBarra = paginas.length;
      prims.push(...barraSeccion(num, tituloSec, y, medir).prims);
      y += ALTO_BARRA + GAP_BARRA;
      const yCard = y;
      const cardPrims = [];
      let yy = yCard + CARD.padT;
      const inicio = i;
      while (i < us.length) {
        const u = us[i];
        const gap = i === inicio ? 0 : (u.gap ?? GAP_BLOQUE);
        // "sub" se queda con la unidad siguiente
        const hJunto = altoJunto(i);
        // una captura que casi cabe se achica (hasta 35 %) en vez de saltar de hoja
        if (i > inicio && yy + gap + hJunto + CARD.padB > Y_LIMITE && !achicar(u, Y_LIMITE - CARD.padB - yy - gap)) break;
        yy += gap;
        cardPrims.push(...BLOQUES[u.t].dibujar(u, yy, u._alto));
        yy += u._alto;
        i++;
      }
      // si al empezar la sección solo cupo la introducción (roles, un párrafo
      // o un subtítulo) y lo siguiente no, la sección empieza en hoja nueva
      const soloIntro = i < us.length && tituloSec === sec.titulo && yBarra > Y_CONTENIDO &&
        us.slice(inicio, i).every((u) => ['roles', 'texto', 'sub'].includes(u.t)) && yy - yCard < 260;
      if (soloIntro) { prims.length = marca; i = inicio; nueva(); continue; }
      if (sec._pag == null) sec._pag = pagBarra;
      const hCard = yy + CARD.padB - yCard;
      sombra(prims, CARD.x, yCard, CARD.w, hCard, 10);
      prims.push({ t: 'path', d: rectRed(CARD.x, yCard, CARD.w, hCard, 10), fill: PAL.blanco, stroke: PAL.borde, sw: 1.3 });
      prims.push(...cardPrims);
      y = yCard + hCard + GAP_SECCION;
      if (i < us.length) { nueva(); tituloSec = `${sec.titulo} (cont.)`; }
    }
  });

  const total = paginas.length;
  paginas.forEach((pg, i) => pg.push(...pie(doc.pie.codigo, doc.pie.nombre, i + 1, total, medir)));
  return paginas;
}
