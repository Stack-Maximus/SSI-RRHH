-- ============================================================================
-- Corrige la base de cálculo de los plazos legales (3/5/10 años): se
-- cuentan desde la Recepción Definitiva, no desde la Recepción Provisoria.
-- ============================================================================

alter table pv_obras add column if not exists fecha_recepcion_definitiva date;

create or replace function reportar_ticket_postventa(p_token uuid, p_datos jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra_id uuid;
  v_obra text;
  v_cc text;
  v_fecha_rp date;
  v_fecha_fin_garantia date;
  v_fecha_rd date;
  v_tipologia text;
  v_categoria_legal text;
  v_plazo_anios int;
  v_anios_desde_rd numeric;
  v_fase text;
  v_numero text;
  v_correlativo int;
begin
  select t.obra_id, o.obra, o.centro_costo, o.fecha_activacion, o.fecha_fin_garantia, o.fecha_recepcion_definitiva
  into v_obra_id, v_obra, v_cc, v_fecha_rp, v_fecha_fin_garantia, v_fecha_rd
  from postventa_accesos_obra t
  join pv_obras o on o.id = t.obra_id
  where t.token = p_token and t.activo;

  if v_obra_id is null then
    raise exception 'Acceso inválido o inactivo';
  end if;

  v_tipologia := p_datos->>'tipologia';
  select categoria_legal, plazo_legal_anios into v_categoria_legal, v_plazo_anios
  from pv_tipologias where codigo = v_tipologia;

  if v_categoria_legal is null then
    raise exception 'Tipología no reconocida: %', v_tipologia;
  end if;

  if current_date <= v_fecha_fin_garantia then
    v_fase := 'servicio_activo';
  elsif v_fecha_rd is null then
    v_fase := 'pendiente_recepcion_definitiva';
  else
    v_anios_desde_rd := extract(epoch from (now() - v_fecha_rd)) / (86400 * 365.25);
    if v_anios_desde_rd <= v_plazo_anios then
      v_fase := 'post_garantia_legal';
    else
      v_fase := 'fuera_de_plazo';
    end if;
  end if;

  v_correlativo := (select count(*) + 1 from pv_tickets where obra = v_obra and fecha_reporte >= date_trunc('year', now()));
  v_numero := 'PV-' || v_obra || '-' || extract(year from now())::text || '-' || lpad(v_correlativo::text, 3, '0');

  insert into pv_tickets (
    numero_ticket, obra, centro_costo, cliente, reportante, rol_reportante,
    correo, telefono, tipologia, ubicacion, descripcion_falla, fase_garantia, estado
  ) values (
    v_numero, v_obra, v_cc, p_datos->>'cliente', p_datos->>'reportante', p_datos->>'rol_reportante',
    p_datos->>'correo', p_datos->>'telefono', v_tipologia, p_datos->>'ubicacion', p_datos->>'descripcion',
    v_fase, 'reportado'
  );

  return v_numero;
end;
$$;

alter table pv_tickets drop constraint if exists pv_tickets_fase_garantia_check;
alter table pv_tickets add constraint pv_tickets_fase_garantia_check
  check (fase_garantia in ('servicio_activo', 'pendiente_recepcion_definitiva', 'post_garantia_legal', 'fuera_de_plazo'));
