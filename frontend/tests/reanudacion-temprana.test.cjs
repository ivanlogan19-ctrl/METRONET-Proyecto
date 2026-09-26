const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

let navegador;
before(async () => {
  navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL,
    args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => { await navegador?.close(); });

async function abrir(t, ruta = '/inicio.html', opciones = {}) {
  const vista = await abrirPantalla(navegador, ruta, opciones);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.waitForFunction(() => {
    const audio = document.querySelector('[data-musica-metronet]');
    return audio && !audio.paused && audio.volume === .35;
  });
  return vista;
}

// Mantener pendiente el módulo de pantalla demuestra que el audio no depende de
// ese módulo; no se usa un límite de rendimiento sensible a la velocidad del equipo.
// Antes del primer render no hay frames: comprobar el audio por intervalo, no
// mediante el requestAnimationFrame que waitForFunction utiliza por defecto.
const ANTES_DEL_RENDER = { polling: 50 };
async function retenerPantalla(pagina, patron) {
  let liberar;
  const pendiente = new Promise(resolve => { liberar = resolve; });
  await pagina.route(patron, async ruta => { await pendiente; await ruta.continue(); });
  return async () => {
    liberar();
    await pagina.waitForLoadState('load');
    await pagina.unroute(patron);
  };
}

test('Escenarios reanuda la música antes de descargar su módulo de pantalla', async t => {
  const { pagina } = await abrir(t);
  await pagina.locator('audio').evaluate(audio => { audio.currentTime = 60; });
  const liberar = await retenerPantalla(pagina, '**/src/navegacion/escenarios.js*');
  try {
    await pagina.goto('http://127.0.0.1:5173/escenarios.html', { waitUntil: 'commit' });
    await pagina.waitForFunction(() => {
      const audio = document.querySelector('[data-musica-metronet]');
      return audio && !audio.paused && audio.currentTime >= 60 && audio.volume === .35;
    }, null, { ...ANTES_DEL_RENDER, timeout: 2500 });
    assert.equal(await pagina.locator('.metronet-navegacion').count(), 0);
    await pagina.evaluate(() => { window.audioTemprano = document.querySelector('audio'); });
  } finally { await liberar(); }
  await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().waitFor();
  assert.equal(await pagina.evaluate(() => audioTemprano === document.querySelector('audio')), true);
  assert.equal(await pagina.locator('audio').count(), 1);
});

test('Registro recupera la pista de acceso mientras su formulario todavía carga', async t => {
  const { pagina } = await abrir(t, '/login.html');
  await pagina.locator('audio').evaluate(audio => { audio.currentTime = 35; });
  const liberar = await retenerPantalla(pagina, '**/src/autenticacion/registro.js*');
  try {
    await pagina.goto('http://127.0.0.1:5173/registro.html', { waitUntil: 'commit' });
    await pagina.waitForFunction(() => {
      const audio = document.querySelector('audio');
      return audio && !audio.paused && audio.currentTime >= 35;
    }, null, ANTES_DEL_RENDER);
    assert.equal(await pagina.locator('audio').getAttribute('src'), '/audio/auth-theme.mp3');
    assert.equal(await pagina.locator('[data-control-musica]').count(), 0);
  } finally { await liberar(); }
  assert.equal(await pagina.locator('audio').count(), 1);
});

test('Administración conserva la pista del menú sin esperar a cargar sus vistas', async t => {
  const { pagina } = await abrir(t, '/inicio.html', { administrador: true });
  await pagina.locator('audio').evaluate(audio => { audio.currentTime = 45; });
  const liberar = await retenerPantalla(pagina, '**/src/administracion/administracion.js*');
  try {
    await pagina.goto('http://127.0.0.1:5173/admin.html', { waitUntil: 'commit' });
    await pagina.waitForFunction(() => document.querySelector('audio')?.currentTime >= 45, null, ANTES_DEL_RENDER);
    assert.equal(await pagina.locator('audio').evaluate(audio => audio.paused), false);
    assert.equal(await pagina.locator('.metronet-navegacion').count(), 0);
  } finally { await liberar(); }
  await pagina.locator('[data-editar-usuario]').first().waitFor();
  assert.equal(await pagina.locator('audio').count(), 1);
});

test('Simulación prepara gameplay en silencio y reutiliza ese reproductor al cargar el diseño', async t => {
  const { pagina } = await abrir(t);
  await pagina.evaluate(async () => {
    const { gestorMusica } = await import('/src/audio/GestorMusica.js');
    gestorMusica.establecerContexto('gameplay');
  });
  await pagina.waitForFunction(() => {
    const audio = document.querySelector('[data-musica-metronet]');
    return audio?.getAttribute('src') === '/audio/gameplay-theme.mp3' && !audio.paused && audio.volume === .35;
  });
  await pagina.locator('[data-musica-metronet]').evaluate(audio => { audio.currentTime = 90; });
  const liberar = await retenerPantalla(pagina, '**/src/simulacion/simulacion.js*');
  try {
    await pagina.goto('http://127.0.0.1:5173/simulacion.html?idDiseno=77', { waitUntil: 'commit' });
    await pagina.waitForFunction(() => document.querySelector('audio')?.readyState >= 2, null, ANTES_DEL_RENDER);
    const estado = await pagina.locator('audio').evaluate(audio => {
      window.audioPreparado = audio;
      return { pausado: audio.paused, posicion: audio.currentTime, volumen: audio.volume };
    });
    assert.equal(estado.pausado, true);
    assert.equal(estado.volumen, 0);
    assert.ok(estado.posicion >= 90);
    assert.equal(await pagina.locator('canvas').count(), 0);
  } finally { await liberar(); }
  await pagina.locator('#panelSimulacion:not([hidden])').waitFor();
  await pagina.waitForFunction(() => !audioPreparado.paused && audioPreparado.volume === .35);
  assert.equal(await pagina.evaluate(() => audioPreparado === document.querySelector('audio')), true);
  assert.equal(await pagina.locator('audio').count(), 1);
});

test('Silencio del usuario impide la reanudación temprana y se conserva al cargar la pantalla', async t => {
  const { pagina } = await abrir(t);
  await pagina.evaluate(async () => {
    const { gestorMusica } = await import('/src/audio/GestorMusica.js');
    gestorMusica.establecerSilencio(true);
  });
  const liberar = await retenerPantalla(pagina, '**/src/navegacion/escenarios.js*');
  try {
    await pagina.goto('http://127.0.0.1:5173/escenarios.html', { waitUntil: 'commit' });
    await pagina.waitForFunction(() => window[Symbol.for('metronet:gestor-musica')], null, ANTES_DEL_RENDER);
    assert.equal(await pagina.locator('audio').count(), 0);
  } finally { await liberar(); }
  assert.equal(await pagina.locator('audio').evaluate(audio => audio.paused && audio.volume === 0), true);
});

test('Una entrada asíncrona tardía no reemplaza bienvenida ni transiciones', async t => {
  const { pagina } = await abrir(t);
  const liberar = await retenerPantalla(pagina, '**/src/audio/ReanudacionTemprana.js*');
  try {
    await pagina.goto('http://127.0.0.1:5173/escenarios.html', { waitUntil: 'domcontentloaded' });
    await pagina.locator('.metronet-navegacion').waitFor();
    await pagina.evaluate(async () => {
      const { gestorMusica } = await import('/src/audio/GestorMusica.js');
      gestorMusica.establecerContexto('general');
      window.liberarBienvenida = gestorMusica.usarContextoTemporal('welcome', { reiniciar: true });
    });
  } finally { await liberar(); }
  const estado = await pagina.evaluate(() => window[Symbol.for('metronet:gestor-musica')].obtenerEstado());
  assert.equal(estado.contexto, 'welcome');
  assert.equal(await pagina.locator('[data-musica-metronet]').getAttribute('src'), '/audio/welcome-theme.mp3');
});

test('Un JUGADOR no anticipa audio administrativo ni altera su redirección de acceso', async t => {
  const { pagina } = await abrir(t);
  const liberar = await retenerPantalla(pagina, '**/src/administracion/administracion.js*');
  try {
    await pagina.goto('http://127.0.0.1:5173/admin.html', { waitUntil: 'commit' });
    await pagina.waitForFunction(() => window[Symbol.for('metronet:gestor-musica')], null, ANTES_DEL_RENDER);
    assert.equal(await pagina.locator('audio').count(), 0);
  } finally { await liberar(); }
  await pagina.waitForURL('**/admin-login.html');
  assert.equal(await pagina.locator('.metronet-navegacion').count(), 0);
});

test('Un registro obsoleto no inicia audio anticipado', async t => {
  const { pagina, contexto } = await abrir(t);
  await contexto.addInitScript(() => {
    sessionStorage.setItem('metronet:musica:continuidad', JSON.stringify({
      pista: '/audio/menu-theme.mp3', contexto: 'menu', instante: Date.now() - 15000,
    }));
  });
  const liberar = await retenerPantalla(pagina, '**/src/navegacion/escenarios.js*');
  try {
    await pagina.goto('http://127.0.0.1:5173/escenarios.html', { waitUntil: 'commit' });
    await pagina.waitForFunction(() => window[Symbol.for('metronet:gestor-musica')], null, ANTES_DEL_RENDER);
    assert.equal(await pagina.locator('audio').count(), 0);
  } finally { await liberar(); }
  await pagina.waitForFunction(() => !document.querySelector('audio')?.paused);
});
