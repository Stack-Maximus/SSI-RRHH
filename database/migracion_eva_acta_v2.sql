-- ============================================================================
-- SGC METALIUM · Reconciliación con la v2.0 de la planilla de evaluación
--
-- La migración anterior (migracion_eva_flujo_bienestar.sql) se sembró con la
-- v1.1 de RRHH-FOR-EVA-AD-001, que era la que existía en ese momento. La v2.0
-- cambió tres cosas que sí importan:
--
--   1. El checklist de la entrevista pasó de 24 a 26 ítems, con otra redacción
--      y — esto es lo nuevo — con la marca de qué ítems son OBLIGATORIOS. Sin
--      ellos la entrevista no se considera realizada conforme a la pauta
--      (RRHH-INS-EVA-AD-002).
--
--   2. El acta pasó de tres firmas a CUATRO: se agrega la Jefatura de Bienestar
--      y Crecimiento, que es la que carga las líneas selladas en la DNC del
--      programa anual. Ya no basta el visto bueno de RRHH para cerrar.
--
--   3. Aparece la derivación del expediente como registro: a quién se envió, en
--      qué fecha, cuántas líneas se cargaron en la DNC y con qué acta del
--      Comité se aprobaron.
--
-- Y una cuarta, textual: los criterios VH2, VH3 y VH6 cambiaron de significado.
-- La v1.1 tenía «Adaptabilidad», «Compromiso» y «Trabajo en equipo»; la v2.0
-- los alinea con los valores HACER — Honestidad, Austeridad, Cercanía,
-- Excelencia, Respeto. Eso se corrige en migracion_eva_motor_pdi.sql, que
-- reescribe el texto de los 30 criterios desde la hoja 11 de la v2.0.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Ítems obligatorios del checklist
-- ----------------------------------------------------------------------------

alter table eva_checklist_items add column if not exists obligatorio boolean not null default false;


-- ----------------------------------------------------------------------------
-- 2. El checklist de la v2.0 — 26 ítems en tres bloques
--
--    Los ítems de la v1.1 no se borran: puede haber respuestas que los
--    referencian y el expediente firmado tiene que seguir diciendo lo que se
--    respondió. Se desactivan, y los nuevos entran con códigos propios.
-- ----------------------------------------------------------------------------

update eva_checklist_items set activo = false
where codigo not like 'V2-%';

insert into eva_checklist_items (codigo, bloque, orden, texto, obligatorio, activo) values

-- A · ANTES DE LA REUNIÓN ----------------------------------------------------
('V2-A1', 'antes', 1, 'Entrevista agendada con ≥ 5 días hábiles, en horario protegido y sala privada o Teams con cámara', true, true),
('V2-A2', 'antes', 2, 'Resultado estudiado: total, categoría, brechas y semáforos por dimensión', true, true),
('V2-A3', 'antes', 3, 'Criterios con |brecha| ≥ 2 y dimensiones con discrepancia significativa marcados para abordar', true, true),
('V2-A4', 'antes', 4, 'Evidencias reunidas: 2 a 3 ejemplos concretos por cada nota ≤ 2 y por cada discrepancia', true, true),
('V2-A5', 'antes', 5, 'Reflexión libre de la autoevaluación leída y anotada', true, true),
('V2-A6', 'antes', 6, 'Contexto revisado: capacitaciones, incidentes, reconocimientos y estado del PDI anterior', false, true),
('V2-A7', 'antes', 7, 'Propuesta del motor de PDI revisada: qué gatilló cada curso y qué se propondrá', true, true),
('V2-A8', 'antes', 8, 'Si la categoría es Por debajo o Crítico: coordinación previa con RRHH', true, true),

