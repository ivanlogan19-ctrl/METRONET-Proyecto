// MP3 real y formularios reales con respuestas HTTP controladas; no modifica cuentas.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL, args: ['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await navegador?.close(); });
const audio = 'audio[data-musica-metronet]';
const rutas = ['/login.html', '/admin-login.html', '/registro.html', '/recuperar-contrasena.html', '/verificar-codigo.html', '/nueva-contrasena.html'];

async function abrir(t, ruta = '/login.html', opciones = {}) {
  const vista = await abrirPantalla(navegador, ruta, opciones);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  vista.pagina.setDefaultTimeout(45000);
  return vista;
}
async function reproduciendo(p) {
  await p.waitForFunction(() => {
    const a = document.querySelector('audio[data-musica-metronet]');
    return a && !a.paused && a.currentTime > 0 && a.volume > 0;
  });
}
async function ingresar(p, rol) {
  await p.locator(rol === 'ADMIN' ? '#usuario' : '#email').fill(rol === 'ADMIN' ? 'operador' : 'ana@example.test');
  await p.locator('#password').fill('Prueba1!');
  await p.locator(rol === 'ADMIN' ? '#loginAdminButton' : '#loginButton').click();
}

for (const ruta of rutas) test(`Acceso sin sesión: Extra y control disponible en ${ruta}`, async t => {
  const { pagina: p, solicitudes } = await abrir(t, ruta);
  await reproduciendo(p);
  assert.equal(await p.locator(audio).count(), 1);
  const datos = await p.locator(audio).evaluate(a => ({ src: a.getAttribute('src'), loop: a.loop, duracion: a.duration }));
  assert.equal(datos.src, '/audio/extra-theme.mp3');
  assert.equal(datos.loop, true);
  assert.ok(datos.duracion > 32 && datos.duracion < 32.2);
  assert.equal(await p.locator('[data-control-musica]').count(), 1);
  assert.equal(await p.evaluate(() => localStorage.getItem('sesionUsuario') || localStorage.getItem('sesionAdministrador')), null);
  assert.deepEqual(solicitudes, [], 'La música no agrega llamadas a backend');
  assert.equal(await p.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('menu-theme'))), false);
});

test('Navegar entre formularios, recargar y completar el loop conserva una sola pista', async t => {
  const { pagina: p } = await abrir(t);
  await reproduciendo(p);
  await p.locator(audio).evaluate(a => { a.currentTime = 3; });
  await p.getByRole('link', { name: 'Crear cuenta', exact: true }).click();
  await p.waitForURL('**/registro.html'); await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 3));
  await p.reload(); await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 3));
  await p.locator(audio).evaluate(a => { a.currentTime = a.duration - .3; });
  await p.waitForFunction(() => { const a = document.querySelector('audio[data-musica-metronet]'); return !a.paused && a.currentTime > .1 && a.currentTime < 2; });
  await p.getByRole('link', { name: 'Leer el uso de mis datos' }).click();
  await p.waitForURL('**/privacidad.html');
  assert.equal(await p.locator(audio).count(), 0);
});

