// Editor/Phaser reales con API simulada. No escribe en PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function preparar(t, opciones) {
  const resultado = await abrirEditor(navegador, opciones);
  t.after(() => resultado.contexto.close());
  return resultado;
}
async function puntoMapa(pagina, x = 750, y = 500) {
  return pagina.evaluate(({ x, y }) => {
    const e = editorPrueba.escena, m = e.capaRedMetro.convertirPosicion(x, y), c = e.cameras.main;
    const r = document.querySelector('#metronet-mapa canvas').getBoundingClientRect();
    return { x: r.x + (m.x - c.worldView.x) * c.zoom, y: r.y + (m.y - c.worldView.y) * c.zoom };
  }, { x, y });
}

test('crear estaciones repetidas no muestra avisos que reduzcan el mapa', async t => {
  const { pagina, solicitudes, errores } = await preparar(t);
  const mensajes = [];
  await pagina.exposeFunction('registrarMensaje', texto => mensajes.push(texto));
  await pagina.evaluate(() => new MutationObserver(() => window.registrarMensaje(document.querySelector('[data-estado-editor] [role=status]').textContent)).observe(document.querySelector('[data-estado-editor] [role=status]'), { childList: true }));
  await pagina.clock.install();
  for (let i = 0; i < 3; i++) {
    await pagina.locator('[data-elegir-herramienta=estaciones]').click();

    const p = await puntoMapa(pagina, 750 + i * 15, 500);
    await pagina.mouse.click(p.x, p.y);
    await pagina.waitForFunction(i => editorPrueba.disenoActual.estaciones.some(e => e.nombre === `Estación ${String(i+1).padStart(2,'0')}`), i);
    assert.equal(await pagina.locator('[data-revisar-error]').isVisible(), false,
      await pagina.evaluate(() => editorPrueba.barraEstado?.ultimoError));
    assert.equal(await pagina.locator('dialog[open], .metronet-notificacion').count(), 0);
  }
  assert.equal(solicitudes.length, 3);
  assert.equal(mensajes.filter(m => /Estación guardada/.test(m)).length, 0);
  assert.equal(mensajes.some(m => /cargada|Hacé clic/.test(m)), false);
  assert.equal(await pagina.locator('.metronet-estado-editor__feedback').isVisible(), false);
  const antes = await pagina.locator('#metronet-mapa').boundingBox();
  await pagina.clock.fastForward(4500);
  assert.equal(await pagina.locator('[data-estado-editor] [role=status]').innerText(), '');
  const despues = await pagina.locator('#metronet-mapa').boundingBox();
  assert.equal(despues.height, antes.height, 'La creación no cambia la altura del mapa');
  assert.equal(despues.y + despues.height, antes.y + antes.height);
  assert.equal(await pagina.locator('.metronet-estado-editor__feedback').isVisible(), false);
  assert.deepEqual(errores, []);
});

test('cambiar herramientas tras una conexión sin línea permite continuar sin modal', async t => {
  const { pagina, solicitudes } = await preparar(t);
  await pagina.locator('[data-elegir-herramienta=conexiones]').click();
  const p = await puntoMapa(pagina,700,460); await pagina.mouse.click(p.x,p.y);
  assert.equal(await pagina.locator('[data-revisar-error]').isVisible(), false,
    await pagina.evaluate(() => editorPrueba.barraEstado?.ultimoError));
  assert.equal(await pagina.locator('[data-elegir-herramienta=conexiones]').getAttribute('aria-pressed'), 'true');
  await pagina.locator('[data-elegir-herramienta=estaciones]').click();
  assert.equal(await pagina.locator('[data-elegir-herramienta=estaciones]').getAttribute('aria-pressed'), 'true');
  assert.equal(await pagina.evaluate(() => editorPrueba.modo), 'crearEstacion');
  assert.equal(await pagina.locator('dialog[open]').count(), 0);
  assert.equal(solicitudes.length, 0);
});

