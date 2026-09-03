/**
 * Gráficos SVG mínimos, sin dependencias externas.
 *
 * Tres formas, cada una elegida por el trabajo que hace el dato:
 *   - lineaTemporal ....... tendencia en el tiempo (1 o 2 series)
 *   - smallMultiples ...... la misma tendencia repetida por dimensión
 *   - barrasDivergentes ... posición respecto de un cero (brechas)
 *   - sparkline ........... micro-tendencia dentro de un KPI
 *
 * Reglas de forma que se respetan acá y no conviene tocar sin motivo:
 *   · un solo eje Y por gráfico (nunca dos escalas en un mismo plot)
 *   · líneas de 2px, marcadores de r>=4 con anillo de 2px del color del fondo
 *   · grilla y ejes en hairline sólido (nunca punteado), recesivos
 *   · etiquetas directas solo en el extremo / el punto que importa
 *   · el color lo llevan las marcas; los textos usan tokens de texto
 *   · todo gráfico trae tooltip en hover Y foco de teclado, y además una
 *     tabla equivalente — el tooltip nunca es la única forma de leer un valor
 *
 * La paleta salió del validador de contraste/daltonismo contra fondo #fff:
 *   #009BDB (acento Metalium) y #eb6834 pasan las 6 verificaciones como par
 *   categórico; #0078b0 / #d03b3b son los polos divergentes con gris neutro
 *   al medio. No cambiar estos hex "a ojo".
 */

export const VIZ = {
  serie1: "#009BDB", // Evaluador / serie principal
  serie2: "#eb6834", // Autoevaluación
  posPolo: "#0078b0", // brecha a favor (evaluador por sobre autoevaluación)
  negPolo: "#d03b3b", // brecha en contra
  neutro: "#94a3b8", // contexto / de-énfasis
  grid: "#e3e8ef",
  eje: "#cbd2dc",
  tinta: "#0f172a",
  tintaM: "#5a6b85",
  tintaS: "#8b97ad",
  fondo: "#ffffff",
};

let uid = 0;
const nextId = () => `viz${++uid}`;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const num = (v, dec = 2) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(dec).replace(/\.?0+$/, ""));

/** Etiqueta de eje: abrevia antes de truncar, porque el año (lo que está al
 *  final) es justo el dato que distingue un ciclo de otro. */
function etiquetaEje(texto, limite = 20) {
  let t = String(texto ?? "")
    .replace(/\bsemestre\b/gi, "sem.")
    .replace(/\bextraordinaria\b/gi, "extraord.")
    .replace(/\bperiodo de prueba\b/gi, "p. prueba")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > limite) t = `${t.slice(0, limite - 1)}…`;
  return t;
}

/** Tooltip único y reutilizable. Se rellena con textContent — los nombres de
 *  serie y categoría vienen de la BD y no se interpolan como HTML. */
