const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirEditor}=require('./soporte/editor.cjs');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let navegador;
before(async()=>{navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(async()=>{await navegador?.close();});
async function simulador(t){
 const v=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{responder:r=>new URL(r.url()).pathname.endsWith('/desempeno')?{json:{puntajeMaximo:100,puntaje:0,unidades:[{idTren:1,tiempoMinutos:15,distanciaKm:10,velocidadKmh:40}]}}:null});t.after(()=>v.contexto.close());t.after(()=>assert.deepEqual(v.errores,[]));
 await v.pagina.route('**/src/simulacion/EscenaSimulacion.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('resolver({ escena: this, destruir });','window.escenaEstabilidad=this; window.destruirVisorEstabilidad=destruir; resolver({ escena: this, destruir });')});});
 await v.pagina.reload();await v.pagina.waitForFunction(()=>window.escenaEstabilidad?.disenoActual?.metricasUnidades?.length);await v.pagina.waitForFunction(()=>document.querySelector('audio[data-musica-metronet]')?.getAttribute('src')==='/audio/simulacion-theme.mp3');return v;
}
test('Editor: un aviso de posición sin cambio de tamaño conserva objetos y cámara',async t=>{
 const v=await abrirEditor(navegador);t.after(()=>v.contexto.close());
 const r=await v.pagina.evaluate(()=>{const s=juegoPrueba.scene.getScene('MapaScene'),c=s.cameras.main;const antes=[c.scrollX,c.scrollY,c.zoom];let dibujos=0;const dibujar=s.capaBarrios.dibujar;s.capaBarrios.dibujar=function(...a){dibujos++;return dibujar.apply(this,a)};const objetos=[...s.children.list];for(let i=0;i<20;i++)s.scale.refresh();return{dibujos,mismaCamara:JSON.stringify(antes)===JSON.stringify([c.scrollX,c.scrollY,c.zoom]),mismosObjetos:objetos.every((o,i)=>o===s.children.list[i])};});
 assert.deepEqual(r,{dibujos:0,mismaCamara:true,mismosObjetos:true});assert.deepEqual(v.errores,[]);
});
test('Simulación en pausa: no reconstruye recorridos, posiciones ni notifica HUD por cuadro',async t=>{
 const {pagina:p}=await simulador(t);
 const r=await p.evaluate(()=>{const s=escenaEstabilidad;s.iniciarAnimacion(1,60);s.pausarAnimacion();let movimientos=0,avisos=0;const mover=s.capaRedMetro.actualizarRepresentacionSimulacion;s.capaRedMetro.actualizarRepresentacionSimulacion=function(...a){movimientos++;return mover.apply(this,a)};s.alActualizarEstado=()=>avisos++;for(let i=0;i<100;i++)s.update(s.time.now+i*17,17);return{movimientos,avisos};});
 assert.deepEqual(r,{movimientos:0,avisos:0});
});
test('Simulador: red visible y geometría actualizada al mostrar el panel y cambiar su tamaño',async t=>{
 const {pagina:p}=await simulador(t);
 for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:1440,height:900}]){
  await p.setViewportSize(viewport);
  await p.waitForFunction(()=>{const s=escenaEstabilidad,c=s.game.canvas,r=c.parentElement.getBoundingClientRect();return Math.abs(c.width-r.width)<2&&Math.abs(c.height-r.height)<2});
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const r=await p.evaluate(()=>{const s=escenaEstabilidad,red=s.capaRedMetro,c=s.cameras.main;return{limites:red.obtenerLimitesEstaciones(),visibles:red.puntosEstaciones.map(p=>c.worldView.contains(p.x,p.y)),puntos:red.puntosEstaciones.length};});
  assert.equal(r.puntos,3);assert.ok(r.visibles.every(Boolean),JSON.stringify(r));
 }
});
test('Destruir el visor libera controles externos y listeners propios de la escena',async t=>{
 const {pagina:p}=await simulador(t);
 const r=await p.evaluate(async()=>{const s=escenaEstabilidad;let limpiezas=0;const quitar=s.referenciasGeograficas.eliminar.bind(s.referenciasGeograficas);s.referenciasGeograficas.eliminar=()=>{limpiezas++;quitar()};destruirVisorEstabilidad();await new Promise(resolve=>setTimeout(resolve,100));return{limpiezas,canvas:document.querySelectorAll('#visorSimulacion canvas').length};});
 assert.deepEqual(r,{limpiezas:1,canvas:0});
});
test('Visor oculto: volver al mismo tamaño reconstruye la red cargada mientras estaba oculto',async t=>{
 const {pagina:p}=await simulador(t);
 await p.evaluate(()=>{document.getElementById('panelSimulacion').hidden=true;});
 await p.waitForFunction(()=>escenaEstabilidad.scale.width===0);
 await p.evaluate(()=>{escenaEstabilidad.establecerDiseno(escenaEstabilidad.disenoActual);document.getElementById('panelSimulacion').hidden=false;});
 await p.waitForFunction(()=>{const s=escenaEstabilidad;return s.scale.width>0&&s.capaRedMetro.puntosEstaciones.length===3&&s.capaRedMetro.puntosEstaciones.every(p=>s.cameras.main.worldView.contains(p.x,p.y));});
});
test('Historial conservado: simulador sobrevive a pagehide/pageshow y mantiene el recorrido',async t=>{
 const {pagina:p}=await simulador(t);
 const r=await p.evaluate(async()=>{const s=escenaEstabilidad;s.iniciarAnimacion(1,60);s.motorSimulacion.progreso=.3;s.motorSimulacion.tiempoAcumulado=.3;
 dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));await new Promise(resolve=>setTimeout(resolve,150));
 const conservado=s.game.canvas.isConnected;dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return{conservado,estado:s.motorSimulacion?.estado,progreso:s.motorSimulacion?.progreso};});
 assert.equal(r.conservado,true);assert.equal(r.estado,'EN_CURSO');assert.ok(r.progreso>=.3&&r.progreso<.34,JSON.stringify(r));
});

