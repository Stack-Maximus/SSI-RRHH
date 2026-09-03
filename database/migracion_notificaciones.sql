-- ============================================================================
-- Sistema de notificaciones (campanita interna). Funciona sola, sin
-- necesitar el correo real — esa parte es un paso aparte y posterior.
-- ============================================================================

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  modulo modulo_sgc,
  titulo text not null,
  mensaje text,
  leida boolean not null default false,
  creado_en timestamptz not null default now()
);

alter table notificaciones enable row level security;

create policy "notificaciones_select_propias" on notificaciones
  for select to authenticated using (usuario_id = auth.uid());

create policy "notificaciones_update_propias" on notificaciones
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create or replace function notificar_modulo(p_modulo modulo_sgc, p_titulo text, p_mensaje text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notificaciones (usuario_id, modulo, titulo, mensaje)
  select usuario_id, p_modulo, p_titulo, p_mensaje
  from modulo_accesos where modulo = p_modulo;
end;
$$;

create or replace function notificar_rol_en_modulo(p_modulo modulo_sgc, p_rol text, p_titulo text, p_mensaje text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notificaciones (usuario_id, modulo, titulo, mensaje)
  select usuario_id, p_modulo, p_titulo, p_mensaje
  from modulo_accesos where modulo = p_modulo and rol = p_rol;
end;
$$;

create or replace function trigger_notificar_ticket_postventa()
returns trigger language plpgsql as $$
begin
  perform notificar_modulo('postventa', 'Nuevo ticket de postventa',
    new.numero_ticket || ' — ' || new.obra || ' (' || new.severidad || ')');
  return new;
end;
$$;
create trigger on_ticket_postventa_creado
  after insert on pv_tickets
  for each row execute function trigger_notificar_ticket_postventa();

create or replace function trigger_notificar_nc_grave()
returns trigger language plpgsql as $$
begin
  if new.severidad in ('critica', 'mayor') and (old.severidad is distinct from new.severidad or old.estado is distinct from new.estado) then
    perform notificar_modulo('no_conformidades', 'NC ' || new.severidad || ' clasificada',
      new.folio || ' — ' || coalesce(new.obra_proceso, 'sin obra asociada'));
  end if;
  return new;
end;
$$;
create trigger on_nc_clasificada_grave
  after update on nc_registro
  for each row execute function trigger_notificar_nc_grave();

create or replace function trigger_notificar_eva_consolidada()
returns trigger language plpgsql as $$
begin
  if new.estado = 'consolidada' and old.estado is distinct from new.estado then
    perform notificar_rol_en_modulo('personal', 'rrhh', 'Evaluación consolidada',
      'Una evaluación de personal quedó lista para revisión y cierre.');
  end if;
  return new;
end;
$$;
create trigger on_evaluacion_consolidada
  after update on eva_evaluaciones
  for each row execute function trigger_notificar_eva_consolidada();

create or replace function trigger_notificar_alerta_satisfaccion()
returns trigger language plpgsql as $$
begin
  perform notificar_modulo('satisfaccion', 'Alerta de recovery',
    'Obra ' || coalesce(new.obra, '—') || ' — respuesta en rojo, SLA de 48h en curso.');
  return new;
end;
$$;
create trigger on_alerta_satisfaccion_creada
  after insert on sat_alertas
  for each row execute function trigger_notificar_alerta_satisfaccion();

create or replace function trigger_notificar_prov_en_comite()
returns trigger language plpgsql as $$
begin
  if new.estado = 'en_comite' and old.estado is distinct from new.estado then
    perform notificar_rol_en_modulo('proveedores', 'comite', 'Evaluación de proveedor lista',
      'Una evaluación de proveedor consolidó las 6 áreas y espera aprobación del comité.');
  end if;
  return new;
end;
$$;
create trigger on_proveedor_en_comite
  after update on prov_evaluaciones
  for each row execute function trigger_notificar_prov_en_comite();
