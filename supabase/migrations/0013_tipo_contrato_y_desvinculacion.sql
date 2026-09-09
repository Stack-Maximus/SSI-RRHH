-- =====================================================================
-- 0013_tipo_contrato_y_desvinculacion.sql
-- Dos cosas nuevas, empaquetadas juntas porque la segunda depende de la
-- primera existir en la misma base:
--
--   1. `trabajadores.tipo_contrato` (Plazo Fijo / Obra o Faena / Indefinido):
--      hoy ese dato solo se capturaba como texto suelto en el `detalle`
--      JSONB de la solicitud de ingreso y nunca se guardaba en el maestro
--      del trabajador. Pasa a ser un campo real, editable en "Trabajadores"
--      y en el importador de Excel (igual que fecha_termino_contrato /
--      contrato_indefinido hoy), y se completa solo cuando se cierra una
--      contratación de ingreso (ver marcarContratado() en el frontend).
--
--   2. `trabajadores.requiere_anexo_renovacion`: si el trabajador tiene
--      contrato "Obra o Faena", un traslado a otra obra exige primero un
--      anexo de renovación (nueva solicitud tipo 'renovacion') -- así lo
--      pidió el cliente explícitamente, con bloqueo duro (no solo aviso,
--      a diferencia del resto del sistema). El flag se prende solo cuando
--      el contrato queda en "Obra o Faena" y se apaga solo cuando se
--      aprueba una renovación para ese trabajador; mientras esté prendido,
--      un trigger nuevo impide crear un traslado para ese trabajador (a
--      nivel de base de datos, no solo en la UI, porque no tenemos el
--      código fuente de crear_solicitud() para tocarlo ahí -- ver el mismo
--      criterio ya documentado en 0006_solicitudes_cambios.sql).
--
--   3. De paso, el nuevo valor de enum 'desvinculacion' (para la solicitud
--      de desvinculación que se agrega en 0014) -- va acá, SOLO el ALTER
--      TYPE y sin usarlo todavía en esta misma transacción, por la regla
--      de Postgres de no poder usar un valor de enum recién agregado hasta
--      que el ALTER TYPE haga commit (mismo criterio que 0001/0006).
--
-- 100% aditivo: columnas y triggers nuevos, con nombre propio. No toca
-- ningún trigger ni política existente.
--
-- Ejecutar después de 0001-0012. 0014 depende de este archivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Columnas nuevas en `trabajadores`.
-- ---------------------------------------------------------------------
alter table public.trabajadores
  add column if not exists tipo_contrato text
    check (tipo_contrato is null or tipo_contrato in ('Plazo Fijo', 'Obra o Faena', 'Indefinido'));

alter table public.trabajadores
  add column if not exists requiere_anexo_renovacion boolean not null default false;

comment on column public.trabajadores.tipo_contrato is
  'Plazo Fijo / Obra o Faena / Indefinido. Se completa solo al cerrar una contratación de ingreso (copia detalle.tipo_contrato de la solicitud) y es editable a mano en Trabajadores / Excel para trabajadores ya existentes.';

comment on column public.trabajadores.requiere_anexo_renovacion is
  'true = tiene contrato "Obra o Faena" sin un anexo de renovación al día; mientras esté en true, no se puede crear un traslado para este trabajador (trg_bloquear_traslado_obra_o_faena). Se prende solo al fijar tipo_contrato=Obra o Faena y se apaga solo al aprobarse una solicitud de renovación para él; también editable a mano por RRHH/admin para casos excepcionales (anexo firmado en papel antes de este sistema, corrección de un dato mal cargado, etc.).';

-- ---------------------------------------------------------------------
-- 2) Prende el flag cuando el contrato queda en "Obra o Faena".
--    Solo en alta o cuando tipo_contrato CAMBIA a ese valor (no en cada
--    UPDATE irrelevante), para no volver a prender un flag que RRHH ya
--    apagó a mano por una razón puntual.
-- ---------------------------------------------------------------------
create or replace function public.marcar_requiere_anexo_renovacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_contrato = 'Obra o Faena'
     and (tg_op = 'INSERT' or old.tipo_contrato is distinct from new.tipo_contrato)
  then
    new.requiere_anexo_renovacion := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marcar_requiere_anexo_renovacion on public.trabajadores;
create trigger trg_marcar_requiere_anexo_renovacion
  before insert or update of tipo_contrato on public.trabajadores
  for each row execute function public.marcar_requiere_anexo_renovacion();

-- ---------------------------------------------------------------------
-- 3) Apaga el flag cuando se aprueba una renovación para el trabajador.
--    Trigger NUEVO y aparte de trg_actualizar_fecha_termino_renovacion
--    (0008) -- no lo toca, ambos escuchan el mismo evento y conviven sin
--    problema (Postgres permite varios triggers AFTER sobre la misma fila).
-- ---------------------------------------------------------------------
create or replace function public.apagar_requiere_anexo_por_renovacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo::text = 'renovacion'
     and new.estado = 'aprobada'
     and (old.estado is distinct from new.estado)
     and new.trabajador_id is not null
  then
    update public.trabajadores
      set requiere_anexo_renovacion = false
      where id = new.trabajador_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apagar_requiere_anexo_renovacion on public.solicitudes;
create trigger trg_apagar_requiere_anexo_renovacion
  after update of estado on public.solicitudes
  for each row execute function public.apagar_requiere_anexo_por_renovacion();

-- ---------------------------------------------------------------------
-- 4) Bloquea crear un traslado mientras el trabajador lo requiera.
--    BEFORE INSERT en `solicitudes`, independiente de qué función hace el
--    INSERT (crear_solicitud() u otra) -- así no hace falta tocar código
--    que no tenemos a la vista.
-- ---------------------------------------------------------------------
create or replace function public.bloquear_traslado_obra_o_faena()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requiere boolean;
  v_nombre text;
begin
  if new.tipo::text = 'traslado' and new.trabajador_id is not null then
    select requiere_anexo_renovacion, nombre into v_requiere, v_nombre
      from public.trabajadores where id = new.trabajador_id;

    if coalesce(v_requiere, false) then
      raise exception
        'No se puede crear el traslado: % tiene contrato "Obra o Faena" y no tiene un anexo de renovación al día. Crea y haz aprobar una solicitud de Renovación para este trabajador antes de trasladarlo.',
        coalesce(v_nombre, 'este trabajador');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_traslado_obra_o_faena on public.solicitudes;
create trigger trg_bloquear_traslado_obra_o_faena
  before insert on public.solicitudes
  for each row execute function public.bloquear_traslado_obra_o_faena();

-- ---------------------------------------------------------------------
-- 5) Nuevo valor de enum para la solicitud de desvinculación (0014 lo usa).
-- ---------------------------------------------------------------------
alter type public.tipo_solicitud add value if not exists 'desvinculacion';
