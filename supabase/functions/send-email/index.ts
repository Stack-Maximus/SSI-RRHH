// supabase/functions/send-email/index.ts
//
// Recibe { to, titulo, mensaje, detalle_html } y envía un correo real vía
// Microsoft Graph. Si detalle_html viene con contenido, se usa como cuerpo
// del correo (con todo el contexto); si no, se usa el mensaje corto.
//
// Parámetros opcionales, todos con el comportamiento anterior por defecto:
//   pie          reemplaza el pie de "notificación automática". Es lo que
//                necesita una carta formal a un proveedor: decirle "no responder
//                este correo" en una carta que lo invita a presentar
//                antecedentes es una contradicción.
//   responder_a  agrega Reply-To, para que la respuesta llegue a una persona.
//   guardar      si es true, el correo queda en Elementos enviados del buzón
//                (para las cartas conviene; para los avisos automáticos, no).
//   ancho        ancho máximo del cuerpo en px. Por defecto 520, que sirve para
//                un aviso corto pero aprieta una carta de varios párrafos.
//
// Deploy: supabase functions deploy send-email --no-verify-jwt
// Secrets:
//   supabase secrets set MS_TENANT_ID=xxxxxxxx
//   supabase secrets set MS_CLIENT_ID=xxxxxxxx
//   supabase secrets set MS_CLIENT_SECRET=xxxxxxxx
//   supabase secrets set FROM_MAILBOX=notificaciones@metalium.cl

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TENANT_ID = Deno.env.get("MS_TENANT_ID");
const CLIENT_ID = Deno.env.get("MS_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("MS_CLIENT_SECRET");
const FROM_MAILBOX = Deno.env.get("FROM_MAILBOX") ?? "notificaciones@metalium.cl";

async function obtenerToken(): Promise<string> {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID ?? "",
    client_secret: CLIENT_SECRET ?? "",
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const datos = await res.json();
  if (!res.ok) {
    throw new Error(`Error al obtener token de Azure AD: ${JSON.stringify(datos)}`);
  }
  return datos.access_token;
}

serve(async (req) => {
  try {
    const { to, titulo, mensaje, detalle_html, pie, responder_a, guardar, ancho } = await req.json();

    if (!to || !titulo) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos: to, titulo" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Faltan credenciales de Microsoft Graph (MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET)" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = await obtenerToken();

    const cuerpo = detalle_html && detalle_html.trim()
      ? detalle_html
      : `<p style="color:#333; font-size:14px; line-height:1.5;">${mensaje ?? ""}</p>`;

    const pieTexto =
      typeof pie === "string" && pie.trim()
        ? pie
        : "Notificación automática del Sistema de Gestión de Calidad. No responder este correo.";

    const anchoMax = Number.isFinite(Number(ancho)) && Number(ancho) > 0 ? Number(ancho) : 520;

    const mensajeGraph: Record<string, unknown> = {
      message: {
        subject: titulo,
        body: {
          contentType: "HTML",
          content: `
            <div style="font-family: -apple-system, sans-serif; padding: 24px; max-width: ${anchoMax}px;">
              <p style="color:#009BDB; font-weight:700; letter-spacing:2px; font-size:13px; margin:0 0 16px;">METALIUM · SGC</p>
              <h2 style="color:#001A5A; margin:0 0 16px;">${titulo}</h2>
              <div style="color:#333; font-size:14px; line-height:1.5;">${cuerpo}</div>
              <p style="color:#999; font-size:11px; margin-top:32px;">${pieTexto}</p>
            </div>
          `,
        },
        toRecipients: [{ emailAddress: { address: to } }],
        ...(typeof responder_a === "string" && responder_a.trim()
          ? { replyTo: [{ emailAddress: { address: responder_a.trim() } }] }
          : {}),
      },
      saveToSentItems: guardar === true ? "true" : "false",
    };

    const respuesta = await fetch(`https://graph.microsoft.com/v1.0/users/${FROM_MAILBOX}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mensajeGraph),
    });

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text();
      console.error("[send-email] Error de Graph:", errorTexto);
      return new Response(JSON.stringify({ error: errorTexto }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-email] Error inesperado:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
