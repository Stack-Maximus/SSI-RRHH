-- ============================================================================
-- SGC METALIUM · Esquema completo de base de datos (Supabase / PostgreSQL)
-- Shell unificado + 5 módulos: Personal, Proveedores, Satisfacción,
-- No Conformidades, Postventa.
-- Ejecutar de arriba a abajo, completo, en el SQL Editor de Supabase.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. SHELL — perfiles, accesos por módulo, funciones de permiso
-- ============================================================================

create type modulo_sgc as enum (
  'personal', 'proveedores', 'satisfaccion', 'no_conformidades', 'postventa'
);

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  cargo text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Crea automáticamente el perfil cuando se registra un usuario nuevo en auth.users
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create table modulo_accesos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  modulo modulo_sgc not null,
  rol text not null,
  creado_en timestamptz not null default now(),
  unique (usuario_id, modulo)
);

create or replace function tiene_acceso(p_modulo modulo_sgc)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from modulo_accesos
    where usuario_id = auth.uid() and modulo = p_modulo
  );
$$;

create or replace function rol_en_modulo(p_modulo modulo_sgc)
returns text
language sql
stable
as $$
  select rol from modulo_accesos
  where usuario_id = auth.uid() and modulo = p_modulo
  limit 1;
$$;

-- RLS del shell
alter table perfiles enable row level security;
alter table modulo_accesos enable row level security;

create policy "perfiles_select_autenticados" on perfiles
  for select to authenticated
  using (true);

create policy "perfiles_update_propio" on perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "modulo_accesos_select_propio" on modulo_accesos
  for select to authenticated
  using (usuario_id = auth.uid());

-- Nota: no hay políticas de insert/update/delete para modulo_accesos.
-- Sin política que lo permita, RLS lo deniega a todos salvo al rol de servicio
-- (service_role) — es decir, los accesos se administran desde el backend/admin,
-- no desde el cliente.

-- ============================================================================
-- Acceso externo tipo A · un solo uso (encuestas)
-- ============================================================================

create table encuestas_token (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid() unique,
  modulo modulo_sgc not null,
  tipo text not null,
  referencia_id uuid,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'completado', 'vencido')),
  fecha_creacion timestamptz not null default now(),
  fecha_respuesta timestamptz
);

alter table encuestas_token enable row level security;
-- Sin políticas ni grants a anon/authenticated: el único acceso es vía las
-- funciones RPC security definer definidas más abajo.

-- ============================================================================
-- Acceso externo tipo B · recurrente por obra (reporte de postventa)
-- ============================================================================

create table postventa_accesos_obra (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid() unique,
  obra text not null,
  centro_costo text,
  fecha_activacion date not null default current_date,
  fecha_fin_garantia date not null,
  activo boolean not null default true
);

alter table postventa_accesos_obra enable row level security;
-- Igual que encuestas_token: sin grants directos, solo vía RPC.


-- ============================================================================
-- 1. MÓDULO · EVALUACIÓN DE PERSONAL (100% interno)
-- ============================================================================

create table eva_ciclos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo_periodo text not null check (tipo_periodo in
    ('1er_semestre', '2do_semestre', 'anual', 'periodo_prueba', 'extraordinaria_pmd')),
  fecha_apertura date,
  fecha_cierre_autoeval date,
  fecha_cierre_evaluacion date,
  fecha_cierre_ciclo date,
  estado text not null default 'planificado'
    check (estado in ('planificado', 'abierto', 'en_cierre', 'cerrado'))
);

create table eva_dimensiones (
  codigo text primary key,
  nombre text not null,
  peso numeric(4,3) not null,
  rubrica_1 text,
  rubrica_2 text,
  rubrica_3 text,
  rubrica_4 text,
  rubrica_5 text
);

create table eva_criterios (
  codigo text primary key,
  dimension_codigo text references eva_dimensiones(codigo),
  orden int,
  texto_criterio text not null
);

