-- Comprobación del paso 3 (migracion_eva_motor_secciones.sql)
select 'tramos de sección NC..EX' as que, count(*)::text as hay, '5' as debe,
       case when count(*)=5 then 'OK' else '>>> REVISAR' end as estado
  from eva_segmento_tramos
union all
select 'orden de las 5 secciones', string_agg(codigo, '→' order by orden), 'TC→SS→DL→VH→CM',
       case when string_agg(codigo,'→' order by orden)='TC→SS→DL→VH→CM' then 'OK' else '>>> REVISAR' end
  from eva_dimensiones
union all
select 'tramo de un promedio 4,33', eva_tramo_de(4.33), 'SE',
       case when eva_tramo_de(4.33)='SE' then 'OK' else '>>> REVISAR' end
union all
select 'tramo de un promedio 4,49', eva_tramo_de(4.49), 'SE',
       case when eva_tramo_de(4.49)='SE' then 'OK' else '>>> REVISAR' end
union all
select 'tramo de un promedio 4,50', eva_tramo_de(4.50), 'EX',
       case when eva_tramo_de(4.50)='EX' then 'OK' else '>>> REVISAR' end
union all
select 'composición de Disciplina Laboral',
       (select cap||' CAP / '||con||' CON' from eva_seccion_composicion() where dimension_codigo='DL'),
       '1 CAP / 5 CON',
       case when (select cap||' CAP / '||con||' CON' from eva_seccion_composicion() where dimension_codigo='DL')='1 CAP / 5 CON'
            then 'OK' else '>>> REVISAR' end
order by estado desc, que;
