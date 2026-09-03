-- Comprobación del paso 4 (migracion_eva_fortalezas.sql)
--
-- El motor de fortalezas tiene reja de privacidad: sin usuario autenticado
-- rechaza, y el SQL Editor corre como postgres. Esta primera línea se hace pasar
-- por el evaluador de la evaluación más avanzada que tengas, sólo para leer.
select set_config('request.jwt.claim.sub',
       (select e.evaluador_id::text from eva_evaluaciones e
        join eva_detalle_sup d on d.evaluacion_id = e.id
        group by e.id, e.evaluador_id order by count(*) desc limit 1), false) as suplantando;

select 'tabla de candidaturas'        as que, count(*)::text as hay, 'existe' as debe,
       case when count(*)=1 then 'OK' else '>>> REVISAR' end as estado
  from information_schema.tables where table_schema='public' and table_name='eva_relator_candidaturas'
union all
select 'curso que forma al relator',
       coalesce((select valor from eva_config_fortalezas where clave='curso_formacion_relator'),'(vacío)'),
       'L-08',
       case when (select valor from eva_config_fortalezas where clave='curso_formacion_relator')='L-08'
            then 'OK' else '>>> REVISAR' end
union all
select 'ese curso está en tu catálogo',
       coalesce((select nombre from eva_cursos where codigo='L-08'),'(no está)'),
       'Formación de relatores internos (metodología N4)',
       case when exists (select 1 from eva_cursos where codigo='L-08') then 'OK' else '>>> REVISAR' end
union all
select 'el PDI acepta líneas de relator',
       case when pg_get_constraintdef(oid) like '%relator%' then 'sí' else 'no' end,
       'sí',
       case when pg_get_constraintdef(oid) like '%relator%'
             and pg_get_constraintdef(oid) like '%profundizacion%'
             and pg_get_constraintdef(oid) like '%reconocimiento%'
            then 'OK' else '>>> REVISAR' end
  from pg_constraint where conname = 'eva_pdi_origen_check'
order by estado desc, que;

-- Y lo que de verdad importa: qué propone el motor sobre TU evaluación.
select f.tipo,
       coalesce(f.dimension_nombre,'—')  as seccion,
       f.titulo,
       coalesce(f.criterio_codigo,'—')   as respaldo
from eva_motor_fortalezas(
       (select e.id from eva_evaluaciones e
        join eva_detalle_sup d on d.evaluacion_id = e.id
        group by e.id order by count(*) desc limit 1)) f
where f.tipo <> 'reconocimiento'
order by f.tipo, seccion;
