-- =====================================================================
-- 06_centros_y_cargos_nov2026.sql   (nov. 2026, a pedido)
--
-- Carga los 21 centros de costo (con su código) y los 67 cargos que aparecen en
-- "Lista_Empleados_de_metalium-spa" (250 trabajadores), después del vaciado (02).
--
-- Cómo correrlo desde CMD (en la carpeta del proyecto):
--   node supabase\mantencion\sql.mjs supabase\mantencion\06_centros_y_cargos_nov2026.sql
--       -> REVISIÓN: muestra lo que agregaría y no guarda nada.
--   node supabase\mantencion\sql.mjs supabase\mantencion\06_centros_y_cargos_nov2026.sql --aplicar
--       -> los GUARDA.
-- (También funciona en el SQL Editor; ahí se guarda de inmediato.)
--
-- Se puede correr más de una vez: lo que ya existe (centro con el mismo
-- código, cargo con el mismo nombre sin importar mayúsculas) no se duplica;
-- si estaba desactivado, se reactiva. No toca nada más.
--
-- Nombres de centro: tal cual vienen en la lista del ERP.
-- Cargos: los de la lista, con las variantes del mismo cargo unificadas
-- (Asesor/Asesora en prevención de riesgos, Maestro (De) Estructuras /
-- Estucturas, Maestro Estructura Metalica/Metálica, Maestro (de) Montaje,
-- Jefe de Terreno (/) Coordinador Civil de Terreno, Soldador -Armador).
-- La plantilla de Trabajadores generada con esta misma lista usa exactamente
-- estos nombres.
--
-- Después: en la app, Centros de costo -> asignar administrador de obra y
-- prevencionista a cada centro; Usuarios -> asignar el centro de cada uno;
-- Trabajadores -> Importar planilla.
-- =====================================================================

create temp table if not exists _centros_nuevos (codigo text, nombre text);
truncate _centros_nuevos;
insert into _centros_nuevos (codigo, nombre) values
  ('1', 'GERENCIA GENERAL'),
  ('2', 'OFICINA CENTRAL LAS CONDES'),
  ('3', 'FINANZAS CORPORATIVAS'),
  ('4', 'OPERACIONES LOGISTICAS'),
  ('5', 'SST'),
  ('6', 'INGENIERÍA'),
  ('7', 'RECURSOS HUMANOS'),
  ('8', 'DESARROLLO ESTRATEGICO'),
  ('10', 'SANTA ELENA'),
  ('14', 'LIRAY'),
  ('16', 'OTROS'),
  ('17', '“REPOSICIÓN COMPLEJO ASISTENCIAL DR. SÓTERO DEL RÍO”'),
  ('19', 'SACYR HOSPITAL CORDILLERA'),
  ('24', 'METRO REFUERZOS DE ANDENES'),
  ('25', '"CONSTRUCCIÓN DE REFUERZOS PARA PUERTAS DE ANDEN EN ESTACIONES GRUPO N° 2 METRO S.A. del contrato N° GE395C4'),
  ('28', '“METRO – REVALORIZACION UNIVERSIDAD DE CHILE.” Contrato N°OB16-5C2'),
  ('29', '“REVALORIZACION DE ESTACIONES GRUPO 2 DE METROS S.A.” Contrato N°OB16-5C3'),
  ('30', '“HABILITACIÓN DE BAÑOS ESTACIÓN UNIVERSIDAD DE CHILE LINEA 1, METRO DE SANTIAGO” Contrato Comercial N° OB16-5C4'),
  ('31', '“OBRAS PREVIAS, LINEA 9 TRAMO 2, BIO - BIO - CAL Y CANTO, METRO DE SANTIAGO” Comercial N° L9-C0600-9'),
  ('32', 'Adaptación PML Pajaritos L1 METRO DE SANTIAGO Contrato N°GE39-5C8'),
  ('33', 'GERENCIA DE OPERACIONES');

