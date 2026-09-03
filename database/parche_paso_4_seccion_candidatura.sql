-- ============================================================================
-- SGC METALIUM · PARCHE del paso 4 — la sección de una candidatura a relator
--
-- QUÉ ARREGLA
--
-- Una candidatura a relator se consolida por DOMINIO de la batería, y un
-- dominio junta criterios de varias secciones. La versión que quedó en el zip
-- etiquetaba la candidatura con UNA sección elegida con min(), o sea la primera
-- alfabéticamente — que no es ni la que más aporta. Salía así:
--
--   «Relator interno N4 · HABILIDADES BLANDAS»  respaldo TC2·SS4·VH3·VH4·VH5·VH6
--   sección: «Competencias Funcionales del Cargo»      ← arbitrario, y falso
--
-- Y ese texto viajaba a la línea del PDI como dimension_criterio.
--
-- Ahora sólo se nombra la sección cuando la candidatura viene toda de una; si
-- cruza varias dice «3 secciones» y manda el dominio, que es de lo que la
-- candidatura habla en realidad.
--
-- CÓMO SE APLICA
--
-- Pégalo completo en el SQL Editor y ejecútalo. Sólo reemplaza una función: no
-- toca tablas, no toca datos, no borra nada. Se puede correr las veces que sea.
--
-- Requiere tener ya aplicados los pasos 1, 3 y 4.
-- ============================================================================


