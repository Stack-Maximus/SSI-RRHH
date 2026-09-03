-- ============================================================================
-- RLS para el nuevo módulo de Trabajadores.
-- ============================================================================

-- 0. es_admin() todavía no era security definer — si se usa dentro de una
--    política SOBRE perfiles (como la de abajo), causaría la misma
--    recursión infinita que ya corregimos antes para tiene_acceso/rol_en_modulo.
create or replace function es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select es_admin from perfiles where id = auth.uid()), false);
$$;

-- 0b. Mismo motivo: este helper evita que una política SOBRE modulo_accesos
--     tenga que consultar modulo_accesos directamente dentro de sí misma.
create or replace function es_rrhh_personal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from modulo_accesos where usuario_id = auth.uid() and modulo = 'personal' and rol = 'rrhh'
  );
$$;

-- 1. Permite a admin/rrhh actualizar cualquier perfil (nombre, cargo,
--    activo) — hoy perfiles solo se puede actualizar a uno mismo.
create policy "admin_rrhh_gestiona_perfiles" on perfiles
  for update to authenticated
  using (es_admin() or es_rrhh_personal())
  with check (es_admin() or es_rrhh_personal());

-- 2. La política de escritura en modulo_accesos existía solo para el
--    módulo 'proveedores' (del fix de delegados) — se extiende para
--    cualquier módulo, así el panel de Trabajadores puede asignar accesos
--    de los 5 módulos, no solo ese.
drop policy if exists "comite_gestiona_accesos_proveedores" on modulo_accesos;

create policy "admin_rrhh_gestiona_modulo_accesos" on modulo_accesos
  for all to authenticated
  using (
    es_admin()
    or (modulo = 'proveedores' and rol_en_modulo('proveedores') = 'comite')
    or es_rrhh_personal()
  )
  with check (
    es_admin()
    or (modulo = 'proveedores' and rol_en_modulo('proveedores') = 'comite')
    or es_rrhh_personal()
  );
