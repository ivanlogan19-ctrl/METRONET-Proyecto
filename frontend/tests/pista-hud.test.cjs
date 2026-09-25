// HUD real sobre Phaser; API controlada. El zoom se cambia en Chrome, no mediante CSS.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
const opciones = {
  escenario: { ...niveles[0], idEscenario: 41 }, estaciones: [], lineas: [], tramos: [],
  consigna: d => ({ estadoGlobal: 'PARCIAL', condiciones: [{ clave: 'minimoEstaciones', completado: d.estaciones.length >= 2, texto: 'Estaciones de la red', actual: d.estaciones.length, requerido: 2 }] }),
};
async function preparar(t, width = 320, browser = navegador) {
  const vista = await abrirEditor(browser, { ...opciones, viewport: { width, height: 844 } });
  t.after(() => vista.contexto.close());
  t.after(() => assert.deepEqual(vista.errores, []));
  await vista.pagina.waitForFunction(() => editorPrueba.estadoConsigna === 'disponible');
  await vista.pagina.waitForFunction(() => document.querySelector('[data-estado-editor] [role=status]').textContent.includes('cargada'));
  await vista.pagina.waitForFunction(() => document.querySelector('[data-estado-editor] [role=status]').textContent === '');
  return vista;
}
async function capturar(p, nombre) {
  if (!process.env.METRONET_CAPTURAS_ASSIST) return;
  fs.mkdirSync(process.env.METRONET_CAPTURAS_ASSIST, { recursive: true });
  await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_ASSIST}/${nombre}.png` });
}
async function medir(p) {
  return p.locator('[data-estado-editor]').evaluate(e => {
    const texto = e.querySelector('[data-assist-mensaje] > p');
    const r = e.getBoundingClientRect(), app = document.querySelector('#metronet-aplicacion').getBoundingClientRect();
    const estilo = getComputedStyle(texto);
    return { alto: r.height, ancho: r.width, cabe: r.left >= 0 && r.right <= innerWidth, fueraMapa: r.bottom <= app.top + .5,
      lineas: Math.round(texto.getBoundingClientRect().height / parseFloat(estilo.lineHeight)), sombra: estilo.textShadow,
      textoCompleto: texto.scrollHeight <= texto.clientHeight + 1, desborde: document.documentElement.scrollWidth > innerWidth };
  });
}

test('móvil: contraer, leer tres líneas, más pista y controles sin una segunda caja', async t => {
  const { pagina: p } = await preparar(t);
  const toggle = p.getByRole('button', { name: 'Mostrar pista del escenario' });
  assert.ok((await medir(p)).alto <= 44);
  assert.equal(await p.locator('[data-assist-controles]').isVisible(), false);
  await capturar(p, 'movil-contraido');
  await toggle.press('Enter');
  const inicial = await medir(p);
  assert.equal(inicial.lineas, 3);
  assert.ok(inicial.alto < 115, JSON.stringify(inicial));
  assert.equal(inicial.fueraMapa, true); assert.equal(inicial.desborde, false);
  assert.equal(inicial.sombra, 'none'); assert.equal(inicial.textoCompleto, true);
  assert.doesNotMatch(await p.locator('[data-estado-editor]').innerText(), /\\|\/{2,}/);
  await capturar(p, 'movil-pista-tres-lineas');
  await p.locator('[data-assist-pista]').click();
  assert.match(await p.locator('[data-assist-mensaje]').innerText(), /ingresá un nombre/);
  assert.ok((await medir(p)).alto < 115);
  await capturar(p, 'movil-mas-pista');
  await p.locator('[data-assist-controles]').click();
  assert.equal(await p.locator('[data-assist-pista]').isVisible(), false);
  assert.equal(await p.locator('.metronet-assist').count(), 1);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  assert.match(await p.locator('[data-assist-mensaje]').innerText(), /Seleccionar.*rueda.*pinza/);
  assert.ok((await medir(p)).alto < 135);
  await capturar(p, 'movil-controles');
  await p.locator('[data-assist-controles]').click();
  await p.locator('[data-assist-alternar]').click();
  await p.evaluate(() => { editorPrueba.disenoActual.estaciones.push({ nombre: 'Primera' }); editorPrueba.actualizarAyuda(); });
  assert.equal(await p.locator('[data-assist-mensaje]').isVisible(), false, 'El progreso no abre el HUD contraído');
  await p.locator('[data-assist-alternar]').press('Space');
  assert.match(await p.locator('[data-assist-mensaje]').innerText(), /Ya ubicaste la primera/);
  await p.evaluate(() => { editorPrueba.errorAyuda = 'La unidad de metro no está disponible.'; editorPrueba.actualizarAyuda(); });
  assert.ok((await medir(p)).alto < inicial.alto, 'Una pista breve ocupa menos altura que tres líneas');
  await capturar(p, 'movil-pista-corta');
});

test('resize conserva acceso por teclado y el glosario se retira al contraer', async t => {
  const { pagina: p } = await preparar(t, 1440);
  await p.locator('[data-assist-mensaje]').focus();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForFunction(() => document.activeElement.matches('[data-assist-alternar]'));
  await p.keyboard.press('Enter');
  await p.locator('.metronet-assist [data-concepto=estacion]').click();
  assert.equal(await p.locator('.metronet-glosario-contextual').isVisible(), true);
  await p.locator('[data-assist-alternar]').click();
  await p.waitForFunction(() => !document.querySelector('.metronet-glosario-contextual'));
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.waitForFunction(() => document.activeElement.matches('[data-assist-controles]'));
  assert.equal(await p.locator('[data-assist-mensaje]').isVisible(), true);
  assert.equal(await p.locator('[data-assist-alternar]').isVisible(), false);
  await p.locator('[data-assist-controles]').press('Enter');
  assert.equal(await p.locator('.metronet-assist').getAttribute('data-vista'), 'controles');
});

for (const porcentaje of [125, 200, 300]) test(`zoom real Chrome ${porcentaje}%: pista, controles y glosario accesibles`, async t => {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'metronet-hud-zoom-'));
  const contexto = await chromium.launchPersistentContext(perfil, { headless: true, channel: process.env.METRONET_BROWSER_CHANNEL,
    viewport: null, args: ['--window-size=1440,900', '--force-device-scale-factor=1'] });
  t.after(async () => { await contexto.close(); fs.rmSync(perfil, { recursive: true, force: true }); });
  const ajustes = contexto.pages()[0];
  await ajustes.goto('chrome://settings/appearance', { waitUntil: 'domcontentloaded' });
  await ajustes.locator('#zoomLevel').selectOption({ label: `${porcentaje}%` });
  const { pagina: p, errores } = await abrirEditor({ newContext: async () => contexto }, opciones);
  await p.waitForFunction(() => editorPrueba.estadoConsigna === 'disponible');
  await p.waitForFunction(() => document.querySelector('[data-estado-editor] [role=status]').textContent.includes('cargada'));
  await p.waitForFunction(() => document.querySelector('[data-estado-editor] [role=status]').textContent === '');
  const dimension = await p.evaluate(() => ({ ratio: devicePixelRatio, ancho: innerWidth }));
  assert.ok(Math.abs(dimension.ratio - porcentaje / 100) < .02, JSON.stringify(dimension));
  assert.ok(Math.abs(dimension.ancho - 1440 / (porcentaje / 100)) <= 2, JSON.stringify(dimension));
  if (await p.locator('[data-assist-alternar]').isVisible()) await p.locator('[data-assist-alternar]').click();
  let medidas = await medir(p);
  assert.equal(medidas.cabe, true); assert.equal(medidas.fueraMapa, true); assert.equal(medidas.desborde, false);
  assert.equal(medidas.textoCompleto, true);
  await p.locator('[data-assist-pista]').click();
  await p.locator('[data-assist-controles]').click();
  assert.match(await p.locator('[data-assist-mensaje]').innerText(), /Seleccionar.*rueda/);
  await p.locator('[data-assist-controles]').click();
  await p.locator('.metronet-assist [data-concepto=estacion]').click();
  assert.equal(await p.locator('.metronet-glosario-contextual').isVisible(), true);
  await p.keyboard.press('Escape');
  await capturar(p, `zoom-real-${porcentaje}`);
  assert.deepEqual(errores, []);
});

test('cambiar la altura del HUD sincroniza canvas y puntero antes del siguiente clic', async t => {
  const { pagina: p, contexto, errores } = await abrirEditor(navegador);
  t.after(() => contexto.close()); t.after(() => assert.deepEqual(errores, []));
  for (const texto of ['Aviso breve.', 'Revisá la conexión seleccionada. '.repeat(25)]) {
    await p.evaluate(texto => editorPrueba.mostrarMensaje(texto, 'info'), texto);
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const posicion = await p.evaluate(() => {
      const escena = editorPrueba.escena, escala = escena.scale, camara = escena.cameras.main;
      const canvas = escala.canvas.getBoundingClientRect(), padre = escala.canvas.parentElement;
      const punto = escena.capaRedMetro.convertirPosicion(810, 480);
      return { desfase: Math.abs(escala.canvasBounds.top - canvas.top), exceso: Math.abs(canvas.height - padre.getBoundingClientRect().height),
        x: canvas.x + (punto.x - camara.worldView.x) * camara.zoom, y: canvas.y + (punto.y - camara.worldView.y) * camara.zoom };
    });
    assert.ok(posicion.desfase < 1, JSON.stringify(posicion));
    assert.ok(posicion.exceso < 2, JSON.stringify(posicion));
    await p.mouse.click(posicion.x, posicion.y);
    await p.waitForFunction(() => editorPrueba.elementoSeleccionado?.valor?.nombre === 'Este');
    await p.locator('[data-quitar-seleccion]').click();
  }
});

test('el HUD conserva el encuadre manual al mover, acercar y cambiar su altura', async t => {
  const { pagina: p } = await preparar(t, 1440);
  const canvas = p.locator('#metronet-mapa canvas');
  const z = await p.evaluate(() => editorPrueba.escena.cameras.main.zoom);
  await canvas.hover({ position: { x: 500, y: 350 } });
  await p.mouse.wheel(0, -200);
  await p.waitForFunction(z => editorPrueba.escena.cameras.main.zoom > z, z);
  const r = await canvas.boundingBox();
  await p.mouse.move(r.x + 500, r.y + 350); await p.mouse.down();
  await p.mouse.move(r.x + 520, r.y + 370, { steps: 5 }); await p.mouse.up();
  await p.evaluate(() => new Promise(resolve => juegoPrueba.events.once('postrender', resolve)));
  const antes = await p.evaluate(() => editorPrueba.escena.controlZoom.capturarVista());
  assert.equal(antes.estadoVista, 'manual');
  await p.evaluate(() => editorPrueba.mostrarMensaje('Aviso de revisión. '.repeat(30), 'info'));
  await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const despues = await p.evaluate(() => editorPrueba.escena.controlZoom.capturarVista());
  assert.equal(despues.estadoVista, 'manual');
  assert.equal(despues.zoom, antes.zoom);
  assert.ok(Math.abs(despues.proporcionX - antes.proporcionX) < .001);
  assert.ok(Math.abs(despues.proporcionY - antes.proporcionY) < .001, JSON.stringify({ antes, despues }));
});
