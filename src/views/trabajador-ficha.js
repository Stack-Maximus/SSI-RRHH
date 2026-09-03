/**
 * Ficha del trabajador · el perfil de una persona visto como historia, no
 * como fila de tabla.
 *
 * Responde una sola pregunta: ¿esta persona mejoró o empeoró, y en qué?
 * Para eso arma la serie temporal de sus evaluaciones (cada ciclo aporta un
 * punto), la descompone por dimensión y contrasta cómo se ve ella misma
 * frente a cómo la ve su jefatura.
 *
 * Quién puede abrirla:
 *   · admin global y RRHH del módulo Personal — la ficha de cualquiera
 *   · cualquier persona — la suya propia ("Mi evolución")
 * El frontend decide qué botón mostrar; el filtro real es RLS.
 *
 * La huella transversal (No Conformidades, Postventa, auditorías) se consulta
 * de forma tolerante: si RLS le oculta esas tablas a quien mira, la sección
 * lo dice en vez de romperse. Ver database/migracion_ficha_trabajador.sql
 * para abrirle esa visibilidad al admin.
 */

import { supabase } from "../core/supabase.js";
import { state } from "../core/state.js";
import { escapeHtml, initials, formatDate } from "../ui/utils.js";
import { Toast } from "../ui/toast.js";
import { MODULO_LABELS } from "../config.js";
import { VIZ, lineaTemporal, smallMultiples, barrasDivergentes, sparkline, leyenda, activarInteraccion } from "../ui/charts.js";
import {
  ESTADO_LABELS,
  ESTADO_BADGE,
  CON_NOTA,
  CATEGORIA_LABELS,
  CATEGORIA_BADGE,
  PDI_ESTADO_LABELS,
} from "./personal-flujo.js";

/** Categoría: el texto siempre está presente — el color solo lo refuerza. */
const CATEGORIA = {
  excepcional: { label: CATEGORIA_LABELS.excepcional, badge: CATEGORIA_BADGE.excepcional, icono: "★" },
  destacado: { label: CATEGORIA_LABELS.destacado, badge: CATEGORIA_BADGE.destacado, icono: "▲" },
  satisfactorio: { label: CATEGORIA_LABELS.satisfactorio, badge: CATEGORIA_BADGE.satisfactorio, icono: "●" },
  por_debajo: { label: CATEGORIA_LABELS.por_debajo, badge: CATEGORIA_BADGE.por_debajo, icono: "▼" },
  critico: { label: CATEGORIA_LABELS.critico, badge: CATEGORIA_BADGE.critico, icono: "!" },
};

const PDI_ESTADO = PDI_ESTADO_LABELS;

const n2 = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : String(Math.round(Number(v) * 100) / 100));

/**
 * Estados en que el expediente se puede bajar en Excel. Es la misma lista que
 * eva_expediente_descargable() en la base, y la base es la que manda: acá sólo
 * se decide si se dibuja el botón.
 *
 * 'consolidada' no está: ahí los puntajes existen pero RRHH todavía no le
 * entregó el resultado a la persona. RRHH sí puede exportar desde su propia
 * lista en ese estado; esta ficha la abre también el trabajador.
 */
const DESCARGABLE = ["entregada_trabajador", "resultados_aceptados", "reunion_agendada", "reunion_realizada",
  "reflexiones_enviadas", "pendiente_firmas", "cerrada_conforme", "cerrada_disconformidad", "archivada"];

