/**
 * Política de contraseña de SSI-RRHH: mínimo 8 caracteres, al menos 1 letra
 * mayúscula, al menos 1 letra y al menos 1 símbolo. Un solo lugar con la
 * regla real -- auth.js la usa como gate antes de llamar a Supabase
 * (updatePassword) y reset-password.js la reusa para el checklist visual
 * en vivo, así las dos nunca se pueden desincronizar.
 *
 * OJO: esto es una barrera del LADO DEL CLIENTE. Para que no se pueda
 * saltar llamando a la API de Supabase directo, conviene reforzarla además
 * en Supabase Dashboard -> Authentication -> Policies -> Password
 * Requirements (ahí se puede exigir mayúscula+minúscula+dígito+símbolo a
 * nivel de servidor). Es un ajuste de configuración, no de código -- no se
 * puede dejar prearmado desde acá.
 */

// No exige minúscula EXPLÍCITA por separado porque "al menos 1 letra" ya la
// cubre en la práctica (si hay mayúscula + letra, alcanza para una
// contraseña razonable) -- se mantienen 3 reglas de contenido + longitud,
// tal como se pidió: 8 caracteres, 1 símbolo, 1 mayúscula y letras.
const LETRA_RE = /[A-Za-zÁÉÍÓÚÜáéíóúüÑñ]/;
const MAYUS_RE = /[A-ZÁÉÍÓÚÜÑ]/;
const SIMBOLO_RE = /[^A-Za-z0-9ÁÉÍÓÚÜáéíóúüÑñ]/; // cualquier caracter que no sea letra ni dígito

export const REGLAS_PASSWORD = [
  { id: 'longitud', label: 'Al menos 8 caracteres', test: (v) => v.length >= 8 },
  { id: 'mayuscula', label: 'Al menos 1 letra mayúscula', test: (v) => MAYUS_RE.test(v) },
  { id: 'letra', label: 'Al menos 1 letra', test: (v) => LETRA_RE.test(v) },
  { id: 'simbolo', label: 'Al menos 1 símbolo (ej: ! " # $ % & . , -)', test: (v) => SIMBOLO_RE.test(v) }
];

/** Evalúa las 4 reglas contra una contraseña. `ok` = true solo si las cumple todas. */
export function validarPassword(pw) {
  const v = pw || '';
  const reglas = REGLAS_PASSWORD.map((r) => ({ id: r.id, label: r.label, ok: r.test(v) }));
  return { ok: reglas.every((r) => r.ok), reglas };
}

/** Mensaje corto para mostrar en el <div class="login-error"> cuando falla. */
export function mensajeReglasFaltantes(pw) {
  const { reglas } = validarPassword(pw);
  const faltan = reglas.filter((r) => !r.ok).map((r) => r.label);
  if (!faltan.length) return null;
  return `La contraseña debe cumplir: ${faltan.join(', ')}.`;
}
