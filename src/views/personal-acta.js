/**
 * Acta de cierre de la evaluación — Hoja 7 de la planilla oficial.
 *
 * Es el registro formal del cierre y necesita CUATRO firmas, en este orden:
 *
 *   trabajador evaluado y supervisor directo  → en cualquier orden
 *   Jefatura de RRHH                          → visto bueno del proceso
 *   Jefatura de Bienestar y Crecimiento       → recibe el expediente y cierra
 *
 * La última es la que cierra la evaluación. Va al final porque su declaración
 * dice que recibió el expediente para cargar las líneas en la DNC del programa
 * anual: firmar eso antes del visto bueno de RRHH sería recibir algo que
 * todavía puede cambiar.
 *
 * Un punto que conviene no perder de vista al leer este archivo: la firma del
 * trabajador NO es una conformidad. La declaración de la Hoja 7 lo dice
 * textualmente — «mi firma no implica necesariamente acuerdo con la
 * calificación; implica que se me comunicaron los resultados y que recibí
 * copia». Su conformidad o disconformidad ya quedó registrada aparte, en las
 * preguntas de cierre, y no cambia por firmar acá. La pantalla lo dice explícito
 * para que nadie firme creyendo que está renunciando a objetar.
 *
 * Cada firma guarda quién estaba autenticado, el nombre y el RUT declarados, la
 * fecha y hora, y el texto exacto de la declaración vigente en ese momento. Una
 * vez puesta no se puede modificar ni borrar: lo impide un trigger en la base,
 * no la interfaz.
 */

import { supabase } from "../core/supabase.js";
import { state } from "../core/state.js";
import { Toast, Confirm } from "../ui/toast.js";
import { escapeHtml, formatDate } from "../ui/utils.js";
import {
  ROL_FIRMANTE_LABELS,
  CATEGORIA_LABELS,
  CATEGORIA_BADGE,
  ESTADO_LABELS,
  PDI_ESTADO_LABELS,
} from "./personal-flujo.js";
import { resumenChecklistHTML } from "./personal-checklist.js";

const ORDEN_FIRMAS = ["trabajador", "supervisor", "rrhh", "bienestar"];
const TOTAL_FIRMAS = ORDEN_FIRMAS.length;
const n2 = (v) => (v == null ? "—" : String(Math.round(Number(v) * 100) / 100));

const fechaHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${formatDate(iso)} a las ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Qué rol le toca firmar a quien está mirando, si le toca alguno. */
function miRol(ev, firmadas) {
  const uid = state.user?.id;
  const rolEn = (r) => state.accesos?.some((a) => a.modulo === "personal" && a.rol === r);
  const esRRHH = state.user?.esAdmin || rolEn("rrhh");
  const esBienestar = state.user?.esAdmin || rolEn("crecimiento_bienestar");

  if (ev.evaluado_id === uid && !firmadas.trabajador) return "trabajador";
  if (ev.evaluador_id === uid && !firmadas.supervisor) return "supervisor";
  if (esRRHH && !firmadas.rrhh) {
    // El visto bueno de RRHH va después del trabajador y del supervisor.
    if (firmadas.trabajador && firmadas.supervisor) return "rrhh";
    return "rrhh_en_espera";
  }
  if (esBienestar && !firmadas.bienestar) {
    if (firmadas.rrhh) return "bienestar";
    return "bienestar_en_espera";
  }
  return null;
}

