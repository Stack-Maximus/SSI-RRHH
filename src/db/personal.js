/**
 * Capa de acceso a datos para el módulo Evaluación de Personal.
 */

import { supabase } from "../core/supabase.js";

export const Personal = {
  /** La evaluación activa del usuario logueado como EVALUADO (para "Mi evaluación") */
  async miEvaluacionActiva(usuarioId) {
    const { data, error } = await supabase
      .from("eva_evaluaciones")
      .select("*")
      .eq("evaluado_id", usuarioId)
      .in("estado", ["asignada", "autoevaluacion_en_curso"])
      .order("fecha_envio_autoeval", { ascending: false, nullsFirst: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Catálogo de criterios con su dimensión, ordenado para el formulario */
  async criterios() {
    const { data, error } = await supabase
      .from("eva_criterios")
      .select("codigo, orden, texto_criterio, dimension_codigo, eva_dimensiones(nombre, peso)")
      .order("dimension_codigo")
      .order("orden");
    if (error) throw error;
    return data;
  },

  /** Respuestas de autoevaluación ya guardadas para esta evaluación (progreso previo) */
  async misRespuestasAuto(evaluacionId) {
    const { data, error } = await supabase
      .from("eva_detalle_auto")
      .select("criterio_codigo, nota, comentario")
      .eq("evaluacion_id", evaluacionId);
    if (error) throw error;
    const porCriterio = {};
    for (const r of data) porCriterio[r.criterio_codigo] = { nota: r.nota, comentario: r.comentario };
    return porCriterio;
  },

  /** Guarda (o actualiza) la respuesta de un criterio — guardado progresivo */
  async guardarRespuestaAuto(evaluacionId, criterioCodigo, nota, comentario) {
    const { error } = await supabase
      .from("eva_detalle_auto")
      .upsert(
        { evaluacion_id: evaluacionId, criterio_codigo: criterioCodigo, nota, comentario: comentario || null },
        { onConflict: "evaluacion_id,criterio_codigo" }
      );
    if (error) throw error;
  },

  /** Marca la evaluación como "en curso" la primera vez que el trabajador guarda algo */
  async marcarEnCurso(evaluacionId) {
    const { error } = await supabase
      .from("eva_evaluaciones")
      .update({ estado: "autoevaluacion_en_curso" })
      .eq("id", evaluacionId)
      .eq("estado", "asignada");
    if (error) throw error;
  },

  /** Envía la autoevaluación — requiere las 30 respuestas completas */
  async enviarAutoevaluacion(evaluacionId) {
    const { error } = await supabase
      .from("eva_evaluaciones")
      .update({ estado: "autoevaluacion_enviada", fecha_envio_autoeval: new Date().toISOString() })
      .eq("id", evaluacionId);
    if (error) throw error;
  },

  // ---------------------------------------------------------------------
  // Panel del evaluador
  // ---------------------------------------------------------------------

  /** Evaluaciones donde el usuario logueado es el EVALUADOR, pendientes de su parte */
  async misEvaluacionesPendientes(evaluadorId) {
    const { data, error } = await supabase
      .from("eva_evaluaciones")
      .select("id, estado, nro_evaluacion, cargo_actual, evaluado:perfiles!evaluado_id(id, nombre, cargo)")
      .eq("evaluador_id", evaluadorId)
      .in("estado", ["autoevaluacion_enviada", "autoevaluacion_en_curso", "asignada"])
      .order("fecha_envio_autoeval", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  },

  async detalleSup(evaluacionId) {
    const { data, error } = await supabase
      .from("eva_detalle_sup")
      .select("criterio_codigo, nota, comentario_evidencia")
      .eq("evaluacion_id", evaluacionId);
    if (error) throw error;
    const porCriterio = {};
    for (const r of data) porCriterio[r.criterio_codigo] = { nota: r.nota, comentario: r.comentario_evidencia };
    return porCriterio;
  },

  async guardarRespuestaSup(evaluacionId, criterioCodigo, nota, comentarioEvidencia) {
    const { error } = await supabase
      .from("eva_detalle_sup")
      .upsert(
        { evaluacion_id: evaluacionId, criterio_codigo: criterioCodigo, nota, comentario_evidencia: comentarioEvidencia || null },
        { onConflict: "evaluacion_id,criterio_codigo" }
      );
    if (error) throw error;
  },

  /** Envía la evaluación del jefe — la deja "consolidada" (el cálculo de promedios se agrega en el siguiente pase) */
  async enviarEvaluacionSup(evaluacionId) {
    const { error } = await supabase
      .from("eva_evaluaciones")
      .update({ estado: "consolidada", fecha_envio_evaluacion: new Date().toISOString() })
      .eq("id", evaluacionId);
    if (error) throw error;
  },
};