/** Consulta que puede no estar permitida: devuelve null en vez de explotar. */
async function tolerante(promesa) {
  try {
    const { data, error } = await promesa;
    if (error) return null;
    return data || [];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

export async function renderFichaTrabajador(container, perfil, { volver } = {}) {
  container.innerHTML = `<div class="view-loading">Cargando ficha...</div>`;

  const volverA = typeof volver === "function" ? volver : () => window.Router.go("home");

  const [{ data: evaluaciones, error }, { data: dimensiones }, { data: accesos }] = await Promise.all([
    supabase
      .from("eva_evaluaciones")
      .select(
        "id, estado, nro_evaluacion, cargo_actual, categoria, decision_asociada, total_sup, total_auto, brecha_total, " +
          "prom_sup_tc, prom_sup_ss, prom_sup_dl, prom_sup_vh, prom_sup_cm, " +
          "prom_auto_tc, prom_auto_ss, prom_auto_dl, prom_auto_vh, prom_auto_cm, " +
          "brecha_tc, brecha_ss, brecha_dl, brecha_vh, brecha_cm, " +
          "fecha_envio_autoeval, fecha_envio_evaluacion, fecha_cierre, acuerdo_trabajador, " +
          "evaluador:evaluador_id(nombre), ciclo:ciclo_id(id, titulo, tipo_periodo, fecha_apertura, fecha_cierre_ciclo)"
      )
      .eq("evaluado_id", perfil.id),
    supabase.from("eva_dimensiones").select("codigo, nombre, peso").order("peso", { ascending: false }),
    supabase.from("modulo_accesos").select("modulo, rol").eq("usuario_id", perfil.id),
  ]);

  if (error) {
    container.innerHTML = `
      <div class="view-ficha">
        <button class="btn btn-secondary" id="btn-volver-ficha" style="margin-bottom:16px;">← Volver</button>
        <div class="placeholder error"><h2>No se pudo cargar la ficha</h2><p>${escapeHtml(error.message)}</p></div>
      </div>`;
    document.getElementById("btn-volver-ficha").addEventListener("click", volverA);
    return;
  }

  const dims = dimensiones || [];
  const evals = ordenarPorTiempo(evaluaciones || []);
  const serie = evals.filter((e) => e.total_sup != null);
  const ultima = serie[serie.length - 1] || null;

  // PDI de todas sus evaluaciones + huella transversal, en paralelo y tolerante.
  const idsEval = evals.map((e) => e.id);
  const [pdi, comoEvaluador, accionesNC, ncDetectadas, ticketsPV, auditorias] = await Promise.all([
    idsEval.length ? tolerante(supabase.from("eva_pdi").select("*").in("evaluacion_id", idsEval).order("nro")) : [],
    tolerante(supabase.from("eva_evaluaciones").select("id, estado").eq("evaluador_id", perfil.id)),
    tolerante(supabase.from("nc_acciones").select("id, tipo, accion, plazo, estado, nc:nc_id(folio, severidad)").eq("responsable_id", perfil.id)),
    tolerante(supabase.from("nc_registro").select("id, folio, severidad, estado").eq("detectada_por", perfil.id)),
    tolerante(supabase.from("pv_tickets").select("id, numero_ticket, obra, severidad, estado, satisfaccion_1_7").eq("responsable_id", perfil.id)),
    tolerante(supabase.from("nc_auditorias").select("id, codigo, area_proceso, estado, fecha_real").eq("auditor_id", perfil.id)),
  ]);

  const esYo = perfil.id === state.user?.id;

  container.innerHTML = `
    <div class="view-ficha">
      <button class="btn btn-secondary" id="btn-volver-ficha" style="margin-bottom:16px;">← Volver</button>

      ${bloqueCabecera(perfil, accesos || [], ultima, esYo)}
      ${bloqueKPIs(serie, ultima)}
      ${bloqueVeredicto(serie, dims)}
      ${bloqueEvolucionTotal(serie)}
      ${bloqueEvolucionDimensiones(serie, dims)}
      ${bloqueBrechas(ultima, dims)}
      ${bloqueHistorial(evals)}
      ${bloquePDI(pdi, evals)}
      ${bloqueHuella({ comoEvaluador, accionesNC, ncDetectadas, ticketsPV, auditorias })}
    </div>
  `;

  document.getElementById("btn-volver-ficha").addEventListener("click", volverA);
  engancharDescargas(container);
  activarInteraccion(container);
}

/** Descarga del expediente de un ciclo, desde el historial. */
function engancharDescargas(container) {
  container.querySelectorAll("[data-bajar-exp]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const texto = btn.textContent;
      btn.disabled = true;
      btn.textContent = "...";
      try {
        const { descargarExpediente } = await import("../ui/exportar-evaluacion.js");
        await descargarExpediente(btn.dataset.bajarExp);
        Toast.success("Expediente descargado", "Documento reservado: guárdalo donde corresponda.");
      } catch (e) {
        Toast.error("No se pudo generar el archivo", e.message || "Error desconocido");
      } finally {
        btn.disabled = false;
        btn.textContent = texto;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Orden temporal
// ---------------------------------------------------------------------------

/** Ancla cada evaluación en el tiempo: apertura del ciclo, o la fecha en que
 *  el evaluador la envió si el ciclo no tiene fechas cargadas. */
function claveTiempo(e) {
  return e.ciclo?.fecha_apertura || e.fecha_envio_evaluacion || e.fecha_envio_autoeval || e.ciclo?.fecha_cierre_ciclo || "";
}

function ordenarPorTiempo(lista) {
  return [...lista].sort((a, b) => String(claveTiempo(a)).localeCompare(String(claveTiempo(b))));
}

function etiquetaCiclo(e) {
  return e.ciclo?.titulo || e.nro_evaluacion || "Sin ciclo";
}

// ---------------------------------------------------------------------------
// Cabecera
// ---------------------------------------------------------------------------

function bloqueCabecera(perfil, accesos, ultima, esYo) {
  const chips = [
    perfil.activo ? `<span class="badge badge-success">Activo</span>` : `<span class="badge badge-danger">Inactivo</span>`,
    perfil.es_admin ? `<span class="badge badge-info">Administrador</span>` : "",
    esYo ? `<span class="badge badge-neutral">Tú</span>` : "",
    ...accesos.map(
      (a) => `<span class="badge badge-neutral">${escapeHtml(MODULO_LABELS[a.modulo] || a.modulo)}: ${escapeHtml(a.rol)}</span>`
    ),
  ]
    .filter(Boolean)
    .join(" ");

  const cargo = ultima?.cargo_actual || perfil.cargo;

  return `
    <div class="ficha-header">
      <div class="ficha-avatar">${escapeHtml(initials(perfil.nombre))}</div>
      <div class="ficha-ident">
        <h2 class="ficha-nombre">${escapeHtml(perfil.nombre)}</h2>
        <p class="ficha-cargo">${escapeHtml(cargo || "Sin cargo registrado")}</p>
        <div class="ficha-chips">${chips}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function bloqueKPIs(serie, ultima) {
  if (!serie.length) {
    return `
      <div class="ficha-seccion-vacia" style="margin-bottom:24px;">
        Todavía no hay ninguna evaluación consolidada para esta persona, así que aún no hay nada
        que medir en el tiempo. La ficha se irá llenando sola a medida que se cierren los ciclos.
      </div>`;
  }

  const actual = Number(ultima.total_sup);
  const previa = serie.length > 1 ? Number(serie[serie.length - 2].total_sup) : null;
  const delta = previa == null ? null : Math.round((actual - previa) * 100) / 100;

  const cat = CATEGORIA[ultima.categoria] || null;
  const chispa = sparkline(serie.map((e) => Number(e.total_sup)));

  const deltaHtml =
    delta == null
      ? `<span class="ficha-kpi-meta">primer ciclo medido</span>`
      : `<span class="ficha-delta ${delta > 0.001 ? "is-sube" : delta < -0.001 ? "is-baja" : "is-igual"}"
               title="Comparado con ${escapeHtml(etiquetaCiclo(serie[serie.length - 2]))}">
           ${delta > 0.001 ? "↑" : delta < -0.001 ? "↓" : "→"} ${delta > 0 ? "+" : ""}${n2(delta)} vs. anterior
         </span>`;

  const brecha = ultima.brecha_total;
  const brechaTexto =
    brecha == null
      ? "sin autoevaluación para comparar"
      : Math.abs(brecha) < 0.2
      ? "su autopercepción coincide con la jefatura"
      : brecha > 0
      ? "se evalúa más bajo que su jefatura"
      : "se evalúa más alto que su jefatura";

  return `
    <div class="ficha-kpis">
      <div class="ficha-kpi is-hero">
        <span class="ficha-kpi-label">Última evaluación · ${escapeHtml(etiquetaCiclo(ultima))}</span>
        <span class="ficha-kpi-valor">${n2(actual)}</span>
        <div class="ficha-kpi-pie">${deltaHtml}${chispa}</div>
      </div>

      <div class="ficha-kpi">
        <span class="ficha-kpi-label">Categoría</span>
        <span class="ficha-kpi-valor" style="font-size:19px;">
          ${cat ? `<span class="badge ${cat.badge}">${cat.icono} ${cat.label}</span>` : "—"}
        </span>
        <div class="ficha-kpi-pie"><span class="ficha-kpi-meta">${escapeHtml(ultima.decision_asociada || "Sin decisión asociada")}</span></div>
      </div>

      <div class="ficha-kpi">
        <span class="ficha-kpi-label">Brecha auto vs. jefatura</span>
        <span class="ficha-kpi-valor">${brecha == null ? "—" : `${brecha > 0 ? "+" : ""}${n2(brecha)}`}</span>
        <div class="ficha-kpi-pie"><span class="ficha-kpi-meta">${brechaTexto}</span></div>
      </div>

      <div class="ficha-kpi">
        <span class="ficha-kpi-label">Ciclos medidos</span>
        <span class="ficha-kpi-valor">${serie.length}</span>
        <div class="ficha-kpi-pie">
          <span class="ficha-kpi-meta">${serie.length === 1 ? "aún no hay serie" : `desde ${escapeHtml(etiquetaCiclo(serie[0]))}`}</span>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Veredicto en palabras
// ---------------------------------------------------------------------------

/** Pendiente por mínimos cuadrados: con 3+ puntos dice más que el último salto. */
function pendiente(valores) {
  const n = valores.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = valores.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - mx) * (valores[i] - my);
    sxx += (i - mx) ** 2;
  }
  return sxx === 0 ? 0 : sxy / sxx;
}

function bloqueVeredicto(serie, dims) {
  if (serie.length < 2) return "";

  const valores = serie.map((e) => Number(e.total_sup));
  const m = pendiente(valores);
  const totalDelta = Math.round((valores[valores.length - 1] - valores[0]) * 100) / 100;

  let clase = "is-estable";
  let icono = "→";
  let titulo = "Se mantiene estable";
  if (m > 0.05) {
    clase = "is-mejora";
    icono = "↑";
    titulo = "Tendencia al alza";
  } else if (m < -0.05) {
    clase = "is-baja";
    icono = "↓";
    titulo = "Tendencia a la baja";
  }

  // La dimensión que más se movió, en una y otra dirección.
  const movimientos = dims
    .map((d) => {
      const c = d.codigo.toLowerCase();
      const prim = serie.find((e) => e[`prom_sup_${c}`] != null);
      const ult = [...serie].reverse().find((e) => e[`prom_sup_${c}`] != null);
      if (!prim || !ult || prim === ult) return null;
      return { nombre: d.nombre, delta: Math.round((Number(ult[`prom_sup_${c}`]) - Number(prim[`prom_sup_${c}`])) * 100) / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => b.delta - a.delta);

  const sube = movimientos[0];
  const baja = movimientos[movimientos.length - 1];

  const detalleDims =
    movimientos.length && sube !== baja
      ? ` Lo que más subió fue <strong>${escapeHtml(sube.nombre)}</strong> (${sube.delta > 0 ? "+" : ""}${n2(sube.delta)});
          lo que más bajó, <strong>${escapeHtml(baja.nombre)}</strong> (${baja.delta > 0 ? "+" : ""}${n2(baja.delta)}).`
      : "";

  return `
    <div class="ficha-veredicto ${clase}">
      <span class="ficha-veredicto-icono" aria-hidden="true">${icono}</span>
      <span>
        <strong>${titulo}.</strong>
        A lo largo de ${serie.length} ciclos medidos pasó de ${n2(valores[0])} a ${n2(valores[valores.length - 1])}
        (${totalDelta > 0 ? "+" : ""}${n2(totalDelta)} en total, ${m > 0 ? "+" : ""}${n2(m)} por ciclo en promedio).${detalleDims}
      </span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Evolución del total
// ---------------------------------------------------------------------------

function bloqueEvolucionTotal(serie) {
  if (!serie.length) return "";

  if (serie.length === 1) {
    return `
      <div class="card viz-card">
        <h3>Evolución del desempeño</h3>
        <p class="viz-sub">Hay una sola evaluación consolidada, así que todavía no hay evolución que graficar. Con el próximo ciclo aparece la línea.</p>
        <div class="ficha-seccion-vacia">
          ${escapeHtml(etiquetaCiclo(serie[0]))} — evaluación ${n2(serie[0].total_sup)} · autoevaluación ${n2(serie[0].total_auto)}
        </div>
      </div>`;
  }

  const etiquetas = serie.map(etiquetaCiclo);
  const series = [
    { nombre: "Evaluación de la jefatura", color: VIZ.serie1, valores: serie.map((e) => (e.total_sup == null ? null : Number(e.total_sup))) },
    { nombre: "Autoevaluación", color: VIZ.serie2, valores: serie.map((e) => (e.total_auto == null ? null : Number(e.total_auto))) },
  ];

  const filas = serie
    .map(
      (e) => `<tr>
        <td>${escapeHtml(etiquetaCiclo(e))}</td>
        <td>${formatDate(e.ciclo?.fecha_apertura) || "—"}</td>
        <td>${n2(e.total_sup)}</td>
        <td>${n2(e.total_auto)}</td>
        <td>${e.brecha_total == null ? "—" : `${e.brecha_total > 0 ? "+" : ""}${n2(e.brecha_total)}`}</td>
        <td>${CATEGORIA[e.categoria] ? escapeHtml(CATEGORIA[e.categoria].label) : "—"}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="card viz-card">
      <h3>Evolución del desempeño</h3>
      <p class="viz-sub">Total ponderado de cada ciclo, en la escala 1 a 5. La línea de referencia marca el 3,0 — el nivel «Cumple».</p>
      ${leyenda(series)}
      ${lineaTemporal({ etiquetas, series, referencia: { valor: 3, texto: "3,0 · Cumple" } })}
      <details class="viz-tabla">
        <summary>Ver los datos en tabla</summary>
        <div class="tabla-scroll">
          <table class="data-table">
            <thead><tr><th>Ciclo</th><th>Apertura</th><th>Jefatura</th><th>Autoeval.</th><th>Brecha</th><th>Categoría</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </details>
    </div>`;
}

// ---------------------------------------------------------------------------
// Evolución por dimensión (small multiples)
// ---------------------------------------------------------------------------

function bloqueEvolucionDimensiones(serie, dims) {
  if (serie.length < 2 || !dims.length) return "";

  const etiquetas = serie.map(etiquetaCiclo);

  const paneles = dims.map((d) => {
    const c = d.codigo.toLowerCase();
    const valores = serie.map((e) => (e[`prom_sup_${c}`] == null ? null : Number(e[`prom_sup_${c}`])));
    const conDato = valores.filter((v) => v != null);
    const delta = conDato.length > 1 ? Math.round((conDato[conDato.length - 1] - conDato[0]) * 100) / 100 : null;
    const peso = `peso ${Math.round(Number(d.peso) * 100)}%`;
    return {
      titulo: d.nombre,
      meta: delta == null ? peso : `${peso} · ${delta > 0 ? "+" : ""}${n2(delta)} desde el primer ciclo`,
      valores,
    };
  });

  const filas = dims
    .map((d) => {
      const c = d.codigo.toLowerCase();
      return `<tr>
        <td>${escapeHtml(d.nombre)}</td>
        ${serie.map((e) => `<td>${n2(e[`prom_sup_${c}`])}</td>`).join("")}
      </tr>`;
    })
    .join("");

  return `
    <div class="card viz-card">
      <h3>Evolución por dimensión</h3>
      <p class="viz-sub">
        Un panel por dimensión, todos en la misma escala 1 a 5 y con la misma línea de referencia en 3,0,
        para que se puedan comparar entre sí de un vistazo. La nota que aparece es la de la jefatura.
      </p>
      <div class="viz-facets">${smallMultiples({ etiquetas, paneles, nombreSerie: "nota de la jefatura" })}</div>
      <p class="viz-eje-nota">
        Eje horizontal, de izquierda a derecha: ${escapeHtml(etiquetas[0])} → ${escapeHtml(etiquetas[etiquetas.length - 1])}
        (${etiquetas.length} ciclos). Pasa el cursor por cualquier punto para ver de qué ciclo se trata.
      </p>
      <details class="viz-tabla">
        <summary>Ver los datos en tabla</summary>
        <div class="tabla-scroll">
          <table class="data-table">
            <thead><tr><th>Dimensión</th>${serie.map((e) => `<th>${escapeHtml(etiquetaCiclo(e))}</th>`).join("")}</tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </details>
    </div>`;
}

// ---------------------------------------------------------------------------
// Brechas del último ciclo
// ---------------------------------------------------------------------------

function bloqueBrechas(ultima, dims) {
  if (!ultima || !dims.length) return "";

  const items = dims.map((d) => {
    const c = d.codigo.toLowerCase();
    const v = ultima[`brecha_${c}`];
    return { etiqueta: d.nombre, valor: v == null ? null : Number(v) };
  });

  if (items.every((i) => i.valor == null)) return "";

  const filas = dims
    .map((d) => {
      const c = d.codigo.toLowerCase();
      return `<tr>
        <td>${escapeHtml(d.nombre)}</td>
        <td>${n2(ultima[`prom_auto_${c}`])}</td>
        <td>${n2(ultima[`prom_sup_${c}`])}</td>
        <td>${ultima[`brecha_${c}`] == null ? "—" : `${ultima[`brecha_${c}`] > 0 ? "+" : ""}${n2(ultima[`brecha_${c}`])}`}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="card viz-card">
      <h3>Autopercepción vs. jefatura · ${escapeHtml(etiquetaCiclo(ultima))}</h3>
      <p class="viz-sub">
        Cada barra es la diferencia entre la nota de la jefatura y la autoevaluación en esa dimensión.
        A la derecha del cero, la jefatura valora más alto de lo que la persona se valora; a la izquierda, al revés.
        Lo interesante no es el signo sino el tamaño: una barra larga es una conversación pendiente.
      </p>
      ${barrasDivergentes({ items, polos: { izq: "se evalúa más alto", der: "la jefatura evalúa más alto" } })}
      <details class="viz-tabla">
        <summary>Ver los datos en tabla</summary>
        <div class="tabla-scroll">
          <table class="data-table">
            <thead><tr><th>Dimensión</th><th>Autoevaluación</th><th>Jefatura</th><th>Brecha</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </details>
    </div>`;
}

// ---------------------------------------------------------------------------
// Historial completo
// ---------------------------------------------------------------------------

function bloqueHistorial(evals) {
  if (!evals.length) return "";

  const filas = [...evals]
    .reverse()
    .map((e) => {
      const cat = CATEGORIA[e.categoria];
      return `<tr>
        <td>${escapeHtml(etiquetaCiclo(e))}</td>
        <td>${escapeHtml(e.ciclo?.tipo_periodo || "—")}</td>
        <td>${escapeHtml(e.evaluador?.nombre || "—")}</td>
        <td><span class="badge ${ESTADO_BADGE[e.estado] || "badge-neutral"}">${escapeHtml(ESTADO_LABELS[e.estado] || e.estado)}</span></td>
        <td>${CON_NOTA.includes(e.estado) ? n2(e.total_sup) : "—"}</td>
        <td>${cat ? `<span class="badge ${cat.badge}">${cat.label}</span>` : "—"}</td>
        <td>${e.acuerdo_trabajador === "conforme" ? "Conforme" : e.acuerdo_trabajador === "no_conforme" ? "No conforme" : "—"}</td>
        <td>${DESCARGABLE.includes(e.estado)
          ? `<button class="btn btn-secondary btn-sm" data-bajar-exp="${escapeHtml(e.id)}" title="Descargar el expediente de este ciclo en Excel">⬇ Excel</button>`
          : `<span class="hint">aún no</span>`}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="card viz-card">
      <h3>Historial de evaluaciones (${evals.length})</h3>
      <p class="viz-sub">Todos los ciclos en que participó, del más reciente al más antiguo — incluidos los que aún no tienen nota.
      Cada expediente descargable trae el detalle completo de ese ciclo: es un documento reservado con datos personales.</p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>Ciclo</th><th>Periodo</th><th>Evaluador</th><th>Estado</th><th>Nota</th><th>Categoría</th><th>Conformidad</th><th>Expediente</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// PDI acumulado
// ---------------------------------------------------------------------------

function bloquePDI(pdi, evals) {
  if (pdi === null) {
    return `
      <div class="card viz-card">
        <h3>Plan de Desarrollo Individual</h3>
        <div class="ficha-seccion-vacia">No tienes visibilidad sobre el PDI de esta persona.</div>
      </div>`;
  }
  if (!pdi.length) return "";

  const cicloDe = {};
  evals.forEach((e) => (cicloDe[e.id] = etiquetaCiclo(e)));

  const completadas = pdi.filter((a) => a.estado_accion === "completada").length;

  const filas = pdi
    .map(
      (a) => `<tr>
        <td>${escapeHtml(cicloDe[a.evaluacion_id] || "—")}</td>
        <td>${escapeHtml(a.dimension_criterio || "—")}</td>
        <td>${escapeHtml(a.accion_smart || "—")}</td>
        <td>${formatDate(a.fecha_cierre) || "—"}</td>
        <td>${escapeHtml(PDI_ESTADO[a.estado_accion] || a.estado_accion || "—")}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="card viz-card">
      <h3>Plan de Desarrollo Individual</h3>
      <p class="viz-sub">${completadas} de ${pdi.length} acciones de desarrollo completadas, acumulando todos sus ciclos.</p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>Ciclo</th><th>Dimensión/criterio</th><th>Acción SMART</th><th>Cierre</th><th>Estado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Huella transversal
// ---------------------------------------------------------------------------

function bloqueHuella({ comoEvaluador, accionesNC, ncDetectadas, ticketsPV, auditorias }) {
  const bloques = [];

  if (comoEvaluador && comoEvaluador.length) {
    bloques.push(
      bloque("🧑‍💼", "Evaluaciones que realiza", comoEvaluador.length, `Como evaluador de otras personas.`)
    );
  }

  if (accionesNC === null) {
    bloques.push(bloque("⚠", "No Conformidades", "—", "Sin visibilidad sobre el módulo."));
  } else if (accionesNC.length || (ncDetectadas && ncDetectadas.length)) {
    const abiertas = accionesNC.filter((a) => a.estado !== "cerrada" && a.estado !== "completada").length;
    const detectadas = ncDetectadas ? ncDetectadas.length : 0;
    bloques.push(
      bloque(
        "⚠",
        "No Conformidades",
        accionesNC.length,
        `acciones correctivas a su cargo${abiertas ? ` · ${abiertas} sin cerrar` : " · todas cerradas"}` +
          (detectadas ? `<br>${detectadas} NC detectadas por ella misma` : "")
      )
    );
  }

  if (ticketsPV === null) {
    bloques.push(bloque("🔧", "Postventa", "—", "Sin visibilidad sobre el módulo."));
  } else if (ticketsPV.length) {
    const cerrados = ticketsPV.filter((t) => t.estado === "cerrado").length;
    const notas = ticketsPV.map((t) => t.satisfaccion_1_7).filter((v) => v != null);
    const promSat = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;
    bloques.push(
      bloque(
        "🔧",
        "Tickets de postventa",
        ticketsPV.length,
        `${cerrados} cerrados de ${ticketsPV.length}` + (promSat != null ? `<br>satisfacción promedio ${promSat} de 7` : "")
      )
    );
  }

  if (auditorias && auditorias.length) {
    bloques.push(bloque("🔍", "Auditorías", auditorias.length, "Como auditor asignado."));
  }

  if (!bloques.length) {
    return `
      <div class="card viz-card">
        <h3>Huella en los otros módulos</h3>
        <div class="ficha-seccion-vacia">
          Esta persona todavía no tiene registros a su nombre en No Conformidades, Postventa ni auditorías.
        </div>
      </div>`;
  }

  return `
    <div class="card viz-card">
      <h3>Huella en los otros módulos</h3>
      <p class="viz-sub">Lo que esta persona genera fuera de su propia evaluación — es el contexto que explica muchas notas.</p>
      <div class="ficha-huella">${bloques.join("")}</div>
    </div>`;
}

function bloque(icono, titulo, cifra, detalleHtml) {
  return `
    <div class="ficha-huella-bloque">
      <h4><span aria-hidden="true">${icono}</span> ${escapeHtml(titulo)}</h4>
      <div class="ficha-huella-cifra">${escapeHtml(String(cifra))}</div>
      <div class="ficha-huella-detalle">${detalleHtml}</div>
    </div>`;
}
