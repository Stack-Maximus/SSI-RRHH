-- ============================================================================
-- SGC METALIUM · El otro lado del motor: qué pasa cuando sale bien
--
-- Todo lo construido hasta acá mira brechas. Pero la regla de tus documentos
-- tiene dos mitades, y la segunda estaba sin implementar:
--
--   Nota 5 en un criterio     →  candidatura a RELATOR INTERNO N4
--                                «el que sabe, enseña»
--   Nota 4 en un criterio     →  se reconoce en la entrevista con ejemplos
--                                concretos (no genera línea de PDI)
--   Sección en 4,00 – 4,49    →  SE · PDI de profundización y desarrollo
--   Sección en 4,50 – 5,00    →  EX · reconocimiento formal y candidatura a
--                                relator interno N4 en la sección
--   Total ponderado ≥ 4,00    →  reconocimiento del equipo + PDI de
--                                profundización
--   Total ponderado ≥ 4,50    →  reconocimiento formal + candidato a promoción,
--                                bono o rol de relator interno N4
--
-- Antes de esta migración, una persona con los 30 criterios en 5 recibía CERO
-- líneas. Las pantallas decían «corresponde reconocimiento y candidatura a
-- relator N4», pero era una frase: no se registraba, nadie recibía aviso y no
-- llegaba al acta. El curso L-08 «Formación de relatores internos (metodología
-- N4)» estaba en el catálogo y nada lo proponía nunca.
--
-- Fuente: hoja 01 del listado (secciones B, C y D) y hoja 13_MAESTROS · B de
-- RRHH-FOR-EVA-AD-001 v2.0.
--
-- Igual que el resto: TODO ES RECOMENDACIÓN. Una candidatura propuesta no
-- compromete a nadie — la acepta o la descarta quien decide, y en cualquiera de
-- los dos casos queda escrito.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Pesos chilenos en texto
--
--    to_char con 'G' usa el separador de la configuración regional del servidor,
--    que en Supabase es la anglosajona: salía «2,960,000» en vez de «$2.960.000».
--    Se arma a mano para no depender de eso.
-- ----------------------------------------------------------------------------

create or replace function sgc_clp(p_valor numeric)
returns text
language sql
immutable
as $$
  select case when p_valor is null then '—'
    else '$' || replace(to_char(round(p_valor), 'FM999G999G999G999'), ',', '.')
  end;
$$;


-- ----------------------------------------------------------------------------
-- 1. Las candidaturas a relator interno N4
--
--    Una candidatura no es una línea de PDI: no es algo que la persona tenga
--    que aprender, es algo que la empresa quiere aprovechar. Por eso va en su
--    propia tabla y tiene su propio ciclo de vida — el Comité la acepta, la
--    posterga o la descarta, y eso queda con fecha y con quién lo resolvió.
-- ----------------------------------------------------------------------------

