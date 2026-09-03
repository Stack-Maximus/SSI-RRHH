-- =====================================================================
-- 0001_contratacion_rol.sql
-- Módulo de Contratación + SST (homologación) para SSI-RRHH.
--
-- IMPORTANTE: ejecutar este archivo SOLO (pegar y correr) antes que
-- 0002_contratacion_sst.sql. Postgres no permite usar un valor de enum
-- recién agregado (ALTER TYPE ... ADD VALUE) dentro de la misma
-- transacción/lote en que se agregó, así que el nuevo rol va en un
-- archivo aparte, igual que hace SSI-SST con sus migraciones numeradas.
-- =====================================================================

alter type public.user_role add value if not exists 'prevencionista';
