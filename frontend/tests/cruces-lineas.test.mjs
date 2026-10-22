import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCrucesLineas } from '../src/mapa/utilidades/CrucesLineas.mjs';

const estaciones = [
  { nombre: 'A', posicionX: 0, posicionY: 0 }, { nombre: 'B', posicionX: 10, posicionY: 10 },
  { nombre: 'C', posicionX: 0, posicionY: 10 }, { nombre: 'D', posicionX: 10, posicionY: 0 },
];
const tramos = [
  { nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B' },
  { nombreLinea: 'Roja', estacionA: 'C', estacionB: 'D' },
];
test('Cruce interior entre líneas: una posición sin alterar estaciones ni tramos', () => {
  const original = structuredClone({ estaciones, tramos });
  assert.deepEqual(calcularCrucesLineas(estaciones, tramos), [{ posicionX: 5, posicionY: 5 }]);
  assert.deepEqual({ estaciones, tramos }, original);
});
test('Una estación compartida, tramos paralelos o de la misma línea no generan rombos', () => {
  assert.deepEqual(calcularCrucesLineas(estaciones, [tramos[0], { ...tramos[1], nombreLinea: 'Azul' }]), []);
  assert.deepEqual(calcularCrucesLineas(estaciones, [tramos[0], { nombreLinea: 'Roja', estacionA: 'B', estacionB: 'C' }]), []);
  assert.deepEqual(calcularCrucesLineas(estaciones, [tramos[0], { ...tramos[0], nombreLinea: 'Roja' }]), []);
});
test('Varios pares que cruzan en el mismo punto producen un solo marcador', () => {
  const puntos = [...estaciones, { nombre: 'E', posicionX: 5, posicionY: 0 }, { nombre: 'F', posicionX: 5, posicionY: 10 }];
  assert.deepEqual(calcularCrucesLineas(puntos, [...tramos, { nombreLinea: 'Verde', estacionA: 'E', estacionB: 'F' }]), [{ posicionX: 5, posicionY: 5 }]);
});
test('Ignora segmentos incompletos, degenerados y cruces fuera de los tramos', () => {
  assert.deepEqual(calcularCrucesLineas(estaciones, [tramos[0], { ...tramos[1], estacionA: 'Ausente' }]), []);
  assert.deepEqual(calcularCrucesLineas(estaciones, [tramos[0], { ...tramos[1], estacionB: 'C' }]), []);
  const puntos = [...estaciones, { nombre: 'E', posicionX: 20, posicionY: 0 }, { nombre: 'F', posicionX: 20, posicionY: 30 }];
  assert.deepEqual(calcularCrucesLineas(puntos, [tramos[0], { nombreLinea: 'Verde', estacionA: 'E', estacionB: 'F' }]), []);
});
