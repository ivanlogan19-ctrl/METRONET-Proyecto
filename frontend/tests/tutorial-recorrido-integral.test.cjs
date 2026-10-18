const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirEditor}=require('./soporte/editor.cjs');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
const catalogo=require('../src/educacion/recorrido-integral.json');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(()=>browser?.close());
for(const width of [1440,390]) test(`Nivel 1 presenta mapa y herramientas, incluida Simular deshabilitada: ${width}`,async t=>{
 const escenario={...catalogo[0],idEscenario:1,recorrido:'integral-2026-10'};
 const v=await abrirEditor(browser,{escenario,estaciones:[],lineas:[],tramos:[],ofrecerRecorrido:true,viewport:{width,height:1000}});
 t.after(()=>v.contexto.close());
 const p=v.pagina;
 const oferta=p.locator('[data-oferta-tutorial]');
 const dimensiones=await oferta.boundingBox();
 assert.ok(Math.abs(dimensiones.x+dimensiones.width/2-width/2)<2,'Oferta centrada horizontalmente');
 assert.ok(Math.abs(dimensiones.y+dimensiones.height/2-500)<2,'Oferta centrada verticalmente');
 const fuentes=await oferta.locator('h2,p,button').evaluateAll(es=>es.map(e=>getComputedStyle(e).fontFamily));
 assert.equal(new Set(fuentes).size,1,'Toda la oferta usa la misma fuente pixelada');
 const botones=await oferta.locator('button').all();
 const cajas=await Promise.all(botones.map(b=>b.boundingBox()));
 assert.ok(cajas[1].y-cajas[0].y-cajas[0].height>=10,'Opciones separadas');
 assert.equal(cajas[0].width,cajas[1].width);
 await p.getByRole('button',{name:'Iniciar tutorial',exact:true}).click();
 await p.locator('.metronet-recorrido').waitFor();
 const titulos=[];
 while(await p.locator('.metronet-recorrido [data-recorrido-siguiente]:visible').count()) {
  titulos.push(await p.locator('.metronet-recorrido h2').textContent());
  assert.equal(await p.locator('[data-recorrido-progreso]').isVisible(),false);
  assert.doesNotMatch(await p.locator('.metronet-recorrido').innerText(),/RECORRIDO\s*\/\/|\d+\s+DE\s+\d+/i);
  const r=await p.locator('.metronet-recorrido').boundingBox();
  assert.ok(r.x>=0 && r.x+r.width<=width+1,'La guía queda dentro del ancho visible');
  await p.locator('[data-recorrido-siguiente]').click();
 }
 for(const nombre of ['Mapa de la red','Vista del mapa','Rotación del mapa','Estación','Línea','Conexión','Metro','Guardar','Simular','Selección','Aprender','Música']) assert.ok(titulos.includes(nombre),nombre);
 await p.waitForFunction(()=>document.querySelector('.metronet-recorrido h2')?.textContent==='Elegí Estación');
 assert.equal(await p.locator('[data-recorrido-siguiente]').isVisible(),false,'La práctica requiere la herramienta real');
 await p.locator('[data-elegir-herramienta="estaciones"]').click();
 await p.waitForFunction(()=>document.querySelector('.metronet-recorrido h2')?.textContent==='Colocá estaciones');
 assert.deepEqual(v.errores,[]);
});
test('Simulación incremental exige eventos, y la ayuda manual sigue disponible en niveles de reutilización',async t=>{
 const v=await abrirPantalla(browser,'/escenarios.html');t.after(()=>v.contexto.close());const p=v.pagina;
 await p.evaluate(async()=>{
  const {abrirTutorialSimulacion,presentarTutorialSimulacion}=await import('/src/educacion/TutorialSimulacion.js');
  localStorage.setItem("metronet:tutorial-pantalla-simulacion:v6:7:1:primera-visita","presentado");
  window.autoReutilizacion=presentarTutorialSimulacion({numeroNivel:6,idUsuario:7});
  window.guia=abrirTutorialSimulacion(()=>{},6);
 });
 assert.equal(await p.evaluate(()=>autoReutilizacion),null);
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Mapa de la red');
 await p.keyboard.press('Escape');
 await p.evaluate(async()=>{const {abrirTutorialSimulacion}=await import('/src/educacion/TutorialSimulacion.js');window.guia=abrirTutorialSimulacion(()=>{},2);});
 assert.match(await p.locator('.metronet-recorrido h2').textContent(),/velocidad.*UV/);
 await p.locator('[data-recorrido-siguiente]').click();
 assert.equal(await p.locator('[data-recorrido-siguiente]').isVisible(),false);
 await p.evaluate(()=>guia.notificar('velocidad'));
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Observá el recorrido','Un ajuste no sustituye la ejecución inicial');
 await p.evaluate(()=>guia.notificar('ejecucion'));
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Cambiá UV');
 await p.evaluate(()=>guia.notificar('velocidad'));
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Observá el recorrido');
 await p.evaluate(()=>guia.notificar('ejecucion'));
 assert.equal(await p.locator('.metronet-recorrido').count(),0);
 assert.deepEqual(v.errores,[]);
});