-- B · DURANTE LA REUNIÓN · guion de 6 etapas, 60 minutos ---------------------
('V2-B1',  'durante',  1, 'E1 · Encuadre hecho: desarrollo, no juicio. No se partió por la nota final', true, true),
('V2-B2',  'durante',  2, 'E2 · El evaluado habló primero de su autoevaluación (regla 70/30) sin ser corregido', true, true),
('V2-B3',  'durante',  3, 'E3 · Las 5 dimensiones revisadas en orden fijo: TC → SS → DL → VH → CM', true, true),
('V2-B4',  'durante',  4, 'E3 · Toda nota ≤ 2 explicada con evidencia y modelo Situación–Comportamiento–Impacto', true, true),
('V2-B5',  'durante',  5, 'E3 · Toda discrepancia significativa abordada preguntando primero «¿cómo lo viste tú?»', true, true),
('V2-B6',  'durante',  6, 'E4 · Total ponderado, categoría y decisión asociada comunicados sin eufemismos', true, true),
('V2-B7',  'durante',  7, 'E5 · Propuesta del motor mostrada en pantalla y revisada línea por línea', true, true),
('V2-B8',  'durante',  8, 'E5 · Cada línea quitada quedó justificada por escrito', true, true),
('V2-B9',  'durante',  9, 'E5 · Lo que el evaluado pidió en E2 quedó incorporado o explicado por qué no', true, true),
('V2-B10', 'durante', 10, 'E5 · PDI final leído en voz alta y aceptado en contenido antes de cerrar', true, true),
('V2-B11', 'durante', 11, 'E5 · Controles intermedios con fechas concretas acordados', false, true),
('V2-B12', 'durante', 12, 'E6 · Explicado el cuestionario de conformidad y el derecho a marcar «No conforme»', true, true),
('V2-B13', 'durante', 13, 'E6 · Pregunta de cierre hecha: «¿cómo te vas de esta conversación?»', false, true),

-- C · DESPUÉS DE LA REUNIÓN --------------------------------------------------
('V2-C1', 'despues', 1, 'PDI sellado el mismo día de la entrevista', true, true),
('V2-C2', 'despues', 2, 'Expediente en PDF enviado al evaluado dentro de 48 horas', true, true),
('V2-C3', 'despues', 3, 'Archivo derivado a RRHH y a Bienestar y Crecimiento', true, true),
('V2-C4', 'despues', 4, 'Líneas del PDI cargadas en la DNC del programa anual', true, true),
('V2-C5', 'despues', 5, 'Controles intermedios agendados en el calendario de ambos', false, true)

on conflict (codigo) do update set
  bloque = excluded.bloque,
  orden = excluded.orden,
  texto = excluded.texto,
  obligatorio = excluded.obligatorio,
  activo = true;


-- ----------------------------------------------------------------------------
-- 3. La cuarta firma: Jefatura de Bienestar y Crecimiento
-- ----------------------------------------------------------------------------

alter table eva_firmas drop constraint if exists eva_firmas_rol_firmante_check;
alter table eva_firmas add constraint eva_firmas_rol_firmante_check
  check (rol_firmante in ('trabajador', 'supervisor', 'rrhh', 'bienestar'));

alter table eva_declaraciones drop constraint if exists eva_declaraciones_rol_firmante_check;
alter table eva_declaraciones add constraint eva_declaraciones_rol_firmante_check
  check (rol_firmante in ('trabajador', 'supervisor', 'rrhh', 'bienestar'));

insert into eva_declaraciones (codigo, rol_firmante, texto, vigente) values
('DECL-BIEN',
 'bienestar',
 'Como Jefatura de Bienestar y Crecimiento recibo el expediente con el PDI sellado y me hago cargo de cargar sus líneas en la DNC del programa anual de capacitación (RRHH-FOR-CAP-11). Recibo qué capacitar, no el detalle del desempeño.',
 true)
on conflict (codigo) do update set
  rol_firmante = excluded.rol_firmante,
  texto = excluded.texto,
  vigente = excluded.vigente;


-- ----------------------------------------------------------------------------
-- 4. Derivación del expediente
--
--    La hoja 08 de la v2.0 la pide como registro, no como trámite informal.
--    Se llena sola cuando firma cada jefatura, salvo el número de acta del
--    Comité, que es dato externo y lo escribe Bienestar y Crecimiento.
-- ----------------------------------------------------------------------------

alter table eva_evaluaciones add column if not exists derivado_rrhh_en timestamptz;
alter table eva_evaluaciones add column if not exists derivado_bienestar_en timestamptz;
alter table eva_evaluaciones add column if not exists lineas_cargadas_dnc integer;
alter table eva_evaluaciones add column if not exists acta_comite text;


-- ----------------------------------------------------------------------------
-- 5. eva_firmar_acta con cuatro firmas
--
--    El orden importa y ahora es explícito:
--
--      trabajador y supervisor  → en cualquier orden
--      RRHH                     → después de esos dos (visto bueno del proceso)
--      Bienestar y Crecimiento  → al final, y es la que cierra
--
--    La razón de que Bienestar vaya última: su firma declara que recibió el
--    expediente para cargarlo en la DNC. Firmar eso antes de que RRHH dé el
--    visto bueno sería recibir algo que todavía puede cambiar.
--
--    La conformidad del trabajador NO es requisito para cerrar. Si marcó «No
--    conforme», el acta se cierra igual con estado de disconformidad y RRHH
--    revisa el caso — así está en la hoja 08: «marcar No conforme es legítimo,
--    exige observaciones y activa la revisión de RRHH sin represalias».
-- ----------------------------------------------------------------------------

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
  v_previas integer;
  v_firmas integer;
  v_estado_final text;
  v_lineas integer;
