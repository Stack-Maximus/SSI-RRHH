-- ============================================================================
-- Migración: nuevo flujo post-entrega de la Evaluación de Personal,
-- rol Crecimiento y Bienestar, catálogo de planes de acción recomendados,
-- y aviso por correo a RRHH al cerrarse el ciclo.
--
-- Los catálogos y umbrales de aquí NO son inventados: salen de la planilla
-- oficial RRHH-FOR-EVA-AD-001 v1.1 (Hoja 8 «Maestros», Hoja 5 «Resultado»,
-- Hoja 6 «PDI» y Hoja 10 «Checklist de la entrevista one-to-one»).
--
-- Orden nuevo del flujo, después de que RRHH entrega el resultado:
--
--   entregada_trabajador
--     → resultados_aceptados   el evaluado ve sus puntajes y acusa recibo
--     → reunion_agendada       el evaluador fija la 1:1 (≥5 días hábiles)
--     → reunion_realizada      el evaluador la marca como hecha
--     → reflexiones_enviadas   el evaluado responde las 4 preguntas + conformidad
--     → cerrada_conforme | cerrada_disconformidad
--
-- El «aceptar» es acuse de recibo, no conformidad — igual que la declaración
-- de la Hoja 7 de la planilla: «Mi firma no implica necesariamente acuerdo con
-- la calificación; implica que se me comunicaron los resultados».
--
-- Es idempotente: se puede correr más de una vez.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Rangos de resultado final — Hoja 8 de la planilla, ahora como tabla
--    editable en vez de estar clavados dentro de la función.
-- ----------------------------------------------------------------------------

create table if not exists eva_rangos (
  id uuid primary key default gen_random_uuid(),
  rango_min numeric not null,
  rango_max numeric not null,
  categoria text not null unique check (categoria = any (array['excepcional','destacado','satisfactorio','por_debajo','critico'])),
  decision_asociada text not null,
  orden integer
);

alter table eva_rangos enable row level security;

drop policy if exists "personal_lee_rangos" on eva_rangos;
create policy "personal_lee_rangos" on eva_rangos
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_rangos" on eva_rangos;
create policy "rrhh_edita_rangos" on eva_rangos
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

-- Siembra sin borrar: si RRHH ya ajustó un rango desde la app, se respeta.
-- Para volver a los valores oficiales hay que borrar la fila y recorrer esto.
insert into eva_rangos (rango_min, rango_max, categoria, decision_asociada, orden) values
  (4.50, 5.00, 'excepcional',    'Reconocimiento + candidato a promoción / bono',          1),
  (4.00, 4.49, 'destacado',      'Reconocimiento formal del equipo',                       2),
  (3.00, 3.99, 'satisfactorio',  'PDI estándar de mejora continua',                        3),
  (2.00, 2.99, 'por_debajo',     'PMD obligatorio + seguimiento mensual 3 meses',          4),
  (1.00, 1.99, 'critico',        'Escalamiento a RRHH-PRO-09 (medidas disciplinarias)',    5)
on conflict (categoria) do nothing;

-- La función pasa a leer la tabla. Deja de ser immutable (ahora depende de
-- datos), así que se recrea como stable.
drop function if exists eva_categoria_y_decision(numeric);
create or replace function eva_categoria_y_decision(p_promedio numeric)
returns table (categoria text, decision_asociada text)
language sql
stable
security definer
set search_path = public
as $$
  select r.categoria, r.decision_asociada
  from eva_rangos r
  where p_promedio between r.rango_min and r.rango_max
  order by r.orden
  limit 1;
$$;

grant execute on function eva_categoria_y_decision(numeric) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Recomendación final — la lista «ListaRecom» de la Hoja 8. Hasta ahora
--    recomendacion_final era texto libre; con esto el evaluador elige de una
--    lista cerrada y los informes se pueden agrupar.
-- ----------------------------------------------------------------------------

create table if not exists eva_recomendaciones (
  codigo text primary key,
  texto text not null,
  orden integer,
  activo boolean not null default true
);

alter table eva_recomendaciones enable row level security;

drop policy if exists "personal_lee_recomendaciones" on eva_recomendaciones;
create policy "personal_lee_recomendaciones" on eva_recomendaciones
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_recomendaciones" on eva_recomendaciones;
create policy "rrhh_edita_recomendaciones" on eva_recomendaciones
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

insert into eva_recomendaciones (codigo, texto, orden) values
  ('continuar',            'Continuar en el cargo',                      1),
  ('promover',             'Promover de cargo',                          2),
  ('aumento_merito',       'Aumento de remuneración por mérito',         3),
  ('capacitacion',         'Capacitación específica',                    4),
  ('cambio_area',          'Cambio de área o función',                   5),
  ('prueba_aprobada',      'Período de prueba aprobado',                 6),
  ('prueba_no_aprobada',   'Período de prueba no aprobado',              7),
  ('pmd',                  'Plan de mejora obligatorio (PMD)',           8),
  ('escalamiento',         'Escalamiento a RRHH-PRO-09',                 9),
  ('desvinculacion',       'Desvinculación (RRHH-PRO-10)',              10)
on conflict (codigo) do update set texto = excluded.texto, orden = excluded.orden;


-- ----------------------------------------------------------------------------
-- 3. Estados nuevos y columnas de la reunión 1:1.
--
--    Los estados viejos se conservan todos: una evaluación ya cerrada no
--    cambia de estado por esta migración.
-- ----------------------------------------------------------------------------

alter table eva_evaluaciones drop constraint if exists eva_evaluaciones_estado_check;
alter table eva_evaluaciones add constraint eva_evaluaciones_estado_check
  check (estado = any (array[
    'asignada',
    'autoevaluacion_en_curso',
    'autoevaluacion_enviada',
    'consolidada',
    'entregada_trabajador',
    'resultados_aceptados',   -- nuevo: el evaluado acusó recibo de sus puntajes
    'reunion_agendada',       -- nuevo: el evaluador fijó la 1:1
    'reunion_realizada',      -- nuevo: la 1:1 ya ocurrió
    'reflexiones_enviadas',   -- nuevo: el evaluado respondió las 4 preguntas
    'cerrada_conforme',
    'cerrada_disconformidad',
    'archivada'
  ]));

-- Acuse de recibo de los resultados (no es conformidad).
alter table eva_evaluaciones add column if not exists fecha_aceptacion_resultados timestamptz;

