-- ============================================================================
-- SGC METALIUM · Catálogos y datos semilla
-- Ejecutar DESPUÉS de sgc_schema.sql. Datos tomados literalmente de los
-- documentos fuente (RRHH-SIS-EVA-AD-001 Anexo A, GOL-SIS-EVA-PROV-001 §9-10,
-- GI-SIS-SAT-CLI-001 §4.1) — no son valores inventados.
-- ============================================================================

-- ============================================================================
-- 1. EVALUACIÓN DE PERSONAL — dimensiones y los 30 criterios
-- ============================================================================

insert into eva_dimensiones (codigo, nombre, peso, rubrica_1, rubrica_2, rubrica_3, rubrica_4, rubrica_5) values
  ('TC', 'Competencias Funcionales del Cargo', 0.35,
   '1 · No cumple (NC)', '2 · Por debajo de lo esperado (PD)', '3 · Cumple (C)', '4 · Sobre lo esperado (SE)', '5 · Excepcional (EX)'),
  ('SS', 'Organización y Cumplimiento', 0.20,
   '1 · No cumple (NC)', '2 · Por debajo de lo esperado (PD)', '3 · Cumple (C)', '4 · Sobre lo esperado (SE)', '5 · Excepcional (EX)'),
  ('DL', 'Disciplina Laboral', 0.15,
   '1 · No cumple (NC)', '2 · Por debajo de lo esperado (PD)', '3 · Cumple (C)', '4 · Sobre lo esperado (SE)', '5 · Excepcional (EX)'),
  ('VH', 'Valores HACER', 0.15,
   '1 · No cumple (NC)', '2 · Por debajo de lo esperado (PD)', '3 · Cumple (C)', '4 · Sobre lo esperado (SE)', '5 · Excepcional (EX)'),
  ('CM', 'Calidad y Mejora', 0.15,
   '1 · No cumple (NC)', '2 · Por debajo de lo esperado (PD)', '3 · Cumple (C)', '4 · Sobre lo esperado (SE)', '5 · Excepcional (EX)');

insert into eva_criterios (codigo, dimension_codigo, orden, texto_criterio) values
  ('TC1', 'TC', 1, 'Dominio de las funciones y procesos propios del cargo'),
  ('TC2', 'TC', 2, 'Calidad y exactitud de los entregables (informes, registros, documentos)'),
  ('TC3', 'TC', 3, 'Productividad y cumplimiento de los plazos de las tareas asignadas'),
  ('TC4', 'TC', 4, 'Manejo de sistemas y herramientas (ERP Auranet, Excel/Office, plataformas)'),
  ('TC5', 'TC', 5, 'Gestión documental, archivo y trazabilidad de la información'),
  ('TC6', 'TC', 6, 'Análisis y resolución de problemas administrativos del área'),
  ('SS1', 'SS', 1, 'Cumplimiento de procedimientos y normativa interna aplicable'),
  ('SS2', 'SS', 2, 'Confidencialidad y manejo responsable de información sensible (Ley 19.628)'),
  ('SS3', 'SS', 3, 'Orden del puesto de trabajo y autocuidado (ergonomía, pausas)'),
  ('SS4', 'SS', 4, 'Planificación y administración del tiempo / cumplimiento de la agenda'),
  ('SS5', 'SS', 5, 'Cumplimiento de plazos legales y de reportería, sin atrasos'),
  ('SS6', 'SS', 6, 'Aplicación de controles y respaldos para evitar errores u omisiones'),
  ('DL1', 'DL', 1, 'Asistencia sin ausencias injustificadas'),
  ('DL2', 'DL', 2, 'Puntualidad (entrada, colaciones, reuniones)'),
  ('DL3', 'DL', 3, 'Cumplimiento de horarios y jornada completa'),
  ('DL4', 'DL', 4, 'Adherencia al Reglamento Interno (RIOHS)'),
  ('DL5', 'DL', 5, 'Uso de identificación corporativa y presentación personal'),
  ('DL6', 'DL', 6, 'Cuidado de equipos, recursos e insumos de oficina'),
  ('VH1', 'VH', 1, 'Honestidad — transparencia en reportes y manejo de recursos'),
  ('VH2', 'VH', 2, 'Adaptabilidad — respuesta a cambios de carga, prioridades y procesos'),
  ('VH3', 'VH', 3, 'Compromiso — esfuerzo en cierres y plazos críticos; disponibilidad'),
  ('VH4', 'VH', 4, 'Excelencia — búsqueda del detalle y trabajo bien hecho'),
  ('VH5', 'VH', 5, 'Respeto — trato con pares, jefatura, clientes internos y externos'),
  ('VH6', 'VH', 6, 'Trabajo en equipo y comunicación efectiva'),
  ('CM1', 'CM', 1, 'Conformidad de los entregables con estándares y formatos requeridos'),
  ('CM2', 'CM', 2, 'Reducción de errores, reprocesos y observaciones'),
  ('CM3', 'CM', 3, 'Aporte de ideas de mejora y optimización de procesos'),
  ('CM4', 'CM', 4, 'Disposición a capacitarse y aprender nuevas herramientas'),
  ('CM5', 'CM', 5, 'Apoyo e inducción a compañeros nuevos o con menos experiencia'),
  ('CM6', 'CM', 6, 'Iniciativa frente a tareas no asignadas pero necesarias');

