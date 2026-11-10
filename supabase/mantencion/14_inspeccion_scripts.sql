-- =====================================================================
-- 14_inspeccion_scripts.sql   (nov. 2026)  -- SOLO LECTURA, no cambia nada
--
-- ¿Me falta correr algún script? Revisa la base contra el repositorio:
--
--  MIGRACIONES 0001 a 0029: que estén las tablas, columnas, valores de
--  enum, restricciones, buckets, funciones, triggers y políticas que crea
--  cada una. Las FUNCIONES se comparan además con el contenido de su
--  última versión en el repo: si están pero con una versión anterior,
--  aparece "VERSIÓN ANTERIOR" y hay que volver a correr esa migración.
--  La 0024 se revisa por sus restricciones ajustadas.
--
--  SCRIPTS PUNTUALES (supabase/mantencion): 05, 06, 09, 10, 12 y 13, por lo
--  que dejan en los datos; y el 11 (obra de los trabajadores) por si quedan
--  trabajadores sin obra. Más la configuración de obras sin administrador.
--
-- Estados: OK · FALTA CORRER · VERSIÓN ANTERIOR · REVISAR · SIN REVISIÓN
-- (SIN REVISIÓN = la migración no crea nada comprobable: cambia datos o
-- funciones que una migración posterior vuelve a definir, y esa es la que
-- se revisa).
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar todo y Run. Muestra una sola
-- tabla con el resultado. O desde CMD:
--   node supabase\mantencion\sql.mjs supabase\mantencion\14_inspeccion_scripts.sql --guardar
-- Generado desde supabase/migrations: si se agrega una migración nueva,
-- hay que regenerarlo.
-- =====================================================================

