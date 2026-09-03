/**
 * Comunicación del resultado al proveedor — lo que antes hacía el comité y
 * ahora hace GOL directamente.
 *
 * Lo que había antes: un botón «Comunicar al proveedor» que solo cambiaba el
 * estado y ponía la fecha. No se enviaba nada y no quedaba registro de qué se
 * le dijo. Ahora GOL ve el consolidado, recibe la carta ya redactada según la
 * clasificación obtenida, la edita si quiere, ajusta destinatarios y copias, y
 * al enviar queda el texto exacto guardado en prov_cartas.
 *
 * El editor es un contenteditable y no un textarea con HTML crudo: quien manda
 * estas cartas es GOL, no un desarrollador. Lo que se guarda pasa por un
 * saneado con lista blanca de etiquetas — el contenido lo escribe alguien de
 * confianza, pero termina en el cliente de correo de un tercero y no cuesta
 * nada dejarlo limpio.
 *
 * El envío va por la función prov_enviar_carta y no por supabase.functions:
 * la Edge Function send-email no maneja CORS, solo acepta llamadas
 * servidor-a-servidor. Además así el envío, el cambio de estado y la
 * actualización del maestro ocurren en una sola transacción.
 */

import { supabase } from "../core/supabase.js";
import { state } from "../core/state.js";
import { Toast, Confirm } from "../ui/toast.js";
import { escapeHtml, formatDate } from "../ui/utils.js";

const AREAS = ["gol", "gfc", "gi", "go", "gsst", "rrhh"];
const AREA_LABELS = {
  gol: "Operaciones Logísticas (GOL)",
  gfc: "Finanzas y Contabilidad (GFC)",
  gi: "Ingeniería (GI)",
  go: "Operaciones (GO)",
  gsst: "Seguridad y Salud (GSST)",
  rrhh: "Recursos Humanos (RRHH)",
};

const CLASIF = {
  a_preferente: { label: "A · Preferente", badge: "badge-success" },
  b_aprobado: { label: "B · Aprobado", badge: "badge-success" },
  c_condicionado: { label: "C · Condicionado", badge: "badge-warning" },
  d_no_aprobado: { label: "D · No aprobado", badge: "badge-danger" },
};

const REQUIERE_PLAN = ["c_condicionado", "d_no_aprobado"];

const n2 = (v) => (v == null ? "—" : String(Math.round(Number(v) * 100) / 100));
const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Suma días hábiles a hoy (sin considerar feriados). */
function enDiasHabiles(n) {
  const d = new Date();
  let h = 0;
  while (h < n) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) h++;
  }
  return d.toISOString().slice(0, 10);
}

function enDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const fmt = (iso) => formatDate(iso) || "—";

// ---------------------------------------------------------------------------
// Saneado del HTML de la carta
// ---------------------------------------------------------------------------

const TAGS_OK = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "H3", "H4", "DIV", "SPAN", "A"]);
const ATTRS_OK = new Set(["href", "style"]);

/**
 * Deja solo etiquetas y atributos de la lista blanca. No pretende ser una
 * defensa contra un atacante con acceso a la cuenta de GOL — pretende que no se
 * cuele un script o un onclick por copiar y pegar desde Word o desde un correo.
 */
function sanear(html) {
  const cont = document.createElement("div");
  cont.innerHTML = html;

  const recorrer = (nodo) => {
    for (const hijo of [...nodo.childNodes]) {
      if (hijo.nodeType === Node.COMMENT_NODE) {
        hijo.remove();
        continue;
      }
      if (hijo.nodeType !== Node.ELEMENT_NODE) continue;

      if (!TAGS_OK.has(hijo.tagName)) {
        // Se descarta la etiqueta pero se conserva su contenido.
        const frag = document.createDocumentFragment();
        while (hijo.firstChild) frag.appendChild(hijo.firstChild);
        hijo.replaceWith(frag);
        recorrer(nodo);
        return;
      }

      for (const attr of [...hijo.attributes]) {
        const nombre = attr.name.toLowerCase();
        if (!ATTRS_OK.has(nombre) || nombre.startsWith("on")) {
          hijo.removeAttribute(attr.name);
        } else if (nombre === "href" && /^\s*javascript:/i.test(attr.value)) {
          hijo.removeAttribute(attr.name);
        }
      }
      recorrer(hijo);
    }
  };

  recorrer(cont);
  return cont.innerHTML;
}

