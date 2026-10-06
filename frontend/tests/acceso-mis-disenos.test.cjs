const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await browser?.close(); });

const catalogo = desbloqueado => [
  { idEscenario: 42, numero: 1, desbloqueado: true },
  { idEscenario: 45, numero: null, desbloqueado },
];

for (const width of [390, 1440]) test(`Jugador sin campaña: consulta diseños guardados, pero no entra a Modo Libre a ${width}px`, async t => {
  const v = await abrirPantalla(browser, '/disenos.html', { viewport: { width, height: 900 }, responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/juego/progreso') return { json: { modoLibreDesbloqueado: false } };
    if (path === '/api/juego/escenarios') return { json: catalogo(false) };
  } });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.locator('#listaMisDisenos[aria-busy=false]').waitFor({ state: 'attached' });
  assert.equal(await p.locator('#listaMisDisenos > li').count(), 1);
  assert.equal(await p.locator('#irDisenoLibre').isDisabled(), true);
  assert.match(await p.locator('#explicacionDisenoLibre').innerText(), /10 niveles/);
  for (const selector of ['#listaMisDisenos strong', '#listaMisDisenos small', '#explicacionDisenoLibre']) {
    assert.match(await p.locator(selector).first().evaluate(e => getComputedStyle(e).fontFamily), /Silkscreen/);
  }
  assert.ok(v.solicitudes.some(s => s.path === '/api/simulaciones'));
  if (width < 600) await p.locator('.metronet-navegacion__usuario > summary').click();
  const enlace = p.locator('.metronet-navegacion a:visible').filter({ hasText: 'Mis diseños' });
  assert.equal(await enlace.getAttribute('aria-disabled'), null);
  assert.match(await enlace.getAttribute('href'), /disenos\.html/);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

for (const administrador of [false, true]) test(`${administrador ? 'ADMIN' : 'JUGADOR con campaña histórica'} abre Modo Libre`, async t => {
  const v = await abrirPantalla(browser, '/disenos.html', { administrador, responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/juego/progreso') return { json: { numeroCampanaActual: 2, campanaCompletada: false, modoLibreDesbloqueado: true } };
    if (path === '/api/juego/escenarios') return { json: catalogo(true) };
  }});
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.locator('#listaMisDisenos[aria-busy=false]').waitFor({ state: 'attached' });
  assert.equal(await p.locator('#irDisenoLibre').isEnabled(), true);
  assert.equal(await p.locator('.metronet-navegacion__enlaces a').filter({ hasText: 'Mis diseños' }).getAttribute('aria-disabled'), null);
  assert.ok(v.solicitudes.some(s => s.path === (administrador ? '/api/admin/disenos' : '/api/simulaciones')));
  if (administrador) assert.equal(v.solicitudes.some(s => s.path === '/api/juego/progreso'), false);
});

test('Error consultando progreso conserva listado; reintentar comprueba el desbloqueo', async t => {
  let disponible = false;
  const v = await abrirPantalla(browser, '/disenos.html', { responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/juego/progreso') return disponible ? { json: { modoLibreDesbloqueado: true } } : { status: 500, json: {} };
    if (path === '/api/juego/escenarios') return { json: catalogo(true) };
  }});
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.locator('#listaMisDisenos[aria-busy=false]').waitFor();
  assert.equal(await p.locator('#listaMisDisenos > li').count(), 1);
  assert.equal(await p.locator('#irDisenoLibre').isDisabled(), true);
  assert.equal(await p.getByRole('button', { name: 'Volver a cargar' }).isVisible(), true);
  disponible = true;
  await p.getByRole('button', { name: 'Volver a cargar' }).click();
  await p.locator('#irDisenoLibre:not(:disabled)').waitFor();
});
