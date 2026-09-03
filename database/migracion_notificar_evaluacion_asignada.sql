-- ============================================================================
-- Notifica al evaluado apenas se le asigna una evaluación dentro de un
-- ciclo — ese es el momento real en que "empieza" su autoevaluación, no
-- cuando se crea el ciclo en sí (ahí todavía no tiene nada que hacer).
-- ============================================================================

create or replace function trigger_notificar_evaluacion_asignada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo_ciclo text;
begin
  select titulo into v_titulo_ciclo from eva_ciclos where id = new.ciclo_id;

  insert into notificaciones (usuario_id, modulo, titulo, mensaje)
  values (
    new.evaluado_id,
    'personal',
    'Nueva autoevaluación asignada',
    'Se inició tu ciclo de evaluación "' || coalesce(v_titulo_ciclo, 'sin ciclo') || '" — ya puedes completar tu autoevaluación.'
  );

  return new;
end;
$$;

create trigger on_evaluacion_asignada
  after insert on eva_evaluaciones
  for each row execute function trigger_notificar_evaluacion_asignada();
