// MP3 y navegador reales, API interceptada: no modifica cuentas ni progreso.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL, args: ['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await navegador?.close(); });

async function abrir(t) {
  const v = await abrirPantalla(navegador, '/escenarios.html', { contenedor: true });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  await v.vista.evaluate(async () => {
    window.crearIntro = (await import('/src/educacion/PantallaPreparacionNivel.js')).crearPreparacionNivel;
    window.crearOutro = (await import('/src/educacion/PantallaTransicionNivel.js')).mostrarTransicionNivel;
    window.g = (await import('/src/audio/GestorMusica.js')).gestorMusica;
  });
  return v;
}

async function comenzar(v, tipo) {
  await v.evaluate(tipo => {
    window.termino = false;
    const inicio = performance.now();
    let promesa;
    if (tipo === 'intro') {
      window.intro = crearIntro({ numero: 1, nombre: 'Primera red' });
      intro.marcarDatosListos(); promesa = intro.finalizada;
    } else promesa = crearOutro({ numero: 1 }, { numero: 2 }, { puntaje: 100 });
    const audio = parent[Symbol.for('metronet:gestor-musica')].audio;
    let finalNatural = false, duracion = 0, primerSonido = null, cortes = 0;
    audio.addEventListener('playing', () => { primerSonido ??= performance.now() - inicio; });
    audio.addEventListener('loadedmetadata', () => { duracion = audio.duration; });
    audio.addEventListener('pause', () => { if (!audio.ended) cortes++; });
    audio.addEventListener('ended', () => { finalNatural = true; });
    window.fin = promesa.then(async accion => {
      // El listener del gestor resuelve la promesa antes del siguiente listener de ended.
      await new Promise(resolve => setTimeout(resolve, 0));
      termino = true;
      const datos = { accion, ms: performance.now() - inicio, finalNatural, duracion, primerSonido, cortes };
      if (tipo === 'intro') intro.cerrar();
      return datos;
    });
  }, tipo);
}

for (const tipo of ['intro', 'outro']) test(`${tipo}: descarga demorada seis segundos conserva la canción completa`, async t => {
  const { pagina: p, vista: v } = await abrir(t);
  await p.route('**/audio/victory-theme.mp3', async ruta => {
    await new Promise(resolve => setTimeout(resolve, 6000));
    await ruta.continue();
  });
  await comenzar(v, tipo);
  const datos = await v.evaluate(() => fin);
  t.diagnostic(JSON.stringify(datos));
  assert.equal(datos.finalNatural, true, 'La carga lenta no debe disparar la salida anticipada');
  assert.ok(datos.duracion > 13.7 && datos.duracion < 13.9);
  assert.ok(datos.ms - datos.primerSonido >= 13600, JSON.stringify(datos));
  assert.ok(datos.ms > 19500 && datos.ms < 28000, JSON.stringify(datos));
  assert.equal(datos.cortes, 0);
  assert.equal(datos.accion, tipo === 'intro' ? true : 'siguiente');
});

for (const tipo of ['intro', 'outro']) test(`${tipo}: silencio conserva la duración de la pista`, async t => {
  const { pagina: p, vista: v } = await abrir(t);
  await v.evaluate(() => g.establecerSilencio(true));
  await p.clock.install();
  await comenzar(v, tipo);
  await p.clock.runFor(2000);
  assert.equal(await v.evaluate(() => termino), false, 'No terminar al antiguo respaldo de 1,8 s');
  await p.clock.runFor(10000);
  assert.equal(await v.locator('.metronet-cartel-transicion').isVisible(), true);
  assert.equal(await v.evaluate(() => termino), false);
  await p.clock.runFor(3000);
  const datos = await v.evaluate(() => fin);
  assert.ok(datos.ms >= 13700 && datos.ms <= 13800, JSON.stringify(datos));
  assert.equal(datos.accion, tipo === 'intro' ? true : 'siguiente');
});

for (const tipo of ['intro', 'outro']) test(`${tipo}: audio detenido sin ended conserva una salida de respaldo y limpia contextos`, async t => {
  const { pagina: p, vista: v } = await abrir(t);
  await comenzar(v, tipo);
  await p.waitForFunction(() => document.querySelector('audio[data-musica-metronet]')?.currentTime > .5);
  await p.clock.install();
  await p.locator('audio[data-musica-metronet]').evaluate(a => a.pause());
  await p.clock.runFor(17000);
  assert.equal(await v.evaluate(() => termino), false);
  await p.clock.runFor(4000);
  const datos = await v.evaluate(() => fin);
  assert.equal(datos.finalNatural, false);
  assert.equal(datos.accion, tipo === 'intro' ? true : 'siguiente');
  assert.equal(await v.locator('dialog[open]').count(), 0);
  assert.equal(await p.evaluate(() => window[Symbol.for('metronet:gestor-musica')].temporales.size), 0);
});
