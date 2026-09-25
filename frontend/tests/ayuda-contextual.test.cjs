const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const niveles = require('../src/educacion/niveles.json');
let orientar;
before(async () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../src/educacion/AyudaContextual.js'), 'utf8');
  ({ obtenerAyudaContextual: orientar } = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`));
});
const condicion = (clave, completado) => ({ clave, completado, texto: clave });
const contexto = (nivel = niveles[0]) => ({
  escenario: nivel, diseno: { estaciones: [], lineas: [] }, estadoConsigna: 'disponible',
  consigna: { estadoGlobal: 'INICIADO', condiciones: [condicion('minimoEstaciones', false), condicion('minimoLineas', false)] },
});

for (const nivel of niveles) test(`Nivel ${nivel.numero}: inicio, primer elemento, avance, evaluación y repetición`, () => {
  const c = contexto(nivel);
  const snapshot = JSON.stringify(nivel);
  if (nivel.reglasExito.requiereCoberturaPuntosInteres) c.consigna.condiciones.push(condicion('requiereCoberturaPuntosInteres', false));
  const inicio = orientar(c);
  assert.equal(inicio.clave, nivel.numero >= 4 ? 'explorar' : 'primera-estacion');
  c.diseno.estaciones.push({ nombre: 'A' });
  assert.equal(orientar(c).clave, 'primera-ubicada');
  c.diseno.estaciones.push({ nombre: 'B' });
  assert.equal(orientar(c).clave, 'primera-linea');
  if (nivel.numero <= 2) assert.match(orientar(c).pista, /confirmá con el mismo botón/);
  else assert.doesNotMatch(orientar(c).pista, /pulsá|clic|ingresá/);
  c.diseno.lineas.push({ nombre: 'L' });
  c.consigna.condiciones = [condicion('minimoEstaciones', true), condicion('minimoLineas', true), condicion('requiereRedValida', false)];
  assert.equal(orientar(c).clave, 'requiereRedValida');
  assert.equal(orientar(c).etiqueta, 'POR REVISAR');
  c.consigna.condiciones.at(-1).completado = true;
  c.consigna.estadoGlobal = 'LISTO';
  assert.equal(orientar(c).clave, 'listo', 'Cumplir condiciones no equivale a una evaluación registrada');
  c.consigna.estadoGlobal = 'COMPLETADO';
  assert.equal(orientar(c).clave, 'completado');
  assert.equal(orientar(contexto(nivel)).clave, 'primera-estacion', 'Un intento nuevo no hereda el anterior');
  assert.equal(JSON.stringify(nivel), snapshot, 'Nunca cambia objetivo, reglas ni herramientas');
});

test('condiciones geográficas, transbordo y unidades: manda el estado del servidor', () => {
  const c = contexto(niveles[8]); c.diseno = { estaciones: [{}, {}, {}], lineas: [{}] };
  for (const [clave, esperada] of [
    ['requiereGeografiaValida', 'territorio'], ['maximoEstaciones', 'limite'],
    ['requiereCoberturaPuntosInteres', 'requiereCoberturaPuntosInteres'], ['areaObjetivo:0', 'areas'],
    ['requiereObjetivosMismaLinea', 'requiereObjetivosMismaLinea'], ['minimoTransbordos', 'minimoTransbordos'],
    ['minimoMetros', 'minimoMetros'], ['minimoTramos', 'minimoTramos'],
  ]) {
    c.consigna.condiciones = [condicion('minimoEstaciones', true), condicion(clave, false)];
    assert.equal(orientar(c).clave, esperada);
    c.consigna.condiciones[1].completado = true;
    assert.equal(orientar(c).clave, 'listo', `${clave}: la pista pendiente debe desaparecer`);
  }
});

test('consigna ausente, incompleta, fallida o de otra actividad: no inventa cumplimiento', () => {
  const c = contexto();
  for (const estadoConsigna of ['cargando', 'noDisponible', 'sinDatos']) assert.equal(orientar({ ...c, estadoConsigna }).clave, 'sin-consigna');
  for (const condiciones of [[], [null], [{}], [{ clave: 'minimoEstaciones' }]]) assert.equal(orientar({ ...c, consigna: { condiciones } }).clave, 'sin-consigna');
  assert.equal(orientar({ ...c, escenario: { modo: 'EDICION_LIBRE' } }), null);
  assert.equal(orientar({ ...c, escenario: null }), null);
});

test('sin herramienta habilitada o con condiciones desconocidas no sugiere simular', () => {
  const c = contexto(niveles[3]); c.diseno = { estaciones: [{}, {}], lineas: [{}] };
  c.consigna.condiciones = [condicion('condicionFutura', false), condicion('requiereSimulacion', false)];
  assert.equal(orientar(c).clave, 'otra-condicion');
  c.escenario = { ...c.escenario, herramientasHabilitadas: { estaciones: false, simulacion: true } };
  c.consigna.condiciones[0] = condicion('minimoEstaciones', false);
  assert.equal(orientar(c).clave, 'otra-condicion');
});

test('errores, selección de extremos, referencias y circulación', () => {
  const c = contexto();
  assert.equal(orientar({ ...c, error: 'Las estaciones elegidas no pertenecen a la línea.' }).clave, 'error-recorrido');
  assert.equal(orientar({ ...c, error: 'El tramo cruza un área restringida.' }).clave, 'error-territorio');
  assert.equal(orientar({ ...c, error: 'Ingresá el nombre.' }).clave, 'error-nombre');
  assert.equal(orientar({ ...c, error: 'Elegí la línea para el metro.' }).clave, 'error-unidad');
  assert.equal(orientar({ ...c, error: 'No se permiten estaciones en Centro según la consigna.' }).clave, 'error-territorio');
  assert.equal(orientar({ ...c, error: 'La conexión atraviesa Centro, donde la consigna prohíbe tramos.' }).clave, 'error-territorio');
  assert.equal(orientar({ ...c, error: 'Hay conexiones duplicadas: A-B.' }).clave, 'error-recorrido');
  assert.equal(orientar({ ...c, modo: 'crearLinea', seleccionadas: ['A', 'B'] }).clave, 'crearLinea-2');
  assert.match(orientar({ ...c, modo: 'crearTramo' }).pista, /Conectar estaciones/);
  const geo = contexto(niveles[3]); geo.consigna.condiciones.push(condicion('requiereCoberturaPuntosInteres', false));
  assert.equal(orientar({ ...geo, referencia: { id: 1 } }).clave, 'referencia-elegida');
  geo.diseno = { estaciones: [{}, {}], lineas: [{}] };
  geo.consigna.condiciones = [condicion('requiereRedValida', true), condicion('requiereSimulacion', false)];
  assert.equal(orientar(geo).clave, 'simular');
  for (const estadoMotor of ['EN_CURSO', 'PAUSADA']) assert.equal(orientar({ ...geo, pantalla: 'simulacion', estadoMotor }).clave, `circulacion-${estadoMotor}`);
  assert.equal(orientar({ ...geo, pantalla: 'simulacion', estadoMotor: 'FINALIZADA' }).clave, 'simular', 'Finalizar la animación no demuestra éxito');
});
