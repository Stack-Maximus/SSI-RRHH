-- =====================================================================
-- 0016_homologacion_rechazo.sql
-- Rechazo de homologación SST (Prevención), con motivo obligatorio,
-- extensión acumulable del plazo y aviso condicional a RRHH.
--
-- Hasta ahora Homologación SST solo tenía un camino: "Autorizar ingreso a
-- obra". Se agrega el camino contrario -- "Rechazar" -- sin tocar ese flujo
-- existente ni el estado de la contratación/solicitud (sigue pendiente,
-- se puede volver a evaluar después de que se corrija lo que corresponda):
--
--   1. Tabla `homologacion_rechazos`: 1 fila por cada vez que el
--      prevencionista rechaza un caso -- motivo (obligatorio), quién y
--      cuándo. Es polimórfica igual que ya lo es en la práctica el resto
--      de este módulo (contratacion_id para ingreso XOR solicitud_id para
--      traslado, mismo criterio que ya separa contrataciones.homologacion_
--      aprobada_at/_por de solicitudes.homologacion_traslado_aprobada_at/_por,
--      ver 0011 y 0012) -- pero acá conviene 1 sola tabla porque además
--      hay que guardar auditoría (quién/cuándo) y una relación N:M con los
--      documentos marcados, y duplicar eso en 2 tablas hubiera sido más
--      código para el mismo resultado.
--
--   2. Tabla `homologacion_rechazo_documentos`: qué ítems del checklist de
--      homologación (el prevencionista los marca desde los mismos que ya
--      ve como "Documentos para homologación") tienen el problema que
--      motivó el rechazo. Si un rechazo tiene al menos 1 documento
--      marcado, se le avisa también a RRHH (además del solicitante y el
--      Gerente de Prevención, que se avisan siempre) -- lo decide la Edge
--      Function `notificar` consultando esta tabla, no un campo aparte.
--
--   3. La extensión del plazo (+3 días hábiles por cada rechazo,
--      acumulable) NO se guarda en una columna: se calcula en el momento
--      contando filas de `homologacion_rechazos` para ese caso (ver
--      dashboard-prevencion.js). Así no hay un contador que se pueda
--      desincronizar de la auditoría real.
--
--   4. Gerente de Prevención: mismo patrón que Gerente de Operaciones
--      (columna `es_gerente_operaciones`, migración original) -- un
--      booleano en `perfiles`, editable desde "Usuarios". A diferencia de
--      Gerente de Operaciones, no participa de ningún flujo de aprobación
--      (no es aprobador de nada): solo recibe copia de los correos de
--      rechazo de homologación, así que no necesita cargarse en el estado
--      de sesión (src/core/auth.js) -- la Edge Function lo consulta
--      directo contra la base de datos al momento de enviar.
--
-- Ejecutar después de 0001-0015.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Gerente de Prevención (booleano en perfiles, mismo patrón que
--    es_gerente_operaciones).
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists es_gerente_prevencion boolean not null default false;

comment on column public.perfiles.es_gerente_prevencion is
  'Gerente de Prevención: recibe copia por correo de todo rechazo de homologación SST (ingreso o traslado), sea cual sea el centro de costo. No es aprobador de solicitudes -- editable desde "Usuarios".';

-- ---------------------------------------------------------------------
-- 2) Tabla `homologacion_rechazos`.
-- ---------------------------------------------------------------------
create table public.homologacion_rechazos (
  id uuid primary key default gen_random_uuid(),
  contratacion_id uuid references public.contrataciones(id) on delete cascade,
  solicitud_id uuid references public.solicitudes(id) on delete cascade,
  motivo text not null,
  rechazado_por uuid not null references public.perfiles(id),
  created_at timestamptz not null default now(),
  constraint homologacion_rechazos_un_solo_origen check (
    (contratacion_id is not null and solicitud_id is null) or
    (contratacion_id is null and solicitud_id is not null)
  ),
  constraint homologacion_rechazos_motivo_no_vacio check (length(trim(motivo)) > 0)
);

create index homologacion_rechazos_contratacion_idx on public.homologacion_rechazos(contratacion_id);
create index homologacion_rechazos_solicitud_idx on public.homologacion_rechazos(solicitud_id);

comment on table public.homologacion_rechazos is
  'Auditoría de rechazos de homologación SST (ingreso vía contratacion_id XOR traslado vía solicitud_id). No cambia el estado del caso: sigue pendiente y se puede volver a autorizar o rechazar de nuevo más adelante. Cada fila extiende el plazo del caso en 3 días hábiles (se calcula al vuelo, ver dashboard-prevencion.js).';
comment on column public.homologacion_rechazos.motivo is
  'Motivo del rechazo, obligatorio -- lo escribe el prevencionista. Se envía al solicitante original y al Gerente de Prevención; a RRHH solo si además hay documentos marcados en homologacion_rechazo_documentos.';

-- ---------------------------------------------------------------------
-- 3) Tabla `homologacion_rechazo_documentos` (N:M rechazo <-> ítem de
--    checklist marcado como el problema). Si un rechazo tiene al menos 1
--    fila acá, la Edge Function `notificar` copia a RRHH.
-- ---------------------------------------------------------------------
create table public.homologacion_rechazo_documentos (
  id uuid primary key default gen_random_uuid(),
  rechazo_id uuid not null references public.homologacion_rechazos(id) on delete cascade,
  checklist_item_id uuid not null references public.documentos_checklist(id),
  unique (rechazo_id, checklist_item_id)
);

create index homologacion_rechazo_documentos_rechazo_idx on public.homologacion_rechazo_documentos(rechazo_id);

