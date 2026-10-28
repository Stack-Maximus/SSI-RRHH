// Genera los instructivos en PDF con el diseño SGC.
//   deno run -A generar.ts [clave...]
import { crearPintorPdf, ALTO_PT, ANCHO_PT } from './sgc-pdf.ts';
import { ANCHO, ICONOS } from './sgc-layout.js';
import { ICONOS_EXTRA } from './iconos-extra.js';
import { componerInstructivo } from './sgc-instructivo.js';
import { INSTRUCTIVOS } from './contenido.js';

Object.assign(ICONOS, ICONOS_EXTRA);
const K = ANCHO_PT / ANCHO;
// capturas reducidas para el PDF (~200 dpi); las dimensiones originales
// (dims.json) son las que definen el tamaño en la página
const SHOTS = new URL('./shots-pdf/', import.meta.url);
const DIMS = JSON.parse(await Deno.readTextFile(new URL('dims.json', SHOTS)));
const OUT = new URL('./out/', import.meta.url);
await Deno.mkdir(OUT, { recursive: true });

async function generar(clave: string, def: any) {
  const pintor = await crearPintorPdf();
  const imagenes = new Map<string, any>();
  const cargar = async (src: string) => {
    if (!imagenes.has(src)) imagenes.set(src, await pintor.doc.embedJpg(await Deno.readFile(new URL(src + '.jpg', SHOTS))));
    return imagenes.get(src);
  };
  // dimensiones reales de cada captura (en px de la imagen)
  for (const sec of def.doc.secciones) for (const b of sec.bloques ?? []) {
    if (b.t === 'img' || b.t === 'lado') { await cargar(b.src); [b.w, b.h] = DIMS[b.src]; }
    if (b.t === 'img2') for (const k of ['a', 'b']) { await cargar(b[k].src); [b[k].w, b[k].h] = DIMS[b[k].src]; }
  }
  // Índice con N° de página: primero se compone con páginas de relleno (mismo
  // alto de filas), se leen las páginas reales de cada sección y se recompone.
  const secs = def.doc.secciones;
  const idx = secs.find((s: any) => s.indice);
  const filasIndice = (pag: (s: any) => string) => secs
    .map((s: any, i: number) => ({ s, n: i + 1 }))
    .filter(({ s }: any) => !s.indice && !s.fichas)
    .map(({ s, n }: any) => [String(n), s.titulo, s.lectores ?? (s.roles ? s.roles.join(', ') : 'Todos'), pag(s)]);
  if (idx) {
    idx.tabla.filas = filasIndice(() => '00');
    componerInstructivo(def.doc, pintor.medir);
    idx.tabla.filas = filasIndice((s) => String(s._pag));
    secs.forEach((s: any) => { delete s._pag; });
  }
  const paginas = componerInstructivo(def.doc, pintor.medir);
  if (idx) {
    const antes = idx.tabla.filas.map((f: any) => f[3]).join();
    const despues = filasIndice((s) => String(s._pag)).map((f: any) => f[3]).join();
    if (antes !== despues) console.warn('¡El índice cambió al recomponer!', antes, despues);
  }
  for (const prims of paginas) {
    const page = pintor.nuevaPagina();
    let lote: any[] = [];
    const vaciar = () => { if (lote.length) pintor.pintar(page, lote); lote = []; };
    for (const p of prims) {
      if (p.t === 'img' && p.key !== 'logo') {
        vaciar();
        page.drawImage(imagenes.get(p.key), { x: p.x * K, y: ALTO_PT - (p.y + p.h) * K, width: p.w * K, height: p.h * K });
      } else lote.push(p);
    }
    vaciar();
  }
  pintor.doc.setTitle(def.doc.pie.nombre);
  pintor.doc.setAuthor('Metalium SpA · Recursos Humanos');
  pintor.doc.setSubject(`${def.doc.encabezado.codigo} · Revisión ${def.doc.encabezado.revision}`);
  pintor.doc.setCreator('SSI-RRHH');
  const bytes = await pintor.doc.save();
  await Deno.writeFile(new URL(def.archivo, OUT), bytes);
  console.log(clave, paginas.length, 'páginas', Math.round(bytes.length / 1024), 'KB');
}

const pedidas = Deno.args.length ? Deno.args : Object.keys(INSTRUCTIVOS);
for (const k of pedidas) await generar(k, INSTRUCTIVOS[k]);
