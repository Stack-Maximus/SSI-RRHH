/**
 * Qué criterios aplican a cada familia de cargos. Sólo RRHH.
 *
 * Antes de esta pantalla la matriz existía en la base pero se editaba llamando
 * eva_marcar_criterio_familia() desde el SQL Editor. O sea: la decisión de qué
 * se le pregunta a un Jornal quedaba operable sólo por quien supiera SQL.
 *
 * Se trabaja UNA FAMILIA A LA VEZ, no la cuadrícula de 30 × 11. Con 330 casillas
 * en pantalla no cabe el motivo de cada exclusión, y el motivo es obligatorio:
 * quitar un criterio a una familia es una decisión que alguien va a auditar.
 *
 * Dos datos que la pantalla pone al lado de cada criterio, porque sin ellos la
 * decisión se toma a ciegas:
 *
 *   · CAP o CON. Un criterio conductual (asistencia, honestidad, respeto) aplica
 *     a cualquier oficio: quitarlo casi nunca tiene sentido.
 *   · Cuántos cursos de la batería de esa familia cerrarían ese criterio si sale
 *     bajo. Un 0 ahí NO significa que el criterio no aplique — significa que si
 *     sale bajo habrá que escribir la acción a mano.
 *
 * Y una regla dura que viene de la base, no de acá: no se puede dejar una
 * sección entera sin criterios. El promedio de esa sección sería 0/0 y el total
 * ponderado saldría NaN. El trigger lo rechaza y acá se muestra el mensaje.
 *
 * La misma pantalla administra el CATÁLOGO DE CARGOS de la familia, por dos
 * razones concretas:
 *
 *   · El dato maestro venía incompleto. «Gerente General» no figuraba en la hoja
 *     13_MAESTROS y hubo que agregarlo con una migración. Va a volver a faltar
 *     alguno, y RRHH no debería tener que pedir SQL para eso.
 *   · Hay cargos que existen pero no se evalúan — el Gerente General es la
 *     cabeza de la línea: no tiene jefatura arriba. Eso se marca, no se
 *     esconde: si el cargo desapareciera del catálogo habría que escribirlo a
 *     mano en la ficha de la persona, que es justo lo que se acaba de cerrar.
 */

import { supabase } from "../core/supabase.js";
import { Toast, Confirm, Prompt } from "../ui/toast.js";
import { escapeHtml } from "../ui/utils.js";

let familiaActiva = null;

export async function renderCriteriosCargo(container) {
  container.innerHTML = `<div class="view-loading">Cargando la matriz de criterios...</div>`;

  const [{ data: matriz, error }, { data: familias }, { data: cargos, error: errCargos }] = await Promise.all([
    supabase.rpc("eva_criterio_familia_matriz"),
    supabase.from("eva_familias_cargo").select("*").order("orden"),
    supabase.rpc("eva_cargos_con_uso"),
  ]);

  if (error) {
    container.innerHTML = `
      <div class="view-eva">
        <button class="btn btn-secondary" id="btn-volver-cc" style="margin-bottom:16px;">← Volver</button>
        <div class="placeholder error">
          <h2>No se pudo cargar la matriz</h2>
          <p>${escapeHtml(error.message)}</p>
          <p class="hint">Si dice que la función no existe, falta correr
          <code>database/migracion_eva_filtro_cargo.sql</code>.</p>
        </div>
      </div>`;
    document.getElementById("btn-volver-cc").addEventListener("click", () => window.Router.go("personal"));
    return;
  }

  const fams = familias || [];
  const filas = matriz || [];

  // Si falla sólo la parte de cargos, la matriz se muestra igual: son dos
  // decisiones independientes y la de criterios es la que más se usa. El bloque
  // de cargos avisa por qué no está en vez de dejar la pantalla en blanco.
  const cargosDato = errCargos ? { error: errCargos.message } : { lista: cargos || [] };

  if (!familiaActiva || !fams.some((f) => f.codigo === familiaActiva)) {
    familiaActiva = fams[0]?.codigo || null;
  }

  pintar(container, filas, fams, cargosDato);
}

// ---------------------------------------------------------------------------

