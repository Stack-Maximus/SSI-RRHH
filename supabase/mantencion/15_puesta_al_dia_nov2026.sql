-- =====================================================================
-- 15_puesta_al_dia_nov2026.sql   (nov. 2026)
--
-- Pone al día lo que marcó la inspección (14_inspeccion_scripts.sql) el
-- 09-11-2026, de una sola vez y en el orden correcto:
--
--   0020 (solo secciones 2 y 3): Renovación aprobada -> además de la fecha,
--        deja el tipo de contrato del trabajador (Plazo Fijo / Obra o Faena /
--        Indefinido). La sección 1 de la 0020 NO va: es una versión antigua
--        de crear_solicitud_cambio() que la 0025 ya reemplaza.
--   0023 (sin su crear_solicitud_cambio): supervisores -> solicitantes,
--        política de subida de adjuntos y la restricción que impide volver a
--        asignar el rol Supervisor.
--   0025: crear_solicitud_cambio() con los mensajes que nombran trabajador y obra.
--   0026: revisión de los CV de Ingreso.
--
-- Cada parte es copia exacta de su migración (por eso la inspección las va
-- a reconocer como la versión al día). Todo o nada: si algo falla, no se
-- guarda nada. Se puede correr más de una vez.
--
-- SQL Editor (proyecto "SSI - RRHH"): pegar todo y Run. Después, correr de
-- nuevo 14_inspeccion_scripts.sql: 0020, 0023, 0025 y 0026 deben quedar OK.
-- =====================================================================

-- =========================== 0020 (secciones 2 y 3) ===========================
-- ---------------------------------------------------------------------
-- 2) Renovación aprobada -> fecha de término + tipo de contrato
--    Reemplaza la función de 0008 (mismo nombre, el trigger
--    trg_actualizar_fecha_termino_renovacion de 0008 la sigue llamando,
--    no hace falta recrearlo).
-- ---------------------------------------------------------------------
create or replace function public.actualizar_fecha_termino_por_renovacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date;
  v_tipo_ren text;
  v_indefinido boolean;
begin
  if new.tipo::text = 'renovacion'
     and new.estado = 'aprobada'
     and (old.estado is distinct from new.estado)
     and new.trabajador_id is not null
  then
    -- null en las renovaciones creadas antes de oct. 2026
    v_tipo_ren := new.detalle ->> 'tipo_renovacion';
    v_indefinido := coalesce((new.detalle ->> 'indefinido')::boolean, false)
                    or coalesce(v_tipo_ren = 'indefinido', false);

    if v_indefinido then
      -- El contrato pasa a indefinido: ya no vence.
      update public.trabajadores
        set contrato_indefinido = true,
            fecha_termino_contrato = null,
            tipo_contrato = case when v_tipo_ren is not null then 'Indefinido' else tipo_contrato end
        where id = new.trabajador_id;

    elsif v_tipo_ren = 'obra_faena' then
      -- Por obra o faena: termina con un hito de la obra (texto en
      -- detalle.hito_obra), no con una fecha -- por eso fecha_termino_contrato
      -- queda vacía y el trabajador no entra al aviso de vencimientos.
      update public.trabajadores
        set tipo_contrato = 'Obra o Faena',
            contrato_indefinido = false,
            fecha_termino_contrato = null
        where id = new.trabajador_id;
      -- El trigger BEFORE UPDATE OF tipo_contrato de 0013 vuelve a prender
      -- requiere_anexo_renovacion cuando el contrato CAMBIA a "Obra o Faena";
      -- pero esta renovación aprobada ES el anexo, así que se apaga de nuevo.
      -- Update aparte (no toca tipo_contrato, no re-dispara ese trigger).
      -- trg_apagar_requiere_anexo_renovacion (0013) hace lo mismo después;
      -- esto lo deja correcto sin depender del orden de los triggers.
      update public.trabajadores
        set requiere_anexo_renovacion = false
        where id = new.trabajador_id;

    elsif (new.detalle ->> 'nueva_fecha_termino') is not null then
      begin
        v_fecha := (new.detalle ->> 'nueva_fecha_termino')::date;
      exception when others then
        v_fecha := null;
      end;

      if v_fecha is not null then
        update public.trabajadores
          set fecha_termino_contrato = v_fecha,
              contrato_indefinido = false,
              tipo_contrato = case when v_tipo_ren = 'plazo' then 'Plazo Fijo' else tipo_contrato end
          where id = new.trabajador_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 3) Limpieza defensiva de la "entrega 18" (si se llegó a correr)
-- ---------------------------------------------------------------------
drop trigger if exists trg_solicitudes_normalizar_sueldo_actual on public.solicitudes;
drop function if exists public.solicitudes_normalizar_sueldo_actual();

-- =========================== 0023 (sin crear_solicitud_cambio) ===========================
-- 1) Supervisores -> Solicitantes
update public.perfiles set rol = 'solicitante' where rol::text = 'supervisor';