for (const rol of ['JUGADOR', 'ADMIN']) test(`${rol}: error de login conserva música; bienvenida y menú la detienen; logout la recupera`, async t => {
  let accesoValido = false;
  const { pagina: p, solicitudes } = await abrir(t, rol === 'ADMIN' ? '/admin-login.html' : '/login.html', {
    reducedMotion: 'reduce', responder: req => {
      if (/\/auth\/login/.test(req.url())) return accesoValido
        ? { json: { token: 'sesion-local-de-prueba', usuario: { idUsuario: 7, nombre: 'Ana', rol } } }
        : { status: 401, json: { detail: 'Credenciales incorrectas.' } };
      if (/\/auth\/logout/.test(req.url())) return { status: 204 };
      return null;
    },
  });
  await reproduciendo(p); await ingresar(p, rol);
  await p.locator('#mensaje.error').waitFor(); await reproduciendo(p);
  assert.equal(await p.locator('.metronet-bienvenida').count(), 0);
  accesoValido = true;
  await ingresar(p, rol);
  await p.locator('.metronet-bienvenida').waitFor();
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/welcome-theme.mp3');
  assert.equal(await p.locator(audio).evaluate(a => a.loop), false);
  await p.evaluate(() => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await p.waitForURL(rol === 'ADMIN' ? '**/admin.html' : '**/inicio.html');
  await reproduciendo(p);
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/menu-theme.mp3');
  assert.equal(solicitudes.filter(s => s.path.startsWith('/auth/login')).length, 2);
  await p.locator('.metronet-navegacion__usuario > summary').click();
  await p.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await p.waitForURL('**/login.html'); await reproduciendo(p);
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/extra-theme.mp3');
});

test('Volumen y silencio persisten; eventos de almacenamiento sin sesión no detienen el contexto auth', async t => {
  const { pagina: p } = await abrir(t);
  await reproduciendo(p);
  await p.locator('.metronet-audio summary').click();
  await p.getByLabel('Silenciar música').check();
  await p.getByRole('slider', { name: 'Volumen de música' }).fill('42');
  await p.reload();
  await p.locator(audio).waitFor({ state: 'attached' });
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await p.locator('.metronet-audio summary').click();
  assert.equal(await p.getByRole('slider').inputValue(), '42');
  await p.getByLabel('Silenciar música').uncheck(); await reproduciendo(p);
  await p.evaluate(() => {
    localStorage.setItem('metronet:musica:preferencias', JSON.stringify({ volumen: .2, silenciado: false }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'metronet:musica:preferencias' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'sesionUsuario' }));
  });
  await p.waitForFunction(() => { const a = document.querySelector('audio[data-musica-metronet]'); return !a.paused && a.volume === .2; });
});

test('Autoplay bloqueado ofrece activación accesible sin impedir escribir en el formulario', async t => {
  const { pagina: p, contexto } = await abrir(t);
  await contexto.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    let primera = true;
    HTMLMediaElement.prototype.play = function () {
      if (primera) { primera = false; return Promise.reject(new DOMException('Bloqueado para prueba', 'NotAllowedError')); }
      return original.call(this);
    };
  });
  await p.reload();
  await p.locator('.metronet-audio summary').click();
  await p.getByRole('button', { name: 'Activar música' }).click(); await reproduciendo(p);
  await p.keyboard.press('Escape');
  await p.locator('#email').fill('ana@example.test');
  assert.equal(await p.locator('#email').inputValue(), 'ana@example.test');
});

test('MP3 ausente no bloquea el login ni la bienvenida', async t => {
  const { pagina: p } = await abrir(t, '/login.html', { reducedMotion: 'reduce', responder: req => /\/auth\/login$/.test(req.url())
    ? { json: { token: 'sesion-local-de-prueba', usuario: { idUsuario: 7, nombre: 'Ana', rol: 'JUGADOR' } } } : null });
  await p.route('**/audio/extra-theme.mp3', route => route.fulfill({ status: 404 }));
  await p.reload();
  await p.waitForFunction(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.obtenerEstado().error);
  await ingresar(p, 'JUGADOR');
  await p.waitForURL('**/inicio.html');
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/menu-theme.mp3');
});

test('Registro conserva su validación, solicitud y retorno a login con la misma pista', async t => {
  const { pagina: p, solicitudes } = await abrir(t, '/registro.html', { responder: req => /\/auth\/registro$/.test(req.url()) ? { status: 201, json: { idUsuario: 7 } } : null });
  await reproduciendo(p);
  await p.locator('#registroButton').click();
  assert.deepEqual(solicitudes, []);
  for (const [id, valor] of Object.entries({ nombre: 'Ana', apellido: 'Prueba', email: 'ana@example.test', password: 'Prueba1!' })) await p.locator(`#${id}`).fill(valor);
  await p.locator('#aceptaDatos').check();
  await p.locator('#registroButton').click();
  await p.waitForURL('**/login.html'); await reproduciendo(p);
  assert.deepEqual(solicitudes.map(s => [s.path, s.method]), [['/auth/registro', 'POST']]);
});

