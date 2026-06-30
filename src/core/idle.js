/**
 * Temporizador de inactividad. Cuenta tiempo sin interacción del usuario y,
 * al superar el límite, dispara el callback (que cierra la sesión).
 * Cualquier actividad (mouse, teclado, scroll, touch) reinicia el conteo.
 */

const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
let timer = null;
let reset = null;
let onIdle = null;

export const Idle = {
  /** minutos: límite de inactividad · cb: qué hacer al vencer */
  start(minutos, cb) {
    this.stop();
    onIdle = cb;
    const ms = Math.max(1, minutos) * 60 * 1000;
    reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (onIdle) onIdle(); }, ms);
    };
    EVENTOS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset(); // arranca el conteo
  },

  stop() {
    clearTimeout(timer);
    timer = null;
    if (reset) {
      EVENTOS.forEach((e) => window.removeEventListener(e, reset));
      reset = null;
    }
    onIdle = null;
  }
};
