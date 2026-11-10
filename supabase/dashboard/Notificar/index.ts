// =====================================================================
// ARCHIVO GENERADO -- NO EDITAR A MANO.
// Edge Function "Notificar" en UN SOLO ARCHIVO, para pegarla en el editor del
// Dashboard de Supabase (Edge Functions -> Notificar -> Code -> reemplazar todo
// -> Deploy). El Dashboard no puede ver la carpeta _shared/, por eso aqui va
// todo junto. La fuente real es supabase/functions/notificar/index.ts + _shared/.
// Generado con: esbuild notificar/index.ts --bundle --format=esm --external:jsr:* --external:npm:*
// =====================================================================

// notificar/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

// _shared/sgc-layout.js
var ANCHO = 1416;
var ALTO = 1416 * 841.89 / 595.28;
var PAL = {
  fondo: "#F7F9FB",
  blanco: "#FFFFFF",
  borde: "#E2EAF2",
  sombra: "#0B2A5B",
  navy: "#021659",
  // texto fuerte (valores, datos en negrita)
  texto: "#3A5A85",
  // texto regular de la tabla
  azulEtiqueta: "#0A64B4",
  // etiquetas de las fichas
  azulIcono: "#0050A2",
  iconoCard: "#0A2466",
  etiquetaCard: "#1B4C86",
  valorCardSuave: "#3A5A80",
  cian: "#08B7F7",
  amarillo: "#FFC000",
  amarilloBarra: "#FFC300",
  ficha: "#F1F6FA",
  separador: "#D4DFE9",
  divisor: "#E6EEF5",
  filaAlterna: "#F0F5F9",
  lineaTabla: "#E3EBF2",
  pildora: "#D9F0FA",
  pildoraTexto: "#05205F",
  pieAcento: "#00BDF8",
  pieLinea: "#A9C3DB",
  pieFuerte: "#00417D",
  pieTexto: "#557AA2",
  pieSep: "#9AB0C8"
};
var K = 0.5523;
var n2 = (v) => Math.round(v * 100) / 100;
function rectRed(x, y, w, h, r = 0) {
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
  p.push("Z");
  return p.join(" ");
}
function poligono(pts, radios = null) {
  if (!radios) return "M" + pts.map(([x, y]) => `${n2(x)} ${n2(y)}`).join(" L") + " Z";
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const r = radios[i] || 0;
    const [px, py] = pts[(i - 1 + n) % n];
    const [nx, ny] = pts[(i + 1) % n];
    if (!r) {
      out.push(`${out.length ? "L" : "M"}${n2(x)} ${n2(y)}`);
      continue;
    }
    const l1 = Math.hypot(px - x, py - y), l2 = Math.hypot(nx - x, ny - y);
    const ax = x + (px - x) / l1 * r, ay = y + (py - y) / l1 * r;
    const bx = x + (nx - x) / l2 * r, by = y + (ny - y) / l2 * r;
    out.push(`${out.length ? "L" : "M"}${n2(ax)} ${n2(ay)}`);
    out.push(`C${n2(ax + (x - ax) * K)} ${n2(ay + (y - ay) * K)} ${n2(bx + (x - bx) * K)} ${n2(by + (y - by) * K)} ${n2(bx)} ${n2(by)}`);
  }
  out.push("Z");
  return out.join(" ");
}
var linea = (x1, y1, x2, y2) => `M${n2(x1)} ${n2(y1)} L${n2(x2)} ${n2(y2)}`;
function sombra(prims, x, y, w, h, r) {
  prims.push({ t: "path", d: rectRed(x - 1.5, y + 1, w + 3, h + 4, r + 1.5), fill: PAL.sombra, op: 0.035 });
  prims.push({ t: "path", d: rectRed(x - 0.5, y + 0.5, w + 1, h + 2, r + 0.5), fill: PAL.sombra, op: 0.04 });
}
function partirLineas(texto, medir, f, s, anchoMax) {
  const lineas = [];
  for (const parrafo of String(texto ?? "").split(/\r?\n/)) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) {
      lineas.push("");
      continue;
    }
    let actual = "";
    for (const p of palabras) {
      const prueba = actual ? actual + " " + p : p;
      if (medir(prueba, f, s) <= anchoMax || !actual) {
        actual = prueba;
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
function recortar(texto, medir, f, s, anchoMax) {
  let t = String(texto ?? "");
  if (medir(t, f, s) <= anchoMax) return t;
  while (t.length > 1 && medir(t + "\u2026", f, s) > anchoMax) t = t.slice(0, -1);
  return t.trimEnd() + "\u2026";
}
function fondoPagina(alto = ALTO) {
  return [
    { t: "path", d: rectRed(0, 0, ANCHO, alto, 0), fill: PAL.fondo },
    // brillos diagonales tenues de la esquina superior derecha
    { t: "path", d: poligono([[1352, 0], [1390, 0], [1416, 36], [1416, 88]]), fill: PAL.blanco, op: 0.55 },
    { t: "path", d: poligono([[1398, 0], [1416, 0], [1416, 22]]), fill: PAL.blanco, op: 0.7 }
  ];
}
var SISTEMA_NOMBRE = "SISTEMA DE GESTI\xD3N DE CALIDAD";
var SISTEMA_SIGLA = "SGC";
function encabezado(o, medir, y0 = 45) {
  const p = [];
  const dy = y0 - 45;
  const Y = (v) => v + dy;
  const m = 0.2232;
  const xNavy = (y) => 984.9 - (y - 45) * m;
  sombra(p, 33, Y(45), 400, 255.5, 9);
  p.push({ t: "path", d: rectRed(33, Y(45), 400, 255.5, 9), fill: PAL.blanco, stroke: PAL.borde, sw: 1.2 });
  p.push({ t: "img", key: "logo", x: 59, y: Y(140), w: 293, h: 61.2 });
  p.push({ t: "text", x: 353, y: Y(153), txt: "\xAE", f: "f500", s: 23, c: "#0E1F5B" });
  sombra(p, 948, Y(67), 436.5, 233.5, 10);
  p.push({ t: "path", d: rectRed(948, Y(67), 436.5, 233.5, 10), fill: PAL.blanco, stroke: PAL.borde, sw: 1.2 });
  const c0 = xNavy(45), c1 = xNavy(305);
  p.push({
    t: "path",
    d: poligono([[c0 - 30, Y(45)], [c0 + 21.8, Y(45)], [c1 + 22.6, Y(305)], [c1 - 30, Y(305)]], [0, 9, 9, 0]),
    fill: { lin: [c0, Y(45), c1 + 20, Y(305)], stops: [[0, "#05B4F6"], [1, "#0ABCFA"]] }
  });
  const panel = [[392.5, Y(45)], [xNavy(45), Y(45)], [xNavy(305), Y(305)], [355.7, Y(305)], [392.5, Y(238)]];
  p.push({
    t: "path",
    d: poligono(panel, [0, 2, 6, 0, 0]),
    fill: { lin: [392, Y(45), 985, Y(305)], stops: [[0, "#00255F"], [0.42, "#003A83"], [0.78, "#00559F"], [1, "#006EBA"]] }
  });
  p.push({ t: "path", d: poligono([[520, Y(150)], [xNavy(150) - 4, Y(150)], [xNavy(245) - 4, Y(245)], [470, Y(245)]]), fill: PAL.blanco, op: 0.035 });
  p.push({ t: "path", d: poligono([[392.5, Y(238)], [610, Y(238)], [690, Y(305)], [355.7, Y(305)]]), fill: "#00133F", op: 0.28 });
  p.push({ t: "path", d: poligono([[600, Y(52)], [xNavy(52) - 6, Y(52)], [xNavy(118) - 6, Y(118)], [650, Y(118)]]), fill: PAL.blanco, op: 0.025 });
  const xTxt = 444;
  p.push({ t: "text", x: xTxt, y: Y(101.1), txt: o.sistema || SISTEMA_NOMBRE, f: "mBlack", s: 21.8, c: PAL.blanco });
  const anchoTitulo = xNavy(166) - 22 - xTxt;
  let s = 31.9, lineas;
  for (; s >= 22; s -= 0.5) {
    lineas = partirLineas(String(o.titulo || "").toUpperCase(), medir, "mBold", s, anchoTitulo);
    if (lineas.length <= 2 && lineas.every((l) => medir(l, "mBold", s) <= anchoTitulo)) break;
  }
  if (lineas.length > 2) lineas = [lineas[0], recortar(lineas.slice(1).join(" "), medir, "mBold", s, anchoTitulo)];
  const bases = lineas.length === 1 ? [187] : [166.4, 166.4 + 42 * (s / 31.9)];
  lineas.forEach((l, i) => {
    p.push({ t: "text", x: xTxt + 1.2, y: Y(bases[i] + 1.6), txt: l, f: "mBold", s, c: "#000F33", op: 0.32 });
    p.push({ t: "text", x: xTxt, y: Y(bases[i]), txt: l, f: "mBold", s, c: PAL.blanco });
  });
  p.push({ t: "path", d: rectRed(xTxt, Y(271), 76, 7, 1.5), fill: PAL.amarilloBarra });
  p.push({ t: "text", x: 556, y: Y(282.3), txt: o.sigla || SISTEMA_SIGLA, f: "mBlack", s: 21.1, c: PAL.blanco });
  const filas = [
    { icono: "file-text", et: "C\xD3DIGO", val: o.codigo, fuerte: true },
    { icono: "calendar-days", et: "FECHA", val: o.fecha },
    { icono: "refresh-cw", et: "REVISI\xD3N", val: o.revision ?? "00" }
  ];
  const centros = [107, 183.5, 260];
  const largo = filas.some((fi) => medir(String(fi.val ?? ""), "f700", 24) > 1370 - 1221);
  const xSep = largo ? 1187 : 1197, xVal = largo ? 1204 : 1221;
  [146.2, 221.6].forEach((yy) => p.push({ t: "path", d: linea(1016, Y(yy), 1368, Y(yy)), stroke: "#DCE6EF", sw: 1.5 }));
  filas.forEach((fi, i) => {
    const yc = Y(centros[i]);
    p.push({ t: "icon", name: fi.icono, x: 1035, y: yc - 21, size: 42, c: PAL.iconoCard, sw: 1.9 });
    p.push({ t: "text", x: 1100.5, y: yc + 6.4, txt: fi.et, f: "f500", s: 18.6, c: PAL.etiquetaCard });
    p.push({ t: "path", d: linea(xSep, yc - 22, xSep, yc + 22), stroke: "#D5DFE9", sw: 1.6 });
    let sv = 24;
    const val = String(fi.val ?? "\u2014");
    while (sv > 16 && medir(val, "f700", sv) > 1372 - xVal) sv -= 0.5;
    const v = recortar(val, medir, "f700", sv, 1372 - xVal);
    p.push({ t: "text", x: xVal, y: yc + sv * 0.34, txt: v, f: "f700", s: sv, c: fi.fuerte ? PAL.navy : PAL.valorCardSuave });
  });
  return { prims: p, alto: 260 };
}
var ALTO_BARRA = 59.5;
function barraSeccion(numero, titulo, y0, medir) {
  const p = [];
  const h = ALTO_BARRA;
  const mA = 0.576, mN = 0.717, mF = 0.58;
  const tituloTxt = String(titulo).toUpperCase();
  const sT = 24.3;
  const finTitulo = 152.5 + medir(tituloTxt, "mBold", sT);
  const xe = Math.max(finTitulo + 122, 632.7);
  const yb = y0 + 16.3;
  const fx2 = (x0, y) => x0 + (y - yb) * mF;
  const finBanda = 1172.4;
  p.push({
    t: "path",
    d: poligono([[xe - 30, yb], [finBanda, yb], [fx2(finBanda, y0 + h), y0 + h], [xe - 30, y0 + h]]),
    fill: { lin: [xe, 0, finBanda, 0], stops: [[0, "#C8DBEC"], [1, "#DEE9F3"]] }
  });
  [[1188.4, 18], [1218.4, 18.5], [1247.9, 19.5]].forEach(([x0, w]) => {
    p.push({ t: "path", d: poligono([[x0, yb], [x0 + w, yb], [fx2(x0 + w, y0 + h), y0 + h], [fx2(x0, y0 + h), y0 + h]]), fill: "#E6EEF6" });
  });
  p.push({ t: "path", d: poligono([[1278.4, yb], [1364, yb], [1383.5, y0 + h], [fx2(1278.4, y0 + h), y0 + h]], [0, 4, 6, 0]), fill: "#EBF1F7" });
  const xA0 = 94.9, xA1 = xA0 + h * mA;
  p.push({
    t: "path",
    d: poligono([[xA0 - 2, y0], [xe, y0], [xe + h * mN, y0 + h], [xA1 - 2, y0 + h]]),
    fill: { lin: [xA0, 0, xe + h * mN, 0], stops: [[0, "#001D56"], [0.62, "#00286A"], [0.9, "#003C84"], [1, "#00539F"]] }
  });
  p.push({ t: "path", d: linea(xe - 0.6, y0 + 0.5, xe + h * mN - 0.6, y0 + h - 0.5), stroke: "#3AA7DE", sw: 2.2 });
  p.push({ t: "path", d: poligono([[34.5, y0], [xA0, y0], [xA1, y0 + h], [34.5, y0 + h]], [4, 0, 0, 4]), fill: PAL.amarillo });
  p.push({ t: "text", x: 67.5, y: y0 + 42.9, txt: String(numero), f: "mBlack", s: 36, c: "#0B1F4F", a: "middle" });
  p.push({ t: "text", x: 152.5, y: y0 + 38.5, txt: tituloTxt, f: "mBold", s: sT, c: PAL.blanco });
  return { prims: p, alto: h };
}
var FICHA = {
  x: [50.5, 723],
  w: 645,
  wFull: 1317.5,
  h: 88,
  gap: 15.6,
  iconCx: 47.5,
  iconSize: 44,
  sepX: 94,
  txtX: 113.5,
  etBase: 27.5,
  valBase: 62,
  sEt: 20.1,
  sVal: 25.2,
  lhVal: 30
};
function medirFichas(campos, medir) {
  const filas = [];
  let i = 0;
  while (i < campos.length) {
    const c = campos[i];
    if (c.ancho === "completo") {
      filas.push([c]);
      i++;
      continue;
    }
    const sig = campos[i + 1];
    if (sig && sig.ancho !== "completo") {
      filas.push([c, sig]);
      i += 2;
    } else {
      filas.push([c]);
      i++;
    }
  }
  return filas.map((fila) => {
    const anchoTxt = (fila.length === 1 && fila[0].ancho === "completo" ? FICHA.wFull : FICHA.w) - FICHA.txtX - 22;
    const lineas = fila.map((c) => partirLineas(c.valor ?? "\u2014", medir, "f700", FICHA.sVal, anchoTxt));
    const n = Math.max(...lineas.map((l) => l.length));
    return { fila, lineas, h: FICHA.h + (n - 1) * FICHA.lhVal };
  });
}
function tarjetaFichas(filasMedidas, y0, desde = 0, hasta = filasMedidas.length) {
  const p = [];
  const filas = filasMedidas.slice(desde, hasta);
  const altoFichas = filas.reduce((a, f) => a + f.h, 0) + (filas.length - 1) * FICHA.gap;
  const h = 16.5 + altoFichas + 17.5;
  sombra(p, 33, y0, 1351.5, h, 10);
  p.push({ t: "path", d: rectRed(33, y0, 1351.5, h, 10), fill: PAL.blanco, stroke: PAL.borde, sw: 1.3 });
  let y = y0 + 16.5;
  filas.forEach((fm, idx) => {
    const dos = fm.fila.length === 2;
    if (dos) {
      const yTop = idx === 0 ? y : y - FICHA.gap / 2, yBot = idx === filas.length - 1 ? y + fm.h : y + fm.h + FICHA.gap / 2;
      p.push({ t: "path", d: linea(709, yTop, 709, yBot), stroke: PAL.divisor, sw: 1.5 });
    }
    fm.fila.forEach((c, j) => {
      const completo = !dos && c.ancho === "completo";
      const x = completo ? FICHA.x[0] : FICHA.x[j];
      const w = completo ? FICHA.wFull : FICHA.w;
      p.push({ t: "path", d: rectRed(x, y, w, fm.h, 8), fill: PAL.ficha });
      const yc = y + Math.min(44, fm.h / 2);
      p.push({ t: "icon", name: c.icono || "file-text", x: x + FICHA.iconCx - FICHA.iconSize / 2, y: yc - FICHA.iconSize / 2, size: FICHA.iconSize, c: PAL.azulIcono, sw: c.icono === "barcode" ? 2.3 : 1.75 });
      p.push({ t: "path", d: linea(x + FICHA.sepX, y + 18, x + FICHA.sepX, y + fm.h - 18), stroke: PAL.separador, sw: 1.6 });
      p.push({ t: "text", x: x + FICHA.txtX, y: y + FICHA.etBase, txt: c.etiqueta, f: "f600", s: FICHA.sEt, c: PAL.azulEtiqueta });
      fm.lineas[j].forEach((l, k) => {
        p.push({ t: "text", x: x + FICHA.txtX, y: y + FICHA.valBase + k * FICHA.lhVal, txt: l, f: "f700", s: FICHA.sVal, c: PAL.navy });
      });
    });
    y += fm.h + FICHA.gap;
  });
  return { prims: p, alto: h };
}
var TABLA = { x: 38.5, w: 1342, hHead: 87, hMin: 88, lh: 24.5, sReg: 18.5, sBold: 19.5, sHead: 19.2, pad: 26 };
function anchosColumnas(columnas) {
  const total = columnas.reduce((a, c) => a + c.w, 0);
  let x = TABLA.x;
  return columnas.map((c) => {
    const w = c.w / total * TABLA.w;
    const r = { ...c, x, w };
    x += w;
    return r;
  });
}
function encabezadoTabla(cols, y0, medir, tam = TABLA) {
  const p = [];
  const h = TABLA.hHead;
  p.push({
    t: "path",
    d: rectRed(TABLA.x, y0, TABLA.w, h, [10, 10, 0, 0]),
    fill: { lin: [TABLA.x, 0, TABLA.x + TABLA.w, 0], stops: [[0, "#003174"], [0.72, "#00357B"], [0.87, "#0058A6"], [1, "#0A7FC3"]] }
  });
  const xr = TABLA.x + TABLA.w;
  p.push({ t: "path", d: poligono([[xr - 150, y0], [xr - 10, y0], [xr, y0 + 10], [xr, y0 + 30], [xr - 205, y0 + h], [xr - 260, y0 + h]], [0, 0, 0, 0, 0, 0]), fill: PAL.blanco, op: 0.05 });
  cols.forEach((c, i) => {
    if (i > 0) p.push({ t: "path", d: linea(c.x, y0, c.x, y0 + h), stroke: "#2D6AA1", sw: 1.4, op: 0.85 });
    const palabras = String(c.titulo).split(/\s+/);
    const cabe = (ancho, s) => palabras.every((w) => medir(w, "f600", s) <= ancho) && partirLineas(c.titulo, medir, "f600", s, ancho).length <= 2;
    let conIcono = !!c.icono, sH = tam.sHead ?? TABLA.sHead;
    const anchoCon = () => c.w - 63 - 10, anchoSin = () => c.w - 16;
    while (conIcono && !cabe(anchoCon(), sH) && sH > 15) sH -= 0.5;
    if (conIcono && !cabe(anchoCon(), sH)) {
      conIcono = false;
      sH = tam.sHead ?? TABLA.sHead;
    }
    while (!conIcono && !cabe(anchoSin(), sH) && sH > 13) sH -= 0.5;
    const xTxt = conIcono ? c.x + 63 : c.x;
    const lineas = partirLineas(c.titulo, medir, "f600", sH, conIcono ? anchoCon() : anchoSin()).slice(0, 2);
    const lh = 23.5 * sH / TABLA.sHead;
    const base0 = y0 + h / 2 + sH * 0.33 - (lineas.length - 1) * lh / 2;
    if (conIcono) p.push({ t: "icon", name: c.icono, x: c.x + 17, y: y0 + h / 2 - 18, size: 36, c: PAL.blanco, sw: 1.9 });
    lineas.forEach((l, k) => {
      p.push({ t: "text", x: conIcono ? xTxt : c.x + c.w / 2, y: base0 + k * lh, txt: l, f: "f600", s: sH, c: PAL.blanco, a: conIcono ? "start" : "middle" });
    });
  });
  return { prims: p, alto: h };
}
function medirFila(cols, valores, medir, tam = TABLA) {
  const celdas = cols.map((c, i) => {
    const v = valores[i] == null || valores[i] === "" ? "\u2014" : String(valores[i]);
    const f = c.estilo === "normal" ? "f400" : "f700";
    let s = f === "f400" ? tam.sReg : tam.sBold;
    const ancho = c.estilo === "pildora" ? c.w - 37 - 22 : c.w - (c.alinear === "centro" ? 16 : TABLA.pad + 14);
    const minimo = s * 0.8;
    while (s > minimo && v.split(/\s+/).some((w) => medir(w, f, s) > ancho)) s -= 0.5;
    let lineas = partirLineas(v, medir, f, s, ancho);
    if (lineas.length > 4) lineas = [...lineas.slice(0, 3), recortar(lineas.slice(3).join(" "), medir, f, s, ancho)];
    return { v, f, s, lineas };
  });
  const n = Math.max(1, ...celdas.map((c) => c.lineas.length));
  const lh = tam.lh ?? TABLA.lh;
  return { celdas, lh, h: Math.max(tam.hMin ?? TABLA.hMin, 39 + n * lh) };
}
function filaTabla(cols, fm, y0, indice, ultima) {
  const p = [];
  const h = fm.h;
  const fondo = indice % 2 === 1 ? PAL.filaAlterna : PAL.blanco;
  p.push({ t: "path", d: rectRed(TABLA.x, y0, TABLA.w, h, ultima ? [0, 0, 10, 10] : 0), fill: fondo });
  cols.forEach((c, i) => {
    if (i > 0) p.push({ t: "path", d: linea(c.x, y0, c.x, y0 + h), stroke: PAL.lineaTabla, sw: 1.5 });
    const cel = fm.celdas[i];
    const n = cel.lineas.length;
    const lh = fm.lh ?? TABLA.lh;
    const base0 = y0 + h / 2 + cel.s * 0.345 - (n - 1) * lh / 2;
    if (c.estilo === "pildora") {
      const pw = c.w - 37, ph = Math.max(h - 20, 30);
      p.push({ t: "path", d: rectRed(c.x + 18.5, y0 + (h - ph) / 2, pw, ph, 6), fill: PAL.pildora });
      cel.lineas.forEach((l, k) => p.push({ t: "text", x: c.x + c.w / 2, y: base0 + k * lh, txt: l, f: "f700", s: cel.s, c: PAL.pildoraTexto, a: "middle" }));
      return;
    }
    const centro = c.alinear === "centro";
    const color2 = c.estilo === "normal" ? PAL.texto : c.estilo === "numero" ? "#1A396C" : PAL.navy;
    cel.lineas.forEach((l, k) => p.push({
      t: "text",
      x: centro ? c.x + c.w / 2 : c.x + TABLA.pad,
      y: base0 + k * lh,
      txt: l,
      f: cel.f,
      s: cel.s,
      c: color2,
      a: centro ? "middle" : "start"
    }));
  });
  return { prims: p, alto: h };
}
function filaVacia(texto, y0) {
  return [
    { t: "path", d: rectRed(TABLA.x, y0, TABLA.w, TABLA.hMin, [0, 0, 10, 10]), fill: PAL.blanco },
    { t: "text", x: TABLA.x + TABLA.w / 2, y: y0 + TABLA.hMin / 2 + TABLA.sReg * 0.345, txt: texto, f: "f500", s: TABLA.sReg, c: PAL.pieTexto, a: "middle" }
  ];
}
function bordeTabla(y0, h, cerrada = true) {
  return [{ t: "path", d: rectRed(TABLA.x, y0, TABLA.w, h, cerrada ? [10, 10, 10, 10] : [10, 10, 0, 0]), stroke: "#DCE5EE", sw: 1.3 }];
}
function pie(codigo, nombre, pagina, total, medir, alto = ALTO, conPagina = true) {
  const p = [];
  const yl = alto - 93;
  p.push({ t: "path", d: linea(38, yl, 1380, yl), stroke: PAL.pieLinea, sw: 1.5 });
  p.push({ t: "path", d: rectRed(38, yl - 2.2, 58, 4.4, 2.2), fill: PAL.pieAcento });
  const yb = yl + 35.5;
  const s = 18;
  let x = 38.6;
  const tramo = (txt, f, c) => {
    p.push({ t: "text", x, y: yb, txt, f, s, c });
    x += medir(txt, f, s);
  };
  tramo("METALIUM", "f700", PAL.pieFuerte);
  tramo(" | ", "f400", PAL.pieSep);
  tramo(codigo, "f400", PAL.pieTexto);
  tramo(" | ", "f400", PAL.pieSep);
  tramo(nombre, "f400", PAL.pieTexto);
  if (conPagina) p.push({ t: "text", x: 1376, y: yb, txt: total > 1 ? `P\xE1gina ${pagina} de ${total}` : `P\xE1gina ${pagina}`, f: "f400", s, c: PAL.pieTexto, a: "end" });
  return p;
}
var Y_CONTENIDO = 332;
var Y_LIMITE = ALTO - 122;
function componerDocumento(doc, medir) {
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
          acum += filas[hasta].h + (hasta > desde ? FICHA.gap : 0);
          hasta++;
        }
        if (hasta === desde) {
          if (y > Y_CONTENIDO) {
            nueva();
            continue;
          }
          hasta = desde + 1;
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
      const tam = { ...TABLA, ...sec.tabla.tam || {} };
      const filas = sec.tabla.filas.map((v) => medirFila(cols, v, medir, tam));
      const altoTabla = ALTO_BARRA + 21 + TABLA.hHead + filas.reduce((a, f) => a + f.h, 0);
      const cabeEnHojaNueva = Y_CONTENIDO + altoTabla <= Y_LIMITE;
      if (y > Y_CONTENIDO && (y + altoTabla > Y_LIMITE && cabeEnHojaNueva && filas.length <= 8 || y + ALTO_BARRA + 21 + TABLA.hHead + (filas[0]?.h ?? TABLA.hMin) > Y_LIMITE)) nueva();
      prims.push(...barraSeccion(num, sec.titulo, y, medir).prims);
      y += ALTO_BARRA + 21;
      let k = 0;
      let continuacion = false;
      do {
        if (continuacion) {
          nueva();
        }
        const yTabla = y;
        prims.push(...encabezadoTabla(cols, y, medir, tam).prims);
        y += TABLA.hHead;
        const inicio = k;
        if (!filas.length) {
          prims.push(...filaVacia(sec.tabla.vacia || "Sin registros.", y));
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
function iconoParaCampo(etiqueta) {
  const e = String(etiqueta || "").toLowerCase();
  if (/registro/.test(e)) return "file-text";
  if (/código/.test(e)) return "barcode";
  if (/revisión/.test(e)) return "settings";
  if (/total/.test(e)) return "database";
  if (/folio|n° de solicitud|n°/.test(e)) return "hash";
  if (/estado|decisión/.test(e)) return "circle-check";
  if (/solicitante/.test(e)) return "user";
  if (/trabajador|candidato/.test(e)) return "hard-hat";
  if (/obra|centro|cliente/.test(e)) return "building-2";
  if (/cargo/.test(e)) return "briefcase";
  if (/cantidad/.test(e)) return "users";
  if (/sueldo|monto|bono/.test(e)) return "banknote";
  if (/tipo de contrato|contrato/.test(e)) return "file-signature";
  if (/tipo de renovación|renovación|condición/.test(e)) return "refresh-cw";
  if (/hito/.test(e)) return "flag";
  if (/colación/.test(e)) return "utensils";
  if (/turno|horario|plazo|tiempo/.test(e)) return "clock";
  if (/período|periodo/.test(e)) return "calendar-range";
  if (/creación|creada|asignado|decidido/.test(e)) return "calendar-clock";
  if (/fecha/.test(e)) return "calendar-days";
  if (/causal/.test(e)) return "tag";
  if (/motivo|observaci|modificaci/.test(e)) return "message-square";
  if (/etapa/.test(e)) return "truck";
  return "file-text";
}
var ICONOS = {
  "file-text": "M6 22a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2.4 2.4 0 0 1 1.704 .706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1 -2 2zM14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8",
  "calendar-days": "M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01",
  "refresh-cw": "M3 12a9 9 0 0 1 9 -9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1 -9 9 9.75 9.75 0 0 1 -6.74 -2.74L3 16M8 16H3v5",
  "barcode": "M3 5v14M6 5v14M8.5 5v14M11.5 5v14M14.5 5v14M17 5v14M20 5v14",
  "settings": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1 -2.33 4.033 2.34 2.34 0 0 0 -3.319 1.915 2.34 2.34 0 0 1 -4.659 0 2.34 2.34 0 0 0 -3.32 -1.915 2.34 2.34 0 0 1 -2.33 -4.033 2.34 2.34 0 0 0 0 -3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319 -1.915M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
  "database": "M3 5a9 3 0 1 0 18 0a9 3 0 1 0 -18 0zM3 5V19A9 3 0 0 0 21 19V5M3 12A9 3 0 0 0 21 12",
  "truck": "M14 18V6a2 2 0 0 0 -2 -2H4a2 2 0 0 0 -2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1 -1v-3.65a1 1 0 0 0 -.22 -.624l-3.48 -4.35A1 1 0 0 0 17.52 8H14M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0zM5 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
  "building": "M12 10h.01M12 14h.01M12 6h.01M16 10h.01M16 14h.01M16 6h.01M8 10h.01M8 14h.01M8 6h.01M9 22v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-16a2 2 0 0 1 2 -2z",
  "building-2": "M10 12h4M10 8h4M14 21v-3a2 2 0 0 0 -4 0v3M6 10H4a2 2 0 0 0 -2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2 -2V9a2 2 0 0 0 -2 -2h-2M6 21V5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16",
  "layers": "M12.83 2.18a2 2 0 0 0 -1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58 -3.9a1 1 0 0 0 0 -1.83zM2 12a1 1 0 0 0 .58 .91l8.6 3.91a2 2 0 0 0 1.65 0l8.58 -3.9A1 1 0 0 0 22 12M2 17a1 1 0 0 0 .58 .91l8.6 3.91a2 2 0 0 0 1.65 0l8.58 -3.9A1 1 0 0 0 22 17",
  "circle-check": "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM16 9l-5.5 5.5L8 12",
  "user": "M19 21v-2a4 4 0 0 0 -4 -4H9a4 4 0 0 0 -4 4v2M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z",
  "users": "M16 21v-2a4 4 0 0 0 -4 -4H6a4 4 0 0 0 -4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0 -3 -3.87M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z",
  "tag": "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0 -2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58 -6.58a2.426 2.426 0 0 0 0 -3.42zM7 7.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0z",
  "hash": "M4 9L20 9M4 15L20 15M10 3L8 21M16 3L14 21",
  "clock": "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM12 6v6l4 2",
  "briefcase": "M16 20V4a2 2 0 0 0 -2 -2h-4a2 2 0 0 0 -2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z",
  "banknote": "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2zM10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0zM6 12h.01M18 12h.01",
  "list-checks": "M13 5h8M13 12h8M13 19h8M3 17l2 2 4 -4M3 7l2 2 4 -4",
  "user-check": "M16 11l2 2 4 -4M16 21v-2a4 4 0 0 0 -4 -4H6a4 4 0 0 0 -4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z",
  "calendar-clock": "M16 14v2.2l1.6 1M16 2v3M21 7.338V5a2 2 0 0 0 -2 -2H5a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h2.338M3 9h5.859M8 2v3M10 16a6 6 0 1 0 12 0a6 6 0 1 0 -12 0z",
  "timer": "M10 2L14 2M12 14L15 11M4 14a8 8 0 1 0 16 0a8 8 0 1 0 -16 0z",
  "id-card": "M13 19a4 4 0 0 0 -8 0M16 10h2M16 14h2M6 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0zM4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z",
  "graduation-cap": "M21.42 10.922a1 1 0 0 0 -.019 -1.838L12.83 5.18a2 2 0 0 0 -1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0zM22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5",
  "file-signature": "M14.364 13.634a2 2 0 0 0 -.506 .854l-.837 2.87a.5 .5 0 0 0 .62 .62l2.87 -.837a2 2 0 0 0 .854 -.506l4.013 -4.009a1 1 0 0 0 -3.004 -3.004zM14.487 7.858A1 1 0 0 1 14 7V2M20 19.645V20a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2.4 2.4 0 0 1 1.704 .706l2.516 2.516M8 18h1",
  "calendar-x": "M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM3 9h18M14 13l-4 4M10 13l4 4",
  "infinity": "M6 16c5 0 7 -8 12 -8a4 4 0 0 1 0 8c-5 0 -7 -8 -12 -8a4 4 0 1 0 0 8",
  "message-square": "M22 17a2 2 0 0 1 -2 2H6.828a2 2 0 0 0 -1.414 .586l-2.202 2.202A.71 .71 0 0 1 2 21.286V5a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2z",
  "map-pin": "M20 10c0 4.993 -5.539 10.193 -7.399 11.799a1 1 0 0 1 -1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
  "clipboard-list": "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2h2M12 11h4M12 16h4M8 11h.01M8 16h.01",
  "hard-hat": "M10 10V5a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v5M14 6a6 6 0 0 1 6 6v3M4 15v-3a6 6 0 0 1 6 -6M3 15h18a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1z",
  "arrow-left-right": "M8 3 4 7l4 4M4 7h16M16 21l4 -4 -4 -4M20 17H4",
  "calendar-range": "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM16 2v3M3 9h18M8 2v3M17 13h-6M13 17H7M7 13h.01M17 17h.01",
  "scroll-text": "M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0 -2 -2H4M8 21h12a2 2 0 0 0 2 -2v-1a1 1 0 0 0 -1 -1H11a1 1 0 0 0 -1 1v1a2 2 0 1 1 -4 0V5a2 2 0 1 0 -4 0v2a1 1 0 0 0 1 1h3",
  "badge-check": "M3.85 8.62a4 4 0 0 1 4.78 -4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1 -4.77 4.78 4 4 0 0 1 -6.75 0 4 4 0 0 1 -4.78 -4.77 4 4 0 0 1 0 -6.76ZM16 9l-5.5 5.5L8 12",
  "circle-dollar-sign": "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6",
  "flag": "M4 22V4a1 1 0 0 1 .4 -.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067 -.8A1 1 0 0 1 20 4v10a1 1 0 0 1 -.4 .8A6 6 0 0 1 16 16c-3 0 -5 -2 -8 -2a6 6 0 0 0 -4 1.528",
  "utensils": "M3 2v7c0 1.1 .9 2 2 2h4a2 2 0 0 0 2 -2V2M7 2v20M21 15V2a5 5 0 0 0 -5 5v6c0 1.1 .9 2 2 2h3Zm0 0v7",
  "house": "M15 21v-8a1 1 0 0 0 -1 -1h-4a1 1 0 0 0 -1 1v8M3 10a2 2 0 0 1 .709 -1.528l7 -6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2z",
  "trending-up": "M16 7h6v6M22 7l-8.5 8.5 -5 -5L2 17",
  "shield-check": "M20 13c0 5 -3.5 7.5 -7.66 8.95a1 1 0 0 1 -.67 -.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1 -1c2 0 4.5 -1.2 6.24 -2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4 -4",
  "circle-x": "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM15 9l-6 6M9 9l6 6",
  "circle-dot": "M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0zM2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z"
};

// _shared/sgc-documentos.js
var ZONA = "America/Santiago";
function partes(d) {
  const o = {};
  for (const p of new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d)) o[p.type] = p.value;
  return o;
}
function fechaDMY(d, sep = "/") {
  const p = partes(d);
  return `${p.day}${sep}${p.month}${sep}${p.year}`;
}
function fechaHora(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "\u2014";
  const p = partes(d);
  return `${p.day}-${p.month}-${p.year} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
function duracion(ms) {
  if (ms == null || isNaN(ms)) return "\u2014";
  const h = ms / 36e5;
  if (h < 1) return Math.max(1, Math.round(ms / 6e4)) + " min";
  if (h < 48) return (Math.round(h * 10) / 10).toString().replace(".", ",") + " h";
  return (Math.round(h / 24 * 10) / 10).toString().replace(".", ",") + " d";
}
var capital = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "\u2014";
var dmyIso = (iso, sep = "-") => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}${sep}${m[2]}${sep}${m[1]}` : iso || "\u2014";
};
var APROBACION_AUTOMATICA = "Aprobaci\xF3n autom\xE1tica";
var esAprobacionAutomatica = (a) => a?.comentario === APROBACION_AUTOMATICA;
var LARGOS = /^(motivo|modificaciones|observaciones|hito de la obra|nueva condición)$/i;
function documentoComprobante(data, ref, hoy = /* @__PURE__ */ new Date()) {
  const { sol, cmap, aprs, pmap, trabNombre } = data;
  const tipoTxt2 = ref.tipoLabels[sol.tipo] ?? sol.tipo;
  const codigo = ref.documentoCodigos[sol.tipo]?.codigo ?? "\u2014";
  const nombre = `Comprobante de solicitud de ${tipoTxt2}`;
  const fecha = fechaDMY(hoy);
  const identificacion = [
    { etiqueta: "Registro", valor: `Solicitud de ${tipoTxt2}`, icono: "file-text" },
    { etiqueta: "Fecha del documento", valor: fecha, icono: "calendar-days" },
    { etiqueta: "C\xF3digo", valor: codigo, icono: "barcode" },
    { etiqueta: "Revisi\xF3n", valor: "00", icono: "settings" },
    { etiqueta: "Folio", valor: sol.folio || "\u2014", icono: "hash" },
    { etiqueta: "Estado", valor: capital(String(sol.estado ?? "")), icono: "circle-check" },
    { etiqueta: "N\xB0 de solicitud", valor: sol.codigo || "\u2014", icono: "clipboard-list" },
    { etiqueta: "Fecha de creaci\xF3n", valor: fechaHora(sol.created_at), icono: "calendar-clock" }
  ];
  const sol_p = pmap.get(sol.solicitante_id);
  const detalle = [
    { etiqueta: "Solicitante", valor: sol_p?.nombre ? sol_p.email ? `${sol_p.nombre} \xB7 ${sol_p.email}` : sol_p.nombre : "\u2014", icono: "user" }
  ];
  if (sol.tipo === "traslado") {
    detalle.push({ etiqueta: "Trabajador", valor: trabNombre ?? "\u2014", icono: "hard-hat" });
    detalle.push({ etiqueta: "Obra origen", valor: cmap.get(sol.centro_origen_id)?.nombre ?? "\u2014", icono: "building-2" });
    detalle.push({ etiqueta: "Obra destino", valor: cmap.get(sol.centro_destino_id)?.nombre ?? "\u2014", icono: "building-2" });
  } else if (sol.tipo === "ingreso") {
    detalle.push({ etiqueta: "Centro de costo", valor: cmap.get(sol.centro_origen_id)?.nombre ?? "\u2014", icono: "building-2" });
  } else {
    detalle.push({ etiqueta: "Trabajador", valor: trabNombre ?? "\u2014", icono: "hard-hat" });
    detalle.push({ etiqueta: "Centro de costo", valor: cmap.get(sol.centro_origen_id)?.nombre ?? "\u2014", icono: "building-2" });
  }
  for (const [k, v] of ref.detalleLineas(sol)) {
    const valor = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dmyIso(String(v)) : v;
    detalle.push({ etiqueta: k, valor, icono: iconoParaCampo(k), ancho: LARGOS.test(k) ? "completo" : void 0 });
  }
  if (sol.motivo) detalle.push({ etiqueta: "Motivo", valor: String(sol.motivo), icono: "message-square", ancho: "completo" });
  const cortas = detalle.filter((c) => c.ancho !== "completo");
  const largas = detalle.filter((c) => c.ancho === "completo");
  const filasAprob = aprs.slice().sort((a, b) => a.orden - b.orden).map((a) => {
    const ms = a.tiempo_respuesta != null ? a.tiempo_respuesta * 1e3 : a.decidido_at && a.asignado_at ? new Date(a.decidido_at).getTime() - new Date(a.asignado_at).getTime() : null;
    const auto = esAprobacionAutomatica(a);
    return [
      String(a.orden),
      auto ? `${pmap.get(a.aprobador_id)?.nombre ?? "\u2014"} (aprobaci\xF3n autom\xE1tica)` : pmap.get(a.aprobador_id)?.nombre ?? "\u2014",
      capital(String(a.decision ?? "pendiente")),
      fechaHora(a.asignado_at),
      a.decidido_at ? fechaHora(a.decidido_at) : "\u2014",
      auto ? "No requiere" : duracion(ms)
    ];
  });
  return {
    encabezado: { titulo: nombre, codigo, fecha, revision: "00" },
    pie: { codigo, nombre },
    secciones: [
      { titulo: "Identificaci\xF3n del registro", fichas: identificacion },
      { titulo: "Detalle del registro", fichas: [...cortas, ...largas] },
      { titulo: "Aprobaciones", tabla: {
        columnas: [
          { titulo: "N\xB0", w: 80, alinear: "centro", estilo: "numero" },
          { titulo: "Aprobador", icono: "user-check", w: 330, estilo: "fuerte" },
          { titulo: "Decisi\xF3n", icono: "circle-check", w: 190, estilo: "pildora" },
          { titulo: "Asignado", icono: "calendar-clock", w: 235, alinear: "centro", estilo: "normal" },
          { titulo: "Decidido", icono: "calendar-days", w: 235, alinear: "centro", estilo: "normal" },
          { titulo: "Tiempo de respuesta", icono: "timer", w: 272, alinear: "centro", estilo: "normal" }
        ],
        filas: filasAprob,
        vacia: "Sin aprobadores asignados."
      } }
    ]
  };
}

// _shared/sgc-pdf.ts
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFOperator,
  PDFOperatorNames,
  PDFNumber,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  lineTo,
  appendBezierCurve,
  closePath,
  clip,
  endPath,
  LineCapStyle
} from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

// _shared/fuentes-sgc.ts
var FUENTES_SGC_B64 = {
  mBlack: "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",
  mBold: "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",
  f400: "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",
  f500: "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",
  f600: "AAEAAAAOAIAAAwBgR0RFRgI6AqcAAD3kAAAALkdQT1NEdkx1AAA+FAAAACBHU1VCkxWCFgAAPjQAAAA2T1MvMlztd+MAADnEAAAAYGNtYXDOQ6vuAAA6JAAAAfpnYXNwAAAAEAAAPdwAAAAIZ2x5ZkkGdS0AAADsAAAy6GhlYWQJ9nqAAAA1yAAAADZoaGVhBfEE1QAAOaAAAAAkaG10eLlnCowAADYAAAADoGxvY2GT3ochAAAz9AAAAdJtYXhwAQcBlQAAM9QAAAAgbmFtZSCFOUcAADwgAAABnHBvc3T/uAAyAAA9vAAAACAAAv/3AAACUwK0AAcACgAAIScjByMTMxMBMwMBtyfZJ5nVs9T+gKFRm5sCtP1MAQgBP/////cAAAJTA7EAIgACAAAAAwDfAcsAAP////cAAAJTA6wAIgACAAAAAwDgAfwAAP////cAAAJTA5YAIgACAAAAAwDdAf8AAP////cAAAJTA7EAIgACAAAAAwDeAcYAAP////cAAAJTA9oAIgACAAAAAwDhAckAAP////cAAAJTA5IAIgACAAAAAwDiAfsAAAAC/+wAAAMgArQADwASAAAlMxUhJyMHIwEhByEXMxUjBTMDAjrm/qAd5TacARAB/hD+6Sf34P7SqzxsbJubArRrtmohAT8AAwBJAAACSAK0AA4AFwAfAAAAFhUUBiMjETMyFhUUBgcnFTMyNjU0JiMSNjU0IyMVMwHxV5yL2L2Olkk2z0g2Oj5CU0iAU0YBYUtNbVwCtFRdPUsN3K8tLi4m/iMpOWjKAAABACb/8AIxAsQAGgAAABYXByYjIgYVFBYzMjY3FwYGIyImJjU0NjYzAZtgLkk8QkpXV0snQCNEJW1CXYxOUIxYAsQlJlUxeYF+eR0bVSYxVKN0caNVAAEAJv7/AjECxAAsAAAkBgcVFhYVFAYjIiYnNxYzMjU0JiM3JiY1NDY2MzIWFwcmIyIGFRQWMzI2NxcCEVs4MzJPQCE3EyEfITArMQx5i1CMWEFgLkk8QkpXV0snQCNEJi4GJAUzKDI9EA1EESATEWARup1xo1UlJlUxeYF+eR0bVQACAEkAAAJjArQACAASAAAAFhUUBiMjETMHETMyNjU0JiYjAaDDv5XGtSI8VV0vTjgCtJPEwJ0CtGz+JGmIXmglAAACAA8AAAJwArQADAAaAAAAFhUUBiMjESM1MxEzEjY1NCYmIyMVMxUjFTMBrcO/lcZHR7VvXS9OODmNjTwCtJPEwJ0BM1wBJf24aYheaCW5XMcAAQBJAAAB6AK0AAsAAAEHIxUzFSMVIRUhEQHmEPra2gEM/mECtGu0ar9sArQA//8ASQAAAegDsQAiAA8AAAADAN8BvwAA//8ASQAAAegDrAAiAA8AAAADAOAB8AAA//8ASQAAAegDlgAiAA8AAAADAN0B8wAA//8ASQAAAegDsQAiAA8AAAADAN4BugAAAAEASQAAAdsCtAAJAAAzESEHIxUzFSMRSQGSEO/Q0AK0a8Rr/uYAAQAm//ACUALEAB0AAAAWFwcmJiMiBhUUFjMyNzUjJyERBgYjIiY1NDY2MwGwbS9NJUEpT2FLTzkuYQ8A/zZ9QJmeVpNbAsQrKFAcGn2Ah3UZqWv+qyEluLNxpFQAAAEASQAAAlQCtAALAAAhESMRIxEzETMRMxEBweWTk+WTAS/+0QK0/u8BEf1MAAABAEkAAADcArQAAwAAExEjEdyTArT9TAK0//8ADAAAARoDsQAiABcAAAADAN8BOAAA////2wAAAUsDrAAiABcAAAADAOABaQAA////1QAAAU4DlgAiABcAAAADAN0BbAAA//8ABwAAARUDsQAiABcAAAADAN4BMwAAAAH/+f9eAPUCtAALAAA3FAYGByc+AjURM/U3XEInLC0Qk2dQaDsWaREsOi4CSAACAEkAAAJ3ArQAAwAJAAATESMRIQMTIwMT3JMCHOf5rOnmArT9TAK0/sj+hAFxAUMAAAEASQAAAe4CtAAFAAATESEHIRHcARIQ/msCtP3CdgK0AAABACgAAALoArQAFAAAISMDJjU0NwMjAxYVFAcDIxMzExMzAuiQDwcBdYt9BAQPjza7cmu9ARl+WC8V/hcB6j1MUUT+6gK0/iMB3QAAAQBJAAACUwK0AA4AACEjAxYWFREjETMTJjURMwJTvdwJC4W54BSFAiVHfVT+8wK0/dqGcAEwAP//AEkAAAJTA5IAIgAgAAAAAwDiAikAAAACACb/8AKNAsQADwAbAAAAFhYVFAYGIyImJjU0NjYzBgYVFBYzMjY1NCYjAbmKSkqKX1+LSkuLXkxNTktMTExMAsRVonNxo1ZVo3Jwo1dueISEeHeFhXf//wAm//ACjQOxACIAIgAAAAMA3wH/AAD//wAm//ACjQOsACIAIgAAAAMA4AIwAAD//wAm//ACjQOWACIAIgAAAAMA3QIzAAD//wAm//ACjQOxACIAIgAAAAMA3gH6AAAAAwAm/3sCjQM6ABcAHwAnAAAAFhUUBgYjIicHJzcmJjU0NjYzMhc3FwcGBhUUFxMmIxI2NTQnAxYzAkJLSopfHxckcShGS0uLXh4XJXAp7U0wixYMTEwxixISAnGjdHGjVgR5HoEqo3Nwo1cEeh6BRXiEmzkBzgL+CHeFnzf+MQMA//8AJv/wAo0DkgAiACIAAAADAOICLwAAAAIASQAAAjsCtAAKABIAAAAWFRQGIyMVIxEzEjY1NCMjFTMBppWUfE+T1kBEhkFDArRwb3R17AK0/qQ6Q3XyAAACAEkAAAI7ArQADAAUAAAAFhUUBiMjFSMRMxUzEjY1NCMjFTMBppWUfE+Tk0NBQ4ZBQwJFcXB4d3UCtG/+nDtHePoAAAIAJv94ArMCxAAVACEAACQWFwcmJiMiJiY1NDY2MzIWFhUUBgckFjMyNjU0JiMiBhUCKWAqWTt1WVuHSUuLXl+KSlhK/tZOS0xMTExMTSsgHnU9PlShcnCjV1Wic3WRKat4d4WFd3iEAAACAEkAAAJiArQADQAWAAABIxEjETMyFhUUBgcTIwMzMjY1NCYjIwEnS5PYi4xDRrOn3007PD9DQgEP/vECtGdoRFgf/tYBdzU5NTEAAQAN//ACGQLEACkAAAAWFwcmJiMiBhUUFhYXFhYVFAYGIyImJzcWFjMyNjU0JiYnJiY1NDY2MwFnby9GJUoqLjcXOjpnZkB6UlKALksoVjM2QRc4NXFhPm5GAsQrLFEeHCckGSAcEiFhWkBhNzQtUyIjMi0cJR4QI2JPOlkwAAABAAoAAAIUArQABwAAAQcjESMRIzUCFBCvk7gCtHP9vwJBcwABAD//8AJOArQAEgAAJRQGBiMiJjURMxEUFjMyNjURMwJOPHdVgIeTODw8OZPkR24/hW8B0P43RkVFRgHJ//8AP//wAk4DsQAiAC8AAAADAN8B7AAA//8AP//wAk4DrAAiAC8AAAADAOACHQAA//8AP//wAk4DlgAiAC8AAAADAN0CIAAA//8AP//wAk4DsQAiAC8AAAADAN4B5wAAAAH/9wAAAj8CtAAGAAABAyMDMxMTAj/Hs86djYgCtP1MArT9xgI6AAABAA0AAAM8ArQADAAAAQMjAwMjAzMTEzMTEwM8eb9gZbp4k09pm2VZArT9TAId/eMCtP2+AkL9vgJCAAAB//4AAAI9ArQACwAAARMjAwMjEwMzFzczAXPKooF/ncW1oW1ynAF1/osBEv7uAXABROfnAAAB//wAAAJLArQACAAAAQMRIxEDMxMTAkvek96hiokCtP5R/vsBBAGw/sYBOgD////8AAACSwOxACIANwAAAAMA3wHJAAAAAQAVAAAB/AK0AAkAAAEVASEHITUBITUB9/7KATsQ/ikBPP7kArRx/jR3bwHRdAAAAgAf//ACAgIiABwAJQAAJBYXByYmJwYjIiY1NDYzMzU0JiMiByc2MzIWFRUGNzUjIhUUFjMB2xIVHi87EDRrT11+dj0sMzhUIGNhbGatIi9zIyF0HQdeBCQmUFtJV1waMSYcXyddXNY9O2VWIycA//8AH//wAgIDOwAiADoAAAADANcBrQAA//8AH//wAgIDLwAiADoAAAADANgB4wAA//8AH//wAgIDGAAiADoAAAADANQB5wAA//8AH//wAgIDOwAiADoAAAADANYBvAAA//8AH//wAgIDXAAiADoAAAADANkBsAAA//8AH//wAgIDFAAiADoAAAADANoB4gAAAAMAH//wAzUCIgApADAAPQAAAAchFhYzMjY3FwYjIiYnBgYjIiY1NDYzMzU0JiMiByc2MzIXNjMyFhYVJyYjIgYHMwQ2NyYnNSMiBhUUFjMDNQP+tQdANyI8IztZcERoISNePFFegXg9KzM6UiFjYW8yPmNFaDiMAl4sMQXC/nAzFwoCLzo5IyEBCy1IPBYYUEgwLDIqW0lXXBkxJhxgJ0ZGQHpTKIRBSeEkJCUtAyksIiYAAAIARv/wAikC9QAQABoAAAAWFRQGBiMiJwcjETcRNjYzEjU0JiMiBxUWMwHCZzNfQFc0CH6OGUwsMDEuOSkjOAIilIVSf0hENALlEP7kIif+N7BhT0TjOQABACb/8AHTAiIAGQAAABYXByYmIyIVFBYzMjY3FwYjIiYmNTQ2NjMBWFUmPhoxHXE6NhwuHz5MYk5zPj5zTAIiHyFUFBKuWEwRFFk+RH1UVIFIAAABACb+/wHTAiIAKwAABAcVFhYVFAYjIiYnNxYzMjU0JiM3JiY1NDY2MzIWFwcmJiMiFRQWMzI2NxcBkFAzMk9AITcTIR8hMCsxDV5pPnNMNVUmPhoxHXE6NhwuHz4IByMFMygyPRANRBEgExFiEZBvVIFIHyFUFBKuWEwRFFkAAAIAK//wAhEC9QAPABwAAAERIycGIyImNTQ2NjMyFxECNjc1JiYjIgYVFBYzAhF9CDhgYmc1YkBKN0YwFhUrHDE3MS4C5f0bQVGXglJ/SDUBCP1lHyHtGRlWWl9QAAACACb/8AIVAxkAHwAqAAAAFhUUBgYjIiYmNTQ2NjMyFhcmJicHJzcmJzcWFzcXBwI2NScmIyIVFBYzAcNSPHJNRW9ANF48KkIcDTIrO1s9KTccUz9JSzoSNgEqQmE1LwJXv4ZThEs8cU1CcEIaGTJNIjsrQA4LXw8ZTUE8/b1VVEUyjEpKAAIAJv/wAgYCIgAVABwAAAAHIRYWMzI2NxcGIyImNTQ2NjMyFhUnNCMiBgczAgYD/rUHQDciPCM7WXB9hjltS3F+jV8sMQXBAQstSDwWGFBIloBRgUqOfyiEQUn//wAm//ACBgM7ACIARwAAAAMA1wG6AAD//wAm//ACBgMvACIARwAAAAMA2AHwAAD//wAm//ACBgMYACIARwAAAAMA1AH0AAD//wAm//ACBgM7ACIARwAAAAMA1gHJAAAAAQAEAAABpgL1ABUAAAAGFRUzByMRIxEjNTM1NDYzMhcHJiMBBR9+EG6OVFRlXUpCJysrAosiJjFk/lIBrmQ1TWEgXhQAAAIAC/8kAiACYgA4AEMAAAEGIxYWFRQGBiMiJwYVFBYzMzIWFhUUBiMiJiY1MxQWFjMyNjU0JiMjIiY1NDY3JiY1NDY2MxY2NwQGFRQWMzI2NTQjAiA0ZTIwNWNCIxsUGSRRO1kxi4NebSx/FDUyRTcqKU5PTiEdMS05Z0JSajz+4y8vKSssWAH1FBZBMTNRLgcNFhATJ0UsUVsnSjgaHw8iHxweOy0cNRIbSTM6Vy8CICKfMywtNDIxXQAAAQBGAAACAgL0ABIAAAAWFREjETQmIyIHESMRNxE2NjMBs0+OHhw4Lo6OIEsvAiJVS/5+AWorI0n+kQLlD/7iJib//wA2AAAA4wMjACIAUAAAAAMA1QEBAAAAAQBGAAAA1AISAAMAABMRIxHUjgIS/e4CEv//AAEAAAEPAzsAIgBQAAAAAwDXAS0AAP///9UAAAFFAy8AIgBQAAAAAwDYAWMAAP///9AAAAFJAxgAIgBQAAAAAwDUAWcAAP//ABAAAAEeAzsAIgBQAAAAAwDWATwAAP///9r/JQDiAyMAIgBWAAAAAwDVAQAAAAAB/9r/JQDTAhIACwAANxQGBgcnPgI1ETPTMVZDLycsGI41UGc/GmcSIzswAeYAAgBGAAACJQL1AAMACQAAExEjEQUHEyMDN9SOAdCpuKGrqgL1/QsC5dPp/tcBIvAAAQBB//ABJQL1AAwAABYmNRE3ERQzMjcXBiOJSI4dEAwdKTIQS0UCZRD9jyMGZRIAAQBGAAADDwIiACAAAAAWFREjETQjIgYHESMRNCMiBgcRIxEzFzY2MzIWFzY2MwLCTY40HCoWjjQcKhWOewseSzEtQg8hTTECIlZK/n4Bak4kJv6SAWpOJSX+kgISQigqLSkrKwAAAQBGAAACAgIiABMAAAAWFREjETQmIyIGBxEjETMXNjYzAbROjh0dHjEXjnsLIU8yAiJVS/5+AWorIyUl/pICEkMpKv//AEYAAAICAxQAIgBaAAAAAwDaAfwAAAACACb/8AIiAiIADQAZAAAAFhUUBgYjIiY1NDY2MwYGFRQWMzI2NTQmIwGchj1zTneHPXNPNjU1NTU1NDUCIpWEVH9GlYRUf0ZqVVpaVVVaWlX//wAm//ACIgM7ACIAXAAAAAMA1wHEAAD//wAm//ACIgMvACIAXAAAAAMA2AH6AAD//wAm//ACIgMYACIAXAAAAAMA1AH+AAD//wAm//ACIgM7ACIAXAAAAAMA1gHTAAAAAwAm/3oCIgKYABcAHgAmAAAAFhUUBgYjIicHJzcmJjU0NjYzMhc3FwcEFRQXEyYjEjY1NCcDFjMB6Do9c04MGiVqKDY7PXNPDRgnair/AB5qBg44Oh5pBg4B3H1WVH9GAngffCF9VlR/RgJ4H3xFr2knAT4B/qJWWWol/sMBAP//ACb/8AIiAxQAIgBcAAAAAwDaAfkAAAACAEb/JAIpAiIAEAAbAAAAFhUUBgYjIicVBxEzFzY2MxI1NCYjIgYHFRYzAchhMl9BUTKOfQceUSsxLi8eMxMiNwIik4VRgEk59RAC7j4nJ/44r2BQJR/nNAACAEb/JAIpAvUAEAAbAAAAFhUUBgYjIicVBxE3ETY2MxI1NCYjIgYHFRYzAchhMl9BUTKOjh1KJzMvMB0yEyI3AiKThVGASTnzEgPBEP7oJCH+OK9gUCUf5zQAAAIAK/8kAhECIgAPABwAAAERJxEGIyImNTQ2NjMyFzcCNjc1JiYjIgYVFBYzAhGON1hiZzVhQVE7CFkwFhUqHDE4MS4CEv0SEAECRpeCUn9IQTH+SB8h7RkZVlpfUAABAEYAAAGNAiEADwAAABcHJiMiBgcRIxEzFzY2MwFwHRgcEy80D457DRNJLgIhCIkHQkP+7gISZzg+AAABAAv/8AHIAiIAJgAAABcHJiMiBhUUFhYXFhYVFAYGIyImJzcWMzI2NTQmJicmJjU0NjYzAWZQNkNBIyYRLy9UUj1oQENuJ0ZDSygvEjAzUE00Xz8CIkBRKhoWEBYUDhdNQzVOKSkkTjQfGxUYFQ4WUTwtSCkAAQBG//ACQwL1ADMAAAAWFhUUBgcGBhUUFhceAhUUBgYjIic3FjMyNjU0JicmJjU0Njc2NjU0JiMiFREjETQ2MwFnWzAfHhYUHiIlMCM0WTc+NCoVIh8kJycqKxoYFRYlH1OOdm0C9ShEKCYxGxQbEhUfGBosRjE3UiwaYQwlIyUwHB82LCQrFxQjGx0hdf3mAhdodgAAAQAE//ABgwKXABYAACUGBiMmJjURIzUzNTcVMwcjERQWMzI3AYMdSSRSVE9PjnoObBobGyEZFBUBXFkBCGR0EYVk/vsmIhIAAQBB//AB+AISABIAACEjJwYGIyImNREzERQWMzI3ETMB+HsHHFA1SEyOHB45KI5HLCtXTgF9/pUqI0UBc///AEH/8AH4AzsAIgBqAAAAAwDXAb0AAP//AEH/8AH4Ay8AIgBqAAAAAwDYAfMAAP//AEH/8AH4AxgAIgBqAAAAAwDUAfcAAP//AEH/8AH4AzsAIgBqAAAAAwDWAcwAAAAB//4AAAH+AhIABgAAAQMjAzMTEwH+qqmtmmlrAhL97gIS/l0BowAAAQAIAAAC3QISAAwAAAEDIwMDIwMzExMzExMC3XGtTEyrdI9BWI5PSAIS/e4Bk/5tAhL+VwGp/lcBqQAAAf/5AAACAAISAAsAAAETIycHIxMnMxc3MwFSrqNlY5yunKBTUZgBHP7kzc0BF/uwsAAB//7/JAICAhIADQAABQYGByc2NjcjAzMTEzMBVyCJdQ9MRxcxpZdqcJMBZW4IZgo0OAIS/koBtgD////+/yQCAgM7ACIAcgAAAAMA1wGgAAD////+/yQCAgMYACIAcgAAAAMA1AHaAAAAAQAQAAABsQISAAkAAAEVAzMHITUTIzUBrPn+Dv5t+eQCEmX+wW5mAT9tAAADADMAAAHKArQAHgAnACsAAAE1NCYjIgcnNjYzMhYVFRQWFwcmJicGBiMiJjU0NjMWNzUjIhUUFjMHIRUhASUgJzA/HihUJVxVDRAaJzIPFUMoP0xnYRMXHVEYF60Bkf5vAg8OIRkVVA8PR0iVFhUFVAMaGx4cRjhBRqkfRDgVFvdvAAADACkAAAHLArQACwAXABsAAAAWFRQGIyImNTQ2MwYGFRQWMzI2NTQmIwM1IRUBXG9wYWJvcWEnJSUmJyQkJs4BmwK0cGVic3BmYXNeOT0/OTk+Pzj9qm9vAAABAEb/JQITAhIAGgAABSYmJwYGIyImJxYWFRUHETMRFDMyNxEzERQXAZEKCAYWOiMeLBESEIeOOTomjhgQFSEjJiwUGCM+L18PAu3+kkNIAWn+pGhOAAIAKv/wAhkCrwALABsAAAAWFRQGIyImNTQ2Mw4CFRQWFjMyNjY1NCYmIwGbfn95eX5+eSQsFRUsJCQsFhYsJAKvtaqqtraqqrVqL2tbW2svLmtcXWstAAABABIAAAFvAqIABgAAAREjEQcnNwFvi5Q+4AKi/V4CFltghwABAAsAAAHcAq8AGAAAABYWFRQGBgchByE1PgI1NCYjIgYHJzYzATJmNS9xbAEbEP5TfnAuMiolOiBVVosCrzNXNTdmgGVuZ358Vi0rMiEmRHEAAQAB//AB3AKvACgAAAAWFhUUBgcWFhUUBgYjIic3FhYzMjY1NCYjIzczMjY1NCYjIgYHJzYzATBjM0Y+RFY7ck6PUU0iQic0PTo6NxElLzgzLCZAH0ddfQKvLU4wPVERB1RLOl43ZEoiHjgyNjBkMi0nLBweTVgAAQAfAAACFgKxAA4AAAEVIxUjJyE1ExcDMzczFQIWT4oB/uPCeKeMD3oBAmyWlmABuy3+fqWlAAABABD/8AHsAqIAHAAAASMVNjMyFhYVFAYGIyInNxYzMjY1NCMiBgcjESEBvvkxNThXMkB1TYJYUDhONz1mFicXYwGSAjubFzRjQ0ZrPGJLQEI+dwsNAWYAAgAq//ACEAKvABgAIwAAABYWFRQGBiMiJjU0NjYzMhcHJiMiBgc2MxI2NTQmIyIHFhYzAYdXMjtsRn96RYBXVz80LjE9SgU8VwIvKys9MQIvNgHDNGNGRnBArZlxq10rVxtqYEX+lUpCQjk+bF0AAAEAEP/xAbkCogAGAAABFQMnEyE1Abn4geb+6gKiYv2xKwIabAAAAwAh//ACHAKvABcAJAAwAAAAFhUUBgYjIiYmNTQ3JjU0NjYzMhYVFAcmBhUUFhcXNjY1NCYjEjY1NCYnJwYVFBYzAdlDPnROTHI9f2Q8Z0BigW6eMCwwFCQeLio0OTJAIEs8NAFKWTs3WzQ0WTZyODlmNlEsXFFeOuQrKSUtEwcXMyMmLf4KNCsrMhcLJ1YtNAACAB//5QIEAq8AFAAfAAAAFhUUBgYHJzY2NwYjIiYmNTQ2NjMSNzYmIyIGFRQWMwGHfVWwkB6EhxA2WDVXM0BuRDYsAS02LzUxKQKvjneJsWsgZSFpXUU2ZENFaDn+o0BjUz88QDsAAAEALgAAASUBpAAGAAABESMRByc3ASVqXi+WAaT+XAE9OEhXAAEAKQAAAWYBrQAYAAAAFhUUBgYHMwchNT4CNTQmIyIGByc2NjMBDFEdSUW0C/7eTkkdHRkXJRM/G04xAa1HNSA6SzlTTEhLMRgYGxQWMSMoAAABACX/9QFrAa0AJAAAABYVFAYHFhYVFAYjIic3FjMyNjU0JiMjNzMyNjU0JiMiByc2MwENTy8tMTpbUWE5PCcwHiQjIyQMGR0gHhovJjdAWAGtPTAkMwsEMy84S0E5KB0bHRpKGhcVFyM5OgABAB0AAAFyAa0ADgAAJRUjFSM1IzUTFwczNzMVAXIwZ757W2dREVSnUFdXSAEOIeVhYQAAAQAuARABJQK0AAYAAAERIxEHJzcBJWpeL5YCtP5cAT04SFcAAQAlAQUBawK9ACQAAAAWFRQGBxYWFRQGIyInNxYzMjY1NCYjIzczMjY1NCYjIgcnNjMBDU8vLTE6W1FhOTwnMB4kIyMkDBkdIB4aLyY3QFgCvT0wJDMLBDMvOEtBOSgdGx0aShoXFRcjOTr//wAuAUEBJQLlAAcAgwAAAUH//wApAUEBZgLuAAcAhAAAAUH//wAlATYBawLuAAcAhQAAAUEAAf9Z/6wBRwL1AAMAABMXASfzVP5mVAL1KvzhKgD//wAu/6wDlgL1ACIAhwAAACMAjAGQAAAAAwCEAjAAAP//AC7/rAOiAvUAIgCHAAAAIwCMAZAAAAADAIYCMAAA//8AJf+sA6IC9QAiAIgAAAAjAIwBkAAAAAMAhgIwAAAAAQALAVABtALlAA4AAAEHFwcnByc3JzcXJzMHNwG0kGZlRkRlZI8mgxN9E4ICHhppSoCBSmkadD6SlEEAAQBR/5IBtwMuAAMAABMTBwPM63zqAy78gR0DgAAAAQAiAN8AzQGKAAsAABIWFRQGIyImNTQ2M5syMiQjMjIjAYoyIyMzMyMjMgABACcA0gEuAdkACwAAEhYVFAYjIiY1NDYz40tLOThLSzgB2Uw4OEtMODhL//8AIv/wAM0B+gAiAJoAAAAHAJoAAAFfAAEAHf9SAM0AmwAOAAA2FhUUBgcHIzcmJjU0NjOcMQ0PQVMqERQxJJsxJBQrI5KuCyUWJDEA//8AIv/wArcAmwAjAJoA9QAAACMAmgHqAAAAAgCaAAAAAgAj//AAzgK0AAMADwAAEwMjAxIWFRQGIyImNTQ2M8MRdBNxMjIkIzIyIwK0/kUBu/3nMiMjMzMjIzIAAgAj/zAAzgH6AAsADwAAEhYVFAYjIiY1NDYzExMjE5wyMiMkMjIkOhKYEgH6MyMjMjIjIzP+9P5CAb4AAgAPAAACFAKiABsAHwAAASMHMxUjByM3IwcjNyM1MzcjNTM3MwczNzMHMwM3IwcCFEcaPEgUdhRyFHYUOkYaO0gSdhJyEnYSOtcachoBusZglJSUlGDGYIiIiIj+2sbGAAABACL/8ADNAJsACwAANhYVFAYjIiY1NDYzmzIyJCMyMiObMiMjMzMjIzIAAAIAEv/wAcoCxAAdACkAAAAWFhUUBgYHBgYVFSM1NDY2NzY2NTQmIyIHJzY2MxIWFRQGIyImNTQ2MwE6YDAcKCEoJ4MdKR8gHSkkRDZcLHBIBDIyJCQxMSQCxC1LLCk6IxcbLSQeIy5AJhUVIBkfIT9HMzb91zIjIzMyJCMyAAIAEv8jAcoB+gALACkAABImNTQ2MzIWFRQGIwImJjU0NjY3NjY1NTMVFAYGBwYGFRQWMzI3FwYGI+IyMiQkMTEkZGAwHCkhKCaDHSggIB0pJEM3XCxwSAFPMiMjMzIkIzL91C1LLSk6JBYbKyMhJi4/JRUVIBkfIUBIMzYA//8AMwGhAXsCtAAiAJ4AAAADAJ4AxAAAAAEAMwGhALcCtAADAAATAzMDRRKEEgGhARP+7f//AB3/UgDNAfoAIgCVAAAABwCaAAABXwABAFH/kgG3Ay4AAwAAARcDJwE8e+p8Ay4c/IAdAAABAAv/XAH9/80AAwAAFzUhFQsB8qRxcQABAA3/dQElA0cAIAAAASIGFRUUBgcWFhUVFBYzFSImJjU1NCYjNTI2NTU0NjYzASUuIy8yMjAjLVNdJhwmJhwmXVMC4hsixzw4DQw3PMciG2UjRji9LSN1JC29OUUjAAABAB//dQE2A0cAIAAAEhYWFRUUFjMVIgYVFRQGBiM1MjY1NTQ2NyYmNTU0JiM1cl0lHCYmHCVdUy0jMDEyLyMtA0cjRTm9LSR1Iy29OEYjZRsixzw3DA04PMciG2UAAQAp/4cBJAM1AAcAAAEVIxEzFSMRASR0dPsDNWz9KWsDrgAAAQAf/4cBGgM1AAcAAAERIzUzESM1ARr7dHQDNfxSawLYawAAAQAX/2UBMgNXAA8AAAEGBhUUFhcHLgI1NDY2NwEySEJCSFtBTDMzTEEDGmjJi4vJaD1aga9vb6+BWgAAAQAT/2UBLQNXAA8AABIWFhUUBgYHJzY2NTQmJzeuTDMzTEFaSEJCSFoC/YGvb2+vgVo9aMmLi8loPQAAAQAYAQEDAwFxAAMAABM1IRUYAusBAXBwAAABABgBAQHwAXEAAwAAEzUhFRgB2AEBcHAAAAEAMAEBAWYBcQADAAATNSEVMAE2AQFwcAAAAQAwAQEBZgFxAAMAABM1IRUwATYBAXBwAP//ACkAEwI+AicAIgCuAAAAAwCuAQQAAP//ACkAEwI6AicAIgCvAAAAAwCvAQAAAAABACkAEwE6AicABgAAExcHFwcnNeNXg4NXugInOtDQOtxbAAABACkAEwE6AicABgAAExcVByc3J4C6uleCggIn3VvcOtDQAAACACcB1AGVAvwADQAbAAASJjU0Njc3MwcWFRQGIzImNTQ2NzczBxYVFAYjVS4MDkFMKSIvIaUuDA5BTCkiLyEB1CwhESYehpwYKCAsLCERJh6GnBgoICz//wAhAdMBjwL7ACcAtAAAAnUABwC0AMcCdQABACcB1ADOAvwADQAAEiY1NDY3NzMHFhUUBiNVLgwOQUwpIi8hAdQsIREmHoacGCggLAD//wAhAdMAyAL7AAcAtAAAAnUAAQAh/14AyACGAA0AADYWFRQGBwcjNyY1NDYzmi4MDkFMKSIvIYYsIREmHoacGCggLAABACb/YQHTArIAHAAAJQYHFSM1JiY1NDY3NTMVFhcHJiYjIhUUFjMyNjcB0zpDal1pa1xpRTg+GjEdcTo2HC4fLi8Lk5QRkG9vlxKVlAsxVBQSrlhMERQAAgAUAFACHAJbABsAJwAAAAcXBycGIyInByc3JjU0Nyc3FzYzMhc3FwcWFQY2NTQmIyIGFRQWMwHzIktCTTRCQTNOQU0iIUxCTjNAQjVNQUsipzU1MzI1NTIBEjVKQ0weH01DTDVBQTVOQk4fH05CTDVDdD04Nz09Nzg9AAEADf9gAgQDPQApAAAkBgcVIzUmJzcWMzI2NTQmJicmJjU0Njc1MxUWFwcmIyIGFRQWFhcWFhUCBGFWaoNTSklfND8WNjRsXWZUal1HREBSLDUWNzhkYXhsEJyWClNQQzArGyQcECJeS0pkC5OUDkJPOSUjGB4cER9eVwABAA3/8AI+Aq8AJQAAJBYzMjcVBgYjIiYnIzczNSM3MzY2MzIXByYmIyIGBzMHIxUzByMBAks/Q00pSixxkRdXFD9TFEQcmWhoVDMgPiY0ShL1FOjYE8GaQCpuExN9ck1LTm19OVgVE0BBTktNAAEAHwAAAgcCrwAhAAA2BgchByE1PgI1NSM1MzU0NjMyFhcHJiYjIgYVFTMVIxX9GiUBNhD+OyQkC0REa2RBYCVYFS0fKCm/v7k3FG5oCx8rJVhMX1pwLzBBHBgxLl5MUgAAAf/8AAACNQKiABYAAAEDMxUjFTMVIxUjNSM1MzUjNTMDMxMTAjW0ZYaGho6GhoZktJiIhgKi/r1OTE14eE1MTgFD/uQBHAAAAQA0AHoB1wIeAAsAAAEVMxUjFSM1IzUzNQFBlpZ4lZUCHptvmppvmwAAAQA0ARUBzwGEAAMAABM1IRU0AZsBFW9vAAABADwAbQHGAfgACwAAARcHFwcnByc3JzcXAXdPdXVPdHhPdHRPdAH4UHN4UHp6UHN4UHr//wA0AAkBzwKQACcAmgCKABkAJwCaAIoB9QACAL0AAP//ADQArQHPAeoAJgC9AGYABgC9AJgAAQAmAGAB3AI6AAYAABMFFQUnJSVUAYj+eC4BP/7BAjqtgK1phIYAAAEAJgBgAdwCOgAGAAABFwUFByU1Aa4u/sEBPy7+eAI6Z4aEaa2AAP//ADUAAAHYAlsAJwC9AAX+6wAGALwBPQABABUA7AHnAZQAGQAAJCYnJiYjIgYHJzY2MzIWFxYWMzI2NxcGBiMBLTAcExkNFx4RTRpJOCAvGxQaDhYeEUwZSTfsExIMDBsZJzVDFBEMDBgYJjRBAAEANAB4AdgBfwAFAAABESM1ITUB2Hf+0wF//vmXcAD//wBG/yUCEwISAAIAeAAAAAUAIf/aAzICzgADABMAHAAsADUAAAEXAScSFhYVFAYGIyImJjU0NjYzBhUUFjMyNTQjABYWFRQGBiMiJiY1NDY2MwYVFBYzMjU0IwJlWv4wWWtPLS1PMjFPLi5PMUUfJkREAedPLS1QMTFQLi5QMUUfJkREAs45/UU5ApwrUTU1USsrUTU1UStXWiczWlr++itRNTVQLCxQNTVRK1daJzNaWgAAAQBlAAEDLgKRAA4AAAEBJzc2NjchNSEmJicnNwMu/tlfZxopGP37AgUbJhpnXwFJ/rhRcBskDnQQIB1wUQACADX/JAPHAsQANQBAAAAAFxUUFjMyNjU0JiMiBgYVFBYWMzI2NxcGIyImJjU0NjYzMhYWFRQGBiMiJicGBiMiJjU0NjMSNzUmIyIGFRQWMwJnURgcKi+dmmqbUU+abjJnKiNwd43XdXnYiIjIaTRgQjdDCRRINFhcemsXGRsZLzEhJAH0LPk9MWRziZlbo2psoFcUD2QqcdGLhdV5bbRpWYxQPSksNnplfY/+cDzuC1RdRj4AAAMAQf/wAtcCxAAfACsANAAAABYWFRQGBxc2NxcGBxcHJwYjIiYmNTQ2NyYmNTQ2NjMGBhUUFhc2NjU0JiMCBhUUFjMyNycBdV4yRkGSIBJ5JTZ3dlNagUduPUJGNSsuXUIfJRwiJyYlIEIhQDVFNqsCxClILTpZKYhEUiRuT2o9UFAwVzo9Wi0zSS8tSi1eJh8cLyEZMyAgJf6pNiEtNC6jAAEAR/8jAo0CtAANAAABEQcRIxEHESYmNTQ2MwKNfWF9dHeJegK0/IARAyz85REB6QRzXWRwAAIAOf+wAekCrgAxAD4AACQWFRQGBiMiJzcWMzI2NTQmJicmJjU0NjcmJjU0NjMyFhcHJiMiBhUUFhYXFhYVFAYHJhc2NTQmJycGFRQWFwG4GjZhQG5MLz1IJy4RMzVOSiskHBpyXjVgJjBARSYoETEzT0sqJHQnHSg8NhoiMKAxJC5GJzVVJhoXExgXERhCOyY+FhUzI0ZWHRpSJRoYExcYEBpDOiY+FzcQIh8cIRUTHiIcIBAAAwBJAGgC4QL6AA8AHwA4AAAAFhYVFAYGIyImJjU0NjYzDgIVFBYWMzI2NjU0JiYjFhcHJiYjIgYVFBYzMjY3FwYjIiY1NDY2MwHxmFhYmFtbmVlZmVtHcUBAcUdHcEBAcUZLNi0SIhQkKykkGCcTKThKUF4tTzEC+lSXXl6XVFSXXl6XVElBdEtLdEBAdEtLdEE8MDoOCzc7OjgPDz0zZl48WC8AAAQAMgDaAk0C9QAPAB8ALQA0AAAAFhYVFAYGIyImJjU0NjYzEjY2NTQmJiMiBgYVFBYWMzYGBxcjJyMVIxEzMhYVBzMyNTQjIwGLe0dHe0xMe0ZHe0s6WTIyWjk5WTMzWTlwIBxKTjsWRFNBQZEdLi8cAvVHfExMekZGekxMfEf+JDNdPT1fNDRfPTxeM+8oCnVoaAEZKywkJiIAAAIAHgEpA0wCtAAHABwAAAEHIxEjESM1ASMnJzQ3IwMjAyMWFRUHIxMzExMzAX0OcWp2Ay5mBgEHAktVUwIFBWIPikhAkAK0VP7JATdU/nWtJyJB/vIBDC07IK0Bi/8AAQAAAgArAXQBiQLEAA8AGwAAEiYmNTQ2NjMyFhYVFAYGIzY2NTQmIyIGFRQWM65RMjJQLS1QMjJRLCEpKSEhKSkhAXQpTTMzTCgoTTMzTClVLSYnLSwnJy0AAAEAfv+YAQEDKQADAAABESMRAQGDAyn8bwORAAACAH7/mAEBAykAAwAHAAABESMRExEjEQEBg4ODAyn+kgFu/d3+kgFuAAABABcCDwITA0sABgAAARMjJwcjEwFWvY1ybo+9A0v+xM/PATwAAAL+aQKE/+IDGAALABcAAAAWFRQGIyImNTQ2MyAWFRQGIyImNTQ2M/7UKysgHywsHwECLCwgHysrHwMYKx8fKysfHysrHx8rKx8fKwAB/zUCff/iAyMACwAAAhYVFAYjIiY1NDYzTzExJiYwMCYDIy8kJC8vJCQvAAH+1AJy/+IDOwADAAADFwcn89Uo5gM7gElcAAAB/tQCcv/iAzsAAwAAAxcHJ1Y45igDO21cSQAAAf5yAnD/4gMvAAYAAAEnNzMXByf+pjSMWIw1gwJwPIODPFkAAv7YAmH/4gNcAAsAFwAAAhYVFAYjIiY1NDYzBgYVFBYzMjY1NCYjaEpKOztKSjsVGhkWFhkaFQNcSTQ1SUk1NElKGxgZGxsZGBsAAAH+dAKA/+IDFAAZAAACJicmJiMiBgcnNjYzMhYXFhYzMjY3FwYGI7AfFQ0TChAYDUkUQCgXIBQNEgoQFw5JFEApAoAODQoJFhckMT4PDQkJFRckMzsAAf64ApL/4gL2AAMAAAMhNSEe/tYBKgKSZAAB/uj+///iABAAEwAABxYWFRQGIyImJzcWMzI1NCYjNzODMzJPQCE3EyEfITArMRBQMgUzKDI9EA1EESATEX0AAv5pAwL/4gOWAAsAFwAAABYVFAYjIiY1NDYzIBYVFAYjIiY1NDYz/tQrKyAfLCwfAQIsLCAfKysfA5YrHx8rKx8fKysfHysrHx8rAAH+1ALw/+IDsQADAAADFwcn9tgk6gOxeElVAAAB/tQC8P/iA7EAAwAAAxcHJ1Q26iQDsWxVSQAAAf5yAvT/4gOsAAYAAAEnNzMXByf+pzWMWIw0hAL0PHx8PFMAAv7YAt//4gPaAAsAFwAAAhYVFAYjIiY1NDYzBgYVFBYzMjY1NCYjaEpKOztKSjsVGhkWFhkaFQPaSTQ1SUk1NElKGxgZGxsZGBsAAAH+dAL+/+IDkgAZAAACJicmJiMiBgcnNjYzMhYXFhYzMjY3FwYGI7AfFQ0TChAYDUkUQCgXIBQNEgoQFw5JFEApAv4ODQoJFhckMT4PDQkJFRckMzv//wAeAnIBLAM7AAMA1wFKAAD//wAe/v8BGAAQAAMA3AE2AAD//wAdAoQBlgMYAAMA1AG0AAD//wAeAnIBLAM7AAMA1gFKAAD//wAeApIBSAL2AAMA2wFmAAAAAQAAAOgBNwATAFwABwABAAAAAAAAAAAAAAAAAAQAAQAAAAAAAAAZACUAMQA9AEkAVQBhAIQAtQDgASEBQgFrAYIBjgGaAaYBsgHFAfQCCwIYAiQCMAI8AkgCXwJ4AokCrwLLAtcDAwMPAxsDJwMzA3QDgAOgA8ID9wQdBF0EbwSOBJoEpgSyBL4E0gTwBQsFIgUuBUYFfgWKBZYFogWuBboFxgYgBkwGdga2BuUHKAdWB2IHbgd6B4YHqQgHCCgINAhBCE0IWQhlCHEIfQiUCKwIxAj3CRkJJQlOCVoJZglyCX4JvgnKCfcKJQpUCnIKrQr4CxwLOwtHC1MLXwtrC38LnQu2C9ML3wvrDAEMQwxwDJsMxwzZDQINPg1aDYYNvg3RDhoOTg5gDokOvw7ZDusPIQ8qDzMPPA9LD1sPaw97D5kPqA++D9QP4A/7EAsQKRBHEHgQjhDNEQwRGBEmETIRQRFNEX0RrBG+EdAR7hIMEhkSJhIzEkASTBJYEmoSfBKoErUSzxLYEvES8RMdE1sTmRPQFAEUJRQ6FEcUYRRxFHwUkBSkFLAU2xTrFPMVRRVkFb8WEBYrFoYW2RcnF1gXhBeSF6cXuhfgF/YYBBgSGCQYShh1GIIYohjIGNYY5Bj2GRwZRxlQGVkZYhlrGXQAAAABAAAABDP3z2qxol8PPPUAAwPoAAAAANQuIFIAAAAA1GbiI/z3/p4FUASSAAAABwACAAAAAAAAApoAewD0AAACSv/3Akr/9wJK//cCSv/3Akr/9wJK//cCSv/3A0b/7AJnAEkCOwAmAjsAJgKKAEkClwAPAhAASQIQAEkCEABJAhAASQIQAEkB6ABJAoEAJgKdAEkBJgBJASYADAEm/9sBJv/VASYABwE6//kCbgBJAf0ASQMQACgCnABJApwASQKzACYCswAmArMAJgKzACYCswAmArMAJgKzACYCUwBJAlMASQKzACYCZgBJAjUADQIWAAoCjgA/Ao4APwKOAD8CjgA/Ao4APwI3//cDSgANAjv//gJH//wCR//8AhsAFQIjAB8CIwAfAiMAHwIjAB8CIwAfAiMAHwIjAB8DVgAfAlQARgHeACYB3gAmAlcAKwJBACYCJwAmAicAJgInACYCJwAmAicAJgFfAAQCIAALAkMARgEaADYBGgBGARoAAQEa/9UBGv/QARoAEAEZ/9oBGf/aAh4ARgEoAEEDUABGAkMARgJDAEYCSAAmAkgAJgJIACYCSAAmAkgAJgJIACYCSAAmAlQARgJUAEYCVwArAY0ARgHfAAsCWwBGAXwABAI+AEECPgBBAj4AQQI+AEECPgBBAfz//gLlAAgB+f/5AgD//gIA//4CAP/+AcYAEAH0ADMB9AApAkgARgJDACoByAASAgAACwIDAAECLQAfAg8AEAIsACoBzgAQAj4AIQIoAB8BkAAuAZAAKQGQACUBkAAdAZAALgGQACUBkAAuAZAAKQGQACUAoP9ZA8AALgPAAC4DwAAlAb8ACwIIAFEA8AAiAVUAJwDwACIA8AAdAtoAIgDxACMA8QAjAiMADwDwACIB3AASAdwAEgGuADMA6gAzAPAAHQIIAFECCAALAUMADQFDAB8BQwApAUMAHwFEABcBRAATAxsAGAIIABgBlgAwAZYAMAJnACkCYwApAWMAKQFjACkBtgAnAbYAIQDvACcA7wAhAO8AIQD0AAAB3gAmAjAAFAIhAA0CSwANAhcAHwIx//wCCwA0AgIANAICADwCAgA0AgIANAICACYCAgAmAgwANQH8ABUCDAA0AkgARgNTACEDhABlA/wANQLxAEEDBwBHAiIAOQMqAEkCfgAyA4QAHgIJACsBfwB+AX8AfgIqABcAAP5pAAD/NQAA/tQAAP7UAAD+cgAA/tgAAP50AAD+uAAA/ugAAP5pAAD+1AAA/tQAAP5yAAD+2AAA/nQBSgAeATYAHgG1AB0BSgAeAWYAHgABAAADp/73AAAFtPz3/0EFUAABAAAAAAAAAAAAAAAAAAAA6AAEAjoCWAAFAAACigJYAAAASwKKAlgAAAFeADIBPgAAAgsGAwUAAAIABAAAAAMAAAAAAAAAAAAAAABDVERCAMAAICGSA6f+9wAAA6cBCQAAAAEAAAAAAhICtAAAACAAAwAAAAIAAAADAAAAFAADAAEAAAAUAAQB5gAAABoAEAADAAoALwA5AH4A/yAUIBkgHSAiICYgrCEiIZL//wAAACAAMAA6AKAgEyAYIBwgIiAmIKwhIiGS//8AAABJAAAAAAAA4JrglOBx4HDgDd+t3zYAAQAaAAAANgC+AXwAAAAAAAAAAAAAAAAAAAAAAAEAlwCdAJkAuADHAMoAngCmAKcAkAC8AJUAqgCaAKAAlACfAMIAwADBAJsAyQACAAoACwANAA8AFAAVABYAFwAcAB0AHgAfACAAIgApACsALAAtAC4ALwA0ADUANgA3ADkApACRAKUA0wChAOYAOgBCAEMARQBHAEwATQBOAE8AVQBXAFgAWQBaAFwAYwBlAGYAZwBpAGoAbwBwAHEAcgB1AKIA0QCjAMQAtQCYALYAugC3ALsA0gDMAOUAzQB2AKwAxQCrAM4A5wDQAMMAigCLAOMAxgDLAJIA5ACJAHcArQCOAI0AjwCcAAYAAwAEAAgABQAHAAkADAATABAAEQASABsAGAAZABoADgAhACYAIwAkACgAJQC+ACcAMwAwADEAMgA4ACoAaAA+ADsAPABAAD0APwBBAEQASwBIAEkASgBUAFEAUgBTAEYAWwBgAF0AXgBiAF8AvwBhAG4AawBsAG0AcwBkAHQAqQCoAAAAAAAHAFoAAwABBAkAAACcAAAAAwABBAkAAQAkAJwAAwABBAkAAgAOAMAAAwABBAkAAwA4AM4AAwABBAkABAAkAJwAAwABBAkABQAaAQYAAwABBAkABgAiASAARABpAGcAaQB0AGkAegBlAGQAIABkAGEAdABhACAAYwBvAHAAeQByAGkAZwBoAHQAIAAyADAAMQAyAC0AMgAwADEANgAsACAAVABoAGUAIABNAG8AegBpAGwAbABhACAARgBvAHUAbgBkAGEAdABpAG8AbgAgAGEAbgBkACAAVABlAGwAZQBmAG8AbgBpAGMAYQAgAFMALgBBAC4ARgBpAHIAYQAgAFMAYQBuAHMAIABTAGUAbQBpAEIAbwBsAGQAUgBlAGcAdQBsAGEAcgA0AC4AMgAwADMAOwBDAFQARABCADsARgBpAHIAYQBTAGEAbgBzAC0AUwBlAG0AaQBCAG8AbABkAFYAZQByAHMAaQBvAG4AIAA0AC4AMgAwADMARgBpAHIAYQBTAGEAbgBzAC0AUwBlAG0AaQBCAG8AbABkAAMAAAAAAAD/tQAyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAB//8ADwABAAAADAAAAAAAAAACAAUAAgBPAAEAUQBVAAEAVwB3AAEAtgC8AAEAvgDTAAEAAAABAAAACgAcAB4AAURGTFQACAAEAAAAAP//AAAAAAAAAAEAAAAKADIANAAEREZMVAAaY3lybAAkZ3JlawAkbGF0bgAkAAQAAAAA//8AAAAAAAAAAAAAAAA=",
  f700: "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"
};

// _shared/logo.ts
var LOGO_METALIUM_PNG_B64 = "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";
function logoBytes() {
  const binario = atob(LOGO_METALIUM_PNG_B64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

// _shared/sgc-pdf.ts
var ANCHO_PT = 595.28;
var ALTO_PT = 841.89;
var K2 = ANCHO_PT / ANCHO;
var ICONOS2 = ICONOS;
function b64ABytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function color(hex) {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}
function colorArr(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
var PERMITIDOS = /[ -~ -ÿ–—‘’“”•…€™→]/;
function limpiarTexto(t) {
  let out = "";
  for (const ch of String(t ?? "")) {
    if (PERMITIDOS.test(ch)) out += ch;
    else if (ch === "	") out += " ";
    else if (/[‐-‒−]/.test(ch)) out += "-";
    else if (/\s/.test(ch)) out += " ";
    else out += "?";
  }
  return out;
}
async function crearPintorPdf() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fuentes = {};
  for (const [k, b64] of Object.entries(FUENTES_SGC_B64)) {
    fuentes[k] = await doc.embedFont(b64ABytes(b64), { subset: false });
  }
  const logo = await doc.embedPng(logoBytes());
  const medir = (txt, f, s) => fuentes[f].widthOfTextAtSize(limpiarTexto(txt), s);
  const nuevaPagina = () => {
    const page = doc.addPage([ANCHO_PT, ALTO_PT]);
    page.pushOperators(PDFOperator.of(PDFOperatorNames.SetLineJoinStyle, [PDFNumber.of(1)]));
    return page;
  };
  const sombreados = /* @__PURE__ */ new WeakMap();
  const rellenarDegradado = (page, d, g, op) => {
    const n = (sombreados.get(page) ?? 0) + 1;
    sombreados.set(page, n);
    const nombre = `SgcSh${n}`;
    const stops = g.stops;
    let fn;
    if (stops.length === 2) {
      fn = doc.context.obj({ FunctionType: 2, Domain: [0, 1], C0: colorArr(stops[0][1]), C1: colorArr(stops[1][1]), N: 1 });
    } else {
      const funcs = [], bounds = [], encode = [];
      for (let i = 0; i < stops.length - 1; i++) {
        funcs.push(doc.context.obj({ FunctionType: 2, Domain: [0, 1], C0: colorArr(stops[i][1]), C1: colorArr(stops[i + 1][1]), N: 1 }));
        if (i > 0) bounds.push(stops[i][0]);
        encode.push(0, 1);
      }
      fn = doc.context.obj({ FunctionType: 3, Domain: [0, 1], Functions: funcs, Bounds: bounds, Encode: encode });
    }
    const [x1, y1, x2, y2] = g.lin;
    const sh = doc.context.obj({
      ShadingType: 2,
      ColorSpace: "DeviceRGB",
      Coords: [x1 * K2, ALTO_PT - y1 * K2, x2 * K2, ALTO_PT - y2 * K2],
      Function: fn,
      Extend: [true, true]
    });
    const ref = doc.context.register(sh);
    const res = page.node.normalizedEntries().Resources;
    let dict = res.lookupMaybe(PDFName.of("Shading"), PDFDict);
    if (!dict) {
      dict = doc.context.obj({});
      res.set(PDFName.of("Shading"), dict);
    }
    dict.set(PDFName.of(nombre), ref);
    const ops = [pushGraphicsState()];
    if (op != null && op < 1) {
      const gs = doc.context.obj({ Type: "ExtGState", ca: op, CA: op });
      const gsName = page.node.newExtGState("SgcGs", doc.context.register(gs));
      ops.push(PDFOperator.of(PDFOperatorNames.SetGraphicsStateParams, [gsName]));
    }
    const re = /([MLCZ])([^MLCZ]*)/g;
    let m;
    while (m = re.exec(d)) {
      const v = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (m[1] === "M") ops.push(moveTo(v[0] * K2, ALTO_PT - v[1] * K2));
      else if (m[1] === "L") ops.push(lineTo(v[0] * K2, ALTO_PT - v[1] * K2));
      else if (m[1] === "C") ops.push(appendBezierCurve(v[0] * K2, ALTO_PT - v[1] * K2, v[2] * K2, ALTO_PT - v[3] * K2, v[4] * K2, ALTO_PT - v[5] * K2));
      else if (m[1] === "Z") ops.push(closePath());
    }
    ops.push(clip(), endPath(), PDFOperator.of(PDFOperatorNames.ShadingFill, [PDFName.of(nombre)]), popGraphicsState());
    page.pushOperators(...ops);
  };
  const pintar = (page, prims) => {
    for (const p of prims) {
      if (p.t === "path") {
        if (p.fill && typeof p.fill === "object") rellenarDegradado(page, p.d, p.fill, p.op);
        else if (p.fill) page.drawSvgPath(p.d, { x: 0, y: ALTO_PT, scale: K2, color: color(p.fill), opacity: p.op ?? 1 });
        if (p.stroke) {
          page.drawSvgPath(p.d, {
            x: 0,
            y: ALTO_PT,
            scale: K2,
            borderColor: color(p.stroke),
            borderWidth: p.sw ?? 1,
            borderOpacity: p.op ?? 1,
            borderLineCap: LineCapStyle.Round
          });
        }
      } else if (p.t === "text") {
        const txt = limpiarTexto(p.txt);
        if (!txt) continue;
        const f = fuentes[p.f];
        const w = f.widthOfTextAtSize(txt, p.s);
        const x = p.a === "middle" ? p.x - w / 2 : p.a === "end" ? p.x - w : p.x;
        page.drawText(txt, { x: x * K2, y: ALTO_PT - p.y * K2, size: p.s * K2, font: f, color: color(p.c), opacity: p.op ?? 1 });
      } else if (p.t === "icon") {
        const d = ICONOS2[p.name] ?? ICONOS2["file-text"];
        page.drawSvgPath(d, {
          x: p.x * K2,
          y: ALTO_PT - p.y * K2,
          scale: p.size / 24 * K2,
          borderColor: color(p.c),
          borderWidth: p.sw ?? 2,
          borderLineCap: LineCapStyle.Round
        });
      } else if (p.t === "img" && p.key === "logo") {
        page.drawImage(logo, { x: p.x * K2, y: ALTO_PT - (p.y + p.h) * K2, width: p.w * K2, height: p.h * K2 });
      }
    }
  };
  return { doc, medir, nuevaPagina, pintar };
}
async function pdfDeDocumento(componer) {
  const pintor = await crearPintorPdf();
  const paginas = componer(pintor.medir);
  for (const prims of paginas) pintor.pintar(pintor.nuevaPagina(), prims);
  return pintor.doc.save();
}

// _shared/solicitud-detalle.ts
var TIPO_LABELS = {
  ingreso: "Ingreso",
  traslado: "Traslado",
  aumento_sueldo: "Aumento de sueldo",
  bono: "Bono",
  cambio_cargo: "Cambio de cargo",
  cambio_turno: "Cambio de turno",
  renovacion: "Renovaci\xF3n",
  desvinculacion: "Desvinculaci\xF3n"
};
function tipoTxt(t) {
  return (TIPO_LABELS[t] ?? t ?? "").toLowerCase();
}
var DOCUMENTO_CODIGOS = {
  ingreso: { codigo: "RRH-FOR-CON-006", folioPrefijo: "RRH-ING-" },
  traslado: { codigo: "RRH-FOR-TRA-002", folioPrefijo: "RRH-TRA-" },
  aumento_sueldo: { codigo: "RRH-FOR-VAR-001", folioPrefijo: "RRH-VAR-" },
  bono: { codigo: "RRH-FOR-VAR-002", folioPrefijo: "RRH-BON-" },
  cambio_cargo: { codigo: "RRH-FOR-VAR-003", folioPrefijo: "RRH-CAR-" },
  cambio_turno: { codigo: "RRH-FOR-VAR-005", folioPrefijo: "RRH-TUR-" },
  // provisorio
  renovacion: { codigo: "RRH-FOR-CON-007", folioPrefijo: "RRH-REN-" },
  desvinculacion: { codigo: "RRH-FOR-VAR-004", folioPrefijo: "RRH-DES-" }
};
var MAESTRO_SOLICITUDES_CODIGO = "RRH-FOR-SOL-001";
var TIPO_RENOVACION_LABELS = {
  plazo: "A plazo",
  obra_faena: "Por obra o faena",
  indefinido: "Pasa a indefinido"
};
function pesos(n) {
  const v = Number(n);
  if (isNaN(v)) return String(n ?? "\u2014");
  return "$ " + v.toLocaleString("es-CL");
}
function detalleLineas(sol) {
  const d = sol.detalle || {};
  let pares;
  switch (sol.tipo) {
    case "ingreso":
      pares = [
        ["Cargo", d.cargo],
        ["Cantidad", d.cantidad],
        ["Sueldo l\xEDquido pactado", d.sueldo_liquido != null ? pesos(d.sueldo_liquido) : null],
        ["Tipo de contrato", d.tipo_contrato],
        ["Plazo", d.plazo],
        ["Turno", d.turno],
        ["Horario de colaci\xF3n", d.colacion],
        ["Horario", d.horario],
        ["Fecha de ingreso", d.fecha_ingreso],
        ["Cliente", d.cliente]
      ];
      break;
    case "traslado":
      pares = [
        ["Cargo", d.cargo],
        ["Fecha de traslado", d.fecha_traslado],
        ["Modificaciones", d.modificaciones_contractuales],
        ["Turno", d.turno],
        ["Horario", d.horario],
        ["Sueldo l\xEDquido actual", d.sueldo_liquido_actual != null ? pesos(d.sueldo_liquido_actual) : null],
        ["Nuevo sueldo l\xEDquido", d.nuevo_sueldo_liquido != null ? pesos(d.nuevo_sueldo_liquido) : null],
        ["Bono nocturno", !d.bono_nocturno ? null : d.bono_nocturno.aplica ? `S\xED (${d.bono_nocturno.porcentaje ?? "\u2014"} \xB7 ${d.bono_nocturno.periodo ?? "\u2014"})` : "No"],
        ["Bono trato", !d.bono_trato ? null : d.bono_trato.aplica ? `S\xED (${d.bono_trato.monto != null ? pesos(d.bono_trato.monto) : "\u2014"} \xB7 ${d.bono_trato.dias_asignacion ?? "\u2014"} d\xEDas)` : "No"]
      ];
      break;
    case "aumento_sueldo":
      pares = [
        ["Monto del aumento", d.monto_aumento != null ? pesos(d.monto_aumento) : null],
        ["Sueldo l\xEDquido actual", d.sueldo_actual != null ? pesos(d.sueldo_actual) : null],
        ["Nuevo sueldo l\xEDquido", d.sueldo_nuevo != null ? pesos(d.sueldo_nuevo) : null],
        ["Fecha efectiva", d.fecha_efectiva],
        ["Motivo", d.motivo]
      ];
      break;
    case "bono":
      pares = [
        ["Tipo de bono", d.tipo_bono],
        ["Monto", d.monto != null ? pesos(d.monto) : null],
        ["Per\xEDodo / fecha", d.periodo],
        ["Motivo", d.motivo]
      ];
      break;
    case "cambio_cargo":
      pares = [
        ["Cargo actual", d.cargo_actual],
        ["Cargo nuevo", d.cargo_nuevo],
        ["Fecha efectiva", d.fecha_efectiva],
        ["Motivo", d.motivo]
      ];
      break;
    case "cambio_turno":
      pares = [["Turno nuevo", d.turno_nuevo], ["Motivo", d.motivo]];
      break;
    case "renovacion":
      pares = d.tipo_renovacion ? [
        ["Tipo de contrato actual", d.tipo_contrato_actual],
        ["Fecha de t\xE9rmino actual", d.fecha_termino_actual],
        ["Tipo de renovaci\xF3n", TIPO_RENOVACION_LABELS[d.tipo_renovacion] ?? d.tipo_renovacion],
        ["Fecha de culminaci\xF3n", d.tipo_renovacion === "plazo" ? d.nueva_fecha_termino : null],
        ["Hito de la obra", d.tipo_renovacion === "obra_faena" ? d.hito_obra : null],
        ["Motivo", d.motivo]
      ] : [
        // renovaciones anteriores a oct. 2026 (sin tipo_renovacion)
        ["Fecha de t\xE9rmino actual", d.fecha_termino_actual],
        ["Nueva condici\xF3n", d.indefinido ? "Pasa a indefinido (sin fecha de t\xE9rmino)" : null],
        ["Nueva fecha de t\xE9rmino", d.indefinido ? null : d.nueva_fecha_termino],
        ["Nuevo plazo", d.indefinido ? null : d.nuevo_plazo],
        ["Motivo", d.motivo]
      ];
      break;
    case "desvinculacion":
      pares = [
        ["Causal", d.causal],
        ["Fecha de desvinculaci\xF3n", d.fecha_desvinculacion],
        ["Documento adjunto", d.adjunto?.nombre || (d.adjunto?.path ? "Documento adjunto" : null)],
        ["Observaciones", d.observaciones]
      ];
      break;
    default:
      pares = [];
  }
  return pares.filter(([, v]) => v !== null && v !== void 0 && v !== "").map(([k, v]) => [k, String(v)]);
}

// _shared/pdf-comprobante.ts
async function construirComprobantePdf(data) {
  const doc = documentoComprobante(data, { tipoLabels: TIPO_LABELS, documentoCodigos: DOCUMENTO_CODIGOS, detalleLineas });
  return pdfDeDocumento((medir) => componerDocumento(doc, medir));
}

// _shared/correo-sgc.js
var F_TIT = "'Montserrat','Segoe UI',Arial,Helvetica,sans-serif";
var F_TXT = "'Fira Sans','Segoe UI',Arial,Helvetica,sans-serif";
var DEGRADADO = "linear-gradient(100deg,#003174 0%,#00357B 72%,#0058A6 87%,#0A7FC3 100%)";
var AZUL_BANDA = "#00357B";
var fx = (peso, px, familia = F_TXT, lh = null) => `font-family:${familia};font-size:${px}px;font-weight:${peso};${lh ? `line-height:${lh};` : ""}`;
var escCorreo = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var esc = escCorreo;
function correoSgc(p, o = {}) {
  const usados = /* @__PURE__ */ new Set();
  const ico = (nombre, variante = "", px = 20) => {
    if (!nombre) return "";
    const clave2 = nombre + (variante ? "-" + variante : "");
    usados.add(clave2);
    const src = o.icono ? o.icono(clave2) : `cid:ico-${clave2}`;
    return `<img src="${src}" width="${px}" height="${px}" alt="" style="display:block;width:${px}px;height:${px}px;border:0">`;
  };
  const logo = o.logo || "cid:metalium-logo";
  const e = p.encabezado || {};
  const filaInfo = (icono, etiqueta, valor, ultima) => {
    const linea2 = ultima ? "" : `border-bottom:1px solid ${PAL.divisor};`;
    return `
      <tr>
        <td width="26" style="padding:7px 0 7px 2px;${linea2}" valign="middle">${ico(icono, "osc")}</td>
        <td style="padding:7px 8px;${fx(700, 9.5, F_TIT)}letter-spacing:.04em;text-transform:uppercase;color:${PAL.etiquetaCard};white-space:nowrap;${linea2}" valign="middle">${etiqueta}</td>
        <td style="padding:7px 4px 7px 10px;border-left:1px solid ${PAL.separador};${fx(800, 12, F_TIT)}color:${PAL.navy};white-space:nowrap;${linea2}" valign="middle">${esc(valor)}</td>
      </tr>`;
  };
  const encabezado2 = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${PAL.borde};border-radius:8px;border-collapse:separate;overflow:hidden">
    <tr>
      <td class="sgc-col sgc-logo" width="25%" style="padding:16px 14px" valign="middle" align="center">
        <img src="${logo}" width="140" alt="Metalium" style="display:block;width:140px;max-width:100%;height:auto;border:0">
      </td>
      <td class="sgc-col" bgcolor="${AZUL_BANDA}" style="background:${AZUL_BANDA};background-image:${DEGRADADO};padding:16px 18px" valign="middle">
        <div style="${fx(800, 9.5, F_TIT)}letter-spacing:.08em;text-transform:uppercase;color:#ffffff">Sistema de Gesti\xF3n de Calidad</div>
        <div style="margin-top:7px;${fx(800, 17, F_TIT, 1.25)}text-transform:uppercase;color:#ffffff">${esc(e.titulo)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>
          <td width="40" height="4" bgcolor="${PAL.amarilloBarra}" style="background:${PAL.amarilloBarra};font-size:0;line-height:0">&nbsp;</td>
          <td style="padding-left:12px;${fx(800, 10, F_TIT)}color:#ffffff;letter-spacing:.04em">SGC</td>
        </tr></table>
      </td>
      <td class="sgc-cian" width="6" bgcolor="${PAL.cian}" style="background:${PAL.cian};font-size:0;line-height:0">&nbsp;</td>
      <td class="sgc-col" width="30%" style="padding:6px 12px" valign="middle">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${filaInfo("file-text", "C\xF3digo", e.codigo, false)}
          ${filaInfo("calendar-days", "Fecha", e.fecha, false)}
          ${filaInfo("refresh-cw", "Revisi\xF3n", e.revision ?? "00", true)}
        </table>
      </td>
    </tr>
  </table>`;
  const barra = (n, titulo) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 10px">
    <tr>
      <td width="36" bgcolor="${PAL.amarillo}" align="center" style="background:${PAL.amarillo};padding:8px 0;text-align:center;${fx(900, 15, F_TIT)}color:${PAL.navy};border-radius:4px 0 0 4px">${n}</td>
      <td bgcolor="${AZUL_BANDA}" style="background:${AZUL_BANDA};background-image:${DEGRADADO};padding:9px 16px;${fx(800, 12.5, F_TIT)}letter-spacing:.03em;text-transform:uppercase;color:#ffffff;white-space:nowrap">${esc(titulo)}</td>
      <td class="sgc-relleno" width="38%" bgcolor="#DCE7F2" style="background:#DCE7F2;font-size:0;line-height:0">&nbsp;</td>
    </tr>
  </table>`;
  const ficha = (f) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAL.ficha}" style="background:${PAL.ficha};border-radius:6px;border-collapse:separate">
      <tr>
        <td width="34" style="padding:12px 10px 12px 14px" valign="top">${ico(f.icono || "file-text")}</td>
        <td style="padding:10px 14px;border-left:1px solid ${PAL.separador}" valign="top">
          <div style="${fx(700, 11.5)}color:${PAL.azulEtiqueta}">${esc(f.etiqueta)}</div>
          <div style="margin-top:2px;${fx(700, 14, F_TXT, 1.35)}color:${PAL.navy};overflow-wrap:anywhere;word-break:break-word">${esc(f.valor == null || f.valor === "" ? "\u2014" : f.valor)}</div>
        </td>
      </tr>
    </table>`;
  const grillaFichas = (fichas) => {
    const ordenadas = [...fichas.filter((f) => f.ancho !== "completo"), ...fichas.filter((f) => f.ancho === "completo")];
    const filas = [];
    let pendiente = null;
    for (const f of ordenadas) {
      if (f.ancho === "completo") {
        if (pendiente) {
          filas.push([pendiente, null]);
          pendiente = null;
        }
        filas.push([f]);
      } else if (pendiente) {
        filas.push([pendiente, f]);
        pendiente = null;
      } else pendiente = f;
    }
    if (pendiente) filas.push([pendiente, null]);
    return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${PAL.borde};border-radius:8px;border-collapse:separate">
    <tr><td style="padding:8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${filas.map((r) => r.length === 1 ? `<tr><td colspan="2" style="padding:5px">${ficha(r[0])}</td></tr>` : `<tr><td class="sgc-col" width="50%" style="padding:5px" valign="top">${ficha(r[0])}</td>${r[1] ? `<td class="sgc-col" width="50%" style="padding:5px" valign="top">${ficha(r[1])}</td>` : '<td class="sgc-vacia" width="50%" style="padding:5px">&nbsp;</td>'}</tr>`).join("")}
      </table>
    </td></tr>
  </table>`;
  };
  const tabla = (t) => {
    const cols = (t.columnas || t.cols || []).map((c) => typeof c === "string" ? { titulo: c } : c);
    const cab = cols.map((c, i) => `
      <td class="sgc-th${c.movil === false ? " sgc-oculta" : ""}" bgcolor="${AZUL_BANDA}" style="background:${AZUL_BANDA};padding:10px 10px;${i ? "border-left:1px solid #2D6AA1;" : ""}" align="${c.alinear === "centro" && !c.icono ? "center" : "left"}" valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0"${c.alinear === "centro" && !c.icono ? ' align="center"' : ""}><tr>
          ${c.icono ? `<td class="sgc-th-ico" width="24" valign="middle" style="padding-right:6px">${ico(c.icono, "bl", 18)}</td>` : ""}
          <td valign="middle" style="${fx(600, 11.5, F_TXT, 1.25)}color:#ffffff">${esc(c.titulo)}</td>
        </tr></table>
      </td>`).join("");
    const valorHtml = (v) => {
      const txt = String(v);
      if (/^\d{2}-\d{2}-\d{4}$/.test(txt)) return `<span style="white-space:nowrap">${txt}</span>`;
      const m = /^(\d{2}-\d{2}-\d{4}) (\d{2}:\d{2})$/.exec(txt);
      return m ? `<span style="white-space:nowrap">${m[1]}</span> <span style="white-space:nowrap">${m[2]}</span>` : esc(v);
    };
    const celda = (c, v, fondo, i) => {
      const obj = v != null && typeof v === "object" ? v : null;
      const txt = obj ? obj.texto : v;
      const val = txt == null || txt === "" ? "\u2014" : txt;
      const centro = c.alinear === "centro";
      const base = `class="sgc-td${c.movil === false ? " sgc-oculta" : ""}" bgcolor="${fondo}" style="background:${fondo};padding:10px 10px;border-top:1px solid ${PAL.lineaTabla};${i ? `border-left:1px solid ${PAL.lineaTabla};` : ""}`;
      if (c.estilo === "pildora") {
        return `<td ${base}" align="center" valign="middle">
          <span class="sgc-pildora" style="display:inline-block;background:${obj?.fondo || PAL.pildora};border-radius:5px;padding:5px 12px;${fx(700, 12.5)}color:${obj?.color || PAL.pildoraTexto};white-space:nowrap">${esc(val)}</span></td>`;
      }
      const color2 = c.estilo === "normal" ? PAL.texto : c.estilo === "numero" ? "#1A396C" : PAL.navy;
      const peso = c.estilo === "normal" ? 400 : 700;
      return `<td ${base}${fx(peso, 12.5, F_TXT, 1.35)}color:${color2}" align="${centro ? "center" : "left"}" valign="middle">${valorHtml(val)}</td>`;
    };
    const filas = (t.filas || []).length ? t.filas.map((fila, k) => {
      const fondo = k % 2 ? PAL.filaAlterna : "#ffffff";
      return `<tr>${cols.map((c, i) => celda(c, fila[i], fondo, i)).join("")}</tr>`;
    }).join("") : `<tr><td colspan="${cols.length}" align="center" style="padding:14px;border-top:1px solid ${PAL.lineaTabla};${fx(400, 13)}color:${PAL.texto};text-align:center">${esc(t.vacia || "Sin registros.")}</td></tr>`;
    return `
  <div class="sgc-tabla-wrap" style="overflow-x:auto">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${PAL.borde};border-radius:8px;border-collapse:separate;overflow:hidden">
    <tr>${cab}</tr>
    ${filas}
  </table>
  </div>`;
  };
  const secciones = (p.secciones || []).filter(Boolean).map((s, i) => barra(i + 1, s.titulo) + (s.tabla ? tabla(s.tabla) : grillaFichas(s.fichas || []))).join("");
  const resumen = (p.resumen || []).filter(([, v]) => v != null && v !== "");
  const resumenHtml = resumen.length ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">
        <tr>${resumen.map(([k, v, color2], i) => `
          <td class="sgc-col sgc-dato" valign="top" style="padding:8px 12px;background:${PAL.ficha};${i ? `border-left:3px solid #ffffff;` : ""}">
            <div style="${fx(700, 10.5)}color:${PAL.azulEtiqueta};text-transform:uppercase;letter-spacing:.03em">${esc(k)}</div>
            <div style="margin-top:2px;${fx(700, 13.5)}color:${color2 || PAL.navy};white-space:nowrap">${esc(v)}</div>
          </td>`).join("")}
        </tr>
      </table>` : "";
  const boton = p.boton?.url ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
        <td bgcolor="#0A64B4" style="background:#0A64B4;border-radius:6px">
          <a href="${esc(p.boton.url)}" style="display:inline-block;padding:11px 22px;${fx(700, 14)}color:#ffffff;text-decoration:none">${esc(p.boton.texto || "Ir al sistema")}</a>
        </td>
      </tr></table>` : "";
  const mensaje = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#ffffff;border:1px solid ${PAL.borde};border-left:4px solid ${PAL.cian};border-radius:8px;border-collapse:separate">
    <tr><td style="padding:18px 22px;${fx(400, 14.5, F_TXT, 1.6)}color:${PAL.texto}">
      ${p.saludo ? `<div style="font-weight:700;color:${PAL.navy};margin-bottom:4px">${esc(p.saludo)}</div>` : ""}
      ${p.mensaje || ""}
      ${resumenHtml}
      ${boton}
    </td></tr>
  </table>`;
  const pie2 = p.pie ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px">
    <tr><td style="border-top:1px solid ${PAL.pieLinea};font-size:0;line-height:0">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="44" height="3" bgcolor="${PAL.pieAcento}" style="background:${PAL.pieAcento};font-size:0;line-height:0">&nbsp;</td></tr></table>
    </td></tr>
    <tr><td style="padding-top:8px;${fx(600, 11)}color:${PAL.pieTexto}">
      <b style="font-family:${F_TIT};font-weight:900;color:${PAL.pieFuerte}">METALIUM</b>
      <span style="color:${PAL.pieSep}">&nbsp;|&nbsp;</span>${esc(p.pie.codigo)}
      <span style="color:${PAL.pieSep}">&nbsp;|&nbsp;</span>${esc(p.pie.nombre)}
    </td></tr>
    <tr><td style="padding-top:6px;${fx(400, 11)}color:#9AB0C8">${p.nota || "Correo autom\xE1tico del sistema SSI-RRHH: no hace falta responderlo."}</td></tr>
  </table>` : "";
  const estilo = `<style>
  @media only screen and (max-width:600px){
    .sgc-col{display:block!important;width:100%!important;box-sizing:border-box}
    .sgc-cian{display:block!important;width:100%!important;height:5px!important}
    .sgc-logo{padding:14px!important}
    .sgc-vacia,.sgc-relleno{display:none!important}
    .sgc-dato{border-left:0!important;border-top:3px solid #ffffff!important}
    .sgc-th-ico{display:none!important}
    .sgc-th{padding:8px 4px!important}
    .sgc-th td{font-size:10px!important}
    .sgc-td{padding:8px 4px!important;font-size:10.5px!important}
    .sgc-pildora{padding:3px 4px!important;font-size:10px!important}
    .sgc-fondo{padding:14px 8px!important}
    .sgc-oculta{display:none!important}
  }
</style>`;
  const html = `${estilo}<div class="sgc-fondo" style="background:${PAL.fondo};padding:24px 12px">
  <!--[if mso]><table role="presentation" width="720" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;table-layout:fixed">
    <tr><td>
      ${encabezado2}
      ${mensaje}
      ${secciones}
      ${pie2}
    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</div>`;
  return { html, iconos: [...usados] };
}

// _shared/iconos-correo.ts
var ICONOS_CORREO_PNG_B64 = {
  "file-text": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADvklEQVR4AdRY26sNYRT/rTlESvKAKOVJFKLIA4V4cMnZs8slt9mUXPJCnpX/gCKiTtnjGuXMpo4Uuabw4PoieVAuR1LCA6dzZlnfmT1zZvae2d/MmNM5vr41a62ZtX7z22vmu8w2MMybnmB7x1iY5+fCPLs0s7Tb8//197cmaNpHYIz8AfQ9A/hOZjHwFKbNMKtdyEk2maACBfajkEaroMiW7ONZ4eIJmrYQE9CsaLp4wj6U7JO6sPD1eILgDaGgF0DbPDgWpRbm9aH8qEnYIyRTVzKeIGNegMp8Gs6W54GfxmCiaBivjvheJVORjCdINDoAZPoa2HkNp3IDjJWS3iPidUXStE94TvIxnmByfLorRmMFJa1m3RSS7WINkAT2yihvSVJPkJgFNFt3E3I8kuUGMCFZPdRwLnD1BJvepyA32YiroB9ds7qkkitFev1Tog/LwFkouqnrCeapILtu5E6NqxDRH7l+TKTeyQDhYN2JKCPiFeUwf45CcfMqRDgQiWGeHfHrTnaC5ln1ztyCad/1pKrsXXU8T40a80Ie4RfPSXkkmhEXmY1g2Z4l67GMOlouYEs86bdPoVydLr7Xr2z4BYPXgbnbO5H/qCeYdpAw90VodFYeolaZ3HL1AW2M5MQ4eoLhQdJpvRaM3VLF26LvecLK3gln+zvxs3WXtVOYnmBjBR1Llr7KCqnMUk/67Y5szOrRraYjP6Suh63SV3CIqesJht9BRdasXpDpRXbJaqecVSRXYWQQPcEwWPuZRQBtQu4muSV7YEkrfJD08juZgLUjL5E/Szb1vQmuFzJIwo+4a0e3TMAT4LoySdMyIIOoHIMnwNnxHX4rvIIKuLPyDde234ez7W4mUTkqV2H4UkgFfbCWevAu6gdJ+BH7PMrVxWjcQul8lePn+7qQR+yDKb3m/HiY9icwPZDlrnkL1erjXuWUqh+x/vI4BZVW9BUMI41wZ4o7WSRfJ5qCnt+x26okwGwEa9seSeUuJoHpz/NF1KzHQVwhg6Rps1DZLJsEyieSG7BLZxjpwoYu6j8lyPwzqBlhYmAXbriTAkiG/M0XeIERX0GC2jnXg3gXSudiv7jqAfnU2nMLAAp9bPErxLR4gqDLQSzRHJD7Uua/nFushC1Zm/tE7iEfYXJUnXBJqUaJJ+hYR8G43hg8iL4Dp3I8Dj+eoIqsWeqPnp0y771V7uAIK2z54LLKSfjJBFWGY3XIL5sOo20asmyt0sQaxtR+bHUPJLfWBP28q1veI+v2Shd/desHH76V/gsAAP//k6q+vQAAAAZJREFUAwB/8vtgiYQlNAAAAABJRU5ErkJggg==",
  "calendar-days": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEpElEQVR4AdRYzW9UVRT/nWl1azBWrW7cqPEDSUwwUSs2amLQyLxGWFDpjCDxT0AXRklY1a2uNKAzLW1irJ0piW4USlEW4sIoIX4E40Ys1MboRoPMO/7uvW/e3Ps6fW2BKcPtPfd83/Ob+967790W0OXt8gAOVe5Z8++6nBwWWRvA5w9vQFQ9B5UfUay8z/zV9ahyMMn5DTs+uml1SS5qeYBRdR+K1cOIqsdIs5Z6G8eZ1k8CRPZaW1R1vjwO2QPTRO7AxX/mvLxjrDFOfZ9xt6OlALce6mPC1wwehWCYfJD0pCXBRnK/OzuwEm/liDxEpRk/yBovUR9FVDkJU5uK3zMAVXBjzzQDNpPWucujrP1xtmghMETjOyDyeGBT/Yq6ubTHoThD2e/ODqzEWzluDhfv5m75RLYgGotaBiAEqPHDqVPxJwq8Z+rlAdRKg5YU++G3pn0l7udA37JzmRwzd3zDnVD8nYbEHgYaQ4DAXWg2wVF8MvJ7U7VcZN5yM6i2ZKPnkeJ86lYN55zZeQ6Cz1O/yN2pTCEEKOLrMf1hr4+cAHSSv/g8RN4InTma4E3mLZAmMfOyuWWywY3UIOiB13xAzOdD4jnbirXyMOql23mZDrb1tzPWSu+hVr6VZHaFpRG6fN3C0ujuslx3AFv3AnQQ0SreElcjRmA2bnfpVGMnuDG7gt4NKn0MMYnrQLYWy7FL8KAiC5AR3dVDgAJveZXbAtyOv/Kb4grjbK1kZVQTwbIQoPorKrMwu/16kNqFsIAAEXgtBOg5ukW8zgCKBNe/7SpGlQlElQvcgl4N/ENjm2j7lvQ9iuPhd2OxspcfpvPMmwhymkpO3cwK+jeoLyczbfuQn2KyE7DbwgH4LVbz1byJpgchjVfI/X4AgtsA5to5kGl+LV+G/1AwJ3xIhJawX9KzUP4560+OJaPoz4lk2FkzeORiTW5PwY9zITl1wxUMt5mll/vT3fMoaB83o82olZ5wsydjrfwutPCApVr5ncTq2F/xs2gUHrG506ULzuiNOXVDgDm/JJ1uuryImdI3qe4L9V1nYMi3GXl29784susUTK7Rs5RTNwSYTVy13rnAEGDOUgcQto3dG+hN5YWJW2Coqfs87+CeUzcE6E/YTm4e3Av6A7eTD4KQaOxF9FxasFSsDIW+5OBuDv1mjsCZr6wNYG98H6dzB3fgOcpe14FU8T+frFG2Wgb0o+e/+xN5VSwD0H8P+nIyV33kJM8F7kwSIzyTxGpW9DQjT/MpP0Tu9/3MWyBNou2ZxK/ly8jug8ufDdJqzTPJTCn838xM+TtuPRstGTlNoHAVzyTeF3UGPOt0rItIOvcKX9S/poHAY57cWVHxVFpA5JdUppC5B+FvwP18uS/yJT+HqDrbESpWOXdlke/pDcTiuuopJ7gxBFgvTUF1zrnMKDcz2bzSOnMuEXBu1jClHH2Jetn888ppHEOAEMXFxnbap0jr3afQ6B3KFs0ApPuzPQt8ErdDZQu1t0lHSVd45sAy+foFr9go4njA1jwy/AdrBX0pwKa7PnKCSa+hVnqaNNgZKj/DS/o62u6NDsjyAJ3/mo9dD/B/AAAA//8jg89+AAAABklEQVQDAOALS2+iyC+wAAAAAElFTkSuQmCC",
  "refresh-cw": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAFYElEQVR4AexYXYzUVBT+TndFQTFGDWL4SSRqQCMREMT4gAQTgejOrGY14afF34CKEDUiERVElCiERVGjotBh8QETbHchgKLyoAEFFh+IRokxgmhAfRBBCDA9fp3Z6c8wO1N2wi4P3Dmn97vn3HPv19vb9nQMnOXlHMFqL1B1K3in3R9pewa1EalME3VDm65m/QZS9iykV99YkWR9phfSmSUcZzHq7cui/TtGMJ2ZycF2oFZ+BaSROgOCidSxbTqB9XSILASyuzj5Puoi+CeEEsXDY7TOBORJqExDpCQn2LCmhivyECfax/glgAxD8tKXXZ/iCe3hyr5Don3YjoheF2kMjmAkIziu6WKcOPY5V+R9BvuTsSoS1f1QfJNT4Lcib6HZDYKpqJEfUbeyrmCkzQswVEOMBATvbuqL871tDBpFjcpBQJciizFwTIFr9YVrjsypY/bL2TwMZ8Dz1FZqKIILYRgur8ac0FgalV/B8St6I+t9zdBB1LyoHiOxefgPA+BYM9FifpF3lDg2mzvgmC9Th3Fl/RXbXdRrPvfySkAE7ZT2CTas6YbzjE0Q9A9jdSdqagfCsebiU/NIaE+AXLMFjnkDib4U7y0W2w3UktI+wRNHV0Ek3LCqK+BYN2HtRN65JcdKZnTNF+F5KQCHqRWlNMGUfR8g96JQFBvhWg8Umh2q6zODkF51W06NmkO8FxYkGac0QcH8SPAPOG6QcMRyujBtf8BL+z337peBiryaZJhTCdbZXCm5Jgj2vIexYdKhoN0hIOMShylie/tUgiKPhIPpVjRP8e/i0NQxNJcr92fFUMUBoGZRtF+c4F3v9qBzBDUvig/zoMqjY77HG6wX/OdlOXXN3nAncSuE88UJGhfcAeGv4M9iQwF2VR0nKHJ9SET/xjprf9juGhQnqLg0QsNPCiLNMwjr/XTLbuRbpbFSunV5QEOl81Yvq48DMiOnFdKtXxCWb0N4hpGIn1S0TaJXtYFcFb/EBt7i42AZPYvh1b7NupNErwgmUvkjwARxgp+YB+FY0+GYT6Nlwl/0d5ZcGUwkymdh0EKcYGjvPOTnmyK9gwnV+C7ABAa1a8Xzwve8/5pzf469ueIE6+zBvNV3IZ3RCnqA/gfDM6sKPRpEC7MmzI2k/yi6xAb8W73yZyLQi4Py/cpjNVKXmcrwAdS8eLI8D8JjfAWBi0JXRfRTxR7lOvh7z9BIyqVb0Tx5Y3FIMcFif76t+iwgo0PVm3mnj0E1xcs6gFyCQlG8UIDROhlB4DlmwD3gTN6SV6u6h3gqYyP6Xa26nBn7ZpQocYJatCcLASI9Cdfxo7vkWdKXTBrWdOfH/2fMl8xIwHb8039apB2DcYICL+L9mKu2ImgLhxXM4wStJDo+sCcF6aYxOH60FSK3ByGKvcjWjseW0ScDWxGIE4w5VbnsTP8xK2YWGQLBej5mdlJno84eEvNHG34CnLLreULrAW8zRAYGbtVtMDC80hurDMG2oRzzNXj8plD9t81SqIYSvAJDWklUubJ7qVuJt+Q0ZX+Fmu5HSGotBEUrrjZP/hb4r1YOUk7iBBWRtkgQ6N/+hlwNxZu0HaeeKiL9IDKSDv8vklHEtxIXie4BpB6ONQUJS4SQHyHh94Bit28J1D9b13wCJ9V/sC7m/vw98JUHh3limwCdTmLXwpnMx0v5gKg3TjCfbi3l5K+3m275nwF+tuNafeDpUPadzcmXkcRHVP9Bu5b1Ak5yP7LGCDhmT7jmWDiWn8bRfHoSJ+ivkv+HkGs9U2nz5qZptnbBtRbCYYrmmhPhmuPgmPewnsN6JVombc/1q+IQJ1jFQGcq9Kwn+D8AAAD//69zQccAAAAGSURBVAMAJT+9YBJgJ2IAAAAASUVORK5CYII=",
  "barcode": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAB7klEQVR4AeyXPUsDQRCG391EUbARtbARKxEEC8EfYCd+RRFFMB/4Cyz8LYJglYgWEWJMYyn4gY1gJ6QMFgHB3mBy6+5s4t5dLnCwFhF3uZ2bfWZmmXt3m+Po8+EatD0gp+A/VHD9Yhxb+bHAl4fZTnEYa/mpQE4ctlNMyL1nQnXdzJcQvIObZ9vgzToE6kgV1ikvzDby8/j6fEeS1bBZOKKcOGz1fFTWvUGwKlL5U6qLYhQwJtggvG0wJAE2AGBPTvmEGEdKwhE51ZNRBnFYorUkcyflBBg7gBpRTHHfDDYooBrTYdbxmWxYIzCh/ER7BZj8CMbN3kLWcd8+gM6PYj+ba8dsotd9Z12DtkfiFHQK2ipgW+/uoFPQVgHbencHnYK2CtjW/9IdtG2jd71rsLc28SJOwXg69c76awqypvkWoX2BlmHk+9btHBBvp3WY57WBerXgdbhaCh2LYirsm0EFmXg0MX5Pfph5eCBOhumcOCzJnuRvqqAysDt6RzEKGBNssJw9huBz8NgsyukTSguzSu4WPDEtFVnA4NAh5cRhpUwdXEzAwyIa48tUF8UoYEywQflnjuv0KyqZKpQPNZjoYqX9Giq5F1zumuOOw65yH6hkn3Gz0lA704xiFNAm1KCG/WRdg7an4RS0VfAbAAD//2e8eeYAAAAGSURBVAMA2+vFUUhhKN4AAAAASUVORK5CYII=",
  "settings": "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",
  "database": "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",
  "truck": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEa0lEQVR4AexXXYhVVRT+1hkdDCpnAoWKfCqJfgj60SmIRiqinO4cDUWY5lyzUgt7kOjZ6rF66CExpRzvnTT6oc6ZmQhC8BYEptVDUaQRBRZCEY1RGTr3Ltc6+/zee87M3HvVOw+z2Wuvv73W/vbPOWcfC3O8zANsd4PmV/D8r6BdfgV26TjsMrdGpUmJ+wqF0dXtgtP4eIv7RxZhsPy5GJ8F6Dq0XGixhN4KiycEqOQSrY0aA+zpeg2Eu9rI1RjKeBn2W/c2OmZvMQBX7++VkMeFTGV8AeZ1AK1qnrAd4D+hhUBAta1VNAAX1m7RfBFRbQhe8X24w5XmyXkVoF0ICyOdO7TPkhuAwNJUf3fjTym9aYW+jUKIrorkFgQDsMbcQmx+SH0+e7QfSSqUb88PTnsMwLTtAmh8SM5lTBaOYrD092weoIsEMGPORJcBtYNYU7ozwxuZDECL5GmLbO0LzeRjeFg7emXeoAZgnvd82V2HkCTmrXFqWoJq7QP0H1oQ22Lp4gCMxzOSV9wt79kRo0hL1IeeEztFaqidAagwTi3bLCAPqxjQZtjljYEcsc4BrKyawplqQZD8LhRU3iP3gZWB4rPOAdThP970BxgCks+qCtBCEMbw4N4lCIoBWP9iDZwts2byeY589/FMYqyl6O46EOoGYKh1iutDA7wZDU90H9aUb1J9bgBUJK7zhLKIqliusgFodfBFrSiyqUvNBqBKc5QMwJkOdfI/ZbD0q/yzjGOgdHU8pzqpPt9AaZm8Pj6SC8Jv8q6Tf53SMZFfqotKq8T+DcsAzNvirP8UIgFGA+iSO5+977Z01kCrz6d9CQ+BwrshLRf5OQH9GXSMICyLGYBZHrX1TPOfQugF04dY9+6l2nVaIlye6SfcjcWW3MAzvGyeC8t31fCvz8PGLldkKyqi1v2nYEg+T7vFbirRNThz+rDfN4xRzrzDdGhod4ElB/hI5CHaEsVHRhEs/kdaBACt46ok6B6RlYQFlakIzzkAr7hVBjkWWAGiGwFo35gIN4gtXZm/kRvN09AcVd6UdkbxsblKP6hiAE4M/QjwXjXkEk8l7ozsH+DcvpkOs2W+a4FV83lew3gd487P6jYAVXKLsp28EuoEPhWTkrCgWtYI7NH1sMtvgOj6wCrz4u9E1r6NxPhefKYSbpaHYg8K5Q1yTPYZY9SaWMZO1HCHrPJToScGqBa3eMR3uk6/bEe/mJKfnz5B847YZCLS+pV/QfclfX7fMCbJuxfJhPmE31UbwpNyqN4GaAXCogsSxnjONow5X4Yu5WmAaknSZHWbzPZg0pSQT2LKegTvrfcPc8Iei+pjWiuGk0IZlT/Bqer2DEdkmh5g5bH/4RXvR40eldWbEJqUI6C3jx2onr4WE8NfR5nyBF0R7Qt6Xroclfi/hMZl4hvgFh+AjoH8Mj3AMG5seL8ke1ioF57TJ/Qixrf8F7pn5NrXHX4BrrNCYq8QKsAr6nGZMXR2AGdMc+E6zANsd23n/AqeAwAA///Psy5iAAAABklEQVQDAFprmmCQTKOhAAAAAElFTkSuQmCC",
  "building": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEuElEQVR4AdxYT2wVRRj/fftqNDFGTaTKgegJoxaqB9REjfVE0LRvG1NFeOwDbcpBiF68eTDh5kUS8EBNkfdaCtaE7msT44160PgvEUtD/BMOGkMqjQf1QoTu+H27b2dn+na71UzBOJ3fzDffv/k6s/O92fXwHy/lAQ6M3Qb/5MPwx/vcgn2K75IFKg6w72wX/OY78G76A1j+BlBn3YJ9iu9q420MTVWK4iwO8I6fZ9jodcb6VqI38NeV6aJJ8gP0mxwY7Sgycs4n9MNvHMzzmx+gwk5D+Vug8gjCgJxCfCpc0PMoGtK0QeQHCNWrdZQaRbj7nB67IhKfx7Q7Uls1bRD5ARLdonUULWnaNUG0mLmk2zM6o/IDzOQAKQWz+M0RPt1T6J943GRjsNnNz9FhxhHsOL7BklWbj6HaOM12IxY/WuHbEiaD8gAVUaLKbXViC7eyLUPwohNMZ3VZHQDoNcYB3Fx5FXaZANGLzDrG/0gP90n1DN8Jp6MtD9A08SJzNe3cRZTJIth+CVe1m8jL/mHNLCZsR3l65hZPBwussh9KfcB9jZFVD+9yIj8ao0LcZyIsey/z6EPGfrRq57lPqvMtFrdhMIpWfSdawRcwy3RwGWH9YAyhTdls7XOEwQuMUZMNz/UWW96vz6B8i69PHIWzlAdoPoPixm9Mciq53JEyBsd7mXeOcR7JaRftBNXGMKrNRbabTBhrb8sDNH0NnHgCoJcYkucOwSyRkoPQy6we0PIr3Jv1EAh3Q2xjH0iK80NyTV2E4r/E/Q9J125J/dimpLsojYFEV2wrXqbn5JCYW/zRvkV4agMibEMYPGUEAIT1o1DeQzHC+hFL9nu0nVPNo7GtecKdr6DMOl3/DTPB10J2oFW7wHkuu6GkCnP7rmC29hXENuVJ72QFxdENRPkhMbc4DXRg/P6UtPr+ybsgsJjtwWBjc5vKOidbnLkDnjt5J6eRS/wsfcf9+6YI/vjzqFxbilFtDNqyxhgUfQ+/eSn2YQlXH5SvoGnfFT3Aw40Mqc9Kk0E9qWnC05qOCUpfHzaicvXBmLXG5p8F2NrzGV8GTkHhVz7Jb1pzREpWVC4TCyw7bsmAt9huiXEKM3s/RVqcHBLzPiiOw/ouvijcwyf5PRkm4HamPo8w2BJDaGbpKheMsN4NsdXMtRHe2tRunNb/IMC8NCMLKqlGvgpUmx/z6ZzLhchER3TFZiWcpJmVz6BMIjmN1ALkqwBhO7Pk1HZCZLEO64oNK1rVySGxPLYHivaC0NUelXeiq7CrXLFTo/wZzN1itSlzpTh94BMe5yCWsUgq3SuthXXbYoXsxR40hzDoy4WKA09jujUldP+vt1ipP7UTQremU4I4Fac0v+JpciVRqhfxJbZtZM7ZZkmXv8WEBREmUCMdV3iYb2MmnVhkrSkzadbon9gGkPmlYR45JT9A0JTWJdoKiuY5jSgNwPwSNaT5fjPTEXo1vUr0Jc/Rw0gq4XRC2G1+gGFwmH9vZ23VdR2FkBt5zhT5AYpiKxjgbph/4LN3CGa4rUp8DyMMBov8FgcoFmEwhrC+GV7lPoCecQrP2xT7ljlQXFYPMLU7s/snhHs4nTjEmdovqfvV+r8BAAD//8EqMs8AAAAGSURBVAMAM/kDbxjJW3QAAAAASUVORK5CYII=",
  "building-2": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEoklEQVR4AexYTYgcRRT+3qwJepCoGA8RxIuCggSCUfyLE7wYgjvtzx50zcyyXryJRhPQg3vT+I8KgrLqzG4ussaZXY/ibgTFCIsHMaggIoKCPyieAnH7+VVV/1T3TvdMTxbdQIp69f5fv656XV3dNWzydi7BM12gajMYdA6h0TmKoLNMWKkIy/Sdp8+hKkkPl+C+t7cz8BcMfASCB4jrhNsrQp2+k/Q5gqD9GUxMMoP6EAmqYOvYBwy0m7BBXW5izIVhgtUGGgXzExC5JWOn+in545XA+dAl6iJ7EMwFEVeIBieo4a7EW/EnarIDvdat6DbrlcD4hFsuh+LvJF7oxU6EWWJwgsCViJvgYxw78EvMVsaL9/8MwUeJn8hVCV1ADJPgmOcbevRopGoaQ+DHRr82OEFBGhCq/YJUkmXiYQJBRx20v0Wj/Vw+1uAE8x55/u7ONQjm6n3B6PL2KmFe5Hi5GiJPcK/8BPV3zncy4MwSDNqzLPqTgC73BcVJzspb8cUsFi2/puA2bBt72dpyKDemQXmXfeV6akXu5FjUVwDZy8qZ4A2aFwFsEzyM8dkLDT1EgiLG0IFPW8kMzNZjyX6D/kHpDMHrmRi/oXtghdvWAtZ02jMCZOt1YFufYNB5AUH7O8TFCxYyDV1XdTgau8030Wtewv1Q+kPrUspnI+sI+TE8emnq68ggQuEOQ6QJTrx3AQvUvCEOAlK0P63hP25pgqdPvQbBzeXXl/PK9UNo1X8wM8uddVancwnuP3oxtQ8RXFeccIUreylgIXO03VsSwzc6N7IUFghFRy/q2jcY0wQy+2AuXmJEQpzOJbgl3ElR2iWcRK+1AFPAqr97Cu+BsdJ5jvcSio5e1Em2BkeaQeAyXiTt3anvU6aEEpwu0TqVav6mnHzI0c1gqNmn03cuW5K12jRLwZwVi45e77Ouc9vHkK/OzBLXpPguy5Zk6cHPWQr3oPjodR+6rXQDNjdeFs/oY1CXk5vBWLgJ8VmS4Kg1GM94o3MXt5pVvoH+ctBZxfjc/lidwWU17RsOXYNwteB8fdpJeFo5DMEiOX4ayDbAAHahph8yab6VkGt+DJ/OmUXs4CVWLX6AzDlQ5Nko1nqkeB7B/B0ZRVk831Bd8i7BUZdYw6e8mL+SftSBPcWAM8ubW8vO4oYvcdm2ILgeSdPX0W2+YgHyRirGzoQ2RFk8o48hM4OxsDKWixKXUL5JaMhXCS38TE2Y6oRbYg3DQteKS2LjjFoy1jkZ7NHOJSj6QyI2xPi7ewyyoHA2lnGFa8n8EC2JFY/yZjIPnHWOB5eTu3h3ajUWW1yrHed+dgJBZ4WFbk4qVszvBn69UWbkBiKpRYIZa2/kqk/Db0YWg6BfPL4OlR9ekZPqKSy2vjScS9BQikcMSkHMOY7BZLsnMzRliMFT4VoyTi6WJpt0J4fx6xtvd2JpCKk9ZpCBNMFe81UKniT83/0wz6HJLpAmaNLqNp9Bbcz8i3kciiWKio5RGytXXUSoB6H/XIFuM/N3IZsgM8KxyR9p9CJ6zXHian+wio9d5XF6rQZr7iX0pn8yKfiwPkFfuwnoTZ/gvwAAAP//LBhl6wAAAAZJREFUAwBhIfNgflQE+QAAAABJRU5ErkJggg==",
  "layers": "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",
  "circle-check": "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",
  "user": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADpElEQVR4AexYSUyTQRT+Xqm7JBJRowfUeNCjRhOXg8CFm7RgJBJpK0QlEvWEMdGrRhNcY4xGYqA1EgWUgrsnvBkvLojExJsHPGnAja0d33T5pwWm/1IiaJzM++d7M2/efJl/6Xx1YYaX/wSzvUHZ72BpyzJ4Qz54gqe4vcvWDk/oJLzBKpSFlk4vQW9zCWisj0mEQHSc23K2nSCcAOgmouiFjIHz4nwHPcEGwPWUyeRplyfkx2I8wTPaGJMBZwQ9wVoQ1Y/L/Z39NwmTmGGiEh1DaWh/wrPV2CfobV7DK1xki1eBMQb1CPtz2dYnLBeCjiI+xsNcCRdQfmslI1vVPkFQHe/eXGMVQTuY1DnDT4JO31m4RFnSBWEBopE6w7cIHBBEocotzqPL90T541BH4AEgLhm9Qmw3sEVgj+Cu1oWcdwNbvApqjYMMV0K7GqVNKGpSu68GtMgewdGRzQCpObPnvoVZcc/rMUIIbixybzF8C8BlIUaFRCNflMPo5+hyvmauw8NL0gIIX9N8E8cewcGCHqS+mbOi6nbrFqLoRjUkRuGe80755sgewe7iMZBQCwjRgJLQAu0ypTdy+e1N+UjTa7RVRLTxkwzYIygTCKgFCasxHw/hbVolh9JM9pGb32JSY0KcToux4Ngn2Bm4AyGaUnLzZyfnA7zBFnhDe/nQsC+GwX1E6rMi0IjOQEfKPEvQPkGZ9hcd5uY5W7LOBqgSQBOIGhHH3Idk6cZA5EjSsdM6I/jM/wNhXzGfVg7ybn7TLygGeKyWf2mK0V09xNh2dUYwtgwJdPmvIce1ln8t5O60cXc/E/7Exo8BDmEkuo7JXed+xzULgok17/n6EQ5cRthfwbaCn7MCtt3o9F/Bo+rPyLJkTzBLAmbT/zGCE/VHN39arFi7U51ifQeltpioPwr5FlkxxzrFGkFT/cE0rVZCPqSWsahTzAlm1h/yY23FpFZxpFMyEzTXH0X8abFiUqs40imZCVrVH1ZvrwOdYkIQ8gVILC8y649ElGljU6foCTrRH6bsEgE2dIqe4PDwVqTqj4GIfNAxJWUoR2kZqVNyc7bp8uoJupCXNsnhaSQtR9J5XDWYhLGWsDjWTnLRE5wkeDq6/mKCJN4bOyZEr4GnDvSpVPRK4XSk38EOP6s3qoNACwg16dOmwIu4ajj3bT6VH+C/Tz7qMuoJyhlh31U+eO5BOPBSulNq96tecO5KPpWzhoG2ZCaonfbnBmY8wd8AAAD//6Ilmb0AAAAGSURBVAMA2whAYPTvKhMAAAAASUVORK5CYII=",
  "users": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAFB0lEQVR4AexYXWwUVRT+zuxSFiqiNv4+EIxSfNBExQeFROoLpkS62xgJSHcGCAYUlMQYf6KGxBC1IVGMEUFiyi5aAzTsDmIh+mBVYowP/v8laIz6gEbQCGhby8713JmduTO7M7ODW2NJuLlnznfOPfful3t3z9yzGiZ4O0uw2QM6vR3s6r8YuWIeXYUnWJdZBpAtbkSu0IPu4kWRZLoL7Rz7CHI7lqKjLxMZFzKQnGCu0Alt7BteowiNHmedZbkdhEcB2gkhvmKytyKsCXqN3U8CWj+mp45y3IvofOVc9jXsyQhmC5sAGmQ5D5GN2pjsQWQLT4eEXOr5CK0ctwYt1iEs7LvE80eAxgSzhdUgeqBm/km2P62KxAyrneghdBXvqlpVRXcC4nDVcBThGkzS3naM6Gc8wdyOK5jc1sB0gftR1qexXFuVaXy8DwdiSGxGrm+m5yvnh1A22iGwjIke8/xEV0F+pxHd4gmC7glMtagTpv5swCcN0+gFiUUS2kI0FUjdbWP/w9T7oaXnMNFflFs8pnA9akAQ89UU8Qz25Q8quwaVjP28O895XiFu9rAf7F32A8dtUC5qhzwp5QigaIILiq0ceR2L0wXtdkDMkzCgRukGdA5OVrYfpd7zW6ikLwzYPiOa4FTtRoDUeEvmMzRq6SmfeyGENCYfu8mz/aCl5Ue/Cc26IGD7DEXA57ShVfnN1u7jrzGVKlxfrR4dDe4E4ffaENseHp5ua/ehifA4Ho8muM/4mMdVn2Sp41beICJrjucQYgSlvExFnssDKbrawxKMVL6VKkyiCdrR4hNbyYcQm7BoG/86pREid+w+BwSVpInUcdeGk1jvuYQYxYGVv3p2DYgnKPwfiMuRmjIYyG/uYjLn/T38BkAz4TYhnnJhQOeKvQCnK1QbUaGKQlU8QdPYxUm4zzeT007qe+QK/Zxgl/NrbZWNwT4ilVYEtsM0St687kIbx23mdzCnGDzo+YU4gdFTTeVBYJju5QXfYfF1WspGH4i2AzaGrw2hJaOOUA5Y9C5A60GYAdVOQsPCuOOVofE7KCPe1P9EWe/gnVzLckK6QkXgOI+v5dhbsGfxcCBGXhACDnEYQpuLknEo4A4xGhN0J5nGFqS02YC4j117WI4woZ9Y+GuAdRirzOZj3cL++k5iHTvf4thtEDQP8r1s9kT/iDjY7ckJyhl780d48edR1hezXMaEZrAsgam/gMEVPyOqyddgWV8A01gDM/9+VFiY//QIhq3wH/vOYIL19ccQp5YkMsDpZCOnlR50N1+nhO9geP0xn08ziYxrnVJPMFH9wVQDPcqgpuuUIMH4+kMm6yQiLwhN1CnBu6IiKG+1RFsDeyHgrz86OLUkEVmrNFGn4Epkd+ouD0Uwaf3hzmykTaM3cZ1yCtdDQNUpZHnvZx9ByB9A9WNFfP1RjWqoSkayOmW/wTdssUGtR7Nw26uzpO0Q/Df1h5ydRJLWKZYlv99qxZRl384dghmaC5CDwe2PivyiMxiHPpJStQwhjfTReaGrZlrlVcw3JNqk4ZDScL40PBlaMeLhZsGBnuOBJQj2Bwd80qi9AQlkpNshKNEElTOEIPFfZ+4OCvGlC8dRf+2tpVkfebge1MU5O1jSv+DY1Xyh3AXCSsbj2yuaXFNeclehvPy7yMVD4hyCckZZf4kvlEtQNj7EeLfXez6Ac8l9OXbpkDhFMHbm/zc44Qn+AwAA//+xlOtLAAAABklEQVQDAJf4zGAH32kBAAAAAElFTkSuQmCC",
  "tag": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEO0lEQVR4AcyYz4scRRTHv1WbYReEgD+CElSEKImIioJgJDHR1QTFnel4VJzO+guP5qR48x8QBRHixmRnNiTiwZlJTIywYDSLelIQSVbxkkNISHJYcsivyXTlfbumu7cnu9s/d0nTr+u97nr1PlNV/aprNG7zY2HA6sG12NHYCGdqa2qpTj4PZ3Jd2b83DkiwWuNP6O4ZGPUbYH5OLVr/Auj/4TTOg7AlkUaArzUehL7+N5R6qljbag0IW22+V6wd6x0BrsK3gLobZR0aX6MESAtY2/sAoDYiOIzZg96qNWjXVSbx8D6MuRo0A0LWGu+Gdg7FAprKYzHf671PcPiNi7F7aYxD9QmBelkgL4fVlZoo0pMWUGN12CCVH9++wCKXtNwZgXxJfK+I2FNhN5zmW9bIdrWA2XySa7fc36HMqFS0kAoKBo08kMsDKGQoCdICesawzSVlbN8GOI1p1BqX/LI6tR5Jh4XcFs5J9iTQzDInLWBSID7XQ5OAGoXCWVt6YiP54Jw05pUQkh58u53mO1STxAJqpZIqCtgTUmcGbXe9BPtDdNpSpDgP7fxVfAgZpSBgj4xGYgqygGmGGDglKJvgNE9CqWdFZsVOf1rI7QIaQaZIQRYwTRhjPpJqMxLg/n5JW9QMZwQZ5cmE4baAaYa4406jXd+Mjru6X05nQIuqElIjnicNJmRkFsyTFjByXxnNvt2jEiwxT1rAdHNQ2ivxtJC3pqCBtdsCatUtMXT6pqIUFH9xxvY/EzRiAZV3Mrjhl86U45crceGcNIZv97wXx/smCG0BW+5/cuO8SP80LTj7OUf69jIXhFTq0zCKwuPY/t1dtC0gNXgf+kVwMb0fMNZ8MTCXvayMfBWLMXzlSdoRYHvnQdl/7OVNX5QagTZHVqwnr13b5McNLkPK/+SLAPmg7cr6aOKQ7MnlHu5X990H7X1JBF/4Vd6q/0M9Dsg7hDTyxUGdwp40vSPY0dxCs3SpHrgXlaETgFqH6PgiUG8F5JNO3R0Y7mF45tjic5JOOcTvue4JKDwcehvzl6xWHwf2woB8ulBPanO0tJ4cO3APKlr23eoRhvPFmFl4lW2+3r8sDsgK7Mn4cA9LT/5UGJJwmj2nNjCMLxZu8+BmbWlAepYNmQGO4ZMBWassyIxwDJ0OkDWLQuaAY9j0gKydFzInHENmA6RHVsgCcAyXHZBeaSELwjFUPkB6EhKxZZEp6BhqzV187KcifUP+YRhIJVptGUwlfv1FLvkB2SCTeRxyRFaFz2Q7eUb+6jgu+rwVAv+i672AVn3eZx0bWVqKAbJtQhqzm2ooSq0NdaucQre3FUfHz1kz/bU4IGN13A9kO/q6rN9zNCMxnuifY673dB448UU5gGyp47bQdu+EHnoIyjyHXu9RzHl3oF3fhePj0Z6DdTNIeYBB0O/fPA3u2A6PzxYBC5q7CQAA//+0I/j0AAAABklEQVQDAJFq92DgkbV7AAAAAElFTkSuQmCC",
  "hash": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAC00lEQVR4AeyYsW/TQBTGv5eUhRGJASgCCSbYYUJlAjGgVAiBKkIy9B9gZ2VmYgWRCAYqoaZFCLFBJ4SYgQExAAMbEgMSiORxjuPzs/POPNtJ26GWz353/t3nr8/NPScN7PJtz2DdB1Qvg63edSz3XqLVv11oxMopIvUMAncBugDCHVx+eBrhzcpNKVQ3eHHtAIgOe8UmjvhYBlZOzhFxdYP7fx8VOsCIvmf6ScfKJXzuXN0gRlmDw4WvOe1J18pN8NypusEhLXot5l94fuOH78vAysk5Iq5ukFhkkALZc3eycg7V9uoGQalB4m+aeDxm5WI6f6xhkNNHjIIMwsrlrcX9GgZFZgBbBgu52FD+qBts9c+6CvEEy/1XwUY4mYrxSj2u5+7VO5PqpZFuEHgE0DUASwXNXUp2OuGiEOsuJXuIi+5F9xNKnkMG/0hoJ2Pd4KixCuZ1Z+y12hjv3Xi6M2+5zjRr5YCnAK86jaldN/is/QYb3SsYdM6rjeieV4oW6Y3uUi1u0LmKQfet1xSBblAAeigXaXzRmWjUykWs3qoZZCwKufASY+WEWD6sZpCQVhGgoMwZubwr0a9mUGaGYctgEScM5cNqBoHj8BuFM2jnvFo+0A0WVZJWfwuEBS9EuKVWESs3rlazrCSEc5Ab4ZTrTlcRK4eoWs29kjiLc9r1R1xcST7nvExXECAas3IRO8NKwljzBpk/IlRt2MjF82dYSUi8gFLBJ9jK+b9WD/RHrLOTUUoXaTa+6hdyE9nAqYJBkcE5vuonfssbZDqWTEZRdbByXkwPyhm89OAg5CIdyqCV0z1lRssZbO5L//8iGR7qZc7KRRr/aeUMNnAoo/c38HOHlcuI6Z1yBpucLr6MT3jR/qnKWjl1cnawnMH1zgf3K1Z7/H2FsZKVEj0rJ6aEwnIGI5XNm4/H31c2O++ibrBZuaBAfKG8wXjeth13vcF/AAAA//9FYchSAAAABklEQVQDAPN7ZmAEAPjvAAAAAElFTkSuQmCC",
  "clock": "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",
  "briefcase": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAC+UlEQVR4AexYu2sUQRj/fWsEm4ggQRQUBAtJQBAhGBBM4wM0e2uwENE7YnxgoWBjEYSksbCxsFLRxL3TqIhweWBQhMRGsBFJoX+BIaCFYlCJ7H7O7N7ezuw9vL01j2KH+W7m973mx7dzy84YWOUtGUHz8RYcs7tgFbqrirT1FjYnqUFzBCWxjP0exp/PYHoL8HRVkTaX52DZ7yBjmmAan+BRexuMxVkQ7W58PeoUMR+QGd7aeIzvGZ9gC54AtBGxG7WBWkbjhsUj6FWAusqLMN+D09KGYpaqirQB98v+wD6Yo5sU/M9pPIK8tkPLuOgMYOLkV02nAmlbdK6pKsDZpeP6KB5BA+u1dFNnvmi4GnjRN6+reYOO66NKgmbhCDL5u7Dsl7DyM5owD2rpovZaWA0iDGk5vRhvrTswC4cRaTpBK38DBk+CcA6ggwD2a0JoF1jtuj3qH+Iwxs8RifPWOi/WnkLGvh46AyFBy74kDFeFrGwnGoBVuBiQCAmCbgXK0vhJjG80YXwUWO26HaiFwxg/R9RPrqX4uDcD4BO0HuwJFN7ocr94bbQL6daEMQS1FbO6vRZWYyD2caWf3Dpny25E62Da3r/dJ8i0vWyUk/HcsByWVYpZ9X0plqYd4qe0B8nwiUpNPTGI6pkbsnHDOdbIfI0Rk54rJCnBpIVPK5hWMGkFksanezCtYGMVWDqvdA8mrW1awf9TQdeZ1xL1jOzUcABc5mDa9Eg1cmQeyq9qJa07J4H/iA2elaAshjECM98rDi/6rZXB+sG91q1WVF9OLCZkdFTkzdjHQc6IsCrd8Tj5BIt934Ql/OQm2gsDz1Fxa0WDwk/pPI0Kn2o6JQQszjURH6JnAHUiaIzbGO//IaFPUM6cX5fB/FpOV1b4Fb47VwIOIcGJCz8xljsAl06JqkwKhwUhy9UXwJgQBTqBYu4QZvp+o9RCgiUFxk8/Ek49KGZbhVS/tap1m9W8vhVjWRNjuacBjWCsJBhYVsmYEkz6IFZ9Bf8CAAD//y8PX30AAAAGSURBVAMAYQNUYKTbvFkAAAAASUVORK5CYII=",
  "banknote": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADJ0lEQVR4AexXS2gUQRB9NXvQmydzFAMeJAeF+DlqQBBF3B3PmlnxE5AkBOMnEM+iMRiCRkTFkJ31rLOTgHjwk6NCEE/iScVbQPAoYqasnt75aXbY7OBkAzvbb6q6errqUd1ds2Ogza8OwawL1MlgJ4NZM5B1/gbcg8XqMZTshzArL2Dab/KBH+sBitUjf2c8mUHTnoDBCyCcB+gwgIP5wI81ILGfo1S5LjHDFhE0K8NivSpY30Y0DrN6ISAREQTdCYx1+VHkYk5QsSRUvbE3VdegCZpzewKDLz0+C8fqEfTlhB6Je06gG9FmFCu7VEcTZOpWnRBueTbU81Ic63EyFO1QfU2QDC2VpX1QUFQ0MY9ZdVpGyT4O016S0vRDQ3RVrlp2KBNJc9IEDSIxtdZKlTEpS65M7gVoiwZ6pWQsCOlLyHhpgq06Mat9ILrZcDpjEuaTQw3H0wZYJ00TTFviE3aXLNu04C6Ozm5N+GTvWqy/LPpFDf4uEiD5YSWZxTR/iF1NL/EKDwE0IhjCpsIg4hdhb9TlGTjWtA/Q/dDO2B3qSknzp8YDJDIYGFeTRNEB8qAzHj5Hv0K17tDvMzxf+jfyT6OvqluqP/VAEjpg2hIbuAdIdhQKNJOcjg9hnzAo22BYCuwVEIevKhl/L4haur/ouaaX+Jm1DKc87EPpkQvRjAm5Ba0LkNelQbdE6r3KYMnlJOKX8tHQX+zB+oroDMbsa1KdUy/hcfIQxB0QRjFvvYqbmtYTGWx61ioPuuUpeLRTcvUIzN9kO3zxdWVTh2aVKWsxZctgEMnt/4SaNYBaeZtshW4o3RVbMN6KTCwxe7FT14q3/zJnRXnVGST+rDohinMHQj0vRb2VErE0J03QOb2UGDOMRSkZb5HbN4n9Tvbu65AD80+4Zb88aYJqhDGiRATaL3pO3yTYJ7GiRsZo0IkI1iz1l388GFhHOQanP3xVRgQVI8e6AaOwXdTLYMyLzOebhNn16yn/lipgSaGXyPWWJKiMT09+hWPdllJRFJnPN0mtXJI9N4XaGamjikSEfwlGY22hdQhmXYZOBjsZzJqBrPP/AAAA//8zWFaZAAAABklEQVQDAH/ruWBYPJBMAAAAAElFTkSuQmCC",
  "list-checks": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADqElEQVR4AeyXz0sUYRjHv+8okXWINPoXsg5JYNQhUkNTM921yIPtzpZ46WBBqIfyEEQdNKEiIgKJWa2DRc66RRiaikWWJEUYFN262g8qW3PdeXve3XZ2RndXZ93JDju835nnfd533ufDM+/MO6+E//zIAK70AWUymMlgwgxUe/fB2V0ct73WuzXcJtqtqFbJWzheanPQ4T2JLAwBfBgOpdQ0qFPpAse7cJtotyLOpuHwVhvHsw5Yo7SA4YphkHqDTSarpFPqhaHIeLM1QKe3DRJr1wfgmIHGO/V6xDgHjq8R0+qZv0JIu2W8ywxY072FUjwBp/clqnt2w3g4lAtUPU+KlgAkXgb/samoI3xV5ZvwyblQZWZdnsKF45kBJa0VDIUUaCckbRC1yh6yQfOsA4ydCdvixPkvML4ffZ7nomqnzICQ/HowhvXQMEBw9wmuWfcLOEgVBPdU99lomAFVt0pzqlWPx9g6gqvV60AAHAfhc48ZfLaaZkARqt/TQRBivolaTJzPEnwV+j3DMaf91mJAEdMnt9F37Jow/2qOoA/8azgROz6gaFE9TeD8IpmjCKFyNeAoNhIDilaf5yx9Korhl5+I6mooOWAqRA7vLji990gj1qVcpk9bnjFs+gGBHgpwmCSWLItip8DZCbpXL+kHZAjqo6dicPO0Sz9gSGqgl6uP2EZTUCe07Ot0n17SD+h3jcPnORR+uVS52OK1Gf76aZ2OjNQAq+9soiWwg9SOI70baBzbinVAAScFx2gJbCa1YC4QWxptwLQGWHV7IyJw+WYW+2qLARPtNcR+IXt+hLIWg+N8CvPZl+zDg/mVpp/Vcn2v4VSa9MDlvbn0fRoiuO26D3iD2Zy9eHg0xb9nw0hJTHMGGXfF+rKrqFFOh1+CtYFB8heQomUSwawSDNR9iTrsupoBeVY7OO0zotEk1ong7AcwtiPqom/cOH5LJXZnLhrPDOhzvYVGwTn/Ee1A182kSOH8GdbklOGR63vEEefsUBrhVKZpHeYp6DUcPduMo5oBRYvfNYGQVEyZNM8tTnvgACvH3bqfolsS0caKmRb8JH0XNhWAaQ1Gp2Ss6PYD9yS9P0X00/o54uNDlLkqPJZnIvUkZ8beJ2lduknDR2On+ICih3jcPCTmXiNUTyllLiDcS+pbqIKyT1tWVgJYlMby0S/fgOFIDCg6+Ro+QZW7hLlsjRyfhU9+AdU9Yln97kXZTw64bCr7OmYAV5rbTAZXmsE/AAAA//8gN7MzAAAABklEQVQDACx7nmCmUjqVAAAAAElFTkSuQmCC",
  "user-check": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEnElEQVR4AexXW4gcRRQ9t2fc7CYGDMaIiEEF/VMSUfAB2Sg+ELMzE8VgdKZ7I5F8xChCVIjoh66oJKvxFdAoa3fWaJLV7RnjKgvCJvghfsRnzJf4oaAfPlCiu4k7Xd7qnumanu3XPNQEUtStuq+6daaqp6quhhO8nALY6Qa1toK53WejYJWQN5/k/h2mMeStIRTMIlZbSzoFEzY+PcDcrhtAs0c4iAWiLdzfynQbCI8AtAsODkP6oLslHcC8uRWamGQwiyKnJyx2ffLm05E+bRiSAebNDSDa3BT7KMtf1EjyzNYq0cPIWffUpI67eIC3vHkhz7CdyasCs8xshq0vZFpWo4UQ9CA8G5u5Ep7DKnMpcx3XeICnzW7k1ev1ZxE0wKCGfbnOlEvbeHtX10UQFiBLG325AyYeINCvYotnUSl9qOQmbtzYD4jnfa0QK3y+AyYa4I3WAo67nMmrgvZ6TExLGFNWuhw3T8xTcntcNMD52pUAKXtP75dIKtm+r3wXQhbzfrnKl9tkFIDmAE7114Dqr7/PCchhwrFjZwXUhN8CchtCNMCK8VkgXqa6LCCHCRou89VCzGC8JI8iX5XIDIxewTfTKORtVXOOBug6iM/dTjaEbRh4Zb5kQ+n2vacDzjO+jUhtt6+MYfLWTcg4H/MJcBd7WciPXsI94gEKqFuBcAEyfRMojJwvBwZI6o5Pvw+QsgnxFNIW94oUNrv3MHlVEy42t/E0IW3Z2AMhRhosfOxkvkPB3M3bMMiPhvUuD9YRqWNFYCfKxnjDOLi+q8xzAzopDFjXgZwKiNR5C2yvfx7xAMFlmjZxe4CpodJaFkY46E7A5dFQptDTe3+DDP4xr7m+WTqEnHmpb5PgMtjPtiA4W3+g7pMMcFL/k2+PlbyS8mYI3rv1KF5/1PWx9Wuxb820p6q1QsjvSgpL+KM6wCCXI/fGCkhwQJ801GiY5/LBSV0yQOklqWzsgEYXA+I+CLzNqh8Y0Pcsv8XyvThevYi3dQfr51aBx5SSzuA4B6Fp8lZS4BzxBINrfpQgPUA5w7ulH2EbL6Ksr4Wtn4eysRS2cSfK+suYWPeTdAmlirGV9Y8y1Sv/4wMrtwUVo+FH1N3QIkA1rnXO1ofgiIdCBsrXUeQ/XgsZ8O+p5EoKNPyBxCbY+nDchNEA6/lHznwcBctmmkpJY3wbDPHxU0RYnlLWX+CNux6O0w/beCkOnLSFA5QHZz3/0Eh+O3l27k9JyXmKXfwIlcGDHC+xzgWYJv+YEzZCQVjMD9lJPqTVjRThGqUOAozPP+RhnYbkAyF4XnaQpyiAyfnHSth6GpK5StfyFAUwbf4RtRfN+i7lKQpgK/lHM5gouQt5igewnfwjClSzvsM8xQPYS1ejMf/4vSo/dHSlzGRULiPzlOzP17QS1wOoYVFg0NS6mYDcifBB8Y/AcMKZATlB8AAmOP2f5pMEIIlv/FUS4rDPd4854ofSnEM+n4LxVnBc/5p9N/ADdA8IdzPf3VrVZMx9HHQ97MFvuU9dPYDS3dZfRdm4A7bxKbpd3it+Altfw/R6q6EVwFZH/kf+JzzAfwAAAP//mbJeUAAAAAZJREFUAwD8/n9gIJ2YygAAAABJRU5ErkJggg==",
  "calendar-clock": "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",
  "timer": "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",
  "id-card": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEoUlEQVR4AexXXWhcRRT+zt0khpaYSk39AX3wKdVa/CO0Ilp9UIomu/GlErvZJP0RrRaUVkEKCkXB4h+C0GrT9G617VO7u6k/bxYEJQ2ptlJF8U0rjRZqqljZ7N7xnDv3zr03+xddsxHMMGfmO2fOzPly5s5k1sJ/vCwQrHeDFjL4P81gz6Fr0WuvRuLAmoaIxHr4wDXlsh39BoVY3D4Ja/osFH0GqE8aIhLLUT8hYY9BOISYBgQfsq+HlT8NoltD4w2G1MUcvkR833V+4IBgEw4DtBTzXqgD1HTQp6EJuoxptW+EUntRbOpApp8aIhILGDbxgbvQc/Aq0TVB1XyTKEbyxecx2nfe6HMNJFa+uCMaprhSdE3QwuWiGPlo6BeDGwU+HDwXDaWWiK4JOkqJMitJ2F1IpJ9F3D6MePoQeuzt6EnfMau5f8eJNCdN0CKqObd7zyIk0nsAGgPwCp/2dSA8Aot2wcI4E34ba0ZaeezfqUpz0gRrZVACW60nOPJmlvKV6Am0x06UJRm3N/IfN8miQjKB+Hs3ll+MrZEMsl61tsd2gSh6kJQ6w6f9TGQe4WYm+XLEppWd3C1jCdfbQM5Q2FAO6wxW2+Ke4TYQngpN3g8Ur0A2tcIVwQrm3mLfp3F/enHIX+B30pSIg+9LbDMMmmDVLW6528xRuAhneisyg78am+BC7EnO5h/G1kp3GixgynkACqsAuteIQ53I9e9GjaIJVsug5dxn1iA1jtyG34zugw8evQDQBPxiKSbiK9wfH/wT2f4xZJLHjeSS3/JI5arIPbiaYGU3fitQsxlWnAejzACE6cCiFgW4PqQJVttiwslQiBUhHIUKKwNDKJu+sTe9HOHnW6+91B8q28/6FBN9YRYguprvu3eRGHFvedcuOJEe4cNxpatLo6xgu0VP2MOc+695O4Lnm6LzfNF3y3A10Rn02JZ1PJo8xYuPmjGijUDsAi9+msl+42JgAEE5gux6JhMYAFqLskUFB7DsOKAJeh9kBR+gpbWPx5gMt36VO4+o01fdXu7G5taUi6PNi5y9mf/fx+Go/VG3Uk0TLLVHLflLL7BhOUuF6pnlMs9f2uFpQZfpfweZ1DJEn29dGB2IXvTBDINqE4zbj4Fom5mhwe/cnfJEMEOvEj3Hj4dNnlZ3pwlWugcffP8GjvAmi64KBQbbOBNtLLd40gZF26HHeJgr4Q3ITwiG/7h6n50m6OBiZKHetP6/2VzYwtkLXiiKupnUaxFfUbLJV2GpXoGuEBajiba4eLaN94I27pYzJdgj6HwlihGFnVi7r4P1e1i8ql5HLvmxp5R2R1PHoPCWGVCq5gk1vkLOKrxkdAFOi3xC0ASPpc4C6nOxe7IZlzX9DNDtMIWeQSKtqgpha+BOq6r6hteyCud43gYWXRU+Ra5vUhRNUJAqruOOSXE7n1VhEjGrz6cQEMwO/YDpWCe/SvbyVkW/Sd97Tns1xXF3g4qdOLL+Rz9UQFAs8irJpjbxy6MdcPh3BvGrpBHCsTKpJRz3ccjzTbh4EiXoGd0uMzCB8PNoTjHHcoOWNpUJlvrOi2WBYL1pX8hgvRn8CwAA//+V9wPHAAAABklEQVQDABn5F2/56MN7AAAAAElFTkSuQmCC",
  "graduation-cap": "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",
  "file-signature": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAE+0lEQVR4AcxYXWgcVRT+zsS0CloEhaLg34P64G/BvgjWRAua1uxuKm3VJLNaa9NaaEvAQn1SRBBKqdXSSDSSnSSSVggziU0VrDZPgiJqEfG3IBYF0RcFrSbZ47mzOzP37sxmMnG39DLnnp977rnfnrl/OxYu8JIOMDd0GQpjd6Iw0paZcs5d//f3Lwyw4ByE1foHMP8ZwB9mJgufoOAwCqVpLBFsfYAqKLAHDSnUAQU27xzOGi4ZYMERYBI0a7Q0f8JOZASZDBC8SRvrC6BlFVybFk3MG7X+plgBecg01teSATJWhV2YB+F2fx7qixGYyHBjrDd0wi6ZlwcMWx0lGSDRxZr/r5q8ONGqAejZ02DkzM7ULwton2mLa8kA437ZLGXmWAfPngKoC2Z51lTjWjrA2tcVjxG31GYw8HB73Wom530T42ufL1ClA6SEbCwQMLXJz6T1gOypzwNzG9L80wGmRUhur2QouQ1we07CLT4Hb8tP9VwCe3MAlvFlMIDP886gz5dQNQfgZO838go/jfDwlZGsSfnSZuRLrwmNy1G4HZ1vxfyaA1BhmD+3BsxHRJwB8YvCo6fTuU9OlDMgGhfqE9osR+EArLkfBGxf5Agx61qSvJRVrOJM9f0Fr7gTrt0G9/Eom3mnU0Z9D4QblJtBhBUgUhldG9jTM9jIVZwbzoEwKXRRAECmwkey9YxHupJoSNWK0gEqr0aQnznLM0IxDsIt3g3PfhRMW8I2wrXYMHad0s8PwLyzTrI2qQaMiA8JsP5QX7b87VBWQnn2ZsWaD7BQ6hBwx9VgITFelcztCXUlzP39sGIhzbZ+r+TmAsyNPAjQNPSiVrZn79JN6Crl5RUPa7azON59RunNA5gfuQcWn1CDaDQAtbI1A9TCYXJ1E8r0VKA3B2DH6ApZnRPBIFUu90r76apcYbmR9bBqFw7vx2TvuxUHoDkAl5cfkXkXnQqM1+HaxgYsG/U6yfA7ARCfM16RDO/15WrVHIBgfcLPwLO3VcerMDU3CfGF49m7Kw5RnQ6QiSL3epJm33jsEoDaEBTmY4Ho81ypXTJn7oeAzM2aheM7A+kAs54ks//IXQ/LqvEhEz5aKGq1WvSBtEXtlddvzk1xCJ50gIHnojk/FLny72ih1Sg4R+RP0reylZirFRiMvf6osy9lB1gY2SGDvS+DnhJ+QPawK/xIUdUeiSRtfFT0HQDdCL0wvxFbOHp7Vc4GsMu5FVBXKLpf+t8LUL+8wu0wCl9uqLUK8zm5hu2DVwz3uloXXc8GsGyV9c6+TGzGYLzp283qFzDGxPQE/m1ZKeBeEnlRjxk8rYvX8xVAMqH5JIAZycR+zLcOiBw9XvEZAaMuAa7w3WDrFnmVV8Oze4QP40SPfIyK3GWaHJXp8rPQk5o1FLMBVN3c3gG4xbVQF1GvuBdTj/2mzAZ5tlyj7C4BJRuv+lFGa6TkhtcAtAnAVUIvCMWeZIDMf0aetDKSGyxZdEcYkfnSUNaEZICk/yvjbciP3qb1aYzYOboaIP2EOY2EkgwQFO3+RLeDyqfhf4hUHyMbRC3ljwWP7ApSq4dQc+1XxnoniWu/LBNcvqVUnM5D7cItHk4ap04GxdWzc1JvlX3vO+FNeljF3gpXFlSdEeoDVB1cewhu8SZYLdcD1N5Qsqxr/NhqDNQvCwMM+k10/wi391RDaaLnbBB+If4fAAAA//8Drzq1AAAABklEQVQDADhB3GCSmrecAAAAAElFTkSuQmCC",
  "calendar-x": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEcklEQVR4AdRY328UVRT+TmFLTTAGQ42ID77omz6YGFQKNggmYGKHhDaxprtK9F9ATIz6Wp8MGh80NdkFQkKt7kICD0IpsBIVn018MSYqSqoxGiO0pnv87p2d2Xt3Z2bb3VKWyTn3nHt+3PPtnXtn7mwfevzqDOD+4iMr/l2d5LDIygA+f3wTgtI1qHyPkeLHzF8eBcWpes4vGD15z/KSwqh0gEHpEEZKxxGULpDnLK9fusi0LWRA5FVrC0qhL0tCDsJcIg9g8cYlJ+8Caxxj/5BxJ3ErwL2fDDLhGwZPQjBOOUx+xrLgUUqXQjvQTjZyRB5jJ4ofZo2X2J9EULwCU5sdl5oAqqB/3ecMeIK8xiRPsfanzUX7PENwbBQi2z2b6pfsm1t7EYrvqLsU2oF2spETjhHGh2M3fCI7ERwNGgbAB6i1x2On4k/0cc1UCkMo54ctK96Be0X2dtLNgb5txzI5ZuxabisUf8chNQcDjT5A4CFEl2AWn038GnWtFPnNStOoNnTTz2LF9dit6o956sVrEJyL/SIPxzoVH6CI26/R71Nl4jKgJ/iLr0PkTd+Z0RO8xbx58gmcetksmebgpdggWAfncgExn5vEcSaq5cI4Kvn7eZumEv1JxnL+I5QL95HNU6E1QtPr9rVG95bljgPYWAvQYQTLeEusRozAPLjDW6daC5WwbZ5BZ4HKIENM4hqwrcVyJPE2KpoBMqK3yAcocKZX+VhA+MRv/6boMs7Wqs+Mal2xwgeo7ozKHMzTfi1Y7URYQIAInMsH6Dh6Rb3DAPpr0FsLiTM6cjTPk/XPPHQWeVLeGMeMntxImzmI/sRH1URsT1My6nY3g1I7wiWzFYI8Fm+esyBfmLrb6gJzEH2Q788jabiWY+8OIHAmLiLYxuP8F5AcmXrkUDkdqZ1IH6C/i73dlDj4wuArtFfJIYk8ydncFnZsO4vFza9ZLavJqOsDzBokyXd23wJyA8/R1QDJTp2qWNi8DyambuhEdAfQVJweu4FcC8iqBd4lODN8dwD3ntnAXXoZ/938l4MNkSMasragdB4mJrJ2IH2AGds9cewN8x/S3gCm+Jr9q+SIdqF//oOokyoz6voA4b5mXD1laLXfzaFT9Sv0D+zmrd1Fw1VyRMmn6MhrpVvL1eG+e23kyhqRN+oJVfTftQfTY/9Yzg3sgeKK9QkOW9lh48+gpn8bJI5fzr+Hcl7IOyywKGh67C9+t2ynnb7C+5E5VWbU9QECzom6y9lNRZPgEJHY2uZE/WMcCDzt6LdWVZh1G9YQ+SFUwrZ5Br8NzbbdgqD4B1/67r9Rc3ysrB6PlDg2awg22YqmUXU3GHyAlfwMVC+ZuJDlXgh2UL813yV2bNZggTpVUSmYP6/qXTQBhCgWlw7QO0Nea5rB0vr9zUX9GTTeswfnufsOQGUnu++SZ8ldfnMgJV/P845NolYbsjVPj//OWh61AozcFf4PU86/jnL+WXL479aqf58UdvOWHkby/zUWSTpA6779Tc8D/B8AAP//+IXNUQAAAAZJREFUAwBefhpvrv/QtwAAAABJRU5ErkJggg==",
  "infinity": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEmUlEQVR4AexWW2gcVRj+/tmmTRqx1kdB0SZKtfVKsSAK1oSUaJtM0KZKkp0Wb0+K1HjBJx/0obZFUUF9CrvbeknUzCa2oqQaqbYqxKIJvWCT0gdfRKGB2qw2O7//ObNzdmdvXRgEKXs4/5z/fr79z20t/M9bHWDUBapXsF7BqBWIGl/fg/UKRq1A1Pja9qC97zZsHloddTITr3L1JNcauQpTHuCW4SbYyd1Cs0IMZI8iFjuO7uQ52IkJ2KkHq+Qsb7JTvbCTB3UOlYsxLTJLvlPoTuyCmrNMZClAe28b/smcEN9nhVYJ5TuhGaA2gD/2Eyc342KtJ9EtoOYk5iNxvQ86h3CmUwuIBvWcdupeo84xYYDdqXsAbwKEa3L2KoNKjDH59a9WdLKTO8HkSr7rKvoEBj0nf42exN2BSo15gB3JZpCXVEpDjHEBvA7IrpSxFeCnxXZcKN+JXpJqHoA9dIVRKt5OfCHy80KFXWL5KVyIteRyrgNjf6EDmBJQWHLKPMAmfgOgaxE05p1Ix7vgbpuCu/0s3G2zcJ234MZvAughMP6AadQJtr7RILcMrwBihwDqQL79DmJbx7rO29jfNwc/55TMsUnc9ggFfRWWY1cg5AC+bIHosUAJllKnnReNXMy4A58gFlO//qQxEd0iwA7jQuaI6PInlHEMi3wHRp206Mt3Nz4oc04YI+PxgLc0s+l6Kbnm/I9Hr/hMle+nfWewtHG9JP6uwOtG4RXJIJ1xSPt85vwm0kU67TYOhCWwh/Rq+gBj2fBpbWycMs7VmJHeecx77bLch8u4TWI+24GR3nNlbKUqbpgOKT1LHywfIHvhJIuZZSHnasLk9oyYTwsVdT4D31akryRyNmQh628l+wCXLf9JCYaydKvhqzJMcs18CEJfqRs5crrfL9VX0mRvD1nmFzUmH+BI74Is0ynjQF7x9WBMhnlg30q5gL8E0VajK2HoEQF5AJ17Ly8xFSssb9ComE8E1fcBKgvhXTVoImqXxIVHX6vNR702SxZnBFy70YGPILvQrEnxxkCdWJqdQVdig1EVM3bydegXCrlG7+QY5AG68T1yIn8JDADtEJAn5b18Qp+ojcNXinynVO0DQL02dBVM42E0NLVh/MnzmhQP0QV2oqth0VcSn5L49fLurkBXqtXPnVBX1TOBq4w/y934poy65wEqkfL3jxIBugHAe3K/nUZT5k+AfgDhYRQ2xg64zlY5rQtGrbaMKzrmoruU+iX+e7krz8LiX8Vfcus5hA2692jAqdFSH0Ou8yNAG2Q/ljmVCDfGONhaI79WlidsMlLakbfYkgucPze6yswc1Nzq5UK+hQEqvTswKZfrGlludXFKkFLmiPEXwHIw+C4B1oV0/7GcpfKQ7p+G69wPYvkjwgcl7/mwM8+K/BoaGtdCzS1CYS8FqKxqidLOc3DjLUIET54qj1YLqMvgOhvl2VLPmfKsnUadbyW2HWmnWVeecDPcOMF1WuHGXwhtkYKs5QEWOGh2zDmKsQG1mbUY+aMqPxqfqSVPbQBryfQf+dQBRi1svYL1CkatQNT4+h685Cv4LwAAAP//4If7cwAAAAZJREFUAwBhlXVg0dpt+AAAAABJRU5ErkJggg==",
  "message-square": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACTklEQVR4AexYv4sTQRT+3kbBTtEDLQQRLORAQb1ebUT8sVnr6MbzVLjCShC08QcI2lxhpYI/spHUu6d4HAqeXC2IFv4B1yg23hUWmuz4Zicz654xHHvJZosZ3sd7b3Ym35cvO0XGQcmHFbjeH+hfB93mSVSDx/Aa8/CChWKQcD2C2zy++gtlBXrBfTjiFQiXADoG4HAxSLguM/ccqo27zGkiFeg1rvDsNcZog+gGvOa0FpEKBD3Qk938hfP7giC5mKobIp7pVlACveeH9ESSYzGF0B9nHCkI48x7kaGCaBPcxn7ZKIGCdsvGYLb+1NRFFaH/JEtFe2SvBJKjspwpDypSShmFSV0GVqCxImdhHcxpnNlmHTRW5CysgzmNM9usg8aKnIV1MKdxZpt10FiRsxiQgznZ17DNClyDSX2XKAdjIfquKuKh29qeoXHiZdkrgQ6RbEaG060xOO3MH3b8Ep+kHiWwn4Mnnu2AF4SMJYYYCirt7yxmiqFCYBGvJ7/KRgmUVS+4wQQ2Vj7zoypjJ2P4IfANaNc00f8Fnmoe5LuSt3xPM6YXDzeLZQg8BHX2IrqwpLl6C6y+2IcN8RuANkMPgRZ/AN8+0VFg0IgnENa3IPKnEU7+wF+jt0DqvANoK/SIxVXeXGPMIzy3MHic/6CpVueuQPqZfUDbTC/EdczWZ0xfcKEE/qZF5u0wsiFwB1H9Xnay2E4JnDu7wu/XGcZKSi9uI/Jvpv1oKiVQckf+Sz5Bu5AcgMoBfmlvoQQjFSjFyBOUHILaR9mWAX8AAAD//wwSlk8AAAAGSURBVAMAd1w+YClbXroAAAAASUVORK5CYII=",
  "map-pin": "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",
  "clipboard-list": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAD3ElEQVR4AexYS2gUQRB9NREEEUXwL4InP/hFCR5UVDypJDtBPPibNSqC4EVEPOjNi+BF/IAifnY3GgmYzCbBk2CMIBgMSBSJioigopFAwItIMm31zM7s7G7vzvZmNSpp+k1Xd1dVv9RkqrvXwF9eKifYkFwGM7WpLEjdCgOhTzCWaoSZGILAC0A8LAtSV9rEkrt1eeoR3No0BSQuADQV2sW1uYS6q5N0TPUITkQtO5/MqKwSpsGYtEbHuDTBWLIOZrLXfaVmUgDOgxzntkUoB2EjEt3sU2R89qI+tT08nS8XJxhLnAShnQ1Wo6JXiojivvLVMEQnEz5eTFlNUH6dRGeLGVV9XOAczKYtKr9qgsI5FVIeYPkYQJsBnGRkq5ns4r8+GlkLQNAJeL7YpxiELMTvCiPKKKoJglZJuwwu8v/Zedj7ujBc05YZ85uNLJQDVstUR9xzfdnWeSZ7OTPKxLEikEOCmiBheqAjRH8gd+55y55uBH1dQeAKOqz3gZnAy0AmmhfIIUFNMKRQINrxg0xyLeRiwCOej4bAZTioRdo6wvpaNZqgICrwaMd73MVsaxO//mikraNot54V+DEUvvOUognmGfzp7jjB0UY8OoIkeIvLW6Y+tShvxOvW3ZkOmeRVaEis95RCT0fhOzQtxWiCUsvH9tvTYCY/8/bUz+1Nf9htzdQO1Ax/4y9cfQQT9BixxCfsbNE6CekRnOAsYTJzGLJuk48sRGGEspOeRDQXP38s9jrlPfUIpvc94Qg1cw78ynntdM4SjpARzSbenEm/I5o5PT31e6hKmsnPg3Z8Ny8ym/PatWAhKbTH+zgnLmeUOIKxrdTVgKGhOyaq4wRHG/b/IIL5idpM3OH7xADnwcPZ6LDUkFrJY88ZfN/g+4upAtuyqk7Vi2D9rXUA7WLMAHCGka2OOMCdlYwSlW1jybWBQlV2knCaGRbvOAeKzAJvMq3XkODDrCcWfQq2ppHXwXxV8mD4Fd9v/MLb3AxO0rWwrQ3BQlKw45cgjKVw7xu0uaB1nI2urd04BL9UPYLScVt8EKrDp5xL730FeXdRoX1/N6St1PNRlQj6zsao1ftIxoDkP0pQiO9BsAgzA7nqgjMrcBleMxgE1BGk0H0V4jBiTctDNtUR65pqAQon+z4oipogqCXQJVoBcvpK7xCqXSNirMbp4TWWMbxKuOsJuU81QfdnCXTkqv7Wng2ZRxVLqAlKxbRVz80hPkFH7xCsWFl1d59DsK2GYvbFCUoL27oOO74QRs0CFNshKh03jPmub7kGipfSBH271j0foNodRjPWuvej775U+wsAAP//8NoNYgAAAAZJREFUAwBG485gu3KZ7gAAAABJRU5ErkJggg==",
  "hard-hat": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADqUlEQVR4AexXTWxMURT+zpsK9RNFJCRFQmyQEMIS3ZDQMq3YSM2oxEIiNHYWKCsbESRWhJmysdCZqbBUgg0r8bMRJCwkfuInQtK+d5z7fu67r73Tjky106Q397z7ne+ee88399133zwHNV4mBVZ7gyZXcHxXMH21Aen8JaRzr6XlpCkudxEqpgqVVd5i56zkPgjQMgwpiqNDgB8zpLdSojqBjG0jJ6ItI8eUj/h3gVtvzsXOfIvYCRAtiKemLoCaQhOMqDTKFjgu8S3YfmNORFbaVi5wS36GJDmP+t+fQCiJnUok8fglCnv7fANeJfpApyW+hCnuJxF7FmquZEBZrzKBzd1rUc+vJMlhgOxjiAcQFc/AERe0KYCOYjpeoLV7NSoo9mTmwHR3GnX8EESLTNqCJblmTaxJAyyBx4/Qmms2OCscXmBrfhPAPTKyXiyojNdgboO/31BhoSZ42AXGWz2AMANMvdhxbaPmLKC8wLbrjfIrexNjGGdQzCxHMdsT7rVEt3YcIo0VUHuzlLmFYmYp1ByKi8yhItq6F0bu4La8QNeVjU2z9ADGEUlwTPuDAVNS1OD+yC9mZA7ujFyAGuBy8oFDXOwC224skT3XocOY74m4C9q3AWK20VaukD0v/EOxoBIOQOUMvMTVLtB1ZY+Fccw/kUplQm+4xtWd5Z9iHQIe2APGL014bqvGBrALBLfoGMJt3Gr/oH0TMD/wXZZU5N3zsboMuI+FiVa0T1FDrLj/vTyAdw0+zmmQdoGEVTqG6Y3Gg8F3bytcZwMcno9Cxzfdfafjo895WI9CRt4uuicJKDF3nNOIsgsE5ukYQnw0aDIEfR1/0Nv+BD3ZLyETN4orZZ7GhA3RO80yz9bYAGUEUsx7+GHEjzaMfxjRVNvksRBbbw1wE0jg7puzkc53yr+NrsTCEbqE7/svxnwSZknnVK5O7LiiXxDhCnY56P+jDs5zAJ2EWQgrxJV3Mkbfgrll+qj6uc/BqdNHViCwedkaCbE+5sJXUEc7hNah5dpKNWsg0HEblWPYfcHjYZI2rClarFAoMDVNOdoKmc1ywI69aQECPJopVwQCFapRmyAC2fuaWMB0nuVYGXszRTD8t0ywgv3ec7OvNnDdM6UjEKj+fTAfAPi7IsfXRAPxPvTu+ax0BAIVKmYvo5BtkO+Q1fA/iKhpzFt2VkJp6MnmEJZYYEiglH3mfxCpD52xtmL7y0hG1A4VGPXUSDspsNobMbmC1a7gXwAAAP//3bvUqAAAAAZJREFUAwD4edRgBnZnugAAAABJRU5ErkJggg==",
  "arrow-left-right": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADHElEQVR4AeyYv08UQRTHvw/CcSiJhUpM/AssrTBq4glCFBNuKaAwuIjSaCzURokxNBZaQdRIAcbsXicxrhrwd4TEgD86CxtbCw0UmpDAQWR8cz/YPZi9vZXdCQWT92beezsz73Oz2Zm9rcImL1uAG71B4VcwbfXBsDJot/ZvNHkl48MBGtYDEI0A1M3tY2golQMa9n2AzqJYSFDRjLOtDNCw7jLEeVaPVPd5nNjMYEDDHgToItyyAEIKTvc7aCjlAXNwuAS3MJxoxhNzyg3Fa/kDroebB0m4npl4kUpnVwOmravczbty7KIegqZh2CIG/cVznpNJ1qoaECQB1/aN02+AEAOqBGpAwldV51hjRN9V86sBf/89DoHxkgFC/OTYSYCORq+iEY7ZDEVRA072LiKR7OT+H1jzQrSHt5d+ZHfOwDk9Ga32fM4nWV+rAWW/sa4F1CRb2XQhgcOonZvAiYlajmsRf0CZvggp8Em6BW3SCVkeUBJJyETyGD9lH6Vb0CYkZu8V7FibYECZfqxrHom6Fja/sBblVNGIs60MUBJIyJpkCz/J09LlB+Zaro25qhxQgox1/cFT8xBvCQSnR77hyGiwpjMm0tYPpG0LnY/qgwe4PcIBuuPCWbRyB0R7QTCxtPg2DKQeQGBi9RcRGrG08Aat9vbVWBlDD2B2dy8zuPsp0QFsw0teyTqOlxU9gC/asspNf3nxddCmHxFg2UXIX5T76X+cTP6AHfY+GJlUpLqcbeSX3tu8Vc3lqXN1E2pnx5F6mMx5ayo1oGGP8iTfAPE+chX0nJ/mXaUc1Iwd1aOlsbynBgTa8pd11qJdlU0NuIIBQMyqBsQWI1xXza0GfGaO8EnRAMfkEyNiJXGQQeZZXRG4BZ+TSQ3oDo3W6rCPQJD8P+097ob4+Oz3S6QPUMKtiFcM4t2ch+CYlznmK3oA2zMtEJgEkfsmLjAYBAcuGgD5I1OVGOFcXhnm23rFG/CzNQDK1ELIuqDDvHIXCnZgowGQBN/aM0wyxXozDBz3hwZATiM/NjlmiuFusBdK9ACGQirtvOkB/wEAAP//xsO3bAAAAAZJREFUAwCp2mNgBX3UOwAAAABJRU5ErkJggg==",
  "calendar-range": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEeklEQVR4AdRYS28cRRD+am24ogQZCFy48MgBDkiAABPMQ0IBKR5LySGG3U1CfkPggCASJ/MTggLsOsESwnjXkeACsWNDJAhnxFtcCA6JFZFLoig7la97Zme6Z3dnx4ntbFpV09X16Pq2Z6ana0sY8HZjACdqD6/5d91IDJOsDeDrx7cgqJ+Fyq8Yr33E+GIU1I7GMf9gz+d3FQuKvHoDDOqHMF4/jqC+QF60PNw6xbBtZEDkoNUF9ciW10MOwDSR+3H18pITt8Acxzg+ZMzduBPgzo9HGPAjnacgmGQ/Rn7BsuAx9i5FeqBfn8aIPM5B23+MOd7geApB7TRMbg5cygBUwZ1Dc3R4krzJJM8w9xfZpCVPERzbA5HnPJ3q9xybW3sKip8puxTpgX59GhPNEflHc6c2kR0IpoNUAfgANXwiMSouosRnplkdRaMyZllxGG5r6/v1bgz0fTuXiTFzh3c8AMWlxCV0MFDpAwQeRLsJTuLL8r/toe1FVmxvLqqpbMZ5rDiXmFX9Oef3noXgm8Qu8lAiU/ABirjjkHafmuVlQGf4i89B5F3fmDMSvMe48+QZzO8zj0zWuZUoBENwmguI8XxJHGNXsVGdRLNyH2/T0a72bspG5Qga1XvIZlfo9NDeeUud3oOlue0Aps8CdAxBga/EevgIzMYd3TrVMBKia3YFnQdURuhiAjeBbS6mI4n3oiILkB6DRT5AgbO8ym0B0Y7f/0txk342V7wyqrFgOx+guisqizC7/Waw2oWwgAAROM0H6BgGRbzNAIp4999bxfHaQR4uVxDUPvP0ZmB0QV25LRXg2gX6vWXCEs7Jm1lB9wF1ZTvVBxDcC8he7Po0PZJZmToUbXI3Pf1TEdxcrgz3pWCY/5IINS79ZgcKxVDpdyubyzX9k5reK298OvkPT6UujryXRLxtxk/6f/gqWqWnUNIRzFX+SxJ8tX/F6sKQG7q8CPRjfZq7A/2Qtpy8/i3O+SVY3H8FJ948g7nqajpzLBnd/L4lNMrcmvpx1dQ7cWDc5eT1Acb+a+82LsIHmLPUFsJEfTuCaR4i+vBEbdT6d7vsmn6kQ52T1wfYEekoAlN8m6JJF3iyzWeVZRb2fpHeLvpL+guC+ifOzLlicYCQnbkzZY22SL/yaKIeDrdTjop+4DXKhSgDUCSNcmWrPczt5KKVCl10hqXBD4lrs3yaKx/VMyEy9Yyby5Xh7j+cSnvXBtwajjDhVvZSjKud9Ue7npmv+P/r5OTNrCCcE3UGPPFvGIlIMnefE/XfiSPwrCNvrKh4KUkg8lciU8iu4E/UtWkbDwarPCAs8a1b3BAer3Pu2iq/8VvaSflZPpPIFHyAzcosHZaoj0m2Mvh5DvgZw/qzgHMzBxPE9B2aVfPnVTwEfIDgcetqazets+TNplm0hieySTMAaf76wHm+pbuhsoOjD8knyTdZc6BHvH7LOzaFMBy1OU9MXmAujzoBts3N8jKD3kaj8jI5+ndr3euT6iu8pe+g+/81FklvgNZ86y8DD/A6AAAA//+uNxHoAAAABklEQVQDAOa2cm9EoZCVAAAAAElFTkSuQmCC",
  "scroll-text": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAD8ElEQVR4AexYXahNWxT+xrr3dm/n5Xbd+3B1b7du3atIXpCiOKWIYq+DFLG3jp/yIIUoL3jwQJEQIT978SJk730SSv4fJJKE4oFSyE8kD8JZw5hr7rXXXHuvveY+9t6nk6zmN8cYc44x5nfWWnOesbaDAX59J9jsA6q9gxlvKjLeXrj5s3C9i61HkHePrDG5EfJxgq63CYRTgsUATQIwofUI8i6RNc4gk98o+VNbRNDNLxPP1YL+a0Rr4R5emrZgRBC0Pe7ID+O2sviB9JeaxH2Jjxr7WyOjVtME3UMjY1M+L0QhNwT+T3+B8a4y5+MoCtnOJjFM8i0S6Eb0C6bnR2ijttcEmf6NTZVyBwK7NOepvCvnAl11RP8r0TQK2f3xHPRf3I4sTZAcLaPxSGP2KwbhB7Tnqpu3PrH2EOlzVk2Q/eguqRTu4U7ZXRpEf6ghDWYtjb7LG1rxNeNMvSv/uxFRq1JC3rJXmSA/K9tlwReAEOhEvcvN75dNdC/yDWOqJNMrOZin1UuTNq4J/txxW5xeCGytN+5AU+J2ikVQh36KQ/KUJnhs9nsQzwTz82S3ymj8ZfaxDow3sF58E73+QatbgoMmqCZO5q6imBuMQpZiYD6upjWItCz3pew+FLODYv7V8YGdG4WeBXfLUbWCq/IaHhFBY3Agqd8AQYJxBHH8mMl4Y+B6xwUX05HfhrSjxnrMpD1ThnGXa96VIxI6U6B2aApoOZjqVy1tewcJn4RcYy32hzYWoryMu6PMBKQ94l6nW46mkxJ1yYIt8H/cJT7JrW2PuGfeNRRzM+SYsZVgq9Az91UyOxlt2yOW3O1u9kfcbgaW/C0iaFmliWk7wbRNEi4848jfmH5oPMwSy6aHsUo6NCyI7fKGK9OEYxrJunn2mbp4d+WHwPXuwfefwHFkJ7NRptl0ia80Xh+UbIw78j3+VkqzueFUAwSZQ2dJYugy6tMG6YcKWtjoV0m2E9P2dIg0/0soMwlkVDCmHvg29OtA4NmXjvAbnI7gS9N+B5kNglWrqEThkI/Zch7GS7Wg1Koq39LGwlxKMv+phJ0gYFbRaf6mn8rdLIJ8aQuGCzwOFZFjBbqpXaq1cs+PysrXiTr5GiF4w1hxsOyy1wIZY9mxxgxhh+xoS9lV99ey67IBo3zMH1DK3VLZ7QSL2RNSEFxWzho0CKDgBYZ5EY0TM6XkQtrcaImNGjkrQsNOUL6m8LF3lgScEPRHW4PC/N3hQg0QFNfT3S9RyM4C03ixNgvOC+RgRmvAXILPK8Gf/5F1VH5Jr1tjBLUvUJx/RRKsQSE7UdDZMhRzGXnntqLY/SRcKpR9IxhG9aMc8AS/AAAA///un/5aAAAABklEQVQDAPML8mBF3N+hAAAAAElFTkSuQmCC",
  "badge-check": "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",
  "circle-dollar-sign": "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",
  "flag": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAD7klEQVR4AexXW2gUVxj+/kmkQmssbQNtoaWWBG3Ftg/FFtvSlkJtodlZaSk0ibsbW7D0oYVSFPvQ0j60UfFJFESj7CYm4i2zG1RQ8IYQxSclildERRSvifdLMsfvTMzOzu7EGRk0Puxw/j3/+ec7//nONwf2Pwae8ufRCcZaa2BmPkBd+0tPYm/BBGOt4xFPt9NOIJ5RMNRRCHajov8CifbBTO+izUas49XHQXh4guby10hoBQkdAuQH2hsofgRVEPmI1gzj3hkS3YpYegZiLWOKoSVjM/0L81ucMxtTV79Q8v5BwJ9gXWYcpGI/MSla+CbyOQxpgTHqKhdfi2lpE/pI6Axa4Vjmfar+F0md5aYWMWyyb8bo23sQX1EqAAH+BA0sBuR5eJ8WwK6HMiZi4NazEDUFSv0MqA4vLD/6FkosfoGjJMujQYUN7IXgH4i8nEdpR1ADGHO1W2z+BAUfFwC3wJZaWImfYKU6kG08iK6ZN9GZ7EY2uQRWsh6jRo8hYa32loJ5wa7ClQLQFwV+3vUnCDyXR9hYitz0Y/mxn7Pm++sknIaV+BJ3B16BrWYR1kMbpqlu2LYJhZkuQF50fdcbjqCLEKXcQQhvY9M55JLzSXYS7hhjqf4EqvsJP+t7UP2vO8fDSk5BLpULkQ3BBJVImES+mE2NV6n+Yaq7C53T9yE747RzPIbARnDuYIJDyUaoLxOMKnxZwbKCURWIOr98BssKRlUg6vzgMyhFxYIuPOvaPsTXbVVRF4ddlNsnYTBBhXGIpxewCt7Kvtcp7Svsbjxj93F8fjCemYVvVtb65H94qHjzPuhggobMA+R36HIeMhaeR6oH45iLyoEjJNuDeOY/TMu85YH5DZyrgPzovlK9ru96wQRdbLAnMpGgOSxED5LsPpitfyCengx9AeMLmG1vw8zUcxPLnKuA4CsdHjTZMdh7f0MSVJe56L+0GAvQWtxkxa3vJFC/Mt06KHWNvbeJvMNCdT4geyCVp0hKQewDEKwEUKAcR7r0Nyp+o1fSggkqrMK9yhpkE3/TuliAHsPmxA0Wod2wkgthJb5DNlkF2/6UG2jmJepIySoPD7QA/e9ifcNJP1gwQah12NBwxW+yJ5ZL7UQ2MQdWcjxVmsR3f9J2kPRF9t6mcAIK7fwaE6AvY7rS9iLyoxAE89jwTmeihwv/T/uMpKuh7ybOkbBrGBPG3qQ18GscDkpqBAEQ5U4ylFzfTfQ11UodHwqF7YMJhs30mHBlglGFLStYVhCi+qOqEGW+/xlUaqeTVEH/f25z/BH68SfYZ0/FgDGZFUc1rKbeEeLmLOtPcHvTbXQ17mVBcMlBjeDPfQAAAP//2PdpHAAAAAZJREFUAwB+YTZgsDnt+wAAAABJRU5ErkJggg==",
  "utensils": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADuklEQVR4AexXSYgUSRR9P9uZEeYwDOpBQRRxX656UVQQBKWtUlEU7WzbFUFwAb14UfAgelEQBEWlql1AD1Z3HwVXBHFBBGnpiysqooJiu6GV359pRWREVnZlVpU2Kh3Ez3jxt3j8rKiIdPCLt3KCjScHYn5uQCzv+bnRsXpfWcnm25Ok8djYuHVtgtnWhWj4+hJMr5DJN8Js2dwR0Xchk3uKRaf/06a5J/5HNv+sZDus9Ukgc3Qosrl9EntF1upGQ8M9yVG2rk0Q3kIj7xIDC6SV8gCIhuDL55lQraHo48HBlGh1MCY9MvntoH6PAdoIYCoI/8qourVuhCD1U14S9JfGUcBe6OcYMVG/6HzBiWFStS4QdkVNek6w1o0QZNaOMHGoLUNeSj8/0CseByjyO+b9YHRCNzufTZBhzIl0TBSwYXMMHPUz55n8ZplOFVH9nlRyEgrNmwA2CNr5DEIq7ieM81rHCJndRubn8L5MwVn3rqGLhb1DkLxVsvrfIt87YSnaV71DitY7BIGRmgvzbancJT1PAL1EkEKCRNcSOFlmmyDBC61s7OhQGyAybKl2MY8K4vwH0w1/sKTCujZB/km7mKi/JsTcrbECFda1CaqAX2j83QjSC6N44wzcM2SeoI0MM16r6wF2BRl3jGQT5ZZxSG4vs5BtnWHoAYfGB7p5ua0gXm/Ybhs4HpobTHmk3iT/9D8lR/ATFQfCGhCdk6PogtYFgHcEOof2ADQIfmM5UT3s9WFFMY9J5Zh6k5xZ3A2mBRL3XKS6TtiCDvd8YlBsBYl7inPKDO3uTRQ/yh8r7ZAqXS+zmwrGAzAOw6OxKLj7TNOPwuUE/cwd6z6g0LQTheYpKLgUiK9X4mFxoGtzR6DNXYv2pi5lShxjXzFTT3HxBHvyVvq416RsSWPc9Sz1JklKruxs39mUusJ4P7R500JcQqk3Sck/cai+grfCnLQB2XynyEUthOnazuxpLKC2V1x1BYvbwHgv66nuHwI+qZKU/qp8K5HFyZr49lRSVsGEqELLQ7A3R7weiSR046YknrURlMCqe/uKy7Lzh0sll4m0Srx/aS0Jv5R5bK+NYNWv2Fi7zT0pf02ukJ2hheETLTnZG7A2gqVUvTH0Eay3yn0V7KtgvRWoN/4P/Q0Sf623MnY8Gfns3OkryHw5SMpyUJEX+UYJLLU/iK+Gwc6VEAPpCb71ZqPoTIbDg1BoeWMmqRsXmg+AnQnfPx2aDpr50hO82PIJHctv4GzzazPBD8NtyzvjPh2+AQAA//+6aBOaAAAABklEQVQDAHd7FmBJBKB1AAAAAElFTkSuQmCC",
  "house": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAENElEQVR4AexXXYhUZRh+3nGLTAgKIooiukkoohCCxbS0hcxqZ2ZDgqSdXYoCIciCrO68K4XIgrrIG2dW6CKWnZm0NQsxXSFq6aKkS+kqCOsiooRk5u15j+d853znz9k/FfTwvvO93/P+PXPmfN/5poIr/Fo+gmPNDai3dgZaPfDIcn3vpRN89uCdqLVmoXKSpD4ItFKZI3YY1c/u4HxJsjSCz0ytQ68/D8GTGRaCpyDnf0Tt4AMZ3wKAxROsTj2NVf1TJHdbYT8Bfb3vYLGFQeWOxRGst3ahoocgcoMrr/oT+ngYohthduQQuTGIrTdfi6CFjAskuLvCZ+tTNthDjUXxFc7JenQb85iZmMP1q4dhWBxBS/ZdyFXhZGAZnOATrTWo3fMNBC971RX70RnfiqONfxz++XPnAsx8DqRhubWpWVgtTgeRwQjaalyN7yGyOS6qfUB3otN4BfxdkblEL/jwOuMYGwYItsBqWc0QKhsuTtBWqq1GwX2ukOq/bLoV7YkPHVZktBv70K9U+VwyJwyyWlbTaodQ0VBO0FZfeqUqfgdWDaM9ebSoaAbvjh8OcoLc0Gsr3GpbjxDKG4oJVptvoNLvIr1S9bp16Lzwc16xUsxyLFfxi4uz2tbDejnQN/IJ1lufoCLvAxL7FV8iWKnP/4bFXl3m6vlhpn9NDYU9rJf1DJHkEBOI0FrzbZo7qLEoPkLnzKi3UmPvwqzuS3+jPb6F29D+VOIOvsd3pTD4BEcP3M+f9F0vSPEqVyM32d3xSvQCFjOJVjh3AT99D986a5OQT7BSGUk6uXuMktzHHrack2AXkDG/pG5Ozn2Cog86pz1zMxOH3HyljPZ4m6XjZ1L0Ic6d+AQVNzmPIH4zOHCFDNW/XGWRW5xNwycoSDxnqvQXS3VqLWrNvXy/HkG9dTxXa60jQYzFouQq6esT1OSiESksOda8l8/naS6oN2GvLuAxxmbVfCKM0dOwHAblSklfn2Budg6oMkliQzmefEgwBMX2fGc56hMsudV+Gb0rnutZ2t/ma+Cjy0Tuts9cLenrEyy51V5hRXxQhRxHu7EpVxVGPEpdExmZsaSvTzCTefmBq4Xgyt3pa3dwqff22h286u5gL/GNi3/+kp0/kQ8MHJd476v9nYW70iR+dR5gfcL2zZKd3wscPO5xlydyxtk00gTniUVyO+rNP3mcOpE5Sgns5BLG6aaMPzp+XSyu1mJt9hDcHBbj3239wdk0fIKdxjT/YJ8gHgoPj4KNnBihhMqtxEIJ7IQvIB/OA19xXFCbPcIIDnPoTMxwdOIT5CEP//W20TtNvdQyjd7QWLppiiDdsy+e5clkG1Qe5Wwv9RjVTiUrocegeA/9/oag5xfb/2AvT7IEI3dn/CST3kK7MULNP04VHbMGx0fQabyD7uSpqG16LCaYjrxM8yue4P8AAAD//4W871EAAAAGSURBVAMA6qSRYPQ55Y0AAAAASUVORK5CYII=",
  "trending-up": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADYElEQVR4AexWzUsVURT/nbFFn9SmVv0JrQoqqIWZpUL2xqBF1HujEG0igqTIXKRUGmQR4a5FzSgt2rznaGVYalJEH2S1a92mFpFSmYLO6dz5cHzz/JinYC7mcs6555x3zn2/+c3l3tGwwkcCcKkvKGEwYXCpDCy1P9mDCYNLZcDtT5knoVvfRTmemg/cPjHLtQevyH9tEY0pdAwps1wVLw9Aoi/qz4rUTap+eQCOTFWCsRugfYXKTzDPWB6Ag3Xj6Mq8QS49mKfs7AKoCrMNJlLpxQEsvbcaRzq3qgUWrSmrEUTXw34eCX3xiFksigeom1XYpH2D43yFbt5UixStutUAwtXpPsZPkFY6Hc9wtBn+wu7hjgMAPRbdCHfQOaSsdteNa1LmRSltEfXEBVdShmz6k5fIt/EBVltlIMfOb5eIcDo2kwocUat0+cIjYC5F7vhHP1EwxQOod5SiBD0gWl2wgpsQJnUrZMXNRYxu1Ut/PrhJbT9s43OkMi9cGGCNuRfsPJKuNaKeMO7CoYNeMG0bhMmm6Wimo5tnJWwT9YVH4aAMPekPfqJwYiKVnB9gdeduONQrT75WFbvKuCNHxinY6T5MYT+Yx928a+iy3ACXXDcwijnQ7SAEeBSTWpkwNxzmZvGIJ1V2boC6uRMlTh8I61Shp9wu4BQbXtid6YdGlWCe8BJiia4Jk17N7Mztm5M55iFZQZ4BLPt9QPmzA0xZu6TkmRSsF/WFbyFnnPGDcMpmXkhtlYAcC5PCWMrqRZQ5h8rnZW7UqcCUthMab0auzj0XCwHq93eA+CmINiAYzG0Crj4IC2bbGICGijyQJHFQyPxL3IOwM+9lnlvUjdN94h2yxo+gKB/goY7tAAlz5J9zELr5BrqM8+LNI/JT1ngpAIVJ/JEoFBccHZAHfBsm43shwBprG1Y5/QC5XxFQQzHXZVxQbiy1a4fk9chhjr9+/W8QyqHuYT9R7OQBPPpwjeyj58AM5oBWxGEOkZE1XsPhPUJ9M4j2Lpa5YFUP4MSYeurwg5K5BblM/nERdMSZbWMYOaNprusrzhJBjQfQrrVl/7zyktQkzDV6/v+3HkCFo8uQ15Eh5NLNKlwpGgJcKYgiOBKAEUKKDhMGi6Ys0pAwGCGk6DBhsGjKIg3/AAAA//+4Uir/AAAABklEQVQDAKNzGmBClJAPAAAAAElFTkSuQmCC",
  "shield-check": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAFhElEQVR4AexYfWwURRT/vS2WFvkwkQRJTBGJJGiNGjRGo7EoECDSW1AOBXorxvgVTTBIKH5F/EMUEoMoQWMIvSuQQNXenUBFwDYqGrXGpBpNJP7VEBABBZHSr32+2b3bncW9Xu+uRGOczJv9vZk3b373ZvfN3hr4l5ehIzhny2WoTTzqyvZxQ/W7h4agIlZedggGNjlCfT+hNv7gUJAsjeDMxMUwE80OKWCkR4gwGgZtRiSxDXPfHuH1FwGKJ2g23I8R/L2saYqEV8IilFV0yLYvCDfI31sYwdlbR0vE6mDG2wFjO0BXIFsYx2HznQBNg8LIFpoEAzudOWaiDgt2+pHOmgxwHZjg/K2Xo7ZxltxPLyES34fh9inxlQBoKvTC/Al6+69F2mpFsq4NPKwaqk+3ceck0HvuDyG7V7Z/teNbrRGwCyrhBOfFJ0ukfoBtd8LgFhj0PIimB6cqjX+V9iGkrDuwZ+lRwW5NL/rF6bPxGMAn3E69pZkgvOD4VmuYie9w97ardIssDido02oxmCISXhmnZWANztJEJGObBYfXdOwtdJddCfBrYnBGJFetRln/i2GD4QSJZwSMmY/KlnWI7JCoRpCKjRFiz+Cj2J8BuzClZclpJK3lSMZGyfz5YtIkV+XLj7h0Sr1L5G81nCDoUs/SRhQpa7zIdSL3If1A2hsrFKSsZiGq/Clf4wFaiGwhjMtC/ZqDoG7yz+L/CZYa//9ABIm56ChEEjdLQv5acupXULn1fEd2ft8XLoKKHGG/JOQbhddNYFou14LrhSFoNshRyPuEjX/uMnaJXnAtjqC55RI5m9eJrJWt83OmWr42IRGjAyAapVRX+EmkYh+4WGsHcfvkJ8hEmssMLFslBJ4WWSFb9ynUW44aqY3fIOfrfoDGwCu8DEnrTU/VARl5189roPvzMAdu7ikY3v+xRPIWGGhFgByeEnKvo4RSHMFzlWtlzR9FMpWmgulz6OSY65GMrUeJJQdBVu99rmsDVS7Q2r3RkyC+3Tn0tW4PMq9CynrV03MB257gD/HvPvZROEGmk54J8zUe1kGzdQJ9w2qE5Ld6t+jPCrlXAn25FKJqb4jpuIc1EE6Q2CdICCeonOxe/Bt6ymrkfe8LpWbIvezgwTQEnyC4AIKMDt8/Xe3jEOS871m3yv1GErnBk3Nd+QSJtDXdQdWGRxDYowYzMhJmYzSDh+5S27hYnJWLuNW2d7sg2IYTLK+Ul1Jtm8Hr5d9YZXBqCdqCnZWSL9dpHo7hcHeLpnswnGBTtEfSxibPChiPnq7nNL002NOl/vPIG3XGDWMjvnmkN6MFLuEElYmBDWD0KegIYQXMhkkOLqWZm5gIwjL4pQfUv8FXgyg3webYMXk6tajRRYBxAJGtAz80Qf9BbV6iGgbaAOUL2bISyaWhOVAZ5CaoRlWyZeiH/ASQ3V7UQ2M23gOb2yV6euJ/H3lOm4EJKpLlFQtlq79UMCPysPAOmPE3UNM6LNOX+6JsIvGNshvvgmi4ZvgZuscu0vRQmJ9gU7QL5RXTJQkfDHqgJzCm82d55arH3O1jg2Oiqb5IvN6xIXpcevzKfBBnMQstc7r9znCUn6Ca1xQ9I0n4NiEZPF9JzmmiNTB6OyWiDTC3Xe9KvMHpU2PKRvlQwrIXwFqcqqoZ1J9+mTM4gmLo1JRVLyRnAHzI0bMNUQVAFtAv57ISwU4ftCJzyJgh99xKtE3zs4NmEQYLI6g8pKz9SFqTYeNhUY+I5KtHHFs1J7nkQD7j88cLJ5j1kI69g86uCQDdKxGVU4BteEUw40MhFnVs0mLrjRUGiieo1lHZP1n3nkR0jqT0KqiPl0r6UIVUbDbSsaZcJwQGWUojqC+yyzrsfLxUHzAV1sdKwH8BAAD//wurYZ4AAAAGSURBVAMAgxHBYMs5PKsAAAAASUVORK5CYII=",
  "circle-x": "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",
  "circle-dot": "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",
  "file-text-osc": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAECUlEQVR4AdxYW4sURxQ+p7Or0wMhCeSCgYRlZpAENERIyEMCGpIH9UEQvKCPutO6+KL4LPgPFJQVe3ZBfFDxSRAUQfGKoD54fRFn1hW8IoKsYs+s2308NW5314zVXV1jL16aPVtfVZ/z1benuqpPrwUf+aUX+O26L/sHqr8XKoOLTK1Y2vDH+/79qQLtirOj+HXfRH8fXrXAOm1qYNGVYsWhYrl6rFexiQIFKQJshjwuxCVCrF1ydpvSKQUy0WYQpKZsGn+0YFOhXN2jceu4rRQICKskr+uvp2jBq7qLWY38YKUU3wEtxI2cgMyZVAsEWhCzkvt6vHYt7mdAX1j8dMR+PtHSuAcgMplVpFIgIhZg+iLAp9Ow56bVqB33gRYT0GRIIkQWKs5w2E9qlQKTnLOPU0cGRVyrXjsRACyTRfLkQzqR7CPCU8wPKOVuwi1UxrRFBrRcDmIBQ4Wys00ekzHfl7sK3PU8KTwUQ/ROBkOn1tjIsbfLDVPhGDtvtwecv8K+3OoF9pJBn3g142kKXW8hBGoB0K7QAxEs6IOtoLj0AhVB2iGLHsk+qjcQAm6RfRjPZ3vnx1hgseQM2WXnpF2pnmkb42LZcWRmb2L2dSB6Io/pMAL8ovIxEjirvH4eL8YwIvyHgAvbxpgP9r2zS9W50QRPh18GhCuA4HE01iPQC8y6SSz0ZQ3NMffCq4Y7J+3tw0fOajlGhfUCpU0y2Ri9xVnZQASnmPxs2xgHEAy26m5DNUH6GCqPIzlGL7Arg5wV12u4/3v12qK2MW7WR0Zl0uw4+TgKOfQCQ88P1H4GAqVnUCTRLlcPtKtkUSkbmogVHCZmlEG7vP5vRFxjMoHsK2I7X2k5bxLP9xvElzypCeZQ8mDydhyTxyaRl3h832Ov2fou8HEhHy3/GhnHiFgY3/c8FphzBtvED/Y/a97de46PljNGxjHAsW2O6FceGYzI0sDM3dNvEnmJp3UUSs4/3SWUts8x0+FSk8cSS3Tw89A3XLk8tCw4ryqhUsc4hqufB1ByvpIpdVifQYnB7p/6lSuXOdKQEeTq50c7AGVZlURkJNBr1C7yUXEwiUw3LmK9cfdS7JfHJukqFljk2rQSKu2eiI3FZUNGGcxGma/XpymQC9EXYR4Q4PsQ594S/CBxTkg4guoMEt6KPIicWSVnftTPCRRL1T8RMPrY4g10U0WdIBAOR86Iv/VZcKPXEispDiy8zEfWvGgewEMxjpFSoDfm7uSPhaOx28wi/sY54jXc3apZlAKFo1d3l3G1MsjBd0R/JkxwizlYXMf/a+S5EgUKJ65WRjl4buD7A0xkVl5BkOpPEPwkuMUcYq4kSxUYBjXvjt5jIrPyqj6S6u/VR+6H/GntGwAAAP//+fn1wAAAAAZJREFUAwDWVahvZPkrWAAAAABJRU5ErkJggg==",
  "calendar-days-osc": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAE30lEQVR4AdRYS29bVRD+xokJ9ga1IjyChGhsQDxKJaQiQV8RICFYgQgLwqoPG/EHgAWCSl2VLSyonTQV4rGh6h+A0gTaBWWBAEU8fJMg1BBqKiQWvmma62Hm+j7OuYkvTmQX9+jOnTkzZ2Y+H597Xhn0edkSwKHR0n2b/V1b8dEcmwN492vb8oXy0kCGfhZe1QCdUL5YmlKfXLF0CaPlWzrxCdu0BZgrlF/PFcsfS9Avhc4p5bPeDAh3+s6EI6rrhAA6BCkEGskTzxo+GvsjzSXmDZ/1AIsHh3OF0jdEOE7ABIHGCHRAScDtNKOorhMyfUD0iOGjsV/RXALyAooHh622UkkCpBwPniGi3WK7rg8RHs8h+1kyqQVQuv4lItpjNmLm8wyeURL9nFD0qK4TihxawlzkI7FbqtabgP0ytp9v1VpvC6CoHhVqPYy/cQ0jrlPd69aqY0oMHIVRVNcJGS5gr/lO5COxcXXtLrH/IxQ+MQbR2ACZ7hGd/zDx2cZvlT/8SvCS4MuBCDBiOVK2EZj/jCwZtmI2fj+5xIzPQzuD7w1l5TZAglGnJhJlZWHyK/nLP4UkbFLzrYQ5pUpvyy+qq6/rTJ1f15DgRTqigUgWwQAkNTDpO43kL59oONU7VmqTU2ntTFvDqVQatept6mvqY7l93gTA2KVfpBsMIFM0Fgg8JtOOv4L0msu4OhD9Ywxr7Ns9SGwMUBqmYAXpNQcoXkHI/FBhV9CHxe5Bq3u5zsEK0msOcD3qG5mLIlkEGyDFPcqgc9GMX2utJL2qMzCDsMhaG4rKbYCq6TO60QCS9HZ6F8pe8RPZIV+WXUfZbJnd8equfLH8neh/uGm0bO0bby6Wj+QLpWX1NX1iuX1euwfNAWrKQaRc4fAeGSIvozUtHINRBjOsu+ZdIDw8QHzYMCHDOAai29VXY5g2XzZzmbIYbYAUfyQSkJAoruc54u/3srx+SZh/NeqOIUNWWr+t+rrImu1azah9XhsgG7O4REOyLJ5adleuDqNJu12nss80S/39NdBDSq5Tfc+yra0+gyY/5vs6H1w2bb6cktcGSO1/CcJy6cMrjfkT34ZVk6/WTswpmTpfXjy10pivXoT4+vXki9rntQFiq6V3fjbAlK42IQztOHS/WY/kkfKtUIoUsTCUdthPyWsDjONtLIUH94HBn/KF0rTZKDdaejGfR11JppMXTJtMS/7BXaagJUgM0/Zf8qYA5rJrDyA8uIOes4JnaK9Rj7dPqmR6Vpn65rKrD/pyhy8boExUkZ8pB0r5Oi/Ix906k4CtM4nnNafB+FHJa/LJwCVkRyEbAvXd+ExC8ZRGFMvibQOEzFiiTHsE5ERDzyRO1bqbWV2Y/L7hVHYqqWzGEF2XziTGjlp+cQK8mbLrctxrjNQd9WKYmpieCOVec8n1ZJiDmOdDWbndSx7HE7B8DPL1XZEv0ryN6u4ZpVCa1Rzy8WxTMEoyyC4qD8kC6C5MnpY1djY0ArSdiPYRyL/d6jonkuWStiMocsPwtYzxM0HVZxZA0bCLa+MMPi3ydX00p+vCmj8VQBIgUJuuy9Z+vOk198u08K7QWXH2b7e6zhlfSMzjzJ5eUI1jqfKXgjJpPcDAqvcw0t1vCD0lgP3bra5zp/K0xHxzw7kxwNEWYGD/31nfA/wXAAD//+kpI+gAAAAGSURBVAMAUbZrfjW0b1wAAAAASUVORK5CYII=",
  "refresh-cw-osc": "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",
  "user-check-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAD3ElEQVR4AeyYXWiOYRjHN8n3inwlWSjOaBPlo2xEjiSUDCtpcjAjNdTEAROyMZ8HRmo0X5MlpJXa5EAO5nMcaQcUR5TIDtT8rsdzP7ve+32fj/d9nmbKun7vfd3Xfd3X83+fr/u9NyhvgP/9Fxj3AmV1Bnt7eydCORyG29ACtbAJJsQVk2l+ZIEIWE6Bd9AENbAG1sI+uAJdbg5uchZJIAc+ziHbYAz42TgG2sg9SpuYhQrkgNs4WjVo+07npYv4uJ7tZc5WrxfTCRTIgaZTvwGM/cKpzs/PL4AilwJiu0HGaBw7ydxCx4v5ESiQ2pUwDIytRFS96ZiWWB3+ajA2Ekfm0sSzMIElqvwJhDxU/RSXsXsEToGxxcaJ0/oK5BLJWShWxW8q389tUQNzqTFU9XNyfQVSbT7o8Vf0w+y1ShiMvwBimRZgF/piBSZZ/Uzd8Vbwq9XPuusrkHvquVWtyOpn6s5RwR5qyKtIhYJdbol5cBXKTaavQDfhhdtKU8fEEeJkgrFRxI+BMX25Tcy3Zf4KBp/ARmiiP4s2L0ygXhWmMeEBE6fSppgbu09Qjx2hH8mYL8toK8lDwJijzfkwEbvlEt0gdhmMyWunm4LNsBkqoJnBbtCvlUbm3iHmGXmSO9kLuA7xpbh3Qb9vG5jv3B6BApkkVsVHB2groyPCG2nFp/GsHW8neIaIi3QktxN/Nr5j+CJO3p+2uF1OAh+hAvkmP6CUXFkZ7HWXsGcyVknuEvjpRf84cl+JJz/JOhBWDHLGRdxwGXCpZ64nTmKhAiVJYOJ52pmwA67DR/gA12A7zHBzcNPsgIqMxn8MsippcYeYb/8oCX1IqNNnFPgEZ6AMpkAhbIBz8LkvM9VjTH6u7VdReeK1uBpy9JfwUiOfQW9Gjg4Capm6B2yTX0e+T3y/CRRViJQzqR+gKmJpv44k1+ArkJvY7D8O4rdCe0QC9ykIOs3Bl0EJ/lnaQMsoECHy4jT7D7l3VlFF3oFRCN2nIOwRyINC2WBLE4g4uQxh+w+rqm839j4lRSDigvYf8rKOgqwA8k7UqnPep3gCERe2/yjlskRB9iqJ7VM8gXxdWSn0kpNx/0FeJOPLJLJP0QLlATAHD9x/mKSwFpGylMXapzgCuby57D/C9JnxWPsURyCVFoLxcfPkRpc2CfReRvYpi7IpakSl/EuDS9OTTZGgXGp9s8bHWv3ArhEYmPQ3B/8ZgW/VWepSflKuLJumVqdxorTOGeQ+eUOyrCKyB9mCn7RJzVsUreBY72kjmyNQspl4AdbDM+knCTWfwjq4lG1dT2C2E/srf8AL/A0AAP//1YQItwAAAAZJREFUAwB7ZGpglyLNegAAAABJRU5ErkJggg==",
  "circle-check-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAFiElEQVR4AcyYe6hUVRTGZ3pnEWF5tScRZFkUvSTL8N5eSFRC/ZHRCyXJykeva0h0+6dCSi2tG4nW7WEPi7IoLcogrSiRQqHUjCBCel0rIoiKrOn3nTlrs2bPzJlzxrnQsL5Za+219trf2eecffY5u5X+57+OEKxUKiPAaDAuhewRnTj2tghCYgyYA9aBvyEyCLaBj1PIHlQMrAW94DhihaUQQQY5AXzIKFvAA2AC2AM0E8W6Cc4HW+n7LjgeO7fkIkhRncKnqfo5GA/alfPouJl6y8Bw7JbSkiCFTqfKRnAt8PIzzkvgOnAGOBrsm0K22m7EV84vaC/TcDZR+2R0pmQSpMDV9NYpPQxt8ivGLWBkuVyeDAbABvA1+DOFbLUtwZ+sXHAr+A2YHIGxnjEuRzeVpgTpOIVey8HewORVjGMYdDH4BzuXkLsTLCJ5NFgFTFT7RcaKz47FSw0J0mEcGUuBl3kMchn4yTcWsen7I/mTwIPAy+OMeZZvMLuOIIm6ft4iYU9gchPF7zRnVzR1KuB2atwMTDTWasY+yhpM1xEkoLv1QLTJQgo+Zk6nNDUfptZDwERjLjHHdA1BjuBcAmcDkzUYc8BQiWbybVd8IhzGOr/uGrzfBX/HvoIjraCHRNLaV1H8D2CywAzpMIMwP5EGrXmoRBZRIF6/kkDRP2qPBc+Ca+K+jKH1VHe4hSaQFx6LgSDRS4CXR7zTrs1gE+mrtVQz9Qy+JoKmGtH16BsCF0/wIpehRVZLgmsqbkLmHHq9DvYCJv+aYZpZ/AH7E2ASuHiCfh16xTLb1ZA7n75vAk9OC/xm2hrJy64x3CgJQYod5IIyN+ivXVBPM/cG/fcBJv3MlB6R5sfaz+AwahyghIQgxqHAy3bveJuOU8ByEI4yimupWk2bJ6e1dBZtWfJtFDxEvhE8XI7Dd84OJqROwXkSJJsIfM0UblXwtRUTOe1qqo2l0gJmrtecDK3r0Ie1mahbBy2hbEaG1rWlx1NCEnLavL5Dvp+5+yCXd6HXzpzuQXaXZTMY37FdCsZgMO0LF7t2zdQqyM2lTTfEMLRJH/l3mZNDj4xyvpdvBPVOId8wyoxYM6gudL+witQ88vYDJr3k3WtOTh3fBwknIxjP4KlZRRlcm897muTMJL6wSSyr2Y+pHU9yTSYEKajzv8n1vtjZDU363E1ApxYVZBbtjwavmOHHDEtOQjCto91yapYu5Lryp8zaazRktLmYXiqVdAam4ffXJOR0GGt/Ui8AJivNaEZQcb3wSGcCUkvBKPBEZmJ2cGYUDk+VQJABPiNJD3VUIn0cmTaRiTNUf4xxMLX7gMkauHxlTiCYNugOTc2SHjUrKJBnTbQ+hXRaW7OllcD66gY0u3ahhvmnRFYAE22VajaQFuiQ1nKlLw9W7nk41Gwm4hlUol5m/HPxNo50hgKdRFpztqup578/g0mojiBHoAVSG8a/kozqXz8FtRhXvV34p04Z6FuNv+M11iTG3hGXriOoBBL1SLtBtsNcCq8E8cbCpWSb9D2SjNdAvHmYyph+HSalKg0JKkSHp9D67oIKcinWdgYaAC2/q5CbCLmnAb3OfkODXtxRQUTuheBFRlOCyoPkAFq7FL3YYAaZirWRQfUNUGRnYHeD4aAL9IDZ4DmgRVxPhvjzhr5QjGcMTQTlGksmQXWhwAdofdNbho7fJ/QVVWR1Pa0lrgMRofewteu5Eh3vjPRNR59VxlD7I+KZ0pKgelNoEFyPrTeydeh2RX1PotZ0oBlsWScXQatC0S2gB18zegf6fbATNBPFREqbVs1YD/31dbZZfl17IYLWm0G2gvmgG+jDj06jXrbPJEc4Ft2lGBApbfu/oK2wtEUwHgUSO8A2sD7Fl+i6NS3ul8f/DwAA///DtP0eAAAABklEQVQDALiDz2CMBwIbAAAAAElFTkSuQmCC",
  "calendar-clock-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAFcklEQVR4AcyYWahWVRTHz1dE9WRWV8vmB0Mo42I3K1JTguqlQbAezCxKBHuIBrSBaCCoboMRvthclPhg00MEVlxvWWbaKDRcKJoHMy0rGiC9/v77+/bn/+xzzvV896L4sf57rb32Wnuvb589rHP2yfby37ACHBwcPL7T/zUcH43RUYAMMhr8iOMA/FF4LcL2cQzl8wPyKOTaVBkgHS0Cy8Aq0C/Q6xvgcCCaJ10dYHwFEI2jeNN81Pez1BehL6VCgBh3gXVY94LZYDo4s4WJcKeo3xV3n5OoRHv1fQn1XsZcA7qQc5QLEIMGrS+CU8CeptMZ8DmQo1yAtFwEzgBOb1PRoxU+RXaSrg7cR31EH/XtbdOYpAtdkQY4yRp/Qx7XaDSmgOkC9dtBm6Srg7ZDU7jNfKagOgL8ASJ5DFka4LHRCt5HRz/BnX62isumLhU3mjbXJ2PoVHjd2sebXAjQA97uhpLpbDV8OdCAt8Dr0q0YbgLL6SN9rKizbSpa2LfFA/OApNAmEa8EA8wGhwGdbZV23oDtI2AM0KngTVGuHDcNMDrsNTwN0B/r4B6M0tel1mR76DRAD2oGWz7cIBW8D33lDdAeoZ7wGGYfg/Ugd4WmAfoC1akeT/wyPoPOdAOIIw6fWJsbQDeYDD7xntIA/RG7XccyszsTPAh0934DF22kWA+eBvOBJmHIvtMA3VjHQjzxy3gfxgv5x6vgbWLQbvAhihfANWAqOBqIxlD0gLngYaAM5zJ4JaUBer2fwcMNUsHPQn+/90xgl1N/D3SDOjQao6fwewnsj1wgD0iNfmB29LgZ4F46eBL4Ov6A+lJwPTgXXAlk9zLc6QIqymYOgucoDdA7T9tyjl4huGupLwSR/ke4EfQwywvAYrASPAFuAOfRdhrw40V3sGYyN26ugoPPmh85NJUTwU2mZTGIpGtwKkH0gso+aHsXhxOB1jIskE6LO4PUKtIAW+qO2H2Jta7CtYku448U3mMIcgt2erzfwyNdh23M2gvJQjSqxelIie00M17CoD4joQk73dvasYV3Euz/wuhSEOkABO1+WDayAOnhfOB0l1dM9neSwsFOkP3Y6jUDFqjdb/qIvd4IpkMXp1rzVwxUJ0fcz3xcVCoX6xOY9QNV8YBU73STHCOnLAulDvMg7KKo2jip/3HqJw1Quk7gC39NTcebmB0dMal5msiG22ekAWoXxoEOiUIJ/8J0Ou/eIcj5ppN4sArDf5JHGuAv6qQFDdwSC0y79NtE+0BSPzmph/WcBugbw+XEt139qC1lWeX9y+ZZC7Reb86y7G8gWqnC4H/wT+w/U1saoC9gl2VbhldMOZ7HpkPXVHmRQe9GcxRYAHQvwzId4ocieFbzKvVAQwXo93IwLin0FULvz7FJmcmRsVLGCXILWAq2WvszyGNBJKViQU4D/Dpom4VeqptSRckgugXusWZlIyuYSeV9pq4WsVXKpkwnGmk5vBYraYDK5WLbWJw3A2XE/m6iL14nRCP4EqDPGbBAOkI+x88fWWjwgvaJQImtUrHY9C/CVaBNuQCZEX288QNTW18ZsbKMCL3b6l+HTvD5B0EzsBkeKSai6wjiDnA2GAV6wNVA2fYGjNONNYf+FDRNTcoF2FRl+oD0fEuuYjk/Ov0OQ117A3AnJRP6qqAd+zsNemt7CD4TpHQx/RTGzQ0kD4w2gVnIylKU/So70axGaEErQcVkJ+HzJTUFuQzeCWnGlNiuKHMqBBiNGHA1UPardw9/N5mL3tdcdMnQbwVzUEwASrH8qxWqHOkomYX9JPB+rsUqlQGaTcciAw6AeUDfo7WGlWI5umg7BxQeaTrYbgnQByGIt4DeEB2/us1Q8g4AAAD//40uigIAAAAGSURBVAMAkPEeb7Zo0DsAAAAASUVORK5CYII=",
  "calendar-days-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAD0ElEQVR4AdSYTW8NURjHWz6AEPW6sUG8NpFUgqoGibAiatHaIT5CWQgSq9qyItjQbogvQFVLF2ohJY2XEBtVrUZiZUP9/uOem/+Ze6emTae5bZ7/PK/neZ6eO3PmnFlUV+N/s2pwampqw0z/r9mMUY0ZNUiRpWCUge/gN+G5iNhbBGrMF+QlyLkps0ESdYJ74AnoE8j6FKwGojOy5QHBp4BoDZd+G6Pcd9E7sVeligYJbgAviO4CHaAV7CthG9wp2P/Hfcx2lBCv3CfRu6g5CBqQI4oaJKAe70PQBOabdlHwPogoahDPCbAHOD1H0U8rjCA7yZYHPkY5whjldl8Lk3TUDekGd5jzB/Ka+vr6ZtAqoF8GZZItD8oD/gmXbEwzprXgJwjkPdSlG1wXouC9JPoKdxozxWUzVxW/mTXKSQ2tCo/Mv97kiga94T8eKJlkA/AeoIIX4HnpIoEToIcc6Z8Vc91vXUpYXOIJ84Zk0EMingkKdIBVQGtbZpw7iL0BVgCtCu4KcmbddINhQM3wBdeg3wutPPLJG6Rozs+lhRuWUHTvp2fQb1Ct6ho4H1CtpDsuUU+RgrPmKN2gT6+WhbDiF81VK0zOVBDE0w263seykLxBiuY0ogmAJRQtOd5Q4q21y4JrMPr9q80mS043GAdn3Y/eCF6B1yDaN6JrczsG7/YxJmfWTc+gB7qc5KKAtmLtKFoWrsCdtGtuxLAVnAZOil2Job2UAzEir+XytJuF6GYtpfsIDwneIzt9MEVxptaFWI31uBDjExXVdYeCfZlRMtnK4GnWFkuz14S8t+xAQL8O2yIgX4M7HULZCRrwjcPTlFk33aDr0X8SMlJgErwMunPsI4LbJGP7BYbApPQqyKzrjirj8pqKi0s3mDnV3gI3+kbXg4x9uRB059inO+xn1k036DkrZIqEg/tb5DsegH4cXa+sCeRjyGVC1+ZWB/dR5KVlRw5hRg2SbxMIB/cjyE46AAVdO6Agix/WBWjsZnhuSjfoD4bLSUJu8kGErDOJZvQNfuE23EmnQc1u1pnEa7lcsQ5GTq8QZJoMZ5Lo2wz2YbCthOEQL45tzs4kvqNOz65qFQWfGH9gKmbws3Ww2+Sixf1W4JPJFQ36AryaJ24S+NeouT6jKLcWb3+yh6Zr8AHOfhBoGYJeaXoqi4ByqwZlEnrG/aqPV4miS3Sf4dT7tw2HGoXNK6lmtH6qetSgDDQ5AdRkC/pV0Au0JS8Cj8mt75D6QNVG3e/oEVU0GLwED4Bz4AAo6mxykNznQbXvNUkrmQ0m3hq41HyDfwEAAP//BWQrMQAAAAZJREFUAwAaC1Bv4iUS6QAAAABJRU5ErkJggg==",
  "timer-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAErklEQVR4AdyYWahVVRjH1+0pKjWtNEoab9EtisAGi6tdzSaISiiMaHqoHpRA8KGsqMBZUHAGB5xexHnCCcUnZ8UBR8QJJ5xwFsXh+vsf9tp857jWOfuccwXx8P/v7/vW+ta3/vucvdfa+zzg7vFP1QIbGxvrYEOEddWef1UCETUBATvhygh3kjOOvopRlUBm/QyWwqelEor1Vyvwf4qfhTGcoUM5mMpQlcCampqxsBWM4XE6dBlUpo5RVQlk/F3H/S2QO7Q1/BkOhJPhooSTsAPgD/CJar7mir5BJu0GNzPxCTgR/gF/hLqrxZ/w/4RT4ElyN8Iv8ctGWQKZpBYuZ5Zp8E2YFe1InMtYfcPP4mdGZoEUf5+qG+CHMISTNG5KeAobgr7dTdR6J9QZasskkIJfM3gVfBRaDCX4BDZjOWkD30rYmrbmUIv0MKzFYwTrqNkVWxIlBVKoE1VmQIvVBHWI6QWXwUvEeaDtIlwKe9LxOtwILWZT+wPbEPKLCqSArpdZZuB1/L9hBybejc0EcreT2B7+A29AjznM8ZwPQraoQAboZmiJFRo5fMtk/eEt/LLAmJuwH4O6QdXCONWeKifGqEDOTMuCztqP7c0Es32Q1VKnM2zw+UmNf32Mraf/c2wQUYFkD4YeOyg8yAdZLRP/Tu4KuBK/CzYHavXF2Qs9Bnqn0AYFUkw3xssmWdedCUu71OhO1nDo8Z13EvtXYmVeI79eTiGDAkmSQEwO5znjeTkv44HJepA6CnpcxhkCU1BzJsFF6BFcX2MC7S6x2FfIYhH3C3kjoYeWoAYE7fANxi4zvp0zbY4JfCbNcG6Ly/hJxNlHfInrhLjCNdBXtLXb+kZrYwJtsrYwOyboI047ihWnn/XjIuJURw8bsqKdU3GOMYHajnIJHK7BLPjeJEncR4hbY9pC7lXT2ML4qRsTeDjNcE77qgmjrpahC/Seg10yiCPNtdEhYfCXigm0ybZIUqvQOIeg7bAFbAnXumyfJ02a/bnT5pjArWmGc+8Zv6ldW9veMOk8MYFL0gznOnIDtDVxk7jUfJpCesbE5GDnzDXoEBOo9clv6DUk9oJNjd6m4E38pfAOBAVyDZ0n0z5l9OSMa2lrElBL26h2G19vKnNe8YG1QYFJgvZKPf8loZtP4Yd8UKmlRjPGLoQeWmqie31UIGd0lAojoIf+qVrABBWLZOwjFJO4l7Aew5nrmA8KbVRgkqjnNv17lYSuM84aJnoKWxYYoxtNL10dzcBt+P/BKIoK5My0I2gLs29pb1BtFxP2gYUvUXTlg5xWUE/SOtFXTO9pfG2F+olxwygqUEMQeQTbAR6EHnpj0/vFcSafDr+C+iPzYWxz+CrsCqczQP9w6XrWtUeYwyGO9dQOLs70pSgpUJkU2oN9GxY+lTxI2zdwDtQ3pKcXrQB6tNLrgfroyoPendslNfM6QkEmgRpIQf0kWlh/Iz4Ay8V+BvwK21NL3ypuaWQWqFIUvg7HwReI9eI9BmsfLAjzsI9oNPyCMS/C8dC+dtJVHGUJtKWYaC7sDvVwq+VDot8lR3yedqGWQw+4gPaKULFAOxsCLsMDcH1Ce0PZ1LL92wAAAP//ilJ+hAAAAAZJREFUAwA7v4tgyo+NOwAAAABJRU5ErkJggg==",
  "hash-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACfElEQVR4AexXvy8EURC+E3+BROFXSKjoqYTKHyBCLtH5B/RatUqroyARtQ6ViBqFKFDoJAqF5nxzu+9ubnfmmffeHleQ+Xbee/vN7Gf2biY3UOvzv3+BqS8oqYLNZnMDOAd2fEJw38STciQJRMI9YAXYhYg5eM2svFJ8tEAIGkK2UcDZmFtwb+XxGL6OFogkEwC3N75hayuPhXSWVQp86aTtWhUFaryuILdJETjuksB/1uv1d3jJrDwptpYikFfGVxUrr6cCX8Xs2SEX6ONl7MI1pYL81fkqaOUVpGXbFIHWylh5maLCVRSI3rUAHAMXGpBnBnDWSOTRs+ZdMu5FgSAcAuvAkge41bZprDQubrVN49GzDtosttAEfjHOny41gVtQdQZcKrjDObcrbCSulXeKeHomXLeJAtF0r4FVYFkCUuwDzqhJL6XwELsG3LiE3IsCOUFZ82/ms8KhYyuPuCJiBfLe5mu+Vp4ojg5jBfLK+Jq0lUdaRMQKtFbGyhPF0WGswCkKzuGroJWXpyo7USCmgm+SUEsZZKm2wZcmjpVHsZVOkkUmjpazuEhTxMqj2F5PEkjskYmvGM+irq5Nkifc5yZNEDqz8ohb3SSBshPA2QMmgDZtTLw8vtJJwluH7xts5bl/VvTaKxbJ+SFvvr4pYuXlaWUXI9BaGStPVpafxgiczGPJ+Spo5VEeFUEC0ZCHkYk3afEzaOUh148WJBDZ+OcK25ooEDesPFD9FipwpJBOE2jlFdKVt6ECefN9RA/7KKdsnVh5LbLvEiQQgu6RbBOgKdOAF83KE4MLh0ECKRYPPwLo98ot7TWAY+Jp8e48WKAL/C3f9wK/AQAA//8pNfubAAAABklEQVQDAHFySmB1sNZ+AAAAAElFTkSuQmCC",
  "file-text-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADQ0lEQVR4AdyYu2sVQRTGb6xsRCyiRBCsREHFgGJhwIgWaiEIPkjqEBUbxVrwP1BQFIW0iVgJQkRQjEYEtfDZiFgIPpGAqI2iXn9ns7s5O3dm75nNJiS5nG/nnNlzvvl27s6+FjXm+K+twGazuQRsAr0VsHm6x18qEEFnGeA7eAruVsATOMRG2VQSGxQI4SiCToA6bA8kIvYCbZR5BSJOhAlpFJkh+Tjclwx5eYpXIHsPgcye43R3RPzIPwhCdhSR5pkMCexW7FfQ9kzFFrfDSdrrxDKTJpEhgYsV4VflV3I5wJsU7ga/QWYi8mIWhNqQwFC+td+dwQYib1G8D2iRx/i7S0VaBDYhjTVvTSpyv0MmIk87fXloEdgyG3l12AnWIFIuX/J3/1HlZ5jJrSrOXYtA72zkDH7nn+5m8MJdiH2/wHmQmeg4lQW6lR06rsv/5BD57kInnZwNTpyE0QKZDTlnbtOOpRB/MGGb2si188tUaPLW+rKiBCJoPSSy6nbSbk8h/mX2rSFOjPPsJ84B8BlMyywCgye8M/JfHSPyAegCQSP/MCg1i8B8kTDSK9iOgDvgXgrxB9j3ljjWcu5QoUVgYQYRIre+XbS9KcQfCg3Qpr/A7cu1CPTVzVrfghBYOE9YrcOgqg3HTn3UDKJqGwP0garWB4e+pRUO3kdqEahPZFmpbUl9A6V9Uvs69aXR3BK3wCJQSJNCVq1ceDsJ5CK9gzYGUtMJxzfqMsu5sw63tQgsHCUDTID7YCwSUjPhCChwO/uS0CIwSSzfzNxei8CWv4ETvQcUHqEMcY/nMFq43RyLwLwGEcvARzrGge8RqqxvnNoPYCm1ZosSCOs60AWq2koKvY9V9HstSiCL4iEsI6CqjcDxSBXXskgKJAzQD6pavxJncqNm0MRYc9K8FfhDTcRy5dftrlCE8plPhZNuaAblyXkyo9EY5NLgfePKEqq0cG6hTr9svSRusZDAaypzI/4LCGs1OB8DeQmjSexqsnU2XoEs0XPk3QCzZdcZ0/u1yytQVFEgH3oG8N+AmTLhlhcu93tNPl5QoGQgcgjI++5q4phHK0vuKuEGpS9cpQIRlRgk70Ds41W7/PcJeZvNfwAAAP//52BKrQAAAAZJREFUAwClBPBgktCqYAAAAABJRU5ErkJggg==",
  "clipboard-list-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADSUlEQVR4AeyYz2sTQRTHU48iSqH1J4Inf2BrRSkeVIx4UxTEU3tTS6HgRUQ86M2L4KVohYJUb60IoqhHwVhBsChIKlIVEUFFK4WCf0D8vGxn8tbMLLObbdpDyvvsvJm8930v0zC7yYrCMv/L3GClUumCYiBdWfchdYM0dBrmKTgNzwOZlhzoJz6VpWqQAqtRvwFrIK1JzggaK9MkpmoQ4V5YBVmtncS9EGyJDfJuj8NbmIcKqs/AWlvgn02InEnRAtEU7WPRsvvqbRCBS6Q8hj0g/x6GXE00RfsptS74lJ0NklAk4Ro0y65T84irmLNBAi+DsVmc83AYZFcZIkO0FEIUba8X8URLNOfwxdq4OHfR1+BuEozd5KM2DCUWHoK2Q0xCIMzaA9GCYVZugbFdxtGjr8EOFTRjfEQ/49+BrDaKxleV/F75m5RvXV+DNuB/hwJnWdsHo/AiENmpXnKHiE9lIQ3K5yMmSqEpGIJiIOeIexMTiSZ12tFy7RrSYC16CbxWg41uesgOyi0uVoezb1tsYWHCegf4HsEOLITpoU5bvyh+SIMSV4Xi7fCTyQzjXUZrzE8x+QO+R7CXxPwAucURFmapGkRyB2wAsaNyUbh2SL1cdTdy3Q7BlqpBjopXKE/Ab7gC2mRH9cGrXzP+BBqvzYQxl2MmJkKBflgPtylgjXkZuiHJFveJ2nbTRCfVv7iJfdlSrQbtVmR0QnYwdphyjo3DLAzWahYKzHvgHSTZuM4J8UMatDpU3s+kDzrhKmg7w6QHkqwPDXlUMzGxN28W9RjSoD5mvpBsRD/ha5OHWT13+ZL7Ub2gtdVyzQ1pUESrGRxwv3Bk9+Th8yC+NV4bYbIT5PuGC/lq0Emc/CpBWNWsdnXmuIQ0GHuXFJgD18NngfUPUPIwybr5kmRaiWmbRT2GNKjjm+63Gmx0y307+FcJr1V+3u46Jahr2mVfg/qxaZCzq9tm5OSgKb+U6cO+7JL2NXhfBcs3/jKCuRr6U6B/eb3HvM6cDXIcyM8ST+qiF2/hETXlHK2r4GxQokg4wTgAIXcIwjKZaA9Q66Qv29ugJJA4Blvxt4Dr7tDI2mbRhjG0vZbYoMlC5Bv47hBZ178b/aTxHwAAAP//+BsgoAAAAAZJREFUAwBTJM1gY3jtRQAAAABJRU5ErkJggg==",
  "user-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADG0lEQVR4AeyYS4iOURjHfZIUs5BbLFyyYEmUywKzsbNAyYSSMBFWI8WWqHFNIrNQ1OQysqHMbuxk4zo0ZWcxVuRWCn1+z9f7TM97es/7nnO+LzNken5znnN7nv+c9/1O3zPjx43xn/8Cm31ATZ9gvV6fBTvgBNyFPjgO22HmqApEwHoEvIHrcBQ2wWY4BjdgMFuDm2bJJ0jiblL2w1Tw2XQm+ll7ijbJkgSSsJNsXWDtK53nGeLjjtgR9uwZ6UU40QJJtJD450HtJ05XrVZrgyUZbYwdBpmjadg59s5reBG/ogUSez9MArUNiDqjHW0ZO42/EdQm48hemnBLEbjWhD+LkIemn3OZu8/ABVBbo05oGyWQRzSFwEtB7bY6JW2fmVtODHv6ZqrYjRJIiBVg97ygX2UvzYIJ+Csh2GyykE0fnEWznX5Rd4Yz+NHpl3ZjBcpp2E+mfdy+RMvMxA/8VxBsUQJ56UWcTdDNOyWfzsKEzMl1Yy/pZ8T4VbjYMxglMIthEy5g7AFC5tPmLBuTT7GdO5lbFNCJFsgJ3CLuNVCTa2cIQb2wE3ZDL5NDYK+VHvbeYyzKogVm0Q/SPgK1iTgdIMJ7aMWXMdyGDfD7EERbkkBO4huZ2mEffAGffWKik/Xt8B0/2pIEShYS1uEK/iKQ07lDOwzvQF6DA7SLWXOVNtmSBWpGBAzDRdgCc2AubIVL8F7XpbZNC0xNHLrv3xLI9eHWHwOMhZBcpwSfIEKK6g+5A0NIrlOCBCKuov4IfaMa66LqlEqBiCurP+SyDkFqlaQ6pVQg4qrqj3VcJSFIrSJfHKLrlFKBPBCpIew34ML6g3VBxh8TXadUCZQPgCYvrT90UVWLSPmGE1yneAXyeFPqjyp9Oh9cp3gFEmkV2Hl50RlqidlaRuqU1b6oVoC7JvcvDR5N0rcRN6j0ifVZWsM04+fcMoG5haPV+asFvjanNmj8VrnybzuN9VQdt/WeIO+JVG9yD0p9scvd2IK+xLxJnL3kektbaF6BspqNl2EbPJF+KyHmY+gAqWG8oUsFenf9wYkxL/A3AAAA//9GcRqOAAAABklEQVQDACfvKWAgzZXHAAAAAElFTkSuQmCC",
  "hard-hat-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADD0lEQVR4AeyXu2sUURTG72qhEiVRCShEBcXGCIqipY9GQQz46CxEixSCaLCzUKNVmiAqWNn4Dxg0gmWiqI1WQWMTVNBCiIoPBAtl/X2TPZeTyUwycRNmA7ucb87jnnvOt3fu3J1dFBr80yRY7w1qrmCpK1itVtvAbTAG0qLYLYJt9ZCs9xb30/wM2ATSothZgspB/Z/US/BQgbYHCuTkpsyaILdsFegCl6m6Bpj0YuyvQTZmIh3kXgKaszKJzOJSmCANWsANao+DB+Aq8DJaqVSGBYJvgJdrOJozTo1+0IJfSAoRpOAOqqnpOXTenD+MmXjbYtKLuVwAr6m5DT2j5DWLEyl0BOcpWAemEzW3cW9bzOsNOM+ofRg9rUxLkAJ7mT0AlgGTMYxjQPsNVUiUe5zMd8BEt3mQHnsskKVzCTKxgwmDwEsfe2wzGADDfiBlV7yvXHAPbCTeB7zcp9daH/B2LkGStLFXoE3O0+CiORl6EqmM8SRUq9GTOBMXHeTpB25ihGsmQb6R9shpxk2GKHzTnBxdzYlPCVNLp4H2tY1113qaH3UmQUa1x1CJ/OR6Eswkf11C3lPsUsIJnF/A5KgZXucR7HJJD/nGH53vzSc1R6s3VLOlnnNRDBUy9yo1P4QQHgET39NiIY/g1pgRwltnp82DBHaDdhp+QyeC/QmjHezC1hOMmSm+tu8Zk/MIro4ZIfijwYVDoPlv8AJ8CamPYuBlKpx237tAq7OjmUfQx3/E7Lk3/BdbklXeE8kaLz22cAhyDrWCHuBflbSCvcSG5wMUvwKi0EO9xCH+QCQryIC0Ds7rZE+ahL8F6Dd5PqDalI+i3uIQjywR0+h2LpmPOfECMucpO1m0TlU1gnoxkG94jFEGaBtlvSwjuFSOgfNrXxmw/jW9XNoIym5ILBiCX/3ysUFLEc8BO/mVsRV8RaDRZESEEoI8EHr76CbwHZQt4nAKTp9FJCEog8AdoNdv/R3UK1IZ6BQHcFechEhQjsDgCEj+gJegR8XBYwpBP9gIdpNgvXehuYL1ruA/AAAA//+AtWeZAAAABklEQVQDADyl3GCzE1i3AAAAAElFTkSuQmCC",
  "briefcase-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACgElEQVR4AeyYu0sdQRTGY9KkSQgECRESCKQICoEQCBECsckDQlKEFCnS5QEpEkiTQgLapLCxsFLxUSmKWCmIIqiNYCNioX+BImghKGJ3/Z25d8az4+6y4+q9t9jL9+3Mecw5H7Or7OzVK3X+yyWwVCo1wVbYlkCJ3c2zB+cSiBgRtkrjLbgMFxIosW3yV2ATOcEIFkij+3RZh09gVjwjcY219xiDECyQ6mPwNgxFIwtGYRCCBFZ2oFV1GGDe2JDwkxgchBYvqHHHGlnGIIEUbIEa7Wjb0w49r8T+aR/zxzAzQgXe1JURsKvtuDk5O57/lmenmmcEcgvewX44Cxc1qdQBHXQsbe4WlCedMbnSqw//23LK6TUikIQuQtPwO3wNX3psxtbw40m2XiM1/Dzp9YOkGTT8Z3RwAgn8wvsX1hrtaPlpRTiBOHqgxibGkscNbA0/nmTrNVLDz5NeOqfbGkYgip9aR2X8ysPdDNs0iXVCBx1Lm7sF5UlHTK7c9m/lsLleR5P5azcCcT2ADhQYckaVJvTU/y+l60O5WIF2FF8aG9KCGWNZa1yTelmFSW5NWAjMu+3FDhY7mHcH8q4vnsFiB7PtwOVlFc9g3r0tdvCidjByNORt9lFC4VKCP8QdW4Oe8lat62yLYW+xfGsR23KYBR9h5KsVwcjB3Y8n2azTaInJ+0TCMNQwmoxAXrf3iehX7ufYk9D/ahU5F8fE/Xxrk+og5xrrt+MEUfnAxGDQi6YDmRmBMoG/4TysNeYQ8AcaOIEoPoKv8H6Bcng/ZKwWpNcUzT6j4Q08Zm7gBBqLC8ER+B7egNWC9PpAs3EkRHBGYCRaB0YhMO9NqPsdPAEAAP//FuyxrwAAAAZJREFUAwBcMUpgVTSSBAAAAABJRU5ErkJggg==",
  "building-2-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEGUlEQVR4AeyYSYgVVxSGXydZJIuQgZiFgZBNAgZCIGQgiTEtbhRxwGGjO924E2fQhe6cB1QQFHe6axHUpWgrKCqIC1FUEBFBwQHFlSD6/P7Tda6nyqp6VdpoCz7OX+fcM9Vft+rduu991Bnhnw8E3/QGtZrBbre7HOwHx8FgS6hmHzXL25BuRJCmo8A5Gq8Hc0A/+L8lVDOXmvX0Og1GYfeUngRp1EeXg+APMFzyN40GQE/pSZAOs8G/IMopBidaQjWUJBnHxU9PowqjCcHfQu1D7NF9fX1jQX9LjKX2O/AYuMTe7svpJgR/CBXHIHUnjFuZ1N6m4Chw+dGNKt2E4Meh+HmwX9eMPWLv0n5NCMaG3dIu7Zyx32yeQ5erGBuKrZoQLNbkxjQdA/orMCaXPDSIBIc8Q8efUMvocxJ8im3yRgRptJcul8HxClwmZw+xKL3O+R/JW4FJr2RLqjlMqol5aKIbJXoQ33igpUwvAkyTBVzY57KaENRCrVwh2hqv4aClB1UqD/AqB5Uk9rjHN3sQaNGelzKGjF+kXiEI803gGjAhSVeHMsl9SWi8G3wNquQbAnoMrDg7xB7JJu9SFnc1WkYiCJvPgFb7JQSq1qdnxN6qJIKcdQf4B9TJJ3XBhrF4zni7i+UWs2Rm7iui84HLWQzdWj3AepAZmqRbohF1f4EBULX1UuxP5QbEZSbXL+TItJgRZPQriDKXZ2IAiNz9ELCrCuN92DNB1dZLseIz6OekrFPsJ5/DYp78rXulIXZdugGeNsixEzXIK01xgjadpRmdTt0t0dKgvWLV1usAPZWDSlLXLyVhGCcnWHeVnkNN/pYw02fADFC19ZpFLC7A6lHZT8EA4xSTQ2zkmO8NQbvfFfPW85npdrtTWGrOg0cZZE9+3X5ZnXHyGbT7nQWKKsaibXkQWoFxCGj7/gVakH2EmN5KuHISe0Q7l+QDJ+jjMl3ZBAL6KbmurCjzbSRnQma7quznCZm2PCdo05kFiqruFq8KyXexF2XQLgbTvvXFWazrpxqHcXKCxtYjBe05chfzfpczw06WlG0C413ApfiWquvnNdJ2rpgsZ1t8GQquBPtisG3bFMatTCcYp73YIMZs2osJ2TjGop2Fk2raz7Z2TvBGKsfgwR6HcvEcjW3aZZQgxqJdTC3txzn1hYu5xsmSeW7Oxwj2CQrOAu1mtFPBZaJfb2lrZZ6XhzXKF3CtBknkc+As66fXoX54ETZ5AqcLsoygDLAQRNE+Ts3iv1Cy5XPE/J8ZuF82wyTul1YPD8iWr/jH1GJPSARhvB3nSvCuZQVc0iqQCIoVgbVo/RezFH0YVG2jhtuvN5HWy+/hkPt3IUcQQh0SboLNYCqo2kYNt38a59oCbolDxCsEY3Ak2COe4AsAAAD//8ar0zMAAAAGSURBVAMAZ/bOYLkRMC4AAAAASUVORK5CYII=",
  "calendar-x-bl": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADnklEQVR4AdSYu2tUQRTGN1qkiUiEiIkWNtppIYiPPAyapLBSiE3EgKL/QowgahsrUbFQLAQljWIh2JjEmMTgqxZsRPBNDKKEiIWuv2/cCWdm9+5u7mbDJpxvzplzzsz5Mjt3dvauytT4XyqC2Wx262L/rzRjVGNRBCnSCD4x8A36BrosIfcmiRrzEXstdtmSSJCJBsAd8BiMC8z6BDQDyUn5ygHJJ4CkhWbCjNHct+kP4C8oeQRJbgIvyB4CfaAT7MthG9qK95fSdsx2Oj5fcx+lP0TNadCEHUhAkIQ6ovfBTrDcsoeCd0EgAUEiR0ArsPKUjj5a4TW2FfnKgR2jOfwYzW1jHSzSIeuICe4wwe/YLXV1dW2gU6B/ASyIfOVgYcB/47wZ04ZrI/gJvFgOmZjgZp+FHmOiz2grX0zH2sZd0PxqvMGc1NCpMGLiW4ydR9AS/msTZTPZJHoYqOBZdLlyjsQZMMwc8ceKO/NHTQ6rc9opS0gOPSTSiaBAH9gAdLYl5tkAudfBeqBTwYa8nVg3JugH1IxecQTtXujkkXffINXWfFw6uFFOgr0fr6DdoDrVNXA5oFqOHU3AKegQrDmJCdrl1bHgT/xqa9Xyi5P1hnRM0PbHORbcN0i1NUS0ACgnwZFjCblorTUrjqDdg8FeKLSyHD/94AO4BRp8jmygi+h79DHvL6IT61a6gpcpqttIP3oEMg1gjWygi+gmtHJQ6aRSgg9N2V3Yj3KQjenkgWtTNjFB2w+epoT5j+OfAl52Y1hyY/RPgVKSWNcGSk2SF+f4+Y2zB1iSdJ3IdzCX4xxpmooIqiAEfmUymZikyPUQ0z+gtNSoiCAPRD3QJXYeBrq+o5zInic2CuqdJ2UTE0x83BPmv4ZfZFBOntO+BF72Y1wFpSSxbkzQPhjWTipgb8jPSOoCImVJ2hzCBcXWsnbeb5KCo4s4z+Ri2nPd7Lk5AV83mAaSQTVpUWwFS84JmUtA0k4z5wdg/wCtQHLF+4voYNVsXkzQ3qjjmB231LYlaPdj3kf8zlTea+xqm9q3vsZbb0jHq/RKzhyaOSJmgX0btdS/UTT3LPUagRf7gOWt4D2yJoCXdRjtoFq/SzS3alDCyRSbVi+vXEdNsIIEdcXqJSCiqGUV1TwcVwwIKgjJGSCSHfQvAn3h60peDYwyv95D6gVVL3W/0Q8kj6CPkjwJToMDoFq/TbqYexAUel/jqCQSdNEaaGqe4D8AAAD//3uQ+QUAAAAGSURBVAMAnvIjbz4ZUe8AAAAASUVORK5CYII="
};

// _shared/dias-habiles.js
var SOLSTICIOS = {
  2024: [6, 20],
  2025: [6, 21],
  2026: [6, 21],
  2027: [6, 21]
};
var SOLSTICIO_DEFAULT = [6, 21];
var FERIADOS_ADHOC = [
  // ej: '2026-11-15', // 1ª vuelta presidencial (agregar cuando se confirme)
];
function pad(n) {
  return String(n).padStart(2, "0");
}
function clave(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function claveDeFecha(d) {
  return clave(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function domingoPascua(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const n = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * n + 114) / 31);
  const dia = (h + l - 7 * n + 114) % 31 + 1;
  return new Date(year, mes - 1, dia);
}
function sumarDias(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function trasladarALunesSiguienteSiEntreSemana(date) {
  const dow = date.getDay();
  if (dow >= 2 && dow <= 5) return sumarDias(date, 8 - dow);
  return date;
}
function trasladarALunesAnteriorSiMarOMier(date) {
  const dow = date.getDay();
  if (dow === 2) return sumarDias(date, -1);
  if (dow === 3) return sumarDias(date, -2);
  return date;
}
var cacheFeriados = /* @__PURE__ */ new Map();
function feriadosDelAnio(year) {
  if (cacheFeriados.has(year)) return cacheFeriados.get(year);
  const set = /* @__PURE__ */ new Set();
  const add = (m, d) => set.add(clave(year, m, d));
  add(1, 1);
  add(5, 1);
  add(5, 21);
  add(7, 16);
  add(8, 15);
  add(9, 18);
  add(9, 19);
  add(11, 1);
  add(12, 8);
  add(12, 25);
  const pascua = domingoPascua(year);
  set.add(claveDeFecha(sumarDias(pascua, -2)));
  set.add(claveDeFecha(sumarDias(pascua, -1)));
  set.add(claveDeFecha(trasladarALunesSiguienteSiEntreSemana(new Date(year, 5, 29))));
  set.add(claveDeFecha(trasladarALunesSiguienteSiEntreSemana(new Date(year, 9, 12))));
  set.add(claveDeFecha(trasladarALunesAnteriorSiMarOMier(new Date(year, 9, 31))));
  const [sm, sd] = SOLSTICIOS[year] || SOLSTICIO_DEFAULT;
  add(sm, sd);
  FERIADOS_ADHOC.filter((f) => f.startsWith(`${year}-`)).forEach((f) => set.add(f));
  cacheFeriados.set(year, set);
  return set;
}
function esFeriado(date) {
  const d = new Date(date);
  return feriadosDelAnio(d.getFullYear()).has(claveDeFecha(d));
}
function esDiaHabil(date) {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !esFeriado(d);
}
function diasHabilesEntre(desde, hasta) {
  const d0 = new Date(desde);
  const d1 = new Date(hasta);
  if (isNaN(d0) || isNaN(d1) || d1 <= d0) return 0;
  let cursor = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1);
  const fin = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  let n = 0;
  while (cursor <= fin) {
    if (esDiaHabil(cursor)) n++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return n;
}

// notificar/index.ts
var RECORDATORIO_ENFRIAMIENTO_HORAS = 4;
var ESPERA_DIAS_ATRASADA = 1;
var ESPERA_DIAS_CRITICA = 3;
var DIAS_HABILES_PROCESO_RRHH = 3;
var DIAS_HABILES_RECLUTAMIENTO = 6;
var cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { type, solicitud_id, contratacion_id, reclutamiento_id, aprobador_id } = await req.json();
    if (!type) return json({ error: "Falta type." }, 400);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autenticado." }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const appUrl = urlApp(req);
    if (type === "contratacion_iniciada") {
      if (!contratacion_id) return json({ error: "Falta contratacion_id." }, 400);
      const { data: contrat, error: cErr } = await admin.from("contrataciones").select("id, solicitud_id, nombre_candidato, canal, tipo_trabajador").eq("id", contratacion_id).single();
      if (cErr || !contrat) return json({ error: "Contrataci\xF3n no encontrada." }, 404);
      const { data: solIngreso } = await admin.from("solicitudes").select("id, codigo, folio, centro_origen_id, detalle").eq("id", contrat.solicitud_id).single();
      if (!solIngreso) return json({ error: "La solicitud de esta contrataci\xF3n ya no existe." }, 404);
      const { data: centro } = await admin.from("centros_costo").select("id, codigo, nombre, prevencionista_id").eq("id", solIngreso.centro_origen_id).single();
      if (!centro?.prevencionista_id) {
        return json({ ok: true, skipped: true, reason: "centro sin prevencionista asignado" });
      }
      const { data: prev } = await admin.from("perfiles").select("email, nombre, activo").eq("id", centro.prevencionista_id).single();
      if (!prev?.email || prev.activo === false) {
        return json({ ok: true, skipped: true, reason: "prevencionista sin correo o inactivo" });
      }
      const d = await datosSolicitud(admin, solIngreso.id);
      if (!d) return json({ error: "La solicitud de esta contrataci\xF3n ya no existe." }, 404);
      const token = await graphToken();
      await graphSend(
        token,
        prev.email,
        `Nueva contrataci\xF3n para homologar \u2014 ${contrat.nombre_candidato}`,
        correoContratacionIniciada(prev.nombre ?? "", contrat, d, centro, appUrl)
      );
      return json({ ok: true, enviados: 1 });
    }
    if (type === "rrhh_cerrado" || type === "homologacion_autorizada") {
      if (!solicitud_id && !contratacion_id) {
        return json({ error: "Falta solicitud_id o contratacion_id." }, 400);
      }
      const { sol: sol2, nombre } = await resolverSolicitudYNombre(admin, { solicitud_id, contratacion_id });
      if (!sol2) return json({ error: "Solicitud no encontrada." }, 404);
      const { data: s } = await admin.from("perfiles").select("nombre, email, activo").eq("id", sol2.solicitante_id).single();
      if (!s?.email || s.activo === false) {
        return json({ ok: true, skipped: true, reason: "solicitante sin correo o inactivo" });
      }
      const d = await datosSolicitud(admin, sol2.id);
      if (!d) return json({ error: "Solicitud no encontrada." }, 404);
      const token = await graphToken();
      if (type === "rrhh_cerrado") {
        await graphSend(
          token,
          s.email,
          `RRHH ya proces\xF3 tu solicitud ${sol2.codigo}`,
          correoRrhhCerrado(s.nombre ?? "", d, nombre, appUrl)
        );
      } else {
        await graphSend(
          token,
          s.email,
          `${nombre || "El trabajador"} ya puede ingresar a la obra \u2014 solicitud ${sol2.codigo}`,
          correoHomologacionAutorizada(s.nombre ?? "", d, nombre, appUrl)
        );
      }
      return json({ ok: true, enviados: 1 });
    }
    if (type === "homologacion_rechazada") {
      if (!solicitud_id && !contratacion_id) {
        return json({ error: "Falta solicitud_id o contratacion_id." }, 400);
      }
      const { sol: sol2, nombre } = await resolverSolicitudYNombre(admin, { solicitud_id, contratacion_id });
      if (!sol2) return json({ error: "Solicitud no encontrada." }, 404);
      let ultimoQ = admin.from("homologacion_rechazos").select("id, motivo, rechazado_por, created_at").order("created_at", { ascending: false }).limit(1);
      ultimoQ = contratacion_id ? ultimoQ.eq("contratacion_id", contratacion_id) : ultimoQ.eq("solicitud_id", solicitud_id);
      const { data: ultimoArr } = await ultimoQ;
      const ultimo = ultimoArr?.[0];
      if (!ultimo) return json({ error: "No se encontr\xF3 el rechazo." }, 404);
      let countQ = admin.from("homologacion_rechazos").select("id", { count: "exact", head: true });
      countQ = contratacion_id ? countQ.eq("contratacion_id", contratacion_id) : countQ.eq("solicitud_id", solicitud_id);
      const { count: totalRechazos } = await countQ;
      const { data: docsMarcados } = await admin.from("homologacion_rechazo_documentos").select("checklist_item_id").eq("rechazo_id", ultimo.id);
      let nombresDocs = [];
      if (docsMarcados?.length) {
        const { data: items } = await admin.from("documentos_checklist").select("id, nombre").in("id", docsMarcados.map((d2) => d2.checklist_item_id));
        nombresDocs = (items ?? []).map((i) => i.nombre);
      }
      const { data: rechazadoPor } = await admin.from("perfiles").select("nombre").eq("id", ultimo.rechazado_por).single();
      const { data: solicitante } = await admin.from("perfiles").select("nombre, email, activo").eq("id", sol2.solicitante_id).single();
      const d = await datosSolicitud(admin, sol2.id);
      if (!d) return json({ error: "Solicitud no encontrada." }, 404);
      const token = await graphToken();
      let enviados = 0;
      if (solicitante?.email && solicitante.activo !== false) {
        await graphSend(
          token,
          solicitante.email,
          `Se rechaz\xF3 la homologaci\xF3n de tu solicitud ${sol2.codigo}`,
          correoHomologacionRechazada(solicitante.nombre ?? "", d, nombre, ultimo, totalRechazos ?? 1, appUrl)
        );
        enviados++;
      }
      const { data: gerentesPrevencion } = await admin.from("perfiles").select("nombre, email").eq("es_gerente_prevencion", true).eq("activo", true);
      for (const g of gerentesPrevencion ?? []) {
        if (!g.email) continue;
        await graphSend(
          token,
          g.email,
          `Rechazo de homologaci\xF3n \u2014 solicitud ${sol2.codigo}`,
          correoHomologacionRechazadaGerente(g.nombre ?? "", d, nombre, ultimo, rechazadoPor?.nombre ?? "", nombresDocs, totalRechazos ?? 1, appUrl)
        );
        enviados++;
      }
      if (nombresDocs.length) {
        const { data: rrhh } = await admin.from("perfiles").select("nombre, email").eq("rol", "rrhh").eq("activo", true);
        for (const r of rrhh ?? []) {
          if (!r.email) continue;
          await graphSend(
            token,
            r.email,
            `Revisar documento(s) \u2014 homologaci\xF3n rechazada, solicitud ${sol2.codigo}`,
            correoHomologacionRechazadaRRHH(r.nombre ?? "", d, nombre, ultimo, nombresDocs, appUrl)
          );
          enviados++;
        }
      }
      return json({ ok: true, enviados });
    }
    if (type === "reclutamiento_opciones") {
      if (!reclutamiento_id) return json({ error: "Falta reclutamiento_id." }, 400);
      const { data: recl } = await admin.from("reclutamientos").select("id, solicitud_id").eq("id", reclutamiento_id).single();
      if (!recl) return json({ error: "Proceso de reclutamiento no encontrado." }, 404);
      const { data: sol2 } = await admin.from("solicitudes").select("id, codigo, folio, solicitante_id, tipo, detalle, centro_origen_id").eq("id", recl.solicitud_id).single();
      if (!sol2) return json({ error: "La solicitud de este proceso ya no existe." }, 404);
      const desc = await descripcionIngreso(admin, sol2);
      const { count: pendientes } = await admin.from("reclutamiento_candidatos").select("id", { count: "exact", head: true }).eq("reclutamiento_id", reclutamiento_id).eq("decision", "pendiente");
      const { data: s } = await admin.from("perfiles").select("nombre, email, activo").eq("id", sol2.solicitante_id).single();
      if (!s?.email || s.activo === false) {
        return json({ ok: true, skipped: true, reason: "solicitante sin correo o inactivo" });
      }
      const d = await datosSolicitud(admin, sol2.id);
      if (!d) return json({ error: "La solicitud de este proceso ya no existe." }, 404);
      const token = await graphToken();
      await graphSend(
        token,
        s.email,
        `Candidatos para tu solicitud de ingreso: ${desc}`,
        correoReclutamientoOpciones(s.nombre ?? "", d, pendientes ?? 0, appUrl, desc)
      );
      return json({ ok: true, enviados: 1 });
    }
    if (type === "reclutamiento_elegido" || type === "reclutamiento_todos_rechazados") {
      if (!reclutamiento_id) return json({ error: "Falta reclutamiento_id." }, 400);
      const { data: recl } = await admin.from("reclutamientos").select("id, solicitud_id, contratacion_id").eq("id", reclutamiento_id).single();
      if (!recl) return json({ error: "Proceso de reclutamiento no encontrado." }, 404);
      const { data: sol2 } = await admin.from("solicitudes").select("id, codigo, folio, tipo, detalle, centro_origen_id").eq("id", recl.solicitud_id).single();
      if (!sol2) return json({ error: "La solicitud de este proceso ya no existe." }, 404);
      const desc = await descripcionIngreso(admin, sol2);
      const d = await datosSolicitud(admin, sol2.id);
      if (!d) return json({ error: "La solicitud de este proceso ya no existe." }, 404);
      const { data: rrhh } = await admin.from("perfiles").select("nombre, email").eq("rol", "rrhh").eq("activo", true);
      const token = await graphToken();
      let enviados = 0;
      if (type === "reclutamiento_elegido") {
        let candidatoNombre = "";
        if (recl.contratacion_id) {
          const { data: c } = await admin.from("contrataciones").select("nombre_candidato").eq("id", recl.contratacion_id).single();
          candidatoNombre = c?.nombre_candidato ?? "";
        }
        for (const r of rrhh ?? []) {
          if (!r.email) continue;
          await graphSend(
            token,
            r.email,
            `Candidato elegido \u2014 ${desc}`,
            correoReclutamientoElegido(r.nombre ?? "", d, candidatoNombre, appUrl, desc)
          );
          enviados++;
        }
      } else {
        for (const r of rrhh ?? []) {
          if (!r.email) continue;
          await graphSend(
            token,
            r.email,
            `Se rechazaron todos los candidatos \u2014 ${desc}`,
            correoReclutamientoTodosRechazados(r.nombre ?? "", d, appUrl, desc)
          );
          enviados++;
        }
      }
      return json({ ok: true, enviados });
    }
    if (type === "recordatorio_aprobador") {
      return await recordatorioAprobador(admin, user.id, { aprobador_id, solicitud_id }, appUrl);
    }
    if (!solicitud_id) return json({ error: "Falta solicitud_id." }, 400);
    const { data: sol, error: solErr } = await admin.from("solicitudes").select("id, codigo, folio, tipo, estado, solicitante_id, trabajador_id, centro_origen_id, centro_destino_id, motivo, detalle, created_at").eq("id", solicitud_id).single();
    if (solErr || !sol) return json({ error: "Solicitud no encontrada." }, 404);
    let evento = type;
    if (type === "pendiente_aprobador" && sol.estado === "aprobada") {
      const { data: etapas } = await admin.from("aprobaciones").select("comentario").eq("solicitud_id", sol.id);
      if ((etapas ?? []).length && (etapas ?? []).every(esAprobacionAutomatica)) evento = "cambio_estado";
    }
    if (evento === "pendiente_aprobador") {
      if (sol.estado !== "pendiente") {
        return json({ ok: true, skipped: true, reason: `estado ${sol.estado}` });
      }
      const { data: aprs } = await admin.from("aprobaciones").select("aprobador_id, orden, decision").eq("solicitud_id", solicitud_id);
      const pendientes = (aprs ?? []).filter((a) => a.decision === "pendiente");
      if (!pendientes.length) return json({ ok: true, skipped: true, reason: "sin aprobadores pendientes" });
      const minOrden = Math.min(...pendientes.map((a) => a.orden));
      const ids = [...new Set(pendientes.filter((a) => a.orden === minOrden).map((a) => a.aprobador_id))];
      const { data: perfiles } = await admin.from("perfiles").select("email, nombre, activo").in("id", ids);
      const d = await datosSolicitud(admin, sol.id);
      if (!d) return json({ error: "Solicitud no encontrada." }, 404);
      const token = await graphToken();
      let enviados = 0;
      for (const p of perfiles ?? []) {
        if (!p.email || p.activo === false) continue;
        await graphSend(
          token,
          p.email,
          `Solicitud ${sol.codigo} pendiente de tu aprobaci\xF3n`,
          correoPendiente(p.nombre ?? "", d, appUrl)
        );
        enviados++;
      }
      return json({ ok: true, enviados });
    }
    if (evento === "cambio_estado") {
      if (sol.estado !== "aprobada" && sol.estado !== "rechazada") {
        return json({ ok: true, skipped: true, reason: `estado ${sol.estado} no notificable` });
      }
      const d = await datosSolicitud(admin, sol.id);
      if (!d) return json({ error: "Solicitud no encontrada." }, 404);
      const { cmap, aprs, pmap, trabNombre } = d;
      const token = await graphToken();
      if (sol.estado === "rechazada") {
        const s = pmap.get(sol.solicitante_id);
        if (s?.email) {
          await graphSend(
            token,
            s.email,
            `Tu solicitud ${sol.codigo} fue rechazada`,
            correoRechazada(s.nombre ?? "", d, appUrl)
          );
        }
        return json({ ok: true, enviados: s?.email ? 1 : 0 });
      }
      const pdfBytes = await construirComprobantePdf({ sol: d.sol, cmap, aprs, pmap, trabNombre });
      const pdfB64 = encodeBase64(pdfBytes);
      const { data: rrhh } = await admin.from("perfiles").select("id, nombre, email").eq("rol", "rrhh").eq("activo", true);
      const dest = /* @__PURE__ */ new Map();
      const add = (p, rol) => {
        if (!p?.email) return;
        const ya = dest.get(p.email);
        if (!ya || rol === "rrhh") dest.set(p.email, { nombre: p.nombre ?? "", rol });
      };
      add(pmap.get(sol.solicitante_id), "solicitante");
      aprs.forEach((a) => add(pmap.get(a.aprobador_id), "aprobador"));
      (rrhh ?? []).forEach((r) => add(r, "rrhh"));
      const nombrePdf = `${DOCUMENTO_CODIGOS[sol.tipo]?.codigo || "RRH"} - ${sol.folio || sol.codigo}.pdf`;
      const adjuntos = [{ name: nombrePdf, b64: pdfB64 }];
      let enviados = 0;
      for (const [email, p] of dest) {
        await graphSend(
          token,
          email,
          `Solicitud ${sol.codigo} aprobada \u2014 respaldo`,
          correoAprobada(p.nombre, d, appUrl, p.rol, nombrePdf),
          adjuntos
        );
        enviados++;
      }
      return json({ ok: true, enviados });
    }
    return json({ error: `type desconocido: ${type}` }, 400);
  } catch (e) {
    return json({ error: e.message ?? "Error interno." }, 500);
  }
});
async function graphToken() {
  const tenant = Deno.env.get("GRAPH_TENANT_ID");
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GRAPH_CLIENT_ID"),
      client_secret: Deno.env.get("GRAPH_CLIENT_SECRET"),
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials"
    })
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("Graph auth: " + (j.error_description ?? "sin token"));
  return j.access_token;
}
var LOGO_CID = "metalium-logo";
async function graphSend(token, to, subject, correo, adjuntos = []) {
  const sender = Deno.env.get("GRAPH_FROM_ADDRESS");
  const html = correo.html;
  const iconos = correo.iconos.filter((k) => ICONOS_CORREO_PNG_B64[k]).map((k) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: `ico-${k}.png`,
    contentType: "image/png",
    contentBytes: ICONOS_CORREO_PNG_B64[k],
    contentId: `ico-${k}`,
    isInline: true
  }));
  const attachments = [
    {
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: "metalium-logo.png",
      contentType: "image/png",
      contentBytes: LOGO_METALIUM_PNG_B64,
      contentId: LOGO_CID,
      isInline: true
    },
    ...iconos,
    ...adjuntos.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.name,
      contentType: "application/pdf",
      contentBytes: a.b64
    }))
  ];
  const message = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: [{ emailAddress: { address: to } }],
    attachments
  };
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message, saveToSentItems: false })
  });
  if (!res.ok) throw new Error("Graph sendMail: " + await res.text());
}
var SOL_FIELDS = "id, codigo, folio, tipo, estado, solicitante_id, trabajador_id, centro_origen_id, centro_destino_id, motivo, detalle, created_at";
async function resolverSolicitudYNombre(admin, { solicitud_id, contratacion_id }) {
  if (contratacion_id) {
    const { data: contrat } = await admin.from("contrataciones").select("id, solicitud_id, nombre_candidato").eq("id", contratacion_id).single();
    if (!contrat) return { sol: null, nombre: null };
    const { data: sol } = await admin.from("solicitudes").select(SOL_FIELDS).eq("id", contrat.solicitud_id).single();
    return { sol: sol ?? null, nombre: contrat.nombre_candidato ?? null };
  }
  if (solicitud_id) {
    const { data: sol } = await admin.from("solicitudes").select(SOL_FIELDS).eq("id", solicitud_id).single();
    let nombre = null;
    if (sol?.trabajador_id) {
      const { data: t } = await admin.from("trabajadores").select("nombre").eq("id", sol.trabajador_id).single();
      nombre = t?.nombre ?? null;
    }
    return { sol: sol ?? null, nombre };
  }
  return { sol: null, nombre: null };
}
var REF_DOC = { tipoLabels: TIPO_LABELS, documentoCodigos: DOCUMENTO_CODIGOS, detalleLineas };
var VERDE = "#1a7f37";
var ROJO = "#b91c1c";
var AMBAR = "#92400e";
var ROJO_BG = "#fbe9e9";
var ROJO_FG = ROJO;
var escHtml = escCorreo;
var Tipo = (t) => tipoTxt(t).replace(/^./, (c) => c.toUpperCase());
async function datosSolicitud(admin, solicitudId) {
  const { data: sol } = await admin.from("solicitudes").select(SOL_FIELDS).eq("id", solicitudId).single();
  if (!sol) return null;
  const centroIds = [sol.centro_origen_id, sol.centro_destino_id].filter(Boolean);
  const { data: centros } = centroIds.length ? await admin.from("centros_costo").select("id, codigo, nombre").in("id", centroIds) : { data: [] };
  const { data: aprs } = await admin.from("aprobaciones").select("aprobador_id, decision, decidido_at, asignado_at, orden, tiempo_respuesta, comentario").eq("solicitud_id", sol.id).order("orden");
  const ids = [...new Set([sol.solicitante_id, ...(aprs ?? []).map((a) => a.aprobador_id)].filter(Boolean))];
  const { data: pers } = await admin.from("perfiles").select("id, nombre, email").in("id", ids);
  let trabNombre = null;
  if (sol.trabajador_id) {
    const { data: t } = await admin.from("trabajadores").select("nombre").eq("id", sol.trabajador_id).single();
    trabNombre = t?.nombre ?? null;
  }
  return {
    sol,
    cmap: new Map((centros ?? []).map((c) => [c.id, c])),
    aprs: aprs ?? [],
    pmap: new Map((pers ?? []).map((p) => [p.id, p])),
    trabNombre
  };
}
function enlace(appUrl, texto, vista = "") {
  if (!appUrl) return null;
  return { url: vista ? `${appUrl}/?ir=${encodeURIComponent(vista)}` : `${appUrl}/`, texto };
}
function estadoResumen(sol, propio) {
  if (propio) return ["Estado", propio[0], propio[1]];
  const e = String(sol.estado ?? "");
  const txt = e ? e.charAt(0).toUpperCase() + e.slice(1) : "\u2014";
  const color2 = e === "aprobada" ? VERDE : e === "rechazada" ? ROJO : e === "pendiente" ? AMBAR : "";
  return ["Estado", txt, color2];
}
function correoSolicitud(d, o) {
  const doc = documentoComprobante(d, REF_DOC);
  const [, detalle, aprobaciones] = doc.secciones;
  const titulo = o.titulo ?? `Solicitud de ${Tipo(d.sol.tipo)}`;
  return correoSgc({
    encabezado: { ...doc.encabezado, titulo },
    pie: { codigo: doc.pie.codigo, nombre: titulo },
    saludo: o.saludo,
    mensaje: o.mensaje,
    resumen: [["N\xB0 de solicitud", d.sol.codigo], ["Folio", d.sol.folio], estadoResumen(d.sol, o.estado), ...o.resumenExtra ?? []],
    boton: o.boton,
    secciones: [
      ...o.antes ?? [],
      ...o.incluir.includes("detalle") ? [detalle] : [],
      ...o.incluir.includes("aprobaciones") ? [aprobaciones] : []
    ]
  });
}
var saludo = (nombre) => nombre ? `Hola ${nombre}:` : "Hola:";
var p0 = (html) => `<p style="margin:0">${html}</p>`;
var p1 = (html) => `<p style="margin:10px 0 0">${html}</p>`;
function correoPendiente(nombre, d, appUrl) {
  const quien = d.pmap.get(d.sol.solicitante_id)?.nombre;
  return correoSolicitud(d, {
    saludo: saludo(nombre),
    mensaje: p0(`Tienes una solicitud de <b>${escHtml(Tipo(d.sol.tipo))}</b> pendiente de tu aprobaci\xF3n${quien ? `, creada por <b>${escHtml(quien)}</b>` : ""}.`) + p1("Revisa el detalle y decide desde tu bandeja."),
    boton: enlace(appUrl, "Ir a mi bandeja", "bandeja"),
    incluir: ["detalle", "aprobaciones"]
  });
}
function correoRechazada(nombre, d, appUrl) {
  const rech = d.aprs.find((a) => a.decision === "rechazado");
  const quien = rech ? d.pmap.get(rech.aprobador_id)?.nombre : null;
  const comentario = String(rech?.comentario ?? "").trim();
  return correoSolicitud(d, {
    saludo: saludo(nombre),
    mensaje: p0(`Tu solicitud de <b>${escHtml(Tipo(d.sol.tipo))}</b> fue <b style="color:${ROJO}">rechazada</b>${quien ? ` por <b>${escHtml(quien)}</b>` : ""}.`) + (comentario ? p1(`<b>Comentario:</b> ${escHtml(comentario)}`) : ""),
    boton: enlace(appUrl, "Ver mis solicitudes", "mis-solicitudes"),
    incluir: ["detalle", "aprobaciones"]
  });
}
function correoAprobada(nombre, d, appUrl, rol, adjunto) {
  const tipo = escHtml(Tipo(d.sol.tipo));
  const aprobada = `<b style="color:${VERDE}">aprobada por todos los aprobadores</b>`;
  const automatica = d.aprs.length > 0 && d.aprs.every(esAprobacionAutomatica);
  const quien = escHtml(d.pmap.get(d.sol.solicitante_id)?.nombre ?? "");
  const texto = automatica ? rol === "rrhh" ? p0(`La solicitud de <b>${tipo}</b>${quien ? ` de <b>${quien}</b>` : ""} qued\xF3 <b style="color:${VERDE}">aprobada</b> al crearla: no requiere aprobaci\xF3n. Ya puedes continuar con el proceso (plazo: ${DIAS_HABILES_PROCESO_RRHH} d\xEDas h\xE1biles).`) : p0(`Tu solicitud de <b>${tipo}</b> qued\xF3 <b style="color:${VERDE}">aprobada</b>: no requiere aprobaci\xF3n. RRHH continuar\xE1 con el proceso.`) : rol === "rrhh" ? p0(`La solicitud de <b>${tipo}</b> fue ${aprobada}. Ya puedes continuar con el proceso (plazo: ${DIAS_HABILES_PROCESO_RRHH} d\xEDas h\xE1biles).`) : rol === "solicitante" ? p0(`Tu solicitud de <b>${tipo}</b> fue ${aprobada}. RRHH continuar\xE1 con el proceso.`) : p0(`La solicitud de <b>${tipo}</b> que aprobaste qued\xF3 ${aprobada}.`);
  const doc = documentoComprobante(d, REF_DOC);
  return correoSolicitud(d, {
    titulo: doc.encabezado.titulo,
    // "Comprobante de solicitud de ...", igual que el PDF adjunto
    saludo: saludo(nombre),
    mensaje: texto + p1(`Se adjunta el comprobante en PDF (<b>${escHtml(adjunto)}</b>).`),
    boton: rol === "rrhh" ? enlace(appUrl, "Ir a Solicitudes", "solicitudes") : rol === "solicitante" ? enlace(appUrl, "Ver mis solicitudes", "mis-solicitudes") : enlace(appUrl, "Ir a SSI-RRHH"),
    incluir: ["detalle", "aprobaciones"]
  });
}
function correoRrhhCerrado(nombre, d, nombreEspecifico, appUrl) {
  return correoSolicitud(d, {
    saludo: saludo(nombre),
    mensaje: p0(`RRHH ya termin\xF3 de procesar tu solicitud de <b>${escHtml(Tipo(d.sol.tipo))}</b>${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ""}.`),
    boton: enlace(appUrl, "Ver mis solicitudes", "mis-solicitudes"),
    incluir: ["detalle"],
    estado: ["Procesada por RRHH", VERDE]
  });
}
function correoHomologacionAutorizada(nombre, d, nombreEspecifico, appUrl) {
  return correoSolicitud(d, {
    titulo: "Homologaci\xF3n SST",
    saludo: saludo(nombre),
    mensaje: p0(`El proceso de homologaci\xF3n de tu solicitud termin\xF3: ${nombreEspecifico ? `<b>${escHtml(nombreEspecifico)}</b>` : "el trabajador"} ya est\xE1 <b style="color:${VERDE}">autorizado para ingresar a la obra</b>.`),
    boton: enlace(appUrl, "Ver mis solicitudes", "mis-solicitudes"),
    antes: [{ titulo: "Homologaci\xF3n SST", fichas: [
      { etiqueta: d.sol.tipo === "ingreso" ? "Candidato" : "Trabajador", valor: nombreEspecifico || d.trabNombre || "\u2014", icono: "hard-hat" },
      { etiqueta: "Resultado", valor: "Autorizado para ingresar a la obra", icono: "shield-check" }
    ] }],
    incluir: ["detalle"],
    estado: ["Homologaci\xF3n autorizada", VERDE]
  });
}
function seccionRechazoHomologacion(d, nombreEspecifico, rechazo, extra) {
  return { titulo: "Rechazo de homologaci\xF3n", fichas: [
    { etiqueta: d.sol.tipo === "ingreso" ? "Candidato" : "Trabajador", valor: nombreEspecifico || d.trabNombre || "\u2014", icono: "hard-hat" },
    ...extra,
    { etiqueta: "Motivo", valor: String(rechazo?.motivo ?? "\u2014"), icono: "message-square", ancho: "completo" }
  ] };
}
function correoHomologacionRechazada(nombre, d, nombreEspecifico, rechazo, totalRechazos, appUrl) {
  return correoSolicitud(d, {
    titulo: "Homologaci\xF3n SST",
    saludo: saludo(nombre),
    mensaje: p0(`Prevenci\xF3n <b style="color:${ROJO}">rechaz\xF3 la homologaci\xF3n</b> de tu solicitud${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ""}.`) + p1("El plazo de homologaci\xF3n de este caso se extiende autom\xE1ticamente por cada rechazo."),
    boton: enlace(appUrl, "Ver mis solicitudes", "mis-solicitudes"),
    estado: ["Homologaci\xF3n rechazada", ROJO],
    antes: [seccionRechazoHomologacion(d, nombreEspecifico, rechazo, [
      { etiqueta: "N\xB0 de rechazos de este caso", valor: String(totalRechazos), icono: "hash" }
    ])],
    incluir: ["detalle"]
  });
}
function correoHomologacionRechazadaGerente(nombre, d, nombreEspecifico, rechazo, rechazadoPorNombre, nombresDocs, totalRechazos, appUrl) {
  return correoSolicitud(d, {
    titulo: "Homologaci\xF3n SST",
    saludo: saludo(nombre),
    mensaje: p0(`${rechazadoPorNombre ? `<b>${escHtml(rechazadoPorNombre)}</b>` : "Un prevencionista"} <b style="color:${ROJO}">rechaz\xF3 una homologaci\xF3n</b>${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ""}.`),
    boton: enlace(appUrl, "Ir a Homologaci\xF3n SST", "homologacion"),
    estado: ["Homologaci\xF3n rechazada", ROJO],
    antes: [seccionRechazoHomologacion(d, nombreEspecifico, rechazo, [
      { etiqueta: "Rechazado por", valor: rechazadoPorNombre || "\u2014", icono: "user" },
      { etiqueta: "N\xB0 de rechazos de este caso", valor: String(totalRechazos), icono: "hash" },
      { etiqueta: "Documento(s) marcado(s)", valor: nombresDocs.length ? nombresDocs.join(", ") : "Ninguno", icono: "list-checks", ancho: "completo" }
    ])],
    incluir: ["detalle"]
  });
}
function correoHomologacionRechazadaRRHH(nombre, d, nombreEspecifico, rechazo, nombresDocs, appUrl) {
  return correoSolicitud(d, {
    titulo: "Homologaci\xF3n SST",
    saludo: saludo(nombre),
    mensaje: p0(`Prevenci\xF3n <b style="color:${ROJO}">rechaz\xF3 la homologaci\xF3n</b>${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ""} por un problema con ${nombresDocs.length === 1 ? "este documento" : "estos documentos"}: <b>${nombresDocs.map((n) => escHtml(n)).join(", ")}</b>.`) + p1("Corrige o reemplaza el/los documento(s): Prevenci\xF3n vuelve a revisar el caso desde ah\xED."),
    boton: nombreEspecifico ? enlace(appUrl, "Ir a Contrataci\xF3n", "contrataciones") : enlace(appUrl, "Ir a Solicitudes", "solicitudes"),
    estado: ["Homologaci\xF3n rechazada", ROJO],
    antes: [seccionRechazoHomologacion(d, nombreEspecifico, rechazo, [
      { etiqueta: "Documento(s) a corregir", valor: nombresDocs.join(", "), icono: "list-checks", ancho: "completo" }
    ])],
    incluir: ["detalle"]
  });
}
function correoContratacionIniciada(nombre, contrat, d, centro, appUrl) {
  const CANAL_LABELS = { recomendacion: "Recomendaci\xF3n", reclutamiento_seleccion: "Reclutamiento y selecci\xF3n" };
  const TIPO_TRAB_LABELS = { administrativo: "Administrativo", operativo: "Operativo" };
  return correoSolicitud(d, {
    titulo: "Contrataci\xF3n para homologar",
    saludo: saludo(nombre),
    mensaje: p0("RRHH inici\xF3 una contrataci\xF3n en tu centro de costo. Puedes empezar la homologaci\xF3n SST a medida que se vaya subiendo la documentaci\xF3n."),
    boton: enlace(appUrl, "Ir a Homologaci\xF3n SST", "homologacion"),
    antes: [{ titulo: "Contrataci\xF3n", fichas: [
      { etiqueta: "Candidato", valor: contrat.nombre_candidato, icono: "hard-hat" },
      { etiqueta: "Cargo", valor: d.sol.detalle?.cargo || "\u2014", icono: "briefcase" },
      { etiqueta: "Canal", valor: CANAL_LABELS[contrat.canal] ?? contrat.canal ?? "\u2014", icono: "tag" },
      { etiqueta: "Tipo de trabajador", valor: TIPO_TRAB_LABELS[contrat.tipo_trabajador] ?? contrat.tipo_trabajador ?? "\u2014", icono: "id-card" },
      { etiqueta: "Centro de costo", valor: centro?.nombre ?? "\u2014", icono: "building-2", ancho: "completo" }
    ] }],
    incluir: []
  });
}
function seccionReclutamiento(desc, extra) {
  return { titulo: "Reclutamiento y selecci\xF3n", fichas: [
    ...extra,
    { etiqueta: "Vacante", valor: desc || "\u2014", icono: "clipboard-list", ancho: "completo" }
  ] };
}
function correoReclutamientoOpciones(nombre, d, cantidad, appUrl, desc = "") {
  return correoSolicitud(d, {
    titulo: "Reclutamiento y selecci\xF3n",
    saludo: saludo(nombre),
    mensaje: p0(`RRHH envi\xF3 <b>${cantidad} candidato${cantidad === 1 ? "" : "s"}</b> para tu solicitud de ingreso${desc ? ` <b>${escHtml(desc)}</b>` : ""}. Rev\xEDsalos y elige uno, o rech\xE1zalos si ninguno calza.`),
    boton: enlace(appUrl, "Ver candidatos", "mis-solicitudes"),
    antes: [seccionReclutamiento(desc, [{ etiqueta: "Candidatos por revisar", valor: String(cantidad), icono: "users" }])],
    incluir: []
  });
}
function correoReclutamientoElegido(nombre, d, candidatoNombre, appUrl, desc = "") {
  return correoSolicitud(d, {
    titulo: "Reclutamiento y selecci\xF3n",
    saludo: saludo(nombre),
    mensaje: p0(`El solicitante eligi\xF3 a ${candidatoNombre ? `<b>${escHtml(candidatoNombre)}</b>` : "un candidato"} para la solicitud ${desc ? `<b>${escHtml(desc)}</b>` : escHtml(d.sol.codigo)}. Ya se cre\xF3 la contrataci\xF3n: contin\xFAa el proceso desde ah\xED.`),
    boton: enlace(appUrl, "Ir a Contrataci\xF3n", "contrataciones"),
    antes: [seccionReclutamiento(desc, [{ etiqueta: "Candidato elegido", valor: candidatoNombre || "\u2014", icono: "user-check" }])],
    incluir: []
  });
}
function correoReclutamientoTodosRechazados(nombre, d, appUrl, desc = "") {
  return correoSolicitud(d, {
    titulo: "Reclutamiento y selecci\xF3n",
    saludo: saludo(nombre),
    mensaje: p0(`El solicitante <b style="color:${ROJO}">rechaz\xF3 a todos los candidatos</b> enviados para la solicitud ${desc ? `<b>${escHtml(desc)}</b>` : escHtml(d.sol.codigo)}.`) + p1(`Agrega una nueva tanda de candidatos desde Contrataci\xF3n: el plazo de reclutamiento (${DIAS_HABILES_RECLUTAMIENTO} d\xEDas h\xE1biles) vuelve a correr desde este rechazo.`),
    boton: enlace(appUrl, "Ir a Contrataci\xF3n", "contrataciones"),
    antes: [seccionReclutamiento(desc, [{ etiqueta: "Plazo de reclutamiento", valor: `${DIAS_HABILES_RECLUTAMIENTO} d\xEDas h\xE1biles desde este rechazo`, icono: "clock" }])],
    incluir: []
  });
}
var ORIGEN_PERMITIDO = /^(https:\/\/([a-z0-9-]+\.)*(vercel\.app|metalium\.cl)|http:\/\/localhost(:\d+)?)$/i;
function urlApp(req) {
  const env = (Deno.env.get("APP_URL") || "").trim().replace(/\/+$/, "");
  if (env) return env;
  const origin = (req.headers.get("Origin") || "").trim().replace(/\/+$/, "");
  return ORIGEN_PERMITIDO.test(origin) ? origin : "";
}
async function descripcionIngreso(admin, sol) {
  const d = sol?.detalle ?? {};
  const cant = Number(d.cantidad) || 1;
  let obra = "";
  if (sol?.centro_origen_id) {
    const { data: c } = await admin.from("centros_costo").select("codigo, nombre").eq("id", sol.centro_origen_id).maybeSingle();
    if (c) {
      const n = String(c.nombre ?? "");
      obra = `Obra ${c.codigo ?? ""}${n ? " " + (n.length > 60 ? n.slice(0, 59) + "\u2026" : n) : ""}`.trim();
    }
  }
  const f = typeof d.fecha_ingreso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha_ingreso) ? d.fecha_ingreso.split("-").reverse().join("-") : "";
  return [d.cargo || "Cargo sin indicar", `${cant} vacante${cant === 1 ? "" : "s"}`, obra, f ? `ingreso desde el ${f}` : ""].filter(Boolean).join(" \xB7 ");
}
function aChile(f) {
  return new Date(new Date(f).toLocaleString("en-US", { timeZone: "America/Santiago" }));
}
function nivelEspera(desde, ahora = /* @__PURE__ */ new Date()) {
  const horas = Math.max(0, (ahora.getTime() - new Date(desde).getTime()) / 36e5);
  const dias = diasHabilesEntre(aChile(desde), aChile(ahora));
  const nivel = dias >= ESPERA_DIAS_CRITICA ? "critica" : dias >= ESPERA_DIAS_ATRASADA ? "atrasada" : "al_dia";
  const h = Math.floor(horas);
  const texto = dias >= 1 ? `${dias} d\xEDa${dias === 1 ? "" : "s"} h\xE1bil${dias === 1 ? "" : "es"}` : horas < 1 ? "menos de 1 hora" : `${h} hora${h === 1 ? "" : "s"}`;
  return { dias, horas, nivel, texto };
}
var diaCL = (f) => new Date(f).toLocaleDateString("es-CL", { timeZone: "America/Santiago" });
var horaCL = (f) => new Date(f).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
var cuandoCL = (f) => diaCL(f) === diaCL(/* @__PURE__ */ new Date()) ? `hoy a las ${horaCL(f)}` : `el ${diaCL(f)} a las ${horaCL(f)}`;
var APR_FIELDS = "solicitud_id, aprobador_id, orden, decision, asignado_at, decidido_at";
function aprobacionesEnTurno(sol, aprs) {
  const pend = aprs.filter((a) => a.decision === "pendiente");
  if (!pend.length) return [];
  const min = Math.min(...pend.map((a) => a.orden));
  return pend.filter((a) => a.orden === min).map((a) => {
    const fechas = [
      sol.created_at,
      a.asignado_at,
      ...aprs.filter((x) => x.orden < a.orden && x.decidido_at).map((x) => x.decidido_at)
    ].filter(Boolean);
    const desde = fechas.reduce((m, f) => new Date(f) > new Date(m) ? f : m, fechas[0]);
    return { ...a, desde };
  });
}
async function recordatorioAprobador(admin, userId, { aprobador_id, solicitud_id }, appUrl) {
  if (!aprobador_id && !solicitud_id) return json({ error: "Falta aprobador_id o solicitud_id." }, 400);
  const { data: yo } = await admin.from("perfiles").select("id, nombre, rol, activo").eq("id", userId).single();
  if (!yo || yo.activo === false) return json({ error: "Tu cuenta no est\xE1 activa." }, 403);
  const esGestion = yo.rol === "admin" || yo.rol === "rrhh";
  let objetivos = [];
  let origen = "rrhh_admin";
  let solicitudUnica = null;
  if (aprobador_id) {
    if (!esGestion) return json({ error: "Solo RRHH o el administrador pueden enviar este recordatorio." }, 403);
    const { data: suyas } = await admin.from("aprobaciones").select("solicitud_id").eq("aprobador_id", aprobador_id).eq("decision", "pendiente");
    const ids = [...new Set((suyas ?? []).map((a) => a.solicitud_id))];
    const items = [];
    if (ids.length) {
      const { data: sols } = await admin.from("solicitudes").select(SOL_FIELDS).in("id", ids).eq("estado", "pendiente");
      const { data: aprs } = await admin.from("aprobaciones").select(APR_FIELDS).in("solicitud_id", ids);
      for (const s of sols ?? []) {
        const turno = aprobacionesEnTurno(s, (aprs ?? []).filter((a) => a.solicitud_id === s.id));
        const mio = turno.find((a) => a.aprobador_id === aprobador_id);
        if (mio) items.push({ sol: s, desde: mio.desde });
      }
    }
    if (!items.length) return json({ error: "Este aprobador no tiene solicitudes esperando su decisi\xF3n en este momento." }, 400);
    objetivos = [{ aprobadorId: aprobador_id, items }];
  } else {
    const { data: s } = await admin.from("solicitudes").select(SOL_FIELDS).eq("id", solicitud_id).single();
    if (!s) return json({ error: "Solicitud no encontrada." }, 404);
    if (s.solicitante_id !== userId && !esGestion) {
      return json({ error: "Solo quien cre\xF3 la solicitud (o RRHH / el administrador) puede enviar este recordatorio." }, 403);
    }
    if (s.estado !== "pendiente") return json({ error: "Esta solicitud ya no est\xE1 pendiente de aprobaci\xF3n." }, 400);
    const { data: aprs } = await admin.from("aprobaciones").select(APR_FIELDS).eq("solicitud_id", s.id);
    const turno = aprobacionesEnTurno(s, aprs ?? []);
    if (!turno.length) return json({ error: "Esta solicitud no tiene aprobadores pendientes." }, 400);
    origen = s.solicitante_id === userId ? "solicitante" : "rrhh_admin";
    solicitudUnica = s;
    objetivos = turno.map((t) => ({ aprobadorId: t.aprobador_id, items: [{ sol: s, desde: t.desde }] }));
  }
  const solicitantes = objetivos.flatMap((o) => o.items.map((i) => i.sol.solicitante_id));
  const { data: pers } = await admin.from("perfiles").select("id, nombre, email, activo, rol").in("id", [.../* @__PURE__ */ new Set([...objetivos.map((o) => o.aprobadorId), ...solicitantes])]);
  const pmap = new Map((pers ?? []).map((p) => [p.id, p]));
  const desdeEnfr = new Date(Date.now() - RECORDATORIO_ENFRIAMIENTO_HORAS * 3600 * 1e3).toISOString();
  for (const o of objetivos) {
    const { data: previos } = await admin.from("recordatorios_aprobacion").select("created_at, enviado_por, solicitud_id, solicitudes_incluidas").eq("aprobador_id", o.aprobadorId).gte("created_at", desdeEnfr).order("created_at", { ascending: false }).limit(50);
    const choca = (previos ?? []).find((r) => solicitudUnica ? r.solicitud_id === solicitudUnica.id || Array.isArray(r.solicitudes_incluidas) && r.solicitudes_incluidas.includes(solicitudUnica.id) : r.solicitud_id === null);
    if (choca) {
      const { data: quien } = await admin.from("perfiles").select("nombre").eq("id", choca.enviado_por).single();
      const proximo = new Date(new Date(choca.created_at).getTime() + RECORDATORIO_ENFRIAMIENTO_HORAS * 3600 * 1e3);
      const nombreApr = pmap.get(o.aprobadorId)?.nombre || "este aprobador";
      return json({
        error: `Ya se le envi\xF3 un recordatorio a ${nombreApr} ${cuandoCL(choca.created_at)}${quien?.nombre ? ` (lo pidi\xF3 ${quien.nombre})` : ""}. Podr\xE1s enviar otro ${cuandoCL(proximo)}.`,
        proximo_permitido: proximo.toISOString()
      }, 429);
    }
  }
  const todas = objetivos.flatMap((o) => o.items.map((i) => i.sol));
  const trabIds = [...new Set(todas.map((s) => s.trabajador_id).filter(Boolean))];
  const centroIds = [...new Set(todas.map((s) => s.centro_origen_id).filter(Boolean))];
  const { data: trabs } = trabIds.length ? await admin.from("trabajadores").select("id, nombre").in("id", trabIds) : { data: [] };
  const { data: centros } = centroIds.length ? await admin.from("centros_costo").select("id, nombre").in("id", centroIds) : { data: [] };
  const tmap = new Map((trabs ?? []).map((t) => [t.id, t.nombre]));
  const cmap = new Map((centros ?? []).map((c) => [c.id, c.nombre]));
  const detalleCorto = (s) => {
    const quien = s.tipo === "ingreso" ? `${s.detalle?.cargo || "Cargo"} \xD7 ${s.detalle?.cantidad || 1}` : tmap.get(s.trabajador_id) || "Trabajador";
    const centro = cmap.get(s.centro_origen_id);
    return centro ? `${quien} \xB7 ${centro}` : quien;
  };
  const ROL_TXT = { admin: "administrador", rrhh: "RRHH", solicitante: "solicitante", supervisor: "supervisor" };
  const pedidoPor = { nombre: yo.nombre ?? "", rol: ROL_TXT[yo.rol] ?? yo.rol };
  const token = await graphToken();
  const destinatarios = [];
  const sinCorreo = [];
  for (const o of objetivos) {
    const apr = pmap.get(o.aprobadorId);
    if (!apr?.email || apr.activo === false) {
      sinCorreo.push(apr?.nombre || "un aprobador");
      continue;
    }
    const filas = o.items.map((i) => ({
      sol: i.sol,
      desde: i.desde,
      espera: nivelEspera(i.desde),
      detalle: detalleCorto(i.sol),
      solicitante: pmap.get(i.sol.solicitante_id)?.nombre || "\u2014"
    })).sort((a, b) => new Date(a.desde).getTime() - new Date(b.desde).getTime());
    const { asunto, correo } = correoRecordatorio(apr.nombre ?? "", filas, pedidoPor, origen, appUrl);
    await graphSend(token, apr.email, asunto, correo);
    await admin.from("recordatorios_aprobacion").insert({
      aprobador_id: o.aprobadorId,
      solicitud_id: solicitudUnica?.id ?? null,
      enviado_por: userId,
      origen,
      solicitudes_incluidas: o.items.map((i) => i.sol.id)
    });
    destinatarios.push(apr.nombre ?? apr.email);
  }
  if (!destinatarios.length) {
    return json({ error: `${sinCorreo.join(", ")} no tiene correo registrado o su cuenta est\xE1 inactiva.` }, 400);
  }
  return json({ ok: true, enviados: destinatarios.length, destinatarios, sin_correo: sinCorreo });
}
var NIVEL_ESTILO = {
  al_dia: { etiqueta: "Al d\xEDa", bg: "#e0f2fe", fg: "#0369a1" },
  atrasada: { etiqueta: "Atrasada", bg: "#fef3c7", fg: "#92400e" },
  critica: { etiqueta: "Cr\xEDtica", bg: ROJO_BG, fg: ROJO_FG }
};
function correoRecordatorio(nombre, filas, pedidoPor, origen, appUrl) {
  const n = filas.length;
  const peor = filas[0];
  const nivel = peor.espera.nivel;
  const est = NIVEL_ESTILO[nivel];
  const plural = n === 1 ? "solicitud" : "solicitudes";
  const espera = escHtml(peor.espera.texto);
  const codigo = escHtml(peor.sol.codigo || peor.sol.folio || "");
  let asunto;
  let intro;
  if (origen === "solicitante") {
    asunto = nivel === "critica" ? `Urgente: la solicitud ${peor.sol.codigo} lleva ${peor.espera.texto} esperando tu aprobaci\xF3n` : `Recordatorio: la solicitud ${peor.sol.codigo} espera tu aprobaci\xF3n`;
    intro = `<b>${escHtml(pedidoPor.nombre)}</b> te pide revisar su solicitud <b>${codigo}</b>, que lleva <b>${espera}</b> esperando tu aprobaci\xF3n.`;
  } else if (nivel === "critica") {
    asunto = `Urgente: ${n} ${plural} esperan tu aprobaci\xF3n hace ${peor.espera.texto}`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobaci\xF3n y la m\xE1s antigua ya lleva <b>${espera}</b>.`;
  } else if (nivel === "atrasada") {
    asunto = `Recordatorio: ${n} ${plural} esperan tu aprobaci\xF3n (${peor.espera.texto})`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobaci\xF3n; la m\xE1s antigua lleva <b>${espera}</b>.`;
  } else {
    asunto = `Recordatorio: tienes ${n} ${plural} por aprobar`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobaci\xF3n en SSI-RRHH.`;
  }
  const cierre = nivel === "critica" ? `Es urgente: ${n === 1 ? "la solicitud no avanza" : "las solicitudes no avanzan"} hasta que decidas, y una vez aprobada${n === 1 ? "" : "s"} RRHH todav\xEDa necesita hasta ${DIAS_HABILES_PROCESO_RRHH} d\xEDas h\xE1biles para procesarla${n === 1 ? "" : "s"}.` : nivel === "atrasada" ? `Te pedimos revisar${n === 1 ? "la" : "las"} a la brevedad: hasta que decidas, ${n === 1 ? "la solicitud no avanza" : "no avanzan"}.` : `Mientras antes ${n === 1 ? "la revises" : "las revises"}, antes puede seguir el proceso.`;
  const tipos = [...new Set(filas.map((f) => f.sol.tipo))];
  const codigoDoc = tipos.length === 1 ? DOCUMENTO_CODIGOS[tipos[0]]?.codigo ?? MAESTRO_SOLICITUDES_CODIGO : MAESTRO_SOLICITUDES_CODIGO;
  const titulo = "Recordatorio de aprobaci\xF3n";
  const correo = correoSgc({
    encabezado: { titulo, codigo: codigoDoc, fecha: fechaDMY(/* @__PURE__ */ new Date()), revision: "00" },
    pie: { codigo: codigoDoc, nombre: titulo },
    saludo: saludo(nombre),
    mensaje: p0(intro) + p1(cierre),
    resumen: [
      ["Solicitudes por aprobar", String(n)],
      ["Espera m\xE1s larga", peor.espera.texto, est.fg],
      ["Nivel", est.etiqueta, est.fg]
    ],
    boton: enlace(appUrl, "Ir a mi bandeja", "bandeja"),
    secciones: [{ titulo: n === 1 ? "Solicitud por aprobar" : "Solicitudes por aprobar", tabla: {
      columnas: [
        { titulo: "N\xB0 de solicitud", icono: "hash", estilo: "fuerte" },
        { titulo: "Tipo", icono: "file-text", estilo: "normal", movil: false },
        { titulo: "Detalle", icono: "clipboard-list", estilo: "normal" },
        { titulo: "Solicitante", icono: "user", estilo: "normal" },
        { titulo: "Esperando", icono: "timer", estilo: "pildora" },
        { titulo: "Desde", icono: "calendar-clock", alinear: "centro", estilo: "normal", movil: false }
      ],
      filas: filas.map((f) => [
        f.sol.codigo || "\u2014",
        Tipo(f.sol.tipo),
        f.detalle,
        f.solicitante,
        { texto: f.espera.texto, fondo: NIVEL_ESTILO[f.espera.nivel].bg, color: NIVEL_ESTILO[f.espera.nivel].fg },
        fechaHora(f.desde)
      ])
    } }],
    nota: `Recordatorio enviado a pedido de ${escHtml(pedidoPor.nombre)} (${escHtml(pedidoPor.rol)}). Correo autom\xE1tico del sistema SSI-RRHH: no hace falta responderlo.`
  });
  return { asunto, correo };
}
