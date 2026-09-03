-- ============================================================================
-- Mueve la consolidación de Proveedores a una función RPC (security
-- definer) que corre con visión completa de la tabla, sin importar quién
-- la dispare. Antes, el chequeo "¿ya calificaron las 6 áreas?" se hacía
-- desde el cliente, y RLS le ocultaba a cada delegado las áreas que no
-- eran la suya — por eso la consolidación nunca se completaba salvo que
-- la dispara alguien con visión total (comité real).
-- ============================================================================

create or replace function intentar_consolidar_proveedor(p_evaluacion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_areas text[] := array['gol', 'gfc', 'gi', 'go', 'gsst', 'rrhh'];
  v_areas_presentes text[];
  v_ev prov_evaluaciones;
  v_campo_peso text;
  v_total numeric;
  v_veto_codigo text;
  v_veto_aplicado boolean;
  v_clasificacion text;
  v_decision text;
  v_peso_gol numeric; v_peso_gfc numeric; v_peso_gi numeric;
  v_peso_go numeric; v_peso_gsst numeric; v_peso_rrhh numeric;
begin
  select array_agg(distinct area) into v_areas_presentes
  from prov_detalle where evaluacion_id = p_evaluacion_id;

  if v_areas_presentes is null or not (v_areas_presentes @> v_areas) then
    return jsonb_build_object('consolidado', false, 'motivo', 'faltan_areas', 'areas_presentes', to_jsonb(v_areas_presentes));
  end if;

  select * into v_ev from prov_evaluaciones where id = p_evaluacion_id;
  if v_ev.id is null then
    return jsonb_build_object('consolidado', false, 'motivo', 'evaluacion_no_encontrada');
  end if;

  v_campo_peso := case when v_ev.categoria_aplicada = 'bienes' then 'peso_bienes' else 'peso_servicios' end;

  if v_campo_peso = 'peso_bienes' then
    select peso_bienes into v_peso_gol from prov_pesos where area = 'gol';
    select peso_bienes into v_peso_gfc from prov_pesos where area = 'gfc';
    select peso_bienes into v_peso_gi from prov_pesos where area = 'gi';
    select peso_bienes into v_peso_go from prov_pesos where area = 'go';
    select peso_bienes into v_peso_gsst from prov_pesos where area = 'gsst';
    select peso_bienes into v_peso_rrhh from prov_pesos where area = 'rrhh';
  else
    select peso_servicios into v_peso_gol from prov_pesos where area = 'gol';
    select peso_servicios into v_peso_gfc from prov_pesos where area = 'gfc';
    select peso_servicios into v_peso_gi from prov_pesos where area = 'gi';
    select peso_servicios into v_peso_go from prov_pesos where area = 'go';
    select peso_servicios into v_peso_gsst from prov_pesos where area = 'gsst';
    select peso_servicios into v_peso_rrhh from prov_pesos where area = 'rrhh';
  end if;

  v_total := round(
    coalesce(v_ev.nota_gol, 0) * coalesce(v_peso_gol, 0) +
    coalesce(v_ev.nota_gfc, 0) * coalesce(v_peso_gfc, 0) +
    coalesce(v_ev.nota_gi, 0) * coalesce(v_peso_gi, 0) +
    coalesce(v_ev.nota_go, 0) * coalesce(v_peso_go, 0) +
    coalesce(v_ev.nota_gsst, 0) * coalesce(v_peso_gsst, 0) +
    coalesce(v_ev.nota_rrhh, 0) * coalesce(v_peso_rrhh, 0)
  , 2);

  select pd.criterio_codigo into v_veto_codigo
  from prov_detalle pd
  join prov_criterios pc on pc.codigo = pd.criterio_codigo
  where pd.evaluacion_id = p_evaluacion_id and pc.veto = true and pd.na = false and pd.nota <= 2
  limit 1;

  v_veto_aplicado := v_veto_codigo is not null;

  if v_veto_aplicado then
    select clasificacion, decision_asociada into v_clasificacion, v_decision
    from prov_rangos where clasificacion = 'd_no_aprobado';
  else
    select clasificacion, decision_asociada into v_clasificacion, v_decision
    from prov_rangos where v_total between rango_min and rango_max;
  end if;

  update prov_evaluaciones set
    total_ponderado = v_total,
    veto_aplicado = v_veto_aplicado,
    veto_criterio = v_veto_codigo,
    clasificacion = v_clasificacion,
    decision_asociada = v_decision,
    estado = 'en_comite'
  where id = p_evaluacion_id;

  return jsonb_build_object('consolidado', true, 'total_ponderado', v_total, 'clasificacion', v_clasificacion, 'veto_aplicado', v_veto_aplicado);
end;
$$;

grant execute on function intentar_consolidar_proveedor(uuid) to authenticated;
