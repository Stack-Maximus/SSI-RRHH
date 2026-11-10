// =====================================================================
//  Edge Function: notificar
//  Envía correos (Microsoft Graph, buzón Metalium) ante eventos de solicitudes.
//  El frontend la invoca tras el evento (fire-and-forget).
//
//  Payload:
//   { type: 'pendiente_aprobador',   solicitud_id }    -> avisa a los aprobadores pendientes (al crear)
//   { type: 'cambio_estado',         solicitud_id }    -> al quedar aprobada o rechazada:
//        * rechazada  -> avisa al solicitante
//        * aprobada   -> avisa a solicitante + aprobadores + RRHH, con el comprobante en PDF
//                         (mismo diseño -- encabezado Metalium + Código/Folio -- que el PDF
//                         que se puede descargar a demanda desde la app, ver comprobante-pdf)
//   { type: 'contratacion_iniciada', contratacion_id } -> RRHH inició la contratación de una
//                         solicitud de ingreso ya aprobada: avisa al prevencionista asignado al
//                         centro de costo de esa solicitud (`centros_costo.prevencionista_id`,
//                         ver 0009_homologacion_por_centro.sql) para que empiece la homologación
//                         SST con la documentación que RRHH vaya subiendo. Si el centro todavía no
//                         tiene prevencionista asignado, no manda nada y devuelve `skipped: true`
//                         (el frontend le avisa a RRHH en pantalla para que lo asigne).
//   { type: 'rrhh_cerrado', solicitud_id | contratacion_id } -> RRHH terminó su parte de la
//                         solicitud (sube el Contrato de Trabajo en ingreso, completa los 3
//                         documentos en traslado, o hace clic en "Marcar como procesado" en el
//                         resto de los tipos) -- avisa SOLO al solicitante original. En ingreso se
//                         manda contratacion_id (puede haber varias personas por solicitud, cada
//                         una con su propio cierre); en el resto, solicitud_id directo.
//   { type: 'homologacion_autorizada', solicitud_id | contratacion_id } -> Prevención autorizó el
//                         ingreso a obra (fin del plazo de homologación SST, solo aplica a ingreso
//                         y traslado) -- avisa SOLO al solicitante original. Mismo criterio
//                         contratacion_id/solicitud_id que 'rrhh_cerrado'.
//   { type: 'homologacion_rechazada', solicitud_id | contratacion_id } -> Prevención rechazó la
//                         homologación (motivo obligatorio, ver migración 0016 y homologacion.js) --
//                         consulta el rechazo más reciente de ese caso (no confía en el payload) y
//                         avisa: SIEMPRE al solicitante original y a todo perfil con
//                         es_gerente_prevencion=true; a RRHH (rol='rrhh') SOLO si ese rechazo marcó
//                         al menos un documento del checklist como el problema.
//   { type: 'reclutamiento_opciones',          reclutamiento_id } -> RRHH agregó una tanda de
//                         candidatos (primera vez o tras un rechazo total, ver migración 0018 y
//                         reclutamiento_agregar_candidatos()) -- avisa SOLO al solicitante original
//                         de la solicitud dueña de ese proceso, con la cantidad de candidatos.
//   { type: 'reclutamiento_elegido',           reclutamiento_id } -> el solicitante eligió un
//                         candidato (reclutamiento_decidir_candidato(), decision='elegido') -- ya se
//                         creó la contratación sola; avisa a todo perfil con rol='rrhh' para que
//                         sigan el proceso (RUT, checklist de documentos, etc.) desde Contratación.
//   { type: 'reclutamiento_todos_rechazados',  reclutamiento_id } -> el solicitante rechazó a todos
//                         los candidatos de la tanda vigente -- avisa a todo perfil con rol='rrhh'
//                         para que agregue una tanda nueva.
//   { type: 'recordatorio_aprobador', aprobador_id | solicitud_id } -> (oct. 2026) recordatorio
//                         por correo, PERSONALIZADO, a un aprobador que tiene solicitudes esperando
//                         su decisión (solo cuenta el turno vigente: la aprobación es secuencial):
//        * aprobador_id -> lo pide RRHH o admin: un correo con TODAS sus solicitudes en turno.
//        * solicitud_id -> lo pide quien creó la solicitud (o RRHH / admin): a quien(es) le toca
//                          aprobar esa solicitud, solo con esa solicitud.
//                         El mensaje (asunto, saludo, tono) depende de cuánto lleva esperando la
//                         más antigua: al día (< 1 día hábil), atrasada (1-2) o crítica (3 o más),
//                         y lista cada solicitud con su tiempo de espera. Para no saturar, no deja
//                         repetir el mismo recordatorio antes de RECORDATORIO_ENFRIAMIENTO_HORAS
//                         (responde 429 con el mensaje de cuándo se puede); cada envío queda en
//                         public.recordatorios_aprobacion (migración 0022).
//
//  Botón "Ir a ..." en TODOS los correos (oct. 2026): lleva al sistema y, con ?ir=<vista>, abre
//  directo la vista que corresponde (bandeja, mis-solicitudes, ...) después de iniciar sesión
//  (ver Auth.vistaDelEnlace() en src/core/auth.js). La URL base sale del secret APP_URL
//  (RECOMENDADO: configúralo con la URL pública de Vercel); si no está, se usa el origen del
//  navegador que disparó el correo, solo si es https://*.vercel.app, https://*.metalium.cl o
//  localhost (ver urlApp()).
//
//  Diseño (nov. 2026): todos los correos tienen el diseño de los exportables (SGC "Concept 3"):
//  encabezado con logo + banda azul + Código/Fecha/Revisión, mensaje, secciones numeradas con
//  fichas o tabla y pie METALIUM. Ver correoSgc() en _shared/correo-sgc.js y las plantillas abajo.
//
//  Deploy:  supabase functions deploy notificar
//  Secrets: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_FROM_ADDRESS
//           APP_URL (recomendado)
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { construirComprobantePdf } from '../_shared/pdf-comprobante.ts';
import { tipoTxt, DOCUMENTO_CODIGOS, TIPO_LABELS, MAESTRO_SOLICITUDES_CODIGO, detalleLineas } from '../_shared/solicitud-detalle.ts';
import { LOGO_METALIUM_PNG_B64 } from '../_shared/logo.ts';
import { correoSgc, escCorreo } from '../_shared/correo-sgc.js';
import { documentoComprobante, fechaDMY, fechaHora, esAprobacionAutomatica } from '../_shared/sgc-documentos.js';
import { ICONOS_CORREO_PNG_B64 } from '../_shared/iconos-correo.ts';
import { diasHabilesEntre } from '../_shared/dias-habiles.js';

