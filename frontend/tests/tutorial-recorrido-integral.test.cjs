const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirEditor}=require('./soporte/editor.cjs');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
const catalogo=require('../src/educacion/recorrido-integral.json');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(()=>browser?.close());
for(const width of [1440,390]) test(`Nivel 1 presenta mapa y herramientas, incluida Simular deshabilitada: ${width}`,async t=>{
 const escenario={...catalogo[0],idEscenario:1,recorrido:'integral-2026-10'};
 const v=await abrirEditor(browser,{escenario,estaciones:[],lineas:[],tramos:[],ofrecerRecorrido:true,viewport:{width,height:1000}});
 t.after(()=>v.contexto.close());
 const p=v.pagina;
 await p.locator('.metronet-recorrido').waitFor();
 const titulos=[];
 while(await p.locator('.metronet-recorrido [data-recorrido-siguiente]:visible').count()) {
  titulos.push(await p.locator('.metronet-recorrido h2').textContent());
  assert.equal(await p.locator('[data-recorrido-progreso]').isVisible(),false);
  assert.doesNotMatch(await p.locator('.metronet-recorrido').innerText(),/RECORRIDO\s*\/\/|\d+\s+DE\s+\d+/i);
  const r=await p.locator('.metronet-recorrido').boundingBox();
  assert.ok(r.x>=0 && r.x+r.width<=width+1,'La guía queda dentro del ancho visible');
  await p.locator('[data-recorrido-siguiente]').click();
 }
 for(const nombre of ['Mapa de la red','Estación','Línea','Conexión','Metro','Guardar','Simular','Selección']) assert.ok(titulos.includes(nombre),nombre);
 await p.waitForFunction(()=>document.querySelector('.metronet-recorrido h2')?.textContent==='Elegí Estación');
 assert.equal(await p.locator('[data-recorrido-siguiente]').isVisible(),false,'La práctica requiere la herramienta real');
 await p.locator('[data-elegir-herramienta="estaciones"]').click();
 await p.waitForFunction(()=>document.querySelector('.metronet-recorrido h2')?.textContent==='Colocá estaciones');
 assert.deepEqual(v.errores,[]);
});
test('Simulación incremental exige eventos, y la ayuda manual sigue disponible en niveles de reutilización',async t=>{
 const v=await abrirPantalla(browser,'/escenarios.html');t.after(()=>v.contexto.close());const p=v.pagina;
 await p.evaluate(async()=>{
  const {abrirTutorialSimulacion,presentarTutorialSimulacion}=await import('/src/educacion/TutorialSimulacion.js');
  window.autoReutilizacion=presentarTutorialSimulacion({numeroNivel:6,idUsuario:7});
  window.guia=abrirTutorialSimulacion(()=>{},6);
 });
 assert.equal(await p.evaluate(()=>autoReutilizacion),null);
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Mapa de la red');
 await p.keyboard.press('Escape');
 await p.evaluate(async()=>{const {abrirTutorialSimulacion}=await import('/src/educacion/TutorialSimulacion.js');window.guia=abrirTutorialSimulacion(()=>{},2);});
 assert.match(await p.locator('.metronet-recorrido h2').textContent(),/velocidad.*UV/);
 await p.locator('[data-recorrido-siguiente]').click();
 assert.equal(await p.locator('[data-recorrido-siguiente]').isVisible(),false);
 await p.evaluate(()=>guia.notificar('velocidad'));
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Observá el recorrido','Un ajuste no sustituye la ejecución inicial');
 await p.evaluate(()=>guia.notificar('ejecucion'));
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Cambiá UV');
 await p.evaluate(()=>guia.notificar('velocidad'));
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Observá el recorrido');
 await p.evaluate(()=>guia.notificar('ejecucion'));
 assert.equal(await p.locator('.metronet-recorrido').count(),0);
 assert.deepEqual(v.errores,[]);
});
