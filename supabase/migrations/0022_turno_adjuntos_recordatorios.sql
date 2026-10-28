-- =====================================================================
-- 0022_turno_adjuntos_recordatorios.sql
-- Ajustes de fines de oct. 2026 (NOTAS_CONTRATACION_SST.md, sección 21):
--
--   1. Cambio de turno (enum agregado en 0021): crear_solicitud_cambio()
--      lo acepta (exige detalle.turno_nuevo), se suma a las políticas de
--      SELECT del solicitante, al cierre "Marcar como procesado" de RRHH y
--      al folio correlativo (prefijo RRH-TUR-, formulario RRH-FOR-VAR-005,
--      código provisorio).
--
--   2. Adjuntos de solicitudes: bucket privado 'solicitud-adjuntos'. Hoy lo
--      usa Desvinculación: con causal "Renuncia voluntaria" es OBLIGATORIO
--      adjuntar la carta de renuncia firmada; con otras causales es
--      opcional. El archivo va en una carpeta con el id de quien crea la
--      solicitud y la solicitud guarda detalle.adjunto = {path, nombre,
--      tipo_mime, bytes}. Un trigger valida, al crear o editar el detalle:
--        - Renuncia voluntaria sin adjunto -> error.
--        - el adjunto tiene que ser un archivo de la carpeta de quien creó
--          la solicitud y tiene que existir en el bucket.
--      Lo pueden descargar: quien creó la solicitud, sus aprobadores, RRHH
--      y admin.
--
--   3. Recordatorios a aprobadores: tabla `recordatorios_aprobacion` (lo
--      que se mandó, a quién, quién lo pidió y cuándo). La escribe SOLO la
--      Edge Function `notificar` (service role) al enviar el correo
--      'recordatorio_aprobador'; con ella controla el enfriamiento (no
--      repetir el mismo recordatorio antes de unas horas). RRHH/admin ven
--      todos; el resto, los que pidió.
--
-- La causal "Ausentismo" y el turno quitado de Traslado son solo de
-- pantalla (src/config.js, nueva-solicitud.js): `causal` es texto libre en
-- detalle y los traslados antiguos conservan su turno.
--
-- Ejecutar después de 0021 (no en la misma transacción). 100% aditivo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) crear_solicitud_cambio() + 'cambio_turno'
--    Mismo cuerpo que 0020; agrega el tipo y valida el turno nuevo.
-- ---------------------------------------------------------------------
create or replace function public.crear_solicitud_cambio(
  p_tipo public.tipo_solicitud,
  p_trabajador_id uuid,
  p_detalle jsonb default '{}'::jsonb
)
returns public.solicitudes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol public.user_role;
  v_centro_id uuid;
  v_admin_obra_id uuid;
  v_solicitud public.solicitudes;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol not in ('solicitante', 'supervisor', 'admin') then
    raise exception 'No tienes permiso para levantar este tipo de solicitud.';
  end if;

  if p_tipo::text = 'bono' then
    raise exception 'Las solicitudes de Bono ya no se crean desde el sistema.';
  end if;

  if p_tipo::text not in ('aumento_sueldo', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion') then
    raise exception 'Tipo de solicitud no válido para crear_solicitud_cambio().';
  end if;

  if p_tipo::text = 'cambio_turno' and coalesce(trim(p_detalle ->> 'turno_nuevo'), '') = '' then
    raise exception 'Falta el turno nuevo.';
  end if;

  if p_trabajador_id is null then
    raise exception 'Falta el trabajador.';
  end if;

  select centro_costo_id into v_centro_id from public.trabajadores where id = p_trabajador_id;
  if v_centro_id is null then
    raise exception 'El trabajador no existe o no tiene centro de costo asignado.';
  end if;

  select admin_obra_id into v_admin_obra_id from public.centros_costo where id = v_centro_id;
  if v_admin_obra_id is null then
    raise exception 'El centro de costo de este trabajador no tiene administrador de obra asignado. Asígnalo en "Centros de costo" antes de continuar.';
  end if;

  insert into public.solicitudes (tipo, solicitante_id, trabajador_id, centro_origen_id, detalle)
  values (p_tipo, auth.uid(), p_trabajador_id, v_centro_id, coalesce(p_detalle, '{}'::jsonb))
  returning * into v_solicitud;

  insert into public.aprobaciones (solicitud_id, aprobador_id, orden)
  values (v_solicitud.id, v_admin_obra_id, 1);

  return v_solicitud;
end;
$$;

grant execute on function public.crear_solicitud_cambio(public.tipo_solicitud, uuid, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 2) Políticas: suman 'cambio_turno' a las listas acotadas (mismo
--    criterio que 0007/0014: agregan visibilidad, nunca la quitan).
-- ---------------------------------------------------------------------
drop policy if exists solicitudes_cambio_solicitante_select on public.solicitudes;
create policy solicitudes_cambio_solicitante_select on public.solicitudes
  for select to authenticated
  using (
    tipo::text in ('aumento_sueldo', 'bono', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion')
    and solicitante_id = auth.uid()
  );

drop policy if exists aprobaciones_cambio_solicitante_select on public.aprobaciones;
create policy aprobaciones_cambio_solicitante_select on public.aprobaciones
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitudes s
      where s.id = solicitud_id
        and s.tipo::text in ('aumento_sueldo', 'bono', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion')
        and s.solicitante_id = auth.uid()
    )
  );

drop policy if exists solicitudes_rrhh_marcar_procesado on public.solicitudes;
create policy solicitudes_rrhh_marcar_procesado on public.solicitudes
  for update to authenticated
  using (
    public.rol_actual() in ('admin', 'rrhh')
    and tipo::text in ('aumento_sueldo', 'bono', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion')
    and estado = 'aprobada'
    and procesado_rrhh_at is null
  )
  with check (
    public.rol_actual() in ('admin', 'rrhh')
    and tipo::text in ('aumento_sueldo', 'bono', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion')
  );


-- ---------------------------------------------------------------------
-- 3) Folio correlativo: RRH-TUR-000001, ... (mismo cuerpo que 0014 + 1 when)
-- ---------------------------------------------------------------------
insert into public.folios_correlativos (tipo, siguiente) values ('cambio_turno', 1)
on conflict (tipo) do nothing;

create or replace function public.asignar_folio_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text;
  v_num integer;
begin
  if new.folio is not null then
    return new;
  end if;

  v_prefijo := case new.tipo::text
    when 'ingreso'         then 'RRH-ING-'
    when 'traslado'        then 'RRH-TRA-'
    when 'aumento_sueldo'  then 'RRH-VAR-'
    when 'bono'            then 'RRH-BON-'
    when 'cambio_cargo'    then 'RRH-CAR-'
    when 'cambio_turno'    then 'RRH-TUR-'
    when 'renovacion'      then 'RRH-REN-'
    when 'desvinculacion'  then 'RRH-DES-'
    else null
  end;

  if v_prefijo is null then
    return new;
  end if;

  insert into public.folios_correlativos (tipo, siguiente)
    values (new.tipo::text, 2)
    on conflict (tipo) do update set siguiente = folios_correlativos.siguiente + 1
    returning siguiente - 1 into v_num;

  new.folio := v_prefijo || lpad(v_num::text, 6, '0');
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 4) Bucket privado de adjuntos de solicitudes + políticas de Storage.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'solicitud-adjuntos', 'solicitud-adjuntos', false, 10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword']
)
on conflict (id) do nothing;

