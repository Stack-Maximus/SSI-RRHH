-- ============================================================================
-- Migración: en Evaluación de Proveedores el comité desaparece — lo hace GOL
-- directamente — y la comunicación al proveedor pasa a gestionarse dentro del
-- sistema: carta precargada según la clasificación, editable por GOL, enviada
-- y registrada.
--
-- Contexto de lo que había antes: el botón «Comunicar al proveedor» solo
-- cambiaba el estado a 'comunicada' y ponía la fecha. No se enviaba nada, no
-- quedaba el texto de lo comunicado, y la columna url_carta nunca se llenaba.
--
-- Sobre el estado 'en_comite': se conserva el VALOR tal cual, a propósito. Lo
-- escribe la función intentar_consolidar_proveedor y puede haber evaluaciones
-- en ese estado ahora mismo; renombrarlo obligaría a migrar filas y tocar la
-- RPC para un beneficio puramente cosmético. En la interfaz aparece como
-- «Pendiente de comunicar (GOL)», que es lo que la gente lee.
--
-- Es idempotente: se puede correr más de una vez.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. El rol 'comite' pasa a ser 'gol'.
--
--    GOL ya era una de las 6 áreas evaluadoras; ahora además es quien revisa
--    el consolidado y comunica. Los usuarios que hoy tengan 'comite' se migran
--    a 'gol' — si no se migraran quedarían sin panel, porque de acá en adelante
--    nada mira ese rol.
-- ----------------------------------------------------------------------------

update modulo_accesos
set rol = 'gol'
where modulo = 'proveedores' and rol = 'comite';

/**
 * ¿Esta persona es GOL en Proveedores? Es el reemplazo de la pregunta
 * «¿es del comité?» que estaba desparramada por las políticas.
 */
create or replace function es_gol_proveedores()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select es_admin() or exists (
    select 1 from modulo_accesos
    where usuario_id = auth.uid() and modulo = 'proveedores' and rol = 'gol'
  );
$$;

grant execute on function es_gol_proveedores() to authenticated;

/**
 * es_rrhh_personal() se define en migracion_rls_gestion_trabajadores.sql, que es
 * un archivo distinto y puede no estar aplicado. Se recrea acá con la MISMA
 * definición para que esta migración no dependa de haber corrido ese paso: si ya
 * existe, queda idéntica; si no existía, ahora sí.
 */
create or replace function es_rrhh_personal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from modulo_accesos where usuario_id = auth.uid() and modulo = 'personal' and rol = 'rrhh'
  );
$$;

grant execute on function es_rrhh_personal() to authenticated;

-- GOL necesita ver y corregir el detalle de TODAS las áreas para poder revisar
-- el consolidado — no solo el de su propia área, que es lo que le dejaría la
-- condición `area = rol_en_modulo(...)` ahora que su rol es 'gol'.
drop policy if exists "proveedores_delegado_edita_su_area" on prov_detalle;
create policy "proveedores_delegado_edita_su_area" on prov_detalle
  for all to authenticated
  using (
    tiene_acceso('proveedores')
    and (es_gol_proveedores() or area = rol_en_modulo('proveedores'))
  )
  with check (
    tiene_acceso('proveedores')
    and (es_gol_proveedores() or area = rol_en_modulo('proveedores'))
  );

-- La política que permitía al comité gestionar accesos del módulo.
drop policy if exists "admin_rrhh_gestiona_modulo_accesos" on modulo_accesos;
create policy "admin_rrhh_gestiona_modulo_accesos" on modulo_accesos
  for all to authenticated
  using (
    es_admin()
    or (modulo = 'proveedores' and es_gol_proveedores())
    or es_rrhh_personal()
  )
  with check (
    es_admin()
    or (modulo = 'proveedores' and es_gol_proveedores())
    or es_rrhh_personal()
  );

