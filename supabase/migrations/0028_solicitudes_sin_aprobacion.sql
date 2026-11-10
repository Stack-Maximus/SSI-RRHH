-- =====================================================================
-- 0028_solicitudes_sin_aprobacion.sql   (nov. 2026, a pedido)
--
-- "Sus solicitudes no requieren aprobación" (ej. el Gerente General): una
-- casilla por usuario en Usuarios (perfiles.aprobacion_automatica). Las
-- solicitudes que crea esa persona, de cualquier tipo, no pasan por
-- aprobadores: quedan APROBADAS al crearlas, con una sola etapa a su nombre
-- marcada "Aprobación automática" (así el comprobante, las tablas y el
-- plazo de RRHH tienen de dónde sacar la fecha de aprobación). La Edge
-- Function notificar, al ver eso, manda el correo de "aprobada" con el PDF
-- a RRHH y a quien la pidió, en vez del aviso a aprobadores.
--
-- Cómo, sin tocar crear_solicitud ni crear_solicitud_cambio:
--   1. Columna perfiles.aprobacion_automatica (falso por defecto).
--   2. Solo un admin la puede marcar o desmarcar (trigger; desde el SQL
--      Editor también se puede).
--   3. Antes de crear cada etapa de aprobación: si quien solicita tiene la
--      casilla, la etapa no se crea (se omite en silencio).
--   4. Al confirmar la transacción que creó la solicitud (trigger diferido,
--      corre después de que la función de creación terminó): se crea la
--      etapa automática y se aprueba "como si la aprobara él", con lo que la
--      base recalcula el estado y los tiempos igual que una aprobación
--      normal (y se dispara todo lo que depende de quedar aprobada:
--      renovación, desvinculación, etc.). Si aun así no quedó aprobada, se
--      marca aprobada.
--
-- Las solicitudes que ya existían no cambian. Desmarcar la casilla vale
-- para las próximas.
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar y Run. O:
--   node supabase\mantencion\sql.mjs supabase\migrations\0028_solicitudes_sin_aprobacion.sql --aplicar
-- Se puede correr más de una vez.
-- =====================================================================

-- 1. La casilla -------------------------------------------------------
alter table public.perfiles
  add column if not exists aprobacion_automatica boolean not null default false;
comment on column public.perfiles.aprobacion_automatica is
  'true = sus solicitudes no requieren aprobación: quedan aprobadas al crearlas, con una etapa "Aprobación automática" a su nombre (ej. Gerente General). Solo la cambia un admin. Ver 0028.';

-- 2. Solo un admin la cambia ------------------------------------------
create or replace function public.proteger_aprobacion_automatica()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.aprobacion_automatica is not distinct from old.aprobacion_automatica then
    return new;
  end if;
  if tg_op = 'INSERT' and not coalesce(new.aprobacion_automatica, false) then
    return new;
  end if;
  -- Desde la app (usuario conectado) solo un admin; el SQL Editor y las
  -- Edge Functions con service_role pueden.
  if coalesce(auth.role(), '') in ('authenticated', 'anon')
     and public.rol_actual() is distinct from 'admin' then
    raise exception 'Solo un administrador puede cambiar "Sus solicitudes no requieren aprobación".';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_aprobacion_automatica on public.perfiles;
create trigger trg_proteger_aprobacion_automatica
  before insert or update of aprobacion_automatica on public.perfiles
  for each row execute function public.proteger_aprobacion_automatica();

-- 3. No crear etapas para quien no requiere aprobación ----------------
create or replace function public.omitir_etapas_aprobacion_automatica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- la etapa automática (paso 4) sí se crea
  if new.comentario is not distinct from 'Aprobación automática' then
    return new;
  end if;
  if exists (
    select 1
    from public.solicitudes s
    join public.perfiles p on p.id = s.solicitante_id
    where s.id = new.solicitud_id and p.aprobacion_automatica
  ) then
    return null;   -- se omite esta etapa
  end if;
  return new;
end;
$$;

-- "trg_00_..." para que corra antes que cualquier otro trigger de la tabla
drop trigger if exists trg_00_omitir_etapas_aprobacion_automatica on public.aprobaciones;
create trigger trg_00_omitir_etapas_aprobacion_automatica
  before insert on public.aprobaciones
  for each row execute function public.omitir_etapas_aprobacion_automatica();

-- 4. Al confirmar: etapa automática aprobada ---------------------------
create or replace function public.aprobar_solicitud_automatica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
  v_apr uuid;
begin
  select s.id, s.solicitante_id, s.estado::text as estado
    into v_sol
  from public.solicitudes s where s.id = new.id;
  if not found then
    return null;
  end if;
  if not exists (select 1 from public.perfiles p where p.id = v_sol.solicitante_id and p.aprobacion_automatica) then
    return null;
  end if;
  if v_sol.estado not in ('pendiente', 'aprobada') then
    return null;
  end if;
  -- si por alguna razón quedó otra etapa (no debería), no se toca: sigue el flujo normal
  if exists (
    select 1 from public.aprobaciones a
    where a.solicitud_id = v_sol.id and a.comentario is distinct from 'Aprobación automática'
  ) then
    return null;
  end if;

  -- Como si aprobara desde su propia cuenta (igual que el script 13):
  -- la lógica de aprobaciones de la base usa auth.uid().
  perform set_config('request.jwt.claim.sub', v_sol.solicitante_id::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sol.solicitante_id, 'role', 'authenticated')::text, true);

  select a.id into v_apr
  from public.aprobaciones a
  where a.solicitud_id = v_sol.id and a.comentario = 'Aprobación automática'
  limit 1;
  if v_apr is null then
    insert into public.aprobaciones (solicitud_id, aprobador_id, orden, comentario, asignado_at)
    values (v_sol.id, v_sol.solicitante_id, 1, 'Aprobación automática', now())
    returning id into v_apr;
  end if;

  update public.aprobaciones
     set decision = 'aprobado', comentario = 'Aprobación automática'
   where id = v_apr and decision::text = 'pendiente';
  -- por si la lógica de aprobaciones no completó las fechas
  update public.aprobaciones
     set asignado_at = coalesce(asignado_at, now()), decidido_at = coalesce(decidido_at, now())
   where id = v_apr and (asignado_at is null or decidido_at is null);
  -- y por si no recalculó el estado
  update public.solicitudes
     set estado = 'aprobada'
   where id = v_sol.id and estado::text = 'pendiente';

  return null;
end;
$$;

drop trigger if exists trg_aprobar_solicitud_automatica on public.solicitudes;
create constraint trigger trg_aprobar_solicitud_automatica
  after insert on public.solicitudes
  deferrable initially deferred
  for each row execute function public.aprobar_solicitud_automatica();

revoke all on function public.omitir_etapas_aprobacion_automatica() from public, anon, authenticated;
revoke all on function public.aprobar_solicitud_automatica() from public, anon, authenticated;

notify pgrst, 'reload schema';

select
  'Solicitudes sin aprobación listo' as resultado,
  (select count(*) from public.perfiles where aprobacion_automatica) as usuarios_marcados;
