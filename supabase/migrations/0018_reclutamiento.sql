-- =====================================================================
-- 0018_reclutamiento.sql
-- Proceso de "Reclutamiento y selección" -- alternativa a iniciar una
-- contratación directo (canal 'recomendacion'): RRHH sube opciones de
-- candidatos (nombre + CV) para una solicitud de ingreso ya aprobada: el
-- SOLICITANTE original las revisa y elige una, o las rechaza. Si elige una,
-- se crea sola la contratación (canal 'reclutamiento_seleccion', mismo
-- flujo de checklist/homologación que ya existe) y RRHH recibe aviso para
-- seguir el proceso. Si rechaza todas, RRHH recibe aviso y puede agregar
-- otra tanda de candidatos sin perder el historial de la anterior.
--
-- Diseño:
--   1. Tabla `reclutamientos`: 1 fila por proceso de reclutamiento
--      (1 solicitud puede tener más de un proceso a la vez si pide varias
--      vacantes -- mismo criterio N:1 que ya usa `contrataciones`).
--      estado: 'esperando_seleccion' | 'candidato_elegido' | 'todos_rechazados'.
--      No guarda un contador de "tanda actual" aparte: se calcula al vuelo
--      con max(tanda) sobre reclutamiento_candidatos (mismo criterio que ya
--      usa homologacion_rechazos con el plazo extendido, ver 0016 -- así no
--      hay un contador que se pueda desincronizar de la auditoría real).
--   2. Tabla `reclutamiento_candidatos`: 1 fila por candidato ofrecido, con
--      su CV (Storage) y su decisión. `tanda` agrupa cada "ronda" de
--      opciones enviadas -- permite reenviar una tanda nueva después de un
--      rechazo total sin perder el historial de la anterior.
--   3. RPC `reclutamiento_agregar_candidatos`: RRHH/admin agregan una tanda
--      (la primera o una nueva tras un rechazo total) -- inserta las filas y
--      deja el proceso en 'esperando_seleccion', todo en una transacción.
--      Rechaza si ya hay un candidato elegido o si la tanda vigente todavía
--      tiene candidatos pendientes (solo puede haber una tanda "abierta" a
--      la vez -- ver comentario en el cuerpo de la función).
--   4. RPC `reclutamiento_decidir_candidato`: el solicitante elige o
--      rechaza un candidato de la tanda vigente. Si elige, crea sola la
--      contratación (mismos datos que hoy completa RRHH a mano en
--      "Iniciar contratación", el resto -- RUT, teléfono, checklist -- se
--      sigue completando después desde Contratación, sin cambios ahí). Si
--      rechaza y ya no queda ningún candidato pendiente en esa tanda, el
--      proceso pasa a 'todos_rechazados'.
--   5. Bucket de Storage 'reclutamiento-cv' (privado) + políticas: RRHH/admin
--      suben: el solicitante solo puede DESCARGAR el CV de un candidato de
--      un proceso que pertenece a una solicitud suya.
--
-- Notificaciones nuevas (Edge Function `notificar`, no en esta migración):
--   'reclutamiento_opciones'         -> avisa al solicitante que hay candidatos para revisar.
--   'reclutamiento_elegido'          -> avisa a RRHH que el solicitante eligió uno.
--   'reclutamiento_todos_rechazados' -> avisa a RRHH que se rechazó toda la tanda.
--
-- Ejecutar después de 0001-0017.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabla `reclutamientos`.
-- ---------------------------------------------------------------------
create table public.reclutamientos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes(id) on delete cascade,
  tipo_trabajador public.tipo_trabajador_contratacion not null,
  estado text not null default 'esperando_seleccion'
    check (estado in ('esperando_seleccion', 'candidato_elegido', 'todos_rechazados')),
  contratacion_id uuid references public.contrataciones(id),
  creado_por uuid not null references public.perfiles(id),
  created_at timestamptz not null default now()
);

create index reclutamientos_solicitud_idx on public.reclutamientos(solicitud_id);
create index reclutamientos_contratacion_idx on public.reclutamientos(contratacion_id);