-- El aviso de «consolidado listo» iba al comité; ahora va a GOL.
create or replace function trigger_notificar_prov_en_comite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prov text;
begin
  if new.estado = 'en_comite' and old.estado is distinct from new.estado then
    select razon_social into v_prov from prov_proveedores where id = new.proveedor_id;
    perform notificar_rol_en_modulo(
      'proveedores', 'gol',
      'Evaluación de proveedor lista para comunicar',
      coalesce(v_prov, 'Un proveedor') || ' quedó consolidado con nota ' ||
      coalesce(new.total_ponderado::text, '—') || ' (' ||
      replace(coalesce(new.clasificacion, 'sin clasificar'), '_', ' ') ||
      '). Corresponde revisar y enviar la carta.'
    );
  end if;
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. Plantillas de carta, una por clasificación.
--
--    Una carta de «condicionado con plan de acción a 10 días» y una de
--    «proveedor preferente» no se parecen en nada; con una sola plantilla
--    genérica GOL termina reescribiéndola completa cada vez.
--
--    Los marcadores se reemplazan al momento de precargar la carta:
--      {{proveedor}} {{rut}} {{ciclo}} {{obra}} {{total}} {{clasificacion}}
--      {{decision}} {{notas_areas}} {{fecha}} {{plazo_plan}} {{fecha_reeval}}
--      {{veto}}
-- ----------------------------------------------------------------------------

create table if not exists prov_carta_plantillas (
  clasificacion text primary key check (clasificacion = any (array['a_preferente','b_aprobado','c_condicionado','d_no_aprobado'])),
  asunto text not null,
  cuerpo_html text not null,
  actualizada_en timestamptz not null default now()
);

alter table prov_carta_plantillas enable row level security;

drop policy if exists "prov_lee_plantillas" on prov_carta_plantillas;
create policy "prov_lee_plantillas" on prov_carta_plantillas
  for select to authenticated
  using (tiene_acceso('proveedores') or es_admin());

drop policy if exists "gol_edita_plantillas" on prov_carta_plantillas;
create policy "gol_edita_plantillas" on prov_carta_plantillas
  for all to authenticated
  using (es_gol_proveedores())
  with check (es_gol_proveedores());

-- Siembra sin sobreescribir: si GOL ya ajustó una plantilla desde la app, se
-- respeta. Para volver al texto original hay que borrar la fila y recorrer esto.
insert into prov_carta_plantillas (clasificacion, asunto, cuerpo_html) values

