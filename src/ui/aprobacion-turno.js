/**
 * Turno de aprobación y tiempo de espera de una solicitud pendiente -- lo
 * usan "Aprobaciones pendientes" (RRHH / admin), "Solicitudes" y "Mis
 * solicitudes" para mostrar hace cuánto espera el aprobador al que le toca
 * y para el botón 🔔 Recordar (Edge Function notificar,
 * 'recordatorio_aprobador', que calcula lo mismo del lado del servidor para
 * armar el correo personalizado).
 *
 * Niveles de urgencia (deben coincidir con nivelEspera() en
 * supabase/functions/notificar/index.ts):
 *   'al_dia'   -> menos de 1 día hábil esperando
 *   'atrasada' -> 1 o 2 días hábiles
 *   'critica'  -> 3 días hábiles o más
 */

import { diasHabilesEntre } from '../utils/dias-habiles.js';
import { Data } from '../db/data.js';
import { Toast } from './toast.js';

export const ESPERA_DIAS_ATRASADA = 1;
export const ESPERA_DIAS_CRITICA = 3;

/** Aprobaciones a las que les toca decidir AHORA (menor orden entre las pendientes). */
export function aprobacionesEnTurno(sol) {
  if (sol.estado !== 'pendiente') return [];
  const pend = (sol.aprobaciones || []).filter(a => a.decision === 'pendiente');
  if (!pend.length) return [];
  const min = Math.min(...pend.map(a => a.orden));
  return pend.filter(a => a.orden === min);
}

/**
 * Desde cuándo espera la solicitud al aprobador `apr` (que está en turno):
 * la última decisión de un aprobador anterior, o la creación de la solicitud
 * si es el primero (la aprobación es secuencial).
 */
export function esperaDesde(sol, apr) {
  const fechas = [sol.created_at, apr?.asignado_at,
    ...(sol.aprobaciones || []).filter(a => a.orden < (apr?.orden ?? 0) && a.decidido_at).map(a => a.decidido_at)]
    .filter(Boolean);
  return fechas.reduce((max, f) => (new Date(f) > new Date(max) ? f : max), fechas[0]);
}

/** { dias (hábiles), horas, nivel, texto } de una espera que empezó en `desde`. */
export function nivelEspera(desde, ahora = new Date()) {
  const horas = Math.max(0, (ahora - new Date(desde)) / 36e5);
  const dias = diasHabilesEntre(desde, ahora);
  const nivel = dias >= ESPERA_DIAS_CRITICA ? 'critica' : dias >= ESPERA_DIAS_ATRASADA ? 'atrasada' : 'al_dia';
  const texto = dias >= 1
    ? `${dias} día${dias === 1 ? '' : 's'} hábil${dias === 1 ? '' : 'es'}`
    : horas < 1 ? 'menos de 1 hora' : `${Math.floor(horas)} hora${Math.floor(horas) === 1 ? '' : 's'}`;
  return { dias, horas, nivel, texto };
}

const CLASE_NIVEL = { al_dia: 'badge-info', atrasada: 'badge-warning', critica: 'badge-danger' };
export const ETIQUETA_NIVEL = { al_dia: 'Al día', atrasada: 'Atrasada', critica: 'Crítica' };

/** Pastilla "⏳ 2 días hábiles" con el color de su nivel. */
export function esperaBadge(desde, prefijo = '⏳ ') {
  const e = nivelEspera(desde);
  return `<span class="badge ${CLASE_NIVEL[e.nivel]}" title="Esperando desde el ${new Date(desde).toLocaleString('es-CL')}">${prefijo}${e.texto}</span>`;
}

/**
 * 🔔 Recordar al aprobador: correo personalizado a quien le toca decidir
 * esta solicitud, con el tiempo que lleva esperando (Edge Function
 * notificar, 'recordatorio_aprobador'). Botón con data-recordar="<solicitud_id>"
 * (Mis solicitudes y Solicitudes). La función revisa que quien lo pide sea
 * quien creó la solicitud (o RRHH / admin) y no deja repetirlo antes de
 * unas horas (el error dice desde cuándo).
 */
export async function recordar(btn) {
  const texto = btn.textContent;
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const r = await Data.recordarAprobador({ solicitud_id: btn.dataset.recordar });
    const quien = (r?.destinatarios || []).join(', ');
    Toast.success('Recordatorio enviado', quien ? `Le escribimos a ${quien}.` : 'Le escribimos al aprobador.');
    btn.textContent = '✓ Recordatorio enviado';
  } catch (e) {
    console.error('[recordar]', e);
    Toast.error('No se envió el recordatorio', e.message || '');
    btn.disabled = false; btn.textContent = texto;
  }
}