test('música bajo demanda; canvas sin tooltip y mapa con zoom operativo', async t => {
  const { pagina } = await preparar(t);
  assert.doesNotMatch(await pagina.locator('[data-estado-editor]').innerText(), /Rueda|Mover mapa/);
  assert.equal(await pagina.locator('.metronet-hud').count(), 1);
  assert.equal(await pagina.locator('#metronet-panel-controles .metronet-hud').count(), 0);
  await pagina.clock.install(); await pagina.clock.fastForward(4500);
  await pagina.locator('#metronet-mapa canvas').hover({ position: { x: 150, y: 150 } });
  assert.equal(await pagina.locator('#metronet-mapa canvas').getAttribute('title'), null);
  assert.equal(await pagina.locator('#metronet-mapa canvas').getAttribute('data-ayuda-sistema'), null);
  await pagina.reload();
  await pagina.waitForFunction(() => window.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro?.disenoActual);
  assert.doesNotMatch(await pagina.locator('[data-estado-editor]').innerText(), /Rueda|Mover mapa/);
  const mapa = await pagina.locator('#metronet-mapa').boundingBox();
  if (!await pagina.locator('.metronet-hud').evaluate(e=>e.open)) await pagina.locator('.metronet-hud>summary').click();
  assert.equal(await pagina.locator('.metronet-hud').getAttribute('data-vista'), 'musica');
  assert.equal(await pagina.locator('[data-hud-vista]').count(), 0);
  assert.deepEqual(await pagina.locator('#metronet-mapa').boundingBox(), mapa);
  const zoom = await pagina.evaluate(() => juegoPrueba.scene.getScene('MapaScene').cameras.main.zoom);
  await pagina.locator('#metronet-mapa canvas').hover({ position: { x: 150, y: 150 } });
  await pagina.mouse.wheel(0, -150);
  await pagina.waitForFunction(zoom => juegoPrueba.scene.getScene('MapaScene').cameras.main.zoom > zoom, zoom);
  assert.equal(await pagina.locator('.metronet-hud').getAttribute('data-vista'), 'musica');
  assert.equal(await pagina.locator('dialog[open], .metronet-notificacion').count(), 0);
});

test('error backend sigue legible y consultable tras expirar o completar otra operación', async t => {
  const { pagina } = await preparar(t);
  await pagina.route('**/api/simulaciones/77/guardar', route => route.fulfill({ status: 500, json: { detail: 'No se pudo guardar. Reintentá la operación.' } }));
  await pagina.clock.install();
  await pagina.locator('[data-guardar]').click();
  await pagina.waitForFunction(() => document.querySelector('[data-estado-editor]').dataset.tipo === 'error');
  assert.match(await pagina.locator('[data-estado-editor] [role=alert]').innerText(), /No se pudo guardar/);

  assert.equal(await pagina.locator('dialog[open]').count(), 0);
  await pagina.clock.fastForward(9500);
  assert.equal(await pagina.locator('[data-estado-editor] [role=alert]').innerText(), '');
  await pagina.evaluate(() => editorPrueba.mostrarMensaje('Operación completada.', 'exito'));
  assert.equal(await pagina.locator('[data-estado-editor] [role=status]').innerText(), '');
  await pagina.locator('[data-revisar-error]').click();
  assert.match(await pagina.locator('[data-estado-editor] [role=alert]').innerText(), /No se pudo guardar/);
});

test('fallo al recargar después de crear no anuncia éxito ni pierde cambios pendientes', async t => {
  const { pagina } = await preparar(t);
  await pagina.route('**/api/simulaciones/77', route => route.fulfill({ status: 503, json: { detail: 'No se pudo recargar la red.' } }));
  await pagina.locator('[data-elegir-herramienta=metros]').click();
  await pagina.evaluate(() => editorPrueba.creacionDirecta.seleccionar({tipo:'tramo',valor:editorPrueba.disenoActual.tramos[0]}));
  await pagina.waitForFunction(() => document.querySelector('[data-estado-editor]').dataset.tipo === 'error');
  assert.match(await pagina.locator('[data-estado-editor] [role=alert]').innerText(), /No se pudo recargar/);
  assert.equal(await pagina.evaluate(() => editorPrueba.cambiosPendientes), true);
});

