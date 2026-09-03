/**
 * Evaluación de Proveedores · vista principal.
 * - GOL/admin: panel completo (maestro, ciclos, delegados, iniciar
 *   evaluaciones, comunicar consolidados) + acceso directo a su propia
 *   bandeja, porque GOL además es una de las 6 áreas que califica.
 * - Delegado de área: "Mi bandeja" — solo las evaluaciones donde su área
 *   todavía no ha calificado.
 *
 * Acá ya no hay comité: quien revisa el consolidado y comunica el resultado al
 * proveedor es GOL directamente. El estado interno sigue llamándose 'en_comite'
 * porque lo escribe la RPC de consolidación y hay evaluaciones vivas con ese
 * valor; en pantalla se lee «Pendiente de comunicar».
 */

import { supabase } from "../core/supabase.js";
import { state } from "../core/state.js";
import { Toast } from "../ui/toast.js";
import { Modal } from "../ui/modal.js";
import { escapeHtml, formatDate } from "../ui/utils.js";
import { renderCalificarProveedor, intentarConsolidar } from "./proveedores-evaluar.js";

const AREAS = ["gol", "gfc", "gi", "go", "gsst", "rrhh"];
const AREA_LABELS = { gol: "GOL", gfc: "GFC", gi: "GI", go: "GO", gsst: "GSST", rrhh: "RRHH" };

const ESTADO_LABELS = {
  abierta: "Abierta",
  en_evaluacion: "En evaluación",
  consolidada: "Consolidada",
  en_comite: "Pendiente de comunicar",
  comunicada: "Comunicada",
  cerrada: "Cerrada",
};
const ESTADO_BADGE = {
  abierta: "badge-neutral",
  en_evaluacion: "badge-warning",
  consolidada: "badge-info",
  en_comite: "badge-warning",
  comunicada: "badge-success",
  cerrada: "badge-neutral",
};

export async function renderProveedores(container) {
  const rol = state.accesos.find((a) => a.modulo === "proveedores")?.rol;
  // GOL asumió lo que antes hacía el comité. Se acepta 'comite' como legado por
  // si quedó algún acceso sin migrar, pero la migración los pasa a 'gol'.
  const esGOL = state.user.esAdmin || rol === "gol" || rol === "comite";
  container.innerHTML = `<div class="view-loading">Cargando...</div>`;

  // Mis áreas = las que tenga por modulo_accesos.rol + las que tenga en
  // prov_delegados como delegado o suplente — se calcula siempre, sin
  // importar si además es comité/admin, porque una misma persona puede
  // ser ambas cosas a la vez.
  const misAreas = new Set();
  if (rol && AREAS.includes(rol)) misAreas.add(rol);

  const { data: delegaciones } = await supabase
    .from("prov_delegados")
    .select("area")
    .or(`delegado_id.eq.${state.user.id},suplente_id.eq.${state.user.id}`);
  (delegaciones || []).forEach((d) => misAreas.add(d.area));

  if (esGOL) {
    await renderPanelGOL(container, [...misAreas]);
    return;
  }

  if (!misAreas.size) {
    container.innerHTML = `<div class="empty-state"><p>No estás asignado como delegado de ninguna área todavía. Pídele al Comité que te asigne en "Delegados por área".</p></div>`;
    return;
  }

  await renderBandejaDelegado(container, [...misAreas]);
}

// ============================================================================
// PANEL COMITÉ / ADMIN
// ============================================================================