create table eva_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid references eva_ciclos(id),
  evaluado_id uuid references perfiles(id),
  evaluador_id uuid references perfiles(id),
  cargo_evaluador text,
  estado text not null default 'asignada' check (estado in (
    'asignada', 'autoevaluacion_en_curso', 'autoevaluacion_enviada',
    'consolidada', 'entregada_trabajador', 'cerrada_conforme',
    'cerrada_disconformidad', 'archivada'
  )),
  nro_evaluacion text,
  rut text,
  fecha_nacimiento date,
  nacionalidad text,
  fecha_ingreso date,
  antiguedad_cargo_meses int,
  cargo_actual text,
  tipo_contrato text,
  centro_trabajo text,
  subcontratista text,
  areas_proyectos text,
  capacitaciones_periodo text,
  incidentes_hallazgos text,
  reconocimientos_sanciones text,
  fecha_envio_autoeval timestamptz,
  fecha_envio_evaluacion timestamptz,
  fecha_entrevista date,
  fecha_cierre_pdi_estimada date,
  fecha_cierre date,
  prom_sup_tc numeric(3,2), prom_sup_ss numeric(3,2), prom_sup_dl numeric(3,2),
  prom_sup_vh numeric(3,2), prom_sup_cm numeric(3,2),
  prom_auto_tc numeric(3,2), prom_auto_ss numeric(3,2), prom_auto_dl numeric(3,2),
  prom_auto_vh numeric(3,2), prom_auto_cm numeric(3,2),
  brecha_tc numeric(3,2), brecha_ss numeric(3,2), brecha_dl numeric(3,2),
  brecha_vh numeric(3,2), brecha_cm numeric(3,2),
  total_sup numeric(3,2),
  total_auto numeric(3,2),
  brecha_total numeric(3,2),
  categoria text check (categoria in
    ('excepcional', 'destacado', 'satisfactorio', 'por_debajo', 'critico')),
  decision_asociada text,
  reflexion_mejor text,
  reflexion_mejorar text,
  reflexion_necesito text,
  reflexion_metas text,
  recomendacion_final text,
  justificacion_recomendacion text,
  acuerdo_trabajador text check (acuerdo_trabajador in ('conforme', 'no_conforme')),
  observaciones_trabajador text,
  folio_aprobacion text,
  fecha_respuesta_conformidad timestamptz,
  url_pdf text
);

create table eva_detalle_auto (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references eva_evaluaciones(id) on delete cascade,
  criterio_codigo text references eva_criterios(codigo),
  nota int check (nota between 1 and 5),
  comentario text
);

create table eva_detalle_sup (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references eva_evaluaciones(id) on delete cascade,
  criterio_codigo text references eva_criterios(codigo),
  nota int check (nota between 1 and 5),
  comentario_evidencia text
);

create table eva_pdi (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references eva_evaluaciones(id) on delete cascade,
  nro int,
  dimension_criterio text,
  accion_smart text,
  responsable_apoyo text,
  recursos text,
  fecha_inicio date,
  fecha_cierre date,
  estado_accion text default 'pendiente',
  control_1_fecha date,
  control_1_obs text,
  control_2_fecha date,
  control_2_obs text
);

-- RLS · módulo Personal
alter table eva_ciclos enable row level security;
alter table eva_dimensiones enable row level security;
alter table eva_criterios enable row level security;
alter table eva_evaluaciones enable row level security;
alter table eva_detalle_auto enable row level security;
alter table eva_detalle_sup enable row level security;
alter table eva_pdi enable row level security;

create policy "personal_acceso_modulo" on eva_ciclos
  for all to authenticated
  using (tiene_acceso('personal')) with check (tiene_acceso('personal'));

create policy "personal_lectura_catalogos_dim" on eva_dimensiones
  for select to authenticated using (tiene_acceso('personal'));

create policy "personal_lectura_catalogos_crit" on eva_criterios
  for select to authenticated using (tiene_acceso('personal'));

create policy "personal_acceso_evaluaciones" on eva_evaluaciones
  for all to authenticated
  using (
    tiene_acceso('personal')
    and (rol_en_modulo('personal') = 'rrhh' or evaluado_id = auth.uid() or evaluador_id = auth.uid())
  )
  with check (
    tiene_acceso('personal')
    and (rol_en_modulo('personal') = 'rrhh' or evaluador_id = auth.uid())
  );

create policy "personal_trabajador_edita_autoeval" on eva_detalle_auto
  for all to authenticated
  using (
    exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and e.evaluado_id = auth.uid() and e.estado = 'autoevaluacion_en_curso'
    )
    or exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and (rol_en_modulo('personal') = 'rrhh' or e.evaluador_id = auth.uid())
    )
  );