-- La reunión one-to-one, con los campos que pide la Hoja 10.
alter table eva_evaluaciones add column if not exists reunion_fecha date;
alter table eva_evaluaciones add column if not exists reunion_hora time;
alter table eva_evaluaciones add column if not exists reunion_duracion_min integer default 60;
alter table eva_evaluaciones add column if not exists reunion_modalidad text;
alter table eva_evaluaciones add column if not exists reunion_lugar text;
alter table eva_evaluaciones add column if not exists reunion_agendada_en timestamptz;
alter table eva_evaluaciones add column if not exists reunion_realizada_en timestamptz;
alter table eva_evaluaciones add column if not exists reunion_notas text;

alter table eva_evaluaciones drop constraint if exists eva_reunion_modalidad_check;
alter table eva_evaluaciones add constraint eva_reunion_modalidad_check
  check (reunion_modalidad is null or reunion_modalidad = any (array['presencial','videollamada_teams']));

-- La Hoja 7 de la planilla ofrece tres respuestas («Sí / Parcialmente / No»),
-- no dos. Se amplía el check para no perder el caso intermedio.
alter table eva_evaluaciones drop constraint if exists eva_evaluaciones_acuerdo_trabajador_check;
alter table eva_evaluaciones add constraint eva_evaluaciones_acuerdo_trabajador_check
  check (acuerdo_trabajador is null or acuerdo_trabajador = any (array['conforme','parcialmente','no_conforme']));

-- Recomendación final ligada al catálogo, conservando el texto libre que ya
-- exista en las evaluaciones viejas.
alter table eva_evaluaciones add column if not exists recomendacion_codigo text;
alter table eva_evaluaciones drop constraint if exists eva_recomendacion_codigo_fkey;
alter table eva_evaluaciones add constraint eva_recomendacion_codigo_fkey
  foreign key (recomendacion_codigo) references eva_recomendaciones(codigo);


-- ----------------------------------------------------------------------------
-- 4. Catálogo de planes de acción recomendados.
--
--    Cada acción tipo se asocia a las categorías donde aplica y, opcionalmente,
--    a una dimensión. El sistema le propone al evaluador las del rango obtenido
--    más las de la dimensión más débil; él marca las que aplican y se crean
--    como acciones del PDI. Las redacciones salen de la Hoja 6 de la planilla
--    y de los descriptores de la rúbrica (Hoja 9).
-- ----------------------------------------------------------------------------

create table if not exists eva_planes_catalogo (
  codigo text primary key,
  titulo text not null,
  accion_smart text not null,
  dimension_codigo text references eva_dimensiones(codigo),
  categorias text[] not null,
  responsable_sugerido text,
  recursos_sugeridos text,
  duracion_dias integer default 90,
  orden integer,
  activo boolean not null default true
);

alter table eva_planes_catalogo enable row level security;

drop policy if exists "personal_lee_planes_catalogo" on eva_planes_catalogo;
create policy "personal_lee_planes_catalogo" on eva_planes_catalogo
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_planes_catalogo" on eva_planes_catalogo;
create policy "rrhh_edita_planes_catalogo" on eva_planes_catalogo
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

-- Trazabilidad: qué acción del PDI vino del catálogo y cuál se escribió a mano.
alter table eva_pdi add column if not exists plan_codigo text;
alter table eva_pdi drop constraint if exists eva_pdi_plan_codigo_fkey;
alter table eva_pdi add constraint eva_pdi_plan_codigo_fkey
  foreign key (plan_codigo) references eva_planes_catalogo(codigo);

-- OJO: nada de "delete from" acá. En cuanto una acción del PDI referencia un
-- plan del catálogo, borrarlo viola la FK y la migración deja de ser repetible.
-- Se siembra con on conflict do nothing: los códigos nuevos entran y los que ya
-- existen se dejan como están, incluidas las ediciones que haya hecho RRHH.
insert into eva_planes_catalogo
  (codigo, titulo, accion_smart, dimension_codigo, categorias, responsable_sugerido, recursos_sugeridos, duracion_dias, orden) values

-- --- Por dimensión: Competencias Funcionales del Cargo (TC) ------------------
('TC-ACOMP', 'Acompañamiento técnico quincenal',
 'Acompañamiento técnico quincenal con el supervisor para revisar los procesos clave del cargo. Al cierre, ejecuta de forma autónoma 3 entregables tipo (informes/registros) sin observaciones.',
 'TC', array['por_debajo','critico','satisfactorio'], 'Supervisor directo', '2 h quincenales; manual de procesos del cargo', 90, 10),

('TC-ERP', 'Capacitación formal en ERP Auranet',
 'Capacitación formal en los módulos del ERP Auranet propios del cargo; aprobar la evaluación interna con ≥80% y operar sin soporte en las tareas habituales.',
 'TC', array['por_debajo','critico','satisfactorio'], 'RRHH / TI', 'Cupo en capacitación ERP; tiempo protegido', 90, 11),

('TC-DOC', 'Estandarización del archivo del área',
 'Ordenar y estandarizar el archivo del área (estructura de carpetas, nomenclatura y respaldos). Trazabilidad verificable y respaldos al día en el primer control.',
 'TC', array['por_debajo','critico','satisfactorio'], 'El propio trabajador', 'Estándar de archivo; espacio en servidor/respaldo', 60, 12),

('TC-MENTOR', 'Mentoría a pares nuevos',
 'Actuar como referente funcional del área: acompañar la inducción de al menos 1 persona nueva y documentar 2 procesos clave del cargo para el manual del área.',
 'TC', array['excepcional','destacado'], 'El propio trabajador', 'Tiempo protegido; plantilla de documentación', 120, 13),

-- --- Organización y Cumplimiento (SS) ---------------------------------------
('SS-PLANIF', 'Rutina semanal de planificación',
 'Establecer una rutina semanal de planificación y priorización con reporte de avances al supervisor. Cumplir el 100% de los hitos comprometidos, sin atrasos, durante 3 meses.',
 'SS', array['por_debajo','critico','satisfactorio'], 'El propio trabajador', 'Plantilla de planificación semanal', 90, 20),

('SS-CONTROLES', 'Controles y respaldos preventivos',
 'Implementar controles de verificación y respaldo antes de cada entrega para prevenir errores u omisiones. Meta: cero hallazgos por desorden o falta de respaldo en los controles de seguimiento.',
 'SS', array['por_debajo','critico','satisfactorio'], 'El propio trabajador + supervisor', 'Checklist de control; espacio de respaldo', 90, 21),

