-- ============================================================================
-- SGC METALIUM · La lectura por SECCIÓN del motor de PDI
--
-- Fuente: hojas 06 (AGRUPACIÓN POR SEGMENTO) y 07 (PAQUETE DE CURSOS DE CADA
-- SEGMENTO) del listado Metalium_Listado_PDI_Plan_de_Accion_por_Puntaje.
--
-- La evaluación tiene cinco secciones — que en la planilla se llaman
-- «segmentos» y son las cinco dimensiones ponderadas:
--
--   TC · Competencias Funcionales del Cargo   peso 0,35
--   SS · Organización y Cumplimiento          peso 0,20
--   DL · Disciplina Laboral                   peso 0,15
--   VH · Valores HACER                        peso 0,15
--   CM · Calidad y Mejora                     peso 0,15
--
-- Hasta ahora el motor leía sólo la nota de cada criterio. Esta migración
-- agrega la lectura de la SECCIÓN: el promedio de cada sección cae en un tramo
-- corporativo, y ese tramo dice qué se hace con la sección completa y con qué
-- amplitud de paquete.
--
--   1,00 – 1,99  NC  Crítico       P1  paquete completo de la sección
--   2,00 – 2,99  PD  Por debajo    P2  Legal + Crítica + Alta
--   3,00 – 3,99  C   Satisfactorio P4  Legal + Crítica
--   4,00 – 4,49  SE  Destacado     —   ninguno por brecha (sólo P3)
--   4,50 – 5,00  EX  Excepcional   —   ninguno por brecha (sólo P3)
--
-- CÓMO CONVIVEN LAS DOS LECTURAS
--
-- No se sustituyen: la del criterio DISPARA la línea, la de la sección es el
-- lente con que el Comité mira el presupuesto. Las dos se muestran juntas y
-- ninguna manda sobre la otra en silencio.
--
-- El caso que lo explica: si TC1 sale 1 pero el promedio de la sección es 3,4,
-- el criterio pide el curso con prioridad P1 y el tramo de la sección lo
-- dejaría fuera si no es de criticidad Crítica o Legal. La línea aparece igual,
-- con P1, y marcada como «el tramo de la sección no la incluiría». El evaluador
-- ve las dos lecturas y decide. Al revés también: sección en 2,8 con todos los
-- criterios en 3 propone P4 por criterio, y el aviso dice que la sección
-- completa está por debajo y que corresponde PMD.
--
-- TODO ESTO ES RECOMENDACIÓN. Quien designa qué se hace es el evaluador: el
-- sistema no compromete ninguna línea por su cuenta ni bloquea el sello.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Dos ayudas de redacción
--
--    Chile escribe las notas con coma decimal, y «1 criterio(s)» delata que la
--    frase la armó una máquina. Son detalles, pero esta frase la va a leer un
--    supervisor antes de una conversación difícil.
-- ----------------------------------------------------------------------------

create or replace function sgc_nota(p_valor numeric)
returns text
language sql
immutable
as $$
  select replace(to_char(p_valor, 'FM9990.00'), '.', ',');
$$;

create or replace function sgc_plural(p_n integer, p_singular text, p_plural text)
returns text
language sql
immutable
as $$
  select p_n || ' ' || case when p_n = 1 then p_singular else p_plural end;
$$;


-- ----------------------------------------------------------------------------
-- 1. Los cinco tramos de la sección
--
--    Los textos son los de la hoja 06, sin reescribir. Están en tabla para que
--    RRHH pueda ajustar una redacción sin tocar código.
-- ----------------------------------------------------------------------------

create table if not exists eva_segmento_tramos (
  sigla text primary key,
  desde numeric(3,2) not null,
  hasta numeric(3,2) not null,
  categoria text not null,
  prioridad integer,
  que_se_hace text not null,
  filtro_criticidad text not null,
  criticidades text[],
  plazo text,
  orden integer
);

alter table eva_segmento_tramos enable row level security;

drop policy if exists "personal_lee_segmento_tramos" on eva_segmento_tramos;
create policy "personal_lee_segmento_tramos" on eva_segmento_tramos
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_segmento_tramos" on eva_segmento_tramos;
create policy "rrhh_edita_segmento_tramos" on eva_segmento_tramos
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

