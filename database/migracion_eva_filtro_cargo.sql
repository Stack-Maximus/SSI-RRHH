-- ============================================================================
-- SGC METALIUM · Filtrar por cargo: que a cada uno se le pregunte y se le
--                proponga lo suyo
--
-- EL PROBLEMA, MEDIDO
--
-- Hasta acá el motor proponía los cursos mapeados a un criterio sin mirar el
-- cargo de la persona. Un Analista TI con nota 1 en TC1 recibía los mismos
-- cinco cursos que un Modelador/Proyectista, incluido D-12 «Auranet (ERP)
-- avanzado» — que en tu propia matriz MAPA_CARGO no aplica a la familia F9.
--
-- El ruido, contado sobre los 51 cursos que la evaluación puede gatillar:
--
--   F11 Servicios de obra          43 de 51 no aplican   84%
--   F5  Maestros y especialidades  38 de 51              75%
--   F10 Licitaciones y comercial   36 de 51              71%
--   F6  Taller Liray               29 de 51              57%
--   F7  Logística y bodega         28 de 51              55%
--   F8  Finanzas y contabilidad    25 de 51              49%
--   F4  Supervisión y prevención   20 de 51              39%
--   F3  Oficina Técnica            17 de 51              33%
--   F9  RRHH y JDE (TI/SGC)        17 de 51              33%
--   F1  Gerencias y jefaturas      12 de 51              24%
--   F2  Administración de obra      5 de 51              10%
--
-- POR QUÉ NO SE FILTRA A SECAS
--
-- Porque medí lo otro también: con un filtro duro, un Jornal/Ayudante (F11) se
-- queda con 17 de sus 22 criterios capacitables SIN ningún curso — incluido TC1,
-- «dominio de las funciones del cargo». Maestros, 10 de 22. Filtrar sin más
-- cambia un problema de ruido por uno peor: brechas reales sin ninguna acción,
-- justo en las familias operativas.
--
-- Así que los cursos que no aplican no se esconden: se degradan. Salen en su
-- propio bloque, desmarcados y con el motivo escrito, porque para esas familias
-- a veces es todo lo que hay.
--
-- Y LOS CRITERIOS
--
-- Se agrega la matriz criterio × familia. Nace ENTERA EN «SÍ APLICA»: al correr
-- esta migración nada cambia de comportamiento. Es RRHH quien va marcando lo que
-- no corresponde a cada familia — SS5 «plazos legales y reportes obligatorios» a
-- un Jornal, SS2 «confidencialidad de la información» a un Pintor. No lo sembré
-- yo con criterio propio: son 330 juicios sobre qué le toca a cada oficio y ésos
-- no me corresponden.
--
-- EL BORDE QUE SÍ ROMPE
--
-- El promedio de cada sección se calcula dividiendo por los criterios que
-- efectivamente se calificaron, así que quitar algunos ajusta solo. Pero dejar
-- una sección ENTERA sin criterios da 0/0, y el total ponderado sale NaN. Eso lo
-- impide un trigger: siempre tiene que quedar al menos un criterio por sección.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Matriz criterio × familia
-- ----------------------------------------------------------------------------

create table if not exists eva_criterio_familia (
  criterio_codigo text not null references eva_criterios(codigo) on delete cascade,
  familia_codigo text not null references eva_familias_cargo(codigo) on delete cascade,
  aplica boolean not null default true,
  motivo text,
  actualizado_por uuid references perfiles(id),
  actualizado_en timestamptz,
  primary key (criterio_codigo, familia_codigo)
);

alter table eva_criterio_familia enable row level security;

drop policy if exists "personal_lee_criterio_familia" on eva_criterio_familia;
create policy "personal_lee_criterio_familia" on eva_criterio_familia
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_criterio_familia" on eva_criterio_familia;
create policy "rrhh_edita_criterio_familia" on eva_criterio_familia
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

-- Nace completa y en «sí aplica»: correr esto no cambia nada todavía.
insert into eva_criterio_familia (criterio_codigo, familia_codigo, aplica)
select c.codigo, f.codigo, true
from eva_criterios c cross join eva_familias_cargo f
on conflict (criterio_codigo, familia_codigo) do nothing;


