const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('La transición agrupa los cambios y presenta en el primer cuadro disponible', async () => {
  const eventos = new Map(), cuadros = new Map();
  let observar, ocupado = false, solicitudes = 0;
  const raiz = { dataset: {}, querySelector: () => ocupado ? {} : null };
  const ventana = { addEventListener: (nombre, callback) => eventos.set(nombre, callback) };
  ventana.parent = ventana.top = ventana;
  vm.runInNewContext(readFileSync(`${__dirname}/../public/transicion-pagina.js`, 'utf8'), {
    window: ventana, document: { documentElement: raiz, addEventListener() {}, fonts: { ready: Promise.resolve() } },
    history: {}, MutationObserver: class {
      constructor(callback) { observar = callback; }
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame: callback => { cuadros.set(++solicitudes, callback); return solicitudes; },
    cancelAnimationFrame: id => cuadros.delete(id),
  });
  eventos.get('DOMContentLoaded')();
  await Promise.resolve();
  for (let i = 0; i < 30; i++) observar();
  assert.equal(solicitudes, 1, 'Los cambios de contenido no deben cancelar y postergar el cuadro ya solicitado');
  // Si comienza otra carga antes de pintar, se espera su resultado.
  ocupado = true;
  cuadros.get(1)();
  assert.ok('pantallaPreparando' in raiz.dataset);
  ocupado = false;
  observar();
  assert.equal(solicitudes, 2);
  cuadros.get(2)();
  assert.ok(!('pantallaPreparando' in raiz.dataset));
  observar();
  assert.equal(solicitudes, 2);
});