// Horas mínimas entre dos recordatorios iguales al mismo aprobador (debe
// coincidir con RECORDATORIO_ENFRIAMIENTO_HORAS en src/config.js).
const RECORDATORIO_ENFRIAMIENTO_HORAS = 4;
// Niveles de espera en días hábiles (deben coincidir con src/ui/aprobacion-turno.js).
const ESPERA_DIAS_ATRASADA = 1;
const ESPERA_DIAS_CRITICA = 3;
// Plazo de RRHH una vez aprobada (src/config.js DIAS_HABILES_PROCESO_RRHH).
const DIAS_HABILES_PROCESO_RRHH = 3;
// Plazo de RRHH para enviar candidatos, por tanda (src/config.js DIAS_HABILES_RECLUTAMIENTO).
const DIAS_HABILES_RECLUTAMIENTO = 6;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { type, solicitud_id, contratacion_id, reclutamiento_id, aprobador_id } = await req.json();
    if (!type) return json({ error: 'Falta type.' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'No autenticado.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const appUrl = urlApp(req);

    // ---- contratación iniciada -> avisa al prevencionista del centro ----
    // Va antes del resto porque usa `contratacion_id`, no `solicitud_id`.
    if (type === 'contratacion_iniciada') {
      if (!contratacion_id) return json({ error: 'Falta contratacion_id.' }, 400);

      const { data: contrat, error: cErr } = await admin
        .from('contrataciones')
        .select('id, solicitud_id, nombre_candidato, canal, tipo_trabajador')
        .eq('id', contratacion_id).single();
      if (cErr || !contrat) return json({ error: 'Contratación no encontrada.' }, 404);

      const { data: solIngreso } = await admin
        .from('solicitudes').select('id, codigo, folio, centro_origen_id, detalle')
        .eq('id', contrat.solicitud_id).single();
      if (!solIngreso) return json({ error: 'La solicitud de esta contratación ya no existe.' }, 404);

      const { data: centro } = await admin
        .from('centros_costo').select('id, codigo, nombre, prevencionista_id')
        .eq('id', solIngreso.centro_origen_id).single();
      if (!centro?.prevencionista_id) {
        return json({ ok: true, skipped: true, reason: 'centro sin prevencionista asignado' });
      }

      const { data: prev } = await admin
        .from('perfiles').select('email, nombre, activo').eq('id', centro.prevencionista_id).single();
      if (!prev?.email || prev.activo === false) {
        return json({ ok: true, skipped: true, reason: 'prevencionista sin correo o inactivo' });
      }

      const d = await datosSolicitud(admin, solIngreso.id);
      if (!d) return json({ error: 'La solicitud de esta contratación ya no existe.' }, 404);
      const token = await graphToken();
      await graphSend(token, prev.email,
        `Nueva contratación para homologar — ${contrat.nombre_candidato}`,
        correoContratacionIniciada(prev.nombre ?? '', contrat, d, centro, appUrl));
      return json({ ok: true, enviados: 1 });
    }

    // ---- RRHH cerró su parte -> avisa SOLO al solicitante original ----
    // Van antes del resto porque aceptan contratacion_id (ingreso) además de
    // solicitud_id, y resuelven su propia `sol` con resolverSolicitudYNombre.
    if (type === 'rrhh_cerrado' || type === 'homologacion_autorizada') {
      if (!solicitud_id && !contratacion_id) {
        return json({ error: 'Falta solicitud_id o contratacion_id.' }, 400);
      }
      const { sol, nombre } = await resolverSolicitudYNombre(admin, { solicitud_id, contratacion_id });
      if (!sol) return json({ error: 'Solicitud no encontrada.' }, 404);

      const { data: s } = await admin
        .from('perfiles').select('nombre, email, activo').eq('id', sol.solicitante_id).single();
      if (!s?.email || s.activo === false) {
        return json({ ok: true, skipped: true, reason: 'solicitante sin correo o inactivo' });
      }

      const d = await datosSolicitud(admin, sol.id);
      if (!d) return json({ error: 'Solicitud no encontrada.' }, 404);
      const token = await graphToken();
      if (type === 'rrhh_cerrado') {
        await graphSend(token, s.email,
          `RRHH ya procesó tu solicitud ${sol.codigo}`,
          correoRrhhCerrado(s.nombre ?? '', d, nombre, appUrl));
      } else {
        await graphSend(token, s.email,
          `${nombre || 'El trabajador'} ya puede ingresar a la obra — solicitud ${sol.codigo}`,
          correoHomologacionAutorizada(s.nombre ?? '', d, nombre, appUrl));
      }
      return json({ ok: true, enviados: 1 });
    }

    // ---- Prevención rechazó la homologación -> avisa al solicitante y al
    // Gerente de Prevención siempre; a RRHH solo si además se marcó algún
    // documento del checklist como el problema (migración 0016).
    if (type === 'homologacion_rechazada') {
      if (!solicitud_id && !contratacion_id) {
        return json({ error: 'Falta solicitud_id o contratacion_id.' }, 400);
      }
      const { sol, nombre } = await resolverSolicitudYNombre(admin, { solicitud_id, contratacion_id });
      if (!sol) return json({ error: 'Solicitud no encontrada.' }, 404);

      // El rechazo recién insertado por el frontend es el más reciente de
      // este caso -- se vuelve a consultar acá (no se confía en el payload).
      let ultimoQ = admin.from('homologacion_rechazos').select('id, motivo, rechazado_por, created_at')
        .order('created_at', { ascending: false }).limit(1);
      ultimoQ = contratacion_id ? ultimoQ.eq('contratacion_id', contratacion_id) : ultimoQ.eq('solicitud_id', solicitud_id);
      const { data: ultimoArr } = await ultimoQ;
      const ultimo = ultimoArr?.[0];
      if (!ultimo) return json({ error: 'No se encontró el rechazo.' }, 404);

      let countQ = admin.from('homologacion_rechazos').select('id', { count: 'exact', head: true });
      countQ = contratacion_id ? countQ.eq('contratacion_id', contratacion_id) : countQ.eq('solicitud_id', solicitud_id);
      const { count: totalRechazos } = await countQ;

      const { data: docsMarcados } = await admin
        .from('homologacion_rechazo_documentos').select('checklist_item_id').eq('rechazo_id', ultimo.id);
      let nombresDocs: string[] = [];
      if (docsMarcados?.length) {
        const { data: items } = await admin
          .from('documentos_checklist').select('id, nombre').in('id', docsMarcados.map((d) => d.checklist_item_id));
        nombresDocs = (items ?? []).map((i) => i.nombre);
      }

      const { data: rechazadoPor } = await admin.from('perfiles').select('nombre').eq('id', ultimo.rechazado_por).single();
      const { data: solicitante } = await admin
        .from('perfiles').select('nombre, email, activo').eq('id', sol.solicitante_id).single();

      const d = await datosSolicitud(admin, sol.id);
      if (!d) return json({ error: 'Solicitud no encontrada.' }, 404);
      const token = await graphToken();
      let enviados = 0;

      // Solicitante original -- siempre.
      if (solicitante?.email && solicitante.activo !== false) {
        await graphSend(token, solicitante.email,
          `Se rechazó la homologación de tu solicitud ${sol.codigo}`,
          correoHomologacionRechazada(solicitante.nombre ?? '', d, nombre, ultimo, totalRechazos ?? 1, appUrl));
        enviados++;
      }

      // Gerente de Prevención -- siempre, puede haber más de un perfil marcado.
      const { data: gerentesPrevencion } = await admin
        .from('perfiles').select('nombre, email').eq('es_gerente_prevencion', true).eq('activo', true);
      for (const g of gerentesPrevencion ?? []) {
        if (!g.email) continue;
        await graphSend(token, g.email,
          `Rechazo de homologación — solicitud ${sol.codigo}`,
          correoHomologacionRechazadaGerente(g.nombre ?? '', d, nombre, ultimo, rechazadoPor?.nombre ?? '', nombresDocs, totalRechazos ?? 1, appUrl));
        enviados++;
      }

      // RRHH -- solo si el rechazo marcó documento(s) (así corrige/reemplaza).
      if (nombresDocs.length) {
        const { data: rrhh } = await admin.from('perfiles').select('nombre, email').eq('rol', 'rrhh').eq('activo', true);
        for (const r of rrhh ?? []) {
          if (!r.email) continue;
          await graphSend(token, r.email,
            `Revisar documento(s) — homologación rechazada, solicitud ${sol.codigo}`,
            correoHomologacionRechazadaRRHH(r.nombre ?? '', d, nombre, ultimo, nombresDocs, appUrl));
          enviados++;
        }
      }

      return json({ ok: true, enviados });
    }

    // ---- Reclutamiento y selección (ver migración 0018) ----
    // Van antes del resto porque usan reclutamiento_id, no solicitud_id.
    if (type === 'reclutamiento_opciones') {
      if (!reclutamiento_id) return json({ error: 'Falta reclutamiento_id.' }, 400);
      const { data: recl } = await admin
        .from('reclutamientos').select('id, solicitud_id').eq('id', reclutamiento_id).single();
      if (!recl) return json({ error: 'Proceso de reclutamiento no encontrado.' }, 404);
      const { data: sol } = await admin
        .from('solicitudes').select('id, codigo, folio, solicitante_id, tipo, detalle, centro_origen_id').eq('id', recl.solicitud_id).single();
      if (!sol) return json({ error: 'La solicitud de este proceso ya no existe.' }, 404);
      const desc = await descripcionIngreso(admin, sol);
      const { count: pendientes } = await admin
        .from('reclutamiento_candidatos').select('id', { count: 'exact', head: true })
        .eq('reclutamiento_id', reclutamiento_id).eq('decision', 'pendiente');
      const { data: s } = await admin
        .from('perfiles').select('nombre, email, activo').eq('id', sol.solicitante_id).single();
      if (!s?.email || s.activo === false) {
        return json({ ok: true, skipped: true, reason: 'solicitante sin correo o inactivo' });
      }
      const d = await datosSolicitud(admin, sol.id);
      if (!d) return json({ error: 'La solicitud de este proceso ya no existe.' }, 404);
      const token = await graphToken();
      await graphSend(token, s.email,
        `Candidatos para tu solicitud de ingreso: ${desc}`,
        correoReclutamientoOpciones(s.nombre ?? '', d, pendientes ?? 0, appUrl, desc));
      return json({ ok: true, enviados: 1 });
    }

    if (type === 'reclutamiento_elegido' || type === 'reclutamiento_todos_rechazados') {
      if (!reclutamiento_id) return json({ error: 'Falta reclutamiento_id.' }, 400);
      const { data: recl } = await admin
        .from('reclutamientos').select('id, solicitud_id, contratacion_id').eq('id', reclutamiento_id).single();
      if (!recl) return json({ error: 'Proceso de reclutamiento no encontrado.' }, 404);
      const { data: sol } = await admin
        .from('solicitudes').select('id, codigo, folio, tipo, detalle, centro_origen_id').eq('id', recl.solicitud_id).single();
      if (!sol) return json({ error: 'La solicitud de este proceso ya no existe.' }, 404);
      const desc = await descripcionIngreso(admin, sol);

      const d = await datosSolicitud(admin, sol.id);
      if (!d) return json({ error: 'La solicitud de este proceso ya no existe.' }, 404);
      const { data: rrhh } = await admin.from('perfiles').select('nombre, email').eq('rol', 'rrhh').eq('activo', true);
      const token = await graphToken();
      let enviados = 0;

      if (type === 'reclutamiento_elegido') {
        let candidatoNombre = '';
        if (recl.contratacion_id) {
          const { data: c } = await admin
            .from('contrataciones').select('nombre_candidato').eq('id', recl.contratacion_id).single();
          candidatoNombre = c?.nombre_candidato ?? '';
        }
        for (const r of rrhh ?? []) {
          if (!r.email) continue;
          await graphSend(token, r.email,
            `Candidato elegido — ${desc}`,
            correoReclutamientoElegido(r.nombre ?? '', d, candidatoNombre, appUrl, desc));
          enviados++;
        }
      } else {
        for (const r of rrhh ?? []) {
          if (!r.email) continue;
          await graphSend(token, r.email,
            `Se rechazaron todos los candidatos — ${desc}`,
            correoReclutamientoTodosRechazados(r.nombre ?? '', d, appUrl, desc));
          enviados++;
        }
      }
      return json({ ok: true, enviados });
    }

    // ---- Recordatorio a aprobador(es) con solicitudes en su turno ----
    if (type === 'recordatorio_aprobador') {
      return await recordatorioAprobador(admin, user.id, { aprobador_id, solicitud_id }, appUrl);
    }

    if (!solicitud_id) return json({ error: 'Falta solicitud_id.' }, 400);

    const { data: sol, error: solErr } = await admin
      .from('solicitudes')
      .select('id, codigo, folio, tipo, estado, solicitante_id, trabajador_id, centro_origen_id, centro_destino_id, motivo, detalle, created_at')
      .eq('id', solicitud_id).single();
    if (solErr || !sol) return json({ error: 'Solicitud no encontrada.' }, 404);

    // Solicitud de alguien con "Sus solicitudes no requieren aprobación"
    // (perfiles.aprobacion_automatica, migración 0028): al crearla ya queda
    // aprobada, con una sola etapa automática a su nombre. En vez de avisar a
    // aprobadores, se manda el aviso de "aprobada" (con el PDF) a RRHH y a quien solicitó.
    let evento = type;
    if (type === 'pendiente_aprobador' && sol.estado === 'aprobada') {
      const { data: etapas } = await admin.from('aprobaciones').select('comentario').eq('solicitud_id', sol.id);
      if ((etapas ?? []).length && (etapas ?? []).every(esAprobacionAutomatica)) evento = 'cambio_estado';
    }

    // ---- aviso a aprobadores pendientes (al crear) ----
    if (evento === 'pendiente_aprobador') {
      // Solo si la solicitud sigue pendiente
      if (sol.estado !== 'pendiente') {
        return json({ ok: true, skipped: true, reason: `estado ${sol.estado}` });
      }
      const { data: aprs } = await admin
        .from('aprobaciones').select('aprobador_id, orden, decision').eq('solicitud_id', solicitud_id);
      const pendientes = (aprs ?? []).filter((a) => a.decision === 'pendiente');
      if (!pendientes.length) return json({ ok: true, skipped: true, reason: 'sin aprobadores pendientes' });
      // Turno actual = menor orden entre los pendientes (aprobación secuencial)
      const minOrden = Math.min(...pendientes.map((a) => a.orden));
      const ids = [...new Set(pendientes.filter((a) => a.orden === minOrden).map((a) => a.aprobador_id))];
      const { data: perfiles } = await admin.from('perfiles').select('email, nombre, activo').in('id', ids);
      const d = await datosSolicitud(admin, sol.id);
      if (!d) return json({ error: 'Solicitud no encontrada.' }, 404);
      const token = await graphToken();
      let enviados = 0;
      for (const p of perfiles ?? []) {
        if (!p.email || p.activo === false) continue;
        await graphSend(token, p.email,
          `Solicitud ${sol.codigo} pendiente de tu aprobación`,
          correoPendiente(p.nombre ?? '', d, appUrl));
        enviados++;
      }
      return json({ ok: true, enviados });
    }

    // ---- cambio de estado ----
    if (evento === 'cambio_estado') {
      if (sol.estado !== 'aprobada' && sol.estado !== 'rechazada') {
        return json({ ok: true, skipped: true, reason: `estado ${sol.estado} no notificable` });
      }

      // datos comunes (los mismos del comprobante en PDF)
      const d = await datosSolicitud(admin, sol.id);
      if (!d) return json({ error: 'Solicitud no encontrada.' }, 404);
      const { cmap, aprs, pmap, trabNombre } = d;

      const token = await graphToken();

      // RECHAZADA -> solo solicitante
      if (sol.estado === 'rechazada') {
        const s = pmap.get(sol.solicitante_id);
        if (s?.email) {
          await graphSend(token, s.email, `Tu solicitud ${sol.codigo} fue rechazada`,
            correoRechazada(s.nombre ?? '', d, appUrl));
        }
        return json({ ok: true, enviados: s?.email ? 1 : 0 });
      }

      // APROBADA -> comprobante en PDF (con el encabezado Metalium y Código/Folio)
      // a solicitante + aprobadores + RRHH, cada uno con su mensaje
      const pdfBytes = await construirComprobantePdf({ sol: d.sol, cmap, aprs, pmap, trabNombre });
      const pdfB64 = encodeBase64(pdfBytes);
      const { data: rrhh } = await admin
        .from('perfiles').select('id, nombre, email').eq('rol', 'rrhh').eq('activo', true);

      type Rol = 'rrhh' | 'solicitante' | 'aprobador';
      const dest = new Map<string, { nombre: string; rol: Rol }>(); // email -> destinatario (sin repetir)
      const add = (p: any, rol: Rol) => {
        if (!p?.email) return;
        const ya = dest.get(p.email);
        if (!ya || rol === 'rrhh') dest.set(p.email, { nombre: p.nombre ?? '', rol });
      };
      add(pmap.get(sol.solicitante_id), 'solicitante');
      aprs.forEach((a) => add(pmap.get(a.aprobador_id), 'aprobador'));
      (rrhh ?? []).forEach((r) => add(r, 'rrhh'));

      // Mismo nombre que la descarga desde la app: "<código del documento> - <folio>.pdf"
      const nombrePdf = `${DOCUMENTO_CODIGOS[sol.tipo]?.codigo || 'RRH'} - ${sol.folio || sol.codigo}.pdf`;
      const adjuntos = [{ name: nombrePdf, b64: pdfB64 }];
      let enviados = 0;
      for (const [email, p] of dest) {
        await graphSend(token, email, `Solicitud ${sol.codigo} aprobada — respaldo`,
          correoAprobada(p.nombre, d, appUrl, p.rol, nombrePdf), adjuntos);
        enviados++;
      }
      return json({ ok: true, enviados });
    }

    return json({ error: `type desconocido: ${type}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Error interno.' }, 500);
  }
});

// ---------- Microsoft Graph ----------
async function graphToken(): Promise<string> {
  const tenant = Deno.env.get('GRAPH_TENANT_ID')!;
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GRAPH_CLIENT_ID')!,
      client_secret: Deno.env.get('GRAPH_CLIENT_SECRET')!,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('Graph auth: ' + (j.error_description ?? 'sin token'));
  return j.access_token;
}

type Adjunto = { name: string; b64: string };
// Logo Metalium, incrustado como adjunto "inline" (Content-ID) en TODOS los
// correos -- así el encabezado de cada plantilla (ver correoSgc()) lo puede
// mostrar con <img src="cid:metalium-logo">. Los clientes de correo no
// muestran imágenes en base64 pegadas directo en el HTML (Outlook las
// bloquea), así que tiene que ir como adjunto inline, no como data: URI.
const LOGO_CID = 'metalium-logo';
async function graphSend(token: string, to: string, subject: string, correo: Correo, adjuntos: Adjunto[] = []) {
  const sender = Deno.env.get('GRAPH_FROM_ADDRESS')!;
  const html = correo.html;
  // Íconos del diseño SGC: solo los que usa este correo, también como inline (cid:ico-<clave>)
  const iconos = correo.iconos.filter((k) => ICONOS_CORREO_PNG_B64[k]).map((k) => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: `ico-${k}.png`,
    contentType: 'image/png',
    contentBytes: ICONOS_CORREO_PNG_B64[k],
    contentId: `ico-${k}`,
    isInline: true,
  }));
  const attachments: any[] = [
    {
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: 'metalium-logo.png',
      contentType: 'image/png',
      contentBytes: LOGO_METALIUM_PNG_B64,
      contentId: LOGO_CID,
      isInline: true,
    },
    ...iconos,
    ...adjuntos.map((a) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: 'application/pdf',
      contentBytes: a.b64,
    })),
  ];
  const message: any = {
    subject,
    body: { contentType: 'HTML', content: html },
    toRecipients: [{ emailAddress: { address: to } }],
    attachments,
  };
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems: false }),
  });
  if (!res.ok) throw new Error('Graph sendMail: ' + (await res.text()));
}

const SOL_FIELDS =
  'id, codigo, folio, tipo, estado, solicitante_id, trabajador_id, centro_origen_id, centro_destino_id, motivo, detalle, created_at';

/**
 * Resuelve la solicitud y el "nombre específico" a mostrar en el correo, a
 * partir de contratacion_id O solicitud_id -- usado por 'rrhh_cerrado' y
 * 'homologacion_autorizada'. En ingreso el cierre es por CONTRATACIÓN
 * (puede haber varias personas en una misma solicitud, cada una con su
 * propio candidato) así que el nombre sale de `contrataciones.nombre_candidato`;
 * en el resto de los tipos (siempre con trabajador_id) sale de `trabajadores.nombre`.
 */
async function resolverSolicitudYNombre(
  admin: ReturnType<typeof createClient>,
  { solicitud_id, contratacion_id }: { solicitud_id?: string; contratacion_id?: string },
) {
  if (contratacion_id) {
    const { data: contrat } = await admin
      .from('contrataciones').select('id, solicitud_id, nombre_candidato')
      .eq('id', contratacion_id).single();
    if (!contrat) return { sol: null as any, nombre: null as string | null };
    const { data: sol } = await admin.from('solicitudes').select(SOL_FIELDS).eq('id', contrat.solicitud_id).single();
    return { sol: sol ?? null, nombre: contrat.nombre_candidato ?? null };
  }
  if (solicitud_id) {
    const { data: sol } = await admin.from('solicitudes').select(SOL_FIELDS).eq('id', solicitud_id).single();
    let nombre: string | null = null;
    if (sol?.trabajador_id) {
      const { data: t } = await admin.from('trabajadores').select('nombre').eq('id', sol.trabajador_id).single();
      nombre = t?.nombre ?? null;
    }
    return { sol: sol ?? null, nombre };
  }
  return { sol: null as any, nombre: null as string | null };
}

// ---------- Plantillas de correo (nov. 2026: diseño SGC de los exportables) ----------
// Todas se arman con correoSgc() (_shared/correo-sgc.js): encabezado con logo,
// banda azul y Código/Fecha/Revisión; mensaje con resumen y botón; secciones
// numeradas con fichas o tabla; pie METALIUM | código | nombre. Las de una
// solicitud reutilizan las secciones "Detalle del registro" y "Aprobaciones"
// del comprobante (documentoComprobante, lo mismo que el PDF y la vista
// previa); la "Identificación del registro" no va (repite el encabezado): el
// N° de solicitud, el folio y el estado van en el resumen del mensaje.
// El logo y los íconos van como adjuntos inline (ver graphSend).
type Correo = { html: string; iconos: string[] };
type Seccion = { titulo: string; fichas?: any[]; tabla?: any };
type DatosSol = { sol: any; cmap: Map<string, any>; aprs: any[]; pmap: Map<string, any>; trabNombre: string | null };

const REF_DOC = { tipoLabels: TIPO_LABELS, documentoCodigos: DOCUMENTO_CODIGOS, detalleLineas };
const VERDE = '#1a7f37', ROJO = '#b91c1c', AMBAR = '#92400e';
const ROJO_BG = '#fbe9e9', ROJO_FG = ROJO;

// Escapa texto libre (nombres, motivos) antes de meterlo en el HTML del mensaje.
const escHtml = escCorreo;
const Tipo = (t: string) => tipoTxt(t).replace(/^./, (c) => c.toUpperCase());

/**
 * Todo lo que necesita el comprobante de una solicitud (mismos datos que el
 * PDF): la solicitud, sus centros, aprobaciones, perfiles y el trabajador.
 */
async function datosSolicitud(admin: any, solicitudId: string): Promise<DatosSol | null> {
  const { data: sol } = await admin.from('solicitudes').select(SOL_FIELDS).eq('id', solicitudId).single();
  if (!sol) return null;
  const centroIds = [sol.centro_origen_id, sol.centro_destino_id].filter(Boolean);
  const { data: centros } = centroIds.length
    ? await admin.from('centros_costo').select('id, codigo, nombre').in('id', centroIds) : { data: [] as any[] };
  const { data: aprs } = await admin
    .from('aprobaciones').select('aprobador_id, decision, decidido_at, asignado_at, orden, tiempo_respuesta, comentario')
    .eq('solicitud_id', sol.id).order('orden');
  const ids = [...new Set([sol.solicitante_id, ...(aprs ?? []).map((a: any) => a.aprobador_id)].filter(Boolean))];
  const { data: pers } = await admin.from('perfiles').select('id, nombre, email').in('id', ids);
  let trabNombre: string | null = null;
  if (sol.trabajador_id) {
    const { data: t } = await admin.from('trabajadores').select('nombre').eq('id', sol.trabajador_id).single();
    trabNombre = t?.nombre ?? null;
  }
  return {
    sol,
    cmap: new Map((centros ?? []).map((c: any) => [c.id, c])),
    aprs: aprs ?? [],
    pmap: new Map((pers ?? []).map((p: any) => [p.id, p])),
    trabNombre,
  };
}

/** Botón del correo: lleva al sistema y, con vista, abre esa vista (?ir=). Sin URL base no hay botón. */
function enlace(appUrl: string, texto: string, vista = '') {
  if (!appUrl) return null;
  return { url: vista ? `${appUrl}/?ir=${encodeURIComponent(vista)}` : `${appUrl}/`, texto };
}

/** Estado del resumen: el de la solicitud, o uno propio del correo ([texto, color]). */
function estadoResumen(sol: any, propio?: [string, string]): [string, string, string] {
  if (propio) return ['Estado', propio[0], propio[1]];
  const e = String(sol.estado ?? '');
  const txt = e ? e.charAt(0).toUpperCase() + e.slice(1) : '—';
  const color = e === 'aprobada' ? VERDE : e === 'rechazada' ? ROJO : e === 'pendiente' ? AMBAR : '';
  return ['Estado', txt, color];
}

/**
 * Correo de una solicitud con el diseño SGC.
 *  titulo:     del encabezado (por defecto "Solicitud de <tipo>")
 *  incluir:    qué secciones del comprobante van ('detalle', 'aprobaciones')
 *  antes:      secciones propias del correo, antes de las del comprobante
 */
function correoSolicitud(d: DatosSol, o: {
  titulo?: string; saludo: string; mensaje: string; boton: { url: string; texto: string } | null;
  incluir: ('detalle' | 'aprobaciones')[]; antes?: Seccion[]; estado?: [string, string]; resumenExtra?: [string, string, string?][];
}): Correo {
  const doc = documentoComprobante(d, REF_DOC);
  const [, detalle, aprobaciones] = doc.secciones;
  const titulo = o.titulo ?? `Solicitud de ${Tipo(d.sol.tipo)}`;
  return correoSgc({
    encabezado: { ...doc.encabezado, titulo },
    pie: { codigo: doc.pie.codigo, nombre: titulo },
    saludo: o.saludo,
    mensaje: o.mensaje,
    resumen: [['N° de solicitud', d.sol.codigo], ['Folio', d.sol.folio], estadoResumen(d.sol, o.estado), ...(o.resumenExtra ?? [])],
    boton: o.boton,
    secciones: [
      ...(o.antes ?? []),
      ...(o.incluir.includes('detalle') ? [detalle] : []),
      ...(o.incluir.includes('aprobaciones') ? [aprobaciones] : []),
    ],
  });
}

const saludo = (nombre: string) => (nombre ? `Hola ${nombre}:` : 'Hola:');
const p0 = (html: string) => `<p style="margin:0">${html}</p>`;
const p1 = (html: string) => `<p style="margin:10px 0 0">${html}</p>`;

/** Al aprobador en turno: tiene una solicitud por decidir. */
function correoPendiente(nombre: string, d: DatosSol, appUrl: string): Correo {
  const quien = d.pmap.get(d.sol.solicitante_id)?.nombre;
  return correoSolicitud(d, {
    saludo: saludo(nombre),
    mensaje: p0(`Tienes una solicitud de <b>${escHtml(Tipo(d.sol.tipo))}</b> pendiente de tu aprobación${quien ? `, creada por <b>${escHtml(quien)}</b>` : ''}.`)
      + p1('Revisa el detalle y decide desde tu bandeja.'),
    boton: enlace(appUrl, 'Ir a mi bandeja', 'bandeja'),
    incluir: ['detalle', 'aprobaciones'],
  });
}

/** Al solicitante: su solicitud fue rechazada (quién y su comentario, si dejó uno). */
function correoRechazada(nombre: string, d: DatosSol, appUrl: string): Correo {
  const rech = d.aprs.find((a) => a.decision === 'rechazado');
  const quien = rech ? d.pmap.get(rech.aprobador_id)?.nombre : null;
  const comentario = String(rech?.comentario ?? '').trim();
  return correoSolicitud(d, {
    saludo: saludo(nombre),
    mensaje: p0(`Tu solicitud de <b>${escHtml(Tipo(d.sol.tipo))}</b> fue <b style="color:${ROJO}">rechazada</b>${quien ? ` por <b>${escHtml(quien)}</b>` : ''}.`)
      + (comentario ? p1(`<b>Comentario:</b> ${escHtml(comentario)}`) : ''),
    boton: enlace(appUrl, 'Ver mis solicitudes', 'mis-solicitudes'),
    incluir: ['detalle', 'aprobaciones'],
  });
}

/** Aprobada por todos: a solicitante, aprobadores y RRHH, con el comprobante en PDF adjunto. */
function correoAprobada(nombre: string, d: DatosSol, appUrl: string, rol: 'rrhh' | 'solicitante' | 'aprobador', adjunto: string): Correo {
  const tipo = escHtml(Tipo(d.sol.tipo));
  const aprobada = `<b style="color:${VERDE}">aprobada por todos los aprobadores</b>`;
  // Sin aprobadores: quien la pidió tiene "Sus solicitudes no requieren aprobación" (0028)
  const automatica = d.aprs.length > 0 && d.aprs.every(esAprobacionAutomatica);
  const quien = escHtml(d.pmap.get(d.sol.solicitante_id)?.nombre ?? '');
  const texto = automatica
    ? (rol === 'rrhh'
      ? p0(`La solicitud de <b>${tipo}</b>${quien ? ` de <b>${quien}</b>` : ''} quedó <b style="color:${VERDE}">aprobada</b> al crearla: no requiere aprobación. Ya puedes continuar con el proceso (plazo: ${DIAS_HABILES_PROCESO_RRHH} días hábiles).`)
      : p0(`Tu solicitud de <b>${tipo}</b> quedó <b style="color:${VERDE}">aprobada</b>: no requiere aprobación. RRHH continuará con el proceso.`))
    : rol === 'rrhh'
    ? p0(`La solicitud de <b>${tipo}</b> fue ${aprobada}. Ya puedes continuar con el proceso (plazo: ${DIAS_HABILES_PROCESO_RRHH} días hábiles).`)
    : rol === 'solicitante'
      ? p0(`Tu solicitud de <b>${tipo}</b> fue ${aprobada}. RRHH continuará con el proceso.`)
      : p0(`La solicitud de <b>${tipo}</b> que aprobaste quedó ${aprobada}.`);
  const doc = documentoComprobante(d, REF_DOC);
  return correoSolicitud(d, {
    titulo: doc.encabezado.titulo, // "Comprobante de solicitud de ...", igual que el PDF adjunto
    saludo: saludo(nombre),
    mensaje: texto + p1(`Se adjunta el comprobante en PDF (<b>${escHtml(adjunto)}</b>).`),
    boton: rol === 'rrhh' ? enlace(appUrl, 'Ir a Solicitudes', 'solicitudes')
      : rol === 'solicitante' ? enlace(appUrl, 'Ver mis solicitudes', 'mis-solicitudes')
        : enlace(appUrl, 'Ir a SSI-RRHH'),
    incluir: ['detalle', 'aprobaciones'],
  });
}

/** Al solicitante: RRHH terminó su parte. */
function correoRrhhCerrado(nombre: string, d: DatosSol, nombreEspecifico: string | null, appUrl: string): Correo {
  return correoSolicitud(d, {
    saludo: saludo(nombre),
    mensaje: p0(`RRHH ya terminó de procesar tu solicitud de <b>${escHtml(Tipo(d.sol.tipo))}</b>${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ''}.`),
    boton: enlace(appUrl, 'Ver mis solicitudes', 'mis-solicitudes'),
    incluir: ['detalle'],
    estado: ['Procesada por RRHH', VERDE],
  });
}

/** Al solicitante: Prevención autorizó el ingreso a la obra. */
function correoHomologacionAutorizada(nombre: string, d: DatosSol, nombreEspecifico: string | null, appUrl: string): Correo {
  return correoSolicitud(d, {
    titulo: 'Homologación SST',
    saludo: saludo(nombre),
    mensaje: p0(`El proceso de homologación de tu solicitud terminó: ${nombreEspecifico ? `<b>${escHtml(nombreEspecifico)}</b>` : 'el trabajador'} ya está <b style="color:${VERDE}">autorizado para ingresar a la obra</b>.`),
    boton: enlace(appUrl, 'Ver mis solicitudes', 'mis-solicitudes'),
    antes: [{ titulo: 'Homologación SST', fichas: [
      { etiqueta: d.sol.tipo === 'ingreso' ? 'Candidato' : 'Trabajador', valor: nombreEspecifico || d.trabNombre || '—', icono: 'hard-hat' },
      { etiqueta: 'Resultado', valor: 'Autorizado para ingresar a la obra', icono: 'shield-check' },
    ] }],
    incluir: ['detalle'],
    estado: ['Homologación autorizada', VERDE],
  });
}

function seccionRechazoHomologacion(d: DatosSol, nombreEspecifico: string | null, rechazo: any, extra: any[]): Seccion {
  return { titulo: 'Rechazo de homologación', fichas: [
    { etiqueta: d.sol.tipo === 'ingreso' ? 'Candidato' : 'Trabajador', valor: nombreEspecifico || d.trabNombre || '—', icono: 'hard-hat' },
    ...extra,
    { etiqueta: 'Motivo', valor: String(rechazo?.motivo ?? '—'), icono: 'message-square', ancho: 'completo' },
  ] };
}

/** Al solicitante original: aviso del rechazo + cuántos van (sin detalle de documentos). */
function correoHomologacionRechazada(nombre: string, d: DatosSol, nombreEspecifico: string | null, rechazo: any, totalRechazos: number, appUrl: string): Correo {
  return correoSolicitud(d, {
    titulo: 'Homologación SST',
    saludo: saludo(nombre),
    mensaje: p0(`Prevención <b style="color:${ROJO}">rechazó la homologación</b> de tu solicitud${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ''}.`)
      + p1('El plazo de homologación de este caso se extiende automáticamente por cada rechazo.'),
    boton: enlace(appUrl, 'Ver mis solicitudes', 'mis-solicitudes'),
    estado: ['Homologación rechazada', ROJO],
    antes: [seccionRechazoHomologacion(d, nombreEspecifico, rechazo, [
      { etiqueta: 'N° de rechazos de este caso', valor: String(totalRechazos), icono: 'hash' },
    ])],
    incluir: ['detalle'],
  });
}

/** Al Gerente de Prevención: copia completa (quién rechazó, motivo, documentos marcados). */
function correoHomologacionRechazadaGerente(
  nombre: string, d: DatosSol, nombreEspecifico: string | null, rechazo: any,
  rechazadoPorNombre: string, nombresDocs: string[], totalRechazos: number, appUrl: string,
): Correo {
  return correoSolicitud(d, {
    titulo: 'Homologación SST',
    saludo: saludo(nombre),
    mensaje: p0(`${rechazadoPorNombre ? `<b>${escHtml(rechazadoPorNombre)}</b>` : 'Un prevencionista'} <b style="color:${ROJO}">rechazó una homologación</b>${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ''}.`),
    boton: enlace(appUrl, 'Ir a Homologación SST', 'homologacion'),
    estado: ['Homologación rechazada', ROJO],
    antes: [seccionRechazoHomologacion(d, nombreEspecifico, rechazo, [
      { etiqueta: 'Rechazado por', valor: rechazadoPorNombre || '—', icono: 'user' },
      { etiqueta: 'N° de rechazos de este caso', valor: String(totalRechazos), icono: 'hash' },
      { etiqueta: 'Documento(s) marcado(s)', valor: nombresDocs.length ? nombresDocs.join(', ') : 'Ninguno', icono: 'list-checks', ancho: 'completo' },
    ])],
    incluir: ['detalle'],
  });
}

/** A RRHH: solo cuando el rechazo marcó documento(s) -- pide corregir/reemplazar. */
function correoHomologacionRechazadaRRHH(nombre: string, d: DatosSol, nombreEspecifico: string | null, rechazo: any, nombresDocs: string[], appUrl: string): Correo {
  return correoSolicitud(d, {
    titulo: 'Homologación SST',
    saludo: saludo(nombre),
    mensaje: p0(`Prevención <b style="color:${ROJO}">rechazó la homologación</b>${nombreEspecifico ? ` de <b>${escHtml(nombreEspecifico)}</b>` : ''} por un problema con ${nombresDocs.length === 1 ? 'este documento' : 'estos documentos'}: <b>${nombresDocs.map((n) => escHtml(n)).join(', ')}</b>.`)
      + p1('Corrige o reemplaza el/los documento(s): Prevención vuelve a revisar el caso desde ahí.'),
    boton: nombreEspecifico ? enlace(appUrl, 'Ir a Contratación', 'contrataciones') : enlace(appUrl, 'Ir a Solicitudes', 'solicitudes'),
    estado: ['Homologación rechazada', ROJO],
    antes: [seccionRechazoHomologacion(d, nombreEspecifico, rechazo, [
      { etiqueta: 'Documento(s) a corregir', valor: nombresDocs.join(', '), icono: 'list-checks', ancho: 'completo' },
    ])],
    incluir: ['detalle'],
  });
}

/** Al prevencionista del centro: RRHH inició una contratación para homologar. */
function correoContratacionIniciada(nombre: string, contrat: any, d: DatosSol, centro: any, appUrl: string): Correo {
  const CANAL_LABELS: Record<string, string> = { recomendacion: 'Recomendación', reclutamiento_seleccion: 'Reclutamiento y selección' };
  const TIPO_TRAB_LABELS: Record<string, string> = { administrativo: 'Administrativo', operativo: 'Operativo' };
  return correoSolicitud(d, {
    titulo: 'Contratación para homologar',
    saludo: saludo(nombre),
    mensaje: p0('RRHH inició una contratación en tu centro de costo. Puedes empezar la homologación SST a medida que se vaya subiendo la documentación.'),
    boton: enlace(appUrl, 'Ir a Homologación SST', 'homologacion'),
    antes: [{ titulo: 'Contratación', fichas: [
      { etiqueta: 'Candidato', valor: contrat.nombre_candidato, icono: 'hard-hat' },
      { etiqueta: 'Cargo', valor: d.sol.detalle?.cargo || '—', icono: 'briefcase' },
      { etiqueta: 'Canal', valor: CANAL_LABELS[contrat.canal] ?? contrat.canal ?? '—', icono: 'tag' },
      { etiqueta: 'Tipo de trabajador', valor: TIPO_TRAB_LABELS[contrat.tipo_trabajador] ?? contrat.tipo_trabajador ?? '—', icono: 'id-card' },
      { etiqueta: 'Centro de costo', valor: centro?.nombre ?? '—', icono: 'building-2', ancho: 'completo' },
    ] }],
    incluir: [],
  });
}

function seccionReclutamiento(desc: string, extra: any[]): Seccion {
  return { titulo: 'Reclutamiento y selección', fichas: [
    ...extra,
    { etiqueta: 'Vacante', valor: desc || '—', icono: 'clipboard-list', ancho: 'completo' },
  ] };
}

/** Al solicitante: RRHH mandó una tanda de candidatos para que elija o rechace. */
function correoReclutamientoOpciones(nombre: string, d: DatosSol, cantidad: number, appUrl: string, desc = ''): Correo {
  return correoSolicitud(d, {
    titulo: 'Reclutamiento y selección',
    saludo: saludo(nombre),
    mensaje: p0(`RRHH envió <b>${cantidad} candidato${cantidad === 1 ? '' : 's'}</b> para tu solicitud de ingreso${desc ? ` <b>${escHtml(desc)}</b>` : ''}. Revísalos y elige uno, o recházalos si ninguno calza.`),
    boton: enlace(appUrl, 'Ver candidatos', 'mis-solicitudes'),
    antes: [seccionReclutamiento(desc, [{ etiqueta: 'Candidatos por revisar', valor: String(cantidad), icono: 'users' }])],
    incluir: [],
  });
}

/** A RRHH: el solicitante eligió candidato -- ya se creó la contratación sola. */
function correoReclutamientoElegido(nombre: string, d: DatosSol, candidatoNombre: string, appUrl: string, desc = ''): Correo {
  return correoSolicitud(d, {
    titulo: 'Reclutamiento y selección',
    saludo: saludo(nombre),
    mensaje: p0(`El solicitante eligió a ${candidatoNombre ? `<b>${escHtml(candidatoNombre)}</b>` : 'un candidato'} para la solicitud ${desc ? `<b>${escHtml(desc)}</b>` : escHtml(d.sol.codigo)}. Ya se creó la contratación: continúa el proceso desde ahí.`),
    boton: enlace(appUrl, 'Ir a Contratación', 'contrataciones'),
    antes: [seccionReclutamiento(desc, [{ etiqueta: 'Candidato elegido', valor: candidatoNombre || '—', icono: 'user-check' }])],
    incluir: [],
  });
}

/** A RRHH: el solicitante rechazó a todos los candidatos de la tanda vigente. */
function correoReclutamientoTodosRechazados(nombre: string, d: DatosSol, appUrl: string, desc = ''): Correo {
  return correoSolicitud(d, {
    titulo: 'Reclutamiento y selección',
    saludo: saludo(nombre),
    mensaje: p0(`El solicitante <b style="color:${ROJO}">rechazó a todos los candidatos</b> enviados para la solicitud ${desc ? `<b>${escHtml(desc)}</b>` : escHtml(d.sol.codigo)}.`)
      + p1(`Agrega una nueva tanda de candidatos desde Contratación: el plazo de reclutamiento (${DIAS_HABILES_RECLUTAMIENTO} días hábiles) vuelve a correr desde este rechazo.`),
    boton: enlace(appUrl, 'Ir a Contratación', 'contrataciones'),
    antes: [seccionReclutamiento(desc, [{ etiqueta: 'Plazo de reclutamiento', valor: `${DIAS_HABILES_RECLUTAMIENTO} días hábiles desde este rechazo`, icono: 'clock' }])],
    incluir: [],
  });
}

/**
 * URL base del sistema para los botones de los correos. Primero el secret
 * APP_URL; si no está configurado, el origen del navegador que disparó el
 * evento, pero SOLO si es un dominio esperado (no se arma un enlace a
 * cualquier sitio que diga el encabezado Origin).
 */
const ORIGEN_PERMITIDO = /^(https:\/\/([a-z0-9-]+\.)*(vercel\.app|metalium\.cl)|http:\/\/localhost(:\d+)?)$/i;
function urlApp(req: Request): string {
  const env = (Deno.env.get('APP_URL') || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const origin = (req.headers.get('Origin') || '').trim().replace(/\/+$/, '');
  return ORIGEN_PERMITIDO.test(origin) ? origin : '';
}


/**
 * Descripción legible de una solicitud de ingreso (nov. 2026, a pedido: en
 * los correos de candidatos, en vez del código). Texto plano, ej.:
 * "Maestro Albañil · 2 vacantes · Obra 25 LIRAY · ingreso desde el 15-11-2026".
 * Igual que descripcionIngreso() de src/ui/solicitud-format.js.
 */
async function descripcionIngreso(admin: any, sol: any): Promise<string> {
  const d = sol?.detalle ?? {};
  const cant = Number(d.cantidad) || 1;
  let obra = '';
  if (sol?.centro_origen_id) {
    const { data: c } = await admin.from('centros_costo').select('codigo, nombre').eq('id', sol.centro_origen_id).maybeSingle();
    if (c) {
      const n = String(c.nombre ?? '');
      obra = `Obra ${c.codigo ?? ''}${n ? ' ' + (n.length > 60 ? n.slice(0, 59) + '…' : n) : ''}`.trim();
    }
  }
  const f = typeof d.fecha_ingreso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha_ingreso)
    ? d.fecha_ingreso.split('-').reverse().join('-') : '';
  return [d.cargo || 'Cargo sin indicar', `${cant} vacante${cant === 1 ? '' : 's'}`, obra, f ? `ingreso desde el ${f}` : '']
    .filter(Boolean).join(' · ');
}

// =====================================================================
// Recordatorio a aprobadores (oct. 2026) -- type 'recordatorio_aprobador'
// =====================================================================
type NivelEspera = 'al_dia' | 'atrasada' | 'critica';

/**
 * Fecha "de pared" en Chile como Date. dias-habiles.js trabaja con la hora
 * LOCAL del proceso (UTC en Supabase): sin esto, una solicitud creada a las
 * 22:00 en Chile se contaría en el día siguiente.
 */
function aChile(f: string | Date): Date {
  return new Date(new Date(f).toLocaleString('en-US', { timeZone: 'America/Santiago' }));
}

/** Mismo criterio que nivelEspera() en src/ui/aprobacion-turno.js. */
function nivelEspera(desde: string, ahora = new Date()) {
  const horas = Math.max(0, (ahora.getTime() - new Date(desde).getTime()) / 36e5);
  const dias = diasHabilesEntre(aChile(desde), aChile(ahora));
  const nivel: NivelEspera = dias >= ESPERA_DIAS_CRITICA ? 'critica' : dias >= ESPERA_DIAS_ATRASADA ? 'atrasada' : 'al_dia';
  const h = Math.floor(horas);
  const texto = dias >= 1
    ? `${dias} día${dias === 1 ? '' : 's'} hábil${dias === 1 ? '' : 'es'}`
    : horas < 1 ? 'menos de 1 hora' : `${h} hora${h === 1 ? '' : 's'}`;
  return { dias, horas, nivel, texto };
}

const fechaHoraCL = (f: string | Date) => new Date(f).toLocaleString('es-CL', {
  timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const diaCL = (f: string | Date) => new Date(f).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
const horaCL = (f: string | Date) => new Date(f).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** "hoy a las 16:51" o "el 29-10-2026 a las 09:10" (hora de Chile). */
const cuandoCL = (f: string | Date) => diaCL(f) === diaCL(new Date()) ? `hoy a las ${horaCL(f)}` : `el ${diaCL(f)} a las ${horaCL(f)}`;

const APR_FIELDS = 'solicitud_id, aprobador_id, orden, decision, asignado_at, decidido_at';

/**
 * Aprobaciones a las que les toca decidir ahora en una solicitud pendiente
 * (menor orden entre las pendientes) y desde cuándo esperan: la última
 * decisión anterior, o la creación de la solicitud si es el primer turno.
 */
function aprobacionesEnTurno(sol: any, aprs: any[]) {
  const pend = aprs.filter((a) => a.decision === 'pendiente');
  if (!pend.length) return [];
  const min = Math.min(...pend.map((a) => a.orden));
  return pend.filter((a) => a.orden === min).map((a) => {
    const fechas = [sol.created_at, a.asignado_at,
      ...aprs.filter((x) => x.orden < a.orden && x.decidido_at).map((x) => x.decidido_at)].filter(Boolean);
    const desde = fechas.reduce((m: string, f: string) => (new Date(f) > new Date(m) ? f : m), fechas[0]);
    return { ...a, desde };
  });
}

async function recordatorioAprobador(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
  { aprobador_id, solicitud_id }: { aprobador_id?: string; solicitud_id?: string },
  appUrl: string,
) {
  if (!aprobador_id && !solicitud_id) return json({ error: 'Falta aprobador_id o solicitud_id.' }, 400);

  const { data: yo } = await admin.from('perfiles').select('id, nombre, rol, activo').eq('id', userId).single();
  if (!yo || yo.activo === false) return json({ error: 'Tu cuenta no está activa.' }, 403);
  const esGestion = yo.rol === 'admin' || yo.rol === 'rrhh';

  // objetivos: a quién se escribe y con qué solicitudes
  let objetivos: { aprobadorId: string; items: { sol: any; desde: string }[] }[] = [];
  let origen: 'rrhh_admin' | 'solicitante' = 'rrhh_admin';
  let solicitudUnica: any = null;

  if (aprobador_id) {
    // RRHH / admin: todas las solicitudes en turno de ese aprobador.
    if (!esGestion) return json({ error: 'Solo RRHH o el administrador pueden enviar este recordatorio.' }, 403);
    const { data: suyas } = await admin
      .from('aprobaciones').select('solicitud_id').eq('aprobador_id', aprobador_id).eq('decision', 'pendiente');
    const ids = [...new Set((suyas ?? []).map((a: any) => a.solicitud_id))];
    const items: { sol: any; desde: string }[] = [];
    if (ids.length) {
      const { data: sols } = await admin.from('solicitudes').select(SOL_FIELDS).in('id', ids).eq('estado', 'pendiente');
      const { data: aprs } = await admin.from('aprobaciones').select(APR_FIELDS).in('solicitud_id', ids);
      for (const s of sols ?? []) {
        const turno = aprobacionesEnTurno(s, (aprs ?? []).filter((a: any) => a.solicitud_id === s.id));
        const mio = turno.find((a) => a.aprobador_id === aprobador_id);
        if (mio) items.push({ sol: s, desde: mio.desde });
      }
    }
    if (!items.length) return json({ error: 'Este aprobador no tiene solicitudes esperando su decisión en este momento.' }, 400);
    objetivos = [{ aprobadorId: aprobador_id, items }];
  } else {
    // Quien creó la solicitud (o RRHH / admin): solo esa solicitud, a quien(es) le toca.
    const { data: s } = await admin.from('solicitudes').select(SOL_FIELDS).eq('id', solicitud_id).single();
    if (!s) return json({ error: 'Solicitud no encontrada.' }, 404);
    if (s.solicitante_id !== userId && !esGestion) {
      return json({ error: 'Solo quien creó la solicitud (o RRHH / el administrador) puede enviar este recordatorio.' }, 403);
    }
    if (s.estado !== 'pendiente') return json({ error: 'Esta solicitud ya no está pendiente de aprobación.' }, 400);
    const { data: aprs } = await admin.from('aprobaciones').select(APR_FIELDS).eq('solicitud_id', s.id);
    const turno = aprobacionesEnTurno(s, aprs ?? []);
    if (!turno.length) return json({ error: 'Esta solicitud no tiene aprobadores pendientes.' }, 400);
    origen = s.solicitante_id === userId ? 'solicitante' : 'rrhh_admin';
    solicitudUnica = s;
    objetivos = turno.map((t) => ({ aprobadorId: t.aprobador_id, items: [{ sol: s, desde: t.desde }] }));
  }

  // Perfiles involucrados (aprobadores, solicitantes, quien envió antes)
  const solicitantes = objetivos.flatMap((o) => o.items.map((i) => i.sol.solicitante_id));
  const { data: pers } = await admin.from('perfiles').select('id, nombre, email, activo, rol')
    .in('id', [...new Set([...objetivos.map((o) => o.aprobadorId), ...solicitantes])]);
  const pmap = new Map<string, any>((pers ?? []).map((p: any) => [p.id, p]));

  // Enfriamiento: no repetir el mismo recordatorio antes de N horas.
  const desdeEnfr = new Date(Date.now() - RECORDATORIO_ENFRIAMIENTO_HORAS * 3600 * 1000).toISOString();
  for (const o of objetivos) {
    const { data: previos } = await admin.from('recordatorios_aprobacion')
      .select('created_at, enviado_por, solicitud_id, solicitudes_incluidas')
      .eq('aprobador_id', o.aprobadorId).gte('created_at', desdeEnfr)
      .order('created_at', { ascending: false }).limit(50);
    const choca = (previos ?? []).find((r: any) => solicitudUnica
      ? r.solicitud_id === solicitudUnica.id || (Array.isArray(r.solicitudes_incluidas) && r.solicitudes_incluidas.includes(solicitudUnica.id))
      : r.solicitud_id === null);
    if (choca) {
      const { data: quien } = await admin.from('perfiles').select('nombre').eq('id', choca.enviado_por).single();
      const proximo = new Date(new Date(choca.created_at).getTime() + RECORDATORIO_ENFRIAMIENTO_HORAS * 3600 * 1000);
      const nombreApr = pmap.get(o.aprobadorId)?.nombre || 'este aprobador';
      return json({
        error: `Ya se le envió un recordatorio a ${nombreApr} ${cuandoCL(choca.created_at)}${quien?.nombre ? ` (lo pidió ${quien.nombre})` : ''}. Podrás enviar otro ${cuandoCL(proximo)}.`,
        proximo_permitido: proximo.toISOString(),
      }, 429);
    }
  }

  // Datos para el detalle de cada fila del correo
  const todas = objetivos.flatMap((o) => o.items.map((i) => i.sol));
  const trabIds = [...new Set(todas.map((s) => s.trabajador_id).filter(Boolean))];
  const centroIds = [...new Set(todas.map((s) => s.centro_origen_id).filter(Boolean))];
  const { data: trabs } = trabIds.length
    ? await admin.from('trabajadores').select('id, nombre').in('id', trabIds) : { data: [] as any[] };
  const { data: centros } = centroIds.length
    ? await admin.from('centros_costo').select('id, nombre').in('id', centroIds) : { data: [] as any[] };
  const tmap = new Map<string, string>((trabs ?? []).map((t: any) => [t.id, t.nombre]));
  const cmap = new Map<string, string>((centros ?? []).map((c: any) => [c.id, c.nombre]));
  const detalleCorto = (s: any): string => {
    const quien = s.tipo === 'ingreso'
      ? `${s.detalle?.cargo || 'Cargo'} × ${s.detalle?.cantidad || 1}`
      : (tmap.get(s.trabajador_id) || 'Trabajador');
    const centro = cmap.get(s.centro_origen_id);
    return centro ? `${quien} · ${centro}` : quien;
  };

  const ROL_TXT: Record<string, string> = { admin: 'administrador', rrhh: 'RRHH', solicitante: 'solicitante', supervisor: 'supervisor' };
  const pedidoPor = { nombre: yo.nombre ?? '', rol: ROL_TXT[yo.rol] ?? yo.rol };

  const token = await graphToken();
  const destinatarios: string[] = [];
  const sinCorreo: string[] = [];
  for (const o of objetivos) {
    const apr = pmap.get(o.aprobadorId);
    if (!apr?.email || apr.activo === false) { sinCorreo.push(apr?.nombre || 'un aprobador'); continue; }
    const filas = o.items
      .map((i) => ({
        sol: i.sol,
        desde: i.desde,
        espera: nivelEspera(i.desde),
        detalle: detalleCorto(i.sol),
        solicitante: pmap.get(i.sol.solicitante_id)?.nombre || '—',
      }))
      .sort((a, b) => new Date(a.desde).getTime() - new Date(b.desde).getTime());
    const { asunto, correo } = correoRecordatorio(apr.nombre ?? '', filas, pedidoPor, origen, appUrl);
    await graphSend(token, apr.email, asunto, correo);
    await admin.from('recordatorios_aprobacion').insert({
      aprobador_id: o.aprobadorId,
      solicitud_id: solicitudUnica?.id ?? null,
      enviado_por: userId,
      origen,
      solicitudes_incluidas: o.items.map((i) => i.sol.id),
    });
    destinatarios.push(apr.nombre ?? apr.email);
  }

  if (!destinatarios.length) {
    return json({ error: `${sinCorreo.join(', ')} no tiene correo registrado o su cuenta está inactiva.` }, 400);
  }
  return json({ ok: true, enviados: destinatarios.length, destinatarios, sin_correo: sinCorreo });
}

const NIVEL_ESTILO: Record<NivelEspera, { etiqueta: string; bg: string; fg: string }> = {
  al_dia:   { etiqueta: 'Al día',   bg: '#e0f2fe', fg: '#0369a1' },
  atrasada: { etiqueta: 'Atrasada', bg: '#fef3c7', fg: '#92400e' },
  critica:  { etiqueta: 'Crítica',  bg: ROJO_BG,   fg: ROJO_FG },
};

/**
 * Correo de recordatorio, personalizado por aprobador: lo saluda por su
 * nombre, el asunto y el tono dependen de cuánto lleva esperando la
 * solicitud más antigua (al día / atrasada / crítica), y lista cada
 * solicitud con su propio tiempo de espera (tabla con el diseño SGC).
 */
function correoRecordatorio(
  nombre: string,
  filas: { sol: any; desde: string; espera: ReturnType<typeof nivelEspera>; detalle: string; solicitante: string }[],
  pedidoPor: { nombre: string; rol: string },
  origen: 'rrhh_admin' | 'solicitante',
  appUrl: string,
): { asunto: string; correo: Correo } {
  const n = filas.length;
  const peor = filas[0];
  const nivel = peor.espera.nivel;
  const est = NIVEL_ESTILO[nivel];
  const plural = n === 1 ? 'solicitud' : 'solicitudes';
  const espera = escHtml(peor.espera.texto);
  const codigo = escHtml(peor.sol.codigo || peor.sol.folio || '');

  let asunto: string;
  let intro: string;
  if (origen === 'solicitante') {
    asunto = nivel === 'critica'
      ? `Urgente: la solicitud ${peor.sol.codigo} lleva ${peor.espera.texto} esperando tu aprobación`
      : `Recordatorio: la solicitud ${peor.sol.codigo} espera tu aprobación`;
    intro = `<b>${escHtml(pedidoPor.nombre)}</b> te pide revisar su solicitud <b>${codigo}</b>, que lleva <b>${espera}</b> esperando tu aprobación.`;
  } else if (nivel === 'critica') {
    asunto = `Urgente: ${n} ${plural} esperan tu aprobación hace ${peor.espera.texto}`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobación y la más antigua ya lleva <b>${espera}</b>.`;
  } else if (nivel === 'atrasada') {
    asunto = `Recordatorio: ${n} ${plural} esperan tu aprobación (${peor.espera.texto})`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobación; la más antigua lleva <b>${espera}</b>.`;
  } else {
    asunto = `Recordatorio: tienes ${n} ${plural} por aprobar`;
    intro = `Tienes <b>${n} ${plural}</b> esperando tu aprobación en SSI-RRHH.`;
  }
  const cierre = nivel === 'critica'
    ? `Es urgente: ${n === 1 ? 'la solicitud no avanza' : 'las solicitudes no avanzan'} hasta que decidas, y una vez aprobada${n === 1 ? '' : 's'} RRHH todavía necesita hasta ${DIAS_HABILES_PROCESO_RRHH} días hábiles para procesarla${n === 1 ? '' : 's'}.`
    : nivel === 'atrasada'
      ? `Te pedimos revisar${n === 1 ? 'la' : 'las'} a la brevedad: hasta que decidas, ${n === 1 ? 'la solicitud no avanza' : 'no avanzan'}.`
      : `Mientras antes ${n === 1 ? 'la revises' : 'las revises'}, antes puede seguir el proceso.`;

  // Código del encabezado: el del documento si todas son del mismo tipo; si no, el del Maestro de solicitudes
  const tipos = [...new Set(filas.map((f) => f.sol.tipo))];
  const codigoDoc = tipos.length === 1 ? (DOCUMENTO_CODIGOS[tipos[0]]?.codigo ?? MAESTRO_SOLICITUDES_CODIGO) : MAESTRO_SOLICITUDES_CODIGO;
  const titulo = 'Recordatorio de aprobación';

  const correo = correoSgc({
    encabezado: { titulo, codigo: codigoDoc, fecha: fechaDMY(new Date()), revision: '00' },
    pie: { codigo: codigoDoc, nombre: titulo },
    saludo: saludo(nombre),
    mensaje: p0(intro) + p1(cierre),
    resumen: [
      ['Solicitudes por aprobar', String(n)],
      ['Espera más larga', peor.espera.texto, est.fg],
      ['Nivel', est.etiqueta, est.fg],
    ],
    boton: enlace(appUrl, 'Ir a mi bandeja', 'bandeja'),
    secciones: [{ titulo: n === 1 ? 'Solicitud por aprobar' : 'Solicitudes por aprobar', tabla: {
      columnas: [
        { titulo: 'N° de solicitud', icono: 'hash', estilo: 'fuerte' },
        { titulo: 'Tipo', icono: 'file-text', estilo: 'normal', movil: false },
        { titulo: 'Detalle', icono: 'clipboard-list', estilo: 'normal' },
        { titulo: 'Solicitante', icono: 'user', estilo: 'normal' },
        { titulo: 'Esperando', icono: 'timer', estilo: 'pildora' },
        { titulo: 'Desde', icono: 'calendar-clock', alinear: 'centro', estilo: 'normal', movil: false },
      ],
      filas: filas.map((f) => [
        f.sol.codigo || '—',
        Tipo(f.sol.tipo),
        f.detalle,
        f.solicitante,
        { texto: f.espera.texto, fondo: NIVEL_ESTILO[f.espera.nivel].bg, color: NIVEL_ESTILO[f.espera.nivel].fg },
        fechaHora(f.desde),
      ]),
    } }],
    nota: `Recordatorio enviado a pedido de ${escHtml(pedidoPor.nombre)} (${escHtml(pedidoPor.rol)}). Correo automático del sistema SSI-RRHH: no hace falta responderlo.`,
  });
  return { asunto, correo };
}
