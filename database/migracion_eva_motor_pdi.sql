-- ============================================================================
-- SGC METALIUM · Motor de PDI de la evaluación de personal
--
-- Reemplaza el recomendador anterior (categoría + dimensión más débil) por el
-- motor real de la planilla oficial:
--
--   RRHH-FOR-EVA-AD-001 v2.0 · hoja 06_PDI_AUTO, 11_MAPA_CRITERIO, 13_MAESTROS
--   RRHH-FOR-CAP-11    v2.0 · hojas CATALOGO y MAPA_CARGO
--
-- La regla, textual de la hoja 01 del listado:
--
--   «la nota propone, la conversación decide, el sello compromete y el Comité
--    financia. Ninguna brecha detectada queda sin acción; ninguna capacitación
--    se contrata sin una brecha que la justifique.»  · RRHH-PRO-EVA-PDI-001
--
-- Cómo funciona, en una línea: la nota de CADA criterio (no el promedio) fija
-- la prioridad; la prioridad arrastra los cursos que la batería corporativa
-- tiene mapeados a ese criterio; los ocho criterios conductuales no gatillan
-- curso nunca; y a todo eso se suman los obligatorios del cargo que la persona
-- todavía no tiene.
--
--   Nota 1 → P1 · brecha crítica          · dentro del trimestre
--   Nota 2 → P2 · brecha de desempeño     · dentro del semestre
--   Nota 3 → P4 · refuerzo opcional       · si el Comité lo prioriza
--   Nota 4 → nada (se reconoce en la entrevista con ejemplos concretos)
--   Nota 5 → nada + candidatura a relator interno N4
--   Batería del cargo → P3 · obligatorio  · dentro del año del plan
--
-- Todos los datos de este archivo salen leídos directamente de las dos
-- planillas: 160 cursos, 626 celdas de la matriz curso × familia, 92 mapeos
-- criterio × curso, 54 cargos y 11 familias. No hay nada transcrito a mano.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Helper de normalización de texto
--
--    perfiles.cargo es texto libre, así que para deducir la familia del cargo
--    hay que comparar sin acentos ni mayúsculas. unaccent es una extensión que
--    no siempre está instalada; translate() sí está siempre.
-- ----------------------------------------------------------------------------

create or replace function sgc_norm(p_texto text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(regexp_replace(
      translate(lower(coalesce(p_texto, '')),
                'áéíóúüñàèìòùâêîôûäëïöçÁÉÍÓÚÜÑ',
                'aeiouunaeiouaeiouaeiocAEIOUUN'),
      '\s+', ' ', 'g')),
    '');
$$;


-- ----------------------------------------------------------------------------
-- 1. Familias de cargos y cargos de la organización
--
--    La batería obligatoria no se define por cargo sino por FAMILIA (F1..F11).
--    De ahí que haga falta el catálogo de cargos: es el puente entre el cargo
--    que trae el perfil de la persona y la columna de la matriz.
-- ----------------------------------------------------------------------------

create table if not exists eva_familias_cargo (
  codigo text primary key,
  nombre text not null,
  orden integer
);

create table if not exists eva_cargos_catalogo (
  nombre text primary key,
  familia_codigo text not null references eva_familias_cargo(codigo),
  activo boolean not null default true
);

create index if not exists idx_cargos_catalogo_norm
  on eva_cargos_catalogo (sgc_norm(nombre));

alter table eva_familias_cargo enable row level security;
alter table eva_cargos_catalogo enable row level security;

drop policy if exists "personal_lee_familias" on eva_familias_cargo;
create policy "personal_lee_familias" on eva_familias_cargo
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_familias" on eva_familias_cargo;
create policy "rrhh_edita_familias" on eva_familias_cargo
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

drop policy if exists "personal_lee_cargos_cat" on eva_cargos_catalogo;
create policy "personal_lee_cargos_cat" on eva_cargos_catalogo
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_cargos_cat" on eva_cargos_catalogo;
create policy "rrhh_edita_cargos_cat" on eva_cargos_catalogo
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');


-- ----------------------------------------------------------------------------
-- 2. Batería corporativa de capacitación — los 160 cursos
-- ----------------------------------------------------------------------------

create table if not exists eva_cursos (
  codigo text primary key,
  dominio text,
  nombre text not null,
  objetivo text,
  modalidad text,
  horas integer,
  nivel text,
  financiamiento text,
  franquiciable boolean not null default false,
  criticidad text,
  recurrencia text,
  precio_ref integer,
  activo boolean not null default true
);

alter table eva_cursos enable row level security;

drop policy if exists "personal_lee_cursos" on eva_cursos;
create policy "personal_lee_cursos" on eva_cursos
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_cursos" on eva_cursos;
create policy "rrhh_edita_cursos" on eva_cursos
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');


-- ----------------------------------------------------------------------------
-- 3. Matriz curso × familia: la batería obligatoria del puesto (P3)
--
--    O = obligatorio para la familia · R = recomendado.
--    Sólo los «O» que la persona no tiene entran al PDI como P3. Los «R»
--    quedan visibles como sugerencia, pero el motor no los propone solo.
-- ----------------------------------------------------------------------------

create table if not exists eva_curso_familia (
  curso_codigo text not null references eva_cursos(codigo) on delete cascade,
  familia_codigo text not null references eva_familias_cargo(codigo) on delete cascade,
  obligatoriedad text not null check (obligatoriedad in ('O', 'R')),
  primary key (curso_codigo, familia_codigo)
);

alter table eva_curso_familia enable row level security;

drop policy if exists "personal_lee_curso_familia" on eva_curso_familia;
create policy "personal_lee_curso_familia" on eva_curso_familia
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_curso_familia" on eva_curso_familia;
create policy "rrhh_edita_curso_familia" on eva_curso_familia
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');


-- ----------------------------------------------------------------------------
-- 4. Tipo de criterio: CAP capacitable / CON conductual
--
--    Ésta es la excepción que hace que el motor no sea una tabla de multiplicar:
--    una nota baja en asistencia, puntualidad, jornada, RIOHS, presentación,
--    honestidad, respeto o disposición a capacitarse NO se resuelve con un
--    curso. El motor lo dice expresamente en lugar de proponer capacitación.
-- ----------------------------------------------------------------------------

-- El orden fijo del recorrido de la entrevista (TC → SS → DL → VH → CM) también
-- es el desempate del motor cuando dos criterios de la misma prioridad piden el
-- mismo curso. eva_criterios.orden va del 1 al 6 DENTRO de cada dimensión, así
-- que sin el orden de la dimensión el desempate mezclaría dimensiones.
alter table eva_dimensiones add column if not exists orden integer;
update eva_dimensiones set orden = case codigo
  when 'TC' then 1 when 'SS' then 2 when 'DL' then 3
  when 'VH' then 4 when 'CM' then 5 end
where orden is null or orden <> (case codigo
  when 'TC' then 1 when 'SS' then 2 when 'DL' then 3
  when 'VH' then 4 when 'CM' then 5 end);

alter table eva_criterios add column if not exists tipo text not null default 'CAP';
alter table eva_criterios drop constraint if exists eva_criterios_tipo_check;
alter table eva_criterios add constraint eva_criterios_tipo_check
  check (tipo in ('CAP', 'CON'));


-- ----------------------------------------------------------------------------
-- 5. Cruce criterio × cursos — el corazón de la automatización
-- ----------------------------------------------------------------------------

create table if not exists eva_criterio_cursos (
  criterio_codigo text not null references eva_criterios(codigo) on delete cascade,
  curso_codigo text not null references eva_cursos(codigo) on delete cascade,
  orden integer not null default 1,
  primary key (criterio_codigo, curso_codigo)
);

alter table eva_criterio_cursos enable row level security;

drop policy if exists "personal_lee_criterio_cursos" on eva_criterio_cursos;
create policy "personal_lee_criterio_cursos" on eva_criterio_cursos
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_criterio_cursos" on eva_criterio_cursos;
create policy "rrhh_edita_criterio_cursos" on eva_criterio_cursos
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');


-- ----------------------------------------------------------------------------
-- 6. La regla: prioridades del PDI y regla conductual
--
--    Están en tablas y no dentro de la función a propósito: si el Comité
--    cambia un plazo o una redacción, lo cambia acá y no hay que tocar código.
-- ----------------------------------------------------------------------------

create table if not exists eva_prioridades_pdi (
  prioridad integer primary key check (prioridad between 1 and 4),
  sigla text not null,
  titulo text not null,
  descripcion text not null,
  plazo text not null,
  dias_sugeridos integer not null,
  exige_evidencia boolean not null default false,
  orden integer
);

create table if not exists eva_reglas_conducta (
  nota integer primary key check (nota between 1 and 5),
  accion text not null,
  plazo text,
  escala_rrhh boolean not null default false
);

alter table eva_prioridades_pdi enable row level security;
alter table eva_reglas_conducta enable row level security;

drop policy if exists "personal_lee_prioridades" on eva_prioridades_pdi;
create policy "personal_lee_prioridades" on eva_prioridades_pdi
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_prioridades" on eva_prioridades_pdi;
create policy "rrhh_edita_prioridades" on eva_prioridades_pdi
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

drop policy if exists "personal_lee_reglas_conducta" on eva_reglas_conducta;
create policy "personal_lee_reglas_conducta" on eva_reglas_conducta
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_reglas_conducta" on eva_reglas_conducta;
create policy "rrhh_edita_reglas_conducta" on eva_reglas_conducta
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

insert into eva_prioridades_pdi
  (prioridad, sigla, titulo, descripcion, plazo, dias_sugeridos, exige_evidencia, orden) values
(1, 'P1', 'Brecha crítica',
 'Compromete el desempeño del cargo. Entran al PDI todos los cursos mapeados a ese criterio. La nota exige comentario con evidencia (modelo Situación–Comportamiento–Impacto) y abordaje obligatorio en la entrevista.',
 'Dentro del trimestre', 90, true, 1),
(2, 'P2', 'Brecha de desempeño',
 'Debe cerrarse dentro del período. Entran los cursos mapeados al criterio. La nota exige comentario con evidencia.',
 'Dentro del semestre', 180, true, 2),
(3, 'P3', 'Obligatorio de la batería del cargo',
 'Curso obligatorio del puesto que la persona aún no tiene, independiente de su nota. Incluye los habilitantes por ley.',
 'Dentro del año del plan', 365, false, 3),
(4, 'P4', 'Refuerzo opcional',
 'Está en el mínimo esperado. Refuerzo opcional, sólo si el Comité tiene fondo disponible.',
 'Si el Comité lo prioriza', 365, false, 4)
on conflict (prioridad) do update set
  sigla = excluded.sigla, titulo = excluded.titulo,
  descripcion = excluded.descripcion, plazo = excluded.plazo,
  dias_sugeridos = excluded.dias_sugeridos,
  exige_evidencia = excluded.exige_evidencia, orden = excluded.orden;

insert into eva_reglas_conducta (nota, accion, plazo, escala_rrhh) values
(1, 'Acompañamiento de la jefatura y compromiso conductual verificable con fecha. Escalamiento a RRHH-PRO-09 (medidas disciplinarias) si corresponde. RRHH acompaña la entrevista.',
 'Compromiso con fecha en la misma entrevista', true),
(2, 'Se nombra la conducta con evidencia, se explicita la expectativa y se acuerda un compromiso verificable con fecha. Si reincide, se activa el plan de mejora del desempeño (PMD).',
 'Compromiso con fecha en la misma entrevista', false),
(3, 'Se refuerza la expectativa en la entrevista. No genera curso ni línea de PDI.',
 null, false),
(4, 'No genera línea de PDI. Se reconoce en la entrevista con ejemplos concretos.',
 null, false),
(5, 'No genera línea de PDI. Genera candidatura a relator interno N4: «el que sabe, enseña».',
 null, false)
on conflict (nota) do update set
  accion = excluded.accion, plazo = excluded.plazo, escala_rrhh = excluded.escala_rrhh;


-- ----------------------------------------------------------------------------
-- 7. Familia de la persona
--
--    Se guarda en el perfil cuando RRHH la fija a mano, y se congela en la
--    evaluación al momento de crearla: si la persona cambia de cargo después,
--    el expediente firmado sigue diciendo con qué batería se evaluó.
-- ----------------------------------------------------------------------------

alter table perfiles add column if not exists familia_codigo text;
alter table perfiles drop constraint if exists perfiles_familia_codigo_fkey;
alter table perfiles add constraint perfiles_familia_codigo_fkey
  foreign key (familia_codigo) references eva_familias_cargo(codigo);

alter table eva_evaluaciones add column if not exists familia_codigo text;
alter table eva_evaluaciones drop constraint if exists eva_evaluaciones_familia_codigo_fkey;
alter table eva_evaluaciones add constraint eva_evaluaciones_familia_codigo_fkey
  foreign key (familia_codigo) references eva_familias_cargo(codigo);

