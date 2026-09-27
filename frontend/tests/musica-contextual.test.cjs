const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL, args: ['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await navegador?.close(); });
const audio = 'audio[data-musica-metronet]';

async function abrir(t, ruta = 'editor', opciones = {}) {
  const vista = ruta === 'editor' ? await abrirEditor(navegador, opciones) : await abrirPantalla(navegador, ruta, opciones);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  return vista;
}
async function abrirMusica(p) {
  if(await p.locator('.metronet-hud').count()){
    if(!await p.locator('.metronet-hud').evaluate(e=>e.open)) await p.locator('.metronet-hud>summary').click();
    await p.locator('[data-hud-vista=musica]').click();
  } else await p.locator('.metronet-audio summary').click();
}
async function reproduciendo(p, pista = '/audio/gameplay-theme.mp3') {
  await p.waitForFunction(pista => { const a = document.querySelector('audio[data-musica-metronet]'); return a?.getAttribute('src') === pista && !a.paused && a.currentTime > 0 && a.volume === 0.35; }, pista);
}
async function gestor(p, accion, valor) {
  return p.evaluate(async ({ accion, valor }) => {
    const { gestorMusica } = await import('/src/audio/GestorMusica.js');
    return gestorMusica[accion](valor);
  }, { accion, valor });
}

for (const ruta of ['/login.html', '/admin-login.html', '/inicio.html', '/escenarios.html', '/ranking.html', '/perfil.html', '/admin.html', '/simulacion.html']) {
  test(`La pista de gameplay no se carga fuera del juego: ${ruta}`, async t => {
    const { pagina: p } = await abrir(t, ruta === '/simulacion.html' ? '/inicio.html' : ruta);
    if (ruta === '/simulacion.html') { await p.goto('http://127.0.0.1:5173/simulacion.html'); await p.locator('#estadoVacio').waitFor(); }
    assert.equal(await p.locator(`${audio}[src="/audio/gameplay-theme.mp3"]`).count(), 0);
    const recursos = await p.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('gameplay-theme')).length);
    assert.equal(recursos, 0);
    if (!ruta.includes('login')) {
      await reproduciendo(p, '/audio/menu-theme.mp3');
      assert.equal(await p.locator(audio).count(), 1);
      assert.equal(await p.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('auth-theme'))), false);
    }
  });
}

test('MP3 real en modo libre: una instancia, 35 %, loop y final sin detenerse', async t => {
  const { pagina: p } = await abrir(t);
  await reproduciendo(p);
  const inicial = await p.locator(audio).evaluate(a => ({ duration: a.duration, loop: a.loop, volumen: a.volume, src: a.getAttribute('src') }));
  assert.ok(inicial.duration > 167 && inicial.duration < 169);
  assert.equal(inicial.loop, true); assert.equal(inicial.volumen, .35);
  assert.equal(inicial.src, '/audio/gameplay-theme.mp3');
  await p.locator(audio).evaluate(a => { a.currentTime = a.duration - .4; });
  await p.waitForFunction(() => { const a = document.querySelector('audio[data-musica-metronet]'); return !a.paused && a.currentTime > .1 && a.currentTime < 2; });
  for (let i = 0; i < 5; i++) await gestor(p, 'establecerContexto', 'gameplay');
  assert.equal(await p.locator(audio).count(), 1);
});

test('Menús: MP3 real en bucle, navegación y recarga conservan posición sin superponer pistas', async t => {
  const { pagina: p } = await abrir(t, '/inicio.html', {
    administrador: true,
    responder: request => new URL(request.url()).pathname === '/auth/perfil'
      ? { json: { nombre: 'Ana', apellido: 'Prueba', email: 'ana@example.test', rol: 'ADMIN' } } : null,
  });
  await reproduciendo(p, '/audio/menu-theme.mp3');
  const datos = await p.locator(audio).evaluate(a => ({ duracion: a.duration, loop: a.loop }));
  assert.ok(datos.duracion > 151 && datos.duracion < 153);
  assert.equal(datos.loop, true);
  await p.locator(audio).evaluate(a => { a.currentTime = 30; });
  for (const ruta of ['escenarios', 'ranking', 'perfil', 'admin', 'inicio']) {
    await p.goto(`http://127.0.0.1:5173/${ruta}.html`);
    await reproduciendo(p, '/audio/menu-theme.mp3');
    assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 30));
    assert.equal(await p.locator(audio).count(), 1);
  }
  await p.reload(); await reproduciendo(p, '/audio/menu-theme.mp3');
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 30));
  await p.locator(audio).evaluate(a => { a.currentTime = a.duration - .3; });
  await p.waitForFunction(() => { const a = document.querySelector('audio'); return !a.paused && a.currentTime > .1 && a.currentTime < 2; });
});