begin
  select * into v_ev from eva_evaluaciones where id = p_evaluacion_id;
  if v_ev.id is null then
    raise exception 'La evaluación no existe';
  end if;

  if v_ev.estado <> 'pendiente_firmas' then
    raise exception 'Esta evaluación no está en etapa de firmas (estado actual: %)', v_ev.estado;
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_rut), '') = '' then
    raise exception 'La firma necesita nombre y RUT';
  end if;

  -- Sin esto, firmar dos veces devuelve la violación cruda de la clave única y
  -- el usuario ve un mensaje de base de datos en lugar de una explicación.
  if exists (select 1 from eva_firmas
             where evaluacion_id = p_evaluacion_id and rol_firmante = p_rol_firmante) then
    raise exception 'Esa firma ya está puesta en el acta y no se puede repetir';
  end if;

  -- Quién puede firmar cada rol.
  if p_rol_firmante = 'trabajador' then
    v_autorizado := v_ev.evaluado_id = auth.uid();
  elsif p_rol_firmante = 'supervisor' then
    v_autorizado := v_ev.evaluador_id = auth.uid();
  elsif p_rol_firmante = 'rrhh' then
    v_autorizado := es_admin() or rol_en_modulo('personal') = 'rrhh';
  elsif p_rol_firmante = 'bienestar' then
    v_autorizado := es_admin() or rol_en_modulo('personal') = 'crecimiento_bienestar';
  else
    raise exception 'Rol de firmante no válido: %', p_rol_firmante;
  end if;

  if not coalesce(v_autorizado, false) then
    raise exception 'No te corresponde firmar como %', p_rol_firmante;
  end if;

  -- Orden de las firmas.
  if p_rol_firmante = 'rrhh' then
    select count(*) into v_previas from eva_firmas
    where evaluacion_id = p_evaluacion_id and rol_firmante in ('trabajador', 'supervisor');
    if v_previas < 2 then
      raise exception 'Faltan las firmas del trabajador y del supervisor antes del visto bueno de RRHH';
    end if;
  elsif p_rol_firmante = 'bienestar' then
    select count(*) into v_previas from eva_firmas
    where evaluacion_id = p_evaluacion_id and rol_firmante = 'rrhh';
    if v_previas < 1 then
      raise exception 'Bienestar y Crecimiento firma al final: falta el visto bueno de RRHH';
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

  -- Cada jefatura que firma deja la fecha de derivación del expediente.
  if p_rol_firmante = 'rrhh' then
    update eva_evaluaciones set derivado_rrhh_en = now() where id = p_evaluacion_id;
  elsif p_rol_firmante = 'bienestar' then
    select count(*) into v_lineas from eva_pdi where evaluacion_id = p_evaluacion_id;
    update eva_evaluaciones
      set derivado_bienestar_en = now(),
          lineas_cargadas_dnc = v_lineas
      where id = p_evaluacion_id;
  end if;

  -- ¿Están las cuatro? Entonces se cierra.
  select count(*) into v_firmas from eva_firmas where evaluacion_id = p_evaluacion_id;

  if v_firmas >= 4 then
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


-- ----------------------------------------------------------------------------
-- 6. El número de acta del Comité
--
--    Es dato externo: lo aporta Bienestar y Crecimiento cuando el Comité
--    prioriza y asigna fondo. RLS no puede restringir columnas, así que va por
--    una función de alcance estrecho — el mismo patrón que el resto del módulo.
-- ----------------------------------------------------------------------------

