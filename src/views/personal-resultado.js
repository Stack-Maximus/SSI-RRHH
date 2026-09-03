/**
 * Lo que ve el EVALUADO después de que le entregan el resultado.
 *
 * Antes esta pantalla mezclaba todo: los puntajes y el cuestionario de
 * conformidad en un mismo formulario, así que la persona respondía «¿estás
 * conforme?» sin haber conversado nunca con su jefatura. Ahora está por etapas
 * y la conversación va en medio:
 *
 *   1. ve sus puntajes
 *   2. confirma que los recibió  ← acuse de recibo, no conformidad
 *   3. su jefatura agenda la 1:1
 *   4. conversan
 *   5. recién entonces responde las preguntas de cierre y declara conformidad
 *
 * Cada etapa se dibuja sola según el estado de la evaluación: la vista es una
 * sola y no hay forma de saltarse un paso desde la interfaz.
 */

import { supabase } from "../core/supabase.js";
import { Toast, Confirm } from "../ui/toast.js";
import { escapeHtml, formatDate, formatTime } from "../ui/utils.js";
import {
  ESTADO_LABELS,
  PASOS_CIERRE,
  yaPaso,
  posicion,
  CATEGORIA_LABELS,
  CATEGORIA_BADGE,
  MODALIDAD_LABELS,
  lecturaBrecha,
  PDI_ESTADO_LABELS,
  PDI_ESTADO_BADGE,
} from "./personal-flujo.js";

const n2 = (v) => (v == null ? "—" : String(Math.round(Number(v) * 100) / 100));

/**
 * Desde cuándo el trabajador puede descargar su expediente en Excel.
 *
 * Es el mismo criterio que eva_expediente_descargable() en la base — y la base
 * es la que manda: acá sólo se decide si se dibuja el botón. Si alguien llamara
 * la descarga antes de tiempo, RLS le devolvería un expediente vacío.
 *
 * 'consolidada' no está a propósito: ahí los puntajes ya existen pero RRHH
 * todavía no le entregó el resultado a la persona.
 */
const DESCARGABLE = ["entregada_trabajador", "resultados_aceptados", "reunion_agendada", "reunion_realizada",
  "reflexiones_enviadas", "pendiente_firmas", "cerrada_conforme", "cerrada_disconformidad", "archivada"];

let cacheDim = null;
async function dimensiones() {
  if (cacheDim) return cacheDim;
  const { data } = await supabase.from("eva_dimensiones").select("codigo, nombre, peso").order("peso", { ascending: false });
  cacheDim = data || [];
  return cacheDim;
}

export async function renderResultadoEvaluado(container, evaluacionId) {
  container.innerHTML = `<div class="view-loading">Cargando tu resultado...</div>`;

  const [{ data: ev, error }, dims] = await Promise.all([
    supabase
      .from("eva_evaluaciones")
      .select("*, evaluador:evaluador_id(nombre, cargo), ciclo:ciclo_id(titulo, tipo_periodo)")
      .eq("id", evaluacionId)
      .single(),
    dimensiones(),
  ]);

  if (error || !ev) {
    container.innerHTML = `<div class="placeholder error"><h2>No se pudo cargar</h2><p>${escapeHtml(error?.message || "Evaluación no encontrada")}</p></div>`;
    return;
  }

  const { data: pdi } = await supabase.from("eva_pdi").select("*").eq("evaluacion_id", ev.id).order("nro");

  container.innerHTML = `
    <div class="view-eva">
      <button class="btn btn-secondary" id="btn-volver-res" style="margin-bottom:16px;">← Volver</button>

      <div class="card">
        <div class="eva-head">
          <div>
            <h3 style="margin-bottom:2px;">Tu evaluación · ${escapeHtml(ev.ciclo?.titulo || "")}</h3>
            <p class="hint" style="margin:0;">Evaluada por ${escapeHtml(ev.evaluador?.nombre || "tu jefatura")}</p>
          </div>
          <div class="eva-head-acciones">
            <span class="badge ${ev.estado === "cerrada_disconformidad" ? "badge-danger" : "badge-info"}">
              ${escapeHtml(ESTADO_LABELS[ev.estado] || ev.estado)}
            </span>
            ${DESCARGABLE.includes(ev.estado)
              ? `<button class="btn btn-secondary" id="btn-bajar-expediente">⬇ Descargar en Excel</button>`
              : ""}
          </div>
        </div>
        ${stepper(ev)}
        ${DESCARGABLE.includes(ev.estado)
          ? `<p class="hint" style="margin:12px 0 0;">
               El Excel trae todo: tus respuestas, las notas y comentarios de tu jefatura, el resultado y tu plan de
               desarrollo. Es un documento reservado — contiene tus datos personales.
             </p>`
          : ""}
      </div>

      ${bloqueResultado(ev, dims)}
      ${bloqueEtapa(ev)}
      ${bloquePDI(pdi || [])}
    </div>
  `;

  document.getElementById("btn-volver-res").addEventListener("click", () => window.Router.go("personal"));
  engancharDescarga(ev);
  engancharEtapa(container, ev);
}

