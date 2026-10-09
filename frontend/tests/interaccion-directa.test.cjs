const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const {abrirEditor} = require('./soporte/editor.cjs');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(async()=>browser?.close());
async function abrir(t,opciones) { const vista=await abrirEditor(browser,opciones);t.after(()=>vista.contexto.close());t.after(()=>assert.deepEqual(vista.errores,[]));return vista; }
async function punto(p,x,y) {return p.evaluate(({x,y})=>{const e=editorPrueba.escena,c=e.cameras.main,m=e.capaRedMetro.convertirPosicion(x,y),r=e.game.canvas.getBoundingClientRect();return {x:r.x+(m.x-c.worldView.x)*c.zoom,y:r.y+(m.y-c.worldView.y)*c.zoom};},{x,y});}
async function clic(p,x,y) {await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const a=await punto(p,x,y);await p.mouse.click(a.x,a.y);}
async function herramienta(p,clave) {await p.locator(`[data-elegir-herramienta="${clave}"]`).click();}

test('arrastrar y hacer zoom con Estación activa no crea estaciones; tap sí',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);await herramienta(p,'estaciones');
 const a=await punto(p,700,460);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(a.x+60,a.y+30,{steps:8});await p.mouse.up();
 assert.equal(solicitudes.length,0);await p.mouse.wheel(0,-100);await p.waitForTimeout(100);assert.equal(solicitudes.length,0);
 await clic(p,750,480);await p.waitForFunction(()=>editorPrueba.disenoActual.estaciones.length===4);
 assert.equal(solicitudes.length,1);assert.equal(await p.evaluate(()=>editorPrueba.modo),'crearEstacion');
});

test('colocación con teclado y cancelación conserva el foco y el nombre automático',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);await herramienta(p,'estaciones');
 const posicion=await punto(p,750,480);
 await p.evaluate(pos=>{const r=juegoPrueba.canvas.getBoundingClientRect();editorPrueba.capaRedMetro.gestos.posicion={x:pos.x-r.x,y:pos.y-r.y};},posicion);
 await p.locator('canvas').focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');
 await p.waitForFunction(()=>editorPrueba.disenoActual.estaciones.length===4);
 assert.equal(solicitudes[0].datos.nombre,'Estación 01');await p.keyboard.press('Escape');
 assert.equal(await p.evaluate(()=>editorPrueba.modo),'normal');assert.equal(await p.locator('[data-elegir-herramienta="seleccion"]').getAttribute('aria-pressed'),'true');
});

test('nombre duplicado se recalcula una vez; doble clic no duplica escrituras',async t=>{
 const {pagina:p,diseno,solicitudes}=await abrir(t);
 let primera=true;
 await p.route('**/api/simulaciones/77/estaciones',async route=>{
   if(!primera)return route.fallback(); primera=false;
   diseno.estaciones.push({nombre:'Estación 01',posicionX:720,posicionY:470});
   await new Promise(r=>setTimeout(r,200));
   await route.fulfill({status:409,json:{detail:'Ya existe una estación con ese nombre'},headers:{'access-control-allow-origin':'*'}});
 });
 await herramienta(p,'estaciones');const a=await punto(p,760,480);await p.mouse.dblclick(a.x,a.y);
 await p.waitForFunction(()=>editorPrueba.disenoActual.estaciones.some(e=>e.nombre==='Estación 02'));
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/estaciones')).length,1);
 assert.equal(diseno.estaciones.filter(e=>e.nombre==='Estación 02').length,1);
});

