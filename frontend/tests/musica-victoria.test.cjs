// MP3 y editor reales; respuestas del servidor controladas, sin alterar cuentas ni diseños reales.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
const niveles = require('../src/educacion/niveles.json');
const pista = '/audio/victory-theme.mp3', audio = 'audio[data-musica-metronet]';
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL, args: ['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await navegador?.close(); });

function limpiar(t, vista) { t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); }); }
async function abrir(t, opciones = {}) {
  const vista = await abrirPantalla(navegador, '/escenarios.html', opciones); limpiar(t, vista);
  // El menú ahora tiene fade de audio: dejarlo terminar antes de sustituir
  // performance.now por el reloj simulado de las pruebas de transición.
  await vista.pagina.waitForFunction(() => document.querySelector('audio')?.volume === .35);
  return vista.pagina;
}
async function celebrar(p, numero = 1, final = false) {
  await p.evaluate(async ({ nivel, final }) => {
    const { mostrarTransicionNivel } = await import('/src/educacion/PantallaTransicionNivel.js');
    window.resultadoMusica = undefined;
    window.celebracion = mostrarTransicionNivel(nivel, final ? null : { numero: nivel.numero + 1 }, { puntaje: 100, final })
      .then(accion => { window.resultadoMusica = accion; });
  }, { nivel: niveles[numero - 1], final });
  await p.locator('.metronet-victoria').waitFor();
}
async function sonando(p) {
  await p.waitForFunction(() => { const a = document.querySelector('audio'); return a?.getAttribute('src') === '/audio/victory-theme.mp3' && !a.paused && a.currentTime > 0 && a.volume > 0; });
}

test('Guardar y completar en el editor: pista completa, final natural y un solo inicio del próximo nivel', async t => {
  const escenarios = niveles.map(n => ({ ...n, idEscenario: n.numero, estado: 'DISPONIBLE', desbloqueado: n.numero <= 2 }));
  escenarios[0].estado = 'EN_DESARROLLO';
  const progreso = { escenarios, cantidadNiveles: 10, nivelesCompletados: 0 };
  const vista = await abrirEditor(navegador, { escenario: escenarios[0] }); limpiar(t, vista);
  const p = vista.pagina; let evaluaciones = 0, inicios = 0;
  await p.route('**/api/juego/**', async route => {
    const ruta = new URL(route.request().url()).pathname;
    if (ruta.endsWith('/evaluar')) {
      evaluaciones++; escenarios[0].estado = 'COMPLETADO'; progreso.nivelesCompletados = 1;
      return route.fulfill({ json: { completado: true, puntaje: 100, idSiguienteEscenario: 2, mensaje: 'Nivel completado' } });
    }
    if (ruta.endsWith('/iniciar')) { inicios++; vista.diseno.simulacion.idEscenario = 2; return route.fulfill({ json: { idDiseno: 77, idEscenario: 2, idIntento: 202 } }); }
    if (ruta.endsWith('/progreso')) return route.fulfill({ json: progreso });
    if (ruta.endsWith('/escenarios')) return route.fulfill({ json: escenarios });
    return route.fallback();
  });
  await p.evaluate(() => editorPrueba.guardarDiseno({ evaluar: false }));
  assert.equal(await p.locator('.metronet-victoria').count(), 0, 'Guardar sin evaluar no anuncia victoria');
  assert.equal(await p.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('victory-theme'))), false);
  await p.evaluate(() => document.addEventListener('ended', e => { const a = e.target; if (a.getAttribute('src') === '/audio/victory-theme.mp3') window.finCancion = { tiempo: a.currentTime, duracion: a.duration, fecha: Date.now() }; }, { capture: true }));
  await p.evaluate(() => { window.validacionMusica = Promise.all([editorPrueba.guardarDiseno(), editorPrueba.guardarDiseno()]); });
  await p.locator('.metronet-victoria').waitFor(); await sonando(p);
  assert.equal(await p.locator(audio).count(), 1);
  assert.equal(await p.locator(audio).evaluate(a => a.loop), false);
  assert.ok(await p.locator(audio).evaluate(a => a.duration > 14.8 && a.duration < 15.1));
  await p.waitForFunction(() => document.querySelector('audio')?.currentTime > 5);
  assert.equal(inicios, 0, 'No abre el siguiente escenario al antiguo límite de 4,5 s');
  assert.equal(await p.locator('.metronet-victoria').isVisible(), true);
  await p.waitForFunction(() => !editorPrueba.evaluacionEnCurso && new URL(location.href).searchParams.get('idEscenario') === '2', null, { timeout: 22000 });
  const fin = await p.evaluate(() => finCancion);
  assert.ok(Math.abs(fin.tiempo - fin.duracion) < .05);
  assert.ok(Date.now() - fin.fecha < 2500);
  assert.equal(inicios, 1); assert.equal(evaluaciones, 1);
  assert.equal(vista.solicitudes.filter(s => s.ruta.endsWith('/guardar')).length, 2);
  assert.equal(await p.locator('.metronet-viaje, .metronet-victoria').count(), 0);
});

