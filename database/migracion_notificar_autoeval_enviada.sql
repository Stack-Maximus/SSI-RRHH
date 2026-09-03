-- ============================================================================
-- Notifica al evaluador apenas su evaluado envía la autoevaluación —
-- ese es el momento en que la jefatura ya puede calificar.
-- ============================================================================

create or replace function trigger_notificar_autoevaluacion_enviada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_evaluado text;
begin
  if new.estado = 'autoevaluacion_enviada' and old.estado is distinct from new.estado then
    select nombre into v_nombre_evaluado from perfiles where id = new.evaluado_id;

    insert into notificaciones (usuario_id, modulo, titulo, mensaje)
    values (
      new.evaluador_id,
      'personal',
      'Autoevaluación lista para calificar',
      coalesce(v_nombre_evaluado, 'Un trabajador') || ' ya completó su autoevaluación — puedes continuar con tu evaluación.'
    );
  end if;
  return new;
end;
$$;

create trigger on_autoevaluacion_enviada
  after update on eva_evaluaciones
  for each row execute function trigger_notificar_autoevaluacion_enviada();
