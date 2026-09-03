# SGC Metalium — Esquema de base de datos (Supabase)
### Sistema unificado: 5 módulos sobre un solo esquema

Este documento traduce a Supabase/PostgreSQL los 8 documentos de origen (RRHH-SIS-EVA-AD-001,
GOL-SIS-EVA-PROV-001, GI-SIS-SAT-CLI-001, GI-SIS-NC-001, PV-PRO-001/REG-001/FOR-ACT-001),
manteniendo su lógica de negocio real. No es una traducción literal de Teams/Power Platform —
es el mismo modelo de datos, pensado para un backend Postgres.

---

## 0. El shell — login, módulos y los dos tipos de acceso externo

```sql
create type modulo_sgc as enum (
  'personal','proveedores','satisfaccion','no_conformidades','postventa'
);

create table perfiles (
  id uuid primary key references auth.users(id),
  nombre text not null,
  cargo text,
  activo boolean not null default true
);

create table modulo_accesos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  modulo modulo_sgc not null,
  rol text not null,           -- ej: 'evaluador','delegado_gol','coordinador','ing_calidad','lectura'
  unique (usuario_id, modulo)
);

create or replace function tiene_acceso(p_modulo modulo_sgc)
returns boolean language sql stable as $$
  select exists (select 1 from modulo_accesos where usuario_id = auth.uid() and modulo = p_modulo);
$$;

create or replace function rol_en_modulo(p_modulo modulo_sgc)
returns text language sql stable as $$
  select rol from modulo_accesos where usuario_id = auth.uid() and modulo = p_modulo limit 1;
$$;
```

**Patrón de RLS estándar**, idéntico en toda tabla de módulo salvo excepciones puntuales que se
anotan en cada sección:

```sql
alter table <tabla> enable row level security;

create policy "acceso_por_modulo" on <tabla>
for all to authenticated
using (tiene_acceso('<modulo>'))
with check (tiene_acceso('<modulo>'));
```

### Los dos tipos de acceso externo (sin cuenta)

```sql
-- TIPO A · un solo uso — encuestas (satisfacción y cierre de postventa)
create table encuestas_token (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid() unique,
  modulo modulo_sgc not null,
  tipo text not null,                  -- 'cierre'|'pulso'|'postventa'|'campania'|'encuesta_cierre_ticket'
  referencia_id uuid,                  -- invitación o ticket relacionado
  estado text not null default 'pendiente' check (estado in ('pendiente','completado','vencido')),
  fecha_creacion timestamptz not null default now(),
  fecha_respuesta timestamptz
);

-- TIPO B · recurrente por obra — reporte de fallas de postventa (vigente toda la garantía)
create table postventa_accesos_obra (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid() unique,
  obra text not null,
  centro_costo text,
  fecha_activacion date not null default current_date,
  fecha_fin_garantia date not null,
  activo boolean not null default true
);
```

Ambas tablas quedan con RLS activado y **sin ningún grant al rol `anon`** — todo acceso externo
pasa exclusivamente por funciones RPC `security definer` (una por módulo, se detallan más abajo).
El `anon` nunca puede hacer `select`/`insert` directo sobre ninguna tabla.

---

## 1. Evaluación de Personal

100% interno — el trabajador y su jefatura son ambos cuentas del sistema, no hay acceso externo.

