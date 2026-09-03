// =====================================================================
//  Edge Function: comprobante-pdf
//  Genera y devuelve el PDF del comprobante de UNA solicitud (los 6
//  tipos), con el encabezado corporativo Metalium y el cuadro de
//  Código/Folio. La app lo llama con fetch() (no supabase.functions.invoke,
//  porque la respuesta es binaria) y dispara la descarga del archivo.
//
//  Uso:  GET/POST  .../functions/v1/comprobante-pdf?solicitud_id=<uuid>
//        Headers:  Authorization: Bearer <access_token del usuario>
//
//  Deploy:  supabase functions deploy comprobante-pdf
//  (usa las mismas variables SUPABASE_URL / SUPABASE_ANON_KEY /
//  SUPABASE_SERVICE_ROLE_KEY ya disponibles para toda Edge Function)
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { construirComprobantePdf } from '../_shared/pdf-comprobante.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = new URL(req.url);
    let solicitudId = url.searchParams.get('solicitud_id');
    if (!solicitudId && req.method === 'POST') {
      try { solicitudId = (await req.json())?.solicitud_id ?? null; } catch { /* sin body */ }
    }
    if (!solicitudId) {
      return new Response(JSON.stringify({ error: 'Falta solicitud_id.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: sol, error: solErr } = await admin
      .from('solicitudes')
      .select('id, codigo, folio, tipo, estado, solicitante_id, trabajador_id, centro_origen_id, centro_destino_id, motivo, detalle, created_at')
      .eq('id', solicitudId).single();
    if (solErr || !sol) {
      return new Response(JSON.stringify({ error: 'Solicitud no encontrada.' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const [{ data: centros }, { data: aprs }] = await Promise.all([
      admin.from('centros_costo').select('id, codigo, nombre'),
      admin.from('aprobaciones').select('aprobador_id, decision, decidido_at, asignado_at, orden, tiempo_respuesta').eq('solicitud_id', solicitudId).order('orden'),
    ]);

    // Autorización: solo puede descargar el comprobante quien la creó, quien
    // figura como uno de sus aprobadores, o rrhh/admin (mismo criterio que
    // ya aplican las policies RLS de `solicitudes`/`aprobaciones` para leerlas).
    const esAprobador = (aprs ?? []).some((a) => a.aprobador_id === user.id);
    if (sol.solicitante_id !== user.id && !esAprobador) {
      const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single();
      if (!perfil || !['rrhh', 'admin'].includes(perfil.rol)) {
        return new Response(JSON.stringify({ error: 'No tienes permiso para ver este comprobante.' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }
    const cmap = new Map((centros ?? []).map((c) => [c.id, c]));
    const aprIds = (aprs ?? []).map((a) => a.aprobador_id);
    const { data: pers } = await admin.from('perfiles').select('id, nombre, email').in('id', [sol.solicitante_id, ...aprIds]);
    const pmap = new Map((pers ?? []).map((p) => [p.id, p]));
    let trabNombre: string | null = null;
    if (sol.trabajador_id) {
      const { data: t } = await admin.from('trabajadores').select('nombre').eq('id', sol.trabajador_id).single();
      trabNombre = t?.nombre ?? null;
    }

    const bytes = await construirComprobantePdf({ sol, cmap, aprs: aprs ?? [], pmap, trabNombre });

    return new Response(bytes, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(sol.folio || sol.codigo || 'comprobante')}.pdf"`,
      },
    });
  } catch (e) {
    console.error('[comprobante-pdf]', e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? 'Error interno.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
