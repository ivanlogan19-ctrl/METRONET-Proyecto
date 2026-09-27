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

test('transbordo exige bandera y dos líneas; se habilita en el intento en edición',async t=>{
 const escenario={idEscenario:7,numero:7,nombre:'Transbordos',estado:'EN_DESARROLLO',progreso:0,desbloqueado:true,herramientasHabilitadas:{estaciones:true,lineas:true,metros:true,conexiones:true,simulacion:true}};
 const {pagina:p,solicitudes}=await abrir(t,{escenario,lineas:[{nombre:'Azul'},{nombre:'Rosa'}],tramos:[{nombreLinea:'Azul',estacionA:'Centro',estacionB:'Parque'},{nombreLinea:'Rosa',estacionA:'Centro',estacionB:'Este'}]});
 assert.equal(await p.evaluate(()=>editorPrueba.capaRedMetro.esTransbordo(editorPrueba.disenoActual.estaciones[0])),false);
 assert.equal(await p.locator('[data-elegir-herramienta=transbordos]').count(),0);
 await clic(p,580,470);await p.locator('[data-editar-estacion]').click();
 await p.getByLabel('Permite transbordo',{exact:true}).check();await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();
 await p.waitForFunction(()=>editorPrueba.disenoActual.estaciones[0].transbordo);
 assert.equal(await p.evaluate(()=>editorPrueba.capaRedMetro.esTransbordo(editorPrueba.disenoActual.estaciones[0])),true);
 assert.equal(solicitudes[0].metodo,'PATCH');
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

for(const numero of [1,2,3,4,5,6,7,8,9,10]) test(`nivel ${numero}: conserva disponibilidad e iconos y permite inspector de intento activo`,async t=>{
 const nivel=require('../src/educacion/niveles.json').find(n=>n.numero===numero);
 const {pagina:p}=await abrir(t,{escenario:{...nivel,idEscenario:numero,desbloqueado:true,estado:'EN_DESARROLLO'}});
 for(const clave of ['estaciones','lineas','conexiones','metros']) assert.equal(await p.locator(`[data-elegir-herramienta="${clave}"]`).isDisabled(),nivel.herramientasHabilitadas[clave]===false);
 assert.equal(await p.locator('[data-ir-simulacion]').isDisabled(),nivel.herramientasHabilitadas.simulacion===false);
 await clic(p,810,480);assert.equal(await p.locator('[data-editar-estacion]').isVisible(),true);
});

test('pinza de dos dedos y controles del HUD no crean elementos con Estación activa',async t=>{
 const {pagina:p,contexto,solicitudes}=await abrir(t);await herramienta(p,'estaciones');
 const a=await punto(p,700,460), cdp=await contexto.newCDPSession(p);
 const puntos=(delta)=>[{x:a.x-delta,y:a.y,id:0},{x:a.x+delta,y:a.y,id:1}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:puntos(10)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:puntos(40)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await p.locator('.metronet-hud>summary').click();
 await p.locator('[data-hud-vista=controles]').click();
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
 await p.locator('#pausarSimulacion:not([hidden]):not(:disabled)').waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
 assert.deepEqual(solicitudes.slice(0,2).map(s=>s.ruta.split('/').at(-1)),['validacion','guardar']);
 await p.reload();await p.locator('#panelSimulacion:not([hidden])').waitFor();
 assert.equal(solicitudes.filter(s=>s.ruta.endsWith('/ejecutar')).length,1);
 assert.equal(await p.locator('#formularioEjecucion button[type=submit]').isVisible(),true);
});

test('Simular rechaza una red no preparada y conserva el editor sin guardar ni navegar',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);
 await p.route('**/api/simulaciones/77/validacion',route=>route.fulfill({json:{valido:true,preparadoParaSimular:false,observacionesSimulacion:['Falta asignar una unidad de metro.']},headers:{'access-control-allow-origin':'*'}}));
 await p.locator('[data-ir-simulacion]').click();await p.waitForFunction(()=>!editorPrueba.finalizacionEnCurso);
 assert.match(await p.locator('[data-estado-editor]').innerText(),/Falta asignar/);
 assert.equal(solicitudes.some(s=>/guardar|ejecutar/.test(s.ruta)),false);assert.equal(new URL(p.url()).pathname,'/');
});

test('renombrar la línea activa no deja conexiones apuntando al nombre anterior',async t=>{
 const {pagina:p,solicitudes}=await abrir(t);
 await p.evaluate(()=>editorPrueba.seleccionarLineaDesdeLista('Azul'));
 await p.locator('[data-editar-linea]').click();await p.getByLabel('Nombre de la línea',{exact:true}).fill('Nueva identidad');
 await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();
 await p.waitForFunction(()=>!editorPrueba.creacionDirecta.pendiente && editorPrueba.disenoActual.lineas[0].nombre==='Nueva identidad');
 await herramienta(p,'conexiones');await clic(p,700,460);
 assert.equal(solicitudes.length,1);assert.equal(await p.locator('[data-linea-conexion]').inputValue(),'');
 assert.match(await p.locator('[data-estado-editor]').innerText(),/línea activa/);
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