create temp table if not exists _esp (migracion text, tipo text, objeto text, extra text);
truncate _esp;
insert into _esp (migracion, tipo, objeto, extra) values
  ('0001', 'valor enum', 'user_role.prevencionista', ''),
  ('0002', 'bucket', 'contratacion-documentos', ''),
  ('0002', 'función', 'rol_actual', '53de422a4c0e483da37669fd54e1065c|'),
  ('0002', 'política', 'public.contrataciones.contrataciones_rrhh_admin', ''),
  ('0002', 'política', 'public.documentos_checklist.documentos_checklist_select', ''),
  ('0002', 'política', 'public.documentos_checklist.documentos_checklist_write', ''),
  ('0002', 'política', 'public.documentos_contratacion.documentos_contratacion_rrhh_admin', ''),
  ('0002', 'política', 'storage.objects.storage_contratacion_rrhh_admin', ''),
  ('0002', 'tabla', 'contrataciones', ''),
  ('0002', 'tabla', 'documentos_checklist', ''),
  ('0002', 'tabla', 'documentos_contratacion', ''),
  ('0005', 'valor enum', 'user_role.supervisor', ''),
  ('0006', 'valor enum', 'tipo_solicitud.aumento_sueldo', ''),
  ('0006', 'valor enum', 'tipo_solicitud.bono', ''),
  ('0006', 'valor enum', 'tipo_solicitud.cambio_cargo', ''),
  ('0006', 'valor enum', 'tipo_solicitud.renovacion', ''),
  ('0008', 'columna', 'trabajadores.contrato_indefinido', ''),
  ('0008', 'columna', 'trabajadores.fecha_termino_contrato', ''),
  ('0008', 'trigger', 'public.solicitudes.trg_actualizar_fecha_termino_renovacion', ''),
  ('0009', 'columna', 'centros_costo.prevencionista_id', ''),
  ('0009', 'política', 'public.contrataciones.contrataciones_prevencionista_select', ''),
  ('0009', 'política', 'public.documentos_contratacion.documentos_contratacion_prevencionista_select', ''),
  ('0009', 'política', 'storage.objects.storage_contratacion_prevencionista_select', ''),
  ('0010', 'columna', 'solicitudes.folio', ''),
  ('0010', 'tabla', 'folios_correlativos', ''),
  ('0010', 'trigger', 'public.solicitudes.trg_asignar_folio_solicitud', ''),
  ('0011', 'columna', 'contrataciones.homologacion_aprobada_at', ''),
  ('0011', 'columna', 'contrataciones.homologacion_aprobada_por', ''),
  ('0011', 'política', 'public.contrataciones.contrataciones_prevencionista_autorizar', ''),
  ('0012', 'bucket', 'traslado-documentos', ''),
  ('0012', 'columna', 'solicitudes.homologacion_traslado_aprobada_at', ''),
  ('0012', 'columna', 'solicitudes.homologacion_traslado_aprobada_por', ''),
  ('0012', 'columna', 'solicitudes.procesado_rrhh_at', ''),
  ('0012', 'columna', 'solicitudes.procesado_rrhh_por', ''),
  ('0012', 'política', 'public.documentos_traslado.documentos_traslado_prevencionista_select', ''),
  ('0012', 'política', 'public.documentos_traslado.documentos_traslado_rrhh_admin', ''),
  ('0012', 'política', 'public.solicitudes.solicitudes_prevencionista_autorizar_traslado', ''),
  ('0012', 'política', 'storage.objects.storage_traslado_prevencionista_select', ''),
  ('0012', 'política', 'storage.objects.storage_traslado_rrhh_admin', ''),
  ('0012', 'tabla', 'documentos_traslado', ''),
  ('0013', 'columna', 'trabajadores.requiere_anexo_renovacion', ''),
  ('0013', 'columna', 'trabajadores.tipo_contrato', ''),
  ('0013', 'función', 'apagar_requiere_anexo_por_renovacion', 'a59be8bf43e4b8c0f0c1130688a8dd78|'),
  ('0013', 'función', 'bloquear_traslado_obra_o_faena', 'd6bdfc7dee05a1c120052ef8b8714faa|'),
  ('0013', 'función', 'marcar_requiere_anexo_renovacion', 'b2d80642375e32be99fed9a0b9263090|'),
  ('0013', 'trigger', 'public.solicitudes.trg_apagar_requiere_anexo_renovacion', ''),
  ('0013', 'trigger', 'public.solicitudes.trg_bloquear_traslado_obra_o_faena', ''),
  ('0013', 'trigger', 'public.trabajadores.trg_marcar_requiere_anexo_renovacion', ''),
  ('0013', 'valor enum', 'tipo_solicitud.desvinculacion', ''),
  ('0014', 'función', 'desactivar_trabajador_por_desvinculacion', '40ea64f862d3258c9751a6429453d0f2|'),
  ('0014', 'trigger', 'public.solicitudes.trg_desactivar_trabajador_por_desvinculacion', ''),
  ('0015', 'columna', 'contrataciones.apellido_materno_candidato', ''),
  ('0015', 'columna', 'contrataciones.apellido_paterno_candidato', ''),
  ('0015', 'columna', 'contrataciones.nombres_candidato', ''),
  ('0015', 'columna', 'trabajadores.apellido_materno', ''),
  ('0015', 'columna', 'trabajadores.apellido_paterno', ''),
  ('0015', 'columna', 'trabajadores.nombres', ''),
  ('0015', 'función', 'armar_nombre_candidato', 'd855d92d5e1a6305ee2d46d1bff25f7f|'),
  ('0015', 'función', 'armar_nombre_trabajador', '947745d03c6f800a46db72c8c7c88dc2|'),
  ('0015', 'trigger', 'public.contrataciones.trg_armar_nombre_candidato', ''),
  ('0015', 'trigger', 'public.trabajadores.trg_armar_nombre_trabajador', ''),
  ('0016', 'columna', 'perfiles.es_gerente_prevencion', ''),
  ('0016', 'política', 'public.homologacion_rechazo_documentos.homologacion_rechazo_documentos_insert', ''),
  ('0016', 'política', 'public.homologacion_rechazo_documentos.homologacion_rechazo_documentos_select', ''),
  ('0016', 'política', 'public.homologacion_rechazos.homologacion_rechazos_admin_all', ''),
  ('0016', 'política', 'public.homologacion_rechazos.homologacion_rechazos_prevencionista_insert', ''),
  ('0016', 'política', 'public.homologacion_rechazos.homologacion_rechazos_prevencionista_select', ''),
  ('0016', 'política', 'public.homologacion_rechazos.homologacion_rechazos_rrhh_select', ''),
  ('0016', 'tabla', 'homologacion_rechazo_documentos', ''),
  ('0016', 'tabla', 'homologacion_rechazos', ''),
  ('0017', 'función', 'editar_solicitud', 'c19fa321b2346e695be0bca6712e1c2e|p_solicitud_id,p_motivo,p_detalle'),
  ('0018', 'bucket', 'reclutamiento-cv', ''),
  ('0018', 'función', 'reclutamiento_agregar_candidatos', '2a593bf659851b35fcae8eb01dd07108|p_reclutamiento_id,p_candidatos'),
  ('0018', 'función', 'reclutamiento_decidir_candidato', '9cae7e751345b8fb699da6074c9b6ad9|p_candidato_id,p_decision'),
  ('0018', 'política', 'public.reclutamiento_candidatos.reclutamiento_candidatos_rrhh_admin', ''),
  ('0018', 'política', 'public.reclutamiento_candidatos.reclutamiento_candidatos_solicitante_select', ''),
  ('0018', 'política', 'public.reclutamientos.reclutamientos_rrhh_admin', ''),
  ('0018', 'política', 'public.reclutamientos.reclutamientos_solicitante_select', ''),
  ('0018', 'política', 'storage.objects.storage_reclutamiento_rrhh_admin', ''),
  ('0018', 'política', 'storage.objects.storage_reclutamiento_solicitante_select', ''),
  ('0018', 'tabla', 'reclutamiento_candidatos', ''),
  ('0018', 'tabla', 'reclutamientos', ''),
  ('0020', 'función', 'actualizar_fecha_termino_por_renovacion', '168ecbce82ce5e371addf5bfc4de1b81|'),
  ('0021', 'valor enum', 'tipo_solicitud.cambio_turno', ''),
  ('0022', 'bucket', 'solicitud-adjuntos', ''),
  ('0022', 'función', 'asignar_folio_solicitud', '0af86665701da7af9bd6291315608747|'),
  ('0022', 'función', 'puede_ver_adjunto_solicitud', 'c15cf43efa688cc3888dbfb98a862ce7|p_path'),
  ('0022', 'política', 'public.aprobaciones.aprobaciones_cambio_solicitante_select', ''),
  ('0022', 'política', 'public.recordatorios_aprobacion.recordatorios_aprobacion_select', ''),
  ('0022', 'política', 'public.solicitudes.solicitudes_cambio_solicitante_select', ''),
  ('0022', 'política', 'public.solicitudes.solicitudes_rrhh_marcar_procesado', ''),
  ('0022', 'política', 'storage.objects.storage_solicitud_adjuntos_admin_delete', ''),
  ('0022', 'política', 'storage.objects.storage_solicitud_adjuntos_select', ''),
  ('0022', 'tabla', 'recordatorios_aprobacion', ''),
  ('0023', 'política', 'storage.objects.storage_solicitud_adjuntos_insert', ''),
  ('0023', 'restricción', 'perfiles.perfiles_rol_sin_supervisor', ''),
  ('0025', 'función', 'crear_solicitud_cambio', '50656af49a775628a20700af4b08a7d5|p_tipo,p_trabajador_id,p_detalle'),
  ('0026', 'función', 'validar_adjunto_solicitud', '1cdd7c6d8c41fd976c824dee7a564bf1|'),
  ('0026', 'trigger', 'public.solicitudes.trg_validar_adjunto_solicitud', ''),
  ('0027', 'función', 'alertas_vencimiento_secreto_ok', '0842def75d88e0156b7ac202c0a3989e|p_secreto'),
  ('0027', 'función', 'disparar_alertas_vencimiento', 'd1bf1043c969c6728bf50e386573634e|p_opciones'),
  ('0027', 'política', 'public.avisos_vencimiento_contrato.avisos_vencimiento_select', ''),
  ('0027', 'tabla', 'avisos_vencimiento_contrato', ''),
  ('0028', 'columna', 'perfiles.aprobacion_automatica', ''),
  ('0028', 'función', 'aprobar_solicitud_automatica', 'e6bc839610900771f137711c3a819a51|'),
  ('0028', 'función', 'omitir_etapas_aprobacion_automatica', '07f41345b26a5902ec023fb025f5518e|'),
  ('0028', 'función', 'proteger_aprobacion_automatica', '18cafe30798308d0ac622ea87fa2ef9d|'),
  ('0028', 'trigger', 'public.aprobaciones.trg_00_omitir_etapas_aprobacion_automatica', ''),
  ('0028', 'trigger', 'public.perfiles.trg_proteger_aprobacion_automatica', ''),
  ('0028', 'trigger', 'public.solicitudes.trg_aprobar_solicitud_automatica', ''),
  ('0029', 'función', 'actualizar_estado_contratacion', 'ee2913ec75158eb20f39665e1a76e981|'),
  ('0029', 'función', 'estado_contratacion_por_datos', '153bc61693074836e6d0b758d7680008|'),
  ('0029', 'función', 'recalcular_estado_contratacion', '21fbcc7571316be409471989f78ed3af|p_contratacion_id'),
  ('0029', 'trigger', 'public.contrataciones.trg_estado_contratacion_por_datos', ''),
  ('0029', 'trigger', 'public.documentos_contratacion.trg_actualizar_estado_contratacion', '');