test('Lista de diseños → edición libre → lista recupera cada canción desde su posición', async t => {
  const { pagina: p } = await abrir(t);
  await reproduciendo(p);
  await p.locator(audio).evaluate(a => { a.currentTime = 28; });
  await p.goto('http://127.0.0.1:5173/');
  await reproduciendo(p, '/audio/menu-theme.mp3');
  assert.equal(await p.locator('[data-editor-activo]').isHidden(), true);
  await p.locator(audio).evaluate(a => { a.currentTime = 42; });
  await p.goto('http://127.0.0.1:5173/?idDiseno=77');
  await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 28));
  assert.equal(await p.locator('[data-editor-activo]').isVisible(), true);
  await p.goto('http://127.0.0.1:5173/');
  await reproduciendo(p, '/audio/menu-theme.mp3');
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 42));
  assert.equal(await p.locator(audio).count(), 1);
});

test('Selector de simulación usa menú; abrir una red cambia a gameplay', async t => {
  const { pagina: p } = await abrir(t, '/inicio.html', { responder: request => {
    const ruta = new URL(request.url()).pathname;
    if (ruta === '/api/juego/escenarios') return { json: [] };
    if (ruta === '/api/juego/progreso') return { json: { escenarios: [], modoLibreDesbloqueado: true } };
    return null;
  } });
  await p.goto('http://127.0.0.1:5173/simulacion.html');
  await reproduciendo(p, '/audio/menu-theme.mp3');
  await p.locator(audio).evaluate(a => { a.currentTime = 20; });
  await p.locator('#estadoVacio').getByRole('link',{name:'Mis diseños'}).click();
  await p.getByRole('link',{name:'Simular diseño: Red de Montevideo'}).click();
  await reproduciendo(p);
  assert.equal(await p.locator('#panelSimulacion').isVisible(), true);
  await p.goto('http://127.0.0.1:5173/inicio.html');
  await reproduciendo(p, '/audio/menu-theme.mp3');
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 20));
});

test('La preparación inicial usa Donkey Kong y al cancelar recupera el menú', async t => {
  const { pagina: p } = await abrir(t, '/escenarios.html');
  await reproduciendo(p, '/audio/menu-theme.mp3');
  await p.locator(audio).evaluate(a => { a.currentTime = 15; });
  await p.evaluate(async () => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.preparacionMenu = crearPreparacionNivel({ numero: 1, nombre: 'Red inicial' });
  });
  await reproduciendo(p, '/audio/victory-theme.mp3');
  await p.evaluate(() => preparacionMenu.cerrar());
  await reproduciendo(p, '/audio/menu-theme.mp3');
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 15));
});

test('Audio de menú ausente no impide navegar ni iniciar el juego', async t => {
  const { pagina: p } = await abrir(t, '/inicio.html', { responder: request => new URL(request.url()).pathname === '/api/juego/escenarios' ? { json: [] } : null });
  await p.route('**/audio/menu-theme.mp3', route => route.fulfill({ status: 404 }));
  await p.reload();
  await p.waitForFunction(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.obtenerEstado().error);
  assert.equal(await p.locator('.metronet-inicio__tarjeta').first().isVisible(), true);
  await p.goto('http://127.0.0.1:5173/simulacion.html?idDiseno=77');
  await reproduciendo(p);
});

test('Menú: bloqueo de autoplay y silencio se recuperan con los controles existentes', async t => {
  const { pagina: p, contexto } = await abrir(t, '/inicio.html');
  await contexto.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    let primera = true;
    HTMLMediaElement.prototype.play = function () {
      if (primera) { primera = false; return Promise.reject(new DOMException('Autoplay bloqueado', 'NotAllowedError')); }
      return original.call(this);
    };
  });
  await p.reload();
  await abrirMusica(p);
  await p.getByRole('button', { name: 'Activar música' }).click();
  await reproduciendo(p, '/audio/menu-theme.mp3');
  await p.getByLabel('Silenciar música').check();
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await p.getByLabel('Silenciar música').uncheck();
  await reproduciendo(p, '/audio/menu-theme.mp3');
});

