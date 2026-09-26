// Chrome y Phaser reales; API simulada, sin escribir en PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL}); });
after(async () => { await navegador?.close(); });
const resumen = completados => ({cantidadNiveles:10,nivelesCompletados:completados,campanaCompletada:completados===10,
  escenarios:niveles.map(n=>({...n,idEscenario:n.numero,estado:n.numero<=completados?'COMPLETADO':'DISPONIBLE',desbloqueado:n.numero<=completados+1,mejorPuntaje:85,puntajeMaximo:100}))});
async function abrir(t,opciones={}) {
  const vista=await abrirPantalla(navegador,'/escenarios.html',opciones);
  t.after(async()=>{await vista.contexto.close();assert.deepEqual(vista.errores,[]);});
  // La composición con reloj controlado prueba el respaldo silencioso de 1,8 s.
  await vista.pagina.evaluate(async()=>{(await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true);});
  await vista.pagina.clock.install();return vista;
}
async function victoria(pagina,opciones={}) {
  await pagina.evaluate(async opciones=>{
    const {mostrarTransicionNivel}=await import('/src/educacion/PantallaTransicionNivel.js');
    window.accionVictoria=undefined;
    window.promesaVictoria=mostrarTransicionNivel({numero:opciones.final?10:6,nombre:opciones.final?'Nivel 10 · Red integral':'Nivel 6 · Movilidad entre zonas',puntajeMaximo:100},
      opciones.final?null:{numero:7,objetivo:'Organizá estaciones y transbordos entre tres líneas.'},
      {puntaje:95,mejorPuntajeAnterior:85,...opciones}).then(valor=>{window.accionVictoria=valor;return valor;});
  },opciones);return pagina.locator('.metronet-victoria');
}
for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[768,1024],[390,844],[375,667],[320,568]]) {
 test(`Victoria ${width}×${height}: composición, puntos, sincronización y avance automático`,async t=>{
  const {pagina}=await abrir(t,{viewport:{width,height}});const d=await victoria(pagina);
  assert.equal(await pagina.evaluate(()=>document.activeElement.id),'tituloVictoriaNivel');
  assert.match(await d.innerText(),/95 \/ 100 PTS.*Nuevo récord personal/is);
  assert.equal(await d.locator('[data-concepto], [aria-haspopup], [role=tooltip], [popover], a').count(),0);
  assert.equal(await d.getByRole('progressbar').getAttribute('aria-valuenow'),'0');
  let previo=-1;
  for(const ms of [200,400,500]){
   await pagina.clock.runFor(ms);
   const {p,x}=await d.evaluate(d=>({p:Number(d.querySelector('[role=progressbar]').getAttribute('aria-valuenow')),x:d.querySelector('.recorrido-tren').transform.baseVal.getItem(0).matrix.e}));
   assert.ok(p>=previo);previo=p;
   assert.ok(Math.abs((x-124)/712*100-p)<1.1);
  }
  const medidas=await d.evaluate(d=>{const r=d.getBoundingClientRect();return {
   alto:r.height,ancho:r.width,scroll:d.scrollHeight>d.clientHeight+1,scrollX:d.scrollWidth>d.clientWidth+1,
   imagen:d.querySelector('.metronet-victoria__recorrido').getBoundingClientRect().height,
   texto:[...d.querySelectorAll('header, footer, .metronet-victoria__destino')].map(e=>e.getBoundingClientRect().height),
   botones:[...d.querySelectorAll('footer button')].every(b=>b.getBoundingClientRect().height>=44),
   tren:d.querySelector('.recorrido-tren').getBoundingClientRect().width};});
  assert.ok(medidas.alto<=height&&medidas.ancho<=width);assert.equal(medidas.scrollX,false);assert.equal(medidas.botones,true);
  assert.ok(medidas.imagen>Math.max(...medidas.texto),'La animación es el bloque principal');
  assert.ok(medidas.tren>=85,'Metro reconocible también en móvil');if(width>=768)assert.equal(medidas.scroll,false);
  if(process.env.METRONET_VICTORIA_CAPTURAS){fs.mkdirSync(process.env.METRONET_VICTORIA_CAPTURAS,{recursive:true});const base=path.join(process.env.METRONET_VICTORIA_CAPTURAS,`victoria-${width}x${height}`);await pagina.screenshot({path:base+'.png'});fs.writeFileSync(base+'.json',JSON.stringify(medidas,null,2));}
  await pagina.clock.runFor(800);assert.equal(await pagina.evaluate(()=>window.accionVictoria),'siguiente');assert.equal(await d.count(),0);
 });
}
test('Reduced motion conserva progreso y avance sin desplazamiento continuo',async t=>{
 const {pagina}=await abrir(t,{reducedMotion:'reduce',viewport:{width:390,height:844}});const d=await victoria(pagina);
 const inicio=await d.locator('.recorrido-tren').getAttribute('transform');await pagina.clock.runFor(1200);
 assert.equal(await d.locator('.recorrido-tren').getAttribute('transform'),inicio);assert.ok(Number(await d.getByRole('progressbar').getAttribute('aria-valuenow'))>50);
 assert.equal(await d.getAttribute('data-movimiento-reducido'),'true');await pagina.clock.runFor(800);assert.equal(await pagina.evaluate(()=>window.accionVictoria),'siguiente');
});
for(const anterior of [null,95,100])test(`No inventa récord con referencia ${anterior}`,async t=>{
 const {pagina}=await abrir(t);const d=await victoria(pagina,{mejorPuntajeAnterior:anterior});assert.equal(await d.locator('.metronet-victoria__record').count(),0);
 await pagina.keyboard.press('Escape');assert.equal(await pagina.evaluate(()=>window.accionVictoria),null);
});
for(const width of [1366,390])test(`Final ${width}: llegada, resumen, total y ranking; sin nivel inexistente`,async t=>{
 const {pagina,solicitudes}=await abrir(t,{viewport:{width,height:width===1366?768:844}});
 const d=await victoria(pagina,{final:true,resumen:resumen(10),ranking:{puntajeTotal:850,puntajeMaximo:1000,tuPosicion:4}});
 assert.equal(await d.locator('.metronet-victoria__resumen').isVisible(),false);await pagina.clock.runFor(1900);
 assert.match(await d.innerText(),/850 \/ 1000 puntos acumulados.*Tu posición: 4/s);assert.equal(await d.getByRole('progressbar').getAttribute('aria-valuenow'),'100');
 assert.equal(await d.evaluate(e=>e.scrollHeight>e.clientHeight+1),false);assert.equal(await pagina.evaluate(()=>window.accionVictoria),undefined);
 if(process.env.METRONET_VICTORIA_CAPTURAS)await pagina.screenshot({path:path.join(process.env.METRONET_VICTORIA_CAPTURAS,`final-${width}.png`)});
 await d.getByRole('button',{name:'Ver desempeño y ranking'}).click();assert.equal(await pagina.evaluate(()=>window.accionVictoria),'ranking');assert.equal(solicitudes.filter(r=>r.method==='POST').length,0);
});
test('Destino persistido admite repetir, respeta bloqueados y excluye Modo Libre',async t=>{
 const {pagina}=await abrir(t);
 for(const estado of ['COMPLETADO','DISPONIBLE','BLOQUEADO']){
  const progreso=resumen(6);progreso.escenarios[6].estado=estado;progreso.escenarios[6].desbloqueado=estado!=='BLOQUEADO';
  await pagina.evaluate(async progreso=>{const {presentarResultadoNivel}=await import('/src/educacion/TransicionNivel.js');window.accion=presentarResultadoNivel(progreso,6,{completado:true,puntaje:95,idSiguienteEscenario:7});},progreso);
  await pagina.locator('.metronet-victoria').waitFor();await pagina.clock.runFor(1900);const accion=await pagina.evaluate(()=>window.accion);
  if(estado==='BLOQUEADO')assert.deepEqual(accion,{destino:'/escenarios.html'});else assert.equal(accion.siguiente.estado,estado);
 }
 const acciones=await pagina.evaluate(async()=>{const {presentarResultadoNivel}=await import('/src/educacion/TransicionNivel.js');return Promise.all([
  presentarResultadoNivel({escenarios:[{idEscenario:11,numero:null,estado:'COMPLETADO'}]},11,{completado:true}),presentarResultadoNivel({escenarios:[]},1,{completado:false})]);});
 assert.deepEqual(acciones,[null,null]);assert.equal(await pagina.locator('.metronet-victoria').count(),0);
});
test('Ranking fallido no bloquea la victoria final de un administrador',async t=>{
 const {pagina}=await abrir(t,{responder:async req=>new URL(req.url()).pathname.endsWith('/ranking')?{status:503,json:{}}:null});
 const progreso=resumen(0);progreso.escenarios[9].estado='COMPLETADO';progreso.escenarios.forEach(e=>e.desbloqueado=true);
 await pagina.evaluate(async progreso=>{const {presentarResultadoNivel}=await import('/src/educacion/TransicionNivel.js');window.accion=presentarResultadoNivel(progreso,10,{completado:true,puntaje:100,idSiguienteEscenario:null});},progreso);
 const d=pagina.locator('.metronet-victoria');await d.waitFor();await pagina.clock.runFor(1900);assert.match(await d.innerText(),/Resumen del recorrido/i);assert.doesNotMatch(await d.innerText(),/Campaña completada/i);
 await d.getByRole('button',{name:'Seleccionar nivel'}).click();assert.deepEqual(await pagina.evaluate(()=>window.accion),{destino:'/escenarios.html'});
});
test('Cancelación, reemplazo y desmontaje limpian frames y evitan dobles continuaciones',async t=>{
 const {pagina}=await abrir(t);
 await pagina.evaluate(async()=>{
  const {mostrarTransicionNivel}=await import('/src/educacion/PantallaTransicionNivel.js');window.nuevaVictoria=signal=>mostrarTransicionNivel({numero:1},{numero:2},{signal});
  const raf=requestAnimationFrame,caf=cancelAnimationFrame;window.framesVictoria=new Set();
  window.requestAnimationFrame=cb=>{const id=raf(t=>{framesVictoria.delete(id);cb(t);});framesVictoria.add(id);return id;};window.cancelAnimationFrame=id=>{framesVictoria.delete(id);caf(id);};
 });
 for(const modo of ['escape','popstate','pagehide','desmontar','reemplazar','signal','selector']){
  await pagina.evaluate(()=>{window.controlVictoria=new AbortController();window.primera=nuevaVictoria(controlVictoria.signal);window.anterior=document.querySelector('.metronet-victoria');});
  await pagina.clock.runFor(700);
  if(modo==='escape')await pagina.keyboard.press('Escape');else if(modo==='selector')await pagina.getByRole('button',{name:'Seleccionar nivel'}).click();else await pagina.evaluate(modo=>{
   if(modo==='desmontar')anterior.remove();else if(modo==='signal')controlVictoria.abort();else if(modo==='reemplazar'){nuevaVictoria();document.querySelector('.metronet-victoria').close();}else window.dispatchEvent(new Event(modo));
  },modo);
  assert.equal(await pagina.evaluate(()=>primera),modo==='selector'?'selector':null);
  const p=await pagina.evaluate(()=>anterior.querySelector('[role=progressbar]').getAttribute('aria-valuenow'));await pagina.clock.runFor(5000);
  assert.equal(await pagina.locator('.metronet-victoria').count(),0);assert.equal(await pagina.evaluate(()=>framesVictoria.size),0);assert.equal(await pagina.evaluate(()=>anterior.querySelector('[role=progressbar]').getAttribute('aria-valuenow')),p);
 }
});
test('Tras la victoria: salida durante API lenta evita otra carga y navegación tardía',async t=>{
 const {pagina}=await abrir(t);await pagina.evaluate(async()=>{
  const {iniciarNivelConTransicion}=await import('/src/educacion/PreparacionNivel.js');window.llamadas=0;
  window.inicio=iniciarNivelConTransicion({numero:2},signal=>{window.signalInicio=signal;llamadas++;return new Promise(r=>window.liberarInicio=r);},{preparado:true});
 });
 assert.equal(await pagina.locator('.metronet-viaje').count(),0);await pagina.evaluate(()=>window.dispatchEvent(new Event('popstate')));assert.equal(await pagina.evaluate(()=>inicio),null);
 await pagina.evaluate(()=>liberarInicio({idDiseno:42}));assert.equal(await pagina.evaluate(()=>signalInicio.aborted),true);assert.equal(await pagina.evaluate(()=>llamadas),1);
});
test('Constructor real: evaluación única, victoria y siguiente nivel sin segunda carga',async t=>{
 const progreso=resumen(0);progreso.escenarios[0].estado='EN_DESARROLLO';progreso.escenarios[1].desbloqueado=true;
 const vista=await abrirEditor(navegador,{escenario:progreso.escenarios[0]});const {pagina}=vista;
 t.after(async()=>{await vista.contexto.close();assert.deepEqual(vista.errores,[]);});let evaluaciones=0,inicios=0;
 await pagina.route('**/api/juego/**',async route=>{
  const ruta=new URL(route.request().url()).pathname;
  if(ruta.endsWith('/evaluar')){evaluaciones++;progreso.escenarios[0].estado='COMPLETADO';return route.fulfill({json:{completado:true,puntaje:95,idSiguienteEscenario:2,mensaje:'Nivel completado'}});}
  if(ruta.endsWith('/iniciar')){inicios++;vista.diseno.simulacion.idEscenario=2;return route.fulfill({json:{idDiseno:77,idEscenario:2,idIntento:202}});}
  if(ruta.endsWith('/progreso'))return route.fulfill({json:progreso});if(ruta.endsWith('/escenarios'))return route.fulfill({json:progreso.escenarios});return route.fallback();
 });
 await pagina.evaluate(async()=>{(await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true);});
 await pagina.clock.install();await pagina.evaluate(()=>{window.evaluaciones=Promise.all([editorPrueba.evaluarEscenarioSinSimulacion(77),editorPrueba.evaluarEscenarioSinSimulacion(77)]);});
 const d=pagina.locator('.metronet-victoria');await d.waitFor();assert.match(await d.innerText(),/Nuevo récord personal/i);assert.equal(evaluaciones,1);assert.equal(inicios,0);
  await pagina.clock.runFor(1900);await pagina.waitForFunction(()=>!editorPrueba.evaluacionEnCurso);assert.equal(await pagina.locator('.metronet-identificacion').count(),0);assert.equal(inicios,1);assert.equal(await pagina.locator('.metronet-viaje').count(),0);
 assert.equal(new URL(pagina.url()).searchParams.get('idEscenario'),'2');
});
for (const caso of ['repetido','administrador','errorInicio','modoLibre','incompleto']) test(`Simulación integrada: ${caso}`,async t=>{
 const numero=caso==='modoLibre'?null:4;
 const progreso=resumen(caso==='repetido'?10:4);
 if(caso==='administrador'){progreso.campanaCompletada=false;progreso.escenarios.forEach(e=>e.desbloqueado=true);}
 if(!numero)progreso.escenarios.push({numero:null,idEscenario:11,estado:'DISPONIBLE',desbloqueado:true});
 const red={simulacion:{idDiseno:77,idEscenario:numero??11,nombre:'Red de prueba',modo:numero?'NIVEL':'EDICION_LIBRE',estado:'VALIDADO'},
  estaciones:[{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],lineas:[{nombre:'Azul'}],tramos:[{nombreLinea:'Azul',estacionA:'A',estacionB:'B'}],
  unidadesMetro:[{idTren:1,nombreLinea:'Azul',capacidad:300,velocidadPromedio:40}],preparadoParaSimular:true,resultados:[],territorio:{areas:[],errores:[]}};
 const vista=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{administrador:caso==='administrador',responder:async req=>{
  const ruta=new URL(req.url()).pathname;
  if(ruta==='/api/juego/progreso')return {json:progreso};
  if(ruta==='/api/simulaciones')return {json:[red.simulacion]};
  if(ruta==='/api/simulaciones/77')return {json:red};
  if(ruta.endsWith('/ejecutar'))return {json:{idSimulacion:1,puntaje:0,estado:'COMPLETADA',duracion:10,velocidad:4}};
  if(ruta.endsWith('/evaluar'))return {json:{completado:caso!=='incompleto',puntaje:100,idSiguienteEscenario:numero?5:null,mensaje:'Resultado registrado',desempeno:{puntajeMaximo:100}}};
  if(/escenarios\/5\/(iniciar|volver-a-jugar)$/.test(ruta))return caso==='errorInicio'?{status:503,json:{}}:{json:{idDiseno:200,idEscenario:5,idIntento:300}};
 }});
 const {pagina,solicitudes}=vista;t.after(async()=>{await vista.contexto.close();assert.deepEqual(vista.errores,[]);});
 pagina.setDefaultTimeout(26000); // Incluye simulación real y transición breve.
 if(caso==='administrador')assert.equal(await pagina.evaluate(()=>JSON.parse(localStorage.getItem('sesionAdministrador')).usuario.rol),'ADMIN');
 await pagina.route('**/?idDiseno=200*',route=>route.fulfill({contentType:'text/html',body:'<script src="/transicion-pagina.js"></script><link rel="stylesheet" href="/src/estilos/navegacion-estable.css"><h1>Consigna del nivel 5</h1>'}));
 await pagina.locator('#seccionConfiguracion > summary').click();await pagina.locator('#duracionSimulacion').fill('10');await pagina.locator('[data-velocidad="4"]').click();
 await pagina.locator('#formularioEjecucion button[type="submit"]').click();
 if(caso==='modoLibre'||caso==='incompleto'){
  await pagina.getByText(/Recorrido finalizado:/).waitFor();assert.equal(await pagina.locator('.metronet-victoria').count(),0);
  assert.equal(solicitudes.filter(s=>/escenarios\/5\//.test(s.path)).length,0);return;
 }
 await pagina.locator('.metronet-victoria').waitFor();assert.equal(solicitudes.filter(s=>s.path.endsWith('/evaluar')).length,1);
 assert.match(await pagina.locator('.metronet-victoria').innerText(),/100 \/ 100 PTS.*Nuevo récord personal/is);
 if(caso==='errorInicio'){
  await pagina.getByText(/Resultado guardado.*No fue posible iniciar/).waitFor();assert.equal(new URL(pagina.url()).pathname,'/simulacion.html');
  await pagina.locator('#seccionResultados > summary').click();
  assert.equal(await pagina.locator('#continuarEscenarios').isVisible(),true);
 }else await pagina.waitForURL('**/?idDiseno=200&idEscenario=5&idIntento=300');
 const inicios=solicitudes.filter(s=>/escenarios\/5\//.test(s.path));assert.equal(inicios.length,1);
 assert.equal(inicios[0].path,`/api/juego/escenarios/5/${caso==='repetido'?'volver-a-jugar':'iniciar'}`);
 assert.equal(await pagina.locator('.metronet-viaje').count(),0);
});


test('Cambiar de diseño mientras llega el próximo nivel conserva la elección manual',async t=>{
 const {pagina}=await abrir(t);
 await pagina.evaluate(async()=>{
  const {default:Editor}=await import('/src/mapa/controles/EditorRedMetro.js');
  window.editor=new Editor(null);editor.escenariosJuego=[{idEscenario:2,numero:2}];
  editor.disenoActual={simulacion:{idDiseno:77}};
  editor.solicitarJuego=()=>new Promise(r=>window.liberar=r);
  editor.cargarJuego=async()=>{};editor.cargarDisenos=async()=>{window.cambioIndebido=true;};editor.mostrarMensaje=()=>{};
  window.apertura=editor.abrirEscenario('/escenarios/2/iniciar',2,true);
 });
 await pagina.waitForFunction(()=>typeof window.liberar==='function');
 await pagina.evaluate(()=>{editor.disenoActual={simulacion:{idDiseno:88}};history.replaceState({},'', '/escenarios.html?idDiseno=88');liberar({idDiseno:99,idEscenario:2,idIntento:3});});
 await pagina.evaluate(()=>apertura);
 assert.equal(new URL(pagina.url()).searchParams.get('idDiseno'),'88');
 assert.equal(await pagina.evaluate(()=>window.cambioIndebido),undefined);
 assert.equal(await pagina.evaluate(()=>editor.aperturaEscenarioEnCurso),false);
});
