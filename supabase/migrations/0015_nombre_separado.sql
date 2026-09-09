-- =====================================================================
-- 0015_nombre_separado.sql
-- Separa el nombre en "Nombres" / "Apellido Paterno" / "Apellido Materno"
-- como 3 campos propios -- tanto en `trabajadores` (el maestro de dotación,
-- editable en pantalla y por Excel) como en `contrataciones` (el candidato,
-- mientras todavía no es trabajador). Pedido explícito: hoy el importador
-- de Excel exige escribir el nombre completo como un solo texto en la
-- planilla, y el cliente maneja su propia dotación con estos 3 campos ya
-- separados.
--
-- Diseño (a propósito, para no arriesgar ninguna pantalla que hoy ya
-- funciona con el nombre completo -- comprobantes, correos, selectores,
-- dashboards, la Edge Function `notificar`, etc.):
--   * `trabajadores.nombre` y `contrataciones.nombre_candidato` NO
--     desaparecen ni cambian de significado -- se siguen leyendo en toda
--     la app exactamente igual que hoy (nombre completo).
--   * Se agregan las columnas nuevas (partes) en las dos tablas.
--   * Un trigger nuevo en cada tabla arma el nombre completo automático a
--     partir de las 3 partes, cada vez que se inserta o se edita
--     cualquiera de ellas -- así el campo de siempre queda siempre al día
--     sin tocar el resto del código.
--   * Si en algún insert/update no viene NINGUNA de las 3 partes (por
--     ejemplo, algún camino que todavía no se haya actualizado), el
--     trigger no toca el nombre completo -- se deja tal como venga en ese
--     insert/update. Es decir: las partes son la fuente de verdad SOLO
--     cuando se usan; si no se usan, el campo de siempre sigue mandando.
--   * Los trabajadores y candidatos que ya existían se separan una sola
--     vez, automático, con la mejor convención posible para nombres
--     chilenos: el último apellido = materno, el anterior = paterno, todo
--     lo demás = nombres. Nombres de 1 sola palabra quedan con los 2
--     apellidos vacíos; de 2 palabras, la primera se asume nombre y la
--     segunda apellido paterno (queda materno vacío). Como es una
--     suposición, hay que revisar los casos dudosos a mano en Trabajadores
--     -- no hay forma de adivinarlo bien al 100% solo con el texto.
--
-- Ejecutar después de 0001-0014.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) trabajadores: columnas nuevas.
-- ---------------------------------------------------------------------
alter table public.trabajadores
  add column if not exists nombres text,
  add column if not exists apellido_paterno text,
  add column if not exists apellido_materno text;

comment on column public.trabajadores.nombres is
  'Nombre(s) de pila. Junto con apellido_paterno/apellido_materno arma trabajadores.nombre automático (ver trg_armar_nombre_trabajador). trabajadores.nombre sigue siendo el nombre completo que usa el resto de la app -- no se lee este campo directamente fuera de las pantallas de edición.';
comment on column public.trabajadores.apellido_paterno is 'Apellido paterno. Ver comentario de la columna "nombres".';
comment on column public.trabajadores.apellido_materno is 'Apellido materno (puede ser null). Ver comentario de la columna "nombres".';

create or replace function public.armar_nombre_trabajador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_armado text;
begin
  v_armado := nullif(trim(concat_ws(' ', new.nombres, new.apellido_paterno, new.apellido_materno)), '');
  if v_armado is not null then
    new.nombre := v_armado;
  end if;
  -- Si no viene ninguna de las 3 partes (nombres/apellido_paterno/apellido_materno
  -- todas null o vacías), no se toca new.nombre -- queda tal cual llegó en el
  -- insert/update (compatibilidad con cualquier camino que todavía no mande
  -- las partes por separado).
  return new;
end;
$$;

drop trigger if exists trg_armar_nombre_trabajador on public.trabajadores;
create trigger trg_armar_nombre_trabajador
  before insert or update of nombres, apellido_paterno, apellido_materno on public.trabajadores
  for each row execute function public.armar_nombre_trabajador();

-- Separación automática de los trabajadores que ya existían (solo los que
-- todavía no tienen ninguna de las 3 partes cargada -- así el paso es
-- seguro de repetir sin pisar nada si se corre más de una vez).
with partes as (
  select
    id,
    regexp_split_to_array(trim(regexp_replace(nombre, '\s+', ' ', 'g')), ' ') as palabras
  from public.trabajadores
  where nombre is not null and trim(nombre) <> ''
    and nombres is null and apellido_paterno is null and apellido_materno is null
)
update public.trabajadores t
set
  nombres = case
    when array_length(p.palabras, 1) <= 2 then p.palabras[1]
    else array_to_string(p.palabras[1 : array_length(p.palabras, 1) - 2], ' ')
  end,
  apellido_paterno = case
    when array_length(p.palabras, 1) = 1 then null
    when array_length(p.palabras, 1) = 2 then p.palabras[2]
    else p.palabras[array_length(p.palabras, 1) - 1]
  end,
  apellido_materno = case
    when array_length(p.palabras, 1) <= 2 then null
    else p.palabras[array_length(p.palabras, 1)]
  end
from partes p
where t.id = p.id;

-- ---------------------------------------------------------------------
-- 2) contrataciones: mismo patrón, para el nombre del candidato.
-- ---------------------------------------------------------------------
alter table public.contrataciones
  add column if not exists nombres_candidato text,
  add column if not exists apellido_paterno_candidato text,
  add column if not exists apellido_materno_candidato text;

comment on column public.contrataciones.nombres_candidato is
  'Nombre(s) de pila del candidato. Arma contrataciones.nombre_candidato automático (ver trg_armar_nombre_candidato), igual que trabajadores.nombres.';
comment on column public.contrataciones.apellido_paterno_candidato is 'Apellido paterno del candidato.';
comment on column public.contrataciones.apellido_materno_candidato is 'Apellido materno del candidato (puede ser null).';

create or replace function public.armar_nombre_candidato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_armado text;
begin
  v_armado := nullif(trim(concat_ws(' ', new.nombres_candidato, new.apellido_paterno_candidato, new.apellido_materno_candidato)), '');
  if v_armado is not null then
    new.nombre_candidato := v_armado;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_armar_nombre_candidato on public.contrataciones;
create trigger trg_armar_nombre_candidato
  before insert or update of nombres_candidato, apellido_paterno_candidato, apellido_materno_candidato on public.contrataciones
  for each row execute function public.armar_nombre_candidato();

with partes as (
  select
    id,
    regexp_split_to_array(trim(regexp_replace(nombre_candidato, '\s+', ' ', 'g')), ' ') as palabras
  from public.contrataciones
  where nombre_candidato is not null and trim(nombre_candidato) <> ''
    and nombres_candidato is null and apellido_paterno_candidato is null and apellido_materno_candidato is null
)
update public.contrataciones c
set
  nombres_candidato = case
    when array_length(p.palabras, 1) <= 2 then p.palabras[1]
    else array_to_string(p.palabras[1 : array_length(p.palabras, 1) - 2], ' ')
  end,
  apellido_paterno_candidato = case
    when array_length(p.palabras, 1) = 1 then null
    when array_length(p.palabras, 1) = 2 then p.palabras[2]
    else p.palabras[array_length(p.palabras, 1) - 1]
  end,
  apellido_materno_candidato = case
    when array_length(p.palabras, 1) <= 2 then null
    else p.palabras[array_length(p.palabras, 1)]
  end
from partes p
where c.id = p.id;
