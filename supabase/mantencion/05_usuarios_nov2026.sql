-- =====================================================================
-- 05_usuarios_nov2026.sql   (nov. 2026, a pedido)
--
-- 1. Elimina 3 cuentas de prueba:
--      srhernandez.castillo@gmail.com
--      maxi.her0.115@gmail.com
--      mercaditoferiano@metalium.cl
-- 2. Cambia el nombre de mhernandez@metalium.cl a "Maximiliano Hernández".
--
-- Cómo correrlo desde CMD (en la carpeta del proyecto, con Node):
--   node supabase\mantencion\sql.mjs supabase\mantencion\05_usuarios_nov2026.sql
--       -> REVISIÓN: hace los cambios, muestra cómo quedaría y los DESHACE.
--   node supabase\mantencion\sql.mjs supabase\mantencion\05_usuarios_nov2026.sql --aplicar
--       -> los GUARDA.
-- (En el SQL Editor de Supabase también funciona, pero ahí se guarda de
-- inmediato: no hay modo revisión.)
--
-- Todo o nada: no borra ninguna cuenta si alguna todavía aparece en otra
-- tabla (solicitudes, centros de costo, etc.) -> en ese caso corre antes
-- 02_vaciar_todo_menos_usuarios.sql. Siempre queda al menos un
-- Administrador activo. Si una de las 3 cuentas ya no existe, se omite.
-- =====================================================================

-- Antes del cambio
select p.email, p.nombre, p.rol::text as rol, p.activo
from public.perfiles p
where lower(p.email) in ('srhernandez.castillo@gmail.com', 'maxi.her0.115@gmail.com',
                         'mercaditoferiano@metalium.cl', 'mhernandez@metalium.cl')
order by p.email;

create temp table if not exists _borrar (email text);
truncate _borrar;
insert into _borrar values
  ('srhernandez.castillo@gmail.com'),
  ('maxi.her0.115@gmail.com'),
  ('mercaditoferiano@metalium.cl');

create temp table if not exists _bloqueos (id uuid, bloqueo text);
truncate _bloqueos;

do $$
declare
  v_ids uuid[];
  r record;
  v_faltan text;
  v_bloqueos text;
begin
  select array_agg(distinct x.id) into v_ids
  from (
    select u.id from auth.users u join _borrar b on lower(u.email) = b.email
    union
    select p.id from public.perfiles p join _borrar b on lower(p.email) = b.email
  ) x;
  v_ids := coalesce(v_ids, '{}');

  select string_agg(b.email, ', ') into v_faltan
  from _borrar b
  where not exists (select 1 from auth.users u where lower(u.email) = b.email)
    and not exists (select 1 from public.perfiles p where lower(p.email) = b.email);
  if v_faltan is not null then
    raise notice 'Estas cuentas no existen (se omiten): %', v_faltan;
  end if;

  -- columnas de otras tablas que todavía apuntan a esas cuentas
  -- (las que se borran o se limpian solas al eliminarlas no cuentan)
  for r in
    select c.conrelid::regclass as tabla, a.attname as columna
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and c.confrelid in ('public.perfiles'::regclass, 'auth.users'::regclass)
      and c.conrelid <> 'public.perfiles'::regclass
      and n.nspname not in ('auth', 'storage')
      and c.confdeltype not in ('c', 'n', 'd')
  loop
    execute format(
      'insert into _bloqueos select %1$I, %2$L || count(*) || '' fila(s))'' from %3$s where %1$I = any($1) group by %1$I',
      r.columna, format('%s.%s (', r.tabla, r.columna), r.tabla)
      using v_ids;
  end loop;

  select string_agg(distinct coalesce(p.email, b.id::text) || ' -> ' || b.bloqueo, '; ') into v_bloqueos
  from _bloqueos b left join public.perfiles p on p.id = b.id;
  if v_bloqueos is not null then
    raise exception 'No se cambió nada: estas cuentas todavía aparecen en otras tablas: %. Corre antes supabase/mantencion/02_vaciar_todo_menos_usuarios.sql.', v_bloqueos;
  end if;

  if not exists (
    select 1 from public.perfiles
    where rol = 'admin' and coalesce(activo, true) and not (id = any(v_ids))
  ) then
    raise exception 'No se cambió nada: tiene que quedar al menos un Administrador activo.';
  end if;

  delete from public.perfiles where id = any(v_ids);
  delete from auth.users where id = any(v_ids);
  raise notice 'Cuentas eliminadas: %', coalesce(array_length(v_ids, 1), 0);

  -- nombre de mhernandez@metalium.cl (U& = "á" escrita como código, a prueba de consolas)
  update public.perfiles
  set nombre = U&'Maximiliano Hern\00E1ndez'
  where lower(email) = 'mhernandez@metalium.cl';
  if not found then
    raise exception 'No se cambió nada: no existe la cuenta mhernandez@metalium.cl.';
  end if;
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                           || jsonb_build_object('nombre', U&'Maximiliano Hern\00E1ndez')
  where lower(email) = 'mhernandez@metalium.cl';
end $$;

-- Después del cambio: todos los usuarios
select p.email, p.nombre, p.rol::text as rol, p.activo
from public.perfiles p
order by p.email;
