// Interacción real y MP3 real; respuestas HTTP controladas, sin escribir datos.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let navegador;
before(async()=>{navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL,args:['--autoplay-policy=no-user-gesture-required']});});
after(async()=>{await navegador?.close();});
async function abrir(t){
 const v=await abrirPantalla(navegador,'/escenarios.html');
 t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
 await v.pagina.evaluate(async()=>{
  window.g=(await import('/src/audio/GestorMusica.js')).gestorMusica;
  window.crearIntro=(await import('/src/educacion/PantallaPreparacionNivel.js')).crearPreparacionNivel;
  window.crearOutro=(await import('/src/educacion/PantallaTransicionNivel.js')).mostrarTransicionNivel;
 });
 return v.pagina;
}
for(const tipo of ['intro','outro'])for(const fase of ['viaje','cartel'])test(`${tipo}/${fase}: ${fase==='viaje'?'Jugar permite avanzar':'el número de nivel oculta las acciones y conserva la música'}`,async t=>{
 const p=await abrir(t);
 await p.evaluate(tipo=>{
  window.continuaciones=0;
  let promesa;
  if(tipo==='intro'){
   window.intro=crearIntro({numero:1,nombre:'Primera red'});intro.marcarDatosListos();promesa=intro.finalizada;
  }else promesa=crearOutro({numero:1},{numero:2},{puntaje:100});
  window.fin=promesa.then(accion=>{window.accion=accion;continuaciones++;if(tipo==='intro')intro.cerrar();});
  window.audioInicial=g.audio;
 },tipo);
 await p.waitForFunction(()=>audioInicial.currentTime>.1&&!audioInicial.paused);
 assert.equal(await p.getByRole('button',{name:'Leer sin prisa'}).count(),0);
 assert.equal(await p.locator(tipo==='intro'?'.metronet-viaje__estado':'.metronet-victoria__estado').textContent(),'Entrarás al terminar la música. Pulsá Jugar para comenzar ahora.');
 if(fase==='cartel'){
  await p.getByRole('button',{name:'Jugar',exact:true}).focus();
  await p.evaluate(()=>audioInicial.currentTime=12);
  await p.locator('.metronet-cartel-transicion:not([hidden])').waitFor();
  const pie=p.locator(tipo==='intro'?'.metronet-viaje__pie':'.metronet-victoria__acciones');
  assert.equal(await pie.isVisible(),false);
  for(const boton of await pie.locator('button').all())assert.equal(await boton.isVisible(),false);
  await p.keyboard.press('Tab');
  assert.equal(await pie.evaluate(e=>e.contains(document.activeElement)),false,'Los botones ocultos no reciben foco');
  assert.equal(await p.evaluate(()=>g.audio===audioInicial&&!audioInicial.paused&&audioInicial.currentTime>=12),true);
  assert.equal(await p.evaluate(()=>continuaciones),0);
  await p.evaluate(()=>audioInicial.currentTime=audioInicial.duration-.3);
  await p.waitForFunction(()=>continuaciones===1);
 }else{
  const inicio=Date.now();
  const boton=p.getByRole('button',{name:'Jugar',exact:true});
  await boton.focus();await p.keyboard.press('Enter');
  await p.evaluate(()=>fin);
  assert.ok(Date.now()-inicio<1800,'No esperar los 15 s después de pulsar Jugar');
 }
 assert.equal(await p.evaluate(()=>accion),tipo==='intro'?true:'siguiente');
 await p.waitForFunction(()=>audioInicial.paused);
 assert.deepEqual(await p.evaluate(()=>({continuaciones,temporales:g.temporales.size,dialogos:document.querySelectorAll('dialog[open]').length})),{continuaciones:1,temporales:0,dialogos:0});
});
test('Jugar espera los datos reales y un doble clic no duplica la entrada',async t=>{
 const p=await abrir(t);
 await p.evaluate(()=>{window.intro=crearIntro({numero:1});window.continuaciones=0;intro.finalizada.then(()=>continuaciones++);});
 const jugar=p.getByRole('button',{name:'Jugar',exact:true});
 assert.equal(await jugar.isDisabled(),true);
 await jugar.evaluate(b=>b.click());
 assert.equal(await p.evaluate(()=>continuaciones),0);
 await p.evaluate(()=>intro.marcarDatosListos());
 assert.equal(await jugar.isEnabled(),true);
 await jugar.dblclick();
 assert.equal(await p.evaluate(()=>continuaciones),1);
 await p.evaluate(()=>intro.cerrar());
});
for(const modoLibre of [null,{numero:null,idEscenario:11}])test(`Final de recorrido: ${modoLibre?'Jugar abre Modo Libre':'Ver resumen conserva resultados'}`,async t=>{
 const p=await abrir(t);
 await p.evaluate(modoLibre=>{window.accion=undefined;window.fin=crearOutro({numero:10},null,{final:true,modoLibre,puntaje:95}).then(a=>{accion=a;});window.audioInicial=g.audio;},modoLibre);
 await p.getByRole('button',{name:modoLibre?'Jugar':'Ver resumen',exact:true}).click();
 if(modoLibre){await p.evaluate(()=>fin);assert.equal(await p.evaluate(()=>accion),'modoLibre');}
 else{
  assert.equal(await p.locator('.metronet-victoria__resumen').isVisible(),true);
  assert.equal(await p.evaluate(()=>accion),undefined);
  assert.equal(await p.getByRole('button',{name:'Ver resumen',exact:true}).isVisible(),false);
  await p.getByRole('button',{name:'Ver desempeño y ranking'}).click();
  await p.evaluate(()=>fin);assert.equal(await p.evaluate(()=>accion),'ranking');
 }
 await p.waitForFunction(()=>audioInicial.paused);
});
for(const [width,height]of [[375,667],[320,568]])test(`Acciones visibles solo durante el viaje de inicio y final a ${width}x${height}`,async t=>{
 const p=await abrir(t);await p.setViewportSize({width,height});
 await p.evaluate(()=>g.establecerSilencio(true));await p.clock.install();
 for(const tipo of ['intro','outro']){
  await p.evaluate(tipo=>{
   if(tipo==='intro'){window.intro=crearIntro({numero:2,nombre:'Conectá la red',objetivo:'Explorá cómo las estaciones forman un recorrido continuo.'});intro.marcarDatosListos();}
   else window.fin=crearOutro({numero:1,nombre:'Primera red'},{numero:2,objetivo:'Explorá cómo las estaciones forman un recorrido continuo.'},{puntaje:95});
  },tipo);
  await p.clock.runFor(700);
  const boton=p.getByRole('button',{name:'Jugar',exact:true});
  const rect=await boton.boundingBox();
  assert.ok(rect.y>=0&&rect.y+rect.height<=height,'Jugar visible durante la animación sin scroll previo');
  assert.ok(rect.height>=44&&rect.x>=0&&rect.x+rect.width<=width);
  await p.clock.runFor(850);
  assert.equal(await p.locator('.metronet-cartel-transicion').isVisible(),true);
  assert.equal(await p.locator(tipo==='intro'?'.metronet-viaje__pie':'.metronet-victoria__acciones').isVisible(),false);
  assert.equal(await boton.isVisible(),false);
  await p.clock.runFor(350);
  if(tipo==='intro')await p.evaluate(async()=>{await intro.finalizada;intro.cerrar();});else await p.evaluate(()=>fin);
 }
});
