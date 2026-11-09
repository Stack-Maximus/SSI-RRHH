-- =====================================================================
-- 12_aprobar_SSI-RRHH-2026-0001.sql   (nov. 2026, a pedido)
--
-- Deja APROBADA la solicitud SSI-RRHH-2026-0001, aprobada por Franklin
-- Bratta:
--   - Cada aprobación que siga pendiente pasa a Franklin y queda aprobada,
--     en orden (1, 2, 3...), como si él apretara "Aprobar" en su Bandeja.
--     Lo que ya estaba aprobado no se toca.
--   - Si la solicitud no tenía ningún aprobador (pasaba cuando la obra no
--     tenía administrador de obra), se le agrega Franklin como aprobador.
--   - La base calcula sola el estado y los tiempos; si el estado no cambia
--     solo, se marca aprobada igual.
-- No toca una solicitud rechazada. Si algo falla, no guarda nada.
-- Aprobada desde aquí NO se envían los correos de "solicitud aprobada".
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar todo y Run. Se puede correr
-- más de una vez.
-- =====================================================================

create temp table if not exists _apr_log (orden int, aprobador_antes text, accion text);
truncate _apr_log;
create temp table if not exists _apr_sol (id uuid, estado_antes text);
truncate _apr_sol;

do $$
declare
  c_codigo constant text := 'SSI-RRHH-2026-0001';
  v_sol record;
  v_franklin uuid;
  v_n int;
  v_lista text;
  r record;
  v_antes text;
  v_agregado boolean := false;
begin
  select s.id, s.estado::text as estado, s.tipo::text as tipo into v_sol
  from public.solicitudes s where upper(s.codigo) = upper(c_codigo);
  if not found then
    raise exception 'No existe la solicitud % en este proyecto.', c_codigo;
  end if;
  insert into _apr_sol values (v_sol.id, v_sol.estado);

  select count(*), min(id::text)::uuid, string_agg(nombre || ' <' || coalesce(email, '') || '>', '; ')
    into v_n, v_franklin, v_lista
  from public.perfiles
  where translate(lower(nombre), 'áéíóúüñ', 'aeiouun') like '%franklin%brat%';
  if v_n <> 1 then
    raise exception 'Usuario "Franklin Bratta": se encontraron % (%). Revisa el nombre en Usuarios.', v_n, coalesce(v_lista, 'ninguno');
  end if;

  if v_sol.estado = 'aprobada' then
    raise notice 'La solicitud % ya estaba aprobada: no se cambió nada.', c_codigo;
    return;
  end if;
  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud % está "%": no se aprueba desde aquí. No se cambió nada.', c_codigo, v_sol.estado;
  end if;

  -- Como si aprobara Franklin desde su cuenta
  perform set_config('request.jwt.claim.sub', v_franklin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_franklin, 'role', 'authenticated')::text, true);

  -- Sin aprobadores: se agrega Franklin
  if not exists (select 1 from public.aprobaciones where solicitud_id = v_sol.id) then
    insert into public.aprobaciones (solicitud_id, aprobador_id, orden) values (v_sol.id, v_franklin, 1);
    v_agregado := true;
  end if;

  -- Cada aprobación pendiente, en orden: pasa a Franklin y se aprueba
  for r in
    select a.id, a.orden, a.aprobador_id
    from public.aprobaciones a
    where a.solicitud_id = v_sol.id and a.decision::text = 'pendiente'
    order by a.orden
  loop
    select coalesce(p.nombre, 'nadie') into v_antes from public.perfiles p where p.id = r.aprobador_id;
    v_antes := case when v_agregado then '(no tenía aprobador)' else coalesce(v_antes, 'nadie') end;
    if r.aprobador_id is distinct from v_franklin then
      begin
        update public.aprobaciones set aprobador_id = v_franklin where id = r.id;
      exception when unique_violation then
        -- Franklin ya está en otra etapa de esta solicitud: esta se aprueba a nombre de quien estaba
        raise notice 'Etapa %: Franklin ya figura en otra etapa; esta queda aprobada a nombre de %.', r.orden, v_antes;
      end;
    end if;
    update public.aprobaciones set decision = 'aprobado' where id = r.id;
    insert into _apr_log values (r.orden, v_antes, 'aprobada');
  end loop;

  -- Si el estado no cambió solo pero todo quedó aprobado, se marca igual
  update public.solicitudes s set estado = 'aprobada'
  where s.id = v_sol.id and s.estado::text <> 'aprobada'
    and not exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id and a.decision::text <> 'aprobado');

  if (select estado::text from public.solicitudes where id = v_sol.id) <> 'aprobada' then
    raise exception 'La solicitud % no quedó aprobada. No se cambió nada.', c_codigo;
  end if;
end $$;

-- Resultado
select s.codigo,
       s.tipo::text as tipo,
       x.estado_antes || ' -> ' || s.estado::text as estado,
       a.orden as etapa,
       coalesce(p.nombre, '—') as aprobo,
       coalesce(l.aprobador_antes, '') as antes_estaba,
       a.decision::text as decision,
       to_char(a.decidido_at at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI') as decidida
from _apr_sol x
join public.solicitudes s on s.id = x.id
left join public.aprobaciones a on a.solicitud_id = s.id
left join public.perfiles p on p.id = a.aprobador_id
left join _apr_log l on l.orden = a.orden
order by a.orden;