create policy "personal_evaluador_edita_sup" on eva_detalle_sup
  for all to authenticated
  using (
    exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and e.evaluador_id = auth.uid()
      and e.estado in ('autoevaluacion_enviada', 'autoevaluacion_en_curso')
    )
    or rol_en_modulo('personal') = 'rrhh'
  );

create policy "personal_evaluado_lee_sup_consolidada" on eva_detalle_sup
  for select to authenticated
  using (
    exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and e.evaluado_id = auth.uid()
      and e.estado in ('entregada_trabajador', 'cerrada_conforme', 'cerrada_disconformidad', 'archivada')
    )
  );

create policy "personal_acceso_pdi" on eva_pdi
  for all to authenticated
  using (
    exists (
      select 1 from eva_evaluaciones e where e.id = evaluacion_id
      and (rol_en_modulo('personal') = 'rrhh' or e.evaluador_id = auth.uid()
           or (e.evaluado_id = auth.uid() and e.estado in
               ('entregada_trabajador','cerrada_conforme','cerrada_disconformidad','archivada')))
    )
  );


-- ============================================================================
-- 2. MÓDULO · EVALUACIÓN DE PROVEEDORES (100% interno)
-- ============================================================================

create table prov_proveedores (
  id uuid primary key default gen_random_uuid(),
  rut text unique not null,
  razon_social text not null,
  nombre_fantasia text,
  categoria text not null check (categoria in ('bienes', 'servicios', 'ambas')),
  rubro text,
  critico boolean default false,
  contacto text,
  correo text,
  id_auranet text,
  estado_homologacion text default 'en_ingreso' check (estado_homologacion in
    ('homologado_a', 'homologado_b', 'condicionado_c', 'suspendido_d', 'en_ingreso')),
  clasificacion_vigente text,
  fecha_ultima_evaluacion date
);

create table prov_delegados (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('gol', 'gfc', 'gi', 'go', 'gsst', 'rrhh')),
  delegado_id uuid references perfiles(id),
  suplente_id uuid references perfiles(id)
);

create table prov_ciclos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text check (tipo in
    ('semestral_bienes', 'anual_bienes_menor', 'por_contrato', 'extraordinaria', 'reevaluacion')),
  periodo_evaluado text,
  fecha_apertura date,
  fecha_cierre date,
  estado text default 'planificado'
);

create table prov_criterios (
  codigo text primary key,
  area text not null check (area in ('gol', 'gfc', 'gi', 'go', 'gsst', 'rrhh')),
  texto text not null,
  aplica text not null check (aplica in ('bienes', 'servicios', 'ambas')),
  veto boolean default false,
  orden int
);

create table prov_pesos (
  area text primary key check (area in ('gol', 'gfc', 'gi', 'go', 'gsst', 'rrhh')),
  peso_bienes numeric(4,3) not null,
  peso_servicios numeric(4,3) not null
);

create table prov_rangos (
  id uuid primary key default gen_random_uuid(),
  rango_min numeric(3,2),
  rango_max numeric(3,2),
  clasificacion text check (clasificacion in
    ('a_preferente', 'b_aprobado', 'c_condicionado', 'd_no_aprobado')),
  decision_asociada text
);

create table prov_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references prov_proveedores(id),
  ciclo_id uuid references prov_ciclos(id),
  categoria_aplicada text check (categoria_aplicada in ('bienes', 'servicios')),
  obra_contrato text,
  estado text not null default 'abierta' check (estado in
    ('abierta', 'en_evaluacion', 'consolidada', 'en_comite', 'comunicada', 'cerrada')),
  nota_gol numeric(3,2), nota_gfc numeric(3,2), nota_gi numeric(3,2),
  nota_go numeric(3,2), nota_gsst numeric(3,2), nota_rrhh numeric(3,2),
  total_ponderado numeric(3,2),
  veto_aplicado boolean default false,
  veto_criterio text,
  clasificacion text check (clasificacion in
    ('a_preferente', 'b_aprobado', 'c_condicionado', 'd_no_aprobado')),
  decision_asociada text,
  tendencia_vs_anterior numeric(3,2),
  folio_aprobacion text,
  url_informe text,
  url_carta text,
  fecha_envio_carta date
);

create table prov_detalle (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references prov_evaluaciones(id) on delete cascade,
  area text not null check (area in ('gol', 'gfc', 'gi', 'go', 'gsst', 'rrhh')),
  criterio_codigo text references prov_criterios(codigo),
  nota int check (nota between 1 and 5),
  na boolean default false,
  justificacion_na text,
  comentario text,
  adjunto_url text
);

