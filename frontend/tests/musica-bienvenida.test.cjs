const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL, args: ['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await navegador?.close(); });
const audio = 'audio[data-musica-metronet]';
const pista = '/audio/welcome-theme.mp3';

async function abrir(t, rol = 'JUGADOR', opciones = {}) {
  const vista = await abrirPantalla(navegador, rol === 'ADMIN' ? '/admin-login.html' : '/login.html', {
    ...opciones, responder: req => {
      if (/\/auth\/login/.test(req.url())) return opciones.invalido
        ? { status: 401, json: { detail: 'Credenciales incorrectas.' } }
        : { json: { token: 'sesion-local-de-prueba', usuario: { idUsuario: 7, nombre: 'Ana', rol } } };
      if (/\/auth\/logout/.test(req.url())) return { status: 204 };
      return null;
    },
  });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  vista.pagina.setDefaultTimeout(45000);
  return vista;
}
async function ingresar(p, rol = 'JUGADOR') {
  await p.locator(rol === 'ADMIN' ? '#usuario' : '#email').fill(rol === 'ADMIN' ? 'operador' : 'ana@example.test');
  await p.locator('#password').fill('Prueba1!');
  await p.locator(rol === 'ADMIN' ? '#loginAdminButton' : '#loginButton').click();
  await p.locator('.metronet-bienvenida').waitFor();
}
async function sonando(p) {
  await p.waitForFunction(() => {
    const a = document.querySelector('audio[data-musica-metronet]');
    return a?.getAttribute('src') === '/audio/welcome-theme.mp3' && !a.paused && a.currentTime > 0 && a.volume > 0;
  });
}

for (const rol of ['JUGADOR', 'ADMIN']) test(`${rol}: un solo MP3 sin bucle acompaña la escena breve y navega una vez`, async t => {
  const { pagina: p, solicitudes } = await abrir(t, rol);
  await p.evaluate(() => {
    window.addEventListener('pagehide', () => {
      const a = document.querySelector('audio[data-musica-metronet]');
      sessionStorage.setItem('prueba:fin-audio', JSON.stringify({ src: a?.getAttribute('src'), tiempo: a?.currentTime, duracion: a?.duration, fin: Date.now() }));
    });
  });
  const navegaciones = [];
  p.on('framenavigated', f => { if (f === p.mainFrame()) navegaciones.push(new URL(f.url()).pathname); });
  await ingresar(p, rol); await sonando(p);
  assert.equal(await p.locator(audio).count(), 1);
  assert.equal(await p.locator(audio).evaluate(a => a.loop), false);
  const duracion = await p.locator(audio).evaluate(a => a.duration);
  assert.ok(duracion > 32.5 && duracion < 32.7);
  await p.waitForURL(rol === 'ADMIN' ? '**/admin.html' : '**/inicio.html');
  const fin = await p.evaluate(() => JSON.parse(sessionStorage.getItem('prueba:fin-audio')));
  assert.equal(fin.src, pista);
  assert.ok(fin.tiempo >= 8.5 && fin.tiempo < 13, 'La música suena durante el viaje visual y se corta al salir');
  assert.ok(Date.now() - fin.fin < 1500);
  assert.deepEqual(navegaciones, [rol === 'ADMIN' ? '/admin.html' : '/inicio.html']);
  assert.equal(solicitudes.filter(s => s.path.startsWith('/auth/login')).length, 1);
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/menu-theme.mp3');
});

test('Login inválido no carga la pista de bienvenida', async t => {
  const { pagina: p } = await abrir(t, 'JUGADOR', { invalido: true });
  await p.locator('#email').fill('ana@example.test'); await p.locator('#password').fill('Prueba1!');
  await p.locator('#loginButton').click(); await p.locator('#mensaje.error').waitFor();
  assert.equal(await p.locator('.metronet-bienvenida').count(), 0);
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/extra-theme.mp3');
  assert.equal(await p.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('welcome-theme'))), false);
});

