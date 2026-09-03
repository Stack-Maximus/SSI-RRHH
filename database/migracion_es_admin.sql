-- ============================================================================
-- Flag de administrador global. Separa "¿qué módulos veo?" (modulo_accesos)
-- de "¿soy admin del sistema?" (perfiles.es_admin).
-- ============================================================================

alter table perfiles add column if not exists es_admin boolean not null default false;

-- Ejemplo para convertir a un usuario en admin global:
-- update perfiles set es_admin = true
-- where id = (select id from auth.users where email = 'tu-correo@metalium.cl');
