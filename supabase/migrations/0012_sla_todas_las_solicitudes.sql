-- =====================================================================
-- 0012_sla_todas_las_solicitudes.sql
-- Extiende el SLA de RRHH (3 días hábiles) a los 6 tipos de solicitud, no
-- solo ingreso. Agrega dos mecanismos de cierre nuevos:
--
--   1. "Marcar como procesado" (aumento_sueldo, bono, cambio_cargo,
--      renovación): no tienen un evento propio que cierre el plazo de
--      RRHH, así que se agrega un cierre manual explícito, con quién y
--      cuándo -- mismo criterio de auditoría que ya usa contrataciones
--      (homologacion_aprobada_at/_por, migración 0011).
--
--   2. Documentos de traslado (Contrato de Trabajo + Anexo de Contrato +
--      Cédula): a diferencia de ingreso, un traslado es de un trabajador
--      YA existente (siempre trae trabajador_id), así que no necesita un
--      "expediente" tipo `contrataciones` con datos de postulante -- los
--      documentos se cuelgan directo de la solicitud. El checklist
--      reutiliza el catálogo `documentos_checklist` ya existente
--      (contrato_trabajo y cedula_ambos_lados ya estaban; se agrega
--      anexo_contrato), pero con su propia tabla de archivos subidos
--      (documentos_traslado) para no tocar el trigger/checklist de
--      ingreso (que filtra por aplica_administrativo/aplica_operativo,
--      un eje que no aplica a traslado).
--
--      El prevencionista que homologa un traslado es el del centro de
--      costo DESTINO (la obra nueva a la que entra el trabajador) --
--      confirmado con RRHH: es el mismo criterio que ya usa ingreso
--      (ahí el único centro de la solicitud ES el destino), a diferencia
--      del resto de las políticas de traslado (aprobación de la
--      solicitud), que consultan tanto origen como destino.
--
-- Ejecutar después de 0001-0011.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Nuevo ítem de checklist: Anexo de Contrato.
--    aplica_administrativo/aplica_operativo = false a propósito: ese eje
--    lo usa el trigger de contratación (ingreso) para decidir qué
--    documentos son obligatorios por tipo de trabajador, y este ítem no
--    participa de ese flujo -- solo lo consume el checklist fijo de
--    traslado (ver más abajo, filtra por código, no por estos flags).
-- ---------------------------------------------------------------------
insert into public.documentos_checklist
  (codigo, nombre, aplica_administrativo, aplica_operativo, obligatorio, requerido_homologacion, orden)
values
  ('anexo_contrato', 'Anexo de Contrato', false, false, false, true, 6)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------
-- 2) Columnas nuevas en `solicitudes`.
--    procesado_rrhh_at/_por: cierre manual de RRHH para aumento_sueldo /
--      bono / cambio_cargo / renovación (los 4 tipos sin evento propio).
--    homologacion_traslado_aprobada_at/_por: equivalente de
--      contrataciones.homologacion_aprobada_at/_por (migración 0011),
--      pero para traslado -- se prefijó "_traslado" porque `solicitudes`
--      es compartida por los 6 tipos y así queda claro que solo aplica
--      a ese tipo (a diferencia de `contrataciones`, que es 100% ingreso).
-- ---------------------------------------------------------------------
alter table public.solicitudes
  add column if not exists procesado_rrhh_at timestamptz,
  add column if not exists procesado_rrhh_por uuid references public.perfiles(id),
  add column if not exists homologacion_traslado_aprobada_at timestamptz,
  add column if not exists homologacion_traslado_aprobada_por uuid references public.perfiles(id);

comment on column public.solicitudes.procesado_rrhh_at is
  'Cierre manual del plazo de RRHH para aumento_sueldo/bono/cambio_cargo/renovación (tipos sin documento o autorización propia). Null mientras siga pendiente.';
comment on column public.solicitudes.procesado_rrhh_por is
  'Quién de RRHH marcó la solicitud como procesada.';
comment on column public.solicitudes.homologacion_traslado_aprobada_at is
  'Momento en que el prevencionista del centro DESTINO autoriza el ingreso a obra de un traslado (fin del plazo de homologación SST). Solo aplica a tipo=traslado.';
comment on column public.solicitudes.homologacion_traslado_aprobada_por is
  'Prevencionista que autorizó el ingreso a obra del traslado.';

