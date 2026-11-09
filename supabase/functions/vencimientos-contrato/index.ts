// =====================================================================
//  Edge Function: vencimientos-contrato
//  Alerta por correo de contratos próximos a vencer
//  (`trabajadores.fecha_termino_contrato`). Corre sola UNA VEZ AL DÍA: la
//  llama pg_cron desde la base (migración 0027_alertas_vencimiento_contrato.sql),
//  no el frontend.
//
//  Qué avisa (nov. 2026): cada contrato se avisa una vez por tramo:
//    - tramo 30: cuando le quedan 30 días o menos (y más de 15)
//    - tramo 15: cuando le quedan 15 días o menos (hasta el mismo día)
//  Lo ya avisado queda en public.avisos_vencimiento_contrato (trabajador,
//  fecha de término, tramo), así que nunca se repite, y si un día no corre
//  se pone al día al siguiente. La primera vez avisa todos los contratos que
//  ya estaban dentro de los 30 días. Si la fecha de término cambia (una
//  renovación), los avisos empiezan de nuevo para la fecha nueva.
//
//  A quién, en UN SOLO CORREO DIARIO por persona (resumen con tabla):
//    - Todo el equipo de RRHH (rol 'rrhh', activos): todos los contratos.
//    - El Administrador de obra de cada centro (centros_costo.admin_obra_id):
//      solo los de su(s) obra(s).
//  No toca `contrato_indefinido = true`: esos no vencen.
//
//  Seguridad: no la puede llamar cualquiera. Exige el encabezado
//  x-alerta-secreto, que se compara con la clave guardada en Vault por la
//  migración 0027 (función alertas_vencimiento_secreto_ok). El cron la manda
//  sola; por eso en el Dashboard va con "Verify JWT" desactivado.
//
//  Cuerpo opcional (para probar desde el SQL Editor con
//  public.disparar_alertas_vencimiento('{...}')):
//    { "simular": true }             -> no envía nada: devuelve qué avisaría y a quién
//    { "prueba_a": "x@metalium.cl" } -> manda a esa dirección el resumen que hoy
//                                       recibiría RRHH (o, si no hay nada que avisar,
//                                       los próximos 5 contratos por vencer), marcado
//                                       [PRUEBA]; no registra nada.
//
//  Diseño del correo: el de los exportables (SGC), ver _shared/correo-sgc.js.
//  Como importa _shared/, para el Dashboard se pega
//  supabase/dashboard/vencimientos-contrato/index.ts.
//
//  Secrets: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_FROM_ADDRESS
//           (opcional) APP_URL -> botón del correo
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { correoSgc, escCorreo } from '../_shared/correo-sgc.js';
import { fechaDMY } from '../_shared/sgc-documentos.js';
import { DOCUMENTO_CODIGOS } from '../_shared/solicitud-detalle.ts';
import { LOGO_METALIUM_PNG_B64 } from '../_shared/logo.ts';
import { ICONOS_CORREO_PNG_B64 } from '../_shared/iconos-correo.ts';

const VENTANA_DIAS = 30;   // se avisa desde 30 días antes...
const TRAMO_URGENTE = 15;  // ...y de nuevo desde 15 días antes
const MAX_PRUEBA = 5;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

// Fecha de hoy en Chile como "AAAA-MM-DD" (la función corre en UTC)
const hoyChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const sumarDias = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(hasta + 'T00:00:00Z') - Date.parse(desde + 'T00:00:00Z')) / 86400000);
/** "2026-11-30" -> "30-11-2026" */
const dmy = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('-') : (iso || '—'));

