const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async()=>{navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL,args:['--autoplay-policy=no-user-gesture-required']});});
after(async()=>{await navegador?.close();});
async function abrir(t,ruta='/inicio.html') {
 const v=await abrirPantalla(navegador,ruta,{administrador:true});
 t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
 await v.pagina.evaluate(async()=>{window.gestorPrueba=(await import('/src/audio/GestorMusica.js')).gestorMusica;});
 await estable(v.pagina);return v;
}
async function estable(p,pista='/audio/menu-theme.mp3') {
 await p.waitForFunction(pista=>{const a=document.querySelector('[data-musica-metronet]');return a?.getAttribute('src')===pista&&!a.paused&&a.readyState>=2&&!a.seeking&&a.volume===.35&&document.querySelectorAll('audio').length===1;},pista);
}
async function medir(p){return p.evaluate(()=>[...document.querySelectorAll('audio')].map(a=>({pista:a.getAttribute('src'),volumen:a.volume,tiempo:a.currentTime,pausado:a.paused})));}

test('Administración: tabs, clics repetidos y enlaces propios conservan documento, manager y audio',async t=>{
 const {pagina:p,solicitudes}=await abrir(t,'/admin.html');
 await p.evaluate(()=>{window.docPrueba=crypto.randomUUID();window.audioPrueba=gestorPrueba.audio;window.eventosPrueba=[];for(const e of ['pause','play','emptied'])audioPrueba.addEventListener(e,()=>eventosPrueba.push(e));audioPrueba.currentTime=3;});
 const id=await p.evaluate(()=>docPrueba);
 for(const vista of ['disenos','configuracion','actividad','usuarios','disenos']) await p.locator(`[data-vista="${vista}"]`).click();
 const solicitudesAntes=solicitudes.length;
 await p.locator('[data-vista="disenos"]').click({clickCount:3});
 assert.equal(solicitudes.length,solicitudesAntes);
 await p.locator('.metronet-navegacion__enlaces a[href="/admin.html"]').click();
 await p.locator('[data-vista="usuarios"]').click();
 assert.equal(await p.locator('#vista-usuarios').evaluate(e=>e.classList.contains('activa')),true);
 assert.equal(await p.evaluate(()=>docPrueba),id);
 assert.equal(await p.evaluate(()=>audioPrueba===gestorPrueba.audio),true);
 assert.deepEqual(await p.evaluate(()=>eventosPrueba),[]);
 assert.ok(await p.evaluate(()=>audioPrueba.currentTime>=3));
});

test('Misma pista menu→admin y carga de 200ms no tocan play, pause ni volumen',async t=>{
 const {pagina:p}=await abrir(t);
 await p.evaluate(()=>{window.audioPrueba=gestorPrueba.audio;window.eventosPrueba=[];for(const e of ['pause','play','emptied'])audioPrueba.addEventListener(e,()=>eventosPrueba.push(e));audioPrueba.currentTime=3;gestorPrueba.establecerContexto('admin');window.liberarCarga=gestorPrueba.usarContextoTemporal('loading');});
 await p.waitForTimeout(200);await p.evaluate(()=>liberarCarga());await p.waitForTimeout(600);
 assert.equal(await p.evaluate(()=>gestorPrueba.audio===audioPrueba),true);
 assert.deepEqual(await p.evaluate(()=>eventosPrueba),[]);
 assert.equal((await medir(p))[0].volumen,.35);
 assert.ok((await medir(p))[0].tiempo>3);
});

test('Cambio de pista mezcla durante 180ms y respeta 40% maestro',async t=>{
 const {pagina:p}=await abrir(t);
 await p.evaluate(()=>{gestorPrueba.establecerVolumen(.4);gestorPrueba.establecerContexto('gameplay');});
 await p.waitForFunction(()=>gestorPrueba.obtenerEstado().mezclando&&document.querySelector('[data-musica-metronet]')?.currentTime>0);
 await p.waitForTimeout(35);
 const mezcla=await medir(p);assert.equal(mezcla.length,2);
 assert.ok(mezcla.every(a=>!a.pausado&&a.volumen>0&&a.volumen<.4),JSON.stringify(mezcla));
 assert.ok(Math.abs(mezcla.reduce((s,a)=>s+a.volumen,0)-.4)<.025);
 await p.waitForFunction(()=>!gestorPrueba.obtenerEstado().mezclando);
 const final=await medir(p);assert.equal(final.length,1);assert.equal(final[0].pista,'/audio/extra-theme.mp3');assert.equal(final[0].volumen,.4);
 assert.equal(await p.evaluate(()=>gestorPrueba.temporizadorMezcla),null);
});

