-- ============================================================================
-- SGC METALIUM · PARCHE DE SEGURIDAD · guardias que no cerraban
--
-- QUÉ ESTABA MAL
--
-- Las funciones que exigen un rol están escritas así:
--
--     if not (es_admin() or rol_en_modulo('personal') = 'rrhh') then
--       raise exception 'Sólo RRHH ...';
--     end if;
--
-- Parece correcto y no lo es. rol_en_modulo() devuelve NULL cuando el usuario
-- NO TIENE NINGUNA FILA en modulo_accesos para ese módulo. Y en SQL:
--
--     NULL = 'rrhh'                    -> NULL   (no es false: es «no sé»)
--     false or NULL                    -> NULL
--     not NULL                         -> NULL
--     if NULL then ... end if           -> NO ENTRA
--
-- O sea: la guardia rechazaba a quien tenía el rol EQUIVOCADO y dejaba pasar a
-- quien NO TENÍA NINGUNO. Exactamente al revés de lo que hace falta.
--
-- Por qué no lo vimos antes: todas las pruebas de permisos se hicieron con
-- usuarios que SÍ tenían un rol en el módulo (supervisor, bienestar, RRHH). Con
-- 'supervisor' la comparación da false de verdad y la guardia salta bien. El
-- agujero sólo se abre con un usuario sin rol en el módulo — que es justo el
-- perfil de cualquier trabajador recién creado.
--
-- COMPROBADO en base real, con un usuario autenticado sin ninguna fila en
-- modulo_accesos. Antes del parche pudo:
--
--   · agregar un cargo al catálogo,
--   · marcar «Jefe SST» como cargo que no se evalúa,
--   · quitarle el criterio TC1 a toda la familia F1,
--   · y — la peor — FIRMAR EL ACTA como RRHH y como Bienestar, que es el visto
--     bueno del proceso completo.
--
-- QUÉ NO ESTABA MAL
--
-- Las políticas RLS (using / with check) NO tienen este problema: ahí un NULL
-- se trata como false y la fila se filtra. Por eso ese mismo usuario no podía
-- LEER el catálogo aunque sí podía escribirlo por función. Las políticas no se
-- tocan en este parche.
--
-- CÓMO SE ARREGLA
--
-- La condición de la guardia pasa a ser estrictamente booleana:
--
--     if not coalesce(<condición>, false) then
--
-- Con coalesce, un NULL vale false y la excepción salta. Falla cerrado, que es
-- como tiene que fallar una guardia. Se aplica también a las ramas que comparan
-- identidad (evaluado_id = auth.uid()), que serían NULL si el token no trae
-- sujeto.
--
-- Además queda sgc_rol(), que nunca devuelve NULL, para que el código nuevo no
-- vuelva a caer en lo mismo.
--
-- Se reemplazan 5 funciones ya desplegadas. El cuerpo es el mismo de las
-- migraciones que ya corriste — se extrajo de los archivos, no se transcribió a
-- mano — con la guardia corregida y nada más.
--
-- Es repetible: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. El rol, sin NULL de por medio
--
--    rol_en_modulo() se deja como está: su NULL significa «no tiene rol» y hay
--    código que lo lee así. Esta es la versión para escribir guardias.
-- ----------------------------------------------------------------------------

create or replace function sgc_rol(p_modulo modulo_sgc)
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(rol_en_modulo(p_modulo), '');
$fn$;

grant execute on function sgc_rol(modulo_sgc) to authenticated;


-- --------------------------------------------------------------------------
-- eva_firmar_acta
--   origen: migracion_eva_acta_v2.sql
-- --------------------------------------------------------------------------

