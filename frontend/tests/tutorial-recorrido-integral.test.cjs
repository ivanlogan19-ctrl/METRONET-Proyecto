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
 const oferta=p.locator('[data-oferta-tutorial]');
 const dimensiones=await oferta.boundingBox();
 assert.ok(Math.abs(dimensiones.x+dimensiones.width/2-width/2)<2,'Oferta centrada horizontalmente');
 assert.ok(Math.abs(dimensiones.y+dimensiones.height/2-500)<2,'Oferta centrada verticalmente');
 const fuentes=await oferta.locator('h2,p,button').evaluateAll(es=>es.map(e=>getComputedStyle(e).fontFamily));
 assert.equal(new Set(fuentes).size,1,'Toda la oferta usa la misma fuente pixelada');
 const botones=await oferta.locator('button').all();
 const cajas=await Promise.all(botones.map(b=>b.boundingBox()));
 assert.ok(cajas[1].y-cajas[0].y-cajas[0].height>=10,'Opciones separadas');
 assert.equal(cajas[0].width,cajas[1].width);
 await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).click();
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
 for(const nombre of ['Mapa de la red','Estación','Línea','Conexión','Metro','Guardar','Simular','Selección','Aprender','Música']) assert.ok(titulos.includes(nombre),nombre);
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
  localStorage.setItem("metronet:tutorial-pantalla-simulacion:v4:7:1:primera-visita","presentado");
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

for (const nivel of catalogo.slice(1)) test(`N${nivel.numero}: el tutorial automático presenta solamente funciones nuevas`, async t => {
 const v=await abrirEditor(browser,{escenario:{...nivel,idEscenario:nivel.numero,recorrido:'integral-2026-10-metas-5-v1'},ofrecerRecorrido:true,estaciones:[],lineas:[],tramos:[]});
 t.after(()=>v.contexto.close());
 const p=v.pagina, titulo={2:'Extendé la línea',6:'Puntos de interés de Montevideo',7:'Un intercambio real'}[nivel.numero];
 if(titulo) {
  await p.locator('.metronet-recorrido').waitFor();
  assert.equal(await p.locator('.metronet-recorrido h2').textContent(),titulo);
  assert.equal(await p.locator('[data-recorrido-omitir]').evaluate(e=>e.getBoundingClientRect().width),24);
  await p.keyboard.press('Escape');
 } else assert.equal(await p.locator('.metronet-recorrido').count(),0);
 assert.deepEqual(v.errores,[]);
});

test('N1 permite comenzar directamente y sigue aceptando estaciones', async t => {
 const v=await abrirEditor(browser,{escenario:{...catalogo[0],idEscenario:1,recorrido:'integral-2026-10-objetivos-reales-v2'},ofrecerRecorrido:true,estaciones:[],lineas:[],tramos:[]});
 t.after(()=>v.contexto.close());const p=v.pagina;
 await p.getByRole('button',{name:'Comenzar directamente',exact:true}).click();
 assert.equal(await p.locator('.metronet-recorrido').count(),0);
 await p.locator('[data-elegir-herramienta="estaciones"]').click();
 const canvas=await p.locator('#metronet-mapa canvas').boundingBox();
 await p.mouse.click(canvas.x+canvas.width*.55,canvas.y+canvas.height*.60);
 await p.waitForFunction(()=>editorPrueba.disenoActual.estaciones.length===1);
 assert.deepEqual(v.errores,[]);
});

test('Registro por usuario: funciones nuevas, POI real y ayudas que no se marcan antes de practicarlas',async t=>{
 const v=await abrirPantalla(browser,'/escenarios.html');t.after(()=>v.contexto.close());const p=v.pagina;
 const estado=await p.evaluate(async()=>{
  const r=await import('/src/educacion/FuncionesCampana.js');
  const e=await import('/src/educacion/TutorialInicial.js');
  const s=await import('/src/educacion/TutorialSimulacion.js');
  const secuencia=Array.from({length:10},(_,i)=>r.funcionesIntroducidas(i+1));
  r.registrarFuncionesEnsenadas(7,['editor.poi','simulacion.inicial','simulacion.velocidad']);
  const conocida=s.presentarTutorialSimulacion({idUsuario:7,numeroNivel:2,numeroCampana:4});
  const otraCuenta=s.presentarTutorialSimulacion({idUsuario:8,numeroNivel:8});
  const inicialOtraCuenta=document.querySelector('.metronet-recorrido h2')?.textContent;
  otraCuenta?.terminar(false);
  return {secuencia,conocida:conocida===null,inicialOtraCuenta,ajena:r.funcionesEnsenadas(8).size,
   poi:e.objetivoTutorialPoi(6).id,poiInicial:e.objetivoTutorialPoi(1),
   pasosPoi:e.pasosPracticosEditor(6).map(p=>p[3]).filter(Boolean)};
 });
 assert.deepEqual(estado.secuencia,[['editor.basico'],['editor.extender','simulacion.velocidad'],['simulacion.duracion'],['simulacion.global','simulacion.individual'],[],['editor.poi'],['editor.transbordo'],[],['simulacion.combinacion'],[]]);
 assert.equal(estado.conocida,true);assert.equal(estado.inicialOtraCuenta,'Mapa de la red');assert.equal(estado.ajena,0);
 assert.equal(estado.poi,33);assert.equal(estado.poiInicial,undefined);
 assert.deepEqual(estado.pasosPoi,['poi-abierto','buscador-abierto','poi-buscado','poi-localizado','poi-cubierto']);
});

for (const numero of [1,6]) test(`Guía rápida N${numero}: solo funciones visibles y acceso Aprender`,async t=>{
 const nivel=catalogo[numero-1];
 const v=await abrirEditor(browser,{escenario:{...nivel,idEscenario:numero,recorrido:'integral-2026-10-objetivos-reales-v2'},primeraPasada:false,novedadPresentada:true,cerrarTarjetaAutomatica:false,consigna:()=>({condiciones:[],referenciasObjetivo:(nivel.reglasExito.puntosInteresObjetivo||[]).map(p=>({...p,nombre:`Referencia ${p.idPunto}`}))})});
 t.after(()=>v.contexto.close());const p=v.pagina;
 if(await p.locator('.metronet-recorrido').count()) await p.keyboard.press('Escape');
 await p.locator('.metronet-tutorial > summary').click();
 const guia=p.locator('.metronet-guia-rapida:popover-open');await guia.waitFor();
 const texto=await guia.innerText();
 assert.match(texto,/Aprender abre las tarjetas educativas/);
 assert.doesNotMatch(texto,/Controles y pista|pedir una pista|El libro/);
 assert.equal(/puntos de interés/.test(texto),numero===6);
 assert.equal(await p.getByRole('button',{name:'Aprender',exact:true}).isVisible(),true);
 await p.getByRole('button',{name:'Aprender',exact:true}).click();
 await p.locator('.metronet-tarjeta-educativa').waitFor();
 assert.deepEqual(v.errores,[]);
});
