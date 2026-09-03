// =====================================================================
//  Edge Function: maestro-pdf
//  Genera y devuelve el PDF del "Maestro de solicitudes" (resumen de
//  TODAS las solicitudes, los 6 tipos), con el encabezado corporativo
//  Metalium y el código RRH-FOR-SOL-001. Solo rrhh/admin.
//
//  Uso:  GET/POST  .../functions/v1/maestro-pdf
//        Headers:  Authorization: Bearer <access_token del usuario>
//
//  Deploy: supabase functions deploy maestro-pdf
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { construirMaestroPdf, FilaMaestro } from '../_shared/pdf-maestro.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function dur(ms: number | null) {
  if (ms == null || isNaN(ms)) return '';
  const h = ms / 3600000;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
  if (h < 48) return (Math.round(h * 10) / 10) + ' h';
  return (Math.round((h / 24) * 10) / 10) + ' d';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
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

    const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single();
    if (!perfil || !['rrhh', 'admin'].includes(perfil.rol)) {
      return new Response(JSON.stringify({ error: 'Sin permisos para el maestro de solicitudes.' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const [{ data: sols }, { data: centros }, { data: trabs }] = await Promise.all([
      admin.from('solicitudes')
        .select('id, codigo, folio, tipo, estado, created_at, solicitante_id, trabajador_id, centro_origen_id')
        .order('created_at', { ascending: false }),
      admin.from('centros_costo').select('id, nombre'),
      admin.from('trabajadores').select('id, nombre'),
    ]);
    const cmap = new Map((centros ?? []).map((c) => [c.id, c.nombre]));
    const tmap = new Map((trabs ?? []).map((t) => [t.id, t.nombre]));

    const solIds = (sols ?? []).map((s) => s.id);
    const { data: aprs } = solIds.length
      ? await admin.from('aprobaciones').select('solicitud_id, decision, tiempo_respuesta, asignado_at, decidido_at').in('solicitud_id', solIds)
      : { data: [] as any[] };
    const aprsPorSol = new Map<string, any[]>();
    (aprs ?? []).forEach((a) => {
      if (!aprsPorSol.has(a.solicitud_id)) aprsPorSol.set(a.solicitud_id, []);
      aprsPorSol.get(a.solicitud_id)!.push(a);
    });

    const solicitanteIds = [...new Set((sols ?? []).map((s) => s.solicitante_id))];
    const { data: pers } = solicitanteIds.length
      ? await admin.from('perfiles').select('id, nombre').in('id', solicitanteIds)
      : { data: [] as any[] };
    const pmap = new Map((pers ?? []).map((p) => [p.id, p.nombre]));

    const filas: FilaMaestro[] = (sols ?? []).map((s) => {
      const propias = aprsPorSol.get(s.id) ?? [];
      const aprobadas = propias.filter((a) => a.decision === 'aprobado').length;
      const totalMs = propias.reduce((acc, a) => {
        const ms = a.tiempo_respuesta != null
          ? a.tiempo_respuesta * 1000
          : (a.decidido_at && a.asignado_at ? new Date(a.decidido_at).getTime() - new Date(a.asignado_at).getTime() : 0);
        return acc + (ms || 0);
      }, 0);
      return {
        folio: s.folio,
        codigo: s.codigo,
        tipo: s.tipo,
        estado: s.estado,
        solicitante: pmap.get(s.solicitante_id) ?? '—',
        trabajador: s.trabajador_id ? (tmap.get(s.trabajador_id) ?? '—') : '',
        centro: cmap.get(s.centro_origen_id) ?? '',
        creada: (s.created_at ?? '').toString().slice(0, 10),
        aprobResumen: propias.length ? `${aprobadas}/${propias.length} · ${dur(totalMs) || '—'}` : 'Sin aprob.',
      };
    });

    const bytes = await construirMaestroPdf(filas);

    return new Response(bytes, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Maestro_Solicitudes_${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (e) {
    console.error('[maestro-pdf]', e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? 'Error interno.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
