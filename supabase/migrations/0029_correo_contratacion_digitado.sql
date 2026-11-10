-- =====================================================================
-- 0029_correo_contratacion_digitado.sql   (nov. 2026, a pedido)
--
-- En Contratación, el "Correo electrónico" del checklist de documentos ya
-- no se sube como archivo: se DIGITA (es el campo contrataciones.
-- email_candidato). Este ítem del checklist (codigo 'correo_electronico')
-- sigue siendo obligatorio, pero se da por cumplido cuando la contratación
-- tiene un correo válido digitado (o, en las antiguas, si ya se había
-- subido un archivo).
--
-- Cambia el cálculo de "documentos completos" (actualizar_estado_contratacion
-- de 0002) para que cuente ese correo, y lo vuelve a calcular cuando se
-- digita o cambia el correo (o el tipo de trabajador, que cambia qué
-- documentos aplican). Al final recalcula las contrataciones en curso.
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar y Run. O:
--   node supabase\mantencion\sql.mjs supabase\migrations\0029_correo_contratacion_digitado.sql --aplicar
-- Se puede correr más de una vez.
-- =====================================================================

-- 1. El cálculo, en una función reutilizable ---------------------------
create or replace function public.recalcular_estado_contratacion(p_contratacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo public.tipo_trabajador_contratacion;
  v_estado_actual public.estado_contratacion;
  v_email text;
  v_faltantes integer;
begin
  select tipo_trabajador, estado, email_candidato into v_tipo, v_estado_actual, v_email
  from public.contrataciones where id = p_contratacion_id;

  if not found or v_estado_actual in ('contratado', 'anulada') then
    return;
  end if;

  select count(*) into v_faltantes
  from public.documentos_checklist dc
  where dc.activo = true
    and dc.obligatorio = true
    and (case when v_tipo = 'administrativo' then dc.aplica_administrativo else dc.aplica_operativo end)
    and not exists (
      select 1 from public.documentos_contratacion doc
      where doc.contratacion_id = p_contratacion_id and doc.checklist_item_id = dc.id
    )
    -- el correo se digita: cuenta como entregado si hay un correo válido
    and not (dc.codigo = 'correo_electronico' and coalesce(trim(v_email), '') ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

  update public.contrataciones
    set estado = case when v_faltantes = 0 then 'documentos_completos'::public.estado_contratacion else 'en_proceso'::public.estado_contratacion end
  where id = p_contratacion_id
    and estado is distinct from (case when v_faltantes = 0 then 'documentos_completos'::public.estado_contratacion else 'en_proceso'::public.estado_contratacion end);
end;
$$;
revoke all on function public.recalcular_estado_contratacion(uuid) from public, anon, authenticated;

-- 2. Al subir o borrar un documento (mismo trigger de 0002) -------------
create or replace function public.actualizar_estado_contratacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalcular_estado_contratacion(coalesce(new.contratacion_id, old.contratacion_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_actualizar_estado_contratacion on public.documentos_contratacion;
create trigger trg_actualizar_estado_contratacion
  after insert or delete on public.documentos_contratacion
  for each row execute function public.actualizar_estado_contratacion();

-- 3. Al digitar o cambiar el correo (o el tipo de trabajador) -----------
create or replace function public.estado_contratacion_por_datos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalcular_estado_contratacion(new.id);
  return null;
end;
$$;

drop trigger if exists trg_estado_contratacion_por_datos on public.contrataciones;
create trigger trg_estado_contratacion_por_datos
  after update of email_candidato, tipo_trabajador on public.contrataciones
  for each row execute function public.estado_contratacion_por_datos();

-- 4. Recalcular las contrataciones en curso ------------------------------
do $$
begin
  perform public.recalcular_estado_contratacion(c.id)
  from public.contrataciones c
  where c.estado::text not in ('contratado', 'anulada');
end $$;

select
  'Correo de contratación digitado' as resultado,
  (select count(*) from public.contrataciones where estado = 'documentos_completos') as con_documentos_completos,
  (select count(*) from public.contrataciones where estado = 'en_proceso') as en_proceso;
