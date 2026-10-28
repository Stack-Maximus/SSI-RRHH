import '../src/styles/sgc-doc.css';
// Renderiza, con el mismo motor del sistema (sgc-layout.js + sgc-render.js),
// las piezas gráficas de los comprobantes SIN los textos variables. Devuelve
// cada imagen (PNG) y los textos quitados (posición en u), para ponerlos
// encima como cuadros de texto editables en el Excel.
import { encabezado, barraSeccion, pie, PAL, ALTO_BARRA } from '../supabase/functions/_shared/sgc-layout.js';
import { asegurarFuentes, medidor, pngDeRegion, pngDeIcono } from '../src/ui/sgc-render.js';
import { documentoComprobante, documentoMaestro } from '../supabase/functions/_shared/sgc-documentos.js';
import { DOCUMENTO_CODIGOS, TIPO_LABELS, MAESTRO_SOLICITUDES_CODIGO, detalleLineas } from '../supabase/functions/_shared/solicitud-detalle.ts';

// Comprobante en blanco (mismos campos que el PDF que emite el sistema)
const X = 'x';
const TIPOS = {
  ingreso: { detalle: { cargo: X, cantidad: X, sueldo_liquido: 1, tipo_contrato: X, plazo: X, turno: X, colacion: X, fecha_ingreso: X, cliente: X }, motivo: X },
  traslado: { detalle: { cargo: X, fecha_traslado: X, modificaciones_contractuales: X }, motivo: null },
  aumento_sueldo: { detalle: { monto_aumento: 1, motivo: X } },
  cambio_cargo: { detalle: { cargo_actual: X, cargo_nuevo: X, fecha_efectiva: X, motivo: X } },
  cambio_turno: { detalle: { turno_nuevo: X, motivo: X } },
  renovacion: { detalle: { tipo_contrato_actual: X, fecha_termino_actual: X, tipo_renovacion: 'plazo', nueva_fecha_termino: X, motivo: X } },
  desvinculacion: { detalle: { causal: X, fecha_desvinculacion: X, adjunto: { path: X, nombre: X }, observaciones: X } },
};
window.__docMaestro = () => {
  const doc = documentoMaestro([], { tipoLabels: TIPO_LABELS, codigoMaestro: MAESTRO_SOLICITUDES_CODIGO });
  const FIJOS = new Set(['Registro', 'Código', 'Revisión']);
  doc.encabezado.fecha = '';
  for (const f of doc.secciones[0].fichas) if (!FIJOS.has(f.etiqueta)) f.valor = '';
  return doc;
};
window.__docComprobante = (tipo) => {
  const def = TIPOS[tipo];
  const sol = { tipo, estado: '', folio: '', codigo: '', created_at: null, solicitante_id: 'u', centro_origen_id: 'c', centro_destino_id: 'c', detalle: def.detalle, motivo: def.motivo ?? null };
  const data = { sol, cmap: new Map([['c', { nombre: X }]]), aprs: [], pmap: new Map([['u', { nombre: X }]]), trabNombre: X };
  const ref = {
    tipoLabels: TIPO_LABELS, documentoCodigos: DOCUMENTO_CODIGOS,
    detalleLineas: (s) => {
      const l = detalleLineas(s);
      if (tipo === 'renovacion') l.splice(l.findIndex(([k]) => k === 'Fecha de culminación') + 1, 0, ['Hito de la obra', X]);
      return l;
    },
  };
  const doc = documentoComprobante(data, ref);
  const FIJOS = new Set(['Registro', 'Código', 'Revisión']);
  doc.encabezado.fecha = '';
  for (const sec of doc.secciones) if (sec.fichas) for (const f of sec.fichas) if (!FIJOS.has(f.etiqueta)) f.valor = '';
  return doc;
};

window.__assets = async ({ K, doc, secciones, iconos }) => {
  await asegurarFuentes();
  const medir = medidor();
  const out = { imagenes: {}, textos: {} };
  // encabezado: se quitan el título (mBold) y los valores de la tarjeta (f700)
  {
    const prims = encabezado(doc.encabezado, medir).prims;
    const quitar = (p) => p.t === 'text' && (p.f === 'mBold' || p.f === 'f700');
    const textos = prims.filter(quitar).filter((p) => !(p.op && p.op < 1)); // sin la sombra del título
    const img = await pngDeRegion(prims.filter((p) => !quitar(p)), { x0: 26, y0: 34, x1: 1392, y1: 322, escala: K, fondo: PAL.fondo });
    out.imagenes.encabezado = img; out.textos.encabezado = textos;
  }
  // barras de sección (sin número ni título)
  for (const [n, titulo] of secciones) {
    const prims = barraSeccion(n, titulo, 0, medir).prims;
    const quitar = (p) => p.t === 'text';
    const img = await pngDeRegion(prims.filter((p) => !quitar(p)), { x0: 26, y0: 0, x1: 1392, y1: ALTO_BARRA, escala: K, fondo: PAL.fondo });
    out.imagenes['barra' + n] = img; out.textos['barra' + n] = prims.filter(quitar);
  }
  // pie: solo la línea con el acento cian
  {
    const altoRef = 200, yl = altoRef - 93;
    const prims = pie('X', 'X', 1, 1, medir, altoRef, false).filter((p) => p.t !== 'text');
    out.imagenes.pie = await pngDeRegion(prims, { x0: 26, y0: yl - 6, x1: 1392, y1: yl + 6, escala: K, fondo: PAL.fondo });
  }
  // íconos
  for (const [clave, nombre, px, color, sw] of iconos) {
    out.imagenes[clave] = { dataUrl: await pngDeIcono(nombre, { px, color, sw }), ancho: px, alto: px };
  }
  return out;
};
window.__listo = true;
