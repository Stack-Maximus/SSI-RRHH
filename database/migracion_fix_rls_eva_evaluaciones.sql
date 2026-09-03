-- ============================================================================
-- Corrige: "new row violates row-level security policy for table
-- eva_evaluaciones".
--
-- Causa: el WITH CHECK de la política dejaba actualizar la fila solo al
-- evaluador o a RRHH — nunca se incluyó al evaluado, aunque el flujo real
-- necesita que el propio trabajador actualice su fila al enviar su
-- autoevaluación.
-- ============================================================================

drop policy if exists "personal_acceso_evaluaciones" on eva_evaluaciones;

create policy "personal_acceso_evaluaciones" on eva_evaluaciones
  for all to authenticated
  using (
    tiene_acceso('personal')
    and (rol_en_modulo('personal') = 'rrhh' or evaluado_id = auth.uid() or evaluador_id = auth.uid())
  )
  with check (
    tiene_acceso('personal')
    and (rol_en_modulo('personal') = 'rrhh' or evaluado_id = auth.uid() or evaluador_id = auth.uid())
  );
