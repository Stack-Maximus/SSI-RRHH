/**
 * Constantes de la aplicación.
 * Los roles deben coincidir EXACTAMENTE con el ENUM user_role de la BD:
 *   'admin' | 'rrhh' | 'solicitante' | 'aprobador' | 'prevencionista' | 'supervisor'
 *
 * Varias vistas todavía son placeholders; se construyen en los próximos sprints.
 */

// Menú permitido por rol (claves de vista)
export const ROLES = {
  solicitante:    { menu: ['inicio', 'nueva-solicitud', 'mis-solicitudes'] },
  supervisor:     { menu: ['inicio', 'nueva-solicitud', 'mis-solicitudes'] },
  aprobador:      { menu: ['inicio', 'bandeja'] },
  rrhh:           { menu: ['inicio', 'solicitudes', 'historial', 'contrataciones', 'dashboard-rrhh'] },
  prevencionista: { menu: ['inicio', 'homologacion', 'dashboard-prevencion'] },
  admin:          { menu: ['inicio', 'nueva-solicitud', 'mis-solicitudes', 'bandeja',
                            'solicitudes', 'historial', 'contrataciones', 'homologacion', 'checklist-documentos',
                            'dashboard-rrhh', 'dashboard-prevencion',
                            'usuarios', 'centros-costo', 'cargos', 'trabajadores', 'kpis'] }
};

// Tipos de solicitud que puede crear cada rol desde "Nueva solicitud"
// (mismo formulario para todos; el segmento de tipos varía según el rol).
// Unificado en 'solicitante' (ve los 7) a pedido explícito -- antes los 5
// tipos "de cambio" eran exclusivos de 'supervisor', ver migración
// 0019_solicitante_tipos_cambio.sql (esa es la puerta real; esto de acá
// solo decide qué pestañas se muestran). 'supervisor' se deja igual que
// antes -- no se le quitó nada -- por si ya hay cuentas con ese rol.
export const TIPOS_SOLICITUD_POR_ROL = {
  solicitante: ['ingreso', 'traslado', 'aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion'],
  supervisor:  ['aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion'],
  admin:       ['ingreso', 'traslado', 'aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion']
};

// Ícono + etiqueta de cada vista (para el sidebar)
export const NAV_META = {
  'inicio':               { icon: '\u{1F3E0}', label: 'Inicio' },
  'nueva-solicitud':      { icon: '\u{1F4DD}', label: 'Nueva solicitud' },
  'mis-solicitudes':      { icon: '\u{1F4C4}', label: 'Mis solicitudes' },
  'bandeja':              { icon: '✅',     label: 'Bandeja' },
  'solicitudes':          { icon: '\u{1F4CB}', label: 'Solicitudes' },
  'historial':            { icon: '\u{1F5C2}️', label: 'Historial' },
  'contrataciones':       { icon: '\u{1F4BC}', label: 'Contratación' },
  'homologacion':         { icon: '\u{1F9BA}', label: 'Homologación SST' },
  'checklist-documentos': { icon: '\u{1F4C1}', label: 'Checklist documentos' },
  'usuarios':             { icon: '\u{1F465}', label: 'Usuarios' },
  'centros-costo':        { icon: '\u{1F3D7}️', label: 'Centros de costo' },
  'cargos':               { icon: '\u{1F9F0}', label: 'Cargos' },
  'trabajadores':         { icon: '\u{1F477}', label: 'Trabajadores' },
  'kpis':                 { icon: '\u{1F4CA}', label: 'Dashboard' },
  'dashboard-rrhh':       { icon: '⏱️', label: 'SLA Contratación' },
  'dashboard-prevencion': { icon: '\u{1F6E1}️', label: 'SLA Homologación' }
};

export const ROLE_LABELS = {
  admin: 'Administrador',
  rrhh: 'RRHH',
  solicitante: 'Solicitante',
  aprobador: 'Aprobador',
  prevencionista: 'Prevencionista',
  supervisor: 'Supervisor'
};

// Tipos de solicitud SIN documento/autorización propia que cierre el plazo
// de RRHH (dashboard "SLA Contratación"): se cierran a mano con el botón
// "Marcar como procesado" en Solicitudes. ingreso cierra al subir el
// Contrato de Trabajo; traslado, al completar sus 3 documentos.
export const TIPOS_SOLICITUD_SIN_DOCUMENTO = ['aumento_sueldo', 'bono', 'cambio_cargo', 'renovacion', 'desvinculacion'];

