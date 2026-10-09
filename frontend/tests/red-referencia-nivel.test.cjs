const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');

test('mapa Admin crea y conecta estaciones; flechas conservan foco y posición', async () => {
  const navegador = await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL,headless:true});
  try {
    const pagina = await navegador.newPage({viewport:{width:390,height:844}});
    const errores=[];pagina.on('pageerror',error=>errores.push(error.message));
    await pagina.route('**/__red_qa',ruta=>ruta.fulfill({contentType:'text/html',body:
      '<link rel="stylesheet" href="/src/administracion/administracion.css"><div id="editor" style="width:350px"></div>'}));
    await pagina.goto(`${process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173'}/__red_qa`);
    await pagina.evaluate(async () => {
      const {crearEditorRedReferenciaNivel}=await import('/src/administracion/EditorRedReferenciaNivel.js');
      window.redQa={estaciones:[],lineas:[],tramos:[],unidades:[],ejecuciones:[]};
      window.mapaQa=crearEditorRedReferenciaNivel(document.getElementById('editor'),window.redQa,()=>{});
    });
    const mapa=pagina.locator('.admin-red-referencia__mapa');
    const caja=await mapa.boundingBox();
    await mapa.click({position:{x:caja.width*.4,y:caja.height*.5}});
    assert.equal(await pagina.evaluate(()=>redQa.estaciones.length),1);
    const primera=pagina.locator('[data-estacion="E1"]');
    await primera.focus();
    const x=await pagina.evaluate(()=>redQa.estaciones[0].x);
    await pagina.keyboard.press('ArrowRight');
    assert.equal(await pagina.evaluate(()=>redQa.estaciones[0].x),x+5);
    assert.equal(await pagina.locator('[data-estacion="E1"]').evaluate(n=>n===document.activeElement),true);
    await mapa.click({position:{x:caja.width*.6,y:caja.height*.5}});
    await pagina.evaluate(()=>{redQa.lineas.push({nombre:'Principal'});mapaQa.actualizar()});
    await pagina.getByLabel('Acción del mapa de referencia').selectOption('tramo');
    await pagina.locator('[data-estacion="E1"] circle').click();
    await pagina.locator('[data-estacion="E2"] circle').click();
    assert.deepEqual(await pagina.evaluate(()=>redQa.tramos),[{linea:'Principal',a:'E1',b:'E2'}]);
    await pagina.getByLabel('Acción del mapa de referencia').selectOption('mover');
    await pagina.locator('[data-estacion="E1"] circle').click();
    const antes=await pagina.evaluate(()=>({...redQa.estaciones[0]}));
    await mapa.click({position:{x:caja.width*.3,y:caja.height*.4}});
    const despues=await pagina.evaluate(()=>redQa.estaciones[0]);
    assert(despues.x<antes.x&&despues.y<antes.y,'Mover modifica las coordenadas sin crear otra estación');
    assert.equal(await pagina.evaluate(()=>redQa.estaciones.length),2);
    await pagina.evaluate(()=>{redQa.lineas.push({nombre:'Secundaria'});mapaQa.actualizar()});
    await pagina.getByLabel('Línea de referencia activa').selectOption('Secundaria');
    await pagina.getByLabel('Acción del mapa de referencia').selectOption('tramo');
    await pagina.locator('[data-estacion="E1"] circle').click();
    await pagina.locator('[data-estacion="E2"] circle').click();
    assert.equal(await pagina.evaluate(()=>redQa.tramos[1].linea),'Secundaria');
    assert.equal(await pagina.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errores,[]);
  } finally { await navegador.close(); }
});