test('Diseño libre propio: conserva instrucciones sin consultar una consigna de campaña inexistente',async t=>{
 const v=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{responder:r=>new URL(r.url()).pathname==='/api/simulaciones/77'?{json:{simulacion:{idDiseno:77,idEscenario:999,modo:'EDICION_LIBRE',nombre:'Libre propio',objetivo:'Planificar una red propia'},estaciones:[],lineas:[],tramos:[],unidadesMetro:[],resultados:[],territorio:{areas:[],errores:[]}}}:null});t.after(()=>v.contexto.close());
 await v.pagina.waitForFunction(()=>document.querySelector('audio[data-musica-metronet]')?.getAttribute('src')==='/audio/simulacion-theme.mp3');
 assert.equal(v.solicitudes.filter(r=>r.path.endsWith('/consigna')).length,0);assert.equal(await v.pagina.locator('#objetivoConsigna').count(),0);assert.deepEqual(v.errores,[]);
});

test('Recorridos reutilizados durante el movimiento se invalidan al editar y redimensionar',async t=>{
 const {pagina:p}=await simulador(t);
 const r=await p.evaluate(()=>{const s=escenaEstabilidad,red=s.capaRedMetro;s.iniciarAnimacion(1,60);let conversiones=0;const convertir=red.convertirPosicion;red.convertirPosicion=function(...a){conversiones++;return convertir.apply(this,a)};for(let i=0;i<120;i++)s.update(s.time.now+i*16,16);const durante=conversiones;
 const ruta=red.obtenerRuta('Azul'),antes=red.obtenerPuntoEnRuta(ruta,.5);red.diseno.estaciones[1].posicionX+=50;red.dibujar();const editado=red.obtenerPuntoEnRuta(red.obtenerRuta('Azul'),.5);red.actualizarTamano();const recalculado=red.obtenerPuntoEnRuta(red.obtenerRuta('Azul'),.5);return{durante,antes,editado,recalculado};});
 assert.equal(r.durante,0);assert.notDeepEqual(r.antes,r.editado);assert.deepEqual(r.editado,r.recalculado);
});