create temp table if not exists _cargos_nuevos (nombre text);
truncate _cargos_nuevos;
insert into _cargos_nuevos (nombre) values
  ('Administrador de Obras'),
  ('Administradora General'),
  ('Albañil'),
  ('Analista de Compras'),
  ('Analista de Remuneraciones'),
  ('Analista de RR.HH.'),
  ('Analista TI'),
  ('Arquitecto Modelador'),
  ('Asesor en Prevención de Riesgos'),
  ('Asesora del Hogar'),
  ('Asistente de Gerencia'),
  ('Asistente RR.HH.'),
  ('Ayudante'),
  ('Ayudante de Construcción'),
  ('Ayudante de Estructuras'),
  ('Bodeguero'),
  ('Capataz de Obra'),
  ('Carpintero'),
  ('Chofer Logístico'),
  ('Coordinador BIM'),
  ('Coordinador de operaciones'),
  ('Ejecutiva Comercial'),
  ('Encargado de Administración'),
  ('Encargado de Bodega y Activos'),
  ('Encargado de Contabilidad'),
  ('Encargado de Facturación y Administración'),
  ('Enfierrador'),
  ('Gerente de Finanzas Corporativas'),
  ('Gerente de Operaciones'),
  ('Gerente de Operaciones Logísticas'),
  ('Gerente de RRHH'),
  ('Gerente General'),
  ('Gerente SST'),
  ('Ingeniero Ambiental'),
  ('Ingeniero de Calidad'),
  ('Ingeniero Oficina Técnica'),
  ('Instalador Sanitario'),
  ('Jefe de Desarrollo Estratégico'),
  ('Jefe de Finanzas Corporativas'),
  ('Jefe de Licitaciones'),
  ('Jefe de Oficina Técnica'),
  ('Jefe de Recursos Humanos'),
  ('Jefe de Taller'),
  ('Jefe de Terreno / Coordinador Civil de Terreno'),
  ('Jefe de Tesorería'),
  ('Jornal'),
  ('Maestro Albañil'),
  ('Maestro Carpintero'),
  ('Maestro de Estructuras'),
  ('Maestro Electricista'),
  ('Maestro Estructura Metálica'),
  ('Maestro Gasfiter'),
  ('Maestro Montaje'),
  ('Maestro Pintor'),
  ('Maestro Soldador'),
  ('Modelador / Proyectista'),
  ('Montador'),
  ('Operador de Maquinaria'),
  ('Operador de Máquina'),
  ('Paramédico'),
  ('Planificadora de Obras'),
  ('Servicios Generales'),
  ('Soldador'),
  ('Soldador - Armador'),
  ('Supervisor'),
  ('Topógrafo'),
  ('Trazador');

create temp table if not exists _carga_resultado (orden int, tabla text, agregados int, reactivados int, ya_estaban int);
truncate _carga_resultado;

do $$
declare
  v_tipo text;
  v_nuevos int;
  v_react int;
  v_total int;
begin
  -- Centros de costo. El código se convierte al tipo real de la columna
  -- (texto o número), así el script sirve en cualquiera de los dos casos.
  select format_type(a.atttypid, a.atttypmod) into v_tipo
  from pg_attribute a
  where a.attrelid = 'public.centros_costo'::regclass and a.attname = 'codigo' and not a.attisdropped;

  update public.centros_costo c set activo = true
  from _centros_nuevos n
  where c.codigo::text = n.codigo and c.activo is false;
  get diagnostics v_react = row_count;

  execute format(
    'insert into public.centros_costo (codigo, nombre)
     select n.codigo::%s, n.nombre from _centros_nuevos n
     where not exists (select 1 from public.centros_costo c where c.codigo::text = n.codigo)', v_tipo);
  get diagnostics v_nuevos = row_count;
  select count(*) into v_total from _centros_nuevos;
  insert into _carga_resultado values (1, 'Centros de costo', v_nuevos, v_react, v_total - v_nuevos - v_react);

  -- Cargos
  update public.cargos c set activo = true
  from _cargos_nuevos n
  where lower(trim(c.nombre)) = lower(n.nombre) and c.activo is false;
  get diagnostics v_react = row_count;

  insert into public.cargos (nombre)
  select n.nombre from _cargos_nuevos n
  where not exists (select 1 from public.cargos c where lower(trim(c.nombre)) = lower(n.nombre));
  get diagnostics v_nuevos = row_count;
  select count(*) into v_total from _cargos_nuevos;
  insert into _carga_resultado values (2, 'Cargos', v_nuevos, v_react, v_total - v_nuevos - v_react);
end $$;

-- Resultado 1: centros de costo de la lista, como quedan en el sistema
select c.codigo::text as codigo, c.nombre, case when c.activo then 'activo' else 'inactivo' end as estado
from public.centros_costo c
join _centros_nuevos n on n.codigo = c.codigo::text
order by case when c.codigo::text ~ '^[0-9]+$' then c.codigo::text::bigint end, c.codigo::text;

-- Resultado 2: cargos de la lista, como quedan en el sistema
select c.nombre as cargo, case when c.activo then 'activo' else 'inactivo' end as estado
from public.cargos c
join _cargos_nuevos n on lower(trim(c.nombre)) = lower(n.nombre)
order by lower(c.nombre);

-- Resultado 3 (al final, para que sea el que muestra el SQL Editor): resumen
select tabla, agregados, reactivados, ya_estaban
from _carga_resultado
order by orden;
