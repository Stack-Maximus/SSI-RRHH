-- =====================================================================
-- 0019_solicitante_tipos_cambio.sql
-- Unifica en el rol `solicitante` los 5 tipos de solicitud que hasta
-- ahora solo podía levantar `supervisor` (aumento_sueldo, bono,
-- cambio_cargo, renovacion, desvinculacion) -- a pedido explícito:
-- "dejalo unificado ... hacia Solicitante únicamente".
--
-- El front (TIPOS_SOLICITUD_POR_ROL en config.js) ya decide qué pestañas
-- ve cada rol en "Nueva solicitud" -- ese cambio no necesita SQL. Pero
-- la puerta REAL está acá, en crear_solicitud_cambio() (0007, reemplazada
-- entera en 0014 para sumar 'desvinculacion'): esa función rechaza de
-- entrada a cualquiera que no sea 'supervisor' o 'admin', así que sin
-- este archivo el botón nuevo le tiraría un error de permiso a un
-- solicitante aunque el front ya le muestre la pestaña.
--
-- 100% aditivo sobre 0014: mismo cuerpo, un solo rol agregado a la lista
-- del `not in` + mensaje de error genérico (ya no es cierto que "solo
-- un supervisor" pueda). No toca las políticas de SELECT de 0007/0014
-- (esas ya filtran por `solicitante_id = auth.uid()`, no por rol, así
-- que ya funcionan para cualquiera que haya creado la solicitud).
--
-- El rol `supervisor` NO se tocó ni se quitó -- sigue existiendo y
-- sigue pudiendo levantar estos mismos 5 tipos, por si ya tienes cuentas
-- con ese rol asignado. Si en algún momento quieres eliminarlo del todo,
-- es un paso aparte (avísame).
--
-- Ejecutar después de 0001-0018 (no depende de 0017/0018, pero sigue el
-- orden correlativo de siempre).
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
  v_centro_id uuid;
  v_admin_obra_id uuid;
  v_solicitud public.solicitudes;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol not in ('solicitante', 'supervisor', 'admin') then
    raise exception 'No tienes permiso para levantar este tipo de solicitud.';
  end if;

  if p_tipo::text not in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion') then
    raise exception 'Tipo de solicitud no válido para crear_solicitud_cambio().';
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
