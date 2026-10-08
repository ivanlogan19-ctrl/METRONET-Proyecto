const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
for (const administrador of [false, true]) for (const width of [1440, 390]) {
  test(`Reglas accesibles para ${administrador ? 'ADMIN' : 'JUGADOR'} a ${width}px`, async t => {
    const v = await abrirPantalla(navegador, '/inicio.html', { administrador, viewport: { width, height: 900 } });
    t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
    const p = v.pagina;
    if (width < 1025) await p.locator('.metronet-navegacion__usuario > summary').click();
    await p.getByRole('link', { name: 'Reglas', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await p.getByRole('heading', { name: 'Reglas de puntuación', exact: true }).waitFor();
    assert.match(await p.locator('main').innerText(), /100 − descuentos registrados/);
    assert.match(await p.locator('#reglaAprobacion').innerText(), /todas las condiciones obligatorias/);
    assert.match(await p.locator('#reglaDescuentos').innerText(), /no descuentan puntos/);
    assert.deepEqual(await p.locator('#ejemplosPuntos tbody tr td:nth-child(2)').allTextContents(), ['100', '90', '80', '70', '60']);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(v.solicitudes.filter(s => s.method !== 'GET').length, 0);
  });
}
