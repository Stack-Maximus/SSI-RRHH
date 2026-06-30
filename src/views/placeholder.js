/**
 * Genera una vista placeholder "en construcción" para las pantallas
 * que todavía no están implementadas. Se reemplazan sprint a sprint.
 */

export function makePlaceholder(titulo, descripcion, fase = '') {
  return function (container) {
    container.innerHTML = `
      <div class="placeholder construction">
        <div class="placeholder-icon">🚧</div>
        <h2>${titulo}</h2>
        <p class="lead">${descripcion}</p>
        ${fase ? `<span class="phase-tag">${fase}</span>` : ''}
      </div>
    `;
  };
}
