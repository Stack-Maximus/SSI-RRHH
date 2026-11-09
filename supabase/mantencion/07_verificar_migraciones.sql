-- =====================================================================
-- 07_verificar_migraciones.sql   (nov. 2026)
--
-- SOLO LECTURA: revisa, migración por migración (0001 a 0023), que estén en
-- la base las funciones, tablas, columnas y valores de enum que cada una
-- crea. Sirve para saber cuáles migraciones faltan por correr.
--
--   node supabase\mantencion\sql.mjs supabase\mantencion\07_verificar_migraciones.sql
--
-- Resultado 1: resumen por migración (OK / FALTAN n).
-- Resultado 2: el detalle de lo que falta.
-- Las funciones se revisan con los nombres de parámetros de su última
-- versión: si existe con otros parámetros, aparece como "otra firma".
-- (Generado a partir de supabase/migrations; no revisa políticas RLS,
-- triggers ni el contenido de las funciones. 0003, 0004, 0007 y 0019 no
-- aparecen: solo cambian datos/políticas o funciones que una migración
-- posterior vuelve a definir, y esa es la que se revisa.)
-- =====================================================================

create temp table if not exists _esperado (migracion text, tipo text, objeto text, args text);
truncate _esperado;
insert into _esperado (migracion, tipo, objeto, args) values
  ('0001', 'valor enum', 'user_role.prevencionista', ''),
  ('0002', 'función', 'actualizar_estado_contratacion', ''),
  ('0002', 'función', 'rol_actual', ''),
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
  ('0009', 'columna', 'centros_costo.prevencionista_id', ''),
  ('0010', 'columna', 'solicitudes.folio', ''),
  ('0010', 'tabla', 'folios_correlativos', ''),
  ('0011', 'columna', 'contrataciones.homologacion_aprobada_at', ''),
  ('0011', 'columna', 'contrataciones.homologacion_aprobada_por', ''),
  ('0012', 'columna', 'solicitudes.homologacion_traslado_aprobada_at', ''),
  ('0012', 'columna', 'solicitudes.homologacion_traslado_aprobada_por', ''),
  ('0012', 'columna', 'solicitudes.procesado_rrhh_at', ''),
  ('0012', 'columna', 'solicitudes.procesado_rrhh_por', ''),
  ('0012', 'tabla', 'documentos_traslado', ''),
  ('0013', 'columna', 'trabajadores.requiere_anexo_renovacion', ''),
  ('0013', 'columna', 'trabajadores.tipo_contrato', ''),
  ('0013', 'función', 'apagar_requiere_anexo_por_renovacion', ''),
  ('0013', 'función', 'bloquear_traslado_obra_o_faena', ''),
  ('0013', 'función', 'marcar_requiere_anexo_renovacion', ''),
  ('0013', 'valor enum', 'tipo_solicitud.desvinculacion', ''),
  ('0014', 'función', 'desactivar_trabajador_por_desvinculacion', ''),
  ('0015', 'columna', 'contrataciones.apellido_materno_candidato', ''),
  ('0015', 'columna', 'contrataciones.apellido_paterno_candidato', ''),
  ('0015', 'columna', 'contrataciones.nombres_candidato', ''),
  ('0015', 'columna', 'trabajadores.apellido_materno', ''),
  ('0015', 'columna', 'trabajadores.apellido_paterno', ''),
  ('0015', 'columna', 'trabajadores.nombres', ''),
  ('0015', 'función', 'armar_nombre_candidato', ''),
  ('0015', 'función', 'armar_nombre_trabajador', ''),
  ('0016', 'columna', 'perfiles.es_gerente_prevencion', ''),
  ('0016', 'tabla', 'homologacion_rechazo_documentos', ''),
  ('0016', 'tabla', 'homologacion_rechazos', ''),
  ('0017', 'función', 'editar_solicitud', 'p_solicitud_id,p_motivo,p_detalle'),
  ('0018', 'función', 'reclutamiento_agregar_candidatos', 'p_reclutamiento_id,p_candidatos'),
  ('0018', 'función', 'reclutamiento_decidir_candidato', 'p_candidato_id,p_decision'),
  ('0018', 'tabla', 'reclutamiento_candidatos', ''),
  ('0018', 'tabla', 'reclutamientos', ''),
  ('0020', 'función', 'actualizar_fecha_termino_por_renovacion', ''),
  ('0021', 'valor enum', 'tipo_solicitud.cambio_turno', ''),
  ('0022', 'función', 'asignar_folio_solicitud', ''),
  ('0022', 'función', 'puede_ver_adjunto_solicitud', 'p_path'),
  ('0022', 'función', 'validar_adjunto_solicitud', ''),
  ('0022', 'tabla', 'recordatorios_aprobacion', ''),
  ('0023', 'función', 'crear_solicitud_cambio', 'p_tipo,p_trabajador_id,p_detalle');

create temp table if not exists _revision (migracion text, tipo text, objeto text, estado text);
truncate _revision;
insert into _revision
select e.migracion, e.tipo, e.objeto,
  case e.tipo
    when 'tabla' then case when to_regclass('public.' || e.objeto) is not null then 'ok' else 'FALTA' end
    when 'columna' then case when exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = split_part(e.objeto, '.', 1) and c.column_name = split_part(e.objeto, '.', 2)
      ) then 'ok' else 'FALTA' end
    when 'valor enum' then case when exists (
        select 1 from pg_enum v join pg_type t on t.oid = v.enumtypid
        where t.typname = split_part(e.objeto, '.', 1) and v.enumlabel = substr(e.objeto, length(split_part(e.objeto, '.', 1)) + 2)
      ) then 'ok' else 'FALTA' end
    when 'función' then case
      when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.objeto
          and coalesce(p.proargnames, '{}'::text[]) @> coalesce(nullif(string_to_array(e.args, ','), '{}'), '{}'::text[])
      ) then 'ok'
      when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.objeto
      ) then 'otra firma: ' || (
        select string_agg(p.oid::regprocedure::text, ' | ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.objeto)
      else 'FALTA' end
  end
from _esperado e;

-- Resultado 1: resumen por migración
select migracion,
       count(*) as objetos,
       case when count(*) filter (where estado <> 'ok') = 0 then 'OK'
            else 'FALTAN ' || count(*) filter (where estado <> 'ok') end as estado
from _revision
group by migracion
order by migracion;

-- Resultado 2: detalle de lo que falta
select migracion, tipo, objeto, estado
from _revision
where estado <> 'ok'
order by migracion, tipo, objeto;