create table prov_eventos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references prov_proveedores(id),
  fecha date default current_date,
  area_reporta text,
  tipo text check (tipo in
    ('nc_mayor', 'nc_menor', 'incidente_sst', 'incumplimiento_laboral', 'quiebre_entrega', 'reconocimiento')),
  severidad text,
  descripcion text,
  evidencia_url text,
  estado text default 'abierto' check (estado in ('abierto', 'cerrado'))
);

create table prov_planes_accion (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references prov_proveedores(id),
  evaluacion_id uuid references prov_evaluaciones(id),
  compromisos text,
  plazo date,
  fecha_reevaluacion date,
  estado text default 'activo',
  verificacion text
);

-- RLS · módulo Proveedores
alter table prov_proveedores enable row level security;
alter table prov_delegados enable row level security;
alter table prov_ciclos enable row level security;
alter table prov_criterios enable row level security;
alter table prov_pesos enable row level security;
alter table prov_rangos enable row level security;
alter table prov_evaluaciones enable row level security;
alter table prov_detalle enable row level security;
alter table prov_eventos enable row level security;
alter table prov_planes_accion enable row level security;

create policy "proveedores_acceso_modulo_proveedores" on prov_proveedores
  for all to authenticated
  using (tiene_acceso('proveedores')) with check (tiene_acceso('proveedores'));

create policy "proveedores_acceso_modulo_delegados" on prov_delegados
  for all to authenticated
  using (tiene_acceso('proveedores')) with check (tiene_acceso('proveedores'));

create policy "proveedores_acceso_modulo_ciclos" on prov_ciclos
  for all to authenticated
  using (tiene_acceso('proveedores')) with check (tiene_acceso('proveedores'));

create policy "proveedores_lectura_criterios" on prov_criterios
  for select to authenticated using (tiene_acceso('proveedores'));

create policy "proveedores_lectura_pesos" on prov_pesos
  for select to authenticated using (tiene_acceso('proveedores'));

create policy "proveedores_lectura_rangos" on prov_rangos
  for select to authenticated using (tiene_acceso('proveedores'));

create policy "proveedores_acceso_evaluaciones" on prov_evaluaciones
  for all to authenticated
  using (tiene_acceso('proveedores')) with check (tiene_acceso('proveedores'));

create policy "proveedores_delegado_edita_su_area" on prov_detalle
  for all to authenticated
  using (
    tiene_acceso('proveedores')
    and (rol_en_modulo('proveedores') = 'comite' or area = rol_en_modulo('proveedores'))
  )
  with check (
    tiene_acceso('proveedores')
    and (rol_en_modulo('proveedores') = 'comite' or area = rol_en_modulo('proveedores'))
  );

create policy "proveedores_acceso_eventos" on prov_eventos
  for all to authenticated
  using (tiene_acceso('proveedores')) with check (tiene_acceso('proveedores'));

create policy "proveedores_acceso_planes" on prov_planes_accion
  for all to authenticated
  using (tiene_acceso('proveedores')) with check (tiene_acceso('proveedores'));


-- ============================================================================
-- 3. MÓDULO · SATISFACCIÓN DEL CLIENTE (interno + acceso externo tipo A)
-- ============================================================================

create table sat_clientes (
  id uuid primary key default gen_random_uuid(),
  mandante text not null,
  rut text,
  contraparte_comercial text
);

create table sat_contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references sat_clientes(id) on delete cascade,
  nombre text,
  cargo text,
  correo text,
  telefono text
);

create table sat_dimensiones (
  codigo text primary key,
  nombre text not null,
  peso numeric(4,3) not null
);

create table sat_invitaciones (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null,
  obra text not null,
  contacto_id uuid references sat_contactos(id),
  tipo_encuesta text not null check (tipo_encuesta in ('cierre', 'pulso', 'postventa', 'campania')),
  fecha_envio timestamptz default now(),
  recordatorio_1 timestamptz,
  recordatorio_2 timestamptz,
  estado text not null default 'enviada' check (estado in
    ('enviada', 'recordada', 'respondida', 'vencida', 'gestionada')),
  fecha_respuesta timestamptz,
  respuesta_id uuid
);

