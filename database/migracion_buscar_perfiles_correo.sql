-- ============================================================================
-- RPC para resolver una lista de correos a sus perfiles — necesaria para
-- la importación masiva de evaluaciones (y reutilizable para cualquier
-- otro importador futuro que necesite lo mismo).
-- ============================================================================

create or replace function buscar_perfiles_por_correo(p_correos text[])
returns table (correo text, id uuid, nombre text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select u.email, p.id, p.nombre
  from auth.users u
  join perfiles p on p.id = u.id
  where u.email = any(p_correos) and p.activo;
end;
$$;

grant execute on function buscar_perfiles_por_correo(text[]) to authenticated;