create or replace function eva_motor_fortalezas(p_evaluacion_id uuid)
returns table (
  tipo text,
  criterio_codigo text,
  criterio_texto text,
  dimension_codigo text,
  dimension_nombre text,
  nota integer,
  promedio_seccion numeric,
  tramo_sigla text,
  titulo text,
  detalle text,
  dominio_sugerido text,
  accion_sugerida text,
  genera_linea boolean,
  ya_registrada boolean,
  orden_salida integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not eva_puede_ver_evaluacion(p_evaluacion_id) then
    raise exception 'No tiene permiso para ver las fortalezas de esta evaluación'
      using errcode = '42501';
  end if;

  return query
  with notas as (
    select c.codigo as criterio_codigo, c.texto_criterio, c.tipo as tipo_criterio,
           c.dimension_codigo, coalesce(d.orden, 9) * 10 + coalesce(c.orden, 9) as orden_criterio,
           d.nombre as dimension_nombre, ds.nota
    from eva_criterios c
    left join eva_dimensiones d on d.codigo = c.dimension_codigo
    join eva_detalle_sup ds
      on ds.criterio_codigo = c.codigo and ds.evaluacion_id = p_evaluacion_id
    where ds.nota is not null
  ),
  secs as (select * from eva_motor_pdi_secciones(p_evaluacion_id)),
  -- El dominio de la batería donde la persona destaca. Se infiere de los cursos
  -- mapeados a ese criterio: si el criterio se cierra con cursos de un dominio,
  -- quien lo domina puede relatar en ese dominio. Es una sugerencia, no un dato
  -- de tus planillas.
  dominios as (
    select cc.criterio_codigo, cu.dominio, count(*) as n
    from eva_criterio_cursos cc
    join eva_cursos cu on cu.codigo = cc.curso_codigo
    group by cc.criterio_codigo, cu.dominio
  ),
  dominio_top as (
    -- Los alias van cualificados: «criterio_codigo» a secas choca con el
    -- parámetro de salida de la función y Postgres lo rechaza por ambiguo.
    select distinct on (dd.criterio_codigo) dd.criterio_codigo, dd.dominio
    from dominios dd
    order by dd.criterio_codigo, dd.n desc, dd.dominio
  ),

  -- a) Los criterios con nota 5, CONSOLIDADOS POR DOMINIO
  --
  --    La primera versión de esto devolvía una candidatura por criterio. Con los
  --    30 criterios en 5 salían 35 candidaturas para una sola persona, que es un
  --    resultado inútil: nadie es relator de treinta cosas. Se consolida por
  --    dominio de la batería, que es la unidad en que realmente se relata un
  --    curso, y cada fila dice qué criterios la respaldan.
  criterios_5 as (
    select n.criterio_codigo, n.texto_criterio, n.dimension_codigo, n.dimension_nombre,
           n.orden_criterio, dt.dominio
    from notas n
    left join dominio_top dt on dt.criterio_codigo = n.criterio_codigo
    where n.nota = 5
  ),
  por_dominio as (
    select
      c5.dominio,
      array_agg(c5.criterio_codigo order by c5.orden_criterio) as criterios,
      count(*)::int as n_criterios,
      min(c5.orden_criterio) as orden_criterio,
      -- Un dominio junta criterios de varias secciones. Etiquetar la candidatura
      -- con una sola sección sería arbitrario — y con min() salía la primera
      -- alfabéticamente, que no es ni la que más aporta. Sólo se nombra la
      -- sección cuando de verdad viene toda de una; si no, manda el dominio.
      case when count(distinct c5.dimension_codigo) = 1
           then min(c5.dimension_codigo) end as dimension_codigo,
      case when count(distinct c5.dimension_codigo) = 1
           then min(c5.dimension_nombre)
           else sgc_plural(count(distinct c5.dimension_codigo)::int, 'sección', 'secciones')
      end as dimension_nombre
    from criterios_5 c5
    where c5.dominio is not null
    group by c5.dominio
  ),
  -- Lo que la empresa se ahorraría si esta persona relata ese dominio en vez de
  -- contratarlo afuera. Sale del catálogo y del valor hora de relator interno
  -- que fijaste en CONFIG del programa anual.
  potencial as (
    select cu.dominio,
           count(*)::int as cursos,
           sum(cu.horas)::int as horas,
           sum(cu.precio_ref)::bigint as costo_externo
    from eva_cursos cu
    where cu.activo
    group by cu.dominio
  ),
  relator_criterio as (
    select
      'relator'::text as tipo,
      array_to_string(pd.criterios, ' · ') as criterio_codigo,
      ('Respaldan esta candidatura ' || sgc_plural(pd.n_criterios, 'criterio', 'criterios')
       || ' con nota 5: ' || array_to_string(pd.criterios, ', ') || '.')::text as criterio_texto,
      pd.dimension_codigo, pd.dimension_nombre,
      5 as nota, null::numeric as promedio_seccion, null::text as tramo_sigla,
      ('Relator interno N4 · ' || pd.dominio)::text as titulo,
      ('Sacó 5 en ' || sgc_plural(pd.n_criterios, 'criterio', 'criterios') || ' de este dominio. '
       || 'La regla dice que un 5 no genera curso: genera candidatura a relator interno N4 — '
       || '«el que sabe, enseña». '
       || case when po.cursos > 0 then
            'La batería tiene ' || sgc_plural(po.cursos, 'curso', 'cursos') || ' en este dominio ('
            || po.horas || ' h, ' || sgc_clp(po.costo_externo)
            || ' de costo externo de referencia): eso es lo que podría relatarse internamente.'
          else '' end)::text as detalle,
      pd.dominio as dominio_sugerido,
      ('Proponer como relator interno N4 en ' || pd.dominio || ', a partir de su nota 5 en '
       || array_to_string(pd.criterios, ', ') || '.')::text as accion_sugerida,
      true as genera_linea,
      exists (select 1 from eva_relator_candidaturas r
              where r.evaluacion_id = p_evaluacion_id
                and r.dominio_sugerido = pd.dominio) as ya_registrada,
      pd.n_criterios * -1 as orden_salida
    from por_dominio pd
    left join potencial po on po.dominio = pd.dominio
  ),

  -- b) Sección en EX → reconocimiento formal
  --
  --    Sin candidatura acá: una sección sólo llega a 4,50 si tiene criterios en
  --    5, y ésos ya generaron su candidatura por dominio más arriba. Repetirla a
  --    nivel de sección sería contar dos veces lo mismo.
  relator_seccion as (
    select
      'reconocimiento_seccion'::text,
      null::text, null::text, s.dimension_codigo, s.dimension_nombre,
      null::integer, s.promedio_sup, s.tramo_sigla,
      'Reconocimiento formal de la sección'::text,
      ('La sección completa promedió ' || sgc_nota(s.promedio_sup) || ' (tramo EX). Corresponde '
       || 'reconocimiento formal. La candidatura a relator ya está propuesta arriba, por dominio.')::text,
      null::text,
      ('Reconocimiento formal por el desempeño en ' || s.dimension_nombre || ': promedio '
       || sgc_nota(s.promedio_sup) || ' sobre 5,00.')::text,
      true,
      false,
      500 + coalesce(s.orden, 9)
    from secs s
    where s.tramo_sigla = 'EX'
  ),

  -- c) Sección en SE → PDI de profundización y desarrollo
  profundizacion as (
    select
      'profundizacion'::text,
      null::text, null::text, s.dimension_codigo, s.dimension_nombre,
      null::integer, s.promedio_sup, s.tramo_sigla,
      'PDI de profundización y desarrollo'::text,
      ('La sección promedió ' || sgc_nota(s.promedio_sup) || ' (tramo SE). No corresponde curso por '
       || 'brecha: corresponde profundizar. Lo que se acuerde acá se escribe a mano — el motor no '
       || 'tiene un catálogo de profundización, tiene uno de cierre de brechas.')::text,
      null::text,
      ('Profundizar en ' || s.dimension_nombre || ': definir con la persona un desafío concreto del '
       || 'próximo período que la lleve más allá del estándar del cargo.')::text,
      true,
      false,
      600 + coalesce(s.orden, 9)
    from secs s
    where s.tramo_sigla = 'SE'
  ),

  -- d) Criterio con nota 4 → se reconoce en la entrevista, sin línea de PDI
  reconocimiento as (
    select
      'reconocimiento'::text,
      n.criterio_codigo, n.texto_criterio, n.dimension_codigo, n.dimension_nombre,
      n.nota, null::numeric, null::text,
      'Reconocer con ejemplos concretos'::text,
      ('Sacó 4 en ' || n.criterio_codigo || '. La regla no genera curso ni línea de PDI: pide '
       || 'reconocerlo en la entrevista con ejemplos concretos del período.')::text,
      null::text,
      null::text,
      false,
      false,
      700 + n.orden_criterio
    from notas n
    where n.nota = 4
  )

  select x.* from (
    select * from relator_criterio
    union all select * from relator_seccion
    union all select * from profundizacion
    union all select * from reconocimiento
  ) x
  order by x.orden_salida;
end;
$$;

grant execute on function eva_motor_fortalezas(uuid) to authenticated;

notify pgrst, 'reload schema';