// ---------------------------------------------------------------------------

function engancharDescarga(ev) {
  const btn = document.getElementById("btn-bajar-expediente");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const texto = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando...";
    try {
      const { descargarExpediente } = await import("../ui/exportar-evaluacion.js");
      await descargarExpediente(ev.id);
      Toast.success("Descargado", "Guárdalo donde sólo tú tengas acceso: lleva tus datos personales.");
    } catch (e) {
      Toast.error("No se pudo generar el archivo", e.message || "Error desconocido");
    } finally {
      btn.disabled = false;
      btn.textContent = texto;
    }
  });
}

// ---------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------

function stepper(ev) {
  const actual = posicion(ev.estado);
  return `
    <ol class="eva-stepper">
      ${PASOS_CIERRE.map((p, i) => {
        const hecho = yaPaso(ev.estado, p.estado);
        const esActual = posicion(p.estado) === actual;
        return `
        <li class="eva-step ${hecho ? "is-hecho" : ""} ${esActual ? "is-actual" : ""}">
          <span class="eva-step-marca" aria-hidden="true">${hecho ? "✓" : i + 1}</span>
          <span class="eva-step-texto">
            <strong>${escapeHtml(p.titulo)}</strong>
            <em>${escapeHtml(p.quien)}</em>
          </span>
        </li>`;
      }).join("")}
    </ol>`;
}

// ---------------------------------------------------------------------------
// Los puntajes — siempre visibles desde la entrega
// ---------------------------------------------------------------------------

function bloqueResultado(ev, dims) {
  const filas = dims
    .map((d) => {
      const c = d.codigo.toLowerCase();
      const b = ev[`brecha_${c}`];
      const lec = lecturaBrecha(b);
      return `
      <tr>
        <td>${escapeHtml(d.nombre)}</td>
        <td>${Math.round(Number(d.peso) * 100)}%</td>
        <td>${n2(ev[`prom_auto_${c}`])}</td>
        <td><strong>${n2(ev[`prom_sup_${c}`])}</strong></td>
        <td>${b == null ? "—" : `${b > 0 ? "+" : ""}${n2(b)}`}</td>
        <td class="eva-lectura ${lec.clase}">${escapeHtml(lec.texto)}</td>
      </tr>`;
    })
    .join("");

  const cat = CATEGORIA_LABELS[ev.categoria];

  return `
    <div class="card" style="margin-top:20px;">
      <h3>Resultado por dimensión</h3>
      <p class="hint" style="margin:-2px 0 12px;">
        Escala de 1 a 5. La columna de lectura usa los mismos cortes que la planilla oficial:
        una diferencia de 1 punto o más entre tu autoevaluación y la de tu jefatura es un punto a conversar.
      </p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>Dimensión</th><th>Peso</th><th>Tu autoevaluación</th><th>Tu jefatura</th><th>Brecha</th><th>Lectura</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>

      <div class="eva-totales">
        <div class="eva-total">
          <span class="eva-total-label">Total de tu jefatura</span>
          <span class="eva-total-valor">${n2(ev.total_sup)}</span>
        </div>
        <div class="eva-total">
          <span class="eva-total-label">Tu autoevaluación</span>
          <span class="eva-total-valor is-secundario">${n2(ev.total_auto)}</span>
        </div>
        <div class="eva-total">
          <span class="eva-total-label">Categoría</span>
          <span class="eva-total-valor">${cat ? `<span class="badge ${CATEGORIA_BADGE[ev.categoria]}">${escapeHtml(cat)}</span>` : "—"}</span>
        </div>
      </div>
      ${ev.decision_asociada ? `<div class="stat-row"><span>Decisión asociada al rango</span><span>${escapeHtml(ev.decision_asociada)}</span></div>` : ""}
    </div>`;
}