comment on table public.homologacion_rechazo_documentos is
  'Documentos del checklist de homologación que el prevencionista marcó como el problema en un rechazo puntual. Presencia de al menos 1 fila para un rechazo = ese rechazo copia a RRHH por correo.';

-- ---------------------------------------------------------------------
-- 4) RLS -- mismo criterio de seguridad de fila que ya usa el resto del
--    módulo de homologación (0009/0011/0012): el prevencionista solo
--    puede rechazar/ver casos de su(s) centro(s) asignados (origen para
--    ingreso, destino para traslado); admin gestiona todo; rrhh/solicitante
--    no escriben acá, pero rrhh SÍ necesita poder leer (para que la
--    información "aparezca" en Contratación/Solicitudes cuando corresponda).
-- ---------------------------------------------------------------------
alter table public.homologacion_rechazos enable row level security;
alter table public.homologacion_rechazo_documentos enable row level security;

-- El prevencionista rechaza casos de su(s) centro(s), mientras el caso no
-- esté ya autorizado (una vez autorizado, el proceso terminó).
drop policy if exists homologacion_rechazos_prevencionista_insert on public.homologacion_rechazos;
create policy homologacion_rechazos_prevencionista_insert on public.homologacion_rechazos
  for insert to authenticated
  with check (
    rechazado_por = auth.uid()
    and public.rol_actual() = 'prevencionista'
    and (
      (contratacion_id is not null and exists (
        select 1
        from public.contrataciones c
        join public.solicitudes s on s.id = c.solicitud_id
        join public.centros_costo cc on cc.id = s.centro_origen_id
        where c.id = contratacion_id
          and c.estado <> 'anulada'
          and c.homologacion_aprobada_at is null
          and cc.prevencionista_id = auth.uid()
      ))
      or
      (solicitud_id is not null and exists (
        select 1
        from public.solicitudes s
        join public.centros_costo cc on cc.id = s.centro_destino_id
        where s.id = solicitud_id
          and s.tipo = 'traslado'
          and s.estado = 'aprobada'
          and s.homologacion_traslado_aprobada_at is null
          and cc.prevencionista_id = auth.uid()
      ))
    )
  );

-- El prevencionista ve el historial de rechazos de los casos de su(s)
-- centro(s) (sin la restricción de "todavía no autorizado": una vez
-- autorizado, sigue siendo útil ver que antes se había rechazado).
drop policy if exists homologacion_rechazos_prevencionista_select on public.homologacion_rechazos;
create policy homologacion_rechazos_prevencionista_select on public.homologacion_rechazos
  for select to authenticated
  using (
    public.rol_actual() = 'prevencionista'
    and (
      (contratacion_id is not null and exists (
        select 1
        from public.contrataciones c
        join public.solicitudes s on s.id = c.solicitud_id
        join public.centros_costo cc on cc.id = s.centro_origen_id
        where c.id = contratacion_id and cc.prevencionista_id = auth.uid()
      ))
      or
      (solicitud_id is not null and exists (
        select 1
        from public.solicitudes s
        join public.centros_costo cc on cc.id = s.centro_destino_id
        where s.id = solicitud_id and cc.prevencionista_id = auth.uid()
      ))
    )
  );

-- RRHH lee el historial completo (lo necesita para saber si tiene que
-- corregir/reemplazar algún documento) -- de solo lectura, RRHH nunca
-- rechaza una homologación.
drop policy if exists homologacion_rechazos_rrhh_select on public.homologacion_rechazos;
create policy homologacion_rechazos_rrhh_select on public.homologacion_rechazos
  for select to authenticated
  using (public.rol_actual() = 'rrhh');

-- Admin gestiona todo (mismo criterio que el resto del sistema).
drop policy if exists homologacion_rechazos_admin_all on public.homologacion_rechazos;
create policy homologacion_rechazos_admin_all on public.homologacion_rechazos
  for all to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

-- Documentos marcados: solo quien acaba de crear el rechazo (mismo
-- request, insert inmediatamente después del rechazo) puede agregar sus
-- filas -- y solo mientras ese rechazo sea suyo.
drop policy if exists homologacion_rechazo_documentos_insert on public.homologacion_rechazo_documentos;
create policy homologacion_rechazo_documentos_insert on public.homologacion_rechazo_documentos
  for insert to authenticated
  with check (
    public.rol_actual() = 'admin'
    or exists (
      select 1 from public.homologacion_rechazos hr
      where hr.id = rechazo_id and hr.rechazado_por = auth.uid()
    )
  );

-- Lectura: mismo público que homologacion_rechazos (rrhh/admin ven todo;
-- prevencionista solo lo de su(s) centro(s), resuelto acá vía COALESCE
-- porque cada rechazo es de ingreso XOR traslado).
drop policy if exists homologacion_rechazo_documentos_select on public.homologacion_rechazo_documentos;
create policy homologacion_rechazo_documentos_select on public.homologacion_rechazo_documentos
  for select to authenticated
  using (
    public.rol_actual() in ('admin', 'rrhh')
    or (
      public.rol_actual() = 'prevencionista'
      and exists (
        select 1
        from public.homologacion_rechazos hr
        left join public.contrataciones c on c.id = hr.contratacion_id
        left join public.solicitudes sc on sc.id = c.solicitud_id
        left join public.solicitudes st on st.id = hr.solicitud_id
        join public.centros_costo cc on cc.id = coalesce(sc.centro_origen_id, st.centro_destino_id)
        where hr.id = rechazo_id and cc.prevencionista_id = auth.uid()
      )
    )
  );

grant select, insert, update, delete on public.homologacion_rechazos to authenticated;
grant select, insert, update, delete on public.homologacion_rechazo_documentos to authenticated;
