// supabase/functions/create-user/index.ts
//
// Crea una cuenta de Auth nueva y genera un LINK DE INVITACIÓN — no pide
// ni transmite ninguna contraseña. La persona la define ella misma al
// abrir el link (que aterriza en src/views/completar-password.js).
// Solo puede llamarla alguien que ya sea admin (es_admin=true).
//
// A diferencia de send-email (que la llama Postgres, servidor a
// servidor), esta función SÍ la llama el navegador directamente — por
// eso necesita manejar CORS explícitamente, incluyendo la solicitud
// "preflight" (OPTIONS) que el navegador manda antes de la llamada real.
//
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY ya vienen
// disponibles automáticamente en toda Edge Function de Supabase.
//
// Deploy: supabase functions deploy create-user --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // El navegador manda esto ANTES de la llamada real, para preguntar si
  // tiene permiso — sin responder esto bien, la llamada real ni siquiera
  // se intenta.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No autorizado — falta el token de sesión." }, 401);
    }

    // Cliente "normal" con el token de quien llama, solo para saber quién es
    const supabaseComoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseComoUsuario.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Sesión inválida." }, 401);
    }

    // Cliente con privilegios de administrador
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: perfilLlamante } = await supabaseAdmin
      .from("perfiles")
      .select("es_admin")
      .eq("id", userData.user.id)
      .single();

    if (!perfilLlamante?.es_admin) {
      return jsonResponse({ error: "Solo un administrador puede crear usuarios nuevos." }, 403);
    }

    const { email, nombre, cargo, redirectTo } = await req.json();

    if (!email || !nombre) {
      return jsonResponse({ error: "Faltan correo o nombre." }, 400);
    }

    // Crea el usuario (sin contraseña) y genera su link de invitación —
    // no lo envía por correo Supabase, nos devuelve el link para que lo
    // mostremos/enviemos nosotros mismos.
    const { data: linkData, error: errLink } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (errLink) {
      return jsonResponse({ error: errLink.message }, 400);
    }

    const nuevoUsuarioId = linkData.user.id;
    const linkInvitacion = linkData.properties?.action_link || null;

    // El trigger on_auth_user_created ya crea el perfil solo (con el
    // correo como nombre por defecto) — lo actualizamos con los datos reales.
    await supabaseAdmin
      .from("perfiles")
      .update({ nombre: nombre || email, cargo: cargo || null })
      .eq("id", nuevoUsuarioId);

    // Reutiliza la infraestructura de notificaciones ya existente (la
    // misma que avisa de tickets, NC, evaluaciones) para mandar el link
    // por correo automáticamente — sin esto, el admin tendría que copiar
    // y enviar cada link a mano, incluso en una importación masiva.
    if (linkInvitacion) {
      await supabaseAdmin.from("notificaciones").insert({
        usuario_id: nuevoUsuarioId,
        modulo: null,
        titulo: "Bienvenido a SGC Metalium",
        mensaje: "Se creó tu cuenta. Revisa tu correo para definir tu contraseña y activarla.",
        detalle_html: `
          <p>Se creó tu cuenta en el Sistema de Gestión de Calidad de Metalium.</p>
          <p>Haz clic en el siguiente link para definir tu contraseña y activar tu acceso:</p>
          <p style="margin: 20px 0;">
            <a href="${linkInvitacion}" style="background:#009BDB; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
              Activar mi cuenta
            </a>
          </p>
          <p style="font-size:12px; color:#888;">Si el botón no funciona, copia y pega este link en tu navegador:<br>${linkInvitacion}</p>
        `,
      });
    }

    return jsonResponse({ ok: true, id: nuevoUsuarioId, link: linkInvitacion });
  } catch (error) {
    console.error("[create-user] Error inesperado:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
