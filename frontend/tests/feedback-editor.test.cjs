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

test('crear estaciones repetidas produce un solo éxito temporal sin cubrir mapa ni herramientas', async t => {
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
    assert.match(await pagina.locator('[data-estado-editor]').innerText(), /Estación guardada/);
    assert.equal(await pagina.locator('dialog[open], .metronet-notificacion').count(), 0);
  }
  assert.equal(solicitudes.length, 3);
  assert.equal(mensajes.filter(m => /Estación guardada/.test(m)).length, 3);
  assert.equal(mensajes.some(m => /cargada|Hacé clic/.test(m)), false);
  const estado = await pagina.locator('[data-estado-editor]').boundingBox();
  for (const selector of ['#metronet-mapa', '#metronet-panel-controles']) {
    const r = await pagina.locator(selector).boundingBox();
    assert.ok(estado.y + estado.height <= r.y);
  }
  const antes = await pagina.locator('#metronet-mapa').boundingBox();
  await pagina.clock.fastForward(4500);
  assert.equal(await pagina.locator('[data-estado-editor] [role=status]').innerText(), '');
  const despues = await pagina.locator('#metronet-mapa').boundingBox();
  assert.ok(despues.height > antes.height, 'Al expirar el aviso se recupera su espacio');
  assert.equal(despues.y + despues.height, antes.y + antes.height);
  assert.equal(await pagina.locator('.metronet-estado-editor__feedback').isVisible(), false);
  assert.deepEqual(errores, []);
});

test('las instrucciones cambian en contexto y una línea pendiente permite corregir sin modal', async t => {
  const { pagina, solicitudes } = await preparar(t);
  await pagina.locator('[data-elegir-herramienta=conexiones]').click();
  const p = await puntoMapa(pagina,700,460); await pagina.mouse.click(p.x,p.y);
  assert.match(await pagina.locator('[data-estado-editor]').innerText(), /línea activa/);
  assert.match(await pagina.locator('.metronet-herramientas__ayuda').innerText(), /origen/);
  await pagina.locator('[data-elegir-herramienta=estaciones]').click();
  assert.match(await pagina.locator('.metronet-herramientas__ayuda').innerText(), /colocar estaciones/);
  assert.equal(await pagina.locator('dialog[open]').count(), 0);
  assert.equal(solicitudes.length, 0);
});

