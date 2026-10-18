const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirEditor}=require('./soporte/editor.cjs');
const catalogo=require('../src/educacion/recorrido-integral.json');
let browser;
before(async()=>{browser=await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL});});
after(()=>browser?.close());
for(const width of [1366,390])test(`N8: entrada y metas nombran ambas líneas sin cambiar requisitos (${width})`,async t=>{
 const nivel=catalogo[7];
 const condiciones=[
  {clave:'minimoEstaciones',texto:'Ubicar 6 estaciones',actual:3,requerido:6,completado:false},
  {clave:'minimoLineas',texto:'Crear 2 líneas',actual:2,requerido:2,completado:true},
  {clave:'minimoMetros',texto:'Asignar 2 metros',actual:1,requerido:2,completado:false},
  {clave:'aprendizajeSimulacion:individual',texto:'Cambiar UV de una línea sin modificar las demás',actual:0,requerido:1,completado:false},
  {clave:'simulacionActual',texto:'Simular la red actual',actual:0,requerido:1,completado:false},
 ];
 const v=await abrirEditor(browser,{viewport:{width,height:900},primeraPasada:false,
  escenario:{...nivel,idEscenario:8,recorrido:'integral-2026-10-lineas-automaticas-v4'},
  lineas:[{nombre:'Norte'},{nombre:'Costa'}],
  consigna:()=>({estadoGlobal:'PARCIAL',progreso:20,condiciones,referenciasObjetivo:[]})});
 t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
 const p=v.pagina;
 const metas=p.locator('.metronet-consigna__lista-breve');
 assert.match(await metas.innerText(),/Norte: construir · Costa: construir/);
 assert.match(await metas.innerText(),/Norte o Costa: cambiar UV y simular/);
 assert.equal(await p.locator('.metronet-consigna__resumen-activo .metronet-indicaciones-lineas').count(),0);
 assert.equal(await p.locator('.metronet-consigna__lista-breve > li').count(),5,'No se agregan criterios ni se altera el progreso');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.evaluate(async nivel=>{
  (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true);
  window.introLineas=(await import('/src/educacion/PantallaPreparacionNivel.js')).crearPreparacionNivel({
   ...nivel,contenidoPublicado:{desafio:{...nivel,recorrido:'integral-2026-10-lineas-automaticas-v4',relato:nivel.historia.texto},reglasExito:nivel.reglasExito}
  });
 },nivel);
 const intro=p.locator('.metronet-viaje .metronet-indicaciones-lineas');
 assert.deepEqual(await intro.locator('[data-indicacion-lineas="minimoLineas"] p').allTextContents(),[
  'Línea 1: construí su recorrido.','Línea 2: construí su recorrido.'
 ]);
 assert.match(await intro.innerText(),/Elegí sólo una línea/);
 assert.equal(await p.locator('.metronet-viaje').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await p.evaluate(()=>introLineas.cerrar());
 assert.equal(v.solicitudes.length,0,'Las aclaraciones no escriben progreso ni redes');
});

test('Carteles publicados: los diez niveles conservan consigna, requisitos y acceso',async t=>{
 const {abrirPantalla}=require('./soporte/pantallas.cjs');
 const v=await abrirPantalla(browser,'/escenarios.html',{viewport:{width:1366,height:768}});
 t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
 const p=v.pagina;
 await p.emulateMedia({reducedMotion:'reduce'});
 for(const nivel of catalogo){
  await p.evaluate(async nivel=>{
   (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true);
   window.introLineas=(await import('/src/educacion/PantallaPreparacionNivel.js')).crearPreparacionNivel({
    ...nivel,contenidoPublicado:{desafio:{...nivel,recorrido:'integral-2026-10-lineas-automaticas-v4',relato:nivel.historia.texto},reglasExito:nivel.reglasExito}
   });
   introLineas.marcarDatosListos();
  },nivel);
  const dialogo=p.locator('.metronet-viaje');
  assert.equal(await dialogo.locator('.metronet-logo').count(),0);
  assert.equal(await dialogo.locator('.metronet-viaje__dato').count(),1);
  assert.equal(await dialogo.locator('.metronet-viaje__consigna').count(),0,'La consigna se consulta al elegir el nivel, sin duplicarla');
  assert.equal(await dialogo.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  assert.equal(await dialogo.getByRole('button',{name:'Iniciar nivel',exact:true}).isEnabled(),true);
  if(nivel.numero>=5){
   const detalle=dialogo.locator('.metronet-indicaciones-lineas');
   assert.match(await detalle.innerText(),/Línea 1/);
   assert.match(await detalle.innerText(),/Línea 2/);
   assert.equal(await detalle.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  }
  assert.equal(await dialogo.evaluate(e=>e.scrollHeight>e.clientHeight+1),false,`Nivel ${nivel.numero}: acciones visibles sin desplazar`);
  const jugar=dialogo.getByRole('button',{name:'Iniciar nivel',exact:true});
  await jugar.scrollIntoViewIfNeeded();
  assert.equal(await jugar.isVisible(),true);
  if(nivel.numero===10) await p.screenshot({path:'/tmp/metronet-cartel-lineas.png'});
  await p.evaluate(()=>introLineas.cerrar());
 }
});
