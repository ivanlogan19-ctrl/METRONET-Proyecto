const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function prepararEscala() {
  const ventana = { innerWidth: 2940, innerHeight: 1680, outerWidth: 2940, outerHeight: 1780, devicePixelRatio: 2 };
  const pendientes = [];
  let redimensionar;
  let escala;
  ventana.addEventListener = (nombre, accion) => { redimensionar = accion; };
  const marco = { style: { setProperty: (nombre, valor) => { escala = Number(valor); } } };
  const fuente = readFileSync(`${__dirname}/../src/navegacion/EscalaInterfaz.js`, 'utf8').replace('export function', 'function');
  runInNewContext(`${fuente}\nadaptarEscalaInterfaz(marco);`, {
    window: ventana, marco, requestAnimationFrame: accion => pendientes.push(accion)
  });
  return { ventana, pendientes, redimensionar: () => redimensionar(), escala: () => escala };
}

test('La escala respeta el zoom del usuario y agrupa los eventos de tamaño', () => {
  const prueba = prepararEscala();
  assert.equal(prueba.escala(), 2);
  Object.assign(prueba.ventana, { innerWidth: 2352, innerHeight: 1344, devicePixelRatio: 2.5 });
  prueba.redimensionar();
  prueba.redimensionar();
  assert.equal(prueba.pendientes.length, 1);
  prueba.pendientes.shift()();
  assert.equal(prueba.escala(), 2, 'El ajuste automático no debe cancelar el zoom de 125 %');
  Object.assign(prueba.ventana, { innerWidth: 1176, innerHeight: 672, outerWidth: 1470, outerHeight: 940 });
  prueba.redimensionar();
  prueba.pendientes.shift()();
  assert.equal(prueba.escala(), 1);
});
