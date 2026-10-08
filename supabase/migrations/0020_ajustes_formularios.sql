-- =====================================================================
-- 0020_ajustes_formularios.sql
-- Ajustes de oct. 2026 a los formularios de "Nueva solicitud" (ver
-- NOTAS_CONTRATACION_SST.md, sección 16). Casi todo el cambio es de
-- pantalla (src/views/nueva-solicitud.js); acá va solo lo que tiene que
-- quedar firme en la base:
--
--   1. Bono deja de existir como solicitud nueva: crear_solicitud_cambio()
--      ya no lo acepta (el front tampoco lo muestra). Mismo cuerpo que en
--      0019, solo sale 'bono' de la lista. El valor del enum NO se borra:
--      las solicitudes de bono ya creadas siguen existiendo, se pueden ver,
--      aprobar o rechazar normalmente.
--
--   2. Renovación ahora trae `detalle.tipo_renovacion`:
--        'plazo'      -> detalle.nueva_fecha_termino (fecha de culminación)
--        'obra_faena' -> detalle.hito_obra (texto libre, sin fecha)
--        'indefinido' -> detalle.indefinido = true
--      Se reemplaza el trigger de 0008 (actualizar_fecha_termino_por_renovacion)
--      para que, al aprobarse, además de la fecha deje el tipo de contrato
--      del trabajador en lo que se renovó (Plazo Fijo / Obra o Faena /
--      Indefinido). Las renovaciones antiguas (sin tipo_renovacion) siguen
--      funcionando exactamente igual que antes: no tocan tipo_contrato.
--
--   3. Limpieza defensiva: si alguna vez se corrió la migración de la
--      "entrega 18" (restricción de sueldo en traslado por cargo), su
--      trigger seguiría escribiendo el sueldo en los traslados nuevos --
--      y Traslado ya no lleva sueldo. Se elimina si existe; si nunca se
--      corrió, esta parte no hace nada.
--
-- Ejecutar después de 0001-0019. No agrega valores de enum, así que se
-- puede correr de una sola vez en el SQL Editor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) crear_solicitud_cambio() sin 'bono'
-- ---------------------------------------------------------------------
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
  v_centro_id uuid;
  v_admin_obra_id uuid;
  v_solicitud public.solicitudes;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol not in ('solicitante', 'supervisor', 'admin') then
    raise exception 'No tienes permiso para levantar este tipo de solicitud.';
  end if;

  if p_tipo::text = 'bono' then
    raise exception 'Las solicitudes de Bono ya no se crean desde el sistema.';
  end if;

  if p_tipo::text not in ('aumento_sueldo', 'cambio_cargo', 'renovacion', 'desvinculacion') then
    raise exception 'Tipo de solicitud no válido para crear_solicitud_cambio().';
  end if;

  if p_trabajador_id is null then
    raise exception 'Falta el trabajador.';
  end if;

  select centro_costo_id into v_centro_id from public.trabajadores where id = p_trabajador_id;
  if v_centro_id is null then
    raise exception 'El trabajador no existe o no tiene centro de costo asignado.';
  end if;

  select admin_obra_id into v_admin_obra_id from public.centros_costo where id = v_centro_id;
  if v_admin_obra_id is null then
    raise exception 'El centro de costo de este trabajador no tiene administrador de obra asignado. Asígnalo en "Centros de costo" antes de continuar.';
  end if;

  insert into public.solicitudes (tipo, solicitante_id, trabajador_id, centro_origen_id, detalle)
  values (p_tipo, auth.uid(), p_trabajador_id, v_centro_id, coalesce(p_detalle, '{}'::jsonb))
  returning * into v_solicitud;

  insert into public.aprobaciones (solicitud_id, aprobador_id, orden)
  values (v_solicitud.id, v_admin_obra_id, 1);

  return v_solicitud;
end;
$$;


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
