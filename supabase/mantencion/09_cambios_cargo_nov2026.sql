-- =====================================================================
-- 09_cambios_cargo_nov2026.sql   (nov. 2026, a pedido)
--
-- Crea 3 solicitudes de Cambio de cargo como si las levantara
-- Francisco Montesinos desde su cuenta, con Patricio Muñoz como aprobador:
--
--   Jonathan Panes        -> Supervisor
--   Patricio Muñoz        -> Jefe de Terreno
--   Francisco Montesinos  -> Administrador de Obra
--
--   Fecha efectiva: 10-11-2026 (hoy 05-11 + 3 días hábiles, la regla del
--   sistema). Motivo (observación): el anexo se hace desde el 03-11-2026.
--
-- Quedan PENDIENTES de la aprobación de Patricio Muñoz (le aparecen en su
-- Bandeja), con folio y código como cualquier solicitud creada en la app.
-- El cargo nuevo se toma de la lista de Cargos: si no está escrito igual,
-- se usa el que empieza con ese nombre (se muestra en el resultado).
--
-- Requiere la migración 0024 (si no, la base rechaza el Cambio de cargo).
--
--   node supabase\mantencion\sql.mjs supabase\mantencion\09_cambios_cargo_nov2026.sql
--       -> REVISIÓN: muestra cómo quedarían y no guarda nada.
--   node supabase\mantencion\sql.mjs supabase\mantencion\09_cambios_cargo_nov2026.sql --aplicar
--       -> las crea. Si se corre de nuevo no las duplica.
-- =====================================================================

create temp table if not exists _cc_pedido (orden int, trabajador text, cargo text);
truncate _cc_pedido;
insert into _cc_pedido values
  (1, 'jonathan panes', 'Supervisor'),
  (2, 'patricio munoz', 'Jefe de Terreno'),
  (3, 'francisco montesinos', 'Administrador de Obra');

create temp table if not exists _cc_resultado (orden int, solicitud_id uuid, accion text, cargo_usado text);
truncate _cc_resultado;

do $$
declare
  c_fecha constant text := '2026-11-10';
  c_motivo constant text := 'El anexo de contrato se hace a partir del 03/11/2026.';
  v_solicitante uuid;
  v_aprobador uuid;
  v_lista text;
  v_n int;
  p record;
  t record;
  v_cargo text;
  v_sol uuid;
