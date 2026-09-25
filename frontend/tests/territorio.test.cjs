const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function preparar(t, opciones) {
  const prueba = await abrirEditor(navegador, opciones);
  t.after(() => prueba.contexto.close());
  t.after(() => assert.deepEqual(prueba.errores, []));
  return prueba;
}
async function clic(pagina, x, y, zoom = 1.5) {
  await pagina.evaluate(({ x, y, zoom }) => {
    const p = editorPrueba.capaRedMetro.convertirPosicion(x, y);
    editorPrueba.escena.cameras.main.setZoom(zoom).centerOn(p.x, p.y);
  }, { x, y, zoom });
  await pagina.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const p = await pagina.evaluate(({ x, y }) => {
    const p = editorPrueba.capaRedMetro.convertirPosicion(x, y), c = editorPrueba.escena.cameras.main;
    const rect = editorPrueba.escena.game.canvas.getBoundingClientRect();
    return { x: rect.x + (p.x - c.worldView.x) * c.zoom, y: rect.y + (p.y - c.worldView.y) * c.zoom };
  }, { x, y });
  await pagina.mouse.click(p.x, p.y);
}
async function activarCreacion(pagina, nombre = 'Nueva') {
  await pagina.locator('[data-elegir-herramienta="estaciones"]').click();
  await pagina.locator('[data-nombre-estacion]').fill(nombre);
  await pagina.locator('[data-agregar-estacion]').click();
}

test('clic fuera del territorio no envía POST, incluso con zoom y pan; dentro crea', async t => {
  const { pagina, solicitudes } = await preparar(t);
  await activarCreacion(pagina);
  for (const zoom of [1, 2.5, 4]) {
    await clic(pagina, 600, 600, zoom);
    assert.equal(solicitudes.length, 0);
    assert.equal(await pagina.evaluate(() => editorPrueba.modo), 'crearEstacion');
    assert.match(await pagina.locator('body').innerText(), /debe quedar dentro del territorio/);
  }
  await clic(pagina, 750, 500);
  await pagina.waitForFunction(() => editorPrueba.disenoActual.estaciones.some(e => e.nombre === 'Nueva'));
  assert.equal(solicitudes.length, 1);
  assert.equal(solicitudes[0].metodo, 'POST');
  assert.ok(Math.abs(solicitudes[0].datos.posicionX - 750) <= 1, 'la precisión del clic está limitada al píxel de pantalla');
});

test('mover fuera no persiste ni pierde la estación seleccionada', async t => {
  const { pagina, solicitudes } = await preparar(t);
  await clic(pagina, 580, 470);
  await pagina.locator('[data-reubicar-estacion]').click();
  await clic(pagina, 600, 600, 3);
  assert.equal(solicitudes.length, 0);
  assert.equal(await pagina.evaluate(() => editorPrueba.modo), 'reubicarEstacion');
  assert.equal(await pagina.evaluate(() => editorPrueba.disenoActual.estaciones.find(e => e.nombre === 'Centro').posicionX), 580);
  await clic(pagina, 590, 470);
  await pagina.waitForFunction(() => editorPrueba.modo === 'normal');
  assert.equal(solicitudes[0].metodo, 'PATCH');
});

test('tramo y movimiento rechazan cruces exteriores aunque los extremos sean válidos', async t => {
  const { pagina, solicitudes } = await preparar(t, {
    estaciones: [{ nombre: 'A', posicionX: 666, posicionY: 167 }, { nombre: 'B', posicionX: 264, posicionY: 84 }, { nombre: 'C', posicionX: 666, posicionY: 170 }],
    tramos: [{ nombreLinea: 'Azul', estacionA: 'A', estacionB: 'C' }],
  });
  await pagina.evaluate(() => editorPrueba.guardarTramo('Azul', 'A', 'B'));
  assert.equal(solicitudes.length, 0);
  assert.match(await pagina.locator('body').innerText(), /conexión sale del territorio/);
  const error = await pagina.evaluate(() => editorPrueba.escena.territorioMapa.errorMovimiento({ posicionX: 264, posicionY: 84 }, 'C', editorPrueba.disenoActual));
  assert.match(error, /conexión sale del territorio/);
});

test('referencias territoriales permiten construir y las áreas restringidas explican su rechazo', async t => {
  const referencia = { tipo: 'barrio', nombre: 'AGUADA', prohibirEstaciones: false, prohibirTramos: false };
  const { pagina, solicitudes, diseno } = await preparar(t, { territorio: { areas: [referencia], errores: [] } });
  await activarCreacion(pagina, 'Referencia');
  await clic(pagina, 595.82, 492.99);
  await pagina.waitForFunction(() => editorPrueba.modo === 'normal');
  assert.equal(solicitudes.length, 1);
  diseno.territorio.areas[0].prohibirEstaciones = true;
  await pagina.evaluate(() => editorPrueba.abrirDiseno(77));
  await activarCreacion(pagina, 'Prohibida');
  await clic(pagina, 595.82, 492.99, 3);
  assert.equal(solicitudes.length, 1);
  assert.match(await pagina.locator('body').innerText(), /No se permiten estaciones en AGUADA/);
  assert.match(await pagina.getByRole('list', { name: 'Áreas territoriales del escenario' }).innerText(), /AGUADA: sin estaciones/);
  await pagina.getByRole('button', { name: 'Espacios verdes', exact: true }).click();
  assert.equal(await pagina.evaluate(() => editorPrueba.escena.territorioMapa.errorEstacion({ posicionX: 595.82, posicionY: 492.99 }) !== null), true);
});

test('restricción de tramos no prohíbe estaciones y no se evita cambiando zoom', async t => {
  const { pagina, solicitudes } = await preparar(t, {
    estaciones: [{ nombre: 'A', posicionX: 580, posicionY: 470 }, { nombre: 'B', posicionX: 750, posicionY: 500 }],
    tramos: [], territorio: { areas: [{ tipo: 'barrio', nombre: 'AGUADA', prohibirEstaciones: false, prohibirTramos: true }], errores: [] },
  });
  for (const zoom of [1, 4]) {
    await pagina.evaluate(zoom => { editorPrueba.escena.cameras.main.setZoom(zoom); return editorPrueba.guardarTramo('Azul', 'A', 'B'); }, zoom);
    assert.equal(solicitudes.length, 0);
  }
  assert.match(await pagina.locator('body').innerText(), /atraviesa AGUADA/);
  await activarCreacion(pagina, 'Permitida');
  await clic(pagina, 595.82, 492.99);
  await pagina.waitForFunction(() => editorPrueba.modo === 'normal');
  assert.equal(solicitudes[0].metodo, 'POST');
});

test('cambiar de diseño limpia restricciones anteriores; configuración inválida informa y bloquea', async t => {
  const { pagina, solicitudes, diseno } = await preparar(t, { territorio: { areas: [], errores: ['Área territorial sin geometría: Prueba'] } });
  await activarCreacion(pagina);
  await clic(pagina, 750, 500);
  assert.equal(solicitudes.length, 0);
  diseno.territorio = { areas: [], errores: [] };
  await pagina.evaluate(() => editorPrueba.abrirDiseno(77));
  await activarCreacion(pagina);
  await clic(pagina, 750, 500);
  await pagina.waitForFunction(() => editorPrueba.modo === 'normal');
  assert.equal(solicitudes.length, 1);
});