type Fila = { t: any; dias: number; tramo: number; centro: any };
const aFila = (hoy: string, cmap: Map<string, any>) => (t: any): Fila => {
  const dias = diasEntre(hoy, t.fecha_termino_contrato);
  return { t, dias, tramo: dias <= TRAMO_URGENTE ? TRAMO_URGENTE : VENTANA_DIAS, centro: cmap.get(t.centro_costo_id) };
};
const porFecha = (a: Fila, b: Fila) => a.dias - b.dias || String(a.t.nombre).localeCompare(String(b.t.nombre));

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const appUrl = (Deno.env.get('APP_URL') || '').trim().replace(/\/+$/, '');

    // ---- solo el cron (o quien tenga la clave guardada en Vault) puede llamarla
    const secreto = req.headers.get('x-alerta-secreto') ?? '';
    const { data: ok, error: errOk } = await admin.rpc('alertas_vencimiento_secreto_ok', { p_secreto: secreto });
    if (errOk) {
      return json({ error: 'No se pudo validar la llamada. ¿Se corrió la migración 0027_alertas_vencimiento_contrato.sql?', detalle: errOk.message }, 500);
    }
    if (ok !== true) return json({ error: 'No autorizado.' }, 401);

    let opciones: { simular?: boolean; prueba_a?: string } = {};
    try { opciones = (await req.json()) ?? {}; } catch { /* sin cuerpo */ }
    const simular = opciones.simular === true;
    const pruebaA = typeof opciones.prueba_a === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(opciones.prueba_a.trim())
      ? opciones.prueba_a.trim() : '';

    const hoy = hoyChile();
    const limite = sumarDias(hoy, VENTANA_DIAS);
    const CAMPOS = 'id, nombre, cargo, centro_costo_id, fecha_termino_contrato';

    // ---- contratos que vencen entre hoy y hoy + 30 días
    const { data: trabajadores, error: errT } = await admin
      .from('trabajadores').select(CAMPOS)
      .eq('activo', true).eq('contrato_indefinido', false)
      .gte('fecha_termino_contrato', hoy).lte('fecha_termino_contrato', limite);
    if (errT) throw errT;

    // ---- lo ya avisado
    const ids = (trabajadores ?? []).map((t) => t.id);
    const { data: avisados, error: errA } = ids.length
      ? await admin.from('avisos_vencimiento_contrato').select('trabajador_id, fecha_termino, tramo').in('trabajador_id', ids)
      : { data: [] as any[], error: null };
    if (errA) throw errA;
    const ya = new Set((avisados ?? []).map((a) => `${a.trabajador_id}|${a.fecha_termino}|${a.tramo}`));

    // ---- centros
    const centroIds = [...new Set((trabajadores ?? []).map((t) => t.centro_costo_id).filter(Boolean))];
    const { data: centros } = centroIds.length
      ? await admin.from('centros_costo').select('id, codigo, nombre, admin_obra_id').in('id', centroIds)
      : { data: [] as any[] };
    const cmap = new Map((centros ?? []).map((c) => [c.id, c]));

    const filas: Fila[] = (trabajadores ?? []).map(aFila(hoy, cmap))
      .filter((f) => !ya.has(`${f.t.id}|${f.t.fecha_termino_contrato}|${f.tramo}`))
      .sort(porFecha);

    // ---- prueba: el resumen de RRHH a una sola dirección, sin registrar nada
    if (pruebaA) {
      let muestra = filas;
      let nota = '';
      if (!muestra.length) {
        const { data: proximos } = await admin
          .from('trabajadores').select(CAMPOS)
          .eq('activo', true).eq('contrato_indefinido', false).gte('fecha_termino_contrato', hoy)
          .order('fecha_termino_contrato', { ascending: true }).limit(MAX_PRUEBA);
        const cIds = [...new Set((proximos ?? []).map((t) => t.centro_costo_id).filter(Boolean))];
        const { data: cs } = cIds.length
          ? await admin.from('centros_costo').select('id, codigo, nombre').in('id', cIds) : { data: [] as any[] };
        muestra = (proximos ?? []).map(aFila(hoy, new Map((cs ?? []).map((c) => [c.id, c])))).sort(porFecha);
        nota = 'Prueba: hoy no hay contratos nuevos por avisar, así que se muestran los próximos contratos por vencer.';
      }
      if (!muestra.length) return json({ ok: true, prueba: true, enviados: 0, motivo: 'no hay contratos con fecha de término desde hoy' });
      const { asunto, correo } = correoResumen('', muestra, 'rrhh', appUrl, nota);
      await graphSend(await graphToken(), pruebaA, `[PRUEBA] ${asunto}`, correo);
      return json({ ok: true, prueba: true, enviados: 1, a: pruebaA, contratos: muestra.length });
    }

    if (!filas.length) return json({ ok: true, hoy, enviados: 0, motivo: 'no hay contratos nuevos por avisar (30 o 15 días)' });

    // ---- destinatarios: RRHH ve todo; cada adm. de obra, solo lo de su obra
    const { data: rrhh } = await admin.from('perfiles').select('id, nombre, email').eq('rol', 'rrhh').eq('activo', true);
    const adminObraIds = [...new Set(filas.map((f) => f.centro?.admin_obra_id).filter(Boolean))];
    const { data: adminsObra } = adminObraIds.length
      ? await admin.from('perfiles').select('id, nombre, email, activo').in('id', adminObraIds)
      : { data: [] as any[] };
    const adminObraMap = new Map((adminsObra ?? []).map((p) => [p.id, p]));

    const dest = new Map<string, { nombre: string; rol: 'rrhh' | 'obra'; filas: Fila[] }>();
    for (const r of rrhh ?? []) if (r.email) dest.set(r.email, { nombre: r.nombre ?? '', rol: 'rrhh', filas: [...filas] });
    for (const f of filas) {
      const ao = f.centro?.admin_obra_id ? adminObraMap.get(f.centro.admin_obra_id) : null;
      if (!ao?.email || ao.activo === false) continue;
      const d = dest.get(ao.email);
      if (d?.rol === 'rrhh') continue; // ya lo recibe completo
      if (d) d.filas.push(f); else dest.set(ao.email, { nombre: ao.nombre ?? '', rol: 'obra', filas: [f] });
    }

    if (simular) {
      return json({
        ok: true, simulado: true, hoy,
        contratos: filas.map((f) => ({ trabajador: f.t.nombre, vence: f.t.fecha_termino_contrato, dias: f.dias, tramo: f.tramo, obra: f.centro?.codigo ?? null })),
        destinatarios: [...dest.values()].map((d) => ({ nombre: d.nombre, rol: d.rol, contratos: d.filas.length })),
      });
    }

    // ---- envío: un correo por persona; se registra lo que le llegó a alguien
    const token = await graphToken();
    const avisadosHoy = new Set<string>();
    const errores: string[] = [];
    let enviados = 0;
    for (const [email, d] of dest) {
      const { asunto, correo } = correoResumen(d.nombre, d.filas, d.rol, appUrl);
      try {
        await graphSend(token, email, asunto, correo);
        enviados++;
        d.filas.forEach((f) => avisadosHoy.add(f.t.id));
      } catch (e) {
        errores.push(`${d.nombre || email}: ${(e as Error).message}`);
      }
    }
    const registros = filas.filter((f) => avisadosHoy.has(f.t.id))
      .map((f) => ({ trabajador_id: f.t.id, fecha_termino: f.t.fecha_termino_contrato, tramo: f.tramo }));
    if (registros.length) {
      const { error: errR } = await admin.from('avisos_vencimiento_contrato')
        .upsert(registros, { onConflict: 'trabajador_id,fecha_termino,tramo', ignoreDuplicates: true });
      if (errR) errores.push('No se pudo registrar lo avisado: ' + errR.message);
    }
    const sinDestinatario = filas.filter((f) => !avisadosHoy.has(f.t.id)).map((f) => f.t.nombre);

    return json({ ok: errores.length === 0, hoy, enviados, contratos: registros.length, sin_destinatario: sinDestinatario, errores });
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

