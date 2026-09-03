-- ============================================================================
-- Datos de prueba: una evaluación ya consolidada, para probar el export
-- SIN pasar por todo el flujo de autoevaluación + evaluador.
-- Reemplaza el correo por el tuyo. Usa tu propio id como evaluado Y evaluador
-- solo para esta prueba (la app no lo permitiría vía UI, pero a nivel de BD
-- no hay restricción — es un atajo de testing, no el flujo real).
-- ============================================================================

do $$
declare
  v_uid uuid;
  v_ciclo_id uuid;
  v_eval_id uuid;
begin
  select id into v_uid from auth.users where email = 'tu-correo@metalium.cl';

  insert into eva_ciclos (titulo, tipo_periodo, fecha_apertura, estado)
  values ('2026-S2 (prueba)', '2do_semestre', current_date, 'abierto')
  returning id into v_ciclo_id;

  insert into eva_evaluaciones (
    ciclo_id, evaluado_id, evaluador_id, cargo_evaluador, estado,
    rut, cargo_actual, fecha_ingreso, centro_trabajo,
    prom_auto_tc, prom_auto_ss, prom_auto_dl, prom_auto_vh, prom_auto_cm, total_auto,
    prom_sup_tc, prom_sup_ss, prom_sup_dl, prom_sup_vh, prom_sup_cm, total_sup,
    brecha_tc, brecha_ss, brecha_dl, brecha_vh, brecha_cm, brecha_total,
    categoria, decision_asociada
  ) values (
    v_ciclo_id, v_uid, v_uid, 'Jefe de Prueba', 'consolidada',
    '11.111.111-1', 'Analista de Calidad', '2024-03-01', 'Oficina Central',
    4.2, 4.0, 4.5, 4.3, 4.1, 4.20,
    4.0, 3.8, 4.2, 4.1, 3.9, 4.00,
    -0.2, -0.2, -0.3, -0.2, -0.2, -0.20,
    'destacado', 'Reconocimiento formal del equipo'
  )
  returning id into v_eval_id;

  insert into eva_detalle_auto (evaluacion_id, criterio_codigo, nota, comentario)
  select v_eval_id, codigo, 4, 'Comentario de autoevaluación de prueba'
  from eva_criterios;

  insert into eva_detalle_sup (evaluacion_id, criterio_codigo, nota, comentario_evidencia)
  select v_eval_id, codigo, 4, 'Comentario del evaluador de prueba'
  from eva_criterios;

  raise notice 'Evaluación de prueba creada: %', v_eval_id;
end $$;