// Etiquetas + ícono de cada tipo de solicitud (para segment-control, badges y listados)
export const TIPO_SOLICITUD_META = {
  ingreso:         { icon: '➕', label: 'Ingreso',            desc: 'Pedir personal nuevo a la obra' },
  traslado:        { icon: '🔁', label: 'Traslado',           desc: 'Mover a un trabajador entre obras' },
  aumento_sueldo:  { icon: '💰', label: 'Aumento de sueldo',  desc: 'Subir el sueldo líquido pactado' },
  bono:            { icon: '🎁', label: 'Bono',               desc: 'Asignar un bono puntual o periódico' },
  cambio_cargo:    { icon: '🔀', label: 'Cambio de cargo',    desc: 'Cambiar el cargo del trabajador' },
  renovacion:      { icon: '⏳', label: 'Renovación',         desc: 'Renovar o extender el contrato' },
  desvinculacion:  { icon: '🔚', label: 'Desvinculación',     desc: 'Terminar la relación laboral de un trabajador' }
};

// Canal por el que se contrata a la persona (proceso de Contratación)
export const CANAL_CONTRATACION_LABELS = {
  recomendacion: 'Recomendación',
  reclutamiento_seleccion: 'Reclutamiento y selección'
};

// Tipo de trabajador, define qué checklist de documentos aplica
export const TIPO_TRABAJADOR_LABELS = {
  administrativo: 'Administrativo',
  operativo: 'Operativo'
};

// Tipo de contrato del trabajador (trabajadores.tipo_contrato, ver migración
// 0013). Compartido entre el formulario de Ingreso (Nueva solicitud) y el
// maestro de Trabajadores (columna editable + Excel), para que no queden dos
// listas que se puedan desincronizar.
export const TIPOS_CONTRATO = ['Plazo Fijo', 'Obra o Faena', 'Indefinido'];

// Causales de desvinculación (formulario "Nueva solicitud" -> Desvinculación).
// Categorías prácticas de uso frecuente, no la tipificación legal completa
// del Código del Trabajo -- se deja "Otra causal" con detalle libre en el
// campo Observaciones para cualquier caso que no encaje.
export const CAUSALES_DESVINCULACION = [
  'Renuncia voluntaria',
  'Mutuo acuerdo de las partes',
  'Vencimiento del plazo convenido',
  'Conclusión del trabajo o faena',
  'Necesidades de la empresa',
  'Causal disciplinaria (Art. 160)',
  'Otra causal'
];

export const ESTADO_CONTRATACION_LABELS = {
  en_proceso: 'En proceso',
  documentos_completos: 'Documentos completos',
  contratado: 'Contratado',
  anulada: 'Anulada'
};

// Proceso de Reclutamiento y selección (migración 0018_reclutamiento.sql).
export const ESTADO_RECLUTAMIENTO_LABELS = {
  esperando_seleccion: 'Esperando selección',
  candidato_elegido: 'Candidato elegido',
  todos_rechazados: 'Todos rechazados'
};
export const DECISION_CANDIDATO_LABELS = {
  pendiente: 'Pendiente',
  elegido: 'Elegido',
  rechazado: 'Rechazado'
};

// Codificación de documentos del Sistema de Gestión (formato Metalium):
// "codigo" identifica el FORMULARIO/plantilla (fijo); "folioPrefijo" es el
// prefijo del correlativo de cada comprobante emitido (el número lo asigna
// la base de datos, ver migración 0010_folio_documentos.sql).
export const DOCUMENTO_CODIGOS = {
  ingreso:         { codigo: 'RRH-FOR-CON-006', folioPrefijo: 'RRH-ING-' },
  traslado:        { codigo: 'RRH-FOR-TRA-002', folioPrefijo: 'RRH-TRA-' },
  aumento_sueldo:  { codigo: 'RRH-FOR-VAR-001', folioPrefijo: 'RRH-VAR-' },
  bono:            { codigo: 'RRH-FOR-VAR-002', folioPrefijo: 'RRH-BON-' },
  cambio_cargo:    { codigo: 'RRH-FOR-VAR-003', folioPrefijo: 'RRH-CAR-' },
  renovacion:      { codigo: 'RRH-FOR-CON-007', folioPrefijo: 'RRH-REN-' },
  // OJO: 'RRH-FOR-VAR-004' es un código provisorio (sigue la misma numeración
  // que los otros 3 tipos "VAR") -- confírmalo o reemplázalo por el código
  // real del Sistema de Gestión de Metalium para el formulario de Desvinculación.
  desvinculacion:  { codigo: 'RRH-FOR-VAR-004', folioPrefijo: 'RRH-DES-' }
};

// Maestro de solicitudes (exportable a Excel): código del formulario, sin folio propio.
export const MAESTRO_SOLICITUDES_CODIGO = 'RRH-FOR-SOL-001';
