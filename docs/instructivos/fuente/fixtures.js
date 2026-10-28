// Datos de prueba para las capturas de los instructivos (no son datos reales).
const H = (d, h = '10:00') => new Date(`2026-${d}T${h}:00-03:00`).toISOString();

export const PERFILES = [
  { id: 'u-sol', nombre: 'Sonia Fuentes Rojas', email: 'sfuentes@metalium.cl', rol: 'solicitante', centro_costo_id: 'c1' },
  { id: 'u-sup', nombre: 'Marcelo Tapia Lagos', email: 'mtapia@metalium.cl', rol: 'supervisor', centro_costo_id: 'c2' },
  { id: 'a1', nombre: 'Andrés Pérez Soto', email: 'aperez@metalium.cl', rol: 'aprobador', centro_costo_id: 'c1' },
  { id: 'a2', nombre: 'Carolina Muñoz Vera', email: 'cmunoz@metalium.cl', rol: 'aprobador', centro_costo_id: 'c2' },
  { id: 'g1', nombre: 'Rodrigo Valdés Ortiz', email: 'rvaldes@metalium.cl', rol: 'aprobador', es_gerente_operaciones: true },
  { id: 'r1', nombre: 'Daniela Cortés Peña', email: 'dcortes@metalium.cl', rol: 'rrhh' },
  { id: 'p1', nombre: 'Felipe Araya Muñoz', email: 'faraya@metalium.cl', rol: 'prevencionista', centro_costo_id: 'c1' },
  { id: 'p2', nombre: 'Javiera Núñez Castro', email: 'jnunez@metalium.cl', rol: 'prevencionista', es_gerente_prevencion: true },
  { id: 'ad1', nombre: 'Claudia Reyes Salinas', email: 'creyes@metalium.cl', rol: 'admin' },
  { id: 'u-old', nombre: 'Tomás Herrera Vidal', email: 'therrera@metalium.cl', rol: 'solicitante', centro_costo_id: 'c3', activo: false },
];
PERFILES.forEach(p => { p.activo = p.activo ?? true; p.es_gerente_operaciones = !!p.es_gerente_operaciones; p.es_gerente_prevencion = !!p.es_gerente_prevencion; p.centro_costo_id = p.centro_costo_id ?? null; });
export const PMAP = new Map(PERFILES.map(p => [p.id, p]));

export const CENTROS = [
  { id: 'c1', codigo: '2041', nombre: 'Edificio Las Condes', admin_obra_id: 'a1', prevencionista_id: 'p1', activo: true },
  { id: 'c2', codigo: '3010', nombre: 'Hospital Biprovincial Quillota', admin_obra_id: 'a2', prevencionista_id: 'p1', activo: true },
  { id: 'c3', codigo: '1050', nombre: 'Condominio Los Robles', admin_obra_id: 'a2', prevencionista_id: 'p1', activo: true },
  { id: 'c0', codigo: '100', nombre: 'Oficina Central', admin_obra_id: 'g1', prevencionista_id: null, activo: true },
];

export const CARGOS = ['Ayudante de Bodega', 'Bodeguero', 'Capataz', 'Carpintero', 'Jefe de Terreno', 'Jornal',
  'Maestro Primera Albañil', 'Maestro Terminaciones', 'Prevencionista de Riesgos', 'Soldador'];

