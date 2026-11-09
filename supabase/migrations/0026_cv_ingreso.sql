-- =====================================================================
-- 0026_cv_ingreso.sql   (nov. 2026, a pedido)
--
-- En una solicitud de Ingreso, quien solicita puede adjuntar (opcional) los
-- CV de candidatos que ya entrevistó o reclutó: varios archivos o una
-- carpeta. Quedan en detalle.cvs = [{ path, nombre, tipo_mime, bytes }] y
-- los archivos en el bucket privado 'solicitud-adjuntos' (0022), dentro de
-- la carpeta del usuario: <id del usuario>/cv/...
--
-- Quién los puede abrir: no cambia nada. La política de Storage de 0022
-- (puede_ver_adjunto_solicitud) ya deja ver a RRHH y admin todo el bucket,
-- y a cada usuario su propia carpeta. Los aprobadores NO ven los CV.
--
-- Esta migración solo amplía la revisión que hace la base al guardar la
-- solicitud (validar_adjunto_solicitud, mismo trigger de 0022): cada CV
-- tiene que estar en la carpeta de quien crea la solicitud y existir de
-- verdad en Storage, y como máximo 20 por solicitud. Lo de 0022 sobre el
-- documento adjunto de Desvinculación queda exactamente igual.
--
-- Sin esta migración la app funciona igual (solo falta esa revisión).
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar y Run. O:
--   node supabase\mantencion\sql.mjs supabase\migrations\0026_cv_ingreso.sql --aplicar
-- Se puede correr más de una vez.
-- =====================================================================

create or replace function public.validar_adjunto_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
  v_cv jsonb;
  v_cv_path text;
begin
  -- Un UPDATE que no toca el detalle (aprobar, marcar procesado...) no se
  -- revisa: las desvinculaciones antiguas sin adjunto siguen su curso.
  if tg_op = 'UPDATE' and new.detalle is not distinct from old.detalle then
    return new;
  end if;

  v_path := nullif(trim(new.detalle -> 'adjunto' ->> 'path'), '');

  if new.tipo::text = 'desvinculacion'
     and new.detalle ->> 'causal' = 'Renuncia voluntaria'
     and v_path is null
  then
    raise exception 'Para una desvinculación por Renuncia voluntaria es obligatorio adjuntar la carta de renuncia firmada.';
  end if;

  if v_path is not null then
    if split_part(v_path, '/', 1) is distinct from new.solicitante_id::text then
      raise exception 'El documento adjunto no es válido (no lo subió quien crea la solicitud).';
    end if;
    if not exists (
      select 1 from storage.objects where bucket_id = 'solicitud-adjuntos' and name = v_path
    ) then
      raise exception 'No se encontró el documento adjunto. Vuelve a adjuntarlo.';
    end if;
  end if;

  -- CV de candidatos (Ingreso, nov. 2026)
  if jsonb_typeof(new.detalle -> 'cvs') = 'array' then
    if jsonb_array_length(new.detalle -> 'cvs') > 20 then
      raise exception 'Se pueden adjuntar como máximo 20 CV por solicitud.';
    end if;
    for v_cv in select value from jsonb_array_elements(new.detalle -> 'cvs') loop
      v_cv_path := nullif(trim(v_cv ->> 'path'), '');
      if v_cv_path is null then
        raise exception 'Uno de los CV adjuntos no es válido (no trae el archivo). Vuelve a adjuntarlo.';
      end if;
      if split_part(v_cv_path, '/', 1) is distinct from new.solicitante_id::text then
        raise exception 'El CV "%" no es válido (no lo subió quien crea la solicitud).', coalesce(v_cv ->> 'nombre', v_cv_path);
      end if;
      if not exists (
        select 1 from storage.objects where bucket_id = 'solicitud-adjuntos' and name = v_cv_path
      ) then
        raise exception 'No se encontró el CV "%". Vuelve a adjuntarlo.', coalesce(v_cv ->> 'nombre', v_cv_path);
      end if;
    end loop;
  end if;

  return new;
end;
$$;

-- Mismo trigger de 0022 (por si se corre en una base donde faltara)
drop trigger if exists trg_validar_adjunto_solicitud on public.solicitudes;
create trigger trg_validar_adjunto_solicitud
  before insert or update of detalle on public.solicitudes
  for each row execute function public.validar_adjunto_solicitud();

select 'Revisión de CV de Ingreso activada (máx. 20 por solicitud, en la carpeta de quien solicita)' as resultado;
