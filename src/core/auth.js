/**
 * Autenticación contra Supabase Auth + carga del perfil desde la tabla `perfiles`.
 * Misma lógica que GOL, adaptada al esquema nuevo:
 *   - columna `rol` (no `role`)
 *   - sin `telefono`
 *   - se cargan además centro_costo_id y es_gerente_operaciones
 */

import { supabase } from './supabase.js';
import { state } from './state.js';
import { Idle } from './idle.js';
import { Toast, Confirm } from '../ui/toast.js';
import { Modal } from '../ui/modal.js';
import { ROLES } from '../config.js';
import { renderLogin } from '../views/login.js';
import { renderForgotPassword } from '../views/forgot-password.js';
import { renderResetPassword } from '../views/reset-password.js';
import { mensajeReglasFaltantes } from './password-policy.js';

// ----- Recuperación de contraseña (nov. 2026) -----
// El correo lo manda la Edge Function recuperar-clave (buzón Metalium) con un
// enlace a la app: ?recuperar=<token>. El token se guarda aquí y recién se
// usa (verifyOtp) cuando la persona escribe su nueva contraseña: así el filtro
// de seguridad del correo, que abre los enlaces antes que la persona, ya no
// lo gasta (era lo que dejaba los enlaces de Supabase "inválidos o vencidos").
const CLAVE_TOKEN = 'ssi.recuperar';
const guardarToken = (t) => { try { sessionStorage.setItem(CLAVE_TOKEN, t); } catch { /* sin storage */ } Auth._tokenRecuperacion = t; };
const leerToken = () => { try { return sessionStorage.getItem(CLAVE_TOKEN) || Auth._tokenRecuperacion; } catch { return Auth._tokenRecuperacion; } };
const borrarToken = () => { try { sessionStorage.removeItem(CLAVE_TOKEN); } catch { /* sin storage */ } Auth._tokenRecuperacion = null; };
const AVISO_ENLACE_VENCIDO = 'El enlace ya se usó o venció. Pide uno nuevo aquí abajo: llega en uno o dos minutos.';

// Minutos de inactividad antes de cerrar la sesión automáticamente.
// Cambiá este número para ajustar el tiempo.
const INACTIVIDAD_MIN = 30;