test('Niveles y cambios internos conservan la pista y su posición', async t => {
  const { pagina: p } = await abrir(t, 'editor', { escenario: { idEscenario: 41, numero: 1, nombre: 'Red inicial', estado: 'DISPONIBLE', progreso: 0, desbloqueado: true, herramientasHabilitadas: { estaciones: true, lineas: true } } });
  await reproduciendo(p);
  await p.locator(audio).evaluate(a => { a.currentTime = 35; });
  await p.evaluate(async () => { for (let i = 0; i < 3; i++) await editorPrueba.abrirDiseno(77); });
  await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 35));
  assert.equal(await p.locator(audio).count(), 1);
});

test('Mapa → simulación → mapa y refresh recuperan posición, sin reiniciar', async t => {
  const { pagina: p } = await abrir(t, '/simulacion.html?idDiseno=77', { responder: request => new URL(request.url()).pathname === '/api/juego/escenarios' ? { json: [] } : null });
  await reproduciendo(p);
  await p.locator(audio).evaluate(a => { a.currentTime = 35; });
  await p.locator('#volverEdicion').click();
  await p.waitForURL('**/?idDiseno=77*');
  await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 35));
  await p.goto('http://127.0.0.1:5173/simulacion.html?idDiseno=77');
  await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 35));
  await p.reload(); await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 35));
  await p.goto('http://127.0.0.1:5173/inicio.html');
  await reproduciendo(p, '/audio/menu-theme.mp3');
  assert.equal(await p.locator(audio).count(), 1);
});

test('Mute y volumen persisten; volver de silencio no reinicia', async t => {
  const { pagina: p } = await abrir(t);
  await reproduciendo(p);
  await p.locator(audio).evaluate(a => { a.currentTime = 12; });
  await abrirMusica(p);
  await p.getByLabel('Silenciar música').check();
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await p.getByRole('slider', { name: 'Volumen de música' }).fill('42');
  await p.reload();
  await p.waitForSelector(audio, { state: 'attached' });
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await abrirMusica(p);
  assert.equal(await p.getByRole('slider', { name: 'Volumen de música' }).inputValue(), '42');
  assert.equal(await p.getByLabel('Silenciar música').isChecked(), true);
  await p.getByLabel('Silenciar música').uncheck();
  await p.waitForFunction(() => { const a = document.querySelector('audio[data-musica-metronet]'); return !a.paused && a.volume === .42 && a.currentTime >= 12; });
  await p.getByRole('slider', { name: 'Volumen de música' }).fill('0');
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
});

test('Donkey Kong en preparación; victoria usa la misma pista puntual y al cancelar recupera gameplay', async t => {
  const { pagina: p } = await abrir(t);
  await reproduciendo(p);
  await p.locator(audio).evaluate(a => { a.currentTime = 25; });
  await p.evaluate(async () => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.preparacionAudio = crearPreparacionNivel({ numero: 1, nombre: 'Red inicial' });
  });
  await reproduciendo(p, '/audio/victory-theme.mp3');
  assert.equal((await gestor(p, 'obtenerEstado')).contexto, 'inicioNivel');
  await p.evaluate(() => preparacionAudio.cerrar()); await reproduciendo(p);
  await p.evaluate(async () => {
    const { mostrarTransicionNivel } = await import('/src/educacion/PantallaTransicionNivel.js');
    window.victoriaAudio = mostrarTransicionNivel({ numero: 1, nombre: 'Red inicial' }, null, { puntaje: 100 });
  });
  await reproduciendo(p, '/audio/victory-theme.mp3');
  assert.equal(await p.locator(audio).evaluate(a => a.loop), false);
  await p.getByRole('button', { name: 'Revisar mi red' }).click(); await reproduciendo(p);
  await p.evaluate(async () => {
    const { gestorMusica: g } = await import('/src/audio/GestorMusica.js');
    const liberarA = g.usarContextoTemporal('loading');
    window.liberarB = g.usarContextoTemporal('transition');
    liberarA(); liberarA();
  });
  await reproduciendo(p);
  await p.evaluate(() => liberarB()); await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 25));
  assert.equal(await p.locator(audio).count(), 1);
});

test('Autoplay rechazado no bloquea; el siguiente gesto lo recupera', async t => {
  const { pagina: p } = await abrir(t, '/inicio.html');
  await p.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    let primera = true;
    HTMLMediaElement.prototype.play = function () {
      if (primera) { primera = false; return Promise.reject(new DOMException('Bloqueado por política de prueba', 'NotAllowedError')); }
      return original.call(this);
    };
  });
  await gestor(p, 'establecerContexto', 'gameplay');
  await p.waitForFunction(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.obtenerEstado().esperandoGesto);
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await p.locator('h1').click();
  await reproduciendo(p);
});