insert into eva_segmento_tramos
  (sigla, desde, hasta, categoria, prioridad, que_se_hace, filtro_criticidad, criticidades, plazo, orden) values

('NC', 1.00, 1.99, 'Crítico', 1,
 'SEGMENTO CRÍTICO. Entra al PDI el paquete COMPLETO de la sección con prioridad P1. PMD con acompañamiento de RRHH y plazo definido; escalamiento a RRHH-PRO-09 si el ponderado global también es crítico. Cada criterio ≤2 de la sección exige evidencia.',
 'Todos los cursos de la sección (Legal · Crítica · Alta · Media · Baja)',
 array['Legal','Crítica','Alta','Media','Baja'],
 'Dentro del trimestre', 1),

('PD', 2.00, 2.99, 'Por debajo', 2,
 'BRECHA DE DESEMPEÑO EN LA SECCIÓN. Entra el paquete acotado a criticidad Crítica y Alta más los habilitantes por ley, con prioridad P2. PMD obligatorio y seguimiento mensual por 3 meses, con RRHH presente en la entrevista.',
 'Legal + Crítica + Alta',
 array['Legal','Crítica','Alta'],
 'Dentro del semestre', 2),

('C', 3.00, 3.99, 'Satisfactorio', 4,
 'EN EL MÍNIMO ESPERADO. Entra sólo el núcleo de criticidad Crítica y los habilitantes por ley, con prioridad P4: se programa únicamente si el Comité tiene fondo disponible. Foco en los criterios de la sección que salieron bajo 3.',
 'Legal + Crítica',
 array['Legal','Crítica'],
 'Si el Comité lo prioriza', 3),

('SE', 4.00, 4.49, 'Destacado', null,
 'SIN CURSOS POR BRECHA. PDI de profundización y desarrollo en la sección. Los habilitantes por ley que la persona aún no tenga siguen entrando por la batería del cargo con prioridad P3.',
 'Ninguno por brecha (sólo P3 habilitantes de la batería del cargo)',
 array[]::text[],
 null, 4),

('EX', 4.50, 5.00, 'Excepcional', null,
 'SIN CURSOS POR BRECHA. Reconocimiento formal y candidatura a relator interno N4 en la sección. Los habilitantes por ley siguen entrando por la batería del cargo con prioridad P3.',
 'Ninguno por brecha (sólo P3 habilitantes de la batería del cargo)',
 array[]::text[],
 null, 5)

on conflict (sigla) do update set
  desde = excluded.desde, hasta = excluded.hasta, categoria = excluded.categoria,
  prioridad = excluded.prioridad, que_se_hace = excluded.que_se_hace,
  filtro_criticidad = excluded.filtro_criticidad, criticidades = excluded.criticidades,
  plazo = excluded.plazo, orden = excluded.orden;


-- ----------------------------------------------------------------------------
-- 2. El tramo de un promedio
--
--    Un umbral abierto arriba en EX y abajo en NC, para que ningún promedio
--    quede sin tramo. La v1.1 tenía el hueco entre 4,49 y 4,50; la v2.0 lo
--    corrigió usando umbral inferior, y acá se respeta eso.
-- ----------------------------------------------------------------------------

create or replace function eva_tramo_de(p_promedio numeric)
returns text
language sql
immutable
as $$
  select case
    when p_promedio is null then null
    when p_promedio >= 4.50 then 'EX'
    when p_promedio >= 4.00 then 'SE'
    when p_promedio >= 3.00 then 'C'
    when p_promedio >= 2.00 then 'PD'
    else 'NC'
  end;
$$;


-- ----------------------------------------------------------------------------
-- 3. La advertencia de composición de cada sección
--
--    No es cosmética. En Disciplina Laboral 5 de 6 criterios son conductuales:
--    un promedio bajo ahí NO se cierra con capacitación, y si la pantalla no lo
--    dice, el evaluador va a buscar un curso que no existe. Se calcula de
--    eva_criterios para que siga siendo cierta si el Comité recategoriza algo.
-- ----------------------------------------------------------------------------

