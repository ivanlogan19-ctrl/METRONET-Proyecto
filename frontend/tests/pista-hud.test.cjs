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
  await vista.pagina.waitForFunction(() => !editorPrueba.identificacion && editorPrueba.disenoActual);
  await vista.pagina.waitForFunction(() => document.querySelector('[data-estado-editor] [role=status]').textContent === '');
  return vista;
}
async function capturar(p, nombre) {
  if (!process.env.METRONET_CAPTURAS_ASSIST) return;
  fs.mkdirSync(process.env.METRONET_CAPTURAS_ASSIST, { recursive: true });
  await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_ASSIST}/${nombre}.png` });
}
async function abrirHud(p) {
  if (!await p.locator('.metronet-hud').evaluate(e=>e.open)) await p.locator('.metronet-hud>summary').click();
}

for(const width of [1440,768,390,320]) test(`Controles ${width}px: música, Aprender y POI sin peticiones ni acciones detrás`, async t=>{
  const {pagina:p,solicitudes}=await preparar(t,width);
  assert.equal(await p.locator('.metronet-hud').evaluate(e=>e.open),false);
  assert.equal(await p.locator('[data-control-musica]').count(),1);
  const antes=await p.locator('#metronet-mapa').boundingBox();
  assert.equal(await p.locator('[data-hud-vista=controles],[data-hud-vista=pista]').count(),0);
  assert.equal(await p.locator('.metronet-aprender-acceso').isVisible(),true);
  assert.equal(await p.locator('.metronet-editor-acceso-teclado').count(),0);
  await abrirHud(p);
  assert.equal(await p.locator('[data-hud-musica]').isVisible(),true);
  assert.deepEqual(await p.locator('#metronet-mapa').boundingBox(),antes);
  await p.locator('[data-control-musica] label').first().click();
  await p.getByRole('slider',{name:'Volumen de música'}).fill('17');
  const musica=await p.evaluate(async()=>{const {gestorMusica:g}=await import('/src/audio/GestorMusica.js');return g.obtenerEstado();});
  assert.equal(musica.silenciado,true); assert.equal(musica.volumen,.17);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.metronet-hud>summary').evaluate(e=>e===document.activeElement),true);
  await p.evaluate(()=>{editorPrueba.panelHerramientas.seleccionar('estaciones');editorPrueba.disenoActual.estaciones.push({nombre:'Primera'});editorPrueba.actualizarAyuda();});
  assert.equal(await p.locator('.metronet-hud').evaluate(e=>e.open),false);
  assert.equal(await p.locator('[data-elegir-herramienta=estaciones]').getAttribute('aria-pressed'),'true');
  assert.equal(solicitudes.length,0);
  await p.locator('.metronet-poi>summary').click();
  await p.locator('.metronet-poi__categorias [data-categoria="SALUD"]').click();
  assert.equal(solicitudes.length,0); assert.equal(await p.locator('dialog[open]').count(),0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});

for (const porcentaje of [80,125,200,300]) test(`Zoom real Chrome ${porcentaje}%: POI, Aprender y música utilizables`,async t=>{
  const perfil=fs.mkdtempSync(path.join(os.tmpdir(),'metronet-hud-zoom-'));
  const contexto=await chromium.launchPersistentContext(perfil,{headless:true,channel:process.env.METRONET_BROWSER_CHANNEL,viewport:null,args:['--window-size=1440,900','--force-device-scale-factor=1']});
  t.after(async()=>{await contexto.close();fs.rmSync(perfil,{recursive:true,force:true});});
  const ajustes=contexto.pages()[0];await ajustes.goto('chrome://settings/appearance',{waitUntil:'domcontentloaded'});await ajustes.locator('#zoomLevel').selectOption({label:`${porcentaje}%`});
  const {pagina:p,errores}=await abrirEditor({newContext:async()=>contexto},{...opciones,primeraPasada:false});
  assert.ok(Math.abs(await p.evaluate(()=>devicePixelRatio)-porcentaje/100)<.02);
  assert.equal(await p.locator('.metronet-aprender-acceso').isVisible(),true);
  await abrirHud(p);
  const r=await p.locator('.metronet-hud__panel').evaluate(e=>{const r=e.getBoundingClientRect();return {cabe:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,desborde:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(r.cabe,true);assert.equal(r.desborde,false);
  assert.equal(await p.getByRole('slider',{name:'Volumen de música'}).isVisible(),true);
  await p.keyboard.press('Escape');
  await p.locator('.metronet-poi>summary').click();
  await p.waitForFunction(()=>{const panel=document.querySelector('.metronet-poi__panel');return panel.style.top!==''||panel.style.bottom!=='';});
  const poi=await p.locator('.metronet-poi__panel').evaluate(e=>{const r=e.getBoundingClientRect();return {cabe:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,desborde:document.documentElement.scrollWidth>innerWidth,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},viewport:{width:innerWidth,height:innerHeight},scrollY};});
  assert.equal(poi.cabe,true,JSON.stringify(poi));assert.equal(poi.desborde,false);
  await p.keyboard.press('Escape');
  assert.deepEqual(errores,[]);
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
    await p.evaluate(() => { editorPrueba.elementoSeleccionado = null; editorPrueba.capaRedMetro.establecerElementoSeleccionado(null); editorPrueba.renderizarElementoSeleccionado(); });
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
  assert.equal(await p.evaluate(() => editorPrueba.escena.controlZoom.estadoVista), 'manual');
  await p.evaluate(() => editorPrueba.mostrarMensaje('Aviso de revisión. '.repeat(30), 'info'));
  await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const despues = await p.evaluate(() => editorPrueba.escena.controlZoom.capturarVista());
  assert.equal(await p.evaluate(() => editorPrueba.escena.controlZoom.estadoVista), 'manual');
  assert.equal(despues.escalaVisible, antes.escalaVisible);
  assert.ok(Math.abs(despues.longitud - antes.longitud) < .001);
  assert.ok(Math.abs(despues.latitud - antes.latitud) < .001, JSON.stringify({ antes, despues }));
});
