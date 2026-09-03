-- ============================================================================
-- Notifica al evaluado cuando RRHH le entrega el resultado de su evaluación
-- (estado pasa a 'entregada_trabajador') — antes esta transición no
-- disparaba ningún aviso porque no existía la acción en el frontend.
-- ============================================================================

create or replace function trigger_notificar_resultado_entregado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'entregada_trabajador' and old.estado is distinct from new.estado then
    insert into notificaciones (usuario_id, modulo, titulo, mensaje)
    values (
      new.evaluado_id,
      'personal',
      'Resultado de tu evaluación disponible',
      'Ya puedes ver el resultado de tu evaluación y responder si estás conforme.'
    );
  end if;
  return new;
end;
$$;

create trigger on_resultado_entregado
  after update on eva_evaluaciones
  for each row execute function trigger_notificar_resultado_entregado();
