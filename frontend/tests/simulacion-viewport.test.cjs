// Phaser real y API interceptada: no hay escrituras en PostgreSQL ni globals en producción.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function cuadros(pagina, cantidad = 3) {
  await pagina.evaluate(n => new Promise(resolve => {
    const juego = escenaViewport.game;
    const contar = () => { if (--n === 0) { juego.events.off('postrender', contar); resolve(); } };
    juego.events.on('postrender', contar);
  }), cantidad);
}
async function abrir(t, width, multiple = false) {
  const red = {
    simulacion: { idDiseno: 77, idEscenario: 42, nombre: 'Prueba de viewport', estado: 'VALIDADO', modo: 'NIVEL', puntosInteresObjetivo: [{ idPunto: 1, posicionX: 596, posicionY: 493, radioCobertura: 60 }] },
    estaciones: [{ nombre: 'A', posicionX: 580, posicionY: 470 }, { nombre: 'B', posicionX: 700, posicionY: 460 }, { nombre: 'C', posicionX: 810, posicionY: 480 }],
    lineas: [{ nombre: 'Azul' }], tramos: [{ nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B' }, { nombreLinea: 'Azul', estacionA: 'B', estacionB: 'C' }],
    unidadesMetro: [{ idTren: 1, nombreLinea: 'Azul', capacidad: 300, velocidadPromedio: 40 }],
    preparadoParaSimular: true, territorio: { areas: [], errores: [] }, resultados: [],
  };
  if (multiple) {
    red.lineas.push({ nombre: 'Verde' }); red.tramos.push({ nombreLinea: 'Verde', estacionA: 'A', estacionB: 'C' });
    red.unidadesMetro.push({ idTren: 2, nombreLinea: 'Verde', capacidad: 300, velocidadPromedio: 50 });
  }
  const vista = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { viewport: { width, height: 1000 }, responder: async req => {
    const p = new URL(req.url()).pathname;
    if (p === '/api/simulaciones') return { json: [red.simulacion, { ...red.simulacion, idDiseno: 78, nombre: 'Otra red' }] };
    if (p === '/api/simulaciones/77') return { json: red };
    if (p === '/api/simulaciones/78') return { json: { ...red, simulacion: { ...red.simulacion, idDiseno: 78 }, estaciones: red.estaciones.map(e => ({ ...e, posicionX: e.posicionX - 100 })) } };
    if (p.endsWith('/ejecutar')) { const resultado = { idSimulacion: red.resultados.length + 1, estado: 'COMPLETADA', puntaje: 0, ...req.postDataJSON() }; red.resultados.unshift(resultado); return { json: resultado }; }
    if (p.endsWith('/desempeno')) return { json: { puntajeMaximo: 100, puntaje: 90, redResuelta: true, etapa: 'SIMULACION', explicacion: 'Red resuelta. Simulá la configuración actual.', unidades: red.unidadesMetro.map(u => ({ idTren: u.idTren, linea: u.nombreLinea, velocidadKmh: u.velocidadPromedio, distanciaKm: 10, tiempoMinutos: 600 / u.velocidadPromedio })) } };
    if (p.endsWith('/evaluar')) return { json: { completado: false, mensaje: 'Resultado de prueba', progreso: 80 } };
  } });
  t.after(() => vista.contexto.close()); t.after(() => assert.deepEqual(vista.errores, []));
  await vista.pagina.route('**/src/simulacion/EscenaSimulacion.js*', async route => {
    const response = await route.fetch(), source = await response.text();
    assert.ok(source.includes('resolver({ escena: this, destruir });'));
    await route.fulfill({ response, body: source.replace('resolver({ escena: this, destruir });', `window.escenaViewport = this; window.ajustesViewport = 0; const ajustar = this.controlZoom.ajustarRed; this.controlZoom.ajustarRed = function(...args) { window.ajustesViewport++; return ajustar.apply(this,args); }; resolver({ escena: this, destruir });`) });
  });
  await vista.pagina.reload(); await vista.pagina.waitForFunction(() => window.escenaViewport?.disenoActual?.metricasUnidades?.length);
  await vista.pagina.locator('#desempenoNivel fieldset').waitFor({ state: 'attached' }); await cuadros(vista.pagina);
  return vista;
}
async function capturar(pagina) {
  return pagina.evaluate(() => {
    const s = escenaViewport, c = s.cameras.main, red = s.capaRedMetro;
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; };
    return {
      camara: { x: c.x, y: c.y, scrollX: c.scrollX, scrollY: c.scrollY, zoom: c.zoom, width: c.width, height: c.height },
      canvas: { pixelsX: s.game.canvas.width, pixelsY: s.game.canvas.height, ...rect(s.game.canvas) }, contenedor: rect(document.getElementById('visorSimulacion')),
      estaciones: red.puntosEstaciones.map(e => ({ ...e })),
      lineas: red.obtenerTramos().map(t => ({ ...t, ruta: red.obtenerRuta(t.nombreLinea).map(e => red.convertirPosicion(e.posicionX, e.posicionY)) })),
      pois: s.capaPuntosInteres.representaciones.map(p => ({ nombre: p.contenedor.name, x: p.contenedor.x, y: p.contenedor.y })),
      unidades: [...red.unidadesSimulacion].map(([id,u]) => ({ id, x: u.x, y: u.y })), estado: s.motorSimulacion.estado, ajustes: ajustesViewport,
    };
  });
}
function estable(antes, despues) {
  for (const key of ['camara', 'canvas', 'contenedor', 'estaciones', 'lineas', 'pois']) assert.deepEqual(despues[key], antes[key], `${key} debe conservarse`);
}
async function posicionar(pagina, modo) {
  if (modo === 'inicial') return;
  const alejar = pagina.getByRole('button', { name: 'Alejar mapa', exact: true });
  await alejar.click(); await cuadros(pagina);
  if (modo === 'acercado') {
    await alejar.click(); await cuadros(pagina); const antes = await capturar(pagina);
    await pagina.getByRole('button', { name: 'Acercar mapa', exact: true }).click(); await cuadros(pagina);
    assert.ok((await capturar(pagina)).camara.zoom > antes.camara.zoom);
  }
  if (modo === 'desplazado') {
    await pagina.locator('#visorSimulacion').scrollIntoViewIfNeeded(); await cuadros(pagina);
    const antes = await capturar(pagina), b = await pagina.locator('#visorSimulacion canvas').boundingBox();
    await pagina.mouse.move(b.x + b.width * .6, b.y + b.height * .6); await pagina.mouse.down();
    await pagina.mouse.move(b.x + b.width * .6 + 55, b.y + b.height * .6 - 30, { steps: 8 }); await pagina.mouse.up(); await cuadros(pagina);
    assert.notDeepEqual((await capturar(pagina)).camara, antes.camara, 'Pan manual debe funcionar');
  }
}
async function iniciar(pagina) {
  await pagina.locator('#formularioEjecucion button[type=submit]').click();
  await pagina.waitForFunction(() => escenaViewport.motorSimulacion.estado === 'EN_CURSO'); await cuadros(pagina);
}
for (const width of [1440, 768, 390]) for (const modo of ['inicial','desplazado','acercado','alejado']) {
  test(`Viewport ${width} ${modo}: iniciar, pausar, reanudar, detener y reiniciar`, async t => {
    const { pagina, solicitudes } = await abrir(t, width, modo === 'desplazado' || modo === 'alejado');
    await posicionar(pagina, modo); await pagina.locator('#formularioEjecucion button[type=submit]').scrollIntoViewIfNeeded(); await cuadros(pagina);
    const antes = await capturar(pagina); assert.ok(antes.pois.length > 0);
    await iniciar(pagina); const inicio = await capturar(pagina); estable(antes, inicio); assert.equal(inicio.ajustes, antes.ajustes);
    await cuadros(pagina, 15); const moviendo = await capturar(pagina); estable(antes, moviendo); assert.notDeepEqual(moviendo.unidades, inicio.unidades, 'Los metros deben moverse');
    await pagina.locator('#pausarSimulacion').click(); await cuadros(pagina); const pausa = await capturar(pagina); estable(antes, pausa);
    await cuadros(pagina, 15); assert.deepEqual((await capturar(pagina)).unidades, pausa.unidades);
    await pagina.locator('#reanudarSimulacion').click(); await cuadros(pagina, 15); estable(antes, await capturar(pagina));
    for (let i = 0; i < 3; i++) { await pagina.locator('#reiniciarSimulacion').click(); await cuadros(pagina); estable(antes, await capturar(pagina)); }
    await pagina.locator('#detenerSimulacion').click(); await cuadros(pagina, 15); estable(antes, await capturar(pagina));
    for (let i = 0; i < 2; i++) { await iniciar(pagina); estable(antes, await capturar(pagina)); await pagina.locator('#detenerSimulacion').click(); await cuadros(pagina); }
    assert.deepEqual(solicitudes.filter(s => s.method !== 'GET').map(s => s.path.split('/').at(-1)),
      Array.from({ length: 3 }, () => ['validacion', 'guardar', 'ejecutar']).flat(),
      'Cada inicio comprueba y guarda la red una vez antes de ejecutar');
  });
}
test('Seguimiento explícito: pausa y detención congelan la cámara sin perseguir el inicio', async t => {
  const { pagina } = await abrir(t, 1440, true); await posicionar(pagina, 'desplazado'); await iniciar(pagina);

  await pagina.locator('#seguirMetro').click(); await cuadros(pagina, 15);
  await pagina.locator('#pausarSimulacion').click(); const pausa = await capturar(pagina); await cuadros(pagina, 15); estable(pausa, await capturar(pagina));
  await pagina.locator('#reanudarSimulacion').click(); await cuadros(pagina, 15);
  await pagina.locator('#detenerSimulacion').click(); const detenida = await capturar(pagina); await cuadros(pagina, 15); estable(detenida, await capturar(pagina));
});
test('Ajustar red y cambiar de diseño conservan el encuadre explícito; resize permanece operativo', async t => {
  const { pagina } = await abrir(t, 1440); await posicionar(pagina, 'desplazado');
  const antes = await capturar(pagina); await pagina.getByRole('button', { name: 'Ajustar red', exact: true }).click(); await cuadros(pagina); assert.ok((await capturar(pagina)).ajustes > antes.ajustes);
  await pagina.goto(`${BASE}/simulacion.html?idDiseno=78`); await pagina.waitForFunction(() => window.escenaViewport?.disenoActual?.simulacion.idDiseno === 78);
  await pagina.waitForFunction(() => window.escenaViewport?.disenoActual?.metricasUnidades?.length); await cuadros(pagina);
  const otra = await capturar(pagina); assert.ok(otra.ajustes >= 1);
  await pagina.setViewportSize({ width: 768, height: 900 }); await cuadros(pagina, 30); const resized = await capturar(pagina); assert.notEqual(resized.canvas.pixelsX, otra.canvas.pixelsX);
  await pagina.locator('#formularioEjecucion button[type=submit]').scrollIntoViewIfNeeded(); await cuadros(pagina); const referencia = await capturar(pagina); await cuadros(pagina, 30); estable(referencia, await capturar(pagina));
});
