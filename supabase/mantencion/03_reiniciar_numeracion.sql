-- =====================================================================
-- 03_reiniciar_numeracion.sql  ·  OPCIONAL
--
-- Hace que la numeración vuelva a partir de 1: los folios de los
-- comprobantes (RRH-ING-000001, RRH-TRA-000001, ...) y el N° de solicitud.
-- Solo funciona con la tabla de solicitudes vacía (después del 02).
--
-- OJO con el Sistema de Gestión: si ya se imprimieron, enviaron o archivaron
-- comprobantes con folio, al reiniciar se repetirían (habría dos
-- RRH-TRA-000001 distintos). En ese caso NO lo corras: la numeración sigue
-- desde donde iba y no pasa nada. Córrelo solo si lo que borraste eran
-- datos de prueba.
-- =====================================================================

do $$
declare
  r record;
begin
  if exists (select 1 from public.solicitudes) then
    raise exception 'No se cambió nada: todavía hay solicitudes. Corre primero 02_vaciar_solicitudes_y_trabajadores.sql.';
  end if;

  -- folios por tipo de solicitud
  update public.folios_correlativos set siguiente = 1;

  -- secuencias del N° de solicitud (las que usan los triggers, los valores por
  -- defecto o una columna serial de la tabla solicitudes)
  for r in
    select distinct seq::regclass as seq from (
      select (regexp_matches(pg_get_functiondef(t.tgfoid), 'nextval\(\s*''([^'']+)''', 'g'))[1] as seq
      from pg_trigger t
      where t.tgrelid = 'public.solicitudes'::regclass and not t.tgisinternal
      union
      select (regexp_matches(pg_get_expr(d.adbin, d.adrelid), 'nextval\(\s*''([^'']+)''', 'g'))[1]
      from pg_attrdef d
      where d.adrelid = 'public.solicitudes'::regclass
      union
      select s.oid::regclass::text
      from pg_depend dep
      join pg_class s on s.oid = dep.objid and s.relkind = 'S'
      where dep.refobjid = 'public.solicitudes'::regclass and dep.deptype in ('a', 'i')
    ) x
  loop
    perform setval(r.seq, 1, false);   -- el próximo valor será 1
  end loop;
end $$;

-- Resultado: numeración después del reinicio
select 'folio ' || tipo as numeracion, siguiente::text as proximo_numero
from public.folios_correlativos
union all
select 'secuencia ' || seq::regclass::text,
       coalesce((pg_sequence_last_value(seq::regclass) + 1)::text, '1')
from (
  select (regexp_matches(pg_get_functiondef(t.tgfoid), 'nextval\(\s*''([^'']+)''', 'g'))[1] as seq
  from pg_trigger t
  where t.tgrelid = 'public.solicitudes'::regclass and not t.tgisinternal
  union
  select (regexp_matches(pg_get_expr(d.adbin, d.adrelid), 'nextval\(\s*''([^'']+)''', 'g'))[1]
  from pg_attrdef d
  where d.adrelid = 'public.solicitudes'::regclass
  union
  select s.oid::regclass::text
  from pg_depend dep
  join pg_class s on s.oid = dep.objid and s.relkind = 'S'
  where dep.refobjid = 'public.solicitudes'::regclass and dep.deptype in ('a', 'i')
) s
order by 1;
