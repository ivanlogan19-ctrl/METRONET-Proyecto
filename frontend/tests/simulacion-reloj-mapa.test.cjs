const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('Phaser: posición geográfica y reloj coinciden por línea durante toda la reproducción', async t => {
  const navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL });
  t.after(() => navegador.close());
  const red = {
    simulacion: { idDiseno: 77, nombre: 'Sincronización', modo: 'LIBRE', estado: 'VALIDADO' },
    estaciones: [
      { nombre: 'A', posicionX: 500, posicionY: 400 },
      { nombre: 'B', posicionX: 600, posicionY: 400 },
      { nombre: 'C', posicionX: 700, posicionY: 400 },
      { nombre: 'D', posicionX: 700, posicionY: 500 },
    ],
    lineas: [{ nombre: 'Azul' }, { nombre: 'Roja' }],
    tramos: [
      { nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B', distanciaKm: 2 },
      { nombreLinea: 'Azul', estacionA: 'B', estacionB: 'C', distanciaKm: 10 },
      { nombreLinea: 'Roja', estacionA: 'C', estacionB: 'D', distanciaKm: 18 },
    ],
    unidadesMetro: [
      { idTren: 1, nombreLinea: 'Azul', velocidadPromedio: 4, duracionUt: 3, capacidad: 300 },
      { idTren: 2, nombreLinea: 'Roja', velocidadPromedio: 4, duracionUt: 4.5, capacidad: 300 },
    ],
    preparadoParaSimular: true, territorio: { areas: [], errores: [] }, resultados: [],
  };
  const { pagina, contexto, errores } = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', {
    responder: req => new URL(req.url()).pathname === '/api/simulaciones/77' ? { json: red } : undefined,
  });
  t.after(() => contexto.close());
  await pagina.route('**/src/simulacion/EscenaSimulacion.js*', async route => {
    const respuesta = await route.fetch();
    await route.fulfill({ response: respuesta, body: (await respuesta.text()).replace(
      'resolver({ escena: this, destruir });',
      'window.escenaPrueba = this; resolver({ escena: this, destruir });') });
  });
  await pagina.reload();
  await pagina.waitForFunction(() => window.escenaPrueba?.motorSimulacion?.rutas.length === 2);
  const muestras = await pagina.evaluate(() => {
    const escena = window.escenaPrueba;
    escena.game.loop.sleep(); // Avanzar fotogramas deterministas con el motor y los dibujos reales.
    escena.iniciarAnimacion(1, 4.5);
    const inicio = escena.motorSimulacion.marcaInicio;
    return [0, .5, 1, 2, 3, 4.5].map(horas => {
      escena.update(inicio + horas / 4.5 * escena.motorSimulacion.duracionVisual, 16);
      const estado = escena.motorSimulacion.obtenerEstado();
      const tren = escena.capaRedMetro.unidadesSimulacion.get('1');
      const xEsperada = horas <= .5 ? 500 + horas * 200 : 600 + Math.min(1, (horas - .5) / 2.5) * 100;
      const punto = escena.capaRedMetro.convertirPosicion(xEsperada, 400);
      return { horas: estado.tiempoTranscurrido, estado: estado.estado,
        errorPosicion: Math.hypot(tren.x - punto.x, tren.y - punto.y),
        km: estado.unidades.map(u => u.distanciaRecorridaKm),
        relojActual: document.querySelector('[data-hora-actual]').textContent.trim(),
        relojFin: document.querySelector('[data-hora-fin]').textContent.trim() };
    });
  });
  for (const muestra of muestras) {
    assert.ok(muestra.errorPosicion < 1e-7, JSON.stringify(muestra));
    assert.deepEqual(muestra.km, [Math.min(12, muestra.horas * 4), Math.min(18, muestra.horas * 4)]);
    const minutos = 480 + muestra.horas * 60;
    assert.equal(muestra.relojActual, `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`);
    assert.equal(muestra.relojFin, '12:30');
  }
  assert.equal(muestras[4].estado, 'EN_CURSO', 'la línea corta termina a las 11:00 y la larga sigue');
  assert.equal(muestras[5].estado, 'FINALIZADA');
  assert.deepEqual(errores, []);
});
