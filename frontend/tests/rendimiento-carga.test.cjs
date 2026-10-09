const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrirSimulacion(t) {
  const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', {
    administrador: true, responder: r => new URL(r.url()).pathname.endsWith('/desempeno')
      ? { json: { puntajeMaximo: 100, unidades: [{ idTren: 1, velocidadUV: 4 }] } } : null,
  });
  t.after(() => v.contexto.close());
  await v.pagina.route('**/src/simulacion/EscenaSimulacion.js*', async route => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text())
      .replace('resolver({ escena: this, destruir });', 'window.escenaCarga=this; resolver({ escena: this, destruir });') });
  });
  return v;
}

test('Reinicializar navegación limpia sus eventos y deja una sola cabecera y control musical', async t => {
  const v = await abrirPantalla(navegador, '/inicio.html', { administrador: true });
  t.after(() => v.contexto.close());
  await v.pagina.evaluate(async () => {
    const { inicializarNavegacion } = await import('/src/navegacion/NavegacionAplicacion.js');
    for (let i = 0; i < 10; i++) inicializarNavegacion({ actual: 'inicio' });
  });
  assert.equal(await v.pagina.locator('.metronet-navegacion').count(), 1);
  assert.equal(await v.pagina.locator('.metronet-audio').count(), 1);
  assert.deepEqual(v.errores, []);
});

test('Consigna lenta no encadena la carga de los controles UV/UT', async t => {
  const v = await abrirSimulacion(t);
  let liberar;
  const espera = new Promise(resolve => { liberar = resolve; });
  await v.pagina.route('**/consigna', async route => {
    await espera;
    await route.fulfill({ json: { condiciones: [], referenciasObjetivo: [] } });
  });
  try {
    await v.pagina.reload();
    // La respuesta se retiene hasta verificar el control: no compara tiempos de CPU.
    await v.pagina.locator('#velocidadUnidad').waitFor({ timeout: 2500 });
    assert.equal(await v.pagina.locator('#aplicarUnidadTiempo').isVisible(), true);
  } finally { liberar(); }
  assert.deepEqual(v.errores, []);
});

test('Recibir métricas del panel conserva las estaciones y el motor ya creados', async t => {
  const v = await abrirSimulacion(t);
  let liberar;
  const espera = new Promise(resolve => { liberar = resolve; });
  await v.pagina.route('**/desempeno', async route => {
    await espera;
    await route.fulfill({ json: { puntajeMaximo: 100, unidades: [{ idTren: 1, velocidadUV: 4 }] } });
  });
  try {
    await v.pagina.reload();
    await v.pagina.waitForFunction(() => window.escenaCarga?.disenoActual);
    await v.pagina.waitForFunction(() => {
      const c = escenaCarga.game.canvas;
      return c.width > 0 && Math.abs(c.width - c.parentElement.clientWidth) < 2;
    });
    await v.pagina.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await v.pagina.evaluate(() => {
      window.motorCarga = escenaCarga.motorSimulacion;
      window.objetosCarga = [...escenaCarga.children.list];
    });
    liberar();
    await v.pagina.locator('#velocidadUnidad').waitFor();
    const estado = await v.pagina.evaluate(() => ({
      mismoMotor: motorCarga === escenaCarga.motorSimulacion,
      mismosObjetos: objetosCarga.every(o => escenaCarga.children.list.includes(o)),
    }));
    assert.deepEqual(estado, { mismoMotor: true, mismosObjetos: true });
  } finally { liberar(); }
  assert.deepEqual(v.errores, []);
});

test('Diez entradas y salidas de Phaser liberan documentos y listeners al abandonar la vista', async t => {
  const v = await abrirPantalla(navegador, '/inicio.html', { administrador: true, contenedor: true,
    responder: r => new URL(r.url()).pathname === '/api/juego/escenarios' ? { json: [] } : null });
  t.after(() => v.contexto.close());
  const cdp = await v.contexto.newCDPSession(v.pagina);
  const muestras = [];
  for (let i = 0; i < 10; i++) {
    for (const [ruta, selector] of [
      ['/?idDiseno=77', '[data-editor-activo]:not([hidden])'],
      ['/simulacion.html?idDiseno=77', '#velocidadUnidad'],
      ['/inicio.html', '.metronet-inicio__tarjeta'],
    ]) {
      await Promise.all([v.vista.waitForNavigation({ waitUntil: 'domcontentloaded' }), v.vista.evaluate(r => location.assign(r), ruta)]);
      await v.vista.locator(selector).first().waitFor();
    }
    await cdp.send('HeapProfiler.collectGarbage');
    muestras.push(await cdp.send('Memory.getDOMCounters'));
  }
  // Comparar tras el calentamiento: los documentos anteriores no deben quedar
  // retenidos por Phaser. La cantidad no depende del recolector de memoria JS.
  const inicial = muestras[1], final = muestras.at(-1);
  assert.ok(final.documents <= inicial.documents + 1, JSON.stringify(muestras));
  assert.ok(final.jsEventListeners <= inicial.jsEventListeners + 5, JSON.stringify(muestras));
  // La navegación puede terminar durante la mezcla de dos pistas distintas.
  await v.pagina.waitForFunction(() => document.querySelectorAll('audio').length === 1);
  assert.equal(await v.pagina.locator('audio').count(), 1);
  assert.deepEqual(v.errores, []);
});
