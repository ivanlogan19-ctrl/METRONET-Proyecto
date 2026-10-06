const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirEditor}=require('./soporte/editor.cjs');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(async()=>{await browser?.close();});
const nivel={idEscenario:1,numero:1,nombre:'Primera red',estado:'EN_DESARROLLO',desbloqueado:true,herramientasHabilitadas:{},objetivo:'Conectá las estaciones.'};
for(const primeraPasada of [true,false])test(`Campaña: primera pasada ${primeraPasada}, Aprender y recarga sin oferta`,async t=>{
 const v=await abrirEditor(browser,{escenario:nivel,estaciones:[],lineas:[],primeraPasada,ofrecerRecorrido:true});const p=v.pagina;
 t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
 assert.equal(await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).isVisible(),primeraPasada);
 if(primeraPasada){
  await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).click();
  const colores=await p.evaluate(async()=>{const d=document.querySelector('.metronet-recorrido');await Promise.all(d.getAnimations().map(a=>a.finished));const s=getComputedStyle(d);return{fondo:s.backgroundColor,borde:s.borderTopColor,opacidad:s.opacity};});
  assert.equal(colores.fondo,'rgb(40, 37, 17)');assert.equal(colores.borde,'rgb(244, 237, 121)');assert.equal(colores.opacidad,'1');
  await p.keyboard.press('Escape');await p.getByRole('button',{name:'Cerrar tutorial',exact:true}).click();
  await p.evaluate(()=>editorPrueba.abrirDiseno(77,{identificar:true}));
  assert.equal(await p.locator('.metronet-tutorial').evaluate(e=>e.open),false,'Reingresar en el mismo documento no repite la oferta');
 }
 assert.equal(await p.locator('[data-hud-vista="pista"]').count(),0);
 assert.equal(await p.locator('.metronet-aprender-acceso').isVisible(),true);
 await p.locator('.metronet-hud>summary').click();assert.equal(await p.locator('[data-hud-musica]').isVisible(),true);
 await p.reload();await p.locator('.metronet-identificacion').waitFor({state:'detached'});await p.locator('.metronet-tutorial>summary').waitFor();
 assert.equal(await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).isVisible(),false);
 assert.equal(await p.locator('.metronet-tutorial').evaluate(e=>e.open),false);
});
test('Nueva campaña permite otra oferta; entrada consumida, repetida, otro usuario y modo libre no la reproducen',async t=>{
 const v=await abrirPantalla(browser,'/escenarios.html');const p=v.pagina;t.after(()=>v.contexto.close());
 const resultados=await p.evaluate(async()=>{
  const {registrarInicioTutorial:r,consumirInicioTutorial:c}=await import('/src/educacion/InicioTutorial.js');
  const nivel={numero:1,idEscenario:1},red={simulacion:{idDiseno:77}},inicio={idDiseno:77,idEscenario:1,idIntento:2,numeroCampana:3,mostrarTutorial:true};
  r(inicio,nivel);const primera=c(red,nivel),otra=c(red,nivel);
  r({...inicio,mostrarTutorial:false},nivel);const repetida=c(red,nivel);
  r({...inicio,numeroCampana:4},nivel);const nueva=c(red,nivel);
  r(inicio,nivel);const sesion=JSON.parse(localStorage.getItem('sesionUsuario'));sesion.usuario.idUsuario=99;localStorage.setItem('sesionUsuario',JSON.stringify(sesion));const otro=c(red,nivel);
  r(inicio,{...nivel,numero:null});const libre=c(red,{...nivel,numero:null});
  return {primera,otra,repetida,nueva,otro,libre};
 });assert.deepEqual(resultados,{primera:true,otra:false,repetida:false,nueva:true,otro:false,libre:false});
});
test('Volver durante API pendiente cancela inmediatamente y no permite un viaje tardío',async t=>{
 const v=await abrirPantalla(browser,'/escenarios.html');const p=v.pagina;t.after(()=>v.contexto.close());
 await p.evaluate(async()=>{const {iniciarNivelConTransicion}=await import('/src/educacion/PreparacionNivel.js');window.resultado=iniciarNivelConTransicion({numero:1},signal=>{window.senal=signal;return new Promise(r=>window.liberar=r);});});
 await p.getByRole('button',{name:'Volver',exact:true}).click();
 assert.equal(await p.evaluate(()=>resultado),null);assert.equal(await p.evaluate(()=>senal.aborted),true);
 await p.evaluate(()=>liberar({idDiseno:77}));assert.equal(await p.locator('.metronet-viaje').count(),0);
});
test('Navegación rápida comparte confirmación y cancela ambos destinos al elegir Cancelar',async t=>{
 const v=await abrirPantalla(browser,'/escenarios.html');const p=v.pagina;t.after(()=>v.contexto.close());
 await p.evaluate(async()=>{const n=await import('/src/navegacion/NavegacionAplicacion.js');n.registrarControlCambios({hayCambios:()=>true,guardar:()=>{throw Error('No debe guardar');}});window.salidas=Promise.all([n.navegarConCambiosPendientes('/inicio.html'),n.navegarConCambiosPendientes('/ranking.html')]);});
 assert.equal(await p.locator('dialog[open]').count(),1);await p.getByRole('button',{name:'Cancelar',exact:true}).click();await p.evaluate(()=>salidas);
 assert.equal(new URL(p.url()).pathname,'/escenarios.html');assert.deepEqual(v.errores,[]);
});