```sql
create table eva_ciclos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,                  -- '2026-S2'
  tipo_periodo text not null check (tipo_periodo in
    ('1er_semestre','2do_semestre','anual','periodo_prueba','extraordinaria_pmd')),
  fecha_apertura date,
  fecha_cierre_autoeval date,
  fecha_cierre_evaluacion date,
  fecha_cierre_ciclo date,
  estado text not null default 'planificado' check (estado in ('planificado','abierto','en_cierre','cerrado'))
);

create table eva_dimensiones (
  codigo text primary key,               -- TC, SS, DL, VH, CM
  nombre text not null,
  peso numeric(4,3) not null,
  rubrica_1 text, rubrica_2 text, rubrica_3 text, rubrica_4 text, rubrica_5 text
);

create table eva_criterios (
  codigo text primary key,               -- TC1...CM6 (30 en total)
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
    'asignada','autoevaluacion_en_curso','autoevaluacion_enviada',
    'consolidada','entregada_trabajador','cerrada_conforme','cerrada_disconformidad','archivada'
  )),
  nro_evaluacion text,
  rut text, fecha_nacimiento date, nacionalidad text, fecha_ingreso date,
  antiguedad_cargo_meses int, cargo_actual text, tipo_contrato text,
  centro_trabajo text, subcontratista text,
  areas_proyectos text, capacitaciones_periodo text, incidentes_hallazgos text, reconocimientos_sanciones text,
  fecha_envio_autoeval timestamptz, fecha_envio_evaluacion timestamptz,
  fecha_entrevista date, fecha_cierre_pdi_estimada date, fecha_cierre date,
  prom_sup_tc numeric(3,2), prom_sup_ss numeric(3,2), prom_sup_dl numeric(3,2),
  prom_sup_vh numeric(3,2), prom_sup_cm numeric(3,2),
  prom_auto_tc numeric(3,2), prom_auto_ss numeric(3,2), prom_auto_dl numeric(3,2),
  prom_auto_vh numeric(3,2), prom_auto_cm numeric(3,2),
  brecha_tc numeric(3,2), brecha_ss numeric(3,2), brecha_dl numeric(3,2),
  brecha_vh numeric(3,2), brecha_cm numeric(3,2),
  total_sup numeric(3,2), total_auto numeric(3,2), brecha_total numeric(3,2),
  categoria text check (categoria in ('excepcional','destacado','satisfactorio','por_debajo','critico')),
  decision_asociada text,
  reflexion_mejor text, reflexion_mejorar text, reflexion_necesito text, reflexion_metas text,
  recomendacion_final text, justificacion_recomendacion text,
  acuerdo_trabajador text check (acuerdo_trabajador in ('conforme','no_conforme')),
  observaciones_trabajador text,
  folio_aprobacion text, fecha_respuesta_conformidad timestamptz, url_pdf text
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
  comentario_evidencia text               -- obligatorio en la app cuando nota <= 2
);

create table eva_pdi (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references eva_evaluaciones(id) on delete cascade,
  nro int,
  dimension_criterio text,
  accion_smart text,
  responsable_apoyo text,
  recursos text,
  fecha_inicio date, fecha_cierre date,
  estado_accion text default 'pendiente',
  control_1_fecha date, control_1_obs text,
  control_2_fecha date, control_2_obs text
);
```

**RLS que se sale del patrón estándar** (aquí sí importa la fila, no solo el módulo):

```sql
create policy "trabajador_edita_su_autoeval" on eva_detalle_auto
for all to authenticated
using (
  exists (select 1 from eva_evaluaciones e where e.id = evaluacion_id
    and e.evaluado_id = auth.uid() and e.estado = 'autoevaluacion_en_curso')
);

create policy "evaluado_lee_evaluacion_consolidada" on eva_detalle_sup
for select to authenticated
using (
  exists (select 1 from eva_evaluaciones e where e.id = evaluacion_id
    and e.evaluado_id = auth.uid() and e.estado in ('entregada_trabajador','cerrada_conforme','cerrada_disconformidad'))
);
```

---

## 2. Evaluación de Proveedores

100% interno — el proveedor nunca entra al sistema; recibe una carta PDF generada y enviada por
correo. Seis gerencias evalúan en paralelo, cada una viendo solo su propia área.

