const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await browser?.close(); });

for (const width of [390, 1440]) test(`Jugador sin campaña: menú y dirección directa bloqueados a ${width}px`, async t => {
  const v = await abrirPantalla(browser, '/disenos.html', { viewport: { width, height: 900 } });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.getByText(/Completá todos los niveles de una campaña para acceder a Mis diseños/).waitFor();
  assert.equal(await p.locator('#crearDiseno').isVisible(), false);
  assert.equal(await p.locator('#buscarDisenos').isVisible(), false);
  assert.equal(await p.locator('#listaMisDisenos > li').count(), 0);
  assert.equal(v.solicitudes.some(s => s.path === '/api/simulaciones'), false);
  if (width < 600) await p.locator('.metronet-navegacion__usuario > summary').click();
  const enlace = p.locator('.metronet-navegacion a:visible').filter({ hasText: 'Mis diseños' });
  assert.equal(await enlace.getAttribute('aria-disabled'), 'true');
  assert.equal(await enlace.getAttribute('href'), null);
  await enlace.press('Enter');
  assert.equal(new URL(p.url()).pathname, '/disenos.html');
  await p.getByRole('link', { name: 'Continuar los niveles' }).click();
  await p.waitForURL('**/escenarios.html');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

for (const administrador of [false, true]) test(`${administrador ? 'ADMIN sin campaña' : 'JUGADOR con campaña histórica'} conserva acceso`, async t => {
  const v = await abrirPantalla(browser, '/disenos.html', { administrador, responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/juego/progreso') return { json: { numeroCampanaActual: 2, campanaCompletada: false, modoLibreDesbloqueado: true } };
    if (path === '/api/juego/escenarios') return { json: [{ numero: null, idEscenario: 44, desbloqueado: true }] };
  }});
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.locator('#crearDiseno:not([hidden])').waitFor();
  assert.equal(await p.locator('.metronet-navegacion__enlaces a').filter({ hasText: 'Mis diseños' }).getAttribute('aria-disabled'), null);
  assert.ok(v.solicitudes.some(s => s.path === (administrador ? '/api/admin/disenos' : '/api/simulaciones')));
  if (administrador) assert.equal(v.solicitudes.some(s => s.path === '/api/juego/progreso'), false);
});

test('Error consultando progreso cierra acceso; reintentar comprueba el desbloqueo nuevo', async t => {
  let disponible = false;
  const v = await abrirPantalla(browser, '/disenos.html', { responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/juego/progreso') return disponible ? { json: { modoLibreDesbloqueado: true } } : { status: 500, json: {} };
    if (path === '/api/juego/escenarios') return { json: [{ numero: null, desbloqueado: true }] };
  }});
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.getByText('No se pudo verificar el acceso a Mis diseños. Volvé a intentarlo.').waitFor();
  assert.equal(v.solicitudes.some(s => s.path === '/api/simulaciones'), false);
  disponible = true;
  await p.getByRole('button', { name: 'Volver a cargar' }).click();
  await p.locator('#crearDiseno:not([hidden])').waitFor();
});
