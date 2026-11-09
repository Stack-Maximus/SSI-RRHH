-- =====================================================================
-- 0027_alertas_vencimiento_contrato.sql   (nov. 2026, a pedido)
--
-- Activa la ALERTA DIARIA DE CONTRATOS POR VENCER (Edge Function
-- vencimientos-contrato): todos los días a las 12:00 UTC (09:00 en Chile
-- con horario de verano, 08:00 en invierno) pg_cron llama a la función, y
-- esta manda UN resumen por persona: a RRHH con todos los contratos, y a
-- cada administrador de obra con los de su obra.
--
-- Cada contrato se avisa una vez por tramo (a los 30 y a los 15 días). Lo
-- ya avisado queda en public.avisos_vencimiento_contrato, así que nunca se
-- repite y, si un día no corre, se pone al día al siguiente. La primera vez
-- avisa todos los contratos que ya vencen dentro de 30 días.
--
-- Qué crea:
--   1. Extensiones pg_cron (programación) y pg_net (llamadas HTTP).
--   2. Tabla avisos_vencimiento_contrato (registro; RRHH y admin la pueden leer).
--   3. Una clave aleatoria en Vault ("alertas_vencimiento_secreto"): solo
--      quien la tiene puede disparar la función (la URL es pública).
--   4. alertas_vencimiento_secreto_ok(): la usa la Edge Function para
--      validar la clave (solo service_role).
--   5. disparar_alertas_vencimiento(opciones): llama a la Edge Function con
--      la clave. La usa el cron y sirve para probar (ver abajo). Solo se
--      puede ejecutar desde el SQL Editor (no desde la app).
--   6. El trabajo diario "alertas-vencimiento-contrato" en pg_cron.
--
-- ANTES: crear la Edge Function "vencimientos-contrato" en el Dashboard
-- (Edge Functions -> Deploy a new function -> nombre exacto
-- vencimientos-contrato), pegar supabase/dashboard/vencimientos-contrato/index.ts,
-- y en sus ajustes DESACTIVAR "Verify JWT" (la protege la clave de Vault).
--
-- PROBAR (SQL Editor), después de correr esto:
--   select public.disparar_alertas_vencimiento('{"simular": true}');
--   select public.disparar_alertas_vencimiento('{"prueba_a": "tu.correo@metalium.cl"}');
--   -- y unos segundos después, la respuesta de la función:
--   select id, status_code, content from net._http_response order by id desc limit 3;
-- "simular" no manda nada (dice qué avisaría y a quién); "prueba_a" manda
-- el resumen de RRHH solo a esa dirección, sin registrar nada.
-- Para mandar las alertas de verdad sin esperar al día siguiente:
--   select public.disparar_alertas_vencimiento();
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar y Run. O:
--   node supabase\mantencion\sql.mjs supabase\migrations\0027_alertas_vencimiento_contrato.sql --aplicar
-- Se puede correr más de una vez (no cambia la clave si ya existe).
-- =====================================================================

-- 1. Extensiones -----------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 2. Registro de lo avisado ------------------------------------------
create table if not exists public.avisos_vencimiento_contrato (
  id bigint generated always as identity primary key,
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  fecha_termino date not null,
  tramo smallint not null check (tramo in (15, 30)),
  enviado_at timestamptz not null default now(),
  constraint avisos_vencimiento_unico unique (trabajador_id, fecha_termino, tramo)
);
comment on table public.avisos_vencimiento_contrato is
  'Alertas de contrato por vencer ya enviadas (una por trabajador, fecha de término y tramo de 30 o 15 días). La escribe la Edge Function vencimientos-contrato. Ver 0027.';

alter table public.avisos_vencimiento_contrato enable row level security;
drop policy if exists avisos_vencimiento_select on public.avisos_vencimiento_contrato;
create policy avisos_vencimiento_select on public.avisos_vencimiento_contrato
  for select to authenticated
  using (public.rol_actual() in ('admin', 'rrhh'));

-- 3. Clave en Vault ----------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'alertas_vencimiento_secreto') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'alertas_vencimiento_secreto',
      'Clave con la que pg_cron llama a la Edge Function vencimientos-contrato (migración 0027)');
  end if;
end $$;

-- 4. Validación de la clave (la llama la Edge Function) ---------------
create or replace function public.alertas_vencimiento_secreto_ok(p_secreto text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_secreto, '') <> ''
     and exists (
       select 1 from vault.decrypted_secrets s
       where s.name = 'alertas_vencimiento_secreto' and s.decrypted_secret = p_secreto
     );
$$;
revoke all on function public.alertas_vencimiento_secreto_ok(text) from public, anon, authenticated;
grant execute on function public.alertas_vencimiento_secreto_ok(text) to service_role;

-- 5. Disparo (cron y pruebas) -----------------------------------------
create or replace function public.disparar_alertas_vencimiento(p_opciones jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secreto text;
begin
  select s.decrypted_secret into v_secreto
  from vault.decrypted_secrets s where s.name = 'alertas_vencimiento_secreto';
  if v_secreto is null then
    raise exception 'Falta la clave alertas_vencimiento_secreto en Vault: vuelve a correr la migración 0027.';
  end if;
  -- Devuelve el id de la llamada; la respuesta queda en net._http_response
  return net.http_post(
    url := 'https://qpezxjcbypshdtfpcfvs.supabase.co/functions/v1/vencimientos-contrato',
    body := coalesce(p_opciones, '{}'::jsonb),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-alerta-secreto', v_secreto),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function public.disparar_alertas_vencimiento(jsonb) from public, anon, authenticated;

-- 6. Trabajo diario en pg_cron ---------------------------------------
do $$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'alertas-vencimiento-contrato';
  perform cron.schedule('alertas-vencimiento-contrato', '0 12 * * *', 'select public.disparar_alertas_vencimiento();');
end $$;

notify pgrst, 'reload schema';

select
  'Alerta de vencimientos programada' as resultado,
  (select schedule from cron.job where jobname = 'alertas-vencimiento-contrato') as horario_utc,
  (select count(*) from vault.secrets where name = 'alertas_vencimiento_secreto') as clave_en_vault,
  (select count(*) from public.avisos_vencimiento_contrato) as avisos_registrados;
