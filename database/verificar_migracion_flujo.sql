-- ============================================================================
-- ¿Está aplicada la migración del nuevo flujo de Evaluación de Personal?
--
-- Pega este archivo completo en el SQL Editor de Supabase y ejecútalo. Devuelve
-- una fila por objeto que la migración debe haber creado, con OK o «>>> FALTA».
--
-- Si aparece cualquier «>>> FALTA», corre la migración que falte:
--
--   migracion_eva_flujo_bienestar.sql   flujo de cierre, checklist, acta, rol
--   migracion_prov_gol_cartas.sql       GOL y cartas al proveedor
--   migracion_eva_motor_pdi.sql         motor de PDI (batería y mapa de cursos)
--   migracion_eva_acta_v2.sql           checklist v2.0 y cuarta firma
--   migracion_eva_motor_secciones.sql   lectura por sección (tramos NC..EX)
--   migracion_eva_fortalezas.sql        qué pasa cuando sale bien (SE y EX)
--   migracion_eva_filtro_cargo.sql      filtrar por cargo: criterios y cursos
--
-- Las siete son repetibles: no pasa nada si las corres de nuevo estando ya
-- aplicadas.
--
-- Si todo dice OK pero el sistema igual reclama que no encuentra una columna,
-- el problema es la caché de esquema de PostgREST. Se recarga con:
--
--     notify pgrst, 'reload schema';
--
-- ============================================================================
with esperado(tipo, objeto) as (values
  ('columna',  'eva_evaluaciones.fecha_aceptacion_resultados'),
  ('columna',  'eva_evaluaciones.reunion_fecha'),
  ('columna',  'eva_evaluaciones.reunion_hora'),
  ('columna',  'eva_evaluaciones.reunion_modalidad'),
  ('columna',  'eva_evaluaciones.reunion_lugar'),
  ('columna',  'eva_evaluaciones.reunion_duracion_min'),
  ('columna',  'eva_evaluaciones.reunion_agendada_en'),
  ('columna',  'eva_evaluaciones.reunion_realizada_en'),
  ('columna',  'eva_evaluaciones.reunion_notas'),
  ('columna',  'eva_evaluaciones.recomendacion_codigo'),
  ('columna',  'eva_pdi.plan_codigo'),
  -- migracion_eva_motor_pdi.sql
  ('tabla',    'eva_familias_cargo'),
  ('tabla',    'eva_cargos_catalogo'),
  ('tabla',    'eva_cursos'),
  ('tabla',    'eva_curso_familia'),
  ('tabla',    'eva_criterio_cursos'),
  ('tabla',    'eva_prioridades_pdi'),
  ('tabla',    'eva_reglas_conducta'),
  ('tabla',    'eva_capacitaciones'),
  ('tabla',    'eva_pdi_descartes'),
  ('columna',  'eva_criterios.tipo'),
  ('columna',  'eva_dimensiones.orden'),
  ('columna',  'perfiles.familia_codigo'),
  ('columna',  'eva_evaluaciones.familia_codigo'),
  ('columna',  'eva_pdi.curso_codigo'),
  ('columna',  'eva_pdi.criterio_codigo'),
  ('columna',  'eva_pdi.prioridad'),
  ('columna',  'eva_pdi.origen'),
  ('funcion',  'sgc_norm'),
  ('funcion',  'eva_familia_de'),
  ('funcion',  'eva_motor_pdi'),
  ('funcion',  'eva_motor_pdi_resumen'),
  ('funcion',  'eva_puede_ver_evaluacion'),
  -- migracion_eva_motor_secciones.sql
  ('tabla',    'eva_segmento_tramos'),
  ('funcion',  'sgc_nota'),
  ('funcion',  'sgc_plural'),
  ('funcion',  'eva_tramo_de'),
  ('funcion',  'eva_seccion_composicion'),
  ('funcion',  'eva_motor_pdi_secciones'),
  ('funcion',  'eva_motor_pdi_con_seccion'),
  -- migracion_eva_filtro_cargo.sql
  ('tabla',    'eva_criterio_familia'),
  ('columna',  'eva_criterio_familia.aplica'),
  ('funcion',  'eva_criterios_de_evaluacion'),
  ('funcion',  'eva_criterio_familia_matriz'),
  ('funcion',  'eva_marcar_criterio_familia'),
  -- migracion_eva_fortalezas.sql
  ('tabla',    'eva_relator_candidaturas'),
  ('tabla',    'eva_config_fortalezas'),
  ('columna',  'eva_relator_candidaturas.estado'),
  ('columna',  'eva_relator_candidaturas.dominio_sugerido'),
  ('funcion',  'sgc_clp'),
  ('funcion',  'eva_motor_fortalezas'),
  ('funcion',  'eva_motor_fortalezas_resumen'),
  ('funcion',  'eva_curso_relator_sugerido'),
  ('funcion',  'eva_resolver_candidatura'),
  ('funcion',  'eva_candidaturas_de'),
  -- migracion_eva_acta_v2.sql
  ('columna',  'eva_checklist_items.obligatorio'),
  ('columna',  'eva_evaluaciones.derivado_rrhh_en'),
  ('columna',  'eva_evaluaciones.derivado_bienestar_en'),
  ('columna',  'eva_evaluaciones.lineas_cargadas_dnc'),
  ('columna',  'eva_evaluaciones.acta_comite'),
  ('funcion',  'eva_registrar_acta_comite'),
  -- migracion_eva_flujo_bienestar.sql
  ('tabla',    'eva_rangos'),
  ('tabla',    'eva_recomendaciones'),
  ('tabla',    'eva_planes_catalogo'),
  ('tabla',    'eva_checklist_items'),
  ('tabla',    'eva_checklist_respuestas'),
  ('tabla',    'eva_declaraciones'),
  ('tabla',    'eva_firmas'),
  ('funcion',  'eva_planes_sugeridos'),
  ('funcion',  'eva_pdi_registrar_control'),
  ('funcion',  'eva_checklist_resumen'),
  ('funcion',  'eva_firmar_acta'),
  ('funcion',  'es_crecimiento_bienestar'),
  -- migracion_prov_gol_cartas.sql
  ('tabla',    'prov_carta_plantillas'),
  ('tabla',    'prov_cartas'),
  ('columna',  'prov_planes_accion.creado_por'),
  ('funcion',  'es_gol_proveedores'),
  ('funcion',  'prov_enviar_carta'),
  ('funcion',  'prov_cerrar_evaluacion'),
  -- migracion_eva_cargos_no_evaluables.sql
  ('columna',  'eva_cargos_catalogo.evaluable'),
  ('columna',  'eva_cargos_catalogo.motivo_no_evaluable'),
  ('funcion',  'eva_marcar_cargo_evaluable'),
  ('funcion',  'eva_candidatos_a_evaluar'),
  ('funcion',  'eva_cargos_con_uso'),
  ('funcion',  'eva_agregar_cargo'),
  -- parche_guardias_nulas.sql
  ('funcion',  'sgc_rol'),
  -- migracion_eva_expediente_trabajador.sql
  ('funcion',  'eva_expediente_descargable'),
  ('funcion',  'eva_expedientes_de'),
  -- migracion_eva_maestro_ciclo.sql
  ('funcion',  'eva_maestro_ciclo'),
  ('funcion',  'eva_maestro_resumen')
)
select
  e.tipo,
  e.objeto,
  case when
    (e.tipo = 'tabla' and exists (
       select 1 from information_schema.tables
       where table_schema = 'public' and table_name = e.objeto))
    or (e.tipo = 'columna' and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = split_part(e.objeto, '.', 1)
         and column_name = split_part(e.objeto, '.', 2)))
    or (e.tipo = 'funcion' and exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = e.objeto))
  then 'OK' else '>>> FALTA' end as estado