function pintar(container, filas, fams, cargosDato) {
  const deLaFamilia = filas
    .filter((r) => r.familia_codigo === familiaActiva)
    .sort((a, b) => a.orden_dim - b.orden_dim || a.orden_crit - b.orden_crit);

  const fam = fams.find((f) => f.codigo === familiaActiva);
  const quitados = deLaFamilia.filter((r) => !r.aplica);

  // Secciones en orden, con el conteo de lo que queda en cada una: es el número
  // que dice si estás cerca del límite de «al menos uno por sección».
  const secciones = [];
  for (const r of deLaFamilia) {
    let sec = secciones.find((s) => s.codigo === r.dimension_codigo);
    if (!sec) {
      sec = { codigo: r.dimension_codigo, nombre: r.dimension_nombre, filas: [] };
      secciones.push(sec);
    }
    sec.filas.push(r);
  }

  container.innerHTML = `
    <div class="view-eva">
      <button class="btn btn-secondary" id="btn-volver-cc" style="margin-bottom:16px;">← Volver</button>

      <div class="card">
        <h3>Qué criterios aplican a cada familia de cargos</h3>
        <p class="hint" style="margin:-2px 0 14px;">
          Los 30 criterios se preguntan a todo el mundo salvo lo que marques acá. Es lo que hace que a un Analista TI
          no se le evalúen responsabilidades de ingeniería, ni a un Jornal el cumplimiento de plazos legales.
        </p>

        <div class="motor-nota-decide">
          <strong>Esto cambia lo que se le pregunta a la gente.</strong> Un criterio quitado desaparece del
          formulario de esa familia — en la autoevaluación y en la del jefe — y deja de contar en el promedio de su
          sección. Las evaluaciones ya cerradas no se tocan.
        </div>

        <div class="cc-familias">
          ${fams.map((f) => {
            const n = filas.filter((r) => r.familia_codigo === f.codigo && !r.aplica).length;
            return `
              <button class="cc-fam ${f.codigo === familiaActiva ? "is-activa" : ""}" data-fam="${escapeHtml(f.codigo)}">
                <span class="cc-fam-cod">${escapeHtml(f.codigo)}</span>
                <span class="cc-fam-nombre">${escapeHtml(f.nombre)}</span>
                ${n ? `<span class="cc-fam-conteo">${n} quitado${n === 1 ? "" : "s"}</span>` : `<span class="cc-fam-conteo is-vacio">los 30</span>`}
              </button>`;
          }).join("")}
        </div>
      </div>

      ${bloqueCargos(fam, cargosDato)}

      <div class="card" style="margin-top:20px;">
        <div class="eva-head">
          <div>
            <h3 style="margin-bottom:2px;">${escapeHtml(fam?.nombre || "")}</h3>
            <p class="hint" style="margin:0;">
              ${deLaFamilia.length - quitados.length} de ${deLaFamilia.length} criterios se le preguntan a esta familia.
            </p>
          </div>
          ${quitados.length ? `<span class="eva-contador is-alerta">${quitados.length} quitado${quitados.length === 1 ? "" : "s"}</span>` : ""}
        </div>

        ${secciones.map((sec) => bloqueSeccion(sec)).join("")}
      </div>
    </div>
  `;

  document.getElementById("btn-volver-cc").addEventListener("click", () => window.Router.go("personal"));

  container.querySelectorAll("[data-fam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      familiaActiva = btn.dataset.fam;
      pintar(container, filas, fams, cargosDato);
    });
  });

  container.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => cambiar(container, btn, filas, fams));
  });

  container.querySelectorAll("[data-cargo-eval]").forEach((btn) => {
    btn.addEventListener("click", () => cambiarEvaluable(container, btn, cargosDato));
  });

  const formNuevo = document.getElementById("cc-form-cargo");
  if (formNuevo) {
    formNuevo.addEventListener("submit", (e) => {
      e.preventDefault();
      agregarCargo(container, fam);
    });
    const chk = document.getElementById("cc-nuevo-no-eval");
    const campoMotivo = document.getElementById("cc-nuevo-motivo-campo");
    if (chk && campoMotivo) {
      chk.addEventListener("change", () => {
        campoMotivo.hidden = !chk.checked;
        if (chk.checked) document.getElementById("cc-nuevo-motivo").focus();
      });
    }
  }
}

// ---------------------------------------------------------------------------
// El catálogo de cargos de la familia activa
// ---------------------------------------------------------------------------

