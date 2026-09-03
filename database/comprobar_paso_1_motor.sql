-- Comprobación del paso 1 (migracion_eva_motor_pdi.sql)
select 'cursos de la batería'   as que, count(*) as hay, 160 as debe, case when count(*)=160 then 'OK' else '>>> REVISAR' end as estado from eva_cursos
union all
select 'matriz curso × familia', count(*), 626, case when count(*)=626 then 'OK' else '>>> REVISAR' end from eva_curso_familia
union all
select 'mapeos criterio × curso', count(*), 92, case when count(*)=92 then 'OK' else '>>> REVISAR' end from eva_criterio_cursos
union all
select 'cargos del catálogo', count(*), 54, case when count(*)=54 then 'OK' else '>>> REVISAR' end from eva_cargos_catalogo
union all
select 'criterios capacitables (CAP)', count(*), 22, case when count(*)=22 then 'OK' else '>>> REVISAR' end from eva_criterios where tipo='CAP'
union all
select 'criterios conductuales (CON)', count(*), 8, case when count(*)=8 then 'OK' else '>>> REVISAR' end from eva_criterios where tipo='CON'
union all
select 'horas de la batería gatillable', sum(horas)::bigint, 646, case when sum(horas)=646 then 'OK' else '>>> REVISAR' end
  from eva_cursos where codigo in (select curso_codigo from eva_criterio_cursos)
order by estado desc, que;
