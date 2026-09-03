// supabase/functions/crear-usuario/index.ts
//
// Crea una cuenta de Auth nueva + su perfil, y devuelve un link de
// invitación para que la persona elija su propia contraseña — nunca se
// genera ni se comunica una contraseña temporal.
//
// Solo puede llamarla alguien con es_admin=true o rol='rrhh' en el módulo
// 'personal' — se verifica adentro, no basta con tener la URL.
//
// Deploy: supabase functions deploy crear-usuario
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen disponibles solos,
// Supabase los inyecta automáticamente en toda Edge Function — no hace
// falta configurarlos como secreto.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const jwt = authHeader.replace("Bearer ", "");

    const { data: quienLlama, error: errUsuario } = await admin.auth.getUser(jwt);
    if (errUsuario || !quienLlama?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verificación de permiso: solo admin global o rrhh del módulo personal
    const { data: perfilQuienLlama } = await admin.from("perfiles").select("es_admin").eq("id", quienLlama.user.id).single();
    const { data: accesoRRHH } = await admin
      .from("modulo_accesos")
      .select("rol")
      .eq("usuario_id", quienLlama.user.id)
      .eq("modulo", "personal")
      .eq("rol", "rrhh")
      .maybeSingle();

    if (!perfilQuienLlama?.es_admin && !accesoRRHH) {
      return new Response(JSON.stringify({ error: "No tienes permiso para crear usuarios" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { correo, nombre, cargo } = await req.json();
    if (!correo || !nombre) {
      return new Response(JSON.stringify({ error: "Faltan campos: correo, nombre" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Contraseña aleatoria que nunca se comunica — la persona elige la suya
    // propia al abrir el link de invitación.
    const passwordAleatoria = crypto.randomUUID() + crypto.randomUUID();

    const { data: nuevoUsuario, error: errCrear } = await admin.auth.admin.createUser({
      email: correo,
      password: passwordAleatoria,
      email_confirm: true,
      user_metadata: { nombre },
    });

    if (errCrear) {
      return new Response(JSON.stringify({ error: errCrear.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // El trigger on_auth_user_created ya creó el perfil solo (con nombre =
    // correo por defecto) — lo corregimos con los datos reales.
    await admin.from("perfiles").update({ nombre, cargo: cargo || null }).eq("id", nuevoUsuario.user.id);

    // Genera el link de invitación para que la persona defina su contraseña
    const { data: linkData, error: errLink } = await admin.auth.admin.generateLink({
      type: "invite",
      email: correo,
    });

    if (errLink) {
      return new Response(JSON.stringify({ ok: true, id: nuevoUsuario.user.id, link: null, avisoLink: errLink.message }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: nuevoUsuario.user.id, link: linkData.properties.action_link }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
