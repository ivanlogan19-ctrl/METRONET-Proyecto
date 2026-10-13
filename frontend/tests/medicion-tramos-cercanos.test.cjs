const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('La regla muestra cada tramo incluso entre estaciones y metros cercanos', async t => {
  const browser = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const v = await abrirPantalla(browser, '/escenarios.html');
  t.after(() => v.contexto.close());
  const resultado = await v.pagina.evaluate(async () => {
    const { default: MedicionDistancias } = await import('/src/mapa/controles/MedicionDistancias.js');
    const contenedor = document.createElement('div');
    contenedor.style.cssText = 'position:fixed;inset:0;width:1000px;height:600px;background:#091324;z-index:10000';
    contenedor.innerHTML = '<h3 class="metronet-panel-editor-cabecera">Diseño de la red</h3><canvas width="1000" height="600" style="position:absolute;inset:0;width:1000px;height:600px"></canvas>';
    document.body.append(contenedor);
    const puntos = [{x:100,y:400},{x:650,y:200},{x:700,y:310},{x:690,y:420},{x:688,y:475}];
    const estaciones = puntos.map((p,i)=>({nombre:String(i),posicionX:p.x,posicionY:p.y}));
    const capa = {
      escena: { events: {on(){},off(){}}, game:{canvas:contenedor.querySelector('canvas')},
        scale:{gameSize:{width:1000,height:600}}, cameras:{main:{scrollX:0,scrollY:0,matrix:{transformPoint:(x,y)=>({x,y})}}}},
      puntosEstaciones:puntos, unidadesEstaticas:[{x:250,y:345},{x:410,y:287},{x:550,y:236},{x:675,y:255}],
      unidadesSimulacion:new Map(), convertirPosicion:(x,y)=>({x,y}),
    };
    const medicion = new MedicionDistancias(capa);
    medicion.actualizar({simulacion:{modo:'LIBRE',idDiseno:1},estaciones,
      tramos:[27.2,5.5,7.1,2.5].map((distanciaKm,i)=>({nombreLinea:i<3?'Azul':'Rosa',estacionA:String(i),estacionB:String(i+1),distanciaKm}))});
    medicion.boton.click();
    await document.fonts.ready;
    medicion.posicionar();
    const etiquetas=medicion.etiquetas.map(({elemento})=>{const r=elemento.getBoundingClientRect();return {visible:!elemento.hidden,x:r.x,y:r.y,w:r.width,h:r.height};});
    return {etiquetas,total:medicion.total.textContent,obstaculos:[...puntos.map(p=>({x:p.x-17,y:p.y-35,w:34,h:48})),...capa.unidadesEstaticas.map(p=>({x:p.x-25,y:p.y-25,w:50,h:50}))]};
  });
  const solapa=(a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
  assert.equal(resultado.total,'Red · 42,3 km');
  assert.equal(resultado.etiquetas.filter(e=>e.visible).length,4,'Todos los tramos tienen espacio libre a sus lados');
  for(const [i,e] of resultado.etiquetas.entries()) {
    assert.ok(e.x>=0 && e.y>=0 && e.x+e.w<=1000 && e.y+e.h<=600);
    assert.ok(![...resultado.obstaculos,...resultado.etiquetas.slice(i+1)].some(o=>solapa(e,o)));
  }
  await v.pagina.screenshot({path:'/tmp/metronet-medicion-tramos-cercanos.png'});
  assert.deepEqual(v.errores,[]);
});
