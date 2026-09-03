-- =====================================================================
-- 0008_fecha_termino_contrato.sql
-- Campo centralizado para saber cuándo vence el contrato de cada
-- trabajador (base para el correo de "próximos vencimientos" y para el
-- Perfil del trabajador). Es editable a mano (RRHH, en Trabajadores /
-- Excel) y además se actualiza solo cuando se APRUEBA una solicitud de
-- tipo 'renovacion':
--   - si trae una fecha concreta (`detalle.nueva_fecha_termino`), esa
--     pasa a ser la nueva fecha de término.
--   - si viene marcada como indefinida (`detalle.indefinido = true` --
--     el contrato deja de tener fecha de término, se puede volver a
--     "renovar" sin límite), se limpia la fecha de término y el
--     trabajador queda marcado `contrato_indefinido = true`; deja de
--     aparecer en el aviso de próximos vencimientos.
-- Si la renovación solo trae `nuevo_plazo` (texto libre, ej. "3 meses más")
-- y no está marcada indefinida, no se puede calcular una fecha exacta,
-- así que en ese caso NO se actualiza sola -- RRHH la ajusta manualmente.
--
-- 100% aditivo: columnas nuevas + nuevo trigger con nombre propio en
-- `solicitudes` (no toca ni reemplaza ningún trigger existente).
--
-- Ejecutar después de 0001-0007.
-- =====================================================================

alter table public.trabajadores
  add column if not exists fecha_termino_contrato date;

alter table public.trabajadores
  add column if not exists contrato_indefinido boolean not null default false;

comment on column public.trabajadores.fecha_termino_contrato is
  'Fecha de término del contrato vigente (solo aplica si contrato_indefinido = false). Editable manualmente y actualizada automáticamente cuando se aprueba una solicitud de renovación con fecha exacta.';

comment on column public.trabajadores.contrato_indefinido is
  'true cuando el contrato ya no tiene fecha de término (pasó a indefinido vía una renovación aprobada, o se marcó manualmente). Mientras sea true, el trabajador no entra al aviso de próximos vencimientos y fecha_termino_contrato se ignora.';

create or replace function public.actualizar_fecha_termino_por_renovacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date;
  v_indefinido boolean;
begin
  if new.tipo::text = 'renovacion'
     and new.estado = 'aprobada'
     and (old.estado is distinct from new.estado)
     and new.trabajador_id is not null
  then
    v_indefinido := coalesce((new.detalle ->> 'indefinido')::boolean, false);

    if v_indefinido then
      -- El contrato pasa a indefinido: ya no vence, se puede seguir
      -- "renovando" (cambio de sueldo/cargo, etc.) sin límite de veces.
      update public.trabajadores
        set contrato_indefinido = true, fecha_termino_contrato = null
        where id = new.trabajador_id;
    elsif (new.detalle ->> 'nueva_fecha_termino') is not null then
      begin
        v_fecha := (new.detalle ->> 'nueva_fecha_termino')::date;
      exception when others then
        v_fecha := null;
      end;

      if v_fecha is not null then
        update public.trabajadores
          set fecha_termino_contrato = v_fecha, contrato_indefinido = false
          where id = new.trabajador_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_actualizar_fecha_termino_renovacion on public.solicitudes;
create trigger trg_actualizar_fecha_termino_renovacion
  after update of estado on public.solicitudes
  for each row execute function public.actualizar_fecha_termino_por_renovacion();