// El logo y los íconos van como adjuntos inline (cid:...): Outlook bloquea
// las imágenes en base64 pegadas en el HTML.
type Correo = { html: string; iconos: string[] };
const inline = (nombre: string, b64: string, cid: string) => ({
  '@odata.type': '#microsoft.graph.fileAttachment', name: nombre, contentType: 'image/png', contentBytes: b64, contentId: cid, isInline: true,
});
async function graphSend(token: string, to: string, subject: string, correo: Correo) {
  const sender = Deno.env.get('GRAPH_FROM_ADDRESS')!;
  const attachments = [
    inline('metalium-logo.png', LOGO_METALIUM_PNG_B64, 'metalium-logo'),
    ...correo.iconos.filter((k) => ICONOS_CORREO_PNG_B64[k]).map((k) => inline(`ico-${k}.png`, ICONOS_CORREO_PNG_B64[k], `ico-${k}`)),
  ];
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: correo.html },
        toRecipients: [{ emailAddress: { address: to } }],
        attachments,
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) throw new Error('Graph sendMail: ' + (await res.text()));
}

// ---------- Correo: resumen diario con el diseño de los exportables (SGC) ----------
const ROJO = '#b91c1c', ROJO_BG = '#fbe9e9', AMBAR = '#92400e', AMBAR_BG = '#fef3c7';
const quedanTxt = (dias: number) => (dias <= 0 ? 'Vence hoy' : `${dias} día${dias === 1 ? '' : 's'}`);
/** "Obra 28 · METRO – REVALORIZACION UNIVERSIDAD DE…" (sin comillas, cortado en una palabra) */
const obraTxt = (c: any) => {
  if (!c) return '—';
  const n = String(c.nombre ?? '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  let corto = n;
  if (n.length > 45) {
    const cut = n.slice(0, 45);
    corto = (cut.lastIndexOf(' ') > 20 ? cut.slice(0, cut.lastIndexOf(' ')) : cut).replace(/[\s.,;:–-]+$/, '') + '…';
  }
  return [c.codigo ? `Obra ${c.codigo}` : '', corto].filter(Boolean).join(' · ');
};

function correoResumen(nombre: string, filas: Fila[], rol: 'rrhh' | 'obra', appUrl: string, notaPrueba = ''): { asunto: string; correo: Correo } {
  const n = filas.length;
  const urgentes = filas.filter((f) => f.dias <= TRAMO_URGENTE).length;
  const codigo = DOCUMENTO_CODIGOS.renovacion?.codigo ?? 'RRH-FOR-CON-007';
  const titulo = 'Contratos por vencer';
  const plural = n === 1 ? 'contrato' : 'contratos';
  const asunto = `Contratos por vencer: ${n} trabajador${n === 1 ? '' : 'es'}${urgentes ? ` (${urgentes} en ${TRAMO_URGENTE} días o menos)` : ''}`;
  const deTuObra = rol === 'obra' ? ' de tu obra' : '';
  const mensaje = (notaPrueba ? `<p style="margin:0 0 10px;color:${AMBAR}"><b>${escCorreo(notaPrueba)}</b></p>` : '')
    + `<p style="margin:0">Hay <b>${n} ${plural}${deTuObra}</b> que vence${n === 1 ? '' : 'n'} en los próximos ${VENTANA_DIAS} días`
    + (urgentes ? `; <b style="color:${ROJO}">${urgentes} en ${TRAMO_URGENTE} días o menos</b>.` : '.') + '</p>'
    + `<p style="margin:10px 0 0">Si corresponde renovar, crea una solicitud de <b>Renovación</b> en el sistema con la anticipación necesaria.</p>`;
  const boton = !appUrl ? null : rol === 'obra'
    ? { url: `${appUrl}/?ir=nueva-solicitud`, texto: 'Crear solicitud de renovación' }
    : { url: `${appUrl}/`, texto: 'Ir a SSI-RRHH' };
  const correo = correoSgc({
    encabezado: { titulo, codigo, fecha: fechaDMY(new Date()), revision: '00' },
    pie: { codigo, nombre: titulo },
    saludo: nombre ? `Hola ${nombre}:` : 'Hola:',
    mensaje,
    resumen: [
      ['Contratos', String(n)],
      [`En ${TRAMO_URGENTE} días o menos`, String(urgentes), urgentes ? ROJO : ''],
      ['Próximo vencimiento', filas[0] ? dmy(filas[0].t.fecha_termino_contrato) : '—'],
    ],
    boton,
    secciones: [{ titulo: 'Contratos por vencer', tabla: {
      columnas: [
        { titulo: 'Trabajador', icono: 'hard-hat', estilo: 'fuerte' },
        { titulo: 'Cargo', icono: 'briefcase', estilo: 'normal', movil: false },
        { titulo: 'Obra', icono: 'building-2', estilo: 'normal', movil: false },
        { titulo: 'Vence', icono: 'calendar-x', alinear: 'centro', estilo: 'normal' },
        { titulo: 'Quedan', icono: 'timer', estilo: 'pildora' },
      ],
      filas: filas.map((f) => [
        f.t.nombre,
        f.t.cargo || '—',
        obraTxt(f.centro),
        dmy(f.t.fecha_termino_contrato),
        f.dias <= TRAMO_URGENTE
          ? { texto: quedanTxt(f.dias), fondo: ROJO_BG, color: ROJO }
          : { texto: quedanTxt(f.dias), fondo: AMBAR_BG, color: AMBAR },
      ]),
    } }],
    nota: `Alerta automática diaria de contratos por vencer: cada contrato se avisa a los ${VENTANA_DIAS} y a los ${TRAMO_URGENTE} días. Correo del sistema SSI-RRHH: no hace falta responderlo.`,
  });
  return { asunto, correo };
}