test('la selección conserva el nombre de estación y solo ofrece mover o eliminar', async t => {
  const { pagina, solicitudes } = await preparar(t);
  await pagina.evaluate(() => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor: editorPrueba.disenoActual.estaciones[0] }));
  assert.equal(await pagina.getByRole('button', { name: 'Mover estación seleccionada' }).isEnabled(), true);
  assert.equal(await pagina.getByRole('button', { name: 'Eliminar elemento seleccionado' }).isEnabled(), true);
  assert.equal(await pagina.locator('[data-editar-estacion], [data-editar-elemento]').count(), 0);
  assert.equal(await pagina.evaluate(() => editorPrueba.disenoActual.estaciones[0].nombre), 'Centro');
  await pagina.keyboard.press('Escape');
  assert.equal(solicitudes.length, 0);
  assert.equal(await pagina.evaluate(() => editorPrueba.disenoActual.estaciones[0].transbordo), false);
  assert.equal(await pagina.locator('dialog[open]').count(), 0);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`HUD de altura natural y mensajes largos accesibles a ${viewport.width}px`, async t => {
    const { pagina, errores } = await preparar(t, { viewport });
    await pagina.evaluate(() => editorPrueba.mostrarMensaje('Error de conexión. '.repeat(50), 'error'));
    const r = await pagina.locator('[data-estado-editor]').boundingBox();
    const app = await pagina.locator('#metronet-aplicacion').boundingBox();
    assert.ok(r.x >= 0 && r.x + r.width <= viewport.width);
    assert.ok(r.y + r.height <= app.y);
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await pagina.locator('.metronet-estado-editor__mensaje').focus();
    assert.match(await pagina.locator('[role=alert]').innerText(), /Error de conexión/);
    if (viewport.width < 620) await pagina.locator('[data-panel-edicion-toggle]').click();
    await pagina.locator('[data-elegir-herramienta=estaciones]').click();

    assert.equal(await pagina.evaluate(() => editorPrueba.modo), 'crearEstacion');
    assert.deepEqual(errores, []);
  });
}

test('eliminar una unidad conserva los datos ante error del servidor y permite reintentar', async t => {
  const { pagina, solicitudes } = await preparar(t);
  let envios = 0;
  let rechazar = true;
  await pagina.route('**/api/simulaciones/77/unidades/1', async route => {
    envios++;
    if (rechazar) await route.fulfill({ status: 500, json: { detail: 'No se pudo eliminar la unidad.' } });
    else await route.fallback();
  });
  await pagina.evaluate(() => editorPrueba.seleccionarElemento({ tipo: 'unidad', valor: editorPrueba.disenoActual.unidadesMetro[0] }));
  await pagina.getByRole('button', { name: 'Eliminar elemento seleccionado' }).click();
  await pagina.locator('[data-confirmar-eliminar]').click();
  await pagina.waitForFunction(() => document.querySelector('[data-estado-editor]').dataset.tipo === 'error');
  assert.equal(envios, 1);
  assert.equal(await pagina.evaluate(() => editorPrueba.disenoActual.unidadesMetro.length), 1);
  assert.match(await pagina.locator('[data-estado-editor] [role=alert]').innerText(), /No se pudo eliminar/);
  assert.equal(solicitudes.length, 0);
  rechazar = false;
  await pagina.getByRole('button', { name: 'Eliminar elemento seleccionado' }).click();
  await pagina.locator('[data-confirmar-eliminar]').click();
  await pagina.waitForFunction(() => editorPrueba.disenoActual.unidadesMetro.length === 0);
  assert.equal(envios, 2);
  assert.equal(solicitudes.filter(s => s.metodo === 'DELETE').length, 1);
});

test('avisos globales usan la barra durante la edición y recuperan su destino al salir', async t => {
  const { pagina } = await preparar(t);
  await pagina.evaluate(() => {
    const campo = document.createElement('input');
    campo.id = 'campoPruebaValidacion';
    campo.setCustomValidity('Revisá el campo.');
    document.body.append(campo);
    campo.reportValidity();
  });
  assert.match(await pagina.locator('[data-estado-editor] [role=alert]').innerText(), /Revisá el campo/);
  assert.equal(await pagina.locator('.metronet-notificacion').count(), 0);
  await pagina.evaluate(() => {
    editorPrueba.eliminar();
    const campo = document.querySelector('#campoPruebaValidacion');
    campo.setCustomValidity('Fuera del editor.');
    campo.reportValidity();
    editorPrueba.mostrarMensaje('Respuesta tardía.', 'error');
  });
  assert.equal(await pagina.locator('[data-estado-editor]').innerText(), '');
  assert.match(await pagina.locator('.metronet-notificacion').innerText(), /Fuera del editor/);
});

