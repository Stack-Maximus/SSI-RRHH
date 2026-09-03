-- ============================================================================
-- Notifica al responsable de una acción de No Conformidad apenas se le
-- asigna — mismo patrón que ya usamos en Postventa para el plan de acción.
-- ============================================================================

create or replace function trigger_notificar_accion_nc_asignada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folio text;
begin
  if new.responsable_id is not null then
    select folio into v_folio from nc_registro where id = new.nc_id;

    insert into notificaciones (usuario_id, modulo, titulo, mensaje)
    values (
      new.responsable_id,
      'no_conformidades',
      'Acción de NC asignada',
      'Se te asignó una acción para la NC ' || coalesce(v_folio, '—') || ': ' || coalesce(new.accion, 'sin descripción') ||
      case when new.plazo is not null then ' — plazo: ' || to_char(new.plazo, 'DD/MM/YYYY') else '' end
    );
  end if;
  return new;
end;
$$;

create trigger on_accion_nc_asignada
  after insert on nc_acciones
  for each row execute function trigger_notificar_accion_nc_asignada();
