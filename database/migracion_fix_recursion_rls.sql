-- ============================================================================
-- Corrige: "stack depth limit exceeded" por recursión infinita en RLS.
--
-- Causa: la política "comite_gestiona_accesos_proveedores" (sobre
-- modulo_accesos) llama a rol_en_modulo(), y esa función consulta
-- modulo_accesos — como la tabla tiene RLS, esa consulta interna vuelve a
-- evaluar la misma política, en un ciclo sin fin.
--
-- Corrección: tiene_acceso() y rol_en_modulo() pasan a ser SECURITY DEFINER,
-- para que su consulta interna corra con privilegios propios y no quede
-- sujeta de nuevo a las políticas RLS de modulo_accesos. Es el patrón
-- estándar recomendado para funciones usadas dentro de políticas RLS —
-- no cambia a quién le devuelven qué, solo evita que se revisen a sí mismas.
-- ============================================================================

create or replace function tiene_acceso(p_modulo modulo_sgc)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from modulo_accesos
    where usuario_id = auth.uid() and modulo = p_modulo
  );
$$;

create or replace function rol_en_modulo(p_modulo modulo_sgc)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from modulo_accesos
  where usuario_id = auth.uid() and modulo = p_modulo
  limit 1;
$$;