-- No existe una tabla eva_rangos en el esquema (la categoría quedó como check
-- constraint en eva_evaluaciones) — esta función resuelve categoría + decisión
-- asociada a partir del promedio, según la Hoja 8 del documento fuente.
create or replace function eva_categoria_y_decision(p_promedio numeric)
returns table (categoria text, decision_asociada text)
language sql
immutable
as $$
  select
    case
      when p_promedio >= 4.50 then 'excepcional'
      when p_promedio >= 4.00 then 'destacado'
      when p_promedio >= 3.00 then 'satisfactorio'
      when p_promedio >= 2.00 then 'por_debajo'
      else 'critico'
    end,
    case
      when p_promedio >= 4.50 then 'Reconocimiento + candidato a promoción/bono'
      when p_promedio >= 4.00 then 'Reconocimiento formal del equipo'
      when p_promedio >= 3.00 then 'PDI estándar de mejora continua'
      when p_promedio >= 2.00 then 'PMD obligatorio + seguimiento mensual por 3 meses'
      else 'Escalamiento a RRHH-PRO-09 (medidas disciplinarias)'
    end;
$$;


-- ============================================================================
-- 2. EVALUACIÓN DE PROVEEDORES — pesos, rangos y los 35 criterios
-- ============================================================================

insert into prov_pesos (area, peso_bienes, peso_servicios) values
  ('gol',  0.30, 0.10),
  ('gi',   0.25, 0.20),
  ('gfc',  0.20, 0.10),
  ('go',   0.10, 0.25),
  ('gsst', 0.10, 0.20),
  ('rrhh', 0.05, 0.15);

insert into prov_rangos (rango_min, rango_max, clasificacion, decision_asociada) values
  (4.50, 5.00, 'a_preferente',
   'Homologación vigente con preferencia en comparativos en igualdad de condiciones; reconocimiento "Proveedor Preferente Metalium" en la carta anual.'),
  (3.50, 4.49, 'b_aprobado',
   'Homologación vigente sin restricciones; oportunidades de mejora informadas en la carta.'),
  (2.50, 3.49, 'c_condicionado',
   'Plan de acción del proveedor en 10 días hábiles; compras y adjudicaciones solo con visto del Jefe GOL; reevaluación obligatoria a los 90 días; dos períodos C consecutivos pasan a D.'),
  (1.00, 2.49, 'd_no_aprobado',
   'Suspensión del registro de homologados y bloqueo en el maestro AURANET; sin nuevas OC ni contratos; reingreso solo mediante homologación completa (GOL-PRO-01) con evidencias.');

