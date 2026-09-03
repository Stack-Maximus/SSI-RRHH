/**
 * Pantalla compartida para dos casos que llegan por el mismo mecanismo de
 * Supabase (un link con tokens en la URL que establece una sesión temporal):
 *   - Completar una invitación nueva (crear tu primera contraseña)
 *   - Restablecer una contraseña olvidada
 * El cliente de Supabase ya establece la sesión solo al cargar la página
 * (detectSessionInUrl, activado por defecto) — aquí solo pedimos la
 * contraseña nueva y la guardamos.
 */

import { supabase } from "../core/supabase.js";

export async function renderCompletarPassword(tipo) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="login-screen"><div class="login-card"><p style="text-align:center;">Cargando...</p></div></div>`;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    app.innerHTML = `
      <div id="login-screen">
        <div class="login-card">
          <div class="encuesta-estado" style="padding:0;">
            <div class="icono">🔒</div>
            <h2>Este enlace ya no es válido</h2>
            <p>Puede que ya lo hayas usado, o que haya vencido. Si necesitas uno nuevo, pide que te reenvíen la invitación, o usa "¿Olvidaste tu contraseña?" desde el login.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const esInvitacion = tipo === "invite";
  const titulo = esInvitacion ? "Bienvenido a SGC Metalium" : "Restablece tu contraseña";
  const subtitulo = esInvitacion
    ? "Crea tu contraseña para activar tu cuenta."
    : "Ingresa tu nueva contraseña.";

  app.innerHTML = `
    <div id="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <div class="login-brand-logo"><img src="/Logo_Metalium.png" alt="Metalium" /></div>
          <div class="login-brand-text">
            <div class="name">Metalium</div>
            <div class="sub">SGC · Sistema de Gestión de Calidad</div>
          </div>
        </div>
        <h1 class="login-title">${titulo}</h1>
        <p class="login-subtitle">${subtitulo}</p>

        <form class="login-form" id="form-completar-password">
          <div class="field">
            <label for="cp-password">Nueva contraseña</label>
            <input type="password" id="cp-password" required minlength="8" placeholder="Mínimo 8 caracteres" autofocus>
          </div>
          <div class="field">
            <label for="cp-password-confirm">Confirma la contraseña</label>
            <input type="password" id="cp-password-confirm" required minlength="8">
          </div>
          <div id="cp-error" class="login-error" hidden></div>
          <button type="submit" class="btn-login" id="cp-submit">Guardar y continuar</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("form-completar-password").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = document.getElementById("cp-password").value;
    const confirmPass = document.getElementById("cp-password-confirm").value;
    const errorEl = document.getElementById("cp-error");
    const btn = document.getElementById("cp-submit");

    errorEl.hidden = true;

    if (pass !== confirmPass) {
      errorEl.textContent = "Las contraseñas no coinciden.";
      errorEl.hidden = false;
      return;
    }
    if (pass.length < 8) {
      errorEl.textContent = "La contraseña debe tener al menos 8 caracteres.";
      errorEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Guardando...";

    const { error } = await supabase.auth.updateUser({ password: pass });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Guardar y continuar";
      return;
    }

    // Limpia los tokens de la URL y entra a la app normalmente — el
    // main.js, al recargar, ya no detecta ningún callback y sigue el
    // flujo habitual (encuentra la sesión ya válida y hace login solo).
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
  });
}
