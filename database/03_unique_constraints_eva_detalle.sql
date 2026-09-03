-- ============================================================================
-- Migración 01 · restricciones únicas para guardado progresivo (upsert)
-- Necesaria para que db/personal.js pueda hacer upsert por (evaluacion_id, criterio_codigo)
-- ============================================================================

alter table eva_detalle_auto
  add constraint eva_detalle_auto_evaluacion_criterio_key
  unique (evaluacion_id, criterio_codigo);

alter table eva_detalle_sup
  add constraint eva_detalle_sup_evaluacion_criterio_key
  unique (evaluacion_id, criterio_codigo);
