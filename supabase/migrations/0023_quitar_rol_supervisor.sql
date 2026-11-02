-- =====================================================================
-- 0023_quitar_rol_supervisor.sql   (nov. 2026, a pedido)
--
-- Supervisor y Solicitante ya hacen exactamente lo mismo (desde 0019 el
-- solicitante crea todos los tipos), así que se deja de usar el rol
-- 'supervisor':
--   1. Las cuentas con rol 'supervisor' pasan a 'solicitante' (perfil y
--      metadatos de la cuenta).
--   2. crear_solicitud_cambio() y la política de subida de adjuntos ya no lo
--      nombran (mismo cuerpo que 0022, solo sale de la lista).
--   3. Una restricción impide volver a asignarlo por error.
-- El valor 'supervisor' queda en el tipo user_role (Postgres no permite
-- quitar un valor de un enum sin rehacer el tipo y todo lo que lo usa), pero
-- ya no lo puede tener ningún usuario.
--
-- El aviso de contratos por vencer (Edge Function vencimientos-contrato)
-- deja de buscar Supervisores: le llega a RRHH y al administrador de obra
-- del centro del trabajador (hay que volver a desplegarla).
--
-- Ejecutar después de 0022. Se puede correr más de una vez.
-- =====================================================================

-- 1) Supervisores -> Solicitantes
update public.perfiles set rol = 'solicitante' where rol::text = 'supervisor';

update auth.users
set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('rol', 'solicitante')
where raw_user_meta_data ->> 'rol' = 'supervisor';


-- 2) crear_solicitud_cambio() sin 'supervisor'
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
  if v_rol is null or v_rol not in ('solicitante', 'admin') then
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

drop policy if exists storage_solicitud_adjuntos_insert on storage.objects;
create policy storage_solicitud_adjuntos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'solicitud-adjuntos'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.rol_actual() in ('solicitante', 'admin')
  );


-- 3) Que no se vuelva a asignar
alter table public.perfiles drop constraint if exists perfiles_rol_sin_supervisor;
alter table public.perfiles add constraint perfiles_rol_sin_supervisor
  check (rol::text <> 'supervisor');

-- Resultado
select rol::text as rol, count(*) as usuarios
from public.perfiles
group by rol
order by rol;
