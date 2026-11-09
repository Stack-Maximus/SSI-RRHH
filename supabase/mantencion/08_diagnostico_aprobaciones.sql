-- =====================================================================
-- 08_diagnostico_aprobaciones.sql   (nov. 2026)  -- SOLO LECTURA
--
-- Para revisar quién aprueba qué y por qué una solicitud no le aparece a
-- alguien, no le llegó el correo o quedó aprobada sin que nadie la aprobara.
--
--   node supabase\mantencion\sql.mjs supabase\mantencion\08_diagnostico_aprobaciones.sql
--
-- Resultado 1: centros de costo con su administrador de obra, prevencionista
--              y los usuarios que tienen ese centro asignado.
-- Resultado 2: usuarios con su rol, su centro y de qué centros son adm. de obra.
-- Resultado 3: las últimas 60 solicitudes con sus aprobadores.
-- Resultado 4: problemas encontrados.
-- No cambia nada (no hace falta --aplicar).
-- =====================================================================

-- Resultado 1: centros
select c.codigo::text as codigo,
       left(c.nombre, 40) as centro,
       coalesce(ao.nombre, '— SIN ADM. DE OBRA —') as adm_obra,
       coalesce(pv.nombre, '— sin prevencionista —') as prevencionista,
       coalesce((select string_agg(p.nombre || ' (' || p.rol::text || ')', ', ' order by p.nombre)
                 from public.perfiles p where p.centro_costo_id = c.id), '') as usuarios_con_este_centro
from public.centros_costo c
left join public.perfiles ao on ao.id = c.admin_obra_id
left join public.perfiles pv on pv.id = c.prevencionista_id
where coalesce(c.activo, true)
order by case when c.codigo::text ~ '^[0-9]+$' then c.codigo::text::bigint end, c.codigo::text;

-- Resultado 2: usuarios
select p.nombre,
       p.rol::text as rol,
       coalesce(c.codigo::text || ' ' || left(c.nombre, 30), '—') as su_centro,
       coalesce((select string_agg(x.codigo::text, ', ' order by x.codigo::text) from public.centros_costo x where x.admin_obra_id = p.id), '') as adm_obra_de,
       case when p.es_gerente_operaciones then 'sí' else '' end as gerente_op,
       case when coalesce(p.activo, true) then 'activo' else 'INACTIVO' end as estado
from public.perfiles p
left join public.centros_costo c on c.id = p.centro_costo_id
order by p.rol::text, p.nombre;

-- Resultado 3: últimas solicitudes y sus aprobadores
select s.codigo,
       s.tipo::text as tipo,
       s.estado::text as estado,
       to_char(s.created_at at time zone 'America/Santiago', 'DD-MM HH24:MI') as creada,
       coalesce(co.codigo::text, '') || coalesce(' -> ' || cd.codigo::text, '') as centro,
       sol.nombre as solicitante,
       (select count(*) from public.aprobaciones a where a.solicitud_id = s.id) as n_aprob,
       coalesce((select string_agg(a.orden || ':' || coalesce(pa.nombre, '¿NADIE?') || ' [' || a.decision::text || ']', ' | ' order by a.orden)
                 from public.aprobaciones a left join public.perfiles pa on pa.id = a.aprobador_id
                 where a.solicitud_id = s.id), '— NINGUNO —') as aprobadores
from public.solicitudes s
left join public.centros_costo co on co.id = s.centro_origen_id
left join public.centros_costo cd on cd.id = s.centro_destino_id
left join public.perfiles sol on sol.id = s.solicitante_id
order by s.created_at desc
limit 60;