for (const nivel of catalogo.slice(1)) test(`N${nivel.numero}: el tutorial automático presenta solamente funciones nuevas`, async t => {
 const v=await abrirEditor(browser,{escenario:{...nivel,idEscenario:nivel.numero,recorrido:'integral-2026-10-metas-5-v1'},ofrecerRecorrido:true,estaciones:[],lineas:[],tramos:[]});
 t.after(()=>v.contexto.close());
 const p=v.pagina, titulo={2:'Extendé la línea',6:'Puntos de interés de Montevideo',7:'Un intercambio real'}[nivel.numero];
 if(titulo) {
  await p.locator('.metronet-recorrido').waitFor();
  assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Nueva funcionalidad');
  await p.getByRole('button',{name:'Iniciar tutorial',exact:true}).click();
  assert.equal(await p.locator('.metronet-recorrido h2').textContent(),titulo);
  assert.equal(await p.locator('[data-recorrido-omitir]').evaluate(e=>e.getBoundingClientRect().width),32);
  await p.keyboard.press('Escape');
 } else assert.equal(await p.locator('.metronet-recorrido').count(),0);
 assert.deepEqual(v.errores,[]);
});

test('N1 permite comenzar directamente y sigue aceptando estaciones', async t => {
 const v=await abrirEditor(browser,{escenario:{...catalogo[0],idEscenario:1,recorrido:'integral-2026-10-objetivos-reales-v2'},ofrecerRecorrido:true,estaciones:[],lineas:[],tramos:[]});
 t.after(()=>v.contexto.close());const p=v.pagina;
 await p.getByRole('button',{name:'Continuar',exact:true}).click();
 assert.equal(await p.locator('.metronet-recorrido').count(),0);
 await p.locator('[data-elegir-herramienta="estaciones"]').click();
 const canvas=await p.locator('#metronet-mapa canvas').boundingBox();
 await p.mouse.click(canvas.x+canvas.width*.55,canvas.y+canvas.height*.60);
 await p.waitForFunction(()=>editorPrueba.disenoActual.estaciones.length===1);
 assert.deepEqual(v.errores,[]);
});

test('N6 ofrece el tutorial una vez por diseño y vuelve a ofrecerlo al empezar otro', async t => {
 const nivel=catalogo[5];
 const v=await abrirEditor(browser,{escenario:{...nivel,idEscenario:6,recorrido:'integral-2026-10-objetivos-reales-v2'},primeraPasada:false,ofrecerRecorrido:true});
 t.after(()=>v.contexto.close());const p=v.pagina;
 await p.getByRole('button',{name:'Iniciar tutorial',exact:true}).click();
 assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Puntos de interés de Montevideo');
 await p.reload();
 await p.waitForFunction(()=>window.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro?.panelTutorial?.contexto?.diseno?.simulacion?.idDiseno===77);
 assert.equal(await p.locator('[data-oferta-tutorial]').count(),0,'No vuelve a ofrecer en la misma partida');
 await p.evaluate(()=>{
  const panel=juegoPrueba.scene.getScene('MapaScene').editorRedMetro.panelTutorial;
  const contexto=panel.contexto;
  panel.actualizar({...contexto,diseno:{...contexto.diseno,simulacion:{...contexto.diseno.simulacion,idDiseno:78}}});
 });
 await p.getByRole('button',{name:'Iniciar tutorial',exact:true}).waitFor();
 await p.getByRole('button',{name:'Continuar',exact:true}).click();
 assert.deepEqual(v.errores,[]);
});

