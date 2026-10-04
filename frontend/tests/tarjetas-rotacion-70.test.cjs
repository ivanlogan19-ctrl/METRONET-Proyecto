const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fuente = fs.readFileSync(path.join(__dirname, '../src/educacion/TarjetasEducativasNivel.js'), 'utf8');

async function moduloAislado() {
  const datos = new Map();
  global.localStorage = {
    getItem: clave => datos.get(clave) ?? null,
    setItem: (clave, valor) => datos.set(clave, String(valor)),
  };
  return import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}#${Math.random()}`);
}

test('las siete tarjetas iniciales se agotan antes de repetir', async () => {
  const tarjetas = await moduloAislado();
  assert.deepEqual(tarjetas.tarjetasEducativas.map(nivel => nivel.length), Array(10).fill(7));
  const elegidas = Array.from({ length: 7 }, () => tarjetas.seleccionarTarjetaEducativa(1).id);
  assert.equal(new Set(elegidas).size, 7);
  const siguiente = tarjetas.seleccionarTarjetaEducativa(1).id;
  assert.notEqual(siguiente, elegidas[6]);
});

test('publicaciones nuevas de siete e históricas de seis rotan por separado', async () => {
  const tarjetas = await moduloAislado();
  const todas = tarjetas.tarjetasEducativas[2];
  tarjetas.registrarTarjetasPublicadas(3, { version: 2, tarjetas: todas }, 18);
  const nuevas = Array.from({ length: 7 }, () => tarjetas.seleccionarTarjetaEducativa(3).id);
  assert.equal(new Set(nuevas).size, 7);
  assert.notEqual(tarjetas.seleccionarTarjetaEducativa(3).id, nuevas[6]);
  tarjetas.registrarTarjetasPublicadas(3, { version: 1, tarjetas: todas.slice(0, 6) }, 18, 81);
  assert.equal(tarjetas.tarjetasDisponibles(3).length, 6);
  const antiguas = Array.from({ length: 6 }, () => tarjetas.seleccionarTarjetaEducativa(3).id);
  assert.equal(new Set(antiguas).size, 6);
  assert.notEqual(tarjetas.seleccionarTarjetaEducativa(3).id, antiguas[5]);
});