test('Archivo ausente y almacenamiento bloqueado no bloquean gameplay', async t => {
  const { pagina: p } = await abrir(t, '/inicio.html');
  await p.route('**/audio/gameplay-theme.mp3', route => route.fulfill({ status: 404 }));
  await p.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('metronet:musica')) throw new DOMException('Sin espacio', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await gestor(p, 'establecerContexto', 'gameplay');
  await p.waitForFunction(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.obtenerEstado().error);
  await gestor(p, 'establecerSilencio', true);
  await gestor(p, 'establecerVolumen', .2);
  assert.equal(await p.locator('.metronet-inicio__tarjeta').first().isVisible(), true);
});

test('Cambiar rápidamente de contexto mientras play está pendiente recupera el audio', async t => {
  const { pagina: p } = await abrir(t, '/inicio.html');
  await p.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    let primera = true;
    HTMLMediaElement.prototype.play = function () {
      if (primera) {
        primera = false;
        return new Promise((resolve, reject) => { window.interrumpirPlay = () => reject(new DOMException('Cambio rápido', 'AbortError')); });
      }
      return original.call(this);
    };
  });
  await gestor(p, 'establecerContexto', 'gameplay');
  await p.waitForFunction(() => Boolean(window.interrumpirPlay));
  await p.evaluate(async () => {
    const { gestorMusica: g } = await import('/src/audio/GestorMusica.js');
    const liberar = g.usarContextoTemporal('loading');
    liberar(); interrumpirPlay();
  });
  await p.waitForFunction(() => { const a = document.querySelector('audio[data-musica-metronet]'); return a && !a.paused && a.volume === .35; }, null, { timeout: 3000 });
  assert.equal(await p.locator(audio).count(), 1);
});

test('Pestaña oculta y pagehide pausan; regreso recupera y logout detiene', async t => {
  const { pagina: p } = await abrir(t);
  await reproduciendo(p);
  await p.locator(audio).evaluate(a => { a.currentTime = 18; });
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await p.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await reproduciendo(p);
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await reproduciendo(p);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 18));
  await p.evaluate(async () => (await import('/src/autenticacion/sesion.js')).eliminarSesiones());
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  assert.deepEqual(await p.evaluate(() => JSON.parse(sessionStorage.getItem('metronet:musica:posiciones'))), {});
  await p.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'sesionUsuario' }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  // La protección de sesión retira una página conservada de una cuenta cerrada.
  // El login tiene su propia música: esperar la navegación evita observar al azar
  // el reproductor del documento anterior o el de autenticación.
  await p.waitForURL('**/login.html');
  await reproduciendo(p, '/audio/auth-theme.mp3');
  assert.equal(await p.locator(`${audio}[src="/audio/gameplay-theme.mp3"]`).count(), 0);
  assert.equal(await p.locator(audio).count(), 1);
});

for (const width of [320, 390, 1025, 1440]) test(`Control accesible sin desbordes / ${width}`, async t => {
  const { pagina: p } = await abrir(t, '/inicio.html', { administrador: true, viewport: { width, height: 900 } });
  await p.locator('.metronet-audio summary').press('Enter');
  await p.locator('.metronet-audio__panel:popover-open').waitFor();
  const caja = await p.locator('.metronet-audio__panel').boundingBox();
  assert.ok(caja.x >= 0 && caja.x + caja.width <= width, JSON.stringify(caja));
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.getByLabel('Silenciar música').focus(); await p.keyboard.press('Space');
  assert.equal(await p.getByLabel('Silenciar música').isChecked(), true);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.metronet-audio').getAttribute('open'), null);
});

test('El control de volumen queda por encima de las capas del mapa en móvil', async t => {
  const { pagina: p } = await abrir(t, 'editor', { viewport: { width: 390, height: 900 } });
  await abrirMusica(p);
  const slider = p.getByRole('slider', { name: 'Volumen de música' });
  await p.locator('.metronet-hud .metronet-audio__panel').waitFor();
  assert.equal(await slider.evaluate(e => {
    const r = e.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === e;
  }), true);
  await slider.click();
  assert.equal(await p.locator('.metronet-hud').evaluate(e=>e.open),true);
});
