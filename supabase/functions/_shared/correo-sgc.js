// =====================================================================
// correo-sgc.js · Correos con el diseño de los exportables (SGC "Concept 3")
//
// Arma el HTML de un correo con las mismas piezas que el PDF y la vista
// previa (sgc-documentos.js / sgc-layout.js): encabezado con logo, banda
// azul con el título y caja Código / Fecha / Revisión; barras de sección
// numeradas; fichas con íconos; tabla; pie METALIUM | código | nombre.
// Encima va un mensaje (saludo, texto, resumen y botón).
//
// Solo tablas y estilos en línea, porque Outlook de escritorio (el cliente
// principal: los correos salen por Microsoft Graph desde el buzón Metalium)
// no entiende SVG, divs con alto/ancho ni el atajo CSS "font:". Lo que el
// correo no puede dibujar (bordes en diagonal; los degradados y las
// esquinas redondeadas en Outlook de escritorio) queda como bloques rectos
// del mismo color. En el celular las columnas se apilan (<style> con
// media query: Gmail, Apple Mail y Outlook móvil lo respetan).
//
// Los íconos van como imágenes PNG incrustadas (cid:ico-<clave>, ver
// iconos-correo.ts); la función devuelve qué claves usó para adjuntar
// solo esas.
// =====================================================================

import { PAL } from './sgc-layout.js';

const F_TIT = "'Montserrat','Segoe UI',Arial,Helvetica,sans-serif";
const F_TXT = "'Fira Sans','Segoe UI',Arial,Helvetica,sans-serif";
const DEGRADADO = 'linear-gradient(100deg,#003174 0%,#00357B 72%,#0058A6 87%,#0A7FC3 100%)';
const AZUL_BANDA = '#00357B';

/** Tipografía en propiedades sueltas (Outlook ignora el atajo "font:"). */
const fx = (peso, px, familia = F_TXT, lh = null) =>
  `font-family:${familia};font-size:${px}px;font-weight:${peso};${lh ? `line-height:${lh};` : ''}`;

export const escCorreo = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const esc = escCorreo;

/**
 * @param {object} p
 *   encabezado: { titulo, codigo, fecha, revision }
 *   pie:        { codigo, nombre }
 *   secciones:  [{ titulo, fichas:[{etiqueta, valor, icono, ancho:'completo'?}] }
 *              | { titulo, tabla:{ columnas:[{titulo, icono, alinear, estilo}], filas:[[...]], vacia } }]
 *               (en una columna 'pildora' la celda puede ser { texto, fondo, color })
 *   saludo (texto), mensaje (HTML ya escapado),
 *   resumen: [[etiqueta, valor, color?], ...]  (fila de datos clave bajo el mensaje)
 *   boton: { url, texto } | null,  nota (HTML, opcional)
 * @param {object} o  icono: (clave) => src (clave = "user", "file-text-osc", "timer-bl"...);
 *                    logo: src del logo. Por defecto cid:ico-<clave> y cid:metalium-logo.
 * @returns {{ html: string, iconos: string[] }}  iconos = claves usadas, para adjuntar solo esas
 */
