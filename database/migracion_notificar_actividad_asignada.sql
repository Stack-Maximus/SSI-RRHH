-- ============================================================================
-- Notifica al responsable de una actividad específica del plan de acción
-- de Postventa — puede ser distinto del responsable general del ticket.
-- ============================================================================

create or replace function trigger_notificar_actividad_asignada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero_ticket text;
begin
  if new.responsable_id is not null then
    select numero_ticket into v_numero_ticket from pv_tickets where id = new.ticket_id;

    insert into notificaciones (usuario_id, modulo, titulo, mensaje)
    values (
      new.responsable_id,
      'postventa',
      'Nueva actividad asignada',
      'Se te asignó la actividad "' || coalesce(new.actividad, 'sin descripción') || '" del ticket ' || coalesce(v_numero_ticket, '—') || '.'
    );
  end if;
  return new;
end;
$$;

create trigger on_actividad_asignada
  after insert on pv_plan_accion
  for each row execute function trigger_notificar_actividad_asignada();