update auth.users
set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('rol', 'solicitante')
where raw_user_meta_data ->> 'rol' = 'supervisor';


drop policy if exists storage_solicitud_adjuntos_insert on storage.objects;
create policy storage_solicitud_adjuntos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'solicitud-adjuntos'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.rol_actual() in ('solicitante', 'admin')
  );


-- 3) Que no se vuelva a asignar
alter table public.perfiles drop constraint if exists perfiles_rol_sin_supervisor;
alter table public.perfiles add constraint perfiles_rol_sin_supervisor
  check (rol::text <> 'supervisor');


-- =========================== 0025 ===========================
create or replace function public.crear_solicitud_cambio(
  p_tipo public.tipo_solicitud,
  p_trabajador_id uuid,
  p_detalle jsonb default '{}'::jsonb
)
returns public.solicitudes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol public.user_role;
  v_trab record;
  v_centro record;
  v_nombre text;
  v_solicitud public.solicitudes;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol not in ('solicitante', 'admin') then
    raise exception 'No tienes permiso para levantar este tipo de solicitud.';
  end if;

  if p_tipo::text = 'bono' then
    raise exception 'Las solicitudes de Bono ya no se crean desde el sistema.';
  end if;

  if p_tipo::text not in ('aumento_sueldo', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion') then
    raise exception 'Tipo de solicitud no válido para crear_solicitud_cambio().';
  end if;

  if p_tipo::text = 'cambio_turno' and coalesce(trim(p_detalle ->> 'turno_nuevo'), '') = '' then
    raise exception 'Falta el turno nuevo.';
  end if;

  if p_trabajador_id is null then
    raise exception 'Falta el trabajador.';
  end if;

  select t.* into v_trab from public.trabajadores t where t.id = p_trabajador_id;
  if not found then
    raise exception 'El trabajador seleccionado ya no existe en el maestro de Trabajadores. Recarga la página e inténtalo de nuevo.';
  end if;
  v_nombre := coalesce(nullif(trim(v_trab.nombre), ''), concat_ws(' ', v_trab.nombres, v_trab.apellido_paterno, v_trab.apellido_materno), 'seleccionado');

  if v_trab.centro_costo_id is null then
    raise exception 'El trabajador % (RUT %) no tiene obra (centro de costo) en el maestro de Trabajadores. Pídele al administrador del sistema que se la asigne en Trabajadores.',
      v_nombre, coalesce(v_trab.rut, 's/i');
  end if;

  select c.id, c.codigo, c.nombre, c.admin_obra_id into v_centro
  from public.centros_costo c where c.id = v_trab.centro_costo_id;
  if v_centro.admin_obra_id is null then
    raise exception 'La obra % (%) del trabajador % no tiene administrador de obra asignado, y es quien debe aprobar. Pídele al administrador del sistema que lo asigne en Centros de costo.',
      v_centro.codigo, left(coalesce(v_centro.nombre, ''), 60), v_nombre;
  end if;

  insert into public.solicitudes (tipo, solicitante_id, trabajador_id, centro_origen_id, detalle)
  values (p_tipo, auth.uid(), p_trabajador_id, v_trab.centro_costo_id, coalesce(p_detalle, '{}'::jsonb))
  returning * into v_solicitud;

  insert into public.aprobaciones (solicitud_id, aprobador_id, orden)
  values (v_solicitud.id, v_centro.admin_obra_id, 1);

  return v_solicitud;
end;
$$;

grant execute on function public.crear_solicitud_cambio(public.tipo_solicitud, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- =========================== 0026 ===========================
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


-- ---------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------
select item, case when ok then 'OK' else 'REVISAR' end as estado
from (
  select 1 as orden, '0020 · Renovación deja el tipo de contrato' as item,
         coalesce((select prosrc like '%tipo_renovacion%' from pg_proc where proname = 'actualizar_fecha_termino_por_renovacion' and pronamespace = 'public'::regnamespace limit 1), false) as ok
  union all
  select 2, '0023 · Sin usuarios con rol Supervisor y restricción puesta',
         not exists (select 1 from public.perfiles where rol::text = 'supervisor')
         and exists (select 1 from pg_constraint where conname = 'perfiles_rol_sin_supervisor')
  union all
  select 3, '0025 · Mensajes de obra/trabajador al crear solicitudes de cambio',
         coalesce((select prosrc like '%no tiene obra (centro de costo)%' from pg_proc where proname = 'crear_solicitud_cambio' and pronamespace = 'public'::regnamespace limit 1), false)
  union all
  select 4, '0026 · Revisión de CV de Ingreso',
         coalesce((select prosrc like '%máximo 20 CV%' from pg_proc where proname = 'validar_adjunto_solicitud' and pronamespace = 'public'::regnamespace limit 1), false)
) x
order by orden;
