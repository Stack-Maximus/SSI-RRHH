-- ============================================================================
-- Permisos que necesita el módulo de Trabajadores: un admin global puede
-- gestionar los accesos de CUALQUIER módulo (antes solo existía ese
-- permiso acotado a Proveedores/comité), y editar el perfil de cualquier
-- persona (antes solo podías editar el tuyo propio).
-- ============================================================================

create policy "admin_gestiona_todos_los_accesos" on modulo_accesos
  for all to authenticated
  using (es_admin())
  with check (es_admin());

create policy "admin_actualiza_cualquier_perfil" on perfiles
  for update to authenticated
  using (es_admin())
  with check (es_admin());
