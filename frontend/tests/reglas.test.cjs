const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
for (const administrador of [false, true]) for (const [width, height] of [[1440, 900], [1470, 800], [1366, 768], [390, 900], [320, 900]]) {
  test(`Reglas accesibles para ${administrador ? 'ADMIN' : 'JUGADOR'} a ${width}×${height}`, async t => {
    const v = await abrirPantalla(navegador, '/inicio.html', { administrador, viewport: { width, height } });
    t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
    const p = v.pagina;
    if (width < 1025) await p.locator('.metronet-navegacion__usuario > summary').click();
    await p.getByRole('link', { name: 'Reglas', exact: true }).click();
    await p.waitForLoadState('domcontentloaded');
    await p.getByRole('heading', { name: 'Reglas del juego', exact: true }).waitFor();
    assert.equal(await p.getByRole('tab').count(), 5);
    for (const nombre of ['Puntuación', 'Cómo aprobar', 'Acciones', 'Velocidad y tiempo', 'Ranking']) {
      await p.getByRole('tab', { name: nombre, exact: true }).click();
      assert.equal(await p.getByRole('tabpanel').count(), 1, 'Sólo se expone el tema elegido');
      assert.equal(await p.getByRole('tab', { name: nombre, exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await p.getByRole('tabpanel').getAttribute('aria-labelledby'), await p.getByRole('tab', { name: nombre, exact: true }).getAttribute('id'));
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const fuentes = await p.getByRole('tabpanel').locator('p, td, h2, h3').evaluateAll(nodos => nodos.map(n => getComputedStyle(n).fontFamily));
      assert.ok(fuentes.every(f => f.includes('Silkscreen')), 'Contenido y tablas comparten la fuente pixelada');
      if (width >= 1025) {
        const panel = await p.getByRole('tabpanel').boundingBox();
        assert.ok(panel.y + panel.height <= height, `${nombre} debe entrar completo en escritorio`);
        assert.equal(await p.evaluate(() => document.documentElement.scrollHeight > innerHeight), false, `${nombre} no necesita desplazamiento con los detalles cerrados`);
      }
    }
    await p.getByRole('tab', { name: 'Cómo aprobar', exact: true }).click();
    assert.doesNotMatch(await p.locator('main').innerText(), /versi[oó]n|pol[ií]tica|servidor|Intentos anteriores|regla anterior/i);
    assert.match(await p.locator('#reglaAprobacion').innerText(), /toda la consigna/);
    assert.match(await p.locator('#reglaAprobacion').innerText(), /60 puntos/);
    assert.match(await p.locator('#reglaAprobacion').innerText(), /Finalizar red/);
    assert.match(await p.locator('main').innerText(), /Guardar y Simular no terminan el nivel/);
    await p.getByRole('tab', { name: 'Puntuación', exact: true }).click();
    assert.match(await p.locator('#reglaDescuentos').innerText(), /no descuentan puntos/i);
    assert.deepEqual(await p.locator('#ejemplosPuntos tbody tr td:nth-child(2)').allTextContents(), ['100', '90', '80', '70', '60']);
    assert.equal(await p.locator('#reglaPracticas, #practicasPuntos').count(), 0);
    assert.doesNotMatch(await p.locator('main').innerText(), /prácticas sin descuento|prácticas gratuitas/);
    assert.match(await p.locator('main').innerText(), /desde la primera ejecución/i);
    assert.match(await p.locator('main').innerText(), /máximo explícito de la consigna/);
    assert.match(await p.locator('main').innerText(), /10 puntos por simulación/);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width < 1025) {
      await p.evaluate(() => window.scrollTo(0, 700));
      const cabecera = await p.locator('.metronet-reglas__titulo-fijo').boundingBox();
      assert.ok(Math.abs(cabecera.y) < 1, 'El título y las hojas permanecen fijos al recorrer las reglas');
    }
    assert.equal(await p.locator('.metronet-reglas__hoja').count(), 0, 'El título ya no incluye las ilustraciones retiradas');
    assert.equal(v.solicitudes.filter(s => s.method !== 'GET').length, 0);
  });
}
test('Las pestañas permiten recorrer todos los temas por teclado y entrar al contenido', async t => {
  const v = await abrirPantalla(navegador, '/reglas.html');
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.getByRole('tab', { name: 'Puntuación', exact: true }).focus();
  for (const [tecla, nombre] of [['ArrowRight', 'Cómo aprobar'], ['End', 'Ranking'], ['ArrowRight', 'Puntuación'], ['ArrowLeft', 'Ranking'], ['Home', 'Puntuación']]) {
    await p.keyboard.press(tecla);
    assert.equal(await p.getByRole('tab', { name: nombre, exact: true }).evaluate(n => n === document.activeElement), true);
    assert.equal(await p.getByRole('tabpanel').count(), 1);
  }
  await p.keyboard.press('Tab');
  assert.equal(await p.getByRole('tabpanel').evaluate(n => n === document.activeElement), true);
  await p.getByRole('tab', { name: 'Velocidad y tiempo', exact: true }).click();
  await p.locator('#panelLibre summary').click();
  assert.match(await p.getByRole('tabpanel').innerText(), /una línea por vez/);
  assert.doesNotMatch(await p.getByRole('tabpanel').innerText(), /Todas las líneas|Mixto/);
  await p.getByRole('tab', { name: 'Ranking', exact: true }).click();
  assert.equal(await p.getByRole('link', { name: 'Ver niveles', exact: true }).getAttribute('href'), '/escenarios.html');
  assert.equal(await p.getByRole('link', { name: 'Ver ranking', exact: true }).getAttribute('href'), '/ranking.html');
});
test('El título conserva su jerarquía sin ilustraciones también con movimiento reducido', async t => {
  const v = await abrirPantalla(navegador, '/reglas.html', { reducedMotion: 'reduce' });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  assert.equal(await v.pagina.getByRole('heading', { name: 'Reglas del juego', exact: true }).isVisible(), true);
  assert.equal(await v.pagina.locator('.metronet-reglas__hoja').count(), 0);
});
