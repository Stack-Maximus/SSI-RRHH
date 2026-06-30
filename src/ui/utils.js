/**
 * Utilidades de presentación reutilizables.
 */

import { ROLE_LABELS } from '../config.js';

/** Escapa HTML para evitar XSS al inyectar texto de usuario en innerHTML */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** "Maximiliano Hernandez" → "MH" */
export function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('') || '?';
}

/** "encargado" → "Enc. Operaciones" */
export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

/** Formato dd/mm/yyyy */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Formato hh:mm */
export function formatTime(time) {
  if (!time) return '';
  return String(time).slice(0, 5);
}
