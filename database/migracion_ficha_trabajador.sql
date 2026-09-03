-- ============================================================================
-- Migración: visibilidad para la Ficha del Trabajador
--
-- La ficha (src/views/trabajador-ficha.js) muestra la evolución de una persona
-- en el tiempo: sus evaluaciones ciclo a ciclo, su PDI acumulado y su huella en
-- los otros módulos. Funciona SIN esta migración — cada quien ve lo que RLS ya
-- le permite y las secciones sin permiso avisan "sin visibilidad" en vez de
-- romperse. Esta migración solo abre lo que hoy queda fuera de alcance:
--
--   1. Un admin global (es_admin = true) SIN fila en modulo_accesos para
--      'personal' no puede leer eva_evaluaciones, porque la política exige
--      tiene_acceso('personal') antes de mirar es_admin(). Es justo el caso
--      del administrador del sistema que gestiona Trabajadores pero no
--      participa del ciclo de evaluación: abre la ficha y la ve vacía.
--
--   2. En No Conformidades y Postventa la única condición es tener acceso al
--      módulo. Eso significa que una persona no ve ni sus PROPIAS acciones
--      correctivas ni sus propios tickets si no tiene el módulo asignado —
--      y son datos suyos, que su ficha debería poder mostrarle.
--
-- Es idempotente: se puede correr más de una vez sin efecto adicional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. El admin global entra a Personal aunque no tenga fila en modulo_accesos.
--    es_admin() sale del AND y pasa a ser una alternativa de primer nivel; el
--    resto de la condición queda exactamente igual que antes.
-- ----------------------------------------------------------------------------

drop policy if exists "personal_acceso_evaluaciones" on eva_evaluaciones;

create policy "personal_acceso_evaluaciones" on eva_evaluaciones
  for all to authenticated
  using (
    es_admin()
    or (
      tiene_acceso('personal')
      and (rol_en_modulo('personal') = 'rrhh' or evaluado_id = auth.uid() or evaluador_id = auth.uid())
    )
  )
  with check (
    es_admin()
    or (
      tiene_acceso('personal')
      and (rol_en_modulo('personal') = 'rrhh' or evaluado_id = auth.uid() or evaluador_id = auth.uid())
    )
  );

-- Los ciclos y el catálogo de dimensiones son contexto de lectura de la ficha.
drop policy if exists "personal_acceso_modulo" on eva_ciclos;
create policy "personal_acceso_modulo" on eva_ciclos
  for all to authenticated
  using (es_admin() or tiene_acceso('personal'))
  with check (es_admin() or tiene_acceso('personal'));

drop policy if exists "personal_lectura_catalogos_dim" on eva_dimensiones;
create policy "personal_lectura_catalogos_dim" on eva_dimensiones
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

drop policy if exists "personal_lectura_catalogos_crit" on eva_criterios;
create policy "personal_lectura_catalogos_crit" on eva_criterios
  for select to authenticated
  using (es_admin() or tiene_acceso('personal'));

-- El PDI acumulado que la ficha lista, con el mismo bypass de admin.
drop policy if exists "personal_acceso_pdi" on eva_pdi;
create policy "personal_acceso_pdi" on eva_pdi
  for all to authenticated
  using (
    es_admin()
    or exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and (rol_en_modulo('personal') = 'rrhh' or e.evaluador_id = auth.uid()
           or (e.evaluado_id = auth.uid() and e.estado in
               ('entregada_trabajador','cerrada_conforme','cerrada_disconformidad','archivada')))
    )
  )
  with check (
    es_admin()
    or exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and (rol_en_modulo('personal') = 'rrhh' or e.evaluador_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Huella transversal: el admin ve todo, y cada persona ve lo propio aunque
--    no tenga el módulo asignado. Se agrega SOLO lectura para el caso propio —
--    la escritura sigue exigiendo acceso al módulo, como hasta ahora.
-- ----------------------------------------------------------------------------

-- Postgres no admite "create policy if not exists", así que cada una va con su
-- drop previo — eso es lo que hace la migración repetible.

drop policy if exists "nc_ficha_lee_acciones" on nc_acciones;
create policy "nc_ficha_lee_acciones" on nc_acciones
  for select to authenticated using (es_admin() or responsable_id = auth.uid());

drop policy if exists "nc_ficha_lee_registro" on nc_registro;
create policy "nc_ficha_lee_registro" on nc_registro
  for select to authenticated using (es_admin() or detectada_por = auth.uid());

drop policy if exists "nc_ficha_lee_auditorias" on nc_auditorias;
create policy "nc_ficha_lee_auditorias" on nc_auditorias
  for select to authenticated using (es_admin() or auditor_id = auth.uid());

drop policy if exists "postventa_ficha_lee_tickets" on pv_tickets;
create policy "postventa_ficha_lee_tickets" on pv_tickets
  for select to authenticated using (es_admin() or responsable_id = auth.uid());

-- ============================================================================
-- Nota sobre la política de RRHH:
--
-- Con esto, cualquier persona puede abrir su PROPIA ficha y ver su evolución
-- (el botón "Ver mi evolución" en Evaluación de Personal). Si Metalium prefiere
-- que el trabajador NO vea su serie histórica y solo acceda al resultado del
-- ciclo vigente, la forma de cerrarlo es quitar ese botón en
-- src/views/personal.js — no tocar RLS, porque el trabajador ya podía leer sus
-- propias evaluaciones desde antes de esta ficha.
-- ============================================================================