('SS-CONFID', 'Refuerzo de confidencialidad y datos personales',
 'Completar la capacitación interna sobre manejo de información sensible (Ley 19.628 / Ley 21.719) y aplicar el protocolo de resguardo en el 100% de los documentos del cargo.',
 'SS', array['por_debajo','critico'], 'RRHH', 'Capacitación interna; protocolo vigente', 60, 22),

-- --- Disciplina Laboral (DL) ------------------------------------------------
('DL-ASIST', 'Compromiso de asistencia y puntualidad',
 'Acuerdo formal de asistencia y puntualidad con seguimiento mensual del registro de marcaje. Meta: cero ausencias injustificadas y cero atrasos durante 3 meses consecutivos.',
 'DL', array['por_debajo','critico'], 'Supervisor directo + RRHH', 'Reporte mensual de asistencia', 90, 30),

('DL-RIOHS', 'Revisión dirigida del Reglamento Interno',
 'Revisar con RRHH los puntos del RIOHS observados en el período y firmar el acta de toma de conocimiento. Sin nuevas observaciones del mismo tipo en el semestre siguiente.',
 'DL', array['por_debajo','critico'], 'RRHH', 'Copia del RIOHS; acta de toma de conocimiento', 45, 31),

-- --- Valores HACER (VH) -----------------------------------------------------
('VH-FEEDBACK', 'Retroalimentación conductual con seguimiento',
 'Definir con la jefatura 2 conductas concretas a corregir, con retroalimentación mensual documentada. Sin nuevos reportes de desviación en el semestre.',
 'VH', array['por_debajo','critico'], 'Supervisor directo', '30 min mensuales de retroalimentación', 90, 40),

('VH-REFERENTE', 'Rol de referente cultural del equipo',
 'Liderar una instancia por trimestre donde se trabajen los valores HACER con el equipo, y ser parte del acompañamiento a personas nuevas del área.',
 'VH', array['excepcional','destacado'], 'El propio trabajador', 'Espacio y tiempo para la instancia', 120, 41),

-- --- Calidad y Mejora (CM) --------------------------------------------------
('CM-CHECKLIST', 'Checklist de control previo a la entrega',
 'Implementar un checklist de control previo a la entrega de informes y registros. Meta: reducir las observaciones/reprocesos a ≤1 por mes, verificado en los controles de seguimiento.',
 'CM', array['por_debajo','critico','satisfactorio'], 'El propio trabajador + supervisor', 'Plantilla de checklist de calidad', 120, 50),

('CM-NC', 'Cierre de las no conformidades pendientes',
 'Cerrar en plazo las no conformidades abiertas a su cargo y documentar la causa raíz de cada una. Meta: cero NC vencidas al segundo control.',
 'CM', array['por_debajo','critico','satisfactorio'], 'El propio trabajador', 'Acceso al módulo de No Conformidades', 90, 51),

('CM-MEJORA', 'Propuesta de mejora implementada',
 'Formular e implementar una mejora medible en el proceso propio del cargo, con el ahorro o la reducción de reproceso cuantificados al cierre.',
 'CM', array['excepcional','destacado','satisfactorio'], 'El propio trabajador', 'Tiempo protegido; apoyo del área de calidad', 120, 52),

-- --- Transversales por categoría, sin dimensión asociada ---------------------
('GEN-PMD', 'Plan de mejora obligatorio (PMD) con seguimiento mensual',
 'Activar el PMD según RRHH-PRO-09, con reuniones de seguimiento mensuales documentadas durante 3 meses y evaluación extraordinaria al cierre del plan.',
 null, array['por_debajo','critico'], 'RRHH + supervisor directo', 'Formato PMD; agenda de seguimiento mensual', 90, 60),

('GEN-ACOMP-RRHH', 'Acompañamiento de RRHH',
 'Incorporar a RRHH al seguimiento del caso: entrevista de acompañamiento al inicio y verificación del avance en cada control del PDI.',
 null, array['critico'], 'RRHH', 'Agenda de RRHH', 90, 61),

('GEN-RECONOCE', 'Reconocimiento formal ante el equipo',
 'Reconocer el desempeño del período en una instancia formal del equipo y registrarlo en el expediente de la persona.',
 null, array['excepcional','destacado'], 'Supervisor directo + RRHH', 'Instancia de equipo ya agendada', 30, 62),

('GEN-PROYECCION', 'Plan de proyección y candidatura a promoción',
 'Levantar el plan de proyección de la persona: cargo objetivo, brechas a cubrir y plazo estimado; presentarlo a RRHH para evaluar promoción o bono.',
 null, array['excepcional'], 'RRHH + gerencia del área', 'Descriptor del cargo objetivo', 120, 63),

('GEN-CAPACITA', 'Capacitación específica del plan anual',
 'Inscribir a la persona en la capacitación pertinente del plan anual de formación y verificar la aprobación con el certificado correspondiente.',
 null, array['satisfactorio','destacado','por_debajo'], 'RRHH', 'Cupo y presupuesto de capacitación', 120, 64)
on conflict (codigo) do nothing;


-- ----------------------------------------------------------------------------
-- 5. Sugeridor de planes.
--
--    Devuelve las acciones del catálogo que aplican a una evaluación: las de la
--    categoría obtenida, marcando aparte las que además apuntan a la dimensión
--    más débil (que es donde conviene poner el esfuerzo). Corre como security
--    definer para que el evaluador pueda usarlo sin depender de sus permisos
--    sobre el catálogo.
-- ----------------------------------------------------------------------------

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
  select e.categoria into v_categoria from eva_evaluaciones e where e.id = p_evaluacion_id;
  if v_categoria is null then
    return;
  end if;

  -- La dimensión con la nota de supervisor más baja. Si hay empate, gana la de
  -- mayor peso: es la que más mueve el total ponderado.
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
    c.codigo,
    c.titulo,
    c.accion_smart,
    c.dimension_codigo,
    dim.nombre,
    c.responsable_sugerido,
    c.recursos_sugeridos,
    c.duracion_dias,
    (c.dimension_codigo is not null and c.dimension_codigo = v_dim_debil) as es_dimension_debil,
    exists (select 1 from eva_pdi p where p.evaluacion_id = p_evaluacion_id and p.plan_codigo = c.codigo) as ya_en_pdi
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
-- 6. Rol «crecimiento_bienestar»: ve el PDI de todo el mundo y registra los
--    controles de seguimiento, pero NO edita las acciones que definió el
--    evaluador. Como RLS no restringe por columna, la escritura va por una
--    función security definer que solo toca los campos de seguimiento.
-- ----------------------------------------------------------------------------