// ---------------------------------------------------------------------------
// La etapa que toca ahora
// ---------------------------------------------------------------------------

function bloqueEtapa(ev) {
  switch (ev.estado) {
    case "entregada_trabajador":
      return `
        <div class="card eva-accion" style="margin-top:20px;">
          <h3>Confirma que recibiste tus resultados</h3>
          <p class="lead">
            Confirmar aquí <strong>no significa que estés de acuerdo</strong> con la calificación — significa
            que ya los viste y que estás en condiciones de conversarlos. La pregunta de conformidad viene
            después de la reunión con tu jefatura, y ahí puedes responder con total libertad.
          </p>
          <p class="hint">Al confirmar, tu jefatura recibe el aviso para agendar la entrevista.</p>
          <div class="form-actions">
            <button class="btn btn-primary" id="btn-aceptar-resultados">Confirmo que recibí mis resultados</button>
          </div>
        </div>`;

    case "resultados_aceptados":
      return espera(
        "Esperando que se agende la reunión",
        `Confirmaste la recepción el ${formatDate(ev.fecha_aceptacion_resultados) || "—"}. Tu jefatura ya recibió el aviso
         para agendar la entrevista 1:1, que según la pauta interna debe quedar con al menos 5 días hábiles de anticipación
         y durar unos 60 minutos. Te va a llegar un correo con la fecha.`
      );

    case "reunion_agendada":
      return `
        <div class="card" style="margin-top:20px;">
          <h3>Tu reunión 1:1 está agendada</h3>
          <div class="eva-reunion">
            <div class="stat-row"><span>Fecha</span><strong>${formatDate(ev.reunion_fecha) || "—"}</strong></div>
            <div class="stat-row"><span>Hora</span><strong>${formatTime(ev.reunion_hora) || "—"}</strong></div>
            <div class="stat-row"><span>Duración</span><span>${ev.reunion_duracion_min || 60} minutos</span></div>
            <div class="stat-row"><span>Modalidad</span><span>${escapeHtml(MODALIDAD_LABELS[ev.reunion_modalidad] || "—")}</span></div>
            <div class="stat-row"><span>${ev.reunion_modalidad === "videollamada_teams" ? "Enlace" : "Lugar"}</span>
              <span>${enlaceOTexto(ev.reunion_lugar)}</span></div>
          </div>
          <p class="hint" style="margin-top:12px;">
            Llega con tu autoevaluación fresca: en la reunión te van a pedir que hables primero de cómo te
            evaluaste tú. Después de la reunión se habilitan las preguntas de cierre.
          </p>
        </div>`;

    case "reunion_realizada":
      return formularioCierre(ev);

    case "reflexiones_enviadas":
      return espera(
        "Respuestas enviadas",
        `Ya enviaste tus respuestas${ev.acuerdo_trabajador ? ` y declaraste estar <strong>${escapeHtml(etiquetaAcuerdo(ev.acuerdo_trabajador))}</strong>` : ""}.
         Tu jefatura está definiendo el plan de acción; cuando lo cierre vas a poder ver las acciones acordadas acá mismo.`
      );

    case "pendiente_firmas":
      return `
        <div class="card eva-accion" style="margin-top:20px;">
          <h3>Falta firmar el acta de cierre</h3>
          <p class="lead">
            Tu jefatura ya definió el plan de desarrollo. Para cerrar formalmente hace falta la firma de las tres
            partes: tú, tu supervisor directo y la Jefatura de RRHH.
          </p>
          <p class="hint">
            Firmar no significa que estés de acuerdo con la calificación — tu declaración de conformidad ya quedó
            registrada y no cambia por esto.
          </p>
          <div class="form-actions">
            <button class="btn btn-primary" id="btn-ir-acta">Ver y firmar el acta</button>
          </div>
        </div>`;

    case "cerrada_conforme":
    case "cerrada_disconformidad":
    case "archivada":
      return `
        <div class="card" style="margin-top:20px;">
          <h3>Tus respuestas</h3>
          ${respuesta("Lo mejor que hiciste en el período", ev.reflexion_mejor)}
          ${respuesta("Lo que podrías mejorar", ev.reflexion_mejorar)}
          ${respuesta("Lo que necesitas para lograrlo", ev.reflexion_necesito)}
          ${respuesta("Tus metas para el próximo período", ev.reflexion_metas)}
          ${respuesta("Tus observaciones", ev.observaciones_trabajador)}
          <div class="stat-row"><span>Tu declaración de conformidad</span>
            <strong>${escapeHtml(etiquetaAcuerdo(ev.acuerdo_trabajador))}</strong></div>
          ${ev.recomendacion_final ? `<div class="stat-row"><span>Recomendación de tu jefatura</span><span>${escapeHtml(ev.recomendacion_final)}</span></div>` : ""}
          ${ev.folio_aprobacion ? `<div class="stat-row"><span>Folio</span><span>${escapeHtml(ev.folio_aprobacion)}</span></div>` : ""}
        </div>`;

    default:
      return "";
  }
}

