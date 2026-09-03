/**
 * Vista del rol «crecimiento_bienestar» dentro de Evaluación de Personal.
 *
 * Su trabajo no es evaluar a nadie: es que los planes de desarrollo que definió
 * cada jefatura efectivamente se pongan en marcha. Así que esta vista no muestra
 * notas ni categorías — muestra personas, acciones, plazos y qué está sin
 * revisar.
 *
 * Está agrupada por persona y no como tabla plana a propósito: quien hace
 * seguimiento no piensa en «acciones», piensa en «tengo que llamar a Francisco».
 * Una tabla plana repite el nombre en cada fila y esconde el hecho de que una
 * persona concentra tres acciones atrasadas.
 *
 * Puede registrar los dos controles de seguimiento de cada acción y mover su
 * estado. NO puede reescribir la acción ni agregar nuevas: el plan lo acordaron
 * el evaluador y el trabajador en la reunión, y cambiarlo por detrás sería pasar
 * por encima de ese acuerdo. La restricción no es solo de interfaz — en la base,
 * este rol tiene lectura del PDI y escribe únicamente a través de la función
 * eva_pdi_registrar_control, que solo toca los campos de seguimiento.
 */

import { supabase } from "../core/supabase.js";
import { Toast } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate, initials } from "../ui/utils.js";
import { PDI_ESTADO_LABELS, PDI_ESTADO_BADGE } from "./personal-flujo.js";

const hoyISO = () => new Date().toISOString().slice(0, 10);
const hoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const diasHasta = (fecha) => (fecha ? Math.round((new Date(`${fecha}T00:00:00`) - hoy()) / 86400000) : null);

/**
 * Situación de una acción: es una sola etiqueta, la más urgente que aplique.
 * Se calculan también los hechos por separado (sinControl1, vencida...) porque
 * los KPI cuentan hechos, no etiquetas — si el KPI usara la etiqueta, una acción
 * vencida Y sin revisar solo contaría en «vencida» y el panel diría que no hay
 * nada sin revisar. Ese era justo el error de la primera versión.
 */
function analizar(a) {
  const completada = a.estado_accion === "completada";
  const dias = diasHasta(a.fecha_cierre);
  const vencida = !completada && dias != null && dias < 0;
  const porVencer = !completada && dias != null && dias >= 0 && dias <= 14;
  const sinControl1 = !a.control_1_fecha;
  const sinControl2 = !!a.control_1_fecha && !a.control_2_fecha;

  let etiqueta;
  if (completada) {
    etiqueta = { clave: "completada", texto: "Completada", badge: "badge-success" };
  } else if (vencida) {
    const d = Math.abs(dias);
    etiqueta = { clave: "vencida", texto: `Vencida hace ${d} día${d === 1 ? "" : "s"}`, badge: "badge-danger" };
  } else if (porVencer) {
    etiqueta = { clave: "por_vencer", texto: dias === 0 ? "Vence hoy" : `Vence en ${dias} días`, badge: "badge-warning" };
  } else {
    etiqueta = { clave: "en_plazo", texto: "En plazo", badge: "badge-neutral" };
  }

  return { ...a, completada, dias, vencida, porVencer, sinControl1, sinControl2, etiqueta };
}

/** Estado del seguimiento, que es cosa distinta del plazo. */
function seguimiento(a) {
  if (!a.control_1_fecha) return { texto: "Sin revisar", clase: "is-pendiente" };
  if (!a.control_2_fecha) return { texto: `1 de 2 controles · ${formatDate(a.control_1_fecha)}`, clase: "is-parcial" };
  return { texto: `2 de 2 controles · ${formatDate(a.control_2_fecha)}`, clase: "is-completo" };
}