```sql
create table prov_proveedores (
  id uuid primary key default gen_random_uuid(),
  rut text unique not null,
  razon_social text not null,
  nombre_fantasia text,
  categoria text not null check (categoria in ('bienes','servicios','ambas')),
  rubro text,
  critico boolean default false,
  contacto text, correo text,
  id_auranet text,
  estado_homologacion text default 'en_ingreso' check (estado_homologacion in
    ('homologado_a','homologado_b','condicionado_c','suspendido_d','en_ingreso')),
  clasificacion_vigente text,
  fecha_ultima_evaluacion date
);

create table prov_delegados (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('gol','gfc','gi','go','gsst','rrhh')),
  delegado_id uuid references perfiles(id),
  suplente_id uuid references perfiles(id)
);

create table prov_ciclos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text check (tipo in ('semestral_bienes','anual_bienes_menor','por_contrato','extraordinaria','reevaluacion')),
  periodo_evaluado text,
  fecha_apertura date, fecha_cierre date,
  estado text default 'planificado'
);

create table prov_criterios (
  codigo text primary key,               -- LG1, FC1, CA1, OP1, ST1 (veto), LA1 (veto)...
  area text not null check (area in ('gol','gfc','gi','go','gsst','rrhh')),
  texto text not null,
  aplica text not null check (aplica in ('bienes','servicios','ambas')),
  veto boolean default false,
  orden int
);

create table prov_pesos (
  area text primary key check (area in ('gol','gfc','gi','go','gsst','rrhh')),
  peso_bienes numeric(4,3) not null,
  peso_servicios numeric(4,3) not null
);

create table prov_rangos (
  id uuid primary key default gen_random_uuid(),
  rango_min numeric(3,2), rango_max numeric(3,2),
  clasificacion text check (clasificacion in ('a_preferente','b_aprobado','c_condicionado','d_no_aprobado')),
  decision_asociada text
);

create table prov_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references prov_proveedores(id),
  ciclo_id uuid references prov_ciclos(id),
  categoria_aplicada text check (categoria_aplicada in ('bienes','servicios')),
  obra_contrato text,
  estado text not null default 'abierta' check (estado in
    ('abierta','en_evaluacion','consolidada','en_comite','comunicada','cerrada')),
  nota_gol numeric(3,2), nota_gfc numeric(3,2), nota_gi numeric(3,2),
  nota_go numeric(3,2), nota_gsst numeric(3,2), nota_rrhh numeric(3,2),
  total_ponderado numeric(3,2),
  veto_aplicado boolean default false, veto_criterio text,
  clasificacion text check (clasificacion in ('a_preferente','b_aprobado','c_condicionado','d_no_aprobado')),
  decision_asociada text,
  tendencia_vs_anterior numeric(3,2),
  folio_aprobacion text, url_informe text, url_carta text, fecha_envio_carta date
);

create table prov_detalle (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references prov_evaluaciones(id) on delete cascade,
  area text not null check (area in ('gol','gfc','gi','go','gsst','rrhh')),
  criterio_codigo text references prov_criterios(codigo),
  nota int check (nota between 1 and 5),
  na boolean default false, justificacion_na text,
  comentario text, adjunto_url text
);

create table prov_eventos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references prov_proveedores(id),
  fecha date default current_date,
  area_reporta text,
  tipo text check (tipo in ('nc_mayor','nc_menor','incidente_sst','incumplimiento_laboral','quiebre_entrega','reconocimiento')),
  severidad text,
  descripcion text, evidencia_url text,
  estado text default 'abierto' check (estado in ('abierto','cerrado'))
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
```

**RLS que se sale del patrón estándar** — cada delegado edita solo las filas de su propia área:

```sql
create policy "delegado_edita_su_area" on prov_detalle
for all to authenticated
using (
  tiene_acceso('proveedores') and
  (rol_en_modulo('proveedores') = 'comite' or area = rol_en_modulo('proveedores'))
);
```

*(convención: el rol de un delegado se guarda como el código de su área, ej. `'gol'`, `'gsst'`;
el comité usa el rol literal `'comite'` y ve todo).*

---

## 3. Satisfacción del Cliente

Único módulo con **ambos** tipos de acceso externo activos, pero solo del tipo A (encuestas de un
solo uso) — no tiene reporte recurrente.

