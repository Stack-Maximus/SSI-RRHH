-- =====================================================================
-- 0005_rol_supervisor.sql
-- Agrega el rol 'supervisor': quien levanta solicitudes de aumento de
-- sueldo, bono, cambio de cargo y renovación (para trabajadores ya
-- contratados). Ejecutar SOLO este archivo primero -- Postgres no deja
-- usar un valor de enum recién creado dentro del mismo lote/transacción
-- en que se agregó.
-- =====================================================================

alter type public.user_role add value if not exists 'supervisor';
