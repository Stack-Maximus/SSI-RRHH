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
import { renderLogin } from '../views/login.js';
import { renderForgotPassword } from '../views/forgot-password.js';
import { renderResetPassword } from '../views/reset-password.js';

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
      role: perfil.rol,                          // ← se mapea desde la columna `rol`
      email: authUser.email,
      centroCostoId: perfil.centro_costo_id,
      esGerente: perfil.es_gerente_operaciones
    };

    Toast.success('Sesión iniciada', `Bienvenido, ${state.user.name}`);

    // Cierre automático por inactividad
    Idle.start(INACTIVIDAD_MIN, () => Auth.logoutInactividad());

    // Monta la estructura permanente (sidebar + topbar) y navega a la vista inicial
    window.Shell.render();
    window.Router.go('inicio');
  },

  async checkSession() {
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
    await supabase.auth.signOut();
    state.user = null;
    state.currentView = null;
    renderLogin();
  },

  // Cierre disparado por inactividad (sin confirmación)
  async logoutInactividad() {
    Idle.stop();
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      successEl.textContent = 'Listo. Revisa tu correo (puede tardar 1-2 minutos). Si no llega, revisa el spam.';
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
    if (password.length < 8) {
      errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      errorEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Toast.success('Contraseña actualizada', 'Ya puedes iniciar sesión con tu nueva contraseña.');
      await supabase.auth.signOut();
      state.user = null;
      window.history.replaceState(null, '', window.location.pathname);
      renderLogin();
    } catch (e) {
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
      if (event === 'PASSWORD_RECOVERY') {
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
    if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 8 caracteres.';
    return msg;
  }
};
