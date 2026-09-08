-- =====================================================================
-- 0011_homologacion_autorizacion.sql
-- Autorización de ingreso a obra (fin del plazo de homologación SST).
--
-- Hasta ahora "documentos_completos" era un estado automático (lo calcula
-- el trigger de 0002 cuando ya se subieron todos los documentos
-- obligatorios) que no necesariamente coincide con que el prevencionista
-- ya revisó y autorizó que el trabajador puede entrar a la obra. Se agrega
-- un registro explícito de esa autorización, con quién y cuándo, para:
--
--   1. Dejar trazabilidad real de la decisión del prevencionista (mismo
--      criterio de auditoría que ya existe para las aprobaciones de
--      solicitudes).
--   2. Medir el SLA de homologación en el dashboard de Prevención:
--
--        RRHH (armar el contrato):   contrataciones.created_at  ------>
--                                     se sube el "Contrato de Trabajo"
--        Prevención (homologación):  se sube el "Contrato de Trabajo" -->
--                                     contrataciones.homologacion_aprobada_at
--
-- Ejecutar después de 0001-0010.
-- =====================================================================

alter table public.contrataciones
  add column if not exists homologacion_aprobada_at timestamptz,
  add column if not exists homologacion_aprobada_por uuid references public.perfiles(id);

comment on column public.contrataciones.homologacion_aprobada_at is
  'Momento en que el prevencionista autoriza el ingreso del trabajador a la obra designada (fin del plazo de homologación SST). Null mientras siga pendiente.';
comment on column public.contrataciones.homologacion_aprobada_por is
  'Prevencionista que autorizó el ingreso a obra.';

-- El prevencionista autoriza el ingreso a obra de las contrataciones de
-- su(s) centro(s) de costo asignados (mismo criterio de acceso que ya usa
-- 0009 para SELECT), mientras no esté ya autorizada ni anulada.
--
-- Nota de seguridad (mismo criterio ya usado en Data.decidir() con la
-- tabla `aprobaciones`, ver NOTAS_CONTRATACION_SST.md): el control es a
-- nivel de FILA (RLS), no de columna -- Postgres no ofrece permisos por
-- columna sin GRANT/REVOKE explícitos, que este proyecto decidió no usar
-- por simplicidad. La UI (Data.autorizarIngresoObra) solo envía
-- {homologacion_aprobada_at, homologacion_aprobada_por} en el UPDATE, así
-- que en la práctica un prevencionista no puede tocar otros campos de la
-- contratación, pero eso lo garantiza el código de la aplicación, no la
-- base de datos.
drop policy if exists contrataciones_prevencionista_autorizar on public.contrataciones;
create policy contrataciones_prevencionista_autorizar on public.contrataciones
  for update to authenticated
  using (
    public.rol_actual() = 'prevencionista'
    and estado <> 'anulada'
    and homologacion_aprobada_at is null
    and exists (
      select 1
      from public.solicitudes s
      join public.centros_costo cc on cc.id = s.centro_origen_id
      where s.id = contrataciones.solicitud_id and cc.prevencionista_id = auth.uid()
    )
  )
  with check (
    public.rol_actual() = 'prevencionista'
    and exists (
      select 1
      from public.solicitudes s
      join public.centros_costo cc on cc.id = s.centro_origen_id
      where s.id = contrataciones.solicitud_id and cc.prevencionista_id = auth.uid()
    )
  );