test('N6: el paseo enseña categorías, barrios, zonas, búsqueda y mantener visible con acciones reales', async t => {
 const nivel=catalogo[5];
 const v=await abrirEditor(browser,{escenario:{...nivel,idEscenario:6,recorrido:'integral-2026-10-objetivos-reales-v2'},ofrecerRecorrido:true,consigna:()=>({condiciones:[],referenciasObjetivo:nivel.reglasExito.puntosInteresObjetivo.map(p=>({...p,nombre:`Referencia ${p.idPunto}`}))})});
 t.after(()=>v.contexto.close()); const p=v.pagina;
 const titulo=async texto=>{try {await p.waitForFunction(texto=>document.querySelector('.metronet-recorrido h2')?.textContent===texto,texto,{timeout:5000});}catch(e){throw new Error(`Esperado: ${texto}; actual: ${await p.locator('.metronet-recorrido').innerText()}`);}};
 await p.getByRole('button',{name:'Iniciar tutorial',exact:true}).click();
 await p.locator('.metronet-poi>summary').click();
 await titulo('Probá una categoría');
 await p.locator('.metronet-poi__categorias button').first().click();
 await titulo('Abrí Barrios');
 await p.locator('#metronet-selector-barrios .metronet-panel-encabezado').click();
 await titulo('Seleccioná un barrio');
 await p.locator('.metronet-selector-barrios-lista input:not([value=""])').first().check();
 await titulo('Más barrios');
 await p.getByRole('button',{name:'Siguiente',exact:true}).click();
 await titulo('Cerrá la lista de barrios');
 await p.locator('#metronet-selector-barrios .metronet-panel-encabezado').click();
 await titulo('Abrí Zonas');
 await p.locator('#metronet-selector-zonas .metronet-panel-encabezado').click();
 await titulo('Seleccioná una zona');
 await p.locator('.metronet-selector-zonas-lista input').first().check();
 await titulo('Cerrá la lista de zonas');
 await p.locator('#metronet-selector-zonas .metronet-panel-encabezado').click();
 if (await p.locator('.metronet-panel-puntos-alternar').getAttribute('aria-expanded') !== 'true') {
  await titulo('Buscar punto de interés');
  await p.getByRole('button',{name:'Buscar punto de interés',exact:true}).click();
 }
 await p.getByRole('searchbox',{name:'Buscar punto de interés'}).fill('Mirador Panorámico de la Intendencia');
 await titulo('Localizá el punto');
 await p.locator('.metronet-panel-puntos-lista button').first().click();
 await titulo('Mantené el punto visible');
 await p.getByRole('checkbox',{name:'Mantener visible',exact:true}).check();
 await titulo('Volvé al mapa');
 await p.getByRole('button',{name:'Cerrar información',exact:true}).click();
 await titulo('Marcador y cobertura');
 await p.getByRole('button',{name:'Siguiente',exact:true}).click();
 await titulo('Estación dentro del radio');
 assert.deepEqual(v.errores,[]);
});

test('Registro por usuario: funciones nuevas, POI real y ayudas que no se marcan antes de practicarlas',async t=>{
 const v=await abrirPantalla(browser,'/escenarios.html');t.after(()=>v.contexto.close());const p=v.pagina;
 const estado=await p.evaluate(async()=>{
  const r=await import('/src/educacion/FuncionesCampana.js');
  const e=await import('/src/educacion/TutorialInicial.js');
  const s=await import('/src/educacion/TutorialSimulacion.js');
  const secuencia=Array.from({length:10},(_,i)=>r.funcionesIntroducidas(i+1));
  r.registrarFuncionesEnsenadas(7,['editor.poi','simulacion.inicial.v2','simulacion.velocidad']);
  const conocida=s.presentarTutorialSimulacion({idUsuario:7,numeroNivel:2,numeroCampana:4});
  conocida?.terminar();
  const otraCuenta=s.presentarTutorialSimulacion({idUsuario:8,numeroNivel:8});
  const inicialOtraCuenta=document.querySelector('.metronet-recorrido h2')?.textContent;
  otraCuenta?.terminar(false);
  return {secuencia,conocida:conocida===null,inicialOtraCuenta,ajena:r.funcionesEnsenadas(8).size,
   poi:e.objetivoTutorialPoi(6).id,poiInicial:e.objetivoTutorialPoi(1),
   pasosPoi:e.pasosPracticosEditor(6).map(p=>p[3]).filter(Boolean)};
 });
 assert.deepEqual(estado.secuencia,[['editor.basico'],['editor.extender','simulacion.velocidad'],['simulacion.duracion'],[],[],['editor.poi'],['editor.transbordo'],['simulacion.individual'],['simulacion.combinacion'],[]]);
 assert.equal(estado.conocida,false);assert.equal(estado.inicialOtraCuenta,'Nueva funcionalidad');assert.equal(estado.ajena,0);
 assert.equal(estado.poi,33);assert.equal(estado.poiInicial,undefined);
 assert.deepEqual(estado.pasosPoi,['poi-abierto','poi-categoria','barrios-abiertos','barrio-seleccionado','barrios-cerrados','zonas-abiertas','zona-seleccionada','zonas-cerradas','buscador-abierto','poi-buscado','poi-localizado','poi-fijado','poi-ficha-cerrada','poi-cubierto']);
});

