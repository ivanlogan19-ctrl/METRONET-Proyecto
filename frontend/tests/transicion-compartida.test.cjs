// Navegador real con reloj controlado; sin llamadas a backend ni escritura en PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const niveles = require('../src/educacion/niveles.json');
const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrir(t, reducedMotion = 'no-preference') {
  const contexto = await navegador.newContext({ reducedMotion });
  // Probar esta vista aislada; la navegación persistente tiene su propia suite integral.
  await contexto.route('**/iniciar-contenedor.js', ruta => ruta.fulfill({ contentType:'application/javascript', body:'' }));
  const p = await contexto.newPage(), errores = [];
  p.on('pageerror', error => errores.push(error.message));
  await p.route('**/api/**', () => { throw new Error('Esta presentación no necesita backend'); });
  await p.route(`${BASE}/__transicion`, r => r.fulfill({ contentType: 'text/html', body: '<script src="/transicion-pagina.js"></script><link rel="stylesheet" href="/src/estilos/navegacion-estable.css"><link rel="stylesheet" href="/src/estilos/metronet.css"><link rel="stylesheet" href="/src/estilos/retro.css"><button id="origen">Niveles</button>' }));
  await p.goto(`${BASE}/__transicion`);
  await p.evaluate(async () => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    const { mostrarTransicionNivel } = await import('/src/educacion/PantallaTransicionNivel.js');
    window.crearIntro = crearPreparacionNivel;
    window.crearOutro = mostrarTransicionNivel;
    // Este grupo verifica el respaldo visual sin audio; el MP3 real se cubre aparte.
    const { gestorMusica } = await import('/src/audio/GestorMusica.js');
    gestorMusica.inicializar(); gestorMusica.establecerSilencio(true);
  });
  const time = new Date('2026-09-25T12:00:00Z');
  await p.clock.install({ time }); await p.clock.pauseAt(time);
  t.after(async () => { await contexto.close(); assert.deepEqual(errores, []); });
  return p;
}
async function comenzar(p, tipo, nivel = niveles[0], final = false) {
  await p.evaluate(({ tipo, nivel, final }) => {
    window.resultado = undefined; window.continuaciones = 0; window.inicio = performance.now();
    let promesa;
    if (tipo === 'intro') {
      window.intro = crearIntro(nivel); intro.marcarDatosListos(); promesa = intro.finalizada;
    } else promesa = crearOutro(nivel, final ? null : { numero: nivel.numero + 1, objetivo: 'Objetivo siguiente' }, { final, puntaje: 95 });
    promesa.then(valor => { resultado = valor; continuaciones++; window.transcurrido = performance.now() - inicio; });
  }, { tipo, nivel, final });
}
for (const movimiento of ['no-preference', 'reduce']) test(`Intro y respaldo sin música conservan 14968 ms en los diez niveles (${movimiento})`, async t => {
  const p = await abrir(t, movimiento);
  for (const nivel of niveles) {
    let geometria;
    for (const tipo of ['intro', 'outro']) {
      await comenzar(p, tipo, nivel);
      const escena = p.locator('.metronet-recorrido-nivel');
      const dibujo = await escena.locator('svg path').evaluateAll(paths => paths.map(e => e.getAttribute('d')));
      if (tipo === 'intro') {
        geometria = dibujo;
        assert.equal(await p.locator('.metronet-viaje__consigna p').textContent(), nivel.objetivo);
        assert.ok(await p.locator('[data-mensaje-id] p').textContent());
      } else assert.deepEqual(dibujo, geometria, 'Reutiliza toda la geometría original de victoria');
      assert.equal(await escena.count(), 1);
      await p.clock.runFor(14967);
      assert.equal(await p.evaluate(() => resultado), undefined, 'No continúa antes del límite');
      await p.clock.runFor(1);
      assert.deepEqual(await p.evaluate(() => ({ resultado, continuaciones, transcurrido })), {
        resultado: tipo === 'intro' ? true : 'siguiente', continuaciones: 1, transcurrido: 14968,
      });
      if (tipo === 'intro') await p.evaluate(() => intro.cerrar());
      await p.clock.runFor(1000);
      assert.equal(await p.evaluate(() => continuaciones), 1);
      assert.equal(await p.locator('dialog').count(), 0);
    }
  }
});
for (const tipo of ['intro', 'outro']) for (const fallo of ['sinFrames', 'errorFrame', 'errorSVG', 'sinCSS']) test(`${tipo}: ${fallo} no bloquea ni duplica la continuación`, async t => {
  const p = await abrir(t);
  await p.evaluate(fallo => {
    if (fallo === 'sinFrames') window.requestAnimationFrame = () => 0;
    if (fallo === 'errorFrame') window.requestAnimationFrame = () => { throw new Error('Frame no disponible'); };
    if (fallo === 'errorSVG') {
      const set = SVGElement.prototype.setAttribute;
      SVGElement.prototype.setAttribute = function(nombre, valor) {
        if (this.matches('.recorrido-tren') && nombre === 'transform') throw new Error('Dibujo no disponible');
        return set.call(this, nombre, valor);
      };
    }
    if (fallo === 'sinCSS') [...document.styleSheets].forEach(s => s.disabled = true);
  }, fallo);
  await comenzar(p, tipo);
  await p.clock.runFor(14968);
  assert.equal(await p.evaluate(() => resultado), tipo === 'intro' ? true : 'siguiente');
  if (tipo === 'intro') {
    assert.equal(await p.locator('.metronet-viaje__consigna p').textContent(), niveles[0].objetivo);
    await p.evaluate(() => intro.cerrar());
  }
  await p.clock.runFor(5000);
  assert.equal(await p.evaluate(() => continuaciones), 1);
});
for (const tipo of ['intro', 'outro']) test(`${tipo}: cancelación y repetición limpian timers, frames y listeners`, async t => {
  const p = await abrir(t);
  await p.evaluate(() => {
    const raf = requestAnimationFrame, caf = cancelAnimationFrame, timeout = setTimeout, clear = clearTimeout;
    const add = window.addEventListener, remove = window.removeEventListener;
    window.frames = new Set(); window.timers = new Set(); window.listeners = new Map();
    window.requestAnimationFrame = cb => { const id = raf(t => { frames.delete(id); cb(t); }); frames.add(id); return id; };
    window.cancelAnimationFrame = id => { frames.delete(id); caf(id); };
    window.setTimeout = (cb, ms) => { const id = timeout(() => { timers.delete(id); cb(); }, ms); timers.add(id); return id; };
    window.clearTimeout = id => { timers.delete(id); clear(id); };
    window.addEventListener = function(tipo, cb, opciones) { if (['pagehide', 'popstate'].includes(tipo)) listeners.set(cb, tipo); return add.call(this, tipo, cb, opciones); };
    window.removeEventListener = function(tipo, cb, opciones) { listeners.delete(cb); return remove.call(this, tipo, cb, opciones); };
  });
  for (const modo of ['escape', 'popstate', 'pagehide', 'desmontar', 'reemplazar']) {
    await comenzar(p, tipo);
    await p.clock.runFor(13000); // Durante el cartel, antes de completar la presentación.
    if (modo === 'escape') await p.keyboard.press('Escape');
    else await p.evaluate(({ modo, tipo }) => {
      if (modo === 'desmontar') document.querySelector('dialog').remove();
      else if (modo === 'reemplazar') {
        if (tipo === 'intro') crearIntro({ numero: 2 }).cerrar();
        else { crearOutro({ numero: 2 }, { numero: 3 }); document.querySelector('dialog').close(); }
      } else window.dispatchEvent(new Event(modo));
    }, { modo, tipo });
    await p.clock.runFor(5000);
    assert.equal(await p.evaluate(() => resultado), tipo === 'intro' ? false : null);
    assert.deepEqual(await p.evaluate(() => ({ timers: timers.size, frames: frames.size, listeners: listeners.size, continuaciones })), { timers: 0, frames: 0, listeners: 0, continuaciones: 1 });
    assert.equal(await p.locator('dialog').count(), 0);
  }
});
test('Jugar adelanta la entrada y el resumen final conserva la información', async t => {
  const p = await abrir(t);
  await comenzar(p, 'intro');
  await p.clock.runFor(200);
  await p.getByRole('button', { name: 'Jugar', exact: true }).press('Enter');
  assert.equal(await p.evaluate(() => resultado), true);
  assert.equal(await p.getByRole('progressbar').getAttribute('aria-valuenow'), '100');
  await p.clock.runFor(2000);
  assert.equal(await p.evaluate(() => continuaciones), 1);
  await p.evaluate(() => intro.cerrar());
  await comenzar(p, 'outro', niveles[9], true);
  assert.equal(await p.locator('.metronet-victoria__resumen').isVisible(), false);
  await p.clock.runFor(14967);
  assert.equal(await p.locator('.metronet-victoria__resumen').isVisible(), false);
  await p.clock.runFor(1);
  assert.equal(await p.locator('.metronet-victoria__resumen').isVisible(), true);
  assert.equal(await p.evaluate(() => resultado), undefined);
  await p.getByRole('button', { name: 'Ver desempeño y ranking' }).click();
  assert.equal(await p.evaluate(() => resultado), 'ranking');
});
