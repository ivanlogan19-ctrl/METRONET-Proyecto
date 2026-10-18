const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Protege cancelación, limpieza local y redirección aun si el servidor no responde.
for (const caso of ['cancelar', 'sinSesion', 'cerrar', 'falloRemoto']) {
  test(`cierre desde editor: ${caso}`, async () => {
    const efectos = [];
    const sesion = caso === 'sinSesion' ? null : { token: 'prueba' };
    const contexto = {
      confirmarSistema: async () => caso !== 'cancelar',
      obtenerSesionActiva: () => sesion,
      cerrarSesionRemota: async valor => { assert.equal(valor, sesion); efectos.push('remoto'); if (caso === 'falloRemoto') throw Error('Sin red'); },
      eliminarSesiones: () => efectos.push('limpieza'),
      window: { location: { assign: ruta => efectos.push(ruta) } },
    };
    const fuente = fs.readFileSync(path.join(__dirname, '../src/autenticacion/ControlSesionEditor.js'), 'utf8')
      .replace(/^import .*;$/gm, '').replaceAll('export ', '');
    const cerrar = vm.runInNewContext(`${fuente}; cerrarSesionEditor`, contexto);
    await cerrar();
    assert.deepEqual(efectos, caso === 'cancelar' ? [] : caso === 'sinSesion' ? ['limpieza', '/login.html'] : ['remoto', 'limpieza', '/login.html']);
  });
}

for (const activa of [true, false]) {
  test(`control del editor conserva el destino de simulación con sesión ${activa}`, () => {
    const eventos = [];
    const controlSesion = { addEventListener: (nombre, accion) => eventos.push({ nombre, accion }) };
    const controlSimulacion = {};
    const fuente = fs.readFileSync(path.join(__dirname, '../src/autenticacion/ControlSesionEditor.js'), 'utf8')
      .replace(/^import .*;$/gm, '').replaceAll('export ', '');
    const configurar = vm.runInNewContext(`${fuente}; configurarControlSesionEditor`, {
      obtenerSesionActiva: () => activa ? { token: 'prueba' } : null,
    });
    configurar(controlSesion, controlSimulacion);
    assert.equal(controlSimulacion.href, activa ? '/simulacion.html' : '/login.html?destino=%2Fsimulacion.html');
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].nombre, 'click');
    assert.equal(typeof eventos[0].accion, 'function');
    assert.doesNotThrow(() => configurar(controlSesion, null));
  });
}