const T = (id, nombres, ap, am, rut, cargo, centro, tipo, fecha = null, extra = {}) => ({
  id, rut, nombres, apellido_paterno: ap, apellido_materno: am, nombre: `${nombres} ${ap} ${am}`, cargo,
  centro_costo_id: centro, tipo_contrato: tipo, fecha_termino_contrato: fecha, contrato_indefinido: tipo === 'Indefinido',
  requiere_anexo_renovacion: false, activo: true, profesion: null, sueldo_liquido: null, ...extra,
});
export const TRABAJADORES = [
  T('t1', 'Juan Carlos', 'Pérez', 'González', '15.234.567-8', 'Maestro Primera Albañil', 'c1', 'Plazo Fijo', '2026-11-30'),
  T('t2', 'Pedro Pablo', 'Ríos', 'Muñoz', '16.345.678-9', 'Carpintero', 'c1', 'Obra o Faena', null, { requiere_anexo_renovacion: true }),
  T('t3', 'María José', 'Fernández', 'Rojas', '17.456.789-0', 'Bodeguero', 'c1', 'Indefinido'),
  T('t4', 'Luis Alberto', 'González', 'Díaz', '12.567.890-1', 'Capataz', 'c2', 'Plazo Fijo', '2026-12-31'),
  T('t5', 'Camila Andrea', 'Muñoz', 'Soto', '18.678.901-2', 'Jornal', 'c2', 'Obra o Faena'),
  T('t6', 'Felipe Andrés', 'Rojas', 'Contreras', '19.789.012-3', 'Soldador', 'c3', 'Plazo Fijo', '2027-01-31'),
  T('t7', 'Héctor', 'Soto', 'Pérez', '11.890.123-4', 'Maestro Terminaciones', 'c3', 'Indefinido'),
  T('t8', 'Valentina', 'Contreras', 'Ríos', '20.901.234-5', 'Ayudante de Bodega', 'c1', 'Plazo Fijo', '2026-10-31'),
  T('t9', 'Jorge Esteban', 'Silva', 'Fernández', '13.012.345-6', 'Jornal', 'c2', 'Plazo Fijo', '2026-11-15'),
];
// datos completos para el maestro / perfil
const EXTRA_T = { t1: ['Constructor Civil', 980000], t2: [null, 720000], t3: ['Técnico en Logística', 750000], t4: [null, 1150000], t5: [null, 560000],
  t6: ['Soldador Calificado', 900000], t7: [null, 870000], t8: [null, 540000], t9: [null, 600000] };
TRABAJADORES.forEach(t => { const [prof, sueldo] = EXTRA_T[t.id]; t.profesion = prof; t.sueldo_liquido = sueldo; });
export const CARGOS_ADMIN = [...CARGOS, 'Electricista'].sort().map((nombre, i) => ({ id: 'cg' + i, nombre, activo: nombre !== 'Electricista' }));
export const TMAP = new Map(TRABAJADORES.map(t => [t.id, t]));

const apr = (sid, orden, aprobador, decision, asignado, decidido = null, extra = {}) => ({
  id: `${sid}-a${orden}`, solicitud_id: sid, orden, aprobador_id: aprobador, decision, asignado_at: asignado, decidido_at: decidido,
  tiempo_respuesta: decidido ? Math.round((new Date(decidido) - new Date(asignado)) / 1000) : null, ...extra,
});