export function correoSgc(p, o = {}) {
  const usados = new Set();
  // variante: '' = azul (fichas), 'osc' = azul oscuro (caja Código/Fecha/Revisión),
  // 'bl' = blanco (encabezado de tabla), igual que en el PDF
  const ico = (nombre, variante = '', px = 20) => {
    if (!nombre) return '';
    const clave = nombre + (variante ? '-' + variante : '');
    usados.add(clave);
    const src = o.icono ? o.icono(clave) : `cid:ico-${clave}`;
    return `<img src="${src}" width="${px}" height="${px}" alt="" style="display:block;width:${px}px;height:${px}px;border:0">`;
  };
  const logo = o.logo || 'cid:metalium-logo';
  const e = p.encabezado || {};

  // ---- Encabezado: logo | banda azul con título | franja cian | Código / Fecha / Revisión
  const filaInfo = (icono, etiqueta, valor, ultima) => {
    const linea = ultima ? '' : `border-bottom:1px solid ${PAL.divisor};`;
    return `
      <tr>
        <td width="26" style="padding:7px 0 7px 2px;${linea}" valign="middle">${ico(icono, 'osc')}</td>
        <td style="padding:7px 8px;${fx(700, 9.5, F_TIT)}letter-spacing:.04em;text-transform:uppercase;color:${PAL.etiquetaCard};white-space:nowrap;${linea}" valign="middle">${etiqueta}</td>
        <td style="padding:7px 4px 7px 10px;border-left:1px solid ${PAL.separador};${fx(800, 12, F_TIT)}color:${PAL.navy};white-space:nowrap;${linea}" valign="middle">${esc(valor)}</td>
      </tr>`;
  };
  const encabezado = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${PAL.borde};border-radius:8px;border-collapse:separate;overflow:hidden">
    <tr>
      <td class="sgc-col sgc-logo" width="25%" style="padding:16px 14px" valign="middle" align="center">
        <img src="${logo}" width="140" alt="Metalium" style="display:block;width:140px;max-width:100%;height:auto;border:0">
      </td>
      <td class="sgc-col" bgcolor="${AZUL_BANDA}" style="background:${AZUL_BANDA};background-image:${DEGRADADO};padding:16px 18px" valign="middle">
        <div style="${fx(800, 9.5, F_TIT)}letter-spacing:.08em;text-transform:uppercase;color:#ffffff">Sistema de Gestión de Calidad</div>
        <div style="margin-top:7px;${fx(800, 17, F_TIT, 1.25)}text-transform:uppercase;color:#ffffff">${esc(e.titulo)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>
          <td width="40" height="4" bgcolor="${PAL.amarilloBarra}" style="background:${PAL.amarilloBarra};font-size:0;line-height:0">&nbsp;</td>
          <td style="padding-left:12px;${fx(800, 10, F_TIT)}color:#ffffff;letter-spacing:.04em">SGC</td>
        </tr></table>
      </td>
      <td class="sgc-cian" width="6" bgcolor="${PAL.cian}" style="background:${PAL.cian};font-size:0;line-height:0">&nbsp;</td>
      <td class="sgc-col" width="30%" style="padding:6px 12px" valign="middle">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${filaInfo('file-text', 'Código', e.codigo, false)}
          ${filaInfo('calendar-days', 'Fecha', e.fecha, false)}
          ${filaInfo('refresh-cw', 'Revisión', e.revision ?? '00', true)}
        </table>
      </td>
    </tr>
  </table>`;

  // ---- Barra de sección: número amarillo | título en banda azul | resto celeste
  const barra = (n, titulo) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 10px">
    <tr>
      <td width="36" bgcolor="${PAL.amarillo}" align="center" style="background:${PAL.amarillo};padding:8px 0;text-align:center;${fx(900, 15, F_TIT)}color:${PAL.navy};border-radius:4px 0 0 4px">${n}</td>
      <td bgcolor="${AZUL_BANDA}" style="background:${AZUL_BANDA};background-image:${DEGRADADO};padding:9px 16px;${fx(800, 12.5, F_TIT)}letter-spacing:.03em;text-transform:uppercase;color:#ffffff;white-space:nowrap">${esc(titulo)}</td>
      <td class="sgc-relleno" width="38%" bgcolor="#DCE7F2" style="background:#DCE7F2;font-size:0;line-height:0">&nbsp;</td>
    </tr>
  </table>`;

  // ---- Ficha: ícono | separador | etiqueta + valor
  const ficha = (f) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAL.ficha}" style="background:${PAL.ficha};border-radius:6px;border-collapse:separate">
      <tr>
        <td width="34" style="padding:12px 10px 12px 14px" valign="top">${ico(f.icono || 'file-text')}</td>
        <td style="padding:10px 14px;border-left:1px solid ${PAL.separador}" valign="top">
          <div style="${fx(700, 11.5)}color:${PAL.azulEtiqueta}">${esc(f.etiqueta)}</div>
          <div style="margin-top:2px;${fx(700, 14, F_TXT, 1.35)}color:${PAL.navy};overflow-wrap:anywhere;word-break:break-word">${esc(f.valor == null || f.valor === '' ? '—' : f.valor)}</div>
        </td>
      </tr>
    </table>`;
  const grillaFichas = (fichas) => {
    // primero las cortas (de a dos), al final las de texto largo, como el PDF
    const ordenadas = [...fichas.filter((f) => f.ancho !== 'completo'), ...fichas.filter((f) => f.ancho === 'completo')];
    const filas = [];
    let pendiente = null;
    for (const f of ordenadas) {
      if (f.ancho === 'completo') {
        if (pendiente) { filas.push([pendiente, null]); pendiente = null; }
        filas.push([f]);
      } else if (pendiente) { filas.push([pendiente, f]); pendiente = null; }
      else pendiente = f;
    }
    if (pendiente) filas.push([pendiente, null]);
    return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${PAL.borde};border-radius:8px;border-collapse:separate">
    <tr><td style="padding:8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${filas.map((r) => r.length === 1
          ? `<tr><td colspan="2" style="padding:5px">${ficha(r[0])}</td></tr>`
          : `<tr><td class="sgc-col" width="50%" style="padding:5px" valign="top">${ficha(r[0])}</td>${r[1] ? `<td class="sgc-col" width="50%" style="padding:5px" valign="top">${ficha(r[1])}</td>` : '<td class="sgc-vacia" width="50%" style="padding:5px">&nbsp;</td>'}</tr>`).join('')}
      </table>
    </td></tr>
  </table>`;
  };

  // ---- Tabla (ej. aprobaciones): mismas columnas del documento
  //      { titulo, icono, alinear: 'centro', estilo: 'numero' | 'fuerte' | 'pildora' | 'normal',
  //        movil: false -> la columna no se muestra en el celular }
  const tabla = (t) => {
    const cols = (t.columnas || t.cols || []).map((c) => (typeof c === 'string' ? { titulo: c } : c));
    const cab = cols.map((c, i) => `
      <td class="sgc-th${c.movil === false ? ' sgc-oculta' : ''}" bgcolor="${AZUL_BANDA}" style="background:${AZUL_BANDA};padding:10px 10px;${i ? 'border-left:1px solid #2D6AA1;' : ''}" align="${c.alinear === 'centro' && !c.icono ? 'center' : 'left'}" valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0"${c.alinear === 'centro' && !c.icono ? ' align="center"' : ''}><tr>
          ${c.icono ? `<td class="sgc-th-ico" width="24" valign="middle" style="padding-right:6px">${ico(c.icono, 'bl', 18)}</td>` : ''}
          <td valign="middle" style="${fx(600, 11.5, F_TXT, 1.25)}color:#ffffff">${esc(c.titulo)}</td>
        </tr></table>
      </td>`).join('');
    // "09-11-2026" y "09-11-2026 17:21": la fecha (y la hora) no se cortan en los guiones
    const valorHtml = (v) => {
      const txt = String(v);
      if (/^\d{2}-\d{2}-\d{4}$/.test(txt)) return `<span style="white-space:nowrap">${txt}</span>`;
      const m = /^(\d{2}-\d{2}-\d{4}) (\d{2}:\d{2})$/.exec(txt);
      return m ? `<span style="white-space:nowrap">${m[1]}</span> <span style="white-space:nowrap">${m[2]}</span>` : esc(v);
    };
    const celda = (c, v, fondo, i) => {
      const obj = v != null && typeof v === 'object' ? v : null;
      const txt = obj ? obj.texto : v;
      const val = txt == null || txt === '' ? '—' : txt;
      const centro = c.alinear === 'centro';
      const base = `class="sgc-td${c.movil === false ? ' sgc-oculta' : ''}" bgcolor="${fondo}" style="background:${fondo};padding:10px 10px;border-top:1px solid ${PAL.lineaTabla};${i ? `border-left:1px solid ${PAL.lineaTabla};` : ''}`;
      if (c.estilo === 'pildora') {
        return `<td ${base}" align="center" valign="middle">
          <span class="sgc-pildora" style="display:inline-block;background:${obj?.fondo || PAL.pildora};border-radius:5px;padding:5px 12px;${fx(700, 12.5)}color:${obj?.color || PAL.pildoraTexto};white-space:nowrap">${esc(val)}</span></td>`;
      }
      const color = c.estilo === 'normal' ? PAL.texto : (c.estilo === 'numero' ? '#1A396C' : PAL.navy);
      const peso = c.estilo === 'normal' ? 400 : 700;
      return `<td ${base}${fx(peso, 12.5, F_TXT, 1.35)}color:${color}" align="${centro ? 'center' : 'left'}" valign="middle">${valorHtml(val)}</td>`;
    };
    const filas = (t.filas || []).length
      ? t.filas.map((fila, k) => {
        const fondo = k % 2 ? PAL.filaAlterna : '#ffffff';
        return `<tr>${cols.map((c, i) => celda(c, fila[i], fondo, i)).join('')}</tr>`;
      }).join('')
      : `<tr><td colspan="${cols.length}" align="center" style="padding:14px;border-top:1px solid ${PAL.lineaTabla};${fx(400, 13)}color:${PAL.texto};text-align:center">${esc(t.vacia || 'Sin registros.')}</td></tr>`;
    return `
  <div class="sgc-tabla-wrap" style="overflow-x:auto">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${PAL.borde};border-radius:8px;border-collapse:separate;overflow:hidden">
    <tr>${cab}</tr>
    ${filas}
  </table>
  </div>`;
  };

  const secciones = (p.secciones || []).filter(Boolean).map((s, i) =>
    barra(i + 1, s.titulo) + (s.tabla ? tabla(s.tabla) : grillaFichas(s.fichas || []))).join('');

  // ---- Mensaje (saludo + texto + resumen + botón): tarjeta blanca con borde cian a la izquierda
  const resumen = (p.resumen || []).filter(([, v]) => v != null && v !== '');
  const resumenHtml = resumen.length ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">
        <tr>${resumen.map(([k, v, color], i) => `
          <td class="sgc-col sgc-dato" valign="top" style="padding:8px 12px;background:${PAL.ficha};${i ? `border-left:3px solid #ffffff;` : ''}">
            <div style="${fx(700, 10.5)}color:${PAL.azulEtiqueta};text-transform:uppercase;letter-spacing:.03em">${esc(k)}</div>
            <div style="margin-top:2px;${fx(700, 13.5)}color:${color || PAL.navy};white-space:nowrap">${esc(v)}</div>
          </td>`).join('')}
        </tr>
      </table>` : '';
  const boton = p.boton?.url ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
        <td bgcolor="#0A64B4" style="background:#0A64B4;border-radius:6px">
          <a href="${esc(p.boton.url)}" style="display:inline-block;padding:11px 22px;${fx(700, 14)}color:#ffffff;text-decoration:none">${esc(p.boton.texto || 'Ir al sistema')}</a>
        </td>
      </tr></table>` : '';
  const mensaje = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#ffffff;border:1px solid ${PAL.borde};border-left:4px solid ${PAL.cian};border-radius:8px;border-collapse:separate">
    <tr><td style="padding:18px 22px;${fx(400, 14.5, F_TXT, 1.6)}color:${PAL.texto}">
      ${p.saludo ? `<div style="font-weight:700;color:${PAL.navy};margin-bottom:4px">${esc(p.saludo)}</div>` : ''}
      ${p.mensaje || ''}
      ${resumenHtml}
      ${boton}
    </td></tr>
  </table>`;

  // ---- Pie como el del PDF: línea + acento cian + METALIUM | código | nombre
  const pie = p.pie ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px">
    <tr><td style="border-top:1px solid ${PAL.pieLinea};font-size:0;line-height:0">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="44" height="3" bgcolor="${PAL.pieAcento}" style="background:${PAL.pieAcento};font-size:0;line-height:0">&nbsp;</td></tr></table>
    </td></tr>
    <tr><td style="padding-top:8px;${fx(600, 11)}color:${PAL.pieTexto}">
      <b style="font-family:${F_TIT};font-weight:900;color:${PAL.pieFuerte}">METALIUM</b>
      <span style="color:${PAL.pieSep}">&nbsp;|&nbsp;</span>${esc(p.pie.codigo)}
      <span style="color:${PAL.pieSep}">&nbsp;|&nbsp;</span>${esc(p.pie.nombre)}
    </td></tr>
    <tr><td style="padding-top:6px;${fx(400, 11)}color:#9AB0C8">${p.nota || 'Correo automático del sistema SSI-RRHH: no hace falta responderlo.'}</td></tr>
  </table>` : '';

  const estilo = `<style>
  @media only screen and (max-width:600px){
    .sgc-col{display:block!important;width:100%!important;box-sizing:border-box}
    .sgc-cian{display:block!important;width:100%!important;height:5px!important}
    .sgc-logo{padding:14px!important}
    .sgc-vacia,.sgc-relleno{display:none!important}
    .sgc-dato{border-left:0!important;border-top:3px solid #ffffff!important}
    .sgc-th-ico{display:none!important}
    .sgc-th{padding:8px 4px!important}
    .sgc-th td{font-size:10px!important}
    .sgc-td{padding:8px 4px!important;font-size:10.5px!important}
    .sgc-pildora{padding:3px 4px!important;font-size:10px!important}
    .sgc-fondo{padding:14px 8px!important}
    .sgc-oculta{display:none!important}
  }
</style>`;
  // Outlook de escritorio no respeta max-width: se le da una tabla de 720 px
  const html = `${estilo}<div class="sgc-fondo" style="background:${PAL.fondo};padding:24px 12px">
  <!--[if mso]><table role="presentation" width="720" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;table-layout:fixed">
    <tr><td>
      ${encabezado}
      ${mensaje}
      ${secciones}
      ${pie}
    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</div>`;
  return { html, iconos: [...usados] };
}
