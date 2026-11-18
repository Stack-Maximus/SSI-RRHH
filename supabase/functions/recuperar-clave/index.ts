// =====================================================================
//  Edge Function: recuperar-clave   (nov. 2026)
//  "¿Olvidaste tu contraseña?": manda el correo de recuperación desde el
//  buzón Metalium (Microsoft Graph), con el diseño de los demás correos, en
//  vez del correo de Supabase.
//
//  Por qué: el enlace del correo de Supabase es de UN SOLO USO y lo "abre"
//  cualquiera que lo visite. El filtro de seguridad del correo de Metalium
//  revisa los enlaces apenas llega el correo (en los logs de Auth: un GET a
//  /verify desde otra IP segundos antes que el usuario), así que cuando la
//  persona hace clic el enlace ya está usado: llega a la app con
//  #error_code=otp_expired ("Email link is invalid or has expired"). Al
//  reintentar seguido, Supabase responde 429 (un correo por minuto).
//
//  Ahora el enlace lleva a la propia app (?recuperar=<token>) y el token
//  recién se usa cuando la persona escribe su nueva contraseña y aprieta
//  "Cambiar contraseña" (supabase.auth.verifyOtp en src/core/auth.js). Que
//  un filtro abra la página no gasta nada.
//
//  Payload: { email }. Responde siempre lo mismo exista o no la cuenta (no
//  revela qué correos están registrados). Límite: 1 correo por minuto y 5
//  por hora por correo, 20 por hora por IP (tabla recuperaciones_clave,
//  migración 0031). No exige sesión: en el Dashboard va con "Verify JWT"
//  desactivado.
//
//  Secrets: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET,
//           GRAPH_FROM_ADDRESS, APP_URL (recomendado)
//  Como importa _shared/, para el Dashboard se pega
//  supabase/dashboard/recuperar-clave/index.ts.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { correoSgc, escCorreo } from '../_shared/correo-sgc.js';
import { fechaDMY } from '../_shared/sgc-documentos.js';
import { LOGO_METALIUM_PNG_B64 } from '../_shared/logo.ts';
import { ICONOS_CORREO_PNG_B64 } from '../_shared/iconos-correo.ts';

const POR_MINUTO = 1;
const POR_HORA = 5;
const POR_HORA_IP = 20;
const VENCE_TEXTO = '1 hora'; // vencimiento del enlace (Auth -> "Email OTP expiration", 3600 s por defecto)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const MENSAJE_OK = 'Si el correo está registrado, te llegará un enlace para crear una nueva contraseña. Revisa también el spam.';

// URL de la app para el enlace: secret APP_URL o el origen del navegador, solo si es un dominio esperado
const ORIGEN_PERMITIDO = /^(https:\/\/([a-z0-9-]+\.)*(vercel\.app|metalium\.cl)|http:\/\/localhost(:\d+)?)$/i;
function urlApp(req: Request): string {
  const env = (Deno.env.get('APP_URL') || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const origin = (req.headers.get('Origin') || '').trim().replace(/\/+$/, '');
  return ORIGEN_PERMITIDO.test(origin) ? origin : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  try {
    let body: { email?: string } = {};
    try { body = await req.json(); } catch { /* sin cuerpo */ }
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
      return json({ error: 'Escribe un correo válido.' }, 400);
    }

    const appUrl = urlApp(req);
    if (!appUrl) return json({ error: 'Falta configurar APP_URL en la función recuperar-clave.' }, 500);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    const hace = (seg: number) => new Date(Date.now() - seg * 1000).toISOString();

    // ---- límites (se cuentan también los correos que no existen: no se puede tantear)
    const contar = async (campo: 'email' | 'ip', valor: string, desde: string) => {
      const { count, error } = await admin.from('recuperaciones_clave')
        .select('id', { count: 'exact', head: true }).eq(campo, valor).gte('created_at', desde);
      if (error) throw new Error('No se pudo revisar el límite de correos (¿se corrió la migración 0031?): ' + error.message);
      return count ?? 0;
    };
    if (await contar('email', email, hace(60)) >= POR_MINUTO) {
      return json({ error: 'Ya te enviamos un correo hace menos de un minuto. Revisa tu bandeja (y el spam) antes de pedir otro.', espera_seg: 60 }, 429);
    }
    if (await contar('email', email, hace(3600)) >= POR_HORA) {
      return json({ error: 'Pediste demasiados correos en la última hora. Espera un rato o pide ayuda al administrador.', espera_seg: 3600 }, 429);
    }
    if (ip && await contar('ip', ip, hace(3600)) >= POR_HORA_IP) {
      return json({ error: 'Demasiadas solicitudes desde esta conexión. Espera un rato.', espera_seg: 3600 }, 429);
    }
    await admin.from('recuperaciones_clave').insert({ email, ip });
    // limpieza: no guardar más de una semana
    await admin.from('recuperaciones_clave').delete().lt('created_at', hace(7 * 24 * 3600));

    // ---- solo cuentas activas con perfil
    const { data: perfil } = await admin.from('perfiles')
      .select('id, nombre, email, activo').ilike('email', email).maybeSingle();
    if (!perfil || perfil.activo === false) return json({ ok: true, mensaje: MENSAJE_OK });

    // ---- token de recuperación (no manda correo; el correo lo mandamos nosotros)
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'recovery', email: perfil.email ?? email });
    const token = link?.properties?.hashed_token;
    if (linkErr || !token) {
      console.error('[recuperar-clave] generateLink', linkErr?.message);
      return json({ ok: true, mensaje: MENSAJE_OK });
    }
    const enlace = `${appUrl}/?recuperar=${encodeURIComponent(token)}`;

    await graphSend(perfil.email ?? email, 'Recupera tu contraseña · SSI-RRHH', correoRecuperacion(perfil.nombre ?? '', perfil.email ?? email, enlace));
    return json({ ok: true, mensaje: MENSAJE_OK });
  } catch (e) {
    console.error('[recuperar-clave]', e);
    return json({ error: (e as Error).message ?? 'Error interno.' }, 500);
  }
});

