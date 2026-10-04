const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirEditor}=require('./soporte/editor.cjs');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
const niveles=require('../src/educacion/niveles.json');
let navegador;
before(async()=>{navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(async()=>{await navegador?.close();});
const nivel={...niveles[0],idEscenario:1,desbloqueado:true,estado:'EN_DESARROLLO',cantidadIntentos:2,mejorPuntaje:80,ultimoPuntaje:65,puntajeMaximo:100};
const cerrar=(t,v)=>t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
for(const width of [1440,390,320])test(`Editor ${width}: sin navegadores duplicados, manual a demanda y un contenido auxiliar`,async t=>{
 const v=await abrirEditor(navegador,{viewport:{width,height:900},escenario:nivel,estaciones:[],lineas:[],tramos:[]});cerrar(t,v);const p=v.pagina;
 assert.equal(await p.locator('.metronet-editor-contexto,.metronet-editor-juego,[data-selector-diseno],[data-lista-escenarios]').count(),0);
 assert.equal(await p.locator('.metronet-tutorial__panel').isVisible(),false);
 assert.equal(await p.locator('[data-panel-edicion-toggle]').isVisible(),width<620);
 assert.equal(await p.locator('[data-editor-activo] .metronet-editor-acceso-teclado').count(),0);
 assert.equal(await p.locator('[data-hud-teclado] .metronet-editor-acceso-teclado').count(),1);
 const mapa=await p.locator('#metronet-mapa').boundingBox();
 await p.locator('.metronet-hud>summary').click();
 for(const nombre of ['Pista','Música','Controles del mapa']){
  await p.locator('.metronet-hud__opciones').getByRole('button',{name:nombre,exact:true}).click();
  assert.equal(await p.locator('.metronet-hud__contenido > :visible').count(),1);
  if(nombre==='Pista')assert.equal(await p.locator('.metronet-glosario-contextual').count(),0);
  const panel=await p.locator('.metronet-hud__panel').boundingBox();assert.ok(panel.width*panel.height<mapa.width*mapa.height*.5);
  assert.deepEqual(await p.locator('#metronet-mapa').boundingBox(),mapa);
 }
 await p.locator('.metronet-tutorial>summary').click();await p.locator('.metronet-tutorial__panel:popover-open').waitFor();assert.match(await p.locator('.metronet-tutorial').innerText(),/símbolo de estación/);
 await p.getByRole('button',{name:'Cerrar tutorial',exact:true}).click();assert.equal(await p.locator('.metronet-hud').getAttribute('open'),null);
 await p.locator('.metronet-hud>summary').click();await p.getByRole('button',{name:'Pista',exact:true}).click();
 await p.locator('[data-indicaciones-escenario]>summary').click();assert.equal(await p.locator('[data-indicaciones-escenario] p').innerText(),nivel.instrucciones);
 assert.match(await p.locator('[data-estadisticas-nivel]').innerText(),/Intentos: 2 · Máximo: 100 puntos · Mejor puntaje: 80 \/ 100 · Mejor del último intento: 65/);
 assert.equal(await p.getByText('Más información',{exact:true}).count(),0);
 await p.keyboard.press('Escape');
 if(width<620)await p.locator('[data-panel-edicion-toggle]').click();
 const consigna=p.locator('[data-alternar-consigna]');await consigna.scrollIntoViewIfNeeded();
 const glifo=await consigna.locator('svg').boundingBox();assert.equal(glifo.width,16);assert.equal(glifo.height,16);assert.ok((await consigna.boundingBox()).height>=40);
 const antes=await p.locator('#metronet-mapa').boundingBox();await consigna.click();assert.equal(await consigna.getAttribute('aria-label'),'Ocultar panel');
 assert.deepEqual(await p.locator('#metronet-mapa').boundingBox(),antes);await consigna.click();assert.equal(await consigna.getAttribute('aria-label'),'Mostrar panel');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});
for(const width of [1440,390])test(`POI ${width}: lupa décima, fallback solo por búsqueda y capas independientes`,async t=>{
 const v=await abrirEditor(navegador,{viewport:{width,height:900}});cerrar(t,v);const p=v.pagina;
 await p.locator('.metronet-poi>summary').click();assert.equal(await p.locator('.metronet-poi [data-categoria=OTROS]').count(),0);
 const accesos=p.locator('.metronet-poi__categorias button');assert.equal(await accesos.count(),10);assert.equal(await accesos.last().getAttribute('aria-label'),'Buscar punto de interés');
 assert.equal(await p.locator('.metronet-poi__busqueda').isVisible(),false);
 const alto=await p.locator('.metronet-poi__panel').evaluate(e=>e.getBoundingClientRect().height);assert.ok(alto<210);
 const invisibles=await p.evaluate(()=>juegoPrueba.scene.getScene('MapaScene').capaPuntosInteres.obtenerResumenPuntos().categoriasVisibles);assert.equal(invisibles.includes('OTROS'),false);
 await accesos.last().click();const campo=p.getByRole('searchbox',{name:'Buscar punto de interés'});assert.equal(await campo.getAttribute('placeholder'),'Buscar punto de interés');
 await campo.fill('Euskal');await p.locator('.metronet-panel-puntos-item').first().click();
 assert.ok(await p.evaluate(()=>juegoPrueba.scene.getScene('MapaScene').capaPuntosInteres.puntoBuscado));
 await p.locator('.metronet-poi>summary').click();await accesos.last().click();assert.equal(await campo.inputValue(),'Complejo Euskal Erria');await p.getByRole('button',{name:'Cerrar búsqueda',exact:true}).click();
 assert.ok(await p.evaluate(()=>juegoPrueba.scene.getScene('MapaScene').capaPuntosInteres.puntoBuscado));
 assert.equal(await p.locator('.metronet-poi__panel').evaluate(e=>e.getBoundingClientRect().height),alto);
 await accesos.last().click();await campo.fill('');assert.equal(await p.evaluate(()=>juegoPrueba.scene.getScene('MapaScene').capaPuntosInteres.puntoBuscado),null);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});
test('Mis diseños: búsqueda, creación, apertura y eliminación con protección de niveles',async t=>{
 let redes=[{idDiseno:77,nombre:'Red libre',estado:'GUARDADO',idEscenario:45},{idDiseno:88,nombre:'Nivel protegido',estado:'GUARDADO',idEscenario:1}];
 const v=await abrirPantalla(navegador,'/disenos.html',{responder:req=>{
  const path=new URL(req.url()).pathname;
  if(path==='/api/juego/progreso')return{json:{modoLibreDesbloqueado:true,escenarios:[]}};
  if(path==='/api/juego/escenarios')return{json:[{idEscenario:45,numero:null,desbloqueado:true},{idEscenario:1,numero:1}]};
  if(path==='/api/simulaciones'&&req.method()==='POST')return{json:{idDiseno:77,nombre:req.postDataJSON().nombre}};
  if(path==='/api/simulaciones')return{json:redes};
  if(path==='/api/simulaciones/77'&&req.method()==='DELETE'){redes=redes.filter(d=>d.idDiseno!==77);return{status:204};}
 }});cerrar(t,v);const p=v.pagina;await p.locator('#listaMisDisenos[aria-busy=false]').waitFor();
 assert.equal(await p.locator('[data-diseno]').count(),2);assert.ok(await p.locator('#buscarDisenos').evaluate(e=>e.getBoundingClientRect().height>=40));assert.equal(await p.locator('.metronet-disenos__acciones a').first().evaluate(e=>parseFloat(getComputedStyle(e).borderTopWidth)>0),true);assert.equal(await p.getByRole('button',{name:'Eliminar diseño: Nivel protegido'}).isDisabled(),true);
 await p.getByRole('searchbox',{name:'Buscar diseños'}).fill('libre');assert.equal(await p.locator('[data-diseno]').count(),1);
 assert.equal(new URL(await p.getByRole('link',{name:'Abrir diseño: Red libre'}).getAttribute('href'),p.url()).searchParams.get('idDiseno'),'77');
 await p.getByRole('button',{name:'Eliminar diseño: Red libre'}).click();await p.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(redes.length,2);
 await p.getByRole('button',{name:'Eliminar diseño: Red libre'}).click();await p.locator('dialog').getByRole('button',{name:'Eliminar diseño',exact:true}).click();await p.getByText('Diseño eliminado.',{exact:true}).waitFor();assert.equal(redes.length,1);
 await p.getByLabel('Nombre de la nueva red').fill('Otra red');await p.getByRole('button',{name:'Crear diseño',exact:true}).click();await p.waitForURL('**/?idDiseno=77');
 assert.equal(v.solicitudes.filter(s=>s.path==='/api/simulaciones'&&s.method==='POST').length,1);
});
test('Mis diseños: error recuperable, creación bloqueada y navegación sin perder acceso',async t=>{
 let falla=true;
 const v=await abrirPantalla(navegador,'/disenos.html',{viewport:{width:320,height:900},responder:req=>{
  const path=new URL(req.url()).pathname;if(path==='/api/simulaciones'&&falla)return{status:500,json:{detail:'Fallo de prueba'}};
  if(path==='/api/juego/progreso')return{json:{modoLibreDesbloqueado:true,escenarios:[]}};
  if(path==='/api/juego/escenarios')return{json:[{idEscenario:45,numero:null,desbloqueado:false}]};
 }});cerrar(t,v);const p=v.pagina;await p.getByText('Fallo de prueba',{exact:true}).waitFor();assert.equal(await p.locator('#crearDiseno').isVisible(),false);falla=false;await p.getByRole('button',{name:'Volver a cargar'}).click();await p.locator('[data-diseno]').waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});
test('Simulación: sin selector de diseños, HUD compartido y panel estable al operar',async t=>{
 const v=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77');cerrar(t,v);const p=v.pagina;
 assert.equal(await p.locator('#seccionDisenos,#listaDisenos').count(),0);assert.equal(await p.getByText('Más información',{exact:true}).count(),0);
 const mapa=await p.locator('#visorSimulacion').boundingBox();await p.locator('.metronet-tutorial>summary').click();await p.locator('.metronet-tutorial__panel:popover-open').waitFor();assert.match(await p.locator('.metronet-tutorial').innerText(),/Simulación/i);assert.deepEqual(await p.locator('#visorSimulacion').boundingBox(),mapa);
 await p.locator('.metronet-hud>summary').click();await p.getByRole('button',{name:'Pista',exact:true}).click();assert.equal(await p.locator('.metronet-hud__contenido > :visible').count(),1);await p.keyboard.press('Escape');
 await p.locator('#ampliarMapa').click();assert.equal(await p.locator('#ampliarMapa').getAttribute('aria-label'),'Mostrar panel');await p.locator('#ampliarMapa').click();assert.equal(await p.locator('#ampliarMapa').getAttribute('aria-label'),'Ocultar panel');
});
