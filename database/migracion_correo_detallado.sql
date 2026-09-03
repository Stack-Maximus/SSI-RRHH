-- ============================================================================
-- Agrega un campo de detalle en HTML para los correos — la campanita sigue
-- mostrando el mensaje corto (`mensaje`), pero el correo, si existe
-- `detalle_html`, lo usa en vez del mensaje corto, con todo el contexto.
-- ============================================================================

alter table notificaciones add column if not exists detalle_html text;

-- El trigger de envío de correo ahora también manda el detalle a la función
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
    body := jsonb_build_object('to', v_email, 'titulo', new.titulo, 'mensaje', new.mensaje, 'detalle_html', new.detalle_html)
  );

  return new;
end;
$$;

-- La notificación de acción de NC ahora construye ese detalle completo:
-- folio, obra, severidad, descripción, contención, causa raíz, y los datos
-- de la acción asignada — todo sin que el responsable tenga que entrar.
create or replace function trigger_notificar_accion_nc_asignada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nc nc_registro;
  v_detalle text;
begin
  if new.responsable_id is not null then
    select * into v_nc from nc_registro where id = new.nc_id;

    v_detalle :=
      '<p><strong>Folio:</strong> ' || coalesce(v_nc.folio, '—') || '</p>' ||
      '<p><strong>Obra / proceso:</strong> ' || coalesce(v_nc.obra_proceso, '—') || '</p>' ||
      '<p><strong>Severidad:</strong> ' || coalesce(v_nc.severidad, 'sin clasificar') || '</p>' ||
      '<p><strong>Descripción del hallazgo:</strong><br>' || coalesce(v_nc.descripcion, '—') || '</p>' ||
      case when v_nc.requisito_incumplido is not null then '<p><strong>Requisito incumplido:</strong> ' || v_nc.requisito_incumplido || '</p>' else '' end ||
      case when v_nc.contencion is not null then '<p><strong>Contención ya aplicada:</strong><br>' || v_nc.contencion || '</p>' else '' end ||
      case when v_nc.causa_raiz is not null then '<p><strong>Causa raíz identificada:</strong><br>' || v_nc.causa_raiz || '</p>' else '' end ||
      '<hr style="border:none; border-top:1px solid #eee; margin:16px 0;">' ||
      '<p><strong>Tu acción asignada:</strong><br>' || coalesce(new.accion, '—') || '</p>' ||
      '<p><strong>Tipo:</strong> ' || coalesce(new.tipo, '—') || '</p>' ||
      case when new.plazo is not null then '<p><strong>Plazo:</strong> ' || to_char(new.plazo, 'DD/MM/YYYY') || '</p>' else '' end;

    insert into notificaciones (usuario_id, modulo, titulo, mensaje, detalle_html)
    values (
      new.responsable_id,
      'no_conformidades',
      'Acción de NC asignada — ' || coalesce(v_nc.folio, ''),
      'Se te asignó una acción para la NC ' || coalesce(v_nc.folio, '—') || '. Revisa tu correo para el detalle completo.',
      v_detalle
    );
  end if;
  return new;
end;
$$;