create temp table if not exists _migs (migracion text);
truncate _migs;
insert into _migs values
  ('0001'),
  ('0002'),
  ('0003'),
  ('0004'),
  ('0005'),
  ('0006'),
  ('0007'),
  ('0008'),
  ('0009'),
  ('0010'),
  ('0011'),
  ('0012'),
  ('0013'),
  ('0014'),
  ('0015'),
  ('0016'),
  ('0017'),
  ('0018'),
  ('0019'),
  ('0020'),
  ('0021'),
  ('0022'),
  ('0023'),
  ('0024'),
  ('0025'),
  ('0026'),
  ('0027'),
  ('0028'),
  ('0029');

create temp table if not exists _rev (migracion text, tipo text, objeto text, estado text);
truncate _rev;

insert into _rev
select e.migracion, e.tipo, e.objeto,
  case e.tipo
    when 'tabla' then case when to_regclass('public.' || e.objeto) is not null then 'ok' else 'falta' end
    when 'columna' then case when exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = split_part(e.objeto, '.', 1) and c.column_name = split_part(e.objeto, '.', 2)
      ) then 'ok' else 'falta' end
    when 'valor enum' then case when exists (
        select 1 from pg_enum v join pg_type t on t.oid = v.enumtypid
        where t.typname = split_part(e.objeto, '.', 1) and v.enumlabel = substr(e.objeto, length(split_part(e.objeto, '.', 1)) + 2)
      ) then 'ok' else 'falta' end
    when 'restricción' then case when exists (
        select 1 from pg_constraint k
        where k.conrelid = to_regclass('public.' || split_part(e.objeto, '.', 1)) and k.conname = split_part(e.objeto, '.', 2)
      ) then 'ok' else 'falta' end
    when 'bucket' then case when exists (select 1 from storage.buckets b where b.id = e.objeto) then 'ok' else 'falta' end
    when 'función' then case
      when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.objeto
          and md5(btrim(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g'), ' ')) = split_part(e.extra, '|', 1)
      ) then 'ok'
      when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.objeto
      ) then 'versión anterior'
      else 'falta' end
    when 'política' then case when exists (
        select 1 from pg_policies pp
        where pp.schemaname = split_part(e.objeto, '.', 1) and pp.tablename = split_part(e.objeto, '.', 2)
          and pp.policyname = split_part(e.objeto, '.', 3)
      ) then 'ok' else 'falta' end
    when 'trigger' then case when exists (
        select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
        where not t.tgisinternal and n.nspname = split_part(e.objeto, '.', 1) and c.relname = split_part(e.objeto, '.', 2)
          and t.tgname = split_part(e.objeto, '.', 3)
      ) then 'ok' else 'falta' end
  end