function bloqueCargos(fam, cargosDato) {
  if (cargosDato.error) {
    return `
      <div class="card" style="margin-top:20px;">
        <h3>Cargos de esta familia</h3>
        <p class="hint">No se pudo leer el catálogo: ${escapeHtml(cargosDato.error)}</p>
        <p class="hint">Si dice que la función no existe, falta correr
        <code>database/migracion_eva_cargos_no_evaluables.sql</code>.</p>
      </div>`;
  }

  const cargos = cargosDato.lista.filter((c) => c.familia_codigo === familiaActiva);
  const noEval = cargos.filter((c) => !c.evaluable);

  return `
    <div class="card" style="margin-top:20px;">
      <div class="eva-head">
        <div>
          <h3 style="margin-bottom:2px;">Cargos de ${escapeHtml(fam?.nombre || "esta familia")}</h3>
          <p class="hint" style="margin:0;">
            Estos son los nombres que se pueden elegir en la ficha de una persona. Los criterios de arriba se
            aplican a todos ellos por igual.
          </p>
        </div>
        ${noEval.length ? `<span class="eva-contador">${noEval.length} no se evalúa${noEval.length === 1 ? "" : "n"}</span>` : ""}
      </div>

      ${cargos.length === 0
        ? `<p class="hint" style="margin-top:12px;">Esta familia no tiene cargos cargados todavía.</p>`
        : `<div class="cc-cargos">
             ${cargos.map((c) => filaCargo(c)).join("")}
           </div>`}

      <form id="cc-form-cargo" class="cc-nuevo">
        <p class="cc-nuevo-titulo">Agregar un cargo a ${escapeHtml(fam?.codigo || "")} · ${escapeHtml(fam?.nombre || "")}</p>
        <p class="hint" style="margin:0 0 10px;">
          Escríbelo como quieres que aparezca en las fichas y en los expedientes. Se rechaza si ya existe uno
          equivalente — «Jefe de Obra» y «jefe de obra» cuentan como el mismo.
        </p>
        <div class="cc-nuevo-linea">
          <div class="form-field">
            <input type="text" id="cc-nuevo-nombre" maxlength="80"
                   placeholder="Ej: Gerente de Administración y Finanzas" required />
          </div>
          <button type="submit" class="btn btn-primary">Agregar</button>
        </div>
        <label class="cc-nuevo-chk">
          <input type="checkbox" id="cc-nuevo-no-eval" />
          <span>Este cargo no se evalúa</span>
        </label>
        <div class="form-field" id="cc-nuevo-motivo-campo" hidden>
          <textarea id="cc-nuevo-motivo" rows="2"
                    placeholder="Por qué no se evalúa. Ej: cabeza de la línea jerárquica, no tiene jefatura que lo evalúe."></textarea>
        </div>
      </form>
    </div>`;
}

/**
 * «evaluación» pierde el acento en plural: pegarle «es» da «evaluaciónes», que
 * es una falta de ortografía, no un plural. Se escriben las dos formas.
 */
function evaluaciones(n) {
  return n === 1 ? "1 evaluación" : `${n} evaluaciones`;
}

function filaCargo(c) {
  const enCurso = c.evaluaciones_en_curso || 0;
  const personas = c.personas_activas || 0;

  return `
    <div class="cc-cargo ${c.evaluable ? "" : "is-no-eval"}">
      <div class="cc-cargo-texto">
        <span class="cc-cargo-nombre">${escapeHtml(c.nombre)}</span>
        ${c.evaluable ? "" : `<span class="badge-neutral">no se evalúa</span>`}
        <span class="cc-cargo-uso">
          ${personas === 0 ? "sin gente asignada" : `${personas} persona${personas === 1 ? "" : "s"} activa${personas === 1 ? "" : "s"}`}
          ${enCurso ? ` · ${evaluaciones(enCurso)} en curso` : ""}
        </span>
        ${c.motivo_no_evaluable ? `<p class="cc-motivo">${escapeHtml(c.motivo_no_evaluable)}</p>` : ""}
      </div>
      ${/* Los dos botones son secundarios a propósito. En la lista de criterios
            «volver a incluir» es primario porque restituye lo normal; acá no hay
            un estado deseable: que el Gerente General no se evalúe está bien, y
            pintar «Volver a evaluar» en azul fuerte convertiría la fila mejor
            configurada de la pantalla en la que más llama a que la toquen. */ ""}
      <button class="btn btn-secondary"
              data-cargo-eval="${escapeHtml(c.nombre)}"
              data-evaluable="${c.evaluable ? "1" : "0"}"
              data-en-curso="${enCurso}">
        ${c.evaluable ? "No evaluar" : "Volver a evaluar"}
      </button>
    </div>`;
}

