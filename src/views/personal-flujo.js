/**
 * El flujo de una evaluación de personal, en un solo lugar.
 *
 * Los estados y sus etiquetas vivían copiados en personal.js,
 * personal-pdi.js y trabajador-ficha.js. Al meter cuatro estados nuevos eso
 * se volvió insostenible: acá quedan una sola vez y los demás importan.
 *
 * El orden, después de que RRHH entrega el resultado, sigue la pauta
 * RRHH-INS-EVA-AD-002 (Hoja 10 de la planilla oficial):
 *
 *   entregada_trabajador   el evaluado ve sus puntajes
 *     → resultados_aceptados   acusa recibo (NO es conformidad todavía)
 *     → reunion_agendada       la jefatura fija la 1:1, ≥5 días hábiles
 *     → reunion_realizada      la 1:1 ya ocurrió
 *     → reflexiones_enviadas   recién ahora responde las 4 preguntas + conformidad
 *     → cerrada_*              la jefatura define el plan de acción y cierra
 *
 * El «aceptar» es deliberadamente un acuse de recibo y no una conformidad,
 * igual que la declaración de la Hoja 7: «Mi firma no implica necesariamente
 * acuerdo con la calificación; implica que se me comunicaron los resultados».
 * Si fuera conformidad, la reunión no serviría para nada: ya estaría decidido.
 */

export const ESTADO_LABELS = {
  asignada: "Asignada",
  autoevaluacion_en_curso: "Autoevaluación en curso",
  autoevaluacion_enviada: "Autoevaluación enviada",
  consolidada: "Consolidada",
  entregada_trabajador: "Resultados entregados",
  resultados_aceptados: "Resultados recibidos",
  reunion_agendada: "Reunión 1:1 agendada",
  reunion_realizada: "Reunión realizada",
  reflexiones_enviadas: "Reflexiones enviadas",
  pendiente_firmas: "Pendiente de firmas",
  cerrada_conforme: "Cerrada · Conforme",
  cerrada_disconformidad: "Cerrada · Disconformidad",
  archivada: "Archivada",
};

export const ESTADO_BADGE = {
  asignada: "badge-neutral",
  autoevaluacion_en_curso: "badge-warning",
  autoevaluacion_enviada: "badge-info",
  consolidada: "badge-info",
  entregada_trabajador: "badge-warning",
  resultados_aceptados: "badge-info",
  reunion_agendada: "badge-info",
  reunion_realizada: "badge-warning",
  reflexiones_enviadas: "badge-warning",
  pendiente_firmas: "badge-warning",
  cerrada_conforme: "badge-success",
  cerrada_disconformidad: "badge-danger",
  archivada: "badge-neutral",
};

/** Los pasos que el evaluado ve como línea de tiempo en su pantalla. */
export const PASOS_CIERRE = [
  { estado: "entregada_trabajador", titulo: "Revisas tus resultados", quien: "tú" },
  { estado: "resultados_aceptados", titulo: "Confirmas que los recibiste", quien: "tú" },
  { estado: "reunion_agendada", titulo: "Se agenda la reunión 1:1", quien: "tu jefatura" },
  { estado: "reunion_realizada", titulo: "Conversan los resultados", quien: "ambos" },
  { estado: "reflexiones_enviadas", titulo: "Respondes las preguntas de cierre", quien: "tú" },
  { estado: "pendiente_firmas", titulo: "Se define el plan de acción", quien: "tu jefatura" },
  { estado: "cerrada_conforme", titulo: "Se firma el acta de cierre", quien: "las cuatro partes" },
];

/** Orden lineal de los estados, para saber qué ya pasó y qué falta. */
const ORDEN = [
  "asignada",
  "autoevaluacion_en_curso",
  "autoevaluacion_enviada",
  "consolidada",
  "entregada_trabajador",
  "resultados_aceptados",
  "reunion_agendada",
  "reunion_realizada",
  "reflexiones_enviadas",
  "pendiente_firmas",
  "cerrada_conforme",
];

export function posicion(estado) {
  if (estado === "cerrada_disconformidad" || estado === "archivada") return ORDEN.length - 1;
  const i = ORDEN.indexOf(estado);
  return i < 0 ? 0 : i;
}

export function yaPaso(estadoActual, estadoPaso) {
  return posicion(estadoActual) >= posicion(estadoPaso);
}

/** Estados en los que la evaluación ya tiene nota calculada. */
export const CON_NOTA = [
  "consolidada",
  "entregada_trabajador",
  "resultados_aceptados",
  "reunion_agendada",
  "reunion_realizada",
  "reflexiones_enviadas",
  "pendiente_firmas",
  "cerrada_conforme",
  "cerrada_disconformidad",
  "archivada",
];

/** Estados desde los que el evaluado ya puede ver su resultado completo. */
export const RESULTADO_VISIBLE = [
  "entregada_trabajador",
  "resultados_aceptados",
  "reunion_agendada",
  "reunion_realizada",
  "reflexiones_enviadas",
  "pendiente_firmas",
  "cerrada_conforme",
  "cerrada_disconformidad",
  "archivada",
];