// Solicitudes ---------------------------------------------------------
export const SOLICITUDES = [
  // de Sonia (solicitante)
  { id: 's1', codigo: 'SOL-2026-0421', folio: 'RRH-ING-000044', tipo: 'ingreso', estado: 'pendiente', solicitante_id: 'u-sol', centro_origen_id: 'c1',
    created_at: H('10-07', '09:12'), motivo: 'Aumento de faenas en terminaciones de la Torre B.',
    detalle: { cargo: 'Maestro Terminaciones', cantidad: 2, sueldo_liquido: 850000, tipo_contrato: 'Plazo Fijo', plazo: '3 meses',
      turno: 'Lunes a Jueves 08:00 a 17:30 · Viernes 08:00 a 17:00', colacion: '60 minutos', fecha_ingreso: '2026-10-19', cliente: 'SACYR' },
    aprobaciones: [] },
  { id: 's2', codigo: 'SOL-2026-0412', folio: 'RRH-TRA-000031', tipo: 'traslado', estado: 'aprobada', solicitante_id: 'u-sol', trabajador_id: 't1',
    centro_origen_id: 'c1', centro_destino_id: 'c2', created_at: H('10-01', '08:58'), motivo: null,
    detalle: { cargo: 'Maestro Primera Albañil', fecha_traslado: '2026-10-14', turno: 'Lunes a Jueves 08:00 a 17:30 · Viernes 08:00 a 17:00',
      modificaciones_contractuales: 'Se mantiene el sueldo base; se ajusta el bono de locomoción según la nueva obra.' },
    aprobaciones: [] },
  { id: 's3', codigo: 'SOL-2026-0398', folio: 'RRH-ING-000041', tipo: 'ingreso', estado: 'aprobada', solicitante_id: 'u-sol', centro_origen_id: 'c1',
    created_at: H('09-24', '11:40'), motivo: null,
    detalle: { cargo: 'Jornal', cantidad: 2, sueldo_liquido: 620000, tipo_contrato: 'Plazo Fijo', plazo: '2 meses',
      turno: 'Lunes a Jueves 07:30 a 17:00 · Viernes 07:30 a 16:30', colacion: '30 minutos', fecha_ingreso: '2026-10-01', cliente: 'SACYR' },
    aprobaciones: [] },
  { id: 's4', codigo: 'SOL-2026-0405', folio: 'RRH-VAR-000012', tipo: 'aumento_sueldo', estado: 'rechazada', solicitante_id: 'u-sol', trabajador_id: 't3',
    centro_origen_id: 'c1', created_at: H('09-29', '15:05'), detalle: { monto_aumento: 80000, motivo: 'Asume la bodega del sector norte.' }, aprobaciones: [] },
  { id: 's5', codigo: 'SOL-2026-0416', folio: 'RRH-REN-000009', tipo: 'renovacion', estado: 'pendiente', solicitante_id: 'u-sol', trabajador_id: 't8',
    centro_origen_id: 'c1', created_at: H('10-06', '16:20'),
    detalle: { tipo_contrato_actual: 'Plazo Fijo', fecha_termino_actual: '2026-10-31', tipo_renovacion: 'plazo', nueva_fecha_termino: '2027-01-31', indefinido: false },
    aprobaciones: [] },
  // de Marcelo (supervisor)
  { id: 's6', codigo: 'SOL-2026-0418', folio: 'RRH-CAR-000006', tipo: 'cambio_cargo', estado: 'pendiente', solicitante_id: 'u-sup', trabajador_id: 't9',
    centro_origen_id: 'c2', created_at: H('10-06', '10:02'), detalle: { cargo_actual: 'Jornal', cargo_nuevo: 'Capataz', fecha_efectiva: '2026-11-01', motivo: 'Reemplazo del capataz del turno mañana.' },
    aprobaciones: [] },
  { id: 's7', codigo: 'SOL-2026-0402', folio: 'RRH-DES-000004', tipo: 'desvinculacion', estado: 'aprobada', solicitante_id: 'u-sup', trabajador_id: 't5',
    centro_origen_id: 'c2', created_at: H('09-26', '12:30'), procesado_rrhh_at: H('09-29', '17:10'), procesado_rrhh_por: 'r1',
    detalle: { causal: 'Conclusión del trabajo o faena', fecha_desvinculacion: '2026-10-15', observaciones: null }, aprobaciones: [] },
  { id: 's8', codigo: 'SOL-2026-0419', folio: 'RRH-VAR-000014', tipo: 'aumento_sueldo', estado: 'aprobada', solicitante_id: 'u-sup', trabajador_id: 't4',
    centro_origen_id: 'c2', created_at: H('10-02', '09:30'), detalle: { monto_aumento: 60000, motivo: 'Evaluación de desempeño destacada.' }, aprobaciones: [] },
  // para la bandeja del aprobador (Andrés)
  { id: 's9', codigo: 'SOL-2026-0423', folio: 'RRH-TRA-000033', tipo: 'traslado', estado: 'pendiente', solicitante_id: 'u-sol', trabajador_id: 't6',
    centro_origen_id: 'c3', centro_destino_id: 'c1', created_at: H('10-07', '15:44'), motivo: null,
    detalle: { cargo: 'Soldador', fecha_traslado: '2026-10-20', turno: 'Lunes a Jueves 08:00 a 17:30 · Viernes 08:00 a 17:00', modificaciones_contractuales: null },
    aprobaciones: [] },
  { id: 's10', codigo: 'SOL-2026-0424', folio: 'RRH-DES-000005', tipo: 'desvinculacion', estado: 'pendiente', solicitante_id: 'u-sol', trabajador_id: 't2',
    centro_origen_id: 'c1', created_at: H('10-08', '08:31'), detalle: { causal: 'Renuncia voluntaria', fecha_desvinculacion: '2026-10-31', observaciones: 'Presentó carta de renuncia el 07-10.' },
    aprobaciones: [] },
  // otra aprobada (traslado) para RRHH / Prevención
  { id: 's11', codigo: 'SOL-2026-0409', folio: 'RRH-TRA-000030', tipo: 'traslado', estado: 'aprobada', solicitante_id: 'u-sol', trabajador_id: 't7',
    centro_origen_id: 'c3', centro_destino_id: 'c1', created_at: H('09-30', '10:15'),
    detalle: { cargo: 'Maestro Terminaciones', fecha_traslado: '2026-10-09', turno: 'Lunes a Jueves 07:30 a 17:00 · Viernes 07:30 a 16:30' }, aprobaciones: [] },
];
// aprobaciones
const A = {
  s1: [apr('s1', 1, 'a1', 'pendiente', H('10-07', '09:12')), apr('s1', 2, 'g1', 'pendiente', H('10-07', '09:12'))],
  s2: [apr('s2', 1, 'a1', 'aprobado', H('10-01', '08:58'), H('10-01', '12:30')), apr('s2', 2, 'a2', 'aprobado', H('10-01', '12:30'), H('10-02', '10:10')), apr('s2', 3, 'g1', 'aprobado', H('10-02', '10:10'), H('10-02', '16:45'))],
  s3: [apr('s3', 1, 'a1', 'aprobado', H('09-24', '11:40'), H('09-24', '15:02')), apr('s3', 2, 'g1', 'aprobado', H('09-24', '15:02'), H('09-25', '09:20'))],
  s4: [apr('s4', 1, 'a1', 'rechazado', H('09-29', '15:05'), H('09-30', '09:44'))],
  s5: [apr('s5', 1, 'a1', 'pendiente', H('10-06', '16:20'))],
  s6: [apr('s6', 1, 'a2', 'pendiente', H('10-06', '10:02'))],
  s7: [apr('s7', 1, 'a2', 'aprobado', H('09-26', '12:30'), H('09-26', '18:05'))],
  s8: [apr('s8', 1, 'a2', 'aprobado', H('10-02', '09:30'), H('10-02', '11:15'))],
  s9: [apr('s9', 1, 'a2', 'aprobado', H('10-07', '15:44'), H('10-07', '18:20')), apr('s9', 2, 'a1', 'pendiente', H('10-07', '18:20')), apr('s9', 3, 'g1', 'pendiente', H('10-07', '18:20'))],
  s10: [apr('s10', 1, 'a1', 'pendiente', H('10-08', '08:31'))],
  s11: [apr('s11', 1, 'a2', 'aprobado', H('09-30', '10:15'), H('09-30', '13:00')), apr('s11', 2, 'a1', 'aprobado', H('09-30', '13:00'), H('10-01', '09:30')), apr('s11', 3, 'g1', 'aprobado', H('10-01', '09:30'), H('10-01', '12:00'))],
};
SOLICITUDES.forEach(s => { s.aprobaciones = A[s.id] || []; s.centro_destino_id = s.centro_destino_id ?? null; s.trabajador_id = s.trabajador_id ?? null; s.motivo = s.motivo ?? null; });
export const APROBACIONES = Object.values(A).flat();