-- RLS: rrhh/admin marcan como procesada cualquier solicitud de los 4 tipos
-- genéricos, ya aprobada y todavía sin marcar. Mismo criterio de
-- seguridad de fila (no de columna) que ya documenta 0011: la UI
-- (Data.marcarProcesadoRRHH) solo envía {procesado_rrhh_at,
-- procesado_rrhh_por} en el UPDATE.
drop policy if exists solicitudes_rrhh_marcar_procesado on public.solicitudes;
create policy solicitudes_rrhh_marcar_procesado on public.solicitudes
  for update to authenticated
  using (
    public.rol_actual() in ('admin', 'rrhh')
    and tipo in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion')
    and estado = 'aprobada'
    and procesado_rrhh_at is null
  )
  with check (
    public.rol_actual() in ('admin', 'rrhh')
    and tipo in ('aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion')
  );

-- RLS: el prevencionista del centro DESTINO autoriza el ingreso a obra de
-- traslados aprobados de su(s) centro(s), mientras no esté ya autorizado.
-- Mismo criterio que contrataciones_prevencionista_autorizar (0011), pero
-- consultando centro_destino_id en vez de centro_origen_id.
drop policy if exists solicitudes_prevencionista_autorizar_traslado on public.solicitudes;
create policy solicitudes_prevencionista_autorizar_traslado on public.solicitudes
  for update to authenticated
  using (
    public.rol_actual() = 'prevencionista'
    and tipo = 'traslado'
    and estado = 'aprobada'
    and homologacion_traslado_aprobada_at is null
    and exists (
      select 1 from public.centros_costo cc
      where cc.id = solicitudes.centro_destino_id and cc.prevencionista_id = auth.uid()
    )
  )
  with check (
    public.rol_actual() = 'prevencionista'
    and tipo = 'traslado'
    and exists (
      select 1 from public.centros_costo cc
      where cc.id = solicitudes.centro_destino_id and cc.prevencionista_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 3) Documentos de traslado (Contrato de Trabajo + Anexo de Contrato +
--    Cédula), colgando directo de la solicitud -- no de un "expediente"
--    aparte, porque el trabajador y el centro ya están en la solicitud.
-- ---------------------------------------------------------------------
create table public.documentos_traslado (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes(id) on delete cascade,
  checklist_item_id uuid not null references public.documentos_checklist(id),
  storage_path text not null,
  nombre_archivo text not null,
  tamano_bytes bigint,
  subido_por uuid not null references public.perfiles(id),
  created_at timestamptz not null default now(),
  unique (solicitud_id, checklist_item_id)
);

create index documentos_traslado_solicitud_idx on public.documentos_traslado(solicitud_id);

comment on table public.documentos_traslado is
  'Documentos requeridos para homologar un traslado (Contrato de Trabajo, Anexo de Contrato, Cédula), subidos por RRHH y visibles para el prevencionista del centro destino. Equivalente de documentos_contratacion, pero para traslado.';

alter table public.documentos_traslado enable row level security;

create policy documentos_traslado_rrhh_admin on public.documentos_traslado
  for all to authenticated
  using (public.rol_actual() in ('admin', 'rrhh'))
  with check (public.rol_actual() in ('admin', 'rrhh'));

-- El prevencionista ve los documentos de traslado de las solicitudes cuyo
-- centro DESTINO es el suyo (a diferencia de ingreso/contrataciones, que
-- se mira por centro_origen -- en traslado el destino es la obra nueva).
create policy documentos_traslado_prevencionista_select on public.documentos_traslado
  for select to authenticated
  using (
    public.rol_actual() = 'prevencionista'
    and exists (
      select 1
      from public.solicitudes s
      join public.centros_costo cc on cc.id = s.centro_destino_id
      where s.id = documentos_traslado.solicitud_id and cc.prevencionista_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.documentos_traslado to authenticated;

-- ---------------------------------------------------------------------
-- 4) Storage: bucket privado + políticas (mismo patrón que
--    'contratacion-documentos', migración 0002/0009).
--    Convención de ruta: {solicitud_id}/{checklist_item_id}/{archivo}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'traslado-documentos', 'traslado-documentos', false, 20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword']
)
on conflict (id) do nothing;

create policy storage_traslado_rrhh_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'traslado-documentos' and public.rol_actual() in ('admin', 'rrhh'))
  with check (bucket_id = 'traslado-documentos' and public.rol_actual() in ('admin', 'rrhh'));

create policy storage_traslado_prevencionista_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'traslado-documentos'
    and public.rol_actual() = 'prevencionista'
    and exists (
      select 1
      from public.documentos_traslado doc
      join public.solicitudes s on s.id = doc.solicitud_id
      join public.centros_costo cc on cc.id = s.centro_destino_id
      where doc.storage_path = storage.objects.name and cc.prevencionista_id = auth.uid()
    )
  );
