/**
 * Plazo de RRHH en un proceso de Reclutamiento y selección (oct. 2026, a
 * pedido): RRHH tiene DIAS_HABILES_RECLUTAMIENTO (5) días hábiles para
 * enviar candidatos, y ese plazo se REINICIA cada vez que el solicitante
 * rechaza a todos los candidatos de una tanda.
 *
 * Un proceso se mide por "ciclos" de búsqueda, uno por tanda:
 *   - tanda 1: desde que RRHH crea el proceso (reclutamientos.created_at)
 *     hasta que envía la primera tanda (el candidato más antiguo de la tanda).
 *     Antes de crear el proceso, la vacante sigue contando en el SLA de
 *     Contratación como "sin iniciar" (desde la aprobación).
 *   - tanda k > 1: desde que se rechazó al último candidato de la tanda k-1
 *     (rechazo total) hasta que RRHH envía la tanda k.
 * Mientras el solicitante revisa una tanda el reloj de RRHH no corre (no es
 * tiempo de RRHH); al elegir un candidato el proceso termina.
 *
 * Lo usan el dashboard "SLA Contratación" (tabla de ciclos) y la tarjeta
 * del proceso en Contratación (plazo de la tanda vigente).
 */

import { diasHabilesEntre } from '../utils/dias-habiles.js';
import { DIAS_HABILES_RECLUTAMIENTO } from '../config.js';

export const SLA_RECLUTAMIENTO = DIAS_HABILES_RECLUTAMIENTO;

const minFecha = (fechas) => fechas.reduce((m, f) => (!m || new Date(f) < new Date(m) ? f : m), null);
const maxFecha = (fechas) => fechas.reduce((m, f) => (!m || new Date(f) > new Date(m) ? f : m), null);

/**
 * Ciclos de búsqueda de un proceso: [{ tanda, inicio, fin, finalizado, dias }].
 * El último puede estar abierto (fin = null) si RRHH todavía no envía esa tanda.
 */
export function ciclosReclutamiento(r, candidatos = [], ahora = new Date()) {
  const porTanda = new Map();
  candidatos.forEach(c => {
    if (!porTanda.has(c.tanda)) porTanda.set(c.tanda, []);
    porTanda.get(c.tanda).push(c);
  });
  const tandas = [...porTanda.keys()].sort((a, b) => a - b);

  const ciclos = [];
  let inicio = r.created_at;
  for (const t of tandas) {
    const cands = porTanda.get(t);
    const envio = minFecha(cands.map(c => c.created_at));
    if (inicio && envio) {
      ciclos.push({ tanda: t, inicio, fin: envio, finalizado: true, dias: diasHabilesEntre(inicio, envio) });
    }
    // Rechazo total de la tanda -> el plazo vuelve a empezar desde el último rechazo.
    const todosRechazados = cands.length > 0 && cands.every(c => c.decision === 'rechazado');
    inicio = todosRechazados ? (maxFecha(cands.map(c => c.decidido_at).filter(Boolean)) || envio) : null;
  }

  const ultimaTanda = tandas.length ? tandas[tandas.length - 1] : 0;
  const buscando = r.estado !== 'candidato_elegido' && (tandas.length === 0 || r.estado === 'todos_rechazados');
  if (buscando && inicio) {
    ciclos.push({ tanda: ultimaTanda + 1, inicio, fin: null, finalizado: false, dias: diasHabilesEntre(inicio, ahora) });
  }
  return ciclos;
}

/**
 * Resumen para la tarjeta del proceso: ciclo vigente (o el último cerrado),
 * cuántas veces se reinició el plazo y en qué está el proceso.
 */
export function resumenReclutamiento(r, candidatos = [], ahora = new Date()) {
  const ciclos = ciclosReclutamiento(r, candidatos, ahora);
  const ultimo = ciclos[ciclos.length - 1] || null;
  const reinicios = Math.max(0, ciclos.length - 1);
  let etapa;
  if (r.estado === 'candidato_elegido') etapa = 'Candidato elegido';
  else if (ultimo && !ultimo.finalizado) etapa = ultimo.tanda === 1 ? 'RRHH buscando candidatos' : `RRHH buscando candidatos (tanda ${ultimo.tanda})`;
  else etapa = 'Esperando decisión del solicitante';
  return { ciclos, ultimo, reinicios, etapa };
}