comment on table public.reclutamientos is
  'Proceso de reclutamiento y selección para una vacante de una solicitud de ingreso aprobada. Puede haber más de uno por solicitud (una vacante cada uno), igual que contrataciones. contratacion_id queda null hasta que el solicitante elige un candidato.';
comment on column public.reclutamientos.estado is
  'esperando_seleccion: hay candidatos pendientes de decisión del solicitante. candidato_elegido: ya se creó la contratación (ver contratacion_id). todos_rechazados: la tanda vigente se rechazó completa -- RRHH puede agregar otra.';

-- ---------------------------------------------------------------------
-- 2) Tabla `reclutamiento_candidatos`.
-- ---------------------------------------------------------------------
create table public.reclutamiento_candidatos (
  id uuid primary key default gen_random_uuid(),
  reclutamiento_id uuid not null references public.reclutamientos(id) on delete cascade,
  tanda integer not null default 1,
  nombres text not null,
  apellido_paterno text not null,
  apellido_materno text,
  cv_storage_path text,
  cv_nombre_archivo text,
  decision text not null default 'pendiente' check (decision in ('pendiente', 'elegido', 'rechazado')),
  decidido_at timestamptz,
  created_at timestamptz not null default now()
);

create index reclutamiento_candidatos_reclutamiento_idx on public.reclutamiento_candidatos(reclutamiento_id);

comment on table public.reclutamiento_candidatos is
  'Candidatos ofrecidos en un proceso de reclutamiento, agrupados por tanda (ronda de envío). decision se resuelve con reclutamiento_decidir_candidato().';

-- ---------------------------------------------------------------------
-- 3) RLS.
-- ---------------------------------------------------------------------
alter table public.reclutamientos enable row level security;
alter table public.reclutamiento_candidatos enable row level security;

-- RRHH/admin gestionan todo (mismo criterio que contrataciones).
drop policy if exists reclutamientos_rrhh_admin on public.reclutamientos;
create policy reclutamientos_rrhh_admin on public.reclutamientos
  for all to authenticated
  using (public.rol_actual() in ('admin', 'rrhh'))
  with check (public.rol_actual() in ('admin', 'rrhh'));

-- El solicitante original ve (de solo lectura) los procesos de sus propias solicitudes.
drop policy if exists reclutamientos_solicitante_select on public.reclutamientos;
create policy reclutamientos_solicitante_select on public.reclutamientos
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitudes s
      where s.id = reclutamientos.solicitud_id and s.solicitante_id = auth.uid()
    )
  );

drop policy if exists reclutamiento_candidatos_rrhh_admin on public.reclutamiento_candidatos;
create policy reclutamiento_candidatos_rrhh_admin on public.reclutamiento_candidatos
  for all to authenticated
  using (public.rol_actual() in ('admin', 'rrhh'))
  with check (public.rol_actual() in ('admin', 'rrhh'));

