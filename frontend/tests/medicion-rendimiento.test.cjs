const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('La regla sigue la cámara real al acercar y girar, sin reescribir el DOM en reposo', async t => {
  const browser = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL });
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
  await p.locator('.metronet-mediciones__tramo:not([hidden])').waitFor();
  await p.evaluate(() => document.fonts.ready);
  const resultado = await p.evaluate(async () => {
    const overlay = document.querySelector('.metronet-mediciones');
    const medicion = escenaMedicionPrueba.capaRedMetro.medicionDistancias;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const antes = overlay.innerHTML;
    let cambios = 0;
    const observador = new MutationObserver(registros => { cambios += registros.length; });
    observador.observe(overlay, { attributes: true, childList: true, characterData: true, subtree: true });
    // Ejecutar el mismo callback evita un falso verde si Chrome pausa Phaser
    // mientras otra prueba tiene el foco. No se altera la red ni la cámara.
    for (let i = 0; i < 30; i++) escenaMedicionPrueba.capaRedMetro.medicionDistancias.posicionar();
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
    // La conversión inversa de Phaser contrasta el centro de cada etiqueta DOM
    // con las coordenadas de la vía, sin repetir la proyección de la regla.
    for (const zoom of [.8, 1, 1.7, 2.4]) for (const giro of [0, .3]) for (const margen of [0, 40]) {
      camara.setViewport(margen, margen, escena.scale.gameSize.width - 2 * margen, escena.scale.gameSize.height - 2 * margen);
      camara.setZoom(zoom).setRotation(giro);
      const a = capa.convertirPosicion(400, 420), b = capa.convertirPosicion(770, 410);
      camara.centerOn((a.x + b.x) / 2 + 20, (a.y + b.y) / 2 - 30);
      camara.preRender();
      medicion.posicionar();
      const rect = escena.game.canvas.getBoundingClientRect();
      const elemento = medicion.etiquetas[0].elemento, etiqueta = elemento.getBoundingClientRect();
      const escala = rect.width / escena.scale.gameSize.width;
      const centro = camara.getWorldPoint((etiqueta.x + etiqueta.width / 2 - rect.x) / escala,
        (etiqueta.y + etiqueta.height / 2 - rect.y) / escala);
      const dx = b.x - a.x, dy = b.y - a.y;
      const distancia = Math.abs((centro.x - a.x) * dy - (centro.y - a.y) * dx) / Math.hypot(dx, dy) * zoom * escala;
      const fraccion = ((centro.x - a.x) * dx + (centro.y - a.y) * dy) / (dx * dx + dy * dy);
      casos.push({ zoom, giro, margen, fraccion, visible: !elemento.hidden, separacion: distancia - elemento.offsetHeight / 2 });
    }
    return casos;
  });
  for (const posicion of posiciones) {
    assert.ok(posicion.visible && posicion.fraccion >= 0 && posicion.fraccion <= 1
      && posicion.separacion >= 7.5 && posicion.separacion <= 42.5, JSON.stringify(posicion));
  }
});