```sql
create table sat_clientes (
  id uuid primary key default gen_random_uuid(),
  mandante text not null, rut text,
  contraparte_comercial text
);

create table sat_contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references sat_clientes(id) on delete cascade,
  nombre text, cargo text, correo text, telefono text
);

create table sat_dimensiones (
  codigo text primary key,               -- D1 Calidad · D2 Plazos · D3 Comunicación · D4 Seguridad · D5 Administración · D6 Postventa
  nombre text not null,
  peso numeric(4,3) not null
);

create table sat_invitaciones (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null,            -- SAT-2026-0147
  obra text not null,
  contacto_id uuid references sat_contactos(id),
  tipo_encuesta text not null check (tipo_encuesta in ('cierre','pulso','postventa','campania')),
  fecha_envio timestamptz default now(),
  recordatorio_1 timestamptz, recordatorio_2 timestamptz,
  estado text not null default 'enviada' check (estado in ('enviada','recordada','respondida','vencida','gestionada')),
  fecha_respuesta timestamptz,
  respuesta_id uuid
  -- el token vive en encuestas_token (modulo='satisfaccion', referencia_id = esta invitación)
);

create table sat_respuestas (
  id uuid primary key default gen_random_uuid(),
  invitacion_id uuid references sat_invitaciones(id),
  fecha timestamptz default now(),
  nota_d1 int, nota_d2 int, nota_d3 int, nota_d4 int, nota_d5 int, nota_d6 int,
  isc numeric(3,2),
  nps int check (nps between 0 and 10),
  clase_nps text check (clase_nps in ('promotor','pasivo','detractor')),
  semaforo text check (semaforo in ('verde','amarillo','rojo')),
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
  contacto_realizado_fecha timestamptz, contacto_realizado_medio text,
  causa_raiz text, accion text,
  estado text default 'abierta' check (estado in ('abierta','en_proceso','cerrada')),
  cierre_verificado boolean default false
);
```

**RPC externas** (patrón tipo A — sin grant directo a las tablas):

```sql
create or replace function obtener_encuesta_satisfaccion(p_token uuid)
returns table (invitacion_id uuid, obra text, dimensiones jsonb)
language plpgsql security definer as $$
begin
  return query
  select i.id, i.obra, (select jsonb_agg(jsonb_build_object('codigo', d.codigo, 'nombre', d.nombre)) from sat_dimensiones d)
  from sat_invitaciones i
  join encuestas_token t on t.referencia_id = i.id and t.modulo = 'satisfaccion'
  where t.token = p_token and t.estado = 'pendiente';
end; $$;
grant execute on function obtener_encuesta_satisfaccion(uuid) to anon;

create or replace function responder_encuesta_satisfaccion(p_token uuid, p_notas jsonb, p_nps int, p_comentario text)
returns boolean language plpgsql security definer as $$
declare v_inv_id uuid; v_isc numeric; v_semaforo text; v_clase_nps text;
begin
  select referencia_id into v_inv_id from encuestas_token
  where token = p_token and modulo = 'satisfaccion' and estado = 'pendiente';
  if v_inv_id is null then return false; end if;

  -- ISC ponderado con redistribución si una dimensión no aplica (calculado en la app o aquí con las notas recibidas)
  -- se omite el detalle aritmético por brevedad; la lógica exacta está en GI-SIS-SAT-CLI-001 sección 4.1

  insert into sat_respuestas (invitacion_id, nota_d1, nota_d2, nota_d3, nota_d4, nota_d5, nota_d6, nps, comentario)
  values (v_inv_id, (p_notas->>'d1')::int, (p_notas->>'d2')::int, (p_notas->>'d3')::int,
          (p_notas->>'d4')::int, (p_notas->>'d5')::int, (p_notas->>'d6')::int, p_nps, p_comentario);

  update sat_invitaciones set estado = 'respondida', fecha_respuesta = now() where id = v_inv_id;
  update encuestas_token set estado = 'completado', fecha_respuesta = now() where token = p_token;
  return true;
end; $$;
grant execute on function responder_encuesta_satisfaccion(uuid, jsonb, int, text) to anon;
```

Un trigger sobre `sat_respuestas` calcula ISC/NPS/semáforo al insertar y, si el semáforo resulta
`rojo`, inserta automáticamente en `sat_alertas` — así el *service recovery* de 48h arranca sin
intervención manual.

---

## 4. No Conformidades

100% interno. El módulo más denso: tres orígenes, severidades con SLA, y el gate de calidad que
retiene la entrega de una obra.

