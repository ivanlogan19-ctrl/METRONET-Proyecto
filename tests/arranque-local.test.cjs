const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Prueba de integración local: ejecutar con npm start activo. No usa credenciales.
const paquete = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
const host = paquete.scripts.start.match(/--host\s+([^\s"]+)/)?.[1];
const puerto = paquete.scripts.start.match(/--port\s+(\d+)/)?.[1];
assert.ok(host && puerto, 'No se pudo identificar el origen configurado para el frontend');
const origen = `http://${host}:${puerto}`;
const login = `http://${host}:8080/auth/login/admin`;

test('el frontend iniciado puede solicitar acceso al login ADMIN', async () => {
  const pagina = await fetch(`${origen}/admin-login.html`);
  assert.equal(pagina.status, 200);
  const respuesta = await fetch(login, { method: 'OPTIONS', headers: {
    Origin: origen,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  } });
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('access-control-allow-origin'), origen);
});

test('el navegador puede leer la validación del login sin bloquearse por CORS', async () => {
  const respuesta = await fetch(login, { method: 'POST',
    headers: { Origin: origen, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(respuesta.status, 400);
  assert.equal(respuesta.headers.get('access-control-allow-origin'), origen);
  const datos = await respuesta.json();
  assert.ok(datos.detail || datos.message, 'La validación debe informar el error al usuario');
});

test('un origen ajeno sigue sin acceso al login', async () => {
  const respuesta = await fetch(login, { method: 'OPTIONS', headers: {
    Origin: 'https://origen-no-autorizado.example',
    'Access-Control-Request-Method': 'POST',
  } });
  assert.equal(respuesta.status, 403);
  assert.equal(respuesta.headers.get('access-control-allow-origin'), null);
});
