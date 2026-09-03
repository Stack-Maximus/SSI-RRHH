-- ============================================================================
-- Migración: despacho de correo real para las notificaciones, vía la
-- Edge Function send-email (Microsoft Graph).
--
-- Reemplaza los dos valores de ejemplo antes de correr:
-- ============================================================================

create extension if not exists pg_net;

alter database postgres set app.edge_function_url = 'https://hscqoyszevpfbpkajezj.supabase.co/functions/v1/send-email';
alter database postgres set app.edge_function_key = 'sb_publishable_JSmx07_ROKX2LeDimxJelg_LYlXRDvB';

create or replace function trigger_enviar_email_notificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_edge_url text := current_setting('app.edge_function_url', true);
  v_anon_key text := current_setting('app.edge_function_key', true);
begin
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

create trigger on_notificacion_creada_enviar_email
  after insert on notificaciones
  for each row execute function trigger_enviar_email_notificacion();
