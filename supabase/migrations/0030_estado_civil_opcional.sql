-- =====================================================================
-- 0030_estado_civil_opcional.sql   (nov. 2026, a pedido)
--
-- 1. En el checklist de Contratación, "Estado Civil (certificado/
--    declaración)" pasa a ser OPCIONAL (codigo 'estado_civil').
-- 2. De aquí en adelante, cuando un admin cambia el checklist (en
--    Administración -> Checklist de documentos: obligatorio, activo, si
--    aplica a administrativo u operativo), las contrataciones en curso se
--    recalculan al tiro. Antes solo se recalculaban al subir o borrar un
--    documento.
-- 3. Recalcula ahora las contrataciones en curso: las que solo esperaban
--    el estado civil pasan a "documentos completos".
--
-- Requiere la 0029 (recalcular_estado_contratacion). Se puede correr más
-- de una vez.
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar y Run. O:
--   node supabase\mantencion\sql.mjs supabase\migrations\0030_estado_civil_opcional.sql --aplicar
-- =====================================================================

do $$
begin
  if to_regprocedure('public.recalcular_estado_contratacion(uuid)') is null then
    raise exception 'Primero corre la migración 0029_correo_contratacion_digitado.sql y después esta.';
  end if;
end $$;

-- 2. Recalcular cuando cambia el checklist ------------------------------
create or replace function public.recalcular_contrataciones_por_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalcular_estado_contratacion(c.id)
  from public.contrataciones c
  where c.estado::text not in ('contratado', 'anulada');
  return null;
end;
$$;
revoke all on function public.recalcular_contrataciones_por_checklist() from public, anon, authenticated;

drop trigger if exists trg_recalcular_contrataciones_por_checklist on public.documentos_checklist;
create trigger trg_recalcular_contrataciones_por_checklist
  after insert or delete or update of obligatorio, activo, aplica_administrativo, aplica_operativo
  on public.documentos_checklist
  for each statement execute function public.recalcular_contrataciones_por_checklist();

-- 1. Estado civil opcional (con el trigger ya creado, esto recalcula) -----
update public.documentos_checklist
   set obligatorio = false
 where codigo = 'estado_civil' and obligatorio;

-- 3. Por si ya estaba opcional: recalcular igual -------------------------
do $$
begin
  perform public.recalcular_estado_contratacion(c.id)
  from public.contrataciones c
  where c.estado::text not in ('contratado', 'anulada');
end $$;

select
  'Estado civil opcional' as resultado,
  (select case when obligatorio then 'Obligatorio' else 'Opcional' end
     from public.documentos_checklist where codigo = 'estado_civil') as estado_civil,
  (select count(*) from public.contrataciones where estado = 'documentos_completos') as con_documentos_completos,
  (select count(*) from public.contrataciones where estado = 'en_proceso') as en_proceso;