test('Continuar, logout y nuevo login detienen la pista y la reinician desde cero', async t => {
  const { pagina: p } = await abrir(t);
  for (let vez = 0; vez < 2; vez++) {
    await ingresar(p); await sonando(p);
    assert.ok(await p.locator(audio).evaluate(a => a.currentTime < 2));
    await p.locator(audio).evaluate(a => { a.currentTime = 5; });
    await p.locator('[data-continuar-bienvenida]').click();
    await p.waitForURL('**/inicio.html');
    assert.equal(await p.locator(audio).getAttribute('src'), '/audio/menu-theme.mp3');
    const posiciones = await p.evaluate(() => JSON.parse(sessionStorage.getItem('metronet:musica:posiciones')));
    assert.equal(posiciones[pista], undefined);
    if (vez === 0) {
      await p.locator('.metronet-navegacion__usuario > summary').click();
      await p.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
      await p.waitForURL('**/login.html');
    }
  }
});

for (const fallo of ['silencio', 'volumen-cero', 'autoplay', 'archivo', 'play-pendiente']) test(`Sin bloqueo del acceso: ${fallo}`, async t => {
  const { pagina: p } = await abrir(t, 'JUGADOR', { reducedMotion: 'reduce' });
  if (fallo === 'archivo') await p.route('**/audio/welcome-theme.mp3', route => route.fulfill({ status: 404 }));
  if (fallo === 'silencio' || fallo === 'volumen-cero') await p.evaluate(async fallo => {
    const { gestorMusica } = await import('/src/audio/GestorMusica.js');
    if (fallo === 'silencio') gestorMusica.establecerSilencio(true);
    else gestorMusica.establecerVolumen(0);
  }, fallo);
  if (fallo === 'autoplay' || fallo === 'play-pendiente') await p.evaluate(fallo => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.getAttribute('src')?.includes('welcome-theme')) return fallo === 'autoplay'
        ? Promise.reject(new DOMException('Autoplay bloqueado', 'NotAllowedError')) : new Promise(() => {});
      return original.call(this);
    };
  }, fallo);
  const inicio = Date.now();
  await ingresar(p); await p.waitForURL('**/inicio.html', { timeout: 4000 });
  assert.ok(Date.now() - inicio < 4000);
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/menu-theme.mp3');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('sesionUsuario')).usuario.rol), 'JUGADOR');
});

test('Audio interrumpido no prolonga la escena visual', async t => {
  const { pagina: p } = await abrir(t);
  // Instalar el reloj después del fade de auth evita cambiar su performance.now a mitad de entrada.
  await p.waitForFunction(() => document.querySelector('audio')?.volume === .35);
  await p.clock.install();
  await ingresar(p);
  await sonando(p);
  await p.locator(audio).evaluate(a => a.pause());
  await p.clock.fastForward(8000);
  assert.equal(await p.locator('.metronet-bienvenida').isVisible(), true);
  await p.clock.fastForward(2500);
  await p.waitForURL('**/inicio.html');
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/menu-theme.mp3');
});

test('El tren avanza a ritmo visual y se pausa mientras la pestaña está oculta', async t => {
  const { pagina: p } = await abrir(t);
  await ingresar(p); await sonando(p);
  await p.waitForFunction(() => document.querySelector('.metronet-bienvenida')?.dataset.fase === 'viaje');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await p.waitForTimeout(80);
  const cuadro = await p.locator('canvas').evaluate(c => c.toDataURL());
  await p.waitForTimeout(400);
  assert.equal(await p.locator('canvas').evaluate(c => c.toDataURL()), cuadro);
  await p.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await sonando(p);
  await p.waitForURL('**/inicio.html');
});

test('Ocultar la pestaña 18 segundos no consume el tiempo visible de bienvenida', async t => {
  const { pagina: p } = await abrir(t);
  await p.waitForFunction(() => document.querySelector('audio')?.volume === .35);
  await p.clock.install();
  await ingresar(p); await sonando(p);
  await p.clock.fastForward(3000);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const cuadro = await p.locator('.metronet-bienvenida canvas').evaluate(c => c.toDataURL());
  await p.clock.fastForward(18000);
  assert.equal(new URL(p.url()).pathname, '/login.html');
  assert.equal(await p.locator('.metronet-bienvenida').isVisible(), true);
  assert.equal(await p.locator('.metronet-bienvenida canvas').evaluate(c => c.toDataURL()), cuadro);
  await p.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await p.clock.fastForward(7500);
  await p.waitForURL('**/inicio.html');
});