// ---------------------------------------------------------------------------
// Precarga de la plantilla
// ---------------------------------------------------------------------------

function tablaNotas(ev) {
  const filas = AREAS.map(
    (a) => `<tr>
      <td style="padding:5px 8px; border-bottom:1px solid #e3e8ef;">${AREA_LABELS[a]}</td>
      <td style="padding:5px 8px; border-bottom:1px solid #e3e8ef; text-align:right;"><strong>${n2(ev[`nota_${a}`])}</strong></td>
    </tr>`
  ).join("");

  return `<table style="width:100%; border-collapse:collapse; margin:14px 0; font-size:13px;">
    <thead><tr>
      <th style="text-align:left; padding:5px 8px; background:#f5f7fb; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#5a6b85;">Área evaluadora</th>
      <th style="text-align:right; padding:5px 8px; background:#f5f7fb; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#5a6b85;">Nota</th>
    </tr></thead>
    <tbody>${filas}
      <tr><td style="padding:7px 8px;"><strong>Total ponderado</strong></td>
          <td style="padding:7px 8px; text-align:right;"><strong>${n2(ev.total_ponderado)}</strong> / 5,00</td></tr>
    </tbody>
  </table>`;
}

function rellenar(plantillaHtml, ev, prov, ciclo, decision) {
  const veto = ev.veto_aplicado
    ? `<p><strong>Nota sobre criterio crítico:</strong> se aplicó veto por el criterio ${escapeHtml(ev.veto_criterio || "")}, ` +
      `lo que determina la clasificación con independencia del promedio obtenido.</p>`
    : "";

  const reemplazos = {
    "{{proveedor}}": escapeHtml(prov?.razon_social || ""),
    "{{rut}}": escapeHtml(prov?.rut || ""),
    "{{ciclo}}": escapeHtml(ciclo?.titulo || ciclo?.periodo_evaluado || ""),
    "{{obra}}": escapeHtml(ev.obra_contrato || "—"),
    "{{total}}": n2(ev.total_ponderado),
    "{{clasificacion}}": CLASIF[ev.clasificacion]?.label || ev.clasificacion || "",
    "{{decision}}": escapeHtml(decision || ev.decision_asociada || ""),
    "{{notas_areas}}": tablaNotas(ev),
    "{{fecha}}": fmt(hoyISO()),
    "{{plazo_plan}}": `${fmt(enDiasHabiles(10))} (10 días hábiles)`,
    "{{fecha_reeval}}": fmt(enDias(90)),
    "{{veto}}": veto,
  };

  let salida = plantillaHtml;
  for (const [clave, valor] of Object.entries(reemplazos)) {
    salida = salida.split(clave).join(valor);
  }
  return salida;
}

// ---------------------------------------------------------------------------

