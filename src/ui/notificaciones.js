/**
 * Campanita de notificaciones — vive en el topbar, se monta una sola vez
 * (Shell.render() solo corre una vez por sesión) y se actualiza sola cada
 * vez que el usuario la abre.
 */

import { supabase } from "../core/supabase.js";
import { state } from "../core/state.js";
import { escapeHtml } from "./utils.js";

function tiempoRelativo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

export function montarCampanita(container) {
  container.innerHTML = `
    <div class="notif-wrap" style="position:relative;">
      <button class="topbar-icon-btn" id="notif-btn" title="Notificaciones" style="position:relative;">
        🔔
        <span id="notif-count" class="notif-count" style="display:none;"></span>
      </button>
      <div id="notif-dropdown" class="notif-dropdown" style="display:none;"></div>
    </div>
  `;

  const btn = document.getElementById("notif-btn");
  const dropdown = document.getElementById("notif-dropdown");

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const abierto = dropdown.style.display === "block";
    if (abierto) {
      dropdown.style.display = "none";
      return;
    }
    await renderDropdown(dropdown);
    dropdown.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) dropdown.style.display = "none";
  });

  actualizarContador();
}

async function actualizarContador() {
  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", state.user.id)
    .eq("leida", false);

  const badge = document.getElementById("notif-count");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

async function renderDropdown(dropdown) {
  dropdown.innerHTML = `<div style="padding:16px; font-size:13px; color:var(--text-m);">Cargando...</div>`;

  const { data: notifs } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("usuario_id", state.user.id)
    .order("creado_en", { ascending: false })
    .limit(15);

  if (!notifs || !notifs.length) {
    dropdown.innerHTML = `<div style="padding:16px; font-size:13px; color:var(--text-m);">Sin notificaciones todavía.</div>`;
    return;
  }

  const filas = notifs
    .map(
      (n) => `
    <button class="notif-item ${n.leida ? "leida" : ""}" data-notif="${n.id}">
      <div class="notif-item-titulo">${escapeHtml(n.titulo)}</div>
      <div class="notif-item-mensaje">${escapeHtml(n.mensaje || "")}</div>
      <div class="notif-item-tiempo">${tiempoRelativo(n.creado_en)}</div>
    </button>`
    )
    .join("");

  dropdown.innerHTML = `
    <div class="notif-header">
      <span>Notificaciones</span>
      <button id="notif-marcar-todas" style="background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer;">Marcar todas leídas</button>
    </div>
    <div class="notif-lista">${filas}</div>
  `;

  document.getElementById("notif-marcar-todas").addEventListener("click", async () => {
    await supabase.from("notificaciones").update({ leida: true }).eq("usuario_id", state.user.id).eq("leida", false);
    await renderDropdown(dropdown);
    await actualizarContador();
  });

  dropdown.querySelectorAll("[data-notif]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await supabase.from("notificaciones").update({ leida: true }).eq("id", btn.dataset.notif);
      btn.classList.add("leida");
      await actualizarContador();
    });
  });
}
