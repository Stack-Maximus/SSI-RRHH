-- =====================================================================
-- 0017_editar_solicitud.sql
-- Permite al solicitante editar una solicitud DESPUÉS de creada, pero
-- solo mientras nadie la haya tocado todavía:
--
--   - Solo quien la creó (solicitudes.solicitante_id = auth.uid()).
--   - Solo mientras estado = 'pendiente'.
--   - Solo si NINGÚN aprobador tomó una decisión todavía (ni aprobó ni
--     rechazó a nadie -- apenas el primero decide, se bloquea la edición
--     para no invalidar una decisión ya tomada sobre datos que después
--     cambiaron).
--
-- Qué se puede editar: el motivo y el `detalle` (JSONB) -- o sea, los
-- mismos campos "de contenido" que ya se completan al crear la solicitud
-- (cargo, sueldo, turno, horario, fechas, causal, etc., según el tipo).
--
-- Qué NO se puede editar acá: tipo, trabajador_id, centro_origen_id,
-- centro_destino_id. Esos 4 campos son los que definen QUIÉN debe aprobar
-- (administrador de obra del centro, Gerente de Operaciones, y en traslado
-- también el administrador de obra del centro contrario) -- cambiarlos
-- implicaría recalcular aprobadores en medio de un flujo de aprobación, y
-- esa lógica de resolución automática vive en crear_solicitud() /
-- crear_solicitud_cambio() (fuera de estas migraciones, en el esquema base
-- del proyecto), no se duplica acá para no arriesgar que quede
-- inconsistente. Si en algún momento hace falta poder cambiar la obra o el
-- trabajador de una solicitud ya creada, lo más simple y seguro sigue
-- siendo cancelarla y levantar una nueva -- ese cambio si hace falta se
-- construye aparte, con la lógica de resolución de aprobadores a la vista.
--
-- SECURITY DEFINER (mismo criterio que crear_solicitud/crear_solicitud_cambio):
-- hace sus propias validaciones de dueño/estado/decisiones adentro, así que
-- no hace falta agregar una política RLS de UPDATE nueva en `solicitudes`.
--
-- Ejecutar después de 0001-0016.
-- =====================================================================

create or replace function public.editar_solicitud(
  p_solicitud_id uuid,
  p_motivo text,
  p_detalle jsonb default '{}'::jsonb
)
returns public.solicitudes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes;
  v_decisiones integer;
begin
  -- Bloquea la fila mientras se valida, para no pisarse con una aprobación
  -- que llegue justo en este instante.
  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;

  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.';
  end if;

  if v_solicitud.solicitante_id <> auth.uid() then
    raise exception 'Solo quien creó la solicitud puede editarla.';
  end if;

  if v_solicitud.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya no se puede editar (no está pendiente).';
  end if;

  select count(*) into v_decisiones
  from public.aprobaciones
  where solicitud_id = p_solicitud_id and decision <> 'pendiente';

  if v_decisiones > 0 then
    raise exception 'Esta solicitud ya no se puede editar: al menos un aprobador ya tomó una decisión.';
  end if;

  update public.solicitudes
    set motivo = p_motivo,
        detalle = coalesce(p_detalle, '{}'::jsonb)
    where id = p_solicitud_id
    returning * into v_solicitud;

  return v_solicitud;
end;
$$;

grant execute on function public.editar_solicitud(uuid, text, jsonb) to authenticated;