async function renderPanelGOL(container, misAreas) {
  const [{ data: proveedores, error: errProv }, { data: ciclos }, { data: evaluaciones }, { data: delegados }] = await Promise.all([
    supabase.from("prov_proveedores").select("*").order("razon_social"),
    supabase.from("prov_ciclos").select("*").order("fecha_apertura", { ascending: false }),
    supabase
      .from("prov_evaluaciones")
      .select("*, proveedor:proveedor_id(razon_social), ciclo:ciclo_id(titulo)")
      .order("id", { ascending: false })
      .limit(50),
    supabase.from("prov_delegados").select("*, delegado:delegado_id(nombre), suplente:suplente_id(nombre)"),
  ]);

  if (errProv) {
    container.innerHTML = `<div class="placeholder error"><h2>Error</h2><p>${escapeHtml(errProv.message)}</p></div>`;
    return;
  }

  const delegadosPorArea = {};
  (delegados || []).forEach((d) => (delegadosPorArea[d.area] = d));

  const filasDelegados = AREAS.map((area) => {
    const d = delegadosPorArea[area];
    return `
      <tr>
        <td>${AREA_LABELS[area]}</td>
        <td>${escapeHtml(d?.delegado?.nombre || "— sin asignar —")}</td>
        <td>${escapeHtml(d?.suplente?.nombre || "—")}</td>
        <td><button class="btn btn-secondary" data-editar-delegado="${area}">Editar</button></td>
      </tr>`;
  }).join("");

  const filasProveedores = proveedores.length
    ? proveedores
        .map(
          (p) => `
      <tr>
        <td>${escapeHtml(p.razon_social)}</td>
        <td>${escapeHtml(p.categoria)}</td>
        <td>${p.critico ? "⚠ Sí" : "No"}</td>
        <td><span class="badge badge-neutral">${escapeHtml(p.clasificacion_vigente || "Sin evaluar")}</span></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty-state">Aún no hay proveedores registrados.</td></tr>`;

  const filasCiclos = ciclos.length
    ? ciclos
        .map(
          (c) => `
      <tr>
        <td>${escapeHtml(c.titulo)}</td>
        <td>${escapeHtml(c.tipo || "—")}</td>
        <td><span class="badge badge-neutral">${escapeHtml(c.estado)}</span></td>
        <td>${formatDate(c.fecha_apertura)} – ${formatDate(c.fecha_cierre)}</td>
        <td><button class="btn btn-secondary" data-iniciar="${c.id}">+ Iniciar evaluación</button></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty-state">Aún no hay ciclos creados.</td></tr>`;

  const filasEval = (evaluaciones || []).length
    ? evaluaciones
        .map((e) => {
          const puedeComunicar = ["en_comite", "consolidada"].includes(e.estado);
          const puedeCerrar = e.estado === "comunicada";
          return `
      <tr>
        <td>${escapeHtml(e.proveedor?.razon_social || "—")}</td>
        <td>${escapeHtml(e.ciclo?.titulo || "—")}</td>
        <td>${e.total_ponderado ?? "—"}</td>
        <td>${e.clasificacion ? `<span class="badge badge-info">${escapeHtml(e.clasificacion)}</span>` : "—"}</td>
        <td><span class="badge ${ESTADO_BADGE[e.estado] || "badge-neutral"}">${ESTADO_LABELS[e.estado] || e.estado}</span></td>
        <td>
          ${puedeComunicar ? `<button class="btn btn-primary" data-comunicar="${e.id}">Revisar y comunicar</button>` : ""}
          ${puedeCerrar ? `<button class="btn btn-primary" data-comunicar="${e.id}">Plan de acción y cierre</button>` : ""}
          ${e.estado === "cerrada" ? `<button class="btn btn-secondary" data-comunicar="${e.id}">Ver la carta enviada</button>` : ""}
          ${e.estado === "en_evaluacion" ? `<button class="btn btn-secondary" data-reintentar="${e.id}">Reintentar consolidación</button>` : ""}
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty-state">Aún no hay evaluaciones iniciadas.</td></tr>`;

  container.innerHTML = `
    <div class="view-proveedores-gol">
      ${
        misAreas.length
          ? `<div class="card" style="margin-bottom:20px; border-color:var(--accent);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <h3>Tus áreas asignadas: ${misAreas.map((a) => AREA_LABELS[a]).join(", ")}</h3>
                  <p class="lead">También eres delegado — revisa tus proveedores pendientes de calificar.</p>
                </div>
                <button class="btn btn-primary" id="btn-ver-mi-bandeja">Ver mis pendientes</button>
              </div>
            </div>`
          : ""
      }

      <div style="margin-bottom:16px; display:flex; gap:10px;">
        <button class="btn btn-primary" id="btn-nuevo-proveedor">+ Nuevo proveedor</button>
        <button class="btn btn-secondary" id="btn-nuevo-ciclo">+ Nuevo ciclo</button>
      </div>

      <div class="card">
        <h3>Delegados por área</h3>
        <table class="data-table">
          <thead><tr><th>Área</th><th>Titular</th><th>Suplente</th><th></th></tr></thead>
          <tbody>${filasDelegados}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3>Maestro de proveedores</h3>
        <table class="data-table">
          <thead><tr><th>Razón social</th><th>Categoría</th><th>Crítico</th><th>Clasificación vigente</th></tr></thead>
          <tbody>${filasProveedores}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3>Ciclos de evaluación</h3>
        <table class="data-table">
          <thead><tr><th>Título</th><th>Tipo</th><th>Estado</th><th>Período</th><th></th></tr></thead>
          <tbody>${filasCiclos}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3>Evaluaciones (últimas 50)</h3>
        <table class="data-table">
          <thead><tr><th>Proveedor</th><th>Ciclo</th><th>Total</th><th>Clasificación</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filasEval}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-nuevo-proveedor").addEventListener("click", abrirModalNuevoProveedor);
  document.getElementById("btn-nuevo-ciclo").addEventListener("click", abrirModalNuevoCicloProv);
  document.getElementById("btn-ver-mi-bandeja")?.addEventListener("click", () => renderBandejaDelegado(container, misAreas));

  container.querySelectorAll("[data-editar-delegado]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalDelegado(btn.dataset.editarDelegado, delegados));
  });
  container.querySelectorAll("[data-iniciar]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalIniciarEvaluacion(btn.dataset.iniciar));
  });
  container.querySelectorAll("[data-comunicar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { renderComunicarProveedor } = await import("./proveedores-comunicar.js");
      await renderComunicarProveedor(container, btn.dataset.comunicar);
    });
  });
  container.querySelectorAll("[data-reintentar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Consolidando...";
      const ok = await intentarConsolidar(btn.dataset.reintentar);
      if (ok) window.Router.go("proveedores");
      else {
        btn.disabled = false;
        btn.textContent = "Reintentar consolidación";
      }
    });
  });
}

function abrirModalNuevoProveedor() {
  Modal.open({
    title: "Nuevo proveedor",
    content: `
      <form id="form-nuevo-proveedor">
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">RUT<span class="req">*</span></label>
            <input type="text" id="prov-rut" required placeholder="76.123.456-7">
          </div>
          <div class="form-field">
            <label class="form-label">Categoría<span class="req">*</span></label>
            <select id="prov-categoria" required>
              <option value="bienes">Bienes</option>
              <option value="servicios">Servicios</option>
              <option value="ambas">Ambas</option>
            </select>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Razón social<span class="req">*</span></label>
          <input type="text" id="prov-razon" required>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Nombre de fantasía</label>
            <input type="text" id="prov-fantasia">
          </div>
          <div class="form-field">
            <label class="form-label">Rubro</label>
            <input type="text" id="prov-rubro">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Contacto</label>
            <input type="text" id="prov-contacto">
          </div>
          <div class="form-field">
            <label class="form-label">Correo</label>
            <input type="email" id="prov-correo">
          </div>
        </div>
        <div class="form-field">
          <label class="form-label"><input type="checkbox" id="prov-critico" style="width:auto; margin-right:6px;">Proveedor crítico</label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-prov">Cancelar</button>
          <button type="submit" class="btn btn-primary">Crear proveedor</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-prov").addEventListener("click", Modal.close);
  document.getElementById("form-nuevo-proveedor").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("prov_proveedores").insert({
      rut: document.getElementById("prov-rut").value.trim(),
      razon_social: document.getElementById("prov-razon").value.trim(),
      nombre_fantasia: document.getElementById("prov-fantasia").value.trim() || null,
      categoria: document.getElementById("prov-categoria").value,
      rubro: document.getElementById("prov-rubro").value.trim() || null,
      contacto: document.getElementById("prov-contacto").value.trim() || null,
      correo: document.getElementById("prov-correo").value.trim() || null,
      critico: document.getElementById("prov-critico").checked,
    });
    if (error) {
      Toast.error("Error al crear el proveedor", error.message);
      return;
    }
    Modal.close();
    Toast.success("Proveedor creado", "Ya aparece en el maestro.");
    window.Router.go("proveedores");
  });
}

function abrirModalNuevoCicloProv() {
  Modal.open({
    title: "Nuevo ciclo de evaluación",
    content: `
      <form id="form-nuevo-ciclo-prov">
        <div class="form-field">
          <label class="form-label">Título<span class="req">*</span></label>
          <input type="text" id="pciclo-titulo" required placeholder="Ej: Semestral Bienes 2026-S2">
        </div>
        <div class="form-field">
          <label class="form-label">Tipo</label>
          <select id="pciclo-tipo">
            <option value="semestral_bienes">Semestral · Bienes</option>
            <option value="anual_bienes_menor">Anual · Bienes menores</option>
            <option value="por_contrato">Por contrato</option>
            <option value="extraordinaria">Extraordinaria</option>
            <option value="reevaluacion">Reevaluación</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Período evaluado</label>
          <input type="text" id="pciclo-periodo" placeholder="Ej: Ene-Jun 2026">
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label class="form-label">Apertura</label>
            <input type="date" id="pciclo-apertura">
          </div>
          <div class="form-field">
            <label class="form-label">Cierre</label>
            <input type="date" id="pciclo-cierre">
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-pciclo">Cancelar</button>
          <button type="submit" class="btn btn-primary">Crear ciclo</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-pciclo").addEventListener("click", Modal.close);
  document.getElementById("form-nuevo-ciclo-prov").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("prov_ciclos").insert({
      titulo: document.getElementById("pciclo-titulo").value.trim(),
      tipo: document.getElementById("pciclo-tipo").value,
      periodo_evaluado: document.getElementById("pciclo-periodo").value.trim() || null,
      fecha_apertura: document.getElementById("pciclo-apertura").value || null,
      fecha_cierre: document.getElementById("pciclo-cierre").value || null,
      estado: "planificado",
    });
    if (error) {
      Toast.error("Error al crear el ciclo", error.message);
      return;
    }
    Modal.close();
    Toast.success("Ciclo creado", "Ya puedes iniciar evaluaciones.");
    window.Router.go("proveedores");
  });
}

async function abrirModalIniciarEvaluacion(cicloId) {
  const { data: proveedores } = await supabase.from("prov_proveedores").select("id, razon_social, categoria").order("razon_social");

  const opciones = (proveedores || [])
    .map((p) => `<option value="${p.id}" data-categoria="${p.categoria}">${escapeHtml(p.razon_social)}</option>`)
    .join("");

  Modal.open({
    title: "Iniciar evaluación",
    content: `
      <form id="form-iniciar-eval">
        <div class="form-field">
          <label class="form-label">Proveedor<span class="req">*</span></label>
          <select id="iniciar-proveedor" required><option value="">Selecciona...</option>${opciones}</select>
        </div>
        <div class="form-field">
          <label class="form-label">Categoría a aplicar<span class="req">*</span></label>
          <select id="iniciar-categoria" required>
            <option value="bienes">Bienes</option>
            <option value="servicios">Servicios</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Obra / contrato</label>
          <input type="text" id="iniciar-obra" placeholder="Opcional">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-iniciar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Iniciar</button>
        </div>
      </form>
    `,
  });

  document.getElementById("btn-cancelar-iniciar").addEventListener("click", Modal.close);
  document.getElementById("form-iniciar-eval").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("prov_evaluaciones").insert({
      ciclo_id: cicloId,
      proveedor_id: document.getElementById("iniciar-proveedor").value,
      categoria_aplicada: document.getElementById("iniciar-categoria").value,
      obra_contrato: document.getElementById("iniciar-obra").value.trim() || null,
      estado: "abierta",
    });
    if (error) {
      Toast.error("Error al iniciar", error.message);
      return;
    }
    Modal.close();
    Toast.success("Evaluación iniciada", "Ya aparece disponible para las 6 áreas.");
    window.Router.go("proveedores");
  });
}

async function abrirModalDelegado(area, delegadosActuales) {
  const { data: perfiles } = await supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre");
  const actual = (delegadosActuales || []).find((d) => d.area === area);

  const opciones = (perfiles || []).map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");

  Modal.open({
    title: `Delegado de ${AREA_LABELS[area]}`,
    content: `
      <form id="form-delegado">
        <div class="form-field">
          <label class="form-label">Titular</label>
          <select id="del-titular">
            <option value="">Sin asignar</option>
            ${opciones}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Suplente</label>
          <select id="del-suplente">
            <option value="">Sin asignar</option>
            ${opciones}
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-del">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `,
  });

  if (actual?.delegado_id) document.getElementById("del-titular").value = actual.delegado_id;
  if (actual?.suplente_id) document.getElementById("del-suplente").value = actual.suplente_id;

  document.getElementById("btn-cancelar-del").addEventListener("click", Modal.close);
  document.getElementById("form-delegado").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titularId = document.getElementById("del-titular").value || null;
    const suplenteId = document.getElementById("del-suplente").value || null;

    const { error } = await supabase
      .from("prov_delegados")
      .upsert({ area, delegado_id: titularId, suplente_id: suplenteId }, { onConflict: "area" });

    if (error) {
      Toast.error("Error al guardar", error.message);
      return;
    }

    // Da acceso real al módulo (idempotente si ya lo tenía)
    for (const uid of [titularId, suplenteId].filter(Boolean)) {
      await supabase.from("modulo_accesos").upsert({ usuario_id: uid, modulo: "proveedores", rol: area }, { onConflict: "usuario_id,modulo" });
    }

    Modal.close();
    Toast.success("Delegado actualizado", "");
    window.Router.go("proveedores");
  });
}