async function cambiarEvaluable(container, btn, cargosDato) {
  const cargo = btn.dataset.cargoEval;
  const evaluableAhora = btn.dataset.evaluable === "1";
  const enCurso = Number(btn.dataset.enCurso || 0);

  let motivo = null;

  if (evaluableAhora) {
    // La base avisa de las evaluaciones en curso con un `raise notice`, que no
    // llega al navegador. Se dice acá, ANTES de decidir, que es donde sirve.
    motivo = await Prompt.texto({
      title: `«${cargo}» deja de evaluarse`,
      label:
        "Por qué a este cargo no lo evalúa nadie" +
        (enCurso
          ? ` — ojo: hay ${evaluaciones(enCurso)} en curso con este cargo y no se cancelan, siguen su flujo`
          : ""),
      placeholder: "Ej: cabeza de la línea jerárquica, no tiene jefatura que lo evalúe. Evalúa a las gerencias.",
      confirmText: "Marcar que no se evalúa",
    });
    if (!motivo) return;
  } else {
    const ok = await Confirm.ask({
      title: `¿«${cargo}» vuelve a evaluarse?`,
      text: "Va a poder elegirse como trabajador a evaluar al asignar una evaluación. El motivo anterior se borra.",
      confirmText: "Volver a evaluar",
    });
    if (!ok) return;
  }

  btn.disabled = true;
  const { error } = await supabase.rpc("eva_marcar_cargo_evaluable", {
    p_cargo: cargo,
    p_evaluable: !evaluableAhora,
    p_motivo: motivo,
  });
  btn.disabled = false;

  if (error) {
    Toast.error("No se pudo cambiar", error.message);
    return;
  }

  Toast.success(
    evaluableAhora ? `«${cargo}» ya no se evalúa` : `«${cargo}» vuelve a evaluarse`,
    evaluableAhora ? "Sigue en el catálogo y sigue sirviendo como evaluador." : ""
  );

  await renderCriteriosCargo(container);
}

async function agregarCargo(container, fam) {
  const inputNombre = document.getElementById("cc-nuevo-nombre");
  const chk = document.getElementById("cc-nuevo-no-eval");
  const inputMotivo = document.getElementById("cc-nuevo-motivo");
  const btn = document.querySelector("#cc-form-cargo button[type=submit]");

  const nombre = (inputNombre.value || "").trim();
  const noEval = chk.checked;
  const motivo = (inputMotivo.value || "").trim();

  if (nombre.length < 3) {
    Toast.warning("Falta el nombre", "Escribe el cargo como quieres que aparezca en las fichas.");
    inputNombre.focus();
    return;
  }
  if (noEval && motivo.length < 10) {
    Toast.warning("Falta el motivo", "Un cargo que no se evalúa necesita decir por qué: queda en el registro.");
    inputMotivo.focus();
    return;
  }

  btn.disabled = true;
  const { error } = await supabase.rpc("eva_agregar_cargo", {
    p_nombre: nombre,
    p_familia_codigo: familiaActiva,
    p_evaluable: !noEval,
    p_motivo: noEval ? motivo : null,
  });
  btn.disabled = false;

  if (error) {
    Toast.error("No se agregó", error.message);
    return;
  }

  Toast.success(
    `«${nombre}» quedó en el catálogo`,
    `Ya se puede elegir en la ficha de una persona. Hereda los ${
      fam ? "criterios de " + fam.nombre : "criterios de esta familia"
    }.`
  );

  await renderCriteriosCargo(container);
}

