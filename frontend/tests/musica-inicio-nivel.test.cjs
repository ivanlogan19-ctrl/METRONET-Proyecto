const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const nivel = { ...require('../src/educacion/niveles.json')[0], idEscenario: 1, estado: 'DISPONIBLE', desbloqueado: true };
const red = { simulacion: { idDiseno: 77, idEscenario: 1, nombre: 'Primera red', modo: 'NIVEL', estado: 'EN_DISENO' }, estaciones: [], lineas: [], tramos: [], unidadesMetro: [], preparadoParaSimular: false, territorio: { areas: [], errores: [] } };
const pista = '/audio/victory-theme.mp3';
const audio = 'audio[data-musica-metronet]';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL, args: ['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await browser?.close(); });
async function abrir(t, opciones = {}) {
  const v = await abrirPantalla(browser, '/inicio.html', { ...opciones, responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/juego/progreso') return { json: { escenarios: [nivel], cantidadNiveles: 10, nivelesCompletados: 0, modoLibreDesbloqueado: false } };
    if (path === '/api/juego/escenarios') return { json: [nivel] };
    if (path.endsWith('/escenarios/1/iniciar')) return { json: { idDiseno: 77, idEscenario: 1, idIntento: 123, numeroCampana: 1, mostrarTutorial: true } };
    if (path === '/api/simulaciones') return { json: [red.simulacion] };
    if (path === '/api/simulaciones/77') return { json: red };
  }});
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  return v;
}

for (const reducido of [false, true]) test(`Viaje y cartel comparten FalsaCargaDeVictoria completa, sin navegar entre fases (reducido ${reducido})`, async t => {
  const { pagina: p } = await abrir(t, { reducedMotion: reducido ? 'reduce' : 'no-preference' });
  let terminoAudio = false;
  await p.exposeFunction('registrarFinAudioPrueba', () => { terminoAudio = true; });
  const inicio = Date.now();
  await p.getByRole('button', { name: 'Comenzar escenario', exact: true }).click();
  await p.locator('.metronet-viaje').waitFor();
  await p.waitForFunction(() => { const a = document.querySelector('audio[data-musica-metronet]'); return a?.getAttribute('src') === '/audio/victory-theme.mp3' && a.currentTime > .4 && !a.paused; });
  const antes = await p.locator(audio).evaluate(a => {
    window.audioDelViaje = a;
    window.cortesDelViaje = 0;
    a.addEventListener('pause', () => { if (!a.ended) window.cortesDelViaje++; });
    a.addEventListener('ended', () => window.registrarFinAudioPrueba(), { once: true });
    return { tiempo: a.currentTime, loop: a.loop, duracion: a.duration };
  });
  assert.equal(antes.loop, false);
  assert.ok(antes.duracion > 13.7 && antes.duracion < 13.9);
  const cartel = p.locator('.metronet-viaje .metronet-cartel-transicion:not([hidden])');
  await cartel.waitFor();
  assert.match(await cartel.innerText(), /NIVEL 1/);
  assert.equal(new URL(p.url()).pathname, '/inicio.html', 'Las dos fases ocurren antes de navegar');
  const continuidad = await p.locator(audio).evaluate(a => ({ mismo: a === window.audioDelViaje, tiempo: a.currentTime, cortes: window.cortesDelViaje }));
  assert.equal(continuidad.mismo, true);
  assert.equal(continuidad.cortes, 0);
  assert.ok(continuidad.tiempo >= 10.5 && continuidad.tiempo < 13.9);
  assert.equal(await p.locator(`audio[src="${pista}"]`).count(), 1);
  await p.waitForURL('**/?idDiseno=77&idEscenario=1&idIntento=123');
  assert.equal(terminoAudio, true, 'Navegar después del evento ended real');
  assert.ok(Date.now() - inicio >= 13600 && Date.now() - inicio < 20000);
  await p.getByRole('button', { name: 'Mostrar tutorial', exact: true }).waitFor();
  assert.equal(await p.locator('.metronet-identificacion').count(), 0);
  assert.equal(await p.locator(`audio[src="${pista}"]`).count(), 0, 'No repetir canción en el editor');
  await p.waitForFunction(() => { const a = document.querySelector('audio[data-musica-metronet]'); return a?.getAttribute('src') === '/audio/extra-theme.mp3' && !a.paused; });
});

for (const fallo of ['archivo', 'silencio']) test(`FalsaCargaDeVictoria ${fallo}: conserva el viaje y permite entrar al nivel`, async t => {
  const { pagina: p } = await abrir(t);
  if (fallo === 'archivo') await p.route('**/audio/victory-theme.mp3', route => route.fulfill({ status: 404 }));
  else await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true));
  await p.getByRole('button', { name: 'Comenzar escenario', exact: true }).click();
  await p.waitForURL('**/?idDiseno=77&idEscenario=1&idIntento=123', { timeout: 20000 });
  await p.getByRole('button', { name: 'Mostrar tutorial', exact: true }).waitFor();
  assert.equal(await p.locator('.metronet-identificacion').count(), 0);
});

test('Cancelar recupera menú; repetir comienza una sola FalsaCargaDeVictoria desde el principio', async t => {
  const { pagina: p } = await abrir(t);
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    await p.getByRole('button', { name: 'Comenzar escenario', exact: true }).click();
    await p.waitForFunction(() => { const a = document.querySelector('audio[data-musica-metronet]'); return a?.getAttribute('src') === '/audio/victory-theme.mp3' && a.currentTime > .1; });
    assert.ok(await p.locator(audio).evaluate(a => a.currentTime < 1));
    assert.equal(await p.locator(`audio[src="${pista}"]`).count(), 1);
    await p.getByRole('button', { name: 'Volver', exact: true }).click();
    await p.waitForFunction(() => document.querySelector('audio[data-musica-metronet]')?.getAttribute('src') === '/audio/menu-theme.mp3');
  }
});