```sql
create table nc_registro (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null,            -- NC-SGC-.. / NC-{OBRA}-.. / NC-{OBRA}-E-..
  tipo_origen text not null check (tipo_origen in ('interna_auditoria','interna_obra','externa_cliente')),
  obra_proceso text,
  fecha_deteccion date default current_date,
  detectada_por uuid references perfiles(id),
  fuente text,
  descripcion text not null,
  requisito_incumplido text,
  partida_elemento text,
  severidad text not null check (severidad in ('critica','mayor','menor','observacion')),
  atribuible_a text,                     -- área Metalium, subcontratista o proveedor (texto libre + posible FK a prov_proveedores)
  estado text not null default 'registrada' check (estado in (
    'registrada','clasificada','contenida','en_analisis','en_implementacion','en_verificacion','cerrada','reabierta'
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
  tipo text check (tipo in ('correccion','accion_correctiva','preventiva_om')),
  accion text, responsable_id uuid references perfiles(id),
  plazo date, estado text default 'pendiente',
  evidencia_implementacion text
);

create table nc_verificaciones (
  id uuid primary key default gen_random_uuid(),
  nc_id uuid references nc_registro(id) on delete cascade,
  fecha date default current_date,
  verificador_id uuid references perfiles(id),
  resultado text check (resultado in ('eficaz','no_eficaz')),
  evidencia text,
  validacion_cliente_doc text, validacion_cliente_fecha date
);

create table nc_auditorias (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  area_proceso text,
  tipo text check (tipo in ('programa_anual','cruzada','extraordinaria')),
  auditor_id uuid references perfiles(id),
  fecha_planificada date, fecha_real date,
  checklist_aplicado text,
  n_hallazgos_criticos int default 0, n_hallazgos_mayores int default 0,
  n_hallazgos_menores int default 0, n_hallazgos_obs int default 0,
  informe_url text,
  estado text default 'planificada'
);

create table nc_entregas_liberacion (
  id uuid primary key default gen_random_uuid(),
  obra text not null,
  hito text check (hito in ('pre_entrega','recepcion_provisoria','recepcion_definitiva','hito_interno')),
  fecha_programada date,
  checklist_aplicado text,
  estado_gate text not null default 'en_inspeccion' check (estado_gate in
    ('en_inspeccion','retenida','liberada','liberada_condicionada')),
  folio_approval text,
  autorizada_por uuid references perfiles(id),
  certificado_url text
);
```

**Dos reglas de negocio que van como función, no como simple columna:**

```sql
-- Reapertura automática si la verificación de eficacia falla
create or replace function trigger_reapertura_nc()
returns trigger language plpgsql as $$
begin
  if new.resultado = 'no_eficaz' then
    update nc_registro set estado = 'reabierta' where id = new.nc_id;
  end if;
  return new;
end; $$;
create trigger on_verificacion_no_eficaz after insert on nc_verificaciones
for each row execute function trigger_reapertura_nc();

-- El gate: no se puede liberar una obra con Mayores/Críticas abiertas vinculadas
create or replace function puede_liberar_gate(p_obra text)
returns boolean language sql stable as $$
  select not exists (
    select 1 from nc_registro
    where obra_proceso = p_obra and severidad in ('critica','mayor')
      and estado not in ('cerrada')
  );
$$;
-- la app llama a esta función antes de permitir el Approval de liberación;
-- la liberación condicionada (con NC menores abiertas) requiere además el visto del Gerente de Ingeniería — se valida en la capa de aplicación, no en la base.
```

---

## 5. Postventa

Es el único módulo con **los dos tipos** de acceso externo activos simultáneamente: reporte
recurrente por obra (tipo B) para nuevas fallas, y encuesta de un solo uso (tipo A) al cerrar.

```sql
create table pv_obras (
  id uuid primary key default gen_random_uuid(),
  obra text not null,
  centro_costo text,
  cliente text,
  fecha_activacion date default current_date,
  fecha_fin_garantia date not null
  -- el token recurrente vive en postventa_accesos_obra, referenciado por obra
);

create table pv_tickets (
  id uuid primary key default gen_random_uuid(),
  numero_ticket text unique not null,    -- PV-QUI01-2026-007
  fecha_reporte timestamptz default now(),
  canal_ingreso text default 'forms',
  obra text not null, centro_costo text,
  cliente text, reportante text, rol_reportante text,
  correo text, telefono text,
  tipologia text, ubicacion text,
  descripcion_falla text not null,
  severidad text not null check (severidad in ('s1_critica','s2_alta','s3_media','s4_cosmetica')),
  imputabilidad text check (imputabilidad in ('garantia','no_imputable','mixta')),
  responsable_id uuid references perfiles(id),
  fecha_asignacion date, fecha_inspeccion date, fecha_plan_accion date,
  costo_estimado numeric, costo_real numeric,
  fecha_inicio_ejecucion date, fecha_termino date, fecha_acta_conformidad date,
  estado text not null default 'reportado' check (estado in (
    'reportado','triage','asignado','en_inspeccion','en_plan','en_aprobacion',
    'en_ejecucion','en_verificacion','cerrado'
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
  fecha_planificada date, fecha_real date,
  materiales_recursos text, hh numeric,
  costo_materiales numeric, costo_hh_subcontrato numeric, costo_total numeric,
  estado text default 'planificada' check (estado in ('planificada','en_curso','terminada'))
);

create table pv_actas_conformidad (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references pv_tickets(id),
  descripcion_trabajos text,
  responsable_tecnico_id uuid references perfiles(id),
  fecha_inicio_trabajos date, fecha_termino_trabajos date,
  firmante_cliente_nombre text, firmante_cliente_rut text, firmante_cliente_cargo text,
  fecha_firma date,
  garantia_dias int default 90,
  observaciones text
);
```

