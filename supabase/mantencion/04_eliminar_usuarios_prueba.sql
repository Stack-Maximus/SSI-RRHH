-- =====================================================================
-- 04_eliminar_usuarios_prueba.sql   (nov. 2026, a pedido)
--
--   ELIMINA LAS CUENTAS QUE PEGUES EN LA LISTA (usuarios de prueba).
--   NO SE PUEDE DESHACER: la persona ya no podrá iniciar sesión.
--
-- Cómo usarlo (SQL Editor de Supabase, todo de una vez):
--   1. Córrelo tal cual (con 'NO'): no borra nada y muestra TODOS los
--      usuarios, marcando cuáles se eliminarían y si algo lo impide.
--   2. Pega los correos en la lista de abajo (uno por línea, entre comillas
--      simples y con coma entre líneas), vuelve a correrlo y revisa.
--   3. Cambia 'NO' por 'ELIMINAR' y córrelo otra vez.
--
-- Lo ideal es correrlo DESPUÉS de 02_vaciar_todo_menos_usuarios.sql: así
-- esos usuarios ya no tienen solicitudes, aprobaciones ni centros a su
-- nombre. Si alguno todavía aparece en otra tabla, el script no borra nada
-- y dice dónde (columna "bloqueo").
--
-- Protecciones: si un correo de la lista no existe, no se borra nada (para
-- que un error de tipeo no pase de largo); y siempre tiene que quedar al
-- menos un Administrador activo.
--
-- Alternativa sin SQL: Supabase -> Authentication -> Users -> "Delete user"
-- (borra la cuenta; su perfil se va con ella si la tabla perfiles lo tiene
-- en cascada, y si no, queda huérfano: por eso este script borra ambos).
-- =====================================================================

select set_config('usuarios.confirmacion', 'NO', false);   -- <<< cambia 'NO' por 'ELIMINAR'
select set_config('usuarios.resultado', '', false);

create temp table if not exists _usuarios_borrar (email text);
truncate _usuarios_borrar;
insert into _usuarios_borrar (email) values
  -- >>> pega aquí los correos de los usuarios de prueba, uno por línea <<<
  ('correo.de.prueba@ejemplo.cl')
;

create temp table if not exists _usuarios_bloqueos (id uuid, bloqueo text);
truncate _usuarios_bloqueos;

do $$
declare
  v_ids uuid[];
  v_no_existen text;
  r record;
  v_admins_quedan int;
begin
  update _usuarios_borrar set email = lower(trim(email));
  delete from _usuarios_borrar where coalesce(email, '') = '';

  -- usuarios de la lista (por el correo de la cuenta o el del perfil)
  select array_agg(distinct x.id) into v_ids
  from (
    select u.id from auth.users u join _usuarios_borrar b on lower(u.email) = b.email
    union
    select p.id from public.perfiles p join _usuarios_borrar b on lower(p.email) = b.email
  ) x;
  v_ids := coalesce(v_ids, '{}');

  -- ¿algo los sigue usando? Columnas de otras tablas que apuntan al usuario
  -- y que NO se borran ni se limpian solas al eliminarlo.
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
      and c.confdeltype not in ('c', 'n', 'd')          -- cascade / set null / default: no bloquean
  loop
    execute format(
      'insert into _usuarios_bloqueos select %1$I, %2$L || count(*) || '' fila(s))'' from %3$s where %1$I = any($1) group by %1$I',
      r.columna, format('aparece en %s.%s (', r.tabla, r.columna), r.tabla)
      using v_ids;
  end loop;

  if coalesce(current_setting('usuarios.confirmacion', true), '') <> 'ELIMINAR' then
    return;   -- vista previa: no se borra nada
  end if;

  select string_agg(b.email, ', ') into v_no_existen
  from _usuarios_borrar b
  where not exists (select 1 from auth.users u where lower(u.email) = b.email)
    and not exists (select 1 from public.perfiles p where lower(p.email) = b.email);
  if v_no_existen is not null then
    raise exception 'No se borró nada: estos correos no existen (revisa que estén bien escritos): %', v_no_existen;
  end if;

  if exists (select 1 from _usuarios_bloqueos) then
    raise exception 'No se borró nada: hay usuarios de la lista que todavía aparecen en otras tablas (ver la columna "bloqueo" corriendo el script con ''NO''). Corre antes 02_vaciar_todo_menos_usuarios.sql.';
  end if;

  select count(*) into v_admins_quedan
  from public.perfiles
  where rol = 'admin' and coalesce(activo, true) and not (id = any(v_ids));
  if v_admins_quedan = 0 then
    raise exception 'No se borró nada: tiene que quedar al menos un Administrador activo.';
  end if;

  delete from public.perfiles where id = any(v_ids);
  delete from auth.users where id = any(v_ids);
  perform set_config('usuarios.resultado', 'eliminado', false);
end $$;

-- Resultado: todos los usuarios y qué pasa con cada uno
select correo, nombre, rol, estado, ultimo_ingreso, accion, bloqueo
from (
  select coalesce(p.email, u.email) as correo,
         p.nombre,
         p.rol::text as rol,
         case when coalesce(p.activo, true) then 'activo' else 'inactivo' end as estado,
         to_char(u.last_sign_in_at at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI') as ultimo_ingreso,
         case when exists (select 1 from _usuarios_borrar b where b.email = lower(coalesce(p.email, u.email)))
              then 'SE ELIMINARÍA' else 'se mantiene' end as accion,
         (select string_agg(distinct bl.bloqueo, '; ') from _usuarios_bloqueos bl where bl.id = coalesce(p.id, u.id)) as bloqueo,
         case when exists (select 1 from _usuarios_borrar b where b.email = lower(coalesce(p.email, u.email))) then 1 else 3 end as prioridad
  from public.perfiles p
  full join auth.users u on u.id = p.id
  union all
  select b.email, null, null, null, null,
         case when current_setting('usuarios.resultado', true) = 'eliminado' then 'ELIMINADO'
              else 'NO EXISTE: revisa el correo' end,
         null, 0
  from _usuarios_borrar b
  where not exists (select 1 from auth.users u where lower(u.email) = b.email)
    and not exists (select 1 from public.perfiles p where lower(p.email) = b.email)
) x
order by prioridad, correo;
