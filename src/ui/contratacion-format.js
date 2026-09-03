/**
 * Helpers compartidos por las vistas de Contratación / Homologación SST.
 */

import { CANAL_CONTRATACION_LABELS, TIPO_TRABAJADOR_LABELS, ESTADO_CONTRATACION_LABELS } from '../config.js';

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
