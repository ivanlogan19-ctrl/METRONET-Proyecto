const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const entrada = fs.readFileSync(path.join(__dirname, '../public/iniciar-contenedor.js'), 'utf8');

function arrancar(ruta, { tipo = 'navigate', contenido = false, documento = false, continuacion = false } = {}) {
  const url = new URL(ruta, 'http://127.0.0.1:5174');
  if (documento) url.searchParams.set('documento', '1');
  const reemplazos = [];
  const datos = new Map([['sesionUsuario', '{"token":"sesion-previa"}'],
    ['metronet:salida-contenedor', JSON.stringify({ ruta: '/', instante: Date.now(), posicion: { x: 1, y: 2 } })]]);
  if (continuacion) datos.set('metronet:continuacion-documento', JSON.stringify({
    origen: url.origin, destino: url.pathname + url.search + url.hash, instante: Date.now(),
  }));
  const ventana = { name: continuacion ? 'metronet:respaldo' : '', stop() { ventana.detenciones++; }, detenciones: 0 };
  ventana.top = contenido ? {} : ventana;
  const location = {
    href: url.href, protocol: url.protocol,
    replace(destino) { reemplazos.push(destino); },
  };
  vm.runInNewContext(entrada, {
    window: ventana, location, URL, URLSearchParams, Set, Number, Date, Symbol,
    performance: { getEntriesByType: () => [{ type: tipo }] },
    history: { state: null },
    sessionStorage: { getItem: clave => datos.get(clave) ?? null, removeItem: clave => datos.delete(clave) },
  });
  return { reemplazos, datos, detenciones: ventana.detenciones };
}

test('Un arranque nuevo o restaurado del juego abre login sin borrar sesión ni intención previa', () => {
  for (const ruta of ['/', '/index.html', '/?idDiseno=7&idIntento=8#partida',
    '/simulacion.html?idDiseno=7', '/inicio.html', '/admin.html']) {
    for (const tipo of ['navigate', 'reload', 'back_forward']) {
      const resultado = arrancar(ruta, { tipo });
      assert.deepEqual(resultado.reemplazos, ['/login.html'], `${ruta} ${tipo}`);
      assert.equal(resultado.datos.get('sesionUsuario'), '{"token":"sesion-previa"}');
      assert.equal(resultado.datos.has('metronet:salida-contenedor'), true);
      assert.equal(resultado.detenciones, 1);
    }
  }
});

test('Login y navegación contenida mantienen el flujo existente', () => {
  const login = arrancar('/login.html');
  assert.equal(login.reemplazos.length, 1);
  assert.match(login.reemplazos[0], /^\/aplicacion\.html\?destino=%2Flogin\.html/);
  assert.deepEqual(arrancar('/?idDiseno=7', { contenido: true }).reemplazos, []);
  assert.deepEqual(arrancar('/?idDiseno=7', { documento: true, continuacion: true }).reemplazos, []);
});

test('documento=1 directo o recargado no evita el login; solo continúa un enlace interno', () => {
  for (const ruta of ['/inicio.html', '/?idDiseno=7&idIntento=8#partida', '/simulacion.html?idDiseno=7']) {
    assert.deepEqual(arrancar(ruta, { documento: true }).reemplazos, ['/login.html']);
    assert.deepEqual(arrancar(ruta, { documento: true, tipo: 'reload', continuacion: true }).reemplazos, ['/login.html']);
    assert.deepEqual(arrancar(ruta, { documento: true, continuacion: true }).reemplazos, []);
  }
});
