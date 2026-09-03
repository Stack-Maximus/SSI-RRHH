-- =====================================================================
-- 0007_solicitudes_cambios_rpc.sql
-- RPC + políticas para los 4 tipos de solicitud nuevos (aumento de
-- sueldo, bono, cambio de cargo, renovación). Va separado de 0006 por la
-- misma razón que 0001 va separado de 0002: no se pueden usar valores de
-- enum recién creados dentro de la misma transacción en que se agregaron.
--
-- Ejecutar después de 0001-0006.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) RPC: crea la solicitud + su única aprobación (el administrador de
--    obra del centro de costo del trabajador). SECURITY DEFINER para no
--    depender de qué políticas de INSERT existen hoy en `solicitudes` /
--    `aprobaciones` (igual que ya hace `crear_solicitud()` para
--    ingreso/traslado).
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
  if v_rol is null or v_rol not in ('supervisor', 'admin') then
    raise exception 'Solo un supervisor puede levantar este tipo de solicitud.';
  end if;

  if p_tipo::text not in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion') then
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

grant execute on function public.crear_solicitud_cambio(public.tipo_solicitud, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Políticas de SELECT adicionales, acotadas a estos 4 tipos, para que
--    quien las creó pueda verlas en "Mis solicitudes" pase lo que pase
--    con las políticas existentes de `solicitudes` / `aprobaciones`
--    (si ya las cubren por ser genéricas, esto queda simplemente
--    redundante y sin efecto — no puede romper nada porque solo agrega
--    visibilidad, nunca la quita).
-- ---------------------------------------------------------------------
drop policy if exists solicitudes_cambio_solicitante_select on public.solicitudes;
create policy solicitudes_cambio_solicitante_select on public.solicitudes
  for select to authenticated
  using (
    tipo::text in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion')
    and solicitante_id = auth.uid()
  );

drop policy if exists aprobaciones_cambio_solicitante_select on public.aprobaciones;
create policy aprobaciones_cambio_solicitante_select on public.aprobaciones
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitudes s
      where s.id = solicitud_id
        and s.tipo::text in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion')
        and s.solicitante_id = auth.uid()
    )
  );
