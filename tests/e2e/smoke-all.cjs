// Humo: cada rol demo visita todas las rutas; falla ante errores de consola, ErrorBoundary o pantallas sin h1.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:5173';
const ROUTES = ['/', '/alumnos', '/profesores', '/grupos', '/clases', '/asignaturas', '/horarios', '/examenes', '/calificaciones', '/asistencia', '/solicitudes', '/lista-espera', '/matriculas', '/pagos', '/facturacion', '/documentos', '/incidencias', '/mensajes', '/avisos', '/notificaciones', '/estadisticas', '/informes', '/jarvis', '/configuracion', '/usuarios', '/permisos', '/personalizacion', '/plataforma'];
(async () => {
  const b = await chromium.launch(); let fails = 0, checks = 0; const seen = {};
  const probe = await (await b.newContext()).newPage(); await probe.goto(U + '/'); await probe.waitForSelector('button');
  const SEL = 'button[class*="text-xs"]'; const cards = await probe.locator(SEL).evaluateAll((els) => els.map((e) => e.textContent.trim()));
  console.log('cuentas detectadas:', cards.length);
  for (let i = 0; i < cards.length; i++) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)));
    await p.goto(U + '/'); await p.waitForSelector('button');
    const btn = p.locator(SEL).nth(i); const label = (await btn.textContent()).trim().replace(/\s+/g, ' ').slice(0, 50);
    await btn.click(); await p.locator('main h1, main [role=alert]').first().waitFor({ timeout: 8000 }).catch(() => {});
    for (const r of ROUTES) {
      checks++; errs.length = 0; await p.goto(U + r); await p.locator('main h1').first().waitFor({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(250);
      const boundary = await p.getByText(/Algo ha salido mal|Something went wrong/i).count();
      const h1 = await p.locator('main h1').count(); const denied = await p.getByText(/sin permiso|no tienes acceso|no disponible/i).count();
      const unknown = errs.filter((e) => !/favicon|Failed to load resource/.test(e));
      const bad = boundary || unknown.length || (!h1 && !denied && new URL(p.url()).pathname === r);
      if (bad) { fails++; console.log('FAIL', label, r, boundary ? 'ErrorBoundary' : '', unknown[0] || '', !h1 ? 'sin h1' : ''); }
    }
    await ctx.close();
  }
  console.log(`\n${checks} comprobaciones, ${fails} fallos`); await b.close(); process.exit(fails ? 1 : 0);
})();
