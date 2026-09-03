-- ============================================================================
-- Asegura que el trigger de notificación de acciones de NC exista de
-- verdad — la función ya estaba bien (viene de migracion_correo_detallado),
-- pero si nunca se corrió la migración original que crea el trigger en sí,
-- la función nunca se llama.
-- ============================================================================

drop trigger if exists on_accion_nc_asignada on nc_acciones;

create trigger on_accion_nc_asignada
  after insert on nc_acciones
  for each row execute function trigger_notificar_accion_nc_asignada();
