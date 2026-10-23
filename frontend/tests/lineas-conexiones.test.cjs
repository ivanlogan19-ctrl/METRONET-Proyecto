const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
async function abrir(t, opciones) {
  const vista = await abrirEditor(navegador, opciones);
  t.after(() => vista.contexto.close());
  t.after(() => assert.deepEqual(vista.errores, []));
  return vista;
}
async function estacion(p, nombre) {
  await p.evaluate(nombre => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor: editorPrueba.disenoActual.estaciones.find(e => e.nombre === nombre) }), nombre);
}
async function esperar(p) { await p.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente); }

test('Línea extiende dos veces sin cambiar identidad, color ni ruta al reabrir', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { estaciones: [
    { nombre: 'Centro', posicionX: 580, posicionY: 470 }, { nombre: 'Parque', posicionX: 700, posicionY: 460 },
    { nombre: 'Este', posicionX: 780, posicionY: 480 }, { nombre: 'Final', posicionX: 810, posicionY: 480 },
  ] });
  const color = await p.evaluate(() => editorPrueba.capaRedMetro.colorLinea('Azul'));
  await p.locator('[data-elegir-herramienta=lineas]').click();
  await estacion(p, 'Parque'); await estacion(p, 'Este'); await esperar(p);
  await estacion(p, 'Final'); await esperar(p);
  assert.equal(await p.evaluate(() => editorPrueba.disenoActual.lineas.length), 1);
  assert.deepEqual(solicitudes.map(s => s.ruta.split('/').slice(-2).join('/')), ['lineas/extender', 'lineas/extender']);
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  assert.equal(await p.evaluate(() => editorPrueba.capaRedMetro.colorLinea('Azul')), color);
  assert.equal(await p.evaluate(() => editorPrueba.disenoActual.tramos.length), 3);
});

test('Línea inicia otro recorrido desde una estación libre sin botones adicionales', async t => {
  const { pagina: p, solicitudes } = await abrir(t);
  await p.locator('[data-elegir-herramienta=lineas]').click();
  assert.equal(await p.locator('[data-nueva-linea]').count(), 0);
  await estacion(p, 'Este'); await estacion(p, 'Parque'); await esperar(p);
  assert.equal(solicitudes[0].ruta, '/api/simulaciones/77/lineas');
  const colores = await p.evaluate(() => [...editorPrueba.capaRedMetro.coloresLineas.values()]);
  assert.equal(new Set(colores).size, 2);
  assert.equal(await p.evaluate(() => editorPrueba.capaRedMetro.esTransbordo(editorPrueba.disenoActual.estaciones[1])), true);
});

test('Conexión conserva ambas rutas, muestra el símbolo distinto y puede eliminarse', async t => {
  const { pagina: p, diseno } = await abrir(t, { estaciones: [
    { nombre: 'Centro', posicionX: 580, posicionY: 470 }, { nombre: 'Parque', posicionX: 700, posicionY: 460 },
    { nombre: 'Este', posicionX: 780, posicionY: 480 }, { nombre: 'Final', posicionX: 810, posicionY: 480 },
  ], lineas: [{ nombre: 'Azul' }, { nombre: 'Verde' }], tramos: [
    { nombreLinea: 'Azul', estacionA: 'Centro', estacionB: 'Parque' },
    { nombreLinea: 'Verde', estacionA: 'Este', estacionB: 'Final' },
  ] });
  const tramos = structuredClone(diseno.tramos);
  const rutas = await p.evaluate(() => JSON.stringify(['Azul', 'Verde'].map(n => editorPrueba.capaRedMetro.obtenerRuta(n))));
  await p.locator('[data-elegir-herramienta=conexiones]').click();
  await estacion(p, 'Parque'); await estacion(p, 'Este'); await esperar(p);
  assert.equal(diseno.conexionesLineas.length, 1);
  assert.deepEqual(diseno.tramos, tramos);
  assert.equal(await p.evaluate(() => JSON.stringify(['Azul', 'Verde'].map(n => editorPrueba.capaRedMetro.obtenerRuta(n)))), rutas);
  assert.equal(await p.evaluate(() => editorPrueba.capaRedMetro.esTransbordo(editorPrueba.disenoActual.estaciones[1])), true);
  await p.evaluate(async () => { await editorPrueba.abrirDiseno(77); editorPrueba.restablecerModo(); editorPrueba.seleccionarElemento({ tipo: 'conexionLinea', valor: editorPrueba.disenoActual.conexionesLineas[0] }); });
  await p.locator('[data-accion-edicion=eliminar]').click();
  await p.locator('[data-confirmar-eliminar]').click();
  await p.waitForFunction(() => editorPrueba.disenoActual.conexionesLineas.length === 0);
  assert.deepEqual(diseno.tramos, tramos);
});


test('Metro en conexión: asignación, ruta exclusiva, reloj, configuración y distancia total', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { modo: 'LIBRE', estaciones: [
    { nombre: 'A', posicionX: 600, posicionY: 430 }, { nombre: 'B', posicionX: 630, posicionY: 430 },
    { nombre: 'C', posicionX: 660, posicionY: 430 }, { nombre: 'D', posicionX: 690, posicionY: 430 },
  ], lineas: [{ nombre: 'Azul' }, { nombre: 'Verde' }], tramos: [
    { nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B', distanciaKm: 1.2 },
    { nombreLinea: 'Verde', estacionA: 'C', estacionB: 'D', distanciaKm: 2.3 },
  ], conexionesLineas: [{ idConexion: 8, lineaA: 'Azul', estacionA: 'B', lineaB: 'Verde', estacionB: 'C', distanciaKm: 0.5 }] });
  await p.locator('[data-elegir-herramienta=metros]').click();
  await p.evaluate(() => editorPrueba.seleccionarElemento({ tipo: 'conexionLinea', valor: editorPrueba.disenoActual.conexionesLineas[0] }));
  await esperar(p);
  assert.equal(solicitudes.at(-1).datos.idConexion, 8);
  assert.equal(solicitudes.at(-1).datos.nombreLinea, undefined);
  const resultado = await p.evaluate(async () => {
    const { default: Motor } = await import('/src/simulacion/MotorSimulacion.js');
    const { default: Selector } = await import('/src/simulacion/SelectorLineasReproduccion.js');
    const d = editorPrueba.disenoActual;
    const motor = new Motor(d); motor.seleccionarLineas(['@conexion:8']);
    const selector = new Selector(d, () => {}); document.body.append(selector.elemento);
    const boton = selector.elemento.querySelector('[data-linea-reproducir="@conexion:8"]');
    const resultado = { rutas: motor.rutas.map(r => r.ruta.map(e => e.nombre)), nombre: boton.textContent,
      color: boton.querySelector('b').style.background };
    selector.elemento.remove(); return resultado;
  });
  assert.deepEqual(resultado.rutas, [['B', 'C']]);
  assert.match(resultado.nombre, /^Conexión /);
  assert.match(resultado.color, /linear-gradient/);
  await p.locator('[data-medicion-distancias]').click();
  assert.equal(await p.locator('.metronet-mediciones__fila').count(), 3);
  assert.match(await p.locator('[data-recorrido="@conexion:8"]').innerText(), /0,5 km/);

});
