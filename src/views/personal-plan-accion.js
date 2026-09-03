/**
 * El penúltimo paso del evaluador: sellar el PDI.
 *
 * TODO LO QUE HAY ACÁ ES RECOMENDACIÓN. Quien designa qué se hace es el
 * evaluador. El sistema no compromete ninguna línea por su cuenta, no descarta
 * nada en silencio y no bloquea el sello: propone, explica de dónde sale cada
 * propuesta, avisa cuando algo queda sin acción, y deja la decisión escrita.
 *
 *   «la nota propone, la conversación decide, el sello compromete y el Comité
 *    financia.»  · RRHH-PRO-EVA-PDI-001
 *
 * La propuesta se lee por SECCIÓN — las cinco dimensiones ponderadas de la
 * evaluación — porque así se lee la planilla y así se conversa en la entrevista.
 * Cada sección trae dos lecturas, y ninguna manda sobre la otra:
 *
 *   · la de la SECCIÓN: su promedio cae en un tramo (NC/PD/C/SE/EX) y ese tramo
 *     dice qué corresponde hacer con la sección completa y con qué amplitud de
 *     paquete de cursos (hoja 06 del listado).
 *   · la del CRITERIO: la nota de cada criterio dispara sus propios cursos con
 *     su propia prioridad (hoja 06_PDI_AUTO de la planilla).
 *
 * Pueden discrepar, y cuando discrepan es cuando la vista sirve: una sección en
 * 4,33 dice «sin cursos por brecha», pero si un criterio de esa sección sacó 1,
 * sus cursos aparecen igual con P1 y marcados como «fuera del filtro de la
 * sección». El evaluador ve las dos cosas y resuelve.
 *
 * Los ocho criterios conductuales no proponen curso nunca: proponen el texto de
 * un compromiso con fecha. Están dentro de su sección, no en un bloque aparte,
 * para que se lean junto al promedio que los explica.
 */

import { supabase } from "../core/supabase.js";
import { Toast, Confirm } from "../ui/toast.js";
import { escapeHtml } from "../ui/utils.js";
import { CATEGORIA_LABELS, CATEGORIA_BADGE, lecturaBrecha } from "./personal-flujo.js";
import { checklistHTML, engancharChecklist, guardarChecklist } from "./personal-checklist.js";

/** Sobre este número de líneas, un PDI deja de seguirse en la práctica. */
const LINEAS_INSEGUIBLES = 12;

const n2 = (v) => (v == null ? "—" : Number(v).toFixed(2).replace(".", ","));
const hoyISO = () => new Date().toISOString().slice(0, 10);
const clp = (v) => (v == null ? "—" : "$" + Number(v).toLocaleString("es-CL"));
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

function enDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + (dias || 90));
  return d.toISOString().slice(0, 10);
}

const PRIORIDAD_META = {
  1: { sigla: "P1", nombre: "Brechas críticas", clase: "is-p1" },
  2: { sigla: "P2", nombre: "Brechas de desempeño", clase: "is-p2" },
  3: { sigla: "P3", nombre: "Obligatorios de la batería del cargo", clase: "is-p3" },
  4: { sigla: "P4", nombre: "Refuerzos opcionales", clase: "is-p4" },
};

/** Cómo se lee el tramo de una sección de un vistazo. */
const TRAMO_META = {
  NC: { clase: "is-nc", forma: "■", etiqueta: "Crítico" },
  PD: { clase: "is-pd", forma: "■", etiqueta: "Por debajo" },
  C: { clase: "is-c", forma: "▲", etiqueta: "Satisfactorio" },
  SE: { clase: "is-se", forma: "✔", etiqueta: "Destacado" },
  EX: { clase: "is-ex", forma: "★", etiqueta: "Excepcional" },
};

/** Acciones escritas a mano en esta sesión, además de las que propuso el motor. */
let propias = [];

const claveLinea = (l) => `${l.origen}|${l.criterio_codigo || ""}|${l.curso_codigo || ""}`;

export async function renderPlanAccion(container, evaluacion) {
  container.innerHTML = `<div class="view-loading">Calculando la propuesta del motor de PDI...</div>`;
  propias = [];

  const [
    { data: motor, error },
    { data: secciones },
    { data: resumen },
    { data: fortalezas },
    { data: resFort },
    { data: cursoRelator },
    { data: recomendaciones },
    { data: yaExisten },
  ] = await Promise.all([
    supabase.rpc("eva_motor_pdi_con_seccion", { p_evaluacion_id: evaluacion.id }),
    supabase.rpc("eva_motor_pdi_secciones", { p_evaluacion_id: evaluacion.id }),
    supabase.rpc("eva_motor_pdi_resumen", { p_evaluacion_id: evaluacion.id }),
    supabase.rpc("eva_motor_fortalezas", { p_evaluacion_id: evaluacion.id }),
    supabase.rpc("eva_motor_fortalezas_resumen", { p_evaluacion_id: evaluacion.id }),
    supabase.rpc("eva_curso_relator_sugerido", { p_evaluacion_id: evaluacion.id }),
    supabase.from("eva_recomendaciones").select("*").eq("activo", true).order("orden"),
    supabase.from("eva_pdi").select("id").eq("evaluacion_id", evaluacion.id),
  ]);

  if (error) {
    container.innerHTML = `
      <div class="view-eva">
        <button class="btn btn-secondary" id="btn-volver-plan" style="margin-bottom:16px;">← Volver</button>
        <div class="placeholder error">
          <h2>No se pudo calcular la propuesta del PDI</h2>
          <p>${escapeHtml(error.message)}</p>
          <p class="hint">Si dice que la función no existe, falta correr
          <code>database/migracion_eva_motor_pdi.sql</code> y
          <code>database/migracion_eva_motor_secciones.sql</code> en el SQL Editor de Supabase.</p>
        </div>
      </div>`;
    document.getElementById("btn-volver-plan").addEventListener("click", () => window.Router.go("personal"));
    return;
  }

  const lineas = motor || [];
  const secs = secciones || [];
  const res = (resumen || [])[0] || {};
  const fort = fortalezas || [];
  const rf = (resFort || [])[0] || {};
  const cursoRel = (cursoRelator || [])[0] || null;
  const yaEnPDI = (yaExisten || []).length;

  // Las candidaturas a relator son por dominio de la batería, así que cruzan
  // secciones: van en su propio bloque. El reconocimiento de sección y la
  // profundización sí pertenecen a una sección y van dentro de ella.
  const relatores = fort.filter((f) => f.tipo === "relator");
  const deSeccionFort = (cod) =>
    fort.filter((f) => f.dimension_codigo === cod && f.tipo !== "relator" && f.tipo !== "reconocimiento");
  const reconocer = fort.filter((f) => f.tipo === "reconocimiento");

  // Las líneas de la batería del cargo (P3) no pertenecen a ninguna sección: no
  // las gatilló una nota, las gatilló el puesto. Van en su propio bloque.
  const deSeccion = (cod) => lineas.filter((l) => l.dimension_codigo === cod);
  const bateria = lineas.filter((l) => l.origen === "bateria" && l.incluir);
  const filtradas = lineas.filter((l) => l.curso_codigo && !l.incluir);

  const checklist = await checklistHTML(evaluacion.id, "despues");

  container.innerHTML = `
    <div class="view-eva">
      <button class="btn btn-secondary" id="btn-volver-plan" style="margin-bottom:16px;">← Volver</button>

      <div class="card">
        <h3>Sellar el PDI · ${escapeHtml(evaluacion.evaluado?.nombre || "")}</h3>
        <p class="hint" style="margin:-2px 0 14px;">${escapeHtml(evaluacion.ciclo?.titulo || "")}</p>

        <div class="eva-totales">
          <div class="eva-total">
            <span class="eva-total-label">Total ponderado</span>
            <span class="eva-total-valor">${n2(evaluacion.total_sup)}</span>
          </div>
          <div class="eva-total">
            <span class="eva-total-label">Categoría</span>
            <span class="eva-total-valor">
              ${evaluacion.categoria
                ? `<span class="badge ${CATEGORIA_BADGE[evaluacion.categoria]}">${escapeHtml(CATEGORIA_LABELS[evaluacion.categoria])}</span>`
                : "—"}
            </span>
          </div>
          <div class="eva-total">
            <span class="eva-total-label">Familia del cargo</span>
            <span class="eva-total-valor" style="font-size:15px;">${escapeHtml(res.familia_nombre || "sin determinar")}</span>
          </div>
        </div>
        ${evaluacion.decision_asociada
          ? `<div class="stat-row"><span>Decisión asociada al rango</span><span>${escapeHtml(evaluacion.decision_asociada)}</span></div>`
          : ""}
        ${avisoFamilia(res, evaluacion)}

        <div class="motor-nota-decide">
          <strong>Todo lo de abajo es una recomendación.</strong> El sistema propone según las notas y explica de
          dónde sale cada línea; qué entra al PDI lo decides tú, y lo que dejes fuera queda registrado tal cual.
        </div>
      </div>

      ${bloqueReflexiones(evaluacion)}
      ${bloqueResumenSecciones(secs)}

      <div class="propuesta-banda">
        <div>
          <h4>Propuesta por sección</h4>
          <p>Cada sección con su promedio, el tramo en que cae y qué recomienda la regla ahí.
             Dentro, las líneas que gatillaron sus criterios.</p>
        </div>
        <span class="eva-contador" id="contador-acciones">0 líneas</span>
      </div>
      <p class="motor-aviso-largo" id="aviso-largo" hidden></p>

      ${bloqueRelatores(relatores, cursoRel, rf)}

      ${secs.map((s) => tarjetaSeccion(s, deSeccion(s.dimension_codigo), deSeccionFort(s.dimension_codigo))).join("")}

      ${bloqueReconocer(reconocer)}
      ${bloqueBateria(bateria, res)}
      ${bloqueFiltradas(filtradas)}
      ${bloqueResumenComite(res)}

      <div class="card" style="margin-top:20px;">
        <div class="eva-head">
          <h3 style="margin:0;">Acciones escritas a mano</h3>
          <button class="btn btn-secondary" id="btn-agregar-propia">+ Escribir una acción</button>
        </div>
        <p class="hint" style="margin:6px 0 0;">
          Para lo que acordaste en la reunión y no se resuelve con un curso de la batería: acompañamiento,
          tarea guiada, instrucción interna.
        </p>
        <div id="lista-propias"></div>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3>Cierre de la evaluación</h3>
        <form id="form-cerrar-eva">
          <div class="form-field">
            <label class="form-label">Recomendación final<span class="req">*</span></label>
            <select id="pl-recomendacion" required>
              <option value="">Selecciona...</option>
              ${(recomendaciones || []).map((r) => `<option value="${escapeHtml(r.codigo)}">${escapeHtml(r.texto)}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Justificación de la recomendación<span class="req">*</span></label>
            <textarea id="pl-justificacion" rows="3" required placeholder="Por qué esta recomendación, con los hechos del período que la sustentan"></textarea>
          </div>
          <div class="form-field">
            <label class="form-label">Fecha estimada de cierre del PDI</label>
            <input type="date" id="pl-cierre-pdi" value="${enDias(120)}">
          </div>

          ${avisoConformidad(evaluacion)}

          <h4 style="margin:22px 0 4px;">Trámite de cierre</h4>
          ${checklist}

          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Sellar el PDI y pasar a firmas</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("btn-volver-plan").addEventListener("click", () => window.Router.go("personal"));
  engancharChecklist(container);
  enganchar(container, evaluacion, lineas, yaEnPDI, fort, cursoRel);
}

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