begin
  -- 0024 aplicada?
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.solicitudes'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* '\mtipo\M' and pg_get_constraintdef(c.oid) ~* 'centro_destino_id'
      and coalesce(obj_description(c.oid, 'pg_constraint'), '') not like 'ajustada 0024%'
  ) then
    raise exception 'Falta correr antes supabase/migrations/0024_tipos_cambio_sin_destino.sql (sin ella la base rechaza el Cambio de cargo).';
  end if;

  -- Usuarios: quien solicita y quien aprueba
  select count(*), min(id::text)::uuid, string_agg(nombre || ' <' || coalesce(email, '') || '>', '; ')
    into v_n, v_solicitante, v_lista
  from public.perfiles
  where translate(lower(nombre), 'áéíóúüñ', 'aeiouun') like '%francisco%montesinos%';
  if v_n <> 1 then
    raise exception 'Usuario "Francisco Montesinos": se encontraron % (%). Revisa el nombre en Usuarios.', v_n, coalesce(v_lista, 'ninguno');
  end if;

  select count(*), min(id::text)::uuid, string_agg(nombre || ' <' || coalesce(email, '') || '>', '; ')
    into v_n, v_aprobador, v_lista
  from public.perfiles
  where translate(lower(nombre), 'áéíóúüñ', 'aeiouun') like '%patricio%munoz%';
  if v_n <> 1 then
    raise exception 'Usuario "Patricio Muñoz": se encontraron % (%). Revisa el nombre en Usuarios.', v_n, coalesce(v_lista, 'ninguno');
  end if;

  -- Como si la creara Francisco desde su cuenta (auth.uid() en los triggers)
  perform set_config('request.jwt.claim.sub', v_solicitante::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_solicitante, 'role', 'authenticated')::text, true);

  for p in select * from _cc_pedido order by orden loop
    -- Trabajador
    select count(*), string_agg(coalesce(x.nombre, concat_ws(' ', x.nombres, x.apellido_paterno, x.apellido_materno)) || ' ' || x.rut, '; ')
      into v_n, v_lista
    from public.trabajadores x
    where coalesce(x.activo, true)
      and translate(lower(coalesce(x.nombre, concat_ws(' ', x.nombres, x.apellido_paterno, x.apellido_materno))), 'áéíóúüñ', 'aeiouun')
          like '%' || replace(p.trabajador, ' ', '%') || '%';
    if v_n <> 1 then
      raise exception 'Trabajador "%": se encontraron % (%). Revisa el maestro de Trabajadores.', p.trabajador, v_n, coalesce(v_lista, 'ninguno');
    end if;
    select x.* into t
    from public.trabajadores x
    where coalesce(x.activo, true)
      and translate(lower(coalesce(x.nombre, concat_ws(' ', x.nombres, x.apellido_paterno, x.apellido_materno))), 'áéíóúüñ', 'aeiouun')
          like '%' || replace(p.trabajador, ' ', '%') || '%';
    if t.centro_costo_id is null then
      raise exception 'El trabajador % no tiene centro de costo en el maestro.', p.trabajador;
    end if;

    -- Cargo nuevo según la lista de Cargos
    select c.nombre into v_cargo from public.cargos c
    where coalesce(c.activo, true) and lower(trim(c.nombre)) = lower(p.cargo) limit 1;
    if v_cargo is null then
      select min(c.nombre), count(*) into v_cargo, v_n from public.cargos c
      where coalesce(c.activo, true) and lower(c.nombre) like lower(p.cargo) || '%';
      if v_n <> 1 then v_cargo := p.cargo; end if;   -- no hay uno claro: tal cual se pidió
    end if;

    -- No duplicar si ya existe
    select s.id into v_sol from public.solicitudes s
    where s.tipo::text = 'cambio_cargo' and s.trabajador_id = t.id
      and s.estado::text in ('pendiente', 'aprobada')
      and s.detalle ->> 'cargo_nuevo' = v_cargo
    limit 1;
    if v_sol is not null then
      insert into _cc_resultado values (p.orden, v_sol, 'ya existía', v_cargo);
      continue;
    end if;

    -- Igual que crear_solicitud_cambio(): solicitud + 1 aprobación
    insert into public.solicitudes (tipo, solicitante_id, trabajador_id, centro_origen_id, detalle)
    values ('cambio_cargo', v_solicitante, t.id, t.centro_costo_id,
            jsonb_build_object('cargo_actual', t.cargo, 'cargo_nuevo', v_cargo, 'fecha_efectiva', c_fecha, 'motivo', c_motivo))
    returning id into v_sol;

    insert into public.aprobaciones (solicitud_id, aprobador_id, orden)
    values (v_sol, v_aprobador, 1);

    insert into _cc_resultado values (p.orden, v_sol, 'creada', v_cargo);
  end loop;
end $$;

-- Resultado
select s.codigo,
       s.folio,
       coalesce(t.nombre, concat_ws(' ', t.nombres, t.apellido_paterno)) as trabajador,
       coalesce(s.detalle ->> 'cargo_actual', '—') || ' -> ' || (s.detalle ->> 'cargo_nuevo') as cambio,
       to_char((s.detalle ->> 'fecha_efectiva')::date, 'DD-MM-YYYY') as fecha_efectiva,
       sol.nombre as solicita,
       ap.nombre as aprueba,
       s.estado::text as estado,
       r.accion
from _cc_resultado r
join public.solicitudes s on s.id = r.solicitud_id
left join public.trabajadores t on t.id = s.trabajador_id
left join public.perfiles sol on sol.id = s.solicitante_id
left join public.aprobaciones a on a.solicitud_id = s.id and a.orden = 1
left join public.perfiles ap on ap.id = a.aprobador_id
order by r.orden;
