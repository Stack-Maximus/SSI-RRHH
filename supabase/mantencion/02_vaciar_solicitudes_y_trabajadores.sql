-- =====================================================================
-- 02_vaciar_solicitudes_y_trabajadores.sql
--
--   BORRA TODAS LAS SOLICITUDES Y TODOS LOS TRABAJADORES.
--   NO SE PUEDE DESHACER.
--
-- Antes de correrlo:
--   1. Respalda: en la app, Solicitudes -> "Exportar maestro (Excel)" y
--      Trabajadores -> "Descargar maestro (Excel)" (este último se puede
--      volver a importar tal cual). Si tu plan de Supabase tiene backups,
--      revisa en Database -> Backups que haya uno reciente.
--   2. Corre 01_diagnostico_vaciado.sql y revisa que ninguna fila diga
--      "⚠ BLOQUEA".
--   3. Cambia 'NO' por 'VACIAR' en la línea de confirmación de abajo.
--
-- Qué borra (todo o nada: si algo falla, no se borra NADA):
--   - Solicitudes de los 7 tipos y sus aprobaciones (con los tiempos).
--   - Lo que cuelga de cada solicitud: documentos de traslado, contrataciones
--     y homologación SST (con sus documentos y rechazos), reclutamientos y
--     sus candidatos. No pueden quedar sin su solicitud.
--   - El maestro de trabajadores completo.
--
-- Qué NO toca: usuarios, perfiles y roles, centros de costo, cargos, turnos,
-- checklist de documentos, notificaciones, ni nada de los otros módulos.
-- Los archivos subidos (PDF, imágenes, CV) se vacían aparte, desde el
-- Dashboard (Storage). La numeración (folios) sigue desde donde iba, salvo
-- que corras 03_reiniciar_numeracion.sql.
-- =====================================================================

select set_config('vaciado.confirmacion', 'NO', false);   -- <<< cambia 'NO' por 'VACIAR'

create temp table if not exists _vaciado (orden int, tabla text, filas_borradas bigint);
truncate _vaciado;

do $$
declare
  -- orden: primero lo que depende de otra tabla, al final solicitudes y trabajadores
  v_tablas text[] := array[
    'public.reclutamiento_candidatos',
    'public.reclutamientos',
    'public.homologacion_rechazo_documentos',
    'public.homologacion_rechazos',
    'public.documentos_contratacion',
    'public.contrataciones',
    'public.documentos_traslado',
    'public.aprobaciones',
    'public.solicitudes',
    'public.trabajadores'
  ];
  v_tabla text;
  v_filas bigint;
  v_orden int := 0;
begin
  if coalesce(current_setting('vaciado.confirmacion', true), '') <> 'VACIAR' then
    raise exception 'No se borró nada: falta confirmar. Cambia ''NO'' por ''VACIAR'' en la línea de confirmación y vuelve a correrlo.';
  end if;

  foreach v_tabla in array v_tablas loop
    v_orden := v_orden + 1;
    if to_regclass(v_tabla) is null then
      insert into _vaciado values (v_orden, v_tabla, null);   -- no existe en esta base: se omite
      continue;
    end if;
    execute format('delete from %s', v_tabla);
    get diagnostics v_filas = row_count;
    insert into _vaciado values (v_orden, v_tabla, v_filas);
  end loop;
end $$;

-- Resultado: lo borrado y lo que queda (la columna "quedan" debe ser 0 en todas)
select v.tabla,
       coalesce(v.filas_borradas::text, 'no existe') as filas_borradas,
       case when to_regclass(v.tabla) is null then '-'
            else (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %s', v.tabla), false, true, '')))[1]::text
       end as quedan
from _vaciado v
order by v.orden;