create table sat_respuestas (
  id uuid primary key default gen_random_uuid(),
  invitacion_id uuid references sat_invitaciones(id),
  fecha timestamptz default now(),
  nota_d1 int, nota_d2 int, nota_d3 int, nota_d4 int, nota_d5 int, nota_d6 int,
  isc numeric(3,2),
  nps int check (nps between 0 and 10),
  clase_nps text check (clase_nps in ('promotor', 'pasivo', 'detractor')),
  semaforo text check (semaforo in ('verde', 'amarillo', 'rojo')),
  comentario text,
  alerta_generada boolean default false
);

create table sat_alertas (
  id uuid primary key default gen_random_uuid(),
  respuesta_id uuid references sat_respuestas(id),
  obra text,
  dimension_critica text,
  gerencia_responsable text,
  fecha_alerta timestamptz default now(),
  sla_48h timestamptz,
  contacto_realizado_fecha timestamptz,
  contacto_realizado_medio text,
  causa_raiz text,
  accion text,
  estado text default 'abierta' check (estado in ('abierta', 'en_proceso', 'cerrada')),
  cierre_verificado boolean default false
);

-- RLS · módulo Satisfacción (interno)
alter table sat_clientes enable row level security;
alter table sat_contactos enable row level security;
alter table sat_dimensiones enable row level security;
alter table sat_invitaciones enable row level security;
alter table sat_respuestas enable row level security;
alter table sat_alertas enable row level security;

create policy "satisfaccion_acceso_clientes" on sat_clientes
  for all to authenticated
  using (tiene_acceso('satisfaccion')) with check (tiene_acceso('satisfaccion'));

create policy "satisfaccion_acceso_contactos" on sat_contactos
  for all to authenticated
  using (tiene_acceso('satisfaccion')) with check (tiene_acceso('satisfaccion'));

create policy "satisfaccion_lectura_dimensiones" on sat_dimensiones
  for select to authenticated using (tiene_acceso('satisfaccion'));

create policy "satisfaccion_acceso_invitaciones" on sat_invitaciones
  for all to authenticated
  using (tiene_acceso('satisfaccion')) with check (tiene_acceso('satisfaccion'));

create policy "satisfaccion_acceso_respuestas" on sat_respuestas
  for all to authenticated
  using (tiene_acceso('satisfaccion')) with check (tiene_acceso('satisfaccion'));

create policy "satisfaccion_acceso_alertas" on sat_alertas
  for all to authenticated
  using (tiene_acceso('satisfaccion')) with check (tiene_acceso('satisfaccion'));


-- ============================================================================
-- 4. MÓDULO · NO CONFORMIDADES (100% interno)
-- ============================================================================

create table nc_registro (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null,
  tipo_origen text not null check (tipo_origen in
    ('interna_auditoria', 'interna_obra', 'externa_cliente')),
  obra_proceso text,
  fecha_deteccion date default current_date,
  detectada_por uuid references perfiles(id),
  fuente text,
  descripcion text not null,
  requisito_incumplido text,
  partida_elemento text,
  severidad text not null check (severidad in ('critica', 'mayor', 'menor', 'observacion')),
  atribuible_a text,
  estado text not null default 'registrada' check (estado in (
    'registrada', 'clasificada', 'contenida', 'en_analisis',
    'en_implementacion', 'en_verificacion', 'cerrada', 'reabierta'
  )),
  contencion text,
  metodo_causa_raiz text,
  causa_raiz text,
  costo_no_calidad_estimado numeric,
  riesgo_asociado text,
  folio_liberacion text
);

create table nc_acciones (
  id uuid primary key default gen_random_uuid(),
  nc_id uuid references nc_registro(id) on delete cascade,
  tipo text check (tipo in ('correccion', 'accion_correctiva', 'preventiva_om')),
  accion text,
  responsable_id uuid references perfiles(id),
  plazo date,
  estado text default 'pendiente',
  evidencia_implementacion text
);

create table nc_verificaciones (
  id uuid primary key default gen_random_uuid(),
  nc_id uuid references nc_registro(id) on delete cascade,
  fecha date default current_date,
  verificador_id uuid references perfiles(id),
  resultado text check (resultado in ('eficaz', 'no_eficaz')),
  evidencia text,
  validacion_cliente_doc text,
  validacion_cliente_fecha date
);

