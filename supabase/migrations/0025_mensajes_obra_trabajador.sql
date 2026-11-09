-- =====================================================================
-- 0025_mensajes_obra_trabajador.sql   (nov. 2026)
--
-- Al pedir una Desvinculación (o Aumento, Cambio de cargo, Cambio de turno,
-- Renovación) el sistema decía "El trabajador no existe o no tiene centro
-- de costo asignado" o "El centro de costo de este trabajador no tiene
-- administrador de obra", sin decir de QUÉ trabajador ni de QUÉ obra, y se
-- confundía una cosa con la otra.
--
-- Mismo crear_solicitud_cambio() que 0023 (mismas reglas), solo cambian los
-- mensajes: ahora nombran al trabajador y a la obra, y dicen dónde se
-- corrige.
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar y Run. O:
--   node supabase\mantencion\sql.mjs supabase\migrations\0025_mensajes_obra_trabajador.sql --aplicar
-- Se puede correr más de una vez.
-- =====================================================================

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
  v_trab record;
  v_centro record;
  v_nombre text;
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

  select t.* into v_trab from public.trabajadores t where t.id = p_trabajador_id;
  if not found then
    raise exception 'El trabajador seleccionado ya no existe en el maestro de Trabajadores. Recarga la página e inténtalo de nuevo.';
  end if;
  v_nombre := coalesce(nullif(trim(v_trab.nombre), ''), concat_ws(' ', v_trab.nombres, v_trab.apellido_paterno, v_trab.apellido_materno), 'seleccionado');

  if v_trab.centro_costo_id is null then
    raise exception 'El trabajador % (RUT %) no tiene obra (centro de costo) en el maestro de Trabajadores. Pídele al administrador del sistema que se la asigne en Trabajadores.',
      v_nombre, coalesce(v_trab.rut, 's/i');
  end if;

  select c.id, c.codigo, c.nombre, c.admin_obra_id into v_centro
  from public.centros_costo c where c.id = v_trab.centro_costo_id;
  if v_centro.admin_obra_id is null then
    raise exception 'La obra % (%) del trabajador % no tiene administrador de obra asignado, y es quien debe aprobar. Pídele al administrador del sistema que lo asigne en Centros de costo.',
      v_centro.codigo, left(coalesce(v_centro.nombre, ''), 60), v_nombre;
  end if;

  insert into public.solicitudes (tipo, solicitante_id, trabajador_id, centro_origen_id, detalle)
  values (p_tipo, auth.uid(), p_trabajador_id, v_trab.centro_costo_id, coalesce(p_detalle, '{}'::jsonb))
  returning * into v_solicitud;

  insert into public.aprobaciones (solicitud_id, aprobador_id, orden)
  values (v_solicitud.id, v_centro.admin_obra_id, 1);

  return v_solicitud;
end;
$$;

grant execute on function public.crear_solicitud_cambio(public.tipo_solicitud, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

select 'crear_solicitud_cambio actualizada: los mensajes ahora nombran al trabajador y a la obra' as resultado;