export async function renderComunicarProveedor(container, evaluacionId) {
  container.innerHTML = `<div class="view-loading">Preparando la carta...</div>`;

  const { data: ev, error } = await supabase
    .from("prov_evaluaciones")
    .select("*, proveedor:proveedor_id(id, razon_social, rut, correo, contacto, categoria, critico), ciclo:ciclo_id(titulo, periodo_evaluado)")
    .eq("id", evaluacionId)
    .single();

  if (error || !ev) {
    container.innerHTML = `<div class="placeholder error"><h2>No se pudo cargar la evaluación</h2><p>${escapeHtml(error?.message || "")}</p></div>`;
    return;
  }

  const [{ data: plantilla }, { data: rango }, { data: cartas }, { data: planes }] = await Promise.all([
    supabase.from("prov_carta_plantillas").select("*").eq("clasificacion", ev.clasificacion).maybeSingle(),
    supabase.from("prov_rangos").select("clasificacion, decision_asociada").eq("clasificacion", ev.clasificacion).maybeSingle(),
    supabase.from("prov_cartas").select("*").eq("evaluacion_id", evaluacionId).order("creada_en", { ascending: false }),
    supabase.from("prov_planes_accion").select("*").eq("evaluacion_id", evaluacionId),
  ]);

  const yaComunicada = ["comunicada", "cerrada"].includes(ev.estado);
  const requierePlan = REQUIERE_PLAN.includes(ev.clasificacion);
  const tienePlan = (planes || []).length > 0;

  const cuerpoInicial = plantilla
    ? rellenar(plantilla.cuerpo_html, ev, ev.proveedor, ev.ciclo, rango?.decision_asociada)
    : `<p>Estimados señores de <strong>${escapeHtml(ev.proveedor?.razon_social || "")}</strong>:</p>
       <p>Comunicamos el resultado de la evaluación de desempeño correspondiente al período
       <strong>${escapeHtml(ev.ciclo?.titulo || "")}</strong>: nota <strong>${n2(ev.total_ponderado)}</strong>,
       clasificación <strong>${CLASIF[ev.clasificacion]?.label || ev.clasificacion || ""}</strong>.</p>
       ${tablaNotas(ev)}`;

  const asuntoInicial = plantilla
    ? rellenar(plantilla.asunto, ev, ev.proveedor, ev.ciclo, rango?.decision_asociada)
    : `Resultado de evaluación de desempeño como proveedor — ${ev.proveedor?.razon_social || ""}`;

  container.innerHTML = `
    <div class="view-eva">
      <button class="btn btn-secondary" id="btn-volver-com" style="margin-bottom:16px;">← Volver</button>

      ${bloqueConsolidado(ev, rango)}
      ${yaComunicada ? bloqueYaEnviada(cartas || []) : bloqueEditor(ev, asuntoInicial, cuerpoInicial, plantilla)}
      ${yaComunicada && requierePlan ? bloquePlan(ev, planes || []) : ""}
      ${yaComunicada && ev.estado === "comunicada" ? bloqueCierre(ev, requierePlan, tienePlan) : ""}
      ${!yaComunicada && (cartas || []).length ? bloqueHistorial(cartas) : ""}
    </div>
  `;

  document.getElementById("btn-volver-com").addEventListener("click", () => window.Router.go("proveedores"));
  enganchar(container, ev, evaluacionId);
}

// ---------------------------------------------------------------------------

function bloqueConsolidado(ev, rango) {
  const c = CLASIF[ev.clasificacion];
  const filas = AREAS.map((a) => {
    const nota = ev[`nota_${a}`];
    return `<tr>
      <td>${AREA_LABELS[a]}</td>
      <td><strong>${n2(nota)}</strong></td>
      <td>${nota == null ? "—" : nota < 3 ? '<span class="badge badge-warning">Bajo el estándar</span>' : nota >= 4 ? '<span class="badge badge-success">Sobre el estándar</span>' : '<span class="badge badge-neutral">Cumple</span>'}</td>
    </tr>`;
  }).join("");

  return `
    <div class="card">
      <div class="eva-head">
        <div>
          <h3 style="margin-bottom:2px;">${escapeHtml(ev.proveedor?.razon_social || "")}</h3>
          <p class="hint" style="margin:0;">
            RUT ${escapeHtml(ev.proveedor?.rut || "—")} ·
            ${escapeHtml(ev.ciclo?.titulo || "")} ·
            ${escapeHtml(ev.categoria_aplicada || "")}
            ${ev.obra_contrato ? ` · ${escapeHtml(ev.obra_contrato)}` : ""}
            ${ev.proveedor?.critico ? ' · <span class="badge badge-warning">Proveedor crítico</span>' : ""}
          </p>
        </div>
        ${c ? `<span class="badge ${c.badge}">${c.label}</span>` : ""}
      </div>

      <div class="eva-totales">
        <div class="eva-total">
          <span class="eva-total-label">Total ponderado</span>
          <span class="eva-total-valor">${n2(ev.total_ponderado)}</span>
        </div>
        <div class="eva-total">
          <span class="eva-total-label">Clasificación</span>
          <span class="eva-total-valor">${c ? `<span class="badge ${c.badge}">${c.label}</span>` : "—"}</span>
        </div>
        ${
          ev.tendencia_vs_anterior != null
            ? `<div class="eva-total">
                 <span class="eva-total-label">Respecto del período anterior</span>
                 <span class="eva-total-valor">${ev.tendencia_vs_anterior > 0 ? "+" : ""}${n2(ev.tendencia_vs_anterior)}</span>
               </div>`
            : ""
        }
      </div>

      ${
        ev.veto_aplicado
          ? `<div class="eva-nota-cierre is-alerta">
               <strong>Veto aplicado</strong> por el criterio ${escapeHtml(ev.veto_criterio || "")}. La clasificación
               quedó forzada a D con independencia del promedio.
             </div>`
          : ""
      }

      <div class="tabla-scroll" style="margin-top:14px;">
        <table class="data-table">
          <thead><tr><th>Área evaluadora</th><th>Nota</th><th>Lectura</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>

      ${(rango?.decision_asociada || ev.decision_asociada) ? `<div class="eva-respuesta" style="margin-top:10px;"><span class="eva-respuesta-label">Decisión asociada al rango</span><p>${escapeHtml(rango?.decision_asociada || ev.decision_asociada)}</p></div>` : ""}
    </div>`;
}

