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

  // ---------------- comunes ----------------
  await alto(860);
  await p.evaluate(() => window.__login()); await esperar();
  await p.fill('#login-email', 'sfuentes@metalium.cl'); await p.fill('#login-password', 'contraseña');
  await shotEl('c-login', '.login-card', 24);
  await p.evaluate(() => window.__forgot()); await esperar();
  await p.fill('#forgot-email', 'sfuentes@metalium.cl');
  await shotEl('c-olvido', '.login-card', 24);

  const inicio = async (u, name) => { await alto(900); await as(u); await shot(name, { x: 0, y: 0, width: 1366, height: 340 }); };
  await inicio('u-sol', 'sol-inicio');
  await inicio('u-sup', 'sup-inicio');
  await inicio('a1', 'apr-inicio');
  await inicio('r1', 'rrhh-inicio');
  await inicio('p1', 'prev-inicio');

  // ---------------- SOLICITANTE ----------------
  await alto(1120); await as('u-sol'); await go('nueva-solicitud');
  await sel('select[name=cargo]', 'Maestro Terminaciones');
  await p.fill('input[name=cantidad]', '2');
  await p.fill('input[name=cliente]', 'SACYR');
  await p.fill('input[name=plazo]', '3 meses');
  await sel('select[name=colacion]', '60 minutos');
  await p.fill('input[name=sueldo_liquido]', '850000');
  await p.fill('input[name=fecha_ingreso]', '2026-10-19');
  await p.fill('textarea[name=motivo]', 'Aumento de faenas en terminaciones de la Torre B.');
  await shotEl('sol-ingreso', '.form-card', 0);

  const tipo = async (t) => { await p.click(`#tipo-control [data-tipo="${t}"]`); await esperar(250); };
  // traslado
  await tipo('traslado');
  await sel('#trab-select', 't1');
  await sel('select[name=centro_destino]', 'c2');
  await p.fill('input[name=fecha_traslado]', '2026-10-14');
  await p.fill('textarea[name=modificaciones]', 'Se mantiene el sueldo base; se ajusta el bono de locomoción según la nueva obra.');
  await shotEl('sol-traslado', '.form-card', 0);
  await sel('#trab-select', 't2');
  await shotEl('sol-traslado-bloqueado', '#form-body', 10);
  // aumento
  await tipo('aumento_sueldo');
  await sel('#cam-trab', 't3');
  await p.fill('input[name=monto_aumento]', '80000');
  await p.fill('textarea[name=motivo]', 'Asume la bodega del sector norte.');
  await shotEl('sol-aumento', '.form-card', 0);
  // cambio de cargo
  await tipo('cambio_cargo');
  await sel('#cc-trab', 't9');
  await sel('select[name=cargo_nuevo]', 'Capataz');
  await p.fill('input[name=fecha_efectiva]', '2026-11-01');
  await shotEl('sol-cambio', '#form-body', 10);
  // renovación
  await tipo('renovacion');
  await sel('#ren-trab', 't8');
  await p.fill('input[name=nueva_fecha_termino]', '2027-01-31');
  await shotEl('sol-renovacion-plazo', '#form-body', 10);
  await sel('#ren-trab', 't2');
  await p.fill('input[name=hito_obra]', 'Término de obra gruesa Torre B');
  await shotEl('sol-renovacion-obra', '#form-body', 10);
  // desvinculación
  await tipo('desvinculacion');
  await sel('#des-trab', 't2');
  await sel('select[name=causal]', 'Renuncia voluntaria');
  await p.fill('input[name=fecha_desvinculacion]', '2026-10-31');
  await p.fill('textarea[name=observaciones]', 'Presentó carta de renuncia el 07-10.');
  await shotEl('sol-desvinculacion', '#form-body', 10);

  // mis solicitudes
  await alto(1300); await go('mis-solicitudes');
  await contenido('sol-mis', 700);
  await shotEl('sol-candidatos', '.recl-pendiente-card', 6);
  await p.click('.cand-row [data-decidir="elegido"]'); await esperar(600);
  await shot('sol-elegir-confirmar', { x: 330, y: 200, width: 900, height: 500 });
  await cerrarModal();
  // editar
  await alto(1120); await go('mis-solicitudes');
  await p.click('[data-editar="s1"]'); await esperar(800);
  await shotEl('sol-editar', '.form-card', 0);
  // comprobante
  await alto(1300); await go('mis-solicitudes');
  await p.click('[data-comprobante="s2"]'); await esperar(1500);
  await hojaParcial('sol-comprobante');

  // ---------------- SUPERVISOR ----------------
  await alto(900); await as('u-sup'); await go('nueva-solicitud');
  await shotEl('sup-tipos', '.form-card .form-section', 6);
  await alto(1100); await go('mis-solicitudes');
  await contenido('sup-mis', await altoContenido());
  await alto(1300); await p.click('[data-editar="s6"]'); await esperar(800);
  await shotEl('sup-editar', '.form-card', 0);
  await go('mis-solicitudes');
  await p.click('[data-comprobante="s8"]'); await esperar(1500);
  await hojaParcial('sup-comprobante');

  // ---------------- APROBADOR ----------------
  await alto(1080); await as('a1'); await go('bandeja');
  await contenido('apr-bandeja', 700);
  await shotEl('apr-tarjeta', '.sol-card[data-sol="s9"]', 6);
  await p.click('.sol-card[data-sol="s9"] [data-act="aprobar"]'); await esperar(600);
  await shot('apr-confirmar-aprobar', { x: 330, y: 220, width: 900, height: 500 });
  await cerrarModal();
  await p.click('.sol-card[data-sol="s9"] [data-act="rechazar"]'); await esperar(600);
  await shot('apr-confirmar-rechazar', { x: 330, y: 220, width: 900, height: 500 });
  await cerrarModal();
  await alto(1300); await p.click('.sol-card[data-sol="s9"] [data-comprobante]'); await esperar(1500);
  await hojaParcial('apr-comprobante');

  // ---------------- RRHH ----------------
  await alto(1000); await as('r1'); await go('solicitudes');
  await contenido('rrhh-solicitudes', 640);
  await alto(2200);
  await p.click('.sol-card[data-sol="s2"] [data-toggle]'); await esperar(300);
  await shotEl('rrhh-traslado-docs', '.sol-card[data-sol="s2"] .sol-accion', 8);
  await p.click('.sol-card[data-sol="s8"] [data-toggle]'); await esperar(300);
  await shotEl('rrhh-procesar', '.sol-card[data-sol="s8"]', 6);
  await alto(1000); await go('historial');
  await contenido('rrhh-historial', 1000);
  await alto(1400); await go('contrataciones');
  await shotEl('rrhh-contratacion', '.sol-card[data-sol="s3"]', 6);
  await alto(1400);
  await p.click('[data-iniciar="s3"]'); await esperar(300);
  await p.fill('[data-f="nombres"]', 'Matías'); await p.fill('[data-f="apellido_paterno"]', 'Herrera');
  await p.fill('[data-f="apellido_materno"]', 'Vidal'); await p.fill('[data-f="rut"]', '20.123.456-7');
  await shotEl('rrhh-iniciar-contratacion', '[data-form="s3"]', 10);
  await go('contrataciones');
  await p.click('[data-iniciar-recl="s3"]'); await esperar(300);
  await shotEl('rrhh-iniciar-reclutamiento', '[data-form-recl="s3"]', 10);
  await go('contrataciones');
  await alto(2300);
  await p.click('[data-ver-btn="k1"]'); await esperar(900);
  await contenido('rrhh-contratacion-detalle', 780);
  await shotEl('rrhh-cerrar-proceso', '#content > .card:last-child', 8);
  await alto(1000); await go('dashboard-rrhh');
  await contenido('rrhh-sla', 600);

  // ---------------- PREVENCIONISTA ----------------
  await alto(900); await as('p1'); await go('homologacion');
  await contenido('prev-homologacion', 520);
  await alto(1300);
  await p.click('[data-ver="ingreso:k1"]'); await esperar(900);
  await contenido('prev-detalle-ingreso', await altoContenido());
  await p.click('#mostrar-rechazo'); await esperar(300);
  await p.fill('#rechazo-form textarea', 'La cédula está vencida desde agosto; se necesita la vigente.');
  await p.locator('#rechazo-form input[type=checkbox]').first().check().catch(() => {});
  await shotEl('prev-rechazo', '#rechazo-form', 14);
  await go('homologacion');
  await p.click('[data-ver="traslado:s11"]'); await esperar(900);
  await contenido('prev-detalle-traslado', await altoContenido());
  await p.click('#autorizar-ingreso'); await esperar(600);
  await shot('prev-confirmar-autorizar', { x: 330, y: 220, width: 900, height: 500 });
  await cerrarModal();
  await alto(1000); await go('dashboard-prevencion');
  await contenido('prev-sla', 600);

  console.log(errs.join('\n') || 'sin errores');
  await b.close();
})();
