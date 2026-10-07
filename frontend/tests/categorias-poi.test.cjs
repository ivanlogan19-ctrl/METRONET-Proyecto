const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Simulación recupera solo las categorías POI elegidas en Edición para el mismo diseño', async () => {
  const datos = new Map();
  const contexto = vm.createContext({
    sessionStorage: {
      getItem: clave => datos.get(clave) ?? null,
      setItem: (clave, valor) => datos.set(clave, valor),
    },
  });
  const raiz = path.resolve(__dirname, '../src/mapa');
  const modulo = new vm.SourceTextModule(fs.readFileSync(path.join(raiz, 'EstadoCategoriasPoi.mjs'), 'utf8'), { context: contexto });
  await modulo.link(async () => new vm.SourceTextModule(
    fs.readFileSync(path.join(raiz, 'configuracion/CategoriasReferencias.js'), 'utf8'), { context: contexto }));
  await modulo.evaluate();
  const { guardarCategoriasPoi, leerCategoriasPoi } = modulo.namespace;

  assert.deepEqual([...leerCategoriasPoi(159)], []);
  guardarCategoriasPoi(159, ['SALUD', 'CULTURA', 'OTROS']);
  assert.deepEqual([...leerCategoriasPoi(159)], ['SALUD', 'CULTURA']);
  assert.deepEqual([...leerCategoriasPoi(160)], []);
  guardarCategoriasPoi(159, ['CULTURA']);
  assert.deepEqual([...leerCategoriasPoi(159)], ['CULTURA']);
  assert.deepEqual([...leerCategoriasPoi(159)], ['CULTURA'], 'Reentrar conserva solo la última selección explícita');
});
