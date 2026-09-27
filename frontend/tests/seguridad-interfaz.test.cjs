const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

test('Administración: datos persistidos con comillas se muestran como texto, sin ejecutar eventos', async t => {
  // Marcador inocuo; no se leen tokens ni se realizan solicitudes externas.
  const nombre = 'Prueba" onpointerover="window.marcadorInyeccion=1" data-prueba="';
  const { contexto, pagina } = await abrirPantalla(navegador, '/admin.html', { responder: req => {
    if (new URL(req.url()).pathname === '/api/admin/usuarios') return { json: [{ idUsuario: 101, nombre, apellido: 'Auditoría', email: 'auditoria@example.test', rol: 'JUGADOR' }] };
  } });
  t.after(() => contexto.close());
  await pagina.locator('[data-editar-usuario]').dispatchEvent('pointerover');
  assert.equal(await pagina.evaluate(() => window.marcadorInyeccion), undefined);
  assert.equal(await pagina.locator('[data-editar-usuario]').getAttribute('data-nombre'), nombre);
  assert.equal(await pagina.locator('#tablaUsuarios [onpointerover]').count(), 0);
  await pagina.locator('[data-editar-usuario]').click();
  assert.equal(await pagina.locator('#editorNombre').inputValue(), nombre);
});

test('destino del login: normalización del navegador no permite salir del origen', async t => {
  const { contexto, pagina } = await abrirPantalla(navegador, '/login.html');
  t.after(() => contexto.close());
  const destinos = await pagina.evaluate(async () => {
    const { obtenerDestinoSeguro } = await import('/src/autenticacion/DestinoSeguro.js');
    return ['/inicio.html', '/index.html?escenario=1', '//example.test', '/\\example.test', '/\n/example.test', 'https://example.test', 'javascript:alert(1)', null]
      .map(valor => obtenerDestinoSeguro(valor));
  });
  assert.deepEqual(destinos, ['/inicio.html', '/index.html?escenario=1', '/inicio.html', '/inicio.html', '/inicio.html', '/inicio.html', '/inicio.html', '/inicio.html']);
});

test('volver a una vista conservada después de cerrar sesión retira los datos privados', async t => {
  const { contexto, pagina } = await abrirPantalla(navegador, '/admin.html');
  t.after(() => contexto.close());
  await pagina.evaluate(() => {
    localStorage.removeItem('sesionAdministrador');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted:true }));
  });
  await pagina.waitForURL('**/login.html', { timeout:5000 });
  assert.equal(await pagina.locator('#tablaUsuarios').count(),0);
});
