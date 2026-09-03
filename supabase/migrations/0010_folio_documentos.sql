-- =====================================================================
-- 0010_folio_documentos.sql
-- Folio correlativo por tipo de solicitud, para el comprobante impreso
-- con el diseño y la codificación del Sistema de Gestión de Metalium
-- (el "Código" de cada formulario es fijo y vive en el frontend,
-- src/config.js -> DOCUMENTO_CODIGOS; el "Folio" es el correlativo
-- RRH-XXX-000001, 000002, ... y se genera acá, en la base de datos, para
-- que sea confiable aunque se creen solicitudes desde varios lugares a
-- la vez).
--
-- 100% aditivo: tabla nueva + columna nueva en `solicitudes` + trigger
-- BEFORE INSERT con nombre propio (no toca el trigger/función que ya
-- genera `solicitudes.codigo`; ambos pueden convivir sin problema, cada
-- uno llena una columna distinta).
--
-- Ejecutar después de 0001-0009.
-- =====================================================================

create table if not exists public.folios_correlativos (
  tipo text primary key,
  siguiente integer not null default 1
);

insert into public.folios_correlativos (tipo, siguiente) values
  ('ingreso', 1), ('traslado', 1), ('aumento_sueldo', 1),
  ('bono', 1), ('cambio_cargo', 1), ('renovacion', 1)
on conflict (tipo) do nothing;

alter table public.solicitudes
  add column if not exists folio text;

comment on column public.solicitudes.folio is
  'Folio correlativo del comprobante impreso (ej. RRH-ING-000123), asignado solo. El prefijo depende del tipo -- ver DOCUMENTO_CODIGOS en src/config.js.';

create or replace function public.asignar_folio_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text;
  v_num integer;
begin
  if new.folio is not null then
    return new;
  end if;

  v_prefijo := case new.tipo::text
    when 'ingreso'         then 'RRH-ING-'
    when 'traslado'        then 'RRH-TRA-'
    when 'aumento_sueldo'  then 'RRH-VAR-'
    when 'bono'            then 'RRH-BON-'
    when 'cambio_cargo'    then 'RRH-CAR-'
    when 'renovacion'      then 'RRH-REN-'
    else null
  end;

  if v_prefijo is null then
    return new; -- tipo no contemplado en la codificación (por ahora no debería pasar)
  end if;

  -- upsert + incremento atómico (evita folios repetidos con inserts concurrentes)
  insert into public.folios_correlativos (tipo, siguiente)
    values (new.tipo::text, 2)
    on conflict (tipo) do update set siguiente = folios_correlativos.siguiente + 1
    returning siguiente - 1 into v_num;

  new.folio := v_prefijo || lpad(v_num::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists trg_asignar_folio_solicitud on public.solicitudes;
create trigger trg_asignar_folio_solicitud
  before insert on public.solicitudes
  for each row execute function public.asignar_folio_solicitud();

-- Solo lectura para cualquier autenticado (ya viaja implícito en `solicitudes`
-- vía SOL_FIELDS del frontend); esta tabla auxiliar no necesita RLS propia
-- porque no se consulta directo desde el cliente, solo desde el trigger
-- (SECURITY DEFINER). Se deja igualmente con RLS activada y sin policies
-- de cliente, por seguridad por defecto.
alter table public.folios_correlativos enable row level security;
