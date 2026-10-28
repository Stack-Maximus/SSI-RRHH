/**
 * Modal genérico reutilizado por todas las vistas — un backdrop + tarjeta,
 * con el contenido HTML que cada llamador defina.
 *
 * Clases usadas (deben calzar con modal.css real): .modal-backdrop, .modal,
 * .modal-sm/.modal-md/.modal-lg, .modal-header, .modal-title,
 * .modal-close-btn, .modal-body.
 *
 * Opciones de Modal.open():
 *   title, content (HTML), size ('sm' | 'md' | 'lg')
 *   descartable (default true): se cierra con un clic fuera de la tarjeta o
 *     con Esc. Los formularios lo apagan (false) para que un clic de más no
 *     borre lo escrito -- ahí solo cierran la X y el botón Cancelar.
 *   onClose: función que se llama al cerrarse (por cualquier vía).
 *
 * El Router cierra cualquier modal abierto al cambiar de vista (router.js).
 */

let onCloseActual = null;

function alPresionarTecla(e) {
  if (e.key === 'Escape') Modal.close();
}

export const Modal = {
  open({ title, content, size = "md", descartable = true, onClose = null }) {
    Modal.close(); // por si había uno abierto

    const tamano = ["sm", "md", "lg"].includes(size) ? `modal-${size}` : "modal-md";

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal ${tamano}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title">${title}</h3>
          <button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    `;
    document.body.appendChild(backdrop);
    onCloseActual = onClose;

    document.getElementById("modal-close-btn").addEventListener("click", Modal.close);
    if (descartable) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) Modal.close();
      });
      document.addEventListener("keydown", alPresionarTecla);
    }
  },

  close() {
    const el = document.getElementById("modal-backdrop");
    document.removeEventListener("keydown", alPresionarTecla);
    if (!el) return;
    el.remove();
    const cb = onCloseActual;
    onCloseActual = null;
    if (cb) cb();
  },

  /** ¿Hay un modal abierto? */
  abierto() {
    return !!document.getElementById("modal-backdrop");
  },
};
