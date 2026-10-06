const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');

let navegador;
const base = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function preparar(t, sesionJugador = true) {
  const contexto = await navegador.newContext({ reducedMotion: 'reduce' });
  t.after(() => contexto.close());
  await contexto.route('**/iniciar-contenedor.js', ruta => ruta.fulfill({ contentType: 'application/javascript', body: '' }));
  if (sesionJugador) await contexto.addInitScript(() => {
    localStorage.setItem('sesionUsuario', JSON.stringify({ token: 'sesion-prueba', usuario: { idUsuario: 7, nombre: 'Ana', rol: 'JUGADOR' } }));
  });
  let mantenimiento = true;
  const peticiones = [];
  await contexto.route('**/api/**', ruta => {
    const path = new URL(ruta.request().url()).pathname;
    peticiones.push(path);
    if (path === '/api/estado') return ruta.fulfill({ json: { mantenimiento }, headers: { 'access-control-allow-origin': '*' } });
    return ruta.fulfill({ status: 503, json: { detail: 'METRONET está en mantenimiento.' }, headers: { 'access-control-allow-origin': '*' } });
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', error => errores.push(error.message));
  t.after(() => assert.deepEqual(errores, []));
  return { pagina, peticiones, desactivar: () => { mantenimiento = false; } };
}

test('Una sesión de jugador solo ve mantenimiento y vuelve al juego al desactivarlo', async t => {
  const { pagina, peticiones, desactivar } = await preparar(t);
  await pagina.goto(`${base}/inicio.html?documento=1`);
  await pagina.waitForURL('**/mantenimiento.html');
  assert.equal(await pagina.getByRole('heading', { name: 'METRONET en mantenimiento' }).isVisible(), true);
  assert.equal(await pagina.locator('.metronet-inicio__tarjeta').count(), 0);
  assert.equal(peticiones.includes('/api/juego/progreso'), false);
  assert.equal(await pagina.locator('.mantenimiento-tren').evaluate(elemento => getComputedStyle(elemento).animationName), 'none');
  desactivar();
  await pagina.evaluate(() => window.dispatchEvent(new Event('focus')));
  await pagina.waitForURL('**/inicio.html');
});

test('El acceso desde el formulario muestra el aviso antes de iniciar sesión', async t => {
  const { pagina } = await preparar(t, false);
  await pagina.goto(`${base}/login.html?documento=1`);
  await pagina.waitForURL('**/mantenimiento.html');
  assert.equal(await pagina.getByText('Disculpá las molestias.', { exact: false }).isVisible(), true);
  assert.equal(await pagina.locator('#loginForm').count(), 0);
});
