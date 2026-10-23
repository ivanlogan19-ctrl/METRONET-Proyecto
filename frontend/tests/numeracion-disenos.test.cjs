const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Cada cuenta numera sus diseños sin usar los identificadores globales', async () => {
  const { numerarDisenos, etiquetaDiseno } = await import('../src/red/NumeracionDisenos.mjs');
  const redes = [{ idDiseno: 720, idUsuario: 7 }, { idDiseno: 717, idUsuario: 8 }, { idDiseno: 700, idUsuario: 7 }];
  const original = structuredClone(redes);
  const numeros = numerarDisenos(redes);
  assert.deepEqual([...numeros], [[700, 1], [717, 1], [720, 2]]);
  assert.equal(etiquetaDiseno(redes[1], numeros), 'Diseño 1');
  assert.deepEqual(redes, original, 'No cambia las identidades ni el orden del listado');
});

test('Borrar todos deja cero diseños y el siguiente vuelve a ser Diseño 1', async () => {
  const { numerarDisenos, nombreDiseno } = await import('../src/red/NumeracionDisenos.mjs');
  assert.equal(numerarDisenos([]).size, 0);
  const nuevo = { idDiseno: 950 };
  assert.equal(nombreDiseno(nuevo, numerarDisenos([nuevo])), 'Diseño 1');
  const restantes = [{ idDiseno: 717 }, { idDiseno: 950 }];
  assert.equal(numerarDisenos(restantes).get(950), 2);
  assert.equal(numerarDisenos(restantes.slice(1)).get(950), 1);
});

test('Conserva los nombres y coincide entre el listado personal y el administrativo', async () => {
  const { numerarDisenos, nombreDiseno } = await import('../src/red/NumeracionDisenos.mjs');
  const personal = [{ idDiseno: 720, nombre: 'Red del centro' }, { idDiseno: 717 }];
  const administracion = personal.map(d => ({ ...d, idUsuario: 8 }));
  assert.deepEqual(numerarDisenos(personal), numerarDisenos(administracion));
  assert.equal(nombreDiseno(personal[0], numerarDisenos(personal)), 'Red del centro');
});
