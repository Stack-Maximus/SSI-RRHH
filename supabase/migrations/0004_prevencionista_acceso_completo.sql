-- =====================================================================
-- 0004_prevencionista_acceso_completo.sql
-- Amplía el acceso de LECTURA del prevencionista: además de los 2
-- documentos marcados requerido_homologacion = true (Contrato y
-- Cédula/Pasaporte), que siguen siendo los que se muestran primero,
-- ahora puede abrir CUALQUIER otro documento ya subido de una
-- contratación, por si necesita revisar algo puntual (ej. certificado
-- de título, licencia de conducir, etc.) que no es parte del expediente
-- estándar de homologación.
--
-- Sigue siendo de SOLO LECTURA: el prevencionista no puede subir,
-- reemplazar ni borrar documentos (eso lo sigue haciendo únicamente RRHH/admin).
--
-- Ejecutar después de 0001, 0002 y 0003.
-- =====================================================================

drop policy if exists documentos_contratacion_prevencionista_select on public.documentos_contratacion;
create policy documentos_contratacion_prevencionista_select on public.documentos_contratacion
  for select to authenticated
  using (public.rol_actual() = 'prevencionista');

drop policy if exists storage_contratacion_prevencionista_select on storage.objects;
create policy storage_contratacion_prevencionista_select on storage.objects
  for select to authenticated
  using (bucket_id = 'contratacion-documentos' and public.rol_actual() = 'prevencionista');
