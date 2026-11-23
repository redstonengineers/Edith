// Auditoría de accesibilidad WCAG A/AA con axe sobre las pantallas principales (modo demo).
const { chromium } = require('playwright'); const AxeBuilder = require('@axe-core/playwright').default; const U = (process.env.APP_URL || 'http://127.0.0.1:5173');
(async () => {
  const b = await chromium.launch(); const summary = {};
  // Cada persona (dos negocios distintos) en tema claro y en tema oscuro.
  for (const [who, theme] of [['Pablo Vidal', 'dark'], ['Pablo Vidal', 'light'], ['Beatriz Quintana', 'dark'], ['Beatriz Quintana', 'light']]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript((t) => localStorage.setItem('ac.theme', JSON.stringify(t)), theme); const p = await ctx.newPage();
    await p.goto(U + '/'); await p.getByRole('button', { name: new RegExp(who) }).first().click(); await p.locator('main h1').first().waitFor();
    for (const r of ['', 'alumnos', 'grupos', 'horarios', 'asistencia', 'pagos', 'incidencias', 'estadisticas', 'jarvis', 'personalizacion', 'configuracion', 'lista-espera', 'registro-accesos']) {
      await p.goto(U + '/' + r); await p.locator('main h1, main [role=alert]').first().waitFor().catch(() => {}); await p.waitForTimeout(700);
      const res = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
      for (const v of res.violations) { const k = `${theme}|${v.id}|${v.impact}`; (summary[k] ??= { n: 0, pages: new Set(), sample: '', help: v.help }).n += v.nodes.length; summary[k].pages.add(r || '/'); summary[k].sample += '\n     ' + v.nodes.slice(0, 4).map(n => n.html.slice(0, 90) + ' :: ' + (n.any[0]?.message || '').slice(0, 90)).join('\n     '); }
    }
  }
  for (const [k, v] of Object.entries(summary)) console.log(k, v.n, [...v.pages].join(','), '\n   ', v.help, '\n   ', v.sample);
  const bad = Object.keys(summary).length; console.log(bad ? `${bad} TIPOS DE VIOLACIÓN` : 'NO VIOLATIONS'); await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
