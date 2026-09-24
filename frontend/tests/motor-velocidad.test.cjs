const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cargar = async () => (await import('data:text/javascript;base64,' + fs.readFileSync(path.join(__dirname, '../src/simulacion/MotorSimulacion.js')).toString('base64'))).default;
const red = () => ({
  estaciones: [{ nombre:'A' },{ nombre:'B' }],
  tramos: [{ nombreLinea:'Azul',estacionA:'A',estacionB:'B' }],
  unidadesMetro: [{ idTren:1,nombreLinea:'Azul',velocidadPromedio:40 },{idTren:2,nombreLinea:'Azul',velocidadPromedio:80}],
  metricasUnidades: [{idTren:1,tiempoMinutos:10},{idTren:2,tiempoMinutos:5}],
});
test('km/h y tiempos estimados afectan el avance relativo sin confundirse con reproducción ×', async () => {
  const Motor = await cargar(), motor = new Motor(red());
  motor.iniciar({duracion:10,velocidad:1,ahora:0});
  const estado = motor.actualizar(1250);
  assert.equal(estado.duracion,600);
  assert.equal(estado.unidades[0].velocidadKmh,40);
  assert.ok(estado.unidades[1].progresoRuta > estado.unidades[0].progresoRuta);
  motor.establecerVelocidad(2,1250);
  assert.equal(motor.obtenerEstado().unidades[0].velocidadKmh,40);
  assert.ok(motor.actualizar(2000).progreso > estado.progreso);
});
test('pausa, reanudación y reinicio conservan ventana visual y velocidades de circulación', async () => {
  const Motor = await cargar(), motor = new Motor(red());
  motor.iniciar({duracion:10,velocidad:1,ahora:0}); motor.pausar(1000);
  const pausa = motor.actualizar(2000); assert.equal(pausa.estado,'PAUSADA');
  motor.reanudar(3000); assert.ok(motor.actualizar(3500).progreso > pausa.progreso);
  motor.reiniciar(4000); assert.equal(motor.duracionVisual,5000); assert.equal(motor.duracion,600);
});