create or replace function eva_firmar_acta(
  p_evaluacion_id uuid,
  p_rol_firmante text,
  p_nombre text,
  p_rut text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev eva_evaluaciones;
  v_decl eva_declaraciones;
  v_autorizado boolean := false;
  v_previas integer;
  v_firmas integer;
  v_estado_final text;
  v_lineas integer;
begin
  select * into v_ev from eva_evaluaciones where id = p_evaluacion_id;
  if v_ev.id is null then
    raise exception 'La evaluación no existe';
  end if;

  if v_ev.estado <> 'pendiente_firmas' then
    raise exception 'Esta evaluación no está en etapa de firmas (estado actual: %)', v_ev.estado;
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_rut), '') = '' then
    raise exception 'La firma necesita nombre y RUT';
  end if;

  -- Sin esto, firmar dos veces devuelve la violación cruda de la clave única y
  -- el usuario ve un mensaje de base de datos en lugar de una explicación.
  if exists (select 1 from eva_firmas
             where evaluacion_id = p_evaluacion_id and rol_firmante = p_rol_firmante) then
    raise exception 'Esa firma ya está puesta en el acta y no se puede repetir';
  end if;

  -- Quién puede firmar cada rol.
  if p_rol_firmante = 'trabajador' then
    v_autorizado := v_ev.evaluado_id = auth.uid();
  elsif p_rol_firmante = 'supervisor' then
    v_autorizado := v_ev.evaluador_id = auth.uid();
  elsif p_rol_firmante = 'rrhh' then
    v_autorizado := es_admin() or rol_en_modulo('personal') = 'rrhh';
  elsif p_rol_firmante = 'bienestar' then
    v_autorizado := es_admin() or rol_en_modulo('personal') = 'crecimiento_bienestar';
  else
    raise exception 'Rol de firmante no válido: %', p_rol_firmante;
  end if;

  if not coalesce(v_autorizado, false) then
    raise exception 'No te corresponde firmar como %', p_rol_firmante;
  end if;

  -- Orden de las firmas.
  if p_rol_firmante = 'rrhh' then
    select count(*) into v_previas from eva_firmas
    where evaluacion_id = p_evaluacion_id and rol_firmante in ('trabajador', 'supervisor');
    if v_previas < 2 then
      raise exception 'Faltan las firmas del trabajador y del supervisor antes del visto bueno de RRHH';
    end if;
  elsif p_rol_firmante = 'bienestar' then
    select count(*) into v_previas from eva_firmas
    where evaluacion_id = p_evaluacion_id and rol_firmante = 'rrhh';
    if v_previas < 1 then
      raise exception 'Bienestar y Crecimiento firma al final: falta el visto bueno de RRHH';
    end if;
  end if;

  select * into v_decl
  from eva_declaraciones
  where rol_firmante = p_rol_firmante and vigente
  order by codigo
  limit 1;

  insert into eva_firmas (evaluacion_id, rol_firmante, usuario_id, nombre_declarado, rut_declarado,
                          declaracion_codigo, declaracion_texto)
  values (p_evaluacion_id, p_rol_firmante, auth.uid(), trim(p_nombre), trim(p_rut),
          v_decl.codigo, coalesce(v_decl.texto, '(declaración no configurada)'));

  -- Cada jefatura que firma deja la fecha de derivación del expediente.
  if p_rol_firmante = 'rrhh' then
    update eva_evaluaciones set derivado_rrhh_en = now() where id = p_evaluacion_id;
  elsif p_rol_firmante = 'bienestar' then
    select count(*) into v_lineas from eva_pdi where evaluacion_id = p_evaluacion_id;
    update eva_evaluaciones
      set derivado_bienestar_en = now(),
          lineas_cargadas_dnc = v_lineas
      where id = p_evaluacion_id;
  end if;

  -- ¿Están las cuatro? Entonces se cierra.
  select count(*) into v_firmas from eva_firmas where evaluacion_id = p_evaluacion_id;

  if v_firmas >= 4 then
    v_estado_final := case when v_ev.acuerdo_trabajador = 'conforme'
                           then 'cerrada_conforme' else 'cerrada_disconformidad' end;
    update eva_evaluaciones
      set estado = v_estado_final,
          fecha_cierre = current_date
      where id = p_evaluacion_id;
    return jsonb_build_object('firmas', v_firmas, 'cerrada', true, 'estado', v_estado_final);
  end if;

  return jsonb_build_object('firmas', v_firmas, 'cerrada', false);
end;
$$;
grant execute on function eva_firmar_acta(uuid, text, text, text) to authenticated;

-- --------------------------------------------------------------------------
-- eva_registrar_acta_comite
--   origen: migracion_eva_acta_v2.sql
-- --------------------------------------------------------------------------

