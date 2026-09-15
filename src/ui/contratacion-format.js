/**
 * Helpers compartidos por las vistas de Contratación / Homologación SST.
 */

import {
  CANAL_CONTRATACION_LABELS, TIPO_TRABAJADOR_LABELS, ESTADO_CONTRATACION_LABELS,
  ESTADO_RECLUTAMIENTO_LABELS, DECISION_CANDIDATO_LABELS
} from '../config.js';

export function estadoContratacionBadge(estado) {
  const map = {
    en_proceso:           ['badge-warning', ESTADO_CONTRATACION_LABELS.en_proceso],
    documentos_completos: ['badge-neutral', ESTADO_CONTRATACION_LABELS.documentos_completos],
    contratado:           ['badge-success', ESTADO_CONTRATACION_LABELS.contratado],
    anulada:              ['badge-danger',  ESTADO_CONTRATACION_LABELS.anulada]
  };
  const [cls, label] = map[estado] || ['badge-neutral', estado];
  return `<span class="badge ${cls}">${label}</span>`;
}

export function canalLabel(canal) { return CANAL_CONTRATACION_LABELS[canal] || canal; }
export function tipoTrabajadorLabel(tipo) { return TIPO_TRABAJADOR_LABELS[tipo] || tipo; }

/** Estado de un proceso de Reclutamiento y selección (migración 0018) */
export function estadoReclutamientoBadge(estado) {
  const map = {
    esperando_seleccion: ['badge-warning', ESTADO_RECLUTAMIENTO_LABELS.esperando_seleccion],
    candidato_elegido:   ['badge-success', ESTADO_RECLUTAMIENTO_LABELS.candidato_elegido],
    todos_rechazados:    ['badge-danger',  ESTADO_RECLUTAMIENTO_LABELS.todos_rechazados]
  };
  const [cls, label] = map[estado] || ['badge-neutral', estado];
  return `<span class="badge ${cls}">${label}</span>`;
}

/** Decisión sobre un candidato ofrecido (reclutamiento_candidatos.decision) */
export function decisionCandidatoBadge(decision) {
  const map = {
    pendiente: ['badge-warning', DECISION_CANDIDATO_LABELS.pendiente],
    elegido:   ['badge-success', DECISION_CANDIDATO_LABELS.elegido],
    rechazado: ['badge-danger',  DECISION_CANDIDATO_LABELS.rechazado]
  };
  const [cls, label] = map[decision] || ['badge-neutral', decision];
  return `<span class="badge ${cls}">${label}</span>`;
}

/** Nombre completo de un candidato de reclutamiento_candidatos (3 columnas separadas) */
export function nombreCandidatoRecl(c) {
  return [c.nombres, c.apellido_paterno, c.apellido_materno].filter(Boolean).join(' ');
}

/** Ítems de checklist que aplican a un tipo de trabajador, ya filtrados/ordenados */
export function checklistParaTipo(checklist, tipo) {
  const campo = tipo === 'administrativo' ? 'aplica_administrativo' : 'aplica_operativo';
  return checklist.filter(c => c[campo]);
}

/** Progreso de documentos obligatorios subidos para una contratación */
export function progresoDocumentos(checklist, documentos, tipoTrabajador) {
  const items = checklistParaTipo(checklist, tipoTrabajador);
  const subidosIds = new Set(documentos.map(d => d.checklist_item_id));
  const obligatorios = items.filter(i => i.obligatorio);
  const obligCompletos = obligatorios.filter(i => subidosIds.has(i.id)).length;
  const totalCompletos = items.filter(i => subidosIds.has(i.id)).length;
  return {
    items, subidosIds,
    obligTotal: obligatorios.length, obligCompletos,
    total: items.length, totalCompletos,
    completo: obligatorios.length > 0 && obligCompletos === obligatorios.length
  };
}
