-- =====================================================================
-- 0009_homologacion_por_centro.sql
-- El prevencionista que homologa cambia según el centro de costo: cada
-- centro de costo tiene ahora su propio "Prevencionista (homologación)"
-- asignado -- mismo patrón que ya existe para el administrador de obra
-- (`centros_costo.admin_obra_id`) -- editable desde "Centros de costo".
--
-- Reemplaza el acceso de 0004 ("cualquier prevencionista ve todas las
-- contrataciones") por uno acotado: un prevencionista solo ve (lectura)
-- las contrataciones cuya solicitud de ingreso pertenece a un centro de
-- costo donde él es el prevencionista asignado. Si un centro no tiene
-- prevencionista asignado, nadie ve sus contrataciones por este camino
-- hasta que se asigne uno.
--
-- Ejecutar después de 0001-0008.
-- =====================================================================

alter table public.centros_costo
  add column if not exists prevencionista_id uuid references public.perfiles(id);

comment on column public.centros_costo.prevencionista_id is
  'Prevencionista responsable de la homologación SST de las contrataciones de este centro de costo. Editable desde "Centros de costo". Puede quedar sin asignar.';

-- Contrataciones: el prevencionista solo ve las de su(s) centro(s).
drop policy if exists contrataciones_prevencionista_select on public.contrataciones;
create policy contrataciones_prevencionista_select on public.contrataciones
  for select to authenticated
  using (
    public.rol_actual() = 'prevencionista'
    and exists (
      select 1
      from public.solicitudes s
      join public.centros_costo cc on cc.id = s.centro_origen_id
      where s.id = contrataciones.solicitud_id and cc.prevencionista_id = auth.uid()
    )
  );

-- Documentos de contratación: mismo criterio (ya no filtra por
-- requerido_homologacion -- eso lo dejó abierto la migración 0004).
drop policy if exists documentos_contratacion_prevencionista_select on public.documentos_contratacion;
create policy documentos_contratacion_prevencionista_select on public.documentos_contratacion
  for select to authenticated
  using (
    public.rol_actual() = 'prevencionista'
    and exists (
      select 1
      from public.contrataciones c
      join public.solicitudes s on s.id = c.solicitud_id
      join public.centros_costo cc on cc.id = s.centro_origen_id
      where c.id = documentos_contratacion.contratacion_id and cc.prevencionista_id = auth.uid()
    )
  );

-- Storage: mismo criterio, vía el path del archivo.
drop policy if exists storage_contratacion_prevencionista_select on storage.objects;
create policy storage_contratacion_prevencionista_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contratacion-documentos'
    and public.rol_actual() = 'prevencionista'
    and exists (
      select 1
      from public.documentos_contratacion doc
      join public.contrataciones c on c.id = doc.contratacion_id
      join public.solicitudes s on s.id = c.solicitud_id
      join public.centros_costo cc on cc.id = s.centro_origen_id
      where doc.storage_path = storage.objects.name and cc.prevencionista_id = auth.uid()
    )
  );