function bloqueEditor(ev, asunto, cuerpo, plantilla) {
  const correo = ev.proveedor?.correo || "";

  return `
    <div class="card eva-accion" style="margin-top:20px;">
      <div class="eva-head">
        <div>
          <h3 style="margin-bottom:2px;">Carta al proveedor</h3>
          <p class="hint" style="margin:0;">
            ${plantilla
              ? `Precargada con la plantilla de <strong>${CLASIF[ev.clasificacion]?.label || ev.clasificacion}</strong>. Edítala libremente antes de enviar.`
              : `No hay plantilla para esta clasificación — se armó un texto mínimo con los datos del consolidado.`}
          </p>
        </div>
      </div>

      <div class="form-field" style="margin-top:14px;">
        <label class="form-label">Asunto<span class="req">*</span></label>
        <input type="text" id="ca-asunto" value="${escapeHtml(asunto)}">
      </div>

      <div class="form-grid-2">
        <div class="form-field">
          <label class="form-label">Destinatarios<span class="req">*</span></label>
          <textarea id="ca-destinatarios" rows="2" placeholder="correo@proveedor.cl">${escapeHtml(correo)}</textarea>
          <p class="hint" style="margin-top:5px;">
            ${correo ? "Precargado del maestro de proveedores." : "El proveedor no tiene correo en el maestro."}
            Uno por línea, o separados por coma.
          </p>
        </div>
        <div class="form-field">
          <label class="form-label">En copia (interno)</label>
          <textarea id="ca-copias" rows="2" placeholder="adquisiciones@metalium.cl"></textarea>
          <p class="hint" style="margin-top:5px;">
            Se envía un correo por destinatario, así el proveedor no ve las direcciones internas.
          </p>
        </div>
      </div>

      <div class="form-field">
        <label class="form-label">Cuerpo de la carta<span class="req">*</span></label>
        <div class="carta-toolbar" role="group" aria-label="Formato">
          <button type="button" class="carta-btn" data-fmt="bold" title="Negrita (Ctrl+B)"><strong>N</strong></button>
          <button type="button" class="carta-btn" data-fmt="italic" title="Cursiva (Ctrl+I)"><em>C</em></button>
          <button type="button" class="carta-btn" data-fmt="insertUnorderedList" title="Lista">• Lista</button>
          <button type="button" class="carta-btn" data-fmt="removeFormat" title="Quitar formato">Limpiar</button>
        </div>
        <div id="ca-cuerpo" class="carta-editor" contenteditable="true" role="textbox" aria-multiline="true">${cuerpo}</div>
        <p class="hint" style="margin-top:6px;">
          Así es como lo va a ver el proveedor. El correo agrega el encabezado de Metalium y un pie que indica a quién
          responder — no el de «no responder este correo» que llevan los avisos automáticos.
        </p>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-restaurar-carta">Restaurar la plantilla</button>
        <button type="button" class="btn btn-primary" id="btn-enviar-carta">Enviar la carta al proveedor</button>
      </div>
    </div>`;
}

function bloqueYaEnviada(cartas) {
  const ultima = cartas[0];
  if (!ultima) return "";

  return `
    <div class="card" style="margin-top:20px;">
      <div class="eva-head">
        <div>
          <h3 style="margin-bottom:2px;">Carta enviada</h3>
          <p class="hint" style="margin:0;">Enviada el ${fmt(ultima.enviada_en)} · no se puede modificar</p>
        </div>
        <span class="badge badge-success">Comunicada</span>
      </div>

      <div class="stat-row"><span>Asunto</span><span>${escapeHtml(ultima.asunto)}</span></div>
      <div class="stat-row"><span>Destinatarios</span><span>${(ultima.destinatarios || []).map(escapeHtml).join(", ") || "—"}</span></div>
      ${(ultima.copias || []).length ? `<div class="stat-row"><span>En copia</span><span>${ultima.copias.map(escapeHtml).join(", ")}</span></div>` : ""}

      <details class="viz-tabla" style="margin-top:12px;">
        <summary>Ver el texto que se envió</summary>
        <div class="carta-enviada">${ultima.cuerpo_html}</div>
      </details>

      ${cartas.length > 1 ? `<p class="hint" style="margin-top:10px;">Hay ${cartas.length} cartas registradas para esta evaluación.</p>` : ""}
    </div>`;
}