test('transbordo surge de dos líneas conectadas en una estación sin edición de propiedades',async t=>{
 const escenario={idEscenario:7,numero:7,nombre:'Transbordos',estado:'EN_DESARROLLO',progreso:0,desbloqueado:true,herramientasHabilitadas:{estaciones:true,lineas:true,metros:true,conexiones:true,simulacion:true}};
 const {pagina:p,solicitudes}=await abrir(t,{escenario,lineas:[{nombre:'Azul'},{nombre:'Rosa'}],tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Rosa',estacionA:'Centro',estacionB:'Este'}]});
 assert.equal(await p.evaluate(()=>editorPrueba.disenoActual.estaciones[0].transbordo),false);
 assert.equal(await p.evaluate(()=>editorPrueba.capaRedMetro.esTransbordo(editorPrueba.disenoActual.estaciones[0])),true);
 assert.equal(await p.evaluate(()=>editorPrueba.capaRedMetro.esTransbordo(editorPrueba.disenoActual.estaciones[1])),false);
 assert.equal(await p.locator('[data-elegir-herramienta=transbordos]').count(),0);
 assert.equal(solicitudes.length,0);
});

test('líneas superpuestas requieren elegir destino del metro',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{lineas:[{nombre:'Azul'},{nombre:'Rosa'}],tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Rosa',estacionA:'Centro',estacionB:'Parque'}]});
 await herramienta(p,'metros');await clic(p,640,465);assert.equal(solicitudes.length,0);
 assert.equal(await p.locator('[data-linea-unidad], [data-agregar-unidad]').count(),0);
 await herramienta(p,'seleccion');
 assert.equal(await p.locator('[data-lineas-superpuestas] button').count(),0);
 assert.equal(await p.locator('[data-lineas-superpuestas]').isVisible(),false);
 await herramienta(p,'metros');await clic(p,640,465);
 await p.getByRole('button',{name:'Crear metro en Rosa',exact:true}).click();
 await p.waitForFunction(()=>editorPrueba.disenoActual.unidadesMetro.length===2);
 assert.equal(solicitudes[0].datos.nombreLinea,'Rosa');
});

test('guardar avance incompleto valida, persiste y no confunde consigna con error',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);
 await p.route('**/api/simulaciones/77/validacion',route=>route.fulfill({json:{valido:false,preparadoParaSimular:false,observaciones:['Hay estaciones sin línea asociada.']},headers:{'access-control-allow-origin':'*'}}));
 await p.locator('[data-guardar]').click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.equal(solicitudes.some(s=>s.ruta.endsWith('/guardar')),true);
 assert.equal(await p.locator('[data-estado-editor] [role=status]').innerText(),'');
 assert.equal(solicitudes.some(s=>s.ruta.endsWith('/evaluar')),false);
 assert.equal(await p.locator('.metronet-dialogo-advertencia').count(),0);
});

for(const numero of [1,2,3,4,5,6,7,8,9,10]) test(`nivel ${numero}: conserva disponibilidad de herramientas sin edición general`,async t=>{
 const nivel=require('../src/educacion/niveles.json').find(n=>n.numero===numero);
 const {pagina:p}=await abrir(t,{escenario:{...nivel,idEscenario:numero,desbloqueado:true,estado:'EN_DESARROLLO'}});
 for(const clave of ['estaciones','lineas','conexiones','metros']) assert.equal(await p.locator(`[data-elegir-herramienta="${clave}"]`).isDisabled(),nivel.herramientasHabilitadas[clave]===false);
 assert.equal(await p.locator('[data-ir-simulacion]').isDisabled(),nivel.herramientasHabilitadas.simulacion===false);
 await clic(p,810,480);assert.equal(await p.locator('[data-editar-estacion]').count(),0);
});

test('pinza de dos dedos y búsqueda POI no crean elementos con Estación activa',async t=>{
 const {pagina:p,contexto,solicitudes}=await abrir(t);await herramienta(p,'estaciones');
 const a=await punto(p,700,460), cdp=await contexto.newCDPSession(p);
 const puntos=(delta)=>[{x:a.x-delta,y:a.y,id:0},{x:a.x+delta,y:a.y,id:1}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:puntos(10)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:puntos(40)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await p.locator('.metronet-poi>summary').click();
 await p.getByRole('button',{name:'Buscar punto de interés'}).click();
 await p.getByRole('searchbox').fill('Hospital');
 await p.waitForTimeout(100);assert.equal(solicitudes.length,0);
});

test('una respuesta tardía no vuelve al diseño anterior ni reintenta una escritura incierta',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);let peticiones=0;
 await p.route('**/api/simulaciones/77/estaciones',async route=>{
   peticiones++;await p.waitForFunction(()=>window.liberarRespuesta);
   await route.fulfill({status:503,json:{detail:'No se confirmó la escritura.'},headers:{'access-control-allow-origin':'*'}});
 });
 await herramienta(p,'estaciones');await clic(p,750,480);await p.waitForFunction(()=>editorPrueba.creacionDirecta.pendiente!==null);
 await p.evaluate(()=>{editorPrueba.disenoActual.simulacion.idDiseno=78;editorPrueba.versionContexto++;window.liberarRespuesta=true;});
 await p.waitForFunction(()=>!editorPrueba.creacionDirecta.pendiente);
 assert.equal(await p.evaluate(()=>editorPrueba.idDiseno()),78);assert.equal(peticiones,1);assert.equal(solicitudes.length,0);
});