from _esp e;

-- 0024: ninguna restricción CHECK de solicitudes por tipo sin ajustar
insert into _rev
select '0024', 'restricción', 'solicitudes: reglas por tipo ajustadas para los tipos de cambio',
  case when exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.solicitudes'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* '\mtipo\M'
      and pg_get_constraintdef(c.oid) ~* '(centro_destino_id|centro_origen_id|trabajador_id)'
      and coalesce(obj_description(c.oid, 'pg_constraint'), '') not like 'ajustada 0024%'
  ) then 'falta' else 'ok' end;

-- 0027: el trabajo diario en pg_cron y la clave en Vault (con SQL dinámico:
-- si pg_cron no está instalado, cron.job no existe y no debe romper la revisión)
do $$
declare v_cron boolean := false; v_clave boolean := false;
begin
  if to_regclass('cron.job') is not null then
    execute $q$select exists (select 1 from cron.job where jobname = 'alertas-vencimiento-contrato' and active)$q$ into v_cron;
  end if;
  if to_regclass('vault.secrets') is not null then
    execute $q$select exists (select 1 from vault.secrets where name = 'alertas_vencimiento_secreto')$q$ into v_clave;
  end if;
  insert into _rev values ('0027', 'cron', 'alertas-vencimiento-contrato (pg_cron)', case when v_cron then 'ok' else 'falta' end);
  insert into _rev values ('0027', 'clave', 'alertas_vencimiento_secreto (Vault)', case when v_clave then 'ok' else 'falta' end);
