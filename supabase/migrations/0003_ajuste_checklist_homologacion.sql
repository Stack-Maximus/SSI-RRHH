-- =====================================================================
-- 0003_ajuste_checklist_homologacion.sql
-- Ajusta qué documentos del checklist de Contratación ve el prevencionista,
-- según la Matriz SST R19-PTMD-SST-07 (Documentos, Certificaciones y
-- Difusiones · Sistema de Gestión SST) que RRHH confirmó:
--
--   De todo el checklist de contratación, SOLO 2 documentos son los que
--   Prevención necesita tomar (vía RRHH) para la homologación:
--     1) Contrato de Trabajo  (no existía como ítem del checklist -> se agrega)
--     2) Cédula de identidad o pasaporte, según corresponda (ya existía)
--   El resto de certificaciones/capacitaciones/exámenes de esa matriz los
--   gestiona Prevención directamente y NO pasan por RRHH, así que no forman
--   parte de este checklist.
--
-- Ejecutar después de 0001 y 0002.
-- =====================================================================

-- 1) Nuevo ítem: Contrato de Trabajo (obligatorio para todos, RRHH lo sube
--    una vez firmado, al cerrar la contratación).
insert into public.documentos_checklist
  (codigo, nombre, aplica_administrativo, aplica_operativo, obligatorio, requerido_homologacion, orden)
values
  ('contrato_trabajo', 'Contrato de Trabajo', true, true, true, true, 5)
on conflict (codigo) do nothing;

-- 2) Alinea el nombre de la cédula con la matriz (incluye pasaporte, para
--    personas trabajadoras extranjeras).
update public.documentos_checklist
  set nombre = 'Cédula de identidad o pasaporte, según corresponda (vigente, no certificado)'
  where codigo = 'cedula_ambos_lados';

-- 3) Deja "requerido_homologacion" en true SOLO para estos 2 documentos.
--    (Antes había marcado varios más -título, licencia, carnet experto,
--    resolución Seremi, previsión- por criterio propio; la matriz que
--    compartió RRHH deja claro que esos no pasan por este checklist.)
update public.documentos_checklist
  set requerido_homologacion = false
  where codigo not in ('contrato_trabajo', 'cedula_ambos_lados');

update public.documentos_checklist
  set requerido_homologacion = true
  where codigo in ('contrato_trabajo', 'cedula_ambos_lados');
