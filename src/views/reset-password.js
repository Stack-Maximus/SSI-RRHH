/**
 * Vista de "definir nueva contraseña" — se muestra automáticamente cuando el usuario
 * llega vía link de email de recuperación (evento PASSWORD_RECOVERY en auth.js).
 */

export function renderResetPassword() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <div class="login-brand-logo"><img src="/Logo_Metalium.png" alt="Metalium" onerror="this.replaceWith(document.createTextNode('M'))" /></div>
          <div class="login-brand-text">
            <div class="name">Metalium</div>
            <div class="sub">SSI-RRHH · Solicitudes de Ingreso y Traslado</div>
          </div>
        </div>
        <h1 class="login-title">Nueva contraseña</h1>
        <p class="login-subtitle">Definí una nueva contraseña para tu cuenta. Debe tener al menos 8 caracteres.</p>

        <form class="login-form" id="reset-form" autocomplete="on">
          <div class="field">
            <label for="reset-password">Nueva contraseña</label>
            <input type="password" id="reset-password" required autocomplete="new-password"
                   placeholder="••••••••" minlength="8" autofocus>
          </div>
          <div class="field">
            <label for="reset-password-confirm">Confirmar contraseña</label>
            <input type="password" id="reset-password-confirm" required autocomplete="new-password"
                   placeholder="••••••••" minlength="8">
          </div>
          <div id="reset-error" class="login-error" hidden></div>
          <button type="submit" class="btn-login" id="reset-submit">Cambiar contraseña</button>
        </form>

        <div class="login-footer">© Metalium SpA · SSI-RRHH v1.0 · Sistema interno</div>
      </div>
    </div>
  `;

  document.getElementById('reset-form').addEventListener('submit', window.Auth.updatePassword);
}
