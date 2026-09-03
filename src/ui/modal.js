/**
 * Modal genérico reutilizado por todas las vistas — un backdrop + tarjeta,
 * con el contenido HTML que cada llamador defina.
 *
 * Clases usadas (deben calzar con modal.css real): .modal-backdrop, .modal,
 * .modal-sm/.modal-md/.modal-lg, .modal-header, .modal-title,
 * .modal-close-btn, .modal-body.
 */

export const Modal = {
  open({ title, content, size = "md" }) {
    Modal.close(); // por si había uno abierto

    const tamano = ["sm", "md", "lg"].includes(size) ? `modal-${size}` : "modal-md";

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal ${tamano}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close-btn" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    `;
    document.body.appendChild(backdrop);

    document.getElementById("modal-close-btn").addEventListener("click", Modal.close);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) Modal.close();
    });
  },

  close() {
    document.getElementById("modal-backdrop")?.remove();
  },
};