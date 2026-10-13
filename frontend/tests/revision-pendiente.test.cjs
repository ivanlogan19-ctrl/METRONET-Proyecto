const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let browser;
before(async()=>{browser=await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL});});
after(()=>browser?.close());
async function abrir(t,width=1440){
 const v=await abrirPantalla(browser,'/escenarios.html',{viewport:{width,height:900}});
 t.after(async()=>{assert.deepEqual(v.errores,[]);await v.contexto.close();});
 await v.pagina.evaluate(async()=>{
  const n=await import('/src/navegacion/NavegacionAplicacion.js');
  let pendientes=true;
  n.registrarControlCambios({hayCambios:()=>pendientes,guardar:async()=>{sessionStorage.setItem('qa-revision-guardada','true');pendientes=false;return true;}});
  window.abrirRevision=()=>{window.salidaPendiente=n.navegarConCambiosPendientes('/inicio.html');};
  window.abrirRevision();
 });
 await v.pagina.locator('[data-dialogo-cambios][open]').waitFor();return v.pagina;
}
for(const width of [1440,390])test(`Revisión pendiente ${width}: centrada, tres acciones iguales y cancelación`,async t=>{
 const p=await abrir(t,width),d=p.locator('[data-dialogo-cambios]');
 assert.deepEqual(await d.locator('button').allTextContents(),['Guardar y continuar','Continuar sin revisar','Cancelar']);
 const medidas=await d.evaluate(e=>{const r=e.getBoundingClientRect(),botones=[...e.querySelectorAll('button')].map(b=>{const c=b.getBoundingClientRect();return {x:c.x,y:c.y,w:c.width,h:c.height,font:getComputedStyle(b).fontFamily};});return {cx:r.x+r.width/2,cy:r.y+r.height/2,overflow:e.scrollWidth>e.clientWidth,botones};});
 assert.ok(Math.abs(medidas.cx-width/2)<1&&Math.abs(medidas.cy-450)<1);
 assert.equal(medidas.overflow,false);
 for(const [i,b] of medidas.botones.entries()){assert.equal(b.w,medidas.botones[0].w);assert.equal(b.h,medidas.botones[0].h);assert.match(b.font,/Silkscreen/);if(i)assert.ok(b.y>=medidas.botones[i-1].y+b.h+8);}
 assert.equal(await d.locator('h2').evaluate(e=>getComputedStyle(e).boxShadow),'none');
 assert.equal(await d.locator('[data-accion-guardar]').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(112, 229, 177)');
 await p.screenshot({path:`/tmp/metronet-revision-pendiente-${width}.png`});
 await d.getByRole('button',{name:'Cancelar',exact:true}).click();await p.evaluate(()=>window.salidaPendiente);
 assert.match(p.url(),/escenarios.html/);assert.equal(await p.evaluate(()=>sessionStorage.getItem('qa-revision-guardada')),null);
 await p.evaluate(()=>window.abrirRevision());await p.keyboard.press('Escape');await p.evaluate(()=>window.salidaPendiente);assert.match(p.url(),/escenarios.html/);
});
for(const accion of ['Guardar y continuar','Continuar sin revisar'])test(`Revisión pendiente: ${accion} conserva su comportamiento`,async t=>{
 const p=await abrir(t);await p.getByRole('button',{name:accion,exact:true}).click();await p.waitForURL('**/inicio.html');
 assert.equal(await p.evaluate(()=>sessionStorage.getItem('qa-revision-guardada')),accion==='Guardar y continuar'?'true':null);
});