test('Guardar espera una edición pendiente y conserva el error si la escritura falla',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);
 await p.route('**/api/simulaciones/77/estaciones',async route=>{
   await p.waitForFunction(()=>window.liberarEscritura);
   await route.fulfill({status:400,json:{detail:'Posición no permitida.'},headers:{'access-control-allow-origin':'*'}});
 });
 await herramienta(p,'estaciones');await clic(p,750,480);await p.waitForFunction(()=>editorPrueba.creacionDirecta.pendiente!==null);
 await p.locator('[data-guardar]').click();await p.evaluate(()=>window.liberarEscritura=true);
 await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso && !editorPrueba.creacionDirecta.pendiente);
 assert.equal(solicitudes.some(s=>/guardar|validacion/.test(s.ruta)),false);
 const aviso=p.getByRole('dialog',{name:'Revisá esta acción',exact:true});
 assert.match(await aviso.innerText(),/Posición no permitida/);
 assert.equal(await p.locator('[data-estado-editor] [role=status]').innerText(),'');
});

test('Simular revisa y guarda antes de navegar; la intención se consume una sola vez',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').dblclick();await p.waitForURL('**/simulacion.html?**');
 await abrirTutorialManual(p);
 const tutorial=p.locator('.metronet-recorrido');await tutorial.waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 assert.equal(await tutorial.getByRole('button',{name:'Pausar recorrido'}).count(),0);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 for(let i=0;await tutorial.getAttribute('data-objetivo') !== 'fin' && i<25;i++)await tutorial.getByRole('button',{name:'Siguiente',exact:true}).click();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 await tutorial.waitFor({state:'detached',timeout:5000});
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 const ejecucion=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/simulaciones/77/ejecutar');
 await p.locator('#formularioEjecucion button[type=submit]').click();
 await ejecucion;
 await p.waitForFunction(()=>['En recorrido','Finalizada'].includes(document.querySelector('#estadoTiempoReal')?.textContent));
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
 assert.deepEqual(solicitudes.slice(0,2).map(s=>s.ruta.split('/').at(-1)),['validacion','guardar']);
 await p.reload();await p.locator('#panelSimulacion:not([hidden])').waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
 assert.equal(await p.locator('#formularioEjecucion button[type=submit]').isVisible(),true);
});

async function abrirTutorialManual(p){
 if(await p.locator('.metronet-recorrido').count()) return;
 if(!await p.locator('.metronet-tutorial-simulacion:popover-open').count()) await p.locator('#tutorialPantallaSimulacion').click();
 await p.locator('.metronet-tutorial-simulacion:popover-open').getByRole('button',{name:'Recorrer la pantalla'}).click();
}

async function completarTutorialSimulacion(p){
 if(!await p.locator('.metronet-recorrido').count()) await abrirTutorialManual(p);
 const tutorial=p.locator('.metronet-recorrido');await tutorial.waitFor();
 for(let i=0;await tutorial.getAttribute('data-objetivo') !== 'fin' && i<25;i++)await tutorial.getByRole('button',{name:'Siguiente',exact:true}).click();
 await tutorial.waitFor({state:'detached',timeout:5000});
}

async function demorarProgresoSimulacion(p,t){
 let liberar=()=>{},aviso;
 const solicitado=new Promise(resolve=>{aviso=resolve;});
 await p.route('**/api/juego/progreso',async route=>{
  await new Promise(resolve=>{liberar=resolve;aviso();});
  await route.fallback();
 });
 t.after(()=>liberar());
 return {solicitado,liberar:()=>liberar()};
}

