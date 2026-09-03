-- ANTES del paso 2: ¿el acta de 4 firmas va a trabar algo?
select
  (select count(*) from modulo_accesos where modulo='personal' and rol='crecimiento_bienestar')      as personas_con_rol_bienestar,
  (select count(*) from eva_evaluaciones where estado='pendiente_firmas')                            as evaluaciones_esperando_firmas,
  (select count(*) from eva_evaluaciones e where e.estado='pendiente_firmas'
     and (select count(*) from eva_firmas f where f.evaluacion_id=e.id) = 3)                         as con_las_3_firmas_ya_puestas;
