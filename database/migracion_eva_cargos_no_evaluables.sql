-- ============================================================================
-- SGC METALIUM · Cargos que existen pero no se evalúan
--
-- El Gerente General tiene que estar en el catálogo — la persona existe, tiene
-- perfil, evalúa a sus gerentes y aparece en los expedientes como evaluador —
-- pero a él nadie lo evalúa: es la cabeza de la línea.
--
-- Dos cosas, entonces:
--
--   1. «Gerente General» entra al catálogo. Comprobado antes de agregarlo: NO
--      estaba en tu hoja 13_MAESTROS, así que no es que se me haya perdido al
--      leerla — los cinco gerentes que hay ahí son Operaciones, Ingeniería,
--      Finanzas Corporativas, Operaciones Logísticas y SST. El hueco es del dato
--      maestro y conviene arreglarlo también en la planilla.
--
--   2. El catálogo gana una columna «evaluable». No se borra al Gerente General
--      ni se lo esconde: se lo marca. Esconderlo obligaría a escribir su cargo a
--      mano, que es justo el problema que acabamos de cerrar.
--
-- QUÉ CAMBIA EN LA PRÁCTICA
--
-- Al asignar una evaluación, quien tenga un cargo no evaluable aparece en la
-- lista de «trabajador a evaluar» pero DESHABILITADO, con el motivo al lado. No
-- se lo saca de la lista: si desapareciera sin explicación, RRHH lo buscaría
-- pensando que falta cargarlo.
--
-- Como EVALUADOR sigue disponible sin restricción: el Gerente General evalúa.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. La columna, y el cargo que faltaba
-- ----------------------------------------------------------------------------

alter table eva_cargos_catalogo add column if not exists evaluable boolean not null default true;
alter table eva_cargos_catalogo add column if not exists motivo_no_evaluable text;

insert into eva_cargos_catalogo (nombre, familia_codigo, evaluable, motivo_no_evaluable)
values ('Gerente General', 'F1', false,
        'Cabeza de la línea jerárquica: no tiene jefatura que lo evalúe. Evalúa a las gerencias.')
on conflict (nombre) do update set
  familia_codigo = excluded.familia_codigo,
  evaluable = excluded.evaluable,
  motivo_no_evaluable = excluded.motivo_no_evaluable;


-- ----------------------------------------------------------------------------
-- 2. Marcar o desmarcar un cargo como evaluable
--
--    Por función de alcance estrecho, como el resto del módulo: RLS no restringe
--    columnas, así que sin esto cualquiera con permiso de escritura sobre el
--    catálogo podría además renombrar cargos o cambiarles la familia.
--
--    Marcar un cargo como no evaluable exige decir por qué. No es burocracia:
--    «a esta gente no la evalúa nadie» es exactamente la clase de decisión que
--    alguien va a cuestionar en una auditoría, y la respuesta no puede ser
--    «estaba así».
-- ----------------------------------------------------------------------------

