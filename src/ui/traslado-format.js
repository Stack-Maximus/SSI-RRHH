/**
 * Checklist de documentos para homologar un TRASLADO (Contrato de Trabajo +
 * Anexo de Contrato + Cédula) -- a diferencia de ingreso, es un set fijo de
 * 3 ítems (no depende de administrativo/operativo), así que se filtra por
 * código directamente en vez de reusar checklistParaTipo().
 */

export const TRASLADO_CHECKLIST_CODIGOS = ['contrato_trabajo', 'anexo_contrato', 'cedula_ambos_lados'];

/** Ítems del catálogo que aplican al checklist fijo de traslado, ya ordenados */
export function checklistParaTraslado(checklist) {
  return checklist
    .filter(c => TRASLADO_CHECKLIST_CODIGOS.includes(c.codigo))
    .sort((a, b) => a.orden - b.orden);
}

/**
 * Progreso de los 3 documentos de un traslado, a partir de las filas
 * crudas de `documentos_traslado` de UNA sola solicitud (ver
 * Data.documentosTrasladoPorSolicitud).
 *
 *   completo       -> están los 3 documentos requeridos
 *   fechaCompleto   -> fecha del último de los 3 en subirse (dispara el fin
 *                      del plazo de RRHH / inicio del plazo de homologación)
 *   ultimoResponsable -> quién subió el documento más reciente (mejor proxy
 *                      disponible de "quién de RRHH está llevando el caso"
 *                      mientras no estén los 3 -- no hay un dueño explícito
 *                      del caso como sí existe en contrataciones.creada_por)
 */
export function progresoDocumentosTraslado(checklist, documentos) {
  const items = checklistParaTraslado(checklist);
  const docPorItem = new Map(documentos.map(d => [d.checklist_item_id, d]));
  const faltantes = items.filter(i => !docPorItem.has(i.id));
  const completo = items.length > 0 && faltantes.length === 0;

  const fechaCompleto = completo
    ? items.reduce((max, i) => {
        const f = docPorItem.get(i.id).created_at;
        return (!max || f > max) ? f : max;
      }, null)
    : null;

  const ultimoDoc = documentos.reduce((max, d) => (!max || d.created_at > max.created_at) ? d : max, null);

  return { items, docPorItem, faltantes, completo, fechaCompleto, ultimoResponsable: ultimoDoc?.subido_por || null };
}