-- Resultado 4: problemas
select problema, donde, detalle from (
  -- aprobada sin que todos sus aprobadores (con nombre) la aprobaran
  select 1 as orden, 'APROBADA SIN APROBACIÓN REAL' as problema, s.codigo as donde,
         (select count(*) from public.aprobaciones a where a.solicitud_id = s.id) || ' aprobación(es); '
         || (select count(*) from public.aprobaciones a where a.solicitud_id = s.id and a.aprobador_id is null) || ' sin aprobador; '
         || (select count(*) from public.aprobaciones a where a.solicitud_id = s.id and a.decision::text <> 'aprobado') || ' no aprobadas' as detalle
  from public.solicitudes s
  where s.estado::text = 'aprobada'
    and (not exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id)
         or exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id and (a.aprobador_id is null or a.decision::text <> 'aprobado')))
  union all
  -- ningún administrador de obra en la cadena (solo el gerente, o nadie)
  select 1, 'SIN ADM. DE OBRA ENTRE SUS APROBADORES', s.codigo,
         s.estado::text || ' — aprobadores: ' || coalesce((select string_agg(coalesce(pa.nombre, '¿nadie?'), ', ' order by a.orden)
           from public.aprobaciones a left join public.perfiles pa on pa.id = a.aprobador_id where a.solicitud_id = s.id), 'ninguno')
  from public.solicitudes s
  where s.estado::text in ('pendiente', 'aprobada')
    and exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id)
    and not exists (select 1 from public.aprobaciones a join public.perfiles pa on pa.id = a.aprobador_id
                    where a.solicitud_id = s.id and not coalesce(pa.es_gerente_operaciones, false))
  union all
  -- pendiente sin aprobaciones o con una aprobación sin aprobador
  select 2, 'PENDIENTE SIN APROBADOR', s.codigo,
         (select count(*) from public.aprobaciones a where a.solicitud_id = s.id) || ' aprobación(es); '
         || (select count(*) from public.aprobaciones a where a.solicitud_id = s.id and a.aprobador_id is null) || ' sin aprobador'
  from public.solicitudes s
  where s.estado::text = 'pendiente'
    and (not exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id)
         or exists (select 1 from public.aprobaciones a where a.solicitud_id = s.id and a.aprobador_id is null))
  union all
  -- aprobación pendiente de alguien que hoy no es adm. de obra de esos centros ni gerente de operaciones
  select 3, 'PENDIENTE CON APROBADOR QUE YA NO CORRESPONDE', s.codigo,
         a.orden || ': ' || coalesce(pa.nombre, '?') || ' — hoy el adm. de obra es '
         || coalesce((select string_agg(coalesce(x.nombre, 'nadie'), ' / ') from public.centros_costo cc left join public.perfiles x on x.id = cc.admin_obra_id
                      where cc.id in (s.centro_origen_id, s.centro_destino_id)), 'nadie')
  from public.solicitudes s
  join public.aprobaciones a on a.solicitud_id = s.id and a.decision::text = 'pendiente'
  left join public.perfiles pa on pa.id = a.aprobador_id
  where s.estado::text = 'pendiente'
    and a.aprobador_id is not null
    and not coalesce(pa.es_gerente_operaciones, false)
    and not exists (select 1 from public.centros_costo cc where cc.id in (s.centro_origen_id, s.centro_destino_id) and cc.admin_obra_id = a.aprobador_id)
  union all
  -- aprobador inactivo con algo pendiente
  select 4, 'APROBADOR INACTIVO CON PENDIENTES', pa.nombre, count(*) || ' aprobación(es) pendiente(s)'
  from public.aprobaciones a
  join public.perfiles pa on pa.id = a.aprobador_id
  join public.solicitudes s on s.id = a.solicitud_id
  where a.decision::text = 'pendiente' and s.estado::text = 'pendiente' and not coalesce(pa.activo, true)
  group by pa.nombre
  union all
  -- centros sin adm. de obra
  select 5, 'CENTRO SIN ADM. DE OBRA', c.codigo::text, left(c.nombre, 60)
  from public.centros_costo c
  where coalesce(c.activo, true) and c.admin_obra_id is null
  union all
  -- usuarios aprobadores con centro asignado que no son adm. de obra de ese centro
  select 6, 'APROBADOR CON CENTRO PERO NO ES SU ADM. DE OBRA', p.nombre,
         'su centro: ' || c.codigo::text || ' — adm. de obra de ese centro: ' || coalesce(ao.nombre, 'nadie')
  from public.perfiles p
  join public.centros_costo c on c.id = p.centro_costo_id
  left join public.perfiles ao on ao.id = c.admin_obra_id
  where p.rol::text = 'aprobador' and not coalesce(p.es_gerente_operaciones, false)
    and coalesce(c.admin_obra_id::text, '') <> p.id::text
) x
order by orden, donde;
