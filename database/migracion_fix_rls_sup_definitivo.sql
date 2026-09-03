-- ============================================================================
-- Corrige el acceso del evaluador a eva_detalle_sup:
--   1. Ya no exige un estado específico — el evaluador puede ver sus propias
--      calificaciones sin importar en qué estado quedó la evaluación después.
--   2. Agrega es_admin() como bypass explícito, igual que ya hace el
--      frontend — antes solo revisaba rol_en_modulo('personal') = 'rrhh',
--      que es un dato distinto al flag es_admin.
-- ============================================================================

drop policy if exists "personal_evaluador_edita_sup" on eva_detalle_sup;

create policy "personal_evaluador_edita_sup" on eva_detalle_sup
  for all to authenticated
  using (
    exists (select 1 from eva_evaluaciones e where e.id = evaluacion_id and e.evaluador_id = auth.uid())
    or rol_en_modulo('personal') = 'rrhh'
    or es_admin()
  );

-- Mismo bypass, por consistencia, en las otras dos políticas de Personal
-- que dependían solo de rol_en_modulo() sin es_admin() como alternativa.

drop policy if exists "personal_trabajador_edita_autoeval" on eva_detalle_auto;

create policy "personal_trabajador_edita_autoeval" on eva_detalle_auto
  for all to authenticated
  using (
    exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and e.evaluado_id = auth.uid() and e.estado in ('asignada', 'autoevaluacion_en_curso')
    )
    or exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and (rol_en_modulo('personal') = 'rrhh' or e.evaluador_id = auth.uid())
    )
    or es_admin()
  );

drop policy if exists "personal_acceso_evaluaciones" on eva_evaluaciones;

create policy "personal_acceso_evaluaciones" on eva_evaluaciones
  for all to authenticated
  using (
    tiene_acceso('personal')
    and (rol_en_modulo('personal') = 'rrhh' or evaluado_id = auth.uid() or evaluador_id = auth.uid() or es_admin())
  )
  with check (
    tiene_acceso('personal')
    and (rol_en_modulo('personal') = 'rrhh' or evaluado_id = auth.uid() or evaluador_id = auth.uid() or es_admin())
  );
