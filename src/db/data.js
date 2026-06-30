/**
 * Acceso a datos de Supabase. Todo pasa por RLS automáticamente.
 */

import { supabase } from '../core/supabase.js';

const SOL_FIELDS = 'id, codigo, tipo, estado, created_at, centro_origen_id, centro_destino_id, motivo, detalle, trabajador_id';

export const Data = {
  async centros() {
    const { data, error } = await supabase
      .from('centros_costo').select('id, codigo, nombre').eq('activo', true).order('nombre');
    if (error) throw error;
    return data || [];
  },

  async trabajadores() {
    const { data, error } = await supabase
      .from('trabajadores').select('id, rut, nombre, cargo, sueldo_liquido, centro_costo_id').eq('activo', true).order('nombre');
    if (error) throw error;
    return data || [];
  },

  /** Mapa id -> trabajador, solo para los ids pedidos */
  async trabajadoresPorId(ids) {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const { data, error } = await supabase
      .from('trabajadores').select('id, nombre, cargo').in('id', u);
    if (error) throw error;
    return new Map((data || []).map(t => [t.id, t]));
  },

  /** Todos los trabajadores con todos sus campos (para importar/exportar el maestro) */
  async todosTrabajadores() {
    const { data, error } = await supabase
      .from('trabajadores')
      .select('id, rut, nombre, profesion, cargo, sueldo_liquido, centro_costo_id, activo')
      .order('nombre');
    if (error) throw error;
    return data || [];
  },

  /** Upsert masivo por RUT (crea nuevos, actualiza existentes) */
  async upsertTrabajadores(rows) {
    if (!rows.length) return;
    const { error } = await supabase
      .from('trabajadores').upsert(rows, { onConflict: 'rut' });
    if (error) throw error;
  },

  async crearSolicitud({ tipo, trabajador_id, centro_origen_id, centro_destino_id, motivo, detalle }) {
    const { data, error } = await supabase.rpc('crear_solicitud', {
      p_tipo: tipo,
      p_trabajador_id: trabajador_id || null,
      p_centro_origen_id: centro_origen_id,
      p_centro_destino_id: centro_destino_id || null,
      p_motivo: motivo || null,
      p_detalle: detalle || {}
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },

  /** Solicitudes creadas por el usuario, con sus aprobaciones */
  async misSolicitudes(userId) {
    const { data: sols, error } = await supabase
      .from('solicitudes').select(SOL_FIELDS).eq('solicitante_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    const ids = (sols || []).map(s => s.id);
    const aprs = await this.aprobacionesDe(ids);
    const byId = new Map();
    aprs.forEach(a => { (byId.get(a.solicitud_id) || byId.set(a.solicitud_id, []).get(a.solicitud_id)).push(a); });
    return (sols || []).map(s => ({ ...s, aprobaciones: (byId.get(s.id) || []).sort((a, b) => a.orden - b.orden) }));
  },

  async aprobacionesDe(solIds) {
    if (!solIds.length) return [];
    const { data, error } = await supabase
      .from('aprobaciones').select('solicitud_id, orden, decision, aprobador_id, tiempo_respuesta, asignado_at, decidido_at').in('solicitud_id', solIds);
    if (error) throw error;
    return data || [];
  },

  /** Todas las solicitudes (admin/rrhh ven todo por RLS), con sus aprobaciones */
  async listTodasSolicitudes() {
    const { data: sols, error } = await supabase
      .from('solicitudes').select(SOL_FIELDS + ', solicitante_id').order('created_at', { ascending: false });
    if (error) throw error;
    const aprs = await this.aprobacionesDe((sols || []).map(s => s.id));
    const byId = new Map();
    aprs.forEach(a => { if (!byId.has(a.solicitud_id)) byId.set(a.solicitud_id, []); byId.get(a.solicitud_id).push(a); });
    return (sols || []).map(s => ({ ...s, aprobaciones: (byId.get(s.id) || []).sort((a, b) => a.orden - b.orden) }));
  },

  /** Mapa id -> perfil (nombre/email), solo para los ids pedidos */
  async perfilesPorId(ids) {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const { data, error } = await supabase.from('perfiles').select('id, nombre, email').in('id', u);
    if (error) throw error;
    return new Map((data || []).map(p => [p.id, p]));
  },

  /** Solicitudes pendientes de aprobación POR este usuario */
  async bandejaPendientes(userId) {
    // mi_bandeja() (SECURITY DEFINER) devuelve solo las aprobaciones que son MI TURNO
    const { data: turno, error } = await supabase.rpc('mi_bandeja');
    if (error) throw error;
    const solIds = [...new Set((turno || []).map(t => t.solicitud_id))];
    if (!solIds.length) return [];
    const { data: sols, error: e2 } = await supabase
      .from('solicitudes').select(SOL_FIELDS).in('id', solIds);
    if (e2) throw e2;
    const solMap = new Map((sols || []).map(s => [s.id, s]));
    return (turno || [])
      .filter(t => solMap.has(t.solicitud_id))
      .map(t => ({ aprobacionId: t.aprobacion_id, orden: t.orden, sol: solMap.get(t.solicitud_id) }))
      .sort((x, y) => new Date(x.sol.created_at) - new Date(y.sol.created_at));
  },

  /** Aprueba o rechaza una aprobación. El trigger de la BD recalcula el estado y los tiempos. */
  async decidir(aprobacionId, decision, comentario = null) {
    const { error } = await supabase
      .from('aprobaciones').update({ decision, comentario }).eq('id', aprobacionId);
    if (error) throw error;
  },

  // ---------- Gestión de usuarios (admin) ----------
  async listUsuarios() {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, email, rol, centro_costo_id, es_gerente_operaciones, activo')
      .order('nombre');
    if (error) throw error;
    return data || [];
  },

  async actualizarUsuario(id, patch) {
    const { error } = await supabase.from('perfiles').update(patch).eq('id', id);
    if (error) throw error;
  },

  /** Invita a un usuario vía Edge Function (correo Metalium + rol/centro pre-asignados) */
  async invitarUsuario({ email, nombre, rol, centro_costo_id }) {
    const { data, error } = await supabase.functions.invoke('invitar-usuario', {
      body: { email, nombre, rol, centro_costo_id: centro_costo_id || null }
    });
    if (error) {
      const detail = data?.error || error.message || 'No se pudo enviar la invitación';
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /**
   * Dispara una notificación por correo (Edge Function `notificar`).
   * Fire-and-forget: si falla, se loguea pero NO rompe la UX.
   *   type: 'pendiente_aprobador' | 'cambio_estado'
   */
  async notificar(type, solicitud_id) {
    try {
      const { data, error } = await supabase.functions.invoke('Notificar', { body: { type, solicitud_id } });
      if (error) console.warn('[notificar] EF error:', error.message);
      else if (data?.error) console.warn('[notificar] devolvió:', data.error);
      return data;
    } catch (e) {
      console.warn('[notificar] excepción:', e.message);
    }
  },

  // ---------- Gestión de centros de costo (admin) ----------
  async listCentrosAdmin() {
    const { data, error } = await supabase
      .from('centros_costo')
      .select('id, codigo, nombre, admin_obra_id, activo')
      .order('nombre');
    if (error) throw error;
    return data || [];
  },

  async crearCentro({ codigo, nombre, admin_obra_id }) {
    const { error } = await supabase
      .from('centros_costo').insert({ codigo, nombre, admin_obra_id: admin_obra_id || null });
    if (error) throw error;
  },

  async actualizarCentro(id, patch) {
    const { error } = await supabase.from('centros_costo').update(patch).eq('id', id);
    if (error) throw error;
  },

  // ---------- Cargos ----------
  /** Nombres de cargos activos, para los desplegables */
  async cargos() {
    const { data, error } = await supabase
      .from('cargos').select('nombre').eq('activo', true).order('nombre');
    if (error) throw error;
    return (data || []).map(c => c.nombre);
  },

  async listCargosAdmin() {
    const { data, error } = await supabase
      .from('cargos').select('id, nombre, activo').order('nombre');
    if (error) throw error;
    return data || [];
  },

  async crearCargo(nombre) {
    const { error } = await supabase.from('cargos').insert({ nombre });
    if (error) throw error;
  },

  async actualizarCargo(id, patch) {
    const { error } = await supabase.from('cargos').update(patch).eq('id', id);
    if (error) throw error;
  }
};