create or replace function eva_registrar_acta_comite(
  p_evaluacion_id uuid,
  p_acta text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((es_admin()
          or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar')), false) then
    raise exception 'Sólo RRHH o Bienestar y Crecimiento registran el acta del Comité';
  end if;

  if coalesce(trim(p_acta), '') = '' then
    raise exception 'Falta el número de acta';
  end if;

  update eva_evaluaciones
    set acta_comite = trim(p_acta)
    where id = p_evaluacion_id;

  if not found then
    raise exception 'La evaluación no existe';
  end if;
end;
$$;
grant execute on function eva_registrar_acta_comite(uuid, text) to authenticated;

-- --------------------------------------------------------------------------
-- eva_marcar_criterio_familia
--   origen: migracion_eva_filtro_cargo.sql
-- --------------------------------------------------------------------------

create or replace function eva_marcar_criterio_familia(
  p_criterio_codigo text,
  p_familia_codigo text,
  p_aplica boolean,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((es_admin() or rol_en_modulo('personal') = 'rrhh'), false) then
    raise exception 'Sólo RRHH define qué criterios aplican a cada familia';
  end if;

  if not p_aplica and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Quitar un criterio de una familia exige decir por qué: queda en el registro y alguien lo va a preguntar';
  end if;

  insert into eva_criterio_familia (criterio_codigo, familia_codigo, aplica, motivo, actualizado_por, actualizado_en)
  values (p_criterio_codigo, p_familia_codigo, true, null, auth.uid(), now())
  on conflict (criterio_codigo, familia_codigo) do nothing;

  update eva_criterio_familia
    set aplica = p_aplica,
        motivo = case when p_aplica then null else trim(p_motivo) end,
        actualizado_por = auth.uid()
    where criterio_codigo = p_criterio_codigo and familia_codigo = p_familia_codigo;

  if not found then
    raise exception 'No existe ese cruce de criterio y familia';
  end if;
end;
$$;
grant execute on function eva_marcar_criterio_familia(text, text, boolean, text) to authenticated;

-- --------------------------------------------------------------------------
-- eva_resolver_candidatura
--   origen: migracion_eva_fortalezas.sql
-- --------------------------------------------------------------------------

create or replace function eva_resolver_candidatura(
  p_candidatura_id uuid,
  p_estado text,
  p_observaciones text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((es_admin() or rol_en_modulo('personal') in ('rrhh', 'crecimiento_bienestar')), false) then
    raise exception 'Sólo RRHH o Bienestar y Crecimiento resuelven las candidaturas a relator';
  end if;

  if p_estado not in ('propuesta', 'aceptada', 'postergada', 'descartada', 'formado') then
    raise exception 'Estado no válido: %', p_estado;
  end if;

  if p_estado in ('descartada', 'postergada') and coalesce(trim(p_observaciones), '') = '' then
    raise exception 'Descartar o postergar una candidatura exige decir por qué';
  end if;

  update eva_relator_candidaturas
    set estado = p_estado,
        observaciones = coalesce(nullif(trim(p_observaciones), ''), observaciones),
        resuelta_por = auth.uid(),
        resuelta_en = now()
    where id = p_candidatura_id;

  if not found then
    raise exception 'La candidatura no existe';
  end if;
end;
$$;
grant execute on function eva_resolver_candidatura(uuid, text, text) to authenticated;

-- --------------------------------------------------------------------------
-- eva_pdi_registrar_control
--   origen: migracion_eva_flujo_bienestar.sql
-- --------------------------------------------------------------------------

create or replace function eva_pdi_registrar_control(
  p_pdi_id uuid,
  p_nro_control integer,
  p_fecha date,
  p_observacion text,
  p_estado_accion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorizado boolean;
begin
  -- Además del rol de bienestar, siguen pudiendo RRHH, el admin y el evaluador
  -- de esa evaluación — el seguimiento no le queda vedado a nadie que ya podía.
  select
    es_admin()
    or es_crecimiento_bienestar()
    or rol_en_modulo('personal') = 'rrhh'
    or exists (
      select 1 from eva_pdi p
      join eva_evaluaciones e on e.id = p.evaluacion_id
      where p.id = p_pdi_id and e.evaluador_id = auth.uid()
    )
  into v_autorizado;

  if not coalesce(v_autorizado, false) then
    raise exception 'No tienes permiso para registrar controles en este PDI';
  end if;

  if p_nro_control not in (1, 2) then
    raise exception 'El número de control debe ser 1 o 2';
  end if;

  if p_estado_accion is not null and p_estado_accion not in ('pendiente','en_curso','completada') then
    raise exception 'Estado de acción no válido: %', p_estado_accion;
  end if;

  if p_nro_control = 1 then
    update eva_pdi set
      control_1_fecha = p_fecha,
      control_1_obs = p_observacion,
      estado_accion = coalesce(p_estado_accion, estado_accion)
    where id = p_pdi_id;
  else
    update eva_pdi set
      control_2_fecha = p_fecha,
      control_2_obs = p_observacion,
      estado_accion = coalesce(p_estado_accion, estado_accion)
    where id = p_pdi_id;
  end if;
end;
$$;
grant execute on function eva_pdi_registrar_control(uuid, integer, date, text, text) to authenticated;

notify pgrst, 'reload schema';
