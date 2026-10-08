const {test}=require('node:test');
const assert=require('node:assert/strict');
const niveles=require('../src/educacion/recorrido-integral.json');
const politica=require('../src/educacion/puntuacion-progreso.json');
// Las variantes completas de cada nivel se prueban también en PostgreSQL.
// Este recorrido comprueba los cinco puntajes en la interfaz y su transición al siguiente nivel.
const puntosEsperados=[100,90,80,70,100,100,100,60,90,60];
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const BASE=process.env.METRONET_URL_PRUEBAS||'http://127.0.0.1:5198';
const API=process.env.METRONET_API_PRUEBAS;

test('campaña integral real: login → diez niveles → Modo Libre', {skip:!API,timeout:1100000}, async t=>{
 const navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});
 t.after(()=>navegador.close());
 const contexto=await navegador.newContext({viewport:{width:1440,height:1000}});
 const pagina=await contexto.newPage(); pagina.setDefaultTimeout(20000);
 const errores=[],fallos=[],evaluaciones=[];
 pagina.on('pageerror',e=>errores.push(e.message));
 pagina.on('response',async r=>{
  if(r.url().includes('/api/')&&r.status()>=400) fallos.push([new URL(r.url()).pathname,r.status()]);
  if(r.url().endsWith('/evaluar')&&r.ok()) evaluaciones.push(await r.json());
 });
 // Proxy transparente hacia Spring Boot real en un puerto aleatorio; no se simula ninguna respuesta REST.
 await contexto.route(/http:\/\/[^/]+:8080\//,route=>route.continue({url:API+new URL(route.request().url()).pathname+new URL(route.request().url()).search}));
 await contexto.route('**/src/main.js*',async route=>{
  const respuesta=await route.fetch();
  await route.fulfill({response:respuesta,body:(await respuesta.text()).replace('let juego = new Phaser.Game(config);','let juego = new Phaser.Game(config); window.juegoPrueba = juego;')});
 });
 await contexto.route('**/src/simulacion/simulacion.js*',async route=>{
  const respuesta=await route.fetch();
  await route.fulfill({response:respuesta,body:(await respuesta.text())+'\nwindow.leerEstadoPrueba=()=>({tutorial:tutorialSimulacion?.indice,estado:estadoMotor?.estado,resultadoEnCurso});'});
 });
 await pagina.goto(BASE+'/login.html');
 await pagina.locator('#pantalla-metronet').waitFor();
 const f=()=>pagina.frames().find(frame=>frame.parentFrame());
 await f().locator('#email').fill(process.env.METRONET_E2E_EMAIL);
 await f().locator('#password').fill(process.env.METRONET_E2E_CLAVE);
 await f().locator('#loginButton').click();
 try { await f().getByRole('link',{name:'Niveles',exact:true}).first().click({timeout:30000}); } catch(error) { console.log('LOGIN',pagina.frames().map(f=>f.url()),await f().locator('body').innerText(),errores,fallos); throw error; }
 await f().getByRole('button',{name:'Comenzar',exact:true}).click();
 await f().getByRole('button',{name:'Jugar',exact:true}).click();

 async function presentaciones() {
  for(let i=0;i<35;i++) {
   const frame=f();
   const tarjeta=frame.locator('dialog[open] .metronet-tarjeta-educativa__acciones button');
   const siguiente=frame.locator('.metronet-recorrido [data-recorrido-siguiente]:visible');
   if(await tarjeta.count()) await tarjeta.first().click();
   else if(await siguiente.count()) await siguiente.click();
   else if(await frame.locator('.metronet-recorrido[data-objetivo="fin"]').count())
    await frame.locator('.metronet-recorrido[data-objetivo="fin"]').waitFor({state:'detached',timeout:5000});
   else break;
  }
 }
 async function editor() {
  for (let i=0;i<8;i++) {
   // La navegación persistente reemplaza el iframe: esperar el documento
   // entrante antes de obtener su Frame, sin asumir que ya existe tras Jugar.
   await pagina.waitForFunction(()=>{
    const vista=document.querySelector('#pantalla-metronet')?.contentWindow;
    return vista?.document.querySelector('dialog[open] .metronet-tarjeta-educativa__acciones button, .metronet-premio[open] button')
     || vista?.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro?.disenoActual;
   });
   await f().waitForFunction(()=>document.querySelector('dialog[open] .metronet-tarjeta-educativa__acciones button, .metronet-premio[open] button') || window.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro?.disenoActual);
   const continuar=f().locator('dialog[open] .metronet-tarjeta-educativa__acciones button, .metronet-premio[open] button');
   if(await continuar.count()) await continuar.first().click(); else break;
  }
  await f().waitForFunction(()=>window.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro?.disenoActual);
  await f().waitForFunction(()=>!juegoPrueba.scene.getScene('MapaScene').editorRedMetro.identificacion);
  await presentaciones();
 }
 async function mapa(x,y) {
  const frame=f();
  await frame.waitForFunction(()=>!juegoPrueba.scene.getScene('MapaScene').cameras.main.panEffect.isRunning);
  await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const punto=await frame.evaluate(({x,y})=>{
   const capa=juegoPrueba.scene.getScene('MapaScene').editorRedMetro.capaRedMetro;
   const p=capa.convertirPosicion(x,y),cam=capa.escena.cameras.main;
   const c=capa.escena.game.canvas.getBoundingClientRect();
   // Leer la cámara solo para localizar el clic real. No se altera estado ni progreso.
   return {x:c.left+(p.x-cam.worldView.x)*cam.zoom,y:c.top+(p.y-cam.worldView.y)*cam.zoom};
  },{x,y});
  const iframe=await pagina.locator('#pantalla-metronet').boundingBox();
  await pagina.mouse.click(punto.x+iframe.x,punto.y+iframe.y);
 }
 async function cuenta(tipo,n) {
  await f().waitForFunction(({tipo,n})=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual[tipo].length===n,{tipo,n});
  await presentaciones();
 }
 async function herramienta(clave){await presentaciones();await f().locator(`[data-elegir-herramienta="${clave}"]`).click();}
 async function aplicarUv(valor,individual=false){
  await presentaciones();
  if(individual){await f().locator('.simulacion-selector-metros > summary').click();await f().locator('.simulacion-selector-metros__opciones button:not([data-metro="todas"])').first().click();}
  else {await f().locator('.simulacion-selector-metros > summary').click();await f().locator('.simulacion-selector-metros__opciones [data-metro="todas"]').click();}
  await f().locator('#velocidadUnidad').fill(String(valor));
  const guardado=pagina.waitForResponse(r=>r.url().includes('/unidades/')&&r.request().method()==='PATCH'&&r.ok());
  await f().locator('.simulacion-parametro-velocidad button[type="submit"]').click();await guardado;
  await f().locator('.simulacion-parametro-velocidad button[type="submit"]').waitFor();
  await f().waitForFunction(()=>!document.querySelector('#velocidadUnidad')?.disabled);
 }
 async function horas(valor){await f().locator('#duracionSimulacion').fill(String(valor));await f().locator('#aplicarUnidadTiempo').click();}
 async function ejecutar(){
  await presentaciones();
  const resultado=pagina.waitForResponse(r=>r.url().endsWith('/evaluar')&&r.request().method()==='POST'&&r.ok(),{timeout:45000});
  await f().getByRole('button',{name:'Iniciar simulación',exact:true}).click();
  const e=await (await resultado).json();
  await f().waitForFunction(()=>window.leerEstadoPrueba?.().estado==='FINALIZADA');
  console.log('EJECUCIÓN',e.completado,await f().evaluate(()=>window.leerEstadoPrueba()));
  if (!e.completado) await presentaciones();return e;
 }
 const geo=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/mapa/datos/barrios_wgs84.geojson'),'utf8'));
 const coords=[];function recolectar(c){if(typeof c[0]==='number')coords.push(c);else c.forEach(recolectar);}
 geo.features.forEach(ft=>recolectar(ft.geometry.coordinates));
 const xs=coords.map(c=>c[0]),ys=coords.map(c=>c[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const puntos=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
 const poi=id=>{const p=puntos.find(p=>p.id===id);return [(p.longitud-minX)/(maxX-minX)*1000,(maxY-p.latitud)/(maxY-minY)*620];};
 let bloqueo=false;
 for(const nivel of niveles) { if(bloqueo) break; await t.test(`Nivel ${nivel.numero}: construir, guardar, simular, 100% y siguiente`,async()=>{
  try {
   await editor();
   assert.equal(await f().evaluate(()=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual.estaciones.length),0);
   const posiciones=Array.from({length:nivel.reglasExito.minimoEstaciones},(_,i)=>[580+i*45,460]);
   const objetivos=nivel.reglasExito.puntosInteresObjetivo||[];
   for(let i=0;i<objetivos.length;i++) posiciones[i]=poi(objetivos[i].idPunto);
   if(objetivos.length){
    await f().locator('.metronet-poi > summary').click();
    await f().locator('.metronet-panel-puntos-alternar').click();
    await f().getByRole('searchbox',{name:'Buscar punto de interés'}).fill('Palacio Legislativo');
    await f().locator('.metronet-panel-puntos-lista button').filter({hasText:'Palacio Legislativo'}).first().click();
    await presentaciones();
   }
   await herramienta('estaciones');
   for(let i=0;i<posiciones.length;i++){await mapa(...posiciones[i]);await cuenta('estaciones',i+1);}
   const dos=nivel.reglasExito.minimoLineas===2;
   await herramienta('lineas');await mapa(...posiciones[0]);await mapa(...posiciones[1]);await cuenta('lineas',1);
   let tramos=1;
   if(posiciones.length>(dos?3:2)) {
    await herramienta('conexiones');
    await mapa(...posiciones[1]);
    for(let i=2;i<posiciones.length-(dos?1:0);i++){await mapa(...posiciones[i]);await cuenta('tramos',++tramos);}
   }
   if(dos){await herramienta('lineas');await mapa(...posiciones.at(-2));await mapa(...posiciones.at(-1));await cuenta('lineas',2);}
   await herramienta('metros');
   const medio=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
   for(let i=0;i<nivel.reglasExito.minimoMetros;i++){
    await mapa(...(dos&&i===1?medio(posiciones.at(-2),posiciones.at(-1)):medio(posiciones[0],posiciones[1])));
    await cuenta('unidadesMetro',i+1);
   }
   const guardado=pagina.waitForResponse(r=>r.url().endsWith('/evaluar')&&r.request().method()==='POST'&&r.ok());
   await f().locator('[data-guardar]').click();
   const evaluacionGuardado=await (await guardado).json();
   assert.equal(evaluacionGuardado.puntaje,100,'Cada nivel empieza con cien puntos');
   assert.equal(evaluacionGuardado.completado,false,'Guardar no reemplaza la simulación pendiente');
   assert.equal(evaluacionGuardado.desempeno.desglosePuntuacion.totalDescontado,0);
   assert.equal(evaluacionGuardado.desempeno.desglosePuntuacion.practicasGratuitas,politica.practicasGratuitasPorNivel[nivel.numero-1]);
   await f().waitForFunction(()=>!juegoPrueba.scene.getScene('MapaScene').editorRedMetro.finalizacionEnCurso);
   await presentaciones();
   await f().locator('[data-ir-simulacion]').click();
   await f().locator('#formularioEjecucion').waitFor();
   if([1,2,3,4,9].includes(nivel.numero)) await f().locator('.metronet-recorrido').waitFor();
   await presentaciones();
   assert.equal(await f().locator('#unidadDuracionSimulacion').innerText(),'h');
   let resultado=await ejecutar();
   const esperado=puntosEsperados[nivel.numero-1];
   if(esperado<100){
    assert.equal(resultado.completado,false);
    const gratuitas=politica.practicasGratuitasPorNivel[nivel.numero-1];
    const cantidadDescuentos=(100-esperado)/10;
    for(let ejecucion=2;ejecucion<=gratuitas+cantidadDescuentos;ejecucion++){
     resultado=await ejecutar();
     assert.equal(resultado.completado,false,'Los puntos no aprueban objetivos pendientes');
     assert.equal(resultado.puntaje,100-10*Math.max(0,ejecucion-gratuitas));
    }
    assert.equal(resultado.desempeno.desglosePuntuacion.descuentos.length,cantidadDescuentos);
    if(esperado===60){resultado=await ejecutar();assert.equal(resultado.puntaje,60,'El tope permite seguir jugando');}
   }
   if(nivel.numero===2){
    assert.equal(resultado.completado,false);
    await aplicarUv(5);resultado=await ejecutar();
   }
   if(nivel.numero===3){assert.equal(resultado.completado,false);await horas(8);resultado=await ejecutar();}
   if([4,10].includes(nivel.numero)){
    assert.equal(resultado.completado,false);await aplicarUv(5);resultado=await ejecutar();
    assert.equal(resultado.completado,false);await aplicarUv(3,true);resultado=await ejecutar();
   }
   if(nivel.numero===8){assert.equal(resultado.completado,false);await aplicarUv(3,true);resultado=await ejecutar();}
   if([9,10].includes(nivel.numero)){assert.equal(resultado.completado,false);await aplicarUv(6);await horas(8);resultado=await ejecutar();}
   assert.equal(resultado.completado,true);assert.equal(resultado.puntaje,esperado);
   assert.equal(resultado.modoLibreDesbloqueado,nivel.numero===10);
   console.log(JSON.stringify({nivel:nivel.numero,editor:'PASS',guardar:'PASS',simular:'PASS',reglas:'PASS',puntaje:resultado.puntaje}));
   {
    const puntos=f().locator('.metronet-resultado-nivel[open]');
    await puntos.waitFor();
    assert.match(await puntos.innerText(), new RegExp(`Ganaste\\s+${esperado}\\s+puntos`));
    if(esperado<100){
     const descuentos=puntos.locator('details');
     assert.equal(await descuentos.count(),(100-esperado)/10);
     assert.match(await puntos.innerText(),new RegExp(`Ejecución ${politica.practicasGratuitasPorNivel[nivel.numero-1]+1}\\s+Sin nuevos avances`));
    }
    assert.equal(await f().locator('.metronet-victoria').count(),0);
    await puntos.getByRole('button',{name:'Continuar',exact:true}).click();
    await f().waitForFunction(()=>document.querySelector('.metronet-premio[open] button') || [...document.querySelectorAll('button')].some(b=>b.textContent==='Jugar'));
    while(await f().locator('.metronet-premio[open] button').count()) {
     await f().locator('.metronet-premio[open] button').click();
     await f().waitForFunction(()=>document.querySelector('.metronet-premio[open] button') || [...document.querySelectorAll('button')].some(b=>b.textContent==='Jugar'));
    }
    await f().getByRole('button',{name:'Jugar',exact:true}).click();
   }
   if(nivel.numero===10) {
    await editor();
    assert.equal(await f().evaluate(()=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual.simulacion.modo),'EDICION_LIBRE');
    assert.equal(await f().locator('.metronet-recorrido').count(),0,'Modo Libre no repite el tutorial de campaña');
    console.log('MODO LIBRE: acceso real desde la victoria final PASS');
   }
   assert.deepEqual(errores,[]);assert.deepEqual(fallos,[]);
  }catch(e){
   bloqueo=true; console.log('FALLO ORIGINAL',e,'ERRORES',errores,fallos);
   try {
    const frame=f();
    if(frame) console.log('ESTADO UI',await frame.evaluate(()=>window.leerEstadoPrueba?.()),(await frame.locator('body').innerText()).slice(-9000));
    await pagina.screenshot({path:`/tmp/metronet-campana-nivel-${nivel.numero}.png`});
   } catch(diagnostico) {console.log('DIAGNOSTICO NO DISPONIBLE',diagnostico.message);}
   throw e;
  }
 }); }
 assert.equal(bloqueo,false,'La campaña no puede continuar después de un nivel bloqueado');
 assert.deepEqual(errores,[]);assert.deepEqual(fallos,[]);
});
