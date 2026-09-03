/**
 * La reunión 1:1 entre evaluador y evaluado: agendarla y marcarla como
 * realizada.
 *
 * Los campos son los que pide la Hoja 10 de la planilla oficial (pauta
 * RRHH-INS-EVA-AD-002): fecha, hora, 60 minutos, modalidad presencial o
 * videollamada Teams, y sala privada o enlace reservado. La pauta también pide
 * agendar con al menos 5 días hábiles de anticipación — acá se avisa cuando no
 * se cumple, pero no se bloquea: hay casos reales de urgencia y quien agenda
 * sabe más que el sistema.
 */

import { supabase } from "../core/supabase.js";
import { Toast, Confirm } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";
import { diasHabiles, MODALIDAD_LABELS } from "./personal-flujo.js";
import { checklistHTML, engancharChecklist, guardarChecklist } from "./personal-checklist.js";

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Fecha sugerida: el primer día hábil a 6 días hábiles de hoy. */
function fechaSugerida() {
  const d = new Date();
  let habiles = 0;
  while (habiles < 6) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) habiles++;
  }
  return d.toISOString().slice(0, 10);
}

export async function abrirModalAgendarReunion(evaluacion, alGuardar) {
  const nombre = evaluacion.evaluado?.nombre || "el trabajador";
  // El bloque «antes» del checklist de la Hoja 10 se llena justamente acá: es
  // la preparación de la entrevista.
  const checklist = await checklistHTML(evaluacion.id, "antes");

  Modal.open({
    title: `Agendar reunión 1:1 con ${nombre}`,
    size: "lg",
    content: `
      <form id="form-reunion">
        <p class="lead" style="margin-bottom:14px;">
          ${escapeHtml(nombre)} ya confirmó que recibió sus resultados. Esta es la entrevista donde se
          conversan los puntajes; recién después de realizarla se le habilitan las preguntas de cierre.
        </p>

        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Fecha<span class="req">*</span></label>
            <input type="date" id="re-fecha" required min="${hoyISO()}" value="${fechaSugerida()}">
          </div>
          <div class="form-field">
            <label class="form-label">Hora<span class="req">*</span></label>
            <input type="time" id="re-hora" required value="10:00">
          </div>
        </div>

        <div id="re-aviso-plazo" class="form-error" style="display:none; margin-bottom:12px;"></div>

        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Duración (minutos)</label>
            <input type="number" id="re-duracion" min="15" max="240" step="15" value="60">
          </div>
          <div class="form-field">
            <label class="form-label">Modalidad<span class="req">*</span></label>
            <select id="re-modalidad" required>
              <option value="presencial">Presencial</option>
              <option value="videollamada_teams" selected>Videollamada Teams</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label class="form-label" id="re-lugar-label">Enlace de la reunión<span class="req">*</span></label>
          <input type="text" id="re-lugar" required placeholder="https://teams.microsoft.com/l/meetup-join/...">
          <p class="hint" style="margin-top:6px;" id="re-lugar-hint">
            Crea la reunión en Teams y pega el enlace acá — le llega por correo a ${escapeHtml(nombre)}.
          </p>
        </div>

        <h4 style="margin:22px 0 4px;">Preparación de la entrevista</h4>
        ${checklist}

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-re">Cancelar</button>
          <button type="submit" class="btn btn-primary">Agendar y avisar</button>
        </div>
      </form>
    `,
  });

  engancharChecklist(document);

  const fecha = document.getElementById("re-fecha");
  const aviso = document.getElementById("re-aviso-plazo");
  const modalidad = document.getElementById("re-modalidad");
  const lugar = document.getElementById("re-lugar");
  const lugarLabel = document.getElementById("re-lugar-label");
  const lugarHint = document.getElementById("re-lugar-hint");

  const revisarPlazo = () => {
    if (!fecha.value) return;
    const h = diasHabiles(new Date(), fecha.value);
    if (h < 5) {
      aviso.style.display = "";
      aviso.textContent = `Quedan ${h} día${h === 1 ? "" : "s"} hábil${h === 1 ? "" : "es"} hasta esa fecha. La pauta interna pide al menos 5 para que la persona pueda prepararse. Puedes agendarla igual si hay una razón.`;
    } else {
      aviso.style.display = "none";
    }
  };

  const ajustarLugar = () => {
    if (modalidad.value === "presencial") {
      lugarLabel.innerHTML = 'Lugar<span class="req">*</span>';
      lugar.placeholder = "Ej: Sala de reuniones 2, Casa Matriz Quilicura";
      lugarHint.textContent = "Tiene que ser un espacio privado: se van a conversar datos sensibles.";
    } else {
      lugarLabel.innerHTML = 'Enlace de la reunión<span class="req">*</span>';
      lugar.placeholder = "https://teams.microsoft.com/l/meetup-join/...";
      lugarHint.textContent = `Crea la reunión en Teams y pega el enlace acá — le llega por correo a ${nombre}.`;
    }
  };

  fecha.addEventListener("change", revisarPlazo);
  modalidad.addEventListener("change", ajustarLugar);
  revisarPlazo();

  document.getElementById("btn-cancelar-re").addEventListener("click", Modal.close);

  document.getElementById("form-reunion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Agendando...";

    const datos = {
      estado: "reunion_agendada",
      reunion_fecha: fecha.value,
      reunion_hora: document.getElementById("re-hora").value,
      reunion_duracion_min: Number(document.getElementById("re-duracion").value) || 60,
      reunion_modalidad: modalidad.value,
      reunion_lugar: lugar.value.trim() || null,
      reunion_agendada_en: new Date().toISOString(),
    };

    await guardarChecklist(document, evaluacion.id, "antes");

    const { error } = await supabase.from("eva_evaluaciones").update(datos).eq("id", evaluacion.id);

    if (error) {
      Toast.error("No se pudo agendar", error.message);
      btn.disabled = false;
      btn.textContent = "Agendar y avisar";
      return;
    }

    Modal.close();
    Toast.success("Reunión agendada", `Se le avisó a ${nombre} por correo con la fecha y el lugar.`);
    ofrecerInvitacion({ ...evaluacion, ...datos }, nombre);
    if (alGuardar) await alGuardar();
  });
}

