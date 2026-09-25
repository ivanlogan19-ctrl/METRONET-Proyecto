const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const width of [390, 1440]) test(`Autenticación ${width}: enlaces azules textuales, foco y destinos`, async t => {
  for (const ruta of ['/login.html','/registro.html','/recuperar-contrasena.html','/nueva-contrasena.html','/verificar-codigo.html']) {
    const { pagina: p, contexto, errores } = await abrirPantalla(navegador, ruta, { viewport: { width, height: 1000 } });
    try {
      for (const a of await p.locator('.auth-link a').all()) {
        assert.deepEqual(await a.evaluate(e => { const s = getComputedStyle(e); return [s.backgroundColor,s.borderTopWidth,s.boxShadow,s.textDecorationStyle,s.fontWeight,s.color]; }), ['rgba(0, 0, 0, 0)','0px','none','dotted','700','rgb(72, 180, 255)']);
        await a.focus(); assert.equal(await a.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
        assert.ok(await a.getAttribute('href'));
      }
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errores, []);
    } finally { await contexto.close(); }
  }
});
