/**
 * Vista de "olvidé mi contraseña": pide el email y dispara el envío del link de recuperación.
 */

export function renderForgotPassword() {
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
        <h1 class="login-title">Recuperar contraseña</h1>
        <p class="login-subtitle">Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.</p>

        <form class="login-form" id="forgot-form" autocomplete="on">
          <div class="field">
            <label for="forgot-email">Correo</label>
            <input type="email" id="forgot-email" required autocomplete="email"
                   placeholder="tu@metalium.cl" autofocus>
          </div>
          <div id="forgot-error" class="login-error" hidden></div>
          <div id="forgot-success" class="login-success" hidden></div>
          <button type="submit" class="btn-login" id="forgot-submit">Enviar enlace</button>
          <div class="login-help">
            <a href="#" class="login-link" id="back-to-login">← Volver al inicio de sesión</a>
          </div>
        </form>

        <div class="login-footer">© Metalium SpA · SSI-RRHH v1.0 · Sistema interno</div>
      </div>
    </div>
  `;

  document.getElementById('forgot-form').addEventListener('submit', window.Auth.requestPasswordReset);
  document.getElementById('back-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    window.Auth.showLogin();
  });
}
