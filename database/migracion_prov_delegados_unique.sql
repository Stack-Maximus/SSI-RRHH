-- ============================================================================
-- Migración: unicidad de delegados por área
-- Sin esto, asignar un delegado dos veces a la misma área crea filas
-- duplicadas en vez de actualizar la existente.
-- ============================================================================

alter table prov_delegados add constraint prov_delegados_area_unique unique (area);
