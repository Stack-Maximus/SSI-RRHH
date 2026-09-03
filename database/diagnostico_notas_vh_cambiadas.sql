-- Las 3 notas puestas en VH2 / VH3 / VH6: ¿de quién son y en qué estado están?
select
  p.nombre                as evaluado,
  c.titulo                as ciclo,
  e.estado,
  d.criterio_codigo       as criterio,
  d.nota,
  cr.texto_criterio       as dice_ahora,
  case d.criterio_codigo
    when 'VH2' then 'Adaptabilidad — respuesta a cambios de carga, prioridades y procesos'
    when 'VH3' then 'Compromiso — esfuerzo en cierres y plazos críticos; disponibilidad'
    when 'VH6' then 'Trabajo en equipo y comunicación efectiva'
  end                     as decia_cuando_se_calificó,
  case when d.comentario_evidencia is null then '— sin comentario —' else left(d.comentario_evidencia, 60) end as comentario
from eva_detalle_sup d
join eva_evaluaciones e  on e.id = d.evaluacion_id
join perfiles p          on p.id = e.evaluado_id
join eva_criterios cr    on cr.codigo = d.criterio_codigo
left join eva_ciclos c   on c.id = e.ciclo_id
where d.criterio_codigo in ('VH2','VH3','VH6')
order by p.nombre, d.criterio_codigo;
