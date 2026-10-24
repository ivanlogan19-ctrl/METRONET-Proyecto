const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => navegador?.close());

// Los motores devuelven coordenadas del documento hijo al consultar un iframe
// con zoom CSS. Convertirlas al marco físico para probar clics reales.
async function cajaVisible(pagina, vista, elemento) {
  const marco = await pagina.locator('#pantalla-metronet').boundingBox();
  const escala = marco.width / await vista.evaluate(() => innerWidth);
  const r = await elemento.evaluate(e => e.getBoundingClientRect().toJSON());
  return {x:marco.x+r.x*escala,y:marco.y+r.y*escala,width:r.width*escala,height:r.height*escala};
}
async function pulsar(pagina, vista, elemento) {
  await elemento.waitFor({state:'visible'});
  const r = await cajaVisible(pagina,vista,elemento);
  await pagina.mouse.click(r.x+r.width/2,r.y+r.height/2);
}

for (const [width, height] of [[1470,840], [1920,1080], [2560,1440], [3840,2160], [3440,1440]]) {
  test(`Interfaz ${width}×${height}: conserva proporción, navegación y controles`, async t => {
    const v = await abrirPantalla(navegador, '/inicio.html', { contenedor:true, viewport:{width,height} });
    t.after(() => v.contexto.close());
    const marco = await v.pagina.locator('#pantalla-metronet').boundingBox();
    assert.ok(Math.abs(marco.width-width)<2 && Math.abs(marco.height-height)<2);
    const boton = await cajaVisible(v.pagina,v.vista,v.vista.locator('#accionesInicio button').first());
    const escala = Math.max(1, Math.min(width/1470, height/840));
    assert.ok(Math.abs(boton.height-40*escala)<2, 'El botón debe crecer junto con la interfaz');
    const tarjeta = await cajaVisible(v.pagina,v.vista,v.vista.locator('.metronet-inicio'));
    // Firefox cuantiza la escala del documento hijo en resoluciones altas.
    assert.ok(Math.abs(tarjeta.width-1080*escala)<1080*escala*.02, `Ancho visible ${tarjeta.width}; esperado ${1080*escala}`);
    await pulsar(v.pagina,v.vista,v.vista.locator('.metronet-navegacion__enlaces').getByRole('link', {name:'Reglas',exact:true}));
    await v.vista.getByRole('heading', {name:'Reglas del juego',exact:true}).waitFor();
    await pulsar(v.pagina,v.vista,v.vista.getByRole('tab', {name:'Velocidad y tiempo',exact:true}));
    await v.vista.locator('#panelLibre:not([hidden])').waitFor();
    assert.equal(await v.vista.evaluate(() => document.documentElement.scrollWidth>innerWidth), false);
    await v.pagina.goBack();
    await v.vista.locator('.metronet-inicio__tarjeta').first().waitFor();
    assert.deepEqual(v.errores, []);
    if (width===2560) await v.pagina.screenshot({path:`/tmp/metronet-grande-${process.env.METRONET_BROWSER || 'chrome'}.png`});
  });
}

test('Redimensionar no recarga la pantalla ni pierde el formulario', async t => {
  const v = await abrirPantalla(navegador, '/registro.html', {contenedor:true, viewport:{width:1470,height:840}});
  t.after(() => v.contexto.close());
  const campo = v.vista.locator('input[type=text]').first();
  await campo.fill('Nombre conservado');
  await v.vista.evaluate(() => { window.marcaPrueba = 73; });
  await v.pagina.setViewportSize({width:3840,height:2160});
  await v.pagina.waitForFunction(() => document.querySelector('iframe').clientWidth<2000);
  assert.equal(await campo.inputValue(), 'Nombre conservado');
  assert.equal(await v.vista.evaluate(() => window.marcaPrueba), 73);
  await v.pagina.setViewportSize({width:1470,height:840});
  await v.pagina.waitForFunction(() => document.querySelector('iframe').clientWidth===1470);
  assert.equal(await campo.inputValue(), 'Nombre conservado');
  assert.deepEqual(v.errores, []);
});

test('Mapa ampliado: el clic conserva su posición geográfica al crear una estación', async t => {
  const v = await abrirEditor(navegador, {contenedor:true, viewport:{width:2560,height:1440}});
  t.after(() => v.contexto.close());
  const f = v.pagina, p = v.paginaContenedor;
  for (const [width,height,x,y] of [[2560,1440,750,500],[3840,2160,780,510]]) {
    await p.setViewportSize({width,height});
    await p.waitForFunction(({width,height}) => Math.abs(document.querySelector('iframe').clientWidth-width/Math.max(1,Math.min(width/1470,height/840)))<2, {width,height});
    await pulsar(p,f,f.locator('[data-elegir-herramienta=estaciones]'));
    const punto = await f.evaluate(({x,y}) => {
      const escena=editorPrueba.escena, camara=escena.cameras.main;
      const mundo=escena.capaRedMetro.convertirPosicion(x,y);
      const pantalla=camara.matrix.transformPoint(mundo.x-camara.scrollX,mundo.y-camara.scrollY);
      const rect=escena.game.canvas.getBoundingClientRect();
      return {x:rect.x+pantalla.x*rect.width/escena.scale.gameSize.width,
        y:rect.y+pantalla.y*rect.height/escena.scale.gameSize.height};
    }, {x,y});
    const marco = await p.locator('iframe').boundingBox();
    const anchoLogico = await f.evaluate(() => innerWidth);
    const escala = marco.width/anchoLogico;
    const cantidad = v.diseno.estaciones.length;
    await p.mouse.click(marco.x+punto.x*escala,marco.y+punto.y*escala);
    await f.waitForFunction(cantidad => editorPrueba.disenoActual.estaciones.length>cantidad, cantidad);
    const creada=v.diseno.estaciones.at(-1);
    assert.ok(Math.abs(creada.posicionX-x)<1 && Math.abs(creada.posicionY-y)<1, JSON.stringify(creada));
    assert.equal(await f.evaluate(() => document.documentElement.scrollWidth>innerWidth), false);
  }
  assert.deepEqual(v.errores, []);
  await p.screenshot({path:`/tmp/metronet-mapa-grande-${process.env.METRONET_BROWSER || 'chrome'}.png`});
});