-- El solicitante solo LEE los candidatos de sus propios procesos -- elegir/
-- rechazar es SIEMPRE vía reclutamiento_decidir_candidato() (SECURITY
-- DEFINER: necesita poder crear la contratación, algo que el solicitante no
-- tiene permiso de hacer directo), nunca un UPDATE de este lado.
drop policy if exists reclutamiento_candidatos_solicitante_select on public.reclutamiento_candidatos;
create policy reclutamiento_candidatos_solicitante_select on public.reclutamiento_candidatos
  for select to authenticated
  using (
    exists (
      select 1
      from public.reclutamientos r
      join public.solicitudes s on s.id = r.solicitud_id
      where r.id = reclutamiento_candidatos.reclutamiento_id and s.solicitante_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.reclutamientos to authenticated;
grant select, insert, update, delete on public.reclutamiento_candidatos to authenticated;

-- ---------------------------------------------------------------------
-- 4) RPC: agrega una tanda de candidatos (la primera o una nueva tras un
--    rechazo total). p_candidatos es un array JSON de objetos:
--    [{nombres, apellido_paterno, apellido_materno, cv_storage_path, cv_nombre_archivo}, ...]
--    (los archivos ya se subieron a Storage antes de llamar acá -- mismo
--    orden que subirDocumentoContratacion: subir primero, registrar después).
-- ---------------------------------------------------------------------
create or replace function public.reclutamiento_agregar_candidatos(
  p_reclutamiento_id uuid,
  p_candidatos jsonb
)
returns setof public.reclutamiento_candidatos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol public.user_role;
  v_tanda integer;
  v_item jsonb;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol not in ('admin', 'rrhh') then
    raise exception 'Solo RRHH o el administrador pueden agregar candidatos.';
  end if;

  if not exists (select 1 from public.reclutamientos where id = p_reclutamiento_id) then
    raise exception 'El proceso de reclutamiento no existe.';
  end if;

  if jsonb_typeof(p_candidatos) is distinct from 'array' or jsonb_array_length(p_candidatos) = 0 then
    raise exception 'Agrega al menos un candidato.';
  end if;

  -- No se puede agregar una tanda nueva mientras la vigente todavía tenga
  -- candidatos sin decisión, ni si el proceso ya cerró con un elegido --
  -- si no, quedarían dos tandas con pendientes al mismo tiempo y
  -- reclutamiento_decidir_candidato() rechazaría por "tanda anterior" las
  -- decisiones que tome el solicitante sobre la tanda más vieja (el
  -- frontend ya oculta el botón en estos casos, esto es la misma
  -- revalidación server-side que ya usan crear_solicitud/editar_solicitud).
  if exists (
    select 1 from public.reclutamientos where id = p_reclutamiento_id and estado = 'candidato_elegido'
  ) then
    raise exception 'Este proceso ya tiene un candidato elegido.';
  end if;
  if exists (
    select 1 from public.reclutamiento_candidatos
    where reclutamiento_id = p_reclutamiento_id and decision = 'pendiente'
  ) then
    raise exception 'Todavía hay candidatos de la tanda vigente sin decisión -- espera a que el solicitante termine antes de agregar otra tanda.';
  end if;

  select coalesce(max(tanda), 0) + 1 into v_tanda
  from public.reclutamiento_candidatos where reclutamiento_id = p_reclutamiento_id;

  for v_item in select * from jsonb_array_elements(p_candidatos)
  loop
    if coalesce(trim(v_item->>'nombres'), '') = '' or coalesce(trim(v_item->>'apellido_paterno'), '') = '' then
      raise exception 'Cada candidato necesita al menos nombres y apellido paterno.';
    end if;
    insert into public.reclutamiento_candidatos
      (reclutamiento_id, tanda, nombres, apellido_paterno, apellido_materno, cv_storage_path, cv_nombre_archivo)
    values (
      p_reclutamiento_id, v_tanda,
      trim(v_item->>'nombres'), trim(v_item->>'apellido_paterno'), nullif(trim(v_item->>'apellido_materno'), ''),
      v_item->>'cv_storage_path', v_item->>'cv_nombre_archivo'
    );
  end loop;

  update public.reclutamientos set estado = 'esperando_seleccion' where id = p_reclutamiento_id;

  return query select * from public.reclutamiento_candidatos
    where reclutamiento_id = p_reclutamiento_id and tanda = v_tanda;
end;
$$;

grant execute on function public.reclutamiento_agregar_candidatos(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5) RPC: el solicitante elige o rechaza un candidato de la tanda vigente.
-- ---------------------------------------------------------------------
create or replace function public.reclutamiento_decidir_candidato(
  p_candidato_id uuid,
  p_decision text
)
returns uuid -- id de la contratación creada (solo si p_decision = 'elegido'), null en rechazo
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidato public.reclutamiento_candidatos;
  v_reclutamiento public.reclutamientos;
  v_solicitud public.solicitudes;
  v_tanda_vigente integer;
  v_pendientes integer;
  v_contratacion_id uuid;
begin
  if p_decision not in ('elegido', 'rechazado') then
    raise exception 'Decisión inválida.';
  end if;

  select * into v_candidato from public.reclutamiento_candidatos where id = p_candidato_id for update;
  if v_candidato.id is null then
    raise exception 'El candidato no existe.';
  end if;

  select * into v_reclutamiento from public.reclutamientos where id = v_candidato.reclutamiento_id for update;
  select * into v_solicitud from public.solicitudes where id = v_reclutamiento.solicitud_id;

  if v_solicitud.solicitante_id <> auth.uid() then
    raise exception 'Esta decisión no te corresponde.';
  end if;
  if v_reclutamiento.estado <> 'esperando_seleccion' then
    raise exception 'Este proceso ya no está esperando una selección.';
  end if;

  select max(tanda) into v_tanda_vigente from public.reclutamiento_candidatos where reclutamiento_id = v_reclutamiento.id;
  if v_candidato.tanda <> v_tanda_vigente then
    raise exception 'Este candidato es de una tanda anterior.';
  end if;
  if v_candidato.decision <> 'pendiente' then
    raise exception 'Ya se decidió sobre este candidato.';
  end if;

  if p_decision = 'elegido' then
    update public.reclutamiento_candidatos
      set decision = 'elegido', decidido_at = now()
      where id = p_candidato_id;

    -- El resto de la tanda queda registrada como no elegida (no se les
    -- vuelve a preguntar -- el proceso ya se cerró con este candidato).
    update public.reclutamiento_candidatos
      set decision = 'rechazado', decidido_at = now()
      where reclutamiento_id = v_reclutamiento.id and tanda = v_tanda_vigente
        and id <> p_candidato_id and decision = 'pendiente';

    -- OJO: no se completa acá nombre_candidato (columna NOT NULL original de
    -- 0002) a propósito -- Data.iniciarContratacion() tampoco la completa
    -- desde la UI y ya funciona en producción, así que hay que asumir que
    -- hoy se arma sola en la base (trigger, mismo patrón que
    -- trabajadores.nombre, ver comentario de armar_nombre_trabajador() en
    -- trabajadores.js) a partir de las 3 columnas separadas. Si esta
    -- migración fallara con un error de "null value in column
    -- nombre_candidato", es la señal de que ESE trigger no existe para
    -- contrataciones y hay que completarla acá a mano con concat_ws(...).
    insert into public.contrataciones
      (solicitud_id, nombres_candidato, apellido_paterno_candidato, apellido_materno_candidato,
       canal, tipo_trabajador, creada_por)
    values (
      v_reclutamiento.solicitud_id, v_candidato.nombres, v_candidato.apellido_paterno, v_candidato.apellido_materno,
      'reclutamiento_seleccion', v_reclutamiento.tipo_trabajador, v_reclutamiento.creado_por
    )
    returning id into v_contratacion_id;

    update public.reclutamientos
      set estado = 'candidato_elegido', contratacion_id = v_contratacion_id
      where id = v_reclutamiento.id;

    return v_contratacion_id;
  else
    update public.reclutamiento_candidatos
      set decision = 'rechazado', decidido_at = now()
      where id = p_candidato_id;

    select count(*) into v_pendientes
    from public.reclutamiento_candidatos
    where reclutamiento_id = v_reclutamiento.id and tanda = v_tanda_vigente and decision = 'pendiente';

    if v_pendientes = 0 then
      update public.reclutamientos set estado = 'todos_rechazados' where id = v_reclutamiento.id;
    end if;

    return null;
  end if;
end;
$$;

grant execute on function public.reclutamiento_decidir_candidato(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6) Storage: bucket privado + políticas (mismo patrón que
--    'contratacion-documentos' / 'traslado-documentos').
--    Convención de ruta: {reclutamiento_id}/{timestamp}_{archivo}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reclutamiento-cv', 'reclutamiento-cv', false, 10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword']
)
on conflict (id) do nothing;

create policy storage_reclutamiento_rrhh_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'reclutamiento-cv' and public.rol_actual() in ('admin', 'rrhh'))
  with check (bucket_id = 'reclutamiento-cv' and public.rol_actual() in ('admin', 'rrhh'));

-- El solicitante solo puede DESCARGAR (select) el CV de un candidato de un
-- proceso de una solicitud suya -- nunca subir/borrar.
create policy storage_reclutamiento_solicitante_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reclutamiento-cv'
    and exists (
      select 1
      from public.reclutamiento_candidatos rc
      join public.reclutamientos r on r.id = rc.reclutamiento_id
      join public.solicitudes s on s.id = r.solicitud_id
      where rc.cv_storage_path = storage.objects.name and s.solicitante_id = auth.uid()
    )
  );
