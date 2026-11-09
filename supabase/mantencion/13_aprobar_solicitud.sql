-- =====================================================================
-- 13_aprobar_solicitud.sql   (nov. 2026) -- reutilizable
--
-- Deja APROBADA una solicitud pendiente, como si cada aprobador apretara
-- "Aprobar" en su Bandeja (en orden: etapa 1, 2, 3...). Lo ya aprobado no
-- se toca; la base calcula sola el estado y los tiempos (si el estado no
-- cambia solo, se marca aprobada igual). No toca una solicitud rechazada.
-- Si algo falla, no guarda nada. NO se envían los correos de "aprobada".
--
-- Cambia las 2 líneas de abajo:
--   - código de la solicitud
--   - aprobador: vacío = a nombre de quien tiene asignada cada etapa;
--                con un nombre (ej. 'Franklin Bratta') = las etapas
--                pendientes pasan a esa persona y quedan aprobadas por ella.
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar todo y Run.
-- =====================================================================

select set_config('aprobar.codigo', 'SSI-RRHH-2026-0011', false);   -- <<< código
select set_config('aprobar.aprobador', '', false);                  -- <<< vacío = el asignado

create temp table if not exists _apr_log (orden int, aprobador_antes text);
truncate _apr_log;
create temp table if not exists _apr_sol (id uuid, estado_antes text);
truncate _apr_sol;

do $$
declare
  v_codigo text := trim(current_setting('aprobar.codigo', true));
  v_nombre text := trim(coalesce(current_setting('aprobar.aprobador', true), ''));
  v_sol record;
  v_quien uuid;          -- aprobador forzado (si se indicó un nombre)
  v_n int;
  v_lista text;
  r record;
  v_antes text;
  v_agregado boolean := false;
begin
  -- La solicitud (acepta también el código mal escrito "SSI-RRH-...")
  select count(*), string_agg(s.codigo, ', ') into v_n, v_lista
  from public.solicitudes s where upper(s.codigo) = upper(v_codigo);
  if v_n = 0 then
    select count(*), string_agg(s.codigo, ', ') into v_n, v_lista
    from public.solicitudes s
    where upper(s.codigo) like 'SSI-RRH%' and right(s.codigo, 9) = right(v_codigo, 9);
  end if;
  if v_n <> 1 then
    raise exception 'Solicitud "%": se encontraron % (%).', v_codigo, v_n, coalesce(v_lista, 'ninguna');
  end if;
  select s.id, s.codigo, s.estado::text as estado into v_sol
  from public.solicitudes s
  where upper(s.codigo) = upper(v_codigo)
     or (upper(s.codigo) like 'SSI-RRH%' and right(s.codigo, 9) = right(v_codigo, 9))
  limit 1;
  insert into _apr_sol values (v_sol.id, v_sol.estado);

  if v_sol.estado = 'aprobada' then
    raise notice 'La solicitud % ya estaba aprobada: no se cambió nada.', v_sol.codigo;
    return;
  end if;
  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud % está "%": no se aprueba desde aquí. No se cambió nada.', v_sol.codigo, v_sol.estado;
  end if;

  -- Aprobador forzado (opcional)
  if v_nombre <> '' then
    select count(*), min(id::text)::uuid, string_agg(nombre, '; ') into v_n, v_quien, v_lista
    from public.perfiles
    where translate(lower(nombre), 'áéíóúüñ', 'aeiouun')
          like '%' || replace(translate(lower(v_nombre), 'áéíóúüñ', 'aeiouun'), ' ', '%') || '%';
    if v_n <> 1 then
      raise exception 'Aprobador "%": se encontraron % (%).', v_nombre, v_n, coalesce(v_lista, 'ninguno');
    end if;
  end if;

  -- Sin aprobadores
  if not exists (select 1 from public.aprobaciones where solicitud_id = v_sol.id) then
    if v_quien is null then
      raise exception 'La solicitud % no tiene ningún aprobador asignado. Escribe quién la aprueba en la línea "aprobar.aprobador" y vuelve a correrlo.', v_sol.codigo;
    end if;
    insert into public.aprobaciones (solicitud_id, aprobador_id, orden) values (v_sol.id, v_quien, 1);
    v_agregado := true;
  end if;

  for r in
    select a.id, a.orden, a.aprobador_id
    from public.aprobaciones a
    where a.solicitud_id = v_sol.id and a.decision::text = 'pendiente'
    order by a.orden
  loop
    select p.nombre into v_antes from public.perfiles p where p.id = r.aprobador_id;
    v_antes := case when v_agregado then '(no tenía aprobador)' else coalesce(v_antes, 'nadie') end;

    if v_quien is not null and r.aprobador_id is distinct from v_quien then
      begin
        update public.aprobaciones set aprobador_id = v_quien where id = r.id;
      exception when unique_violation then
        raise notice 'Etapa %: % ya figura en otra etapa; esta queda aprobada a nombre de %.', r.orden, v_nombre, v_antes;
      end;
    elsif v_quien is null and r.aprobador_id is null then
      raise exception 'La etapa % de % no tiene aprobador. Escribe quién la aprueba en la línea "aprobar.aprobador" y vuelve a correrlo.', r.orden, v_sol.codigo;
    end if;

    -- Como si aprobara desde su cuenta quien quedó en esa etapa
    perform set_config('request.jwt.claim.sub', (select aprobador_id::text from public.aprobaciones where id = r.id), true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', (select aprobador_id from public.aprobaciones where id = r.id), 'role', 'authenticated')::text, true);

    update public.aprobaciones set decision = 'aprobado' where id = r.id;
    insert into _apr_log values (r.orden, v_antes);
  end loop;

  update public.solicitudes s set estado = 'aprobada'
  where s.id = v_sol.id and s.estado::text <> 'aprobada'
    and not exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id and a.decision::text <> 'aprobado');

  if (select estado::text from public.solicitudes where id = v_sol.id) <> 'aprobada' then
    raise exception 'La solicitud % no quedó aprobada. No se cambió nada.', v_sol.codigo;
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