for(const repetido of [false,true])test(`Progreso demorado: Play manual 503 ${repetido?'sin tutorial repetido':'antes del tutorial'} no duplica ejecución`,async t=>{
 const {pagina:p}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 if(repetido)await p.evaluate(()=>localStorage.setItem('metronet:tutorial-pantalla-simulacion:v2:7','presentado'));
 const progreso=await demorarProgresoSimulacion(p,t);
 let intentos=0;
 await p.route('**/api/simulaciones/77/ejecutar',route=>{intentos++;return route.fulfill({status:503,json:{detail:'Error de prueba.'},headers:{'access-control-allow-origin':'*'}});});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await progreso.solicitado;
 await p.locator('#panelSimulacion:not([hidden])').waitFor();
 assert.equal(await p.locator('.metronet-recorrido').count(),0);
 await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
 await p.locator('#mensajeSimulacion.error').filter({hasText:'Error de prueba.'}).waitFor();
 assert.equal(intentos,1);
 const respuesta=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/juego/progreso');
 progreso.liberar();await respuesta;
 if(repetido){
  await p.waitForTimeout(250);
  assert.equal(await p.locator('.metronet-recorrido').count(),0);
 }else{
  assert.equal(await p.locator('.metronet-recorrido').count(),0,'Modo Libre no ofrece tutorial de campaña');
  await completarTutorialSimulacion(p);
 }
 assert.equal(intentos,1,'La intención consumida no reintenta el Play manual fallido');
});

for(const manual of [false,true])test(`Progreso demorado sin tutorial: ${manual?'Play manual no se repite':'espera el Play manual'}`,async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.evaluate(()=>localStorage.setItem('metronet:tutorial-pantalla-simulacion:v2:7','presentado'));
 const progreso=await demorarProgresoSimulacion(p,t);
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');await progreso.solicitado;
 assert.equal(await p.locator('.metronet-recorrido').count(),0);
 if(manual){
  await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
  await p.locator('#pausarSimulacion:not([hidden]):not(:disabled)').waitFor();
  assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
 }
 const respuesta=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/juego/progreso');
 progreso.liberar();await respuesta;
 if(!manual){
  await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('#pausarSimulacion:not([hidden]):not(:disabled)'));
 }
 else await p.waitForTimeout(250);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
});

test('Progreso demorado: salida preservada cancela la intención antes de mostrar tutorial',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 const progreso=await demorarProgresoSimulacion(p,t);
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');await progreso.solicitado;
 await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 progreso.liberar();await p.locator('#tutorialPantallaSimulacion').waitFor();
 await completarTutorialSimulacion(p);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
});

for(const cierre of ['Omitir','Escape'])test(`Simular pendiente: ${cierre} no ejecuta y Play manual ejecuta una vez`,async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await abrirTutorialManual(p);
 const tutorial=p.locator('.metronet-recorrido');await tutorial.waitFor();
 if(cierre==='Omitir')await tutorial.getByRole('button',{name:'Omitir',exact:true}).click();
 else {await tutorial.getByRole('button',{name:'Siguiente',exact:true}).focus();await p.keyboard.press('Escape');}
 await tutorial.waitFor({state:'detached'});
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 await p.locator('#tutorialPantallaSimulacion').click();
 await completarTutorialSimulacion(p);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0,'Repetir el tutorial no ejecuta la intención descartada');
 const ejecutada=p.waitForResponse(r=>r.url().endsWith('/ejecutar')&&r.request().method()==='POST'&&r.ok());
 await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
 await ejecutada;
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
});

test('Play manual durante el tutorial consume la intención diferida',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await abrirTutorialManual(p);await p.locator('.metronet-recorrido').waitFor();
 await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('#pausarSimulacion:not([hidden]):not(:disabled)'));
 await completarTutorialSimulacion(p);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
});

test('Cambiar de diseño durante tutorial descarta la intención anterior y conserva disponible la guía manual',async t=>{
 const {pagina:p,solicitudes,diseno}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await abrirTutorialManual(p);await p.locator('.metronet-recorrido').waitFor();
 await p.route('**/api/simulaciones/78',route=>route.fulfill({json:{...diseno,simulacion:{...diseno.simulacion,idDiseno:78}},headers:{'access-control-allow-origin':'*'}}));
 await p.goto(`${process.env.METRONET_URL_PRUEBAS||'http://127.0.0.1:5173'}/simulacion.html?idDiseno=78`);
 await p.locator('#panelSimulacion:not([hidden])').waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 await abrirTutorialManual(p);await p.locator('.metronet-recorrido').waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
});

test('Salir durante el tutorial y volver desde historial no ejecuta la intención anterior',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await abrirTutorialManual(p);await p.locator('.metronet-recorrido').waitFor();
 await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await completarTutorialSimulacion(p);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
});

