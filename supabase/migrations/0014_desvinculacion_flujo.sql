-- =====================================================================
-- 0014_desvinculacion_flujo.sql
-- Activa el nuevo tipo 'desvinculacion' (agregado en 0013) en todos los
-- mecanismos que ya usan los otros 4 tipos "de cambio" (aumento_sueldo,
-- bono, cambio_cargo, renovación): mismo RPC, mismas políticas, mismo
-- folio correlativo, mismo cierre "Marcar como procesado". Aprueba un
-- único aprobador (el administrador de obra del centro de costo del
-- trabajador), igual que esos 4 tipos.
--
-- Va separado de 0013 por la misma razón que 0001 va separado de 0002:
-- no se puede usar 'desvinculacion' (agregado en 0013) hasta que ese
-- ALTER TYPE haga commit.
--
-- Además: al aprobarse una desvinculación, el trabajador queda marcado
-- `activo = false` (ya no debe aparecer como candidato para nuevas
-- solicitudes -- traslado, aumento de sueldo, etc.). 100% aditivo: no
-- toca ningún trigger/política existente, solo agrega los propios.
--
-- Ejecutar después de 0001-0013.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) crear_solicitud_cambio(): agrega 'desvinculacion' a los tipos válidos.
--    Mismo cuerpo que 0007, un solo cambio en la lista del `not in`.
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

-- ---------------------------------------------------------------------
-- 2) Políticas de SELECT: agregan 'desvinculacion' a la lista acotada
--    (mismo criterio que 0007: agregan visibilidad, nunca la quitan).
-- ---------------------------------------------------------------------
drop policy if exists solicitudes_cambio_solicitante_select on public.solicitudes;
create policy solicitudes_cambio_solicitante_select on public.solicitudes
  for select to authenticated
  using (
    tipo::text in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion')
    and solicitante_id = auth.uid()
  );

drop policy if exists aprobaciones_cambio_solicitante_select on public.aprobaciones;
create policy aprobaciones_cambio_solicitante_select on public.aprobaciones
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitudes s
      where s.id = solicitud_id
        and s.tipo::text in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion')
        and s.solicitante_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 3) "Marcar como procesado" (0012): agrega 'desvinculacion' al grupo de
--    tipos sin documento propio que RRHH cierra a mano.
-- ---------------------------------------------------------------------
drop policy if exists solicitudes_rrhh_marcar_procesado on public.solicitudes;
create policy solicitudes_rrhh_marcar_procesado on public.solicitudes
  for update to authenticated
  using (
    public.rol_actual() in ('admin', 'rrhh')
    and tipo in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion')
    and estado = 'aprobada'
    and procesado_rrhh_at is null
  )
  with check (
    public.rol_actual() in ('admin', 'rrhh')
    and tipo in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion')
  );

-- ---------------------------------------------------------------------
-- 4) Folio correlativo (0010): prefijo propio + fila inicial en el
--    contador. Mismo cuerpo que 0010, un solo `when` nuevo en el case.
-- ---------------------------------------------------------------------
insert into public.folios_correlativos (tipo, siguiente) values ('desvinculacion', 1)
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
    when 'renovacion'      then 'RRH-REN-'
    when 'desvinculacion'  then 'RRH-DES-'
    else null
  end;

  if v_prefijo is null then
    return new; -- tipo no contemplado en la codificación (por ahora no debería pasar)
  end if;

  insert into public.folios_correlativos (tipo, siguiente)
    values (new.tipo::text, 2)
    on conflict (tipo) do update set siguiente = folios_correlativos.siguiente + 1
    returning siguiente - 1 into v_num;

  new.folio := v_prefijo || lpad(v_num::text, 6, '0');
  return new;
end;
$$;
-- (el trigger trg_asignar_folio_solicitud ya existe desde 0010 y apunta a
-- esta misma función por nombre -- CREATE OR REPLACE le basta, no hace
-- falta recrear el trigger).

-- ---------------------------------------------------------------------
-- 5) Al aprobarse una desvinculación, el trabajador queda inactivo (ya
--    no debe ofrecerse como candidato para nuevas solicitudes).
-- ---------------------------------------------------------------------
create or replace function public.desactivar_trabajador_por_desvinculacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo::text = 'desvinculacion'
     and new.estado = 'aprobada'
     and (old.estado is distinct from new.estado)
     and new.trabajador_id is not null
  then
    update public.trabajadores set activo = false where id = new.trabajador_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_desactivar_trabajador_por_desvinculacion on public.solicitudes;
create trigger trg_desactivar_trabajador_por_desvinculacion
  after update of estado on public.solicitudes
  for each row execute function public.desactivar_trabajador_por_desvinculacion();
