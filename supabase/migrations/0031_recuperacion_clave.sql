-- =====================================================================
-- 0031_recuperacion_clave.sql   (nov. 2026, a pedido)
--
-- Registro de los correos de "¿Olvidaste tu contraseña?" que manda la Edge
-- Function recuperar-clave (desde el buzón Metalium, ya no el correo de
-- Supabase). Sirve para limitar: 1 correo por minuto y 5 por hora por
-- correo, y 20 por hora por conexión (IP). La función borra lo que tenga
-- más de una semana.
--
-- Solo la usa la Edge Function (service_role): RLS activada y sin
-- políticas, así que desde la app nadie la puede leer ni escribir.
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar y Run. O:
--   node supabase\mantencion\sql.mjs supabase\migrations\0031_recuperacion_clave.sql --aplicar
-- Se puede correr más de una vez.
-- =====================================================================

create table if not exists public.recuperaciones_clave (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  created_at timestamptz not null default now()
);
comment on table public.recuperaciones_clave is
  'Correos de recuperación de contraseña enviados por la Edge Function recuperar-clave (para limitar envíos). Ver 0031.';

create index if not exists recuperaciones_clave_email_idx on public.recuperaciones_clave (email, created_at desc);
create index if not exists recuperaciones_clave_ip_idx on public.recuperaciones_clave (ip, created_at desc);

alter table public.recuperaciones_clave enable row level security;
revoke all on public.recuperaciones_clave from anon, authenticated;

select 'Registro de recuperación de contraseña listo' as resultado,
       (select count(*) from public.recuperaciones_clave) as registros;
