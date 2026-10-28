// node assets.cjs <tipo> <K> -> assets/<tipo>/*.png + doc.json
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs');
const [tipo, Kstr] = process.argv.slice(2);
const K = Number(Kstr || 0.6);
const OUT = `/home/claude/work/plantillas3/assets/${tipo}/`;
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5179/instr/assets.html');
  await p.waitForFunction(() => window.__listo && window.__docComprobante, null, { timeout: 60000 });
  const doc = await p.evaluate((t) => (t === 'maestro' ? window.__docMaestro() : window.__docComprobante(t)), tipo);
  const secciones = doc.secciones.map((s, i) => [i + 1, s.titulo]);
  const iconos = [];
  const vistos = new Set();
  for (const s of doc.secciones) for (const f of s.fichas || []) {
    const n = f.icono || 'file-text';
    if (!vistos.has('f:' + n)) { vistos.add('f:' + n); iconos.push(['ficha_' + n, n, Math.round(44 * K), '#0050A2', n === 'barcode' ? 2.3 : 1.75]); }
  }
  for (const s of doc.secciones) for (const c of (s.tabla?.columnas || [])) {
    if (c.icono && !vistos.has('t:' + c.icono)) { vistos.add('t:' + c.icono); iconos.push(['tabla_' + c.icono, c.icono, Math.round(36 * K), '#FFFFFF', 1.9]); }
  }
  const r = await p.evaluate((a) => window.__assets(a), { K, doc, secciones, iconos });
  for (const [k, img] of Object.entries(r.imagenes)) {
    fs.writeFileSync(OUT + k + '.png', Buffer.from(img.dataUrl.split(',')[1], 'base64'));
    img.dataUrl = undefined;
  }
  fs.writeFileSync(OUT + 'doc.json', JSON.stringify({ K, doc, textos: r.textos, imagenes: r.imagenes }, null, 1));
  console.log('ok', tipo, Object.keys(r.imagenes).length, 'imágenes', errs.join(' | ') || 'sin errores');
  await b.close();
})();
