-- =====================================================================
-- 0002_contratacion_sst.sql
-- Módulo de Contratación + acceso SST (homologación) para SSI-RRHH.
--
-- Requiere haber ejecutado antes 0001_contratacion_rol.sql (agrega el
-- rol 'prevencionista' al enum user_role).
--
-- Qué agrega:
--   1. Enums: canal_contratacion, tipo_trabajador_contratacion, estado_contratacion
--   2. Tabla documentos_checklist (catálogo de documentos, sembrado con las
--      listas de administrativo/operativo, editable desde el panel admin)
--   3. Tabla contrataciones (una fila por persona a contratar, colgando de
--      una solicitud de ingreso ya aprobada)
--   4. Tabla documentos_contratacion (archivos subidos, uno por ítem de checklist)
--   5. Función auxiliar rol_actual() (SECURITY DEFINER, evita recursión de RLS)
--   6. Políticas RLS: rrhh/admin gestionan todo; prevencionista solo lee
--      contrataciones y, de los documentos, solo los marcados
--      requerido_homologacion = true.
--   7. Trigger que recalcula contrataciones.estado a 'documentos_completos'
--      cuando ya se subieron todos los documentos obligatorios del checklist
--      que corresponde según tipo_trabajador.
--   8. Bucket de Storage 'contratacion-documentos' + políticas equivalentes.
--
-- No modifica ninguna tabla/función/policy existente de SSI-RRHH.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Enums
-- ---------------------------------------------------------------------
create type public.canal_contratacion as enum ('recomendacion', 'reclutamiento_seleccion');
create type public.tipo_trabajador_contratacion as enum ('administrativo', 'operativo');
create type public.estado_contratacion as enum ('en_proceso', 'documentos_completos', 'contratado', 'anulada');

-- ---------------------------------------------------------------------
-- 2) Catálogo de documentos requeridos (editable desde el panel admin)
-- ---------------------------------------------------------------------
create table public.documentos_checklist (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  aplica_administrativo boolean not null default false,
  aplica_operativo boolean not null default false,
  obligatorio boolean not null default true,
  requerido_homologacion boolean not null default true,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.documentos_checklist is
  'Catálogo de documentos del proceso de contratación. aplica_administrativo / aplica_operativo definen en qué checklist aparece cada documento. requerido_homologacion marca si el prevencionista (SST) necesita verlo.';

insert into public.documentos_checklist
  (codigo, nombre, aplica_administrativo, aplica_operativo, obligatorio, requerido_homologacion, orden) values
  ('cedula_ambos_lados',          'Cédula de identidad por ambos lados ("Vigente", no certificado)', true,  true,  true,  true,  10),
  ('certificado_afp',             'Certificado de afiliación AFP',                                    true,  true,  true,  true,  20),
  ('cotizaciones_afp_12',         'Últimas 12 cotizaciones AFP',                                       true,  true,  true,  false, 30),
  ('afiliacion_prevision',        'Afiliación de Previsión (Fonasa o Isapre)',                         true,  true,  true,  true,  40),
  ('certificado_residencia',      'Certificado de Residencia o comprobante de domicilio',              true,  true,  true,  false, 50),
  ('correo_electronico',          'Correo electrónico',                                                true,  true,  true,  false, 60),
  ('certificado_cuenta_bancaria', 'Certificado de cuenta bancaria o cartola con N° de cuenta',         true,  true,  true,  false, 70),
  ('estado_civil',                'Estado Civil (certificado/declaración)',                            true,  true,  true,  false, 80),
  ('ultimo_finiquito',            'Último finiquito',                                                  true,  true,  true,  false, 90),
  ('certificado_titulo',          'Certificado de Título, según corresponda',                          true,  false, false, true, 100),
  ('calificacion_certificado',    'Calificación o certificado, según el cargo',                        false, true,  false, true, 100),
  ('resolucion_seremi_salud',     'Resolución registro Seremi de Salud, según corresponda',            true,  false, false, true, 110),
  ('carnet_experto_prevencion',   'Carnet de experto en prevención de riesgos, según corresponda',     true,  false, false, true, 120),
  ('licencia_conducir',           'Copia de licencia de conducir, según corresponda',                  true,  false, false, true, 130);

-- ---------------------------------------------------------------------
-- 3) Contrataciones
--    Una fila por persona a contratar. Cuelga de una solicitud de tipo
--    'ingreso' ya aprobada (una solicitud puede pedir más de una vacante,
--    por eso NO es 1:1 -- puede haber varias contrataciones por solicitud).
--    trabajador_id queda null hasta que se marca "Contratado" (ahí se crea
--    o vincula la fila real en `trabajadores`).
-- ---------------------------------------------------------------------
create table public.contrataciones (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes(id),
  trabajador_id uuid references public.trabajadores(id),
  nombre_candidato text not null,
  rut_candidato text,
  telefono_candidato text,
  email_candidato text,
  canal public.canal_contratacion not null,
  tipo_trabajador public.tipo_trabajador_contratacion not null,
  estado public.estado_contratacion not null default 'en_proceso',
  creada_por uuid not null references public.perfiles(id),
  created_at timestamptz not null default now(),
  completada_at timestamptz
);

create index contrataciones_solicitud_idx on public.contrataciones(solicitud_id);
create index contrataciones_estado_idx on public.contrataciones(estado);

comment on table public.contrataciones is
  'Proceso de contratación de una persona puntual, posterior a una solicitud de ingreso aprobada. canal y tipo_trabajador se definen al iniciarla y se pueden editar mientras no esté contratada.';

