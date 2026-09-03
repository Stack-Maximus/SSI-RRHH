-- ============================================================================
-- Corrige: "new row violates row-level security policy for table
-- encuestas_token" (y el mismo problema, todavía no descubierto, en
-- postventa_accesos_obra).
--
-- Causa: ambas tablas se diseñaron para acceso EXTERNO solo vía RPC —
-- pero el personal INTERNO también necesita crear estos tokens desde el
-- panel (al generar una invitación de encuesta, o al activar una obra),
-- y no había ninguna política que lo permitiera.
--
-- El acceso externo (anon) sigue exactamente igual: sin ningún grant
-- directo, solo a través de las funciones RPC ya existentes.
-- ============================================================================

create policy "modulos_gestionan_tokens_encuesta" on encuestas_token
  for all to authenticated
  using (tiene_acceso(modulo))
  with check (tiene_acceso(modulo));

create policy "postventa_gestiona_accesos_obra" on postventa_accesos_obra
  for all to authenticated
  using (tiene_acceso('postventa'))
  with check (tiene_acceso('postventa'));