insert into prov_criterios (codigo, area, texto, aplica, veto, orden) values
  -- GOL — Desempeño logístico y comercial
  ('LG1', 'gol', 'Cumplimiento de plazos de entrega comprometidos (OTIF): fecha pactada en OC o movilización pactada en contrato', 'ambas', false, 1),
  ('LG2', 'gol', 'Entregas completas y conformes con la OC: ítem, cantidad y unidad, sin faltantes ni sustituciones no autorizadas', 'bienes', false, 2),
  ('LG3', 'gol', 'Exactitud documental: guías, certificados y facturas consistentes con la OC (3-way match sin observaciones)', 'ambas', false, 3),
  ('LG4', 'gol', 'Tiempo y calidad de respuesta a cotizaciones y requerimientos (SR → cotización dentro del plazo solicitado)', 'ambas', false, 4),
  ('LG5', 'gol', 'Trato comercial, disposición y comunicación con el equipo de compras y las obras', 'ambas', false, 5),
  ('LG6', 'gol', 'Gestión de reclamos, devoluciones, canjes y garantías comerciales', 'ambas', false, 6),
  -- GFC — Condiciones financieras
  ('FC1', 'gfc', 'Condiciones de pago otorgadas (plazo de crédito respecto del estándar Metalium)', 'ambas', false, 1),
  ('FC2', 'gfc', 'Línea de crédito disponible y suficiente para el volumen de compra proyectado', 'ambas', false, 2),
  ('FC3', 'gfc', 'Exactitud de la facturación: sin refacturaciones ni notas de crédito por errores del proveedor', 'ambas', false, 3),
  ('FC4', 'gfc', 'Cumplimiento tributario y documental: DTE válidos ante el SII, datos correctos, sin bloqueos', 'ambas', false, 4),
  ('FC5', 'gfc', 'Flexibilidad ante ajustes de flujo o repactaciones acordadas (curva de pagos)', 'ambas', false, 5),
  ('FC6', 'gfc', 'Manejo de boletas de garantía y retenciones sin controversias', 'servicios', false, 6),
  -- GI — Calidad del producto o servicio
  ('CA1', 'gi', 'Conformidad con las especificaciones técnicas (EETT, fichas, planos) del producto o servicio', 'ambas', false, 1),
  ('CA2', 'gi', 'Certificados de calidad, ensayos y trazabilidad entregados completos y oportunos', 'bienes', false, 2),
  ('CA3', 'gi', 'Tasa de rechazos o devoluciones en la recepción del período', 'bienes', false, 3),
  ('CA4', 'gi', 'Calidad técnica de la ejecución y de los entregables del servicio (protocolos, dossier, terminaciones)', 'servicios', false, 4),
  ('CA5', 'gi', 'Competencia técnica del personal asignado y calidad del soporte/asistencia técnica', 'servicios', false, 5),
  ('CA6', 'gi', 'Respuesta técnica ante consultas y tratamiento de no conformidades de calidad', 'ambas', false, 6),
  -- GO — Cumplimiento contractual y operacional
  ('OP1', 'go', 'Cumplimiento del programa e hitos contractuales comprometidos en obra', 'servicios', false, 1),
  ('OP2', 'go', 'Dotación, equipos y recursos comprometidos efectivamente disponibles en terreno', 'servicios', false, 2),
  ('OP3', 'go', 'Coordinación, comunicación y reportabilidad en terreno (reuniones, avances, alertas tempranas)', 'servicios', false, 3),
  ('OP4', 'go', 'Gestión y cierre oportuno de no conformidades, observaciones y punch list', 'ambas', false, 4),
  ('OP5', 'go', 'Calidad y oportunidad de los estados de avance/EDP presentados y sus respaldos', 'servicios', false, 5),
  ('OP6', 'go', 'Respuesta ante contingencias, urgencias y cambios de alcance', 'ambas', false, 6),
  -- GSST — Seguridad, salud en el trabajo y medio ambiente
  ('ST1', 'gsst', 'Cumplimiento del Reglamento Especial de Empresas Contratistas (DS 76) y del plan SST de la obra', 'servicios', true, 1),
  ('ST2', 'gsst', 'Documentación SST completa y oportuna: IPER, procedimientos, registros, exámenes y acreditaciones', 'servicios', false, 2),
  ('ST3', 'gsst', 'Accidentabilidad del período: sin accidentes graves o fatales imputables; tasas dentro del estándar (certificado de la mutualidad)', 'servicios', true, 3),
  ('ST4', 'gsst', 'Participación en charlas, capacitaciones y actividades preventivas de Metalium', 'servicios', false, 4),
  ('ST5', 'gsst', 'Estándares de seguridad en faena y despachos: EPP, señalización, vehículos y equipos certificados', 'ambas', false, 5),
  ('ST6', 'gsst', 'Gestión ambiental: manejo de residuos, HDS y rotulado de sustancias peligrosas', 'ambas', false, 6),
  -- RRHH — Cumplimiento laboral chileno (Ley 20.123)
  ('LA1', 'rrhh', 'F30 / F30-1 vigentes y oportunos, sin deudas laborales ni previsionales', 'servicios', true, 1),
  ('LA2', 'rrhh', 'Contratos, anexos y finiquitos del personal destacado al día y disponibles', 'servicios', false, 2),
  ('LA3', 'rrhh', 'Acreditación completa y oportuna del personal en obra (IRC) antes del ingreso', 'servicios', false, 3),
  ('LA4', 'rrhh', 'Sin multas ni denuncias de la Dirección del Trabajo imputables en el período; cumplimiento de la Ley Karin', 'servicios', true, 4),
  ('LA5', 'rrhh', 'Cumplimiento laboral básico del personal que presta servicios en dependencias de Metalium', 'ambas', false, 5);


-- ============================================================================
-- 3. SATISFACCIÓN DEL CLIENTE — dimensiones y pesos
-- ============================================================================

insert into sat_dimensiones (codigo, nombre, peso) values
  ('D1', 'Calidad de la obra y de los trabajos entregados', 0.25),
  ('D2', 'Cumplimiento de plazos e hitos comprometidos', 0.25),
  ('D3', 'Comunicación y capacidad de respuesta del equipo', 0.15),
  ('D4', 'Seguridad, orden y limpieza en la faena', 0.10),
  ('D5', 'Gestión administrativa: estados de pago y documentación', 0.10),
  ('D6', 'Postventa y tratamiento de observaciones', 0.15);

-- ============================================================================
-- FIN DE CATÁLOGOS
-- ============================================================================
