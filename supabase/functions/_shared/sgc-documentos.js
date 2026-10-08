// =====================================================================
// sgc-documentos.js · Contenido de cada documento exportable, armado como
// "documento" para componerDocumento() de sgc-layout.js: qué fichas y qué
// tablas lleva el Comprobante de solicitud y el Maestro de solicitudes.
//
// JavaScript plano y sin imports de Deno a propósito: lo usan los PDF de
// las Edge Functions (pdf-comprobante.ts, pdf-maestro.ts) y también la
// vista "Comprobante" en pantalla (src/views/comprobante.js), para que la
// pantalla y el PDF muestren exactamente lo mismo. Las tablas de nombres
// (tipos, códigos) y el detalle por tipo se reciben como parámetro `ref`
// porque cada lado tiene su propia copia (config.js / solicitud-detalle.ts).
// =====================================================================

import { iconoParaCampo } from './sgc-layout.js';

// Fechas y horas siempre en hora de Chile: las Edge Functions corren en
// UTC, y sin esto un comprobante emitido de noche saldría con la fecha y
// las horas de aprobación corridas 3-4 horas.
const ZONA = 'America/Santiago';
function partes(d) {
  const o = {};
  for (const p of new Intl.DateTimeFormat('es-CL', {
    timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)) o[p.type] = p.value;
  return o;
}
export function fechaDMY(d, sep = '/') {
  const p = partes(d);
  return `${p.day}${sep}${p.month}${sep}${p.year}`;
}
export function fechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = partes(d);
  return `${p.day}-${p.month}-${p.year} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
export function duracion(ms) {
  if (ms == null || isNaN(ms)) return '—';
  const h = ms / 3600000;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
  if (h < 48) return (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h';
  return (Math.round((h / 24) * 10) / 10).toString().replace('.', ',') + ' d';
}
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');
const dmyIso = (iso, sep = '-') => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}${sep}${m[2]}${sep}${m[1]}` : (iso || '—');
};

// Campos de texto largo: van en una ficha a lo ancho de la tarjeta.
const LARGOS = /^(motivo|modificaciones|observaciones|hito de la obra|nueva condición)$/i;

/**
 * Comprobante de una solicitud.
 * data = { sol, cmap, aprs, pmap, trabNombre }
 * ref  = { tipoLabels, documentoCodigos, detalleLineas(sol) -> [[k, v]] }
 */
export function documentoComprobante(data, ref, hoy = new Date()) {
  const { sol, cmap, aprs, pmap, trabNombre } = data;
  const tipoTxt = ref.tipoLabels[sol.tipo] ?? sol.tipo;
  const codigo = ref.documentoCodigos[sol.tipo]?.codigo ?? '—';
  const nombre = `Comprobante de solicitud de ${tipoTxt}`;
  const fecha = fechaDMY(hoy);
  const identificacion = [
    { etiqueta: 'Registro', valor: `Solicitud de ${tipoTxt}`, icono: 'file-text' },
    { etiqueta: 'Fecha del documento', valor: fecha, icono: 'calendar-days' },
    { etiqueta: 'Código', valor: codigo, icono: 'barcode' },
    { etiqueta: 'Revisión', valor: '00', icono: 'settings' },
    { etiqueta: 'Folio', valor: sol.folio || '—', icono: 'hash' },
    { etiqueta: 'Estado', valor: capital(String(sol.estado ?? '')), icono: 'circle-check' },
    { etiqueta: 'N° de solicitud', valor: sol.codigo || '—', icono: 'clipboard-list' },
    { etiqueta: 'Fecha de creación', valor: fechaHora(sol.created_at), icono: 'calendar-clock' },
  ];

  const sol_p = pmap.get(sol.solicitante_id);
  const detalle = [
    { etiqueta: 'Solicitante', valor: sol_p?.nombre ? (sol_p.email ? `${sol_p.nombre} · ${sol_p.email}` : sol_p.nombre) : '—', icono: 'user' },
  ];
  if (sol.tipo === 'traslado') {
    detalle.push({ etiqueta: 'Trabajador', valor: trabNombre ?? '—', icono: 'hard-hat' });
    detalle.push({ etiqueta: 'Obra origen', valor: cmap.get(sol.centro_origen_id)?.nombre ?? '—', icono: 'building-2' });
    detalle.push({ etiqueta: 'Obra destino', valor: cmap.get(sol.centro_destino_id)?.nombre ?? '—', icono: 'building-2' });
  } else if (sol.tipo === 'ingreso') {
    detalle.push({ etiqueta: 'Centro de costo', valor: cmap.get(sol.centro_origen_id)?.nombre ?? '—', icono: 'building-2' });
  } else {
    detalle.push({ etiqueta: 'Trabajador', valor: trabNombre ?? '—', icono: 'hard-hat' });
    detalle.push({ etiqueta: 'Centro de costo', valor: cmap.get(sol.centro_origen_id)?.nombre ?? '—', icono: 'building-2' });
  }
  for (const [k, v] of ref.detalleLineas(sol)) {
    const valor = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dmyIso(String(v)) : v;
    detalle.push({ etiqueta: k, valor, icono: iconoParaCampo(k), ancho: LARGOS.test(k) ? 'completo' : undefined });
  }
  if (sol.motivo) detalle.push({ etiqueta: 'Motivo', valor: String(sol.motivo), icono: 'message-square', ancho: 'completo' });
  // ordena: primero las fichas cortas (de a dos), al final las de texto largo
  const cortas = detalle.filter((c) => c.ancho !== 'completo');
  const largas = detalle.filter((c) => c.ancho === 'completo');

  const filasAprob = aprs.slice().sort((a, b) => a.orden - b.orden).map((a) => {
    const ms = a.tiempo_respuesta != null
      ? a.tiempo_respuesta * 1000
      : (a.decidido_at && a.asignado_at ? new Date(a.decidido_at).getTime() - new Date(a.asignado_at).getTime() : null);
    return [
      String(a.orden),
      pmap.get(a.aprobador_id)?.nombre ?? '—',
      capital(String(a.decision ?? 'pendiente')),
      fechaHora(a.asignado_at),
      a.decidido_at ? fechaHora(a.decidido_at) : '—',
      duracion(ms),
    ];
  });

  return {
    encabezado: { titulo: nombre, codigo, fecha, revision: '00' },
    pie: { codigo, nombre },
    secciones: [
      { titulo: 'Identificación del registro', fichas: identificacion },
      { titulo: 'Detalle del registro', fichas: [...cortas, ...largas] },
      { titulo: 'Aprobaciones', tabla: {
        columnas: [
          { titulo: 'N°', w: 80, alinear: 'centro', estilo: 'numero' },
          { titulo: 'Aprobador', icono: 'user-check', w: 330, estilo: 'fuerte' },
          { titulo: 'Decisión', icono: 'circle-check', w: 190, estilo: 'pildora' },
          { titulo: 'Asignado', icono: 'calendar-clock', w: 235, alinear: 'centro', estilo: 'normal' },
          { titulo: 'Decidido', icono: 'calendar-days', w: 235, alinear: 'centro', estilo: 'normal' },
          { titulo: 'Tiempo de respuesta', icono: 'timer', w: 272, alinear: 'centro', estilo: 'normal' },
        ],
        filas: filasAprob,
        vacia: 'Sin aprobadores asignados.',
      } },
    ],
  };
}

