-- =====================================================================
-- 02_vaciar_solicitudes_y_trabajadores.sql  ·  REEMPLAZADO (nov. 2026)
--
-- Este script quedó obsoleto: no conocía las tablas nuevas (recordatorios
-- de la migración 0022) ni vaciaba centros de costo y cargos.
-- Usa 02_vaciar_todo_menos_usuarios.sql (misma carpeta).
-- Este archivo ya no borra nada; se puede eliminar.
-- =====================================================================

do $$
begin
  raise exception 'Script reemplazado: usa supabase/mantencion/02_vaciar_todo_menos_usuarios.sql.';
end $$;
