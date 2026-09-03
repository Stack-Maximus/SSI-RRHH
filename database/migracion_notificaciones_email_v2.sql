-- ============================================================================
-- Migración: despacho de correo real para las notificaciones, vía la
-- Edge Function send-email (Microsoft Graph).
--
-- Versión corregida: usa una tabla de configuración en vez de
-- ALTER DATABASE ... SET, porque el SQL Editor de Supabase no tiene
-- permiso para modificar parámetros a nivel de base de datos.
-- ============================================================================

create extension if not exists pg_net;

create table if not exists app_config (
  clave text primary key,
  valor text
);

alter table app_config enable row level security;
-- Sin políticas: nadie puede leerla ni escribirla vía la API — solo la
-- función security definer de abajo, que corre con privilegios propios.

insert into app_config (clave, valor) values
  ('edge_function_url', 'https://hscqoyszevpfbpkajezj.supabase.co/functions/v1/send-email'),
  ('edge_function_key', 'sb_publishable_JSmx07_ROKX2LeDimxJelg_LYlXRDvB')
on conflict (clave) do update set valor = excluded.valor;

create or replace function trigger_enviar_email_notificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_edge_url text;
  v_anon_key text;
begin
  select valor into v_edge_url from app_config where clave = 'edge_function_url';
  select valor into v_anon_key from app_config where clave = 'edge_function_key';

  if v_edge_url is null or v_edge_url = '' then
    return new;
  end if;

  select email into v_email from auth.users where id = new.usuario_id;
  if v_email is null then
    return new;
  end if;

  perform net.http_post(
    url := v_edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
    body := jsonb_build_object('to', v_email, 'titulo', new.titulo, 'mensaje', new.mensaje)
  );

  return new;
end;
$$;

drop trigger if exists on_notificacion_creada_enviar_email on notificaciones;
create trigger on_notificacion_creada_enviar_email
  after insert on notificaciones
  for each row execute function trigger_enviar_email_notificacion();
