-- =====================================================================
-- 10_aprobar_cambios_cargo_nov2026.sql   (nov. 2026, a pedido)
--
-- Aprueba, como Patricio Muñoz, las 3 solicitudes de Cambio de cargo que
-- creó 09_cambios_cargo_nov2026.sql (Jonathan Panes, Patricio Muñoz y
-- Francisco Montesinos; fecha efectiva 10-11-2026).
--
-- Hace lo mismo que el botón "Aprobar" de la Bandeja: marca la aprobación
-- de Patricio como aprobada y la base calcula sola el estado de la
-- solicitud y el tiempo de respuesta. Si alguna no queda aprobada, no
-- guarda nada.
--
-- OJO: aprobando desde aquí NO se envían los correos de "solicitud
-- aprobada" (a RRHH, al solicitante y al aprobador). RRHH las verá igual en
-- su lista de Solicitudes para procesar.
--
-- SQL Editor de Supabase (proyecto "SSI - RRHH"): pegar todo y Run.
-- O desde CMD: node supabase\mantencion\sql.mjs supabase\mantencion\10_aprobar_cambios_cargo_nov2026.sql --aplicar
-- Se puede correr más de una vez (lo ya aprobado no se toca).
-- =====================================================================

create temp table if not exists _cc_aprobar (solicitud_id uuid, estado_antes text);
truncate _cc_aprobar;

do $$
declare
  v_francisco uuid;
  v_patricio uuid;
  v_n int;
  v_lista text;
  v_pend int;
begin
  select count(*), min(id::text)::uuid, string_agg(nombre, '; ') into v_n, v_francisco, v_lista
  from public.perfiles where translate(lower(nombre), 'áéíóúüñ', 'aeiouun') like '%francisco%montesinos%';
  if v_n <> 1 then
    raise exception 'Usuario "Francisco Montesinos": se encontraron % (%).', v_n, coalesce(v_lista, 'ninguno');
  end if;
  select count(*), min(id::text)::uuid, string_agg(nombre, '; ') into v_n, v_patricio, v_lista
  from public.perfiles where translate(lower(nombre), 'áéíóúüñ', 'aeiouun') like '%patricio%munoz%';
  if v_n <> 1 then
    raise exception 'Usuario "Patricio Muñoz": se encontraron % (%).', v_n, coalesce(v_lista, 'ninguno');
  end if;

  -- Las 3 solicitudes del script 09
  insert into _cc_aprobar
  select s.id, s.estado::text
  from public.solicitudes s
  where s.tipo::text = 'cambio_cargo'
    and s.solicitante_id = v_francisco
    and s.detalle ->> 'fecha_efectiva' = '2026-11-10'
    and s.detalle ->> 'motivo' = 'El anexo de contrato se hace a partir del 03/11/2026.'
    and exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id and a.aprobador_id = v_patricio);

  select count(*) into v_n from _cc_aprobar;
  if v_n = 0 then
    raise exception 'No encontré las 3 solicitudes de Cambio de cargo. ¿Se corrió antes 09_cambios_cargo_nov2026.sql en este proyecto?';
  end if;
  if v_n <> 3 then
    raise notice 'Se encontraron % solicitudes (se esperaban 3).', v_n;
  end if;
  if exists (select 1 from _cc_aprobar where estado_antes not in ('pendiente', 'aprobada')) then
    raise exception 'Alguna de las solicitudes no está pendiente (estado: %). No se cambió nada.',
      (select string_agg(estado_antes, ', ') from _cc_aprobar where estado_antes not in ('pendiente', 'aprobada'));
  end if;

  -- Como si aprobara Patricio desde su cuenta
  perform set_config('request.jwt.claim.sub', v_patricio::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_patricio, 'role', 'authenticated')::text, true);

  update public.aprobaciones a
  set decision = 'aprobado'
  where a.solicitud_id in (select solicitud_id from _cc_aprobar)
    and a.aprobador_id = v_patricio
    and a.decision::text = 'pendiente';
  get diagnostics v_n = row_count;
  raise notice 'Aprobaciones marcadas: %', v_n;

  -- Forzar: si todas sus aprobaciones quedaron aprobadas pero la solicitud
  -- no cambió de estado sola, se marca aprobada igual.
  update public.solicitudes s
  set estado = 'aprobada'
  where s.id in (select solicitud_id from _cc_aprobar)
    and s.estado::text <> 'aprobada'
    and not exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id and a.decision::text <> 'aprobado');
  get diagnostics v_n = row_count;
  if v_n > 0 then
    raise notice 'Solicitudes marcadas aprobadas a la fuerza: %', v_n;
  end if;

  select count(*) into v_pend
  from public.solicitudes s join _cc_aprobar c on c.solicitud_id = s.id
  where s.estado::text <> 'aprobada';
  if v_pend > 0 then
    raise exception 'Después de aprobar, % solicitud(es) no quedaron en estado aprobada (pueden tener otro aprobador pendiente). No se cambió nada.', v_pend;
  end if;
end $$;

-- Resultado
select s.codigo,
       s.folio,
       coalesce(t.nombre, concat_ws(' ', t.nombres, t.apellido_paterno)) as trabajador,
       coalesce(s.detalle ->> 'cargo_actual', '—') || ' -> ' || (s.detalle ->> 'cargo_nuevo') as cambio,
       c.estado_antes || ' -> ' || s.estado::text as estado,
       ap.nombre as aprobo,
       to_char(a.decidido_at at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI') as aprobada_el
from _cc_aprobar c
join public.solicitudes s on s.id = c.solicitud_id
left join public.trabajadores t on t.id = s.trabajador_id
left join public.aprobaciones a on a.solicitud_id = s.id and a.orden = 1
left join public.perfiles ap on ap.id = a.aprobador_id
order by s.codigo;