test('Error al ejecutar después de completar tutorial no repite el intento',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 let intentos=0;
 await p.route('**/api/simulaciones/77/ejecutar',route=>{intentos++;return route.fulfill({status:503,json:{detail:'Servicio temporalmente indisponible.'},headers:{'access-control-allow-origin':'*'}});});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await completarTutorialSimulacion(p);
 await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
 await p.locator('#mensajeSimulacion.error').waitFor();
 assert.match(await p.locator('#mensajeSimulacion').innerText(),/Servicio temporalmente indisponible/);
 assert.equal(intentos,1);
 await p.reload();await p.locator('#panelSimulacion:not([hidden])').waitFor();
 assert.equal(intentos,1);
 assert.equal(await p.locator('.metronet-recorrido').count(),0);
});

test('Simular rechaza una red no preparada y conserva el editor sin guardar ni navegar',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);
 await p.route('**/api/simulaciones/77/validacion',route=>route.fulfill({json:{valido:true,preparadoParaSimular:false,observacionesSimulacion:['Falta asignar una unidad de metro.']},headers:{'access-control-allow-origin':'*'}}));
 await p.locator('[data-ir-simulacion]').click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 const aviso=p.getByRole('dialog',{name:'Prepará la red para simular',exact:true});
 assert.equal(await aviso.isVisible(),true);
 assert.match(await aviso.innerText(),/Prepará la red para simular/i);
 assert.equal(await aviso.getByRole('button').count(),0);
 assert.doesNotMatch(await aviso.innerText(),/Entendido|Clic fuera|Escape/);
 assert.equal(await aviso.evaluate(d=>getComputedStyle(d).backgroundColor),'rgb(165, 29, 65)');
 assert.doesNotMatch(await p.locator('[data-estado-editor]').innerText(),/Falta asignar/);
 await p.mouse.click(4,4);await aviso.waitFor({state:'hidden'});
 await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-ir-simulacion]'));
 await p.locator('[data-ir-simulacion]').click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.equal(await aviso.isVisible(),true);
 await p.keyboard.press('Escape');await aviso.waitFor({state:'hidden'});
 await p.evaluate(()=>editorPrueba.mostrarAvisoFinalizacion());
 const finalizacion=p.getByRole('dialog',{name:'Completá la consigna para finalizar',exact:true});
 assert.equal(await finalizacion.evaluate(d=>getComputedStyle(d).backgroundColor),'rgb(255, 208, 120)');
 assert.equal(await p.locator('.metronet-dialogo-advertencia').count(),1);
 assert.equal(solicitudes.some(s=>/guardar|ejecutar/.test(s.ruta)),false);assert.equal(new URL(p.url()).pathname,'/');
});

test('seleccionar la línea conserva su identidad y las conexiones existentes sin editar nombres',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);
 await p.evaluate(()=>editorPrueba.seleccionarLineaDesdeLista('Azul'));
 assert.equal(await p.locator('[data-editar-linea]').count(),0);
 assert.equal(await p.locator('[data-linea-gestion]').inputValue(),'Azul');
 assert.equal(await p.locator('[data-linea-conexion]').inputValue(),'Azul');
 assert.equal(await p.evaluate(()=>editorPrueba.disenoActual.lineas[0].nombre),'Azul');
 assert.equal(await p.evaluate(()=>editorPrueba.disenoActual.tramos.some(t=>t.nombreLinea==='Azul')),true);
 assert.equal(solicitudes.length,0);
});