const FILTROS = [
  { clave: "todas", label: "Todas", test: () => true },
  { clave: "vencidas", label: "Vencidas", test: (a) => a.vencida },
  { clave: "por_vencer", label: "Vencen en 14 días", test: (a) => a.porVencer },
  { clave: "sin_revisar", label: "Sin revisar", test: (a) => !a.completada && a.sinControl1 },
  { clave: "falta_control", label: "Falta el 2do control", test: (a) => !a.completada && a.sinControl2 },
  { clave: "completadas", label: "Completadas", test: (a) => a.completada },
];

let filtroActivo = "todas";

// ---------------------------------------------------------------------------

export async function renderBienestar(container) {
  container.innerHTML = `<div class="view-loading">Cargando los planes en marcha...</div>`;

  const { data: acciones, error } = await supabase
    .from("eva_pdi")
    .select(
      "*, evaluacion:evaluacion_id(id, estado, evaluado:evaluado_id(id, nombre, cargo), evaluador:evaluador_id(nombre), ciclo:ciclo_id(titulo, fecha_apertura))"
    )
    .order("fecha_cierre", { nullsFirst: false });

  if (error) {
    container.innerHTML = `
      <div class="placeholder error">
        <h2>No se pudieron cargar los planes</h2>
        <p>${escapeHtml(error.message)}</p>
        <p class="hint">Si dice «permission denied», falta correr <code>database/migracion_eva_flujo_bienestar.sql</code>, que es la que le da lectura del PDI a este rol.</p>
      </div>`;
    return;
  }

  const lista = (acciones || []).map(analizar);

  if (!lista.length) {
    container.innerHTML = `
      <div class="view-eva">
        ${cabecera()}
        <div class="ficha-seccion-vacia">
          Todavía no hay planes de desarrollo en marcha. Aparecen acá en cuanto una jefatura cierra una
          evaluación con su plan de acción.
        </div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="view-eva">
      ${cabecera()}
      ${bloqueKPIs(lista)}
      ${bloqueFiltros(lista)}
      <div id="lista-personas">${personas(lista)}</div>
    </div>`;

  enganchar(container, lista);
}

function cabecera() {
  return `
    <div class="bienestar-head">
      <h3>Puesta en marcha de los planes de desarrollo</h3>
      <p class="hint">
        Estas son las acciones que las jefaturas acordaron con cada persona en su entrevista de evaluación.
        Tu rol es que ocurran: registrar los dos controles de seguimiento y mover el estado.
        Las acciones en sí no se editan desde acá — son el acuerdo de la reunión.
      </p>
    </div>`;
}

// ---------------------------------------------------------------------------
// KPIs — cuentan hechos, no etiquetas
// ---------------------------------------------------------------------------

function bloqueKPIs(lista) {
  const activas = lista.filter((a) => !a.completada);
  const completadas = lista.filter((a) => a.completada).length;
  const porcentaje = lista.length ? Math.round((completadas / lista.length) * 100) : 0;
  const vencidas = activas.filter((a) => a.vencida).length;
  const porVencer = activas.filter((a) => a.porVencer).length;
  const sinRevisar = activas.filter((a) => a.sinControl1).length;
  const personasConAtraso = new Set(activas.filter((a) => a.vencida).map((a) => a.evaluacion?.evaluado?.id)).size;
  const totalPersonas = new Set(lista.map((a) => a.evaluacion?.evaluado?.id).filter(Boolean)).size;

  return `
    <div class="ficha-kpis">
      <div class="ficha-kpi is-hero">
        <span class="ficha-kpi-label">Avance del seguimiento</span>
        <span class="ficha-kpi-valor">${porcentaje}%</span>
        <div class="ficha-kpi-pie" style="flex-direction:column; align-items:stretch;">
          <div class="bienestar-medidor" role="img" aria-label="${completadas} de ${lista.length} acciones completadas">
            <div class="bienestar-medidor-relleno" style="width:${porcentaje}%"></div>
          </div>
          <span class="ficha-kpi-meta">${completadas} de ${lista.length} acciones completadas</span>
        </div>
      </div>

      <div class="ficha-kpi ${vencidas ? "is-alerta" : ""}">
        <span class="ficha-kpi-label">Vencidas</span>
        <span class="ficha-kpi-valor">${vencidas}</span>
        <div class="ficha-kpi-pie">
          <span class="ficha-kpi-meta">
            ${vencidas ? `en ${personasConAtraso} persona${personasConAtraso === 1 ? "" : "s"}` : "ninguna fuera de plazo"}
          </span>
        </div>
      </div>

      <div class="ficha-kpi">
        <span class="ficha-kpi-label">Vencen en 14 días</span>
        <span class="ficha-kpi-valor">${porVencer}</span>
        <div class="ficha-kpi-pie"><span class="ficha-kpi-meta">${porVencer ? "conviene adelantarse" : "sin plazos próximos"}</span></div>
      </div>

      <div class="ficha-kpi ${sinRevisar ? "is-atencion" : ""}">
        <span class="ficha-kpi-label">Sin revisar</span>
        <span class="ficha-kpi-valor">${sinRevisar}</span>
        <div class="ficha-kpi-pie">
          <span class="ficha-kpi-meta">${sinRevisar ? "acciones activas sin su primer control" : "todas tienen al menos un control"}</span>
        </div>
      </div>

      <div class="ficha-kpi">
        <span class="ficha-kpi-label">Personas con plan</span>
        <span class="ficha-kpi-valor">${totalPersonas}</span>
        <div class="ficha-kpi-pie"><span class="ficha-kpi-meta">${activas.length} acciones activas</span></div>
      </div>
    </div>`;
}

function bloqueFiltros(lista) {
  return `
    <div class="bienestar-filtros" role="group" aria-label="Filtrar acciones">
      ${FILTROS.map((f) => {
        const n = lista.filter(f.test).length;
        return `<button class="bienestar-filtro ${f.clave === filtroActivo ? "is-activo" : ""}" data-filtro="${f.clave}">
          ${f.label} <span>${n}</span>
        </button>`;
      }).join("")}
    </div>`;
}

// ---------------------------------------------------------------------------
// Una tarjeta por persona
// ---------------------------------------------------------------------------

function personas(lista) {
  const test = FILTROS.find((f) => f.clave === filtroActivo)?.test || (() => true);
  const visibles = lista.filter(test);

  if (!visibles.length) {
    return `<div class="ficha-seccion-vacia">Ninguna acción cae en este filtro.</div>`;
  }

  // Agrupadas por persona, y las personas ordenadas por urgencia: primero quien
  // tiene acciones vencidas, y entre esas, quien tiene más.
  const porPersona = new Map();
  for (const a of visibles) {
    const p = a.evaluacion?.evaluado;
    const key = p?.id || "sin-persona";
    if (!porPersona.has(key)) porPersona.set(key, { persona: p, acciones: [] });
    porPersona.get(key).acciones.push(a);
  }

  const grupos = [...porPersona.values()].sort((x, y) => {
    const vx = x.acciones.filter((a) => a.vencida).length;
    const vy = y.acciones.filter((a) => a.vencida).length;
    if (vx !== vy) return vy - vx;
    return String(x.persona?.nombre || "").localeCompare(String(y.persona?.nombre || ""));
  });

  return grupos.map(tarjetaPersona).join("");
}

function tarjetaPersona({ persona, acciones }) {
  const total = acciones.length;
  const completadas = acciones.filter((a) => a.completada).length;
  const vencidas = acciones.filter((a) => a.vencida).length;
  const sinRevisar = acciones.filter((a) => !a.completada && a.sinControl1).length;
  const pct = total ? Math.round((completadas / total) * 100) : 0;
  const ciclo = acciones[0]?.evaluacion?.ciclo?.titulo;
  const jefatura = acciones[0]?.evaluacion?.evaluador?.nombre;

  const resumen = [
    vencidas ? `<span class="badge badge-danger">${vencidas} vencida${vencidas === 1 ? "" : "s"}</span>` : "",
    sinRevisar ? `<span class="badge badge-warning">${sinRevisar} sin revisar</span>` : "",
    !vencidas && !sinRevisar && completadas === total ? `<span class="badge badge-success">Plan completo</span>` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="card persona-card">
      <div class="persona-head">
        <div class="persona-ident">
          <div class="ficha-avatar" style="width:42px; height:42px; font-size:15px;">${escapeHtml(initials(persona?.nombre))}</div>
          <div>
            <h4 class="persona-nombre">${escapeHtml(persona?.nombre || "Sin asignar")}</h4>
            <p class="persona-meta">
              ${escapeHtml(persona?.cargo || "Sin cargo")}${ciclo ? ` · ${escapeHtml(ciclo)}` : ""}
              ${jefatura ? `<br>Plan definido por ${escapeHtml(jefatura)}` : ""}
            </p>
          </div>
        </div>
        <div class="persona-estado">
          ${resumen}
          <div class="persona-avance">
            <div class="bienestar-medidor" role="img" aria-label="${completadas} de ${total} acciones completadas">
              <div class="bienestar-medidor-relleno" style="width:${pct}%"></div>
            </div>
            <span class="hint">${completadas} de ${total} completadas</span>
          </div>
        </div>
      </div>

      <ul class="accion-lista">
        ${acciones.map(filaAccion).join("")}
      </ul>
    </div>`;
}

function filaAccion(a) {
  const seg = seguimiento(a);
  const yaCerrada = a.completada && !a.sinControl1 && !a.sinControl2;

  return `
    <li class="accion-item ${a.vencida ? "is-vencida" : ""} ${a.completada ? "is-completada" : ""}">
      <div class="accion-cabeza">
        <span class="accion-dim">${escapeHtml(a.dimension_criterio || "Transversal")}</span>
        <span class="badge ${PDI_ESTADO_BADGE[a.estado_accion] || "badge-neutral"}">
          ${escapeHtml(PDI_ESTADO_LABELS[a.estado_accion] || a.estado_accion || "—")}
        </span>
      </div>

      <p class="accion-texto">${escapeHtml(a.accion_smart || "—")}</p>

      <div class="accion-pie">
        <span class="accion-dato">
          <span class="accion-dato-label">Cierre</span>
          ${formatDate(a.fecha_cierre) || "—"}
        </span>
        <span class="accion-dato">
          <span class="accion-dato-label">Plazo</span>
          <span class="badge ${a.etiqueta.badge}">${escapeHtml(a.etiqueta.texto)}</span>
        </span>
        <span class="accion-dato">
          <span class="accion-dato-label">Seguimiento</span>
          <span class="accion-seg ${seg.clase}">${escapeHtml(seg.texto)}</span>
        </span>
        <button class="btn ${a.vencida || a.sinControl1 ? "btn-primary" : "btn-secondary"}" data-control="${a.id}">
          ${yaCerrada ? "Ver seguimiento" : a.sinControl1 ? "Registrar 1er control" : "Registrar 2do control"}
        </button>
      </div>
    </li>`;
}

// ---------------------------------------------------------------------------

function enganchar(container, lista) {
  container.querySelectorAll("[data-filtro]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filtroActivo = btn.dataset.filtro;
      container.querySelectorAll("[data-filtro]").forEach((b) => b.classList.toggle("is-activo", b === btn));
      document.getElementById("lista-personas").innerHTML = personas(lista);
      engancharBotones(container, lista);
    });
  });
  engancharBotones(container, lista);
}

function engancharBotones(container, lista) {
  container.querySelectorAll("[data-control]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = lista.find((x) => x.id === btn.dataset.control);
      if (a) abrirModalControl(a, container);
    });
  });
}

function abrirModalControl(accion, container) {
  const siguiente = !accion.control_1_fecha ? 1 : 2;
  const nombre = accion.evaluacion?.evaluado?.nombre || "la persona";
  const ambosHechos = !!accion.control_1_fecha && !!accion.control_2_fecha;

  Modal.open({
    title: `Seguimiento · ${nombre}`,
    size: "lg",
    content: `
      <div class="bienestar-contexto">
        <span class="eva-respuesta-label">La acción acordada</span>
        <p>${escapeHtml(accion.accion_smart || "—")}</p>
        <div class="stat-row"><span>Dimensión</span><span>${escapeHtml(accion.dimension_criterio || "—")}</span></div>
        <div class="stat-row"><span>Responsable de apoyo</span><span>${escapeHtml(accion.responsable_apoyo || "—")}</span></div>
        <div class="stat-row"><span>Recursos comprometidos</span><span>${escapeHtml(accion.recursos || "—")}</span></div>
        <div class="stat-row"><span>Plazo</span><span>${formatDate(accion.fecha_inicio) || "—"} → ${formatDate(accion.fecha_cierre) || "—"}</span></div>
        <div class="stat-row"><span>Definida por</span><span>${escapeHtml(accion.evaluacion?.evaluador?.nombre || "—")}</span></div>
      </div>

      ${accion.control_1_fecha ? controlPrevio(1, accion.control_1_fecha, accion.control_1_obs) : ""}
      ${accion.control_2_fecha ? controlPrevio(2, accion.control_2_fecha, accion.control_2_obs) : ""}

      ${
        ambosHechos
          ? `<p class="hint" style="margin-top:14px;">
               Los dos controles que pide el plan ya están registrados. Si necesitas corregir alguno, puedes volver a
               guardarlo eligiendo su número.
             </p>`
          : ""
      }

      <form id="form-control">
        <h4 style="margin:16px 0 8px;">${ambosHechos ? "Corregir un control" : `Registrar el ${siguiente === 1 ? "primer" : "segundo"} control`}</h4>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Nº de control</label>
            <select id="ct-nro">
              <option value="1" ${siguiente === 1 ? "selected" : ""}>1er control</option>
              <option value="2" ${siguiente === 2 ? "selected" : ""}>2do control</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Fecha<span class="req">*</span></label>
            <input type="date" id="ct-fecha" required value="${hoyISO()}">
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Observación del control<span class="req">*</span></label>
          <textarea id="ct-obs" rows="4" required placeholder="Qué se verificó, con qué evidencia, y qué queda pendiente"></textarea>
        </div>
        <div class="form-field">
          <label class="form-label">¿Cómo queda la acción?</label>
          <select id="ct-estado">
            <option value="">Sin cambio (${escapeHtml(PDI_ESTADO_LABELS[accion.estado_accion] || "—")})</option>
            <option value="pendiente">Pendiente — todavía no arranca</option>
            <option value="en_curso">En curso</option>
            <option value="completada">Completada</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-ct">Cerrar</button>
          <button type="submit" class="btn btn-primary">Guardar el control</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-ct").addEventListener("click", Modal.close);

  document.getElementById("form-control").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    // La escritura va por la función: es la única puerta que este rol tiene
    // sobre el PDI, y solo toca los campos de seguimiento.
    const { error } = await supabase.rpc("eva_pdi_registrar_control", {
      p_pdi_id: accion.id,
      p_nro_control: Number(document.getElementById("ct-nro").value),
      p_fecha: document.getElementById("ct-fecha").value,
      p_observacion: document.getElementById("ct-obs").value.trim(),
      p_estado_accion: document.getElementById("ct-estado").value || null,
    });

    if (error) {
      Toast.error("No se pudo guardar el control", error.message);
      btn.disabled = false;
      btn.textContent = "Guardar el control";
      return;
    }

    Modal.close();
    Toast.success("Control registrado", `Quedó en el seguimiento de ${nombre}.`);
    await renderBienestar(container);
  });
}

function controlPrevio(nro, fecha, obs) {
  return `
    <div class="bienestar-control-previo">
      <span class="eva-respuesta-label">${nro === 1 ? "1er" : "2do"} control · ${formatDate(fecha)}</span>
      <p>${escapeHtml(obs || "Sin observación registrada")}</p>
    </div>`;
}