/** Estados en los que ya existe (o puede existir) un PDI que mirar. */
export const PDI_VISIBLE = [
  "reflexiones_enviadas",
  "pendiente_firmas",
  "cerrada_conforme",
  "cerrada_disconformidad",
  "archivada",
];

export const CATEGORIA_LABELS = {
  excepcional: "Excepcional",
  destacado: "Destacado",
  satisfactorio: "Satisfactorio",
  por_debajo: "Por debajo de lo esperado",
  critico: "Crítico",
};

export const CATEGORIA_BADGE = {
  excepcional: "badge-success",
  destacado: "badge-success",
  satisfactorio: "badge-info",
  por_debajo: "badge-warning",
  critico: "badge-danger",
};

export const MODALIDAD_LABELS = {
  presencial: "Presencial",
  videollamada_teams: "Videollamada Teams",
};

export const PDI_ESTADO_LABELS = { pendiente: "Pendiente", en_curso: "En curso", completada: "Completada" };
export const PDI_ESTADO_BADGE = { pendiente: "badge-neutral", en_curso: "badge-warning", completada: "badge-success" };

/**
 * Lectura de la brecha por dimensión, con los mismos cortes que la Hoja 5 de la
 * planilla: |b| ≥ 1 discrepancia significativa, ≥ 0,5 diferencia moderada.
 */
export function lecturaBrecha(brecha) {
  if (brecha == null) return { texto: "—", clase: "" };
  const a = Math.abs(brecha);
  if (a >= 1) return { texto: "Discrepancia significativa — abordar en la reunión", clase: "is-alerta" };
  if (a >= 0.5) return { texto: "Diferencia moderada", clase: "is-atencion" };
  return { texto: "Visiones alineadas", clase: "is-ok" };
}

/** Días hábiles entre dos fechas (excluye sábados y domingos, no feriados). */
export function diasHabiles(desde, hasta) {
  const a = new Date(desde);
  const b = new Date(hasta);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  if (b <= a) return 0;
  let n = 0;
  const cur = new Date(a);
  while (cur < b) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

/**
 * Qué puede hacer esta persona con esta evaluación, ahora.
 * Una sola función para las dos vistas, así el evaluado y el evaluador nunca
 * ven acciones contradictorias.
 */
export function accionDisponible(e, soyEvaluado) {
  if (soyEvaluado) {
    if (["asignada", "autoevaluacion_en_curso"].includes(e.estado)) {
      return { texto: "Completar autoevaluación", modo: "autoevaluacion" };
    }
    if (e.estado === "entregada_trabajador") {
      return { texto: "Ver mis resultados", modo: "resultado" };
    }
    if (e.estado === "reunion_realizada") {
      return { texto: "Responder preguntas de cierre", modo: "resultado" };
    }
    if (e.estado === "pendiente_firmas") {
      return { texto: "Firmar el acta de cierre", modo: "acta" };
    }
    if (["resultados_aceptados", "reunion_agendada", "reflexiones_enviadas"].includes(e.estado)) {
      return { texto: "Ver el estado de mi evaluación", modo: "resultado" };
    }
    if (["cerrada_conforme", "cerrada_disconformidad", "archivada"].includes(e.estado)) {
      return { texto: "Ver mi resultado", modo: "resultado" };
    }
    return null;
  }

  if (e.estado === "autoevaluacion_enviada") return { texto: "Evaluar", modo: "evaluador" };
  if (e.estado === "resultados_aceptados") return { texto: "Agendar reunión 1:1", modo: "agendar" };
  if (e.estado === "reunion_agendada") return { texto: "Marcar reunión como realizada", modo: "realizada" };
  if (e.estado === "reflexiones_enviadas") return { texto: "Definir plan de acción", modo: "plan" };
  if (e.estado === "pendiente_firmas") return { texto: "Firmar el acta de cierre", modo: "acta" };
  return null;
}

/** Bloques del checklist de la entrevista (Hoja 10) y en qué etapa se llena cada uno. */
export const CHECKLIST_BLOQUES = {
  antes: {
    titulo: "Antes de la reunión",
    subtitulo: "Lo que hay que tener preparado en los días previos",
    etapa: "Se completa al agendar la entrevista",
  },
  durante: {
    titulo: "Durante la reunión",
    subtitulo: "El guion de 6 etapas de la pauta RRHH-INS-EVA-AD-002, en 60 minutos",
    etapa: "Se completa al marcar la reunión como realizada",
  },
  despues: {
    titulo: "Después de la reunión",
    subtitulo: "El trámite de cierre del expediente",
    etapa: "Se completa al definir el plan de acción y cerrar",
  },
};

export const CHECKLIST_RESPUESTAS = [
  { valor: "si", label: "Sí", badge: "badge-success" },
  { valor: "no", label: "No", badge: "badge-danger" },
  { valor: "na", label: "N/A", badge: "badge-neutral" },
];

export const ROL_FIRMANTE_LABELS = {
  trabajador: "Trabajador evaluado",
  supervisor: "Supervisor directo",
  rrhh: "Jefatura de RRHH",
  bienestar: "Jefatura de Bienestar y Crecimiento",
};
