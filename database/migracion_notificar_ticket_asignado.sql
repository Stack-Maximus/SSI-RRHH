-- ============================================================================
-- Notifica al responsable técnico apenas se le asigna un ticket de
-- Postventa (en el triage, o en cualquier reasignación posterior).
-- ============================================================================

create or replace function trigger_notificar_ticket_asignado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.responsable_id is not null and (old.responsable_id is distinct from new.responsable_id) then
    insert into notificaciones (usuario_id, modulo, titulo, mensaje)
    values (
      new.responsable_id,
      'postventa',
      'Ticket de postventa asignado',
      'Se te asignó el ticket ' || new.numero_ticket || ' — ' || coalesce(new.obra, 'obra sin especificar') || '. Revisa el detalle para continuar.'
    );
  end if;
  return new;
end;
$$;

create trigger on_ticket_postventa_asignado
  after update on pv_tickets
  for each row execute function trigger_notificar_ticket_asignado();