create or replace function eva_registrar_acta_comite(
  p_evaluacion_id uuid,
  p_acta text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((es_admin()
          or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar')), false) then
    raise exception 'Sólo RRHH o Bienestar y Crecimiento registran el acta del Comité';
  end if;

  if coalesce(trim(p_acta), '') = '' then
    raise exception 'Falta el número de acta';
  end if;

  update eva_evaluaciones
    set acta_comite = trim(p_acta)
    where id = p_evaluacion_id;

  if not found then
    raise exception 'La evaluación no existe';
  end if;
end;
$$;

grant execute on function eva_registrar_acta_comite(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Cumplimiento del checklist, contando sólo los obligatorios
--
--    La v2.0 dice: «los ítems en rojo son obligatorios: sin ellos la entrevista
--    no se considera realizada conforme a la pauta». Antes el resumen contaba
--    todo por igual, así que un evaluador podía tener 22 de 24 y estar
--    incumpliendo justamente los dos que importaban.
-- ----------------------------------------------------------------------------

-- Cambia la firma de salida (se agregan tres columnas), así que hay que
-- soltarla antes: create or replace no puede cambiar el tipo de retorno.
-- Los nombres de las columnas que ya existían se mantienen tal cual — la vista
-- del checklist los lee por nombre.
drop function if exists eva_checklist_resumen(uuid);

create function eva_checklist_resumen(p_evaluacion_id uuid)
returns table (
  bloque text,
  total integer,
  respondidos integer,
  cumplidos integer,
  no_cumplidos integer,
  no_aplica integer,
  obligatorios integer,
  obligatorios_cumplidos integer,
  conforme_pauta boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.bloque,
    count(*)::integer,
    count(r.cumplido)::integer,
    count(*) filter (where r.cumplido = 'si')::integer,
    count(*) filter (where r.cumplido = 'no')::integer,
    count(*) filter (where r.cumplido = 'na')::integer,
    count(*) filter (where i.obligatorio)::integer,
    count(*) filter (where i.obligatorio and r.cumplido = 'si')::integer,
    -- Conforme a la pauta = todos los obligatorios en «sí». Un «N/A» en un ítem
    -- obligatorio no lo salva: si de verdad no aplica, RRHH le saca la marca de
    -- obligatorio al ítem — no se lo salta el evaluador.
    (count(*) filter (where i.obligatorio and r.cumplido is distinct from 'si') = 0)
  from eva_checklist_items i
  left join eva_checklist_respuestas r
    on r.item_codigo = i.codigo and r.evaluacion_id = p_evaluacion_id
  where i.activo
  group by i.bloque
  order by case i.bloque when 'antes' then 1 when 'durante' then 2 else 3 end;
$$;

grant execute on function eva_checklist_resumen(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. Aviso a Bienestar y Crecimiento cuando le toca firmar
-- ----------------------------------------------------------------------------

create or replace function trigger_notificar_firma_bienestar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evaluado text;
  v_ciclo text;
  v_lineas integer;
begin
  if new.rol_firmante <> 'rrhh' then
    return new;
  end if;

  select p.nombre, c.titulo
    into v_evaluado, v_ciclo
  from eva_evaluaciones e
  join perfiles p on p.id = e.evaluado_id
  left join eva_ciclos c on c.id = e.ciclo_id
  where e.id = new.evaluacion_id;

  select count(*) into v_lineas from eva_pdi where evaluacion_id = new.evaluacion_id;

  insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
  select
    ma.usuario_id,
    'personal',
    'Expediente listo para cargar en la DNC',
    'RRHH ya dio el visto bueno al expediente de ' || coalesce(v_evaluado, 'un trabajador') ||
    coalesce(' (' || v_ciclo || ')', '') || '. Falta tu firma para cerrarlo: son ' || v_lineas ||
    ' línea(s) de PDI que hay que cargar en la DNC del programa anual.',
    '<p>RRHH dio el visto bueno al expediente de <strong>' || coalesce(v_evaluado, 'un trabajador') ||
    '</strong>' || coalesce(' (' || v_ciclo || ')', '') || '.</p>' ||
    '<p>Falta tu firma para cerrarlo. Son <strong>' || v_lineas || ' línea(s) de PDI</strong> que hay ' ||
    'que cargar en la DNC del programa anual (RRHH-FOR-CAP-11).</p>' ||
    '<p>Recibes qué capacitar, no el detalle del desempeño: las notas y los comentarios de la ' ||
    'evaluación no viajan con las líneas.</p>'
  from modulo_accesos ma
  where ma.modulo = 'personal' and ma.rol = 'crecimiento_bienestar';

  return new;
end;
$$;

drop trigger if exists on_firma_rrhh_avisar_bienestar on eva_firmas;
create trigger on_firma_rrhh_avisar_bienestar
  after insert on eva_firmas
  for each row execute function trigger_notificar_firma_bienestar();


notify pgrst, 'reload schema';