**RPC externa tipo B** — reportar una falla nueva, sin token de un solo uso:

```sql
create or replace function reportar_ticket_postventa(p_token uuid, p_datos jsonb)
returns text language plpgsql security definer as $$
declare v_obra text; v_cc text; v_numero text;
begin
  select obra, centro_costo into v_obra, v_cc from postventa_accesos_obra
  where token = p_token and activo and current_date <= fecha_fin_garantia;

  if v_obra is null then
    raise exception 'Acceso inválido o garantía vencida';
  end if;

  v_numero := 'PV-' || v_obra || '-' || extract(year from now()) || '-' ||
    lpad((select count(*) + 1 from pv_tickets where obra = v_obra and
      fecha_reporte >= date_trunc('year', now()))::text, 3, '0');

  insert into pv_tickets (numero_ticket, obra, centro_costo, cliente, reportante, rol_reportante,
    correo, telefono, tipologia, ubicacion, descripcion_falla)
  values (v_numero, v_obra, v_cc, p_datos->>'cliente', p_datos->>'reportante', p_datos->>'rol_reportante',
    p_datos->>'correo', p_datos->>'telefono', p_datos->>'tipologia', p_datos->>'ubicacion', p_datos->>'descripcion');

  return v_numero;
end; $$;
grant execute on function reportar_ticket_postventa(uuid, jsonb) to anon;
```

*(nótese: este token nunca se marca "usado" — se reutiliza para todos los reportes de la obra
durante la garantía. La encuesta de cierre, en cambio, usa exactamente el mismo patrón de
`encuestas_token` de la sección 3, con `modulo='postventa'` y `tipo='encuesta_cierre_ticket'`.)*

---

## 6. Integraciones entre módulos (no son 5 sistemas aislados)

- Una alerta roja de **Satisfacción** (`sat_alertas`) puede generar una **No Conformidad** externa
  automáticamente (`nc_registro.fuente = 'encuesta'`).
- Un hallazgo de **Auditoría** (`nc_auditorias`) se convierte en **No Conformidad** con un clic
  (`nc_registro.tipo_origen = 'interna_auditoria'`).
- Un evento grave en `prov_eventos` (**Proveedores**) puede quedar referenciado desde una
  **No Conformidad** vía `atribuible_a`.
- Un ticket de **Postventa** con reclamo formal del cliente puede generar una NC externa
  (`nc_registro.fuente = 'postventa'`).
- Todas comparten el mismo `perfiles` / `modulo_accesos` — una persona con acceso a dos módulos
  usa la misma cuenta en ambos.

---

## 7. Lo que falta antes de implementar

- Definir los `check` de severidad/estado con más detalle donde la app lo requiera (arriba están
  los valores confirmados en los documentos; cualquier ajuste de vocabulario es sencillo de
  renombrar antes de crear las tablas).
- Cargar los catálogos maestros iniciales: `eva_dimensiones` + `eva_criterios` (Anexo A de RRHH),
  `prov_criterios` + `prov_pesos` + `prov_rangos` (sección 9-10 de Proveedores),
  `sat_dimensiones` (sección 4.1 de Satisfacción).
- El detalle aritmético completo de ISC/NPS y de la consolidación ponderada de Proveedores
  (fórmulas exactas ya están en los documentos fuente) se implementa en las funciones marcadas
  arriba — quedaron con la estructura lista, el cálculo se completa al construir cada módulo.