create or replace function es_crecimiento_bienestar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from modulo_accesos
    where usuario_id = auth.uid() and modulo = 'personal' and rol = 'crecimiento_bienestar'
  );
$$;

grant execute on function es_crecimiento_bienestar() to authenticated;

-- Lectura del PDI y del contexto mínimo que necesita para hacer seguimiento.
drop policy if exists "bienestar_lee_pdi" on eva_pdi;
create policy "bienestar_lee_pdi" on eva_pdi
  for select to authenticated
  using (es_crecimiento_bienestar());

drop policy if exists "bienestar_lee_evaluaciones" on eva_evaluaciones;
create policy "bienestar_lee_evaluaciones" on eva_evaluaciones
  for select to authenticated
  using (es_crecimiento_bienestar());

-- Registrar un control de seguimiento y/o mover el estado de la acción.
-- Es lo único que este rol puede escribir sobre el PDI.
create or replace function eva_pdi_registrar_control(
  p_pdi_id uuid,
  p_nro_control integer,
  p_fecha date,
  p_observacion text,
  p_estado_accion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorizado boolean;
begin
  -- Además del rol de bienestar, siguen pudiendo RRHH, el admin y el evaluador
  -- de esa evaluación — el seguimiento no le queda vedado a nadie que ya podía.
  select
    es_admin()
    or es_crecimiento_bienestar()
    or rol_en_modulo('personal') = 'rrhh'
    or exists (
      select 1 from eva_pdi p
      join eva_evaluaciones e on e.id = p.evaluacion_id
      where p.id = p_pdi_id and e.evaluador_id = auth.uid()
    )
  into v_autorizado;

  if not coalesce(v_autorizado, false) then
    raise exception 'No tienes permiso para registrar controles en este PDI';
  end if;

  if p_nro_control not in (1, 2) then
    raise exception 'El número de control debe ser 1 o 2';
  end if;

  if p_estado_accion is not null and p_estado_accion not in ('pendiente','en_curso','completada') then
    raise exception 'Estado de acción no válido: %', p_estado_accion;
  end if;

  if p_nro_control = 1 then
    update eva_pdi set
      control_1_fecha = p_fecha,
      control_1_obs = p_observacion,
      estado_accion = coalesce(p_estado_accion, estado_accion)
    where id = p_pdi_id;
  else
    update eva_pdi set
      control_2_fecha = p_fecha,
      control_2_obs = p_observacion,
      estado_accion = coalesce(p_estado_accion, estado_accion)
    where id = p_pdi_id;
  end if;
end;
$$;

grant execute on function eva_pdi_registrar_control(uuid, integer, date, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Avisos del nuevo flujo. Todos entran por la tabla notificaciones, así que
--    heredan gratis el despacho por correo del trigger ya existente
--    (on_notificacion_creada_enviar_email → Edge Function send-email).
-- ----------------------------------------------------------------------------

create or replace function trigger_notificar_flujo_evaluacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evaluado text;
  v_ciclo text;
  v_detalle text;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  select nombre into v_evaluado from perfiles where id = new.evaluado_id;
  select titulo into v_ciclo from eva_ciclos where id = new.ciclo_id;
  v_evaluado := coalesce(v_evaluado, 'Un trabajador');
  v_ciclo := coalesce(v_ciclo, 'el ciclo en curso');

  -- El evaluado acusó recibo: el evaluador ya puede agendar la 1:1.
  if new.estado = 'resultados_aceptados' then
    insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
    values (
      new.evaluador_id, 'personal',
      'Agenda la reunión 1:1 con ' || v_evaluado,
      v_evaluado || ' ya revisó sus resultados. Corresponde agendar la entrevista para conversarlos.',
      '<p><strong>' || v_evaluado || '</strong> revisó los resultados de su evaluación de ' || v_ciclo ||
      ' y acusó recibo.</p><p>El siguiente paso es agendar la entrevista one-to-one. La pauta ' ||
      'RRHH-INS-EVA-AD-002 pide <strong>al menos 5 días hábiles de anticipación</strong>, 60 minutos y ' ||
      'sala privada o Teams reservado.</p>'
    );
  end if;

  -- Reunión agendada: se le avisa al evaluado con fecha, hora y lugar.
  if new.estado = 'reunion_agendada' then
    v_detalle :=
      '<p>Tu jefatura agendó la entrevista para conversar los resultados de tu evaluación de ' || v_ciclo || '.</p>' ||
      '<p><strong>Fecha:</strong> ' || coalesce(to_char(new.reunion_fecha, 'DD/MM/YYYY'), 'por confirmar') || '<br>' ||
      '<strong>Hora:</strong> ' || coalesce(to_char(new.reunion_hora, 'HH24:MI'), 'por confirmar') || '<br>' ||
      '<strong>Duración:</strong> ' || coalesce(new.reunion_duracion_min, 60) || ' minutos<br>' ||
      '<strong>Modalidad:</strong> ' || coalesce(replace(new.reunion_modalidad, '_', ' '), '—') ||
      case when new.reunion_lugar is not null then '<br><strong>Lugar / enlace:</strong> ' || new.reunion_lugar else '' end ||
      '</p><p>Después de la entrevista se te va a pedir responder unas preguntas de reflexión y si estás ' ||
      'conforme con la calificación.</p>';

    insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
    values (
      new.evaluado_id, 'personal',
      'Reunión 1:1 agendada para el ' || coalesce(to_char(new.reunion_fecha, 'DD/MM/YYYY'), 'una fecha por confirmar'),
      'Tu jefatura agendó la entrevista de tu evaluación. Revisa tu correo para el detalle.',
      v_detalle
    );
  end if;

  -- Reunión realizada: ahora sí le toca responder las reflexiones.
  if new.estado = 'reunion_realizada' then
    insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
    values (
      new.evaluado_id, 'personal',
      'Responde las preguntas de cierre de tu evaluación',
      'Ya se realizó tu entrevista. Ahora puedes responder las preguntas de reflexión y declarar si estás conforme.',
      '<p>Ya se registró tu entrevista de evaluación de ' || v_ciclo || '.</p>' ||
      '<p>El último paso es responder cuatro preguntas de reflexión y declarar si estás conforme con la ' ||
      'calificación. Puedes responder con total libertad: la declaración de conformidad no condiciona nada ' ||
      'de lo ya conversado.</p>'
    );
  end if;

  -- Reflexiones enviadas: el evaluador define el plan de acción.
  if new.estado = 'reflexiones_enviadas' then
    insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
    values (
      new.evaluador_id, 'personal',
      'Define el plan de acción de ' || v_evaluado,
      v_evaluado || ' respondió las preguntas de cierre. El sistema ya tiene planes recomendados según su resultado.',
      '<p><strong>' || v_evaluado || '</strong> respondió las preguntas de cierre de su evaluación de ' || v_ciclo || '.</p>' ||
      '<p>El sistema preparó una lista de acciones recomendadas según la categoría obtenida y la dimensión ' ||
      'más débil. Puedes tomarlas como están, editarlas o escribir las tuyas.</p>'
    );
  end if;

  -- Disconformidad: la Hoja 10 (ítem C.5) pide activar la revisión de RRHH.
  if new.estado = 'cerrada_disconformidad' then
    insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
    select
      ma.usuario_id, 'personal',
      'Evaluación cerrada con disconformidad — ' || v_evaluado,
      v_evaluado || ' declaró no estar conforme con su calificación. Corresponde activar la revisión de RRHH.',
      '<p><strong>' || v_evaluado || '</strong> cerró su evaluación de ' || v_ciclo || ' declarando disconformidad.</p>' ||
      case when new.observaciones_trabajador is not null
        then '<p><strong>Sus observaciones:</strong><br>' || new.observaciones_trabajador || '</p>' else '' end ||
      '<p>Según el ítem C.5 del checklist de la entrevista, corresponde activar la revisión de RRHH y pedirle ' ||
      'al evaluador las evidencias que respaldan la calificación.</p>'
    from modulo_accesos ma
    where ma.modulo = 'personal' and ma.rol = 'rrhh';
  end if;

  return new;
end;
$$;

drop trigger if exists on_flujo_evaluacion on eva_evaluaciones;
create trigger on_flujo_evaluacion
  after update on eva_evaluaciones
  for each row execute function trigger_notificar_flujo_evaluacion();


-- ----------------------------------------------------------------------------
-- 8. Correo a RRHH cuando se cierra la ÚLTIMA evaluación del ciclo.
--
--    No depende de que alguien se acuerde de cerrar el ciclo a mano: en cuanto
--    no queda ninguna evaluación pendiente, sale el resumen. Además deja el
--    ciclo en estado 'cerrado' para que la vista de RRHH lo refleje.
-- ----------------------------------------------------------------------------

create or replace function trigger_notificar_ciclo_completo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pendientes integer;
  v_total integer;
  v_conformes integer;
  v_disconformes integer;
  v_promedio numeric;
  v_ciclo eva_ciclos;
  v_distribucion text := '';
  v_fila record;
begin
  if new.ciclo_id is null then
    return new;
  end if;

  -- ¿Quedan evaluaciones sin cerrar en este ciclo?
  select count(*) into v_pendientes
  from eva_evaluaciones
  where ciclo_id = new.ciclo_id
    and estado not in ('cerrada_conforme','cerrada_disconformidad','archivada');

  if v_pendientes > 0 then
    return new;
  end if;

  select * into v_ciclo from eva_ciclos where id = new.ciclo_id;

  -- Si el ciclo ya estaba cerrado, el aviso ya salió: no se repite.
  if v_ciclo.estado = 'cerrado' then
    return new;
  end if;

  select
    count(*),
    count(*) filter (where estado = 'cerrada_conforme'),
    count(*) filter (where estado = 'cerrada_disconformidad'),
    round(avg(total_sup), 2)
  into v_total, v_conformes, v_disconformes, v_promedio
  from eva_evaluaciones
  where ciclo_id = new.ciclo_id;

  for v_fila in
    select coalesce(categoria, 'sin categoría') as cat, count(*) as n
    from eva_evaluaciones
    where ciclo_id = new.ciclo_id
    group by 1
    order by 2 desc
  loop
    v_distribucion := v_distribucion ||
      '<li>' || replace(v_fila.cat, '_', ' ') || ': <strong>' || v_fila.n || '</strong></li>';
  end loop;

  update eva_ciclos set estado = 'cerrado' where id = new.ciclo_id;

  insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
  select
    p.id, 'personal',
    'Ciclo de evaluación completado — ' || coalesce(v_ciclo.titulo, ''),
    'Se cerraron las ' || v_total || ' evaluaciones de ' || coalesce(v_ciclo.titulo, 'el ciclo') || '. Revisa tu correo para el resumen.',
    '<p>Todas las evaluaciones del ciclo <strong>' || coalesce(v_ciclo.titulo, '') || '</strong> quedaron cerradas.</p>' ||
    '<ul>' ||
      '<li>Evaluaciones del ciclo: <strong>' || v_total || '</strong></li>' ||
      '<li>Cerradas conformes: <strong>' || v_conformes || '</strong></li>' ||
      '<li>Cerradas con disconformidad: <strong>' || v_disconformes || '</strong></li>' ||
      '<li>Promedio del ciclo: <strong>' || coalesce(v_promedio::text, '—') || '</strong> sobre 5,00</li>' ||
    '</ul>' ||
    '<p><strong>Distribución por categoría:</strong></p><ul>' || v_distribucion || '</ul>' ||
    '<p>El ciclo quedó marcado como cerrado. Queda pendiente el seguimiento de los PDI, que ahora ve el rol ' ||
    'de Crecimiento y Bienestar.</p>'
  from perfiles p
  where p.activo and (
    p.es_admin
    or exists (select 1 from modulo_accesos ma where ma.usuario_id = p.id and ma.modulo = 'personal' and ma.rol = 'rrhh')
  );

  return new;
end;
$$;

drop trigger if exists on_ciclo_completo on eva_evaluaciones;
create trigger on_ciclo_completo
  after update on eva_evaluaciones
  for each row execute function trigger_notificar_ciclo_completo();


-- ----------------------------------------------------------------------------
-- 9. Checklist de la entrevista one-to-one — Hoja 10 de la planilla.
--
--    Son los 24 ítems de la pauta RRHH-INS-EVA-AD-002, en tres bloques:
--    lo que hay que tener listo ANTES de la reunión, el guion de 6 etapas
--    DURANTE, y el trámite de cierre DESPUÉS. Hasta ahora vivían en una hoja
--    de Excel que había que archivar a mano; el KPI declarado en la propia
--    planilla es «100% archivados», así que tenerlos en el sistema es
--    justamente el punto.
--
--    El evaluador los va marcando en la etapa que corresponde:
--      antes    → al agendar la reunión
--      durante  → al marcarla como realizada
--      después  → al definir el plan de acción y cerrar
-- ----------------------------------------------------------------------------

create table if not exists eva_checklist_items (
  codigo text primary key,
  bloque text not null check (bloque = any (array['antes','durante','despues'])),
  orden integer not null,
  texto text not null,
  activo boolean not null default true
);

alter table eva_checklist_items enable row level security;

drop policy if exists "personal_lee_checklist_items" on eva_checklist_items;
create policy "personal_lee_checklist_items" on eva_checklist_items
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_checklist_items" on eva_checklist_items;
create policy "rrhh_edita_checklist_items" on eva_checklist_items
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

-- Igual que el catálogo de planes: sin delete, porque eva_checklist_respuestas
-- referencia estos códigos.
insert into eva_checklist_items (codigo, bloque, orden, texto) values
  ('A1', 'antes', 1, 'Entrevista agendada con ≥ 5 días hábiles, 60 min, sala privada o Teams reservado'),
  ('A2', 'antes', 2, 'Match de la Hoja 5 estudiado: total, categoría, brechas por dimensión y por criterio'),
  ('A3', 'antes', 3, 'Criterios con |brecha| ≥ 2 y dimensiones con discrepancia significativa marcados'),
  ('A4', 'antes', 4, 'Evidencias concretas reunidas (2–3 por nota ≤ 2 y por discrepancia)'),
  ('A5', 'antes', 5, 'Reflexión libre de la autoevaluación (Hoja 4) leída; coincidencias y sorpresas anotadas'),
  ('A6', 'antes', 6, 'Contexto revisado: capacitaciones, incidentes, reconocimientos (Hoja 2-D) y PDI anterior'),
  ('A7', 'antes', 7, 'Borrador de PDI preparado (3–5 acciones SMART propuestas, con oferta real de capacitación)'),
  ('A8', 'antes', 8, 'Si la categoría es Por debajo o Crítico: coordinado con RRHH (acompañamiento / PMD)'),
  ('B1', 'durante', 1, 'E1 · Encuadre hecho: desarrollo, no juicio; estructura y confidencialidad explicadas'),
  ('B2', 'durante', 2, 'E2 · El evaluado habló primero de su autoevaluación (escucha sin corregir)'),
  ('B3', 'durante', 3, 'E3 · Las 5 dimensiones revisadas en orden (TC·SS·DL·VH·CM), partiendo por fortalezas'),
  ('B4', 'durante', 4, 'E3 · Toda nota ≤ 2 explicada con evidencia SBI (situación–comportamiento–impacto)'),
  ('B5', 'durante', 5, 'E3 · Toda discrepancia significativa abordada preguntando primero la visión del evaluado'),
  ('B6', 'durante', 6, 'E4 · Total ponderado, categoría y decisión asociada comunicados con claridad'),
  ('B7', 'durante', 7, 'E5 · PDI co-construido (3–8 acciones SMART con responsables, recursos, fechas y 2 controles) y leído en voz alta'),
  ('B8', 'durante', 8, 'E6 · Próximos pasos explicados: PDF, cuestionario de conformidad (sin presiones), controles del PDI'),
  ('B9', 'durante', 9, 'E6 · Pregunta de cierre hecha y trabajo del período agradecido'),
  ('C1', 'despues', 1, 'Fecha de entrevista y PDI final registrados (mismo día)'),
  ('C2', 'despues', 2, 'Recomendación final y justificación registradas (Hoja 7)'),
  ('C3', 'despues', 3, 'PDF generado y enviado al trabajador (≤ 2 días hábiles)'),
  ('C4', 'despues', 4, 'Cuestionario de conformidad respondido por el evaluado (seguimiento ≤ 5 días hábiles)'),
  ('C5', 'despues', 5, 'Si No conforme: revisión de RRHH activada; evidencias del evaluador aportadas'),
  ('C6', 'despues', 6, 'Fechas de los 2 controles del PDI agendadas en el calendario de ambos'),
  ('C7', 'despues', 7, 'Checklist archivado en el expediente de la evaluación')
on conflict (codigo) do nothing;

-- Las respuestas del evaluador, una fila por ítem y evaluación.
create table if not exists eva_checklist_respuestas (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references eva_evaluaciones(id) on delete cascade,
  item_codigo text not null references eva_checklist_items(codigo),
  cumplido text check (cumplido = any (array['si','no','na'])),
  observaciones text,
  registrado_por uuid references perfiles(id),
  registrado_en timestamptz not null default now(),
  unique (evaluacion_id, item_codigo)
);

alter table eva_checklist_respuestas enable row level security;

-- Lo llena el evaluador de esa evaluación; RRHH y el admin lo ven y lo pueden
-- completar. El evaluado NO lo ve: es la pauta de trabajo de su jefatura, no
-- un documento dirigido a él (en la planilla es una hoja del expediente).
drop policy if exists "personal_gestiona_checklist" on eva_checklist_respuestas;
create policy "personal_gestiona_checklist" on eva_checklist_respuestas
  for all to authenticated
  using (
    es_admin()
    or rol_en_modulo('personal') = 'rrhh'
    or exists (select 1 from eva_evaluaciones e where e.id = evaluacion_id and e.evaluador_id = auth.uid())
  )
  with check (
    es_admin()
    or rol_en_modulo('personal') = 'rrhh'
    or exists (select 1 from eva_evaluaciones e where e.id = evaluacion_id and e.evaluador_id = auth.uid())
  );

/**
 * Resumen de cumplimiento, igual que el pie de la Hoja 10: cuántos ítems
 * cumplidos sobre los aplicables (los N/A no cuentan en el denominador) y
 * cuántos quedaron en NO, que son los que hay que regularizar.
 */
create or replace function eva_checklist_resumen(p_evaluacion_id uuid)
returns table (
  bloque text,
  total integer,
  respondidos integer,
  cumplidos integer,
  no_cumplidos integer,
  no_aplica integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.bloque,
    count(*)::integer as total,
    count(r.cumplido)::integer as respondidos,
    count(*) filter (where r.cumplido = 'si')::integer as cumplidos,
    count(*) filter (where r.cumplido = 'no')::integer as no_cumplidos,
    count(*) filter (where r.cumplido = 'na')::integer as no_aplica
  from eva_checklist_items i
  left join eva_checklist_respuestas r
    on r.item_codigo = i.codigo and r.evaluacion_id = p_evaluacion_id
  where i.activo
  group by i.bloque
  order by case i.bloque when 'antes' then 1 when 'durante' then 2 else 3 end;
$$;

grant execute on function eva_checklist_resumen(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 10. Acta de cierre firmada — Hoja 7 de la planilla.
--
--     El cierre formal de la evaluación necesita tres firmas: el trabajador
--     evaluado, su supervisor directo y la Jefatura de RRHH. La firma del
--     trabajador NO significa acuerdo con la calificación: la declaración de la
--     Hoja 7 es explícita en eso, y su texto se guarda literal con cada firma
--     para que dentro de dos años se sepa exactamente qué se firmó.
--
--     Con qué se firma: cada persona entra con su cuenta, escribe su nombre y
--     su RUT y confirma. Queda registrado quién estaba autenticado (usuario_id),
--     cuándo, y el texto de la declaración vigente en ese momento. No es firma
--     electrónica avanzada — es un acuse fehaciente y trazable, que es lo que
--     el procedimiento pide.
--
--     Una vez firmada, la fila no se puede modificar ni borrar: lo impide un
--     trigger, no solo la interfaz.
-- ----------------------------------------------------------------------------

-- La declaración textual de la Hoja 7, versionada. Si RRHH cambia el texto, las
-- firmas viejas conservan el que firmaron.
create table if not exists eva_declaraciones (
  codigo text primary key,
  rol_firmante text not null check (rol_firmante = any (array['trabajador','supervisor','rrhh'])),
  texto text not null,
  vigente boolean not null default true
);

alter table eva_declaraciones enable row level security;

drop policy if exists "personal_lee_declaraciones" on eva_declaraciones;
create policy "personal_lee_declaraciones" on eva_declaraciones
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "rrhh_edita_declaraciones" on eva_declaraciones;
create policy "rrhh_edita_declaraciones" on eva_declaraciones
  for all to authenticated
  using (es_admin() or rol_en_modulo('personal') = 'rrhh')
  with check (es_admin() or rol_en_modulo('personal') = 'rrhh');

insert into eva_declaraciones (codigo, rol_firmante, texto) values
  ('trabajador_v1', 'trabajador',
   'Declaro haber participado de la entrevista de evaluación, haber recibido retroalimentación sobre mi ' ||
   'desempeño y conocer el contenido del Plan de Desarrollo Individual. Mi firma no implica necesariamente ' ||
   'acuerdo con la calificación; implica que se me comunicaron los resultados y que recibí copia.'),
  ('supervisor_v1', 'supervisor',
   'Declaro haber realizado la entrevista de evaluación conforme a la pauta RRHH-INS-EVA-AD-002, haber ' ||
   'comunicado al trabajador el total ponderado, la categoría y la decisión asociada, y haber co-construido ' ||
   'con él el Plan de Desarrollo Individual que consta en este expediente.'),
  ('rrhh_v1', 'rrhh',
   'Como Jefatura de Recursos Humanos doy por cerrada formalmente esta evaluación, habiendo verificado que ' ||
   'el proceso se ajustó al procedimiento vigente, que el expediente está completo y que la recomendación ' ||
   'final se encuentra debidamente justificada.')
on conflict (codigo) do nothing;

-- Las firmas propiamente tales.
create table if not exists eva_firmas (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references eva_evaluaciones(id) on delete cascade,
  rol_firmante text not null check (rol_firmante = any (array['trabajador','supervisor','rrhh'])),
  usuario_id uuid references perfiles(id),
  nombre_declarado text not null,
  rut_declarado text not null,
  declaracion_codigo text references eva_declaraciones(codigo),
  declaracion_texto text not null,
  firmado_en timestamptz not null default now(),
  unique (evaluacion_id, rol_firmante)
);

alter table eva_firmas enable row level security;

-- Cada quien firma lo suyo. Todos los involucrados pueden VER las tres firmas
-- (es un acta, no un secreto), pero nadie puede firmar en nombre de otro.
drop policy if exists "eva_firmas_lectura" on eva_firmas;
create policy "eva_firmas_lectura" on eva_firmas
  for select to authenticated
  using (
    es_admin()
    or rol_en_modulo('personal') = 'rrhh'
    or exists (
      select 1 from eva_evaluaciones e
      where e.id = evaluacion_id and (e.evaluado_id = auth.uid() or e.evaluador_id = auth.uid())
    )
  );

drop policy if exists "eva_firmas_firma_propia" on eva_firmas;
create policy "eva_firmas_firma_propia" on eva_firmas
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and (
      (rol_firmante = 'trabajador' and exists (select 1 from eva_evaluaciones e where e.id = evaluacion_id and e.evaluado_id = auth.uid()))
      or (rol_firmante = 'supervisor' and exists (select 1 from eva_evaluaciones e where e.id = evaluacion_id and e.evaluador_id = auth.uid()))
      or (rol_firmante = 'rrhh' and (es_admin() or rol_en_modulo('personal') = 'rrhh'))
    )
  );

-- Una firma es inmutable: ni el que la puso puede cambiarla o borrarla.
-- Sin esto, "queda como registro firmado" sería una promesa de la interfaz.
create or replace function eva_firmas_inmutables()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Una firma registrada no se puede % — es el registro formal del cierre de la evaluación',
    case tg_op when 'UPDATE' then 'modificar' else 'eliminar' end;
end;
$$;

drop trigger if exists on_eva_firmas_inmutables on eva_firmas;
create trigger on_eva_firmas_inmutables
  before update or delete on eva_firmas
  for each row execute function eva_firmas_inmutables();

-- Estado nuevo: entre "el evaluador definió el plan" y "cerrada" hay que juntar
-- las tres firmas. Se agrega al check conservando todos los anteriores.
alter table eva_evaluaciones drop constraint if exists eva_evaluaciones_estado_check;
alter table eva_evaluaciones add constraint eva_evaluaciones_estado_check
  check (estado = any (array[
    'asignada',
    'autoevaluacion_en_curso',
    'autoevaluacion_enviada',
    'consolidada',
    'entregada_trabajador',
    'resultados_aceptados',
    'reunion_agendada',
    'reunion_realizada',
    'reflexiones_enviadas',
    'pendiente_firmas',        -- nuevo: plan definido, juntando las 3 firmas
    'cerrada_conforme',
    'cerrada_disconformidad',
    'archivada'
  ]));

/**
 * Registra una firma y, si con ella se completan las tres, cierra la evaluación
 * en el estado que corresponda según la conformidad ya declarada.
 *
 * Va por función y no por insert directo para que el cierre sea atómico con la
 * última firma: no puede quedar una evaluación con las tres firmas y sin cerrar,
 * ni cerrada sin las tres firmas.
 */
create or replace function eva_firmar_acta(
  p_evaluacion_id uuid,
  p_rol_firmante text,
  p_nombre text,
  p_rut text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev eva_evaluaciones;
  v_decl eva_declaraciones;
  v_autorizado boolean := false;
  v_firmas integer;
  v_estado_final text;
begin
  select * into v_ev from eva_evaluaciones where id = p_evaluacion_id;
  if v_ev.id is null then
    raise exception 'La evaluación no existe';
  end if;

  if v_ev.estado not in ('pendiente_firmas') then
    raise exception 'Esta evaluación no está en etapa de firmas (estado actual: %)', v_ev.estado;
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_rut), '') = '' then
    raise exception 'La firma necesita nombre y RUT';
  end if;

  -- Quién puede firmar cada rol.
  if p_rol_firmante = 'trabajador' then
    v_autorizado := v_ev.evaluado_id = auth.uid();
  elsif p_rol_firmante = 'supervisor' then
    v_autorizado := v_ev.evaluador_id = auth.uid();
  elsif p_rol_firmante = 'rrhh' then
    v_autorizado := es_admin() or rol_en_modulo('personal') = 'rrhh';
  else
    raise exception 'Rol de firmante no válido: %', p_rol_firmante;
  end if;

  if not coalesce(v_autorizado, false) then
    raise exception 'No te corresponde firmar como %', p_rol_firmante;
  end if;

  -- La firma de RRHH va al final: es el visto bueno del proceso completo.
  if p_rol_firmante = 'rrhh' then
    select count(*) into v_firmas
    from eva_firmas
    where evaluacion_id = p_evaluacion_id and rol_firmante in ('trabajador','supervisor');
    if v_firmas < 2 then
      raise exception 'Faltan las firmas del trabajador y del supervisor antes del visto bueno de RRHH';
    end if;
  end if;

  select * into v_decl
  from eva_declaraciones
  where rol_firmante = p_rol_firmante and vigente
  order by codigo
  limit 1;

  insert into eva_firmas (evaluacion_id, rol_firmante, usuario_id, nombre_declarado, rut_declarado,
                          declaracion_codigo, declaracion_texto)
  values (p_evaluacion_id, p_rol_firmante, auth.uid(), trim(p_nombre), trim(p_rut),
          v_decl.codigo, coalesce(v_decl.texto, '(declaración no configurada)'));

  -- ¿Están las tres? Entonces se cierra.
  select count(*) into v_firmas from eva_firmas where evaluacion_id = p_evaluacion_id;

  if v_firmas >= 3 then
    v_estado_final := case when v_ev.acuerdo_trabajador = 'conforme'
                           then 'cerrada_conforme' else 'cerrada_disconformidad' end;
    update eva_evaluaciones
      set estado = v_estado_final,
          fecha_cierre = current_date
      where id = p_evaluacion_id;
    return jsonb_build_object('firmas', v_firmas, 'cerrada', true, 'estado', v_estado_final);
  end if;

  return jsonb_build_object('firmas', v_firmas, 'cerrada', false);
end;
$$;

grant execute on function eva_firmar_acta(uuid, text, text, text) to authenticated;

-- Avisos de la etapa de firmas.
create or replace function trigger_notificar_firmas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evaluado text;
  v_ciclo text;
begin
  if new.estado is not distinct from old.estado or new.estado <> 'pendiente_firmas' then
    return new;
  end if;

  select nombre into v_evaluado from perfiles where id = new.evaluado_id;
  select titulo into v_ciclo from eva_ciclos where id = new.ciclo_id;
  v_evaluado := coalesce(v_evaluado, 'El trabajador');
  v_ciclo := coalesce(v_ciclo, 'el ciclo');

  -- Al trabajador y a su supervisor, que son los dos primeros en firmar.
  insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
  values (
    new.evaluado_id, 'personal',
    'Firma el acta de cierre de tu evaluación',
    'Tu plan de desarrollo quedó definido. Falta que firmes el acta de cierre.',
    '<p>El plan de desarrollo de tu evaluación de ' || v_ciclo || ' quedó definido.</p>' ||
    '<p>Para cerrar formalmente falta tu firma del acta. <strong>Firmar no significa que estés de acuerdo ' ||
    'con la calificación</strong>: significa que participaste de la entrevista, que recibiste ' ||
    'retroalimentación y que conoces el plan. Tu declaración de conformidad ya quedó registrada aparte.</p>'
  );

  insert into notificaciones (usuario_id, modulo, titulo, mensaje)
  values (
    new.evaluador_id, 'personal',
    'Firma el acta de ' || v_evaluado,
    'Falta tu firma como supervisor directo para cerrar la evaluación de ' || v_evaluado || '.'
  );

  return new;
end;
$$;

drop trigger if exists on_pendiente_firmas on eva_evaluaciones;
create trigger on_pendiente_firmas
  after update on eva_evaluaciones
  for each row execute function trigger_notificar_firmas();

/** Aviso a RRHH cuando ya firmaron trabajador y supervisor y falta su visto bueno. */
create or replace function trigger_notificar_firma_rrhh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firmas integer;
  v_evaluado text;
begin
  select count(*) into v_firmas
  from eva_firmas
  where evaluacion_id = new.evaluacion_id and rol_firmante in ('trabajador','supervisor');

  if v_firmas <> 2 then
    return new;
  end if;

  select p.nombre into v_evaluado
  from eva_evaluaciones e join perfiles p on p.id = e.evaluado_id
  where e.id = new.evaluacion_id;

  insert into notificaciones (usuario_id, modulo, titulo, mensaje)
  select ma.usuario_id, 'personal',
    'Visto bueno pendiente — ' || coalesce(v_evaluado, 'una evaluación'),
    'El trabajador y su supervisor ya firmaron el acta. Falta tu visto bueno para cerrar la evaluación.'
  from modulo_accesos ma
  where ma.modulo = 'personal' and ma.rol = 'rrhh';

  return new;
end;
$$;

drop trigger if exists on_firma_registrada on eva_firmas;
create trigger on_firma_registrada
  after insert on eva_firmas
  for each row execute function trigger_notificar_firma_rrhh();