// ============================================================================
// BANDEJA DEL DELEGADO
// ============================================================================

async function renderBandejaDelegado(container, areas) {
  container.innerHTML = `<div class="view-loading">Cargando...</div>`;

  const { data: evaluaciones, error } = await supabase
    .from("prov_evaluaciones")
    .select("*, proveedor:proveedor_id(razon_social)")
    .in("estado", ["abierta", "en_evaluacion"]);

  if (error) {
    container.innerHTML = `<div class="placeholder error"><h2>Error</h2><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  const pendientes = [];
  for (const area of areas) {
    for (const ev of evaluaciones || []) {
      const { count } = await supabase
        .from("prov_detalle")
        .select("id", { count: "exact", head: true })
        .eq("evaluacion_id", ev.id)
        .eq("area", area);
      if (!count) pendientes.push({ ...ev, _area: area });
    }
  }

  const rol = state.accesos.find((a) => a.modulo === "proveedores")?.rol;
  const esGOL = state.user.esAdmin || rol === "gol" || rol === "comite";

  const filas = pendientes
    .map(
      (e) => `
    <tr>
      <td>${escapeHtml(e.proveedor?.razon_social || "—")}</td>
      <td><span class="badge badge-neutral">${AREA_LABELS[e._area]}</span></td>
      <td>${escapeHtml(e.obra_contrato || "—")}</td>
      <td><button class="btn btn-primary" data-calificar="${e.id}" data-area="${e._area}">Calificar</button></td>
    </tr>`
    )
    .join("");

  container.innerHTML = `
    ${esGOL ? `<button class="btn btn-secondary" id="btn-volver-panel" style="margin-bottom:16px;">← Volver al panel</button>` : ""}
    <div class="card">
      <h3>Pendientes de calificar — ${areas.map((a) => AREA_LABELS[a]).join(", ")}</h3>
      <table class="data-table">
        <thead><tr><th>Proveedor</th><th>Área</th><th>Obra / contrato</th><th></th></tr></thead>
        <tbody>${filas.length ? filas : `<tr><td colspan="4" class="empty-state">No tienes proveedores pendientes de calificar.</td></tr>`}</tbody>
      </table>
    </div>
  `;

  document.getElementById("btn-volver-panel")?.addEventListener("click", () => window.Router.go("proveedores"));

  container.querySelectorAll("[data-calificar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = pendientes.find((e) => e.id === btn.dataset.calificar && e._area === btn.dataset.area);
      renderCalificarProveedor(container, ev, btn.dataset.area);
    });
  });
}
