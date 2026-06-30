/**
 * Constantes de la aplicación.
 * Los roles deben coincidir EXACTAMENTE con el ENUM user_role de la BD:
 *   'admin' | 'rrhh' | 'solicitante' | 'aprobador'
 *
 * Varias vistas todavía son placeholders; se construyen en los próximos sprints.
 */

// Menú permitido por rol (claves de vista)
export const ROLES = {
  solicitante: { menu: ['inicio', 'nueva-solicitud', 'mis-solicitudes'] },
  aprobador:   { menu: ['inicio', 'bandeja'] },
  rrhh:        { menu: ['inicio', 'solicitudes', 'historial'] },
  admin:       { menu: ['inicio', 'nueva-solicitud', 'mis-solicitudes', 'bandeja',
                         'solicitudes', 'usuarios', 'centros-costo', 'cargos', 'trabajadores', 'kpis'] }
};

// Ícono + etiqueta de cada vista (para el sidebar)
export const NAV_META = {
  'inicio':          { icon: '\u{1F3E0}', label: 'Inicio' },
  'nueva-solicitud': { icon: '\u{1F4DD}', label: 'Nueva solicitud' },
  'mis-solicitudes': { icon: '\u{1F4C4}', label: 'Mis solicitudes' },
  'bandeja':         { icon: '\u2705',     label: 'Bandeja' },
  'solicitudes':     { icon: '\u{1F4CB}', label: 'Solicitudes' },
  'historial':       { icon: '\u{1F5C2}\uFE0F', label: 'Historial' },
  'usuarios':        { icon: '\u{1F465}', label: 'Usuarios' },
  'centros-costo':   { icon: '\u{1F3D7}\uFE0F', label: 'Centros de costo' },
  'cargos':          { icon: '\u{1F9F0}', label: 'Cargos' },
  'trabajadores':    { icon: '\u{1F477}', label: 'Trabajadores' },
  'kpis':            { icon: '\u{1F4CA}', label: 'Dashboard' }
};

export const ROLE_LABELS = {
  admin: 'Administrador',
  rrhh: 'RRHH',
  solicitante: 'Solicitante',
  aprobador: 'Aprobador'
};