create or replace function eva_seccion_composicion()
returns table (
  dimension_codigo text,
  dimension_nombre text,
  peso numeric,
  orden integer,
  criterios integer,
  cap integer,
  con integer,
  advertencia text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.codigo,
    d.nombre,
    d.peso,
    d.orden,
    count(c.codigo)::int,
    count(*) filter (where c.tipo = 'CAP')::int,
    count(*) filter (where c.tipo = 'CON')::int,
    case
      when count(*) filter (where c.tipo = 'CON') = 0 then
        'Los ' || count(c.codigo) || ' criterios son capacitables: el promedio de la sección se puede cerrar con capacitación.'
      when count(*) filter (where c.tipo = 'CON') > count(*) filter (where c.tipo = 'CAP') then
        count(*) filter (where c.tipo = 'CON') || ' de ' || count(c.codigo) || ' criterios de esta sección son CONDUCTUALES: '
        || 'un promedio bajo aquí no se cierra con capacitación. Se resuelve con acompañamiento de la jefatura, '
        || 'compromiso conductual o la vía disciplinaria (RRHH-PRO-09).'
      else
        count(*) filter (where c.tipo = 'CON') || ' de ' || count(c.codigo) || ' criterios son conductuales: '
        || 'esa parte del promedio no se cierra con curso.'
    end
  from eva_dimensiones d
  left join eva_criterios c on c.dimension_codigo = d.codigo
  group by d.codigo, d.nombre, d.peso, d.orden;
$$;

grant execute on function eva_seccion_composicion() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. LA LECTURA POR SECCIÓN de una evaluación
--
--    Una fila por sección, con todo lo que el evaluador necesita para decidir:
--    el promedio que sacó, el tramo en que cae, qué dice la regla para ese
--    tramo, cuántos criterios quedaron bajo 3, y qué propuso el motor ahí —
--    cursos, compromisos conductuales, horas y costo.
--
--    Los promedios se calculan de las notas, no se leen de eva_evaluaciones:
--    la consolidación las guarda ahí, pero esta función tiene que funcionar
--    también cuando el evaluador todavía no consolidó.
-- ----------------------------------------------------------------------------

create or replace function eva_motor_pdi_secciones(p_evaluacion_id uuid)
returns table (
  dimension_codigo text,
  dimension_nombre text,
  peso numeric,
  orden integer,
  criterios_cap integer,
  criterios_con integer,
  advertencia text,
  promedio_sup numeric,
  promedio_auto numeric,
  brecha numeric,
  aporte_al_total numeric,
  tramo_sigla text,
  tramo_categoria text,
  tramo_prioridad integer,
  que_se_hace text,
  filtro_criticidad text,
  plazo text,
  criterios_bajo_3 integer,
  criterios_en_1_o_2 integer,
  criterios_hasta_3 integer,
  cursos_propuestos integer,
  compromisos_conductuales integer,
  horas integer,
  costo_estimado bigint,
  fuera_del_filtro integer,
  recomendacion text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not eva_puede_ver_evaluacion(p_evaluacion_id) then
    raise exception 'No tiene permiso para ver la lectura por sección de esta evaluación'
      using errcode = '42501';
  end if;

  return query
  with notas as (
    select c.dimension_codigo, c.codigo as criterio_codigo, c.tipo,
           ds.nota as nota_sup, da.nota as nota_auto
    from eva_criterios c
    left join eva_detalle_sup ds
      on ds.criterio_codigo = c.codigo and ds.evaluacion_id = p_evaluacion_id
    left join eva_detalle_auto da
      on da.criterio_codigo = c.codigo and da.evaluacion_id = p_evaluacion_id
  ),
  agregado as (
    select
      n.dimension_codigo,
      round(avg(n.nota_sup)::numeric, 2) as prom_sup,
      round(avg(n.nota_auto)::numeric, 2) as prom_auto,
      count(*) filter (where n.nota_sup is not null and n.nota_sup < 3)::int as bajo_3,
      count(*) filter (where n.nota_sup is not null and n.nota_sup <= 2)::int as en_1_o_2,
      -- Los que realmente gatillan: el motor actúa desde la nota 3 hacia abajo.
      -- «Bajo 3» y «en 1 o 2» son lo mismo con notas enteras; este es distinto.
      count(*) filter (where n.nota_sup is not null and n.nota_sup <= 3)::int as hasta_3
    from notas n
    group by n.dimension_codigo
  ),
  -- Lo que el motor propuso, atribuido a su sección. Las líneas de la batería
  -- del cargo (P3) no tienen criterio y por tanto no pertenecen a ninguna
  -- sección: se cuentan aparte, en el resumen general.
  motor as (
    select m.*
    from eva_motor_pdi(p_evaluacion_id) m
    where m.dimension_codigo is not null
  )
  select
    comp.dimension_codigo,
    comp.dimension_nombre,
    comp.peso,
    comp.orden,
    comp.cap,
    comp.con,
    comp.advertencia,
    ag.prom_sup,
    ag.prom_auto,
    case when ag.prom_sup is null or ag.prom_auto is null
         then null else round(ag.prom_sup - ag.prom_auto, 2) end,
    case when ag.prom_sup is null then null
         else round(ag.prom_sup * comp.peso, 3) end,
    t.sigla,
    t.categoria,
    t.prioridad,
    t.que_se_hace,
    t.filtro_criticidad,
    t.plazo,
    coalesce(ag.bajo_3, 0),
    coalesce(ag.en_1_o_2, 0),
    coalesce(ag.hasta_3, 0),
    (select count(*) from motor m
      where m.dimension_codigo = comp.dimension_codigo
        and m.curso_codigo is not null and m.incluir)::int,
    (select count(*) from motor m
      where m.dimension_codigo = comp.dimension_codigo
        and m.origen = 'conducta' and m.incluir)::int,
    (select coalesce(sum(m.horas), 0) from motor m
      where m.dimension_codigo = comp.dimension_codigo and m.incluir)::int,
    (select coalesce(sum(m.precio_ref), 0) from motor m
      where m.dimension_codigo = comp.dimension_codigo and m.incluir)::bigint,
    -- Cuántas líneas propuestas por criterio caen fuera del filtro de
    -- criticidad del tramo de la sección. No las quita: las señala, porque las
    -- dos lecturas son válidas y la decisión es del evaluador.
    (select count(*) from motor m
      where m.dimension_codigo = comp.dimension_codigo
        and m.curso_codigo is not null and m.incluir
        and not (m.criticidad = any (coalesce(t.criticidades, array[]::text[]))))::int,
    -- La frase que resume la sección. Cuatro casos, en este orden: sin notas,
    -- sección conductual con promedio bajo, sección con brecha capacitable, y
    -- sección en o sobre el estándar.
    case
      when ag.prom_sup is null then
        'Sin calificar todavía.'
      when t.prioridad is not null and comp.con > comp.cap then
        'Promedio ' || sgc_nota(ag.prom_sup) || ' · tramo ' || t.sigla || '. Esta sección es mayormente '
        || 'conductual: lo que corresponde acá es acompañamiento de la jefatura y compromisos con fecha, '
        || 'no capacitación. ' || sgc_plural(coalesce(ag.en_1_o_2, 0), 'criterio', 'criterios') || ' en 1 o 2.'
      -- El tramo puede admitir refuerzo y no haber nada que reforzar: el tramo mira
      -- el promedio, las líneas las gatilla el criterio. Sin esta rama la tarjeta
      -- decía «se recomienda capacitación P4» y dos líneas más abajo «no se
      -- recomienda ninguna acción», que es contradecirse en la misma pantalla.
      when t.prioridad is not null and coalesce(ag.hasta_3, 0) = 0 then
        'Promedio ' || sgc_nota(ag.prom_sup) || ' · tramo ' || t.sigla || '. El tramo admitiría refuerzo P'
        || t.prioridad || ', pero ningún criterio de esta sección quedó en 3 o menos: no hay brecha que lo '
        || 'justifique.'
      when t.prioridad is not null then
        'Promedio ' || sgc_nota(ag.prom_sup) || ' · tramo ' || t.sigla || '. Se recomienda capacitación con '
        || 'prioridad P' || t.prioridad || coalesce(' — ' || t.plazo, '') || '. '
        || sgc_plural(coalesce(ag.hasta_3, 0), 'criterio', 'criterios') || ' en 3 o menos.'
      when t.sigla = 'EX' then
        'Promedio ' || sgc_nota(ag.prom_sup) || ' · tramo EX. No se recomienda curso por brecha: '
        || 'corresponde reconocimiento formal. La candidatura a relator interno N4 se propone aparte, '
        || 'agrupada por dominio de la batería.'
      else
        'Promedio ' || sgc_nota(ag.prom_sup) || ' · tramo SE. No se recomienda curso por brecha: '
        || 'corresponde PDI de profundización y desarrollo en esta sección.'
    end
  from eva_seccion_composicion() comp
  left join agregado ag on ag.dimension_codigo = comp.dimension_codigo
  left join eva_segmento_tramos t on t.sigla = eva_tramo_de(ag.prom_sup)
  order by comp.orden;
end;
$$;

grant execute on function eva_motor_pdi_secciones(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. El motor devuelve además el tramo de la sección de cada línea
--
--    Se agregan tres columnas al final, para no romper a quien ya lee la
--    función por nombre de columna:
--
--      seccion_tramo         el tramo en que cayó el promedio de su sección
--      dentro_filtro_seccion si la criticidad del curso entra en el filtro de
--                            ese tramo (null en las líneas sin curso)
--      nota_de_la_seccion    el promedio de la sección, para mostrarlo al lado
--                            de la nota del criterio
--
--    Repito lo de arriba porque es la parte que se malinterpreta: cuando
--    dentro_filtro_seccion es false la línea NO se descarta. Sigue propuesta
--    con la prioridad de su criterio, y la pantalla dice que el tramo de la
--    sección no la incluiría. Decide el evaluador.
-- ----------------------------------------------------------------------------

drop function if exists eva_motor_pdi_con_seccion(uuid);

create function eva_motor_pdi_con_seccion(p_evaluacion_id uuid)
returns table (
  origen text,
  criterio_codigo text,
  criterio_texto text,
  dimension_codigo text,
  dimension_nombre text,
  tipo text,
  nota integer,
  curso_codigo text,
  curso_nombre text,
  dominio text,
  modalidad text,
  nivel text,
  horas integer,
  precio_ref integer,
  criticidad text,
  franquiciable boolean,
  recurrencia text,
  financiamiento text,
  prioridad integer,
  prioridad_sigla text,
  prioridad_titulo text,
  plazo text,
  dias_sugeridos integer,
  en_su_bateria text,
  ya_lo_tiene boolean,
  fecha_ultima date,
  recomendacion text,
  incluir boolean,
  motivo_exclusion text,
  tambien_pedido_por text[],
  ya_en_pdi boolean,
  orden_salida integer,
  seccion_tramo text,
  seccion_categoria text,
  dentro_filtro_seccion boolean,
  nota_de_la_seccion numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (select * from eva_motor_pdi_secciones(p_evaluacion_id))
  select
    m.*,
    s.tramo_sigla,
    s.tramo_categoria,
    case when m.curso_codigo is null or s.tramo_sigla is null then null
         else m.criticidad = any (coalesce(t.criticidades, array[]::text[])) end,
    s.promedio_sup
  from eva_motor_pdi(p_evaluacion_id) m
  left join s on s.dimension_codigo = m.dimension_codigo
  left join eva_segmento_tramos t on t.sigla = s.tramo_sigla
  order by m.orden_salida, m.curso_codigo;
$$;

grant execute on function eva_motor_pdi_con_seccion(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Un descarte sin justificación también es información
--
--    La tabla exigía motivo. Pero si todo lo que propone el motor es una
--    recomendación y quien decide es el evaluador, entonces «quitó esta línea y
--    no escribió por qué» es un hecho que el expediente debería poder guardar,
--    en lugar de perderse porque la validación no dejó registrarlo.
--
--    El formulario sigue pidiendo el motivo — la pauta de la entrevista lo
--    exige — pero ya no bloquea el sello por no tenerlo.
-- ----------------------------------------------------------------------------

alter table eva_pdi_descartes alter column motivo drop not null;


notify pgrst, 'reload schema';