function bloqueSeccion(sec) {
  const vivos = sec.filas.filter((r) => r.aplica).length;
  const alLimite = vivos === 1;

  return `
    <div class="cc-seccion">
      <div class="cc-seccion-head">
        <span class="seccion-cod">${escapeHtml(sec.codigo)}</span>
        <h4>${escapeHtml(sec.nombre)}</h4>
        <span class="cc-seccion-conteo ${alLimite ? "is-limite" : ""}">
          ${vivos} de ${sec.filas.length} activos${alLimite ? " · en el mínimo" : ""}
        </span>
      </div>

      ${alLimite
        ? `<p class="cc-limite">
             Queda un solo criterio activo en esta sección. No se puede quitar: el promedio de la sección se
             calcularía dividiendo por cero y el total ponderado de la evaluación saldría inválido.
           </p>`
        : ""}

      <div class="cc-lista">
        ${sec.filas.map((r) => `
          <div class="cc-item ${r.aplica ? "" : "is-quitado"}">
            <div class="cc-item-texto">
              <span class="cc-cod">${escapeHtml(r.criterio_codigo)}</span>
              <span class="cc-criterio">${escapeHtml(r.texto_criterio)}</span>
              <span class="cc-meta">
                <span class="cc-tipo ${r.tipo === "CON" ? "is-con" : ""}">${escapeHtml(r.tipo)}</span>
                ${r.tipo === "CON" ? `<span>conductual — aplica a cualquier oficio</span>` : ""}
                <span>${r.cursos_que_aplican
                  ? `${r.cursos_que_aplican} curso${r.cursos_que_aplican === 1 ? "" : "s"} de su batería lo cierran`
                  : "ningún curso de su batería lo cierra"}</span>
              </span>
              ${r.motivo ? `<p class="cc-motivo">${escapeHtml(r.motivo)}</p>` : ""}
            </div>
            ${/* El último criterio activo de una sección no se puede quitar: la base
                  lo rechaza. Mostrar un botón que va a fallar es peor que no
                  mostrarlo, así que se deshabilita y se dice por qué. */ ""}
            <button class="btn ${r.aplica ? "btn-secondary" : "btn-primary"}"
                    data-toggle="${escapeHtml(r.criterio_codigo)}|${escapeHtml(r.familia_codigo)}"
                    data-aplica="${r.aplica ? "1" : "0"}"
                    ${r.aplica && alLimite ? "disabled" : ""}
                    ${r.aplica && alLimite ? `title="Es el único criterio activo de esta sección: si se quita, el promedio de la sección no se puede calcular."` : ""}>
              ${r.aplica ? (alLimite ? "No se puede quitar" : "Quitar") : "Volver a incluir"}
            </button>
          </div>`).join("")}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------

async function cambiar(container, btn, filas, fams) {
  const [criterio, familia] = btn.dataset.toggle.split("|");
  const aplicaAhora = btn.dataset.aplica === "1";
  const fila = filas.find((r) => r.criterio_codigo === criterio && r.familia_codigo === familia);
  const nombreFam = fams.find((f) => f.codigo === familia)?.nombre || familia;

  let motivo = null;

  if (aplicaAhora) {
    // Quitar exige motivo. Se pide con un input real, no con un confirm: lo que
    // se escriba queda en el registro y lo va a leer alguien más.
    motivo = await Prompt.texto({
      title: `Quitar ${criterio} a ${nombreFam}`,
      label: "Por qué este criterio no aplica a esta familia",
      placeholder: "Ej: un jornal no emite reportes obligatorios ni tiene plazos legales a su cargo",
      confirmText: "Quitar el criterio",
    });
    if (!motivo) return;
  } else {
    const ok = await Confirm.ask({
      title: `¿Volver a incluir ${criterio}?`,
      text:
        `Se le va a preguntar de nuevo a ${nombreFam} en las próximas evaluaciones. ` +
        (fila?.motivo ? `El motivo por el que estaba quitado — «${fila.motivo}» — se borra del registro.` : ""),
      confirmText: "Volver a incluir",
    });
    if (!ok) return;
  }

  btn.disabled = true;
  const { error } = await supabase.rpc("eva_marcar_criterio_familia", {
    p_criterio_codigo: criterio,
    p_familia_codigo: familia,
    p_aplica: !aplicaAhora,
    p_motivo: motivo,
  });
  btn.disabled = false;

  if (error) {
    // El mensaje de la guardia de la base es explicativo: se muestra tal cual en
    // vez de traducirlo a un «no se pudo» que no dice nada.
    Toast.error("No se pudo cambiar", error.message);
    return;
  }

  Toast.success(
    aplicaAhora ? `${criterio} ya no se le pregunta a ${nombreFam}` : `${criterio} vuelve a ${nombreFam}`,
    aplicaAhora ? "Desaparece del formulario y del promedio de su sección." : ""
  );

  await renderCriteriosCargo(container);
}