from esperado e
-- ASC, no DESC: '>' (0x3E) ordena antes que 'O' (0x4F), así que los fallos
-- salen ARRIBA. Con 86 filas, un '>>> FALTA' al final no lo ve nadie.
order by estado asc, e.tipo, e.objeto;

-- ----------------------------------------------------------------------------
-- Datos del motor de PDI: no basta con que las tablas existan, tienen que
-- traer la batería completa. Los números salen de las dos planillas oficiales.
-- ----------------------------------------------------------------------------
with conteo(que, hay, debe) as (values
  ('familias de cargo',            (select count(*) from eva_familias_cargo),  11::bigint),
  ('cargos del catálogo',          (select count(*) from eva_cargos_catalogo),  55::bigint),
  ('cursos de la batería',         (select count(*) from eva_cursos),          160::bigint),
  ('celdas curso × familia',       (select count(*) from eva_curso_familia),   626::bigint),
  ('mapeos criterio × curso',      (select count(*) from eva_criterio_cursos),  92::bigint),
  ('criterios capacitables (CAP)', (select count(*) from eva_criterios where tipo = 'CAP'), 22::bigint),
  ('criterios conductuales (CON)', (select count(*) from eva_criterios where tipo = 'CON'),  8::bigint),
  ('prioridades P1..P4',           (select count(*) from eva_prioridades_pdi),    4::bigint),
  ('reglas de conducta 1..5',      (select count(*) from eva_reglas_conducta),    5::bigint),
  ('ítems del checklist v2.0',     (select count(*) from eva_checklist_items where activo and codigo like 'V2-%'), 26::bigint),
  ('ítems obligatorios v2.0',      (select count(*) from eva_checklist_items where activo and obligatorio),        22::bigint),
  ('declaraciones de firma',       (select count(*) from eva_declaraciones where vigente),  4::bigint),
  ('tramos de sección NC..EX',     (select count(*) from eva_segmento_tramos),               5::bigint),
  ('curso de formación de relator',(select count(*) from eva_config_fortalezas
                                      where clave = 'curso_formacion_relator'),              1::bigint),
  ('matriz criterio × familia',    (select count(*) from eva_criterio_familia),             330::bigint),
  ('cargos que no se evalúan',     (select count(*) from eva_cargos_catalogo where not evaluable), 1::bigint)
)
select que, hay, debe,
       case when hay = debe then 'OK' else '>>> REVISAR' end as estado
