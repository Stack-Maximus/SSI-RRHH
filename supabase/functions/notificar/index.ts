// =====================================================================
//  Edge Function: notificar
//  Envía correos (Microsoft Graph, buzón Metalium) ante eventos de solicitudes.
//  El frontend la invoca tras el evento (fire-and-forget).
//
//  Payload:
//   { type: 'pendiente_aprobador', solicitud_id }  -> avisa a los aprobadores pendientes (al crear)
//   { type: 'cambio_estado',       solicitud_id }  -> al quedar aprobada o rechazada:
//        * rechazada  -> avisa al solicitante
//        * aprobada   -> avisa a solicitante + aprobadores + RRHH, con PDF de respaldo adjunto
//
//  Deploy:  supabase functions deploy notificar
//  Secrets: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_FROM_ADDRESS
//           (opcional) APP_URL
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

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
    const { type, solicitud_id } = await req.json();
    if (!type || !solicitud_id) return json({ error: 'Faltan type o solicitud_id.' }, 400);

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

    const { data: sol, error: solErr } = await admin
      .from('solicitudes')
      .select('id, codigo, tipo, estado, solicitante_id, trabajador_id, centro_origen_id, centro_destino_id, motivo, detalle, created_at, decided_at')
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
        .from('aprobaciones').select('aprobador_id, decision, decidido_at, orden')
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

      // APROBADA -> PDF de respaldo a solicitante + aprobadores + RRHH
      const pdfB64 = await construirPdf(sol, cmap, aprs ?? [], pmap, trabNombre);
      const { data: rrhh } = await admin
        .from('perfiles').select('id, nombre, email').eq('rol', 'rrhh').eq('activo', true);

      const dest = new Map<string, string>(); // email -> nombre (dedupe)
      const add = (p: any) => { if (p?.email) dest.set(p.email, p.nombre ?? ''); };
      add(pmap.get(sol.solicitante_id));
      (aprs ?? []).forEach((a) => add(pmap.get(a.aprobador_id)));
      (rrhh ?? []).forEach((r) => add(r));

      const adjuntos = [{ name: `${sol.codigo}.pdf`, b64: pdfB64 }];
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
async function graphSend(token: string, to: string, subject: string, html: string, adjuntos: Adjunto[] = []) {
  const sender = Deno.env.get('GRAPH_FROM_ADDRESS')!;
  const message: any = {
    subject,
    body: { contentType: 'HTML', content: html },
    toRecipients: [{ emailAddress: { address: to } }],
  };
  if (adjuntos.length) {
    message.attachments = adjuntos.map((a) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: 'application/pdf',
      contentBytes: a.b64,
    }));
  }
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems: false }),
  });
  if (!res.ok) throw new Error('Graph sendMail: ' + (await res.text()));
}

// ---------- PDF de respaldo ----------
function pesos(n: any) {
  const v = Number(n);
  if (isNaN(v)) return String(n ?? '—');
  return '$ ' + v.toLocaleString('es-CL');
}
function detalleLineas(sol: any): [string, string][] {
  const d = sol.detalle || {};
  const pares: [string, any][] = sol.tipo === 'ingreso' ? [
    ['Cargo', d.cargo], ['Cantidad', d.cantidad],
    ['Sueldo líquido pactado', d.sueldo_liquido != null ? pesos(d.sueldo_liquido) : null],
    ['Tipo de contrato', d.tipo_contrato], ['Plazo', d.plazo], ['Turno', d.turno],
    ['Horario', d.horario], ['Fecha de ingreso', d.fecha_ingreso], ['Cliente', d.cliente],
  ] : [
    ['Cargo', d.cargo], ['Fecha de traslado', d.fecha_traslado],
    ['Modificaciones', d.modificaciones_contractuales], ['Turno', d.turno], ['Horario', d.horario],
    ['Sueldo líquido actual', d.sueldo_liquido_actual != null ? pesos(d.sueldo_liquido_actual) : null],
    ['Nuevo sueldo líquido', d.nuevo_sueldo_liquido != null ? pesos(d.nuevo_sueldo_liquido) : null],
    ['Bono nocturno', d.bono_nocturno?.aplica ? `Sí (${d.bono_nocturno.porcentaje ?? '—'} · ${d.bono_nocturno.periodo ?? '—'})` : 'No'],
    ['Bono trato', d.bono_trato?.aplica ? `Sí (${d.bono_trato.monto != null ? pesos(d.bono_trato.monto) : '—'} · ${d.bono_trato.dias_asignacion ?? '—'} días)` : 'No'],
  ];
  return pares.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, String(v)]);
}

