-- ============================================================================
-- Garantía en 3 niveles (servicio activo, responsabilidad legal por tipo
-- de falla, fuera de plazo) según LGUC art. 18.
-- ============================================================================

create table pv_tipologias (
  codigo text primary key,
  nombre text not null,
  categoria_legal text not null check (categoria_legal in ('estructural', 'elementos_instalaciones', 'terminaciones')),
  plazo_legal_anios int not null
);

insert into pv_tipologias (codigo, nombre, categoria_legal, plazo_legal_anios) values
  ('estructural', 'Falla o defecto estructural', 'estructural', 10),
  ('humedad', 'Humedad o filtraciones', 'elementos_instalaciones', 5),
  ('electrico', 'Instalación eléctrica', 'elementos_instalaciones', 5),
  ('sanitario', 'Instalación sanitaria', 'elementos_instalaciones', 5),
  ('terminaciones', 'Terminaciones y acabados', 'terminaciones', 3),
  ('pintura', 'Pintura', 'terminaciones', 3),
  ('carpinteria', 'Carpintería y puertas/ventanas', 'terminaciones', 3),
  ('otro', 'Otro', 'terminaciones', 3);

alter table pv_tickets
  add column if not exists fase_garantia text
    check (fase_garantia in ('servicio_activo', 'post_garantia_legal', 'fuera_de_plazo'));

alter table pv_tickets
  add constraint pv_tickets_tipologia_fk foreign key (tipologia) references pv_tipologias(codigo);

alter table postventa_accesos_obra add column if not exists obra_id uuid references pv_obras(id);

update postventa_accesos_obra t
set obra_id = o.id
from pv_obras o
where t.obra_id is null and o.obra = t.obra;

alter table postventa_accesos_obra drop column if exists fecha_activacion;
alter table postventa_accesos_obra drop column if exists fecha_fin_garantia;
alter table postventa_accesos_obra drop column if exists centro_costo;
