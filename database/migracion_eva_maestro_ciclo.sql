-- ============================================================================
-- SGC METALIUM · Maestro del ciclo de evaluación
--
-- El expediente individual responde «cómo le fue a esta persona». Faltaba el
-- otro documento: «cómo va el ciclo completo, y quién no ha hecho lo suyo».
--
-- LO IMPORTANTE: CÓMO SE SABE QUE ALGUIEN NO SE AUTOEVALUÓ
--
-- La respuesta obvia es mirar eva_evaluaciones.fecha_envio_autoeval. Y es la
-- respuesta equivocada, porque ese campo puede estar vacío en evaluaciones que
-- SÍ tienen autoevaluación. Medido en tu propia base:
--
--     estado             evaluaciones  con respuestas  con fecha_envio
--     cerrada_conforme        1              1               0
--
-- Una evaluación cerrada, con las respuestas cargadas, y sin fecha de envío. El
-- formulario sí escribe esa fecha (personal-autoevaluacion.js:216 y
-- db/personal.js:70), pero cualquier fila que entre por otro camino —la carga
-- masiva, una corrección a mano en el SQL Editor, una migración— la deja nula.
--
-- Si el maestro se fiara sólo de la fecha, reportaría como «no se autoevaluó» a
-- gente que sí lo hizo. En un documento cuyo propósito es perseguir a los que
-- faltan, ese error se paga en tiempo de RRHH y en credibilidad.
--
-- Así que se decide por EVIDENCIA, en este orden:
--
--   1. hay filas suyas en eva_detalle_auto            → se autoevaluó
--   2. el estado ya pasó la etapa de autoevaluación   → se autoevaluó
--   3. hay fecha_envio_autoeval                       → se autoevaluó
--   4. ninguna de las tres                            → NO se autoevaluó
--
-- y se devuelve además `como_consta`, para que quien lea el maestro sepa si la
-- fecha está o si se dedujo. Las que digan «sin fecha registrada» son filas que
-- conviene revisar: el dato existe pero incompleto.
--
-- QUIÉN LO VE
--
-- Sólo RRHH y el admin: es la nómina completa con notas de todo el mundo.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Una fila por evaluación del ciclo
-- ----------------------------------------------------------------------------

drop function if exists eva_maestro_ciclo(uuid);

