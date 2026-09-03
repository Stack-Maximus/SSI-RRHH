-- ============================================================================
-- SGC METALIUM · El trabajador puede leer su propio expediente
--
-- POR QUÉ HACE FALTA
--
-- Vamos a poner la descarga del Excel de la evaluación en la pantalla del
-- trabajador y en su ficha. Antes de escribir el botón revisé si el trabajador
-- puede leer todo lo que ese Excel necesita, y falta una cosa:
--
--   eva_detalle_sup  (las notas y observaciones de su jefatura)
--       → SÍ las lee, desde 'entregada_trabajador' en adelante.
--
--   eva_detalle_auto (SUS PROPIAS respuestas de autoevaluación)
--       → NO. La única política que las deja leer al evaluado exige que la
--         evaluación esté en 'asignada' o 'autoevaluacion_en_curso'. Una vez
--         enviada la autoevaluación, la persona deja de poder ver lo que ella
--         misma contestó.
--
-- Comprobado en base real: con la evaluación en 'entregada_trabajador', el
-- evaluado veía las 5 notas de su jefe y 0 de sus propias 5 respuestas.
--
-- Sin esto el Excel del trabajador saldría con la columna «Nota Auto» entera en
-- «—» y la brecha sin explicación, SIN dar ningún error: se vería como si nunca
-- se hubiera autoevaluado. Es la clase de falla que nadie reporta porque parece
-- un dato que falta, no un permiso.
--
-- QUÉ HACE
--
-- Una política SOLO DE LECTURA para el evaluado sobre sus propias respuestas,
-- en cualquier estado. No se toca la política existente, que es la que le
-- permite ESCRIBIR mientras la autoevaluación está abierta: eso sigue cerrado
-- una vez enviada. Leer lo que uno mismo contestó no es lo mismo que poder
-- cambiarlo.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================

drop policy if exists "personal_evaluado_lee_su_autoeval" on eva_detalle_auto;

create policy "personal_evaluado_lee_su_autoeval" on eva_detalle_auto
  for select to authenticated
  using (
    exists (
      select 1 from eva_evaluaciones e
      where e.id = evaluacion_id
        and e.evaluado_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- Y una segunda fuga del mismo tipo, en las notas de la jefatura
--
-- La política que deja al evaluado leer eva_detalle_sup lista cuatro estados:
-- 'entregada_trabajador', 'cerrada_conforme', 'cerrada_disconformidad' y
-- 'archivada'. Faltan TODOS los estados del medio. Medido en base real, con la
-- misma evaluación y el mismo usuario, contando lo que ve de sus 5 respuestas y
-- de las 5 notas de su jefe:
--
--   entregada_trabajador   5 / 5
--   resultados_aceptados   5 / 0   ← las pierde
--   reunion_agendada       5 / 0
--   reunion_realizada      5 / 0
--   reflexiones_enviadas   5 / 0
--   pendiente_firmas       5 / 0
--   cerrada_conforme       5 / 5   ← las recupera
--
-- O sea: la persona ve las notas de su jefatura el día que se las entregan, las
-- pierde en cuanto acusa recibo, y las recupera cuando el expediente se cierra.
-- Justo en el tramo donde NO las tiene está la reunión one-to-one, que es la
-- conversación sobre esas notas.
--
-- No es una decisión de diseño: es una lista de estados que quedó corta cuando
-- el flujo creció de 4 estados a 13. Se completa acá.
-- ----------------------------------------------------------------------------

drop policy if exists "personal_evaluado_lee_sup_consolidada" on eva_detalle_sup;

create policy "personal_evaluado_lee_sup_consolidada" on eva_detalle_sup
  for select to authenticated
  using (
    exists (
      select 1 from eva_evaluaciones e
      where e.id = evaluacion_id
        and e.evaluado_id = auth.uid()
        and e.estado in ('entregada_trabajador', 'resultados_aceptados', 'reunion_agendada',
                         'reunion_realizada', 'reflexiones_enviadas', 'pendiente_firmas',
                         'cerrada_conforme', 'cerrada_disconformidad', 'archivada')
    )
  );

-- ----------------------------------------------------------------------------
-- Desde cuándo puede el trabajador descargar su expediente
--
-- Una sola función para que las tres pantallas donde va el botón — el resultado,
-- la ficha y la lista — no repitan la regla cada una por su cuenta. Si mañana
-- cambia el criterio, cambia acá.
--
-- 'consolidada' NO entra a propósito: en ese estado los puntajes ya existen
-- pero RRHH todavía no le ha entregado el resultado a la persona, y el orden
-- del flujo es parte del diseño. RRHH sí puede exportar desde 'consolidada'
-- (eso no cambia): esta regla es sólo para el evaluado.
-- ----------------------------------------------------------------------------

create or replace function eva_expediente_descargable(p_evaluacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      es_admin()
      or rol_en_modulo('personal') = 'rrhh'
      or e.evaluador_id = auth.uid()
      or (e.evaluado_id = auth.uid()
          and e.estado in ('entregada_trabajador', 'resultados_aceptados', 'reunion_agendada',
                           'reunion_realizada', 'reflexiones_enviadas', 'pendiente_firmas',
                           'cerrada_conforme', 'cerrada_disconformidad', 'archivada'))
    from eva_evaluaciones e
    where e.id = p_evaluacion_id
  ), false);
$$;

grant execute on function eva_expediente_descargable(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- El historial de expedientes de una persona, para su ficha
--
-- Devuelve una fila por evaluación con lo justo para pintar la lista y decidir
-- si va el botón de descarga. Ordenado de la más reciente a la más antigua.
--
-- Vale tanto para el trabajador mirando su propia ficha como para RRHH mirando
-- la de otro: la guardia interna es la misma de siempre.
-- ----------------------------------------------------------------------------

create or replace function eva_expedientes_de(p_perfil_id uuid)
returns table (
  evaluacion_id uuid,
  ciclo_titulo text,
  estado text,
  categoria text,
  total_sup numeric,
  evaluador_nombre text,
  fecha_cierre date,
  descargable boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    c.titulo,
    e.estado,
    e.categoria,
    e.total_sup,
    ev.nombre,
    e.fecha_cierre,
    eva_expediente_descargable(e.id)
  from eva_evaluaciones e
  left join eva_ciclos c on c.id = e.ciclo_id
  left join perfiles ev on ev.id = e.evaluador_id
  where e.evaluado_id = p_perfil_id
    and (
      es_admin()
      or rol_en_modulo('personal') = 'rrhh'
      or p_perfil_id = auth.uid()
      or e.evaluador_id = auth.uid()
    )
  order by c.fecha_apertura desc nulls last, e.id desc;
$$;

grant execute on function eva_expedientes_de(uuid) to authenticated;


notify pgrst, 'reload schema';
