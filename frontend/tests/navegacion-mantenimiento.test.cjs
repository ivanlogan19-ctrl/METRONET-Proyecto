// UI en Chrome con contratos interceptados. Backend y persistencia se prueban en JUnit.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function abrir(t, ruta, opciones = {}) {
  const vista = ruta === 'constructor' ? await abrirEditor(navegador, opciones) : await abrirPantalla(navegador, ruta, opciones);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  return vista;
}
for (const administrador of [false, true]) for (const width of [390, 820, 1440]) {
  test(`Navegación sin duplicación y cuenta accesible: ${administrador ? 'ADMIN' : 'JUGADOR'} / ${width}`, async t => {
    const { pagina: p, solicitudes } = await abrir(t, '/inicio.html', { administrador, viewport: { width, height: 900 } });
    const principal = p.locator('.metronet-navegacion__enlaces');
    await p.locator('.metronet-navegacion__usuario summary').click();
    const menu = p.locator('.metronet-navegacion__menu-usuario');
    assert.equal(await principal.isVisible(), width > 1024);
    assert.equal(await menu.locator('a:visible').count(), width > 1024 ? 1 : administrador ? 8 : 7);
    assert.equal(await menu.getByRole('link', { name: 'Reglas', exact: true }).isVisible(), width <= 1024);
    assert.equal(await menu.getByRole('link', { name: 'Mi perfil' }).isVisible(), true);
    if (width <= 1024) assert.equal(await menu.getByRole('link', { name: 'Niveles' }).isVisible(), true);
    await menu.getByRole('link', { name: 'Mi perfil' }).click();
    await p.waitForURL('**/perfil.html');
    await p.locator('.perfil-contenedor[aria-busy="false"]').waitFor();
    assert.equal(await p.locator('#rolUsuario').textContent(), administrador ? 'Administrador' : 'Jugador');
    await p.locator('.metronet-navegacion__usuario summary').click();
    await p.locator('.metronet-navegacion__menu-usuario button').click();
    await p.waitForURL('**/login.html');
    assert.ok(solicitudes.some(s => s.path === (administrador ? '/auth/logout/admin' : '/auth/logout')));
    assert.equal(await p.evaluate(() => localStorage.getItem('sesionUsuario')), null);
    assert.equal(await p.evaluate(() => localStorage.getItem('sesionAdministrador')), null);
  });
}

test('Los conceptos conservan texto, subrayado y definición con mouse y teclado', async t => {
  const { pagina: p } = await abrir(t, '/escenarios.html');
  await p.evaluate(async () => {
    const { destacarConceptos } = await import('/src/educacion/glosario/GlosarioContextual.js');
    const parrafo = document.createElement('p'); parrafo.id = 'conceptos-prueba';
    parrafo.textContent = 'Línea de metro, estaciones, conexiones, unidad de metro y POI.';
    document.querySelector('main').prepend(parrafo);
    destacarConceptos(parrafo, ['linea', 'estacion', 'conexion', 'unidad', 'poi']);
  });
  const terminos = p.locator('#conceptos-prueba button');
  assert.equal(await terminos.count(), 5);
  for (const termino of await terminos.all()) {
    for (const estado of ['normal', 'hover', 'focus']) {
      if (estado === 'hover') await termino.hover();
      if (estado === 'focus') await termino.focus();
      const css = await termino.evaluate(e => { const s = getComputedStyle(e); return { borde: s.borderTopWidth, fondo: s.backgroundColor, sombra: s.boxShadow, cursor: s.cursor, subrayado: s.textDecorationStyle }; });
      assert.deepEqual(css, { borde: '0px', fondo: 'rgba(0, 0, 0, 0)', sombra: 'none', cursor: 'help', subrayado: 'dotted' });
    }
    await termino.press('Enter');
    await p.locator('.metronet-glosario-ventana').waitFor();
    await p.keyboard.press('Escape');
    await p.locator('.metronet-glosario-ventana').waitFor({ state: 'detached' });
  }
  await terminos.first().click();
  await p.locator('.metronet-glosario-ventana').waitFor();
});

for (const width of [390, 1440]) test(`Mantenimiento cerrado: guarda, recarga y restaura / ${width}`, async t => {
  let modo = 'desactivado';
  const { pagina: p, solicitudes } = await abrir(t, '/admin.html', { viewport: { width, height: 1000 }, responder: async request => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/admin/configuracion/modo_mantenimiento') { modo = request.postDataJSON().valor; return { json: { clave: 'modo_mantenimiento', valor: modo } }; }
    if (path === '/api/admin/configuracion') return { json: [{ clave: 'modo_mantenimiento', valor: modo, descripcion: 'Estado de mantenimiento' }] };
  } });
  async function configurar(valor) {
    await p.locator('[data-vista="configuracion"]').click();
    const select = p.locator('#configuracion-modo_mantenimiento');
    assert.equal(await select.evaluate(e => e.tagName), 'SELECT');
    assert.deepEqual(await select.locator('option').evaluateAll(es => es.map(e => e.value)), ['desactivado', 'activado']);
    await select.selectOption(valor);
    await p.locator('[data-guardar-configuracion="modo_mantenimiento"]').click();
    await p.getByText('Configuración actualizada correctamente.', { exact: true }).waitFor();
    await p.reload();
    await p.locator('[data-vista="configuracion"]').click();
    assert.equal(await p.locator('#configuracion-modo_mantenimiento').inputValue(), valor);
  }
  await configurar('activado'); await configurar('desactivado');
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 2);
  assert.equal(await p.locator('.metronet-aviso-mantenimiento:visible').count(), 0);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

for (const width of [390, 1440]) test(`Referencias territoriales en el mapa, controles compactos / ${width}`, async t => {
  const { pagina: p } = await abrir(t, 'constructor', { viewport: { width, height: 1000 } });
  await p.locator('.metronet-poi>summary').click();
  const panel = p.locator('.metronet-poi__panel');
  assert.equal(await p.locator('[data-contenedor-selectores-mapa] .metronet-territorio').count(), 0);
  const controlPoi = panel.getByRole('button', { name: 'Zonas verdes', exact: true });
  await controlPoi.click();
  assert.equal(await p.evaluate(() => editorPrueba.escena.capaPuntosInteres.categoriasVisibles.has('ESPACIOS_VERDES')), true);
  await controlPoi.click();
  assert.equal(await p.evaluate(() => editorPrueba.escena.capaPuntosInteres.categoriasVisibles.has('ESPACIOS_VERDES')), false);
  assert.equal(await controlPoi.isVisible(), true);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const boton of await p.locator('.metronet-herramientas__barra button:visible').all()) {
    const medidas = await boton.evaluate(e => ({ alto: e.getBoundingClientRect().height, ancho: e.clientWidth, texto: e.scrollWidth }));
    assert.ok(medidas.alto <= 52, JSON.stringify(medidas));
    assert.ok(medidas.texto <= medidas.ancho, JSON.stringify(medidas));
  }
});
