const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const progreso = { escenarios: niveles.map(n => ({ ...n, idEscenario: n.numero, estado:'COMPLETADO',desbloqueado:true,progreso:100,mejorPuntaje:95,ultimoPuntaje:90,puntajeMaximo:100,cantidadIntentos:2 })), cantidadNiveles:10,nivelesCompletados:10,campanaCompletada:true,numeroCampanaActual:1 };
const ranking = { jugadores:[{posicion:1,jugador:'Jugador 9',puntajeTotal:980,nivelesCompletados:10,sosVos:false},{posicion:2,jugador:'Jugador 7',puntajeTotal:950,nivelesCompletados:10,sosVos:true}],tuPosicion:2,puntajeTotal:950,puntajeMaximo:1000 };
async function abrir(t, ruta, opciones = {}) {
 const p = await abrirPantalla(navegador,ruta,{...opciones,responder:async req=>{
  if(opciones.responder){const r=await opciones.responder(req);if(r)return r;}
  const path=new URL(req.url()).pathname;
  if(path==='/api/juego/ranking')return {json:ranking};
  if(path==='/api/juego/progreso')return {json:progreso};
 }});
 t.after(()=>p.contexto.close());t.after(()=>assert.deepEqual(p.errores,[]));return p;
}
for(const width of [1440,768,390]) test(`Ranking ${width}: clasificación, tu posición y resumen de diez niveles`,async t=>{
 const {pagina}=await abrir(t,'/ranking.html',{viewport:{width,height:900}});
 await pagina.locator('.ranking-propio').waitFor();
 assert.match(await pagina.locator('#resumenPuntaje').innerText(),/950 \/ 1000.*Tu posición: 2/);
 assert.equal(await pagina.locator('#puntajesPorNivel > li').count(),10);
 assert.equal(await pagina.locator('.metronet-logo__imagen').count(),1);
 assert.equal(await pagina.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.doesNotMatch(await pagina.locator('#clasificacionRanking').innerText(),/@example|apellido|email/);
});
test('Ranking: error recuperable y navegación desde el juego',async t=>{
 let falla=true;
 const {pagina}=await abrir(t,'/inicio.html',{responder:async req=>req.url().endsWith('/ranking')&&falla?{status:503,json:{}}:null});
 await pagina.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Ranking',exact:true}).click();
 await pagina.locator('#reintentarRanking:not([hidden])').waitFor();falla=false;
 await pagina.locator('#reintentarRanking').click();await pagina.locator('.ranking-propio').waitFor();
});
test('Administrador: todos disponibles sin fingir completados y ranking no competitivo',async t=>{
 const libre={idEscenario:11,numero:null,nombre:'Modo Libre',estado:'DISPONIBLE',desbloqueado:true,herramientasHabilitadas:{}};
 const admin={...progreso,campanaCompletada:false,nivelesCompletados:0,modoLibreDesbloqueado:true,escenarios:[...progreso.escenarios.map(n=>({...n,estado:'DISPONIBLE',progreso:0,mejorPuntaje:null,cantidadIntentos:0})),libre]};
 const {pagina}=await abrir(t,'/admin.html',{responder:async req=>req.url().endsWith('/progreso')?{json:admin}:null});
 await pagina.goto('http://127.0.0.1:5173/escenarios.html');
 await pagina.getByRole('button',{name:'Entrar al Modo Libre',exact:true}).waitFor();
 assert.equal(await pagina.getByRole('button',{name:'Comenzar',exact:true}).count(),10);
 assert.match(await pagina.locator('#descripcionProgresoEscenarios').innerText(),/0 de 10/);
 await pagina.goto('http://127.0.0.1:5173/ranking.html');
 await pagina.getByText(/Esta cuenta no participa en el ranking/).waitFor();
});
for(const resuelta of [false,true]) test(`Simulación: red resuelta ${resuelta}, km/h, estimaciones y guardado mediante API existente`,async t=>{
 let velocidad=90;
 const red=()=>({simulacion:{idDiseno:77,idEscenario:6,nombre:'Movilidad entre zonas',modo:'NIVEL',estado:'VALIDADO'},estaciones:[{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],lineas:[{nombre:'Azul'}],tramos:[{nombreLinea:'Azul',estacionA:'A',estacionB:'B'}],unidadesMetro:[{idTren:1,nombreLinea:'Azul',capacidad:300,velocidadPromedio:velocidad}],preparadoParaSimular:true,territorio:{areas:[],errores:[]},resultados:[]});
 const {pagina,solicitudes}=await abrir(t,'/simulacion.html?idDiseno=77',{viewport:{width:resuelta?390:1440,height:900},responder:async req=>{
  const path=new URL(req.url()).pathname;
  if(path==='/api/simulaciones')return {json:[red().simulacion]};
  if(path==='/api/simulaciones/77')return {json:red()};
  if(path.endsWith('/desempeno'))return {json:{puntaje:resuelta?90:0,puntajeMaximo:100,redResuelta:resuelta,etapa:resuelta?'VELOCIDAD':'RED',explicacion:'Primero resolvé la red. Meta didáctica: 45 km/h ± 15.',unidades:[{idTren:1,linea:'Azul',velocidadKmh:velocidad,distanciaKm:15,tiempoMinutos:900/velocidad}]}};
  if(path.endsWith('/unidades/1')){velocidad=req.postDataJSON().velocidadPromedio;return {status:204};}
  if(path.endsWith('/validacion'))return {json:{valido:true,preparadoParaSimular:true,observaciones:[]}};
 }});
 const campo=pagina.getByRole('spinbutton',{name:'Velocidad del metro 1 en km/h',exact:true});await campo.waitFor();
 assert.equal(await pagina.locator('#desempenoNivel').evaluate(e=>getComputedStyle(e).display),'grid');
 assert.ok(await campo.evaluate(e=>e.getBoundingClientRect().height>=40));
 assert.equal(await pagina.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await campo.isDisabled(),!resuelta);
 await pagina.getByText(/15.00 km · 10.0 min estimados a 90 km\/h/).waitFor();
 assert.match(await pagina.locator('#formularioEjecucion').innerText(),/Ritmo de reproducción \(×\)/);
 if(resuelta){
  await campo.fill('45');await pagina.getByRole('button',{name:'Aplicar km/h',exact:true}).click();
  await pagina.getByText(/15.00 km · 20.0 min estimados a 45 km\/h/).waitFor();
  assert.deepEqual(solicitudes.find(s=>s.method==='PATCH').body,{nombreLinea:'Azul',capacidad:300,velocidadPromedio:45});
  assert.ok(solicitudes.some(s=>s.path.endsWith('/validacion')));
 }
});
test('Cierre global presenta puntos por nivel, máximo y posición sin crear otro intento',async t=>{
 const {pagina,solicitudes}=await abrir(t,'/escenarios.html');
 await pagina.evaluate(async({progreso})=>{
  const {presentarResultadoNivel}=await import('/src/educacion/TransicionNivel.js');
  void presentarResultadoNivel(progreso,10,{completado:true,puntaje:90,idSiguienteEscenario:null,desempeno:{puntajeMaximo:100,explicacion:'Red correcta. Existe margen para optimizar la velocidad.'}});
 },{progreso});
 await pagina.getByRole('dialog').waitFor();
 assert.match(await pagina.getByRole('dialog').innerText(),/950 \/ 1000 puntos.*Tu posición: 2/s);
 assert.match(await pagina.getByRole('dialog').innerText(),/Puntaje del intento:\s+90 \/ 100/);
 await pagina.getByRole('link',{name:'Ver mi desempeño y ranking',exact:true}).click();await pagina.waitForURL('**/ranking.html');
 assert.equal(solicitudes.filter(s=>s.method==='POST').length,0);
});
test('Simulación finalizada presenta el puntaje evaluado en el mensaje y el historial',async t=>{
 const desempeno={puntaje:90,puntajeMaximo:100,redResuelta:true,velocidadCumplida:true,simulacionActual:true,etapa:'LISTO',explicacion:'Red resuelta. Ajuste de velocidad: 0/10.',unidades:[{idTren:1,linea:'Azul',velocidadKmh:60,distanciaKm:15,tiempoMinutos:15}]};
 const resultado={idSimulacion:2,puntaje:0,estado:'COMPLETADA',duracion:10,velocidad:4,comentarios:'Circulación estimada a 60 km/h.'};
 const red={simulacion:{idDiseno:77,idEscenario:6,nombre:'Movilidad entre zonas',modo:'NIVEL',estado:'VALIDADO'},estaciones:[{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],lineas:[{nombre:'Azul'}],tramos:[{nombreLinea:'Azul',estacionA:'A',estacionB:'B'}],unidadesMetro:[{idTren:1,nombreLinea:'Azul',capacidad:300,velocidadPromedio:60}],preparadoParaSimular:true,territorio:{areas:[],errores:[]},resultados:[]};
 const {pagina}=await abrir(t,'/simulacion.html?idDiseno=77',{responder:async req=>{
  const path=new URL(req.url()).pathname;
  if(path==='/api/simulaciones')return {json:[red.simulacion]};
  if(path==='/api/simulaciones/77')return {json:red};
  if(path.endsWith('/desempeno'))return {json:desempeno};
  if(path.endsWith('/ejecutar')){red.resultados=[resultado];return {json:resultado};}
  if(path.endsWith('/evaluar'))return {json:{completado:true,puntaje:90,progreso:100,desempeno,mensaje:desempeno.explicacion}};
 }});
 await pagina.locator('#duracionSimulacion').fill('10');
 await pagina.locator('[data-velocidad="4"]').click();
 await pagina.locator('#formularioEjecucion button[type="submit"]').click();
 await pagina.getByRole('dialog').waitFor();
 assert.match(await pagina.locator('#mensajeSimulacion').innerText(),/90 \/ 100 puntos/);
 assert.match(await pagina.locator('#listaResultadosSimulacion').innerText(),/COMPLETADA · 90 puntos/);
 assert.match(await pagina.getByRole('dialog').innerText(),/Puntaje del intento:\s+90 \/ 100/);
});
