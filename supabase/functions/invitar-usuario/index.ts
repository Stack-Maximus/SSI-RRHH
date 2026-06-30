// =====================================================================
//  Edge Function: invitar-usuario
//  Invita a un usuario con rol/centro pre-asignados y le manda el correo
//  de invitación desde el buzón de Metalium (Microsoft Graph), NO el mailer
//  de Supabase. El usuario define su propia contraseña al aceptar.
//
//  Seguridad:
//   - La service_role vive solo acá (servidor), nunca en el navegador.
//   - Verifica que QUIEN llama es admin antes de hacer nada.
//
//  Deploy:  supabase functions deploy invitar-usuario
//  Secrets (Supabase -> Edge Functions -> Secrets), reusá los de tu app de Graph:
//     GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_FROM_ADDRESS
//     (opcional) INVITE_REDIRECT_URL  -> a dónde vuelve el usuario tras fijar su pass
//  SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { email, nombre, rol, centro_costo_id } = await req.json();
    if (!email) return json({ error: 'Falta el correo del usuario.' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) ¿Quién llama? Verificar que sea admin con su propio token.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'No autenticado.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: perfil } = await admin
      .from('perfiles').select('rol').eq('id', user.id).single();
    if (!perfil || perfil.rol !== 'admin') {
      return json({ error: 'Solo un administrador puede invitar usuarios.' }, 403);
    }

    // 2) Generar el link de invitación SIN enviar el mail de Supabase.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { nombre: nombre ?? null, rol: rol ?? 'solicitante', centro_costo_id: centro_costo_id ?? null },
        redirectTo: Deno.env.get('INVITE_REDIRECT_URL') || undefined,
      },
    });
    if (linkErr) return json({ error: linkErr.message }, 400);
    const link = linkData?.properties?.action_link;
    if (!link) return json({ error: 'No se pudo generar el link de invitación.' }, 500);

    // 3) Enviar el correo por Microsoft Graph (buzón Metalium).
    await enviarCorreoGraph(email, nombre ?? email, link);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Error interno.' }, 500);
  }
});

async function enviarCorreoGraph(to: string, nombre: string, link: string) {
  const tenant = Deno.env.get('GRAPH_TENANT_ID')!;
  const clientId = Deno.env.get('GRAPH_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GRAPH_CLIENT_SECRET')!;
  const sender = Deno.env.get('GRAPH_FROM_ADDRESS')!; // ej: notificaciones@metalium.cl

  // Token client_credentials
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    throw new Error('No se pudo autenticar con Graph: ' + (tokenJson.error_description ?? 'sin token'));
  }

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1b2a4a;max-width:520px;margin:auto">
      <h2 style="color:#0a2c5a">Metalium · SSI-RRHH</h2>
      <p>Hola ${nombre},</p>
      <p>Te invitaron a <strong>SSI-RRHH · Solicitudes de Ingreso y Traslado</strong>.
         Para activar tu cuenta y definir tu contraseña, hacé clic en el botón:</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#0a2c5a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">
          Activar mi cuenta
        </a>
      </p>
      <p style="font-size:12px;color:#667">Si no esperabas esta invitación, ignorá este correo.</p>
    </div>`;

  const mailRes = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: 'Invitación a SSI-RRHH · Metalium',
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: false,
    }),
  });
  if (!mailRes.ok) {
    throw new Error('Graph sendMail falló: ' + (await mailRes.text()));
  }
}
