/**
 * Días hábiles en Chile (feriados nacionales, Semana Santa, traslados...).
 * La implementación vive en supabase/functions/_shared/dias-habiles.js para
 * que la usen también las Edge Functions (Deno) sin duplicarla -- ver la
 * documentación completa allá.
 */
export * from '../../supabase/functions/_shared/dias-habiles.js';