test('Preparación inicial y resultado incompleto nunca cargan la canción de victoria', async t => {
  const p = await abrir(t); await p.clock.install();
  await p.evaluate(async () => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.introMusica = crearPreparacionNivel({ numero: 1 }); introMusica.marcarDatosListos();
  });
  await p.clock.runFor(4500);
  assert.equal(await p.evaluate(() => introMusica.finalizada), true);
  await p.evaluate(async () => {
    introMusica.cerrar();
    const { presentarResultadoNivel } = await import('/src/educacion/TransicionNivel.js');
    window.incompleto = await presentarResultadoNivel({ escenarios: [] }, 1, { completado: false });
  });
  assert.equal(await p.evaluate(() => incompleto), null);
  assert.equal(await p.locator(audio).getAttribute('src'), '/audio/menu-theme.mp3');
  assert.equal(await p.evaluate(() => performance.getEntriesByType('resource').some(r => /victory-theme|welcome-theme/.test(r.name))), false);
});

test('Los diez niveles reinician la pista; el último conserva su resumen y deja de sonar', async t => {
  const p = await abrir(t);
  for (let numero = 1; numero <= 10; numero++) {
    await celebrar(p, numero, numero === 10); await sonando(p);
    assert.ok(await p.locator(audio).evaluate(a => a.currentTime < 2));
    assert.equal(await p.locator(audio).count(), 1);
    await p.locator(audio).evaluate(a => { a.currentTime = a.duration - .25; });
    if (numero < 10) {
      await p.waitForFunction(() => resultadoMusica === 'siguiente');
      assert.equal(await p.locator('.metronet-victoria').count(), 0);
    } else {
      await p.locator('.metronet-victoria__resumen').waitFor();
      assert.equal(await p.evaluate(() => resultadoMusica), undefined);
      assert.equal(await p.getByRole('progressbar', { name: 'Progreso del viaje de victoria' }).getAttribute('aria-valuenow'), '100');
      await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.sincronizar());
      assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
      await p.getByRole('button', { name: 'Ver desempeño y ranking' }).click();
      assert.equal(await p.evaluate(() => resultadoMusica), 'ranking');
    }
  }
});

test('Progreso y tren siguen el audio; reduced motion mantiene el tren estático hasta la llegada', async t => {
  const p = await abrir(t, { reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  await celebrar(p); await sonando(p);
  const d = p.locator('.metronet-victoria'), tren = d.locator('.recorrido-tren');
  const posicion = await tren.getAttribute('transform');
  await p.locator(audio).evaluate(a => { a.currentTime = a.duration / 2; });
  await p.waitForFunction(() => Number(document.querySelector('.metronet-victoria [role=progressbar]').getAttribute('aria-valuenow')) > 35);
  assert.equal(await tren.getAttribute('transform'), posicion);
  assert.equal(await d.getAttribute('data-movimiento-reducido'), 'true');
  assert.ok(await d.evaluate(e => e.scrollWidth <= e.clientWidth));
  await p.locator(audio).evaluate(a => { a.currentTime = a.duration - .25; });
  await p.waitForFunction(() => resultadoMusica === 'siguiente');
});

for (const fallo of ['silencio', 'archivo', 'autoplay', 'play-pendiente']) test(`Victoria sin bloqueo cuando hay ${fallo}`, async t => {
  const p = await abrir(t); await p.clock.install();
  if (fallo === 'archivo') await p.route('**/audio/victory-theme.mp3', route => route.fulfill({ status: 404 }));
  if (fallo === 'silencio') await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true));
  if (fallo === 'autoplay' || fallo === 'play-pendiente') await p.evaluate(fallo => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.getAttribute('src')?.includes('victory-theme')) return fallo === 'autoplay'
        ? Promise.reject(new DOMException('Autoplay bloqueado', 'NotAllowedError')) : new Promise(() => {});
      return original.call(this);
    };
  }, fallo);
  await celebrar(p);
  await p.clock.runFor(4501);
  assert.equal(await p.evaluate(() => resultadoMusica), 'siguiente');
  assert.equal(await p.locator('.metronet-victoria').count(), 0);
});

test('Audio que se interrumpe sin finalizar no deja atrapado el resumen final', async t => {
  const p = await abrir(t); await p.clock.install();
  await celebrar(p, 10, true); await sonando(p);
  await p.locator(audio).evaluate(a => a.pause());
  await p.clock.fastForward(16000);
  assert.equal(await p.locator('.metronet-victoria__resumen').isVisible(), false);
  await p.clock.fastForward(8001);
  await p.locator('.metronet-victoria__resumen').waitFor();
  assert.equal(await p.locator(audio).evaluate(a => a.paused), true);
  await p.getByRole('button', { name: 'Revisar mi red' }).click();
  assert.equal(await p.evaluate(() => resultadoMusica), null);
});
