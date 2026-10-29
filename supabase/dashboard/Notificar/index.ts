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
  while (t.length > 1 && medir(t + "…", f, s) > anchoMax) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
function fondoPagina(alto = ALTO) {
  return [
    { t: "path", d: rectRed(0, 0, ANCHO, alto, 0), fill: PAL.fondo },
    // brillos diagonales tenues de la esquina superior derecha
    { t: "path", d: poligono([[1352, 0], [1390, 0], [1416, 36], [1416, 88]]), fill: PAL.blanco, op: 0.55 },
    { t: "path", d: poligono([[1398, 0], [1416, 0], [1416, 22]]), fill: PAL.blanco, op: 0.7 }
  ];
}
var SISTEMA_NOMBRE = "SISTEMA DE GESTIÓN DE CALIDAD";
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
  p.push({ t: "text", x: 353, y: Y(153), txt: "®", f: "f500", s: 23, c: "#0E1F5B" });
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
    { icono: "file-text", et: "CÓDIGO", val: o.codigo, fuerte: true },
    { icono: "calendar-days", et: "FECHA", val: o.fecha },
    { icono: "refresh-cw", et: "REVISIÓN", val: o.revision ?? "00" }
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
    const val = String(fi.val ?? "—");
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
  const fx = (x0, y) => x0 + (y - yb) * mF;
  const finBanda = 1172.4;
  p.push({
    t: "path",
    d: poligono([[xe - 30, yb], [finBanda, yb], [fx(finBanda, y0 + h), y0 + h], [xe - 30, y0 + h]]),
    fill: { lin: [xe, 0, finBanda, 0], stops: [[0, "#C8DBEC"], [1, "#DEE9F3"]] }
  });
  [[1188.4, 18], [1218.4, 18.5], [1247.9, 19.5]].forEach(([x0, w]) => {
    p.push({ t: "path", d: poligono([[x0, yb], [x0 + w, yb], [fx(x0 + w, y0 + h), y0 + h], [fx(x0, y0 + h), y0 + h]]), fill: "#E6EEF6" });
  });
  p.push({ t: "path", d: poligono([[1278.4, yb], [1364, yb], [1383.5, y0 + h], [fx(1278.4, y0 + h), y0 + h]], [0, 4, 6, 0]), fill: "#EBF1F7" });
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
    const lineas = fila.map((c) => partirLineas(c.valor ?? "—", medir, "f700", FICHA.sVal, anchoTxt));
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
    const v = valores[i] == null || valores[i] === "" ? "—" : String(valores[i]);
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
  if (conPagina) p.push({ t: "text", x: 1376, y: yb, txt: total > 1 ? `Página ${pagina} de ${total}` : `Página ${pagina}`, f: "f400", s, c: PAL.pieTexto, a: "end" });
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
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = partes(d);
  return `${p.day}-${p.month}-${p.year} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
function duracion(ms) {
  if (ms == null || isNaN(ms)) return "—";
  const h = ms / 36e5;
  if (h < 1) return Math.max(1, Math.round(ms / 6e4)) + " min";
  if (h < 48) return (Math.round(h * 10) / 10).toString().replace(".", ",") + " h";
  return (Math.round(h / 24 * 10) / 10).toString().replace(".", ",") + " d";
}
var capital = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
var dmyIso = (iso, sep = "-") => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}${sep}${m[2]}${sep}${m[1]}` : iso || "—";
};
var LARGOS = /^(motivo|modificaciones|observaciones|hito de la obra|nueva condición)$/i;
function documentoComprobante(data, ref, hoy = /* @__PURE__ */ new Date()) {
  const { sol, cmap, aprs, pmap, trabNombre } = data;
  const tipoTxt2 = ref.tipoLabels[sol.tipo] ?? sol.tipo;
  const codigo = ref.documentoCodigos[sol.tipo]?.codigo ?? "—";
  const nombre = `Comprobante de solicitud de ${tipoTxt2}`;
  const fecha = fechaDMY(hoy);
  const identificacion = [
    { etiqueta: "Registro", valor: `Solicitud de ${tipoTxt2}`, icono: "file-text" },
    { etiqueta: "Fecha del documento", valor: fecha, icono: "calendar-days" },
    { etiqueta: "Código", valor: codigo, icono: "barcode" },
    { etiqueta: "Revisión", valor: "00", icono: "settings" },
    { etiqueta: "Folio", valor: sol.folio || "—", icono: "hash" },
    { etiqueta: "Estado", valor: capital(String(sol.estado ?? "")), icono: "circle-check" },
    { etiqueta: "N° de solicitud", valor: sol.codigo || "—", icono: "clipboard-list" },
    { etiqueta: "Fecha de creación", valor: fechaHora(sol.created_at), icono: "calendar-clock" }
  ];
  const sol_p = pmap.get(sol.solicitante_id);
  const detalle = [
    { etiqueta: "Solicitante", valor: sol_p?.nombre ? sol_p.email ? `${sol_p.nombre} · ${sol_p.email}` : sol_p.nombre : "—", icono: "user" }
  ];
  if (sol.tipo === "traslado") {
    detalle.push({ etiqueta: "Trabajador", valor: trabNombre ?? "—", icono: "hard-hat" });
    detalle.push({ etiqueta: "Obra origen", valor: cmap.get(sol.centro_origen_id)?.nombre ?? "—", icono: "building-2" });
    detalle.push({ etiqueta: "Obra destino", valor: cmap.get(sol.centro_destino_id)?.nombre ?? "—", icono: "building-2" });
  } else if (sol.tipo === "ingreso") {
    detalle.push({ etiqueta: "Centro de costo", valor: cmap.get(sol.centro_origen_id)?.nombre ?? "—", icono: "building-2" });
  } else {
    detalle.push({ etiqueta: "Trabajador", valor: trabNombre ?? "—", icono: "hard-hat" });
    detalle.push({ etiqueta: "Centro de costo", valor: cmap.get(sol.centro_origen_id)?.nombre ?? "—", icono: "building-2" });
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
    return [
      String(a.orden),
      pmap.get(a.aprobador_id)?.nombre ?? "—",
      capital(String(a.decision ?? "pendiente")),
      fechaHora(a.asignado_at),
      a.decidido_at ? fechaHora(a.decidido_at) : "—",
      duracion(ms)
    ];
  });
  return {
    encabezado: { titulo: nombre, codigo, fecha, revision: "00" },
    pie: { codigo, nombre },
    secciones: [
      { titulo: "Identificación del registro", fichas: identificacion },
      { titulo: "Detalle del registro", fichas: [...cortas, ...largas] },
      { titulo: "Aprobaciones", tabla: {
        columnas: [
          { titulo: "N°", w: 80, alinear: "centro", estilo: "numero" },
          { titulo: "Aprobador", icono: "user-check", w: 330, estilo: "fuerte" },
          { titulo: "Decisión", icono: "circle-check", w: 190, estilo: "pildora" },
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
  f400: "AAEAAAAOAIAAAwBgR0RFRgI6AqcAAD34AAAALkdQT1NEdkx1AAA+KAAAACBHU1VCkxWCFgAAPkgAAAA2T1MvMlwgdtQAADnMAAAAYGNtYXDOQ6vuAAA6LAAAAfpnYXNwAAAAEAAAPfAAAAAIZ2x5Zk9oY8sAAADsAAAy7mhlYWQKC3o/AAA10AAAADZoaGVhBgYE7QAAOagAAAAkaG10eLKnGlMAADYIAAADoGxvY2GU2IgvAAAz/AAAAdJtYXhwAQcBlwAAM9wAAAAgbmFtZSG8OsYAADwoAAABqHBvc3T/uAAyAAA90AAAACAAAgAGAAACNwKxAAcACgAAISchByMTMxMlMwMB0zT++zRg3Xjc/nrXa62tArH9T/oBaP//AAYAAAI3A48AIgACAAAAAwDfAbUAAP//AAYAAAI3A5IAIgACAAAAAwDgAeIAAP//AAYAAAI3A34AIgACAAAAAwDdAd8AAP//AAYAAAI3A48AIgACAAAAAwDeAasAAP//AAYAAAI3A8IAIgACAAAAAwDhAa8AAP//AAYAAAI3A4QAIgACAAAAAwDiAeQAAAAC//QAAAL6ArEADwASAAAlMxUhJyEHIwEhByEXIRUjBTMDAhfj/tAo/vRBYQESAcsL/ss4AP/s/tfdVExMra0CsUziTD0BawADAGQAAAIzArEADQAWAB8AAAAWFRQhIxEzMhYVFAYHJxUzMjY1NCYjEjY1NCYjIxUzAdtY/u++o4OLSzbRaDxNUVJlWVZFcV8BYExQxAKxVlg8UAv62To1PC795jJGRDz4AAEAN//0AhwCvQAaAAAAFhcHJiMiBhUUFjMyNjcXBgYjIiYmNTQ2NjMBk1UsND9GVmloVixCJS8gZEFUg0lMglACvSAkPTOEko6HHhs8ISxToXFxoVIAAQA3/w8CHAK9AC4AACQGBxUWFhUUBiMiJic3FjMyNjU0JiM3LgI1NDY2MzIWFwcmIyIGFRQWMzI2NxcCAFM1MC1GNhwwDxkeIRcbKi8LTXVBTIJQPlUsND9GVmloVixCJS8kKQUuBC8iMDQNCzQQExUVFVgHV5trcaFSICQ9M4SSjoceGzwAAAIAZAAAAk0CsQAIABIAAAAWFRQGIyMRMwcRMzI2NTQmJiMBkL29h6WQMU1geD5gQQKxkcS/nQKxTP3mdpttdScAAAIAFAAAAlkCsQAMABoAAAAWFRQGIyMRIzUzETMSNjU0JiYjIxUzFSMVMwGcvb2HpVxckHx4PmBBRp2dTQKxkcS/nQE+RgEt/Zp2m211J+FG8wABAGQAAAHhArEACwAAAQchFTMVIxUhFSERAdkL/vXo6AEe/oMCsUzhTOxMArH//wBkAAAB4QOPACIADwAAAAMA3wG4AAD//wBkAAAB4QOSACIADwAAAAMA4AHlAAD//wBkAAAB4QN+ACIADwAAAAMA3QHiAAD//wBkAAAB4QOPACIADwAAAAMA3gGuAAAAAQBkAAAB0gKxAAkAADMRIQchFTMVIxFkAW4L/vzh4QKxTOtL/tEAAAEAN//0AjkCvQAdAAAAFhcHJiYjIgYGFRQWMzI3NSMnMxEGIyImNTQ2NjMBo18vOCVELjVZOF9dTDd6C+NrdoiZUYlRAr0lJzoeGjl9YJGGH9BN/rM9tq9woVMAAQBkAAACRAKxAAsAACERIREjETMRIREzEQHl/t5fXwEiXwFD/r0Csf7gASD9TwAAAQBkAAAAwwKxAAMAABMRIxHDXwKx/U8Csf//ABsAAAELA48AIgAXAAAAAwDfASkAAP///+wAAAE4A5IAIgAXAAAAAwDgAVYAAP////AAAAE1A34AIgAXAAAAAwDdAVMAAP//ABEAAAEBA48AIgAXAAAAAwDeAR8AAAABAAX/dwDSArEACgAANxQGByc+AjURM9JZWxkuLhJfYGZmHUUSKjwwAk0AAAIAZAAAAk0CsQADAAkAABMRIxEhAQEjAQHDXwHW/vsBGHX+8AEGArH9TwKx/sX+igFwAUEAAAEAZAAAAd4CsQAFAAATESEHIRHDARsL/pECsf2iUwKxAAABAD4AAALMArEAEAAAISMDJicDIwMUBwMjEzMTEzMCzFwYDwKVWZ0NF1o5gJGKgQE3t2L9/gIDfaT+0AKx/gsB9QABAGQAAAJHArEADwAAISMBFhYVESMRMwEmJjURMwJHf/7oBgdZfAEbAwpZAklFdVP+xAKx/bYagjYBeP//AGQAAAJHA4QAIgAgAAAAAwDiAiYAAAACADf/9AJ9Ar0ADwAZAAAAFhYVFAYGIyImJjU0NjYzBgYVFBYzMhEQIwGxg0lJg1dXg0lJhFZaZGVZvr4CvVOgcnCgVFKgcW+iVU6IkI+GARYBF///ADf/9AJ9A48AIgAiAAAAAwDfAfAAAP//ADf/9AJ9A5IAIgAiAAAAAwDgAh0AAP//ADf/9AJ9A34AIgAiAAAAAwDdAhoAAP//ADf/9AJ9A48AIgAiAAAAAwDeAeYAAAADADf/gQJ9AzMAFwAfACcAAAAWFRQGBiMiJwcnNyYmNTQ2NjMyFzcXBwYGFRQXEyYjEhE0JicDFjMCLk9Jg1ckHyNPKEdPSYRWJR0lTyrmZFKeGxe+KiqcGRkCdKV3cKBUB3oVgCijdm+iVQd9FYMsiJC5PQIJBf3TARZjeh399QX//wA3//QCfQOEACIAIgAAAAMA4gIfAAAAAgBkAAACJQKxAAoAEwAAABYVFAYjIxUjETMSNjU0JiMjETMBmYySeVdftVBXV1FVUwKxa2pxbv0Csf6XQFNKQv7hAAACAGQAAAIlArEADAAVAAAAFhUUBiMjFSMRMxUzEjY1NCYjIxEzAZmMknlXX19WUVZXUVVTAjtsbXRvfwKxdv6PQlVNQ/7ZAAACADf/mQKaAr0AFQAfAAAkFhcHJiYjIiYmNTQ2NjMyFhYVFAYHJBYzMhEQIyIGFQIWWio+PGxcVoJJSYRWV4NJUE7+vWVZvr5aZCchHVA1KFGfcW+iVVOgcnmPKaGGARYBF4iQAAACAGQAAAJEArEADQAWAAABIxEjETMyFhUUBgcTIwMyNjU0JiMjFQEua1+1gYVKS7pxsEtMTVVVAST+3AKxYmFIWhf+ywFtPURAOfoAAQAZ//QB+QK9ACkAAAAWFwcmJiMiBhUUFhYXHgIVFAYGIyInNxYWMzI2NTQmJicmJjU0NjYzAVNiLjQnSys2RhhBPkFWNTtvTI9bNCpWNUBUGj88amI3Yz8CvScpOh8dMjAeKSITFC5RPjxcNFk6IiM/PCItJBIgWk00Ui4AAQAPAAAB+wKxAAcAAAEHIxEjESM1AfsKv1/EArFR/aACYFEAAQBa//QCPAKxABIAACUUBgYjIiY1ETMRFBYzMjY1ETMCPDltTHN9X0hJSkhg3UVpO39qAdT+M1BQT1EBzf//AFr/9AI8A48AIgAvAAAAAwDfAeEAAP//AFr/9AI8A5IAIgAvAAAAAwDgAg4AAP//AFr/9AI8A34AIgAvAAAAAwDdAgsAAP//AFr/9AI8A48AIgAvAAAAAwDeAdcAAAABAAYAAAImArEABgAAAQMjAzMTEwIm3GbeZq2tArH9TwKx/bYCSgAAAQAZAAADIQKxAAwAAAEDIwMDIwMzExMzExMDIYx6f4B3jF1vhWWIcwKx/U8CQf2/ArH9ogJe/aICXgAAAQAFAAACFwKxAAsAAAETIwMDIxMDMxMTMwFF0myfoWbPvWyLjGYBdP6MATH+zwFvAUL+/QEDAAABAAUAAAIhArEACAAAAQMRIxEDMxMTAiHeYN5pqKgCsf5Y/vcBCAGp/qsBVQD//wAFAAACIQOPACIANwAAAAMA3wGpAAAAAQAeAAAB3QKxAAkAAAEVASEHITUBITUB3f6rAVUL/kwBWP7MArFN/e1RTAIVUAAAAgAt//QB7gIbABwAJQAAJBYXByYmJwYjIiY1NDYzMzU0JiMiByc2MzIWFRUGNzUjIhUUFjMBwhYWFSkyDDVoTlp5b1E2ODpUF2JUXVyJLUWSLi1bHwhABSQmT1hHVFonODAcQyRbVPFCUnlsLzAA//8ALf/0Ae4DIQAiADoAAAADANcBmwAA//8ALf/0Ae4DGAAiADoAAAADANgByQAA//8ALf/0Ae4DAAAiADoAAAADANQBxQAA//8ALf/0Ae4DIQAiADoAAAADANYBpQAA//8ALf/0Ae4DRAAiADoAAAADANkBlQAA//8ALf/0Ae4DBgAiADoAAAADANoBygAAAAMALf/0Ax0CGwAoAC8AOwAAAAchFhYzMjY3FwYjIiYnBgYjIiY1NDYzMzU0JiMiByc2MzIXNjMyFhUnNCYjIgczBDY3JjU1IyIVFBYzAx0C/rAGTDwmQCMoVGQ/YR4kWj5PXHxvUTY4OlQXYlRyKzlmZm9bPj5xCvf+VUMeD0WSLi0BABhXUhYYN0IyLzQtWEdUWic4MBxDJFRUinobTlKm8ywwMDwDbC8wAAACAF//9AIUAu4ADwAbAAAAFhUUBgYjIicHIxE3ETYzEjY1NCYjIgcVFhYzAapqMl4/UzkJUVw5XBxFQDtGNRU9IgIbkYJSfUVGOgLjC/7fTv4iY2hrX1L8ISYAAAEAOf/0AcACGwAZAAAAFhcHJiYjIgYVFBYzMjY3FwYjIiY1NDY2MwFOTiQsHDUgQEdGQR80ICpIWWt7OGdHAhsbHjoUE2ZkZF8TFTw6kH9UfkYAAAEAOf8PAcACGwAtAAAEBxUWFhUUBiMiJic3FjMyNjU0JiM3JiY1NDY2MzIWFwcmJiMiBhUUFjMyNjcXAYFNMC1GNhwwDxkeIRcbKi8LWWQ4Z0cvTiQsHDUgQEdGQR80ICoFBi0ELyIwNA0LNBATFRUVWg6MclR+RhseOhQTZmRkXxMVPAAAAgA+//QB9wLuABAAHQAAAREjJwYGIyImNTQ2NjMyFxECNjcRJiYjIgYVFBYzAfdRCRpOMF5pMl4/UT1YPBwaOyU9Qz46AuP9HUkoLZR9UX5HQQEU/U8nJwECIiNmZWZkAAACADn/9AH8AwgAHgArAAAAFhUUBgYjIiYmNTQ2NjMyFyYmJwcnNyYnNxYXNxcHAjY1NCcmJiMiFRQWMwGwTDpoRD5lOi1bQVs4DDkySD9KND0UVUBGNj8CSwIaRS55RDoCVL+MU31FOnBNPm5EQz9hJ0YgSxgMRhEfSi9B/aVqYxUmJyekVlwAAgA5//QB7QIbABUAHAAAAAchFhYzMjY3FwYjIiY1NDY2MzIWFSc0JiMiBzMB7QL+sAZMPCZAIyhUZG57NWNDaXBbPj5xCvcBABhXUhYYN0KQflJ/SIp6G05Spv//ADn/9AHtAyEAIgBHAAAAAwDXAa0AAP//ADn/9AHtAxgAIgBHAAAAAwDYAdsAAP//ADn/9AHtAwAAIgBHAAAAAwDUAdcAAP//ADn/9AHtAyEAIgBHAAAAAwDWAbcAAAABAAoAAAGLAu4AFgAAEgYVFTMHIxEjESM1MzU0NjMyFhcHJiPoJIAKdlxeXldOJDkhHS0vAqQlJ0lH/jgByEdIRFMNDkMUAAACABn/KwIIAkoAOABDAAABBgYjFhUUBiMiJwYGFRQzMzIWFhUUBiMiJiY1MxQWFjMyNjU0JiMjIiY1NDY3JiY1NDY2MxY2NjcEBhUUFjMyNjU0IwIIHkg0XWxdJB8MDkVUNVItfnlVYypTGD45U0c4MlNDRR4cLis1XTk+VDco/ts5OjU2OXEB9woGKltPZAoIGw4rJkIqTVMjRjcgJRMpKSUmOSsaMBMYRzM1VC8BCxMScUE1NkE/OXUAAAEAXwAAAfAC7AASAAAAFhURIxE0JiMiBgcRIxE3ETYzAZ9RXCspKUAcXFw+XgIbVkv+hgFtOC4wLP6JAuIK/tpV//8ATAAAAM0DDAAiAFAAAAADANUA6wAAAAEAXwAAALsCDwADAAATESMRu1wCD/3xAg///wAVAAABBQMhACIAUAAAAAMA1wEjAAD////nAAABMwMYACIAUAAAAAMA2AFRAAD////qAAABLwMAACIAUAAAAAMA1AFNAAD//wAfAAABDwMhACIAUAAAAAMA1gEtAAD////3/ywAzAMMACIAVgAAAAMA1QDqAAAAAf/3/ywAuQIPAAsAADcUBgYHJz4CNREzuSRFPhsnKhVcIElYNxxDEiM/NwH1AAIAXwAAAgAC7gADAAkAABMRIxEFBxMjAze7XAGLwthu0cIC7v0SAuPU6f7aASDvAAEAWv/0AREC7gANAAAWJjURNxEUFjMyNxcGI5U7XA8SEw8YISgMPTcCewv9fBYUBkASAAABAF8AAAL/AhsAHwAAABYVESMRNCMiBgcRIxE0IyIGBxEjETMXNjMyFhc2NjMCsU5cSic2H1xKKDYeXE8IO10xRQ8fSzMCG1dK/oYBbWYtMP6KAW1mLi/+igIPTVkyLS4xAAEAXwAAAfACGwATAAAAFhURIxE0JiMiBgcRIxEzFzY2MwGfUVwqKSpAHFxPCBxTMgIbVkv+hgFtOC4wLf6KAg9OKjD//wBfAAAB8AMGACIAWgAAAAMA2gHvAAAAAgA5//QCDwIbAA0AFQAAABYVFAYGIyImNTQ2NjMGFRQzMjU0IwGUezhqSW98OGpKiYiIhwIblH9SfUWUf1J9RUrKycrJ//8AOf/0Ag8DIQAiAFwAAAADANcBugAA//8AOf/0Ag8DGAAiAFwAAAADANgB6AAA//8AOf/0Ag8DAAAiAFwAAAADANQB5AAA//8AOf/0Ag8DIQAiAFwAAAADANYBxAAAAAMAOf9+Ag8CkAAXAB4AJgAAABYVFAYGIyInByc3JiY1NDY2MzIXNxcHBBUUFxMmIxI1NCYnAxYzAdY5OGpJGBsnSyo2OjhqShgbJ0sq/vwwfBEShxcYew8TAdt9VlJ9RQV7Fn8hflVSfUUFehZ+K8qBLQF1A/5tykNUFv6MAwD//wA5//QCDwMGACIAXAAAAAMA2gHpAAAAAgBf/ysCFAIbAA8AGgAAABYVFAYjIicVBxEzFzY2MxI1NCMiBgcRFhYzAbZebGNYMlxPBx1SLWB3J0AYFDwkAhuQg3yYPPoLAuRHKCv+JMnKLiT+/x8hAAIAX/8rAhQC7gAPABoAAAAWFRQGIyInFQcRNxE2NjMSNTQjIgYHERYWMwG2XmxjWDJcXBxOLGB3J0AYFDwkAhuQg3yYPPYPA7gL/uElJ/4kycouJP7/HyEAAAIAPv8rAfcCGwAQAB0AAAERJxEGBiMiJjU0NjYzMhc3AjY3ESYmIyIGFRQWMwH3XBpNL15pMl4/VEAHZTwcGjslPUM+OgIP/RwLARAnK5R9UX5HRzv+LicnAQIiI2ZlZmQAAQBfAAABeAIbAA8AAAAXByYjIgYHESMRMxc2NjMBYBgRGBYxPBFcTwkVSDACGwZaBkhM/tMCD2s7PAAAAQAZ//QBsAIbACUAAAAWFwcmJiMiBhUUFhcWFhUUBiMiJzcWMzI2NTQmJicmJjU0NjYzASRWJyckQSQtNDFAWFd5V3hPMUNRND0WNjRUSzFXNgIbHh46FxYlICAkERZMQk5SRTgzKyUbIRkOFko5KUMlAAABAF//9AIpAu4AMwAAABYWFRQGBwYGFRQWFx4CFRQGBiMiJzcWMzI2NTQmJyYmNTQ2NzY2NTQmIyIVESMRNDYzAV9RLCIgGBUiIyYvIjFSLzsrGxooKjMvListHB0bGjUobFxpYALuJkEoKTAaFBoTFyIYGipEMDRPKxdADTQxLTghHzQoISYYFiQdJSeL/eUCG2RvAAABAAn/9AFpApEAFQAAJQYjIiY1ESM1MzU3FTMHIxEUFjMyNwFpNEJDS1xcXH0Kcx0iHycYJE1JAT5HdwuCR/7GKSUVAAEAWv/0AecCDwASAAAhIycGBiMiJjURMxEUFjMyNxEzAedPBx5OOEVOXCYrTTdcUjEtVE0Bev6QNi1bAXj//wBa//QB5wMhACIAagAAAAMA1wG3AAD//wBa//QB5wMYACIAagAAAAMA2AHlAAD//wBa//QB5wMAACIAagAAAAMA1AHhAAD//wBa//QB5wMhACIAagAAAAMA1gHBAAAAAQAKAAAB4gIPAAYAAAEDIwMzExMB4rNvtmSKiQIP/fECD/5DAb0AAAEAFAAAArkCDwAMAAABAyMDAyMDMxMTMxMTArl4fVxfentcX2hnY2ACD/3xAbz+RAIP/jEBz/4xAc8AAAEABQAAAeACDwALAAABEyMnByMTJzMXNzMBKbdvgYNouKNsbm9oARr+5t/fARb5wcEAAQAK/ysB4gIPAA4AAAUGBgcnPgI3IwMzExMzATIfb2cKND4lEB+xYo2KXwNcawtICSI1LQIP/jQBzAD//wAK/ysB4gMhACIAcgAAAAMA1wGMAAD//wAK/ysB4gMAACIAcgAAAAMA1AG2AAAAAQAZAAABlwIPAAkAAAEVASEHITUBIzUBlP7tARYL/o0BEvsCD0b+hE1FAXxOAAMAQQAAAb8CsQAcACUAKQAAATU0JiMiByc2MzIVFRQWFwcmJicGBiMiJjU0NjMWNzUjIhUUFjMDIRUhATkoKzFAFk5InRAREyMrCxVBKD9JY1sZITBqIh+ZAXj+iAINGCcgFT4ch6oXFgY9BBscHh5DN0BEvDVQSB0g/vxNAAMAOAAAAbwCsQALABQAGAAAABYVFAYjIiY1NDYzBhUUMzI1NCYjAzUhFQFXZWdbXGZoW2RjYzExvQF4ArFvYl9ycGFfckWMjIxIRP2UTU0AAQBf/ysCAQIPABsAACQXByYmJzUGBiMiJicWFhUVBxEzERQzMjcRMxEB5xpWCwkEGEcrIy0QCQhbXE9QMVxQUAwaJyABKjgXGxw8LmoLAuT+jVlgAWz+pQAAAgA3//QB9wKnAAsAFwAAABYVFAYjIiY1NDYzBgYVFBYzMjY1NCYjAYZxcW9vcXFvQT8/QUBAQEACp7GoqLKyqKixSYCQkIGBkI+BAAEAIwAAAUMCnQAGAAABESMRByc3AUNcnCjPAp39YwI7X0GAAAEAGQAAAb0CpwAZAAAAFhYVFAYGByEHITU+AjU0JiMiBgcnNjYzASBbMjdydAEtC/51hnAwPDIpPiM8KWQ+AqcwUzQ9cIJ0TUmLgWA3NDsiJzAzMgAAAQAP//QBvAKnACkAAAAWFhUUBgcWFhUUBgYjIiYnNxYWMzI2NTQmIyM3MzI2NTQmIyIGByc2MwEfWS9HO0NUOGhEPWYmNyFFKT9IREEyCyI0RTwzJ0EiMFVqAqcuTi49Tw4GVEg6XjUtLTMiIEc8QjZHPjgvNxwgN08AAAEAKAAAAfYCpwAOAAAlFSMVIzUhNRMXAzM3MxUB9ldZ/uLJTbW+CFDuSaWlQgHAIP5ntLQAAAEAGv/0AcgCnQAeAAABIRU2MzIWFRQGBiMiJic3FhYzMjY1NCYjIgYHIxEhAaT++zM4Vmg6aUU9YCk2IEQrQElCOBosGUgBagJVxRpxY0JnOSsqNSAfUElJQgsMAVEAAAIAN//0Ae0CpwAYACMAAAAWFhUUBgYjIiY1NDY2MzIXByYjIgYHNjMSNjU0IyIGBxYWMwFnVDI5YTt1bD1yTkw+JC84SFQEPmMePmwsShoDP0IBuDBgRUdtO62ZbaVbKT0dinRY/oVYS48xK25oAAABABn/9gGeAp0ABgAAARUDJxMhNQGe+lTx/tgCnUX9nhwCQEsAAAMALf/0AfoCpwAaACcANQAAABUUBgYjIiYmNTQ2NyYmNTQ2NjMyFhYVFAYHJgYVFBYXFzY2NTQmIxI2NTQmJicnBgYVFBYzAfo7akNEaDlDQTUzOV01NF06ODqNPTtBES0oOzY9SRw+OBkyMEg+AS57N1cxMFY3PlQcG000Nk4oJk02Mkgd+zYyMDIVBho6Ki84/dtANSQxJRMJGEk2Nz0AAAIALf/qAdsCpwAVACAAAAAWFRQGBgcnNjY3BgYjIiYmNTQ2NjMSNzYmIyIGFRQWMwFtbkqYghWGjwUXTjE0VDE6YTtFNgI7QDtAPDMCp4t5iadjJkUmgmwkLDVhQURkNf6UU29hTkhGRwABAEEAAAESAaEABgAAAREjEQcnNwESTWIijAGh/l8BUjk1UwABADcAAAFYAagAFwAAABYVFAYGBzMHITU+AjU0JiMiBgcnNjMBA0shSki9CP7zVEgfJB0aJhUxN1UBqEQ0Ij9QQT46UU02HB4iFBgmRAABADT/9wFcAagAJQAAABYVFAYHFhYVFAYjIic3FjMyNjU0JiMjNzMyNjU0JiMiBgcnNjMBBUkuKCw4VUhXNC0mNCUrKSciCRcgKCQeGSoVKDpMAag8LSYyCgQ0LjdJPCopJiEkHzghHhoeEhMsNAAAAQAqAAABZQGoAA4AACUVIxUjNSM1ExcHMzczFQFlNUy6gEJxagdEnDxgYDYBEhnzaWkAAAEAQQEQARICsQAGAAABESMRByc3ARJNYiKMArH+XwFSOTVTAAEANAEHAVwCuAAlAAAAFhUUBgcWFhUUBiMiJzcWMzI2NTQmIyM3MzI2NTQmIyIGByc2MwEFSS4oLDhVSFc0LSY0JSspJyIJFyAoJB4ZKhUoOkwCuDwtJjIKBDQuN0k8KikmISQfOCEeGh4SEyw0AP//AEEBQgESAuMABwCDAAABQv//ADcBQgFYAuoABwCEAAABQv//ADQBOQFcAuoABwCFAAABQgAB/1n/sgErAu4AAwAAExcBJ/A7/mo8Au4d/OEdAP//AEH/sgNsAu4AIgCHAAAAIwCMAZAAAAADAIQCFAAA//8AQf+yA3kC7gAiAIcAAAAjAIwBkAAAAAMAhgIUAAD//wA0/7IDeQLuACIAiAAAACMAjAGQAAAAAwCGAhQAAAABABQBZwGjAuMADgAAAQcXBycHJzcnNxcnMwc3AaOZaEhPTkhnmBuOD1oPjgIxIXQ1hoY0dSFSPZ2ePwABAGn/mAGfAycAAwAAExMHA7foT+cDJ/yEEwN9AAABADIA8QC9AXwACwAAEhYVFAYjIiY1NDYzlSgoHh0oKB0BfCgdHSkpHR0oAAEAMgDlARIBxgALAAASFhUUBiMiJjU0NjPSQEAwMEBAMAHGQTAwQEEwMED//wAy//QAvQHvACIAmgAAAAcAmgAAAXAAAQAm/1oAvQB/AA0AADYWFRQHByM3JiY1NDYzlSgSQ0IoDQ8oHX8oHR8omaYKHhIdKP//ADL/9AKvAH8AIwCaAPkAAAAjAJoB8gAAAAIAmgAAAAIAM//0AL4CsQADAA8AABMDIwMSFhUUBiMiJjU0NjOqClELUigoHh0oKB0Csf41Acv9zigdHSkpHR0oAAIAM/82AL4B7wALAA8AABIWFRQGIyImNTQ2MxcTIxOWKCgdHigoHikLZgoB7ykdHSgoHR0p+P4/AcEAAAIADwAAAfcCnQAbAB8AAAEjBzMVIwcjNyMHIzcjNTM3IzUzNzMHMzczBzMDNyMHAfdMHENNFU4VmhVOFUBKHEFKFE4UmhROFEO2HJocAb/XRaOjo6NF10aYmJiY/uPX1wAAAQAy//QAvQB/AAsAADYWFRQGIyImNTQ2M5UoKB4dKCgdfygdHSkpHR0oAAACAB7/9AGtAr0AHAAoAAAAFhYVFAYGBwYGFRUjNTQ2Njc2NjU0JiMiByc2MwIWFRQGIyImNTQ2MwEqVywbJiAqKlsdKCEmJDYvUDs/VHwDKCgeHSgoHQK9K0gpJzciFx0xKS0yKzwkFxkoICktSDFj/cIoHR0pKR0dKAAAAgAe/ykBrQHvAAsAKAAAEiY1NDYzMhYVFAYjAiYmNTQ2Njc2NjU1MxUUBgYHBgYVFBYzMjcXBiPgKCgeHSgoHV1XLBsoICkpWxwoISYlNi9QOz9UfAFkKB0dKSkdHSj9xStIKSg3IhYcLycpLio6IxYYKSApLUgxY///ADwBqwFTArEAIgCeAAAAAwCeALQAAAABADwBqwCfArEAAwAAEwMzA0sPYw8BqwEG/vr//wAm/1oAvQHvACIAlQAAAAcAmgAAAXAAAQBp/5gBnwMnAAMAAAEXAycBUU7nTwMnEvyDEwAAAQAR/3IB9//BAAMAABc1IRURAeaOT08AAQAZ/3gBFQNEAB4AAAEiBhUVFAYHFhYVFRQWMxUiJjU1NCYjNTI2NTU0NjMBFTMsJCcoIywzZFIfJycfUmQC/R8l7zMtDQ4qM+8lH0dFUN4qIkwkKt5QRQAAAQAt/3gBKQNEAB4AABIWFRUUFjMVIgYVFRQGIzUyNjU1NDY3JiY1NTQmIzWRUh8nJx9SZDMsIygnJCwzA0RFUN4qJEwiKt5QRUcfJe8zKg4NLTPvJR9HAAEAQf+MARADMAAHAAABFSMRMxUjEQEQeHjPAzBN/PVMA6QAAAEAMv+MAQEDMAAHAAABESM1MxEjNQEBz3h4AzD8XEwDC00AAAEAKP9vARwDTQARAAABDgIVFBYWFwcuAjU0NjY3ARw0PSMjPTQ6QkcxMUdCAyVNeZpnZpp7TCheealvb6l5XgABACj/bwEcA00AEQAAEhYWFRQGBgcnPgI1NCYmJzekRzExR0I6ND0jIz00OgLvealvb6l5XihMe5pmZ5p5TSgAAQAgARIC9gFgAAMAABM1IRUgAtYBEk5OAAABACABEgHoAWAAAwAAEzUhFSAByAESTk4AAAEAPAESAVcBYAADAAATNSEVPAEbARJOTgAAAQA8ARIBVwFgAAMAABM1IRU8ARsBEk5OAP//ADcAJwIIAhcAIgCuAAAAAwCuAOsAAP//ADcAJwH/AhcAIgCvAAAAAwCvAOIAAAABADcAJwEdAhcABgAAExcHFwcnNeY3h4c3rwIXJtLSJtg/AAABADcAJwEdAhcABgAAExcVByc3J26vrzeHhwIX2T/YJtLSAAACACwB6gFuAvEADQAbAAASJjU0Njc3MwcWFRQGIzImNTQ2NzczBxYVFAYjUiYHCkM8KBonGpcmBwpDPCgaJxoB6iUaDBkVjpYUHholJRoMGRWOlhQeGiX//wAoAeoBagLxACcAtAAAAoYABwC0ALIChgABACwB6gC8AvEADQAAEiY1NDY3NzMHFhUUBiNSJgcKQzwoGicaAeolGgwZFY6WFB4aJQD//wAoAeoAuALxAAcAtAAAAoYAAQAo/2QAuABrAA0AADYWFRQGBwcjNyY1NDYzkiYHCkM8KBonGmslGgwZFY6WFB4aJQABADn/ZgHAAqwAHQAAJQYHFSM1JiY1NDY3NTMVFhcHJiYjIgYVFBYzMjY3AcA4P1BaZmdaT0E2LBw1IEBHRkEfNCAuLQqRkQyNc3OVDZSUCS06FBNmZGRfExUAAAIAHQBYAhMCUwAbACcAAAAHFwcnBiMiJwcnNyY1NDcnNxc2MzIXNxcHFhUGNjU0JiMiBhUUFjMB7CVMN041Q0I0TjVOJCNNN04xQ0U0TzVMJZc/Pzw7Pz87ARA2SzdMICNPN041Q0E2UDdQIiFPN000RohIQUFISUBBSAABABn/ZQHrAzgALAAAJAYHFSM1Jic3FjMyNjU0JiYnJiY1NDY3NTMVFhYXByYmIyIGFRQWFhceAhUB62BVUHtSNkhkP1EZPjpnX2JQUDBNIzUiSSs1Qxg+PD9UM25oDpOQBlA7Rj45ISwiEiBXSkZeCZKTBSUhOiAcMS4dJyETEy5OPAABABn/9AInAqcAJQAANhYzMjY3FQYGIyImJyM3MzUjNzM2NjMyFwcmJiMiByEHIxUzByPgUEsnQSQmSCxngRRYD0ZVD0oYiF9jUyQmQCh7JAD/D/bjDtKQTxYTUBIUfHc9Wj5wezg/FxSfPlo9AAEAKAAAAeoCpwAhAAA2BgchByE1PgI1NSM1MzU0NjMyFhcHJiYjIgYVFTMVIxXVGiMBQAv+WyMiDUJCZFk3WCQ8GDYlMTXQ0Jk4FE1JDR0vK3U8b1NnKSouHBo5NXA8dgAAAQAFAAACEwKdABYAAAEDMxUjFTMVIxUjNSM1MzUjNTMDMxMTAhO/cYqKil6Li4tyv2akowKd/r0+Wj2FhT1aPgFD/tkBJwAAAQA+AJABtQIHAAsAAAEVMxUjFSM1IzUzNQEjkpJUkZECB5ZMlZVMlgAAAQA+ASYBtgFzAAMAABM1IRU+AXgBJk1NAAABAEgAgQGsAeYACwAAARcHFwcnByc3JzcXAXQ4eHg4eHw4eHg4eAHmOXh8OHx8OHh8OX3//wA+ACMBtgJ3ACcAmgCDAC8AJwCaAIMB+AACAL0AAP//AD4AxAG2AdIAJgC9AF8ABgC9AJ4AAQAyAHMBwgInAAYAABMFFQUnJSVTAW/+kSEBR/65AierXqtKkI4AAAEAMgBzAcICJwAGAAABFwUFByU1AaEh/rkBRyH+kQInTI6QSqteAP//AD4AAAG2Ah4AJwC9AAD+2gAGALwBFwABACMA+gHFAYAAFgAAJCYnJiYjIgcnNjMyFhcWFjMyNjcXBiMBIiseEhgMJyE4MlccKhwUGQ0VJA03L1f6ExMMDDYdYRISDQwbFR5bAAABAD4AjQG2AWkABQAAARUjNSE1AbZT/tsBadyPTf//AF//KwIBAg8AAgB4AAAABQAt/+EDDQLHAAMADwAaACYAMQAAARcBJxIWFRQGIyImNTQ2MwYGFRQWMzI1NCYjABYVFAYjIiY1NDYzBgYVFBYzMjU0JiMCZUD+MUCBW1tIR1tbRywlJSxRJC0B5FpaSEhbW0gsJSUsUSQtAscq/UQqApxcTU1cXE1NXD48Ly49ay49/t1cTU1cXE1NXD87Ly49ay48AAABAHoAFQMUAn0ADQAAAQEnNzY3ITUhJiYnJzcDFP7tQ4cnH/3vAhEVGRiHQwFJ/sw5lCsUUA0XG5Q5AAACAEb/KwO2Ar0ANQA/AAAAFhYVFAYjIiYnBgYjIiY1NDYzMhYXERQWMzI1NCYmIyIGBhUUFhYzMjcXBgYjIiYmNTQ2NjMSNzUmIyIVFBYzApTAYmRhOD8JE0c2UF14YipKKSIiakyUa26lWFWkcl9hGThjP4bOc3PQhSkhISaDMC4CvWu0a4KoPiksOXhkfocSFv79PjPhYZBPY69vb6tfIkcUE2/OiILSef2RVvcPw0tOAAADAFH/9AKxAr0AHwArADUAAAAWFhUUBgcXNjcXBgcXBycGBiMiJiY1NDY3JiY1NDYzBgYVFBYXNjY1NCYjAgYVFBYzMjY3JwFkUy5LQrAoFFYjNnBCYStsRkJlOUZFMi9fVCkwJikzNDIqUDBNPy9MI8gCvSdGKztVJ6ZRWBl0UWk2Xi8vLlU4Pl0sMEwwRFdEMCYkOScfPSUqL/6qRSw3PiQkvwAAAQBa/ykCUgKxAA0AAAERBxEjEQcRJiY1NDYzAlJTclNxb4RyArH8hQ0DP/zODQHxBm5YYWoAAgBG/7kBzwKlAC8AQAAAJBUUBiMiJzcWFjMyNjU0JiYnJiY1NDY3JiY1NDYzMhcHJiYjIgYVFBYWFxYWFRQHJhYXFhc2NjU0JiYnJicGBhUBuWxXYUcjHkEpLDgUMzVTSCkkGxpoU2FKIyFAKC0yEzQzU0lM5Cc4KyQUFhItLSMgExaIPUNPMj0UEyIfGB4aERtAOSQ/FhIxIkNNNjoVFCMfGB8cERxCNUUzciQSDhASKBMYHxkQDQ4TKhMAAAMAXAB5As4C7AAPAB8AOAAAABYWFRQGBiMiJiY1NDY2Mw4CFRQWFjMyNjY1NCYmIxYWFwcmIyIGFRQWMzI2NxcGIyImNTQ2NjMB7I9TU49WVpBUVJBWSHNCQnNIR3NCQnNHJjYbIyYoKTIxKhknFCA0Q0paLEotAuxRj1paj1BQj1paj1E0QnhMTHZCQnZMTHhCRxQULxtAQj9ADxAwLmRaPFYsAAAEAEMA7gI+Au4ADwAfACwANAAAABYWFRQGBiMiJiY1NDY2MxI2NjU0JiYjIgYGFRQWFjM2BgcXIycjFSMRMzIVBzMyNTQmIyMBhnVDQ3VHRXRDQ3RFOlszM1s6OFozM1o4bSQdSkM9GDlOeo8eNhsdHALuRXZGRnVERHVGRnZF/jE1Xjs7XzY2Xzs7XjXrJwlzamoBFFQqKhUTAAACACMBKgMsArEABwAdAAABByMRIxEjNQEjJyY1NDcjAyMDIxYVBwcjEzMTEzMBdAx5TX8DCUsJAQMBWkNjAQMBCEgQaVtTbAKxQP65AUdA/nnTFyAcH/7kARohJSrTAYf+7wERAAACADcBfQF/Ar0ADwAbAAASJiY1NDY2MzIWFhUUBgYjNjY1NCYjIgYVFBYzsEsuLksrK0suLksrJTIyJSUyMyQBfSZJMTFJJiZKMTFJJT4yLy8zMi8vMwAAAQCg/5oA8wMnAAMAABMRIxHzUwMn/HMDjQACAKD/mgDzAycAAwAHAAATESMRExEjEfNTU1MDJ/6UAWz93/6UAWwAAQAoAg8B9ANIAAYAAAETIycHIxMBN71ihYRhvQNI/sfp6QE5AAAC/p0Cjv/iAwAACwAXAAAAFhUUBiMiJjU0NjMyFhUUBiMiJjU0NjP+7yEhGBkhIRnqISEZGCEhGAMAIRgYISEYGCEhGBghIRgYIQAAAf9hAo//4gMMAAsAAAIWFRQGIyImNTQ2M0IkJB0cJCQcAwwkGxsjIxsbJAAB/vICfv/iAyEAAwAAAxcHJ+XHHNQDIXIxVgAAAf7yAn7/4gMhAAMAAAMXBydHKdQcAyFNVjEAAAH+lgJ6/+IDGAAGAAABJzczFwcn/r0nhz2IKH4Cei1xcS1UAAL+/gJw/+IDRAALABcAAAIWFRQGIyImNTQ2MwYGFRQWMzI2NTQmI15AQDIyQEAyGRwcGRgdHBkDRD0tLT09LS09Mh4aGh4eGhoeAAAB/pQCkP/iAwYAGgAAAiYnJiYjIgYHJzY2MzIWFx4CMzI2NxcGBiOeHxMPFQsQGA04EzcjFR4TAxMQCA8YDjgTOCICkA4NCwoWGBwoMA8NAgwGFRccKiwAAf7RApv/4gLgAAMAAAMhNSEe/u8BEQKbRQAB/wv/D//iABAAFAAABxYWFRQGIyImJzcWMzI2NTQmIzczezAtRjYcMA8ZHiEXGyovDjs4BC8iMDQNCzQQExUVFXMAAAL+nQMM/+IDfgALABcAAAAWFRQGIyImNTQ2MzIWFRQGIyImNTQ2M/7vISEYGSEhGeohIRkYISEYA34hGBghIRgYISEYGCEhGBghAAAB/vIC8//iA48AAwAAAxcHJ+fJGNgDj2sxTwAAAf7yAvP/4gOPAAMAAAMXBydGKNgYA49NTzEAAAH+lgL3/+IDkgAGAAABJzczFwcn/r4oiD2HJ38C9y1ubi1RAAL+/gLu/+IDwgALABcAAAIWFRQGIyImNTQ2MwYGFRQWMzI2NTQmI15AQDIyQEAyGRwcGRgdHBkDwj0tLT09LS09Mh4aGh4eGhoeAAAB/pQDDv/iA4QAGgAAAiYnJiYjIgYHJzY2MzIWFx4CMzI2NxcGBiOeHxMPFQsQGA04EzcjFR4TAxMQCA8YDjgTOCIDDg4NCwoWGBwoMA8NAgwGFRccKiz//wAeAn4BDgMhAAMA1wEsAAD//wAe/w8A9QAQAAMA3AETAAD//wAeAo4BYwMAAAMA1AGBAAD//wAeAn4BDgMhAAMA1gEsAAD//wAeApsBLwLgAAMA2wFNAAAAAAABAAAA6AE3ABMAXgAHAAEAAAAAAAAAAAAAAAAABAABAAAAAAAAABkAJQAxAD0ASQBVAGEAhQC2AOEBJQFGAW8BhgGSAZ4BqgG2AcoB+AIQAh0CKQI1AkECTQJjAn4CjwKwAs4C2gMEAxADHAMoAzQDdQOBA6MDxwP6BCAEXwRxBJAEnASoBLQEwATUBPIFDgUlBTEFSQWBBY0FmQWlBbEFvQXJBh8GTQZ3BroG6wcvB10HaQd1B4EHjQexCA8IMAg8CEkIVQhhCG0IeQiFCJwItAjOCP8JIQktCVAJXAloCXQJgAnACcwJ+AolClYKdAquCvkLGws6C0YLUgteC2oLfgucC7UL0wvfC+sMAgxBDGkMlgy8DM4M+Q03DVINgg26Dc0OHg5TDmUOjA7EDt4O8A8oDzEPOg9DD1IPYg9yD4IPoA+vD8UP2w/nEAAQEBAuEEwQfRCTENERDhEaESgRNBFDEU8RfBGoEboRzBHsEgwSGRImEjMSQBJMElgSahJ8EqgStRLPEtgS8RLxEx8TXROfE9YUBxQrFEAUTRRnFHcUghSWFKoUthTdFOwU9BVAFV4VuBYLFiYWhRbYFyYXWReFF5IXphe5F98X9RgDGBEYIxhJGHUYghikGMoY2BjmGPgZHhlKGVMZXBllGW4ZdwAAAAEAAAAEM/fNCrF0Xw889QADA+gAAAAA1C4gUgAAAADUZuIj/Qz+nwVQBFAAAAAHAAIAAAAAAAACmgB7AQkAAAI9AAYCPQAGAj0ABgI9AAYCPQAGAj0ABgI9AAYDMP/0AmAAZAIwADcCMAA3AoQAZAKQABQCFwBkAhcAZAIXAGQCFwBkAhcAZAHrAGQCdwA3AqgAZAEnAGQBJwAbASf/7AEn//ABJwARATEABQJNAGQB8gBkAwoAPgKrAGQCqwBkArQANwK0ADcCtAA3ArQANwK0ADcCtAA3ArQANwJFAGQCRQBkArMANwJdAGQCIQAZAgUADwKWAFoClgBaApYAWgKWAFoClgBaAiwABgM6ABkCHAAFAiYABQImAAUCCgAeAiAALQIgAC0CIAAtAiAALQIgAC0CIAAtAiAALQNRAC0CUgBfAd4AOQHeADkCVgA+AjoAOQIhADkCIQA5AiEAOQIhADkCIQA5AU8ACgIIABkCSgBfARoATAEaAF8BGgAVARr/5wEa/+oBGgAfARj/9wEY//cCAABfASUAWgNZAF8CSgBfAkoAXwJIADkCSAA5AkgAOQJIADkCSAA5AkgAOQJIADkCUgBfAlIAXwJWAD4BggBfAdMAGQJRAF8BaQAJAkYAWgJGAFoCRgBaAkYAWgJGAFoB7AAKAs0AFAHlAAUB7AAKAewACgHsAAoBtQAZAfQAQQH0ADgCTABfAi4ANwGxACMB7wAZAfMADwIUACgB9QAaAhUANwG8ABkCJwAtAg0ALQGQAEEBkAA3AZAANAGQACoBkABBAZAANAGQAEEBkAA3AZAANACE/1kDpABBA6QAQQOkADQBtwAUAggAaQDwADIBRAAyAPAAMgDwACYC4gAyAPEAMwDxADMCBgAPAPAAMgHLAB4BywAeAY8APADbADwA8AAmAggAaQIIABEBQgAZAUIALQFCAEEBQgAyAUQAKAFEACgDFgAgAggAIAGTADwBkwA8Aj8ANwI2ADcBVAA3AVQANwGWACwBlgAoAOQALADkACgA5AAoAQkAAAHeADkCMAAdAhMAGQJAABkCCAAoAhgABQHzAD4B9AA+AfQASAH0AD4B9AA+AfQAMgH0ADIB9AA+AegAIwH0AD4CTABfAzoALQOEAHoD/ABGAtkAUQLeAFoCFQBGAyoAXAKBAEMDcgAjAgsANwGTAKABkwCgAhwAKAAA/p0AAP9hAAD+8gAA/vIAAP6WAAD+/gAA/pQAAP7RAAD/CwAA/p0AAP7yAAD+8gAA/pYAAP7+AAD+lAEsAB4BEwAeAYEAHgEsAB4BTQAeAAEAAAOn/vcAAAW0/Qz/WQVQAAEAAAAAAAAAAAAAAAAAAADoAAQCLgGQAAUAAAKKAlgAAABLAooCWAAAAV4AMgE8AAACCwUDBQAAAgAEAAAAAwAAAAAAAAAAAAAAAENUREIAwAAgIZIDp/73AAADpwEJAAAAAQAAAAACDwKxAAAAIAADAAAAAgAAAAMAAAAUAAMAAQAAABQABAHmAAAAGgAQAAMACgAvADkAfgD/IBQgGSAdICIgJiCsISIhkv//AAAAIAAwADoAoCATIBggHCAiICYgrCEiIZL//wAAAEkAAAAAAADgmuCU4HHgcOAN363fNgABABoAAAA2AL4BfAAAAAAAAAAAAAAAAAAAAAAAAQCXAJ0AmQC4AMcAygCeAKYApwCQALwAlQCqAJoAoACUAJ8AwgDAAMEAmwDJAAIACgALAA0ADwAUABUAFgAXABwAHQAeAB8AIAAiACkAKwAsAC0ALgAvADQANQA2ADcAOQCkAJEApQDTAKEA5gA6AEIAQwBFAEcATABNAE4ATwBVAFcAWABZAFoAXABjAGUAZgBnAGkAagBvAHAAcQByAHUAogDRAKMAxAC1AJgAtgC6ALcAuwDSAMwA5QDNAHYArADFAKsAzgDnANAAwwCKAIsA4wDGAMsAkgDkAIkAdwCtAI4AjQCPAJwABgADAAQACAAFAAcACQAMABMAEAARABIAGwAYABkAGgAOACEAJgAjACQAKAAlAL4AJwAzADAAMQAyADgAKgBoAD4AOwA8AEAAPQA/AEEARABLAEgASQBKAFQAUQBSAFMARgBbAGAAXQBeAGIAXwC/AGEAbgBrAGwAbQBzAGQAdACpAKgAAAAAAAcAWgADAAEECQAAAJwAAAADAAEECQABABIAnAADAAEECQACAA4ArgADAAEECQADADYAvAADAAEECQAEACIA8gADAAEECQAFABoBFAADAAEECQAGACABLgBEAGkAZwBpAHQAaQB6AGUAZAAgAGQAYQB0AGEAIABjAG8AcAB5AHIAaQBnAGgAdAAgADIAMAAxADIALQAyADAAMQA2ACwAIABUAGgAZQAgAE0AbwB6AGkAbABsAGEAIABGAG8AdQBuAGQAYQB0AGkAbwBuACAAYQBuAGQAIABUAGUAbABlAGYAbwBuAGkAYwBhACAAUwAuAEEALgBGAGkAcgBhACAAUwBhAG4AcwBSAGUAZwB1AGwAYQByADQALgAyADAAMwA7AEMAVABEAEIAOwBGAGkAcgBhAFMAYQBuAHMALQBSAGUAZwB1AGwAYQByAEYAaQByAGEAIABTAGEAbgBzACAAUgBlAGcAdQBsAGEAcgBWAGUAcgBzAGkAbwBuACAANAAuADIAMAAzAEYAaQByAGEAUwBhAG4AcwAtAFIAZQBnAHUAbABhAHIAAwAAAAAAAP+1ADIAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAH//wAPAAEAAAAMAAAAAAAAAAIABQACAE8AAQBRAFUAAQBXAHcAAQC2ALwAAQC+ANMAAQAAAAEAAAAKABwAHgABREZMVAAIAAQAAAAA//8AAAAAAAAAAQAAAAoAMgA0AARERkxUABpjeXJsACRncmVrACRsYXRuACQABAAAAAD//wAAAAAAAAAAAAAAAA==",
  f500: "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",
  f600: "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",
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
  renovacion: "Renovación",
  desvinculacion: "Desvinculación"
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
var TIPO_RENOVACION_LABELS = {
  plazo: "A plazo",
  obra_faena: "Por obra o faena",
  indefinido: "Pasa a indefinido"
};
function pesos(n) {
  const v = Number(n);
  if (isNaN(v)) return String(n ?? "—");
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
        ["Sueldo líquido pactado", d.sueldo_liquido != null ? pesos(d.sueldo_liquido) : null],
        ["Tipo de contrato", d.tipo_contrato],
        ["Plazo", d.plazo],
        ["Turno", d.turno],
        ["Horario de colación", d.colacion],
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
        ["Sueldo líquido actual", d.sueldo_liquido_actual != null ? pesos(d.sueldo_liquido_actual) : null],
        ["Nuevo sueldo líquido", d.nuevo_sueldo_liquido != null ? pesos(d.nuevo_sueldo_liquido) : null],
        ["Bono nocturno", !d.bono_nocturno ? null : d.bono_nocturno.aplica ? `Sí (${d.bono_nocturno.porcentaje ?? "—"} · ${d.bono_nocturno.periodo ?? "—"})` : "No"],
        ["Bono trato", !d.bono_trato ? null : d.bono_trato.aplica ? `Sí (${d.bono_trato.monto != null ? pesos(d.bono_trato.monto) : "—"} · ${d.bono_trato.dias_asignacion ?? "—"} días)` : "No"]
      ];
      break;
    case "aumento_sueldo":
      pares = [
        ["Monto del aumento", d.monto_aumento != null ? pesos(d.monto_aumento) : null],
        ["Sueldo líquido actual", d.sueldo_actual != null ? pesos(d.sueldo_actual) : null],
        ["Nuevo sueldo líquido", d.sueldo_nuevo != null ? pesos(d.sueldo_nuevo) : null],
        ["Fecha efectiva", d.fecha_efectiva],
        ["Motivo", d.motivo]
      ];
      break;
    case "bono":
      pares = [
        ["Tipo de bono", d.tipo_bono],
        ["Monto", d.monto != null ? pesos(d.monto) : null],
        ["Período / fecha", d.periodo],
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
        ["Fecha de término actual", d.fecha_termino_actual],
        ["Tipo de renovación", TIPO_RENOVACION_LABELS[d.tipo_renovacion] ?? d.tipo_renovacion],
        ["Fecha de culminación", d.tipo_renovacion === "plazo" ? d.nueva_fecha_termino : null],
        ["Hito de la obra", d.tipo_renovacion === "obra_faena" ? d.hito_obra : null],
        ["Motivo", d.motivo]
      ] : [
        // renovaciones anteriores a oct. 2026 (sin tipo_renovacion)
        ["Fecha de término actual", d.fecha_termino_actual],
        ["Nueva condición", d.indefinido ? "Pasa a indefinido (sin fecha de término)" : null],
        ["Nueva fecha de término", d.indefinido ? null : d.nueva_fecha_termino],
        ["Nuevo plazo", d.indefinido ? null : d.nuevo_plazo],
        ["Motivo", d.motivo]
      ];
      break;
    case "desvinculacion":
      pares = [
        ["Causal", d.causal],
        ["Fecha de desvinculación", d.fecha_desvinculacion],
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
      if (cErr || !contrat) return json({ error: "Contratación no encontrada." }, 404);
      const { data: solIngreso } = await admin.from("solicitudes").select("id, codigo, folio, centro_origen_id, detalle").eq("id", contrat.solicitud_id).single();
      if (!solIngreso) return json({ error: "La solicitud de esta contratación ya no existe." }, 404);
      const { data: centro } = await admin.from("centros_costo").select("id, codigo, nombre, prevencionista_id").eq("id", solIngreso.centro_origen_id).single();
      if (!centro?.prevencionista_id) {
        return json({ ok: true, skipped: true, reason: "centro sin prevencionista asignado" });
      }
      const { data: prev } = await admin.from("perfiles").select("email, nombre, activo").eq("id", centro.prevencionista_id).single();
      if (!prev?.email || prev.activo === false) {
        return json({ ok: true, skipped: true, reason: "prevencionista sin correo o inactivo" });
      }
      const token = await graphToken();
      await graphSend(
        token,
        prev.email,
        `Nueva contratación para homologar — ${contrat.nombre_candidato}`,
        correoContratacionIniciada(prev.nombre ?? "", contrat, solIngreso, centro, appUrl)
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
      const token = await graphToken();
      if (type === "rrhh_cerrado") {
        await graphSend(
          token,
          s.email,
          `RRHH ya procesó tu solicitud ${sol2.codigo}`,
          correoRrhhCerrado(s.nombre ?? "", sol2, nombre, appUrl)
        );
      } else {
        await graphSend(
          token,
          s.email,
          `${nombre || "El trabajador"} ya puede ingresar a la obra — solicitud ${sol2.codigo}`,
          correoHomologacionAutorizada(s.nombre ?? "", sol2, nombre, appUrl)
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
      if (!ultimo) return json({ error: "No se encontró el rechazo." }, 404);
      let countQ = admin.from("homologacion_rechazos").select("id", { count: "exact", head: true });
      countQ = contratacion_id ? countQ.eq("contratacion_id", contratacion_id) : countQ.eq("solicitud_id", solicitud_id);
      const { count: totalRechazos } = await countQ;
      const { data: docsMarcados } = await admin.from("homologacion_rechazo_documentos").select("checklist_item_id").eq("rechazo_id", ultimo.id);
      let nombresDocs = [];
      if (docsMarcados?.length) {
        const { data: items } = await admin.from("documentos_checklist").select("id, nombre").in("id", docsMarcados.map((d) => d.checklist_item_id));
        nombresDocs = (items ?? []).map((i) => i.nombre);
      }
      const { data: rechazadoPor } = await admin.from("perfiles").select("nombre").eq("id", ultimo.rechazado_por).single();
      const { data: solicitante } = await admin.from("perfiles").select("nombre, email, activo").eq("id", sol2.solicitante_id).single();
      const token = await graphToken();
      let enviados = 0;
      if (solicitante?.email && solicitante.activo !== false) {
        await graphSend(
          token,
          solicitante.email,
          `Se rechazó la homologación de tu solicitud ${sol2.codigo}`,
          correoHomologacionRechazada(solicitante.nombre ?? "", sol2, nombre, ultimo, totalRechazos ?? 1, appUrl)
        );
        enviados++;
      }
      const { data: gerentesPrevencion } = await admin.from("perfiles").select("nombre, email").eq("es_gerente_prevencion", true).eq("activo", true);
      for (const g of gerentesPrevencion ?? []) {
        if (!g.email) continue;
        await graphSend(
          token,
          g.email,
          `Rechazo de homologación — solicitud ${sol2.codigo}`,
          correoHomologacionRechazadaGerente(g.nombre ?? "", sol2, nombre, ultimo, rechazadoPor?.nombre ?? "", nombresDocs, totalRechazos ?? 1, appUrl)
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
            `Revisar documento(s) — homologación rechazada, solicitud ${sol2.codigo}`,
            correoHomologacionRechazadaRRHH(r.nombre ?? "", sol2, nombre, ultimo, nombresDocs, appUrl)
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
      const { data: sol2 } = await admin.from("solicitudes").select("id, codigo, folio, solicitante_id").eq("id", recl.solicitud_id).single();
      if (!sol2) return json({ error: "La solicitud de este proceso ya no existe." }, 404);
      const { count: pendientes } = await admin.from("reclutamiento_candidatos").select("id", { count: "exact", head: true }).eq("reclutamiento_id", reclutamiento_id).eq("decision", "pendiente");
      const { data: s } = await admin.from("perfiles").select("nombre, email, activo").eq("id", sol2.solicitante_id).single();
      if (!s?.email || s.activo === false) {
        return json({ ok: true, skipped: true, reason: "solicitante sin correo o inactivo" });
      }
      const token = await graphToken();
      await graphSend(
        token,
        s.email,
        `Candidatos para tu solicitud ${sol2.codigo}`,
        correoReclutamientoOpciones(s.nombre ?? "", sol2, pendientes ?? 0, appUrl)
      );
      return json({ ok: true, enviados: 1 });
    }
    if (type === "reclutamiento_elegido" || type === "reclutamiento_todos_rechazados") {
      if (!reclutamiento_id) return json({ error: "Falta reclutamiento_id." }, 400);
      const { data: recl } = await admin.from("reclutamientos").select("id, solicitud_id, contratacion_id").eq("id", reclutamiento_id).single();
      if (!recl) return json({ error: "Proceso de reclutamiento no encontrado." }, 404);
      const { data: sol2 } = await admin.from("solicitudes").select("id, codigo, folio").eq("id", recl.solicitud_id).single();
      if (!sol2) return json({ error: "La solicitud de este proceso ya no existe." }, 404);
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
            `Candidato elegido — solicitud ${sol2.codigo}`,
            correoReclutamientoElegido(r.nombre ?? "", sol2, candidatoNombre, appUrl)
          );
          enviados++;
        }
      } else {
        for (const r of rrhh ?? []) {
          if (!r.email) continue;
          await graphSend(
            token,
            r.email,
            `Se rechazaron todos los candidatos — solicitud ${sol2.codigo}`,
            correoReclutamientoTodosRechazados(r.nombre ?? "", sol2, appUrl)
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
    if (type === "pendiente_aprobador") {
      if (sol.estado !== "pendiente") {
        return json({ ok: true, skipped: true, reason: `estado ${sol.estado}` });
      }
      const { data: aprs } = await admin.from("aprobaciones").select("aprobador_id, orden, decision").eq("solicitud_id", solicitud_id);
      const pendientes = (aprs ?? []).filter((a) => a.decision === "pendiente");
      if (!pendientes.length) return json({ ok: true, skipped: true, reason: "sin aprobadores pendientes" });
      const minOrden = Math.min(...pendientes.map((a) => a.orden));
      const ids = [...new Set(pendientes.filter((a) => a.orden === minOrden).map((a) => a.aprobador_id))];
      const { data: perfiles } = await admin.from("perfiles").select("email, nombre, activo").in("id", ids);
      const token = await graphToken();
      let enviados = 0;
      for (const p of perfiles ?? []) {
        if (!p.email || p.activo === false) continue;
        await graphSend(
          token,
          p.email,
          `Solicitud ${sol.codigo} pendiente de tu aprobación`,
          correoPendiente(p.nombre ?? "", sol, appUrl)
        );
        enviados++;
      }
      return json({ ok: true, enviados });
    }
    if (type === "cambio_estado") {
      if (sol.estado !== "aprobada" && sol.estado !== "rechazada") {
        return json({ ok: true, skipped: true, reason: `estado ${sol.estado} no notificable` });
      }
      const { data: centros } = await admin.from("centros_costo").select("id, codigo, nombre");
      const cmap = new Map((centros ?? []).map((c) => [c.id, c]));
      const { data: aprs } = await admin.from("aprobaciones").select("aprobador_id, decision, decidido_at, asignado_at, orden, tiempo_respuesta").eq("solicitud_id", solicitud_id).order("orden");
      const aprIds = (aprs ?? []).map((a) => a.aprobador_id);
      const { data: pers } = await admin.from("perfiles").select("id, nombre, email").in("id", [sol.solicitante_id, ...aprIds]);
      const pmap = new Map((pers ?? []).map((p) => [p.id, p]));
      let trabNombre = null;
      if (sol.trabajador_id) {
        const { data: t } = await admin.from("trabajadores").select("nombre").eq("id", sol.trabajador_id).single();
        trabNombre = t?.nombre ?? null;
      }
      const token = await graphToken();
      if (sol.estado === "rechazada") {
        const s = pmap.get(sol.solicitante_id);
        if (s?.email) {
          await graphSend(
            token,
            s.email,
            `Tu solicitud ${sol.codigo} fue rechazada`,
            correoEstado(s.nombre ?? "", sol, appUrl)
          );
        }
        return json({ ok: true, enviados: s?.email ? 1 : 0 });
      }
      const pdfBytes = await construirComprobantePdf({ sol, cmap, aprs: aprs ?? [], pmap, trabNombre });
      const pdfB64 = encodeBase64(pdfBytes);
      const { data: rrhh } = await admin.from("perfiles").select("id, nombre, email").eq("rol", "rrhh").eq("activo", true);
      const dest = /* @__PURE__ */ new Map();
      const add = (p) => {
        if (p?.email) dest.set(p.email, p.nombre ?? "");
      };
      add(pmap.get(sol.solicitante_id));
      (aprs ?? []).forEach((a) => add(pmap.get(a.aprobador_id)));
      (rrhh ?? []).forEach((r) => add(r));
      const adjuntos = [{ name: `${sol.folio || sol.codigo}.pdf`, b64: pdfB64 }];
      let enviados = 0;
      for (const [email, nombre] of dest) {
        await graphSend(
          token,
          email,
          `Solicitud ${sol.codigo} aprobada — respaldo`,
          correoAprobada(nombre, sol, appUrl),
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
async function graphSend(token, to, subject, html, adjuntos = []) {
  const sender = Deno.env.get("GRAPH_FROM_ADDRESS");
  const attachments = [
    {
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: "metalium-logo.png",
      contentType: "image/png",
      contentBytes: LOGO_METALIUM_PNG_B64,
      contentId: LOGO_CID,
      isInline: true
    },
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
var AZUL = "#1B9BD8";
var NAVY = "#1B2340";
var GRIS_ETIQUETA = "#8791AA";
var GRIS_TEXTO = "#3D4258";
var FUENTE = "'Segoe UI', Arial, Helvetica, sans-serif";
function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function shell(inner) {
  return `<div style="background:#eef1f5;padding:32px 16px;font-family:${FUENTE}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e7ee;border-radius:10px">
      <tr><td style="height:6px;line-height:6px;font-size:0;background:${AZUL};border-radius:10px 10px 0 0">&nbsp;</td></tr>
      <tr><td style="padding:26px 32px 16px">
        <img src="cid:metalium-logo" width="140" height="29" alt="Metalium" style="display:block;width:140px;height:29px;border:0" />
        <div style="margin-top:12px;font-size:11px;font-weight:700;letter-spacing:1px;color:${GRIS_ETIQUETA};text-transform:uppercase">Sistema de Gestión Integrado</div>
      </td></tr>
      <tr><td style="padding:0 32px"><div style="border-top:1px solid #edf0f4"></div></td></tr>
      <tr><td style="padding:22px 32px 4px;color:${GRIS_TEXTO};font-size:14.5px;line-height:1.6">${inner}</td></tr>
      <tr><td style="padding:22px 32px 28px">
        <div style="border-top:1px solid #edf0f4;padding-top:16px;font-size:11.5px;color:#9aa2b3;line-height:1.6">
          Metalium SpA · Solicitud de Servicio Interno Recursos Humanos - Homologación (SSI-RRHH-SST).<br/>
          Este es un correo automático -- no hace falta responderlo.
        </div>
      </td></tr>
    </table>
  </div>`;
}
var ORIGEN_PERMITIDO = /^(https:\/\/([a-z0-9-]+\.)*(vercel\.app|metalium\.cl)|http:\/\/localhost(:\d+)?)$/i;
function urlApp(req) {
  const env = (Deno.env.get("APP_URL") || "").trim().replace(/\/+$/, "");
  if (env) return env;
  const origin = (req.headers.get("Origin") || "").trim().replace(/\/+$/, "");
  return ORIGEN_PERMITIDO.test(origin) ? origin : "";
}
function boton(appUrl, txt, vista = "") {
  if (!appUrl) return "";
  const href = vista ? `${appUrl}/?ir=${encodeURIComponent(vista)}` : `${appUrl}/`;
  return `<div style="text-align:center;margin:24px 0 4px">
    <a href="${href}" style="display:inline-block;background:${AZUL};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">${txt}</a>
  </div>`;
}
function infoCard(filas) {
  const tr = filas.filter(([, v]) => v != null && v !== "").map(([k, v]) => `<tr>
        <td style="padding:5px 0;color:${GRIS_ETIQUETA};font-size:12.5px;font-weight:700;white-space:nowrap;vertical-align:top">${k}</td>
        <td style="padding:5px 0 5px 14px;color:${NAVY};font-size:13.5px;font-weight:600">${v}</td>
      </tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 6px;background:#f6f9fc;border-left:3px solid ${AZUL};border-radius:0 6px 6px 0">
    <tr><td style="padding:14px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tr}</table>
    </td></tr>
  </table>`;
}
function badge(texto, bg, fg) {
  return `<span style="display:inline-block;background:${bg};color:${fg};padding:3px 11px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.2px">${texto}</span>`;
}
var VERDE_BG = "#e5f6ea";
var VERDE_FG = "#1a7f37";
var ROJO_BG = "#fbe9e9";
var ROJO_FG = "#b91c1c";
function correoPendiente(nombre, sol, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">Tienes una solicitud pendiente de tu aprobación.</p>
    ${infoCard([["Tipo", tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ["N° de solicitud", sol.codigo], ["Folio", sol.folio]])}
    ${boton(appUrl, "Ir a mi bandeja", "bandeja")}`);
}
function correoEstado(nombre, sol, appUrl) {
  const aprobada = sol.estado === "aprobada";
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">Tu solicitud quedó ${badge(aprobada ? "Aprobada" : "Rechazada", aprobada ? VERDE_BG : ROJO_BG, aprobada ? VERDE_FG : ROJO_FG)}.</p>
    ${infoCard([["Tipo", tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ["N° de solicitud", sol.codigo], ["Folio", sol.folio]])}
    ${boton(appUrl, "Ver mis solicitudes", "mis-solicitudes")}`);
}
function correoAprobada(nombre, sol, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">La solicitud quedó ${badge("Aprobada", VERDE_BG, VERDE_FG)}. Adjuntamos el comprobante en PDF con el detalle de lo aprobado.</p>
    ${infoCard([["Tipo", tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ["N° de solicitud", sol.codigo], ["Folio", sol.folio]])}
    ${boton(appUrl, "Ir a SSI-RRHH")}`);
}
function correoRrhhCerrado(nombre, sol, nombreEspecifico, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">RRHH ya terminó de procesar tu solicitud${nombreEspecifico ? ` de <b>${nombreEspecifico}</b>` : ""}.</p>
    ${infoCard([["Tipo", tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ["N° de solicitud", sol.codigo], ["Folio", sol.folio]])}
    ${boton(appUrl, "Ver mis solicitudes", "mis-solicitudes")}`);
}
function correoHomologacionAutorizada(nombre, sol, nombreEspecifico, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">El proceso de homologación de tu solicitud terminó: ${nombreEspecifico ? `<b>${nombreEspecifico}</b>` : "el trabajador"} ya está autorizado para ingresar a la obra.</p>
    ${infoCard([["Tipo", tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ["N° de solicitud", sol.codigo], ["Folio", sol.folio]])}
    ${boton(appUrl, "Ver mis solicitudes", "mis-solicitudes")}`);
}
function correoHomologacionRechazada(nombre, sol, nombreEspecifico, rechazo, totalRechazos, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">Prevención rechazó la homologación de tu solicitud${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ""}: ${badge("Rechazada", ROJO_BG, ROJO_FG)}</p>
    <p style="margin:12px 0 0"><b>Motivo:</b> ${escHtml(rechazo.motivo)}</p>
    ${infoCard([
    ["Tipo", tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())],
    ["N° de solicitud", sol.codigo],
    ["Folio", sol.folio],
    ["N° de rechazos", String(totalRechazos)]
  ])}
    <p style="margin:12px 0 0;font-size:13px;color:${GRIS_ETIQUETA}">El plazo de homologación de este caso se extiende automáticamente por cada rechazo.</p>
    ${boton(appUrl, "Ver mis solicitudes", "mis-solicitudes")}`);
}
function correoHomologacionRechazadaGerente(nombre, sol, nombreEspecifico, rechazo, rechazadoPorNombre, nombresDocs, totalRechazos, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">${escHtml(rechazadoPorNombre) || "Un prevencionista"} rechazó una homologación${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ""}.</p>
    <p style="margin:12px 0 0"><b>Motivo:</b> ${escHtml(rechazo.motivo)}</p>
    ${infoCard([
    ["Tipo", tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())],
    ["N° de solicitud", sol.codigo],
    ["Folio", sol.folio],
    ["Documento(s) marcado(s)", nombresDocs.length ? nombresDocs.map((n) => escHtml(n)).join(", ") : "Ninguno"],
    ["N° de rechazos de este caso", String(totalRechazos)]
  ])}
    ${boton(appUrl, "Ir a Homologación SST", "homologacion")}`);
}
function correoHomologacionRechazadaRRHH(nombre, sol, nombreEspecifico, rechazo, nombresDocs, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">Prevención rechazó la homologación${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ""} por un problema con ${nombresDocs.length === 1 ? "este documento" : "estos documentos"}:</p>
    <p style="margin:8px 0 0"><b>${nombresDocs.map((n) => escHtml(n)).join(", ")}</b></p>
    <p style="margin:12px 0 0"><b>Motivo:</b> ${escHtml(rechazo.motivo)}</p>
    ${infoCard([
    ["Tipo", tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())],
    ["N° de solicitud", sol.codigo],
    ["Folio", sol.folio]
  ])}
    <p style="margin:12px 0 0;font-size:13px;color:${GRIS_ETIQUETA}">Corrige o reemplaza el/los documento(s) -- Prevención vuelve a revisar el caso desde ahí.</p>
    ${boton(appUrl, nombreEspecifico ? "Ir a Contratación" : "Ir a Solicitudes", nombreEspecifico ? "contrataciones" : "solicitudes")}`);
}
function correoContratacionIniciada(nombre, contrat, sol, centro, appUrl) {
  const CANAL_LABELS = { recomendacion: "Recomendación", reclutamiento_seleccion: "Reclutamiento y selección" };
  const TIPO_TRAB_LABELS = { administrativo: "Administrativo", operativo: "Operativo" };
  const cargo = sol.detalle?.cargo || "—";
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">RRHH inició una contratación en tu centro de costo. Puedes empezar la homologación SST a medida que se vaya subiendo la documentación.</p>
    ${infoCard([
    ["Candidato", contrat.nombre_candidato],
    ["Cargo", cargo],
    ["Centro de costo", centro?.nombre],
    ["Canal", CANAL_LABELS[contrat.canal] ?? contrat.canal],
    ["Tipo de trabajador", TIPO_TRAB_LABELS[contrat.tipo_trabajador] ?? contrat.tipo_trabajador],
    ["Solicitud", sol.folio || sol.codigo]
  ])}
    ${boton(appUrl, "Ir a Homologación SST", "homologacion")}`);
}
function correoReclutamientoOpciones(nombre, sol, cantidad, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">RRHH envió ${cantidad} candidato${cantidad === 1 ? "" : "s"} para tu solicitud de ingreso. Revísalos y elige uno, o recházalos si ninguno calza.</p>
    ${infoCard([["N° de solicitud", sol.codigo], ["Folio", sol.folio]])}
    ${boton(appUrl, "Ver candidatos", "mis-solicitudes")}`);
}
function correoReclutamientoElegido(nombre, sol, candidatoNombre, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">El solicitante eligió a ${candidatoNombre ? `<b>${escHtml(candidatoNombre)}</b>` : "un candidato"} para la solicitud ${sol.codigo}. Ya se creó la contratación -- continúa el proceso desde ahí.</p>
    ${infoCard([["N° de solicitud", sol.codigo], ["Folio", sol.folio]])}
    ${boton(appUrl, "Ir a Contratación", "contrataciones")}`);
}
function correoReclutamientoTodosRechazados(nombre, sol, appUrl) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">El solicitante rechazó a todos los candidatos enviados para la solicitud ${sol.codigo}. Agrega una nueva tanda de candidatos desde Contratación: el plazo de reclutamiento (${DIAS_HABILES_RECLUTAMIENTO} días hábiles) vuelve a correr desde este rechazo.</p>
    ${infoCard([["N° de solicitud", sol.codigo], ["Folio", sol.folio]])}
    ${boton(appUrl, "Ir a Contratación", "contrataciones")}`);
}
function aChile(f) {
  return new Date(new Date(f).toLocaleString("en-US", { timeZone: "America/Santiago" }));
}
function nivelEspera(desde, ahora = /* @__PURE__ */ new Date()) {
  const horas = Math.max(0, (ahora.getTime() - new Date(desde).getTime()) / 36e5);
  const dias = diasHabilesEntre(aChile(desde), aChile(ahora));
  const nivel = dias >= ESPERA_DIAS_CRITICA ? "critica" : dias >= ESPERA_DIAS_ATRASADA ? "atrasada" : "al_dia";
  const h = Math.floor(horas);
  const texto = dias >= 1 ? `${dias} día${dias === 1 ? "" : "s"} hábil${dias === 1 ? "" : "es"}` : horas < 1 ? "menos de 1 hora" : `${h} hora${h === 1 ? "" : "s"}`;
  return { dias, horas, nivel, texto };
}
var fechaHoraCL = (f) => new Date(f).toLocaleString("es-CL", {
  timeZone: "America/Santiago",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});
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
  if (!yo || yo.activo === false) return json({ error: "Tu cuenta no está activa." }, 403);
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
    if (!items.length) return json({ error: "Este aprobador no tiene solicitudes esperando su decisión en este momento." }, 400);
    objetivos = [{ aprobadorId: aprobador_id, items }];
  } else {
    const { data: s } = await admin.from("solicitudes").select(SOL_FIELDS).eq("id", solicitud_id).single();
    if (!s) return json({ error: "Solicitud no encontrada." }, 404);
    if (s.solicitante_id !== userId && !esGestion) {
      return json({ error: "Solo quien creó la solicitud (o RRHH / el administrador) puede enviar este recordatorio." }, 403);
    }
    if (s.estado !== "pendiente") return json({ error: "Esta solicitud ya no está pendiente de aprobación." }, 400);
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
        error: `Ya se le envió un recordatorio a ${nombreApr} ${cuandoCL(choca.created_at)}${quien?.nombre ? ` (lo pidió ${quien.nombre})` : ""}. Podrás enviar otro ${cuandoCL(proximo)}.`,
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
    const quien = s.tipo === "ingreso" ? `${s.detalle?.cargo || "Cargo"} × ${s.detalle?.cantidad || 1}` : tmap.get(s.trabajador_id) || "Trabajador";
    const centro = cmap.get(s.centro_origen_id);
    return centro ? `${quien} · ${centro}` : quien;
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
      solicitante: pmap.get(i.sol.solicitante_id)?.nombre || "—"
    })).sort((a, b) => new Date(a.desde).getTime() - new Date(b.desde).getTime());
    const { asunto, html } = correoRecordatorio(apr.nombre ?? "", filas, pedidoPor, origen, appUrl);
    await graphSend(token, apr.email, asunto, html);
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
    return json({ error: `${sinCorreo.join(", ")} no tiene correo registrado o su cuenta está inactiva.` }, 400);
  }
  return json({ ok: true, enviados: destinatarios.length, destinatarios, sin_correo: sinCorreo });
}
var NIVEL_ESTILO = {
  al_dia: { etiqueta: "Al día", bg: "#e0f2fe", fg: "#0369a1" },
  atrasada: { etiqueta: "Atrasada", bg: "#fef3c7", fg: "#92400e" },
  critica: { etiqueta: "Crítica", bg: ROJO_BG, fg: ROJO_FG }
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
    asunto = nivel === "critica" ? `Urgente: la solicitud ${peor.sol.codigo} lleva ${peor.espera.texto} esperando tu aprobación` : `Recordatorio: la solicitud ${peor.sol.codigo} espera tu aprobación`;
    intro = `<b>${escHtml(pedidoPor.nombre)}</b> te pide revisar su solicitud <b>${codigo}</b>, que lleva <b>${espera}</b> esperando tu aprobación.`;
  } else if (nivel === "critica") {
    asunto = `Urgente: ${n} ${plural} esperan tu aprobación hace ${peor.espera.texto}`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobación y la más antigua ya lleva <b>${espera}</b>.`;
  } else if (nivel === "atrasada") {
    asunto = `Recordatorio: ${n} ${plural} esperan tu aprobación (${peor.espera.texto})`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobación; la más antigua lleva <b>${espera}</b>.`;
  } else {
    asunto = `Recordatorio: tienes ${n} ${plural} por aprobar`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobación en SSI-RRHH.`;
  }
  const cierre = nivel === "critica" ? `Es urgente: ${n === 1 ? "la solicitud no avanza" : "las solicitudes no avanzan"} hasta que decidas, y una vez aprobada${n === 1 ? "" : "s"} RRHH todavía necesita hasta ${DIAS_HABILES_PROCESO_RRHH} días hábiles para procesarla${n === 1 ? "" : "s"}.` : nivel === "atrasada" ? `Te pedimos revisar${n === 1 ? "la" : "las"} a la brevedad: hasta que decidas, ${n === 1 ? "la solicitud no avanza" : "no avanzan"}.` : `Mientras antes ${n === 1 ? "la revises" : "las revises"}, antes puede seguir el proceso.`;
  const color2 = (nv) => NIVEL_ESTILO[nv].fg;
  const tr = filas.map((f) => `
    <tr>
      <td style="padding:8px 8px 8px 0;border-top:1px solid #edf0f4;vertical-align:top">
        <div style="font-weight:700;color:${NAVY};font-size:13px">${escHtml(f.sol.codigo || "—")}</div>
        <div style="color:${GRIS_ETIQUETA};font-size:11.5px">${escHtml(tipoTxt(f.sol.tipo).replace(/^./, (c) => c.toUpperCase()))}</div>
      </td>
      <td style="padding:8px;border-top:1px solid #edf0f4;vertical-align:top;font-size:12.5px;color:${GRIS_TEXTO}">
        ${escHtml(f.detalle)}<div style="color:${GRIS_ETIQUETA};font-size:11.5px">Solicita: ${escHtml(f.solicitante)}</div>
      </td>
      <td style="padding:8px 0 8px 8px;border-top:1px solid #edf0f4;vertical-align:top;text-align:right;white-space:nowrap">
        <div style="font-weight:700;color:${color2(f.espera.nivel)};font-size:13px">${escHtml(f.espera.texto)}</div>
        <div style="color:${GRIS_ETIQUETA};font-size:11px">desde ${escHtml(fechaHoraCL(f.desde))}</div>
      </td>
    </tr>`).join("");
  const html = shell(`
    <p style="margin:0 0 4px">Hola ${escHtml(nombre)},</p>
    <p style="margin:0">${intro} ${badge(est.etiqueta, est.bg, est.fg)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 6px">
      <tr>
        <td style="padding:0 8px 6px 0;color:${GRIS_ETIQUETA};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Solicitud</td>
        <td style="padding:0 8px 6px;color:${GRIS_ETIQUETA};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Detalle</td>
        <td style="padding:0 0 6px 8px;color:${GRIS_ETIQUETA};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:right">Esperando</td>
      </tr>
      ${tr}
    </table>
    <p style="margin:12px 0 0">${cierre}</p>
    ${boton(appUrl, "Ir a mi bandeja", "bandeja")}
    <p style="margin:16px 0 0;font-size:12px;color:${GRIS_ETIQUETA}">Recordatorio enviado a pedido de ${escHtml(pedidoPor.nombre)} (${escHtml(pedidoPor.rol)}).</p>`);
  return { asunto, html };
}