from conteo
order by estado asc, que;   -- los fallos arriba (ver nota de más arriba)

-- ----------------------------------------------------------------------------
-- Que las guardias de permisos sigan cerrando.
--
-- Esto no comprueba que la función exista: comprueba cómo está escrita. Una
-- guardia de la forma
--
--     if not (es_admin() or rol_en_modulo('personal') = 'rrhh') then
--
-- deja pasar a cualquier usuario SIN rol en el módulo, porque rol_en_modulo()
-- devuelve NULL, NULL = 'rrhh' da NULL, y `if NULL then` no entra. Se arregla
-- envolviendo la condición en coalesce(..., false).
--
-- Si alguna de estas siete sale «>>> AGUJERO ABIERTO», hay que volver a correr
-- parche_guardias_nulas.sql: alguien reaplicó una migración vieja encima.
-- ----------------------------------------------------------------------------
with guardias(fn) as (values
  ('eva_firmar_acta'), ('eva_registrar_acta_comite'), ('eva_marcar_criterio_familia'),
  ('eva_resolver_candidatura'), ('eva_pdi_registrar_control'),
  ('eva_marcar_cargo_evaluable'), ('eva_agregar_cargo')
),
def as (
  select g.fn,
         (select pg_get_functiondef(p.oid)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = g.fn
          limit 1) as cuerpo
  from guardias g
)
select fn,
  case
    when cuerpo is null then '>>> FALTA la función'
    when cuerpo like '%if not v_autorizado then%'
      or cuerpo like '%if not (es_admin()%' then '>>> AGUJERO ABIERTO'
    when cuerpo like '%coalesce(v_autorizado, false)%'
      or cuerpo like '%if not coalesce((es_admin()%' then 'OK'
    else '>>> REVISAR a mano'
  end as guardia
from def
order by guardia asc, fn;   -- los fallos arriba

-- ----------------------------------------------------------------------------
-- Que el trabajador pueda leer su propio expediente.
--
-- No basta con que las políticas existan: lo que importa es qué estados cubren.
-- La política que deja al evaluado leer las notas de su jefatura listaba cuatro
-- estados de trece, y perdía el acceso justo en el tramo de la entrevista 1:1.
--
-- Se comprueba contando estados cubiertos en el texto de cada política.
-- ----------------------------------------------------------------------------
with pol(tabla, nombre, minimo) as (values
  ('eva_detalle_auto', 'personal_evaluado_lee_su_autoeval',    0),
  ('eva_detalle_sup',  'personal_evaluado_lee_sup_consolidada', 9)
),
def as (
  select p.tabla, p.nombre, p.minimo,
         (select pg_get_expr(polqual, polrelid)
          from pg_policy where polrelid = p.tabla::regclass and polname = p.nombre) as expr
  from pol p
)
select tabla, nombre,
  case
    when expr is null then '>>> FALTA la política'
    when minimo = 0 then 'OK'
    when (length(expr) - length(replace(expr, '''entregada_trabajador''', ''))) = 0
      then '>>> REVISAR: no cubre entregada_trabajador'
    when expr like '%reunion_realizada%' and expr like '%pendiente_firmas%' then 'OK'
    else '>>> REVISAR: le faltan estados del medio del flujo'
  end as estado
from def
order by estado asc, tabla;

-- ----------------------------------------------------------------------------
-- Recarga de la caché de esquema de la API. Es inofensivo correrlo siempre:
-- si el error era solo de caché, esto lo resuelve.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