test('Ida y vuelta de contextos reutiliza la pista sin reinicio ni canales duplicados',async t=>{
 const {pagina:p}=await abrir(t);
 await p.evaluate(()=>{window.originalAudio=gestorPrueba.audio;originalAudio.currentTime=3;gestorPrueba.establecerContexto('gameplay');});
 await p.waitForTimeout(40);await p.evaluate(()=>gestorPrueba.establecerContexto('admin'));
 assert.equal(await p.evaluate(()=>originalAudio===gestorPrueba.audio),true);
 await estable(p);assert.ok((await medir(p))[0].tiempo>=3);
 for(const contexto of ['gameplay','auth','menu','gameplay','admin']) {
  await p.evaluate(c=>gestorPrueba.establecerContexto(c),contexto);await p.waitForTimeout(60);
  const canales=await medir(p);assert.ok(canales.length<=2);assert.equal(new Set(canales.map(c=>c.pista)).size,canales.length);
 }
 await estable(p);assert.equal(await p.evaluate(()=>gestorPrueba.temporizadorMezcla),null);
});

test('Mute durante una mezcla detiene todas las pistas y se conserva al navegar',async t=>{
 const {pagina:p}=await abrir(t);
 await p.evaluate(()=>gestorPrueba.establecerContexto('gameplay'));await p.waitForTimeout(200);
 await p.evaluate(()=>gestorPrueba.establecerSilencio(true));
 assert.ok((await medir(p)).every(a=>a.pausado&&a.volumen===0));
 await p.evaluate(()=>gestorPrueba.establecerContexto('menu'));
 assert.ok((await medir(p)).every(a=>a.pausado&&a.volumen===0));
 await p.goto(`${process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173'}/escenarios.html`);await p.locator('[data-musica-metronet]').waitFor({state:'attached'});
 assert.ok((await medir(p)).every(a=>a.pausado&&a.volumen===0));
});

test('Pista de destino fallida no deja mezcla ni promesas sin capturar',async t=>{
 const {pagina:p}=await abrir(t);
 await p.route('**/audio/extra-theme.mp3',r=>r.fulfill({status:404}));
 await p.evaluate(()=>gestorPrueba.establecerContexto('gameplay'));
 await p.waitForFunction(()=>gestorPrueba.obtenerEstado().error&&!gestorPrueba.obtenerEstado().mezclando);
 assert.ok((await medir(p)).every(a=>a.pausado));
 assert.equal(await p.evaluate(()=>gestorPrueba.temporizadorMezcla),null);
 await p.evaluate(()=>gestorPrueba.establecerContexto('menu'));await estable(p);
});

test('Carga larga se silencia y cancelar su fade recupera la misma pista',async t=>{
 const {pagina:p}=await abrir(t);
 await p.evaluate(()=>{window.audioPrueba=gestorPrueba.audio;window.finCarga=gestorPrueba.usarContextoTemporal('loading');});
 await p.waitForTimeout(800);assert.equal(await p.evaluate(()=>gestorPrueba.obtenerContexto()),'loading');
 assert.ok((await medir(p))[0].volumen<.35);
 await p.evaluate(()=>finCarga());await estable(p);
 assert.equal(await p.evaluate(()=>gestorPrueba.audio===audioPrueba),true);
});

test('Navegación HTML legítima recupera posición sin otra entrada desde volumen cero',async t=>{
 const {pagina:p,contexto}=await abrir(t);
 await contexto.addInitScript(()=>{window.primerVolumen=null;window.primeraPosicion=null;document.addEventListener('playing',e=>{if(e.target instanceof HTMLMediaElement&&primerVolumen===null){primerVolumen=e.target.volume;primeraPosicion=e.target.currentTime;}},true);});
 await p.locator('[data-musica-metronet]').evaluate(a=>a.currentTime=3);
 await p.locator('.metronet-navegacion__enlaces a[href="/escenarios.html"]').click();
 await estable(p);assert.ok((await medir(p))[0].tiempo>=3);
 await p.waitForFunction(()=>primerVolumen!==null);
 assert.equal(await p.evaluate(()=>primerVolumen),.35);
 assert.ok(await p.evaluate(()=>primeraPosicion>=3));
});
