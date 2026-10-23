const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('La regla muestra solo el cuadro estable al acercar y girar la simulación', async t => {
  const browser = await abrirNavegador({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const v = await abrirPantalla(browser, '/simulacion.html?idDiseno=77', { responder: req => {
    if (new URL(req.url()).pathname === '/api/simulaciones/77') return { json: {
      simulacion: { idDiseno: 77, idEscenario: 42, nombre: 'Modo libre', modo: 'LIBRE', estado: 'VALIDADO' },
      estaciones: [{ nombre: 'A', posicionX: 400, posicionY: 420 }, { nombre: 'B', posicionX: 770, posicionY: 410 }],
      lineas: [{ nombre: 'Línea 01' }],
      tramos: [{ nombreLinea: 'Línea 01', estacionA: 'A', estacionB: 'B', distanciaKm: 8.2 }],
      unidadesMetro: [{ idTren: 1, nombreLinea: 'Línea 01', capacidad: 300, velocidadPromedio: 4, duracionUt: 2 }],
      preparadoParaSimular: true, observacionesSimulacion: [], resultados: [], territorio: { areas: [], errores: [] },
    } };
  } });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  await p.getByRole('button', { name: 'Continuar', exact: true }).click();
  await p.route('**/src/simulacion/EscenaSimulacion.js*', async route => {
    const respuesta = await route.fetch();
    await route.fulfill({ response: respuesta, body: (await respuesta.text()).replace(
      'resolver({ escena: this, destruir });', 'window.escenaMedicionPrueba = this; resolver({ escena: this, destruir });') });
  });
  await p.reload();
  await p.waitForFunction(() => window.escenaMedicionPrueba?.disenoActual);
  await p.getByRole('button', { name: 'Mostrar distancias en kilómetros', exact: true }).click();
  await p.locator('.metronet-mediciones__total:not([hidden])').waitFor();
  await p.evaluate(() => document.fonts.ready);
  const resultado = await p.evaluate(async () => {
    const overlay = document.querySelector('.metronet-mediciones');
    const medicion = escenaMedicionPrueba.capaRedMetro.medicionDistancias;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const antes = overlay.innerHTML;
    let cambios = 0;
    const observador = new MutationObserver(registros => { cambios += registros.length; });
    observador.observe(overlay, { attributes: true, childList: true, characterData: true, subtree: true });
    for (let i = 0; i < 30; i++) escenaMedicionPrueba.events.emit('render');
    cambios += observador.takeRecords().length;
    observador.disconnect();
    return { cambios, activa: medicion.activa, conectada: medicion.overlay === overlay, mismoContenido: antes === overlay.innerHTML, texto: overlay.textContent };
  });
  console.log('REGLA EN REPOSO', JSON.stringify(resultado));
  assert.equal(resultado.mismoContenido, true);
  assert.equal(resultado.activa, true);
  assert.equal(resultado.conectada, true);
  assert.match(resultado.texto, /8,2 km/);
  assert.equal(resultado.cambios, 0, 'Una cámara y red inmóviles no necesitan escrituras repetidas de estilo o visibilidad');
  assert.deepEqual(v.errores, []);
  const posiciones = await p.evaluate(async () => {
    const escena = window.escenaMedicionPrueba;
    const capa = escena.capaRedMetro, camara = escena.cameras.main;
    const medicion = capa.medicionDistancias;
    const casos = [];
    const cuadro = medicion.total.getBoundingClientRect();
    for (const zoom of [.8, 1, 1.7, 2.4]) for (const giro of [0, .3]) {
      camara.setZoom(zoom).setRotation(giro);
      camara.centerOn(450, 400);
      camara.preRender();
      escena.events.emit('render');
      const actual = medicion.total.getBoundingClientRect();
      const mapa = medicion.overlay.getBoundingClientRect();
      casos.push({ fijo: actual.x === cuadro.x && actual.y === cuadro.y,
        dentro: actual.left >= mapa.left && actual.right <= mapa.right && actual.bottom <= mapa.bottom,
        etiquetas: medicion.overlay.querySelectorAll('.metronet-mediciones__tramo').length });
    }
    return casos;
  });
  for (const posicion of posiciones) {
    assert.ok(posicion.fijo && posicion.dentro, JSON.stringify(posicion));
    assert.equal(posicion.etiquetas, 0);
  }
  assert.equal(await p.locator('.metronet-mediciones__titulo').textContent(), 'Distancia total');
  assert.equal(await p.locator('.metronet-mediciones__subtitulo').count(), 0);
  await p.screenshot({path:`/tmp/metronet-distancia-simulacion-${process.env.METRONET_BROWSER || 'chromium'}.png`});
  await p.locator('[data-medicion-distancias]').click();
  assert.equal(await p.locator('.metronet-mediciones').isVisible(), false);
});
