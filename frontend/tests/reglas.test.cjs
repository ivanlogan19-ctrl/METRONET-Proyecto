const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
for (const administrador of [false, true]) for (const width of [1440, 390, 320]) {
  test(`Reglas accesibles para ${administrador ? 'ADMIN' : 'JUGADOR'} a ${width}px`, async t => {
    const v = await abrirPantalla(navegador, '/inicio.html', { administrador, viewport: { width, height: 900 } });
    t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
    const p = v.pagina;
    if (width < 1025) await p.locator('.metronet-navegacion__usuario > summary').click();
    await p.getByRole('link', { name: 'Reglas', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await p.getByRole('heading', { name: 'Reglas de puntuación', exact: true }).waitFor();
    assert.doesNotMatch(await p.locator('main').innerText(), /versi[oó]n|pol[ií]tica|servidor|Intentos anteriores|regla anterior/i);
    assert.match(await p.locator('#reglaAprobacion').innerText(), /toda la consigna/);
    assert.match(await p.locator('#reglaAprobacion').innerText(), /60 puntos/);
    assert.match(await p.locator('#reglaAprobacion').innerText(), /Finalizar red/);
    assert.match(await p.locator('main').innerText(), /Guardar y Simular no terminan el nivel/);
    assert.match(await p.locator('#reglaDescuentos').innerText(), /no descuentan puntos/);
    assert.deepEqual(await p.locator('#ejemplosPuntos tbody tr td:nth-child(2)').allTextContents(), ['100', '90', '80', '70', '60']);
    assert.deepEqual(await p.locator('#practicasPuntos tbody tr td:nth-child(2)').allTextContents(), ['1', '2', '2', '3', '1', '1', '1', '2', '2', '4']);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await p.evaluate(() => window.scrollTo(0, 700));
    const cabecera = await p.locator('.metronet-reglas__titulo-fijo').boundingBox();
    assert.ok(Math.abs(cabecera.y) < 1, 'El título y las hojas permanecen fijos al recorrer las reglas');
    assert.equal(await p.locator('.metronet-reglas__hoja[aria-hidden="true"]').count(), 2);
    assert.equal(v.solicitudes.filter(s => s.method !== 'GET').length, 0);
  });
}
test('Las hojas permanecen visibles sin animación con movimiento reducido', async t => {
  const v = await abrirPantalla(navegador, '/reglas.html', { reducedMotion: 'reduce' });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const lineas = await v.pagina.locator('.metronet-reglas__hoja span').evaluateAll(nodos => nodos.map(n => ({
    animacion: getComputedStyle(n).animationName,
    recorte: getComputedStyle(n).clipPath,
  })));
  assert.equal(lineas.length, 8);
  assert.ok(lineas.every(l => l.animacion === 'none' && l.recorte === 'none'));
});
