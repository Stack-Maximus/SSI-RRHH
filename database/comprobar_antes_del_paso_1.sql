-- ¿Hay evaluaciones ya cerradas cuyas notas quedarían asociadas al texto nuevo?
select
  count(*) filter (where e.estado in ('cerrada_conforme','cerrada_disconformidad','archivada'))          as cerradas,
  count(*) filter (where e.estado not in ('cerrada_conforme','cerrada_disconformidad','archivada'))      as en_curso,
  (select count(*) from eva_detalle_sup)                                                                 as notas_de_supervisor,
  (select count(*) from eva_detalle_sup d
     where d.criterio_codigo in ('VH2','VH3','VH6') )                                                    as notas_en_vh2_vh3_vh6
from eva_evaluaciones e;