create table if not exists eva_relator_candidaturas (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references eva_evaluaciones(id) on delete cascade,
  perfil_id uuid not null references perfiles(id) on delete cascade,

  -- De dónde salió: un criterio con nota 5, o una sección completa en EX.
  origen text not null check (origen in ('criterio', 'seccion')),
  criterio_codigo text references eva_criterios(codigo),
  dimension_codigo text references eva_dimensiones(codigo),
  nota integer,
  promedio_seccion numeric(3,2),

  -- En qué dominio de la batería podría relatar, si se pudo inferir.
  dominio_sugerido text,

  estado text not null default 'propuesta'
    check (estado in ('propuesta', 'aceptada', 'postergada', 'descartada', 'formado')),
  observaciones text,

  propuesta_por uuid references perfiles(id),
  resuelta_por uuid references perfiles(id),
  resuelta_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists idx_relator_perfil on eva_relator_candidaturas (perfil_id);
create index if not exists idx_relator_eval on eva_relator_candidaturas (evaluacion_id);
create index if not exists idx_relator_estado on eva_relator_candidaturas (estado);

-- Una candidatura por criterio y por sección dentro de la misma evaluación: si
-- el evaluador vuelve a sellar, no se duplica.
create unique index if not exists uq_relator_dominio
  on eva_relator_candidaturas (evaluacion_id, dominio_sugerido)
  where dominio_sugerido is not null;

create unique index if not exists uq_relator_seccion
  on eva_relator_candidaturas (evaluacion_id, dimension_codigo)
  where criterio_codigo is null and dimension_codigo is not null;

alter table eva_relator_candidaturas enable row level security;

-- La persona ve las suyas: es reconocimiento, no un expediente reservado.
drop policy if exists "relator_lee_propias" on eva_relator_candidaturas;
create policy "relator_lee_propias" on eva_relator_candidaturas
  for select to authenticated
  using (perfil_id = auth.uid());

drop policy if exists "relator_lee_gestion" on eva_relator_candidaturas;
create policy "relator_lee_gestion" on eva_relator_candidaturas
  for select to authenticated
  using (
    es_admin()
    or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar')
    or exists (
      select 1 from eva_evaluaciones e
      where e.id = eva_relator_candidaturas.evaluacion_id and e.evaluador_id = auth.uid()
    )
  );

-- Las propone el evaluador al sellar; también RRHH.
drop policy if exists "relator_propone_evaluador" on eva_relator_candidaturas;
create policy "relator_propone_evaluador" on eva_relator_candidaturas
  for insert to authenticated
  with check (
    es_admin()
    or rol_en_modulo('personal') = 'rrhh'
    or exists (
      select 1 from eva_evaluaciones e
      where e.id = eva_relator_candidaturas.evaluacion_id and e.evaluador_id = auth.uid()
    )
  );

-- Pero resolverlas es de RRHH y de Bienestar y Crecimiento: el Comité decide a
-- quién forma como relator, no el supervisor directo.
drop policy if exists "relator_resuelve_gestion" on eva_relator_candidaturas;
create policy "relator_resuelve_gestion" on eva_relator_candidaturas
  for update to authenticated
  using (es_admin() or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar'))
  with check (es_admin() or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar'));


-- ----------------------------------------------------------------------------
-- 2. Resolver una candidatura
--
--    RLS no restringe columnas, así que el cambio de estado va por una función
--    de alcance estrecho: el mismo patrón del resto del módulo. Así nadie puede
--    reescribir de qué criterio salió la candidatura al resolverla.
-- ----------------------------------------------------------------------------

create or replace function eva_resolver_candidatura(
  p_candidatura_id uuid,
  p_estado text,
  p_observaciones text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((es_admin() or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar')), false) then
    raise exception 'Sólo RRHH o Bienestar y Crecimiento resuelven las candidaturas a relator';
  end if;

  if p_estado not in ('propuesta', 'aceptada', 'postergada', 'descartada', 'formado') then
    raise exception 'Estado no válido: %', p_estado;
  end if;

  if p_estado in ('descartada', 'postergada') and coalesce(trim(p_observaciones), '') = '' then
    raise exception 'Descartar o postergar una candidatura exige decir por qué';
  end if;

  update eva_relator_candidaturas
    set estado = p_estado,
        observaciones = coalesce(nullif(trim(p_observaciones), ''), observaciones),
        resuelta_por = auth.uid(),
        resuelta_en = now()
    where id = p_candidatura_id;

  if not found then
    raise exception 'La candidatura no existe';
  end if;
end;
$$;

grant execute on function eva_resolver_candidatura(uuid, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Las líneas del PDI que salen de una fortaleza
--
--    Un PDI de profundización también es PDI. Se agregan dos orígenes:
--
--      reconocimiento  lo que corresponde reconocer, con ejemplos concretos
--      profundizacion  desarrollo de alguien que ya está sobre el estándar
--      relator         formarlo para que enseñe («el que sabe, enseña»)
-- ----------------------------------------------------------------------------

alter table eva_pdi drop constraint if exists eva_pdi_origen_check;
alter table eva_pdi add constraint eva_pdi_origen_check
  check (origen is null or origen in (
    'brecha', 'bateria', 'conducta', 'manual',
    'reconocimiento', 'profundizacion', 'relator'
  ));


-- ----------------------------------------------------------------------------
-- 4. EL MOTOR DE FORTALEZAS
--
--    Devuelve lo que corresponde cuando sale bien. Tres tipos de fila:
--
--      relator         criterio con nota 5, o sección en EX
--      profundizacion  sección en SE
--      reconocimiento  criterio con nota 4 — punto de conversación, no línea
--
--    Ojo con la última: la regla dice textual «no genera curso ni línea de PDI.
--    Se reconoce en la entrevista con ejemplos concretos». Sale igual en la
--    propuesta, marcada como no incluible, porque si no aparece el evaluador no
--    lo va a mencionar — y reconocer con ejemplos concretos es justamente lo que
--    la pauta le pide hacer.
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- 5. Formar al relator: la única línea de capacitación que nace de un 5
--
--    No se puede nombrar relator a alguien y no enseñarle a enseñar. En tu
--    catálogo existe justo el curso para eso — L-08 «Formación de relatores
--    internos (metodología N4)», nivel N4, 16 h — y hasta ahora nada lo
--    proponía nunca, porque el motor de brechas sólo mira notas bajas.
--
--    ESTO ES UNA INFERENCIA MÍA, no una regla de tus documentos: tus planillas
--    dicen «candidatura a relator N4» pero no dicen que haya que capacitarlo
--    para relatar. Si el Comité prefiere que la formación se decida aparte,
--    basta poner el curso en null acá y la sugerencia desaparece.
-- ----------------------------------------------------------------------------

create table if not exists eva_config_fortalezas (
  clave text primary key,
  valor text,
  nota text
);

alter table eva_config_fortalezas enable row level security;

drop policy if exists "personal_lee_config_fort" on eva_config_fortalezas;
create policy "personal_lee_config_fort" on eva_config_fortalezas
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_config_fort" on eva_config_fortalezas;
create policy "rrhh_edita_config_fort" on eva_config_fortalezas
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

insert into eva_config_fortalezas (clave, valor, nota) values
('curso_formacion_relator', 'L-08',
 'Curso que se sugiere a quien queda como candidato a relator interno N4. Dejarlo en null desactiva la sugerencia.')
on conflict (clave) do nothing;

create or replace function eva_curso_relator_sugerido(p_evaluacion_id uuid)
returns table (
  curso_codigo text,
  curso_nombre text,
  modalidad text,
  horas integer,
  nivel text,
  precio_ref integer,
  franquiciable boolean,
  financiamiento text,
  ya_lo_tiene boolean,
  fecha_ultima date,
  motivo text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_curso text;
  v_evaluado uuid;
  v_candidaturas integer;
begin
  if not eva_puede_ver_evaluacion(p_evaluacion_id) then
    raise exception 'No tiene permiso para ver esta evaluación'
      using errcode = '42501';
  end if;

  select valor into v_curso from eva_config_fortalezas where clave = 'curso_formacion_relator';
  if v_curso is null then
    return;
  end if;

  select e.evaluado_id into v_evaluado from eva_evaluaciones e where e.id = p_evaluacion_id;
  if v_evaluado is null then
    return;
  end if;

  select count(*) into v_candidaturas
  from eva_motor_fortalezas(p_evaluacion_id) f
  where f.tipo = 'relator';

  if v_candidaturas = 0 then
    return;
  end if;

  return query
  select
    cu.codigo, cu.nombre, cu.modalidad, cu.horas, cu.nivel, cu.precio_ref,
    cu.franquiciable, cu.financiamiento,
    (v.fecha is not null),
    v.fecha,
    ('Queda con ' || sgc_plural(v_candidaturas, 'candidatura', 'candidaturas') || ' a relator interno N4. '
     || 'No se puede nombrar relator a alguien sin enseñarle a enseñar: éste es el curso de la batería '
     || 'que habilita para relatar.')::text
  from eva_cursos cu
  left join lateral (
    select max(cap.fecha) as fecha
    from eva_capacitaciones cap
    where cap.perfil_id = v_evaluado
      and cap.curso_codigo = cu.codigo
      and cap.estado = 'ejecutada'
      and coalesce(cap.aprobado, true)
  ) v on true
  where cu.codigo = v_curso and cu.activo;
end;
$$;

grant execute on function eva_curso_relator_sugerido(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Aviso a RRHH y a Bienestar cuando aparece una candidatura
--
--    Sin esto la candidatura se queda en el expediente esperando que alguien
--    lo abra. El Comité de Capacitación es el que decide a quién formar como
--    relator: tiene que enterarse.
-- ----------------------------------------------------------------------------

create or replace function trigger_notificar_candidatura_relator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona text;
  v_ciclo text;
  v_de text;
begin
  select p.nombre, c.titulo
    into v_persona, v_ciclo
  from eva_evaluaciones e
  join perfiles p on p.id = e.evaluado_id
  left join eva_ciclos c on c.id = e.ciclo_id
  where e.id = new.evaluacion_id;

  v_de := case
    when new.dominio_sugerido is not null then 'su dominio de ' || new.dominio_sugerido
    when new.criterio_codigo is not null then 'el criterio ' || new.criterio_codigo
    when new.dimension_codigo is not null then
      'la sección ' || coalesce((select nombre from eva_dimensiones where codigo = new.dimension_codigo),
                                new.dimension_codigo)
    else 'su evaluación'
  end;

  insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
  select
    ma.usuario_id,
    'personal',
    'Candidatura a relator interno N4: ' || coalesce(v_persona, 'un trabajador'),
    coalesce(v_persona, 'Un trabajador') || ' quedó propuesto como relator interno N4 a partir de '
      || v_de || coalesce(' (' || v_ciclo || ')', '') || '. Corresponde que el Comité la resuelva.',
    '<p><strong>' || coalesce(v_persona, 'Un trabajador') || '</strong> quedó propuesto como '
      || '<strong>relator interno N4</strong> a partir de ' || v_de
      || coalesce(' (' || v_ciclo || ')', '') || '.</p>'
      || coalesce('<p>Dominio sugerido: <strong>' || new.dominio_sugerido || '</strong>.</p>', '')
      || '<p>La candidatura está en estado <strong>propuesta</strong>. La resuelve el Comité de '
      || 'Capacitación: aceptar, postergar o descartar. Postergar y descartar exigen decir por qué.</p>'
      || '<p>«El que sabe, enseña»: una candidatura aceptada convierte a la persona en relator de la '
      || 'batería interna, y eso baja el costo externo de capacitación del programa anual.</p>'
  from modulo_accesos ma
  where ma.modulo = 'personal' and ma.rol in ('rrhh', 'crecimiento_bienestar');

  return new;
end;
$$;

drop trigger if exists on_candidatura_relator on eva_relator_candidaturas;
create trigger on_candidatura_relator
  after insert on eva_relator_candidaturas
  for each row execute function trigger_notificar_candidatura_relator();


-- ----------------------------------------------------------------------------
-- 7. Las candidaturas de una persona, para su ficha
-- ----------------------------------------------------------------------------

create or replace function eva_candidaturas_de(p_perfil_id uuid)
returns table (
  id uuid,
  evaluacion_id uuid,
  ciclo_titulo text,
  origen text,
  criterio_codigo text,
  criterio_texto text,
  dimension_nombre text,
  nota integer,
  promedio_seccion numeric,
  dominio_sugerido text,
  estado text,
  observaciones text,
  resuelta_en timestamptz,
  creado_en timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.id, r.evaluacion_id, c.titulo, r.origen, r.criterio_codigo,
    cr.texto_criterio, d.nombre, r.nota, r.promedio_seccion, r.dominio_sugerido,
    r.estado, r.observaciones, r.resuelta_en, r.creado_en
  from eva_relator_candidaturas r
  left join eva_evaluaciones e on e.id = r.evaluacion_id
  left join eva_ciclos c on c.id = e.ciclo_id
  left join eva_criterios cr on cr.codigo = r.criterio_codigo
  left join eva_dimensiones d on d.codigo = r.dimension_codigo
  where r.perfil_id = p_perfil_id
  order by r.creado_en desc;
$$;

grant execute on function eva_candidaturas_de(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. Resumen de fortalezas, para el encabezado de la propuesta
-- ----------------------------------------------------------------------------

create or replace function eva_motor_fortalezas_resumen(p_evaluacion_id uuid)
returns table (
  criterios_en_5 integer,
  criterios_en_4 integer,
  secciones_ex integer,
  secciones_se integer,
  candidaturas_relator integer,
  lineas_profundizacion integer,
  ya_registradas integer
)
language sql
stable
security definer
set search_path = public
as $$
  with f as (select * from eva_motor_fortalezas(p_evaluacion_id))
  select
    (select count(*) from eva_detalle_sup d
      join eva_criterios c on c.codigo = d.criterio_codigo
      where d.evaluacion_id = p_evaluacion_id and d.nota = 5)::int,
    (select count(*) from eva_detalle_sup d
      where d.evaluacion_id = p_evaluacion_id and d.nota = 4)::int,
    count(*) filter (where f.tipo = 'reconocimiento_seccion')::int,
    count(*) filter (where f.tipo = 'profundizacion')::int,
    count(*) filter (where f.tipo = 'relator')::int,
    count(*) filter (where f.tipo = 'profundizacion')::int,
    count(*) filter (where f.ya_registrada)::int
  from f;
$$;

grant execute on function eva_motor_fortalezas_resumen(uuid) to authenticated;


notify pgrst, 'reload schema';