create or replace function eva_maestro_ciclo(p_ciclo_id uuid)
returns table (
  evaluacion_id uuid,
  nombre text,
  cargo text,
  familia_codigo text,
  familia_nombre text,
  evaluador_nombre text,
  estado text,
  se_autoevaluo boolean,
  como_consta text,
  fecha_envio_autoeval timestamptz,
  jefatura_evaluo boolean,
  fecha_envio_evaluacion timestamptz,
  total_auto numeric,
  total_sup numeric,
  brecha_total numeric,
  categoria text,
  acuerdo_trabajador text,
  firmas integer,
  lineas_pdi integer,
  dias_habilitado integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    p.nombre,
    coalesce(e.cargo_actual, p.cargo),
    coalesce(e.familia_codigo, c.familia_codigo),
    f.nombre,
    ev.nombre,
    e.estado,

    -- Se autoevaluó: por evidencia, no sólo por la fecha.
    (
      exists (select 1 from eva_detalle_auto d where d.evaluacion_id = e.id)
      or e.estado not in ('asignada', 'autoevaluacion_en_curso')
      or e.fecha_envio_autoeval is not null
    ),

    case
      when e.fecha_envio_autoeval is not null then 'Fecha de envío registrada'
      when exists (select 1 from eva_detalle_auto d where d.evaluacion_id = e.id)
        then 'Tiene respuestas cargadas, sin fecha registrada'
      when e.estado not in ('asignada', 'autoevaluacion_en_curso')
        then 'El expediente ya avanzó, sin fecha registrada'
      else 'No se autoevaluó'
    end,

    e.fecha_envio_autoeval,
    (e.fecha_envio_evaluacion is not null
      or e.estado in ('consolidada', 'entregada_trabajador', 'resultados_aceptados',
                      'reunion_agendada', 'reunion_realizada', 'reflexiones_enviadas',
                      'pendiente_firmas', 'cerrada_conforme', 'cerrada_disconformidad',
                      'archivada')),
    e.fecha_envio_evaluacion,

    e.total_auto,
    e.total_sup,
    e.brecha_total,
    e.categoria,
    e.acuerdo_trabajador,
    (select count(*)::int from eva_firmas fi where fi.evaluacion_id = e.id),
    (select count(*)::int from eva_pdi pd where pd.evaluacion_id = e.id),

    -- Días desde que se abrió el ciclo. Es la cifra que convierte «falta» en
    -- «falta hace tres semanas», que es lo que mueve a alguien a llamar.
    case when ci.fecha_apertura is null then null
         else (current_date - ci.fecha_apertura)::int end

  from eva_evaluaciones e
  join perfiles p on p.id = e.evaluado_id
  left join perfiles ev on ev.id = e.evaluador_id
  left join eva_ciclos ci on ci.id = e.ciclo_id
  left join eva_cargos_catalogo c on sgc_norm(c.nombre) = sgc_norm(p.cargo)
  left join eva_familias_cargo f on f.codigo = coalesce(e.familia_codigo, c.familia_codigo)
  where e.ciclo_id = p_ciclo_id
    and coalesce(es_admin() or rol_en_modulo('personal') = 'rrhh', false)
  order by p.nombre;
$$;

grant execute on function eva_maestro_ciclo(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. El resumen del ciclo, para la cabecera del documento y la pantalla
-- ----------------------------------------------------------------------------

drop function if exists eva_maestro_resumen(uuid);

create or replace function eva_maestro_resumen(p_ciclo_id uuid)
returns table (
  ciclo_titulo text,
  ciclo_estado text,
  fecha_apertura date,
  fecha_cierre_autoeval date,
  fecha_cierre_evaluacion date,
  asignadas integer,
  autoevaluadas integer,
  sin_autoevaluar integer,
  evaluadas_por_jefatura integer,
  consolidadas integer,
  cerradas integer,
  con_disconformidad integer,
  promedio_general numeric,
  lineas_pdi integer,
  autoeval_vencida boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (select * from eva_maestro_ciclo(p_ciclo_id))
  select
    ci.titulo,
    ci.estado,
    ci.fecha_apertura,
    ci.fecha_cierre_autoeval,
    ci.fecha_cierre_evaluacion,
    (select count(*)::int from m),
    (select count(*)::int from m where se_autoevaluo),
    (select count(*)::int from m where not se_autoevaluo),
    (select count(*)::int from m where jefatura_evaluo),
    (select count(*)::int from m where estado not in ('asignada','autoevaluacion_en_curso','autoevaluacion_enviada')),
    (select count(*)::int from m where estado in ('cerrada_conforme','cerrada_disconformidad','archivada')),
    (select count(*)::int from m where acuerdo_trabajador in ('no_conforme','parcialmente')),
    (select round(avg(total_sup), 2) from m where total_sup is not null),
    (select coalesce(sum(lineas_pdi), 0)::int from m),
    -- El plazo de autoevaluación ya pasó y todavía falta gente: es el momento
    -- en que el maestro deja de ser informativo y pasa a ser una lista de
    -- llamadas por hacer.
    (ci.fecha_cierre_autoeval is not null
      and ci.fecha_cierre_autoeval < current_date
      and (select count(*) from m where not se_autoevaluo) > 0)
  from eva_ciclos ci
  where ci.id = p_ciclo_id
    and coalesce(es_admin() or rol_en_modulo('personal') = 'rrhh', false);
$$;

grant execute on function eva_maestro_resumen(uuid) to authenticated;


notify pgrst, 'reload schema';
