-- ============================================================================
-- RPC pública para el formulario de reporte de fallas + RLS de
-- pv_tipologias.
-- ============================================================================

alter table pv_tipologias enable row level security;

drop policy if exists "postventa_lectura_tipologias" on pv_tipologias;
create policy "postventa_lectura_tipologias" on pv_tipologias
  for select to authenticated using (tiene_acceso('postventa'));

create or replace function obtener_info_reporte_postventa(p_token uuid)
returns table (obra text, tipologias jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select o.obra,
    (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nombre', t.nombre) order by t.nombre) from pv_tipologias t)
  from postventa_accesos_obra pa
  join pv_obras o on o.id = pa.obra_id
  where pa.token = p_token and pa.activo;
end;
$$;

grant execute on function obtener_info_reporte_postventa(uuid) to anon;