-- ----------------------------------------------------------------------------
-- 2. Ninguna sección puede quedar vacía
--
--    Si una familia se queda sin criterios en una dimensión, el promedio de esa
--    sección es 0/0 y el total ponderado sale NaN. No es una preferencia de
--    diseño: es una división por cero esperando.
-- ----------------------------------------------------------------------------

create or replace function eva_criterio_familia_guardia()
returns trigger
language plpgsql
as $$
declare
  v_dim text;
  v_quedan integer;
begin
  select dimension_codigo into v_dim from eva_criterios where codigo = new.criterio_codigo;

  select count(*) into v_quedan
  from eva_criterio_familia cf
  join eva_criterios c on c.codigo = cf.criterio_codigo
  where cf.familia_codigo = new.familia_codigo
    and c.dimension_codigo = v_dim
    and cf.aplica
    and cf.criterio_codigo <> new.criterio_codigo;

  if not new.aplica and v_quedan = 0 then
    raise exception
      'No se puede dejar la sección % sin ningún criterio para la familia %: el promedio de la sección quedaría sin poder calcularse. Deja al menos uno.',
      coalesce((select nombre from eva_dimensiones where codigo = v_dim), v_dim),
      coalesce((select nombre from eva_familias_cargo where codigo = new.familia_codigo), new.familia_codigo);
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists on_criterio_familia_guardia on eva_criterio_familia;
create trigger on_criterio_familia_guardia
  before update on eva_criterio_familia
  for each row execute function eva_criterio_familia_guardia();


-- ----------------------------------------------------------------------------
-- 3. Los criterios que le tocan a una persona
--
--    Es lo que tiene que cargar el formulario, en los DOS modos: si el evaluado
--    y el evaluador responden conjuntos distintos, las brechas por dimensión
--    dejan de significar algo.
--
--    Sin familia determinada devuelve los 30: preferir de más antes que dejar a
--    alguien sin evaluar por un cargo mal escrito.
-- ----------------------------------------------------------------------------