for (const estado of [400, 409, 422]) {
  test(`validación HTTP ${estado}: advertencia corregible, conserva selección y permite reintentar`, async t => {
    const { pagina, solicitudes } = await preparar(t);
    let rechazar = true;
    await pagina.route('**/api/simulaciones/77/tramos', route => rechazar
      ? route.fulfill({ status: estado, json: { detail: 'La conexión no es válida. Revisá sus extremos.' } })
      : route.fallback());
    await pagina.locator('[data-elegir-herramienta=conexiones]').click();
    await pagina.evaluate(() => editorPrueba.seleccionarElemento({
      tipo: 'tramo', valor: editorPrueba.disenoActual.tramos[0],
    }));
    assert.equal(await pagina.evaluate(() => editorPrueba.creacionDirecta.lineaActiva), 'Azul');
    for (const [x, y] of [[700, 460], [810, 480]]) {
      const punto = await puntoMapa(pagina, x, y);
      await pagina.mouse.click(punto.x, punto.y);
    }
    const aviso = pagina.getByRole('dialog', { name: 'Revisá esta acción', exact: true });
    await aviso.waitFor({ state: 'visible', timeout: 5000 });
    assert.match(await aviso.innerText(), /conexión no es válida/);
    assert.equal(await aviso.getByRole('button').count(), 0);
    assert.equal(await pagina.locator('[data-estado-editor] [role=status]').innerText(), '');
    assert.deepEqual(await pagina.evaluate(() => editorPrueba.estacionesSeleccionadas), ['Parque']);
    await pagina.keyboard.press('Escape');
    await aviso.waitFor({ state: 'hidden' });
    assert.deepEqual(await pagina.evaluate(() => editorPrueba.estacionesSeleccionadas), ['Parque']);
    rechazar = false;
    const destino = await puntoMapa(pagina,810,480); await pagina.mouse.click(destino.x,destino.y);
    await pagina.waitForFunction(() => editorPrueba.disenoActual.tramos.length === 2);
    assert.equal(solicitudes.length, 1);
    assert.equal(await pagina.locator('[data-estado-editor]').getAttribute('data-tipo'), null);
  });
}

test('toque exterior cierra el aviso sin alcanzar el canvas ni desactivar la herramienta', async t => {
  const { pagina, solicitudes, errores } = await preparar(t, { viewport: { width: 390, height: 844 }, hasTouch: true });
  await pagina.evaluate(() => {
    editorPrueba.panelHerramientas.seleccionar('estaciones');
    window.pulsacionesCanvas = 0;
    editorPrueba.escena.game.canvas.addEventListener('pointerdown', () => window.pulsacionesCanvas++);
    editorPrueba.mostrarMensaje('La conexión sale del territorio válido del mapa. Elegí otras estaciones o agregá una estación intermedia dentro del territorio.', 'advertencia');
  });
  const aviso = pagina.getByRole('dialog', { name: 'Conexión fuera del mapa', exact: true });
  await aviso.waitFor({ state: 'visible' });
  await pagina.keyboard.press('Tab');
  assert.equal(await aviso.evaluate(d => document.activeElement === d), true);
  const canvas = await pagina.locator('canvas').boundingBox();
  const modal = await aviso.boundingBox();
  const punto = { x: canvas.x + 16, y: canvas.y + 16 };
  assert.ok(punto.y < modal.y, 'El toque cae en el mapa, fuera del aviso');
  await pagina.touchscreen.tap(punto.x, punto.y);
  await aviso.waitFor({ state: 'hidden' });
  assert.equal(await pagina.evaluate(() => window.pulsacionesCanvas), 0);
  assert.equal(await pagina.evaluate(() => editorPrueba.modo), 'crearEstacion');
  assert.equal(solicitudes.length, 0);
  assert.deepEqual(errores, []);
});
