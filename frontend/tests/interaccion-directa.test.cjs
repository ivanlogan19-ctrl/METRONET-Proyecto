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
 assert.match(await p.locator('.metronet-editor-red').innerText()+await p.locator('body').innerText(),/Diseño guardado/);
 assert.equal(solicitudes.some(s=>s.ruta.endsWith('/evaluar')),false);
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
 assert.match(await p.locator('[data-estado-editor]').innerText(),/Posición no permitida/);
});

test('Simular revisa y guarda antes de navegar; la intención se consume una sola vez',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').dblclick();await p.waitForURL('**/simulacion.html?**');
 const tutorial=p.locator('.metronet-recorrido');await tutorial.waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 await tutorial.getByRole('button',{name:'Pausar recorrido'}).click();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 await p.locator('#tutorialPantallaSimulacion').click();
 for(let i=0;i<8;i++)await tutorial.getByRole('button',{name:'Siguiente',exact:true}).click();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 const ejecucion=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/simulaciones/77/ejecutar');
 await tutorial.getByRole('button',{name:'Comenzar',exact:true}).evaluate(b=>{b.click();b.click();});
 await ejecucion;
 await p.waitForFunction(()=>['En recorrido','Finalizada'].includes(document.querySelector('#estadoTiempoReal')?.textContent));
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
 assert.deepEqual(solicitudes.slice(0,2).map(s=>s.ruta.split('/').at(-1)),['validacion','guardar']);
 await p.reload();await p.locator('#panelSimulacion:not([hidden])').waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
 assert.equal(await p.locator('#formularioEjecucion button[type=submit]').isVisible(),true);
});

async function completarTutorialSimulacion(p){
 const tutorial=p.locator('.metronet-recorrido');await tutorial.waitFor();
 for(let i=0;i<8;i++)await tutorial.getByRole('button',{name:'Siguiente',exact:true}).click();
 await tutorial.getByRole('button',{name:'Comenzar',exact:true}).click();
 await tutorial.waitFor({state:'detached'});
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
  await p.locator('.metronet-recorrido').waitFor();
  await completarTutorialSimulacion(p);
 }
 assert.equal(intentos,1,'La intención consumida no reintenta el Play manual fallido');
});

for(const manual of [false,true])test(`Progreso demorado sin tutorial: ${manual?'Play manual no se repite':'intención ejecuta una vez'}`,async t=>{
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
 if(!manual)await p.locator('#pausarSimulacion:not([hidden]):not(:disabled)').waitFor();
 else await p.waitForTimeout(250);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
});

test('Progreso demorado: salida preservada cancela la intención antes de mostrar tutorial',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 const progreso=await demorarProgresoSimulacion(p,t);
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');await progreso.solicitado;
 await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 progreso.liberar();await p.locator('.metronet-recorrido').waitFor();
 await completarTutorialSimulacion(p);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
});

for(const cierre of ['Omitir','Escape'])test(`Simular pendiente: ${cierre} no ejecuta y Play manual ejecuta una vez`,async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 const tutorial=p.locator('.metronet-recorrido');await tutorial.waitFor();
 if(cierre==='Omitir')await tutorial.getByRole('button',{name:'Omitir',exact:true}).click();
 else {await tutorial.getByRole('button',{name:'Siguiente',exact:true}).focus();await p.keyboard.press('Escape');}
 await tutorial.waitFor({state:'detached'});
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 await p.locator('#tutorialPantallaSimulacion').click();
 await completarTutorialSimulacion(p);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0,'Repetir el tutorial no ejecuta la intención descartada');
 await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('#pausarSimulacion:not([hidden]):not(:disabled)'));
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
});

test('Play manual durante el tutorial consume la intención diferida',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await p.locator('.metronet-recorrido').waitFor();
 await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('#pausarSimulacion:not([hidden]):not(:disabled)'));
 await completarTutorialSimulacion(p);
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
});

test('Cambiar de diseño durante tutorial descarta la intención anterior',async t=>{
 const {pagina:p,solicitudes,diseno}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await p.locator('.metronet-recorrido').waitFor();
 await p.route('**/api/simulaciones/78',route=>route.fulfill({json:{...diseno,simulacion:{...diseno.simulacion,idDiseno:78}},headers:{'access-control-allow-origin':'*'}}));
 await p.goto(`${process.env.METRONET_URL_PRUEBAS||'http://127.0.0.1:5173'}/simulacion.html?idDiseno=78`);
 await p.locator('#panelSimulacion:not([hidden])').waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,0);
 assert.equal(await p.locator('.metronet-recorrido').count(),0);
});

test('Salir durante el tutorial y volver desde historial no ejecuta la intención anterior',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,{tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Azul',estacionA:'Parque',estacionB:'Este'}]});
 await p.locator('[data-ir-simulacion]').click();await p.waitForURL('**/simulacion.html?**');
 await p.locator('.metronet-recorrido').waitFor();
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
 assert.match(await p.locator('[data-estado-editor]').innerText(),/Falta asignar/);
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

for (const numero of [1,2,3,4,5,6,7,8,9,10]) test(`Guardar nivel ${numero} evalúa y actualiza progreso parcial sin Validar manual`,async t=>{
 const nivel=require('../src/educacion/niveles.json').find(n=>n.numero===numero);
 let evaluado=false, evaluaciones=0;
 const {pagina:p,solicitudes}=await abrir(t,{primeraPasada:false,escenario:{...nivel,idEscenario:numero,estado:'EN_DESARROLLO',desbloqueado:true},consigna:()=>({estadoGlobal:'PARCIAL',progreso:evaluado?60:0,condiciones:[{clave:'minimoEstaciones',texto:'Ubicar estaciones',actual:evaluado?3:0,requerido:5,completado:false}],referenciasObjetivo:[]})});
 await p.route('**/api/juego/disenos/77/evaluar',async route=>{evaluado=true;evaluaciones++;await route.fulfill({json:{completado:false,progreso:60,puntaje:60,mensaje:'Faltan estaciones para completar la consigna.'},headers:{'access-control-allow-origin':'*'}});});
 await p.locator('[data-guardar]').click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.equal(evaluaciones,1);assert.equal(await p.evaluate(()=>editorPrueba.consignaActual.progreso),60);
 assert.deepEqual(solicitudes.filter(s=>/guardar|validacion/.test(s.ruta)).map(s=>s.ruta.split('/').at(-1)),['validacion','guardar']);
 assert.equal(await p.locator('[data-validar]').count(),0);assert.equal(await p.locator('.metronet-victoria').count(),0);
});