end $$;

-- Resultado
with por_mig as (
  select m.migracion,
         count(r.migracion) as total,
         count(*) filter (where r.estado = 'falta') as faltan,
         count(*) filter (where r.estado = 'versión anterior') as viejas,
         string_agg(case when r.estado <> 'ok' then r.tipo || ' ' || r.objeto || case when r.estado = 'versión anterior' then ' (versión anterior)' else '' end end, '; ' order by r.tipo, r.objeto) as detalle
  from _migs m
  left join _rev r on r.migracion = m.migracion
  group by m.migracion
),
migraciones as (
  select 1 as grupo, 'Migración ' || migracion as script,
         case when total = 0 then 'SIN REVISIÓN'
              when faltan > 0 then 'FALTA CORRER'
              when viejas > 0 then 'VERSIÓN ANTERIOR'
              else 'OK' end as estado,
         case when total = 0 then 'no crea objetos comprobables'
              when faltan + viejas = 0 then total || ' objeto(s) revisado(s)'
              else left(detalle, 400) end as detalle
  from por_mig
),
scripts as (
  -- 05: cuentas de prueba borradas y nombre corregido
  select 2 as grupo, 'Script 05 (usuarios de prueba)' as script,
    case when not exists (select 1 from public.perfiles where lower(email) in ('srhernandez.castillo@gmail.com', 'maxi.her0.115@gmail.com', 'mercaditoferiano@metalium.cl'))
              and exists (select 1 from public.perfiles where lower(email) = 'mhernandez@metalium.cl' and nombre = U&'Maximiliano Hern\00E1ndez')
         then 'OK' else 'FALTA CORRER' end as estado,
    (select count(*) from public.perfiles where lower(email) in ('srhernandez.castillo@gmail.com', 'maxi.her0.115@gmail.com', 'mercaditoferiano@metalium.cl'))
      || ' cuenta(s) de prueba quedan; nombre de mhernandez: '
      || coalesce((select nombre from public.perfiles where lower(email) = 'mhernandez@metalium.cl'), 'no existe') as detalle
  union all
  -- 06: centros y cargos de la Lista de empleados
  select 2, 'Script 06 (centros de costo y cargos)',
    case when (select count(distinct codigo::text) from public.centros_costo where codigo::text in ('1', '2', '3', '4', '5', '6', '7', '8', '10', '14', '16', '17', '19', '24', '25', '28', '29', '30', '31', '32', '33')) = 21
              and (select count(distinct lower(trim(nombre))) from public.cargos where lower(trim(nombre)) in ('administrador de obras', 'administradora general', 'albañil', 'analista de compras', 'analista de remuneraciones', 'analista de rr.hh.', 'analista ti', 'arquitecto modelador', 'asesor en prevención de riesgos', 'asesora del hogar', 'asistente de gerencia', 'asistente rr.hh.', 'ayudante', 'ayudante de construcción', 'ayudante de estructuras', 'bodeguero', 'capataz de obra', 'carpintero', 'chofer logístico', 'coordinador bim', 'coordinador de operaciones', 'ejecutiva comercial', 'encargado de administración', 'encargado de bodega y activos', 'encargado de contabilidad', 'encargado de facturación y administración', 'enfierrador', 'gerente de finanzas corporativas', 'gerente de operaciones', 'gerente de operaciones logísticas', 'gerente de rrhh', 'gerente general', 'gerente sst', 'ingeniero ambiental', 'ingeniero de calidad', 'ingeniero oficina técnica', 'instalador sanitario', 'jefe de desarrollo estratégico', 'jefe de finanzas corporativas', 'jefe de licitaciones', 'jefe de oficina técnica', 'jefe de recursos humanos', 'jefe de taller', 'jefe de terreno / coordinador civil de terreno', 'jefe de tesorería', 'jornal', 'maestro albañil', 'maestro carpintero', 'maestro de estructuras', 'maestro electricista', 'maestro estructura metálica', 'maestro gasfiter', 'maestro montaje', 'maestro pintor', 'maestro soldador', 'modelador / proyectista', 'montador', 'operador de maquinaria', 'operador de máquina', 'paramédico', 'planificadora de obras', 'servicios generales', 'soldador', 'soldador - armador', 'supervisor', 'topógrafo', 'trazador')) = 67
         then 'OK' else 'FALTA CORRER' end,
    (select count(distinct codigo::text) from public.centros_costo where codigo::text in ('1', '2', '3', '4', '5', '6', '7', '8', '10', '14', '16', '17', '19', '24', '25', '28', '29', '30', '31', '32', '33')) || ' de 21 centros y '
      || (select count(distinct lower(trim(nombre))) from public.cargos where lower(trim(nombre)) in ('administrador de obras', 'administradora general', 'albañil', 'analista de compras', 'analista de remuneraciones', 'analista de rr.hh.', 'analista ti', 'arquitecto modelador', 'asesor en prevención de riesgos', 'asesora del hogar', 'asistente de gerencia', 'asistente rr.hh.', 'ayudante', 'ayudante de construcción', 'ayudante de estructuras', 'bodeguero', 'capataz de obra', 'carpintero', 'chofer logístico', 'coordinador bim', 'coordinador de operaciones', 'ejecutiva comercial', 'encargado de administración', 'encargado de bodega y activos', 'encargado de contabilidad', 'encargado de facturación y administración', 'enfierrador', 'gerente de finanzas corporativas', 'gerente de operaciones', 'gerente de operaciones logísticas', 'gerente de rrhh', 'gerente general', 'gerente sst', 'ingeniero ambiental', 'ingeniero de calidad', 'ingeniero oficina técnica', 'instalador sanitario', 'jefe de desarrollo estratégico', 'jefe de finanzas corporativas', 'jefe de licitaciones', 'jefe de oficina técnica', 'jefe de recursos humanos', 'jefe de taller', 'jefe de terreno / coordinador civil de terreno', 'jefe de tesorería', 'jornal', 'maestro albañil', 'maestro carpintero', 'maestro de estructuras', 'maestro electricista', 'maestro estructura metálica', 'maestro gasfiter', 'maestro montaje', 'maestro pintor', 'maestro soldador', 'modelador / proyectista', 'montador', 'operador de maquinaria', 'operador de máquina', 'paramédico', 'planificadora de obras', 'servicios generales', 'soldador', 'soldador - armador', 'supervisor', 'topógrafo', 'trazador')) || ' de 67 cargos'
  union all
  -- 09: los 3 cambios de cargo
  select 2, 'Script 09 (3 cambios de cargo)',
    case when (select count(*) from public.solicitudes where tipo::text = 'cambio_cargo' and detalle ->> 'fecha_efectiva' = '2026-11-10'
                 and detalle ->> 'motivo' = 'El anexo de contrato se hace a partir del 03/11/2026.') >= 3 then 'OK' else 'FALTA CORRER' end,
    (select count(*) from public.solicitudes where tipo::text = 'cambio_cargo' and detalle ->> 'fecha_efectiva' = '2026-11-10'
       and detalle ->> 'motivo' = 'El anexo de contrato se hace a partir del 03/11/2026.') || ' de 3 creadas'
  union all
  -- 10: aprobadas
  select 2, 'Script 10 (aprobar los 3 cambios de cargo)',
    case when (select count(*) from public.solicitudes where tipo::text = 'cambio_cargo' and detalle ->> 'fecha_efectiva' = '2026-11-10'
                 and detalle ->> 'motivo' = 'El anexo de contrato se hace a partir del 03/11/2026.' and estado::text = 'aprobada') >= 3 then 'OK' else 'FALTA CORRER' end,
    (select count(*) from public.solicitudes where tipo::text = 'cambio_cargo' and detalle ->> 'fecha_efectiva' = '2026-11-10'
       and detalle ->> 'motivo' = 'El anexo de contrato se hace a partir del 03/11/2026.' and estado::text = 'aprobada') || ' de 3 aprobadas'
  union all
  -- 12 y 13: solicitudes puntuales aprobadas
  select 2, 'Script 12 (aprobar SSI-RRHH-2026-0001)',
    case coalesce((select estado::text from public.solicitudes where upper(codigo) = 'SSI-RRHH-2026-0001'), '')
      when 'aprobada' then 'OK' when '' then 'REVISAR' else 'FALTA CORRER' end,
    'estado actual: ' || coalesce((select estado::text from public.solicitudes where upper(codigo) = 'SSI-RRHH-2026-0001'), 'no existe la solicitud')
  union all
  select 2, 'Script 13 (aprobar SSI-RRHH-2026-0011)',
    case coalesce((select estado::text from public.solicitudes where upper(codigo) = 'SSI-RRHH-2026-0011'), '')
      when 'aprobada' then 'OK' when '' then 'REVISAR' else 'FALTA CORRER' end,
    'estado actual: ' || coalesce((select estado::text from public.solicitudes where upper(codigo) = 'SSI-RRHH-2026-0011'), 'no existe la solicitud')
  union all
  -- 11: trabajadores sin obra
  select 2, 'Script 11 (obra de los trabajadores)',
    case when (select count(*) from public.trabajadores where coalesce(activo, true) and centro_costo_id is null) = 0 then 'OK' else 'FALTA CORRER' end,
    (select count(*) from public.trabajadores where coalesce(activo, true) and centro_costo_id is null) || ' trabajador(es) activo(s) sin obra'
  union all
  -- Configuración: obras sin administrador de obra (se arregla en la app, Centros de costo)
  select 3, 'Configuración: obras sin administrador de obra',
    case when exists (select 1 from public.centros_costo where coalesce(activo, true) and admin_obra_id is null) then 'REVISAR' else 'OK' end,
    coalesce((select string_agg(codigo::text, ', ' order by codigo::text) from public.centros_costo where coalesce(activo, true) and admin_obra_id is null), 'todas tienen')
)
select script, estado, detalle
from (select * from migraciones union all select * from scripts) x
order by grupo, script;