-- Resuelve la familia en tres saltos: la de la evaluación, la fijada a mano en
-- el perfil, o la deducida del texto del cargo contra el catálogo de cargos.
create or replace function eva_familia_de(p_perfil_id uuid, p_cargo text default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fam text;
  v_cargo text;
begin
  select p.familia_codigo, coalesce(p_cargo, p.cargo)
    into v_fam, v_cargo
  from perfiles p where p.id = p_perfil_id;

  if v_fam is not null then
    return v_fam;
  end if;

  if coalesce(p_cargo, '') <> '' then
    v_cargo := p_cargo;
  end if;

  select c.familia_codigo into v_fam
  from eva_cargos_catalogo c
  where c.activo and sgc_norm(c.nombre) = sgc_norm(v_cargo)
  limit 1;

  return v_fam;
end;
$$;

grant execute on function eva_familia_de(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. Historial de capacitación — el «¿ya lo tiene?» del motor
--
--    Sin esto el motor volvería a proponer año tras año los mismos cursos
--    obligatorios. Un curso cuenta como vigente según su recurrencia:
--    Anual 12 meses, Bienal 24, Única y Al ingreso no caducan.
-- ----------------------------------------------------------------------------

create table if not exists eva_capacitaciones (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles(id) on delete cascade,
  curso_codigo text not null references eva_cursos(codigo),
  fecha date not null,
  estado text not null default 'ejecutada'
    check (estado in ('planificada', 'en_curso', 'ejecutada', 'anulada')),
  horas integer,
  otec text,
  aprobado boolean,
  observaciones text,
  origen text default 'manual',
  registrado_por uuid references perfiles(id),
  creado_en timestamptz not null default now()
);

create index if not exists idx_capacitaciones_perfil on eva_capacitaciones (perfil_id);
create index if not exists idx_capacitaciones_curso on eva_capacitaciones (curso_codigo);

alter table eva_capacitaciones enable row level security;

drop policy if exists "cap_lee_propias" on eva_capacitaciones;
create policy "cap_lee_propias" on eva_capacitaciones
  for select to authenticated
  using (perfil_id = auth.uid());

drop policy if exists "cap_lee_gestion" on eva_capacitaciones;
create policy "cap_lee_gestion" on eva_capacitaciones
  for select to authenticated
  using (
    es_admin()
    or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar')
    or exists (
      select 1 from eva_evaluaciones e
      where e.evaluado_id = eva_capacitaciones.perfil_id
        and e.evaluador_id = auth.uid()
    )
  );

drop policy if exists "cap_escribe_gestion" on eva_capacitaciones;
create policy "cap_escribe_gestion" on eva_capacitaciones
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar'))
  with check (es_admin() or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar'));


-- ----------------------------------------------------------------------------
-- 9. Columnas del PDI para las líneas del motor
--
--    Las acciones del PDI ya existían como texto libre (accion_smart). Ahora
--    una línea puede además venir de un curso concreto, con su prioridad, su
--    origen y su costo congelado al momento del sello: el precio de referencia
--    del catálogo cambia, pero lo que el Comité aprobó no.
-- ----------------------------------------------------------------------------

alter table eva_pdi add column if not exists curso_codigo text;
alter table eva_pdi drop constraint if exists eva_pdi_curso_codigo_fkey;
alter table eva_pdi add constraint eva_pdi_curso_codigo_fkey
  foreign key (curso_codigo) references eva_cursos(codigo);

alter table eva_pdi add column if not exists criterio_codigo text;
alter table eva_pdi drop constraint if exists eva_pdi_criterio_codigo_fkey;
alter table eva_pdi add constraint eva_pdi_criterio_codigo_fkey
  foreign key (criterio_codigo) references eva_criterios(codigo);

alter table eva_pdi add column if not exists prioridad integer;
alter table eva_pdi drop constraint if exists eva_pdi_prioridad_check;
alter table eva_pdi add constraint eva_pdi_prioridad_check
  check (prioridad is null or prioridad between 1 and 4);

alter table eva_pdi add column if not exists origen text;
alter table eva_pdi drop constraint if exists eva_pdi_origen_check;
alter table eva_pdi add constraint eva_pdi_origen_check
  check (origen is null or origen in ('brecha', 'bateria', 'conducta', 'manual'));

alter table eva_pdi add column if not exists plazo_sugerido text;
alter table eva_pdi add column if not exists horas integer;
alter table eva_pdi add column if not exists precio_ref integer;
alter table eva_pdi add column if not exists nota_criterio integer;

-- Lo que el motor propuso y la conversación descartó. El checklist de la
-- entrevista (ítem B8) exige que cada línea quitada quede justificada por
-- escrito: acá queda, y viaja con el expediente.
create table if not exists eva_pdi_descartes (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references eva_evaluaciones(id) on delete cascade,
  curso_codigo text references eva_cursos(codigo),
  criterio_codigo text references eva_criterios(codigo),
  prioridad integer,
  motivo text not null,
  descartado_por uuid references perfiles(id),
  creado_en timestamptz not null default now()
);

create index if not exists idx_pdi_descartes_eval on eva_pdi_descartes (evaluacion_id);

alter table eva_pdi_descartes enable row level security;

drop policy if exists "descartes_lee" on eva_pdi_descartes;
create policy "descartes_lee" on eva_pdi_descartes
  for select to authenticated
  using (
    es_admin()
    or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar')
    or exists (
      select 1 from eva_evaluaciones e
      where e.id = eva_pdi_descartes.evaluacion_id
        and (e.evaluador_id = auth.uid() or e.evaluado_id = auth.uid())
    )
  );

drop policy if exists "descartes_escribe_evaluador" on eva_pdi_descartes;
create policy "descartes_escribe_evaluador" on eva_pdi_descartes
  for all to authenticated
  using (
    es_admin()
    or rol_en_modulo('personal') = 'rrhh'
    or exists (
      select 1 from eva_evaluaciones e
      where e.id = eva_pdi_descartes.evaluacion_id and e.evaluador_id = auth.uid()
    )
  )
  with check (
    es_admin()
    or rol_en_modulo('personal') = 'rrhh'
    or exists (
      select 1 from eva_evaluaciones e
      where e.id = eva_pdi_descartes.evaluacion_id and e.evaluador_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 9 bis. Quién puede ver la propuesta de una evaluación
--
--     El motor es security definer: tiene que serlo, porque lee el catálogo, la
--     matriz por familia y el historial de capacitación, y ningún evaluador
--     tiene permiso directo sobre todo eso a la vez. Pero definer significa que
--     salta la RLS, así que sin esta reja cualquier usuario autenticado podría
--     pedir la propuesta de cualquier evaluación — y de la propuesta se deduce
--     quién sacó 1 en qué. La reja se aplica dentro de cada función.
-- ----------------------------------------------------------------------------

create or replace function eva_puede_ver_evaluacion(p_evaluacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select es_admin()
        or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar')
        or e.evaluador_id = auth.uid()
        or e.evaluado_id = auth.uid()
    from eva_evaluaciones e
    where e.id = p_evaluacion_id
  ), false);
$$;

grant execute on function eva_puede_ver_evaluacion(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 10. EL MOTOR
--
--     Devuelve la propuesta completa para una evaluación: una fila por cada
--     línea candidata, ya deduplicada y ordenada por prioridad.
--
--     Dos decisiones que conviene tener a la vista:
--
--     a) DEDUPLICACIÓN POR MAYOR PRIORIDAD. Cuando dos criterios gatillan el
--        mismo curso, la planilla se queda con la PRIMERA aparición en el orden
--        de los criterios. Eso tiene una consecuencia mala: si TC1 sale 3 (P4,
--        «opcional si hay fondo») y SS1 sale 1 (P1, «brecha crítica») y ambos
--        mapean el mismo curso, la planilla lo deja en P4 y la brecha crítica
--        se queda sin financiamiento asegurado. Acá gana la prioridad más
--        alta, y la fila indica qué otros criterios pedían el mismo curso.
--        Es la única desviación deliberada respecto de la hoja 06.
--
--     b) VIGENCIA EN VEZ DE «ya lo tiene» BINARIO. La planilla marca a mano si
--        la persona tiene el curso. Acá se calcula con la recurrencia del
--        catálogo: un curso Anual hecho hace tres años vuelve a estar pendiente.
-- ----------------------------------------------------------------------------

create or replace function eva_motor_pdi(p_evaluacion_id uuid)
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
  orden_salida integer
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
  -- Lo que la persona tiene vigente hoy, según la recurrencia del curso.
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
  -- Criterios CAP con nota 1..3: brecha que arrastra los cursos mapeados.
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
  -- Obligatorios de la batería del cargo, con nota o sin ella.
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
  -- Un curso, una línea: gana la prioridad más alta (número más bajo).
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
      g.prioridad * 1000 + coalesce(g.orden_criterio, 999) as orden_salida
    from ganadoras g
    join eva_cursos cu on cu.codigo = g.curso_codigo
    join eva_prioridades_pdi p on p.prioridad = g.prioridad
    left join eva_curso_familia cf
      on cf.curso_codigo = g.curso_codigo and cf.familia_codigo = v_familia
    left join vigentes v on v.curso_codigo = g.curso_codigo
    where g.rn = 1 and cu.activo
  ),
  -- Criterios conductuales con nota 1..3: compromiso, no curso.
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
      -- La nota 3 conductual se refuerza en la conversación pero NO genera línea
      -- de PDI: la hoja 01·C lo dice expresamente. Sale igual en la propuesta
      -- para que el evaluador la aborde, marcada como no incluible.
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
      n.nota * 10 + n.orden_criterio as orden_salida
    from notas n
    join eva_reglas_conducta rc on rc.nota = n.nota
    where n.tipo = 'CON' and n.nota <= 3
  ),
  -- Red de seguridad de la regla de oro: «ninguna brecha detectada queda sin
  -- acción». Si un criterio capacitable sale bajo y el Comité le quitó todos
  -- los cursos del mapa, la brecha desaparecería en silencio. Acá sale igual,
  -- como línea sin curso, para que el evaluador escriba una acción a mano.
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
      pr.prioridad * 1000 + n.orden_criterio as orden_salida
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
  -- El alias x es necesario: sin él, «curso_codigo» del order by choca con el
  -- parámetro de salida de la función y Postgres lo rechaza por ambiguo.
  select x.* from (
    select * from conducta
    union all
    select * from huerfanas
    union all
    select * from cursos_final
  ) x
  order by
    (x.curso_codigo is not null),   -- lo conductual primero: se acuerda en la reunión
    x.orden_salida,
    x.curso_codigo;
end;
$$;

grant execute on function eva_motor_pdi(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 11. Resumen de la propuesta — lo que el Comité necesita ver de una mirada
-- ----------------------------------------------------------------------------

create or replace function eva_motor_pdi_resumen(p_evaluacion_id uuid)
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
  ya_vigentes integer
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (select * from eva_motor_pdi(p_evaluacion_id)),  -- la reja va dentro
  fam as (
    select coalesce(e.familia_codigo, eva_familia_de(e.evaluado_id, e.cargo_actual)) as codigo
    from eva_evaluaciones e where e.id = p_evaluacion_id
  )
  select
    fam.codigo,
    f.nombre,
    count(*) filter (where m.origen = 'brecha'  and m.incluir)::int,
    count(*) filter (where m.origen = 'bateria' and m.incluir)::int,
    count(*) filter (where m.incluir and m.origen <> 'conducta')::int,
    count(*) filter (where m.prioridad = 1 and m.incluir)::int,
    count(*) filter (where m.prioridad = 2 and m.incluir)::int,
    count(*) filter (where m.prioridad = 3 and m.incluir)::int,
    count(*) filter (where m.prioridad = 4 and m.incluir)::int,
    count(*) filter (where m.origen = 'conducta' and m.incluir)::int,
    count(*) filter (where m.criticidad = 'Legal' and m.incluir)::int,
    coalesce(sum(m.horas) filter (where m.incluir), 0)::int,
    coalesce(sum(m.precio_ref) filter (where m.incluir), 0)::bigint,
    coalesce(sum(m.precio_ref) filter (where m.incluir and m.franquiciable), 0)::bigint,
    count(*) filter (where m.curso_codigo is not null and not m.incluir)::int
  from fam
  left join eva_familias_cargo f on f.codigo = fam.codigo
  left join m on true
  group by fam.codigo, f.nombre;
$$;

grant execute on function eva_motor_pdi_resumen(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 12. El recomendador anterior queda desactivado, no borrado
--
--     eva_planes_catalogo tenía 19 planes de acción genéricos que yo redacté
--     antes de tener la batería real. Ahora que existe el motor con los 160
--     cursos oficiales, esos planes ya no se proponen solos — pero no se
--     borran: hay PDI que los referencian por FK y RRHH puede haberlos
--     editado. Quedan disponibles como acción escrita a mano.
-- ----------------------------------------------------------------------------

alter table eva_planes_catalogo add column if not exists propone_motor boolean not null default true;
update eva_planes_catalogo set propone_motor = false where propone_motor;

-- eva_planes_sugeridos (migración anterior) tenía el mismo hueco que el motor:
-- security definer sin reja, y su resultado deja ver la categoría obtenida por
-- la persona. Se le agrega la misma verificación, sin cambiar nada más.
create or replace function eva_planes_sugeridos(p_evaluacion_id uuid)
returns table (
  codigo text,
  titulo text,
  accion_smart text,
  dimension_codigo text,
  dimension_nombre text,
  responsable_sugerido text,
  recursos_sugeridos text,
  duracion_dias integer,
  es_dimension_debil boolean,
  ya_en_pdi boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_categoria text;
  v_dim_debil text;
begin
  if not eva_puede_ver_evaluacion(p_evaluacion_id) then
    raise exception 'No tiene permiso para ver los planes sugeridos de esta evaluación'
      using errcode = '42501';
  end if;

  select e.categoria into v_categoria from eva_evaluaciones e where e.id = p_evaluacion_id;
  if v_categoria is null then
    return;
  end if;

  select d.codigo into v_dim_debil
  from eva_dimensiones d
  join eva_evaluaciones e on e.id = p_evaluacion_id
  cross join lateral (
    select case lower(d.codigo)
      when 'tc' then e.prom_sup_tc
      when 'ss' then e.prom_sup_ss
      when 'dl' then e.prom_sup_dl
      when 'vh' then e.prom_sup_vh
      when 'cm' then e.prom_sup_cm
    end as nota
  ) n
  where n.nota is not null
  order by n.nota asc, d.peso desc
  limit 1;

  return query
  select
    c.codigo, c.titulo, c.accion_smart, c.dimension_codigo, dim.nombre,
    c.responsable_sugerido, c.recursos_sugeridos, c.duracion_dias,
    (c.dimension_codigo is not null and c.dimension_codigo = v_dim_debil),
    exists (select 1 from eva_pdi p where p.evaluacion_id = p_evaluacion_id and p.plan_codigo = c.codigo)
  from eva_planes_catalogo c
  left join eva_dimensiones dim on dim.codigo = c.dimension_codigo
  where c.activo
    and v_categoria = any (c.categorias)
    and (c.dimension_codigo is null or c.dimension_codigo = v_dim_debil)
  order by
    (c.dimension_codigo is not null and c.dimension_codigo = v_dim_debil) desc,
    c.orden;
end;
$$;

grant execute on function eva_planes_sugeridos(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 13. DATOS — leídos directamente de las dos planillas oficiales
-- ----------------------------------------------------------------------------

-- 1. Familias de cargos (13_MAESTROS · D)
insert into eva_familias_cargo (codigo, nombre, orden) values
  ('F1', 'Gerencias y jefaturas', 1),
  ('F2', 'Administración de obra', 2),
  ('F3', 'Oficina Técnica e Ingeniería', 3),
  ('F4', 'Supervisión y prevención', 4),
  ('F5', 'Maestros y especialidades', 5),
  ('F6', 'Taller Liray', 6),
  ('F7', 'Logística, compras y bodega', 7),
  ('F8', 'Finanzas y contabilidad', 8),
  ('F9', 'RRHH y JDE (TI/SGC)', 9),
  ('F10', 'Licitaciones y comercial', 10),
  ('F11', 'Servicios de obra', 11)
on conflict (codigo) do update set nombre = excluded.nombre, orden = excluded.orden;

-- 2. Cargos de la organizacion y su familia (13_MAESTROS · F) -- 54 cargos
insert into eva_cargos_catalogo (nombre, familia_codigo) values
  ('Gerente de Operaciones', 'F1'),
  ('Gerente de Ingeniería', 'F1'),
  ('Gerente de Finanzas Corporativas', 'F1'),
  ('Gerente de Operaciones Logísticas', 'F1'),
  ('Gerente SST', 'F1'),
  ('Coordinador de Obras', 'F1'),
  ('Jefe de Oficina Técnica', 'F1'),
  ('Jefe de Terreno', 'F2'),
  ('Jefe de Taller', 'F6'),
  ('Jefe SST', 'F1'),
  ('Jefe de Recursos Humanos', 'F1'),
  ('Jefe de Desarrollo Estratégico', 'F1'),
  ('Jefe de Licitaciones', 'F10'),
  ('Administrador de Obras', 'F2'),
  ('Planificador de Operaciones', 'F2'),
  ('Administrativo de Obra', 'F2'),
  ('Ingeniero de Oficina Técnica', 'F3'),
  ('Asistente de Oficina Técnica', 'F3'),
  ('Ingeniero de Calidad', 'F3'),
  ('Arquitecto / Coordinador BIM', 'F3'),
  ('Modelador / Proyectista', 'F3'),
  ('Supervisor', 'F4'),
  ('Supervisor de Taller', 'F6'),
  ('Capataz', 'F5'),
  ('APR / Prevencionista', 'F4'),
  ('Ingeniero Ambiental', 'F4'),
  ('Soldador', 'F5'),
  ('Maestro montajista', 'F5'),
  ('Enfierrador', 'F5'),
  ('Carpintero de obra', 'F5'),
  ('Instalador / Gasfíter / Eléctrico', 'F5'),
  ('Pintor / Terminaciones', 'F5'),
  ('Operador CNC', 'F6'),
  ('Personal operativo de taller', 'F6'),
  ('Encargado de Compras', 'F7'),
  ('Encargado de Bodega y Activos', 'F7'),
  ('Analista de Compras', 'F7'),
  ('Bodeguero', 'F7'),
  ('Chofer logístico', 'F7'),
  ('Encargado de Administración', 'F8'),
  ('Encargado de Contabilidad', 'F8'),
  ('Analista Contable', 'F8'),
  ('Encargada Financiera', 'F8'),
  ('Encargado de Remuneraciones', 'F9'),
  ('Analista de Relaciones Laborales', 'F9'),
  ('Asistente RRHH', 'F9'),
  ('Analista TI', 'F9'),
  ('Analista Ofimático', 'F9'),
  ('Diseñador Gráfico', 'F9'),
  ('Ingeniero de Licitaciones', 'F10'),
  ('Analista de Presupuesto', 'F10'),
  ('Vigilante', 'F11'),
  ('Auxiliar de aseo', 'F11'),
  ('Jornal / Ayudante', 'F11')
on conflict (nombre) do update set familia_codigo = excluded.familia_codigo;

-- 3. Bateria corporativa de capacitacion (RRHH-FOR-CAP-11 · CATALOGO) -- 160 cursos
insert into eva_cursos (codigo, dominio, nombre, objetivo, modalidad, horas, nivel, financiamiento, franquiciable, criticidad, recurrencia, precio_ref) values
  ('A-01', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Lectura e interpretación avanzada de planos estructurales', 'Interpretar planos de estructuras de hormigón y acero, cortes, detalles y simbología sin errores de ejecución.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 180000),
  ('A-02', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Cubicación y cálculo de cantidades de obra', 'Cubicar partidas de hormigón, acero, moldaje y terminaciones con criterio de pérdidas y rendimientos.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 240000),
  ('A-03', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Elaboración de APU y análisis de precios unitarios', 'Construir APU con insumos, rendimientos, leyes sociales y gastos generales; validar contra el costo real.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 260000),
  ('A-04', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Especificaciones técnicas y normativa NCh aplicada', 'Leer y aplicar EETT y normas NCh de hormigón, acero y áridos en decisiones de obra.', 'E-learning', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 140000),
  ('A-05', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Diseño y detallamiento de estructuras metálicas', 'Detallar uniones, planchas y conexiones conforme a AWS D1.1 y planos de fabricación.', 'Presencial', 32, 'N3', 'SENCE', true, 'Alta', 'Bienal', 380000),
  ('A-06', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Cálculo estructural básico para revisión de proyectos', 'Verificar dimensionamientos y detectar inconsistencias de proyecto antes de ejecutar.', 'Presencial', 24, 'N2', 'SENCE', true, 'Media', 'Bienal', 290000),
  ('A-07', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Gestión documental técnica y control de revisiones', 'Administrar la lista maestra, revisiones de planos y RDI sin perder trazabilidad.', 'E-learning', 12, 'N3', 'SENCE', true, 'Alta', 'Anual', 110000),
  ('A-08', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Redacción técnica: RDI, cartas y respuestas al mandante', 'Formular una RDI que se pueda responder y redactar cartas que protejan la posición contractual.', 'Presencial', 12, 'N3', 'Directa', false, 'Crítica', 'Anual', 160000),
  ('A-09', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Instalaciones eléctricas y normativa SEC', 'Comprender el reglamento SEC aplicable a obra y coordinar especialidades eléctricas.', 'Presencial', 24, 'N2', 'SENCE', true, 'Alta', 'Bienal', 250000),
  ('A-10', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Instalaciones sanitarias y de climatización en edificación', 'Coordinar y controlar especialidades sanitarias y HVAC en obra.', 'Presencial', 16, 'N2', 'SENCE', true, 'Media', 'Bienal', 190000),
  ('A-11', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Impermeabilización y patología de la construcción', 'Prevenir y diagnosticar filtraciones, fisuras y fallas de terminación.', 'Presencial', 16, 'N2', 'SENCE', true, 'Media', 'Bienal', 180000),
  ('A-12', 'TÉCNICO · INGENIERÍA Y OFICINA TÉCNICA', 'Planos as-built y cierre documental de proyecto', 'Levantar y validar as-built que el mandante reciba sin observaciones.', 'E-learning', 12, 'N3', 'SENCE', true, 'Alta', 'Anual', 120000),
  ('B-01', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Tecnología del hormigón: dosificación, colocación y curado', 'Controlar consistencia, temperatura, colocación y curado para asegurar f''c de diseño.', 'Presencial', 16, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 190000),
  ('B-02', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Enfierradura y armaduras: NCh 204 aplicada', 'Ejecutar y verificar disposición, recubrimientos y traslapes conforme a norma.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 170000),
  ('B-03', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Moldajes y sistemas de encofrado', 'Montar, apuntalar y liberar moldajes con seguridad y precisión geométrica.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 180000),
  ('B-04', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Soldadura al arco: calificación AWS D1.1 (posiciones)', 'Obtener o revalidar la calificación de soldador en las posiciones que exige la obra.', 'Presencial', 40, 'N3', 'SENCE', true, 'Legal', 'Bienal', 450000),
  ('B-05', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Inspección visual de soldadura y ensayos no destructivos', 'Aplicar VT y comprender PT/UT para liberar cordones conforme a norma.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 320000),
  ('B-06', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Montaje de estructuras metálicas y tolerancias', 'Ejecutar montaje, alineación y aplome dentro de tolerancia con maniobras seguras.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 290000),
  ('B-07', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Apriete de pernos estructurales y control de torque', 'Aplicar y verificar torque con instrumento calibrado según ASTM F436.', 'Presencial', 8, 'N3', 'SENCE', true, 'Alta', 'Bienal', 95000),
  ('B-08', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Galvanizado, pintura y protección anticorrosiva', 'Controlar espesores, preparación de superficie y touch-up en terreno.', 'Presencial', 12, 'N2', 'SENCE', true, 'Media', 'Bienal', 140000),
  ('B-09', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Operación y programación de CNC (corte y plegado)', 'Programar y operar equipos CNC de taller optimizando material y tiempo.', 'Presencial', 40, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 520000),
  ('B-10', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Topografía aplicada a obra: replanteo y control', 'Replantear ejes y controlar cotas con estación total dentro de tolerancia.', 'Presencial', 24, 'N3', 'SENCE', true, 'Alta', 'Bienal', 280000),
  ('B-11', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Mecánica de suelos, rellenos y compactación', 'Ejecutar y controlar rellenos y compactación con ensayos de densidad.', 'Presencial', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 180000),
  ('B-12', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Demoliciones y trabajos en estructuras existentes', 'Planificar y ejecutar intervenciones en obra existente controlando riesgos.', 'Presencial', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 190000),
  ('B-13', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Terminaciones de alto estándar y control de calidad visual', 'Ejecutar y recibir terminaciones que pasen la inspección del mandante a la primera.', 'Presencial', 16, 'N2', 'SENCE', true, 'Media', 'Bienal', 170000),
  ('B-14', 'TÉCNICO · CONSTRUCCIÓN Y MONTAJE', 'Trabajos en obras del Metro: estándar y restricciones operativas', 'Operar bajo las exigencias de ventana nocturna, accesos y protocolos del mandante.', 'Interna', 8, 'N3', 'Interna', false, 'Crítica', 'Anual', 0),
  ('C-01', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Planificación y control de obras: programa, ruta crítica y curva S', 'Construir el programa, identificar la ruta crítica y controlar avance con curva S.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 290000),
  ('C-02', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Last Planner System aplicado a construcción', 'Implementar planificación colaborativa, PPC y gestión de restricciones.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 240000),
  ('C-03', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Gestión de proyectos con enfoque PMI (fundamentos)', 'Aplicar el marco de alcance, tiempo, costo, riesgo y stakeholders a obras.', 'Presencial', 40, 'N3', 'Directa', false, 'Alta', 'Única', 690000),
  ('C-04', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Administración de contratos de construcción', 'Administrar el contrato: hitos, multas, retenciones, órdenes de cambio y reclamos.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 320000),
  ('C-05', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Obras extraordinarias, órdenes de cambio y ampliaciones de plazo', 'Identificar, valorizar y formalizar cambios antes de ejecutarlos.', 'Presencial', 16, 'N3', 'Directa', false, 'Crítica', 'Anual', 240000),
  ('C-06', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Control de costos de obra: CPI, SPI y valor ganado', 'Medir desempeño con valor ganado y proyectar el resultado a término.', 'Presencial', 16, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 260000),
  ('C-07', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Gestión de riesgos en proyectos de construcción', 'Levantar la matriz de riesgos, mitigar y monitorear con responsables.', 'Presencial', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 220000),
  ('C-08', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Gestión de subcontratos y Ley 20.123', 'Administrar subcontratos: alcance, avance, pagos, retenciones y riesgo solidario.', 'Presencial', 16, 'N3', 'SENCE', true, 'Crítica', 'Anual', 210000),
  ('C-09', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Productividad en obra: medición de rendimientos y HH', 'Medir rendimientos reales, detectar pérdidas y mejorar el uso de HH.', 'Presencial', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 200000),
  ('C-10', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Lean Construction: eliminación de pérdidas', 'Aplicar principios lean al flujo de trabajo en terreno y taller.', 'Presencial', 16, 'N2', 'SENCE', true, 'Media', 'Bienal', 230000),
  ('C-11', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Cierre de obra, dossier y lecciones aprendidas', 'Ejecutar el cierre en sus siete fases sin dejar pendientes.', 'Interna', 8, 'N3', 'Interna', false, 'Alta', 'Anual', 0),
  ('C-12', 'PLANIFICACIÓN Y GESTIÓN DE PROYECTOS', 'Programación de obras nocturnas y por ventanas', 'Programar faenas con ventanas restringidas y turnos rotativos.', 'Interna', 8, 'N2', 'Interna', false, 'Alta', 'Anual', 0),
  ('D-01', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'MS Project nivel intermedio para obras', 'Construir y actualizar programas, líneas base y reportes de avance.', 'E-learning', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 190000),
  ('D-02', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'MS Project nivel avanzado: recursos, costos y escenarios', 'Nivelar recursos, costear el programa y simular escenarios de recuperación.', 'E-learning', 24, 'N4', 'SENCE', true, 'Alta', 'Única', 240000),
  ('D-03', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'Primavera P6 fundamentos', 'Operar P6 cuando el mandante lo exige como plataforma de programa.', 'E-learning', 24, 'N2', 'SENCE', true, 'Media', 'Única', 320000),
  ('D-04', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'AutoCAD 2D aplicado a construcción', 'Producir y modificar planos 2D con estándares de capas y escalas.', 'E-learning', 32, 'N3', 'SENCE', true, 'Alta', 'Bienal', 210000),
  ('D-05', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'Revit y modelado BIM nivel usuario', 'Navegar y extraer información de modelos BIM para uso en obra.', 'E-learning', 32, 'N2', 'SENCE', true, 'Alta', 'Bienal', 290000),
  ('D-06', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'BIM 4D y 5D: coordinación y cubicación desde el modelo', 'Vincular modelo con programa y presupuesto para detectar interferencias.', 'Presencial', 32, 'N3', 'SENCE', true, 'Media', 'Única', 420000),
  ('D-07', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'Tekla Structures para estructuras metálicas', 'Modelar y generar planos de fabricación de estructuras metálicas.', 'Presencial', 40, 'N3', 'SENCE', true, 'Alta', 'Única', 620000),
  ('D-08', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'SketchUp y visualización rápida de propuestas', 'Generar visualizaciones para propuestas y coordinación en terreno.', 'E-learning', 16, 'N2', 'SENCE', true, 'Baja', 'Única', 120000),
  ('D-09', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'Excel intermedio: tablas, funciones y validaciones', 'Operar los libros del SGC con tablas, SUMIF, BUSCARV y validación de datos.', 'E-learning', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 130000),
  ('D-10', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'Excel avanzado: modelos, dinámicas y automatización', 'Construir modelos de control, tablas dinámicas y macros básicas.', 'E-learning', 24, 'N4', 'SENCE', true, 'Alta', 'Única', 180000),
  ('D-11', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'Power BI: modelado y construcción de dashboards', 'Modelar datos y construir tableros propios sobre los sistemas del SGC.', 'E-learning', 24, 'N3', 'SENCE', true, 'Alta', 'Bienal', 240000),
  ('D-12', 'SOFTWARE DE PLANIFICACIÓN Y DISEÑO', 'Auranet (ERP) nivel avanzado por rol', 'Explotar el ERP en el rol propio: centro de costo, OC, presupuesto y reportes.', 'Interna', 8, 'N3', 'Interna', false, 'Crítica', 'Anual', 0),
  ('E-01', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'Interpretación de ISO 9001:2015', 'Comprender los requisitos de la norma y su aplicación al negocio.', 'E-learning', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 150000),
  ('E-02', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'Formación de auditores internos ISO 9001', 'Planificar, ejecutar e informar auditorías internas con hallazgos útiles.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 290000),
  ('E-03', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'Planes de calidad y PIE según ISO 10005', 'Elaborar el PIE de una obra con criterios, HP/WP y registros.', 'Presencial', 16, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 240000),
  ('E-04', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'No conformidades y análisis de causa raíz', 'Levantar NC, aplicar 5 porqués e Ishikawa y cerrar con eficacia verificada.', 'Presencial', 12, 'N3', 'SENCE', true, 'Crítica', 'Anual', 160000),
  ('E-05', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'Metrología y calibración de instrumentos de medición', 'Gestionar la trazabilidad metrológica exigida por la cláusula 7.1.5.', 'Presencial', 12, 'N2', 'SENCE', true, 'Alta', 'Bienal', 180000),
  ('E-06', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'Control de calidad de hormigón y ensayos de laboratorio', 'Tomar muestras, interpretar informes y decidir sobre resultados no conformes.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 210000),
  ('E-07', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'ISO 14001 y gestión ambiental en obra', 'Gestionar aspectos ambientales, residuos y cumplimiento en faena.', 'E-learning', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 160000),
  ('E-08', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'ISO 45001 y sistema integrado de gestión', 'Integrar calidad, ambiente y seguridad en un solo sistema.', 'E-learning', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 170000),
  ('E-09', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'Dossier de calidad y protocolos de entrega', 'Armar el dossier durante la ejecución y no en la semana de la entrega.', 'Interna', 8, 'N3', 'Interna', false, 'Alta', 'Anual', 0),
  ('E-10', 'CALIDAD Y SISTEMA DE GESTIÓN ISO', 'Gate de calidad y liberación de entregas', 'Ejecutar la inspección de pre-entrega y sostener la liberación.', 'Interna', 6, 'N2', 'Interna', false, 'Alta', 'Anual', 0),
  ('F-01', 'SST Y CERTIFICACIONES HABILITANTES', 'Trabajos en altura: estándar y uso de arnés', 'Habilitar legalmente para trabajo en altura con verificación previa.', 'Presencial', 8, 'N3', 'SENCE', true, 'Legal', 'Anual', 75000),
  ('F-02', 'SST Y CERTIFICACIONES HABILITANTES', 'Espacios confinados: permiso y rescate', 'Habilitar para ingreso a espacios confinados con plan de rescate.', 'Presencial', 8, 'N3', 'SENCE', true, 'Legal', 'Anual', 95000),
  ('F-03', 'SST Y CERTIFICACIONES HABILITANTES', 'Izaje y rigging: maniobras y señalización', 'Ejecutar maniobras de izaje seguras con estrobos y señalero calificado.', 'Presencial', 16, 'N3', 'SENCE', true, 'Legal', 'Bienal', 180000),
  ('F-04', 'SST Y CERTIFICACIONES HABILITANTES', 'Operación de puente grúa', 'Habilitar para operar puente grúa de taller.', 'Presencial', 16, 'N3', 'SENCE', true, 'Legal', 'Bienal', 190000),
  ('F-05', 'SST Y CERTIFICACIONES HABILITANTES', 'Trabajos en caliente y prevención de incendios', 'Gestionar permisos de trabajo en caliente y respuesta inicial a fuego.', 'Presencial', 8, 'N2', 'SENCE', true, 'Legal', 'Anual', 80000),
  ('F-06', 'SST Y CERTIFICACIONES HABILITANTES', 'Primeros auxilios y uso de DEA', 'Responder ante emergencia médica en faena hasta la llegada de la mutual.', 'Presencial', 8, 'N3', 'SENCE', true, 'Legal', 'Anual', 85000),
  ('F-07', 'SST Y CERTIFICACIONES HABILITANTES', 'Brigada de emergencia y evacuación', 'Conformar y entrenar la brigada de la faena.', 'Presencial', 12, 'N3', 'SENCE', true, 'Alta', 'Anual', 120000),
  ('F-08', 'SST Y CERTIFICACIONES HABILITANTES', 'Manejo defensivo y conducción preventiva', 'Habilitar a quienes conducen vehículos de la empresa.', 'Presencial', 8, 'N2', 'SENCE', true, 'Legal', 'Anual', 70000),
  ('F-09', 'SST Y CERTIFICACIONES HABILITANTES', 'Manejo manual de carga y ergonomía (TMERT)', 'Cumplir el protocolo TMERT y prevenir lesiones musculoesqueléticas.', 'Presencial', 8, 'N2', 'SENCE', true, 'Legal', 'Anual', 65000),
  ('F-10', 'SST Y CERTIFICACIONES HABILITANTES', 'Riesgo psicosocial y protocolo ISTAS-21', 'Aplicar el protocolo de vigilancia de riesgo psicosocial en la faena.', 'E-learning', 8, 'N2', 'SENCE', true, 'Legal', 'Anual', 70000),
  ('F-11', 'SST Y CERTIFICACIONES HABILITANTES', 'Investigación de accidentes e incidentes', 'Investigar con método y cerrar con acciones que eviten la repetición.', 'Presencial', 16, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 190000),
  ('F-12', 'SST Y CERTIFICACIONES HABILITANTES', 'Comité paritario: constitución y funcionamiento (CPHS)', 'Habilitar a integrantes del comité paritario de faena.', 'Presencial', 16, 'N3', 'SENCE', true, 'Legal', 'Anual', 0),
  ('F-13', 'SST Y CERTIFICACIONES HABILITANTES', 'DS 44 y nuevo reglamento de gestión preventiva', 'Aplicar las obligaciones vigentes de gestión preventiva del empleador.', 'Presencial', 12, 'N3', 'SENCE', true, 'Legal', 'Anual', 140000),
  ('F-14', 'SST Y CERTIFICACIONES HABILITANTES', 'Ley 16.744 y obligaciones del empleador', 'Comprender el régimen de accidentes del trabajo y sus obligaciones.', 'E-learning', 8, 'N2', 'SENCE', true, 'Legal', 'Bienal', 70000),
  ('F-15', 'SST Y CERTIFICACIONES HABILITANTES', 'Uso, inspección y cuidado de EPP', 'Seleccionar, inspeccionar y reponer el equipo de protección personal.', 'Interna', 4, 'N3', 'Interna', false, 'Legal', 'Anual', 0),
  ('F-16', 'SST Y CERTIFICACIONES HABILITANTES', 'Charla de 5 minutos efectiva y liderazgo en seguridad', 'Conducir la charla diaria de modo que cambie conductas.', 'Interna', 4, 'N3', 'Interna', false, 'Alta', 'Anual', 0),
  ('G-01', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Contabilidad para no contadores', 'Leer estados financieros y comprender el efecto contable de las decisiones de obra.', 'E-learning', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 150000),
  ('G-02', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Normas IFRS aplicadas a contratos de construcción', 'Aplicar el reconocimiento de ingresos y costos de contratos de larga duración.', 'Presencial', 24, 'N3', 'SENCE', true, 'Alta', 'Bienal', 320000),
  ('G-03', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Tributación de empresas constructoras: IVA, F29 y PPM', 'Cumplir las obligaciones tributarias operativas del giro.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Anual', 290000),
  ('G-04', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Costos y presupuestos de obra para finanzas', 'Vincular el presupuesto de control con la contabilidad y el centro de costo.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 240000),
  ('G-05', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Tesorería, capital de trabajo y flujo de caja de proyectos', 'Proyectar la caja de la obra y anticipar el déficit máximo.', 'Presencial', 16, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 260000),
  ('G-06', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Factoring, boletas de garantía e instrumentos financieros', 'Gestionar garantías, seguros y financiamiento de corto plazo del giro.', 'Presencial', 12, 'N3', 'SENCE', true, 'Alta', 'Bienal', 210000),
  ('G-07', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Estados de pago y cobranza en contratos de construcción', 'Preparar y cobrar el EDP sin observaciones ni mora.', 'Presencial', 16, 'N3', 'SENCE', true, 'Crítica', 'Anual', 210000),
  ('G-08', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Control interno y prevención de fraudes', 'Diseñar controles que protejan los activos y los procesos de pago.', 'E-learning', 12, 'N2', 'SENCE', true, 'Alta', 'Bienal', 140000),
  ('G-09', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Facturación electrónica y cumplimiento SII', 'Operar el ciclo de facturación y respaldo documental exigido por el SII.', 'E-learning', 12, 'N3', 'SENCE', true, 'Alta', 'Bienal', 110000),
  ('G-10', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Cuentas por pagar y conciliación de proveedores', 'Conciliar y pagar sin duplicidades ni pagos sobre avance.', 'E-learning', 12, 'N3', 'SENCE', true, 'Alta', 'Bienal', 110000),
  ('G-11', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Rendición de fondos por rendir y caja chica de obra', 'Rendir con respaldo y en plazo el fondo de la obra.', 'Interna', 4, 'N3', 'Interna', false, 'Alta', 'Anual', 0),
  ('G-12', 'ADMINISTRACIÓN, FINANZAS Y CONTABILIDAD', 'Finanzas para gerentes: lectura de EEFF y EBITDA', 'Tomar decisiones leyendo el efecto en margen, caja y EBITDA.', 'Presencial', 16, 'N3', 'Directa', false, 'Alta', 'Bienal', 380000),
  ('H-01', 'RRHH Y LEGISLACIÓN LABORAL', 'Legislación laboral aplicada a la construcción', 'Aplicar el Código del Trabajo a contratos por obra o faena, jornada y término.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Anual', 290000),
  ('H-02', 'RRHH Y LEGISLACIÓN LABORAL', 'Cálculo de remuneraciones y liquidaciones', 'Calcular liquidaciones, horas extra, gratificaciones y descuentos sin error.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Anual', 270000),
  ('H-03', 'RRHH Y LEGISLACIÓN LABORAL', 'Ley 21.643 (Ley Karin): prevención e investigación', 'Prevenir y conducir investigaciones de acoso conforme al protocolo legal.', 'Presencial', 12, 'N3', 'SENCE', true, 'Legal', 'Anual', 180000),
  ('H-04', 'RRHH Y LEGISLACIÓN LABORAL', 'Ley 20.123: subcontratación y responsabilidad solidaria', 'Gestionar F30, F30-1 y el riesgo solidario en la cadena de subcontratos.', 'Presencial', 12, 'N3', 'SENCE', true, 'Legal', 'Anual', 170000),
  ('H-05', 'RRHH Y LEGISLACIÓN LABORAL', 'Reclutamiento y selección por competencias', 'Seleccionar con entrevista estructurada y criterios del perfil de cargo.', 'Presencial', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 200000),
  ('H-06', 'RRHH Y LEGISLACIÓN LABORAL', 'Evaluación de desempeño y planes de desarrollo', 'Evaluar con evidencia y construir PDI que la persona sí ejecute.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Anual', 210000),
  ('H-07', 'RRHH Y LEGISLACIÓN LABORAL', 'Administración de la franquicia SENCE y relación con OTEC', 'Ejecutar el 1% legal correctamente y sostener una fiscalización.', 'Presencial', 12, 'N3', 'SENCE', true, 'Crítica', 'Anual', 160000),
  ('H-08', 'RRHH Y LEGISLACIÓN LABORAL', 'Gestión de conflictos laborales y relación sindical', 'Conducir conversaciones difíciles y negociación colectiva con criterio.', 'Presencial', 16, 'N3', 'Directa', false, 'Alta', 'Bienal', 290000),
  ('H-09', 'RRHH Y LEGISLACIÓN LABORAL', 'Bienestar organizacional y beneficios', 'Diseñar y administrar programas de bienestar con impacto medible.', 'E-learning', 12, 'N2', 'SENCE', true, 'Media', 'Bienal', 140000),
  ('H-10', 'RRHH Y LEGISLACIÓN LABORAL', 'Fiscalización de la Dirección del Trabajo: cómo enfrentarla', 'Preparar el expediente y actuar correctamente durante una fiscalización.', 'Presencial', 8, 'N3', 'SENCE', true, 'Crítica', 'Anual', 130000),
  ('I-01', 'LOGÍSTICA, COMPRAS Y BODEGA', 'Gestión de compras y negociación con proveedores', 'Comprar al mejor costo total, no al mejor precio unitario.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 220000),
  ('I-02', 'LOGÍSTICA, COMPRAS Y BODEGA', 'Gestión de bodega e inventarios en obra', 'Controlar inventario, mermas y despachos con trazabilidad.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 180000),
  ('I-03', 'LOGÍSTICA, COMPRAS Y BODEGA', 'Recepción técnica de materiales y certificados de calidad', 'Recibir verificando certificado, lote y conformidad antes de liberar para uso.', 'Interna', 6, 'N3', 'Interna', false, 'Crítica', 'Anual', 0),
  ('I-04', 'LOGÍSTICA, COMPRAS Y BODEGA', 'Evaluación y desarrollo de proveedores', 'Evaluar con criterios objetivos y desarrollar la base de proveedores.', 'E-learning', 12, 'N2', 'SENCE', true, 'Media', 'Bienal', 130000),
  ('I-05', 'LOGÍSTICA, COMPRAS Y BODEGA', 'Logística de obra y planificación de abastecimiento', 'Sincronizar el abastecimiento con el programa de obra.', 'Presencial', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 190000),
  ('I-06', 'LOGÍSTICA, COMPRAS Y BODEGA', 'Almacenamiento de sustancias peligrosas y hojas de datos', 'Almacenar y manipular sustancias peligrosas conforme a normativa.', 'Presencial', 8, 'N2', 'SENCE', true, 'Legal', 'Anual', 90000),
  ('I-07', 'LOGÍSTICA, COMPRAS Y BODEGA', 'Gestión de flota, mantención y control de combustible', 'Administrar la flota con control de costos y mantención preventiva.', 'E-learning', 12, 'N2', 'SENCE', true, 'Media', 'Bienal', 120000),
  ('I-08', 'LOGÍSTICA, COMPRAS Y BODEGA', 'Arriendo de equipos: contratos y control de facturación', 'Controlar arriendos para no pagar equipos detenidos o devueltos.', 'Interna', 4, 'N3', 'Interna', false, 'Alta', 'Anual', 0),
  ('J-01', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Alfabetización en inteligencia artificial para la empresa', 'Comprender qué puede y qué no puede hacer la IA, y dónde aporta en el negocio.', 'E-learning', 8, 'N1', 'SENCE', true, 'Alta', 'Anual', 90000),
  ('J-02', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Prompting efectivo y uso profesional de asistentes de IA', 'Obtener resultados útiles y verificables de un asistente de IA en el trabajo diario.', 'E-learning', 16, 'N2', 'SENCE', true, 'Alta', 'Anual', 140000),
  ('J-03', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Creación de agentes y automatizaciones con IA', 'Diseñar agentes y flujos que ejecuten tareas repetitivas del área.', 'Presencial', 24, 'N3', 'SENCE', true, 'Alta', 'Anual', 320000),
  ('J-04', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'IA aplicada a la construcción: casos de uso reales', 'Aplicar IA a cubicación, análisis documental, control de avance y reportería.', 'Presencial', 16, 'N2', 'SENCE', true, 'Alta', 'Anual', 260000),
  ('J-05', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Power Automate: automatización de procesos sin código', 'Construir flujos que eliminen digitación y controlen plazos.', 'E-learning', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 180000),
  ('J-06', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Power Apps: construcción de aplicaciones internas', 'Construir y mantener las apps de los sistemas del SGC.', 'Presencial', 24, 'N3', 'SENCE', true, 'Alta', 'Bienal', 290000),
  ('J-07', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'SharePoint y gestión documental corporativa', 'Administrar bibliotecas, permisos y versiones sin perder trazabilidad.', 'E-learning', 12, 'N3', 'SENCE', true, 'Alta', 'Bienal', 120000),
  ('J-08', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Microsoft Teams avanzado: canales, pestañas y aprobaciones', 'Operar Teams como plataforma de trabajo y no como chat.', 'Interna', 6, 'N3', 'Interna', false, 'Crítica', 'Anual', 0),
  ('J-09', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Ciberseguridad y protección de la información', 'Reconocer phishing, proteger credenciales y cuidar la información del negocio.', 'E-learning', 8, 'N2', 'SENCE', true, 'Crítica', 'Anual', 70000),
  ('J-10', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Ley 21.719 de protección de datos personales', 'Tratar datos de trabajadores y clientes conforme a la nueva ley.', 'E-learning', 8, 'N2', 'SENCE', true, 'Legal', 'Anual', 95000),
  ('J-11', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Análisis de datos para la toma de decisiones', 'Convertir datos operativos en decisiones con método.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 240000),
  ('J-12', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Drones y fotogrametría para control de avance', 'Levantar avance físico y registro fotográfico con dron.', 'Presencial', 16, 'N2', 'SENCE', true, 'Media', 'Única', 290000),
  ('J-13', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Escáner láser y captura de realidad para as-built', 'Levantar as-built con nube de puntos.', 'Presencial', 16, 'N2', 'Directa', false, 'Baja', 'Única', 380000),
  ('J-14', 'TECNOLOGÍA, DATOS E INTELIGENCIA ARTIFICIAL', 'Ofimática esencial para personal operativo', 'Usar correo, Teams móvil y formularios digitales desde el terreno.', 'Interna', 8, 'N1', 'Interna', false, 'Alta', 'Anual', 0),
  ('K-01', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Comunicación efectiva en el trabajo', 'Transmitir instrucciones claras y escuchar activamente para evitar reprocesos.', 'Presencial', 12, 'N2', 'SENCE', true, 'Alta', 'Bienal', 140000),
  ('K-02', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Hablar en público y manejo del miedo escénico', 'Presentar ante el mandante o la gerencia sin que el nervio arruine el contenido.', 'Presencial', 16, 'N2', 'SENCE', true, 'Alta', 'Bienal', 220000),
  ('K-03', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Presentaciones ejecutivas de alto impacto', 'Estructurar y presentar en 15 minutos lo que importa a un directorio o mandante.', 'Presencial', 12, 'N3', 'Directa', false, 'Alta', 'Bienal', 240000),
  ('K-04', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Trabajo en equipo y colaboración entre áreas', 'Trabajar con otras gerencias sin que el silo se coma el resultado.', 'Presencial', 12, 'N2', 'SENCE', true, 'Alta', 'Bienal', 130000),
  ('K-05', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Compañerismo, convivencia y respeto en faena', 'Construir un clima de faena donde se pueda trabajar y reportar sin miedo.', 'Interna', 4, 'N2', 'Interna', false, 'Alta', 'Anual', 0),
  ('K-06', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Manejo de conflictos y conversaciones difíciles', 'Abordar el conflicto temprano y sostener la conversación que nadie quiere tener.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 210000),
  ('K-07', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Inteligencia emocional y autorregulación', 'Gestionar la propia reacción bajo presión de plazo.', 'E-learning', 12, 'N2', 'SENCE', true, 'Media', 'Bienal', 120000),
  ('K-08', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Gestión del tiempo y organización personal', 'Priorizar con criterio y cerrar lo importante en semanas exigentes.', 'E-learning', 8, 'N2', 'SENCE', true, 'Media', 'Bienal', 90000),
  ('K-09', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Negociación colaborativa', 'Negociar con proveedores, subcontratos y mandante sin quemar la relación.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 240000),
  ('K-10', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Redacción profesional de correos e informes', 'Escribir claro, breve y sin ambigüedad en comunicaciones que quedan por escrito.', 'E-learning', 12, 'N2', 'SENCE', true, 'Alta', 'Bienal', 110000),
  ('K-11', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Resiliencia y manejo del estrés laboral', 'Sostener el desempeño en faenas de alta exigencia y cuidar la salud mental.', 'E-learning', 8, 'N2', 'SENCE', true, 'Media', 'Anual', 95000),
  ('K-12', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Pensamiento crítico y resolución de problemas', 'Analizar la causa antes de actuar y decidir con la información disponible.', 'Presencial', 12, 'N2', 'SENCE', true, 'Alta', 'Bienal', 160000),
  ('K-13', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Orientación al detalle y cultura de cero reproceso', 'Terminar bien a la primera: el estándar de excelencia en obra.', 'Interna', 4, 'N2', 'Interna', false, 'Alta', 'Anual', 0),
  ('K-14', 'HABILIDADES BLANDAS Y COMUNICACIÓN', 'Inclusión, diversidad y trato no discriminatorio', 'Sostener un ambiente de trabajo respetuoso e inclusivo en faena y oficina.', 'E-learning', 8, 'N2', 'SENCE', true, 'Alta', 'Bienal', 90000),
  ('L-01', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Liderazgo de equipos de terreno', 'Dirigir cuadrillas con autoridad técnica y respeto, no con grito.', 'Presencial', 16, 'N3', 'SENCE', true, 'Crítica', 'Bienal', 210000),
  ('L-02', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Liderazgo para jefaturas y gerencias', 'Dirigir a través de otros, delegar y sostener el estándar.', 'Presencial', 24, 'N3', 'Directa', false, 'Alta', 'Bienal', 420000),
  ('L-03', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Supervisión efectiva: del capataz al supervisor', 'Transitar del oficio a la supervisión con herramientas de gestión.', 'Presencial', 16, 'N3', 'SENCE', true, 'Alta', 'Bienal', 190000),
  ('L-04', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Feedback y conversaciones de desempeño', 'Dar y recibir retroalimentación que cambie conductas.', 'Presencial', 12, 'N3', 'SENCE', true, 'Alta', 'Anual', 160000),
  ('L-05', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Delegación y desarrollo de sucesores', 'Formar al que viene y dejar de ser indispensable.', 'E-learning', 12, 'N3', 'SENCE', true, 'Media', 'Bienal', 140000),
  ('L-06', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Gestión del cambio organizacional', 'Conducir la adopción de nuevos sistemas y procedimientos.', 'Presencial', 16, 'N3', 'Directa', false, 'Alta', 'Bienal', 290000),
  ('L-07', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Reuniones efectivas y gestión de acuerdos', 'Conducir reuniones de 30 minutos con acuerdos que se cumplen.', 'E-learning', 8, 'N3', 'SENCE', true, 'Alta', 'Bienal', 90000),
  ('L-08', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Formación de relatores internos (metodología N4)', 'Habilitar al experto para enseñar: diseño de sesión y evaluación.', 'Presencial', 16, 'N4', 'SENCE', true, 'Alta', 'Anual', 190000),
  ('L-09', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Coaching ejecutivo individual', 'Acompañamiento individual para jefaturas en transición o alto potencial.', 'Presencial', 12, 'N4', 'Directa', false, 'Media', 'Única', 890000),
  ('L-10', 'LIDERAZGO Y GESTIÓN DE EQUIPOS', 'Liderazgo en seguridad: el jefe que no transa', 'Ejercer el liderazgo visible en seguridad desde la jefatura.', 'Interna', 4, 'N3', 'Interna', false, 'Crítica', 'Anual', 0),
  ('M-01', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Preparación de licitaciones públicas y privadas', 'Armar ofertas administrativas y técnicas que no queden fuera de bases.', 'Presencial', 24, 'N3', 'SENCE', true, 'Crítica', 'Anual', 320000),
  ('M-02', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Mercado Público y plataformas de licitación', 'Operar Mercado Público, Ariba e iConstruye sin errores formales.', 'E-learning', 16, 'N3', 'SENCE', true, 'Alta', 'Anual', 180000),
  ('M-03', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Estrategia de precios y decisión GO / NO-GO', 'Decidir a qué licitar y a qué precio, con criterio de margen y riesgo.', 'Presencial', 16, 'N3', 'Directa', false, 'Crítica', 'Anual', 290000),
  ('M-04', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Atención y gestión de la relación con el mandante', 'Sostener la relación con el ITO y el cliente de modo que vuelva a contratarnos.', 'Presencial', 12, 'N3', 'SENCE', true, 'Crítica', 'Anual', 180000),
  ('M-05', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Habilidades comerciales y venta consultiva B2B', 'Vender proyectos de construcción con enfoque de solución, no de precio.', 'Presencial', 24, 'N3', 'SENCE', true, 'Alta', 'Bienal', 340000),
  ('M-06', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Prospección y desarrollo de nuevos clientes', 'Construir y trabajar un pipeline comercial sistemático.', 'Presencial', 16, 'N2', 'SENCE', true, 'Media', 'Bienal', 240000),
  ('M-07', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Manejo de reclamos y recuperación del cliente', 'Convertir un reclamo en una oportunidad de fidelización en 48 horas.', 'Presencial', 8, 'N3', 'SENCE', true, 'Alta', 'Anual', 130000),
  ('M-08', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Postventa y garantías de obra', 'Administrar la garantía y la postventa como parte del servicio.', 'Interna', 6, 'N2', 'Interna', false, 'Media', 'Anual', 0),
  ('M-09', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Encuesta de satisfacción del cliente y gestión del ISC', 'Aplicar la encuesta, leer el índice y activar la recuperación.', 'Interna', 4, 'N2', 'Interna', false, 'Alta', 'Anual', 0),
  ('M-10', 'COMERCIAL, LICITACIONES Y RELACIÓN CON EL CLIENTE', 'Contratos, reclamos y arbitraje en construcción', 'Conocer los mecanismos de reclamo y controversia antes de necesitarlos.', 'Presencial', 16, 'N3', 'Directa', false, 'Alta', 'Bienal', 390000),
  ('N-01', 'CULTURA HACER, INDUCCIÓN Y SGC INTERNO', 'Inducción HACER: los cinco valores con casos reales', 'Comprender qué significa HACER bien las cosas en decisiones concretas.', 'Interna', 4, 'N1', 'Interna', false, 'Crítica', 'Al ingreso', 0),
  ('N-02', 'CULTURA HACER, INDUCCIÓN Y SGC INTERNO', 'Inducción general a Metalium y al grupo Level Capital', 'Conocer la organización, las gerencias y cómo se trabaja aquí.', 'Interna', 4, 'N1', 'Interna', false, 'Crítica', 'Al ingreso', 0),
  ('N-03', 'CULTURA HACER, INDUCCIÓN Y SGC INTERNO', 'Los sistemas digitales del SGC: recorrido general', 'Saber qué sistema existe, para qué sirve y dónde vive en Teams.', 'Interna', 6, 'N1', 'Interna', false, 'Crítica', 'Al ingreso', 0),
  ('N-04', 'CULTURA HACER, INDUCCIÓN Y SGC INTERNO', 'Bitácora Diaria de avance y parte del maestro', 'Registrar y verificar el avance diario que alimenta todos los sistemas.', 'Interna', 6, 'N3', 'Interna', false, 'Crítica', 'Anual', 0),
  ('N-05', 'CULTURA HACER, INDUCCIÓN Y SGC INTERNO', 'Control Integral de Obra: línea base y reproyección', 'Armar y sostener la proyección financiera mensual de la obra.', 'Interna', 8, 'N3', 'Interna', false, 'Crítica', 'Anual', 0),
  ('N-06', 'CULTURA HACER, INDUCCIÓN Y SGC INTERNO', 'Política y objetivos de calidad de Metalium', 'Conocer qué promete la empresa y cuál es la contribución del propio cargo.', 'Interna', 2, 'N1', 'Interna', false, 'Alta', 'Anual', 0)
on conflict (codigo) do update set
  dominio = excluded.dominio, nombre = excluded.nombre, objetivo = excluded.objetivo,
  modalidad = excluded.modalidad, horas = excluded.horas, nivel = excluded.nivel,
  financiamiento = excluded.financiamiento, franquiciable = excluded.franquiciable,
  criticidad = excluded.criticidad, recurrencia = excluded.recurrencia,
  precio_ref = excluded.precio_ref;

-- 4. Matriz curso x familia: la bateria obligatoria del puesto (MAPA_CARGO) -- 626 celdas
insert into eva_curso_familia (curso_codigo, familia_codigo, obligatoriedad) values
  ('A-01', 'F2', 'R'),
  ('A-01', 'F3', 'O'),
  ('A-01', 'F4', 'R'),
  ('A-01', 'F5', 'O'),
  ('A-01', 'F6', 'O'),
  ('A-02', 'F2', 'R'),
  ('A-02', 'F3', 'O'),
  ('A-02', 'F10', 'R'),
  ('A-03', 'F2', 'R'),
  ('A-03', 'F3', 'O'),
  ('A-03', 'F8', 'R'),
  ('A-03', 'F10', 'O'),
  ('A-04', 'F2', 'R'),
  ('A-04', 'F3', 'O'),
  ('A-04', 'F4', 'R'),
  ('A-05', 'F2', 'R'),
  ('A-05', 'F3', 'O'),
  ('A-05', 'F6', 'O'),
  ('A-06', 'F1', 'R'),
  ('A-06', 'F3', 'O'),
  ('A-07', 'F2', 'O'),
  ('A-07', 'F3', 'O'),
  ('A-07', 'F9', 'R'),
  ('A-08', 'F1', 'R'),
  ('A-08', 'F2', 'O'),
  ('A-08', 'F3', 'O'),
  ('A-08', 'F10', 'R'),
  ('A-09', 'F2', 'R'),
  ('A-09', 'F3', 'O'),
  ('A-09', 'F4', 'R'),
  ('A-10', 'F2', 'R'),
  ('A-10', 'F3', 'O'),
  ('A-11', 'F3', 'O'),
  ('A-11', 'F4', 'R'),
  ('A-11', 'F5', 'R'),
  ('A-12', 'F2', 'R'),
  ('A-12', 'F3', 'O'),
  ('B-01', 'F2', 'R'),
  ('B-01', 'F3', 'R'),
  ('B-01', 'F4', 'O'),
  ('B-01', 'F5', 'O'),
  ('B-02', 'F4', 'R'),
  ('B-02', 'F5', 'O'),
  ('B-03', 'F4', 'R'),
  ('B-03', 'F5', 'O'),
  ('B-04', 'F5', 'O'),
  ('B-04', 'F6', 'O'),
  ('B-05', 'F3', 'O'),
  ('B-05', 'F4', 'R'),
  ('B-05', 'F6', 'O'),
  ('B-06', 'F4', 'R'),
  ('B-06', 'F5', 'O'),
  ('B-06', 'F6', 'O'),
  ('B-07', 'F4', 'R'),
  ('B-07', 'F5', 'O'),
  ('B-07', 'F6', 'O'),
  ('B-08', 'F4', 'R'),
  ('B-08', 'F5', 'R'),
  ('B-08', 'F6', 'O'),
  ('B-09', 'F6', 'O'),
  ('B-10', 'F3', 'O'),
  ('B-10', 'F4', 'O'),
  ('B-10', 'F5', 'R'),
  ('B-11', 'F3', 'R'),
  ('B-11', 'F4', 'O'),
  ('B-11', 'F5', 'R'),
  ('B-12', 'F2', 'R'),
  ('B-12', 'F4', 'O'),
  ('B-12', 'F5', 'R'),
  ('B-13', 'F4', 'R'),
  ('B-13', 'F5', 'O'),
  ('B-14', 'F1', 'R'),
  ('B-14', 'F2', 'O'),
  ('B-14', 'F3', 'R'),
  ('B-14', 'F4', 'O'),
  ('B-14', 'F5', 'O'),
  ('C-01', 'F1', 'R'),
  ('C-01', 'F2', 'O'),
  ('C-01', 'F3', 'O'),
  ('C-01', 'F4', 'R'),
  ('C-02', 'F1', 'R'),
  ('C-02', 'F2', 'O'),
  ('C-02', 'F3', 'R'),
  ('C-02', 'F4', 'O'),
  ('C-03', 'F1', 'O'),
  ('C-03', 'F2', 'O'),
  ('C-03', 'F3', 'R'),
  ('C-03', 'F10', 'R'),
  ('C-04', 'F1', 'R'),
  ('C-04', 'F2', 'O'),
  ('C-04', 'F3', 'R'),
  ('C-04', 'F10', 'R'),
  ('C-05', 'F1', 'R'),
  ('C-05', 'F2', 'O'),
  ('C-05', 'F3', 'R'),
  ('C-05', 'F10', 'R'),
  ('C-06', 'F1', 'R'),
  ('C-06', 'F2', 'O'),
  ('C-06', 'F8', 'R'),
  ('C-07', 'F1', 'R'),
  ('C-07', 'F2', 'O'),
  ('C-07', 'F3', 'R'),
  ('C-08', 'F1', 'R'),
  ('C-08', 'F2', 'O'),
  ('C-08', 'F7', 'O'),
  ('C-08', 'F8', 'R'),
  ('C-09', 'F2', 'O'),
  ('C-09', 'F4', 'O'),
  ('C-09', 'F6', 'R'),
  ('C-10', 'F1', 'R'),
  ('C-10', 'F2', 'O'),
  ('C-10', 'F4', 'R'),
  ('C-10', 'F6', 'R'),
  ('C-11', 'F1', 'R'),
  ('C-11', 'F2', 'O'),
  ('C-11', 'F3', 'R'),
  ('C-11', 'F8', 'R'),
  ('C-12', 'F2', 'O'),
  ('C-12', 'F4', 'R'),
  ('D-01', 'F1', 'R'),
  ('D-01', 'F2', 'O'),
  ('D-01', 'F3', 'O'),
  ('D-02', 'F2', 'O'),
  ('D-02', 'F3', 'R'),
  ('D-03', 'F2', 'R'),
  ('D-03', 'F3', 'R'),
  ('D-04', 'F2', 'R'),
  ('D-04', 'F3', 'O'),
  ('D-04', 'F6', 'R'),
  ('D-05', 'F2', 'R'),
  ('D-05', 'F3', 'O'),
  ('D-06', 'F2', 'R'),
  ('D-06', 'F3', 'O'),
  ('D-06', 'F10', 'R'),
  ('D-07', 'F3', 'O'),
  ('D-07', 'F6', 'O'),
  ('D-08', 'F3', 'R'),
  ('D-08', 'F10', 'R'),
  ('D-09', 'F1', 'R'),
  ('D-09', 'F2', 'O'),
  ('D-09', 'F3', 'O'),
  ('D-09', 'F4', 'R'),
  ('D-09', 'F7', 'O'),
  ('D-09', 'F8', 'O'),
  ('D-09', 'F9', 'O'),
  ('D-09', 'F10', 'R'),
  ('D-10', 'F2', 'R'),
  ('D-10', 'F3', 'R'),
  ('D-10', 'F8', 'O'),
  ('D-10', 'F9', 'R'),
  ('D-11', 'F1', 'R'),
  ('D-11', 'F2', 'R'),
  ('D-11', 'F8', 'R'),
  ('D-11', 'F9', 'O'),
  ('D-12', 'F1', 'R'),
  ('D-12', 'F2', 'O'),
  ('D-12', 'F3', 'R'),
  ('D-12', 'F7', 'O'),
  ('D-12', 'F8', 'O'),
  ('E-01', 'F1', 'O'),
  ('E-01', 'F2', 'R'),
  ('E-01', 'F3', 'O'),
  ('E-01', 'F7', 'R'),
  ('E-01', 'F8', 'R'),
  ('E-01', 'F9', 'O'),
  ('E-02', 'F1', 'R'),
  ('E-02', 'F3', 'O'),
  ('E-02', 'F9', 'O'),
  ('E-03', 'F2', 'R'),
  ('E-03', 'F3', 'O'),
  ('E-03', 'F4', 'R'),
  ('E-04', 'F1', 'R'),
  ('E-04', 'F2', 'O'),
  ('E-04', 'F3', 'O'),
  ('E-04', 'F4', 'O'),
  ('E-04', 'F6', 'R'),
  ('E-04', 'F7', 'R'),
  ('E-05', 'F3', 'O'),
  ('E-05', 'F4', 'R'),
  ('E-05', 'F6', 'O'),
  ('E-06', 'F2', 'R'),
  ('E-06', 'F3', 'O'),
  ('E-06', 'F4', 'O'),
  ('E-07', 'F1', 'R'),
  ('E-07', 'F2', 'R'),
  ('E-07', 'F4', 'O'),
  ('E-07', 'F9', 'O'),
  ('E-08', 'F1', 'R'),
  ('E-08', 'F4', 'O'),
  ('E-08', 'F9', 'O'),
  ('E-09', 'F2', 'O'),
  ('E-09', 'F3', 'O'),
  ('E-09', 'F4', 'R'),
  ('E-10', 'F1', 'R'),
  ('E-10', 'F2', 'O'),
  ('E-10', 'F3', 'O'),
  ('E-10', 'F4', 'R'),
  ('F-01', 'F2', 'R'),
  ('F-01', 'F4', 'O'),
  ('F-01', 'F5', 'O'),
  ('F-01', 'F6', 'O'),
  ('F-02', 'F4', 'O'),
  ('F-02', 'F5', 'O'),
  ('F-02', 'F6', 'R'),
  ('F-03', 'F4', 'R'),
  ('F-03', 'F5', 'O'),
  ('F-03', 'F6', 'O'),
  ('F-04', 'F6', 'O'),
  ('F-05', 'F4', 'R'),
  ('F-05', 'F5', 'O'),
  ('F-05', 'F6', 'O'),
  ('F-06', 'F2', 'R'),
  ('F-06', 'F4', 'O'),
  ('F-06', 'F5', 'R'),
  ('F-06', 'F6', 'R'),
  ('F-06', 'F11', 'R'),
  ('F-07', 'F4', 'O'),
  ('F-07', 'F5', 'R'),
  ('F-07', 'F11', 'R'),
  ('F-08', 'F2', 'R'),
  ('F-08', 'F4', 'R'),
  ('F-08', 'F7', 'O'),
  ('F-09', 'F4', 'R'),
  ('F-09', 'F5', 'O'),
  ('F-09', 'F6', 'R'),
  ('F-09', 'F7', 'O'),
  ('F-09', 'F11', 'O'),
  ('F-10', 'F1', 'O'),
  ('F-10', 'F2', 'R'),
  ('F-10', 'F4', 'O'),
  ('F-10', 'F9', 'O'),
  ('F-11', 'F1', 'R'),
  ('F-11', 'F2', 'R'),
  ('F-11', 'F4', 'O'),
  ('F-12', 'F4', 'O'),
  ('F-12', 'F5', 'R'),
  ('F-12', 'F9', 'R'),
  ('F-13', 'F1', 'O'),
  ('F-13', 'F2', 'R'),
  ('F-13', 'F4', 'O'),
  ('F-13', 'F9', 'O'),
  ('F-14', 'F1', 'O'),
  ('F-14', 'F2', 'R'),
  ('F-14', 'F4', 'O'),
  ('F-14', 'F9', 'O'),
  ('F-15', 'F2', 'R'),
  ('F-15', 'F4', 'O'),
  ('F-15', 'F5', 'O'),
  ('F-15', 'F6', 'O'),
  ('F-15', 'F7', 'R'),
  ('F-15', 'F11', 'O'),
  ('F-16', 'F2', 'R'),
  ('F-16', 'F4', 'O'),
  ('F-16', 'F5', 'O'),
  ('F-16', 'F6', 'R'),
  ('G-01', 'F1', 'R'),
  ('G-01', 'F2', 'O'),
  ('G-01', 'F7', 'R'),
  ('G-01', 'F10', 'R'),
  ('G-02', 'F1', 'R'),
  ('G-02', 'F8', 'O'),
  ('G-03', 'F1', 'R'),
  ('G-03', 'F8', 'O'),
  ('G-04', 'F2', 'R'),
  ('G-04', 'F8', 'O'),
  ('G-05', 'F1', 'R'),
  ('G-05', 'F2', 'R'),
  ('G-05', 'F8', 'O'),
  ('G-06', 'F1', 'R'),
  ('G-06', 'F2', 'R'),
  ('G-06', 'F8', 'O'),
  ('G-07', 'F2', 'O'),
  ('G-07', 'F3', 'R'),
  ('G-07', 'F8', 'O'),
  ('G-07', 'F10', 'R'),
  ('G-08', 'F1', 'R'),
  ('G-08', 'F7', 'R'),
  ('G-08', 'F8', 'O'),
  ('G-08', 'F9', 'R'),
  ('G-09', 'F7', 'R'),
  ('G-09', 'F8', 'O'),
  ('G-10', 'F7', 'R'),
  ('G-10', 'F8', 'O'),
  ('G-11', 'F2', 'O'),
  ('G-11', 'F8', 'O'),
  ('G-11', 'F11', 'R'),
  ('G-12', 'F1', 'O'),
  ('G-12', 'F8', 'R'),
  ('H-01', 'F1', 'R'),
  ('H-01', 'F2', 'R'),
  ('H-01', 'F9', 'O'),
  ('H-02', 'F8', 'R'),
  ('H-02', 'F9', 'O'),
  ('H-03', 'F1', 'O'),
  ('H-03', 'F2', 'R'),
  ('H-03', 'F4', 'R'),
  ('H-03', 'F9', 'O'),
  ('H-04', 'F1', 'R'),
  ('H-04', 'F2', 'R'),
  ('H-04', 'F7', 'O'),
  ('H-04', 'F8', 'R'),
  ('H-04', 'F9', 'O'),
  ('H-05', 'F1', 'R'),
  ('H-05', 'F9', 'O'),
  ('H-06', 'F1', 'O'),
  ('H-06', 'F2', 'R'),
  ('H-06', 'F9', 'O'),
  ('H-07', 'F8', 'R'),
  ('H-07', 'F9', 'O'),
  ('H-08', 'F1', 'O'),
  ('H-08', 'F2', 'R'),
  ('H-08', 'F9', 'O'),
  ('H-09', 'F1', 'R'),
  ('H-09', 'F9', 'O'),
  ('H-10', 'F1', 'R'),
  ('H-10', 'F2', 'R'),
  ('H-10', 'F4', 'R'),
  ('H-10', 'F9', 'O'),
  ('I-01', 'F1', 'R'),
  ('I-01', 'F2', 'R'),
  ('I-01', 'F7', 'O'),
  ('I-02', 'F2', 'R'),
  ('I-02', 'F7', 'O'),
  ('I-03', 'F2', 'R'),
  ('I-03', 'F3', 'R'),
  ('I-03', 'F4', 'R'),
  ('I-03', 'F7', 'O'),
  ('I-04', 'F1', 'R'),
  ('I-04', 'F2', 'R'),
  ('I-04', 'F7', 'O'),
  ('I-05', 'F2', 'R'),
  ('I-05', 'F7', 'O'),
  ('I-06', 'F4', 'R'),
  ('I-06', 'F6', 'R'),
  ('I-06', 'F7', 'O'),
  ('I-07', 'F1', 'R'),
  ('I-07', 'F7', 'O'),
  ('I-08', 'F2', 'O'),
  ('I-08', 'F7', 'O'),
  ('I-08', 'F8', 'R'),
  ('J-01', 'F1', 'O'),
  ('J-01', 'F2', 'O'),
  ('J-01', 'F3', 'O'),
  ('J-01', 'F4', 'R'),
  ('J-01', 'F6', 'R'),
  ('J-01', 'F7', 'O'),
  ('J-01', 'F8', 'O'),
  ('J-01', 'F9', 'O'),
  ('J-01', 'F10', 'O'),
  ('J-02', 'F1', 'O'),
  ('J-02', 'F2', 'O'),
  ('J-02', 'F3', 'O'),
  ('J-02', 'F4', 'R'),
  ('J-02', 'F7', 'R'),
  ('J-02', 'F8', 'O'),
  ('J-02', 'F9', 'O'),
  ('J-02', 'F10', 'O'),
  ('J-03', 'F1', 'R'),
  ('J-03', 'F2', 'R'),
  ('J-03', 'F3', 'R'),
  ('J-03', 'F8', 'R'),
  ('J-03', 'F9', 'O'),
  ('J-03', 'F10', 'R'),
  ('J-04', 'F1', 'R'),
  ('J-04', 'F2', 'O'),
  ('J-04', 'F3', 'O'),
  ('J-04', 'F10', 'R'),
  ('J-05', 'F2', 'R'),
  ('J-05', 'F8', 'R'),
  ('J-05', 'F9', 'O'),
  ('J-06', 'F3', 'R'),
  ('J-06', 'F9', 'O'),
  ('J-07', 'F2', 'R'),
  ('J-07', 'F3', 'R'),
  ('J-07', 'F9', 'O'),
  ('J-08', 'F1', 'O'),
  ('J-08', 'F2', 'O'),
  ('J-08', 'F3', 'O'),
  ('J-08', 'F4', 'O'),
  ('J-08', 'F6', 'R'),
  ('J-08', 'F7', 'O'),
  ('J-08', 'F8', 'O'),
  ('J-08', 'F9', 'O'),
  ('J-08', 'F10', 'O'),
  ('J-09', 'F1', 'O'),
  ('J-09', 'F2', 'O'),
  ('J-09', 'F3', 'O'),
  ('J-09', 'F4', 'R'),
  ('J-09', 'F6', 'R'),
  ('J-09', 'F7', 'O'),
  ('J-09', 'F8', 'O'),
  ('J-09', 'F9', 'O'),
  ('J-09', 'F10', 'O'),
  ('J-10', 'F1', 'R'),
  ('J-10', 'F2', 'R'),
  ('J-10', 'F8', 'O'),
  ('J-10', 'F9', 'O'),
  ('J-11', 'F1', 'O'),
  ('J-11', 'F2', 'R'),
  ('J-11', 'F3', 'R'),
  ('J-11', 'F8', 'R'),
  ('J-11', 'F9', 'O'),
  ('J-12', 'F2', 'R'),
  ('J-12', 'F3', 'R'),
  ('J-12', 'F4', 'R'),
  ('J-13', 'F3', 'R'),
  ('J-14', 'F5', 'O'),
  ('J-14', 'F6', 'R'),
  ('J-14', 'F11', 'O'),
  ('K-01', 'F1', 'O'),
  ('K-01', 'F2', 'O'),
  ('K-01', 'F3', 'R'),
  ('K-01', 'F4', 'O'),
  ('K-01', 'F5', 'R'),
  ('K-01', 'F6', 'R'),
  ('K-01', 'F7', 'R'),
  ('K-01', 'F8', 'R'),
  ('K-01', 'F9', 'O'),
  ('K-01', 'F10', 'R'),
  ('K-02', 'F1', 'O'),
  ('K-02', 'F2', 'O'),
  ('K-02', 'F3', 'R'),
  ('K-02', 'F4', 'R'),
  ('K-02', 'F9', 'R'),
  ('K-02', 'F10', 'O'),
  ('K-03', 'F1', 'O'),
  ('K-03', 'F2', 'O'),
  ('K-03', 'F3', 'R'),
  ('K-03', 'F10', 'O'),
  ('K-04', 'F1', 'O'),
  ('K-04', 'F2', 'O'),
  ('K-04', 'F3', 'O'),
  ('K-04', 'F4', 'R'),
  ('K-04', 'F5', 'R'),
  ('K-04', 'F6', 'R'),
  ('K-04', 'F7', 'O'),
  ('K-04', 'F8', 'O'),
  ('K-04', 'F9', 'O'),
  ('K-04', 'F10', 'R'),
  ('K-04', 'F11', 'R'),
  ('K-05', 'F2', 'R'),
  ('K-05', 'F4', 'O'),
  ('K-05', 'F5', 'O'),
  ('K-05', 'F6', 'O'),
  ('K-05', 'F11', 'O'),
  ('K-06', 'F1', 'O'),
  ('K-06', 'F2', 'O'),
  ('K-06', 'F3', 'R'),
  ('K-06', 'F4', 'O'),
  ('K-06', 'F6', 'R'),
  ('K-06', 'F9', 'R'),
  ('K-07', 'F1', 'O'),
  ('K-07', 'F2', 'O'),
  ('K-07', 'F3', 'R'),
  ('K-07', 'F4', 'O'),
  ('K-07', 'F5', 'R'),
  ('K-07', 'F9', 'R'),
  ('K-08', 'F1', 'R'),
  ('K-08', 'F2', 'O'),
  ('K-08', 'F3', 'O'),
  ('K-08', 'F7', 'R'),
  ('K-08', 'F8', 'O'),
  ('K-08', 'F9', 'O'),
  ('K-08', 'F10', 'R'),
  ('K-09', 'F1', 'O'),
  ('K-09', 'F2', 'O'),
  ('K-09', 'F3', 'R'),
  ('K-09', 'F7', 'O'),
  ('K-09', 'F8', 'R'),
  ('K-09', 'F10', 'O'),
  ('K-10', 'F1', 'R'),
  ('K-10', 'F2', 'O'),
  ('K-10', 'F3', 'O'),
  ('K-10', 'F4', 'R'),
  ('K-10', 'F7', 'R'),
  ('K-10', 'F8', 'O'),
  ('K-10', 'F9', 'O'),
  ('K-10', 'F10', 'O'),
  ('K-11', 'F1', 'R'),
  ('K-11', 'F2', 'O'),
  ('K-11', 'F3', 'R'),
  ('K-11', 'F4', 'O'),
  ('K-11', 'F5', 'R'),
  ('K-11', 'F6', 'R'),
  ('K-11', 'F9', 'R'),
  ('K-12', 'F1', 'R'),
  ('K-12', 'F2', 'O'),
  ('K-12', 'F3', 'O'),
  ('K-12', 'F4', 'R'),
  ('K-12', 'F8', 'R'),
  ('K-12', 'F9', 'R'),
  ('K-13', 'F2', 'R'),
  ('K-13', 'F3', 'R'),
  ('K-13', 'F4', 'O'),
  ('K-13', 'F5', 'O'),
  ('K-13', 'F6', 'O'),
  ('K-14', 'F1', 'O'),
  ('K-14', 'F2', 'R'),
  ('K-14', 'F4', 'O'),
  ('K-14', 'F5', 'R'),
  ('K-14', 'F6', 'R'),
  ('K-14', 'F9', 'O'),
  ('K-14', 'F11', 'R'),
  ('L-01', 'F2', 'R'),
  ('L-01', 'F4', 'O'),
  ('L-01', 'F5', 'O'),
  ('L-01', 'F6', 'R'),
  ('L-02', 'F1', 'O'),
  ('L-02', 'F2', 'R'),
  ('L-03', 'F4', 'O'),
  ('L-03', 'F5', 'R'),
  ('L-03', 'F6', 'R'),
  ('L-04', 'F1', 'O'),
  ('L-04', 'F2', 'O'),
  ('L-04', 'F3', 'R'),
  ('L-04', 'F4', 'O'),
  ('L-04', 'F6', 'R'),
  ('L-04', 'F9', 'R'),
  ('L-05', 'F1', 'O'),
  ('L-05', 'F2', 'R'),
  ('L-05', 'F4', 'R'),
  ('L-06', 'F1', 'O'),
  ('L-06', 'F2', 'R'),
  ('L-06', 'F3', 'R'),
  ('L-06', 'F9', 'O'),
  ('L-07', 'F1', 'O'),
  ('L-07', 'F2', 'O'),
  ('L-07', 'F3', 'R'),
  ('L-07', 'F4', 'O'),
  ('L-07', 'F7', 'R'),
  ('L-07', 'F8', 'R'),
  ('L-07', 'F9', 'O'),
  ('L-08', 'F1', 'R'),
  ('L-08', 'F3', 'R'),
  ('L-08', 'F4', 'R'),
  ('L-08', 'F6', 'R'),
  ('L-08', 'F9', 'O'),
  ('L-09', 'F1', 'R'),
  ('L-10', 'F1', 'O'),
  ('L-10', 'F2', 'O'),
  ('L-10', 'F4', 'O'),
  ('L-10', 'F5', 'R'),
  ('L-10', 'F6', 'R'),
  ('M-01', 'F1', 'R'),
  ('M-01', 'F3', 'R'),
  ('M-01', 'F10', 'O'),
  ('M-02', 'F2', 'R'),
  ('M-02', 'F7', 'R'),
  ('M-02', 'F10', 'O'),
  ('M-03', 'F1', 'O'),
  ('M-03', 'F3', 'R'),
  ('M-03', 'F8', 'R'),
  ('M-03', 'F10', 'O'),
  ('M-04', 'F1', 'R'),
  ('M-04', 'F2', 'O'),
  ('M-04', 'F3', 'R'),
  ('M-04', 'F10', 'O'),
  ('M-05', 'F1', 'R'),
  ('M-05', 'F10', 'O'),
  ('M-06', 'F1', 'R'),
  ('M-06', 'F10', 'O'),
  ('M-07', 'F1', 'R'),
  ('M-07', 'F2', 'O'),
  ('M-07', 'F3', 'R'),
  ('M-07', 'F10', 'O'),
  ('M-08', 'F2', 'O'),
  ('M-08', 'F3', 'R'),
  ('M-08', 'F10', 'O'),
  ('M-09', 'F1', 'R'),
  ('M-09', 'F2', 'O'),
  ('M-09', 'F3', 'R'),
  ('M-09', 'F10', 'O'),
  ('M-10', 'F1', 'O'),
  ('M-10', 'F2', 'R'),
  ('M-10', 'F10', 'R'),
  ('N-01', 'F1', 'O'),
  ('N-01', 'F2', 'O'),
  ('N-01', 'F3', 'O'),
  ('N-01', 'F4', 'O'),
  ('N-01', 'F5', 'O'),
  ('N-01', 'F6', 'O'),
  ('N-01', 'F7', 'O'),
  ('N-01', 'F8', 'O'),
  ('N-01', 'F9', 'O'),
  ('N-01', 'F10', 'O'),
  ('N-01', 'F11', 'O'),
  ('N-02', 'F1', 'O'),
  ('N-02', 'F2', 'O'),
  ('N-02', 'F3', 'O'),
  ('N-02', 'F4', 'O'),
  ('N-02', 'F5', 'O'),
  ('N-02', 'F6', 'O'),
  ('N-02', 'F7', 'O'),
  ('N-02', 'F8', 'O'),
  ('N-02', 'F9', 'O'),
  ('N-02', 'F10', 'O'),
  ('N-02', 'F11', 'O'),
  ('N-03', 'F1', 'O'),
  ('N-03', 'F2', 'O'),
  ('N-03', 'F3', 'O'),
  ('N-03', 'F4', 'O'),
  ('N-03', 'F6', 'R'),
  ('N-03', 'F7', 'O'),
  ('N-03', 'F8', 'O'),
  ('N-03', 'F9', 'O'),
  ('N-03', 'F10', 'O'),
  ('N-04', 'F2', 'O'),
  ('N-04', 'F3', 'R'),
  ('N-04', 'F4', 'O'),
  ('N-04', 'F5', 'O'),
  ('N-04', 'F6', 'O'),
  ('N-05', 'F1', 'R'),
  ('N-05', 'F2', 'O'),
  ('N-05', 'F3', 'R'),
  ('N-05', 'F8', 'R'),
  ('N-06', 'F1', 'O'),
  ('N-06', 'F2', 'O'),
  ('N-06', 'F3', 'O'),
  ('N-06', 'F4', 'O'),
  ('N-06', 'F5', 'O'),
  ('N-06', 'F6', 'O'),
  ('N-06', 'F7', 'O'),
  ('N-06', 'F8', 'O'),
  ('N-06', 'F9', 'O'),
  ('N-06', 'F10', 'O'),
  ('N-06', 'F11', 'O')
on conflict (curso_codigo, familia_codigo) do update set obligatoriedad = excluded.obligatoriedad;

-- 5. Tipo de cada criterio: CAP capacitable / CON conductual (11_MAPA_CRITERIO)
update eva_criterios set tipo = 'CAP', texto_criterio = 'Dominio de las funciones y procesos propios del cargo' where codigo = 'TC1';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Calidad y exactitud de los entregables (informes, registros, reportes)' where codigo = 'TC2';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Productividad y cumplimiento de los plazos comprometidos' where codigo = 'TC3';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Manejo de sistemas y herramientas (ERP Auranet, Office, Teams)' where codigo = 'TC4';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Gestión documental, archivo y trazabilidad de la información' where codigo = 'TC5';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Análisis y resolución de problemas del ámbito propio' where codigo = 'TC6';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Cumplimiento de procedimientos y normativa interna' where codigo = 'SS1';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Confidencialidad y manejo responsable de la información' where codigo = 'SS2';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Orden del puesto de trabajo y autocuidado' where codigo = 'SS3';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Planificación y administración del tiempo propio' where codigo = 'SS4';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Cumplimiento de plazos legales y de reportes obligatorios' where codigo = 'SS5';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Aplicación de controles y respaldos para evitar errores' where codigo = 'SS6';
update eva_criterios set tipo = 'CON', texto_criterio = 'Asistencia sin ausencias injustificadas' where codigo = 'DL1';
update eva_criterios set tipo = 'CON', texto_criterio = 'Puntualidad (entrada, colaciones, reuniones)' where codigo = 'DL2';
update eva_criterios set tipo = 'CON', texto_criterio = 'Cumplimiento de horarios y de la jornada completa' where codigo = 'DL3';
update eva_criterios set tipo = 'CON', texto_criterio = 'Adherencia al Reglamento Interno (RIOHS)' where codigo = 'DL4';
update eva_criterios set tipo = 'CON', texto_criterio = 'Uso de identificación corporativa y presentación personal' where codigo = 'DL5';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Cuidado de equipos, recursos e insumos de la empresa' where codigo = 'DL6';
update eva_criterios set tipo = 'CON', texto_criterio = 'Honestidad — transparencia en reportes y manejo de recursos' where codigo = 'VH1';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Austeridad — uso responsable y eficiente de los recursos' where codigo = 'VH2';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Cercanía — escucha, colaboración y trato con el equipo' where codigo = 'VH3';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Excelencia — búsqueda del detalle y del trabajo bien hecho' where codigo = 'VH4';
update eva_criterios set tipo = 'CON', texto_criterio = 'Respeto — trato con pares, jefatura y clientes internos y externos' where codigo = 'VH5';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Compromiso y adaptabilidad frente a cambios y cierres críticos' where codigo = 'VH6';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Conformidad de los entregables con estándares y formatos' where codigo = 'CM1';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Reducción de errores, reprocesos y observaciones' where codigo = 'CM2';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Aporte de ideas de mejora y optimización de procesos' where codigo = 'CM3';
update eva_criterios set tipo = 'CON', texto_criterio = 'Disposición a capacitarse y aprender nuevas herramientas' where codigo = 'CM4';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Apoyo e inducción a compañeros nuevos o con menos experiencia' where codigo = 'CM5';
update eva_criterios set tipo = 'CAP', texto_criterio = 'Iniciativa frente a tareas no asignadas pero necesarias' where codigo = 'CM6';

-- 6. Cruce criterio x cursos: el corazon de la automatizacion (11_MAPA_CRITERIO) -- 92 mapeos
insert into eva_criterio_cursos (criterio_codigo, curso_codigo, orden) values
  ('TC1', 'N-03', 1),
  ('TC1', 'D-12', 2),
  ('TC1', 'A-07', 3),
  ('TC1', 'E-01', 4),
  ('TC1', 'K-12', 5),
  ('TC2', 'E-04', 1),
  ('TC2', 'D-09', 2),
  ('TC2', 'K-10', 3),
  ('TC2', 'K-13', 4),
  ('TC3', 'K-08', 1),
  ('TC3', 'C-01', 2),
  ('TC3', 'C-09', 3),
  ('TC3', 'L-07', 4),
  ('TC4', 'D-12', 1),
  ('TC4', 'D-09', 2),
  ('TC4', 'J-08', 3),
  ('TC4', 'D-11', 4),
  ('TC4', 'J-02', 5),
  ('TC5', 'A-07', 1),
  ('TC5', 'J-07', 2),
  ('TC5', 'A-12', 3),
  ('TC5', 'G-09', 4),
  ('TC6', 'K-12', 1),
  ('TC6', 'E-04', 2),
  ('TC6', 'J-11', 3),
  ('TC6', 'C-07', 4),
  ('SS1', 'E-01', 1),
  ('SS1', 'N-03', 2),
  ('SS1', 'N-06', 3),
  ('SS1', 'H-01', 4),
  ('SS2', 'J-09', 1),
  ('SS2', 'J-10', 2),
  ('SS3', 'F-15', 1),
  ('SS3', 'F-09', 2),
  ('SS3', 'K-13', 3),
  ('SS4', 'K-08', 1),
  ('SS4', 'L-07', 2),
  ('SS4', 'C-01', 3),
  ('SS5', 'H-01', 1),
  ('SS5', 'G-03', 2),
  ('SS5', 'H-04', 3),
  ('SS5', 'G-09', 4),
  ('SS6', 'G-08', 1),
  ('SS6', 'E-04', 2),
  ('SS6', 'D-09', 3),
  ('SS6', 'D-10', 4),
  ('DL2', 'K-08', 1),
  ('DL4', 'N-02', 1),
  ('DL4', 'H-01', 2),
  ('DL5', 'N-02', 1),
  ('DL6', 'F-15', 1),
  ('DL6', 'I-02', 2),
  ('DL6', 'N-01', 3),
  ('VH1', 'N-01', 1),
  ('VH1', 'G-08', 2),
  ('VH2', 'N-01', 1),
  ('VH2', 'I-02', 2),
  ('VH2', 'C-09', 3),
  ('VH3', 'K-01', 1),
  ('VH3', 'K-05', 2),
  ('VH3', 'K-04', 3),
  ('VH3', 'L-01', 4),
  ('VH4', 'K-13', 1),
  ('VH4', 'E-04', 2),
  ('VH4', 'K-12', 3),
  ('VH5', 'K-14', 1),
  ('VH5', 'K-06', 2),
  ('VH5', 'H-03', 3),
  ('VH5', 'K-05', 4),
  ('VH6', 'L-06', 1),
  ('VH6', 'K-11', 2),
  ('VH6', 'K-07', 3),
  ('CM1', 'E-01', 1),
  ('CM1', 'E-04', 2),
  ('CM1', 'K-13', 3),
  ('CM2', 'E-04', 1),
  ('CM2', 'C-10', 2),
  ('CM2', 'K-13', 3),
  ('CM2', 'G-08', 4),
  ('CM3', 'C-10', 1),
  ('CM3', 'J-04', 2),
  ('CM3', 'K-12', 3),
  ('CM3', 'J-03', 4),
  ('CM4', 'J-01', 1),
  ('CM4', 'J-02', 2),
  ('CM4', 'N-01', 3),
  ('CM5', 'L-08', 1),
  ('CM5', 'K-01', 2),
  ('CM5', 'L-04', 3),
  ('CM6', 'K-12', 1),
  ('CM6', 'L-05', 2),
  ('CM6', 'K-07', 3)
on conflict (criterio_codigo, curso_codigo) do update set orden = excluded.orden;

-- ----------------------------------------------------------------------------
-- 14. Refrescar la caché de esquema de PostgREST
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