function espera(titulo, cuerpo) {
  return `
    <div class="card eva-espera" style="margin-top:20px;">
      <h3>${escapeHtml(titulo)}</h3>
      <p class="lead" style="margin:0;">${cuerpo}</p>
    </div>`;
}

function respuesta(label, valor) {
  if (!valor) return "";
  return `
    <div class="eva-respuesta">
      <span class="eva-respuesta-label">${escapeHtml(label)}</span>
      <p>${escapeHtml(valor)}</p>
    </div>`;
}

function etiquetaAcuerdo(a) {
  return { conforme: "Conforme", parcialmente: "Parcialmente conforme", no_conforme: "No conforme" }[a] || "—";
}

/** El lugar puede ser un enlace de Teams o una sala física — se detecta. */
function enlaceOTexto(valor) {
  if (!valor) return "—";
  if (/^https?:\/\//i.test(valor)) {
    return `<a href="${escapeHtml(valor)}" target="_blank" rel="noopener noreferrer">Abrir la reunión</a>`;
  }
  return escapeHtml(valor);
}

// ---------------------------------------------------------------------------
// Formulario de cierre — solo después de la reunión
// ---------------------------------------------------------------------------

function formularioCierre(ev) {
  return `
    <div class="card eva-accion" style="margin-top:20px;">
      <h3>Preguntas de cierre</h3>
      <p class="lead">
        Ya conversaron los resultados en la reunión del ${formatDate(ev.reunion_fecha) || "—"}. Estas cuatro preguntas
        son tu parte del registro: sirven para construir tu plan de desarrollo.
      </p>
      <form id="form-cierre">
        <div class="form-field">
          <label class="form-label">¿Qué es lo mejor que hiciste este período?</label>
          <textarea id="cie-mejor" rows="3"></textarea>
        </div>
        <div class="form-field">
          <label class="form-label">¿Qué podrías mejorar?</label>
          <textarea id="cie-mejorar" rows="3"></textarea>
        </div>
        <div class="form-field">
          <label class="form-label">¿Qué necesitas para lograrlo?</label>
          <textarea id="cie-necesito" rows="3"></textarea>
        </div>
        <div class="form-field">
          <label class="form-label">Tus metas para el próximo período</label>
          <textarea id="cie-metas" rows="3"></textarea>
        </div>

        <h4 style="margin:20px 0 8px;">Tu declaración</h4>
        <div class="form-field">
          <label class="form-label">¿Estás de acuerdo con la calificación?<span class="req">*</span></label>
          <select id="cie-acuerdo" required>
            <option value="">Selecciona...</option>
            <option value="conforme">Sí, estoy conforme</option>
            <option value="parcialmente">Parcialmente</option>
            <option value="no_conforme">No estoy conforme</option>
          </select>
          <p class="hint" style="margin-top:6px;">
            Si respondes «no» o «parcialmente», RRHH recibe el aviso y activa la revisión del caso. No hay
            consecuencia alguna por declararlo: es tu derecho y está previsto en el procedimiento.
          </p>
        </div>
        <div class="form-field">
          <label class="form-label">Observaciones (opcional)</label>
          <textarea id="cie-observaciones" rows="3" placeholder="Todo lo que quieras dejar registrado"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Enviar mis respuestas</button>
        </div>
      </form>
    </div>`;
}