/**
 * El mapa de las cinco secciones, arriba, antes de entrar al detalle. Es lo que
 * el evaluador mira para saber por dónde va a doler la conversación.
 */
function bloqueResumenSecciones(secs) {
  if (!secs.length) return "";

  const conNota = secs.filter((s) => s.promedio_sup != null);
  if (!conNota.length) return "";

  return `
    <div class="card" style="margin-top:20px;">
      <h3>Las cinco secciones de la evaluación</h3>
      <p class="hint" style="margin:-2px 0 12px;">
        El promedio de cada sección cae en un tramo, y el tramo dice qué corresponde recomendar ahí.
        La sección con más peso es la primera: mueve más el total que las otras cuatro.
      </p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Sección</th><th>Peso</th><th>Promedio</th><th>Tramo</th>
              <th>En 1 o 2</th><th>Qué se recomienda</th><th>Cursos</th><th>Compromisos</th>
            </tr>
          </thead>
          <tbody>
            ${secs.map((s) => {
              const t = TRAMO_META[s.tramo_sigla] || {};
              return `<tr>
                <td><strong>${escapeHtml(s.dimension_nombre)}</strong></td>
                <td>${Math.round(Number(s.peso) * 100)}%</td>
                <td><strong>${n2(s.promedio_sup)}</strong></td>
                <td class="tramo-celda ${t.clase || ""}">
                  ${s.tramo_sigla ? `<span class="tramo-forma" aria-hidden="true">${t.forma}</span> ${escapeHtml(s.tramo_sigla)} · ${escapeHtml(s.tramo_categoria || "")}` : "—"}
                </td>
                <td>${s.criterios_en_1_o_2 || 0}</td>
                <td>${
                  s.promedio_sup == null
                    ? "—"
                    : s.tramo_prioridad
                      ? s.criterios_hasta_3
                        ? `Capacitación ${PRIORIDAD_META[s.tramo_prioridad].sigla}`
                        : "Sin brecha que justificar"
                      : "Nada por brecha"
                }</td>
                <td>${s.cursos_propuestos || 0}</td>
                <td>${s.compromisos_conductuales || 0}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/** Una sección: su lectura de conjunto y, dentro, lo que gatillaron sus criterios. */
function tarjetaSeccion(s, lineas, fortalezas = []) {
  const t = TRAMO_META[s.tramo_sigla] || {};
  const conducta = lineas.filter((l) => l.origen === "conducta");
  const todosCursos = lineas.filter((l) => l.curso_codigo && l.incluir);
  // «vacío = no aplica» es la leyenda de la matriz curso × familia. Esos cursos
  // no se esconden — para las familias operativas a veces son casi todo lo que
  // hay — pero van aparte y desmarcados.
  const cursos = todosCursos.filter((l) => l.aplica_familia !== false);
  const noAplican = todosCursos.filter((l) => l.aplica_familia === false);
  const porPrioridad = [1, 2, 4].map((p) => [p, cursos.filter((l) => l.prioridad === p)]);
  const fuera = Number(s.fuera_del_filtro || 0);
  const huerfanas = Number(s.notas_de_criterios_que_no_aplican || 0);

  return `
    <div class="card seccion-card ${t.clase || ""}" style="margin-top:16px;">
      <div class="seccion-head">
        <div class="seccion-titulo">
          <span class="seccion-cod">${escapeHtml(s.dimension_codigo)}</span>
          <h3>${escapeHtml(s.dimension_nombre)}</h3>
          <span class="seccion-peso">peso ${Math.round(Number(s.peso) * 100)}%</span>
        </div>
        <div class="seccion-nota">
          <span class="seccion-nota-valor">${n2(s.promedio_sup)}</span>
          ${s.tramo_sigla
            ? `<span class="tramo-chip ${t.clase}">
                 <span class="tramo-forma" aria-hidden="true">${t.forma}</span>
                 ${escapeHtml(s.tramo_sigla)} · ${escapeHtml(s.tramo_categoria || "")}
               </span>`
            : `<span class="tramo-chip">Sin calificar</span>`}
        </div>
      </div>

      <p class="seccion-recomendacion">${escapeHtml(s.recomendacion || "")}</p>

      ${s.que_se_hace
        ? `<details class="seccion-regla">
             <summary>Qué dice la regla para el tramo ${escapeHtml(s.tramo_sigla)}</summary>
             <p>${escapeHtml(s.que_se_hace)}</p>
             <p class="seccion-regla-filtro"><strong>Filtro de cursos del tramo:</strong>
               ${escapeHtml(s.filtro_criticidad)}${s.plazo ? ` · ${escapeHtml(s.plazo)}` : ""}</p>
           </details>`
        : ""}

      ${/* La advertencia de conductuales sólo tiene sentido si el promedio está
            bajo: con 5,00 en Disciplina Laboral, decir «un promedio bajo aquí no
            se cierra con capacitación» es ruido y se lee como un reproche. */ ""}
      ${s.criterios_con > 0 && s.tramo_prioridad
        ? `<p class="seccion-advertencia ${s.criterios_con > s.criterios_cap ? "is-fuerte" : ""}">
             ${s.criterios_con > s.criterios_cap ? `<span class="motor-aviso-icono" aria-hidden="true">!</span>` : ""}
             ${escapeHtml(s.advertencia || "")}
           </p>`
        : ""}

      ${fuera > 0
        ? `<p class="seccion-nota-filtro">
             ${plural(fuera, "línea propuesta", "líneas propuestas")} de esta sección ${fuera === 1 ? "queda" : "quedan"}
             fuera del filtro del tramo ${escapeHtml(s.tramo_sigla)}: la gatilló la nota de un criterio puntual, no el
             promedio de la sección. Van marcadas más abajo. Ninguna se descarta sola.
           </p>`
        : ""}

      ${huerfanas
        ? `<p class="seccion-nota-filtro is-huerfana">
             ${plural(huerfanas, "nota registrada", "notas registradas")} en esta sección
             ${huerfanas === 1 ? "corresponde" : "corresponden"} a un criterio que RRHH marcó como no aplicable a esta
             familia. ${huerfanas === 1 ? "No se cuenta" : "No se cuentan"} en el promedio. Se calificó con una regla
             distinta a la vigente: si la evaluación sigue abierta, conviene volver a guardar el formulario.
           </p>`
        : ""}

      ${conducta.length ? bloqueConductaSeccion(conducta) : ""}

      ${cursos.length ? porPrioridad.map(([p, ls]) => (ls.length ? grupoPrioridad(p, ls) : "")).join("") : ""}

      ${noAplican.length ? grupoNoAplican(noAplican) : ""}

      ${fortalezas.length ? grupoFortalezasSeccion(fortalezas) : ""}

      ${!cursos.length && !noAplican.length && s.promedio_sup != null && s.criterios_hasta_3 > 0
        ? `<p class="seccion-sin-lineas">
             Esta sección tiene ${plural(s.criterios_hasta_3, "criterio", "criterios")} en 3 o menos, pero sus cursos
             no aparecen acá: o la persona ya los tiene vigentes, o son obligatorios de su cargo y quedaron en el
             bloque P3 con más prioridad. En cualquier caso están abajo, marcados con el criterio que los pide.
           </p>`
        : ""}

      ${!cursos.length && !noAplican.length && !fortalezas.length && !conducta.length && s.promedio_sup != null && !s.criterios_hasta_3
        ? `<p class="seccion-sin-lineas">No se recomienda ninguna acción en esta sección.</p>`
        : ""}
    </div>`;
}

function bloqueConductaSeccion(lineas) {
  const accionables = lineas.filter((l) => l.incluir);
  const soloConversar = lineas.filter((l) => !l.incluir);

  return `
    <div class="motor-grupo is-conducta">
      <div class="motor-grupo-head">
        <span class="motor-sigla">CON</span>
        <span class="motor-grupo-nombre">Criterios conductuales</span>
        <span class="motor-grupo-conteo">${plural(accionables.length, "compromiso", "compromisos")}</span>
      </div>
      <p class="motor-grupo-glosa">
        Acá el motor no propone capacitación a propósito: una nota baja en conducta se resuelve con
        acompañamiento de la jefatura y un compromiso verificable con fecha.
      </p>

      ${accionables.map((l) => `
        <div class="motor-linea is-conducta" data-clave="${escapeHtml(claveLinea(l))}">
          <div class="motor-linea-head">
            <span class="motor-cod">${escapeHtml(l.criterio_codigo)}</span>
            <span class="motor-nombre">${escapeHtml(l.criterio_texto || "")}</span>
            <span class="badge ${l.nota === 1 ? "badge-danger" : "badge-warning"}">Nota ${l.nota}</span>
          </div>
          <p class="motor-porque" title="${escapeHtml(l.recomendacion)}">
            ${escapeHtml(l.recomendacion)}${l.plazo ? ` · plazo ${escapeHtml(l.plazo)}` : ""}
          </p>

          ${/* El compromiso viene REDACTADO. Antes el campo salía vacío y, si el
                evaluador no escribía nada, la línea desaparecía del PDI sin
                avisar: la conducta con nota baja quedaba sin ninguna acción
                justo por no haber tecleado. Ahora hay una propuesta que se
                acepta tal cual o se corrige. */ ""}
          <p class="motor-plan">
            <span class="motor-plan-etiqueta">Propuesto</span>
            Verifica ${escapeHtml(fechaCorta(enDias(30)))} · Supervisor directo
            <button type="button" class="motor-ajustar" data-ajustar-con="${escapeHtml(claveLinea(l))}">Ajustar</button>
          </p>
          <p class="motor-compromiso-texto" data-eco="${escapeHtml(claveLinea(l))}">${escapeHtml(textoCompromiso(l))}</p>

          <div class="motor-linea-cuerpo" hidden>
            <div class="form-field">
              <label class="form-label">Compromiso acordado, con fecha</label>
              <textarea rows="3" data-compromiso="${escapeHtml(claveLinea(l))}"
                placeholder="Si lo dejas en blanco, esta línea no entra al PDI.">${escapeHtml(textoCompromiso(l))}</textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label class="form-label">Se verifica el</label>
                <input type="date" data-compromiso-fecha="${escapeHtml(claveLinea(l))}" value="${enDias(30)}">
              </div>
              <div class="form-field">
                <label class="form-label">Con quién</label>
                <input type="text" data-compromiso-resp="${escapeHtml(claveLinea(l))}" value="Supervisor directo">
              </div>
            </div>
          </div>
        </div>`).join("")}

      ${soloConversar.length
        ? `<div class="motor-nota-menor">
             <strong>Para abordar en la conversación sin generar línea de PDI:</strong>
             <ul>
               ${soloConversar.map((l) => `
                 <li><strong>${escapeHtml(l.criterio_codigo)}</strong> ${escapeHtml(l.criterio_texto || "")}
                 — nota ${l.nota}. ${escapeHtml(l.motivo_exclusion || "")}</li>`).join("")}
             </ul>
           </div>`
        : ""}
    </div>`;
}

/**
 * Cursos que el criterio gatilló pero que no aplican a la familia del cargo.
 *
 * No se descartan. Medí que con un filtro duro un Jornal se queda con 17 de sus
 * 22 criterios sin ningún curso, así que esconderlos cambiaría el ruido por algo
 * peor: brechas reales sin acción. Van plegados, desmarcados, y con el motivo.
 */
/**
 * Redacta el compromiso conductual que se propone.
 *
 * No es capacitación: una nota baja en conducta se resuelve con acompañamiento
 * de la jefatura y algo verificable. El texto sale del propio criterio, así que
 * es concreto sin inventar nada, y el evaluador lo corrige si no le calza.
 */
function textoCompromiso(l) {
  const criterio = (l.criterio_texto || "").trim().replace(/\.$/, "");
  if (!criterio) return "";
  const base = criterio.charAt(0).toLowerCase() + criterio.slice(1);
  return (
    `Se acuerda sostener ${base} durante el próximo período, sin observaciones. ` +
    `La jefatura directa lo revisa en la fecha de verificación y deja constancia del resultado.`
  );
}

function grupoNoAplican(lineas) {
  const horas = lineas.reduce((a, l) => a + (l.horas || 0), 0);
  const costo = lineas.reduce((a, l) => a + (l.precio_ref || 0), 0);
  const criticas = lineas.filter((l) => l.prioridad === 1 || l.prioridad === 2);

  return `
    <details class="motor-grupo is-no-aplica">
      <summary class="motor-grupo-head">
        <span class="motor-sigla is-no-aplica">≠</span>
        <span class="motor-grupo-nombre">No aplican a su familia de cargo</span>
        <span class="motor-grupo-conteo">${plural(lineas.length, "curso", "cursos")} · ${horas} h · ${clp(costo)}</span>
      </summary>
      <p class="motor-grupo-glosa">
        El criterio los pide, pero en la matriz curso × familia estos cursos <strong>no tienen entrada para la
        familia de este cargo</strong>, y «vacío» ahí significa que no aplican al puesto. Vienen desmarcados:
        márcalos sólo si de verdad corresponden en este caso.
        ${criticas.length
          ? `Ojo: ${plural(criticas.length, "es de una brecha", "son de brechas")} P1 o P2, así que si ninguno
             aplica, esa brecha necesita una acción escrita a mano.`
          : ""}
      </p>
      ${lineas.map((l) => tarjetaLinea(l)).join("")}
    </details>`;
}

function grupoPrioridad(prioridad, lineas) {
  const meta = PRIORIDAD_META[prioridad];
  const horas = lineas.reduce((a, l) => a + (l.horas || 0), 0);
  const costo = lineas.reduce((a, l) => a + (l.precio_ref || 0), 0);

  return `
    <div class="motor-grupo ${meta.clase}">
      <div class="motor-grupo-head">
        <span class="motor-sigla">${meta.sigla}</span>
        <span class="motor-grupo-nombre">${meta.nombre}</span>
        <span class="motor-grupo-conteo">${plural(lineas.length, "curso", "cursos")} · ${horas} h · ${clp(costo)}</span>
      </div>
      ${lineas.map((l) => tarjetaLinea(l)).join("")}
    </div>`;
}

/** Los obligatorios del cargo: no los gatilló ninguna nota, los gatilló el puesto. */
function bloqueBateria(lineas, res) {
  if (!lineas.length) return "";

  const legales = lineas.filter((l) => l.criticidad === "Legal");
  const horas = lineas.reduce((a, l) => a + (l.horas || 0), 0);
  const costo = lineas.reduce((a, l) => a + (l.precio_ref || 0), 0);

  return `
    <details class="card seccion-card is-bateria" style="margin-top:16px;">
      <summary class="seccion-head">
        <div class="seccion-titulo">
          <span class="seccion-cod">P3</span>
          <h3>Obligatorios de la batería del cargo</h3>
          <span class="seccion-peso">${escapeHtml(res.familia_nombre || "")}</span>
        </div>
        <div class="seccion-nota">
          <span class="tramo-chip">${plural(lineas.length, "pendiente", "pendientes")} · ${horas} h · ${clp(costo)}</span>
        </div>
      </summary>

      <p class="seccion-recomendacion">
        Estos no salen de ninguna nota: corresponden al puesto, con evaluación o sin ella. No son una brecha de
        esta evaluación — son la batería completa del cargo, que el Comité normalmente prioriza a lo largo del año.
      </p>

      ${legales.length
        ? `<p class="motor-aviso-legal">
             <span class="motor-aviso-icono" aria-hidden="true">!</span>
             ${plural(legales.length, "curso habilitante", "cursos habilitantes")} <strong>por ley</strong>.
             Vienen marcados porque la norma no los deja al criterio del presupuesto, pero igual puedes quitarlos.
           </p>`
        : ""}

      ${lineas.map((l) => tarjetaLinea(l)).join("")}
    </details>`;
}

function bloqueFiltradas(lineas) {
  if (!lineas.length) return "";
  return `
    <details class="card seccion-card is-filtrado" style="margin-top:16px;">
      <summary class="seccion-head">
        <div class="seccion-titulo">
          <span class="seccion-cod">—</span>
          <h3>Lo que el motor no propuso, y por qué</h3>
        </div>
        <div class="seccion-nota">
          <span class="tramo-chip">${plural(lineas.length, "curso", "cursos")}</span>
        </div>
      </summary>
      <p class="seccion-recomendacion">
        Se muestran para que quede a la vista qué se filtró. Si algo de acá tiene que entrar igual,
        agrégalo como acción escrita a mano.
      </p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>Curso</th><th>Sección</th><th>Prioridad</th><th>Motivo</th></tr></thead>
          <tbody>
            ${lineas.map((l) => `
              <tr>
                <td><strong>${escapeHtml(l.curso_codigo || "")}</strong> ${escapeHtml(l.curso_nombre || "")}</td>
                <td>${escapeHtml(l.dimension_codigo || "Batería del cargo")}</td>
                <td>${l.prioridad ? PRIORIDAD_META[l.prioridad].sigla : "—"}</td>
                <td>${escapeHtml(l.motivo_exclusion || "")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </details>`;
}

/**
 * Una línea de la propuesta.
 *
 * Vienen marcadas las que la regla señala como no postergables — P1, P2 y los
 * habilitantes por ley — pero todas se pueden desmarcar. Al desmarcar una de
 * esas se pide el motivo, porque la pauta de la entrevista lo exige por escrito;
 * si el evaluador no lo escribe, el sello igual procede y queda constando que se
 * quitó sin justificación.
 */
function tarjetaLinea(l) {
  const clave = claveLinea(l);
  const esLegal = l.criticidad === "Legal";
  const noAplica = l.aplica_familia === false;
  // Un curso que no aplica al cargo no se marca solo, ni exige justificar que se
  // deje fuera: dejarlo fuera es lo normal.
  const pideMotivo = (l.prioridad === 1 || l.prioridad === 2 || esLegal) && !noAplica;
  const marcada = pideMotivo;
  const fueraDelTramo = l.dentro_filtro_seccion === false;

  const inicio = hoyISO();
  const cierre = enDias(l.dias_sugeridos);
  const responsable = "Bienestar y Crecimiento (programación)";

  // El plan propuesto se muestra COMO TEXTO, no como formulario. Los campos
  // existen igual, rellenos, detrás de «Ajustar»: el evaluador que no quiere
  // cambiar nada no tiene que tocar un solo control, y el que quiere cambiar
  // algo lo abre. Antes esta pantalla presentaba 348 campos abiertos a la vez.
  const plan = [
    `${fechaCorta(inicio)} → ${fechaCorta(cierre)}`,
    responsable.replace(" (programación)", ""),
    costoTexto(l),
  ].join(" · ");

  return `
    <div class="motor-linea ${l.ya_en_pdi ? "is-ya" : ""} ${pideMotivo && !l.ya_en_pdi ? "is-pide-motivo" : ""}"
         data-clave="${escapeHtml(clave)}">
      <label class="motor-check">
        <input type="checkbox" data-sel="${escapeHtml(clave)}"
          ${l.ya_en_pdi ? "disabled" : marcada ? "checked" : ""}>
        <span class="motor-linea-head">
          <span class="motor-cod">${escapeHtml(l.curso_codigo)}</span>
          <span class="motor-nombre">${escapeHtml(l.curso_nombre || "")}</span>
          ${esLegal ? `<span class="badge badge-danger">Habilitante por ley</span>` : ""}
          ${noAplica ? `<span class="badge badge-neutral">No aplica a su cargo</span>` : ""}
          ${l.ya_en_pdi ? `<span class="badge badge-success">Ya está en el PDI</span>` : ""}
        </span>
      </label>

      ${/* Una sola línea de porqué, no cuatro párrafos. El detalle completo
            sigue estando, en el título emergente. */ ""}
      <p class="motor-porque" title="${escapeHtml(porqueLargo(l))}">
        ${escapeHtml(porqueCorto(l))}
        ${fueraDelTramo ? `<span class="motor-fuera-chip">fuera del tramo ${escapeHtml(l.seccion_tramo)}</span>` : ""}
      </p>

      <p class="motor-plan">
        <span class="motor-plan-etiqueta">Propuesto</span>
        ${escapeHtml(plan)}
        ${l.ya_en_pdi ? "" : `<button type="button" class="motor-ajustar" data-ajustar="${escapeHtml(clave)}">Ajustar</button>`}
      </p>

      <div class="motor-linea-cuerpo" hidden>
        <div class="form-field">
          <label class="form-label">Acción tal como queda en el PDI</label>
          <textarea rows="2" data-campo="accion" ${l.ya_en_pdi ? "disabled" : ""}>${escapeHtml(textoAccion(l))}</textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Responsable de apoyo</label>
            <input type="text" data-campo="responsable" value="${escapeHtml(responsable)}"
              ${l.ya_en_pdi ? "disabled" : ""}>
          </div>
          <div class="form-field">
            <label class="form-label">Recursos</label>
            <input type="text" data-campo="recursos" value="${escapeHtml(recursosDe(l))}" ${l.ya_en_pdi ? "disabled" : ""}>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Inicio</label>
            <input type="date" data-campo="inicio" value="${inicio}" ${l.ya_en_pdi ? "disabled" : ""}>
          </div>
          <div class="form-field">
            <label class="form-label">Cierre${l.plazo ? ` · ${escapeHtml(l.plazo)}` : ""}</label>
            <input type="date" data-campo="cierre" value="${cierre}" ${l.ya_en_pdi ? "disabled" : ""}>
          </div>
        </div>
      </div>

      <div class="motor-descarte" hidden>
        <label class="form-label">Por qué la quitas</label>
        <input type="text" data-descarte="${escapeHtml(clave)}"
          placeholder="La pauta de la entrevista pide dejarlo por escrito. Queda en el expediente.">
      </div>
    </div>`;
}

/** dd/mm, que es como se lee una fecha de plazo de un vistazo. */
function fechaCorta(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

/** El porqué en una línea: lo que gatilló el curso y poco más. */
function porqueCorto(l) {
  const meta = PRIORIDAD_META[l.prioridad];
  if (l.criterio_codigo) {
    return `${meta ? meta.sigla + " · " : ""}${l.criterio_codigo} sacó ${l.nota} · ${l.horas || 0} h`;
  }
  return `${meta ? meta.sigla + " · " : ""}Obligatorio de su cargo · ${l.horas || 0} h`;
}

/** Todo lo que antes ocupaba cuatro párrafos, ahora en el título emergente. */
function porqueLargo(l) {
  const partes = [l.recomendacion];
  if (l.dentro_filtro_seccion === false) {
    partes.push(
      `Fuera del filtro del tramo ${l.seccion_tramo} de su sección (promedio ${n2(l.nota_de_la_seccion)}): ` +
        `la pide la nota de ${l.criterio_codigo || "un criterio"}, no el promedio.`
    );
  }
  if (l.tambien_pedido_por?.length) partes.push(`También lo pide ${l.tambien_pedido_por.join(", ")}.`);
  if (l.en_su_bateria === "O") partes.push("Obligatorio de su cargo.");
  if (l.en_su_bateria === "R") partes.push("Recomendado para su cargo.");
  if (l.modalidad) partes.push(`${l.modalidad} · nivel ${l.nivel || "—"}.`);
  if (l.criticidad) partes.push(`Criticidad ${l.criticidad}.`);
  return partes.filter(Boolean).join(" ");
}

function textoAccion(l) {
  if (!l.curso_codigo) {
    return `${l.criterio_texto || ""} — definir acción de desarrollo con seguimiento verificable.`;
  }
  const gatillo = l.criterio_codigo
    ? `Cierra la brecha detectada en ${l.criterio_codigo} (nota ${l.nota}).`
    : `Curso obligatorio de la batería del cargo.`;
  return `Cursar «${l.curso_nombre}» (${l.curso_codigo}, ${l.modalidad || ""}, ${l.horas || 0} h) y aprobarlo. ${gatillo}`;
}

/**
 * Un curso interno no cuesta cero: no tiene costo externo. Decir «$0» invita a
 * leerlo como gratis y a compararlo con los que sí se pagan.
 */
function costoTexto(l) {
  if (!l.precio_ref) return "Sin costo externo · " + (l.financiamiento || "interno");
  return clp(l.precio_ref) + (l.franquiciable ? " · franquiciable SENCE" : " · sin franquicia");
}

function recursosDe(l) {
  if (!l.curso_codigo) return "";
  const partes = [];
  if (l.financiamiento) partes.push(l.financiamiento);
  if (l.precio_ref) partes.push(clp(l.precio_ref) + " ref.");
  else partes.push("sin costo externo");
  if (l.franquiciable) partes.push("franquicia SENCE");
  return partes.join(" · ");
}


// ---------------------------------------------------------------------------
// Fortalezas: lo que corresponde cuando sale bien
// ---------------------------------------------------------------------------

/**
 * Candidaturas a relator interno N4.
 *
 * Van fuera de las secciones porque se agrupan por DOMINIO de la batería, y un
 * dominio junta criterios de varias secciones. La primera versión de esto sacaba
 * una candidatura por criterio: con los 30 criterios en 5 salían 35 candidaturas
 * para una persona, que no sirve de nada. Nadie es relator de treinta cosas.
 */
function bloqueRelatores(relatores, cursoRel, rf) {
  if (!relatores.length) return "";

  return `
    <div class="card fortaleza-card is-relator" style="margin-top:16px;">
      <div class="seccion-head">
        <div class="seccion-titulo">
          <span class="seccion-cod is-fort">N4</span>
          <h3>Candidaturas a relator interno</h3>
          <span class="seccion-peso">«el que sabe, enseña»</span>
        </div>
        <div class="seccion-nota">
          <span class="tramo-chip is-ex">
            <span class="tramo-forma" aria-hidden="true">★</span>
            ${plural(relatores.length, "dominio", "dominios")}
          </span>
        </div>
      </div>

      <p class="seccion-recomendacion">
        Marcar una candidatura no nombra relator a nadie: la deja <strong>propuesta</strong> y avisa al Comité de
        Capacitación, que es quien decide.
        <button type="button" class="motor-ajustar" data-plegar="relatores">Ver las ${relatores.length}</button>
      </p>

      <div data-plegable="relatores" hidden>
      ${relatores.map((f) => `
        <div class="motor-linea is-fortaleza ${f.ya_registrada ? "is-ya" : ""}" data-fort="${escapeHtml(claveFort(f))}">
          <label class="motor-check">
            <input type="checkbox" data-fort-sel="${escapeHtml(claveFort(f))}" ${f.ya_registrada ? "disabled" : "checked"}>
            <span class="motor-linea-head">
              <span class="motor-nombre">${escapeHtml(f.titulo)}</span>
              ${f.ya_registrada ? `<span class="badge badge-success">Ya propuesta</span>` : ""}
            </span>
          </label>
          <p class="motor-porque" title="${escapeHtml(f.detalle)} ${escapeHtml(f.criterio_texto || "")}">
            ${escapeHtml(f.detalle)}
          </p>
          ${f.ya_registrada ? "" : `
          <p class="motor-plan">
            <span class="motor-plan-etiqueta">Propuesto</span>
            Queda como candidatura y se avisa al Comité
            <button type="button" class="motor-ajustar" data-ajustar-fort>Ajustar</button>
          </p>`}
          <div class="motor-linea-cuerpo" hidden>
            <div class="form-field">
              <label class="form-label">Cómo queda escrito en el PDI</label>
              <textarea rows="2" data-fort-accion ${f.ya_registrada ? "disabled" : ""}>${escapeHtml(f.accion_sugerida || "")}</textarea>
            </div>
          </div>
        </div>`).join("")}

      ${cursoRel ? bloqueCursoRelator(cursoRel) : ""}
      </div>
    </div>`;
}

/**
 * El curso que habilita para relatar. Es una inferencia mía, no una regla de las
 * planillas, y la pantalla lo dice: no se puede nombrar relator a alguien y no
 * enseñarle a enseñar, y el curso existe en el catálogo sin que nada lo proponga.
 */
function bloqueCursoRelator(c) {
  return `
    <div class="motor-linea is-curso-relator ${c.ya_lo_tiene ? "is-ya" : ""}">
      <label class="motor-check">
        <input type="checkbox" data-curso-relator ${c.ya_lo_tiene ? "disabled" : "checked"}>
        <span class="motor-linea-head">
          <span class="motor-cod">${escapeHtml(c.curso_codigo)}</span>
          <span class="motor-nombre">${escapeHtml(c.curso_nombre)}</span>
          ${c.ya_lo_tiene ? `<span class="badge badge-success">Ya lo tiene</span>` : ""}
        </span>
      </label>
      <p class="motor-reco">${escapeHtml(c.motivo)}</p>
      <p class="motor-fuera-tramo">
        Esta línea es una sugerencia del sistema, no una regla de tus planillas: ellas dicen «candidatura a relator
        N4» pero no dicen que haya que formarlo. Si el Comité prefiere decidir la formación aparte, se desmarca.
      </p>
      <div class="motor-meta">
        <span>${escapeHtml(c.modalidad || "")} · ${c.horas || 0} h · nivel ${escapeHtml(c.nivel || "")}</span>
        <span>${c.precio_ref ? clp(c.precio_ref) : "sin costo externo"}${c.franquiciable ? " · franquiciable SENCE" : ""}</span>
      </div>
    </div>`;
}

/** Reconocimiento de sección y profundización: pertenecen a una sección. */
function grupoFortalezasSeccion(fortalezas) {
  // Con una sola línea, el encabezado del grupo es un título para nada: ocupa
  // tanto como la línea que anuncia. Se pone sólo cuando hay varias.
  const cabecera = fortalezas.length > 1
    ? `<div class="motor-grupo-head">
         <span class="motor-sigla is-fort">★</span>
         <span class="motor-grupo-nombre">Lo que corresponde porque salió bien</span>
         <span class="motor-grupo-conteo">${plural(fortalezas.length, "línea", "líneas")}</span>
       </div>`
    : "";
  return `
    <div class="motor-grupo is-fortaleza-grupo">
      ${cabecera}
      ${fortalezas.map((f) => `
        <div class="motor-linea is-fortaleza" data-fort="${escapeHtml(claveFort(f))}">
          <label class="motor-check">
            <input type="checkbox" data-fort-sel="${escapeHtml(claveFort(f))}" checked>
            <span class="motor-linea-head">
              <span class="motor-nombre">${escapeHtml(f.titulo)}</span>
            </span>
          </label>
          <p class="motor-porque" title="${escapeHtml(f.detalle)}">${escapeHtml(f.detalle)}</p>
          <p class="motor-plan">
            <span class="motor-plan-etiqueta">Propuesto</span>
            ${escapeHtml(fechaCorta(hoyISO()))} → ${escapeHtml(fechaCorta(enDias(180)))}
            <button type="button" class="motor-ajustar" data-ajustar-fort>Ajustar</button>
          </p>
          <div class="motor-linea-cuerpo" hidden>
            <div class="form-field">
              <label class="form-label">Cómo queda escrito en el PDI</label>
              <textarea rows="2" data-fort-accion>${escapeHtml(f.accion_sugerida || "")}</textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label class="form-label">Inicio</label>
                <input type="date" data-fort-inicio value="${hoyISO()}">
              </div>
              <div class="form-field">
                <label class="form-label">Cierre</label>
                <input type="date" data-fort-cierre value="${enDias(180)}">
              </div>
            </div>
          </div>
        </div>`).join("")}
    </div>`;
}

/**
 * Los criterios con nota 4. La regla es explícita: no generan curso ni línea de
 * PDI, se reconocen en la entrevista con ejemplos concretos. Van plegados porque
 * pueden ser veinticinco, pero van — si no aparecen, nadie los menciona, y
 * reconocer con ejemplos concretos es justo lo que la pauta pide.
 */
function bloqueReconocer(items) {
  if (!items.length) return "";
  return `
    <details class="card fortaleza-card is-reconocer" style="margin-top:16px;">
      <summary class="seccion-head">
        <div class="seccion-titulo">
          <span class="seccion-cod is-fort">4</span>
          <h3>Para reconocer en la entrevista</h3>
        </div>
        <div class="seccion-nota">
          <span class="tramo-chip is-se">
            <span class="tramo-forma" aria-hidden="true">✔</span>
            ${plural(items.length, "criterio", "criterios")} sobre lo esperado
          </span>
        </div>
      </summary>
      <p class="seccion-recomendacion">
        Un 4 no genera curso ni línea de PDI: la regla pide reconocerlo en la conversación con ejemplos concretos del
        período. No hay nada que marcar acá — es la lista de lo que conviene nombrar en voz alta.
      </p>
      <ul class="reconocer-lista">
        ${items.map((f) => `
          <li>
            <strong>${escapeHtml(f.criterio_codigo)}</strong>
            ${escapeHtml(f.criterio_texto || "")}
            <span class="reconocer-sec">${escapeHtml(f.dimension_nombre || "")}</span>
          </li>`).join("")}
      </ul>
    </details>`;
}

const claveFort = (f) => `${f.tipo}|${f.dimension_codigo || ""}|${f.dominio_sugerido || ""}`;

// ---------------------------------------------------------------------------

function avisoFamilia(res, ev) {
  if (res.familia_codigo) return "";
  return `
    <div class="eva-nota-cierre is-alerta" style="margin-top:14px;">
      <strong>No se pudo deducir la familia del cargo</strong> a partir de
      «${escapeHtml(ev.cargo_actual || ev.evaluado?.cargo || "sin cargo")}».
      Sin familia, el motor recomienda las brechas de la evaluación pero <strong>no los cursos
      obligatorios del puesto</strong>. RRHH tiene que fijar la familia en el perfil de la
      persona, o escribir el cargo igual que en el catálogo de cargos.
    </div>`;
}

function bloqueResumenComite(res) {
  if (!res || res.total_propuesta == null) return "";
  return `
    <div class="card motor-resumen" style="margin-top:20px;">
      <div class="eva-head">
        <h3 style="margin:0;">Lo que el Comité va a ver</h3>
        <button type="button" class="motor-ajustar" data-plegar="comite">Ver los totales</button>
      </div>
      <p class="hint" style="margin:6px 0 0;">
        Totales de la propuesta completa del motor. Lo que finalmente selles puede ser bastante menos.
      </p>
      <div class="motor-resumen-grid" data-plegable="comite" hidden>
        ${kpi("Por brechas de la evaluación", res.cursos_por_brecha)}
        ${kpi("Obligatorios del cargo pendientes", res.obligatorios_pendientes)}
        ${kpi("Prioridad 1 · críticas", res.prioridad_1, res.prioridad_1 > 0 ? "is-alerta" : "")}
        ${kpi("Compromisos conductuales", res.conductuales)}
        ${kpi("Habilitantes por ley", res.habilitantes_legales, res.habilitantes_legales > 0 ? "is-atencion" : "")}
        ${kpi("Horas totales", res.horas_totales)}
        ${kpi("Costo externo estimado", clp(res.costo_estimado))}
        ${kpi("De eso, franquiciable", clp(res.costo_franquiciable))}
        ${kpi("Ya vigentes, no se repiten", res.ya_vigentes)}
      </div>

      ${Number(res.fuera_de_su_bateria || 0)
        ? `<p class="motor-nota-fuera">
             Los totales de arriba <strong>no incluyen</strong>
             ${plural(res.fuera_de_su_bateria, "curso que no aplica", "cursos que no aplican")} a la familia de su
             cargo (${res.horas_fuera} h, ${clp(res.costo_fuera)}). Están propuestos igual, en el bloque
             «no aplican a su familia» de cada sección, pero fuera de la cuenta que ve el Comité: si se sumaran,
             el presupuesto estimado quedaría inflado con cursos que no son de su mundo.
           </p>`
        : ""}
    </div>`;
}

function kpi(label, valor, clase = "") {
  return `
    <div class="motor-kpi ${clase}">
      <span class="motor-kpi-label">${escapeHtml(label)}</span>
      <span class="motor-kpi-valor">${escapeHtml(String(valor ?? "—"))}</span>
    </div>`;
}

function bloqueReflexiones(ev) {
  const items = [
    ["Lo mejor que hizo en el período", ev.reflexion_mejor],
    ["Lo que cree que puede mejorar", ev.reflexion_mejorar],
    ["Lo que necesita para lograrlo", ev.reflexion_necesito],
    ["Sus metas para el próximo período", ev.reflexion_metas],
    ["Sus observaciones", ev.observaciones_trabajador],
  ].filter(([, v]) => v);

  if (!items.length) return "";

  return `
    <div class="card" style="margin-top:20px;">
      <div class="eva-head">
        <h3 style="margin:0;">Lo que respondió en el cierre</h3>
        <button type="button" class="motor-ajustar" data-plegar="reflexiones">Leer las ${items.length}</button>
      </div>
      <p class="hint" style="margin:6px 0 0;">Vale la pena leerlo antes de sellar: «lo que necesita para lograrlo» suele ser literalmente la línea que falta.</p>
      <div data-plegable="reflexiones" hidden style="margin-top:10px;">
        ${items.map(([l, v]) => `<div class="eva-respuesta"><span class="eva-respuesta-label">${escapeHtml(l)}</span><p>${escapeHtml(v)}</p></div>`).join("")}
      </div>
    </div>`;
}

function avisoConformidad(ev) {
  if (ev.acuerdo_trabajador === "conforme") {
    return `<div class="eva-nota-cierre is-ok">Declaró estar <strong>conforme</strong> con la calificación.</div>`;
  }
  if (ev.acuerdo_trabajador === "parcialmente") {
    return `<div class="eva-nota-cierre is-atencion">Declaró estar <strong>parcialmente conforme</strong>. Al sellar, RRHH recibe el aviso para revisar el caso — tenlo presente al redactar la justificación.</div>`;
  }
  if (ev.acuerdo_trabajador === "no_conforme") {
    return `<div class="eva-nota-cierre is-alerta"><strong>No está conforme</strong> con la calificación. El PDI empieza igual: la conformidad no es requisito. RRHH recibe el aviso y va a pedirte las evidencias que respaldan las notas.</div>`;
  }
  return `<div class="eva-nota-cierre">Todavía no hay declaración de conformidad registrada.</div>`;
}

// ---------------------------------------------------------------------------
// Interacción
// ---------------------------------------------------------------------------

function enganchar(container, evaluacion, lineas, yaEnPDI, fort = [], cursoRel = null) {
  const contador = document.getElementById("contador-acciones");

  const contar = () => {
    const compromisos = [...container.querySelectorAll("[data-compromiso]")].filter((t) => t.value.trim()).length;
    // Las fortalezas también son líneas del PDI: una candidatura a relator o una
    // profundización ocupan seguimiento igual que un curso.
    const fortalezasMarcadas =
      container.querySelectorAll("[data-fort-sel]:checked").length +
      container.querySelectorAll("[data-curso-relator]:checked").length;
    const n =
      container.querySelectorAll("[data-sel]:checked").length +
      compromisos +
      fortalezasMarcadas +
      propias.filter((p) => p.accion?.trim()).length;
    const total = n + yaEnPDI;
    const largo = total > LINEAS_INSEGUIBLES;

    contador.textContent = plural(total, "línea", "líneas");
    contador.classList.toggle("is-alerta", largo);

    const aviso = document.getElementById("aviso-largo");
    if (aviso) {
      aviso.hidden = !largo;
      aviso.textContent = largo
        ? `${total} líneas es un plan difícil de seguir en la práctica: los controles intermedios se vuelven una ` +
          `lista de verificación y nadie los hace. No impide sellar, pero conviene dejar parte de los obligatorios ` +
          `del cargo para los ciclos siguientes — el Comité los prioriza a lo largo del año.`
        : "";
    }
  };

  container.querySelectorAll("[data-sel]").forEach((chk) => {
    const linea = chk.closest(".motor-linea");
    const caja = linea.querySelector(".motor-descarte");

    const sincronizar = () => {
      linea.classList.toggle("is-sel", chk.checked);
      // Una línea que YA está en el PDI viene deshabilitada: no se está
      // quitando nada, así que no corresponde preguntar por qué.
      if (caja) caja.hidden = chk.disabled || !(linea.classList.contains("is-pide-motivo") && !chk.checked);
    };

    chk.addEventListener("change", () => {
      sincronizar();
      contar();
    });
    sincronizar();
  });

  container.querySelectorAll("[data-compromiso]").forEach((ta) => {
    ta.addEventListener("input", () => {
      // El eco de arriba refleja lo que hay en el campo: si el evaluador borra
      // el compromiso, tiene que verse que esa línea se queda sin nada.
      const eco = container.querySelector(`[data-eco="${CSS.escape(ta.dataset.compromiso)}"]`);
      if (eco) {
        const t = ta.value.trim();
        eco.textContent = t || "Sin compromiso: esta línea no entra al PDI.";
        eco.classList.toggle("is-vacio", !t);
      }
      contar();
    });
  });

  // Bloques enteros que se pliegan: son propuestas que casi siempre se aceptan
  // tal cual, y desplegadas ocupaban más pantalla que todo el resto junto.
  container.querySelectorAll("[data-plegar]").forEach((btn) => {
    const zona = container.querySelector(`[data-plegable="${btn.dataset.plegar}"]`);
    if (!zona) return;
    const textoInicial = btn.textContent.trim();
    btn.addEventListener("click", () => {
      zona.hidden = !zona.hidden;
      btn.textContent = zona.hidden ? textoInicial : "Ocultar";
      btn.classList.toggle("is-abierto", !zona.hidden);
    });
  });

  // «Ajustar»: abre los campos de una línea. El camino normal es no abrirlos.
  container.querySelectorAll("[data-ajustar], [data-ajustar-con], [data-ajustar-fort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cuerpo = btn.closest(".motor-linea").querySelector(".motor-linea-cuerpo");
      if (!cuerpo) return;
      cuerpo.hidden = !cuerpo.hidden;
      btn.textContent = cuerpo.hidden ? "Ajustar" : "Listo";
      btn.classList.toggle("is-abierto", !cuerpo.hidden);
      if (!cuerpo.hidden) cuerpo.querySelector("textarea, input")?.focus();
    });
  });

  container.querySelectorAll("[data-fort-sel], [data-curso-relator]").forEach((chk) => {
    const linea = chk.closest(".motor-linea");
    const sincronizar = () => linea.classList.toggle("is-sel", chk.checked);
    chk.addEventListener("change", () => {
      sincronizar();
      contar();
    });
    sincronizar();
  });

  document.getElementById("btn-agregar-propia").addEventListener("click", () => {
    propias.push({ dimension: "", accion: "", responsable: "", recursos: "", inicio: hoyISO(), cierre: enDias(90) });
    pintarPropias(container, contar);
    contar();
  });

  pintarPropias(container, contar);
  contar();

  document.getElementById("form-cerrar-eva").addEventListener("submit", async (e) => {
    e.preventDefault();
    await sellarPDI(e.target, container, evaluacion, lineas, yaEnPDI, fort, cursoRel);
  });
}

function pintarPropias(container, contar) {
  const cont = document.getElementById("lista-propias");
  if (!cont) return;

  cont.innerHTML = propias
    .map(
      (p, i) => `
    <div class="motor-linea is-propia" data-propia="${i}">
      <div class="eva-head">
        <span class="motor-nombre">Acción escrita a mano ${i + 1}</span>
        <button type="button" class="btn btn-secondary" data-quitar="${i}">Quitar</button>
      </div>
      <div class="motor-linea-cuerpo">
        <div class="form-field">
          <label class="form-label">Sección o criterio que trabaja</label>
          <input type="text" data-campo="dimension" value="${escapeHtml(p.dimension)}" placeholder="Ej: Calidad y Mejora — reprocesos">
        </div>
        <div class="form-field">
          <label class="form-label">Acción<span class="req">*</span></label>
          <textarea rows="3" data-campo="accion" placeholder="Específica, medible, alcanzable, relevante y con plazo">${escapeHtml(p.accion)}</textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Responsable de apoyo</label><input type="text" data-campo="responsable" value="${escapeHtml(p.responsable)}"></div>
          <div class="form-field"><label class="form-label">Recursos</label><input type="text" data-campo="recursos" value="${escapeHtml(p.recursos)}"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-field"><label class="form-label">Inicio</label><input type="date" data-campo="inicio" value="${p.inicio}"></div>
          <div class="form-field"><label class="form-label">Cierre</label><input type="date" data-campo="cierre" value="${p.cierre}"></div>
        </div>
      </div>
    </div>`
    )
    .join("");

  cont.querySelectorAll("[data-quitar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      leerPropias(cont);
      propias.splice(Number(btn.dataset.quitar), 1);
      pintarPropias(container, contar);
      contar();
    });
  });

  cont.querySelectorAll("[data-campo='accion']").forEach((ta) => {
    ta.addEventListener("input", () => {
      leerPropias(cont);
      contar();
    });
  });
}

function leerPropias(cont) {
  cont.querySelectorAll("[data-propia]").forEach((div) => {
    const i = Number(div.dataset.propia);
    if (!propias[i]) return;
    for (const campo of ["dimension", "accion", "responsable", "recursos", "inicio", "cierre"]) {
      const el = div.querySelector(`[data-campo="${campo}"]`);
      if (el) propias[i][campo] = el.value;
    }
  });
}

// ---------------------------------------------------------------------------

/**
 * Sella el PDI.
 *
 * No bloquea por lo que se dejó fuera: nada de lo que propone el motor es
 * obligatorio de aceptar. Lo que sí hace es NOMBRARLO en la confirmación, para
 * que quitar una brecha crítica o dejar un criterio conductual sin compromiso
 * sea una decisión consciente y no un descuido — y después dejarlo escrito.
 */
async function sellarPDI(form, container, evaluacion, lineas, yaEnPDI, fort = [], cursoRel = null) {
  const contPropias = document.getElementById("lista-propias");
  if (contPropias) leerPropias(contPropias);

  const porClave = {};
  for (const l of lineas) porClave[claveLinea(l)] = l;

  const filas = [];
  const descartes = [];

  // --- líneas de curso ------------------------------------------------------
  container.querySelectorAll("[data-sel]").forEach((chk) => {
    const l = porClave[chk.dataset.sel];
    if (!l) return;
    const card = chk.closest(".motor-linea");
    const val = (c) => card.querySelector(`[data-campo="${c}"]`)?.value?.trim() || null;

    if (chk.checked) {
      filas.push({
        origen: l.origen,
        curso_codigo: l.curso_codigo || null,
        criterio_codigo: l.criterio_codigo || null,
        prioridad: l.prioridad ?? null,
        nota_criterio: l.nota ?? null,
        plazo_sugerido: l.plazo || null,
        horas: l.horas ?? null,
        precio_ref: l.precio_ref ?? null,
        dimension_criterio: l.dimension_nombre || l.dominio || "Batería del cargo",
        accion_smart: val("accion"),
        responsable_apoyo: val("responsable"),
        recursos: val("recursos"),
        fecha_inicio: val("inicio"),
        fecha_cierre: val("cierre"),
      });
    } else if (!chk.disabled) {
      descartes.push({
        linea: l,
        motivo: card.querySelector("[data-descarte]")?.value?.trim() || null,
        pedia: card.classList.contains("is-pide-motivo"),
      });
    }
  });

  // --- compromisos conductuales --------------------------------------------
  const sinCompromiso = [];
  container.querySelectorAll("[data-compromiso]").forEach((ta) => {
    const l = porClave[ta.dataset.compromiso];
    if (!l) return;
    const texto = ta.value.trim();
    if (!texto) {
      sinCompromiso.push(l.criterio_codigo);
      return;
    }
    const card = ta.closest(".motor-linea");
    filas.push({
      origen: "conducta",
      curso_codigo: null,
      criterio_codigo: l.criterio_codigo,
      prioridad: null,
      nota_criterio: l.nota ?? null,
      plazo_sugerido: l.plazo || null,
      horas: null,
      precio_ref: null,
      dimension_criterio: l.dimension_nombre || "Conducta",
      accion_smart: texto,
      responsable_apoyo: card.querySelector("[data-compromiso-resp]")?.value?.trim() || "Supervisor directo",
      recursos: null,
      fecha_inicio: hoyISO(),
      fecha_cierre: card.querySelector("[data-compromiso-fecha]")?.value || null,
    });
  });

  // --- fortalezas: relator, reconocimiento de sección, profundización ------
  const porFort = {};
  for (const f of fort) porFort[claveFort(f)] = f;

  const candidaturas = [];
  container.querySelectorAll("[data-fort-sel]:checked").forEach((chk) => {
    const f = porFort[chk.dataset.fortSel];
    if (!f || chk.disabled) return;
    const card = chk.closest(".motor-linea");
    const texto = card.querySelector("[data-fort-accion]")?.value?.trim() || f.accion_sugerida;

    filas.push({
      origen: f.tipo === "relator" ? "relator" : f.tipo === "profundizacion" ? "profundizacion" : "reconocimiento",
      curso_codigo: null,
      criterio_codigo: null,
      prioridad: null,
      nota_criterio: f.nota ?? null,
      plazo_sugerido: null,
      horas: null,
      precio_ref: null,
      dimension_criterio: f.dimension_nombre || f.dominio_sugerido || "Transversal",
      accion_smart: texto,
      responsable_apoyo: f.tipo === "relator" ? "Bienestar y Crecimiento" : "Supervisor directo",
      recursos: null,
      fecha_inicio: card.querySelector("[data-fort-inicio]")?.value || hoyISO(),
      fecha_cierre: card.querySelector("[data-fort-cierre]")?.value || enDias(180),
    });

    // La candidatura, además de la línea, es un registro con su propio ciclo de
    // vida: el Comité la resuelve después y eso no vive en el PDI.
    if (f.tipo === "relator") {
      candidaturas.push({
        evaluacion_id: evaluacion.id,
        perfil_id: evaluacion.evaluado_id || evaluacion.evaluado?.id || null,
        origen: f.dominio_sugerido ? "criterio" : "seccion",
        dimension_codigo: f.dimension_codigo || null,
        nota: f.nota ?? null,
        promedio_seccion: f.promedio_seccion ?? null,
        dominio_sugerido: f.dominio_sugerido || null,
      });
    }
  });

  // El curso que habilita para relatar, si quedó marcado.
  const chkCurso = container.querySelector("[data-curso-relator]:checked");
  if (chkCurso && !chkCurso.disabled && cursoRel) {
    filas.push({
      origen: "relator",
      curso_codigo: cursoRel.curso_codigo,
      criterio_codigo: null,
      prioridad: null,
      nota_criterio: null,
      plazo_sugerido: null,
      horas: cursoRel.horas ?? null,
      precio_ref: cursoRel.precio_ref ?? null,
      dimension_criterio: "Formación de relator interno",
      accion_smart:
        `Cursar «${cursoRel.curso_nombre}» (${cursoRel.curso_codigo}, ${cursoRel.modalidad || ""}, ` +
        `${cursoRel.horas || 0} h) para habilitarse como relator interno N4.`,
      responsable_apoyo: "Bienestar y Crecimiento (programación)",
      recursos: [cursoRel.financiamiento, cursoRel.precio_ref ? clp(cursoRel.precio_ref) + " ref." : null]
        .filter(Boolean)
        .join(" · "),
      fecha_inicio: hoyISO(),
      fecha_cierre: enDias(365),
    });
  }

  // --- acciones escritas a mano --------------------------------------------
  for (const p of propias) {
    if (!p.accion?.trim()) continue;
    filas.push({
      origen: "manual",
      curso_codigo: null,
      criterio_codigo: null,
      prioridad: null,
      nota_criterio: null,
      plazo_sugerido: null,
      horas: null,
      precio_ref: null,
      dimension_criterio: p.dimension?.trim() || null,
      accion_smart: p.accion.trim(),
      responsable_apoyo: p.responsable?.trim() || null,
      recursos: p.recursos?.trim() || null,
      fecha_inicio: p.inicio || null,
      fecha_cierre: p.cierre || null,
    });
  }

  // Lo único que se impide es guardar una línea marcada sin texto: eso no es una
  // decisión, es un formulario a medio llenar.
  if (filas.some((f) => !f.accion_smart)) {
    Toast.warning("Falta el texto de una línea", "Hay una línea marcada sin redacción. Complétala o desmárcala.");
    return;
  }

  if (!filas.length && !yaEnPDI) {
    const seguir = await Confirm.ask({
      title: "¿Sellar sin ninguna línea de PDI?",
      text:
        "No hay ninguna acción marcada ni escrita. La evaluación se puede cerrar así, pero el expediente va a " +
        "quedar sin plan de desarrollo. Si es a propósito, adelante.",
      variant: "danger",
      confirmText: "Sellar sin plan",
    });
    if (!seguir) return;
  }

  // --- la confirmación nombra lo que queda fuera ---------------------------
  const criticasFuera = descartes.filter((d) => d.pedia);
  const sinMotivo = criticasFuera.filter((d) => !d.motivo);

  const total = filas.length + yaEnPDI;
  const horas = filas.reduce((a, f) => a + (f.horas || 0), 0);
  const costo = filas.reduce((a, f) => a + (f.precio_ref || 0), 0);

  const avisos = [];
  if (criticasFuera.length) {
    avisos.push(
      `Quedan fuera ${plural(criticasFuera.length, "línea que la regla marca como no postergable", "líneas que la regla marca como no postergables")} ` +
        `(${criticasFuera.map((d) => d.linea.curso_codigo).join(", ")})` +
        (sinMotivo.length ? `, y ${sinMotivo.length} sin motivo escrito.` : ".")
    );
  }
  if (sinCompromiso.length) {
    avisos.push(
      `${sinCompromiso.join(", ")} ${sinCompromiso.length === 1 ? "tiene" : "tienen"} nota baja en un criterio ` +
        `conductual y ${sinCompromiso.length === 1 ? "queda" : "quedan"} sin compromiso registrado.`
    );
  }
  if (total > LINEAS_INSEGUIBLES) {
    avisos.push(`${total} líneas es un plan difícil de seguir en la práctica.`);
  }

  const extras = [];
  if (candidaturas.length) {
    const una = candidaturas.length === 1;
    extras.push(
      `Se ${una ? "propone" : "proponen"} ${plural(candidaturas.length, "candidatura", "candidaturas")} ` +
        `a relator interno N4; el Comité recibe el aviso para ${una ? "resolverla" : "resolverlas"}.`
    );
  }

  const ok = await Confirm.ask({
    title: "¿Sellar el PDI y pasar a firmas?",
    text:
      `Se sellan ${plural(filas.length, "línea", "líneas")} — ${total} en total — con ${horas} h de capacitación y ` +
      `${clp(costo)} de costo externo de referencia. ` +
      (extras.length ? extras.join(" ") + " " : "") +
      (avisos.length ? avisos.join(" ") + " " : "") +
      `Todo lo que dejes fuera queda registrado en el expediente. Después el acta espera las firmas.`,
    variant: avisos.length ? "danger" : "primary",
    confirmText: "Sellar y pasar a firmas",
  });
  if (!ok) return;

  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Sellando...";
  const rehabilitar = () => {
    btn.disabled = false;
    btn.textContent = "Sellar el PDI y pasar a firmas";
  };

  await guardarChecklist(container, evaluacion.id, "despues");

  if (filas.length) {
    const conNro = filas.map((f, i) => ({
      ...f,
      evaluacion_id: evaluacion.id,
      nro: yaEnPDI + i + 1,
      estado_accion: "pendiente",
    }));
    const { error: errPDI } = await supabase.from("eva_pdi").insert(conNro);
    if (errPDI) {
      Toast.error("No se pudieron guardar las líneas del PDI", errPDI.message);
      rehabilitar();
      return;
    }
  }

  // Las candidaturas a relator van a su propia tabla. Si esto falla no se aborta
  // el sello — la línea del PDI ya quedó — pero se avisa, porque sin el registro
  // el Comité no recibe el aviso y la candidatura muere ahí.
  if (candidaturas.length) {
    const { error: errCand } = await supabase.from("eva_relator_candidaturas").insert(candidaturas);
    if (errCand) {
      Toast.warning(
        "El PDI se guardó, las candidaturas a relator no",
        `${errCand.message}. Avísale a RRHH para que las registre a mano.`
      );
    }
  }

  // Los descartes van al expediente completos, con motivo o sin él: «se quitó y
  // no se escribió por qué» también es información para quien revise el caso.
  if (descartes.length) {
    const { error: errDesc } = await supabase.from("eva_pdi_descartes").insert(
      descartes.map((d) => ({
        evaluacion_id: evaluacion.id,
        curso_codigo: d.linea.curso_codigo || null,
        criterio_codigo: d.linea.criterio_codigo || null,
        prioridad: d.linea.prioridad ?? null,
        motivo: d.motivo,
      }))
    );
    if (errDesc) {
      Toast.warning("Las líneas se guardaron, los descartes no", `${errDesc.message}. Anótalos en el acta a mano.`);
    }
  }

  const codigo = document.getElementById("pl-recomendacion").value;
  const textoRecom = document.getElementById("pl-recomendacion").selectedOptions[0]?.textContent?.trim() || null;

  const { error } = await supabase
    .from("eva_evaluaciones")
    .update({
      recomendacion_codigo: codigo,
      recomendacion_final: textoRecom,
      justificacion_recomendacion: document.getElementById("pl-justificacion").value.trim(),
      fecha_cierre_pdi_estimada: document.getElementById("pl-cierre-pdi").value || null,
      estado: "pendiente_firmas",
      folio_aprobacion: `EVA-${String(evaluacion.nro_evaluacion || "").replace(/\s+/g, "") || "S/N"}-${new Date().getFullYear()}`,
    })
    .eq("id", evaluacion.id);

  if (error) {
    Toast.error("Las líneas se guardaron pero no se pudo avanzar", error.message);
    rehabilitar();
    return;
  }

  Toast.success(
    "PDI sellado",
    "Falta que firmen el acta. Con la última firma se cierra y las líneas viajan a la DNC del programa anual."
  );

  const { renderActa } = await import("./personal-acta.js");
  await renderActa(container, evaluacion.id);
}
