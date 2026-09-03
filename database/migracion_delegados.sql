-- ============================================================================
-- Conecta prov_delegados a los permisos reales de Proveedores (antes la
-- tabla existía pero nadie la consultaba).
-- ============================================================================

alter table prov_delegados add constraint prov_delegados_area_unique unique (area);

create or replace function es_admin()
returns boolean language sql stable as $$
  select coalesce((select es_admin from perfiles where id = auth.uid()), false);
$$;

drop policy if exists "proveedores_delegado_edita_su_area" on prov_detalle;

create policy "proveedores_delegado_edita_su_area" on prov_detalle
  for all to authenticated
  using (
    tiene_acceso('proveedores')
    and (
      rol_en_modulo('proveedores') = 'comite'
      or rol_en_modulo('proveedores') = area
      or exists (
        select 1 from prov_delegados d
        where d.area = prov_detalle.area
          and (d.delegado_id = auth.uid() or d.suplente_id = auth.uid())
      )
    )
  )
  with check (
    tiene_acceso('proveedores')
    and (
      rol_en_modulo('proveedores') = 'comite'
      or rol_en_modulo('proveedores') = area
      or exists (
        select 1 from prov_delegados d
        where d.area = prov_detalle.area
          and (d.delegado_id = auth.uid() or d.suplente_id = auth.uid())
      )
    )
  );

create policy "comite_gestiona_accesos_proveedores" on modulo_accesos
  for all to authenticated
  using (modulo = 'proveedores' and (es_admin() or rol_en_modulo('proveedores') = 'comite'))
  with check (modulo = 'proveedores' and (es_admin() or rol_en_modulo('proveedores') = 'comite'));
