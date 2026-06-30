/**
 * Estado global de la aplicación.
 * Objeto mutable; las mutaciones se hacen desde módulos autorizados
 * (Auth para state.user, los módulos db/* para los caches).
 */

export const state = {
  // Usuario actual (null = no logueado)
  user: null,

  // Vista actualmente renderizada
  currentView: null,

  // Caches de datos (se hidratan cuando construyamos las vistas)
  perfiles: [],
  centrosCosto: [],
  trabajadores: [],
  solicitudes: []
};
