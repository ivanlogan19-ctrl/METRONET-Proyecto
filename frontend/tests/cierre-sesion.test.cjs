const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function preparar(t, solicitar) {
  const ventanaAnterior = global.window;
  const fetchAnterior = global.fetch;
  global.window = { location: { protocol: 'http:', hostname: '127.0.0.1' } };
  global.fetch = solicitar;
  t.after(() => { global.window = ventanaAnterior; global.fetch = fetchAnterior; });
  const fuente = fs.readFileSync(path.join(__dirname, '../src/autenticacion/sesion.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);
}

for (const rol of ['JUGADOR', 'ADMIN']) test(`cierre remoto ${rol}: conserva endpoint, método y autorización`, async t => {
  const solicitudes = [];
  const respuesta = { status: 204 };
  const { cerrarSesionRemota } = await preparar(t, async (...args) => {
    solicitudes.push(args);
    return respuesta;
  });
  assert.equal(await cerrarSesionRemota({ token: 'sesion-prueba', usuario: { rol } }), respuesta);
  assert.deepEqual(solicitudes, [[`http://127.0.0.1:8080/auth/logout${rol === 'ADMIN' ? '/admin' : ''}`, {
    method: 'POST', headers: { Authorization: 'Bearer sesion-prueba' },
  }]]);
});

test('sin sesión no realiza solicitudes ni modifica almacenamiento', async t => {
  const { cerrarSesionRemota } = await preparar(t, () => assert.fail('No debe solicitar cierre sin token'));
  await cerrarSesionRemota(null);
  await cerrarSesionRemota({ usuario: { rol: 'JUGADOR' } });
});

test('conserva HTTPS y propaga la caída de red para que la vista complete su limpieza local', async t => {
  const fallo = new Error('Servidor no disponible');
  const { cerrarSesionRemota } = await preparar(t, async url => {
    assert.equal(url, 'https://metronet.example:8080/auth/logout');
    throw fallo;
  });
  window.location = { protocol: 'https:', hostname: 'metronet.example' };
  await assert.rejects(cerrarSesionRemota({ token: 'sesion-prueba', usuario: { rol: 'JUGADOR' } }), error => error === fallo);
});