create table nc_auditorias (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  area_proceso text,
  tipo text check (tipo in ('programa_anual', 'cruzada', 'extraordinaria')),
  auditor_id uuid references perfiles(id),
  fecha_planificada date,
  fecha_real date,
  checklist_aplicado text,
  n_hallazgos_criticos int default 0,
  n_hallazgos_mayores int default 0,
  n_hallazgos_menores int default 0,
  n_hallazgos_obs int default 0,
  informe_url text,
  estado text default 'planificada'
);

create table nc_entregas_liberacion (
  id uuid primary key default gen_random_uuid(),
  obra text not null,
  hito text check (hito in
    ('pre_entrega', 'recepcion_provisoria', 'recepcion_definitiva', 'hito_interno')),
  fecha_programada date,
  checklist_aplicado text,
  estado_gate text not null default 'en_inspeccion' check (estado_gate in
    ('en_inspeccion', 'retenida', 'liberada', 'liberada_condicionada')),
  folio_approval text,
  autorizada_por uuid references perfiles(id),
  certificado_url text
);

-- RLS · módulo No Conformidades
alter table nc_registro enable row level security;
alter table nc_acciones enable row level security;
alter table nc_verificaciones enable row level security;
alter table nc_auditorias enable row level security;
alter table nc_entregas_liberacion enable row level security;

create policy "nc_acceso_registro" on nc_registro
  for all to authenticated
  using (tiene_acceso('no_conformidades')) with check (tiene_acceso('no_conformidades'));

create policy "nc_acceso_acciones" on nc_acciones
  for all to authenticated
  using (tiene_acceso('no_conformidades')) with check (tiene_acceso('no_conformidades'));

create policy "nc_acceso_verificaciones" on nc_verificaciones
  for all to authenticated
  using (tiene_acceso('no_conformidades')) with check (tiene_acceso('no_conformidades'));

create policy "nc_acceso_auditorias" on nc_auditorias
  for all to authenticated
  using (tiene_acceso('no_conformidades')) with check (tiene_acceso('no_conformidades'));

create policy "nc_acceso_gates" on nc_entregas_liberacion
  for all to authenticated
  using (tiene_acceso('no_conformidades')) with check (tiene_acceso('no_conformidades'));


-- ============================================================================
-- 5. MÓDULO · POSTVENTA (interno + acceso externo tipo A y tipo B)
-- ============================================================================

create table pv_obras (
  id uuid primary key default gen_random_uuid(),
  obra text not null,
  centro_costo text,
  cliente text,
  fecha_activacion date default current_date,
  fecha_fin_garantia date not null
);

create table pv_tickets (
  id uuid primary key default gen_random_uuid(),
  numero_ticket text unique not null,
  fecha_reporte timestamptz default now(),
  canal_ingreso text default 'forms',
  obra text not null,
  centro_costo text,
  cliente text,
  reportante text,
  rol_reportante text,
  correo text,
  telefono text,
  tipologia text,
  ubicacion text,
  descripcion_falla text not null,
  severidad text not null check (severidad in
    ('s1_critica', 's2_alta', 's3_media', 's4_cosmetica')),
  imputabilidad text check (imputabilidad in ('garantia', 'no_imputable', 'mixta')),
  responsable_id uuid references perfiles(id),
  fecha_asignacion date,
  fecha_inspeccion date,
  fecha_plan_accion date,
  costo_estimado numeric,
  costo_real numeric,
  fecha_inicio_ejecucion date,
  fecha_termino date,
  fecha_acta_conformidad date,
  estado text not null default 'reportado' check (estado in (
    'reportado', 'triage', 'asignado', 'en_inspeccion', 'en_plan',
    'en_aprobacion', 'en_ejecucion', 'en_verificacion', 'cerrado'
  )),
  satisfaccion_1_7 int,
  observaciones text
);

create table pv_plan_accion (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references pv_tickets(id) on delete cascade,
  nro_actividad int,
  actividad text,
  responsable_id uuid references perfiles(id),
  fecha_planificada date,
  fecha_real date,
  materiales_recursos text,
  hh numeric,
  costo_materiales numeric,
  costo_hh_subcontrato numeric,
  costo_total numeric,
  estado text default 'planificada' check (estado in ('planificada', 'en_curso', 'terminada'))
);

create table pv_actas_conformidad (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references pv_tickets(id),
  descripcion_trabajos text,
  responsable_tecnico_id uuid references perfiles(id),
  fecha_inicio_trabajos date,
  fecha_termino_trabajos date,
  firmante_cliente_nombre text,
  firmante_cliente_rut text,
  firmante_cliente_cargo text,
  fecha_firma date,
  garantia_dias int default 90,
  observaciones text
);

