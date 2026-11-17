// El aspecto visual cambia según la suscripción: Esencial = base, Profesional y Premium = más sofisticado (html[data-tier]).
// Servidor: TENANTS=1 + PERSONAL_PASSWORD. APP_URL, PERSONAL_TEST_PASSWORD; SHOT_DIR opcional para capturas.
const { chromium } = require('playwright'); const U = process.env.APP_URL || 'http://127.0.0.1:4020'; const PW = process.env.PERSONAL_TEST_PASSWORD; const SH = process.env.SHOT_DIR;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const own = await (await b.newContext()).newPage(); await own.goto(U + '/login'); await own.getByLabel(/Correo o usuario/).fill('redstonengineers'); await own.getByLabel('Contraseña').fill(PW); await own.getByRole('button', { name: /Entrar/ }).click(); await own.waitForURL(/\/personal/);
  const api = own.context().request; const H = { 'x-requested-with': 'edith' };
  const clients = (await (await api.get(U + '/api/personal/clients')).json()).clients; const cl = clients.find((c) => /acceso\/academia/.test(c.slug ?? '') || /Academia Horizonte/.test(c.name));
  ok(!!cl, 'cliente Academia encontrado');
  for (const [plan, tier] of [['basic', null], ['pro', 'pro'], ['premium', 'premium']]) {
    const r = await api.post(U + `/api/personal/clients/${cl.id}/plan`, { data: { plan, applyModules: false }, headers: H }); ok(r.ok(), `plan ${plan} aplicado`);
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(U + '/acceso/academia'); await p.waitForSelector('#u'); await p.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await p.locator('main h1').first().waitFor(); await p.waitForTimeout(700);
    ok((await p.evaluate(() => document.documentElement.dataset.tier ?? null)) === tier, `plan ${plan} → data-tier=${tier}`);
    ok((await p.getByText(/^(Pro|Premium)$/).count()) === (tier ? 1 : 0), `insignia de plan ${tier ? 'visible' : 'ausente'} (${plan})`);
    const rects = await p.evaluate(() => { const g = (q) => { const r = document.querySelector(q).getBoundingClientRect(); return [Math.round(r.x), Math.round(r.width)]; }; return JSON.stringify({ aside: g('aside[aria-label="Barra lateral"]'), root: g('#root'), ambient: g('.ambient'), sl: document.documentElement.scrollLeft, sw: document.documentElement.scrollWidth }); });
    if (process.env.DEBUG_RECTS) console.log(plan, rects);
    if (SH) await p.screenshot({ path: `${SH}/tier-${plan}.png` });
    await p.close();
  }
  await api.post(U + `/api/personal/clients/${cl.id}/plan`, { data: { plan: 'pro', applyModules: false }, headers: H });
  ok(errs.length === 0, 'sin errores JS ' + errs.join('|')); console.log(fails ? fails + ' FALLOS' : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})();
