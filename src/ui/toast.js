/**
 * Sistema de notificaciones y diálogos basado en SweetAlert2.
 * Exporta:
 *   - Toast (success/error/warning/info) · notificaciones efímeras
 *   - Confirm.ask({title, text, variant, ...}) · diálogo modal de confirmación
 */

import Swal from 'sweetalert2';

const ToastMixin = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

export const Toast = {
  success: (title, message) => ToastMixin.fire({ icon: 'success', title, text: message }),
  error:   (title, message) => ToastMixin.fire({ icon: 'error',   title, text: message, timer: 5000 }),
  warning: (title, message) => ToastMixin.fire({ icon: 'warning', title, text: message }),
  info:    (title, message) => ToastMixin.fire({ icon: 'info',    title, text: message })
};

export const Confirm = {
  /**
   * Diálogo de confirmación. Retorna Promise<boolean>.
   * Uso: const ok = await Confirm.ask({ title: '...', text: '...', variant: 'danger' });
   */
  async ask({ title, text = '', variant = 'primary', confirmText = 'Continuar', cancelText = 'Cancelar' }) {
    const colors = { primary: '#009BDB', danger: '#dc2626', success: '#16a34a' };
    const result = await Swal.fire({
      title,
      text,
      icon: variant === 'danger' ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      confirmButtonColor: colors[variant] || colors.primary,
      cancelButtonColor: '#6b7280',
      reverseButtons: true
    });
    return result.isConfirmed;
  }
};
