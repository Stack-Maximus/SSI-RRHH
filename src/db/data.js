/**
 * Acceso a datos de Supabase. Todo pasa por RLS automáticamente.
 */

import { supabase } from '../core/supabase.js';

const SOL_FIELDS = 'id, codigo, folio, tipo, estado, created_at, centro_origen_id, centro_destino_id, motivo, detalle, trabajador_id';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Descarga el PDF que devuelve una Edge Function (comprobante-pdf / maestro-pdf)
 * y dispara la descarga en el navegador. Se usa fetch() directo (no
 * supabase.functions.invoke) porque la respuesta es binaria.
 */
async function descargarPdfDeFuncion(nombreFuncion, params, nombreArchivoPorDefecto) {
  const { data: { session } } = await supabase.auth.getSession();
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${nombreFuncion}${qs}`, {
    headers: {
      Authorization: `Bearer ${session?.access_token || ''}`,
      apikey: SUPABASE_ANON_KEY
    }
  });
  if (!res.ok) {
    let msg = `No se pudo generar el PDF (${res.status}).`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* respuesta no era JSON */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const nombre = (res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]) || nombreArchivoPorDefecto;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const Data = {
  async centros() {
    const { data, error } = await supabase
      .from('centros_costo').select('id, codigo, nombre').eq('activo', true).order('nombre');
    if (error) throw error;
    return data || [];
  },

  async trabajadores() {
    const { data, error } = await supabase
      .from('trabajadores')
      .select('id, rut, nombre, nombres, apellido_paterno, apellido_materno, cargo, sueldo_liquido, centro_costo_id, tipo_contrato, requiere_anexo_renovacion')
      .eq('activo', true).order('nombre');
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
      .select('id, rut, nombre, nombres, apellido_paterno, apellido_materno, profesion, cargo, sueldo_liquido, centro_costo_id, activo, fecha_termino_contrato, contrato_indefinido, tipo_contrato, requiere_anexo_renovacion')
      .order('nombre');
    if (error) throw error;
    return data || [];
  },

  /** Un trabajador puntual, con todos sus campos (para el Perfil del trabajador) */
  async trabajadorPorId(id) {
    const { data, error } = await supabase
      .from('trabajadores')
      .select('id, rut, nombre, nombres, apellido_paterno, apellido_materno, profesion, cargo, sueldo_liquido, centro_costo_id, activo, fecha_termino_contrato, contrato_indefinido, tipo_contrato, requiere_anexo_renovacion')
      .eq('id', id).single();
    if (error) throw error;
    return data;
  },

  /** Edita un campo puntual del trabajador (ej. fecha_termino_contrato, contrato_indefinido) */
  async actualizarTrabajador(id, patch) {
    const { error } = await supabase.from('trabajadores').update(patch).eq('id', id);
    if (error) throw error;
  },

  /** Upsert masivo por RUT (crea nuevos, actualiza existentes) */
  async upsertTrabajadores(rows) {
    if (!rows.length) return;
    const { error } = await supabase
      .from('trabajadores').upsert(rows, { onConflict: 'rut' });
    if (error) throw error;
  },

  /**
   * Historial de solicitudes de un trabajador (traslado, aumento de sueldo,
   * bono, cambio de cargo, renovación -- "anexos" del contrato; ingreso no
   * aplica porque nunca trae trabajador_id todavía inexistente), con sus
   * aprobaciones, para el Perfil del trabajador.
   */
  async solicitudesDeTrabajador(trabajadorId) {
    const { data: sols, error } = await supabase
      .from('solicitudes').select(SOL_FIELDS + ', solicitante_id')
      .eq('trabajador_id', trabajadorId).order('created_at', { ascending: false });
    if (error) throw error;
    const aprs = await this.aprobacionesDe((sols || []).map(s => s.id));
    const byId = new Map();
    aprs.forEach(a => { if (!byId.has(a.solicitud_id)) byId.set(a.solicitud_id, []); byId.get(a.solicitud_id).push(a); });
    return (sols || []).map(s => ({ ...s, aprobaciones: (byId.get(s.id) || []).sort((a, b) => a.orden - b.orden) }));
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

  /**
   * Crea una solicitud de aumento de sueldo / bono / cambio de cargo / renovación
   * (RPC crear_solicitud_cambio: resuelve el administrador de obra del centro del
   * trabajador y crea su única aprobación).
   */
  async crearSolicitudCambio({ tipo, trabajador_id, detalle }) {
    const { data, error } = await supabase.rpc('crear_solicitud_cambio', {
      p_tipo: tipo,
      p_trabajador_id: trabajador_id,
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

  /**
   * Avisa al prevencionista del centro de costo que RRHH inició una contratación,
   * para que empiece la homologación SST. A diferencia de `notificar()`, esta SÍ se
   * espera (await) porque el resultado (`skipped: true` si el centro no tiene
   * prevencionista asignado) se usa para avisarle a RRHH en pantalla.
   */
  async notificarContratacion(contratacionId) {
    try {
      const { data, error } = await supabase.functions.invoke('Notificar', {
        body: { type: 'contratacion_iniciada', contratacion_id: contratacionId }
      });
      if (error) { console.warn('[notificar] EF error:', error.message); return null; }
      if (data?.error) console.warn('[notificar] devolvió:', data.error);
      return data;
    } catch (e) {
      console.warn('[notificar] excepción:', e.message);
      return null;
    }
  },

  /**
   * Dispara las notificaciones nuevas de cierre ("RRHH cerró su parte" /
   * "homologación autorizada") -- Edge Function `notificar`. Igual que
   * notificar(), es fire-and-forget: si falla, se loguea pero no rompe la UX.
   * Acepta solicitud_id O contratacion_id porque en ingreso el cierre es por
   * CONTRATACIÓN (puede haber varias personas por solicitud, cada una con su
   * propio Contrato de Trabajo y su propia homologación), no por solicitud
   * completa; en el resto de los tipos (traslado y los 5 sin documento
   * propio) es siempre por solicitud_id.
   *   type: 'rrhh_cerrado' | 'homologacion_autorizada'
   */
  async notificarEvento(type, { solicitud_id, contratacion_id } = {}) {
    try {
      const body = { type };
      if (solicitud_id) body.solicitud_id = solicitud_id;
      if (contratacion_id) body.contratacion_id = contratacion_id;
      const { data, error } = await supabase.functions.invoke('Notificar', { body });
      if (error) console.warn('[notificar] EF error:', error.message);
      else if (data?.error) console.warn('[notificar] devolvió:', data.error);
      return data;
    } catch (e) {
      console.warn('[notificar] excepción:', e.message);
    }
  },

  /** Descarga el comprobante en PDF (con el encabezado Metalium y Código/Folio) de una solicitud */
  async descargarComprobantePdf(solicitudId) {
    await descargarPdfDeFuncion('comprobante-pdf', { solicitud_id: solicitudId }, 'comprobante.pdf');
  },

  /** Descarga el "Maestro de solicitudes" en PDF (solo rrhh/admin, RLS/rol lo valida la Edge Function) */
  async descargarMaestroPdf() {
    await descargarPdfDeFuncion('maestro-pdf', null, 'Maestro_Solicitudes.pdf');
  },

  // ---------- Gestión de centros de costo (admin) ----------
  async listCentrosAdmin() {
    const { data, error } = await supabase
      .from('centros_costo')
      .select('id, codigo, nombre, admin_obra_id, prevencionista_id, activo')
      .order('nombre');
    if (error) throw error;
    return data || [];
  },

  async crearCentro({ codigo, nombre, admin_obra_id, prevencionista_id }) {
    const { error } = await supabase
      .from('centros_costo').insert({ codigo, nombre, admin_obra_id: admin_obra_id || null, prevencionista_id: prevencionista_id || null });
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
  },

  // ---------- Contratación + SST (homologación) ----------

  /** Una solicitud puntual, con sus aprobaciones (para la vista de detalle de contratación) */
  async solicitudPorId(id) {
    const { data, error } = await supabase
      .from('solicitudes').select(SOL_FIELDS + ', solicitante_id').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  /** Solicitudes de INGRESO ya aprobadas (universo desde el que se inicia contratación) */
  async solicitudesIngresoAprobadas() {
    const { data, error } = await supabase
      .from('solicitudes')
      .select(SOL_FIELDS + ', solicitante_id')
      .eq('tipo', 'ingreso').eq('estado', 'aprobada')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Catálogo de documentos activos, para armar el checklist de un tipo de trabajador */
  async checklistDocumentos() {
    const { data, error } = await supabase
      .from('documentos_checklist').select('*').eq('activo', true).order('orden');
    if (error) throw error;
    return data || [];
  },

  /** Catálogo completo (incluye inactivos), para el panel admin */
  async listChecklistAdmin() {
    const { data, error } = await supabase
      .from('documentos_checklist').select('*').order('orden');
    if (error) throw error;
    return data || [];
  },

  async crearChecklistItem(item) {
    const { error } = await supabase.from('documentos_checklist').insert(item);
    if (error) throw error;
  },

  async actualizarChecklistItem(id, patch) {
    const { error } = await supabase.from('documentos_checklist').update(patch).eq('id', id);
    if (error) throw error;
  },

  /** Todas las contrataciones (RLS: rrhh/admin ven todas, prevencionista también solo-lectura) */
  async listContrataciones() {
    const { data, error } = await supabase
      .from('contrataciones').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Mapa solicitud_id -> [contrataciones], solo para las solicitudes pedidas */
  async contratacionesPorSolicitud(solIds) {
    const u = [...new Set(solIds.filter(Boolean))];
    if (!u.length) return new Map();
    const { data, error } = await supabase
      .from('contrataciones').select('*').in('solicitud_id', u).order('created_at');
    if (error) throw error;
    const map = new Map();
    (data || []).forEach(c => { if (!map.has(c.solicitud_id)) map.set(c.solicitud_id, []); map.get(c.solicitud_id).push(c); });
    return map;
  },

  async contratacionPorId(id) {
    const { data, error } = await supabase.from('contrataciones').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  /** Inicia el proceso de contratación de una persona para una solicitud de ingreso aprobada */
  async iniciarContratacion(payload, userId) {
    const { data, error } = await supabase.from('contrataciones').insert({
      solicitud_id: payload.solicitud_id,
      nombres_candidato: payload.nombres_candidato,
      apellido_paterno_candidato: payload.apellido_paterno_candidato,
      apellido_materno_candidato: payload.apellido_materno_candidato || null,
      rut_candidato: payload.rut_candidato || null,
      telefono_candidato: payload.telefono_candidato || null,
      email_candidato: payload.email_candidato || null,
      canal: payload.canal,
      tipo_trabajador: payload.tipo_trabajador,
      creada_por: userId
    }).select('*').single();
    if (error) throw error;
    return data;
  },

  /** Edita canal / tipo de trabajador / datos del candidato mientras la contratación siga abierta */
  async actualizarContratacion(id, patch) {
    const { error } = await supabase.from('contrataciones').update(patch).eq('id', id);
    if (error) throw error;
  },

  /** Marca la contratación como concluida: crea/actualiza el trabajador (por RUT) y lo vincula */
  async marcarContratado(contratacionId, trabajadorPatch) {
    let trabajadorId = null;
    if (trabajadorPatch?.rut) {
      const { data, error } = await supabase
        .from('trabajadores').upsert(trabajadorPatch, { onConflict: 'rut' }).select('id').single();
      if (error) throw error;
      trabajadorId = data.id;
    }
    const { error: e2 } = await supabase.from('contrataciones')
      .update({ trabajador_id: trabajadorId, estado: 'contratado', completada_at: new Date().toISOString() })
      .eq('id', contratacionId);
    if (e2) throw e2;
    return trabajadorId;
  },

  async anularContratacion(id) {
    const { error } = await supabase.from('contrataciones').update({ estado: 'anulada' }).eq('id', id);
    if (error) throw error;
  },

  /** Documentos subidos de una contratación (RLS filtra homologación para prevencionista) */
  async documentosDeContratacion(contratacionId) {
    const { data, error } = await supabase
      .from('documentos_contratacion').select('*').eq('contratacion_id', contratacionId).order('created_at');
    if (error) throw error;
    return data || [];
  },

  /** Sube un archivo al bucket 'contratacion-documentos' y registra/reemplaza su metadata */
  async subirDocumentoContratacion(contratacionId, checklistItemId, file, userId) {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${contratacionId}/${checklistItemId}/${Date.now()}_${safeName}`;
    const up = await supabase.storage.from('contratacion-documentos').upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    const { data, error } = await supabase.from('documentos_contratacion')
      .upsert({
        contratacion_id: contratacionId, checklist_item_id: checklistItemId,
        storage_path: path, nombre_archivo: file.name, tamano_bytes: file.size, subido_por: userId
      }, { onConflict: 'contratacion_id,checklist_item_id' })
      .select('id').single();
    if (error) throw error;
    return data.id;
  },

  async urlDocumentoContratacion(storagePath, expiresIn = 300) {
    const { data, error } = await supabase.storage
      .from('contratacion-documentos').createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Mapa contratacion_id -> fecha (created_at) en que se subió el
   * documento "Contrato de Trabajo" de esa contratación. Marca el fin del
   * plazo de RRHH y el inicio del plazo de homologación (dashboards de SLA).
   * Si el documento todavía no se sube, esa contratación no aparece en el mapa.
   */
  async fechasContratoSubido(contratacionIds) {
    const u = [...new Set(contratacionIds.filter(Boolean))];
    if (!u.length) return new Map();
    const { data: item, error: e1 } = await supabase
      .from('documentos_checklist').select('id').eq('codigo', 'contrato_trabajo').maybeSingle();
    if (e1) throw e1;
    if (!item) { console.warn('[fechasContratoSubido] no existe el ítem de checklist "contrato_trabajo"'); return new Map(); }
    const { data, error } = await supabase
      .from('documentos_contratacion').select('contratacion_id, created_at')
      .in('contratacion_id', u).eq('checklist_item_id', item.id);
    if (error) throw error;
    return new Map((data || []).map(d => [d.contratacion_id, d.created_at]));
  },

  /**
   * Autoriza el ingreso del trabajador a la obra designada (fin del plazo
   * de homologación SST). Solo puede hacerlo el prevencionista asignado al
   * centro de costo de la solicitud de origen (RLS lo valida, ver
   * migración 0011); botón "Autorizar ingreso a obra" en Homologación SST.
   */
  async autorizarIngresoObra(contratacionId, userId) {
    const { error } = await supabase.from('contrataciones')
      .update({ homologacion_aprobada_at: new Date().toISOString(), homologacion_aprobada_por: userId })
      .eq('id', contratacionId);
    if (error) throw error;
  },

  // ---------- SLA de RRHH para los 6 tipos de solicitud ----------

  /**
   * Solicitudes aprobadas de los tipos dados, con sus aprobaciones (para
   * calcular cuándo terminó de aprobarse -- inicio del plazo de RRHH en
   * los dashboards de SLA). A diferencia de solicitudesIngresoAprobadas(),
   * sirve para cualquier combinación de tipos.
   */
  async solicitudesAprobadasPorTipo(tipos) {
    const { data: sols, error } = await supabase
      .from('solicitudes').select(SOL_FIELDS + ', solicitante_id')
      .in('tipo', tipos).eq('estado', 'aprobada')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const aprs = await this.aprobacionesDe((sols || []).map(s => s.id));
    const byId = new Map();
    aprs.forEach(a => { if (!byId.has(a.solicitud_id)) byId.set(a.solicitud_id, []); byId.get(a.solicitud_id).push(a); });
    return (sols || []).map(s => ({ ...s, aprobaciones: (byId.get(s.id) || []).sort((a, b) => a.orden - b.orden) }));
  },

  /**
   * Marca como procesada por RRHH una solicitud de aumento de sueldo / bono
   * / cambio de cargo / renovación (fin de su plazo de SLA -- estos 4 tipos
   * no tienen un evento propio como el Contrato de Trabajo de ingreso o los
   * documentos de traslado).
   */
  async marcarProcesadoRRHH(solicitudId, userId) {
    const { error } = await supabase.from('solicitudes')
      .update({ procesado_rrhh_at: new Date().toISOString(), procesado_rrhh_por: userId })
      .eq('id', solicitudId);
    if (error) throw error;
  },

  // ---------- Traslado: documentos para homologación ----------

  /** Mapa solicitud_id -> [documentos_traslado], solo para las solicitudes pedidas */
  async documentosTrasladoPorSolicitud(solicitudIds) {
    const u = [...new Set(solicitudIds.filter(Boolean))];
    if (!u.length) return new Map();
    const { data, error } = await supabase
      .from('documentos_traslado').select('*').in('solicitud_id', u).order('created_at');
    if (error) throw error;
    const map = new Map();
    (data || []).forEach(d => { if (!map.has(d.solicitud_id)) map.set(d.solicitud_id, []); map.get(d.solicitud_id).push(d); });
    return map;
  },

  /** Sube un archivo al bucket 'traslado-documentos' y registra/reemplaza su metadata */
  async subirDocumentoTraslado(solicitudId, checklistItemId, file, userId) {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${solicitudId}/${checklistItemId}/${Date.now()}_${safeName}`;
    const up = await supabase.storage.from('traslado-documentos').upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    const { data, error } = await supabase.from('documentos_traslado')
      .upsert({
        solicitud_id: solicitudId, checklist_item_id: checklistItemId,
        storage_path: path, nombre_archivo: file.name, tamano_bytes: file.size, subido_por: userId
      }, { onConflict: 'solicitud_id,checklist_item_id' })
      .select('id').single();
    if (error) throw error;
    return data.id;
  },

  async urlDocumentoTraslado(storagePath, expiresIn = 300) {
    const { data, error } = await supabase.storage
      .from('traslado-documentos').createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Autoriza el ingreso a obra de un trabajador trasladado (fin del plazo
   * de homologación de un traslado). Solo puede hacerlo el prevencionista
   * asignado al centro de costo DESTINO de la solicitud (RLS lo valida,
   * ver migración 0012); botón "Autorizar ingreso a obra" en Homologación SST.
   */
  async autorizarIngresoObraTraslado(solicitudId, userId) {
    const { error } = await supabase.from('solicitudes')
      .update({ homologacion_traslado_aprobada_at: new Date().toISOString(), homologacion_traslado_aprobada_por: userId })
      .eq('id', solicitudId);
    if (error) throw error;
  }
};
