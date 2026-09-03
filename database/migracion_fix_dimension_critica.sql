-- ============================================================================
-- Corrige: las alertas de recovery se creaban sin indicar qué dimensión
-- fue la crítica — la función solo guardaba el valor mínimo para decidir
-- el semáforo, pero nunca el código de la dimensión que lo causó.
-- ============================================================================

create or replace function responder_encuesta_satisfaccion(
  p_token uuid,
  p_notas jsonb,
  p_nps int,
  p_comentario text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv_id uuid;
  v_obra text;
  v_key text;
  v_val jsonb;
  v_peso numeric;
  v_nota int;
  v_suma numeric := 0;
  v_pesos numeric := 0;
  v_isc numeric;
  v_semaforo text;
  v_clase_nps text;
  v_nota_minima int := 5;
  v_dim_minima text;
  v_respuesta_id uuid;
  v_alerta boolean := false;
begin
  select referencia_id into v_inv_id from encuestas_token
  where token = p_token and modulo = 'satisfaccion' and estado = 'pendiente';

  if v_inv_id is null then
    return false;
  end if;

  select obra into v_obra from sat_invitaciones where id = v_inv_id;

  for v_key, v_val in select * from jsonb_each(p_notas) loop
    if v_val is not null and v_val::text != 'null' then
      select peso into v_peso from sat_dimensiones where codigo = upper(v_key);
      if v_peso is not null then
        v_nota := v_val::int;
        v_suma := v_suma + (v_nota * v_peso);
        v_pesos := v_pesos + v_peso;
        if v_nota < v_nota_minima then
          v_nota_minima := v_nota;
          v_dim_minima := upper(v_key);
        end if;
      end if;
    end if;
  end loop;

  if v_pesos > 0 then
    v_isc := round(v_suma / v_pesos, 2);
  end if;

  if p_nps >= 9 then
    v_clase_nps := 'promotor';
  elsif p_nps >= 7 then
    v_clase_nps := 'pasivo';
  else
    v_clase_nps := 'detractor';
  end if;

  if v_isc < 3.5 or v_nota_minima <= 2 or p_nps <= 6 then
    v_semaforo := 'rojo';
    v_alerta := true;
  elsif v_isc < 4.2 or v_nota_minima = 3 then
    v_semaforo := 'amarillo';
  else
    v_semaforo := 'verde';
  end if;

  insert into sat_respuestas (
    invitacion_id, nota_d1, nota_d2, nota_d3, nota_d4, nota_d5, nota_d6,
    isc, nps, clase_nps, semaforo, comentario, alerta_generada
  ) values (
    v_inv_id,
    (p_notas->>'d1')::int, (p_notas->>'d2')::int, (p_notas->>'d3')::int,
    (p_notas->>'d4')::int, (p_notas->>'d5')::int, (p_notas->>'d6')::int,
    v_isc, p_nps, v_clase_nps, v_semaforo, p_comentario, v_alerta
  ) returning id into v_respuesta_id;

  update sat_invitaciones set estado = 'respondida', fecha_respuesta = now(), respuesta_id = v_respuesta_id
  where id = v_inv_id;

  update encuestas_token set estado = 'completado', fecha_respuesta = now()
  where token = p_token;

  if v_alerta then
    insert into sat_alertas (respuesta_id, obra, dimension_critica, fecha_alerta, sla_48h, estado)
    values (
      v_respuesta_id,
      v_obra,
      coalesce((select nombre from sat_dimensiones where codigo = v_dim_minima), 'ISC/NPS general'),
      now(),
      now() + interval '48 hours',
      'abierta'
    );
  end if;

  return true;
end;
$$;