// Checklist (catálogo real de las migraciones 0002/0003/0012) -----------
const CK = (codigo, nombre, adm, ope, oblig, hom, orden) => ({ id: 'k-' + codigo, codigo, nombre, aplica_administrativo: adm, aplica_operativo: ope, obligatorio: oblig, requerido_homologacion: hom, orden, activo: true });
export const CHECKLIST = [
  CK('contrato_trabajo', 'Contrato de Trabajo', true, true, true, true, 5),
  CK('anexo_contrato', 'Anexo de Contrato', false, false, false, true, 6),
  CK('cedula_ambos_lados', 'Cédula de identidad o pasaporte, según corresponda (vigente, no certificado)', true, true, true, true, 10),
  CK('certificado_afp', 'Certificado de afiliación AFP', true, true, true, false, 20),
  CK('cotizaciones_afp_12', 'Últimas 12 cotizaciones AFP', true, true, true, false, 30),
  CK('afiliacion_prevision', 'Afiliación de Previsión (Fonasa o Isapre)', true, true, true, false, 40),
  CK('certificado_residencia', 'Certificado de Residencia o comprobante de domicilio', true, true, true, false, 50),
  CK('correo_electronico', 'Correo electrónico', true, true, true, false, 60),
  CK('certificado_cuenta_bancaria', 'Certificado de cuenta bancaria o cartola con N° de cuenta', true, true, true, false, 70),
  CK('estado_civil', 'Estado Civil (certificado/declaración)', true, true, true, false, 80),
  CK('ultimo_finiquito', 'Último finiquito', true, true, true, false, 90),
  CK('calificacion_certificado', 'Calificación o certificado, según el cargo', false, true, false, false, 100),
];