-- RLS · módulo Postventa (interno)
alter table pv_obras enable row level security;
alter table pv_tickets enable row level security;
alter table pv_plan_accion enable row level security;
alter table pv_actas_conformidad enable row level security;

create policy "postventa_acceso_obras" on pv_obras
  for all to authenticated
  using (tiene_acceso('postventa')) with check (tiene_acceso('postventa'));

create policy "postventa_acceso_tickets" on pv_tickets
  for all to authenticated
  using (tiene_acceso('postventa')) with check (tiene_acceso('postventa'));

create policy "postventa_acceso_plan" on pv_plan_accion
  for all to authenticated
  using (tiene_acceso('postventa')) with check (tiene_acceso('postventa'));

create policy "postventa_acceso_actas" on pv_actas_conformidad
  for all to authenticated
  using (tiene_acceso('postventa')) with check (tiene_acceso('postventa'));


-- ============================================================================
-- 6. FUNCIONES RPC PARA ACCESO EXTERNO (security definer, sin grants a las tablas)
-- ============================================================================

-- 6.1 · Satisfacción — obtener y responder encuesta (token de un solo uso)

create or replace function obtener_encuesta_satisfaccion(p_token uuid)
returns table (invitacion_id uuid, obra text, dimensiones jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select i.id, i.obra,
    (select jsonb_agg(jsonb_build_object('codigo', d.codigo, 'nombre', d.nombre) order by d.codigo)
     from sat_dimensiones d)
  from sat_invitaciones i
  join encuestas_token t on t.referencia_id = i.id and t.modulo = 'satisfaccion'
  where t.token = p_token and t.estado = 'pendiente';
end;
$$;

grant execute on function obtener_encuesta_satisfaccion(uuid) to anon;

create or replace function responder_encuesta_satisfaccion(
  p_token uuid,
  p_notas jsonb,
  p_nps int,
  p_comentario text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv_id uuid;
  v_obra text;
  v_key text;
  v_val jsonb;
  v_peso numeric;
  v_nota int;
  v_suma numeric := 0;
  v_pesos numeric := 0;
  v_isc numeric;
  v_semaforo text;
  v_clase_nps text;
  v_nota_minima int := 5;
  v_respuesta_id uuid;
  v_alerta boolean := false;
begin
  select referencia_id into v_inv_id from encuestas_token
  where token = p_token and modulo = 'satisfaccion' and estado = 'pendiente';

  if v_inv_id is null then
    return false;
  end if;

  select obra into v_obra from sat_invitaciones where id = v_inv_id;

  for v_key, v_val in select * from jsonb_each(p_notas) loop
    if v_val is not null and v_val::text != 'null' then
      select peso into v_peso from sat_dimensiones where codigo = upper(v_key);
      if v_peso is not null then
        v_nota := v_val::int;
        v_suma := v_suma + (v_nota * v_peso);
        v_pesos := v_pesos + v_peso;
        if v_nota < v_nota_minima then
          v_nota_minima := v_nota;
        end if;
      end if;
    end if;
  end loop;

  if v_pesos > 0 then
    v_isc := round(v_suma / v_pesos, 2);
  end if;

  if p_nps >= 9 then
    v_clase_nps := 'promotor';
  elsif p_nps >= 7 then
    v_clase_nps := 'pasivo';
  else
    v_clase_nps := 'detractor';
  end if;

  if v_isc < 3.5 or v_nota_minima <= 2 or p_nps <= 6 then
    v_semaforo := 'rojo';
    v_alerta := true;
  elsif v_isc < 4.2 or v_nota_minima = 3 then
    v_semaforo := 'amarillo';
  else
    v_semaforo := 'verde';
  end if;

  insert into sat_respuestas (
    invitacion_id, nota_d1, nota_d2, nota_d3, nota_d4, nota_d5, nota_d6,
    isc, nps, clase_nps, semaforo, comentario, alerta_generada
  ) values (
    v_inv_id,
    (p_notas->>'d1')::int, (p_notas->>'d2')::int, (p_notas->>'d3')::int,
    (p_notas->>'d4')::int, (p_notas->>'d5')::int, (p_notas->>'d6')::int,
    v_isc, p_nps, v_clase_nps, v_semaforo, p_comentario, v_alerta
  ) returning id into v_respuesta_id;

  update sat_invitaciones set estado = 'respondida', fecha_respuesta = now(), respuesta_id = v_respuesta_id
  where id = v_inv_id;

  update encuestas_token set estado = 'completado', fecha_respuesta = now()
  where token = p_token;

  if v_alerta then
    insert into sat_alertas (respuesta_id, obra, fecha_alerta, sla_48h, estado)
    values (v_respuesta_id, v_obra, now(), now() + interval '48 hours', 'abierta');
  end if;

  return true;
end;
$$;

grant execute on function responder_encuesta_satisfaccion(uuid, jsonb, int, text) to anon;

-- 6.2 · Postventa — reportar ticket (acceso recurrente por obra, tipo B)

create or replace function reportar_ticket_postventa(p_token uuid, p_datos jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra text;
  v_cc text;
  v_numero text;
  v_correlativo int;
begin
  select obra, centro_costo into v_obra, v_cc
  from postventa_accesos_obra
  where token = p_token and activo and current_date <= fecha_fin_garantia;

  if v_obra is null then
    raise exception 'Acceso inválido, inactivo o garantía vencida';
  end if;

  select count(*) + 1 into v_correlativo
  from pv_tickets
  where obra = v_obra and fecha_reporte >= date_trunc('year', now());

  v_numero := 'PV-' || v_obra || '-' || extract(year from now())::text || '-' || lpad(v_correlativo::text, 3, '0');

  insert into pv_tickets (
    numero_ticket, obra, centro_costo, cliente, reportante, rol_reportante,
    correo, telefono, tipologia, ubicacion, descripcion_falla
  ) values (
    v_numero, v_obra, v_cc, p_datos->>'cliente', p_datos->>'reportante', p_datos->>'rol_reportante',
    p_datos->>'correo', p_datos->>'telefono', p_datos->>'tipologia', p_datos->>'ubicacion',
    p_datos->>'descripcion'
  );

  return v_numero;
end;
$$;

grant execute on function reportar_ticket_postventa(uuid, jsonb) to anon;

-- 6.3 · Postventa — obtener y responder encuesta de cierre (token de un solo uso, tipo A)

create or replace function obtener_encuesta_postventa(p_token uuid)
returns table (ticket_id uuid, numero_ticket text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select p.id, p.numero_ticket
  from pv_tickets p
  join encuestas_token t on t.referencia_id = p.id and t.modulo = 'postventa'
  where t.token = p_token and t.estado = 'pendiente';
end;
$$;

grant execute on function obtener_encuesta_postventa(uuid) to anon;

create or replace function responder_encuesta_postventa(p_token uuid, p_satisfaccion int, p_comentario text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_id uuid;
begin
  select referencia_id into v_ticket_id from encuestas_token
  where token = p_token and modulo = 'postventa' and tipo = 'encuesta_cierre_ticket' and estado = 'pendiente';

  if v_ticket_id is null then
    return false;
  end if;

  update pv_tickets set satisfaccion_1_7 = p_satisfaccion, observaciones = coalesce(observaciones || ' · ', '') || coalesce(p_comentario, '')
  where id = v_ticket_id;

  update encuestas_token set estado = 'completado', fecha_respuesta = now()
  where token = p_token;

  return true;
end;
$$;

grant execute on function responder_encuesta_postventa(uuid, int, text) to anon;


-- ============================================================================
-- 7. REGLAS DE NEGOCIO — funciones y triggers internos
-- ============================================================================

-- 7.1 · No Conformidades — reapertura automática si la verificación no fue eficaz
create or replace function trigger_reapertura_nc()
returns trigger
language plpgsql
as $$
begin
  if new.resultado = 'no_eficaz' then
    update nc_registro set estado = 'reabierta' where id = new.nc_id;
  end if;
  return new;
end;
$$;

create trigger on_verificacion_no_eficaz
  after insert on nc_verificaciones
  for each row execute function trigger_reapertura_nc();

-- 7.2 · No Conformidades — el gate: ¿puede liberarse esta obra?
create or replace function puede_liberar_gate(p_obra text)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from nc_registro
    where obra_proceso = p_obra
      and severidad in ('critica', 'mayor')
      and estado <> 'cerrada'
  );
$$;

-- ============================================================================
-- FIN DEL ESQUEMA
-- ============================================================================