create or replace function eva_criterios_de_evaluacion(p_evaluacion_id uuid)
returns table (
  codigo text,
  dimension_codigo text,
  orden integer,
  texto_criterio text,
  tipo text,
  familia_codigo text,
  aplica boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_familia text;
begin
  select coalesce(e.familia_codigo, eva_familia_de(e.evaluado_id, e.cargo_actual))
    into v_familia
  from eva_evaluaciones e where e.id = p_evaluacion_id;

  return query
  select c.codigo, c.dimension_codigo, c.orden, c.texto_criterio, c.tipo,
         v_familia,
         coalesce(cf.aplica, true)
  from eva_criterios c
  left join eva_criterio_familia cf
    on cf.criterio_codigo = c.codigo and cf.familia_codigo = v_familia
  where v_familia is null or coalesce(cf.aplica, true)
  order by
    coalesce((select d.orden from eva_dimensiones d where d.codigo = c.dimension_codigo), 9),
    c.orden;
end;
$$;

grant execute on function eva_criterios_de_evaluacion(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Resumen para RRHH: qué tiene marcado cada familia
-- ----------------------------------------------------------------------------

create or replace function eva_criterio_familia_matriz()
returns table (
  criterio_codigo text,
  dimension_codigo text,
  dimension_nombre text,
  orden_dim integer,
  orden_crit integer,
  texto_criterio text,
  tipo text,
  familia_codigo text,
  familia_nombre text,
  orden_familia integer,
  aplica boolean,
  motivo text,
  cursos_que_aplican integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.codigo, c.dimension_codigo, d.nombre, d.orden, c.orden, c.texto_criterio, c.tipo,
    f.codigo, f.nombre, f.orden,
    coalesce(cf.aplica, true),
    cf.motivo,
    -- Cuántos de los cursos mapeados a ese criterio aplican a esa familia. Un 0
    -- acá no significa que el criterio no aplique: significa que si sale bajo,
    -- no hay curso de su batería que lo cierre y habrá que escribir la acción.
    (select count(*)::int
       from eva_criterio_cursos cc
       join eva_curso_familia cfa
         on cfa.curso_codigo = cc.curso_codigo and cfa.familia_codigo = f.codigo
      where cc.criterio_codigo = c.codigo)
  from eva_criterios c
  join eva_dimensiones d on d.codigo = c.dimension_codigo
  cross join eva_familias_cargo f
  left join eva_criterio_familia cf
    on cf.criterio_codigo = c.codigo and cf.familia_codigo = f.codigo;
$$;

grant execute on function eva_criterio_familia_matriz() to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Cambiar la matriz desde la aplicación
--
--    Por función de alcance estrecho, como el resto del módulo: así queda
--    registrado quién lo cambió, y la guardia del punto 2 no se puede saltar.
-- ----------------------------------------------------------------------------

create or replace function eva_marcar_criterio_familia(
  p_criterio_codigo text,
  p_familia_codigo text,
  p_aplica boolean,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((es_admin() or rol_en_modulo('personal') = 'rrhh'), false) then
    raise exception 'Sólo RRHH define qué criterios aplican a cada familia';
  end if;

  if not p_aplica and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Quitar un criterio de una familia exige decir por qué: queda en el registro y alguien lo va a preguntar';
  end if;

  insert into eva_criterio_familia (criterio_codigo, familia_codigo, aplica, motivo, actualizado_por, actualizado_en)
  values (p_criterio_codigo, p_familia_codigo, true, null, auth.uid(), now())
  on conflict (criterio_codigo, familia_codigo) do nothing;

  update eva_criterio_familia
    set aplica = p_aplica,
        motivo = case when p_aplica then null else trim(p_motivo) end,
        actualizado_por = auth.uid()
    where criterio_codigo = p_criterio_codigo and familia_codigo = p_familia_codigo;

  if not found then
    raise exception 'No existe ese cruce de criterio y familia';
  end if;
end;
$$;

grant execute on function eva_marcar_criterio_familia(text, text, boolean, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. EL MOTOR, ahora mirando el cargo
--
--    Se agrega una columna: aplica_familia. Tres valores posibles:
--
--      true   el curso es O o R para la familia de la persona
--      false  no tiene entrada en la matriz: «vacío = no aplica», dice tu hoja
--      null   no se pudo determinar la familia
--
--    Lo que NO se hace es descartarlos. Salen todos, y la pantalla agrupa: los
--    que aplican arriba y marcados, los que no, en un bloque aparte plegado y
--    desmarcados. Para F11 y F5 ese bloque es casi todo lo que existe.
-- ----------------------------------------------------------------------------

-- Se le agrega una columna al final, así que hay que soltarla: create or
-- replace no puede cambiar el tipo de retorno. Los cuerpos de las funciones que
-- la llaman son cadenas, no tienen dependencia rígida, y resuelven la versión
-- nueva en la siguiente llamada — pero eva_motor_pdi_con_seccion y
-- eva_motor_pdi_resumen sí devuelven sus columnas, y se recrean más abajo.
drop function if exists eva_motor_pdi_con_seccion(uuid);
drop function if exists eva_motor_pdi(uuid);

create function eva_motor_pdi(p_evaluacion_id uuid)
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
  aplica_familia boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_evaluado uuid;
  v_familia text;
begin
  select e.evaluado_id,
         coalesce(e.familia_codigo, eva_familia_de(e.evaluado_id, e.cargo_actual))
    into v_evaluado, v_familia
  from eva_evaluaciones e
  where e.id = p_evaluacion_id;

  if v_evaluado is null then
    return;
  end if;

  if not eva_puede_ver_evaluacion(p_evaluacion_id) then
    raise exception 'No tiene permiso para ver la propuesta de PDI de esta evaluación'
      using errcode = '42501';
  end if;

  return query
  with notas as (
    select d.criterio_codigo, d.nota, c.tipo, c.texto_criterio,
           c.dimension_codigo,
           coalesce(dim.orden, 9) * 10 + coalesce(c.orden, 9) as orden_criterio,
           dim.nombre as dimension_nombre, dim.peso
    from eva_detalle_sup d
    join eva_criterios c on c.codigo = d.criterio_codigo
    left join eva_dimensiones dim on dim.codigo = c.dimension_codigo
    where d.evaluacion_id = p_evaluacion_id
      and d.nota is not null
  ),
  vigentes as (
    select cap.curso_codigo, max(cap.fecha) as fecha_ultima
    from eva_capacitaciones cap
    join eva_cursos cu on cu.codigo = cap.curso_codigo
    where cap.perfil_id = v_evaluado
      and cap.estado = 'ejecutada'
      and coalesce(cap.aprobado, true)
      and (
        cu.recurrencia not in ('Anual', 'Bienal', 'Trienal')
        or cap.fecha > current_date - (
             case cu.recurrencia
               when 'Anual'   then interval '12 months'
               when 'Bienal'  then interval '24 months'
               when 'Trienal' then interval '36 months'
             end)
      )
    group by cap.curso_codigo
  ),
  brechas as (
    select
      'brecha'::text as origen,
      n.criterio_codigo, n.texto_criterio, n.dimension_codigo, n.dimension_nombre,
      n.tipo, n.nota, n.orden_criterio, n.peso,
      cc.curso_codigo, cc.orden as orden_curso,
      case n.nota when 1 then 1 when 2 then 2 when 3 then 4 end as prioridad
    from notas n
    join eva_criterio_cursos cc on cc.criterio_codigo = n.criterio_codigo
    where n.tipo = 'CAP' and n.nota <= 3
  ),
  bateria as (
    select
      'bateria'::text as origen,
      null::text as criterio_codigo, null::text as texto_criterio,
      null::text as dimension_codigo, null::text as dimension_nombre,
      null::text as tipo, null::integer as nota,
      999 as orden_criterio, 0::numeric as peso,
      cf.curso_codigo, 999 as orden_curso,
      3 as prioridad
    from eva_curso_familia cf
    where v_familia is not null
      and cf.familia_codigo = v_familia
      and cf.obligatoriedad = 'O'
  ),
  candidatas as (
    select * from brechas
    union all
    select * from bateria
  ),
  ganadoras as (
    select c.*,
      row_number() over (
        partition by c.curso_codigo
        order by c.prioridad asc, c.orden_criterio asc, c.orden_curso asc
      ) as rn,
      (select array_agg(distinct o.criterio_codigo order by o.criterio_codigo)
         from candidatas o
        where o.curso_codigo = c.curso_codigo
          and o.criterio_codigo is not null
          and o.criterio_codigo is distinct from c.criterio_codigo) as otros
    from candidatas c
  ),
  cursos_final as (
    select
      g.origen, g.criterio_codigo, g.texto_criterio, g.dimension_codigo,
      g.dimension_nombre, g.tipo, g.nota,
      cu.codigo as curso_codigo, cu.nombre as curso_nombre, cu.dominio,
      cu.modalidad, cu.nivel, cu.horas, cu.precio_ref, cu.criticidad,
      cu.franquiciable, cu.recurrencia, cu.financiamiento,
      g.prioridad, p.sigla, p.titulo, p.plazo, p.dias_sugeridos,
      cf.obligatoriedad as en_su_bateria,
      (v.curso_codigo is not null) as ya_lo_tiene,
      v.fecha_ultima,
      case
        when g.origen = 'bateria' and cu.criticidad = 'Legal'
          then 'P3 · HABILITANTE del cargo — obligatorio por norma'
        when g.origen = 'bateria'
          then 'P3 · obligatorio de la batería del cargo'
        when g.prioridad = 1 then 'P1 · brecha crítica — programar en el trimestre'
        when g.prioridad = 2 then 'P2 · brecha de desempeño — programar en el semestre'
        else 'P4 · refuerzo opcional si hay fondo'
      end as recomendacion,
      (v.curso_codigo is null) as incluir,
      case when v.curso_codigo is not null
        then 'Ya lo tiene vigente (' || to_char(v.fecha_ultima, 'MM-YYYY') || ')'
      end as motivo_exclusion,
      g.otros as tambien_pedido_por,
      exists (
        select 1 from eva_pdi pd
        where pd.evaluacion_id = p_evaluacion_id and pd.curso_codigo = cu.codigo
      ) as ya_en_pdi,
      g.prioridad * 1000 + coalesce(g.orden_criterio, 999) as orden_salida,
      -- La columna nueva. «vacío = no aplica» es la leyenda de tu MAPA_CARGO.
      case when v_familia is null then null else cf.obligatoriedad is not null end as aplica_familia
    from ganadoras g
    join eva_cursos cu on cu.codigo = g.curso_codigo
    join eva_prioridades_pdi p on p.prioridad = g.prioridad
    left join eva_curso_familia cf
      on cf.curso_codigo = g.curso_codigo and cf.familia_codigo = v_familia
    left join vigentes v on v.curso_codigo = g.curso_codigo
    where g.rn = 1 and cu.activo
  ),
  conducta as (
    select
      'conducta'::text as origen,
      n.criterio_codigo, n.texto_criterio, n.dimension_codigo, n.dimension_nombre,
      n.tipo, n.nota,
      null::text as curso_codigo, null::text as curso_nombre, null::text as dominio,
      null::text as modalidad, null::text as nivel, null::integer as horas,
      null::integer as precio_ref, null::text as criticidad,
      null::boolean as franquiciable, null::text as recurrencia,
      null::text as financiamiento,
      null::integer as prioridad, null::text as sigla, null::text as titulo,
      rc.plazo, null::integer as dias_sugeridos,
      null::text as en_su_bateria, false as ya_lo_tiene, null::date as fecha_ultima,
      'Conductual — no se cierra con curso: ' || rc.accion as recomendacion,
      (n.nota <= 2) as incluir,
      case when n.nota = 3
        then 'Nota 3: se refuerza la expectativa en la entrevista, no genera línea de PDI'
      end as motivo_exclusion,
      null::text[] as tambien_pedido_por,
      exists (
        select 1 from eva_pdi pd
        where pd.evaluacion_id = p_evaluacion_id
          and pd.criterio_codigo = n.criterio_codigo
          and pd.origen = 'conducta'
      ) as ya_en_pdi,
      n.nota * 10 + n.orden_criterio as orden_salida,
      true as aplica_familia
    from notas n
    join eva_reglas_conducta rc on rc.nota = n.nota
    where n.tipo = 'CON' and n.nota <= 3
  ),
  huerfanas as (
    select
      'brecha'::text as origen,
      n.criterio_codigo, n.texto_criterio, n.dimension_codigo, n.dimension_nombre,
      n.tipo, n.nota,
      null::text as curso_codigo, null::text as curso_nombre, null::text as dominio,
      null::text as modalidad, null::text as nivel, null::integer as horas,
      null::integer as precio_ref, null::text as criticidad,
      null::boolean as franquiciable, null::text as recurrencia,
      null::text as financiamiento,
      pr.prioridad, pr.sigla, pr.titulo, pr.plazo, pr.dias_sugeridos,
      null::text as en_su_bateria, false as ya_lo_tiene, null::date as fecha_ultima,
      pr.sigla || ' · brecha sin curso mapeado en la batería — requiere una acción '
        || 'escrita a mano (acompañamiento, tarea guiada o instrucción interna)'
        as recomendacion,
      true as incluir, null::text as motivo_exclusion,
      null::text[] as tambien_pedido_por,
      exists (
        select 1 from eva_pdi pd
        where pd.evaluacion_id = p_evaluacion_id
          and pd.criterio_codigo = n.criterio_codigo
          and pd.curso_codigo is null
      ) as ya_en_pdi,
      pr.prioridad * 1000 + n.orden_criterio as orden_salida,
      true as aplica_familia
    from notas n
    join eva_prioridades_pdi pr
      on pr.prioridad = case n.nota when 1 then 1 when 2 then 2 when 3 then 4 end
    where n.tipo = 'CAP' and n.nota <= 3
      and not exists (
        select 1 from eva_criterio_cursos cc
        join eva_cursos cu on cu.codigo = cc.curso_codigo and cu.activo
        where cc.criterio_codigo = n.criterio_codigo
      )
  )
  select x.* from (
    select * from conducta
    union all
    select * from huerfanas
    union all
    select * from cursos_final
  ) x
  order by
    (x.curso_codigo is not null),
    x.orden_salida,
    x.curso_codigo;
end;
$$;

grant execute on function eva_motor_pdi(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. eva_motor_pdi_con_seccion, con la columna nueva al final
-- ----------------------------------------------------------------------------

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
  aplica_familia boolean,
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
-- 8. El resumen separa lo que aplica de lo que no
--
--    Sin esto, el total que ve el Comité mezcla los cursos de la batería de la
--    persona con los que no son de su mundo, y el costo estimado queda inflado.
-- ----------------------------------------------------------------------------

drop function if exists eva_motor_pdi_resumen(uuid);

create function eva_motor_pdi_resumen(p_evaluacion_id uuid)
returns table (
  familia_codigo text,
  familia_nombre text,
  cursos_por_brecha integer,
  obligatorios_pendientes integer,
  total_propuesta integer,
  prioridad_1 integer,
  prioridad_2 integer,
  prioridad_3 integer,
  prioridad_4 integer,
  conductuales integer,
  habilitantes_legales integer,
  horas_totales integer,
  costo_estimado bigint,
  costo_franquiciable bigint,
  ya_vigentes integer,
  fuera_de_su_bateria integer,
  horas_fuera integer,
  costo_fuera bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (select * from eva_motor_pdi(p_evaluacion_id)),
  aplica as (select * from m where coalesce(m.aplica_familia, true)),
  fuera as (select * from m where m.aplica_familia is false),
  fam as (
    select coalesce(e.familia_codigo, eva_familia_de(e.evaluado_id, e.cargo_actual)) as codigo
    from eva_evaluaciones e where e.id = p_evaluacion_id
  )
  select
    fam.codigo,
    f.nombre,
    (select count(*) from aplica a where a.origen = 'brecha'  and a.incluir)::int,
    (select count(*) from aplica a where a.origen = 'bateria' and a.incluir)::int,
    (select count(*) from aplica a where a.incluir and a.origen <> 'conducta')::int,
    (select count(*) from aplica a where a.prioridad = 1 and a.incluir)::int,
    (select count(*) from aplica a where a.prioridad = 2 and a.incluir)::int,
    (select count(*) from aplica a where a.prioridad = 3 and a.incluir)::int,
    (select count(*) from aplica a where a.prioridad = 4 and a.incluir)::int,
    (select count(*) from aplica a where a.origen = 'conducta' and a.incluir)::int,
    (select count(*) from aplica a where a.criticidad = 'Legal' and a.incluir)::int,
    (select coalesce(sum(a.horas), 0) from aplica a where a.incluir)::int,
    (select coalesce(sum(a.precio_ref), 0) from aplica a where a.incluir)::bigint,
    (select coalesce(sum(a.precio_ref), 0) from aplica a where a.incluir and a.franquiciable)::bigint,
    (select count(*) from m where m.curso_codigo is not null and not m.incluir)::int,
    (select count(*) from fuera where fuera.incluir)::int,
    (select coalesce(sum(fuera.horas), 0) from fuera where fuera.incluir)::int,
    (select coalesce(sum(fuera.precio_ref), 0) from fuera where fuera.incluir)::bigint
  from fam
  left join eva_familias_cargo f on f.codigo = fam.codigo;
$$;

grant execute on function eva_motor_pdi_resumen(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 9. Los promedios sólo cuentan los criterios que aplican
--
--    Fuga que quedaba abierta: si RRHH quita un criterio de una familia DESPUÉS
--    de que alguien ya lo calificó, la nota vieja se queda en eva_detalle_sup y
--    seguía pesando en el promedio de su sección. El formulario la limpia en el
--    siguiente guardado, pero las evaluaciones en vuelo quedaban a medio camino.
--
--    Ahora el promedio ignora las notas de criterios que no aplican, y la
--    función informa cuántas ignoró: si el número no es cero, alguien tiene que
--    saber que ese expediente se calificó con otra regla.
-- ----------------------------------------------------------------------------

drop function if exists eva_motor_pdi_secciones(uuid);

create function eva_motor_pdi_secciones(p_evaluacion_id uuid)
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
  recomendacion text,
  notas_de_criterios_que_no_aplican integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_familia text;
begin
  if not eva_puede_ver_evaluacion(p_evaluacion_id) then
    raise exception 'No tiene permiso para ver la lectura por sección de esta evaluación'
      using errcode = '42501';
  end if;

  select coalesce(e.familia_codigo, eva_familia_de(e.evaluado_id, e.cargo_actual))
    into v_familia
  from eva_evaluaciones e where e.id = p_evaluacion_id;

  return query
  with aplicables as (
    select c.codigo, c.dimension_codigo, c.tipo,
           coalesce(cf.aplica, true) as aplica
    from eva_criterios c
    left join eva_criterio_familia cf
      on cf.criterio_codigo = c.codigo and cf.familia_codigo = v_familia
  ),
  notas as (
    select a.dimension_codigo, a.codigo as criterio_codigo, a.tipo, a.aplica,
           ds.nota as nota_sup, da.nota as nota_auto
    from aplicables a
    left join eva_detalle_sup ds
      on ds.criterio_codigo = a.codigo and ds.evaluacion_id = p_evaluacion_id
    left join eva_detalle_auto da
      on da.criterio_codigo = a.codigo and da.evaluacion_id = p_evaluacion_id
  ),
  agregado as (
    select
      n.dimension_codigo,
      round(avg(n.nota_sup) filter (where n.aplica)::numeric, 2) as prom_sup,
      round(avg(n.nota_auto) filter (where n.aplica)::numeric, 2) as prom_auto,
      count(*) filter (where n.aplica and n.nota_sup is not null and n.nota_sup < 3)::int as bajo_3,
      count(*) filter (where n.aplica and n.nota_sup is not null and n.nota_sup <= 2)::int as en_1_o_2,
      count(*) filter (where n.aplica and n.nota_sup is not null and n.nota_sup <= 3)::int as hasta_3,
      count(*) filter (where not n.aplica and n.nota_sup is not null)::int as huerfanas
    from notas n
    group by n.dimension_codigo
  ),
  motor as (
    select m.* from eva_motor_pdi(p_evaluacion_id) m
    where m.dimension_codigo is not null
  )
  select
    comp.dimension_codigo, comp.dimension_nombre, comp.peso, comp.orden,
    comp.cap, comp.con, comp.advertencia,
    ag.prom_sup, ag.prom_auto,
    case when ag.prom_sup is null or ag.prom_auto is null
         then null else round(ag.prom_sup - ag.prom_auto, 2) end,
    case when ag.prom_sup is null then null else round(ag.prom_sup * comp.peso, 3) end,
    t.sigla, t.categoria, t.prioridad, t.que_se_hace, t.filtro_criticidad, t.plazo,
    coalesce(ag.bajo_3, 0), coalesce(ag.en_1_o_2, 0), coalesce(ag.hasta_3, 0),
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
    (select count(*) from motor m
      where m.dimension_codigo = comp.dimension_codigo
        and m.curso_codigo is not null and m.incluir
        and not (m.criticidad = any (coalesce(t.criticidades, array[]::text[]))))::int,
    case
      when ag.prom_sup is null then 'Sin calificar todavía.'
      when t.prioridad is not null and comp.con > comp.cap then
        'Promedio ' || sgc_nota(ag.prom_sup) || ' · tramo ' || t.sigla || '. Esta sección es mayormente '
        || 'conductual: lo que corresponde acá es acompañamiento de la jefatura y compromisos con fecha, '
        || 'no capacitación. ' || sgc_plural(coalesce(ag.en_1_o_2, 0), 'criterio', 'criterios') || ' en 1 o 2.'
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
    end,
    coalesce(ag.huerfanas, 0)
  from eva_seccion_composicion() comp
  left join agregado ag on ag.dimension_codigo = comp.dimension_codigo
  left join eva_segmento_tramos t on t.sigla = eva_tramo_de(ag.prom_sup)
  order by comp.orden;
end;
$$;

grant execute on function eva_motor_pdi_secciones(uuid) to authenticated;


notify pgrst, 'reload schema';