export const Auth = {
  // Navegación entre vistas de autenticación
  showLogin: renderLogin,
  showForgotPassword: renderForgotPassword,
  showResetPassword: renderResetPassword,

  async login(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-submit');
    const errorEl = document.getElementById('login-error');

    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await Auth.afterLogin(data.user);
    } catch (e) {
      errorEl.textContent = Auth.errorToHuman(e);
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Iniciar sesión';
    }
  },

  async afterLogin(authUser) {
    const { data: perfil, error } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, centro_costo_id, es_gerente_operaciones, activo')
      .eq('id', authUser.id)
      .single();

    if (error || !perfil) {
      console.error('[auth] No se pudo cargar el perfil:', error);
      Toast.error('Error de perfil', 'No se pudo cargar tu perfil. Contacta al administrador.');
      await supabase.auth.signOut();
      renderLogin();
      return;
    }

    if (!perfil.activo) {
      Toast.error('Cuenta desactivada', 'Tu cuenta está deshabilitada. Contacta al administrador.');
      await supabase.auth.signOut();
      renderLogin();
      return;
    }

    state.user = {
      id: perfil.id,
      name: perfil.nombre,
      // ← se mapea desde la columna `rol`. 'supervisor' se retiró en nov. 2026
      // (migración 0023 lo pasa a 'solicitante'); si la app nueva se publica
      // antes de correr esa migración, se lo trata igual que a un solicitante.
      role: perfil.rol === 'supervisor' ? 'solicitante' : perfil.rol,
      email: authUser.email,
      centroCostoId: perfil.centro_costo_id,
      esGerente: perfil.es_gerente_operaciones
    };

    Toast.success('Sesión iniciada', `Bienvenido, ${state.user.name}`);

    // Cierre automático por inactividad
    Idle.start(INACTIVIDAD_MIN, () => Auth.logoutInactividad());

    // Monta la estructura permanente (sidebar + topbar) y navega a la vista
    // inicial -- o a la que pide el enlace del correo (?ir=bandeja, etc.,
    // ver boton() en supabase/functions/notificar), si el rol tiene acceso.
    window.Shell.render();
    window.Router.go(Auth.vistaDelEnlace() || 'inicio');
  },

  /**
   * Vista pedida por el enlace de un correo (?ir=<vista>), solo si existe en
   * el menú del rol actual (si no, se ignora en silencio y se va a Inicio).
   * Se consume una sola vez: se borra de la barra de direcciones.
   */
  vistaDelEnlace() {
    let vista = null;
    try {
      const url = new URL(window.location.href);
      vista = url.searchParams.get('ir');
      if (vista) {
        url.searchParams.delete('ir');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch { /* URL inválida: se ignora */ }
    const permitidas = ROLES[state.user?.role]?.menu || [];
    return vista && permitidas.includes(vista) ? vista : null;
  },

  async checkSession() {
    // Enlace del correo de recuperación (Edge Function recuperar-clave)
    try {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('recuperar');
      if (token) {
        guardarToken(token);
        url.searchParams.delete('recuperar');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    } catch { /* URL inválida: se ignora */ }
    if (leerToken()) {
      renderResetPassword();
      return false;
    }
    // Enlace antiguo de Supabase que ya se había usado o venció
    if (/error_code=otp_expired|error=access_denied/.test(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      renderForgotPassword(AVISO_ENLACE_VENCIDO);
      return false;
    }
    if (window.location.hash.includes('type=recovery')) {
      renderResetPassword();
      return false;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await Auth.afterLogin(session.user);
      return true;
    }
    renderLogin();
    return false;
  },

  async logout() {
    const ok = await Confirm.ask({
      title: '¿Cerrar sesión?',
      text: 'Vas a tener que ingresar tus credenciales nuevamente.',
      confirmText: 'Cerrar sesión'
    });
    if (!ok) return;
    Idle.stop();
    Modal.close();
    await supabase.auth.signOut();
    state.user = null;
    state.currentView = null;
    renderLogin();
  },

  // Cierre disparado por inactividad (sin confirmación)
  async logoutInactividad() {
    Idle.stop();
    Modal.close();
    state.user = null;          // antes del signOut, para no duplicar el render
    state.currentView = null;
    await supabase.auth.signOut();
    renderLogin();
    Toast.info('Sesión cerrada', 'Cerramos tu sesión por inactividad. Iniciá sesión de nuevo.');
  },

  // ----- RECUPERACIÓN DE CONTRASEÑA -----

  async requestPasswordReset(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('forgot-submit');
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');

    errorEl.hidden = true;
    successEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const r = await Auth.pedirRecuperacion(email);
      successEl.textContent = r?.mensaje || 'Listo. Revisa tu correo (puede tardar 1-2 minutos). Si no llega, revisa el spam.';
      successEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Enviar enlace';
      document.getElementById('forgot-email').value = '';
    } catch (e) {
      errorEl.textContent = Auth.errorToHuman(e);
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Enviar enlace';
    }
  },

  /**
   * Pide el correo de recuperación a la Edge Function recuperar-clave. Si
   * responde con un aviso (correo inválido, espera un minuto) se muestra
   * tal cual. Si la función no está publicada o falla, se usa el correo de
   * Supabase como antes, para no dejar a nadie sin poder recuperar.
   */
  async pedirRecuperacion(email) {
    try {
      const { data, error } = await supabase.functions.invoke('recuperar-clave', { body: { email } });
      if (!error) {
        if (data?.error) throw Object.assign(new Error(data.error), { esAviso: true });
        return data;
      }
      const status = error.context?.status;
      if (status === 400 || status === 429) {
        let cuerpo = null;
        try { cuerpo = await error.context.json(); } catch { /* sin cuerpo */ }
        throw Object.assign(new Error(cuerpo?.error || 'Espera un minuto antes de pedir otro correo.'), { esAviso: true });
      }
      console.warn('[recuperar-clave] no disponible, se usa el correo de Supabase:', status || error.message);
    } catch (e) {
      if (e.esAviso) throw e;
      console.warn('[recuperar-clave] no disponible, se usa el correo de Supabase:', e.message);
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
    return null;
  },

  volverAlLogin() {
    borrarToken();
    renderLogin();
  },

  async updatePassword(event) {
    event.preventDefault();
    const password = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-password-confirm').value;
    const btn = document.getElementById('reset-submit');
    const errorEl = document.getElementById('reset-error');

    errorEl.hidden = true;

    if (password !== confirm) {
      errorEl.textContent = 'Las contraseñas no coinciden.';
      errorEl.hidden = false;
      return;
    }
    const mensajeFaltante = mensajeReglasFaltantes(password);
    if (mensajeFaltante) {
      errorEl.textContent = mensajeFaltante;
      errorEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      // Enlace de recuperar-clave: el token se usa recién ahora
      const token = leerToken();
      if (token) {
        Auth._cambiandoClave = true;
        const { error: eOtp } = await supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' });
        borrarToken();
        if (eOtp) throw new Error(AVISO_ENLACE_VENCIDO);
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Auth._cambiandoClave = false;
      Toast.success('Contraseña actualizada', 'Ya puedes iniciar sesión con tu nueva contraseña.');
      await supabase.auth.signOut();
      state.user = null;
      window.history.replaceState(null, '', window.location.pathname);
      renderLogin();
    } catch (e) {
      Auth._cambiandoClave = false;
      // enlace ya usado o vencido: directo a pedir uno nuevo
      if (Auth.errorToHuman(e) === AVISO_ENLACE_VENCIDO) {
        borrarToken();
        renderForgotPassword(AVISO_ENLACE_VENCIDO);
        return;
      }
      errorEl.textContent = Auth.errorToHuman(e);
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Cambiar contraseña';
    }
  },

  init() {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && state.user) {
        state.user = null;
        renderLogin();
      }
      // (al validar el token de recuperar-clave también llega este evento:
      // el formulario ya está en pantalla, no se vuelve a dibujar)
      if (event === 'PASSWORD_RECOVERY' && !Auth._cambiandoClave) {
        renderResetPassword();
      }
    });
  },

  errorToHuman(e) {
    const msg = (e && e.message) || 'Error desconocido';
    if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de iniciar sesión.';
    if (msg.includes('User not found')) return 'Usuario no encontrado.';
    if (msg.toLowerCase().includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.';
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
      return 'Sin conexión. Verifica tu red.';
    }
    if (msg.includes('New password should be different')) return 'La nueva contraseña debe ser distinta a la anterior.';
    if (msg.includes('only request this after')) return 'Ya te enviamos un correo hace menos de un minuto. Revisa tu bandeja (y el spam) antes de pedir otro.';
    if (msg.includes('Auth session missing') || /expired|invalid.*(token|link)/i.test(msg)) return AVISO_ENLACE_VENCIDO;
    if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 8 caracteres.';
    if (msg.toLowerCase().includes('password should contain') || msg.toLowerCase().includes('character of each')) {
      return 'La contraseña no cumple los requisitos de seguridad (mayúscula, minúscula, número o símbolo) configurados en Supabase.';
    }
    return msg;
  }
};