/**
 * Maestro de solicitudes. filas = [{ folio, codigo, tipo, estado,
 * solicitante, trabajador, centro, creada (AAAA-MM-DD), aprobResumen }]
 * ref = { tipoLabels, codigoMaestro }
 */
export function documentoMaestro(filas, ref, hoy = new Date()) {
  const fecha = fechaDMY(hoy);
  const fechas = filas.map((f) => f.creada).filter(Boolean).sort();
  const periodo = fechas.length ? `${dmyIso(fechas[0], '/')} – ${dmyIso(fechas[fechas.length - 1], '/')}` : '—';
  const nombre = 'Maestro de solicitudes';
  const codigo = ref.codigoMaestro;
  return {
    encabezado: { titulo: nombre, codigo: codigo, fecha, revision: '00' },
    pie: { codigo: codigo, nombre },
    secciones: [
      { titulo: 'Identificación del registro', fichas: [
        { etiqueta: 'Registro', valor: nombre, icono: 'file-text' },
        { etiqueta: 'Fecha del documento', valor: fecha, icono: 'calendar-days' },
        { etiqueta: 'Código', valor: codigo, icono: 'barcode' },
        { etiqueta: 'Revisión', valor: '00', icono: 'settings' },
        { etiqueta: 'Total de registros', valor: `${filas.length} registro(s)`, icono: 'database' },
        { etiqueta: 'Período', valor: periodo, icono: 'calendar-range' },
      ] },
      { titulo: 'Detalle del registro', tabla: {
        tam: { sReg: 17, sBold: 17.5, sHead: 17.5, lh: 22.5 },
        columnas: [
          { titulo: 'N°', w: 50, alinear: 'centro', estilo: 'numero' },
          { titulo: 'Folio', icono: 'hash', w: 186, estilo: 'fuerte' },
          { titulo: 'Tipo', icono: 'tag', w: 160, estilo: 'normal' },
          { titulo: 'Estado', icono: 'circle-check', w: 140, estilo: 'pildora' },
          { titulo: 'Solicitante', icono: 'user', w: 162, estilo: 'normal' },
          { titulo: 'Trabajador', icono: 'hard-hat', w: 166, estilo: 'normal' },
          { titulo: 'Centro de costo', icono: 'building-2', w: 162, estilo: 'normal' },
          { titulo: 'Creada', icono: 'calendar-days', w: 128, alinear: 'centro', estilo: 'normal' },
          { titulo: 'Aprobaciones', icono: 'list-checks', w: 166, alinear: 'centro', estilo: 'normal' },
        ],
        filas: filas.map((f, i) => [
          String(i + 1),
          f.folio || f.codigo || '—',
          ref.tipoLabels[f.tipo] ?? f.tipo,
          capital(f.estado),
          f.solicitante || '—',
          f.trabajador || '—',
          f.centro || '—',
          dmyIso(f.creada),
          f.aprobResumen || '—',
        ]),
        vacia: 'No hay solicitudes registradas.',
      } },
    ],
  };
}