/**
 * Un .ics para arrastrar la reunión al calendario. El correo de aviso no puede
 * llevar adjuntos por el camino actual (Postgres → send-email), así que el
 * archivo se ofrece acá y quien agenda lo reenvía si quiere.
 */
function ofrecerInvitacion(ev, nombre) {
  Modal.open({
    title: "Reunión agendada",
    content: `
      <p class="lead" style="margin-bottom:8px;">
        ${escapeHtml(nombre)} ya recibió el correo con la fecha, la hora y el ${ev.reunion_modalidad === "presencial" ? "lugar" : "enlace"}.
      </p>
      <div class="stat-row"><span>Fecha</span><strong>${formatDate(ev.reunion_fecha)}</strong></div>
      <div class="stat-row"><span>Hora</span><strong>${escapeHtml(String(ev.reunion_hora || "").slice(0, 5))}</strong></div>
      <div class="stat-row"><span>Modalidad</span><span>${escapeHtml(MODALIDAD_LABELS[ev.reunion_modalidad] || "—")}</span></div>
      <p class="hint" style="margin:14px 0;">
        Si quieres que además quede en el calendario de ambos, descarga la invitación y ábrela en Outlook.
      </p>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-ics">⬇ Descargar invitación (.ics)</button>
        <button type="button" class="btn btn-primary" id="btn-cerrar-ics">Listo</button>
      </div>
    `,
  });

  document.getElementById("btn-cerrar-ics").addEventListener("click", Modal.close);
  document.getElementById("btn-ics").addEventListener("click", () => descargarICS(ev, nombre));
}

