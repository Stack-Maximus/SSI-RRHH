// Capturas reales de la app (arnés instr/harness.html) para los instructivos.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const OUT = '/home/claude/work/instr/shots/';
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ args: ['--lang=es-CL'], env: { ...process.env, LANG: 'es_CL.UTF-8', LANGUAGE: 'es_CL:es' } });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2, locale: 'es-CL', timezoneId: 'America/Santiago' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const URL = 'http://localhost:5179/instr/harness.html';
  const cargar = async () => { await p.goto(URL); await p.waitForFunction(() => window.__ready); await p.evaluate(() => document.fonts.ready); };
  const esperar = (ms = 450) => p.waitForTimeout(ms);
  const as = async (u) => { await p.evaluate((u) => window.__as(u), u); await esperar(); };
  const go = async (v) => { await p.evaluate((v) => window.__go(v), v); await esperar(700); };
  const alto = async (h) => p.setViewportSize({ width: 1366, height: h });
  const shot = async (name, clip) => { await p.screenshot({ path: OUT + name + '.jpg', type: 'jpeg', quality: 88, clip }); console.log('ok', name); };
  const shotEl = async (name, sel, pad = 0) => {
    const bb = await p.locator(sel).first().boundingBox();
    await shot(name, { x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad), width: Math.min(1366, bb.width + 2 * pad), height: bb.height + 2 * pad });
  };
  const contenido = async (name, h) => shot(name, { x: 250, y: 0, width: 1116, height: h ?? (await p.evaluate(() => Math.min(document.documentElement.scrollHeight, window.innerHeight))) });
  const altoContenido = () => p.evaluate(() => { const c = document.getElementById('content'); let b = 0; for (const el of c.querySelectorAll(':scope > *')) { const r = el.getBoundingClientRect(); if (r.height) b = Math.max(b, r.bottom); } return Math.ceil(b + 28); });
  const sel = async (selector, value) => { await p.selectOption(selector, value); await esperar(150); };
  const hojaParcial = async (name) => { const bb = await p.locator('.sgc-hoja').first().boundingBox(); await shot(name, { x: bb.x, y: bb.y, width: bb.width, height: Math.round(bb.height * 0.62) }); };
  const cerrarModal = async () => { await p.keyboard.press('Escape'); await esperar(400); };

  await cargar();
  // ---------------- ADMINISTRADOR ----------------
  await alto(1180); await as('ad1');
  await shotEl('ad-menu', '#sidebar', 0);
  await alto(1000); await go('usuarios');
  await p.fill('#inv-email', 'nueva.persona@metalium.cl'); await p.fill('#inv-nombre', 'Nueva Persona');
  await contenido('ad-usuarios', 880);
  await go('centros-costo');
  await contenido('ad-centros', await altoContenido());
  await alto(1300); await go('cargos');
  await contenido('ad-cargos', Math.min(await altoContenido(), 860));
  await p.setViewportSize({ width: 1960, height: 1000 }); await go('trabajadores');
  await shot('ad-trabajadores', { x: 250, y: 0, width: 1710, height: 640 });
  await p.setViewportSize({ width: 1366, height: 1000 });
  await alto(1300);
  await p.setInputFiles('#file-import', '/home/claude/work/test/import_trabajadores.xlsx'); await esperar(900);
  await shotEl('ad-trab-import', '#import-zone', 8);
  await go('trabajadores');
  await p.click('[data-perfil="t1"]'); await esperar(900);
  await contenido('ad-trab-perfil', await altoContenido());
  await alto(1100); await go('checklist-documentos');
  await contenido('ad-checklist', 760);
  await alto(1200); await go('kpis');
  await contenido('ad-kpis', await altoContenido());

  console.log(errs.join('\n') || 'sin errores');
  await b.close();
})();