function bloqueHistorial(cartas) {
  return `
    <div class="card" style="margin-top:20px;">
      <h3>Cartas anteriores de esta evaluación</h3>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Asunto</th><th>Destinatarios</th><th>Estado</th></tr></thead>
          <tbody>
            ${cartas
              .map(
                (c) => `<tr>
                  <td>${fmt(c.enviada_en || c.creada_en)}</td>
                  <td>${escapeHtml(c.asunto)}</td>
                  <td>${(c.destinatarios || []).map(escapeHtml).join(", ")}</td>
                  <td><span class="badge ${c.estado === "enviada" ? "badge-success" : "badge-neutral"}">${escapeHtml(c.estado)}</span></td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function bloquePlan(ev, planes) {
  if (planes.length) {
    return `
      <div class="card" style="margin-top:20px;">
        <h3>Plan de acción del proveedor</h3>
        ${planes
          .map(
            (p) => `
          <div class="eva-respuesta">
            <span class="eva-respuesta-label">Compromisos</span>
            <p>${escapeHtml(p.compromisos || "—")}</p>
          </div>
          <div class="stat-row"><span>Plazo de entrega del plan</span><strong>${fmt(p.plazo)}</strong></div>
          <div class="stat-row"><span>Fecha de reevaluación</span><strong>${fmt(p.fecha_reevaluacion)}</strong></div>
          <div class="stat-row"><span>Estado</span><span>${escapeHtml(p.estado || "activo")}</span></div>
          ${p.verificacion ? `<div class="eva-respuesta"><span class="eva-respuesta-label">Verificación</span><p>${escapeHtml(p.verificacion)}</p></div>` : ""}`
          )
          .join("<hr style='border:none; border-top:1px solid var(--border); margin:14px 0;'>")}
      </div>`;
  }

  return `
    <div class="card eva-accion" style="margin-top:20px;">
      <h3>Registra el plan de acción</h3>
      <p class="lead">
        Una clasificación <strong>${CLASIF[ev.clasificacion]?.label || ev.clasificacion}</strong> exige compromisos con
        plazo y una reevaluación. Sin esto la evaluación no se puede cerrar.
      </p>
      <form id="form-plan">
        <div class="form-field">
          <label class="form-label">Compromisos acordados<span class="req">*</span></label>
          <textarea id="pl-compromisos" rows="4" required placeholder="Qué se comprometió el proveedor a corregir, con qué evidencia se va a verificar"></textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Plazo de entrega del plan<span class="req">*</span></label>
            <input type="date" id="pl-plazo" required value="${enDiasHabiles(10)}">
          </div>
          <div class="form-field">
            <label class="form-label">Fecha de reevaluación<span class="req">*</span></label>
            <input type="date" id="pl-reeval" required value="${enDias(90)}">
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Guardar el plan de acción</button>
        </div>
      </form>
    </div>`;
}

function bloqueCierre(ev, requierePlan, tienePlan) {
  const puede = !requierePlan || tienePlan;
  return `
    <div class="card" style="margin-top:20px;">
      <h3>Cerrar la evaluación</h3>
      <p class="hint" style="margin:-2px 0 12px;">
        ${puede
          ? "Ya se comunicó el resultado. Al cerrar, la evaluación queda archivada con su clasificación vigente."
          : `Falta registrar el plan de acción: una ${CLASIF[ev.clasificacion]?.label || ev.clasificacion} no se puede cerrar sin compromisos.`}
      </p>
      <div class="form-actions">
        <button class="btn ${puede ? "btn-primary" : "btn-secondary"}" id="btn-cerrar-eval" ${puede ? "" : "disabled"}>
          Cerrar la evaluación
        </button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------

function leerCorreos(valor) {
  return String(valor || "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const ES_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function enganchar(container, ev, evaluacionId) {
  // --- editor de la carta ---
  const editor = document.getElementById("ca-cuerpo");
  if (editor) {
    container.querySelectorAll("[data-fmt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editor.focus();
        // execCommand está deprecado pero sigue siendo lo único que funciona en
        // todos los navegadores para un contenteditable sin sumar dependencias.
        document.execCommand(btn.dataset.fmt, false, null);
      });
    });
  }

  document.getElementById("btn-restaurar-carta")?.addEventListener("click", async () => {
    const ok = await Confirm.ask({
      title: "¿Restaurar la plantilla?",
      text: "Se pierde lo que hayas editado en el cuerpo de la carta.",
      confirmText: "Restaurar",
    });
    if (ok) await renderComunicarProveedor(container, evaluacionId);
  });

  document.getElementById("btn-enviar-carta")?.addEventListener("click", async () => {
    const asunto = document.getElementById("ca-asunto").value.trim();
    const destinatarios = leerCorreos(document.getElementById("ca-destinatarios").value);
    const copias = leerCorreos(document.getElementById("ca-copias").value);
    const cuerpo = sanear(editor.innerHTML);

    if (!asunto) {
      Toast.warning("Falta el asunto", "La carta necesita un asunto.");
      return;
    }
    if (!destinatarios.length) {
      Toast.warning("Falta el destinatario", "Agrega al menos un correo del proveedor.");
      return;
    }
    const malos = [...destinatarios, ...copias].filter((c) => !ES_CORREO.test(c));
    if (malos.length) {
      Toast.warning("Hay correos mal escritos", malos.join(", "));
      return;
    }
    if (!editor.textContent.trim()) {
      Toast.warning("La carta está vacía", "Escribe el cuerpo antes de enviar.");
      return;
    }

    const ok = await Confirm.ask({
      title: `¿Enviar la carta a ${ev.proveedor?.razon_social || "el proveedor"}?`,
      text:
        `Se va a enviar a ${destinatarios.length} destinatario(s)` +
        (copias.length ? ` y ${copias.length} en copia` : "") +
        `. Queda registrada y no se puede modificar después; el proveedor pasa a clasificación ` +
        `${CLASIF[ev.clasificacion]?.label || ev.clasificacion} vigente.`,
      confirmText: "Enviar la carta",
    });
    if (!ok) return;

    const btn = document.getElementById("btn-enviar-carta");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    const { data, error } = await supabase.rpc("prov_enviar_carta", {
      p_evaluacion_id: evaluacionId,
      p_asunto: asunto,
      p_cuerpo_html: cuerpo,
      p_destinatarios: destinatarios,
      p_copias: copias,
    });

    if (error) {
      Toast.error("No se pudo enviar la carta", error.message);
      btn.disabled = false;
      btn.textContent = "Enviar la carta al proveedor";
      return;
    }

    Toast.success(
      "Carta enviada",
      data?.requiere_plan
        ? `Se despacharon ${data.correos_despachados} correos. Ahora corresponde registrar el plan de acción.`
        : `Se despacharon ${data?.correos_despachados ?? 0} correos.`
    );
    await renderComunicarProveedor(container, evaluacionId);
  });

  // --- plan de acción ---
  document.getElementById("form-plan")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    const { error } = await supabase.from("prov_planes_accion").insert({
      proveedor_id: ev.proveedor_id,
      evaluacion_id: evaluacionId,
      compromisos: document.getElementById("pl-compromisos").value.trim(),
      plazo: document.getElementById("pl-plazo").value || null,
      fecha_reevaluacion: document.getElementById("pl-reeval").value || null,
      estado: "activo",
      creado_por: state.user?.id || null,
    });

    if (error) {
      Toast.error("No se pudo guardar el plan", error.message);
      btn.disabled = false;
      btn.textContent = "Guardar el plan de acción";
      return;
    }

    Toast.success("Plan registrado", "Ya se puede cerrar la evaluación.");
    await renderComunicarProveedor(container, evaluacionId);
  });

  // --- cierre ---
  document.getElementById("btn-cerrar-eval")?.addEventListener("click", async () => {
    const ok = await Confirm.ask({
      title: "¿Cerrar la evaluación?",
      text: "Queda archivada. El proveedor conserva su clasificación vigente hasta la próxima evaluación.",
      confirmText: "Cerrar",
    });
    if (!ok) return;

    const { error } = await supabase.rpc("prov_cerrar_evaluacion", { p_evaluacion_id: evaluacionId });
    if (error) {
      Toast.error("No se pudo cerrar", error.message);
      return;
    }
    Toast.success("Evaluación cerrada", "");
    window.Router.go("proveedores");
  });
}