export async function renderActa(container, evaluacionId) {
  container.innerHTML = `<div class="view-loading">Cargando el acta...</div>`;

  const [
    { data: ev, error },
    { data: firmas },
    { data: declaraciones },
    { data: pdi },
    { data: descartes },
    { data: candidaturas },
  ] = await Promise.all([
    supabase
      .from("eva_evaluaciones")
      .select("*, evaluado:evaluado_id(nombre, cargo), evaluador:evaluador_id(nombre, cargo), ciclo:ciclo_id(titulo, tipo_periodo)")
      .eq("id", evaluacionId)
      .single(),
    supabase.from("eva_firmas").select("*").eq("evaluacion_id", evaluacionId),
    supabase.from("eva_declaraciones").select("*").eq("vigente", true),
    supabase
      .from("eva_pdi")
      .select("nro, dimension_criterio, accion_smart, fecha_cierre, estado_accion, curso_codigo, prioridad, origen, horas, precio_ref")
      .eq("evaluacion_id", evaluacionId)
      .order("prioridad", { ascending: true, nullsFirst: true })
      .order("nro"),
    // Lo que el motor propuso y la conversación descartó. Va en el acta porque
    // el ítem B8 del checklist exige que quede justificado por escrito: si sólo
    // viviera en la base, el expediente firmado no diría qué se dejó afuera.
    supabase
      .from("eva_pdi_descartes")
      .select("curso_codigo, criterio_codigo, prioridad, motivo")
      .eq("evaluacion_id", evaluacionId),
    // Las candidaturas a relator N4 van en el acta: son reconocimiento formal y
    // la persona tiene derecho a que quede escrito, resuelto o no.
    supabase
      .from("eva_relator_candidaturas")
      .select("dominio_sugerido, dimension_codigo, criterio_codigo, nota, estado, observaciones")
      .eq("evaluacion_id", evaluacionId),
  ]);

  if (error || !ev) {
    container.innerHTML = `<div class="placeholder error"><h2>No se pudo cargar el acta</h2><p>${escapeHtml(error?.message || "")}</p></div>`;
    return;
  }

  const firmadas = {};
  (firmas || []).forEach((f) => (firmadas[f.rol_firmante] = f));

  const declPorRol = {};
  (declaraciones || []).forEach((d) => (declPorRol[d.rol_firmante] = d));

  const rol = miRol(ev, firmadas);
  const resumenChk = await resumenChecklistHTML(evaluacionId);

  container.innerHTML = `
    <div class="view-eva">
      <button class="btn btn-secondary" id="btn-volver-acta" style="margin-bottom:16px;">← Volver</button>

      <div class="card acta-card">
        <div class="eva-head">
          <div>
            <h3 style="margin-bottom:2px;">Acta de cierre de la evaluación</h3>
            <p class="hint" style="margin:0;">
              ${escapeHtml(ev.evaluado?.nombre || "")} · ${escapeHtml(ev.ciclo?.titulo || "")}
            </p>
          </div>
          <span class="badge ${Object.keys(firmadas).length === TOTAL_FIRMAS ? "badge-success" : "badge-warning"}">
            ${Object.keys(firmadas).length} de ${TOTAL_FIRMAS} firmas
          </span>
        </div>

        ${bloqueResumen(ev)}
      </div>

      ${bloquePDI(pdi || [])}
      ${bloqueCandidaturas(candidaturas || [])}
      ${bloqueDescartes(descartes || [])}
      ${bloqueDerivacion(ev)}
      ${resumenChk ? `<div class="card" style="margin-top:20px;"><h3>Cumplimiento de la pauta de entrevista</h3>${resumenChk}</div>` : ""}
      ${bloqueDeclaracionTrabajador(ev)}
      ${bloqueFirmas(ev, firmadas)}
      ${bloqueFirmar(ev, rol, declPorRol, firmadas)}
    </div>
  `;

  document.getElementById("btn-volver-acta").addEventListener("click", () => window.Router.go("personal"));
  document.getElementById("btn-descargar-acta")?.addEventListener("click", () => descargarActa(ev, firmadas, pdi || [], candidaturas || []));
  engancharFirma(container, ev, rol);
}

// ---------------------------------------------------------------------------

function bloqueResumen(ev) {
  const cat = CATEGORIA_LABELS[ev.categoria];
  return `
    <div class="eva-totales">
      <div class="eva-total">
        <span class="eva-total-label">Total ponderado</span>
        <span class="eva-total-valor">${n2(ev.total_sup)}</span>
      </div>
      <div class="eva-total">
        <span class="eva-total-label">Categoría</span>
        <span class="eva-total-valor">${cat ? `<span class="badge ${CATEGORIA_BADGE[ev.categoria]}">${escapeHtml(cat)}</span>` : "—"}</span>
      </div>
      <div class="eva-total">
        <span class="eva-total-label">Estado</span>
        <span class="eva-total-valor" style="font-size:15px;">${escapeHtml(ESTADO_LABELS[ev.estado] || ev.estado)}</span>
      </div>
    </div>
    <div class="stat-row"><span>Evaluador</span><span>${escapeHtml(ev.evaluador?.nombre || "—")}</span></div>
    <div class="stat-row"><span>Entrevista realizada el</span><span>${formatDate(ev.reunion_fecha) || "—"}</span></div>
    <div class="stat-row"><span>Recomendación final</span><span>${escapeHtml(ev.recomendacion_final || "—")}</span></div>
    ${ev.justificacion_recomendacion ? `<div class="eva-respuesta"><span class="eva-respuesta-label">Justificación</span><p>${escapeHtml(ev.justificacion_recomendacion)}</p></div>` : ""}`;
}

