const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let browser;
before(async()=>{browser=await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL})});
after(async()=>{await browser?.close()});
const configuracion=[{clave:'modo_mantenimiento',valor:'desactivado',descripcion:''},{clave:'limite_prueba',valor:'100',descripcion:'Cantidad de prueba'}];
const redes=[{idDiseno:77,idUsuario:7,nombre:'Red propia',propietario:'Ana Prueba',estado:'GUARDADO',idEscenario:45}];
const responder=req=>{
 const path=new URL(req.url()).pathname;
 if(path==='/api/admin/configuracion')return {json:configuracion};
 if(path==='/api/admin/disenos'||path==='/api/simulaciones')return {json:redes};
};
for(const [width,height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,720],[1024,768],[390,844]])test(`Acciones y controles generales: ${width}×${height}`,async t=>{
 for(const ruta of ['/admin.html','/perfil.html','/disenos.html','/escenarios.html','/login.html']) {
  const v=await abrirPantalla(browser,ruta,{viewport:{width,height},responder});const p=v.pagina;
  try {
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${ruta}: sin desborde horizontal`);
   if(ruta==='/disenos.html') {
    await p.locator('[data-diseno="77"]').waitFor();
    const botones=p.locator('[data-diseno="77"] .metronet-disenos__acciones [data-accion-ui]');
    const medidas=await botones.evaluateAll(ns=>ns.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,svg:n.querySelector('svg').getBoundingClientRect().width})));
    assert.equal(medidas.length,3);assert(medidas.every(m=>m.w===32&&m.h===32&&m.svg===20),'Abrir, Simular y Eliminar tienen la misma caja e icono');
    const simular=p.locator('[data-diseno="77"] [data-accion-ui="simular"]');
    const antes=await simular.boundingBox();await simular.hover();assert.deepEqual(await simular.boundingBox(),antes,'Hover sin salto');
    assert.equal(await simular.isDisabled(),true,'El diseño guardado todavía no está preparado para simular');
    assert.equal(await simular.getAttribute('href'),null);
    if(width===1280)await p.screenshot({path:'/tmp/metronet-disenos-unificados.png'});
   }
   if(ruta==='/admin.html') {
    const select=p.locator('#filtroRolUsuarios');const ancho=(await select.boundingBox()).width;
    assert(ancho<300,'Filtro breve no ocupa toda la columna');
    await select.selectOption('ADMIN');assert.equal((await select.boundingBox()).width,ancho);
    await select.focus();await p.keyboard.press('Space');await p.keyboard.press('Escape');assert(await select.evaluate(n=>document.activeElement===n));
    await p.locator('[data-vista="configuracion"]').click();
    const numero=p.locator('[data-control-general="numero"]');await numero.waitFor();
    const caja=await numero.boundingBox();assert(caja.width<150);assert.equal(await numero.evaluate(n=>getComputedStyle(n).textAlign),'center');
    for(const valor of ['1','9','10','99','100']) {await numero.fill(valor);const actual=await numero.boundingBox();assert.equal(actual.width,caja.width);assert.equal(actual.height,caja.height);}
    const mantenimiento=p.locator('select[data-control-general]');assert((await mantenimiento.filter({visible:true}).boundingBox()).width<300);
    if(width===1280)await p.screenshot({path:'/tmp/metronet-controles-unificados.png'});
   }
   if(ruta==='/perfil.html') {
    const guardar=p.locator('button[type="submit"]');assert((await guardar.allTextContents()).every(s=>s.trim()==='Guardar'));
    const altos=await guardar.evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));assert(altos.every(h=>h===40));
   }
   if(ruta==='/login.html')assert.equal((await p.locator('#loginButton').boundingBox()).height,48);
   assert.deepEqual(v.errores,[]);
  } finally {await v.contexto.close();}
 }
});
test('Carga conserva ancho y bloquea el botón; se restaura al terminar',async t=>{
 const v=await abrirPantalla(browser,'/login.html');t.after(()=>v.contexto.close());
 const resultado=await v.pagina.evaluate(async()=>{
  const {establecerCargaAccion}=await import('/src/interfaz/AccionesInterfaz.js');const b=document.querySelector('#loginButton');
  const a=b.getBoundingClientRect().width;establecerCargaAccion(b,true);const disabled=b.disabled;b.querySelector('.button-text').textContent='Preparando…';const c=b.getBoundingClientRect().width;
  establecerCargaAccion(b,false);return {a,c,disabled,activo:!b.disabled};
 });assert.equal(resultado.a,resultado.c);assert(resultado.disabled&&resultado.activo);
});
test('La normalización no se aplica a los controles operacionales de Simulación',async t=>{
 const v=await abrirPantalla(browser,'/simulacion.html?idDiseno=77');t.after(()=>v.contexto.close());
 assert.equal(await v.pagina.locator('#formularioEjecucion [data-accion-ui],#pausarSimulacion[data-accion-ui],#detenerSimulacion[data-accion-ui],[data-paso-horas][data-accion-ui],[data-paso-ritmo][data-accion-ui],#duracionSimulacion[data-control-general]').count(),0);
});

test('Eliminar todo se centra en su columna y el título del tutorial conserva el amarillo',async t=>{
 const v=await abrirPantalla(browser,'/admin.html',{responder:req=>new URL(req.url()).pathname.includes('/actividades')?{json:[{idActividad:1,fecha:'2026-10-15T12:00:00',administrador:'Admin',accion:'Editar',detalle:'Nivel 1'}]}:undefined});t.after(()=>v.contexto.close());const p=v.pagina;
 await p.locator('[data-vista="actividad"]').click();
 const total=p.getByRole('button',{name:'Eliminar todo',exact:true});await total.waitFor();
 assert.equal(await p.locator('#tablaActividad button').textContent(),'Eliminar');
 const alineacion=await total.evaluate(n=>{const b=n.getBoundingClientRect(),c=n.closest('th').getBoundingClientRect();return Math.abs(b.x+b.width/2-c.x-c.width/2)});assert(alineacion<1);
 await p.waitForFunction(()=>getComputedStyle(document.querySelector('#borrarTodasActividades')).backgroundColor==='rgb(180, 35, 64)');
 await p.evaluate(async()=>{await import('/src/educacion/tutorial-inicial.css');const {ofrecerTutorial}=await import('/src/educacion/OfertaTutorial.js');ofrecerTutorial({titulo:'Tutorial',descripcion:'Probá las herramientas',alAceptar:()=>{}})});
 assert.equal(await p.locator('#oferta-tutorial-titulo').evaluate(n=>getComputedStyle(n).color),'rgb(244, 237, 121)');
});
