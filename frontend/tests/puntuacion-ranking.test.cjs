const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const progreso = { escenarios: niveles.map(n => ({ ...n, idEscenario: n.numero, estado:'COMPLETADO',desbloqueado:true,progreso:100,mejorPuntaje:95,ultimoPuntaje:90,puntajeMaximo:100,cantidadIntentos:2 })), cantidadNiveles:10,nivelesCompletados:10,campanaCompletada:true,numeroCampanaActual:1 };
const ranking = { jugadores:[{posicion:1,jugador:'Bruno Silva',puntajeTotal:980,nivelesCompletados:10,sosVos:false},{posicion:2,jugador:'Ana Prueba',puntajeTotal:950,nivelesCompletados:10,sosVos:true}],tuPosicion:2,puntajeTotal:950,puntajeMaximo:1000 };
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
 assert.equal(await pagina.locator('.metronet-logo__imagen').count(),0);
 assert.equal(await pagina.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.match(await pagina.locator('#clasificacionRanking').innerText(),/Bruno Silva.*Ana Prueba/s);
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
 await pagina.goto(`${BASE}/escenarios.html`);
 await pagina.getByRole('button',{name:'Entrar al Modo Libre',exact:true}).waitFor();
 assert.equal(await pagina.getByRole('button',{name:'Comenzar',exact:true}).count(),10);
 assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta--disponible').count(),11);
 await pagina.goto(`${BASE}/ranking.html`);
 await pagina.getByText(/Esta cuenta no participa en el ranking/).waitFor();
});
for(const resuelta of [false,true]) test(`Simulación: red resuelta ${resuelta}, UV, horas simuladas y guardado mediante API existente`,async t=>{
 let velocidad=90;
 const red=()=>({simulacion:{idDiseno:77,idEscenario:6,nombre:'Movilidad entre zonas',modo:'NIVEL',estado:'VALIDADO'},estaciones:[{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],lineas:[{nombre:'Azul'}],tramos:[{nombreLinea:'Azul',estacionA:'A',estacionB:'B'}],unidadesMetro:[{idTren:1,nombreLinea:'Azul',capacidad:300,velocidadPromedio:velocidad}],preparadoParaSimular:true,territorio:{areas:[],errores:[]},resultados:[]});
 const {pagina,solicitudes}=await abrir(t,'/simulacion.html?idDiseno=77',{viewport:{width:resuelta?390:1440,height:900},responder:async req=>{
  const path=new URL(req.url()).pathname;
  if(path==='/api/simulaciones')return {json:[red().simulacion]};
  if(path==='/api/simulaciones/77')return {json:red()};
  if(path.endsWith('/desempeno'))return {json:{puntaje:resuelta?90:0,puntajeMaximo:100,redResuelta:resuelta,etapa:resuelta?'VELOCIDAD':'RED',explicacion:'Primero resolvé la red. Compará ejecuciones con distintas UV.',unidades:[{idTren:1,linea:'Azul',velocidad:velocidad,tramos:3}]}};
  if(path.endsWith('/unidades/1')){velocidad=req.postDataJSON().velocidadPromedio;return {status:204};}
  if(path.endsWith('/validacion'))return {json:{valido:true,preparadoParaSimular:true,observaciones:[]}};
 }});

 const campo=pagina.getByRole('spinbutton',{name:'Velocidad en UV',exact:true});await campo.waitFor();
 assert.equal(await pagina.locator('.simulacion-grupo-metros').isVisible(),true);
 assert.ok(await campo.evaluate(e=>e.getBoundingClientRect().height>=40));
 assert.equal(await pagina.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await campo.isDisabled(),!resuelta);
 assert.equal(await campo.inputValue(),'90');
 assert.match(await pagina.locator('.simulacion-ritmo').innerText(),/Ritmo visual/);
 if(resuelta){
  await campo.fill('45');await pagina.getByRole('button',{name:'Aplicar velocidad',exact:true}).click();
  await pagina.waitForFunction(()=>document.getElementById('velocidadUnidad').value==='45' && !document.querySelector('[data-controles-circulacion]').disabled);
  assert.deepEqual(solicitudes.find(s=>s.method==='PATCH').body,{nombreLinea:'Azul',capacidad:300,velocidadPromedio:45});
  assert.equal(solicitudes.filter(s=>s.method==='PATCH').length,1); // Preflight al pulsar Simular, sin validación manual adicional.
 }
});
test('Cierre global presenta puntos por nivel, máximo y posición sin crear otro intento',async t=>{
 const {pagina,solicitudes}=await abrir(t,'/escenarios.html');
 await pagina.evaluate(async({progreso})=>{
  const {presentarResultadoNivel}=await import('/src/educacion/TransicionNivel.js');
  window.cierre = presentarResultadoNivel(progreso,10,{completado:true,puntaje:90,idSiguienteEscenario:null,desempeno:{puntajeMaximo:100,explicacion:'Red correcta. Existe margen para optimizar la velocidad.'}});
 },{progreso});
 await pagina.locator('.metronet-resultado-nivel').waitFor();
 assert.match(await pagina.locator('.metronet-resultado-nivel').innerText(),/Ganaste\s+90\s+puntos/);
 await pagina.locator('.metronet-resultado-nivel').getByRole('button',{name:'Continuar',exact:true}).click();
 await pagina.getByRole('button',{name:'Ver desempeño y ranking',exact:true}).waitFor({timeout:26000});
 assert.match(await pagina.getByRole('dialog').innerText(),/950 \/ 1000 puntos.*Tu posición: 2/s);
 assert.equal(await pagina.locator('.metronet-victoria__resultado').count(),0);
 await pagina.getByRole('button',{name:'Ver desempeño y ranking',exact:true}).click();
 assert.deepEqual(await pagina.evaluate(()=>window.cierre),{destino:'/ranking.html'});
 assert.equal(solicitudes.filter(s=>s.method==='POST').length,0);
});
for (const [puntos, completado] of [[100, true], [75, false], [100, false]]) test(`Simulación finalizada: ${puntos} puntos, consigna ${completado ? 'completa' : 'pendiente'}, aprobación reservada a Finalizar red`,async t=>{
 const desempeno={puntaje:puntos,puntajeMaximo:100,redResuelta:true,velocidadCumplida:true,simulacionActual:true,etapa:'LISTO',explicacion:`${completado ? 4 : 3} de 4 criterios satisfechos.`,unidades:[{idTren:1,linea:'Azul',velocidad:6,tramos:3}]};
 const resultado={idSimulacion:2,puntaje:0,estado:'COMPLETADA',duracion:1,velocidad:1,escala:'UV_H_V1',unidades:[{idTren:1,velocidad:6}],comentarios:'6 UV durante 1 h simulada.'};
 const red={simulacion:{idDiseno:77,idEscenario:6,nombre:'Movilidad entre zonas',modo:'NIVEL',estado:'VALIDADO'},estaciones:[{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],lineas:[{nombre:'Azul'}],tramos:[{nombreLinea:'Azul',estacionA:'A',estacionB:'B'}],unidadesMetro:[{idTren:1,nombreLinea:'Azul',capacidad:300,velocidadPromedio:60}],preparadoParaSimular:true,territorio:{areas:[],errores:[]},resultados:[]};
 const {pagina,solicitudes}=await abrir(t,'/simulacion.html?idDiseno=77',{responder:async req=>{
  const path=new URL(req.url()).pathname;
  if(path==='/api/simulaciones')return {json:[red.simulacion]};
  if(path==='/api/simulaciones/77')return {json:red};
  if(path.endsWith('/desempeno'))return {json:desempeno};
  if(path.endsWith('/consigna'))return {json:{estadoGlobal:completado?'LISTO':'PARCIAL',condiciones:[],referenciasObjetivo:[]}};
  if(path.endsWith('/ejecutar')){red.resultados=[resultado];return {json:resultado};}
  if(path.endsWith('/evaluar'))return {json:{completado,puntaje:puntos,progreso:completado ? 100 : 75,desempeno,mensaje:desempeno.explicacion}};
 }});

 assert.equal(await pagina.locator('.metronet-recorrido').count(),0,'Nivel 6 reutiliza herramientas, sin repetir el tutorial completo');
 await pagina.locator('#duracionSimulacion').fill('1');
 assert.equal(await pagina.locator('[data-paso-ritmo="1"]').isVisible(), false);
 await pagina.locator('#formularioEjecucion button[type="submit"]').click();
 await pagina.waitForFunction(() => document.querySelector('#estadoTiempoReal')?.textContent === 'Finalizada');
 await pagina.waitForFunction(completado => document.querySelector('#mensajeSimulacion')?.textContent.includes(completado ? 'Finalizar red' : 'objetivos pendientes'), completado);
 assert.equal(await pagina.locator('#seccionResultados, #listaResultadosSimulacion').count(), 0);
 assert.equal(await pagina.getByRole('dialog').count(), 0);
 assert.equal(solicitudes.filter(s=>s.path.endsWith('/evaluar')).length,0);
 assert.equal(solicitudes.filter(s=>s.path.endsWith('/ejecutar')).length,1);
 assert.doesNotMatch(await pagina.locator('#mensajeSimulacion').textContent(),/Nivel aprobado|Ganaste|Puntaje posible/);
});