function tooltipSingleton() {
  let el = document.getElementById("viz-tooltip");
  if (!el) {
    el = document.createElement("div");
    el.id = "viz-tooltip";
    el.className = "viz-tooltip";
    el.setAttribute("role", "status");
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

function mostrarTooltip(filas, titulo, x, y) {
  const tip = tooltipSingleton();
  tip.textContent = "";

  const h = document.createElement("div");
  h.className = "viz-tooltip-title";
  h.textContent = titulo;
  tip.appendChild(h);

  for (const f of filas) {
    const row = document.createElement("div");
    row.className = "viz-tooltip-row";

    const key = document.createElement("span");
    key.className = "viz-tooltip-key";
    key.style.background = f.color;
    row.appendChild(key);

    // El valor manda, el nombre de la serie acompaña.
    const val = document.createElement("strong");
    val.textContent = f.valor;
    row.appendChild(val);

    const nom = document.createElement("span");
    nom.className = "viz-tooltip-serie";
    nom.textContent = f.nombre;
    row.appendChild(nom);

    tip.appendChild(row);
  }

  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  const margen = 12;
  let left = x + margen;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - margen;
  let top = y - r.height - margen;
  if (top < 8) top = y + margen;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${top}px`;
}

function ocultarTooltip() {
  const tip = document.getElementById("viz-tooltip");
  if (tip) tip.hidden = true;
}

// ---------------------------------------------------------------------------
// Línea temporal
// ---------------------------------------------------------------------------

/**
 * @param {object} cfg
 * @param {string[]} cfg.etiquetas       Etiqueta de cada punto en X (ciclos)
 * @param {{nombre:string,color:string,valores:(number|null)[]}[]} cfg.series
 * @param {[number,number]} [cfg.rangoY] Por defecto [1,5] (la escala de notas)
 * @param {number[]} [cfg.ticksY]
 * @param {{valor:number,texto:string}} [cfg.referencia] Línea de contexto (ej: 3 = "Cumple")
 * @param {number} [cfg.alto]
 * @returns {string} SVG como string; hay que llamar a activarInteraccion() después
 */
export function lineaTemporal(cfg) {
  const {
    etiquetas,
    series,
    rangoY = [1, 5],
    ticksY = [1, 2, 3, 4, 5],
    referencia = null,
    alto = 300,
    ancho = 1000,
  } = cfg;

  const id = nextId();
  const m = { top: 18, right: 74, bottom: 40, left: 34 };
  const pw = ancho - m.left - m.right;
  const ph = alto - m.top - m.bottom;
  const n = etiquetas.length;

  const px = (i) => (n === 1 ? m.left + pw / 2 : m.left + (i * pw) / (n - 1));
  const py = (v) => m.top + ph - ((v - rangoY[0]) / (rangoY[1] - rangoY[0])) * ph;

  const grid = ticksY
    .map(
      (t) =>
        `<line x1="${m.left}" y1="${py(t).toFixed(1)}" x2="${m.left + pw}" y2="${py(t).toFixed(1)}" stroke="${VIZ.grid}" stroke-width="1"/>` +
        `<text x="${m.left - 8}" y="${(py(t) + 4).toFixed(1)}" class="viz-tick" text-anchor="end">${t}</text>`
    )
    .join("");

  const refLinea = referencia
    ? `<line x1="${m.left}" y1="${py(referencia.valor).toFixed(1)}" x2="${m.left + pw}" y2="${py(referencia.valor).toFixed(1)}" stroke="${VIZ.eje}" stroke-width="1"/>
       <text x="${m.left + pw}" y="${(py(referencia.valor) - 6).toFixed(1)}" class="viz-ref" text-anchor="end">${esc(referencia.texto)}</text>`
    : "";

  // Etiquetas de X: si son muchas, se rota para que no colisionen.
  const rotar = n > 5;
  const ejeX = etiquetas
    .map((e, i) => {
      const x = px(i);
      const corta = etiquetaEje(e, rotar ? 18 : 22);
      return rotar
        ? `<text transform="translate(${x.toFixed(1)},${m.top + ph + 14}) rotate(-18)" class="viz-tick" text-anchor="end">${esc(corta)}</text>`
        : `<text x="${x.toFixed(1)}" y="${m.top + ph + 18}" class="viz-tick" text-anchor="middle">${esc(corta)}</text>`;
    })
    .join("");

  const trazos = series
    .map((s) => {
      const puntos = s.valores.map((v, i) => (v == null ? null : [px(i), py(v)]));
      // Los tramos se cortan donde falta el dato, en vez de inventar una recta.
      const tramos = [];
      let actual = [];
      for (const p of puntos) {
        if (p) actual.push(p);
        else {
          if (actual.length) tramos.push(actual);
          actual = [];
        }
      }
      if (actual.length) tramos.push(actual);

      const paths = tramos
        .map(
          (t) =>
            `<path d="${t.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
        )
        .join("");

      const dots = puntos
        .filter(Boolean)
        .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${s.color}" stroke="${VIZ.fondo}" stroke-width="2"/>`)
        .join("");

      return paths + dots;
    })
    .join("");

  // Etiqueta directa en el último punto de cada serie. Si las series
  // convergen al final, separarlas verticalmente las despega de su línea y
  // se lee como ruido: en ese caso se etiqueta SOLO la serie principal y el
  // resto lo llevan la leyenda, el tooltip y la tabla.
  let finales = series
    .map((s) => {
      let i = s.valores.length - 1;
      while (i >= 0 && s.valores[i] == null) i--;
      return i < 0 ? null : { color: s.color, x: px(i), y: py(s.valores[i]), texto: num(s.valores[i]) };
    })
    .filter(Boolean);

  const convergen = finales.some((a, i) => finales.some((b, j) => j > i && Math.abs(a.y - b.y) < 15));
  if (convergen) finales = finales.slice(0, 1);

  const etiquetasFin = finales
    .map((f) => `<text x="${(f.x + 11).toFixed(1)}" y="${(f.y + 4).toFixed(1)}" class="viz-endlabel">${f.texto}</text>`)
    .join("");

  // Capa de hover: una banda por punto en X, ancha y fácil de acertar.
  const bandas = etiquetas
    .map((e, i) => {
      const w = n === 1 ? pw : pw / (n - 1);
      const x = px(i) - w / 2;
      return `<rect class="viz-hit" data-i="${i}" x="${Math.max(m.left, x).toFixed(1)}" y="${m.top}" width="${Math.min(w, pw).toFixed(1)}" height="${ph}" fill="transparent" tabindex="0" role="button" aria-label="${esc(e)}"/>`;
    })
    .join("");

  return `
  <svg class="viz" id="${id}" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="xMidYMid meet" role="img"
       data-tipo="linea" data-etiquetas="${esc(JSON.stringify(etiquetas))}" data-series="${esc(JSON.stringify(series))}">
    ${grid}${refLinea}
    <line x1="${m.left}" y1="${m.top + ph}" x2="${m.left + pw}" y2="${m.top + ph}" stroke="${VIZ.eje}" stroke-width="1"/>
    ${ejeX}
    <line class="viz-crosshair" x1="0" y1="${m.top}" x2="0" y2="${m.top + ph}" stroke="${VIZ.eje}" stroke-width="1" opacity="0"/>
    ${trazos}${etiquetasFin}
    <g class="viz-hits" data-px0="${m.left}" data-pxw="${pw}">${bandas}</g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Small multiples — una mini-línea por dimensión, todas en el mismo hue
// ---------------------------------------------------------------------------

/**
 * Cada facet tiene UNA sola serie, así que no hay identidad que codificar:
 * todas comparten el hue principal y no hace falta leyenda ni paleta
 * categórica. La comparación se hace entre paneles, no entre colores.
 */
export function smallMultiples({ etiquetas, paneles, rangoY = [1, 5], referencia = 3, nombreSerie = "valor" }) {
  return paneles
    .map((p) => {
      const id = nextId();
      const ancho = 300;
      const alto = 126;
      const m = { top: 20, right: 44, bottom: 16, left: 24 };
      const pw = ancho - m.left - m.right;
      const ph = alto - m.top - m.bottom;
      const n = etiquetas.length;
      const px = (i) => (n === 1 ? m.left + pw / 2 : m.left + (i * pw) / (n - 1));
      const py = (v) => m.top + ph - ((v - rangoY[0]) / (rangoY[1] - rangoY[0])) * ph;

      const validos = p.valores.map((v, i) => (v == null ? null : [px(i), py(v), v, i])).filter(Boolean);
      const path = validos.length
        ? `<path d="${validos.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="none" stroke="${VIZ.serie1}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
        : "";
      const dots = validos
        .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${VIZ.serie1}" stroke="${VIZ.fondo}" stroke-width="2"/>`)
        .join("");

      const ult = validos[validos.length - 1];
      const etiquetaFin = ult ? `<text x="${(ult[0] + 9).toFixed(1)}" y="${(ult[1] + 4).toFixed(1)}" class="viz-endlabel">${num(ult[2])}</text>` : "";

      const bandas = etiquetas
        .map((e, i) => {
          const w = n === 1 ? pw : pw / (n - 1);
          const x = px(i) - w / 2;
          return `<rect class="viz-hit" data-i="${i}" x="${Math.max(m.left, x).toFixed(1)}" y="${m.top}" width="${Math.min(w, pw).toFixed(1)}" height="${ph}" fill="transparent" tabindex="0" role="button" aria-label="${esc(e)}"/>`;
        })
        .join("");

      // El título del panel ya dice qué dimensión es: repetirlo en el tooltip
      // sobra, así que la serie se nombra por la medida.
      const serieUnica = [{ nombre: nombreSerie, color: VIZ.serie1, valores: p.valores }];

      return `
      <figure class="viz-facet">
        <figcaption>
          <span class="viz-facet-nombre">${esc(p.titulo)}</span>
          <span class="viz-facet-meta">${esc(p.meta || "")}</span>
        </figcaption>
        <svg class="viz" id="${id}" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="xMidYMid meet" role="img"
             data-tipo="linea" data-etiquetas="${esc(JSON.stringify(etiquetas))}" data-series="${esc(JSON.stringify(serieUnica))}">
          <line x1="${m.left}" y1="${py(referencia).toFixed(1)}" x2="${m.left + pw}" y2="${py(referencia).toFixed(1)}" stroke="${VIZ.eje}" stroke-width="1"/>
          <text x="${m.left - 7}" y="${(py(referencia) + 4).toFixed(1)}" class="viz-tick" text-anchor="end">${referencia}</text>
          <line x1="${m.left}" y1="${m.top + ph}" x2="${m.left + pw}" y2="${m.top + ph}" stroke="${VIZ.grid}" stroke-width="1"/>
          <text x="${m.left - 7}" y="${(m.top + ph + 4).toFixed(1)}" class="viz-tick" text-anchor="end">${rangoY[0]}</text>
          <line class="viz-crosshair" x1="0" y1="${m.top}" x2="0" y2="${m.top + ph}" stroke="${VIZ.eje}" stroke-width="1" opacity="0"/>
          ${path}${dots}${etiquetaFin}
          <g class="viz-hits">${bandas}</g>
        </svg>
      </figure>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Barras divergentes — brecha respecto de cero
// ---------------------------------------------------------------------------

/**
 * @param {{etiqueta:string, valor:number|null}[]} items
 * @param {number} [maxAbs] Escala simétrica; si no se pasa, se deduce del dato
 */
export function barrasDivergentes({
  items,
  maxAbs,
  ancho = 1000,
  altoFila = 34,
  etiquetaAncho = 260,
  polos = { izq: "se evalúa más alto", der: "la jefatura evalúa más alto" },
  nombreMedida = "brecha (jefatura − autoevaluación)",
}) {
  const id = nextId();
  const vals = items.map((i) => Math.abs(i.valor ?? 0));
  const lim = Math.max(0.5, maxAbs ?? Math.ceil(Math.max(...vals, 0.5) * 2) / 2);

  const m = { top: 26, right: 56, bottom: 22, left: etiquetaAncho };
  const alto = m.top + items.length * altoFila + m.bottom;
  const pw = ancho - m.left - m.right;
  const cero = m.left + pw / 2;
  const escala = (v) => (v / lim) * (pw / 2);
  const grosor = Math.min(18, altoFila - 12);

  const cabecera = `
    <text x="${(cero - 8).toFixed(1)}" y="14" class="viz-tick" text-anchor="end">← ${esc(polos.izq)}</text>
    <text x="${(cero + 8).toFixed(1)}" y="14" class="viz-tick" text-anchor="start">${esc(polos.der)} →</text>`;

  const filas = items
    .map((it, k) => {
      const yTop = m.top + k * altoFila;
      const yc = yTop + altoFila / 2;
      const v = it.valor;
      const etiqueta = `<text x="${m.left - 12}" y="${(yc + 4).toFixed(1)}" class="viz-cat" text-anchor="end">${esc(it.etiqueta)}</text>`;

      if (v == null) {
        return `${etiqueta}<text x="${(cero + 10).toFixed(1)}" y="${(yc + 4).toFixed(1)}" class="viz-tick">sin dato</text>`;
      }

      const w = Math.abs(escala(v));
      const x = v >= 0 ? cero : cero - w;
      const color = v >= 0 ? VIZ.posPolo : VIZ.negPolo;
      // Extremo del dato redondeado 4px, escuadra pegada al cero.
      const r = Math.min(4, w);
      const d =
        v >= 0
          ? `M${x},${yc - grosor / 2} H${x + w - r} a${r},${r} 0 0 1 ${r},${r} V${yc + grosor / 2 - r} a${r},${r} 0 0 1 -${r},${r} H${x} Z`
          : `M${x + w},${yc - grosor / 2} H${x + r} a${r},${r} 0 0 0 -${r},${r} V${yc + grosor / 2 - r} a${r},${r} 0 0 0 ${r},${r} H${x + w} Z`;

      const signo = v > 0 ? "+" : "";
      const lx = v >= 0 ? x + w + 8 : x - 8;
      const anchor = v >= 0 ? "start" : "end";
      const valorTexto = `<text x="${lx.toFixed(1)}" y="${(yc + 4).toFixed(1)}" class="viz-endlabel" text-anchor="${anchor}">${signo}${num(v)}</text>`;

      return `${etiqueta}
        <path class="viz-bar" d="${d}" fill="${color}"/>
        ${valorTexto}
        <rect class="viz-hit-bar" x="${m.left}" y="${yTop}" width="${pw}" height="${altoFila}" fill="transparent" tabindex="0" role="button"
              data-etiqueta="${esc(it.etiqueta)}" data-valor="${signo}${num(v)}" data-color="${color}" data-medida="${esc(nombreMedida)}"/>`;
    })
    .join("");

  return `
  <svg class="viz" id="${id}" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="xMidYMid meet" role="img" data-tipo="barras">
    ${cabecera}
    <line x1="${cero}" y1="${m.top - 4}" x2="${cero}" y2="${m.top + items.length * altoFila + 4}" stroke="${VIZ.eje}" stroke-width="1"/>
    ${filas}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Sparkline para KPIs
