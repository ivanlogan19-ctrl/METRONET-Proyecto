const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function abrir(t) {
  const vista = await abrirEditor(navegador);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  return vista.pagina;
}

test('El fondo conserva su geometría vectorial preparada durante zoom y pan', async t => {
  const p = await abrir(t);
  const datos = await p.evaluate(async () => {
    const s = juegoPrueba.scene.getScene('MapaScene'), fondo = s.capaBarrios.fondoMapa;
    const indices = fondo.list.map(forma => forma.pathIndexes);
    const puntos = fondo.list.map(forma => [...forma.pathData]);
    s.cameras.main.setZoom(2); s.cameras.main.scrollX += 20;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { tipos: [...new Set(fondo.list.map(forma => forma.type))], cantidad: fondo.length,
      indicesReutilizados: fondo.list.every((forma, i) => forma.pathIndexes === indices[i]),
      geometriaEstable: fondo.list.every((forma, i) => JSON.stringify(forma.pathData) === JSON.stringify(puntos[i])),
      triangulosValidos: fondo.list.every(forma => forma.pathIndexes.length > 0 && forma.pathIndexes.length % 3 === 0) };
  });
  assert.deepEqual(datos.tipos, ['Polygon']); assert.ok(datos.cantidad > 50);
  assert.equal(datos.indicesReutilizados, true); assert.equal(datos.geometriaEstable, true); assert.equal(datos.triangulosValidos, true);
});

test('Redibujar y reiniciar libera los marcos de etiquetas sin acumular texturas', async t => {
  const p = await abrir(t);
  const r = await p.evaluate(() => {
    const s = juegoPrueba.scene.getScene('MapaScene'), red = s.capaRedMetro;
    const claves = [...red.texturasMarcos.keys()];
    const antes = s.textures.getTextureKeys().length;
    for (let i = 0; i < 20; i++) red.dibujar();
    const despues = s.textures.getTextureKeys().length;
    const fondos = red.etiquetasEstaciones.map(e => e.list[0].type);
    const nombres = red.etiquetasEstaciones.map(e => e.list[1].text);
    red.eliminar();
    return { antes, despues, fondos, nombres, eliminadas: claves.every(clave => !s.textures.exists(clave)) };
  });
  assert.equal(r.antes, r.despues); assert.ok(r.fondos.every(t => t === 'Image'));
  assert.deepEqual(r.nombres, ['CENTRO', 'PARQUE', 'ESTE']); assert.equal(r.eliminadas, true);
});

test('El motor reducido conserva render Canvas, controles de teclado, gráficos y etiquetas', async t => {
  const p = await abrir(t);
  await p.route('**/src/main.js*', async route => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()).replace('type: Phaser.AUTO,', 'type: Phaser.CANVAS,')
      .replace('let juego = new Phaser.Game(config);', 'let juego = new Phaser.Game(config); window.juegoPrueba = juego;') });
  });
  await p.reload();
  await p.waitForFunction(() => juegoPrueba?.scene?.getScene('MapaScene')?.editorRedMetro?.disenoActual);
  const datos = await p.evaluate(() => {
    const s = juegoPrueba.scene.getScene('MapaScene');
    return { renderer: s.game.config.renderType, teclado: Boolean(s.input.keyboard),
      etiquetas: s.capaRedMetro.etiquetasEstaciones.length, barrios: s.capaBarrios.fondoMapa.length,
      colores: new Set(s.game.canvas.getContext('2d').getImageData(0, 0, s.scale.width, s.scale.height).data).size };
  });
  assert.equal(datos.renderer, 1); assert.equal(datos.teclado, true); assert.equal(datos.etiquetas, 3);
  assert.ok(datos.barrios > 50); assert.ok(datos.colores > 10);
});
