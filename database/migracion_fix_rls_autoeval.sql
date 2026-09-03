-- ============================================================================
-- Corrige: "new row violates row-level security policy for table
-- eva_detalle_auto".
--
-- Causa: la política exigía estado = 'autoevaluacion_en_curso', pero el
-- frontend nunca transiciona a ese estado — la evaluación queda en
-- 'asignada' desde que se crea hasta que se envía la autoevaluación.
-- ============================================================================

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
  );