// ---------------------------------------------------------------------------

export function sparkline(valores, { ancho = 108, alto = 30 } = {}) {
  const v = valores.filter((x) => x != null);
  if (v.length < 2) return "";
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const px = (i) => (i * ancho) / (v.length - 1);
  const py = (val) => alto - 3 - ((val - min) / span) * (alto - 6);
  const d = v.map((val, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(val).toFixed(1)}`).join(" ");
  const ux = px(v.length - 1);
  const uy = py(v[v.length - 1]);
  return `
  <svg class="viz-spark" viewBox="0 0 ${ancho} ${alto}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${VIZ.neutro}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="3.5" fill="${VIZ.serie1}" stroke="${VIZ.fondo}" stroke-width="2"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Interacción
// ---------------------------------------------------------------------------

/** Engancha hover + foco de teclado en todos los SVG que haya dentro de root. */
export function activarInteraccion(root) {
  root.querySelectorAll('svg.viz[data-tipo="linea"]').forEach((svg) => {
    let etiquetas;
    let series;
    try {
      etiquetas = JSON.parse(svg.dataset.etiquetas);
      series = JSON.parse(svg.dataset.series);
    } catch {
      return;
    }
    const cross = svg.querySelector(".viz-crosshair");

    const activar = (rect, evt) => {
      const i = Number(rect.dataset.i);
      const x = Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")) / 2;
      if (cross) {
        cross.setAttribute("x1", x);
        cross.setAttribute("x2", x);
        cross.setAttribute("opacity", "1");
      }
      // Una sola lectura con TODAS las series de ese X.
      const filas = series
        .filter((s) => s.valores[i] != null)
        .map((s) => ({ color: s.color, nombre: s.nombre, valor: num(s.valores[i]) }));
      if (!filas.length) return;
      const caja = rect.getBoundingClientRect();
      // Se ancla al puntero cuando existe, así no tapa el título de la tarjeta.
      const cx = evt && evt.clientX ? evt.clientX : caja.left + caja.width / 2;
      const cy = evt && evt.clientY ? evt.clientY : caja.top + caja.height / 2;
      mostrarTooltip(filas, etiquetas[i], cx, cy);
    };

    const apagar = () => {
      if (cross) cross.setAttribute("opacity", "0");
      ocultarTooltip();
    };

    svg.querySelectorAll(".viz-hit").forEach((rect) => {
      rect.addEventListener("pointermove", (e) => activar(rect, e));
      rect.addEventListener("pointerenter", (e) => activar(rect, e));
      rect.addEventListener("focus", () => activar(rect, null));
      rect.addEventListener("blur", apagar);
    });
    svg.addEventListener("pointerleave", apagar);
  });

  root.querySelectorAll('svg.viz[data-tipo="barras"]').forEach((svg) => {
    svg.querySelectorAll(".viz-hit-bar").forEach((rect) => {
      const mostrar = (e) => {
        const caja = rect.getBoundingClientRect();
        mostrarTooltip(
          [{ color: rect.dataset.color, nombre: rect.dataset.medida || "valor", valor: rect.dataset.valor }],
          rect.dataset.etiqueta,
          e && e.clientX ? e.clientX : caja.left + caja.width / 2,
          caja.top + 4
        );
        rect.classList.add("is-hover");
      };
      const ocultar = () => {
        rect.classList.remove("is-hover");
        ocultarTooltip();
      };
      rect.addEventListener("pointerenter", mostrar);
      rect.addEventListener("pointermove", mostrar);
      rect.addEventListener("pointerleave", ocultar);
      rect.addEventListener("focus", () => mostrar(null));
      rect.addEventListener("blur", ocultar);
    });
  });
}

/** Leyenda: siempre presente desde 2 series; con 1 sola el título ya la nombra. */
export function leyenda(series, { forma = "linea" } = {}) {
  if (!series || series.length < 2) return "";
  return `<div class="viz-legend">${series
    .map(
      (s) =>
        `<span class="viz-legend-item"><span class="viz-legend-key ${forma === "linea" ? "is-line" : "is-rect"}" style="background:${s.color}"></span>${esc(s.nombre)}</span>`
    )
    .join("")}</div>`;
}