const PRIORIDAD_SIGLA = { 1: "P1", 2: "P2", 3: "P3", 4: "P4" };

const CAND_ESTADO = {
  propuesta: "Propuesta — pendiente del Comité",
  aceptada: "Aceptada",
  postergada: "Postergada",
  descartada: "Descartada",
  formado: "Formado como relator",
};

/**
 * Candidaturas a relator interno N4. Van en el acta porque son la mitad buena
 * del resultado: si sólo quedara la lista de brechas, el expediente de alguien
 * excelente diría únicamente lo que le falta.
 */
function bloqueCandidaturas(cands) {
  if (!cands.length) return "";
  return `
    <div class="card" style="margin-top:20px;">
      <h3>Candidaturas a relator interno N4</h3>
      <p class="hint" style="margin:-2px 0 12px;">
        Salieron de los criterios con nota 5: «el que sabe, enseña». Las resuelve el Comité de Capacitación —
        una candidatura propuesta no compromete a nadie todavía.
      </p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>Dominio</th><th>Respaldo</th><th>Estado</th><th>Observaciones</th></tr></thead>
          <tbody>
            ${cands.map((c) => `<tr>
              <td><strong>${escapeHtml(c.dominio_sugerido || c.dimension_codigo || "—")}</strong></td>
              <td>${escapeHtml(c.criterio_codigo || "—")}${c.nota ? ` · nota ${c.nota}` : ""}</td>
              <td>${escapeHtml(CAND_ESTADO[c.estado] || c.estado || "—")}</td>
              <td>${escapeHtml(c.observaciones || "—")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/** Lo que el motor propuso y la entrevista dejó afuera, con su justificación. */
function bloqueDescartes(descartes) {
  if (!descartes.length) return "";
  return `
    <div class="card" style="margin-top:20px;">
      <h3>Líneas propuestas que se descartaron</h3>
      <p class="hint" style="margin:-2px 0 12px;">
        El motor las propuso y la conversación decidió no incluirlas. Queda por escrito, como pide la pauta de la
        entrevista: la propuesta es automática, la decisión no.
      </p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>Prioridad</th><th>Curso</th><th>Criterio</th><th>Por qué se descartó</th></tr></thead>
          <tbody>
            ${descartes
              .map(
                (d) => `<tr>
                  <td>${d.prioridad ? PRIORIDAD_SIGLA[d.prioridad] : "—"}</td>
                  <td>${escapeHtml(d.curso_codigo || "—")}</td>
                  <td>${escapeHtml(d.criterio_codigo || "—")}</td>
                  <td>${escapeHtml(d.motivo || "—")}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/**
 * Derivación del expediente — hoja 08 de la planilla v2.0. Se llena sola con
 * cada firma de jefatura; el número de acta del Comité es dato externo.
 */
function bloqueDerivacion(ev) {
  if (!ev.derivado_rrhh_en && !ev.derivado_bienestar_en) return "";
  return `
    <div class="card" style="margin-top:20px;">
      <h3>Derivación del expediente</h3>
      <p class="hint" style="margin:-2px 0 12px;">
        Las líneas del PDI viajan a la DNC del programa anual sin las notas ni los comentarios de la evaluación:
        Bienestar y Crecimiento recibe qué capacitar, no el detalle del desempeño.
      </p>
      <div class="stat-row"><span>Enviado a Jefatura de RRHH</span><span>${ev.derivado_rrhh_en ? fechaHora(ev.derivado_rrhh_en) : "Pendiente"}</span></div>
      <div class="stat-row"><span>Enviado a Jefatura de Bienestar y Crecimiento</span><span>${ev.derivado_bienestar_en ? fechaHora(ev.derivado_bienestar_en) : "Pendiente"}</span></div>
      <div class="stat-row"><span>Líneas cargadas en la DNC</span><span>${ev.lineas_cargadas_dnc ?? "—"}</span></div>
      <div class="stat-row"><span>N° de acta del Comité que las aprueba</span><span>${escapeHtml(ev.acta_comite || "Por asignar")}</span></div>
    </div>`;
}
const clp = (v) => (v == null ? "—" : "$" + Number(v).toLocaleString("es-CL"));

function bloquePDI(pdi) {
  if (!pdi.length) return "";
  const horas = pdi.reduce((a, x) => a + (x.horas || 0), 0);
  const costo = pdi.reduce((a, x) => a + (x.precio_ref || 0), 0);
  const cursos = pdi.filter((x) => x.curso_codigo).length;

  return `
    <div class="card" style="margin-top:20px;">
      <h3>Plan de Desarrollo Individual sellado</h3>
      <p class="hint" style="margin:-2px 0 12px;">
        Es parte de lo que se firma: las cuatro partes declaran conocer este plan.
        ${cursos ? `${cursos} de las ${pdi.length} líneas son cursos de la batería corporativa — ${horas} h, ${clp(costo)} de costo externo de referencia.` : ""}
      </p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>N°</th><th>Prioridad</th><th>Curso</th><th>Dimensión</th><th>Acción</th><th>Cierre</th></tr></thead>
          <tbody>
            ${pdi
              .map(
                (a) => `<tr>
                  <td>${a.nro ?? "—"}</td>
                  <td>${a.prioridad ? PRIORIDAD_SIGLA[a.prioridad] : a.origen === "conducta" ? "Conducta" : "—"}</td>
                  <td>${escapeHtml(a.curso_codigo || "—")}</td>
                  <td>${escapeHtml(a.dimension_criterio || "—")}</td>
                  <td>${escapeHtml(a.accion_smart || "—")}</td>
                  <td>${formatDate(a.fecha_cierre) || "—"}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/** La declaración de conformidad que el evaluado ya dio, mostrada como dato del acta. */
function bloqueDeclaracionTrabajador(ev) {
  const etiqueta = { conforme: "Sí, conforme", parcialmente: "Parcialmente", no_conforme: "No conforme" }[ev.acuerdo_trabajador] || "—";
  const clase = ev.acuerdo_trabajador === "conforme" ? "is-ok" : ev.acuerdo_trabajador === "parcialmente" ? "is-atencion" : "is-alerta";

  return `
    <div class="card" style="margin-top:20px;">
      <h3>Declaración del trabajador</h3>
      <div class="eva-nota-cierre ${ev.acuerdo_trabajador ? clase : ""}">
        <strong>¿Está de acuerdo con la calificación?</strong> ${escapeHtml(etiqueta)}
        ${ev.fecha_respuesta_conformidad ? `<br><span class="hint">Respondido el ${fechaHora(ev.fecha_respuesta_conformidad)}</span>` : ""}
      </div>
      ${ev.observaciones_trabajador ? `<div class="eva-respuesta"><span class="eva-respuesta-label">Sus observaciones</span><p>${escapeHtml(ev.observaciones_trabajador)}</p></div>` : ""}
      <p class="hint" style="margin-top:10px;">
        Esta declaración ya quedó registrada al responder las preguntas de cierre y <strong>no cambia por firmar el
        acta</strong>: son dos cosas distintas y así lo dice la declaración que cada uno firma.
      </p>
    </div>`;
}

function bloqueFirmas(ev, firmadas) {
  return `
    <div class="card" style="margin-top:20px;">
      <h3>Firmas</h3>
      <div class="acta-firmas">
        ${ORDEN_FIRMAS.map((r) => {
          const f = firmadas[r];
          return `
          <div class="acta-firma ${f ? "is-firmada" : ""}">
            <span class="acta-firma-rol">${escapeHtml(ROL_FIRMANTE_LABELS[r])}</span>
            ${
              f
                ? `<span class="acta-firma-nombre">${escapeHtml(f.nombre_declarado)}</span>
                   <span class="acta-firma-rut">RUT ${escapeHtml(f.rut_declarado)}</span>
                   <span class="acta-firma-fecha">Firmado el ${fechaHora(f.firmado_en)}</span>
                   <details class="viz-tabla" style="margin-top:6px;">
                     <summary>Ver lo que firmó</summary>
                     <p class="acta-declaracion-texto">${escapeHtml(f.declaracion_texto)}</p>
                   </details>`
                : `<span class="acta-firma-pendiente">Pendiente</span>`
            }
          </div>`;
        }).join("")}
      </div>
      ${
        Object.keys(firmadas).length === TOTAL_FIRMAS
          ? `<div class="form-actions" style="margin-top:16px;">
               <button class="btn btn-secondary" id="btn-descargar-acta">⬇ Descargar el acta</button>
             </div>`
          : `<p class="hint" style="margin-top:12px;">
               Cuando estén las cuatro firmas, la evaluación se cierra automáticamente y el acta queda descargable.
             </p>`
      }
    </div>`;
}

const TITULO_FIRMA = {
  trabajador: "Firma el acta",
  supervisor: "Firma como supervisor directo",
  rrhh: "Visto bueno de RRHH",
  bienestar: "Recepción del expediente y cierre",
};

function bloqueFirmar(ev, rol, declPorRol, firmadas) {
  if (!rol) {
    return `
      <div class="card eva-espera" style="margin-top:20px;">
        <h3>No hay nada pendiente de tu parte</h3>
        <p class="lead" style="margin:0;">
          ${Object.keys(firmadas).length === TOTAL_FIRMAS
            ? `El acta está completa con las ${TOTAL_FIRMAS} firmas.`
            : "Falta la firma de las otras partes. Cuando firmen, se cierra sola."}
        </p>
      </div>`;
  }

  if (rol === "rrhh_en_espera") {
    return `
      <div class="card eva-espera" style="margin-top:20px;">
        <h3>Tu visto bueno viene después</h3>
        <p class="lead" style="margin:0;">
          Primero tienen que firmar el trabajador y su supervisor directo. Cuando los dos hayan firmado te va a llegar
          el aviso para dar el visto bueno del proceso.
        </p>
      </div>`;
  }

  if (rol === "bienestar_en_espera") {
    return `
      <div class="card eva-espera" style="margin-top:20px;">
        <h3>Tu firma va al final</h3>
        <p class="lead" style="margin:0;">
          Falta el visto bueno de la Jefatura de RRHH. Cuando lo dé te llega el aviso: tu firma es la que cierra la
          evaluación, y con ella recibes el expediente para cargar las líneas del PDI en la DNC del programa anual.
        </p>
      </div>`;
  }

  const decl = declPorRol[rol];
  const soyElTrabajador = rol === "trabajador";

  return `
    <div class="card eva-accion" style="margin-top:20px;">
      <h3>${TITULO_FIRMA[rol] || "Firma el acta"}</h3>
      ${rol === "bienestar"
        ? `<p class="hint" style="margin:-6px 0 12px;">Es la última firma: al ponerla, la evaluación queda cerrada
             y el sistema anota cuántas líneas del PDI quedaron para cargar en la DNC.</p>`
        : ""}

      <div class="acta-declaracion">
        <span class="eva-respuesta-label">Lo que estás firmando</span>
        <p>${escapeHtml(decl?.texto || "(declaración no configurada — falta correr la migración)")}</p>
      </div>

      ${
        soyElTrabajador
          ? `<div class="eva-nota-cierre is-atencion">
               <strong>Firmar no es estar de acuerdo.</strong> Tu declaración de conformidad ya quedó registrada
               y no cambia por esto. Si declaraste no estar conforme, esa objeción sigue en pie y RRHH la va a revisar
               igual: firmar acá solo acredita que participaste de la entrevista y que conoces tu plan.
             </div>`
          : ""
      }

      <form id="form-firma">
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Nombre completo<span class="req">*</span></label>
            <input type="text" id="fi-nombre" required value="${escapeHtml(state.user?.nombre || "")}">
          </div>
          <div class="form-field">
            <label class="form-label">RUT<span class="req">*</span></label>
            <input type="text" id="fi-rut" required placeholder="12.345.678-9">
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">
            <input type="checkbox" id="fi-acepto" required style="width:auto; margin-right:7px;">
            He leído la declaración de arriba y la firmo
          </label>
        </div>
        <p class="hint" style="margin-bottom:12px;">
          Queda registrado con tu cuenta, la fecha y la hora. Una firma no se puede modificar ni borrar después.
        </p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Firmar</button>
        </div>
      </form>
    </div>`;
}

// ---------------------------------------------------------------------------

function engancharFirma(container, ev, rol) {
  const form = document.getElementById("form-firma");
  if (!form || !rol || rol.endsWith("_en_espera")) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("fi-nombre").value.trim();
    const rut = document.getElementById("fi-rut").value.trim();

    const ok = await Confirm.ask({
      title: "¿Firmar el acta?",
      text: "Una vez registrada, la firma no se puede modificar ni eliminar.",
      confirmText: "Firmar",
    });
    if (!ok) return;

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Firmando...";

    const { data, error } = await supabase.rpc("eva_firmar_acta", {
      p_evaluacion_id: ev.id,
      p_rol_firmante: rol,
      p_nombre: nombre,
      p_rut: rut,
    });

    if (error) {
      Toast.error("No se pudo firmar", error.message);
      btn.disabled = false;
      btn.textContent = "Firmar";
      return;
    }

    if (data?.cerrada) {
      Toast.success("Acta completa", "Con las cuatro firmas la evaluación quedó cerrada formalmente.");
    } else {
      Toast.success("Firma registrada", `Van ${data?.firmas || 1} de ${TOTAL_FIRMAS} firmas.`);
    }

    await renderActa(container, ev.id);
  });
}

// ---------------------------------------------------------------------------
// Acta descargable
// ---------------------------------------------------------------------------

/**
 * El acta como HTML autocontenido, listo para imprimir o guardar en PDF desde
 * el navegador. No se usa una librería de PDF a propósito: el proyecto no tiene
 * ninguna y este documento es lo bastante simple como para no justificar
 * sumarla al bundle.
 */
function descargarActa(ev, firmadas, pdi, cands = []) {
  const esc = (s) => String(s ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const acuerdo = { conforme: "Sí, conforme", parcialmente: "Parcialmente", no_conforme: "No conforme" }[ev.acuerdo_trabajador] || "—";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Acta de cierre · ${esc(ev.evaluado?.nombre)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font: 12px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; max-width: 760px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 19px; margin: 0 0 2px; color: #001A5A; }
  h2 { font-size: 13px; margin: 26px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #009BDB; color: #001A5A; }
  .sub { color: #5a6b85; margin: 0 0 20px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e3e8ef; vertical-align: top; }
  th { background: #f5f7fb; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #5a6b85; }
  .fila { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e3e8ef; }
  .fila span:first-child { color: #5a6b85; }
  .decl { background: #fafbfd; border: 1px solid #e3e8ef; border-radius: 8px; padding: 12px 14px; margin: 10px 0; font-size: 11.5px; }
  .firma { border: 1px solid #e3e8ef; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
  .firma-rol { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #8b97ad; font-weight: 700; }
  .firma-nombre { font-size: 14px; font-weight: 700; display: block; margin: 3px 0 1px; }
  .firma-meta { font-size: 11px; color: #5a6b85; }
  .pie { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e3e8ef; font-size: 10px; color: #8b97ad; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <h1>Acta de cierre de evaluación de desempeño</h1>
  <p class="sub">Metalium SpA · Sistema de Gestión de Calidad · Formulario RRHH-FOR-EVA-AD-001</p>

  <h2>Identificación</h2>
  <div class="fila"><span>Trabajador evaluado</span><span><strong>${esc(ev.evaluado?.nombre)}</strong></span></div>
  <div class="fila"><span>Cargo</span><span>${esc(ev.evaluado?.cargo)}</span></div>
  <div class="fila"><span>Período evaluado</span><span>${esc(ev.ciclo?.titulo)}</span></div>
  <div class="fila"><span>Evaluador (supervisor directo)</span><span>${esc(ev.evaluador?.nombre)}</span></div>
  <div class="fila"><span>Fecha de la entrevista</span><span>${esc(formatDate(ev.reunion_fecha))}</span></div>
  <div class="fila"><span>N° de evaluación</span><span>${esc(ev.nro_evaluacion)}</span></div>

  <h2>Resultado</h2>
  <div class="fila"><span>Total ponderado (evaluador)</span><span><strong>${n2(ev.total_sup)}</strong> sobre 5,00</span></div>
  <div class="fila"><span>Total autoevaluación</span><span>${n2(ev.total_auto)}</span></div>
  <div class="fila"><span>Categoría obtenida</span><span><strong>${esc(CATEGORIA_LABELS[ev.categoria] || ev.categoria)}</strong></span></div>
  <div class="fila"><span>Decisión asociada</span><span>${esc(ev.decision_asociada)}</span></div>
  <div class="fila"><span>Recomendación final</span><span><strong>${esc(ev.recomendacion_final)}</strong></span></div>
  ${ev.justificacion_recomendacion ? `<div class="decl"><strong>Justificación:</strong> ${esc(ev.justificacion_recomendacion)}</div>` : ""}

  ${
    pdi.length
      ? `<h2>Plan de Desarrollo Individual sellado</h2>
         <table><thead><tr><th>N°</th><th>Prior.</th><th>Curso</th><th>Dimensión / criterio</th><th>Acción</th><th>Cierre</th></tr></thead><tbody>
         ${pdi.map((a) => `<tr><td>${a.nro ?? ""}</td><td>${a.prioridad ? PRIORIDAD_SIGLA[a.prioridad] : a.origen === "conducta" ? "Conducta" : "—"}</td><td>${esc(a.curso_codigo)}</td><td>${esc(a.dimension_criterio)}</td><td>${esc(a.accion_smart)}</td><td>${esc(formatDate(a.fecha_cierre))}</td></tr>`).join("")}
         </tbody></table>
         <div class="fila"><span>Líneas del PDI</span><span><strong>${pdi.length}</strong></span></div>
         <div class="fila"><span>Horas de capacitación comprometidas</span><span>${pdi.reduce((a, x) => a + (x.horas || 0), 0)} h</span></div>
         <div class="fila"><span>Costo externo de referencia</span><span>${clp(pdi.reduce((a, x) => a + (x.precio_ref || 0), 0))}</span></div>`
      : ""
  }

  ${
    cands.length
      ? `<h2>Candidaturas a relator interno N4</h2>
         <table><thead><tr><th>Dominio</th><th>Respaldo</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody>
         ${cands.map((c) => `<tr><td>${esc(c.dominio_sugerido || c.dimension_codigo)}</td><td>${esc(c.criterio_codigo)}${c.nota ? " · nota " + c.nota : ""}</td><td>${esc(CAND_ESTADO[c.estado] || c.estado)}</td><td>${esc(c.observaciones)}</td></tr>`).join("")}
         </tbody></table>`
      : ""
  }

  <h2>Declaración del trabajador</h2>
  <div class="fila"><span>¿Está de acuerdo con la calificación?</span><span><strong>${esc(acuerdo)}</strong></span></div>
  ${ev.observaciones_trabajador ? `<div class="decl"><strong>Observaciones del trabajador:</strong> ${esc(ev.observaciones_trabajador)}</div>` : ""}

  <h2>Firmas</h2>
  ${ORDEN_FIRMAS.map((r) => {
    const f = firmadas[r];
    if (!f) return `<div class="firma"><span class="firma-rol">${esc(ROL_FIRMANTE_LABELS[r])}</span><span class="firma-nombre">Pendiente</span></div>`;
    return `<div class="firma">
      <span class="firma-rol">${esc(ROL_FIRMANTE_LABELS[r])}</span>
      <span class="firma-nombre">${esc(f.nombre_declarado)}</span>
      <span class="firma-meta">RUT ${esc(f.rut_declarado)} · firmado el ${esc(fechaHora(f.firmado_en))}</span>
      <div class="decl">${esc(f.declaracion_texto)}</div>
    </div>`;
  }).join("")}

  <p class="pie">
    Documento generado por el SGC de Metalium el ${esc(formatDate(new Date().toISOString()))}.
    Las firmas se registraron electrónicamente en el sistema, con la cuenta de cada firmante, y no son modificables.
    Folio ${esc(ev.folio_aprobacion)}. RESERVADO — Ley 19.628 / Ley 21.719.
  </p>
</body></html>`;

  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Acta_cierre_${String(ev.evaluado?.nombre || "evaluacion").replace(/\s+/g, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  Toast.success("Acta descargada", "Ábrela y usa «Imprimir → Guardar como PDF» si la necesitas en PDF.");
}
