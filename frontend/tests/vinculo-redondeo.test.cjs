const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cargar = () => import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(`${__dirname}/../src/simulacion/VinculoUvUtLibre.js`)).toString('base64'));
test('La previsualización coincide con división decimal y techo a ocho decimales del servidor', async () => {
  const { calcularVinculo } = await cargar();
  for (const [km, valor, esperado] of [[.07,.01,7], [12,8,1.5], [1,3,.33333334], [1e-7,2,.00000005], [1.00000000001,1,1.00000001]]) {
    const diseno = { tramos: [{ nombreLinea:'L', estacionA:'A', estacionB:'B', distanciaKm:km }] };
    for (const referencia of ['UV', 'UT']) {
      const u = calcularVinculo(diseno, [{ nombreLinea:'L' }], referencia, valor)[0];
      assert.equal(referencia === 'UV' ? u.duracionUt : u.velocidadPromedio, esperado, `${km} / ${valor} en ${referencia}`);
      assert.equal(referencia === 'UV' ? u.velocidadPromedio : u.duracionUt, valor);
    }
  }
});

test('Modo Libre comienza en 1 UV; mostrar dos decimales no altera el cálculo preciso', async () => {
  const { velocidadInicial, valorVisible, calcularVinculo } = await cargar();
  for (const modo of ['LIBRE', 'EDICION_LIBRE']) assert.equal(velocidadInicial({ simulacion: { modo } }), 1);
  assert.equal(velocidadInicial({ simulacion: { modo: 'NIVEL' } }), 1);
  const unidad = calcularVinculo({ tramos: [{ nombreLinea:'L', estacionA:'A', estacionB:'B', distanciaKm:1 }] }, [{nombreLinea:'L'}], 'UV', 3)[0];
  assert.equal(valorVisible(unidad.duracionUt), '0.33');
  assert.equal(unidad.duracionUt, .33333334);
  assert.equal(valorVisible(1), '1');
  assert.equal(valorVisible(1.239), '1.24');
  assert.equal(valorVisible(.00001), '0'); // Sólo el campo visible: no se persiste este redondeo.
});

test('La selección vinculada nunca agrupa líneas y recupera una selección válida', async () => {
  const { normalizarSeleccion, seleccionarUnidades } = await cargar();
  const unidades=[{idTren:1,nombreLinea:'A'},{idTren:2,nombreLinea:'B'},{idTren:3,nombreLinea:'A'}];
  for(const id of ['todas',undefined,'eliminada']) assert.equal(normalizarSeleccion(unidades,id,true),'1');
  assert.equal(normalizarSeleccion(unidades,'3',true),'1');
  assert.equal(normalizarSeleccion(unidades,'2',true),'2');
  assert.equal(normalizarSeleccion([],'todas',true),'');
  assert.deepEqual(seleccionarUnidades(unidades,'todas',true),[]);
  assert.deepEqual(seleccionarUnidades(unidades,'1',true).map(u=>u.idTren),[1,3]);
  assert.equal(seleccionarUnidades(unidades,'todas',false).length,3,'Compatibilidad con escenarios sin vínculo por línea');
});
