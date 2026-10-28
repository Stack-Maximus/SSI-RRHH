-- =====================================================================
-- 0021_tipo_cambio_turno.sql
-- Nuevo tipo de solicitud "Cambio de turno" (oct. 2026, a pedido):
-- seleccionar al trabajador y el turno nuevo. Aprueba solo el
-- administrador de obra del centro de costo del trabajador (mismo circuito
-- que aumento de sueldo / cambio de cargo / renovación / desvinculación).
--
-- Va SOLO, separado de 0022, por la misma razón que 0013/0014: Postgres no
-- deja usar un valor de enum recién agregado dentro de la misma
-- transacción en la que se agregó. Ejecutar 0021, y DESPUÉS 0022.
-- =====================================================================

alter type public.tipo_solicitud add value if not exists 'cambio_turno';