-- ¿Puede el usuario actual ver este adjunto? Dueño de la carpeta, RRHH,
-- admin, o aprobador de una solicitud que apunta a ese archivo. SECURITY
-- DEFINER para no depender de las políticas de solicitudes/aprobaciones
-- (que varían por rol) dentro de la política de Storage.
create or replace function public.puede_ver_adjunto_solicitud(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    split_part(p_path, '/', 1) = auth.uid()::text
    or public.rol_actual() in ('admin', 'rrhh')
    or exists (
      select 1
      from public.solicitudes s
      join public.aprobaciones a on a.solicitud_id = s.id
      where s.detalle -> 'adjunto' ->> 'path' = p_path
        and a.aprobador_id = auth.uid()
    );
$$;

grant execute on function public.puede_ver_adjunto_solicitud(text) to authenticated;

drop policy if exists storage_solicitud_adjuntos_insert on storage.objects;
create policy storage_solicitud_adjuntos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'solicitud-adjuntos'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.rol_actual() in ('solicitante', 'supervisor', 'admin')
  );

drop policy if exists storage_solicitud_adjuntos_select on storage.objects;
create policy storage_solicitud_adjuntos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'solicitud-adjuntos'
    and public.puede_ver_adjunto_solicitud(name)
  );

-- Sin UPDATE para nadie (un adjunto no se reemplaza en sitio: se sube uno
-- nuevo). DELETE solo admin (respaldo de lo que se aprobó).
drop policy if exists storage_solicitud_adjuntos_admin_delete on storage.objects;
create policy storage_solicitud_adjuntos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'solicitud-adjuntos' and public.rol_actual() = 'admin');