test('Simulación ofrece cada función nueva una vez por partida y la repite en una nueva campaña', async t => {
 const v=await abrirPantalla(browser,'/escenarios.html');t.after(()=>v.contexto.close());const p=v.pagina;
 await p.evaluate(async()=>{
  const r=await import('/src/educacion/FuncionesCampana.js');
  r.registrarFuncionesEnsenadas(7,['simulacion.inicial.v2']);
 });
 for (const numero of [2,3,4,8,9]) {
  await p.evaluate(async numero=>{
   const s=await import('/src/educacion/TutorialSimulacion.js');
   window.ofertaPrueba=s.presentarTutorialSimulacion({idUsuario:7,numeroNivel:numero,repetido:true});
  },numero);
  assert.equal(await p.locator('[data-oferta-tutorial] h2').textContent(),'Nueva funcionalidad');
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  assert.equal(await p.evaluate(async numero=>{
   const s=await import('/src/educacion/TutorialSimulacion.js');
   return s.presentarTutorialSimulacion({idUsuario:7,numeroNivel:numero})===null;
  },numero),true,'Respeta comenzar directamente');
 }
 assert.equal(await p.evaluate(async()=>{
  const s=await import('/src/educacion/TutorialSimulacion.js');
  const r=await import('/src/educacion/FuncionesCampana.js');
  r.registrarFuncionesEnsenadas(7,['simulacion.velocidad']);
  const oferta=s.presentarTutorialSimulacion({idUsuario:7,numeroNivel:2,numeroCampana:2});
  const ofrecida=Boolean(oferta);oferta?.terminar();return ofrecida;
 }),true);
 assert.deepEqual(v.errores,[]);
});

for (const numero of [1,6]) test(`Guía rápida N${numero}: solo funciones visibles y acceso Aprender`,async t=>{
 const nivel=catalogo[numero-1];
 const v=await abrirEditor(browser,{escenario:{...nivel,idEscenario:numero,recorrido:'integral-2026-10-objetivos-reales-v2'},primeraPasada:false,novedadPresentada:true,cerrarTarjetaAutomatica:false,consigna:()=>({condiciones:[],referenciasObjetivo:(nivel.reglasExito.puntosInteresObjetivo||[]).map(p=>({...p,nombre:`Referencia ${p.idPunto}`}))})});
 t.after(()=>v.contexto.close());const p=v.pagina;
 if(await p.locator('.metronet-recorrido').count()) await p.keyboard.press('Escape');
 await p.locator('.metronet-tutorial > summary').click();
 const guia=p.locator('.metronet-guia-rapida:popover-open');await guia.waitFor();
 const texto=await guia.innerText();
 assert.match(texto,/Aprender abre las tarjetas educativas/);
 assert.doesNotMatch(texto,/Controles y pista|pedir una pista|El libro/);
 assert.equal(/puntos de interés/.test(texto),numero===6);
 assert.equal(await p.getByRole('button',{name:'Aprender',exact:true}).isVisible(),true);
 await p.getByRole('button',{name:'Aprender',exact:true}).click();
 await p.locator('.metronet-tarjeta-educativa').waitFor();
 assert.deepEqual(v.errores,[]);
});
