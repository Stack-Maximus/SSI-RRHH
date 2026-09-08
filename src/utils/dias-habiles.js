/**
 * Días hábiles en Chile (lunes a viernes, sin feriados irrenunciables
 * nacionales) -- usado para medir el SLA de procesos internos:
 *   - RRHH: armar y subir el Contrato de Trabajo (meta: 3 días hábiles)
 *   - Prevención: homologación SST hasta autorizar el ingreso a obra
 *     (meta: 8 días hábiles)
 *
 * Qué NO cubre (documentado también en NOTAS_CONTRATACION_SST.md):
 *
 *   1. Feriados REGIONALES (ej. Arica y Parinacota 7-jun, Chillán 20-ago):
 *      no se incluyen porque no existe un campo región/comuna por centro
 *      de costo. Si algún centro de costo los necesita, hay que agregar
 *      ese campo primero y filtrar por región.
 *   2. Feriados "ad-hoc" de elecciones/plebiscitos/censo (Leyes 20.983 y
 *      20.215): la fecha depende del calendario electoral de cada año y
 *      no se puede calcular. Se mantienen a mano en FERIADOS_ADHOC.
 *   3. "Día Nacional de los Pueblos Indígenas" (Ley 21.357): cae el
 *      solsticio de invierno, que varía año a año de forma astronómica
 *      (20, 21 o 22 de junio) y no tiene fórmula perpetua. Se mantiene una
 *      tabla SOLSTICIOS con los años ya confirmados; si un año no está en
 *      la tabla, se usa el 21 de junio por defecto (el más frecuente).
 *
 * Para años nuevos: agregar el año a SOLSTICIOS (confirmar la fecha
 * oficial cuando se publique) y completar FERIADOS_ADHOC si ese año hay
 * elecciones. Los feriados fijos y los de Semana Santa se calculan solos.
 */

// --- Solsticio de invierno (Día Nacional de los Pueblos Indígenas) ---
// [mes, día] confirmados por año. Si el año no está, se usa el default.
const SOLSTICIOS = {
  2024: [6, 20],
  2025: [6, 21],
  2026: [6, 21],
  2027: [6, 21]
};
const SOLSTICIO_DEFAULT = [6, 21];

// Feriados ad-hoc (elecciones, plebiscitos, censo) -- mantener a mano.
// Formato: 'YYYY-MM-DD'.
const FERIADOS_ADHOC = [
  // ej: '2026-11-15', // 1ª vuelta presidencial (agregar cuando se confirme)
];

function pad(n) { return String(n).padStart(2, '0'); }
function clave(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
function claveDeFecha(d) { return clave(d.getFullYear(), d.getMonth() + 1, d.getDate()); }

/** Domingo de Pascua de un año (algoritmo de Gauss/Meeus, calendario gregoriano). */
function domingoPascua(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const n = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * n + 114) / 31);
  const dia = ((h + l - 7 * n + 114) % 31) + 1;
  return new Date(year, mes - 1, dia);
}

function sumarDias(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Traslada al lunes SIGUIENTE si cae martes a viernes (si cae sáb/dom/lun, no se toca). */
function trasladarALunesSiguienteSiEntreSemana(date) {
  const dow = date.getDay(); // 0=dom .. 6=sáb
  if (dow >= 2 && dow <= 5) return sumarDias(date, 8 - dow);
  return date;
}

/** Traslada al lunes ANTERIOR solo si cae martes o miércoles (regla propia del 31-oct). */
function trasladarALunesAnteriorSiMarOMier(date) {
  const dow = date.getDay();
  if (dow === 2) return sumarDias(date, -1);
  if (dow === 3) return sumarDias(date, -2);
  return date;
}

/** Set (claves 'YYYY-MM-DD') de feriados nacionales irrenunciables de un año. */
const cacheFeriados = new Map();
function feriadosDelAnio(year) {
  if (cacheFeriados.has(year)) return cacheFeriados.get(year);

  const set = new Set();
  const add = (m, d) => set.add(clave(year, m, d));

  // Fijos, sin traslado
  add(1, 1);   // Año Nuevo
  add(5, 1);   // Día Nacional del Trabajo
  add(5, 21);  // Día de las Glorias Navales
  add(7, 16);  // Virgen del Carmen
  add(8, 15);  // Asunción de la Virgen
  add(9, 18);  // Fiestas Patrias
  add(9, 19);  // Glorias del Ejército
  add(11, 1);  // Día de Todos los Santos
  add(12, 8);  // Inmaculada Concepción
  add(12, 25); // Navidad

  // Movibles (Semana Santa)
  const pascua = domingoPascua(year);
  set.add(claveDeFecha(sumarDias(pascua, -2))); // Viernes Santo
  set.add(claveDeFecha(sumarDias(pascua, -1))); // Sábado Santo

  // Con traslado al lunes siguiente si caen entre semana (martes a viernes)
  set.add(claveDeFecha(trasladarALunesSiguienteSiEntreSemana(new Date(year, 5, 29))));  // San Pedro y San Pablo (29-jun)
  set.add(claveDeFecha(trasladarALunesSiguienteSiEntreSemana(new Date(year, 9, 12))));  // Encuentro de Dos Mundos (12-oct)

  // Día de las Iglesias Evangélicas y Protestantes: traslado especial (solo mar/miér -> lunes anterior)
  set.add(claveDeFecha(trasladarALunesAnteriorSiMarOMier(new Date(year, 9, 31))));

  // Día Nacional de los Pueblos Indígenas (solsticio de invierno)
  const [sm, sd] = SOLSTICIOS[year] || SOLSTICIO_DEFAULT;
  add(sm, sd);

  // Ad-hoc (elecciones, censo, etc.)
  FERIADOS_ADHOC.filter(f => f.startsWith(`${year}-`)).forEach(f => set.add(f));

  cacheFeriados.set(year, set);
  return set;
}

/** ¿La fecha dada es feriado nacional irrenunciable? */
export function esFeriado(date) {
  const d = new Date(date);
  return feriadosDelAnio(d.getFullYear()).has(claveDeFecha(d));
}

/** ¿La fecha dada es día hábil (lunes a viernes y no feriado)? */
export function esDiaHabil(date) {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !esFeriado(d);
}

/**
 * Días hábiles transcurridos ENTRE dos fechas/timestamps. No cuenta el día
 * de `desde` -- el plazo empieza a correr el día siguiente (mismo criterio
 * que los plazos administrativos en Chile, art. 25 Ley 19.880) -- y cuenta
 * cada día hábil desde ahí hasta el día de `hasta`, ambos inclusive.
 *
 * Ej: si `desde` es lunes 10:00 y `hasta` es el mismo lunes 18:00, da 0
 * (el plazo recién empieza a correr el martes). Si `hasta` es el martes
 * siguiente, da 1. Si `hasta` es anterior o igual a `desde`, da 0.
 */
export function diasHabilesEntre(desde, hasta) {
  const d0 = new Date(desde);
  const d1 = new Date(hasta);
  if (isNaN(d0) || isNaN(d1) || d1 <= d0) return 0;

  let cursor = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1);
  const fin = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  let n = 0;
  while (cursor <= fin) {
    if (esDiaHabil(cursor)) n++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return n;
}