for (const numero of [1,2,3,4,5,6,7,8,9,10]) test(`Guardar nivel ${numero} conserva progreso parcial sin aprobar ni exigir Validar manual`,async t=>{
 const nivel=require('../src/educacion/niveles.json').find(n=>n.numero===numero);
 let guardado=false, evaluaciones=0;
 const {pagina:p,solicitudes}=await abrir(t,{primeraPasada:false,escenario:{...nivel,idEscenario:numero,estado:'EN_DESARROLLO',desbloqueado:true},consigna:()=>({estadoGlobal:'PARCIAL',progreso:guardado?60:0,condiciones:[{clave:'minimoEstaciones',texto:'Ubicar estaciones',actual:guardado?3:0,requerido:5,completado:false}],referenciasObjetivo:[]})});
 const mensajePuntuacion='100 puntos iniciales − 0 de descuentos = 100 puntos. 4 de 5 condiciones satisfechas. Todavía debés cumplir toda la consigna. El tutorial y las prácticas gratuitas no descuentan.';
 await p.route('**/api/juego/disenos/77/evaluar',async route=>{evaluaciones++;await route.fulfill({json:{completado:false,progreso:60,puntaje:100,mensaje:mensajePuntuacion},headers:{'access-control-allow-origin':'*'}});});
 await p.route('**/api/simulaciones/77/guardar', async route=>{guardado=true; await route.fallback();});
 if(await p.locator('.metronet-recorrido').count())await p.locator('[data-recorrido-omitir]').click();
 await p.locator('[data-guardar]').click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.equal(evaluaciones,0);assert.equal(await p.evaluate(()=>editorPrueba.consignaActual.progreso),60);
 assert.doesNotMatch(await p.locator('body').innerText(), /100 puntos iniciales|prácticas gratuitas no descuentan|de descuentos =/);
 assert.deepEqual(solicitudes.filter(s=>/guardar|validacion/.test(s.ruta)).map(s=>s.ruta.split('/').at(-1)),['validacion','guardar']);
 assert.equal(await p.locator('[data-validar]').count(),0);assert.equal(await p.locator('.metronet-victoria').count(),0);
});

for (const width of [1440, 390, 320]) test(`Finalizar red ${width}px: botón visible, guarda y evalúa una vez, conserva objetivos pendientes`, async t=>{
 const nivel=require('../src/educacion/niveles.json')[0];
 const {pagina:p,solicitudes}=await abrir(t,{viewport:{width,height:1000},primeraPasada:false,escenario:{...nivel,idEscenario:1,estado:'EN_DESARROLLO',desbloqueado:true},consigna:()=>({estadoGlobal:'PARCIAL',progreso:80,condiciones:[{clave:'requiereSimulacion',texto:'Simular la red actual',completado:false}],referenciasObjetivo:[]})});
 let evaluaciones=0;
 await p.route('**/api/juego/disenos/77/evaluar',async route=>{evaluaciones++;await route.fulfill({json:{completado:false,puntaje:100,progreso:80,mensaje:'100 puntos iniciales − 0 de descuentos = 100 puntos.'},headers:{'access-control-allow-origin':'*'}});});
 const b=p.getByRole('button',{name:'Finalizar red',exact:true});
 assert.equal(await b.isVisible(),true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await b.click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.equal(evaluaciones,1);
 assert.deepEqual(solicitudes.filter(s=>/guardar|validacion/.test(s.ruta)).map(s=>s.ruta.split('/').at(-1)),['validacion','guardar']);
 const aviso=p.getByRole('dialog',{name:'Completá la consigna para finalizar',exact:true});
 assert.equal(await aviso.isVisible(),true);
 assert.equal(await aviso.locator('[data-mensaje-advertencia]').innerText(),'Revisá los objetivos del nivel y continuá construyendo tu red.');
 assert.doesNotMatch(await aviso.innerText(),/Clic fuera|continuar · Esc|Volver a la red/);
 assert.equal(await aviso.getByRole('button').count(),0);
 assert.doesNotMatch(await aviso.innerText(),/Simular la red actual|100 puntos|descuentos/);
 assert.doesNotMatch(await p.locator('[data-estado-editor]').innerText(),/Red guardada\. Todavía falta/);
 assert.equal(await p.evaluate(()=>editorPrueba.consignaActual.condiciones[0].completado),false);
 const accesibilidad=await aviso.evaluate(d=>({titulo:document.getElementById(d.getAttribute('aria-labelledby'))?.textContent,descripcion:d.getAttribute('aria-describedby')?.split(' ').map(id=>document.getElementById(id)?.textContent).join(' '),enfocado:document.activeElement===d}));
 assert.equal(accesibilidad.titulo,'Completá la consigna para finalizar');
 assert.match(accesibilidad.descripcion,/Revisá los objetivos del nivel/);
 assert.equal(accesibilidad.enfocado,true);
 const limites=await aviso.boundingBox();
 assert.ok(limites.x>=0 && limites.x+limites.width<=width && limites.y>=0 && limites.y+limites.height<=1000);
 assert.equal(await aviso.evaluate(d=>d.scrollWidth>d.clientWidth),false);
 await aviso.locator('h2').click();
 assert.equal(await aviso.isVisible(),true);
 await p.keyboard.press('Escape');await aviso.waitFor({state:'hidden'});
 await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-finalizar-red]'));
 assert.equal(await p.locator('.metronet-resultado-nivel, .metronet-victoria').count(),0);
 assert.equal(await b.isEnabled(),true);
});

