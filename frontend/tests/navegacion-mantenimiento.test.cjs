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
    assert.equal(await menu.locator('a:visible').count(), width > 1024 ? 1 : administrador ? 6 : 5);
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

for (const administrador of [false, true]) test(`Mantenimiento y simulación, cambio de estado / ${administrador ? 'ADMIN' : 'JUGADOR'}`, async t => {
  let modo = 'activado', falla = false;
  const { pagina: p, solicitudes } = await abrir(t, '/simulacion.html?idDiseno=77', { administrador, responder: async request => {
    if (new URL(request.url()).pathname === '/api/configuraciones') return falla ? { status: 500, json: {} } : { json: [{ clave: 'modo_mantenimiento', valor: modo }] };
  } });
  const aviso = p.locator('.metronet-aviso-mantenimiento');
  const iniciar = p.locator('#formularioEjecucion button[type=submit]');
  assert.equal(await aviso.isVisible(), !administrador);
  assert.equal(await iniciar.isDisabled(), !administrador);
  if (!administrador) {
    // Un submit programático tampoco debe iniciar una animación prohibida.
    await p.locator('#formularioEjecucion').evaluate(e => e.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(solicitudes.filter(s => s.path.endsWith('/ejecutar')).length, 0);
    falla = true;
    await p.evaluate(async () => { const { obtenerConfiguracionAplicacion } = await import('/src/configuracion/ConfiguracionAplicacion.js'); await obtenerConfiguracionAplicacion(JSON.parse(localStorage.sesionUsuario)); });
    assert.equal(await aviso.isVisible(), true);
    falla = false; modo = 'desactivado';
    await p.evaluate(() => window.dispatchEvent(new Event('focus')));
    await aviso.waitFor({ state: 'hidden' });
    assert.equal(await iniciar.isEnabled(), true);
    modo = 'activado';
    await p.evaluate(() => window.dispatchEvent(new Event('focus')));
    await aviso.waitFor();
    assert.equal(await iniciar.isDisabled(), true);
    assert.equal(await aviso.count(), 1);
  }
});

for (const width of [390, 1440]) test(`Referencias territoriales en el mapa, controles compactos / ${width}`, async t => {
  const { pagina: p } = await abrir(t, 'constructor', { viewport: { width, height: 1000 } });
  await p.locator('.metronet-poi>summary').click();
  const panel = p.locator('.metronet-poi__panel');
  assert.equal(await p.locator('[data-contenedor-selectores-mapa] .metronet-territorio').count(), 0);
  const controlPoi = panel.getByRole('button', { name: 'Zonas verdes', exact: true });
  await controlPoi.click();
  assert.equal(await p.evaluate(() => editorPrueba.escena.capaPuntosInteres.categoriasVisibles.has('ESPACIOS_VERDES')), false);
  await controlPoi.click();
  assert.equal(await controlPoi.isVisible(), true);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const boton of await p.locator('.metronet-herramientas__barra button:visible').all()) {
    const medidas = await boton.evaluate(e => ({ alto: e.getBoundingClientRect().height, ancho: e.clientWidth, texto: e.scrollWidth }));
    assert.ok(medidas.alto <= 52, JSON.stringify(medidas));
    assert.ok(medidas.texto <= medidas.ancho, JSON.stringify(medidas));
  }
});

test('Mantenimiento pausa el recorrido y el bypass visual no permite reanudar; al desactivar se recupera', async t => {
  let modo = 'desactivado';
  const { pagina: p, solicitudes } = await abrir(t, '/simulacion.html?idDiseno=77', { responder: request => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/configuraciones') return { json: [{ clave: 'modo_mantenimiento', valor: modo }] };
    if (path.endsWith('/ejecutar')) return { json: { idSimulacion: 1, estado: 'COMPLETADA', puntaje: 0, velocidad: 1, duracion: 60 } };
  } });
  await p.locator('#formularioEjecucion button[type=submit]').click();
  await p.waitForFunction(() => document.getElementById('estadoTiempoReal').textContent === 'En recorrido');
  modo = 'activado';
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await p.waitForFunction(() => document.getElementById('estadoTiempoReal').textContent === 'Pausada');
  assert.equal(await p.locator('#reanudarSimulacion').isDisabled(), true);
  await p.locator('#reanudarSimulacion').evaluate(e => { e.disabled = false; e.click(); });
  assert.equal(await p.locator('#estadoTiempoReal').textContent(), 'Pausada');
  await p.locator('#reiniciarSimulacion').evaluate(e => { e.disabled = false; e.click(); });
  assert.equal(await p.locator('#estadoTiempoReal').textContent(), 'Pausada');
  modo = 'desactivado';
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await p.locator('.metronet-aviso-mantenimiento').waitFor({ state: 'hidden' });
  await p.locator('#reanudarSimulacion').click();
  await p.waitForFunction(() => document.getElementById('estadoTiempoReal').textContent === 'En recorrido');
  assert.equal(solicitudes.filter(s => s.path.endsWith('/ejecutar')).length, 1);
});

test('Editor conserva cambios ante rechazo del backend y el aviso no tapa el mapa', async t => {
  const { pagina: p } = await abrir(t, 'constructor', { viewport: { width: 390, height: 844 } });
  await p.route('**/api/configuraciones', r => r.fulfill({ json: [{ clave: 'modo_mantenimiento', valor: 'activado' }] }));
  await p.route('**/api/simulaciones/77/guardar', r => r.fulfill({ status: 503, json: { detail: 'La plataforma está en mantenimiento.' } }));
  await p.evaluate(() => { editorPrueba.cambiosPendientes = true; window.dispatchEvent(new Event('focus')); });
  await p.locator('.metronet-aviso-mantenimiento').waitFor();
  await p.locator('[data-panel-edicion-toggle]').click();
  await p.locator('[data-guardar]').click();
  await p.getByText('Error: La plataforma está en mantenimiento.', { exact: true }).first().waitFor();
  assert.equal(await p.evaluate(() => editorPrueba.cambiosPendientes), true);
  const aviso = await p.locator('.metronet-aviso-mantenimiento').boundingBox();
  const editor = await p.locator('#metronet-aplicacion').boundingBox();
  assert.ok(editor.y >= aviso.y + aviso.height - 1);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});