('a_preferente',
 'Resultado de evaluación de desempeño como proveedor — {{proveedor}}',
 '<p>Estimados señores de <strong>{{proveedor}}</strong>:</p>
<p>Junto con saludar, comunicamos el resultado de la evaluación de desempeño correspondiente al período
<strong>{{ciclo}}</strong>.</p>
<p>Su empresa obtuvo una calificación de <strong>{{total}}</strong> sobre 5,00, lo que la sitúa en la categoría
<strong>A · Proveedor Preferente</strong>. Este es el nivel más alto de nuestra escala y reconoce un desempeño
sostenido por sobre el estándar exigido.</p>
{{notas_areas}}
<p><strong>Qué implica esta categoría:</strong> {{decision}}</p>
<p>Agradecemos el compromiso demostrado y esperamos mantener esta relación de trabajo. Cualquier consulta sobre
esta evaluación puede dirigirla a la Gerencia de Operaciones Logísticas.</p>
<p>Atentamente,<br><strong>Gerencia de Operaciones Logísticas</strong><br>Metalium SpA</p>'),

('b_aprobado',
 'Resultado de evaluación de desempeño como proveedor — {{proveedor}}',
 '<p>Estimados señores de <strong>{{proveedor}}</strong>:</p>
<p>Junto con saludar, comunicamos el resultado de la evaluación de desempeño correspondiente al período
<strong>{{ciclo}}</strong>.</p>
<p>Su empresa obtuvo una calificación de <strong>{{total}}</strong> sobre 5,00, lo que la sitúa en la categoría
<strong>B · Aprobado</strong>. Su homologación se mantiene vigente sin restricciones.</p>
{{notas_areas}}
<p><strong>Qué implica esta categoría:</strong> {{decision}}</p>
<p>Le señalamos las oportunidades de mejora identificadas en la evaluación para que puedan ser abordadas durante
el próximo período:</p>
<p><em>[Detallar acá las oportunidades de mejora concretas por área.]</em></p>
<p>Atentamente,<br><strong>Gerencia de Operaciones Logísticas</strong><br>Metalium SpA</p>'),

('c_condicionado',
 'Resultado de evaluación de desempeño — requerimiento de plan de acción — {{proveedor}}',
 '<p>Estimados señores de <strong>{{proveedor}}</strong>:</p>
<p>Comunicamos el resultado de la evaluación de desempeño correspondiente al período <strong>{{ciclo}}</strong>.</p>
<p>Su empresa obtuvo una calificación de <strong>{{total}}</strong> sobre 5,00, lo que la sitúa en la categoría
<strong>C · Condicionado</strong>.</p>
{{notas_areas}}
{{veto}}
<p><strong>Qué implica esta categoría:</strong> {{decision}}</p>
<p><strong>Lo que requerimos de ustedes:</strong> un plan de acción formal que aborde los aspectos evaluados bajo el
estándar, con responsables y plazos, dentro de <strong>{{plazo_plan}}</strong>. Se realizará una reevaluación el
<strong>{{fecha_reeval}}</strong> para verificar el avance comprometido.</p>
<p>Mientras la condición se mantenga, las compras y adjudicaciones a su empresa requieren el visto del Jefe de
Operaciones Logísticas.</p>
<p>Quedamos disponibles para una reunión de trabajo si estiman que ayuda a construir ese plan.</p>
<p>Atentamente,<br><strong>Gerencia de Operaciones Logísticas</strong><br>Metalium SpA</p>'),

('d_no_aprobado',
 'Resultado de evaluación de desempeño — suspensión del registro de homologados — {{proveedor}}',
 '<p>Estimados señores de <strong>{{proveedor}}</strong>:</p>
<p>Comunicamos el resultado de la evaluación de desempeño correspondiente al período <strong>{{ciclo}}</strong>.</p>
<p>Su empresa obtuvo una calificación de <strong>{{total}}</strong> sobre 5,00, lo que la sitúa en la categoría
<strong>D · No Aprobado</strong>.</p>
{{notas_areas}}
{{veto}}
<p><strong>Consecuencia de esta calificación:</strong> {{decision}}</p>
<p>Esto significa que, a partir de la fecha de esta comunicación, no se emitirán nuevas órdenes de compra ni se
suscribirán nuevos contratos con su empresa. Las obligaciones en curso se cumplirán según lo pactado.</p>
<p>El reingreso al registro de proveedores homologados es posible mediante el proceso de homologación completa
(GOL-PRO-01), presentando las evidencias que acrediten la corrección de los aspectos observados.</p>
<p>Si consideran que esta evaluación no refleja su desempeño, pueden presentar sus antecedentes por escrito a la
Gerencia de Operaciones Logísticas dentro de los 10 días hábiles siguientes.</p>
<p>Atentamente,<br><strong>Gerencia de Operaciones Logísticas</strong><br>Metalium SpA</p>')

on conflict (clasificacion) do nothing;


-- ----------------------------------------------------------------------------
-- 3. La carta enviada, como registro.
--
--    Guarda el texto exacto que salió, a quién, quién lo envió y cuándo. Es lo
--    que permite responder «¿qué le comunicamos a este proveedor en julio?»
--    dos años después, y lo que la auditoría va a pedir.
-- ----------------------------------------------------------------------------

create table if not exists prov_cartas (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references prov_evaluaciones(id) on delete cascade,
  plantilla_clasificacion text,
  asunto text not null,
  cuerpo_html text not null,
  destinatarios text[] not null default '{}',
  copias text[] not null default '{}',
  estado text not null default 'borrador' check (estado = any (array['borrador','enviada','error'])),
  enviada_por uuid references perfiles(id),
  enviada_en timestamptz,
  error_detalle text,
  creada_en timestamptz not null default now()
);

create index if not exists prov_cartas_evaluacion_idx on prov_cartas (evaluacion_id);

alter table prov_cartas enable row level security;

drop policy if exists "prov_lee_cartas" on prov_cartas;
create policy "prov_lee_cartas" on prov_cartas
  for select to authenticated
  using (tiene_acceso('proveedores') or es_admin());

drop policy if exists "gol_gestiona_cartas" on prov_cartas;
create policy "gol_gestiona_cartas" on prov_cartas
  for all to authenticated
  using (es_gol_proveedores())
  with check (es_gol_proveedores());

-- Una carta ya enviada no se edita ni se borra: es el registro de lo que
-- efectivamente salió. Si hay que rectificar, se envía una carta nueva.
create or replace function prov_cartas_enviadas_inmutables()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'enviada' then
    raise exception 'Una carta ya enviada no se puede % — si hay que rectificar, envía una carta nueva',
      case tg_op when 'UPDATE' then 'modificar' else 'eliminar' end;
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists on_prov_cartas_inmutables on prov_cartas;
create trigger on_prov_cartas_inmutables
  before update or delete on prov_cartas
  for each row execute function prov_cartas_enviadas_inmutables();


-- ----------------------------------------------------------------------------
-- 4. Envío.
--
--    Va por función y no desde el navegador porque la Edge Function send-email
--    no maneja CORS: solo acepta llamadas servidor-a-servidor. Este es el mismo
--    camino que ya usan las notificaciones internas (pg_net → send-email).
--
--    Se manda un correo por destinatario en vez de uno con todos en copia: así
--    el proveedor no ve las direcciones internas que se pusieron en copia, que
--    con un solo envío quedarían expuestas en el encabezado.
-- ----------------------------------------------------------------------------

create or replace function prov_enviar_carta(
  p_evaluacion_id uuid,
  p_asunto text,
  p_cuerpo_html text,
  p_destinatarios text[],
  p_copias text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev prov_evaluaciones;
  v_carta_id uuid;
  v_edge_url text;
  v_anon_key text;
  v_dest text;
  v_enviados integer := 0;
  v_todos text[];
  v_correo_gol text;
  v_pie text;
begin
  if not es_gol_proveedores() then
    raise exception 'Solo GOL puede comunicar el resultado a un proveedor';
  end if;

  select * into v_ev from prov_evaluaciones where id = p_evaluacion_id;
  if v_ev.id is null then
    raise exception 'La evaluación no existe';
  end if;

  if v_ev.estado not in ('en_comite', 'consolidada') then
    raise exception 'Esta evaluación no está en etapa de comunicación (estado actual: %)', v_ev.estado;
  end if;

  if coalesce(array_length(p_destinatarios, 1), 0) = 0 then
    raise exception 'Hace falta al menos un destinatario';
  end if;

  if coalesce(trim(p_asunto), '') = '' or coalesce(trim(p_cuerpo_html), '') = '' then
    raise exception 'La carta necesita asunto y cuerpo';
  end if;

  insert into prov_cartas (evaluacion_id, plantilla_clasificacion, asunto, cuerpo_html,
                           destinatarios, copias, estado, enviada_por, enviada_en)
  values (p_evaluacion_id, v_ev.clasificacion, trim(p_asunto), p_cuerpo_html,
          p_destinatarios, coalesce(p_copias, '{}'), 'enviada', auth.uid(), now())
  returning id into v_carta_id;

  select valor into v_edge_url from app_config where clave = 'edge_function_url';
  select valor into v_anon_key from app_config where clave = 'edge_function_key';

  -- Las respuestas del proveedor tienen que llegarle a una persona, no al buzón
  -- de notificaciones automáticas.
  select email into v_correo_gol from auth.users where id = auth.uid();

  v_pie := 'Carta emitida por la Gerencia de Operaciones Logísticas de Metalium SpA a través de su ' ||
           'Sistema de Gestión de Calidad. Para responder, escriba a ' ||
           coalesce(v_correo_gol, 'la Gerencia de Operaciones Logísticas') || '.';

  if v_edge_url is not null and v_edge_url <> '' then
    v_todos := p_destinatarios || coalesce(p_copias, '{}');
    foreach v_dest in array v_todos loop
      if coalesce(trim(v_dest), '') <> '' then
        perform net.http_post(
          url := v_edge_url,
          headers := jsonb_build_object('Content-Type', 'application/json',
                                        'Authorization', 'Bearer ' || v_anon_key),
          body := jsonb_build_object(
            'to', trim(v_dest),
            'titulo', trim(p_asunto),
            'mensaje', '',
            'detalle_html', p_cuerpo_html,
            -- Una carta formal no lleva el pie de "no responder este correo".
            'pie', v_pie,
            'responder_a', v_correo_gol,
            'guardar', true,
            'ancho', 680
          )
        );
        v_enviados := v_enviados + 1;
      end if;
    end loop;
  end if;

  -- La evaluación pasa a comunicada y el proveedor queda con su clasificación
  -- vigente. Antes esto lo hacía el frontend en dos updates separados, que
  -- podían quedar a medias si el segundo fallaba.
  update prov_evaluaciones
    set estado = 'comunicada',
        fecha_envio_carta = current_date
    where id = p_evaluacion_id;

  update prov_proveedores
    set clasificacion_vigente = v_ev.clasificacion,
        fecha_ultima_evaluacion = current_date
    where id = v_ev.proveedor_id;

  return jsonb_build_object(
    'carta_id', v_carta_id,
    'correos_despachados', v_enviados,
    'requiere_plan', v_ev.clasificacion in ('c_condicionado', 'd_no_aprobado')
  );
end;
$$;

grant execute on function prov_enviar_carta(uuid, text, text, text[], text[]) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Plan de acción del proveedor.
--
--    prov_planes_accion existía en el esquema desde el principio pero nada la
--    usaba. Para C y D es obligatoria: son justamente las categorías donde la
--    decisión asociada exige compromisos con plazo y reevaluación.
-- ----------------------------------------------------------------------------

alter table prov_planes_accion add column if not exists creado_por uuid references perfiles(id);
alter table prov_planes_accion add column if not exists creado_en timestamptz default now();

drop policy if exists "proveedores_acceso_planes" on prov_planes_accion;
create policy "proveedores_acceso_planes" on prov_planes_accion
  for select to authenticated
  using (tiene_acceso('proveedores') or es_admin());

drop policy if exists "gol_gestiona_planes" on prov_planes_accion;
create policy "gol_gestiona_planes" on prov_planes_accion
  for all to authenticated
  using (es_gol_proveedores())
  with check (es_gol_proveedores());

/**
 * Cierra la evaluación. Si la clasificación es C o D exige que exista un plan
 * de acción registrado — la validación va acá y no solo en la pantalla, para
 * que no se pueda cerrar por otra vía una evaluación que quedó sin compromisos.
 */
create or replace function prov_cerrar_evaluacion(p_evaluacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev prov_evaluaciones;
  v_planes integer;
begin
  if not es_gol_proveedores() then
    raise exception 'Solo GOL puede cerrar la evaluación de un proveedor';
  end if;

  select * into v_ev from prov_evaluaciones where id = p_evaluacion_id;
  if v_ev.id is null then
    raise exception 'La evaluación no existe';
  end if;

  if v_ev.estado <> 'comunicada' then
    raise exception 'Solo se puede cerrar una evaluación ya comunicada (estado actual: %)', v_ev.estado;
  end if;

  if v_ev.clasificacion in ('c_condicionado', 'd_no_aprobado') then
    select count(*) into v_planes from prov_planes_accion where evaluacion_id = p_evaluacion_id;
    if v_planes = 0 then
      raise exception 'Una evaluación % necesita un plan de acción registrado antes de cerrarse',
        replace(v_ev.clasificacion, '_', ' ');
    end if;
  end if;

  update prov_evaluaciones set estado = 'cerrada' where id = p_evaluacion_id;
end;
$$;

grant execute on function prov_cerrar_evaluacion(uuid) to authenticated;

-- Aviso interno cuando se comunica una C o D: son las que arrastran trabajo
-- para adquisiciones y para el área que compra.
create or replace function trigger_notificar_prov_comunicada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prov text;
begin
  if new.estado = 'comunicada' and old.estado is distinct from new.estado
     and new.clasificacion in ('c_condicionado', 'd_no_aprobado') then
    select razon_social into v_prov from prov_proveedores where id = new.proveedor_id;

    perform notificar_modulo(
      'proveedores',
      'Proveedor ' || replace(new.clasificacion, '_', ' ') || ' — ' || coalesce(v_prov, ''),
      'Se comunicó el resultado a ' || coalesce(v_prov, 'el proveedor') || ' con nota ' ||
      coalesce(new.total_ponderado::text, '—') || '. ' ||
      case when new.clasificacion = 'd_no_aprobado'
           then 'Queda suspendido del registro de homologados: no emitir nuevas OC ni contratos.'
           else 'Compras y adjudicaciones requieren visto del Jefe GOL hasta la reevaluación.' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_prov_comunicada on prov_evaluaciones;
create trigger on_prov_comunicada
  after update on prov_evaluaciones
  for each row execute function trigger_notificar_prov_comunicada();
