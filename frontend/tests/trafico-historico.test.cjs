const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cargar = () => import('../src/mapa/trafico/ModeloTrafico.mjs');

test('intensidad: sin datos no equivale a circulación baja; umbrales y hora', async () => {
  const { nivelIntensidad, normalizarHora } = await cargar();
  for (const v of [null, undefined, NaN, Infinity, -1, 2, '0']) assert.equal(nivelIntensidad(v), 'sinDatos');
  assert.equal(nivelIntensidad(0), 'baja');
  assert.equal(nivelIntensidad(1/3), 'baja');
  assert.equal(nivelIntensidad(.5), 'media');
  assert.equal(nivelIntensidad(1), 'alta');
  assert.equal(normalizarHora(24), 0);
  assert.equal(normalizarHora(-1), 23);
  assert.equal(normalizarHora(8.9), 8);
  assert.equal(normalizarHora(NaN), null);
});

test('datos históricos reales: cobertura, horas, asociación y fuente trazables', async () => {
  const { validarDatosTrafico } = await cargar();
  const datos = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/mapa/datos/trafico-historico.json')));
  assert.equal(validarDatosTrafico(datos), true);
  assert.equal(datos.periodo, '2026-09');
  assert.equal(datos.revision.fechas.length, 30);
  assert.ok(datos.tramos.length > 100);
  assert.ok(datos.excluidos.length > 0);
  assert.ok(datos.tramos.some(t => t.intensidades[3] !== t.intensidades[18]));
  assert.ok(datos.tramos.every(t => t.sensores.every(s => s.distanciaMetros <= 60)));
  assert.equal(validarDatosTrafico({ ...datos, tramos: [] }), false);
  assert.equal(validarDatosTrafico({ ...datos, tramos: [{ ...datos.tramos[0], intensidades: [0] }] }), false);
  assert.equal(validarDatosTrafico({ ...datos, tramos: [{ ...datos.tramos[0], coordenadas: [[-56,-34.9]] }] }), false);
});