function descargarICS(ev, nombre) {
  const [y, m, d] = String(ev.reunion_fecha).split("-").map(Number);
  const [hh, mm] = String(ev.reunion_hora || "10:00").split(":").map(Number);
  const inicio = new Date(y, m - 1, d, hh, mm, 0);
  const fin = new Date(inicio.getTime() + (ev.reunion_duracion_min || 60) * 60000);

  // Formato local con TZID: evita el corrimiento de hora que produce convertir
  // a UTC sin declarar la zona.
  const fmt = (dt) =>
    `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}` +
    `T${String(dt.getHours()).padStart(2, "0")}${String(dt.getMinutes()).padStart(2, "0")}00`;

  // Los saltos de línea en un .ics van con \n literal escapado.
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Metalium//SGC//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:eva-${ev.id}@sgc.metalium.cl`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART;TZID=America/Santiago:${fmt(inicio)}`,
    `DTEND;TZID=America/Santiago:${fmt(fin)}`,
    `SUMMARY:${esc(`Entrevista de evaluación de desempeño · ${nombre}`)}`,
    `LOCATION:${esc(ev.reunion_lugar)}`,
    `DESCRIPTION:${esc(
      "Entrevista one-to-one de evaluación de desempeño (pauta RRHH-INS-EVA-AD-002).\n" +
        "60 minutos. El evaluado habla primero de su autoevaluación; se revisan las 5 dimensiones " +
        "partiendo por las fortalezas y se co-construye el plan de desarrollo."
    )}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Entrevista_evaluacion_${String(nombre).replace(/\s+/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------

export async function abrirModalReunionRealizada(evaluacion, alGuardar) {
  const nombre = evaluacion.evaluado?.nombre || "el trabajador";
  // Bloque «durante»: el guion de 6 etapas de la pauta.
  const checklist = await checklistHTML(evaluacion.id, "durante");

  Modal.open({
    title: "Marcar la reunión como realizada",
    content: `
      <form id="form-realizada">
        <p class="lead" style="margin-bottom:12px;">
          Al confirmar, ${escapeHtml(nombre)} puede responder las preguntas de cierre y declarar si está
          conforme con la calificación.
        </p>
        <div class="stat-row"><span>Reunión agendada para</span><strong>${formatDate(evaluacion.reunion_fecha) || "—"}</strong></div>
        <div class="form-field" style="margin-top:14px;">
          <label class="form-label">Notas de la entrevista (opcional)</label>
          <textarea id="re-notas" rows="4" placeholder="Acuerdos, puntos que quedaron pendientes, evidencias presentadas...">${escapeHtml(evaluacion.reunion_notas || "")}</textarea>
          <p class="hint" style="margin-top:6px;">Queda en el expediente de la evaluación. El evaluado no las ve.</p>
        </div>

        <h4 style="margin:22px 0 4px;">Cómo se dio la entrevista</h4>
        ${checklist}

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-real">Cancelar</button>
          <button type="submit" class="btn btn-primary">La reunión se realizó</button>
        </div>
      </form>
    `,
  });

  engancharChecklist(document);
  document.getElementById("btn-cancelar-real").addEventListener("click", Modal.close);

  document.getElementById("form-realizada").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    await guardarChecklist(document, evaluacion.id, "durante");

    const { error } = await supabase
      .from("eva_evaluaciones")
      .update({
        estado: "reunion_realizada",
        reunion_realizada_en: new Date().toISOString(),
        reunion_notas: document.getElementById("re-notas").value.trim() || null,
      })
      .eq("id", evaluacion.id);

    if (error) {
      Toast.error("No se pudo registrar", error.message);
      btn.disabled = false;
      return;
    }

    Modal.close();
    Toast.success("Reunión registrada", `${nombre} ya puede responder las preguntas de cierre.`);
    if (alGuardar) await alGuardar();
  });
}