// Contratación de la solicitud s3 (ingreso aprobado, 2 vacantes) ----------
export const CONTRATACIONES = [
  { id: 'k1', solicitud_id: 's3', trabajador_id: null, nombre_candidato: 'Ricardo Antonio Lagos Pinto', nombres_candidato: 'Ricardo Antonio',
    apellido_paterno_candidato: 'Lagos', apellido_materno_candidato: 'Pinto', rut_candidato: '19.876.543-2', telefono_candidato: '+56 9 8765 4321',
    email_candidato: 'rlagos@gmail.com', canal: 'recomendacion', tipo_trabajador: 'operativo', estado: 'en_proceso', creada_por: 'r1',
    created_at: H('09-26', '10:30'), completada_at: null, homologacion_aprobada_at: null },
];
const doc = (cid, codigo, archivo, fecha) => ({ id: `${cid}-${codigo}`, contratacion_id: cid, checklist_item_id: 'k-' + codigo, storage_path: `${cid}/${codigo}/${archivo}`, nombre_archivo: archivo, subido_por: 'r1', created_at: fecha });
export const DOCS_CONTRATACION = [
  doc('k1', 'contrato_trabajo', 'Contrato_RLagos.pdf', H('09-29', '16:20')),
  doc('k1', 'cedula_ambos_lados', 'Cedula_RLagos.pdf', H('09-26', '11:00')),
  doc('k1', 'certificado_afp', 'AFP_Modelo_RLagos.pdf', H('09-26', '11:02')),
  doc('k1', 'afiliacion_prevision', 'Fonasa_RLagos.pdf', H('09-26', '11:03')),
  doc('k1', 'correo_electronico', 'Correo_RLagos.pdf', H('09-26', '11:05')),
];
// Reclutamiento de la otra vacante de s3: 2 candidatos esperando que Sonia elija
export const RECLUTAMIENTOS = [
  { id: 'rc1', solicitud_id: 's3', tipo_trabajador: 'operativo', estado: 'esperando_seleccion', contratacion_id: null, creado_por: 'r1', created_at: H('10-05', '12:00') },
];
export const CANDIDATOS = [
  { id: 'cd1', reclutamiento_id: 'rc1', tanda: 1, nombres: 'Ignacio', apellido_paterno: 'Vergara', apellido_materno: 'Salas', cv_storage_path: 'rc1/cv1.pdf', cv_nombre_archivo: 'CV_Ignacio_Vergara.pdf', decision: 'pendiente', created_at: H('10-05', '12:10') },
  { id: 'cd2', reclutamiento_id: 'rc1', tanda: 1, nombres: 'Paula', apellido_paterno: 'Castillo', apellido_materno: 'Núñez', cv_storage_path: 'rc1/cv2.pdf', cv_nombre_archivo: 'CV_Paula_Castillo.pdf', decision: 'pendiente', created_at: H('10-05', '12:11') },
];
// Documentos de traslado: s2 con 2 de 3, s11 completo
const dt = (sid, codigo, archivo, fecha) => ({ id: `${sid}-${codigo}`, solicitud_id: sid, checklist_item_id: 'k-' + codigo, storage_path: `${sid}/${codigo}/${archivo}`, nombre_archivo: archivo, subido_por: 'r1', created_at: fecha });
export const DOCS_TRASLADO = [
  dt('s2', 'contrato_trabajo', 'Contrato_JCPerez.pdf', H('10-05', '10:00')),
  dt('s2', 'cedula_ambos_lados', 'Cedula_JCPerez.pdf', H('10-05', '10:02')),
  dt('s11', 'contrato_trabajo', 'Contrato_HSoto.pdf', H('10-02', '09:00')),
  dt('s11', 'anexo_contrato', 'Anexo_Traslado_HSoto.pdf', H('10-02', '09:05')),
  dt('s11', 'cedula_ambos_lados', 'Cedula_HSoto.pdf', H('10-02', '09:07')),
];