-- ---------------------------------------------------------------------
-- 4) Documentos subidos por contratación (uno por ítem de checklist)
-- ---------------------------------------------------------------------
create table public.documentos_contratacion (
  id uuid primary key default gen_random_uuid(),
  contratacion_id uuid not null references public.contrataciones(id) on delete cascade,
  checklist_item_id uuid not null references public.documentos_checklist(id),
  storage_path text not null,
  nombre_archivo text not null,
  tamano_bytes bigint,
  subido_por uuid not null references public.perfiles(id),
  created_at timestamptz not null default now(),
  unique (contratacion_id, checklist_item_id)
);

create index documentos_contratacion_contratacion_idx on public.documentos_contratacion(contratacion_id);

-- ---------------------------------------------------------------------
-- 5) Helper de rol (SECURITY DEFINER: lee perfiles sin pasar por RLS,
--    evita recursión al usarlo dentro de las policies de abajo)
-- ---------------------------------------------------------------------
create or replace function public.rol_actual()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------
alter table public.documentos_checklist enable row level security;
alter table public.contrataciones enable row level security;
alter table public.documentos_contratacion enable row level security;

-- Checklist: cualquier autenticado puede leerlo (se usa para armar los
-- formularios); solo admin/rrhh lo editan.
create policy documentos_checklist_select on public.documentos_checklist
  for select to authenticated using (true);

create policy documentos_checklist_write on public.documentos_checklist
  for all to authenticated
  using (public.rol_actual() in ('admin', 'rrhh'))
  with check (public.rol_actual() in ('admin', 'rrhh'));

-- Contrataciones: rrhh/admin gestionan todo; prevencionista solo lee.
create policy contrataciones_rrhh_admin on public.contrataciones
  for all to authenticated
  using (public.rol_actual() in ('admin', 'rrhh'))
  with check (public.rol_actual() in ('admin', 'rrhh'));

create policy contrataciones_prevencionista_select on public.contrataciones
  for select to authenticated
  using (public.rol_actual() = 'prevencionista');

-- Documentos de contratación: rrhh/admin gestionan todo; prevencionista
-- solo ve los documentos cuyo ítem de checklist está marcado como
-- requerido para homologación.
create policy documentos_contratacion_rrhh_admin on public.documentos_contratacion
  for all to authenticated
  using (public.rol_actual() in ('admin', 'rrhh'))
  with check (public.rol_actual() in ('admin', 'rrhh'));

create policy documentos_contratacion_prevencionista_select on public.documentos_contratacion
  for select to authenticated
  using (
    public.rol_actual() = 'prevencionista'
    and exists (
      select 1 from public.documentos_checklist dc
      where dc.id = checklist_item_id and dc.requerido_homologacion = true
    )
  );

grant select, insert, update, delete on public.documentos_checklist to authenticated;
grant select, insert, update, delete on public.contrataciones to authenticated;
grant select, insert, update, delete on public.documentos_contratacion to authenticated;

-- ---------------------------------------------------------------------
-- 7) Trigger: cuando se sube o borra un documento, revisa si ya están
--    todos los documentos OBLIGATORIOS del checklist que corresponde
--    (según tipo_trabajador) y, si es así, pasa el estado de la
--    contratación a 'documentos_completos'. Nunca toca el estado
--    'contratado' ni 'anulada' (esos son manuales).
-- ---------------------------------------------------------------------
create or replace function public.actualizar_estado_contratacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contratacion_id uuid;
  v_tipo public.tipo_trabajador_contratacion;
  v_estado_actual public.estado_contratacion;
  v_faltantes integer;
begin
  v_contratacion_id := coalesce(new.contratacion_id, old.contratacion_id);

  select tipo_trabajador, estado into v_tipo, v_estado_actual
  from public.contrataciones where id = v_contratacion_id;

  if v_estado_actual in ('contratado', 'anulada') then
    return coalesce(new, old);
  end if;

  select count(*) into v_faltantes
  from public.documentos_checklist dc
  where dc.activo = true
    and dc.obligatorio = true
    and (case when v_tipo = 'administrativo' then dc.aplica_administrativo else dc.aplica_operativo end)
    and not exists (
      select 1 from public.documentos_contratacion doc
      where doc.contratacion_id = v_contratacion_id and doc.checklist_item_id = dc.id
    );

  update public.contrataciones
    set estado = case when v_faltantes = 0 then 'documentos_completos'::public.estado_contratacion else 'en_proceso'::public.estado_contratacion end
  where id = v_contratacion_id;

  return coalesce(new, old);
end;
$$;

create trigger trg_actualizar_estado_contratacion
  after insert or delete on public.documentos_contratacion
  for each row execute function public.actualizar_estado_contratacion();

-- ---------------------------------------------------------------------
-- 8) Storage: bucket privado + políticas
--    Convención de ruta: {contratacion_id}/{checklist_codigo}/{archivo}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contratacion-documentos', 'contratacion-documentos', false, 20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword']
)
on conflict (id) do nothing;

create policy storage_contratacion_rrhh_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'contratacion-documentos' and public.rol_actual() in ('admin', 'rrhh'))
  with check (bucket_id = 'contratacion-documentos' and public.rol_actual() in ('admin', 'rrhh'));

create policy storage_contratacion_prevencionista_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contratacion-documentos'
    and public.rol_actual() = 'prevencionista'
    and exists (
      select 1
      from public.documentos_contratacion doc
      join public.documentos_checklist dc on dc.id = doc.checklist_item_id
      where doc.storage_path = storage.objects.name and dc.requerido_homologacion = true
    )
  );