// ---------- Correo (diseño de los exportables, ver _shared/correo-sgc.js) ----------
type Correo = { html: string; iconos: string[] };
function correoRecuperacion(nombre: string, email: string, enlace: string): Correo {
  const titulo = 'Recuperación de contraseña';
  return correoSgc({
    encabezado: { titulo, codigo: 'SSI-RRHH', fecha: fechaDMY(new Date()), revision: '00' },
    pie: { codigo: 'SSI-RRHH', nombre: titulo },
    saludo: nombre ? `Hola ${nombre}:` : 'Hola:',
    mensaje: `<p style="margin:0">Recibimos una solicitud para cambiar la contraseña de tu cuenta en <b>SSI-RRHH</b>. Aprieta el botón y escribe tu nueva contraseña.</p>
      <p style="margin:10px 0 0">El enlace vence en <b>${VENCE_TEXTO}</b> y sirve una sola vez. Si no lo pediste tú, ignora este correo: tu contraseña actual sigue funcionando.</p>`,
    resumen: [['Cuenta', email], ['Vence en', VENCE_TEXTO]],
    boton: { url: enlace, texto: 'Crear nueva contraseña' },
    nota: `Si el botón no funciona, copia este enlace en el navegador: <span style="word-break:break-all">${escCorreo(enlace)}</span><br>Correo automático del sistema SSI-RRHH: no hace falta responderlo.`,
  });
}

// ---------- Microsoft Graph (mismo patrón que notificar) ----------
const inline = (nombre: string, b64: string, cid: string) => ({
  '@odata.type': '#microsoft.graph.fileAttachment', name: nombre, contentType: 'image/png', contentBytes: b64, contentId: cid, isInline: true,
});
async function graphSend(to: string, subject: string, correo: Correo) {
  const tenant = Deno.env.get('GRAPH_TENANT_ID')!;
  const tokRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GRAPH_CLIENT_ID')!,
      client_secret: Deno.env.get('GRAPH_CLIENT_SECRET')!,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const tok = await tokRes.json();
  if (!tok.access_token) throw new Error('Graph auth: ' + (tok.error_description ?? 'sin token'));
  const sender = Deno.env.get('GRAPH_FROM_ADDRESS')!;
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: correo.html },
        toRecipients: [{ emailAddress: { address: to } }],
        attachments: [
          inline('metalium-logo.png', LOGO_METALIUM_PNG_B64, 'metalium-logo'),
          ...correo.iconos.filter((k) => ICONOS_CORREO_PNG_B64[k]).map((k) => inline(`ico-${k}.png`, ICONOS_CORREO_PNG_B64[k], `ico-${k}`)),
        ],
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) throw new Error('Graph sendMail: ' + (await res.text()));
}
