-- =====================================================================
-- 0024_tipos_cambio_sin_destino.sql   (nov. 2026)
--
-- Error al crear un Cambio de cargo (y cualquier tipo distinto de Ingreso o
-- Traslado):
--   new row for relation "solicitudes" violates check constraint
--   "chk_destino_por_tipo"
--
-- Esa restricción viene del esquema base (no está en estas migraciones) y
-- se escribió cuando solo existían Ingreso y Traslado: exige una forma de
-- centro de destino que los tipos "de cambio" (aumento de sueldo, cambio de
-- cargo, cambio de turno, renovación, desvinculación) no cumplen, porque no
-- tienen obra de destino.
--
-- Qué hace, sin tocar la regla original para Ingreso y Traslado: toma cada
-- restricción CHECK de solicitudes que depende del tipo y de los centros o
-- el trabajador, y la reemplaza por
--      (tipo de cambio Y sin centro de destino)  O  (la regla original)
-- Así Ingreso y Traslado siguen exactamente igual y los demás tipos pasan
-- siempre que no traigan centro de destino (crear_solicitud_cambio() nunca
-- lo pone).
--
-- Muestra (AVISO) cada restricción antes y después. Se puede correr más de
-- una vez: las que ya ajustó quedan marcadas y no se vuelven a tocar.
--
--   node supabase\mantencion\sql.mjs supabase\migrations\0024_tipos_cambio_sin_destino.sql --aplicar --guardar
-- =====================================================================

do $$
declare
  r record;
  v_expr text;
  v_nueva text;
  v_n int := 0;
begin
  for r in
    select c.oid, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.conrelid = 'public.solicitudes'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* '\mtipo\M'
      and pg_get_constraintdef(c.oid) ~* '(centro_destino_id|centro_origen_id|trabajador_id)'
      and coalesce(obj_description(c.oid, 'pg_constraint'), '') not like 'ajustada 0024%'
    order by c.conname
  loop
    v_expr := substring(r.def from '^CHECK \((.*)\)( NOT VALID)?$');
    if v_expr is null then
      raise exception 'No se pudo leer la restricción % (%).', r.conname, r.def;
    end if;

    raise notice 'Restricción % ANTES: %', r.conname, r.def;

    execute format('alter table public.solicitudes drop constraint %I', r.conname);
    execute format(
      'alter table public.solicitudes add constraint %I check (((tipo)::text not in (''ingreso'', ''traslado'') and centro_destino_id is null) or (%s))',
      r.conname, v_expr);
    execute format('comment on constraint %I on public.solicitudes is %L', r.conname,
      'ajustada 0024: los tipos de cambio (sin centro de destino) pasan; Ingreso y Traslado siguen con la regla original');

    select pg_get_constraintdef(c.oid) into v_nueva
    from pg_constraint c where c.conrelid = 'public.solicitudes'::regclass and c.conname = r.conname;
    raise notice 'Restricción % DESPUÉS: %', r.conname, v_nueva;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise notice 'No había restricciones por ajustar (ya estaban ajustadas o no existen).';
  else
    raise notice 'Restricciones ajustadas: %', v_n;
  end if;
end $$;

-- Resultado: restricciones CHECK de solicitudes como quedan
select c.conname as restriccion,
       case when coalesce(obj_description(c.oid, 'pg_constraint'), '') like 'ajustada 0024%' then 'ajustada (0024)' else 'sin cambios' end as estado
from pg_constraint c
where c.conrelid = 'public.solicitudes'::regclass and c.contype = 'c'
order by 1;
