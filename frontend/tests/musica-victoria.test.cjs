// MP3 y Chrome reales; API controlada, sin escribir actividad en PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL, args:['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await navegador?.close(); });
async function abrir(t) {
 const vista = await abrirPantalla(navegador,'/escenarios.html');
 t.after(async()=>{await vista.contexto.close();assert.deepEqual(vista.errores,[]);});
 return vista.pagina;
}
test('Finales 1 → 2 → 3: viaje y nuevo nivel usan una sola canción completa sin repetir al abrir', async t => {
 const p=await abrir(t);
 const datos=await p.evaluate(async()=>{
  const {gestorMusica:g}=await import('/src/audio/GestorMusica.js');
  const {iniciarNivelConTransicion}=await import('/src/educacion/PreparacionNivel.js');
  const {crearIdentificacionNivel}=await import('/src/educacion/IdentificacionNivel.js');
  const {mostrarTransicionNivel}=await import('/src/educacion/PantallaTransicionNivel.js');
  g.establecerContexto('gameplay');
  const estados=[];
  for(const numero of [1,2]){
   const nivel={numero,idEscenario:numero,nombre:`Nivel ${numero}`,objetivo:'Conectar estaciones.'};
   const siguiente={...nivel,numero:numero+1,idEscenario:numero+1};
   const inicio=performance.now();
   const resultado=mostrarTransicionNivel(nivel,siguiente,{puntaje:100});
   const original=g.audio;
   let termino=false,cortes=0,cartel=null;
   original.addEventListener('ended',()=>{termino=true;});
   original.addEventListener('pause',()=>{if(!original.ended)cortes++;});
   const muestreo=setInterval(()=>{
    const visible=document.querySelector('.metronet-victoria .metronet-cartel-transicion:not([hidden])');
    if(visible && !cartel)cartel={texto:visible.textContent,mismo:g.audio===original,tiempo:original.currentTime,instancias:g.obtenerEstado().instancias};
   },50);
   const accion=await resultado;
   await new Promise(resolve=>setTimeout(resolve,0)); // Dejar terminar todos los listeners de ended.
   clearInterval(muestreo);
   estados.push({accion,termino,cortes,cartel,duracion:original.duration,ms:performance.now()-inicio,loop:original.loop});
   await iniciarNivelConTransicion(siguiente,async()=>({idDiseno:numero+1,idEscenario:numero+1}),{preparado:true});
   const antes=performance.now();
   await crearIdentificacionNivel().mostrar(siguiente,numero+1);
   estados.at(-1).demoraRepeticion=performance.now()-antes;
   estados.at(-1).pistaSiguiente=g.pista;
  }
  return estados;
 });
 for(const [i,e] of datos.entries()){
  assert.equal(e.accion,'siguiente');assert.equal(e.termino,true);assert.equal(e.cortes,0);assert.equal(e.loop,false);
  assert.ok(e.ms>=14800&&e.ms<18000);assert.ok(e.duracion>14.8&&e.duracion<15.2);
  assert.equal(e.cartel.mismo,true);assert.equal(e.cartel.instancias,1);assert.match(e.cartel.texto,new RegExp(`NIVEL ${i+2}`));
  assert.ok(e.cartel.tiempo>11&&e.cartel.tiempo<15);assert.ok(e.demoraRepeticion<200);
  assert.equal(e.pistaSiguiente,'/audio/gameplay-theme.mp3');
 }
});
for(const fallo of ['silencio','archivo','autoplay'])test(`Sin sonido (${fallo}) conserva quince segundos sin bloquear la finalización`,async t=>{
 const p=await abrir(t);
 if(fallo==='archivo')await p.route('**/audio/victory-theme.mp3',r=>r.fulfill({status:404}));
 const resultado=await p.evaluate(async fallo=>{
  const {gestorMusica:g}=await import('/src/audio/GestorMusica.js');
  if(fallo==='silencio')g.establecerSilencio(true);
  if(fallo==='autoplay')HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Sin gesto','NotAllowedError'));};
  const {mostrarTransicionNivel}=await import('/src/educacion/PantallaTransicionNivel.js');
  const inicio=performance.now(); const accion=await mostrarTransicionNivel({numero:1},{numero:2},{puntaje:100});
  return {ms:performance.now()-inicio,accion,overlays:document.querySelectorAll('.metronet-victoria').length};
 },fallo);
 assert.equal(resultado.accion,'siguiente');assert.ok(resultado.ms>=14900&&resultado.ms<16000);assert.equal(resultado.overlays,0);
});
test('Menú → gameplay mezcla pistas distintas una vez; repetir contexto no reinicia ni mezcla consigo mismo',async t=>{
 const p=await abrir(t);
 await p.waitForFunction(()=>document.querySelector('audio')?.volume===.35);
 await p.evaluate(async()=>{window.g=(await import('/src/audio/GestorMusica.js')).gestorMusica;g.establecerContexto('gameplay');});
 await p.waitForFunction(()=>g.pista==='/audio/gameplay-theme.mp3'&&!g.obtenerEstado().mezclando&&g.audio.currentTime>.2);
 const estado=await p.evaluate(()=>{const original=g.audio;const posicion=original.currentTime;const liberar=g.usarContextoTemporal('transition');liberar();g.establecerContexto('gameplay');return {mismo:g.audio===original,posicion,despues:g.audio.currentTime,...g.obtenerEstado()};});
 assert.equal(estado.mismo,true);assert.equal(estado.instancias,1);assert.equal(estado.mezclando,false);assert.ok(estado.despues>=estado.posicion);
});