create or replace function eva_marcar_cargo_evaluable(
  p_cargo text,
  p_evaluable boolean,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_en_curso integer;
begin
  if not coalesce((es_admin() or rol_en_modulo('personal') = 'rrhh'), false) then
    raise exception 'Sólo RRHH define qué cargos se evalúan';
  end if;

  if not p_evaluable and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Marcar un cargo como no evaluable exige decir por qué: queda en el registro';
  end if;

  -- Si ya hay evaluaciones en curso de gente con ese cargo, se avisa en el
  -- mensaje de error en lugar de dejarlas huérfanas en silencio. No se bloquea:
  -- puede ser justamente lo que se quiere corregir.
  if not p_evaluable then
    select count(*) into v_en_curso
    from eva_evaluaciones e
    join perfiles p on p.id = e.evaluado_id
    where sgc_norm(coalesce(e.cargo_actual, p.cargo)) = sgc_norm(p_cargo)
      and e.estado not in ('cerrada_conforme', 'cerrada_disconformidad', 'archivada');

    if v_en_curso > 0 then
      raise notice
        'Ojo: hay % evaluación(es) en curso de personas con el cargo «%». No se cancelan solas: siguen su flujo normal. Este cambio sólo impide asignar nuevas.',
        v_en_curso, p_cargo;
    end if;
  end if;

  update eva_cargos_catalogo
    set evaluable = p_evaluable,
        motivo_no_evaluable = case when p_evaluable then null else trim(p_motivo) end
    where sgc_norm(nombre) = sgc_norm(p_cargo);

  if not found then
    raise exception 'El cargo «%» no está en el catálogo', p_cargo;
  end if;
end;
$$;

grant execute on function eva_marcar_cargo_evaluable(text, boolean, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Quién se puede evaluar y quién no
--
--    Una sola consulta para que la pantalla de asignación no tenga que replicar
--    la regla de deducción del cargo. Devuelve a TODOS los activos, con el
--    motivo cuando no corresponde evaluarlos: la lista completa con la razón al
--    lado es más útil que una lista incompleta.
-- ----------------------------------------------------------------------------

create or replace function eva_candidatos_a_evaluar()
returns table (
  perfil_id uuid,
  nombre text,
  cargo text,
  familia_codigo text,
  familia_nombre text,
  evaluable boolean,
  motivo text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nombre,
    p.cargo,
    coalesce(p.familia_codigo, c.familia_codigo),
    f.nombre,
    -- Sin cargo reconocido se deja evaluable: mejor permitir de más que trabar a
    -- alguien por un dato maestro incompleto. La pantalla ya avisa aparte de
    -- quién no tiene familia.
    coalesce(c.evaluable, true),
    case
      when c.evaluable is false then coalesce(c.motivo_no_evaluable, 'Este cargo no se evalúa.')
      else null
    end
  from perfiles p
  left join eva_cargos_catalogo c on sgc_norm(c.nombre) = sgc_norm(p.cargo)
  left join eva_familias_cargo f on f.codigo = coalesce(p.familia_codigo, c.familia_codigo)
  where p.activo
  order by p.nombre;
$$;

grant execute on function eva_candidatos_a_evaluar() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. El catálogo de cargos para administrarlo
-- ----------------------------------------------------------------------------

create or replace function eva_cargos_con_uso()
returns table (
  nombre text,
  familia_codigo text,
  familia_nombre text,
  orden_familia integer,
  evaluable boolean,
  motivo_no_evaluable text,
  personas_activas integer,
  evaluaciones_en_curso integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.nombre, c.familia_codigo, f.nombre, f.orden,
    c.evaluable, c.motivo_no_evaluable,
    (select count(*)::int from perfiles p
      where p.activo and sgc_norm(p.cargo) = sgc_norm(c.nombre)),
    (select count(*)::int from eva_evaluaciones e
      join perfiles p on p.id = e.evaluado_id
      where sgc_norm(coalesce(e.cargo_actual, p.cargo)) = sgc_norm(c.nombre)
        and e.estado not in ('cerrada_conforme', 'cerrada_disconformidad', 'archivada'))
  from eva_cargos_catalogo c
  left join eva_familias_cargo f on f.codigo = c.familia_codigo
  where c.activo
  order by f.orden, c.nombre;
$$;

grant execute on function eva_cargos_con_uso() to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Agregar un cargo al catálogo
--
--    Hace falta porque el dato maestro estaba incompleto: «Gerente General» no
--    figuraba en la hoja 13_MAESTROS. Si vuelve a faltar uno, RRHH lo agrega sin
--    depender de nadie.
--
--    Se valida el duplicado con el mismo criterio de comparación que usa el
--    motor — sin acentos ni mayúsculas — porque «Jefe de Obra» y «jefe de obra»
--    serían dos cargos distintos en la tabla y el mismo para la deducción de
--    familia: dos filas compitiendo por el mismo match.
-- ----------------------------------------------------------------------------

create or replace function eva_agregar_cargo(
  p_nombre text,
  p_familia_codigo text,
  p_evaluable boolean default true,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_existe text;
begin
  if not coalesce((es_admin() or rol_en_modulo('personal') = 'rrhh'), false) then
    raise exception 'Sólo RRHH agrega cargos al catálogo';
  end if;

  if length(v_nombre) < 3 then
    raise exception 'El nombre del cargo es demasiado corto';
  end if;

  if not exists (select 1 from eva_familias_cargo where codigo = p_familia_codigo) then
    raise exception 'La familia «%» no existe', p_familia_codigo;
  end if;

  select nombre into v_existe
  from eva_cargos_catalogo
  where sgc_norm(nombre) = sgc_norm(v_nombre);

  if v_existe is not null then
    raise exception 'Ya existe un cargo equivalente en el catálogo: «%»', v_existe;
  end if;

  if not p_evaluable and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Un cargo no evaluable necesita el motivo';
  end if;

  insert into eva_cargos_catalogo (nombre, familia_codigo, evaluable, motivo_no_evaluable)
  values (v_nombre, p_familia_codigo, p_evaluable,
          case when p_evaluable then null else trim(p_motivo) end);

  -- El cargo nuevo hereda los criterios de su familia: la matriz es por familia,
  -- no por cargo, así que no hay nada que sembrar. Se deja dicho para que nadie
  -- lo busque.
end;
$$;

grant execute on function eva_agregar_cargo(text, text, boolean, text) to authenticated;


notify pgrst, 'reload schema';
