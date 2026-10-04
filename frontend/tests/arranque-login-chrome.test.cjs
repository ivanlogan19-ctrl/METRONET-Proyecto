const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');

const base = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrir({ sesion = true } = {}) {
  const contexto = await navegador.newContext();
  if (sesion) await contexto.addInitScript(() => {
    try { localStorage.setItem('sesionUsuario', JSON.stringify({ token: 'sesion-de-prueba',
      usuario: { idUsuario: 7, nombre: 'Prueba', rol: 'JUGADOR' } })); } catch { /* about:blank */ }
  });
  await contexto.route(url => url.port === '8080', ruta => {
    const solicitud = ruta.request(), path = new URL(solicitud.url()).pathname;
    if (solicitud.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: {
      'access-control-allow-origin': base, 'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    } });
    if (path === '/auth/login') return ruta.fulfill({ json: { token: 'sesion-nueva',
      usuario: { idUsuario: 7, nombre: 'Prueba', rol: 'JUGADOR' } }, headers: { 'access-control-allow-origin': base } });
    return ruta.abort();
  });
  const pagina = await contexto.newPage();
  return { contexto, pagina };
}

test('URL raíz, profunda y documento=1 abiertos en nueva pestaña muestran login sin borrar sesión', async () => {
  for (const ruta of ['/', '/?idDiseno=7&idIntento=8#partida', '/simulacion.html?idDiseno=7',
    '/inicio.html?documento=1', '/?idDiseno=7&idIntento=8&documento=1']) {
    const { contexto, pagina } = await abrir();
    try {
      await pagina.goto(`${base}${ruta}`);
      await pagina.frameLocator('#pantalla-metronet').locator('#loginForm').waitFor();
      assert.equal(new URL(pagina.url()).pathname, '/login.html');
      assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem('sesionUsuario'))?.token), 'sesion-de-prueba');
    } finally { await contexto.close(); }
  }
});

test('Sin sesión previa, una URL protegida también empieza en login', async () => {
  for (const ruta of ['/', '/inicio.html?documento=1']) {
    const { contexto, pagina } = await abrir({ sesion: false });
    try {
      await pagina.goto(`${base}${ruta}`);
      await pagina.frameLocator('#pantalla-metronet').locator('#loginForm').waitFor();
      assert.equal(new URL(pagina.url()).pathname, '/login.html');
      assert.equal(await pagina.evaluate(() => localStorage.getItem('sesionUsuario')), null);
    } finally { await contexto.close(); }
  }
});

test('El login del respaldo HTML continúa a Inicio sin bucle', async () => {
  const { contexto, pagina } = await abrir();
  try {
    await pagina.goto(`${base}/login.html?documento=1`);
    await pagina.locator('#loginForm').waitFor();
    await pagina.locator('#email').fill('prueba@example.test');
    await pagina.locator('#password').fill('Prueba1!');
    await pagina.locator('#loginButton').click();
    await pagina.locator('[data-continuar-bienvenida]').click();
    await pagina.waitForURL(`${base}/inicio.html`);
    await pagina.locator('[data-navegacion-global] nav').waitFor();
    assert.equal(await pagina.locator('iframe').count(), 0);
    await pagina.locator('.metronet-navegacion__enlaces').getByRole('link', { name: 'Niveles' }).click();
    await pagina.waitForURL(`${base}/escenarios.html`);
    await pagina.locator('[data-navegacion-global] nav').waitFor();
    assert.equal(await pagina.locator('iframe').count(), 0);
    await pagina.reload();
    await pagina.frameLocator('#pantalla-metronet').locator('#loginForm').waitFor();
    assert.equal(new URL(pagina.url()).pathname, '/login.html');
  } finally { await contexto.close(); }
});
