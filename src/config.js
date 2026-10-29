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
  rrhh:           { menu: ['inicio', 'solicitudes', 'historial', 'aprobaciones-pendientes', 'contrataciones', 'dashboard-rrhh'] },
  prevencionista: { menu: ['inicio', 'homologacion', 'dashboard-prevencion'] },
  admin:          { menu: ['inicio', 'nueva-solicitud', 'mis-solicitudes', 'bandeja',
                            'solicitudes', 'historial', 'aprobaciones-pendientes', 'contrataciones', 'homologacion', 'checklist-documentos',
                            'dashboard-rrhh', 'dashboard-prevencion',
                            'usuarios', 'centros-costo', 'cargos', 'trabajadores', 'kpis'] }
};

// Tipos de solicitud que puede crear cada rol desde "Nueva solicitud"
// (mismo formulario para todos; el segmento de tipos varía según el rol).
// Unificado en 'solicitante' a pedido explícito -- antes los tipos "de
// cambio" eran exclusivos de 'supervisor', ver migración
// 0019_solicitante_tipos_cambio.sql (esa es la puerta real; esto de acá
// solo decide qué pestañas se muestran). 'supervisor' se deja igual que
// antes -- no se le quitó nada -- por si ya hay cuentas con ese rol.
// 'bono' se quitó de los 3 roles (oct. 2026, a pedido: "Bonos. Quitar todo
// ese apartado"); la base también deja de aceptarlo (migración 0020). El
// tipo sigue existiendo para mostrar las solicitudes de bono ya creadas.
// 'cambio_turno' se agregó en oct. 2026 (migraciones 0021/0022): mismo
// circuito que los otros tipos "de cambio" (aprueba el administrador de obra
// del centro del trabajador).
export const TIPOS_SOLICITUD_POR_ROL = {
  solicitante: ['ingreso', 'traslado', 'aumento_sueldo', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion'],
  supervisor:  ['aumento_sueldo', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion'],
  admin:       ['ingreso', 'traslado', 'aumento_sueldo', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion']
};

// Ícono + etiqueta de cada vista (para el sidebar)
export const NAV_META = {
  'inicio':               { icon: '\u{1F3E0}', label: 'Inicio' },
  'nueva-solicitud':      { icon: '\u{1F4DD}', label: 'Nueva solicitud' },
  'mis-solicitudes':      { icon: '\u{1F4C4}', label: 'Mis solicitudes' },
  'bandeja':              { icon: '✅',     label: 'Bandeja' },
  'solicitudes':          { icon: '\u{1F4CB}', label: 'Solicitudes' },
  'historial':            { icon: '\u{1F5C2}️', label: 'Historial' },
  'aprobaciones-pendientes': { icon: '⏰', label: 'Aprobaciones pendientes' },
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
export const TIPOS_SOLICITUD_SIN_DOCUMENTO = ['aumento_sueldo', 'bono', 'cambio_cargo', 'cambio_turno', 'renovacion', 'desvinculacion'];

// Etiquetas + ícono de cada tipo de solicitud (para segment-control, badges y listados)
export const TIPO_SOLICITUD_META = {
  ingreso:         { icon: '➕', label: 'Ingreso',            desc: 'Pedir personal nuevo a la obra' },
  traslado:        { icon: '🔁', label: 'Traslado',           desc: 'Mover a un trabajador entre obras' },
  aumento_sueldo:  { icon: '💰', label: 'Aumento de sueldo',  desc: 'Subir el sueldo líquido pactado' },
  bono:            { icon: '🎁', label: 'Bono',               desc: 'Asignar un bono puntual o periódico' },
  cambio_cargo:    { icon: '🔀', label: 'Cambio de cargo',    desc: 'Cambiar el cargo del trabajador' },
  cambio_turno:    { icon: '🕒', label: 'Cambio de turno',    desc: 'Pasar a un trabajador a otro turno' },
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

// Tipos de contrato que se pueden pedir en una solicitud de INGRESO. Sin
// "Obra o Faena" (a pedido, oct. 2026). TIPOS_CONTRATO de arriba se deja
// completo: lo usa el maestro de Trabajadores (hay trabajadores que ya
// tienen ese contrato) y la Renovación sigue ofreciendo "por obra o faena".
export const TIPOS_CONTRATO_INGRESO = ['Plazo Fijo', 'Indefinido'];

// Tipos de renovación (formulario "Nueva solicitud" -> Renovación). Cada uno
// pide un dato distinto: 'plazo' -> fecha de culminación (detalle.nueva_fecha_termino),
// 'obra_faena' -> hito de la obra, texto libre (detalle.hito_obra),
// 'indefinido' -> nada (detalle.indefinido = true). Al aprobarse, el trigger
// de la migración 0020 deja trabajadores.tipo_contrato en el valor de la
// derecha (TIPO_CONTRATO_POR_RENOVACION).
export const TIPO_RENOVACION_LABELS = {
  plazo:      'A plazo',
  obra_faena: 'Por obra o faena',
  indefinido: 'Pasa a indefinido'
};
export const TIPO_CONTRATO_POR_RENOVACION = {
  plazo:      'Plazo Fijo',
  obra_faena: 'Obra o Faena',
  indefinido: 'Indefinido'
};

// Causales de desvinculación (formulario "Nueva solicitud" -> Desvinculación).
// Categorías prácticas de uso frecuente, no la tipificación legal completa
// del Código del Trabajo -- se deja "Otra causal" con detalle libre en el
// campo Observaciones para cualquier caso que no encaje. La causal
// disciplinaria (Art. 160) se quitó a pedido (oct. 2026); las solicitudes
// antiguas que la tengan la siguen mostrando tal cual. "Ausentismo" se
// agregó en oct. 2026, a pedido.
export const CAUSALES_DESVINCULACION = [
  'Renuncia voluntaria',
  'Mutuo acuerdo de las partes',
  'Vencimiento del plazo convenido',
  'Conclusión del trabajo o faena',
  'Necesidades de la empresa',
  'Ausentismo',
  'Otra causal'
];

// Causales de desvinculación que exigen adjuntar un documento de respaldo
// (la carta de renuncia firmada). La base de datos valida lo mismo
// (trigger de la migración 0022), esto solo decide qué muestra el formulario.
// Debe coincidir con CAUSALES_CON_ADJUNTO en _shared/solicitud-detalle.ts.
export const CAUSALES_CON_ADJUNTO = ['Renuncia voluntaria'];

// Adjuntos de una solicitud (bucket privado 'solicitud-adjuntos', 0022).
export const ADJUNTO_SOLICITUD = {
  bucket: 'solicitud-adjuntos',
  maxBytes: 10 * 1024 * 1024,
  accept: '.pdf,.png,.jpg,.jpeg,.doc,.docx'
};

// Turnos de trabajo: 3 turnos fijos, cada uno con su horario de Lunes a
// Jueves y su horario (distinto, jornada reducida) del Viernes, más
// "Artículo 22" (trabajador excluido de la limitación de jornada, Art. 22
// del Código del Trabajo: sin horario fijo). Se guarda el texto completo tal
// cual (detalle.turno en Ingreso, detalle.turno_nuevo en Cambio de turno).
export const TURNOS = [
  'Lunes a Jueves 08:00 a 17:30 · Viernes 08:00 a 17:00',
  'Lunes a Jueves 07:30 a 17:00 · Viernes 07:30 a 16:30',
  'Lunes a Jueves 21:00 a 06:00 · Viernes 22:00 a 06:00 (Turno Noche)',
  'Artículo 22 (sin limitación de jornada)'
];

// Plazo máximo de RRHH para procesar CUALQUIER solicitud (aviso en todos
// los formularios de "Nueva solicitud"). Coincide con la meta del dashboard
// "SLA Contratación" (SLA_DIAS = 3 en dashboard-rrhh.js): desde que la
// solicitud queda aprobada hasta que RRHH cierra su parte. Además, la fecha
// de ingreso / traslado / efectiva no puede ser antes de hoy + este plazo.
export const DIAS_HABILES_PROCESO_RRHH = 3;

// Corte de periodo (oct. 2026, a pedido): la fecha de ingreso (Ingreso) y la
// fecha efectiva del aumento (Aumento de sueldo) tienen que caer dentro del
// periodo vigente, que cierra este día de cada mes. Si con los 3 días
// hábiles de RRHH ya no alcanza a quedar antes del corte, el periodo pasa al
// mes siguiente (del 1 al día de corte). Ver periodoConCorte() en
// supabase/functions/_shared/dias-habiles.js.
export const DIA_CORTE_PERIODO = 24;

// Plazo máximo de RRHH para enviar candidatos en un proceso de
// Reclutamiento y selección: días hábiles EXTRA, que se suman a los 3 de la
// contratación. Se cuenta por tanda: si el solicitante rechaza a todos los
// candidatos, el plazo vuelve a empezar desde ese rechazo. (Era 5; pasó a 6
// el 29-oct-2026, a pedido.) Debe coincidir con DIAS_HABILES_RECLUTAMIENTO
// en supabase/functions/notificar/index.ts.
export const DIAS_HABILES_RECLUTAMIENTO = 6;

// Recordatorios a aprobadores (Edge Function notificar, 'recordatorio_aprobador'):
// horas mínimas entre dos recordatorios iguales. Debe coincidir con
// RECORDATORIO_ENFRIAMIENTO_HORAS en supabase/functions/notificar/index.ts
// (que es el que realmente lo hace cumplir).
export const RECORDATORIO_ENFRIAMIENTO_HORAS = 4;

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
  // OJO: 'RRH-FOR-VAR-005' también es provisorio (mismo criterio que VAR-004).
  cambio_turno:    { codigo: 'RRH-FOR-VAR-005', folioPrefijo: 'RRH-TUR-' },
  renovacion:      { codigo: 'RRH-FOR-CON-007', folioPrefijo: 'RRH-REN-' },
  // OJO: 'RRH-FOR-VAR-004' es un código provisorio (sigue la misma numeración
  // que los otros 3 tipos "VAR") -- confírmalo o reemplázalo por el código
  // real del Sistema de Gestión de Metalium para el formulario de Desvinculación.
  desvinculacion:  { codigo: 'RRH-FOR-VAR-004', folioPrefijo: 'RRH-DES-' }
};

// Maestro de solicitudes (exportable a Excel): código del formulario, sin folio propio.
export const MAESTRO_SOLICITUDES_CODIGO = 'RRH-FOR-SOL-001';

// Excel de la dotación (vista Trabajadores), con el diseño del SGC.
// OJO: códigos PROVISORIOS (familia "DOT" = dotación, nueva) -- confírmalos o
// reemplázalos por los códigos reales del Sistema de Gestión de Metalium.
export const DOTACION_CODIGOS = {
  maestro:   { codigo: 'RRH-FOR-DOT-001', titulo: 'Maestro de trabajadores' },
  plantilla: { codigo: 'RRH-FOR-DOT-002', titulo: 'Plantilla de carga de trabajadores' }
};
