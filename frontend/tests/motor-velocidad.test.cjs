const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fuente = nombre => fs.readFileSync(path.join(__dirname, '../src/simulacion/', nombre), 'utf8');
const url = fuente => 'data:text/javascript;base64,' + Buffer.from(fuente).toString('base64');
const cargar = async () => (await import(url(fuente('MotorSimulacion.js')
  .replace('./EscalaSimulacion.js', url(fuente('EscalaSimulacion.js')))
  .replace('../mapa/controles/NombresRed.js', url(fuente('../mapa/controles/NombresRed.js')))))).default;
const red = (uv = [4, 6]) => ({
  estaciones: Array.from({ length: 31 }, (_, i) => ({ nombre: `E${i}` })),
  tramos: Array.from({ length: 30 }, (_, i) => ({ nombreLinea: 'Línea', estacionA: `E${i}`, estacionB: `E${i+1}` })),
  unidadesMetro: uv.map((velocidadPromedio, i) => ({ idTren: i + 1, nombreLinea: 'Línea', velocidadPromedio })),
});
test('La numeración visible pertenece a la red; los IDs persistidos se conservan', async () => {
  const Motor = await cargar(), datos = red();
  datos.unidadesMetro[0].idTren = 206;
  datos.unidadesMetro[1].idTren = 211;
  const motor = new Motor(datos);
  assert.deepEqual(motor.obtenerEstado().unidades.map(u => [u.idTren, u.identificador]), [[206, 'M-1'], [211, 'M-2']]);
  const nueva = red([4]); nueva.unidadesMetro[0].idTren = 900;
  assert.equal(new Motor(nueva).obtenerEstado().unidades[0].identificador, 'M-1');
});
test('UV, horas y ritmo son independientes, sin tiempos físicos derivados', async () => {
  const Motor = await cargar(), motor = new Motor(red());
  motor.iniciar({ duracion: 6, velocidad: 1, ahora: 0 });
  const antes = motor.actualizar(4500);
  assert.equal(antes.duracion, 6);
  assert.equal(antes.tiempoTranscurrido, 1.5);
  assert.deepEqual(antes.unidades.map(u => u.velocidadUV), [4, 6]);
  assert.equal(antes.unidades[0].progresoRuta, .2);
  assert.ok(antes.unidades[1].progresoRuta > antes.unidades[0].progresoRuta);
  motor.establecerVelocidad(2, 4500);
  assert.equal(motor.obtenerEstado().progreso, antes.progreso, 'Cambiar ritmo no salta la posición');
  const despues = motor.actualizar(6750);
  assert.equal(despues.tiempoTranscurrido, 3);
  assert.equal(despues.duracion, 6);
  assert.deepEqual(despues.unidades.map(u => u.velocidadUV), [4, 6]);
});
test('Cambiar UV conserva horas/ritmo y cambiar horas conserva UV/ritmo', async () => {
  const Motor = await cargar();
  const ejecutar = (uv, horas) => { const m = new Motor(red([uv])); m.iniciar({ duracion: horas, velocidad: 1 }); return m.actualizar(9000); };
  const base = ejecutar(4, 6), rapida = ejecutar(6, 6), larga = ejecutar(4, 8);
  assert.ok(rapida.unidades[0].progresoRuta > base.unidades[0].progresoRuta);
  assert.equal(rapida.duracion, 6); assert.equal(rapida.velocidad, 1);
  assert.ok(larga.unidades[0].progresoRuta > base.unidades[0].progresoRuta);
  assert.equal(larga.unidades[0].velocidadUV, 4); assert.equal(larga.velocidad, 1);
});
test('Pausa, stop y restart conservan UV, h y ritmo; finalización sin espera real de horas', async () => {
  const Motor = await cargar(), motor = new Motor(red());
  motor.iniciar({ duracion: 8, velocidad: 2, ahora: 0 }); motor.pausar(1000);
  const pausa = motor.actualizar(2000); assert.equal(pausa.estado, 'PAUSADA');
  motor.reanudar(3000); assert.ok(motor.actualizar(3500).progreso > pausa.progreso);
  motor.detener(); assert.equal(motor.obtenerEstado().progreso, 0);
  motor.reiniciar(4000); assert.equal(motor.duracion, 8); assert.equal(motor.velocidad, 2);
  assert.deepEqual(motor.obtenerEstado().unidades.map(u => u.velocidadUV), [4, 6]);
  const fin = motor.actualizar(13000); assert.equal(fin.estado, 'FINALIZADA'); assert.equal(fin.tiempoTranscurrido, 8);
  motor.iniciar({ duracion: 1000000, ahora: 0 }); assert.equal(motor.actualizar(18000).estado, 'FINALIZADA');
});
test('Una red corta termina en su última estación; no teletransporta ni inventa recorridos', async () => {
  const Motor = await cargar(), datos = red(); datos.tramos = datos.tramos.slice(0, 1);
  const motor = new Motor(datos); motor.iniciar({ duracion: 6 });
  const unidad = motor.actualizar(18000).unidades[0];
  assert.equal(unidad.estacionActual, 'E1'); assert.equal(unidad.proximaEstacion, null); assert.equal(unidad.progresoRuta, 1);
});
test('Formateo centralizado y reloj visual acotado', async () => {
  const escala = await import(url(fuente('EscalaSimulacion.js')));
  assert.equal(escala.formatearVelocidad(4), '4 UV'); assert.equal(escala.formatearDuracion(6), '6 h'); assert.equal(escala.formatearRitmo(2), '2×');
  assert.equal(escala.duracionVisual(1), 5000); assert.equal(escala.duracionVisual(6), 18000); assert.equal(escala.duracionVisual(1000), 18000);
});