test('Finalizar red vacía: guarda sin evaluar, admite reintento y cierra fuera sin crear estaciones',async t=>{
 const nivel={...require('../src/educacion/niveles.json')[0],idEscenario:1,estado:'EN_DESARROLLO',desbloqueado:true};
 const {pagina:p,diseno,solicitudes}=await abrir(t,{primeraPasada:false,escenario:nivel,estaciones:[],lineas:[],tramos:[]});
 diseno.unidadesMetro=[];
 await p.evaluate(()=>editorPrueba.abrirDiseno(77));
 let validaciones=0,evaluaciones=0;
 await p.route('**/api/simulaciones/77/validacion',route=>{validaciones++;return route.fulfill({json:{valido:false,preparadoParaSimular:false,observaciones:['Debe existir al menos una estación.','Debe existir al menos una línea.']},headers:{'access-control-allow-origin':'*'}});});
 await p.route('**/api/juego/disenos/77/evaluar',route=>{evaluaciones++;return route.fulfill({json:{completado:false},headers:{'access-control-allow-origin':'*'}});});
 await herramienta(p,'estaciones');
 const b=p.getByRole('button',{name:'Finalizar red',exact:true});
 await b.evaluate(boton=>{boton.click();boton.click();});
 await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 const aviso=p.getByRole('dialog',{name:'Completá la consigna para finalizar',exact:true});
 assert.equal(await aviso.isVisible(),true);
 assert.equal(validaciones,1);assert.equal(evaluaciones,0);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/guardar')).length,1);
 assert.doesNotMatch(await aviso.innerText(),/Debe existir|estación\.|línea\.|puntos/);
 assert.doesNotMatch(await p.locator('[data-estado-editor]').innerText(),/La red todavía está en construcción/);
 await p.evaluate(()=>{editorPrueba.mostrarAvisoFinalizacion();editorPrueba.mostrarAvisoFinalizacion();});
 assert.equal(await p.locator('.metronet-dialogo-advertencia').count(),1);
 await p.keyboard.press('Escape');await aviso.waitFor({state:'hidden'});
 await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-finalizar-red]'));
 assert.equal(await p.evaluate(()=>editorPrueba.modo),'crearEstacion');
 await b.click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.equal(await aviso.isVisible(),true);
 assert.equal(await p.locator('.metronet-dialogo-advertencia').count(),1);
 const mapa=await p.locator('canvas').boundingBox(), modal=await aviso.boundingBox();
 const fuera={x:mapa.x+mapa.width-16,y:mapa.y+16};
 assert.ok(fuera.x>modal.x+modal.width || fuera.y<modal.y);
 await p.mouse.click(fuera.x,fuera.y);await aviso.waitFor({state:'hidden'});
 await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-finalizar-red]'));
 assert.equal(validaciones,2);assert.equal(evaluaciones,0);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/guardar')).length,2);
 assert.equal(solicitudes.some(s=>s.ruta.endsWith('/estaciones')),false);
 assert.equal(await p.evaluate(()=>editorPrueba.disenoActual.estaciones.length),0);
});

for(const accion of ['cambiar diseño','cerrar editor']) test(`Finalizar red: limpia el aviso al ${accion}`,async t=>{
 const nivel={...require('../src/educacion/niveles.json')[0],idEscenario:1,estado:'EN_DESARROLLO',desbloqueado:true};
 const {pagina:p,diseno}=await abrir(t,{primeraPasada:false,escenario:nivel});
 await p.route('**/api/juego/disenos/77/evaluar',route=>route.fulfill({json:{completado:false},headers:{'access-control-allow-origin':'*'}}));
 await p.locator('[data-finalizar-red]').click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.equal(await p.locator('.metronet-dialogo-advertencia').isVisible(),true);
 if(accion==='cambiar diseño') {
   await p.route('**/api/simulaciones/78',route=>route.fulfill({json:{...diseno,simulacion:{...diseno.simulacion,idDiseno:78}},headers:{'access-control-allow-origin':'*'}}));
   await p.evaluate(()=>editorPrueba.abrirDiseno(78));
 } else await p.evaluate(()=>{editorPrueba.eliminar();editorPrueba.eliminar();});
 assert.equal(await p.locator('.metronet-dialogo-advertencia').count(),0);
});

