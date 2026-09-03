// =====================================================================
//  Edge Function: vencimientos-contrato
//  Aviso por correo de contratos próximos a vencer (30 y 15 días antes de
//  `trabajadores.fecha_termino_contrato`). Pensada para dispararse sola,
//  UNA VEZ AL DÍA, vía un Cron Trigger de Supabase (no la llama el frontend).
//
//  A quién avisa, por cada trabajador con vencimiento en 30 o 15 días:
//    - Todo el equipo de RRHH (rol 'rrhh', activos)
//    - Todo el equipo de Supervisores (rol 'supervisor', activos)
//    - El Administrador de obra del centro de costo del trabajador
//      (centros_costo.admin_obra_id)
//  (Si más adelante quieres acotar RRHH/supervisor por centro de costo,
//  igual que se hizo con el prevencionista, avisa y lo ajusto del mismo
//  modo -- por ahora se asumió "todo RRHH y todo Supervisor", según lo
//  que confirmaste.)
//
//  No genera ningún documento -- es solo un correo (según lo pedido).
//  No toca `contrato_indefinido = true`: esos trabajadores no vencen y
//  quedan excluidos.
//
//  Deploy:  supabase functions deploy vencimientos-contrato --no-verify-jwt
//  Secrets: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_FROM_ADDRESS
//           (opcional) APP_URL
//  Programar: Supabase Dashboard -> Edge Functions -> vencimientos-contrato
//             -> Cron Triggers -> ej. "0 13 * * *" (10:00 Chile aprox., UTC-3)
//             Alternativa por SQL (pg_cron + pg_net), documentada en
//             NOTAS_CONTRATACION_SST.md.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const UMBRALES = [30, 15]; // días de anticipación

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (_req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const appUrl = Deno.env.get('APP_URL') || '';

    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const fechasObjetivo = UMBRALES.map((dias) => {
      const f = new Date(hoy);
      f.setUTCDate(f.getUTCDate() + dias);
      return { dias, iso: f.toISOString().slice(0, 10) };
    });

    const { data: trabajadores, error: errT } = await admin
      .from('trabajadores')
      .select('id, nombre, cargo, centro_costo_id, fecha_termino_contrato')
      .eq('activo', true)
      .eq('contrato_indefinido', false)
      .in('fecha_termino_contrato', fechasObjetivo.map((f) => f.iso));
    if (errT) throw errT;

    if (!trabajadores?.length) return json({ ok: true, avisos: 0, motivo: 'sin vencimientos en 30/15 días' });

    const centroIds = [...new Set(trabajadores.map((t) => t.centro_costo_id).filter(Boolean))];
    const { data: centros } = await admin
      .from('centros_costo').select('id, nombre, admin_obra_id').in('id', centroIds);
    const cmap = new Map((centros ?? []).map((c) => [c.id, c]));

    const { data: rrhh } = await admin.from('perfiles').select('id, nombre, email').eq('rol', 'rrhh').eq('activo', true);
    const { data: supervisores } = await admin.from('perfiles').select('id, nombre, email').eq('rol', 'supervisor').eq('activo', true);

    const adminObraIds = [...new Set((centros ?? []).map((c) => c.admin_obra_id).filter(Boolean))];
    const { data: adminsObra } = adminObraIds.length
      ? await admin.from('perfiles').select('id, nombre, email').in('id', adminObraIds)
      : { data: [] as any[] };
    const adminObraMap = new Map((adminsObra ?? []).map((p) => [p.id, p]));

    const token = await graphToken();
    let avisos = 0;
    const detalle: any[] = [];

    for (const t of trabajadores) {
      const centro = cmap.get(t.centro_costo_id);
      const dias = fechasObjetivo.find((f) => f.iso === t.fecha_termino_contrato)?.dias ?? null;

      const dest = new Map<string, string>(); // email -> nombre
      const add = (p: any) => { if (p?.email) dest.set(p.email, p.nombre ?? ''); };
      (rrhh ?? []).forEach(add);
      (supervisores ?? []).forEach(add);
      if (centro?.admin_obra_id) add(adminObraMap.get(centro.admin_obra_id));

      if (!dest.size) continue;

      const asunto = `Aviso: contrato de ${t.nombre} vence en ${dias} día(s) (${t.fecha_termino_contrato})`;
      for (const [email, nombre] of dest) {
        await graphSend(token, email, asunto, correoVencimiento(t, centro?.nombre, dias, appUrl, nombre));
        avisos++;
      }
      detalle.push({ trabajador: t.nombre, dias, destinatarios: dest.size });
    }

    return json({ ok: true, avisos, trabajadores: trabajadores.length, detalle });
  } catch (e) {
    console.error('[vencimientos-contrato]', e);
    return json({ error: (e as Error).message ?? 'Error interno.' }, 500);
  }
});

// ---------- Microsoft Graph (mismo patrón que notificar / invitar-usuario) ----------
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

async function graphSend(token: string, to: string, subject: string, html: string) {
  const sender = Deno.env.get('GRAPH_FROM_ADDRESS')!;
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) throw new Error('Graph sendMail: ' + (await res.text()));
}

function correoVencimiento(t: any, centroNombre: string | undefined, dias: number | null, appUrl: string, nombreDestino = '') {
  const urgente = dias != null && dias <= 15;
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1b2a4a;max-width:520px;margin:auto">
    <h2 style="color:#0a2c5a">Metalium · SSI-RRHH</h2>
    <p>Hola${nombreDestino ? ' ' + nombreDestino : ''},</p>
    <p>El contrato de <strong>${t.nombre}</strong>${t.cargo ? ` (${t.cargo})` : ''}${centroNombre ? `, en <strong>${centroNombre}</strong>,` : ''}
       vence el <strong>${t.fecha_termino_contrato}</strong>
       ${dias != null ? `— quedan <strong style="color:${urgente ? '#b91c1c' : '#b45309'}">${dias} día(s)</strong>.` : '.'}</p>
    <p>Si corresponde renovar, crea una solicitud de <strong>Renovación</strong> en el sistema con la anticipación necesaria.</p>
    ${appUrl ? `<p style="text-align:center;margin:24px 0">
      <a href="${appUrl}" style="background:#0a2c5a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600">Ir a SSI-RRHH</a></p>` : ''}
    <p style="font-size:12px;color:#667">Aviso automático de próximos vencimientos de contrato.</p></div>`;
}