test('controles solo bajo demanda en la misma asistencia; sin tooltip del canvas ni cambios en el zoom', async t => {
  const { pagina } = await preparar(t);
  assert.doesNotMatch(await pagina.locator('[data-estado-editor]').innerText(), /Rueda|Mover mapa/);
  assert.equal(await pagina.locator('.metronet-assist').count(), 1);
  assert.equal(await pagina.locator('#metronet-panel-controles .metronet-assist').count(), 0);
  const pista = await pagina.locator('[data-assist-mensaje]').innerText();
  await pagina.clock.install(); await pagina.clock.fastForward(4500);
  await pagina.locator('#metronet-mapa canvas').hover({ position: { x: 150, y: 150 } });
  assert.equal(await pagina.locator('[data-assist-mensaje]').innerText(), pista);
  assert.equal(await pagina.locator('#metronet-mapa canvas').getAttribute('title'), null);
  assert.equal(await pagina.locator('#metronet-mapa canvas').getAttribute('data-ayuda-sistema'), null);
  await pagina.reload();
  await pagina.waitForFunction(() => window.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro?.disenoActual);
  assert.doesNotMatch(await pagina.locator('[data-estado-editor]').innerText(), /Rueda|Mover mapa/);
  const mapa = await pagina.locator('#metronet-mapa').boundingBox();
  if (!await pagina.locator('.metronet-hud').evaluate(e=>e.open)) await pagina.locator('.metronet-hud>summary').click();
  await pagina.locator('[data-hud-vista=controles]').click();
  assert.match(await pagina.locator('[data-hud-controles]').innerText(), /Arrastrá para mover.*rueda.*pinza.*acción de la herramienta/);
  assert.equal(await pagina.locator('[data-hud-vista=controles]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await pagina.locator('#metronet-mapa').boundingBox(), mapa);
  const zoom = await pagina.evaluate(() => juegoPrueba.scene.getScene('MapaScene').cameras.main.zoom);
  await pagina.locator('#metronet-mapa canvas').hover({ position: { x: 150, y: 150 } });
  await pagina.mouse.wheel(0, -150);
  await pagina.waitForFunction(zoom => juegoPrueba.scene.getScene('MapaScene').cameras.main.zoom > zoom, zoom);
  if (!await pagina.locator('.metronet-hud').evaluate(e=>e.open)) await pagina.locator('.metronet-hud>summary').click();
  await pagina.locator('[data-hud-vista=pista]').click();
  assert.doesNotMatch(await pagina.locator('[data-assist-mensaje]').innerText(), /Rueda/);
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
  assert.match(await pagina.locator('[data-estado-editor] [role=status]').innerText(), /Operación completada/);
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

test('edición inline se cancela con Escape sin escribir y mantiene transbordo al guardar', async t => {
  const { pagina, solicitudes } = await preparar(t);
  await pagina.evaluate(() => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor: editorPrueba.disenoActual.estaciones[0] }));
  await pagina.locator('[data-editar-estacion]').click();
  await pagina.getByLabel('Nombre de la estación', { exact: true }).fill('No guardar');
  await pagina.keyboard.press('Escape');
  assert.equal(solicitudes.length, 0);
  assert.equal(await pagina.locator('[data-editar-elemento]').count(), 0);
  assert.equal(await pagina.locator('[data-editar-estacion]').evaluate(e => e === document.activeElement), true);
  await pagina.locator('[data-editar-estacion]').click();
  await pagina.getByLabel('Nombre de la estación', { exact: true }).fill('Nuevo centro');
  await pagina.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await pagina.waitForFunction(() => editorPrueba.disenoActual.estaciones[0].nombre === 'Nuevo centro');
  assert.equal(solicitudes[0].datos.transbordo, false);
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

test('editar conserva los datos ante error del servidor y evita envíos duplicados', async t => {
  const { pagina, solicitudes } = await preparar(t);
  let envios = 0;
  await pagina.route('**/api/simulaciones/77/unidades/1', async route => {
    envios++;
    await new Promise(r => setTimeout(r, 250));
    await route.fulfill({ status: 500, json: { detail: 'No se pudo actualizar la unidad.' } });
  });
  await pagina.evaluate(() => editorPrueba.seleccionarElemento({ tipo: 'unidad', valor: editorPrueba.disenoActual.unidadesMetro[0] }));
  await pagina.locator('[data-editar-unidad]').click();
  assert.equal(await pagina.locator('[data-editar-elemento]').getByLabel('Capacidad', { exact: true }).count(), 0);
  await pagina.locator('[data-editar-elemento]').getByLabel('Velocidad promedio (UV)', { exact: true }).fill('60');
  await pagina.getByRole('button', { name: 'Guardar cambios', exact: true }).dblclick();
  await pagina.waitForFunction(() => document.querySelector('[data-estado-editor]').dataset.tipo === 'error');
  assert.equal(envios, 1);
  assert.equal(await pagina.locator('[data-editar-elemento]').getByLabel('Velocidad promedio (UV)', { exact: true }).inputValue(), '60');
  assert.equal(await pagina.getByRole('button', { name: 'Guardar cambios', exact: true }).isEnabled(), true);
  await pagina.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
  assert.equal(solicitudes.length, 0);
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
    await pagina.locator('[data-linea-conexion]').selectOption('Azul');
    for (const [x, y] of [[700, 460], [810, 480]]) {
      const punto = await puntoMapa(pagina, x, y);
      await pagina.mouse.click(punto.x, punto.y);
    }
    await pagina.waitForFunction(() => document.querySelector('[data-estado-editor]').dataset.tipo === 'advertencia');
    assert.match(await pagina.locator('[data-estado-editor] [role=status]').innerText(), /conexión no es válida/);
    assert.deepEqual(await pagina.evaluate(() => editorPrueba.estacionesSeleccionadas), ['Parque']);
    assert.equal(await pagina.locator('dialog[open]').count(), 0);
    rechazar = false;
    const destino = await puntoMapa(pagina,810,480); await pagina.mouse.click(destino.x,destino.y);
    await pagina.waitForFunction(() => editorPrueba.disenoActual.tramos.length === 2);
    assert.equal(solicitudes.length, 1);
    assert.equal(await pagina.locator('[data-estado-editor]').getAttribute('data-tipo'), 'exito');
  });
}