test('Finalizar red: falla de guardado no evalúa y permite reintentar',async t=>{
 const {pagina:p}=await abrir(t,{primeraPasada:false,escenario:{...require('../src/educacion/niveles.json')[0],idEscenario:1,estado:'EN_DESARROLLO',desbloqueado:true}});
 let evaluaciones=0;
 await p.route('**/api/juego/disenos/77/evaluar',route=>{evaluaciones++;return route.fulfill({json:{completado:false}});});
 await p.route('**/api/simulaciones/77/guardar',route=>route.fulfill({status:503,json:{detail:'Guardado no confirmado'},headers:{'access-control-allow-origin':'*'}}));
 await p.locator('[data-finalizar-red]').click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.equal(evaluaciones,0);assert.match(await p.locator('[data-estado-editor]').innerText(),/Guardado no confirmado/);
 assert.equal(await p.locator('[data-finalizar-red]').isEnabled(),true);
});

test('Modo Libre conserva Guardar y Simular sin Finalizar red',async t=>{
 const {pagina:p}=await abrir(t);
 assert.equal(await p.locator('[data-finalizar-red]').isVisible(),false);
 assert.doesNotMatch(await p.locator('[data-ir-simulacion]').getAttribute('data-ayuda-sistema'),/Finalizar red/);
 assert.equal(await p.locator('[data-guardar]').isVisible(),true);
 assert.equal(await p.locator('[data-ir-simulacion]').isVisible(),true);
});

test('Nivel a Modo Libre: cambiar de diseño no consulta contenido del nivel anterior con el intento nuevo',async t=>{
 const nivel={...require('../src/educacion/niveles.json')[9],idEscenario:10,estado:'EN_DESARROLLO',desbloqueado:true};
 const {pagina:p,diseno}=await abrir(t,{primeraPasada:false,escenario:nivel});
 const libre={...diseno,simulacion:{...diseno.simulacion,idDiseno:78,idEscenario:45,modo:'EDICION_LIBRE'}};
 const consultas=[];
 await p.route('**/api/simulaciones/78',route=>route.fulfill({json:libre,headers:{'access-control-allow-origin':'*'}}));
 p.on('request',req=>{if(req.url().endsWith('/intentos/124/contenido'))consultas.push(req.url());});
 await p.evaluate(async()=>{
  editorPrueba.escenariosJuego.push({idEscenario:45,numero:null,modo:'EDICION_LIBRE',nombre:'Modo Libre',desbloqueado:true});
  history.replaceState({},'','/?idDiseno=78&idEscenario=45&idIntento=124');
  await editorPrueba.abrirDiseno(78);
 });
 assert.deepEqual(consultas,[],'El modo libre no tiene contenido de un nivel publicado');
 assert.equal(await p.evaluate(()=>editorPrueba.panelAyuda.numeroEducativo),null);
 assert.equal(await p.locator('[data-finalizar-red]').isVisible(),false);
});

test('una consigna excedida no bloquea el botón Simular de una red operable',async t=>{
 const nivel=require('../src/educacion/recorrido-integral.json')[0];
 const {pagina:p,solicitudes}=await abrir(t,{primeraPasada:false,
  escenario:{...nivel,idEscenario:1,estado:'EN_DESARROLLO',desbloqueado:true},
  tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}],
  consigna:()=>({estadoGlobal:'PARCIAL',progreso:80,referenciasObjetivo:[],condiciones:[
   {clave:'maximoEstaciones',texto:'Usar como máximo 2 estaciones',actual:3,requerido:2,completado:false},
  ]})});
 assert.equal(await p.locator('[data-ir-simulacion]').isDisabled(),false);
 assert.equal(await p.evaluate(()=>editorPrueba.consignaActual.condiciones[0].completado),false);
 await p.locator('[data-ir-simulacion]').click();
 await p.waitForURL('**/simulacion.html?**');
 await p.locator('#formularioEjecucion').waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/guardar')).length,1);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/evaluar')).length,0);
 assert.equal(await p.locator('.metronet-dialogo-advertencia').count(),0);
});
