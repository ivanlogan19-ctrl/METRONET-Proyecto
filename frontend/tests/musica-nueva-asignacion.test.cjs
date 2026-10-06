const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const catalogo = require('../src/educacion/catalogo-svgs-niveles.json');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');

const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
const audio = 'audio[data-musica-metronet]';
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL,
  args: ['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await navegador?.close(); });

async function esperarPista(pagina, pista) {
  await pagina.waitForFunction(pista => {
    const canal = document.querySelector('audio[data-musica-metronet]');
    return canal?.getAttribute('src') === pista && !canal.paused && canal.currentTime > 0;
  }, pista);
}

async function paginaDeTarjetas(t) {
  const contexto = await navegador.newContext();
  t.after(() => contexto.close());
  await contexto.addInitScript(() => localStorage.setItem('sesionUsuario', JSON.stringify({
    token: 'sesion-local-de-prueba', usuario: { idUsuario: 7, rol: 'JUGADOR' },
  })));
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', error => errores.push(error.message));
  t.after(() => assert.deepEqual(errores, []));
  await pagina.route(`${BASE}/__musica_tarjetas`, ruta => ruta.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body><main>Prueba local de tarjetas</main></body></html>',
  }));
  await pagina.goto(`${BASE}/__musica_tarjetas`);
  await pagina.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerContexto('gameplay'));
  await esperarPista(pagina, '/audio/extra-theme.mp3');
  return pagina;
}

test('Aprendizaje usa Educativo al entrar y al leer tarjetas de distintos niveles', async t => {
  const niveles = catalogo.map(nivel => ({ numero: nivel.numero, desbloqueado: true,
    contenido: { desafio: { nombre: `Nivel ${nivel.numero}` }, tarjetas: nivel.tarjetas } }));
  const vista = await abrirPantalla(navegador, '/aprendizaje.html', { responder: request =>
    new URL(request.url()).pathname === '/api/juego/aprendizaje' ? { json: niveles } : null });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  const p = vista.pagina;
  await esperarPista(p, '/audio/educativo-theme.mp3');
  await p.locator(audio).evaluate(a => { window.canalInicial = a; a.currentTime = 3; });
  for (const indice of [0, 9]) {
    await p.locator('.metronet-aprendizaje__nivel').nth(indice).locator('button').first().click();
    assert.equal(await p.locator('#tarjetaAprendizaje').evaluate(d => d.open), true);
    await esperarPista(p, '/audio/educativo-theme.mp3');
    await p.getByRole('button', { name: 'Volver a las tarjetas' }).click();
    assert.equal(await p.locator('#tarjetaAprendizaje').evaluate(d => d.open), false);
  }
  assert.equal(await p.locator(audio).count(), 1);
  assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 3));
  assert.equal(await p.locator(audio).evaluate(a => a === window.canalInicial), true);
});

test('Ayuda y posvictoria usan Educativo mientras la tarjeta está visible y restauran Editor', async t => {
  const p = await paginaDeTarjetas(t);
  await p.locator(audio).evaluate(a => { a.currentTime = 3; });
  for (const numero of [1, 10]) {
    assert.equal(await p.evaluate(async n =>
      (await import('/src/educacion/TarjetaEducativaNivel.js')).abrirTarjetaEducativaDesdeAyuda(n), numero), true);
    await esperarPista(p, '/audio/educativo-theme.mp3');
    if (numero === 1) {
      await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true));
      assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
      await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(false));
      await esperarPista(p, '/audio/educativo-theme.mp3');
    }
    await p.getByRole('button', { name: 'Volver' }).click();
    await esperarPista(p, '/audio/extra-theme.mp3');
    assert.ok(await p.locator(audio).evaluate(a => a.currentTime >= 3));
    assert.equal(await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.temporales.size), 0);
  }
  await p.evaluate(async () => {
    window.tarjetaTrasVictoria = (await import('/src/educacion/TarjetaEducativaNivel.js'))
      .presentarTarjetaEducativaTrasVictoria(3);
  });
  await esperarPista(p, '/audio/educativo-theme.mp3');
  await p.getByRole('button', { name: 'Continuar →' }).click();
  assert.equal(await p.evaluate(() => tarjetaTrasVictoria), true);
  await esperarPista(p, '/audio/extra-theme.mp3');
  assert.equal(await p.locator(audio).count(), 1);
  assert.equal(await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.temporales.size), 0);
});

test('Tarjeta de preparación cambia a Educativo y al cerrar recupera menú', async t => {
  const p = await paginaDeTarjetas(t);
  await p.evaluate(async () => {
    const { gestorMusica } = await import('/src/audio/GestorMusica.js');
    gestorMusica.establecerContexto('menu');
    window.preparacionMusical = (await import('/src/educacion/PantallaPreparacionNivel.js'))
      .crearPreparacionNivel({ numero: 2, nombre: 'Nivel 2' });
    preparacionMusical.marcarDatosListos();
  });
  await p.getByRole('button', { name: 'Jugar' }).click();
  await p.locator('dialog[open] .metronet-tarjeta-educativa').waitFor();
  await esperarPista(p, '/audio/educativo-theme.mp3');
  await p.evaluate(() => preparacionMusical.cerrar());
  await esperarPista(p, '/audio/menu-theme.mp3');
  assert.equal(await p.locator(audio).count(), 1);
  assert.equal(await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.temporales.size), 0);
});

test('Simulación con red, Editor y panel administrador mantienen sus pistas', async t => {
  const simulacion = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77');
  t.after(async () => { await simulacion.contexto.close(); assert.deepEqual(simulacion.errores, []); });
  await esperarPista(simulacion.pagina, '/audio/simulacion-theme.mp3');
  assert.equal(await simulacion.pagina.locator('#panelSimulacion').isVisible(), true);
  const editor = await abrirEditor(navegador);
  t.after(async () => { await editor.contexto.close(); assert.deepEqual(editor.errores, []); });
  await esperarPista(editor.pagina, '/audio/extra-theme.mp3');
  const administracion = await abrirPantalla(navegador, '/admin.html', { administrador: true });
  t.after(async () => { await administracion.contexto.close(); assert.deepEqual(administracion.errores, []); });
  await esperarPista(administracion.pagina, '/audio/menu-theme.mp3');
});

test('La pantalla de Simulación sin red también usa Simulación', async t => {
  const vista = await abrirPantalla(navegador, '/inicio.html');
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.goto(`${BASE}/simulacion.html`);
  await vista.pagina.locator('#estadoVacio:not([hidden])').waitFor();
  await esperarPista(vista.pagina, '/audio/simulacion-theme.mp3');
  assert.equal(await vista.pagina.locator(audio).count(), 1);
});
