-- =====================================================================
-- 01_diagnostico_vaciado.sql  ·  SOLO LECTURA: no borra ni cambia nada.
--
-- Córrelo ANTES de 02_vaciar_solicitudes_y_trabajadores.sql (SQL Editor de
-- Supabase, todo de una vez). Devuelve una sola tabla con:
--   1. Cuántas filas hay en cada tabla que se va a vaciar.
--   2. Toda tabla de la base que apunta a esas tablas, y qué le pasa a ella
--      al vaciarlas. Si alguna dice "⚠ BLOQUEA", NO corras el 02 y avísame:
--      es una tabla que no conozco (de otro módulo) y el vaciado fallaría.
--   3. Triggers que se ejecutan al borrar (solo para tener el panorama).
--   4. Archivos subidos en Storage (se vacían aparte, desde el Dashboard).
--   5. La numeración actual (folios y N° de solicitud).
-- =====================================================================

with tablas (orden, tabla) as (
  values
    (1,  'public.solicitudes'),
    (2,  'public.aprobaciones'),
    (3,  'public.documentos_traslado'),
    (4,  'public.contrataciones'),
    (5,  'public.documentos_contratacion'),
    (6,  'public.homologacion_rechazos'),
    (7,  'public.homologacion_rechazo_documentos'),
    (8,  'public.reclutamientos'),
    (9,  'public.reclutamiento_candidatos'),
    (10, 'public.trabajadores')
),
existentes as (
  select orden, tabla, to_regclass(tabla) as rel from tablas where to_regclass(tabla) is not null
),
conteos as (
  select '1. Filas que se borran' as seccion, t.orden, t.tabla as objeto,
    case when to_regclass(t.tabla) is null then 'la tabla no existe en esta base (se omite)'
         else (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %s', t.tabla), false, true, '')))[1]::text || ' fila(s)'
    end as detalle
  from tablas t
),
fks as (
  select '2. Tablas que apuntan a lo que se borra' as seccion, 100 as orden,
    format('%s.%s  →  %s', c.conrelid::regclass, a.attname, c.confrelid::regclass) as objeto,
    case
      when c.conrelid in (select rel from existentes) then 'OK: el script 02 también la vacía'
      when c.confdeltype = 'c' then 'OK: sus filas se borran solas (ON DELETE CASCADE)'
      when c.confdeltype = 'n' then 'OK: el dato queda en blanco (ON DELETE SET NULL)'
      when c.confdeltype = 'd' then 'OK: el dato vuelve a su valor por defecto'
      else '⚠ BLOQUEA el vaciado: ' ||
        (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %s where %I is not null', c.conrelid::regclass, a.attname), false, true, '')))[1]::text ||
        ' fila(s) con dato. No sigas y avísame.'
    end as detalle
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f'
    and c.confrelid in (select rel from existentes)
),
triggers_borrado as (
  select '3. Triggers que corren al borrar' as seccion, 200 as orden,
    format('%s: %s', t.tgrelid::regclass, t.tgname) as objeto,
    'ejecuta ' || p.proname || '()' as detalle
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and (t.tgtype & 8) <> 0          -- 8 = DELETE
    and t.tgrelid in (select rel from existentes)
),
archivos as (
  select '4. Archivos en Storage (vaciar desde el Dashboard)' as seccion, 300 as orden,
    b.id as objeto, count(o.id)::text || ' archivo(s)' as detalle
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  where b.id in ('traslado-documentos', 'contratacion-documentos', 'reclutamiento-cv')
  group by b.id
),
folios as (
  select '5. Numeración actual' as seccion, 400 as orden,
    'folio ' || f.tipo as objeto, 'próximo número: ' || f.siguiente as detalle
  from public.folios_correlativos f
),
secuencias as (
  select '5. Numeración actual' as seccion, 410 as orden,
    'secuencia ' || s.seq::regclass::text as objeto,
    coalesce('último número usado: ' || pg_sequence_last_value(s.seq::regclass), 'próximo número: 1') as detalle
  from (
    -- secuencias que usan los triggers de solicitudes (ej. el que arma el N° de solicitud)
    select (regexp_matches(pg_get_functiondef(t.tgfoid), 'nextval\(\s*''([^'']+)''', 'g'))[1] as seq
    from pg_trigger t
    where t.tgrelid = 'public.solicitudes'::regclass and not t.tgisinternal
    union
    -- ... o los valores por defecto de sus columnas
    select (regexp_matches(pg_get_expr(d.adbin, d.adrelid), 'nextval\(\s*''([^'']+)''', 'g'))[1]
    from pg_attrdef d
    where d.adrelid = 'public.solicitudes'::regclass
    union
    -- ... o una columna serial / identity
    select s.oid::regclass::text
    from pg_depend dep
    join pg_class s on s.oid = dep.objid and s.relkind = 'S'
    where dep.refobjid = 'public.solicitudes'::regclass and dep.deptype in ('a', 'i')
  ) s
)
select seccion, objeto, detalle
from (
  select * from conteos
  union all select * from fks
  union all select * from triggers_borrado
  union all select * from archivos
  union all select * from folios
  union all select * from secuencias
) x
order by seccion, orden, objeto;