for(const dpr of [1,1.25,2])test(`Canvas DPR ${dpr}: nitidez geométrica y cámara estables entre controles y resize`,async t=>{
 const browserDpr={newContext:opciones=>navegador.newContext({...opciones,deviceScaleFactor:dpr})};
 const v=await abrirEditor(browserDpr,{viewport:{width:1280,height:720}});t.after(()=>v.contexto.close());const p=v.pagina;
 const medir=()=>p.evaluate(()=>{const s=juegoPrueba.scene.getScene('MapaScene'),c=s.game.canvas,r=c.getBoundingClientRect(),cam=s.cameras.main;return{ancho:c.width,alto:c.height,cssAncho:r.width,cssAlto:r.height,filter:getComputedStyle(c).filter,transform:getComputedStyle(c).transform,camara:[cam.scrollX,cam.scrollY,cam.zoom]};});
 const antes=await medir();for(let i=0;i<3;i++){await p.locator('.metronet-poi>summary').click();await p.keyboard.press('Escape');await p.locator('.metronet-hud>summary').click();await p.keyboard.press('Escape');}
 assert.deepEqual(await medir(),antes);
 for(const [width,height]of [[1440,900],[390,844],[1280,720]]){await p.setViewportSize({width,height});await p.waitForFunction(()=>{const c=document.querySelector('#metronet-mapa canvas'),r=c.parentElement.getBoundingClientRect();return Math.abs(c.width-r.width)<2&&Math.abs(c.height-r.height)<2});const m=await medir();assert.ok(Math.abs(m.ancho-m.cssAncho)<1);assert.ok(Math.abs(m.alto-m.cssAlto)<1);assert.equal(m.filter,'none');assert.equal(m.transform,'none');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 assert.deepEqual(v.errores,[]);
});
test('Doce ciclos de simulación conservan la cantidad de objetos y eliminan tweens de actividad',async t=>{
 const {pagina:p}=await simulador(t);
 const ciclos=await p.evaluate(async()=>{const s=escenaEstabilidad,out=[];for(let i=0;i<12;i++){s.iniciarAnimacion(1,60);s.pausarAnimacion();s.reanudarAnimacion();s.detenerAnimacion();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));out.push({objetos:s.children.length,trenes:s.capaRedMetro.unidadesSimulacion.size,tweens:s.tweens.getTweens().length,eventos:s.time._active.length+s.time._pendingInsertion.length});}return out;});
 for(const ciclo of ciclos)assert.deepEqual(ciclo,ciclos[0]);assert.equal(ciclos.at(-1).tweens,0);
});
test('Reiniciar la escena del editor libera HUD, teclado y controles antes de volver a crearlos',async t=>{
 const v=await abrirEditor(navegador);t.after(()=>v.contexto.close());const p=v.pagina;const cantidades=[];
 for(let i=0;i<4;i++){
  await p.evaluate(()=>{const s=juegoPrueba.scene.getScene('MapaScene');window.editorAnteriorEstabilidad=s.editorRedMetro;s.scene.restart();});
  await p.waitForFunction(()=>{const s=juegoPrueba.scene.getScene('MapaScene');return s.editorRedMetro&&s.editorRedMetro!==window.editorAnteriorEstabilidad&&s.editorRedMetro.disenoActual&&!s.editorRedMetro.identificacion});
  cantidades.push(await p.evaluate(()=>{const s=juegoPrueba.scene.getScene('MapaScene');delete window.editorAnteriorEstabilidad;return{objetos:s.children.length,hud:document.querySelectorAll('.metronet-hud').length,poi:document.querySelectorAll('.metronet-poi').length,punteros:s.input.listenerCount('pointerdown'),actualizaciones:s.events.listenerCount('postupdate')};}));
 }
 for(const c of cantidades)assert.deepEqual(c,cantidades[0]);assert.deepEqual(v.errores,[]);
});
