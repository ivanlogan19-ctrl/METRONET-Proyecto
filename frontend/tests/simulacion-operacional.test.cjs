const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrir(t, { fallaSegunda = false, viewport = { width: 1440, height: 900 } } = {}) {
  const red = {
    simulacion: { idDiseno: 77, nombre: 'Red operacional', modo: 'LIBRE', estado: 'VALIDADO' },
    estaciones: [{ nombre: 'A', posicionX: 580, posicionY: 470 }, { nombre: 'B', posicionX: 700, posicionY: 460 }],
    lineas: [{ nombre: 'Azul' }], tramos: [{ nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B' }],
    unidadesMetro: [1, 2].map(idTren => ({ idTren, nombreLinea: 'Azul', capacidad: 300, velocidadPromedio: 40 })),
    preparadoParaSimular: true, territorio: { areas: [], errores: [] }, resultados: [],
  };
  const vista = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { viewport, responder: async req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/simulaciones/77') return { json: red };
    if (path.endsWith('/desempeno')) return { json: { puntajeMaximo: 100, redResuelta: true, unidades: [] } };
    if (/\/unidades\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop());
      if (fallaSegunda && id === 2) return { status: 503, json: { detail: 'No se pudo guardar la segunda unidad.' } };
      await new Promise(resolve => setTimeout(resolve, 100)); // Escritura pendiente para probar doble envío.
      Object.assign(red.unidadesMetro.find(u => u.idTren === id), req.postDataJSON());
      return { status: 204 };
    }
    if (path.endsWith('/ejecutar')) return { json: { idSimulacion: 1, estado: 'COMPLETADA', ...req.postDataJSON() } };
  } });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.locator('#velocidadFisica').waitFor();
  return { ...vista, red };
}
async function aplicar(p, valor) {
  await p.locator('#velocidadFisica').fill(String(valor));
  await p.getByRole('button', { name: 'Aplicar velocidad', exact: true }).click();
  await p.waitForFunction(valor => document.getElementById('mensajeSimulacion').textContent.startsWith(`Velocidad guardada: ${valor}`)
    && !document.querySelector('[data-controles-circulacion]').disabled, valor);
}

test('Velocidad global e individual: persiste cada unidad, representa MIXTO y no altera km/h al cambiar ritmo', async t => {
  const { pagina: p, red, solicitudes } = await abrir(t);
  assert.equal(await p.locator('#velocidadFisica').count(), 1);
  assert.equal(await p.locator('#velocidadFisica').inputValue(), '40');
  await aplicar(p, 55);
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [55, 55]);
  await p.locator('#unidadCirculacion').selectOption('2');
  await aplicar(p, 30);
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [55, 30]);
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '2');
  assert.match(await p.locator('#seccionMetricas').innerText(), /M-2.*Azul/s);
  await p.locator('#unidadCirculacion').selectOption('todas');
  assert.equal(await p.locator('#velocidadFisica').inputValue(), '');
  assert.equal(await p.locator('[data-velocidad-mixta]').isVisible(), true);
  assert.equal(await p.locator('#seccionMetricas').isVisible(), false);
  const antes = solicitudes.filter(s => s.method === 'PATCH').length;
  for (const ritmo of ['0.5', '2', '4', '1']) await p.locator(`[data-velocidad="${ritmo}"]`).click();
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, antes);
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [55, 30]);
});

test('Escritura global parcial: informa lo persistido y recarga valores reales sin duplicar solicitudes', async t => {
  const { pagina: p, red, solicitudes } = await abrir(t, { fallaSegunda: true });
  await p.locator('#velocidadFisica').fill('60');
  await p.locator('.simulacion-parametro-velocidad').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await p.locator('#mensajeSimulacion.error').filter({ hasText: '1 de 2' }).waitFor();
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [60, 40]);
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 2);
  assert.equal(await p.locator('[data-velocidad-mixta]').isVisible(), true);
  assert.equal(await p.locator('#velocidadFisica').isEnabled(), true);
  await p.locator('#unidadCirculacion').selectOption('2');
  assert.equal(await p.locator('#velocidadFisica').inputValue(), '40');
});

test('Ejecución: validación automática, duración real y selección sin permitir escrituras en marcha o pausa', async t => {
  const { pagina: p, solicitudes } = await abrir(t);
  await p.locator('#duracionSimulacion').fill('9');
  await p.locator('#formularioEjecucion button').click();
  assert.equal(solicitudes.some(s => s.path.endsWith('/ejecutar')), false);
  await p.locator('#duracionSimulacion').fill('60');
  await p.locator('[data-velocidad="2"]').click();
  await p.locator('#formularioEjecucion button').click();
  await p.locator('#pausarSimulacion:not([hidden])').waitFor();
  assert.equal(await p.locator('#velocidadFisica').isDisabled(), true);
  await p.locator('#unidadCirculacion').selectOption('1');
  assert.equal(await p.locator('#seccionMetricas').isVisible(), true);
  await p.locator('#pausarSimulacion').click();
  assert.equal(await p.locator('#velocidadFisica').isDisabled(), true);
  assert.equal(await p.locator('#unidadCirculacion').isEnabled(), true);
  await p.locator('#detenerSimulacion').click();
  assert.equal(await p.locator('#velocidadFisica').isEnabled(), true);
  assert.deepEqual(solicitudes.find(s => s.path.endsWith('/ejecutar')).body, { velocidad: 2, duracion: 60 });
  assert.ok(solicitudes.some(s => s.path.endsWith('/validacion') && s.method === 'POST'));
  assert.ok(solicitudes.some(s => s.path.endsWith('/guardar') && s.method === 'POST'));
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 0);
});

for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [768, 900], [390, 844], [320, 740]]) {
  test(`Panel operacional ${width}×${height}: controles compactos, resultados plegados y sin duplicaciones`, async t => {
    const { pagina: p } = await abrir(t, { viewport: { width, height } });
    assert.equal(await p.locator('#consignaSimulacion, #objetivoConsigna, #puntuacionSimulacion').count(), 0);
    assert.equal(await p.locator('#seccionResultados').evaluate(e => e.open), false);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const mapa = await p.locator('#visorSimulacion').boundingBox();
    const panel = await p.locator('#instrumentosSimulacion').boundingBox();
    if (width > 1050) { assert.ok(panel.x >= mapa.x + mapa.width); assert.ok(panel.width <= 282); }
    else assert.ok(panel.y > mapa.y + mapa.height);
    await p.locator('#unidadCirculacion').selectOption('2');
    await p.locator('#velocidadFisica').focus();
    assert.equal(await p.locator('#velocidadFisica').evaluate(e => e === document.activeElement), true);
    assert.equal(await p.locator('#duracionSimulacion').getAttribute('min'), '10');
    if (process.env.METRONET_CAPTURAS_SIMULACION) await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_SIMULACION}/operacional-${width}.png`, fullPage: true });
  });
}
