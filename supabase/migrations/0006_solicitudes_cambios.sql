-- =====================================================================
-- 0006_solicitudes_cambios.sql
-- Nuevos tipos de solicitud para trabajadores YA contratados: aumento de
-- sueldo, bono, cambio de cargo y renovación. Las levanta un 'supervisor'
-- y las aprueba UNA sola persona: el administrador de obra del centro de
-- costo del trabajador (mismo dato `centros_costo.admin_obra_id` que ya
-- usa el resto del sistema) -- no pasa por el Gerente de Operaciones.
-- Una vez aprobada, RRHH se entera por el mismo mecanismo que ya usan
-- ingreso/traslado (Bandeja -> notificar 'cambio_estado').
--
-- IMPORTANTE — no tengo el código fuente de:
--   - la función crear_solicitud() existente (para ingreso/traslado)
--   - el trigger que recalcula solicitudes.estado / tiempos al decidir
--     una aprobación
--   - la función mi_bandeja()
--   - la Edge Function `notificar`
-- así que en vez de tocarlos a ciegas, esta migración es 100% aditiva:
-- define un RPC nuevo (crear_solicitud_cambio) que hace su propio insert
-- en `solicitudes` + `aprobaciones`, reusando la Bandeja / decidir() /
-- notificar existentes tal cual (esas no distinguen por tipo en ningún
-- lado del código cliente, así que deberían funcionar solas). Si algo no
-- aparece en la Bandeja o el correo sale con datos raros para estos
-- tipos nuevos, compárteme esos 4 objetos y lo ajusto fino.
--
-- Ejecutar después de 0001-0005.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Nuevos valores del enum de tipo de solicitud.
--    OJO: asumo que el enum se llama `tipo_solicitud` (mismo patrón que
--    `estado_solicitud`). Si tu enum tiene otro nombre, este ALTER TYPE
--    va a fallar con un error claro ("type ... does not exist") sin
--    romper nada -- avísame el nombre real y lo corrijo.
-- ---------------------------------------------------------------------
alter type public.tipo_solicitud add value if not exists 'aumento_sueldo';
alter type public.tipo_solicitud add value if not exists 'bono';
alter type public.tipo_solicitud add value if not exists 'cambio_cargo';
alter type public.tipo_solicitud add value if not exists 'renovacion';