async function construirPdf(sol: any, cmap: Map<any, any>, aprs: any[], pmap: Map<any, any>, trabNombre: string | null): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const azul = rgb(0.04, 0.17, 0.35);
  const gris = rgb(0.4, 0.45, 0.5);
  const M = 50;
  let y = 800;

  const text = (t: string, x: number, size: number, f = font, color = rgb(0, 0, 0)) =>
    page.drawText(t, { x, y, size, font: f, color });
  const salto = (px = 18) => { y -= px; };
  const kv = (k: string, v: string) => { text(k, M, 10, bold, gris); text(v, 210, 10, font); salto(17); };
  const sep = () => { page.drawLine({ start: { x: M, y: y + 6 }, end: { x: 545, y: y + 6 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) }); salto(14); };

  text('Metalium · SSI-RRHH', M, 20, bold, azul); salto(24);
  text('Comprobante de Solicitud Aprobada', M, 13, bold); salto(22);
  sep();

  kv('Código', sol.codigo ?? '—');
  kv('Tipo', sol.tipo === 'traslado' ? 'Traslado' : 'Ingreso');
  kv('Estado', 'APROBADA');
  kv('Solicitante', pmap.get(sol.solicitante_id)?.nombre ?? '—');
  if (sol.tipo === 'traslado') {
    kv('Trabajador', trabNombre ?? '—');
    kv('Obra origen', cmap.get(sol.centro_origen_id)?.nombre ?? '—');
    kv('Obra destino', cmap.get(sol.centro_destino_id)?.nombre ?? '—');
  } else {
    kv('Centro solicitado', cmap.get(sol.centro_origen_id)?.nombre ?? '—');
  }
  kv('Creada', (sol.created_at ?? '').toString().slice(0, 10));
  kv('Aprobada', (sol.decided_at ?? '').toString().slice(0, 10));
  salto(6); sep();

  text('Detalle', M, 12, bold, azul); salto(20);
  for (const [k, v] of detalleLineas(sol)) kv(k, v);
  salto(6); sep();

  text('Aprobaciones', M, 12, bold, azul); salto(20);
  aprs.forEach((a, i) => {
    const nom = pmap.get(a.aprobador_id)?.nombre ?? `Aprobador ${i + 1}`;
    const fecha = (a.decidido_at ?? '').toString().slice(0, 10);
    kv(`${i + 1}. ${nom}`, `${a.decision}${fecha ? ' · ' + fecha : ''}`);
  });

  if (sol.motivo) { salto(6); sep(); text('Motivo', M, 12, bold, azul); salto(18); text(String(sol.motivo).slice(0, 90), M, 10, font); }

  y = 40;
  text('Documento generado automáticamente por SSI-RRHH · Metalium', M, 8, font, gris);

  const bytes = await doc.save();
  return encodeBase64(bytes);
}

// ---------- Plantillas de correo ----------
function shell(inner: string) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1b2a4a;max-width:520px;margin:auto">
    <h2 style="color:#0a2c5a">Metalium · SSI-RRHH</h2>${inner}
    <p style="font-size:12px;color:#667">Sistema de Solicitudes de Ingreso y Traslado de Personal.</p></div>`;
}
function boton(appUrl: string, txt: string) {
  if (!appUrl) return '';
  return `<p style="text-align:center;margin:24px 0">
    <a href="${appUrl}" style="background:#0a2c5a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600">${txt}</a></p>`;
}
function tipoTxt(t: string) { return t === 'traslado' ? 'traslado' : 'ingreso'; }

function correoPendiente(nombre: string, sol: any, appUrl: string) {
  return shell(`<p>Hola ${nombre},</p>
    <p>Tenés una solicitud de <strong>${tipoTxt(sol.tipo)}</strong> (<strong>${sol.codigo}</strong>)
       pendiente de tu aprobación.</p>${boton(appUrl, 'Ir a la bandeja')}`);
}
function correoEstado(nombre: string, sol: any, appUrl: string) {
  const color = sol.estado === 'aprobada' ? '#1a7f37' : '#b91c1c';
  return shell(`<p>Hola ${nombre},</p>
    <p>Tu solicitud de <strong>${tipoTxt(sol.tipo)}</strong> (<strong>${sol.codigo}</strong>) fue
       <strong style="color:${color}">${sol.estado}</strong>.</p>${boton(appUrl, 'Ver mis solicitudes')}`);
}
function correoAprobada(nombre: string, sol: any, appUrl: string) {
  return shell(`<p>Hola ${nombre},</p>
    <p>La solicitud de <strong>${tipoTxt(sol.tipo)}</strong> (<strong>${sol.codigo}</strong>) quedó
       <strong style="color:#1a7f37">aprobada</strong>.</p>
    <p>Adjuntamos el <strong>comprobante en PDF</strong> con el detalle de lo aprobado.</p>${boton(appUrl, 'Ver en SSI-RRHH')}`);
}
