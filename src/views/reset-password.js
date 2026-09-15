/**
 * Vista de "definir nueva contraseña" — se muestra automáticamente cuando el usuario
 * llega vía link de email de recuperación (evento PASSWORD_RECOVERY en auth.js).
 *
 * El checklist de abajo es solo una ayuda visual en vivo -- la regla real
 * (y la única que efectivamente bloquea el envío) vive en un solo lugar:
 * validarPassword() en core/password-policy.js, que también usa
 * Auth.updatePassword() al enviar el formulario.
 */

import { REGLAS_PASSWORD, validarPassword } from '../core/password-policy.js';

export function renderResetPassword() {
  const app = document.getElementById('app');
  const checklistItems = REGLAS_PASSWORD.map((r) =>
    `<li data-regla="${r.id}" style="color:#9aa2b3;transition:color .15s;">○ ${r.label}</li>`
  ).join('');

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
        <p class="login-subtitle">Definí una nueva contraseña para tu cuenta.</p>

        <form class="login-form" id="reset-form" autocomplete="on">
          <div class="field">
            <label for="reset-password">Nueva contraseña</label>
            <input type="password" id="reset-password" required autocomplete="new-password"
                   placeholder="••••••••" minlength="8" autofocus>
          </div>
          <ul id="reset-pw-checklist" style="list-style:none;padding:0;margin:6px 0 14px;font-size:12.5px;line-height:1.7;">
            ${checklistItems}
          </ul>
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

  const pwInput = document.getElementById('reset-password');
  const checklist = document.getElementById('reset-pw-checklist');
  pwInput.addEventListener('input', () => {
    const { reglas } = validarPassword(pwInput.value);
    reglas.forEach((r) => {
      const li = checklist.querySelector(`[data-regla="${r.id}"]`);
      if (!li) return;
      li.style.color = r.ok ? '#1a7f37' : '#9aa2b3';
      li.textContent = `${r.ok ? '✓' : '○'} ${r.label}`;
    });
  });

  document.getElementById('reset-form').addEventListener('submit', window.Auth.updatePassword);
}
