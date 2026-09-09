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
//
//  Deploy:  supabase functions deploy notificar
//  Secrets: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_FROM_ADDRESS
//           (opcional) APP_URL
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { construirComprobantePdf } from '../_shared/pdf-comprobante.ts';
import { tipoTxt } from '../_shared/solicitud-detalle.ts';
import { LOGO_METALIUM_PNG_B64 } from '../_shared/logo.ts';

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
    const { type, solicitud_id, contratacion_id } = await req.json();
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
    const appUrl = Deno.env.get('APP_URL') || '';

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

      const token = await graphToken();
      await graphSend(token, prev.email,
        `Nueva contratación para homologar — ${contrat.nombre_candidato}`,
        correoContratacionIniciada(prev.nombre ?? '', contrat, solIngreso, centro, appUrl));
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

      const token = await graphToken();
      if (type === 'rrhh_cerrado') {
        await graphSend(token, s.email,
          `RRHH ya procesó tu solicitud ${sol.codigo}`,
          correoRrhhCerrado(s.nombre ?? '', sol, nombre, appUrl));
      } else {
        await graphSend(token, s.email,
          `${nombre || 'El trabajador'} ya puede ingresar a la obra — solicitud ${sol.codigo}`,
          correoHomologacionAutorizada(s.nombre ?? '', sol, nombre, appUrl));
      }
      return json({ ok: true, enviados: 1 });
    }

    if (!solicitud_id) return json({ error: 'Falta solicitud_id.' }, 400);

    const { data: sol, error: solErr } = await admin
      .from('solicitudes')
      .select('id, codigo, folio, tipo, estado, solicitante_id, trabajador_id, centro_origen_id, centro_destino_id, motivo, detalle, created_at')
      .eq('id', solicitud_id).single();
    if (solErr || !sol) return json({ error: 'Solicitud no encontrada.' }, 404);

    // ---- aviso a aprobadores pendientes (al crear) ----
    if (type === 'pendiente_aprobador') {
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
      const token = await graphToken();
      let enviados = 0;
      for (const p of perfiles ?? []) {
        if (!p.email || p.activo === false) continue;
        await graphSend(token, p.email,
          `Solicitud ${sol.codigo} pendiente de tu aprobación`,
          correoPendiente(p.nombre ?? '', sol, appUrl));
        enviados++;
      }
      return json({ ok: true, enviados });
    }

    // ---- cambio de estado ----
    if (type === 'cambio_estado') {
      if (sol.estado !== 'aprobada' && sol.estado !== 'rechazada') {
        return json({ ok: true, skipped: true, reason: `estado ${sol.estado} no notificable` });
      }

      // datos comunes
      const { data: centros } = await admin.from('centros_costo').select('id, codigo, nombre');
      const cmap = new Map((centros ?? []).map((c) => [c.id, c]));
      const { data: aprs } = await admin
        .from('aprobaciones').select('aprobador_id, decision, decidido_at, asignado_at, orden, tiempo_respuesta')
        .eq('solicitud_id', solicitud_id).order('orden');
      const aprIds = (aprs ?? []).map((a) => a.aprobador_id);
      const { data: pers } = await admin
        .from('perfiles').select('id, nombre, email').in('id', [sol.solicitante_id, ...aprIds]);
      const pmap = new Map((pers ?? []).map((p) => [p.id, p]));
      let trabNombre: string | null = null;
      if (sol.trabajador_id) {
        const { data: t } = await admin.from('trabajadores').select('nombre').eq('id', sol.trabajador_id).single();
        trabNombre = t?.nombre ?? null;
      }

      const token = await graphToken();

      // RECHAZADA -> solo solicitante
      if (sol.estado === 'rechazada') {
        const s = pmap.get(sol.solicitante_id);
        if (s?.email) {
          await graphSend(token, s.email, `Tu solicitud ${sol.codigo} fue rechazada`,
            correoEstado(s.nombre ?? '', sol, appUrl));
        }
        return json({ ok: true, enviados: s?.email ? 1 : 0 });
      }

      // APROBADA -> comprobante en PDF (con el encabezado Metalium y Código/Folio)
      // a solicitante + aprobadores + RRHH
      const pdfBytes = await construirComprobantePdf({ sol, cmap, aprs: aprs ?? [], pmap, trabNombre });
      const pdfB64 = encodeBase64(pdfBytes);
      const { data: rrhh } = await admin
        .from('perfiles').select('id, nombre, email').eq('rol', 'rrhh').eq('activo', true);

      const dest = new Map<string, string>(); // email -> nombre (dedupe)
      const add = (p: any) => { if (p?.email) dest.set(p.email, p.nombre ?? ''); };
      add(pmap.get(sol.solicitante_id));
      (aprs ?? []).forEach((a) => add(pmap.get(a.aprobador_id)));
      (rrhh ?? []).forEach((r) => add(r));

      const adjuntos = [{ name: `${sol.folio || sol.codigo}.pdf`, b64: pdfB64 }];
      let enviados = 0;
      for (const [email, nombre] of dest) {
        await graphSend(token, email, `Solicitud ${sol.codigo} aprobada — respaldo`,
          correoAprobada(nombre, sol, appUrl), adjuntos);
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
// correos -- así el encabezado de cada plantilla (ver shell()) lo puede
// mostrar con <img src="cid:metalium-logo">. Los clientes de correo no
// muestran imágenes en base64 pegadas directo en el HTML (Outlook las
// bloquea), así que tiene que ir como adjunto inline, no como data: URI.
const LOGO_CID = 'metalium-logo';
async function graphSend(token: string, to: string, subject: string, html: string, adjuntos: Adjunto[] = []) {
  const sender = Deno.env.get('GRAPH_FROM_ADDRESS')!;
  const attachments: any[] = [
    {
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: 'metalium-logo.png',
      contentType: 'image/png',
      contentBytes: LOGO_METALIUM_PNG_B64,
      contentId: LOGO_CID,
      isInline: true,
    },
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

// ---------- Plantillas de correo ----------
// Estilos en línea (nada de <style> ni clases): es lo único que se ve bien
// de forma pareja en Outlook/Exchange, que es el cliente real acá (Graph +
// buzón Metalium). El logo va como adjunto inline (ver LOGO_CID en
// graphSend) porque Outlook bloquea las imágenes pegadas en base64 dentro
// del propio HTML.
const AZUL = '#1B9BD8';
const NAVY = '#1B2340';
const GRIS_ETIQUETA = '#8791AA';
const GRIS_TEXTO = '#3D4258';
const FUENTE = "'Segoe UI', Arial, Helvetica, sans-serif";

function shell(inner: string) {
  return `<div style="background:#eef1f5;padding:32px 16px;font-family:${FUENTE}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e7ee;border-radius:10px">
      <tr><td style="height:6px;line-height:6px;font-size:0;background:${AZUL};border-radius:10px 10px 0 0">&nbsp;</td></tr>
      <tr><td style="padding:26px 32px 16px">
        <img src="cid:metalium-logo" width="140" height="29" alt="Metalium" style="display:block;width:140px;height:29px;border:0" />
        <div style="margin-top:12px;font-size:11px;font-weight:700;letter-spacing:1px;color:${GRIS_ETIQUETA};text-transform:uppercase">Sistema de Gestión Integrado</div>
      </td></tr>
      <tr><td style="padding:0 32px"><div style="border-top:1px solid #edf0f4"></div></td></tr>
      <tr><td style="padding:22px 32px 4px;color:${GRIS_TEXTO};font-size:14.5px;line-height:1.6">${inner}</td></tr>
      <tr><td style="padding:22px 32px 28px">
        <div style="border-top:1px solid #edf0f4;padding-top:16px;font-size:11.5px;color:#9aa2b3;line-height:1.6">
          Metalium SpA · Sistema de Solicitudes de Ingreso y Traslado de Personal.<br/>
          Este es un correo automático -- no hace falta responderlo.
        </div>
      </td></tr>
    </table>
  </div>`;
}
function boton(appUrl: string, txt: string) {
  if (!appUrl) return '';
  return `<div style="text-align:center;margin:24px 0 4px">
    <a href="${appUrl}" style="display:inline-block;background:${AZUL};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">${txt}</a>
  </div>`;
}
/** Caja de datos clave (label -> valor), acento azul a la izquierda. */
function infoCard(filas: [string, string | null | undefined][]) {
  const tr = filas
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<tr>
        <td style="padding:5px 0;color:${GRIS_ETIQUETA};font-size:12.5px;font-weight:700;white-space:nowrap;vertical-align:top">${k}</td>
        <td style="padding:5px 0 5px 14px;color:${NAVY};font-size:13.5px;font-weight:600">${v}</td>
      </tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 6px;background:#f6f9fc;border-left:3px solid ${AZUL};border-radius:0 6px 6px 0">
    <tr><td style="padding:14px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tr}</table>
    </td></tr>
  </table>`;
}
/** Pastilla de estado (aprobada / rechazada / etc.), en línea dentro de un párrafo. */
function badge(texto: string, bg: string, fg: string) {
  return `<span style="display:inline-block;background:${bg};color:${fg};padding:3px 11px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.2px">${texto}</span>`;
}
const VERDE_BG = '#e5f6ea', VERDE_FG = '#1a7f37';
const ROJO_BG = '#fbe9e9', ROJO_FG = '#b91c1c';

function correoPendiente(nombre: string, sol: any, appUrl: string) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">Tienes una solicitud pendiente de tu aprobación.</p>
    ${infoCard([['Tipo', tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ['N° de solicitud', sol.codigo], ['Folio', sol.folio]])}
    ${boton(appUrl, 'Ir a la bandeja')}`);
}
function correoEstado(nombre: string, sol: any, appUrl: string) {
  const aprobada = sol.estado === 'aprobada';
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">Tu solicitud quedó ${badge(aprobada ? 'Aprobada' : 'Rechazada', aprobada ? VERDE_BG : ROJO_BG, aprobada ? VERDE_FG : ROJO_FG)}.</p>
    ${infoCard([['Tipo', tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ['N° de solicitud', sol.codigo], ['Folio', sol.folio]])}
    ${boton(appUrl, 'Ver mis solicitudes')}`);
}
function correoAprobada(nombre: string, sol: any, appUrl: string) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">La solicitud quedó ${badge('Aprobada', VERDE_BG, VERDE_FG)}. Adjuntamos el comprobante en PDF con el detalle de lo aprobado.</p>
    ${infoCard([['Tipo', tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ['N° de solicitud', sol.codigo], ['Folio', sol.folio]])}
    ${boton(appUrl, 'Ver en SSI-RRHH')}`);
}
function correoRrhhCerrado(nombre: string, sol: any, nombreEspecifico: string | null, appUrl: string) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">RRHH ya terminó de procesar tu solicitud${nombreEspecifico ? ` de <b>${nombreEspecifico}</b>` : ''}.</p>
    ${infoCard([['Tipo', tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ['N° de solicitud', sol.codigo], ['Folio', sol.folio]])}
    ${boton(appUrl, 'Ver mis solicitudes')}`);
}
function correoHomologacionAutorizada(nombre: string, sol: any, nombreEspecifico: string | null, appUrl: string) {
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">El proceso de homologación de tu solicitud terminó: ${nombreEspecifico ? `<b>${nombreEspecifico}</b>` : 'el trabajador'} ya está autorizado para ingresar a la obra.</p>
    ${infoCard([['Tipo', tipoTxt(sol.tipo).replace(/^./, (c) => c.toUpperCase())], ['N° de solicitud', sol.codigo], ['Folio', sol.folio]])}
    ${boton(appUrl, 'Ver mis solicitudes')}`);
}
function correoContratacionIniciada(nombre: string, contrat: any, sol: any, centro: any, appUrl: string) {
  const CANAL_LABELS: Record<string, string> = { recomendacion: 'Recomendación', reclutamiento_seleccion: 'Reclutamiento y selección' };
  const TIPO_TRAB_LABELS: Record<string, string> = { administrativo: 'Administrativo', operativo: 'Operativo' };
  const cargo = sol.detalle?.cargo || '—';
  return shell(`
    <p style="margin:0 0 4px">Hola ${nombre},</p>
    <p style="margin:0">RRHH inició una contratación en tu centro de costo. Puedes empezar la homologación SST a medida que se vaya subiendo la documentación.</p>
    ${infoCard([
      ['Candidato', contrat.nombre_candidato],
      ['Cargo', cargo],
      ['Centro de costo', centro?.nombre],
      ['Canal', CANAL_LABELS[contrat.canal] ?? contrat.canal],
      ['Tipo de trabajador', TIPO_TRAB_LABELS[contrat.tipo_trabajador] ?? contrat.tipo_trabajador],
      ['Solicitud', sol.folio || sol.codigo],
    ])}
    ${boton(appUrl, 'Ir a Homologación SST')}`);
}