// ---------------------------------------------------------------------------
// PDI, cuando ya existe
// ---------------------------------------------------------------------------

function bloquePDI(pdi) {
  if (!pdi.length) return "";
  const filas = pdi
    .map(
      (a) => `
      <tr>
        <td>${a.nro ?? "—"}</td>
        <td>${escapeHtml(a.dimension_criterio || "—")}</td>
        <td>${escapeHtml(a.accion_smart || "—")}</td>
        <td>${escapeHtml(a.responsable_apoyo || "—")}</td>
        <td>${formatDate(a.fecha_cierre) || "—"}</td>
        <td><span class="badge ${PDI_ESTADO_BADGE[a.estado_accion] || "badge-neutral"}">${escapeHtml(PDI_ESTADO_LABELS[a.estado_accion] || a.estado_accion || "—")}</span></td>
      </tr>`
    )
    .join("");

  return `
    <div class="card" style="margin-top:20px;">
      <h3>Tu plan de desarrollo</h3>
      <p class="hint" style="margin:-2px 0 12px;">
        Las acciones acordadas. El seguimiento lo lleva el área de Crecimiento y Bienestar, que va a registrar
        dos controles por acción.
      </p>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>N°</th><th>Dimensión</th><th>Acción</th><th>Apoyo</th><th>Cierre</th><th>Estado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

function engancharEtapa(container, ev) {
  document.getElementById("btn-ir-acta")?.addEventListener("click", async () => {
    const { renderActa } = await import("./personal-acta.js");
    await renderActa(container, ev.id);
  });

  const btnAceptar = document.getElementById("btn-aceptar-resultados");
  if (btnAceptar) {
    btnAceptar.addEventListener("click", async () => {
      const ok = await Confirm.ask({
        title: "¿Confirmas que recibiste tus resultados?",
        text: "Esto no registra si estás de acuerdo o no — solo que ya los viste. Tu jefatura va a agendar la reunión para conversarlos.",
        confirmText: "Confirmar",
      });
      if (!ok) return;

      btnAceptar.disabled = true;
      const { error } = await supabase
        .from("eva_evaluaciones")
        .update({ estado: "resultados_aceptados", fecha_aceptacion_resultados: new Date().toISOString() })
        .eq("id", ev.id);

      if (error) {
        Toast.error("No se pudo confirmar", error.message);
        btnAceptar.disabled = false;
        return;
      }
      Toast.success("Confirmado", "Tu jefatura ya recibió el aviso para agendar la reunión.");
      await renderResultadoEvaluado(container, ev.id);
    });
  }

  const form = document.getElementById("form-cierre");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const acuerdo = document.getElementById("cie-acuerdo").value;

      const ok = await Confirm.ask({
        title: "¿Enviar tus respuestas?",
        text: "No vas a poder modificarlas después de enviarlas.",
        confirmText: "Enviar",
      });
      if (!ok) return;

      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Enviando...";

      const { error } = await supabase
        .from("eva_evaluaciones")
        .update({
          reflexion_mejor: document.getElementById("cie-mejor").value.trim() || null,
          reflexion_mejorar: document.getElementById("cie-mejorar").value.trim() || null,
          reflexion_necesito: document.getElementById("cie-necesito").value.trim() || null,
          reflexion_metas: document.getElementById("cie-metas").value.trim() || null,
          observaciones_trabajador: document.getElementById("cie-observaciones").value.trim() || null,
          acuerdo_trabajador: acuerdo,
          estado: "reflexiones_enviadas",
          fecha_respuesta_conformidad: new Date().toISOString(),
        })
        .eq("id", ev.id);

      if (error) {
        Toast.error("No se pudo enviar", error.message);
        btn.disabled = false;
        btn.textContent = "Enviar mis respuestas";
        return;
      }

      Toast.success("Respuestas enviadas", "Gracias. Tu jefatura va a definir el plan de acción.");
      await renderResultadoEvaluado(container, ev.id);
    });
  }
}
