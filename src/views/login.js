/**
 * Vista de login: form de email/password + link a recuperación.
 * Mismos estilos y estructura que GOL.
 */

export function renderLogin() {
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
        <h1 class="login-title">Bienvenido</h1>
        <p class="login-subtitle">Sistema de Solicitudes de Ingreso y Traslado de Personal — Inicia sesión para continuar.</p>

        <form class="login-form" id="login-form" autocomplete="on">
          <div class="field">
            <label for="login-email">Correo</label>
            <input type="email" id="login-email" required autocomplete="email"
                   placeholder="tu@metalium.cl" autofocus>
          </div>
          <div class="field">
            <label for="login-password">Contraseña</label>
            <input type="password" id="login-password" required autocomplete="current-password"
                   placeholder="••••••••">
          </div>
          <div id="login-error" class="login-error" hidden></div>
          <button type="submit" class="btn-login" id="login-submit">Iniciar sesión</button>
          <div class="login-help">
            <a href="#" class="login-link" id="forgot-link">¿Olvidaste tu contraseña?</a>
          </div>
        </form>

        <div class="login-footer">© Metalium SpA · SSI-RRHH v1.0 · Sistema interno</div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', window.Auth.login);
  document.getElementById('forgot-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.Auth.showForgotPassword();
  });
}