-- ---------------------------------------------------------------------
-- 5) Validación del adjunto al crear / editar una solicitud.
-- ---------------------------------------------------------------------
create or replace function public.validar_adjunto_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  -- Un UPDATE que no toca el detalle (aprobar, marcar procesado...) no se
  -- revisa: las desvinculaciones antiguas sin adjunto siguen su curso.
  if tg_op = 'UPDATE' and new.detalle is not distinct from old.detalle then
    return new;
  end if;

  v_path := nullif(trim(new.detalle -> 'adjunto' ->> 'path'), '');

  if new.tipo::text = 'desvinculacion'
     and new.detalle ->> 'causal' = 'Renuncia voluntaria'
     and v_path is null
  then
    raise exception 'Para una desvinculación por Renuncia voluntaria es obligatorio adjuntar la carta de renuncia firmada.';
  end if;

  if v_path is not null then
    if split_part(v_path, '/', 1) is distinct from new.solicitante_id::text then
      raise exception 'El documento adjunto no es válido (no lo subió quien crea la solicitud).';
    end if;
    if not exists (
      select 1 from storage.objects where bucket_id = 'solicitud-adjuntos' and name = v_path
    ) then
      raise exception 'No se encontró el documento adjunto. Vuelve a adjuntarlo.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_adjunto_solicitud on public.solicitudes;
create trigger trg_validar_adjunto_solicitud
  before insert or update of detalle on public.solicitudes
  for each row execute function public.validar_adjunto_solicitud();


-- ---------------------------------------------------------------------
-- 6) Registro de recordatorios a aprobadores.
-- ---------------------------------------------------------------------
create table if not exists public.recordatorios_aprobacion (
  id uuid primary key default gen_random_uuid(),
  aprobador_id uuid not null references public.perfiles(id) on delete cascade,
  -- null = recordatorio de RRHH/admin con TODAS las solicitudes en turno
  -- del aprobador; con valor = recordatorio de UNA solicitud.
  solicitud_id uuid references public.solicitudes(id) on delete cascade,
  enviado_por uuid not null references public.perfiles(id),
  origen text not null check (origen in ('rrhh_admin', 'solicitante')),
  -- Folios/códigos incluidos en el correo (auditoría).
  solicitudes_incluidas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recordatorios_aprobacion_aprobador_idx
  on public.recordatorios_aprobacion (aprobador_id, created_at desc);
create index if not exists recordatorios_aprobacion_solicitud_idx
  on public.recordatorios_aprobacion (solicitud_id, created_at desc);

comment on table public.recordatorios_aprobacion is
  'Recordatorios por correo a aprobadores con solicitudes en su turno. Solo los inserta la Edge Function notificar (service role), que además los usa para no repetir el mismo recordatorio antes de RECORDATORIO_ENFRIAMIENTO_HORAS.';

alter table public.recordatorios_aprobacion enable row level security;

drop policy if exists recordatorios_aprobacion_select on public.recordatorios_aprobacion;
create policy recordatorios_aprobacion_select on public.recordatorios_aprobacion
  for select to authenticated
  using (public.rol_actual() in ('admin', 'rrhh') or enviado_por = auth.uid());

-- Solo lectura desde la app: sin políticas de INSERT/UPDATE/DELETE, así
-- que solo el service role (Edge Function) puede escribir.
grant select on public.recordatorios_aprobacion to authenticated;