test('Recuperación, código y cambio de contraseña mantienen música y contratos existentes', async t => {
  const { pagina: p, solicitudes } = await abrir(t, '/recuperar-contrasena.html', { responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/auth/recuperar-contrasena') return { json: { idSolicitud: 99 } };
    if (path.endsWith('/verificar-codigo')) return { json: { idSolicitud: 99, tokenRecuperacion: 'prueba-local' } };
    if (path.endsWith('/cambiar-contrasena')) return { status: 204 };
    return null;
  } });
  await reproduciendo(p);
  await p.locator('#email').fill('ana@example.test');
  await p.locator('#botonRecuperar').click();
  await p.waitForURL('**/verificar-codigo.html'); await reproduciendo(p);
  await p.locator('#codigo').fill('123456');
  await p.locator('#botonVerificar').click();
  await p.waitForURL('**/nueva-contrasena.html'); await reproduciendo(p);
  await p.locator('#nuevaContrasena').fill('Prueba1!');
  await p.locator('#confirmarContrasena').fill('Distinta1!');
  await p.locator('#botonCambiarContrasena').click();
  await p.locator('#mensaje.error').waitFor();
  assert.equal(solicitudes.length, 2);
  await p.locator('#confirmarContrasena').fill('Prueba1!');
  await p.locator('#botonCambiarContrasena').click();
  await p.waitForURL('**/login.html'); await reproduciendo(p);
  assert.deepEqual(solicitudes.map(s => [s.path, s.method]), [
    ['/auth/recuperar-contrasena', 'PATCH'],
    ['/auth/recuperar-contrasena/verificar-codigo', 'POST'],
    ['/auth/recuperar-contrasena/cambiar-contrasena', 'PATCH'],
  ]);
});

for (const width of [320, 390, 768, 1440]) test(`Audio en formularios: teclado, controles y mapa de clics a ${width}px`, async t => {
  const { pagina: p } = await abrir(t, '/registro.html', { viewport: { width, height: 900 } });
  const formulario = await p.locator('form').boundingBox();
  const logo = await p.locator('.auth-card img').first().boundingBox();
  assert.equal(await p.locator('.auth-card > .metronet-audio--autenticacion:first-child').count(),1);
  const acceso = await p.locator('.metronet-audio summary').boundingBox();
  assert.ok(acceso.y + acceso.height <= logo.y);
  assert.ok(acceso.width >= 44 && acceso.height >= 44);
  await p.locator('.metronet-audio summary').press('Enter');
  await p.locator('.metronet-audio__panel:popover-open').waitFor();
  assert.deepEqual(await p.locator('form').boundingBox(),formulario);
  assert.deepEqual(await p.locator('.auth-card img').first().boundingBox(),logo);
  const control = await p.locator('.metronet-audio summary').boundingBox();
  const caja = await p.locator('.metronet-audio__panel').boundingBox();
  assert.ok(Math.abs(caja.y - control.y - control.height - 6) < 2);
  assert.ok(caja.x >= 0 && caja.x + caja.width <= width && caja.y >= 0 && caja.y + caja.height <= 900);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const slider = p.getByRole('slider', { name: 'Volumen de música' });
  assert.equal(await slider.evaluate(e => { const r = e.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === e; }), true);
  await p.getByLabel('Silenciar música').focus(); await p.keyboard.press('Space');
  assert.equal(await p.getByLabel('Silenciar música').isChecked(), true);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.metronet-audio').getAttribute('open'), null);
});
