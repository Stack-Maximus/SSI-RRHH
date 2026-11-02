-- =====================================================================
-- 02_vaciar_todo_menos_usuarios.sql   (nov. 2026, a pedido)
--
--   DEJA EL SISTEMA EN BLANCO, SALVO LOS USUARIOS.  NO SE PUEDE DESHACER.
--
-- Antes de correrlo:
--   1. Respalda: en la app, Solicitudes -> "Exportar maestro (Excel)" y
--      Trabajadores -> "Descargar maestro (Excel)". Si tu plan de Supabase
--      tiene backups, revisa en Database -> Backups que haya uno reciente.
--   2. Corre 01_diagnostico_vaciado.sql y revisa que ninguna fila diga
--      "⚠ BLOQUEA".
--   3. SQL Editor: cambia 'NO' por 'VACIAR' en la línea de confirmación de
--      abajo. Desde CMD con sql.mjs no hace falta tocar el archivo: sin
--      --aplicar muestra lo que borraría y no guarda nada; con --aplicar borra.
--
-- Qué borra (todo o nada: si algo falla, no se borra NADA):
--   - Solicitudes de todos los tipos (pendientes e historial) y sus
--     aprobaciones con los tiempos.
--   - Todo lo que cuelga de ellas: documentos de traslado, contrataciones y
--     homologación SST (documentos y rechazos), reclutamientos y candidatos,
--     y los recordatorios a aprobadores.
--   - El maestro de trabajadores completo (para volver a importarlo).
--   - Los centros de costo (con sus administradores de obra y prevencionistas
--     asignados) y la lista de cargos.
--
-- Qué NO toca: los usuarios (cuentas, perfiles y roles; a quien tenía un
-- centro de costo asignado se le deja en blanco, hay que volver a asignarlo
-- en Usuarios), el checklist de documentos y nada de otros módulos.
-- Los archivos subidos (PDF, imágenes, CV, cartas de renuncia) se vacían
-- aparte, desde el Dashboard -> Storage. La numeración (folios) se reinicia
-- con 03_reiniciar_numeracion.sql.
--
-- Después: crear los centros de costo (y asignar administrador de obra y
-- prevencionista a cada uno), los cargos, el centro de cada usuario, e
-- importar la dotación en Trabajadores.
-- =====================================================================

select set_config('vaciado.confirmacion', 'NO', false);   -- <<< cambia 'NO' por 'VACIAR'

create temp table if not exists _vaciado (orden int, tabla text, filas_borradas bigint);
truncate _vaciado;

do $$
declare
  -- orden: primero lo que depende de otra tabla; centros y cargos al final
  v_tablas text[] := array[
    'public.recordatorios_aprobacion',
    'public.reclutamiento_candidatos',
    'public.reclutamientos',
    'public.homologacion_rechazo_documentos',
    'public.homologacion_rechazos',
    'public.documentos_contratacion',
    'public.contrataciones',
    'public.documentos_traslado',
    'public.aprobaciones',
    'public.solicitudes',
    'public.trabajadores',
    'public.centros_costo',
    'public.cargos'
  ];
  v_tabla text;
  v_filas bigint;
  v_orden int := 0;
begin
  -- Confirmación: 'VACIAR' arriba, o correrlo con sql.mjs (revisión / --aplicar)
  if coalesce(current_setting('vaciado.confirmacion', true), '') <> 'VACIAR'
     and coalesce(current_setting('mantencion.runner', true), '') <> 'sql.mjs' then
    raise exception 'No se borró nada: falta confirmar. Cambia ''NO'' por ''VACIAR'' en la línea de confirmación y vuelve a correrlo.';
  end if;

  foreach v_tabla in array v_tablas loop
    v_orden := v_orden + 1;
    if to_regclass(v_tabla) is null then
      insert into _vaciado values (v_orden * 10, v_tabla, null);   -- no existe en esta base: se omite
      continue;
    end if;

    -- Antes de borrar los centros: los usuarios se mantienen, pero sin centro.
    if v_tabla = 'public.centros_costo' and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'perfiles' and column_name = 'centro_costo_id'
    ) then
      update public.perfiles set centro_costo_id = null where centro_costo_id is not null;
      get diagnostics v_filas = row_count;
      insert into _vaciado values (v_orden * 10 - 5, 'public.perfiles (centro de costo en blanco)', v_filas);
    end if;

    execute format('delete from %s', v_tabla);
    get diagnostics v_filas = row_count;
    insert into _vaciado values (v_orden * 10, v_tabla, v_filas);
  end loop;
end $$;

-- Resultado: lo borrado y lo que queda (la columna "quedan" debe ser 0, salvo perfiles)
select v.tabla,
       coalesce(v.filas_borradas::text, 'no existe') as filas_afectadas,
       case when v.tabla like 'public.perfiles%' then (select count(*) from public.perfiles)::text || ' usuario(s), intactos'
            when to_regclass(v.tabla) is null then '-'
            else (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %s', v.tabla), false, true, '')))[1]::text
       end as quedan
from _vaciado v
order by v.orden;
