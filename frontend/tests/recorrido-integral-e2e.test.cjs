const {test}=require('node:test');
const assert=require('node:assert/strict');
const niveles=require('../src/educacion/recorrido-integral.json');
const politica=require('../src/educacion/puntuacion-progreso.json');
// Las variantes completas de cada nivel se prueban también en PostgreSQL.
// Este recorrido comprueba los cinco puntajes en la interfaz y su transición al siguiente nivel.
const puntosEsperados=Array(10).fill(100);
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
   const oferta=frame.getByRole('button',{name:'Comenzar directamente',exact:true});
   if(await oferta.count()) await oferta.click();
   else if(await tarjeta.count()) await tarjeta.first().click();
   else if(await siguiente.count()) await siguiente.click();
   else if(await frame.locator('.metronet-recorrido[data-objetivo="fin"]').count())
    await frame.locator('.metronet-recorrido[data-objetivo="fin"]').waitFor({state:'detached',timeout:5000});
   else if(await frame.locator('.metronet-recorrido[open]').count()) await frame.locator('body').press('Escape');
   else break;
  }
 }
 async function editor(numeroEsperado) {
  for (let i=0;i<8;i++) {
   // La navegación persistente reemplaza el iframe: esperar el documento
   // entrante antes de obtener su Frame, sin asumir que ya existe tras Jugar.
   await pagina.waitForFunction(numero=>{
    const vista=document.querySelector('#pantalla-metronet')?.contentWindow;
    const editor=vista?.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro;
    return vista?.document.querySelector('dialog[open] .metronet-tarjeta-educativa__acciones button, .metronet-premio[open] button')
     || (editor?.disenoActual && (numero===undefined || editor.escenarioJuegoActual?.numero===numero));
   },numeroEsperado);
   await f().waitForFunction(numero=>{
    const editor=window.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro;
    return document.querySelector('dialog[open] .metronet-tarjeta-educativa__acciones button, .metronet-premio[open] button')
     || (editor?.disenoActual && (numero===undefined || editor.escenarioJuegoActual?.numero===numero));
   },numeroEsperado);
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
  let punto;
  for (let ajuste=0; ajuste<8; ajuste++) {
   punto=await frame.evaluate(({x,y})=>{
   const capa=juegoPrueba.scene.getScene('MapaScene').editorRedMetro.capaRedMetro;
   const p=capa.convertirPosicion(x,y),cam=capa.escena.cameras.main;
   const c=capa.escena.game.canvas.getBoundingClientRect();
   // Leer la cámara solo para localizar el clic real. No se altera estado ni progreso.
   const sx=c.left+(p.x-cam.worldView.x)*cam.zoom, sy=c.top+(p.y-cam.worldView.y)*cam.zoom;
   return {x:sx,y:sy,visible:sx>c.left+12&&sx<c.right-12&&sy>c.top+12&&sy<c.bottom-12};
   },{x,y});
   if (punto.visible) break;
   await frame.getByRole('button',{name:'Alejar mapa',exact:true}).click();
   await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  assert.ok(punto.visible,'El clic debe quedar dentro del mapa visible');
  const iframe=await pagina.locator('#pantalla-metronet').boundingBox();
  await pagina.mouse.click(punto.x+iframe.x,punto.y+iframe.y);
 }
 async function cuenta(tipo,n) {
  await f().waitForFunction(({tipo,n})=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual[tipo].length===n,{tipo,n});
  await presentaciones();
 }
 async function herramienta(clave){await presentaciones();await f().locator(`[data-elegir-herramienta="${clave}"]`).click();}
 async function aplicarUv(valor){
  await presentaciones();
  await f().locator('.simulacion-selector-metros > summary').click();
  await f().locator('.simulacion-selector-metros__opciones button').first().click();
  await f().locator('#velocidadUnidad').fill(String(valor));
  const guardado=pagina.waitForResponse(r=>r.url().includes('/unidades/')&&r.request().method()==='PATCH'&&r.ok());
  await f().locator('.simulacion-parametro-velocidad button[type="submit"]').click();await guardado;
  await f().locator('.simulacion-parametro-velocidad button[type="submit"]').waitFor();
  await f().waitForFunction(()=>!document.querySelector('#velocidadUnidad')?.disabled);
 }
 async function horas(valor){await f().locator('#duracionSimulacion').fill(String(valor));await f().locator('#aplicarUnidadTiempo').click();}
 async function leerAvance(){
  return f().evaluate(async()=>{
   const {consultarJuego}=await import('/src/educacion/ClientePuntuacion.js');
   const id=Number(new URLSearchParams(location.search).get('idDiseno'));
   const [consigna,desempeno,progreso]=await Promise.all([
    consultarJuego(`/disenos/${id}/consigna`),consultarJuego(`/disenos/${id}/desempeno`),consultarJuego('/progreso')]);
   return {consigna,listo:consigna.estadoGlobal==='LISTO',puntaje:desempeno.puntaje,desempeno,progreso};
  });
 }
 async function comprobarColeccion(completados) {
  const coleccion = await f().evaluate(async () => {
   const {consultarJuego} = await import('/src/educacion/ClientePuntuacion.js');
   const [tarjetas, trofeos] = await Promise.all([consultarJuego('/aprendizaje'), consultarJuego('/trofeos')]);
   return {tarjetas, trofeos};
  });
  assert.deepEqual(coleccion.tarjetas.filter(n=>n.desbloqueado).map(n=>n.numero), Array.from({length:completados},(_,i)=>i+1));
  for(const n of coleccion.tarjetas) {
   if(n.desbloqueado) assert.equal(n.contenido.tarjetas.length,7,`Siete tarjetas ganadas en nivel ${n.numero}`);
   else assert.equal(n.contenido,null,'No adelantar tarjetas de niveles pendientes');
  }
  const esperados=completados===10?['corona','biblioteca','copa','estacion','camino']:completados>=5?['estacion','camino']:completados>=1?['estacion']:[];
  assert.deepEqual(coleccion.trofeos.filter(t=>t.obtenido).map(t=>t.id),esperados);
 }
 async function ejecutar(){
  await presentaciones();
  const previas=evaluaciones.length;
  const resultado=pagina.waitForResponse(r=>r.url().endsWith('/ejecutar')&&r.request().method()==='POST'&&r.ok(),{timeout:45000});
  await f().getByRole('button',{name:'Iniciar simulación',exact:true}).click();
  await resultado;
  await f().waitForFunction(()=>window.leerEstadoPrueba?.().estado==='FINALIZADA'&&!window.leerEstadoPrueba().resultadoEnCurso);
  assert.equal(evaluaciones.length,previas,'Simular no solicita aprobación');
  assert.equal(await f().locator('.metronet-resultado-nivel, .metronet-victoria').count(),0);
  const e=await leerAvance();
  console.log('EJECUCIÓN',JSON.stringify({lista:e.listo,puntaje:e.puntaje}));
  await presentaciones();return e;
 }
 const geo=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/mapa/datos/barrios_wgs84.geojson'),'utf8'));
 const coords=[];function recolectar(c){if(typeof c[0]==='number')coords.push(c);else c.forEach(recolectar);}
 geo.features.forEach(ft=>recolectar(ft.geometry.coordinates));
 const xs=coords.map(c=>c[0]),ys=coords.map(c=>c[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const puntos=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
 const poi=id=>{const p=puntos.find(p=>p.id===id);return [(p.longitud-minX)/(maxX-minX)*1000,(maxY-p.latitud)/(maxY-minY)*620];};
 let bloqueo=false;
 for(const nivel of niveles) { if(bloqueo) break; await t.test(`Nivel ${nivel.numero}: construir, guardar, simular, finalizar explícitamente y siguiente`,async()=>{
  try {
   await editor(nivel.numero);
   assert.equal(await f().evaluate(()=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual.estaciones.length),0);
   const posiciones=Array.from({length:nivel.reglasExito.minimoEstaciones},(_,i)=>[580+i*45,460]);
   const objetivos=nivel.reglasExito.puntosInteresObjetivo||[];
   for(let i=0;i<objetivos.length;i++) posiciones[i]=poi(objetivos[i].idPunto);

   if(objetivos.length){
    await f().locator('.metronet-poi > summary').click();
    await f().locator('.metronet-panel-puntos-alternar').click();
    await f().getByRole('searchbox',{name:'Buscar punto de interés'}).fill(puntos.find(p=>p.id===objetivos[0].idPunto).nombre);
    await f().locator('.metronet-panel-puntos-lista button').filter({hasText:puntos.find(p=>p.id===objetivos[0].idPunto).nombre}).first().click();
    await presentaciones();
   }
   await herramienta('estaciones');
   for(let i=0;i<posiciones.length;i++){await mapa(...posiciones[i]);await cuenta('estaciones',i+1);}
   const dos=nivel.reglasExito.minimoLineas===2||nivel.reglasExito.minimoTransbordos>0;
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
   const evaluacionesAntes=evaluaciones.length;
   const guardado=pagina.waitForResponse(r=>r.url().endsWith('/guardar')&&r.request().method()==='POST'&&r.ok());
   await f().locator('[data-guardar]').click();await guardado;
   await f().waitForFunction(()=>!juegoPrueba.scene.getScene('MapaScene').editorRedMetro.finalizacionEnCurso);
   const avanceGuardado=await leerAvance();
   assert.equal(evaluaciones.length,evaluacionesAntes,'Guardar no solicita aprobación');
   assert.equal(avanceGuardado.consigna.condiciones.length,nivel.numero<6?5:8,'Cinco objetivos reales más tres POI cuando corresponde');
   assert.equal(avanceGuardado.puntaje,100,'Cada nivel empieza con cien puntos');
   assert.equal(avanceGuardado.listo,false,'Guardar no reemplaza la simulación pendiente');
   assert.equal(avanceGuardado.desempeno.desglosePuntuacion.totalDescontado,0);
   assert.equal(avanceGuardado.desempeno.desglosePuntuacion.practicasGratuitas,politica.practicasGratuitasPorNivel[nivel.numero-1]);
   await presentaciones();
   await f().locator('[data-ir-simulacion]').click();
   await f().locator('#formularioEjecucion').waitFor();
   await f().locator('#velocidadUnidad').waitFor();
   await f().waitForFunction(()=>!document.querySelector('#formularioEjecucion button[type=submit]').disabled);
   await presentaciones();
   assert.equal(await f().locator('#unidadDuracionSimulacion').innerText(),'UT');
   let resultado=await ejecutar();
   const esperado=puntosEsperados[nivel.numero-1];
   if(esperado<100){
    assert.equal(resultado.listo,false);
    // La primera ejecución cumple objetivos; repetirla sin cambios ya no tiene exenciones.
    const cantidadDescuentos=(100-esperado)/10;
    for(let ejecucion=2;ejecucion<=1+cantidadDescuentos;ejecucion++){
     resultado=await ejecutar();
     assert.equal(resultado.listo,false,'Los puntos no aprueban objetivos pendientes');
     assert.equal(resultado.puntaje,100-10*Math.max(0,ejecucion-1));
    }
    assert.equal(resultado.desempeno.desglosePuntuacion.descuentos.length,cantidadDescuentos);
    if(esperado===60){resultado=await ejecutar();assert.equal(resultado.puntaje,60,'El tope permite seguir jugando');}
   }
   if(nivel.numero===2){
    assert.equal(resultado.listo,false);
    await aplicarUv(5);resultado=await ejecutar();
   }
   if(nivel.numero===3){assert.equal(resultado.listo,false);await horas(8);resultado=await ejecutar();}
   if(nivel.numero===4){
    assert.equal(resultado.listo,false);await aplicarUv(5);resultado=await ejecutar();
    assert.equal(resultado.listo,false);await horas(8);resultado=await ejecutar();
   }
   if(nivel.numero===8){assert.equal(resultado.listo,false);await aplicarUv(3,true);resultado=await ejecutar();}
   if([9,10].includes(nivel.numero)){assert.equal(resultado.listo,false);await aplicarUv(6);await horas(8);resultado=await ejecutar();}
   assert.equal(resultado.consigna.progreso,100);
   assert.equal(resultado.listo,true);assert.equal(resultado.puntaje,esperado);
   assert.equal(resultado.progreso.nivelesCompletados,nivel.numero-1,'Ni Guardar ni Simular aprueban');
   assert.equal(resultado.progreso.modoLibreDesbloqueado,false);
   if(nivel.numero<10) assert.equal(resultado.progreso.escenarios.find(e=>e.numero===nivel.numero+1).desbloqueado,false);
   await f().locator('#volverEdicion').click();await editor();
   if(nivel.numero===1){
    // El contenedor vigente lleva toda recarga completa al login; retomar no debe aprobar ni crear otro intento.
    const idAntes=await f().evaluate(()=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.idDiseno());
    await pagina.reload();
    await pagina.waitForFunction(()=>document.querySelector('#pantalla-metronet')?.contentWindow?.document.querySelector('#loginButton'));
    await f().locator('#email').fill(process.env.METRONET_E2E_EMAIL);
    await f().locator('#password').fill(process.env.METRONET_E2E_CLAVE);
    await f().locator('#loginButton').click();
    await f().getByRole('link',{name:'Niveles',exact:true}).first().click({timeout:30000});
    await f().getByRole('button',{name:'Continuar',exact:true}).click();
    await f().getByRole('button',{name:'Jugar',exact:true}).click();
    await editor();
    assert.equal(await f().evaluate(()=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.idDiseno()),idAntes);
    assert.equal((await leerAvance()).progreso.nivelesCompletados,0,'Recargar y retomar no aprueba');
   }
   await f().locator('[data-guardar]').click();
   await f().waitForFunction(()=>!juegoPrueba.scene.getScene('MapaScene').editorRedMetro.finalizacionEnCurso);
   assert.equal((await leerAvance()).progreso.nivelesCompletados,nivel.numero-1,'Guardar una red lista tampoco aprueba');
   await comprobarColeccion(nivel.numero-1);
   const cierre=pagina.waitForResponse(r=>r.url().endsWith('/evaluar')&&r.request().method()==='POST'&&r.ok());
   await f().getByRole('button',{name:'Finalizar red',exact:true}).click();
   const aprobado=await(await cierre).json();
   assert.equal(aprobado.completado,true);assert.equal(aprobado.puntaje,esperado);
   assert.equal(aprobado.modoLibreDesbloqueado,nivel.numero===10);
   const nuevosEsperados=nivel.numero===1?['estacion']:nivel.numero===5?['camino']:nivel.numero===10?['corona','biblioteca','copa']:[];
   assert.deepEqual(aprobado.trofeosNuevos.map(t=>t.id),nuevosEsperados,'Premios solo al cumplir su requisito');
   await comprobarColeccion(nivel.numero);
   assert.deepEqual(aprobado.desempeno.desglosePuntuacion,resultado.desempeno.desglosePuntuacion,'Finalizar no descuenta');
   console.log(JSON.stringify({nivel:nivel.numero,editor:'PASS',guardar:'PASS',simular:'PASS',finalizar:'PASS',reglas:'PASS',puntaje:resultado.puntaje}));
   {
    const puntos=f().locator('.metronet-resultado-nivel[open]');
    await puntos.waitFor();
    assert.match(await puntos.innerText(), new RegExp(`Ganaste\\s+${esperado}\\s+puntos`));
    if(esperado<100){
     const descuentos=puntos.locator('details');
     assert.equal(await descuentos.count(),(100-esperado)/10);
     assert.match(await puntos.innerText(),new RegExp(`Ejecución 2\\s+Sin nuevos avances`));
    }
    assert.equal(await f().locator('.metronet-victoria').count(),0);
    await puntos.getByRole('button',{name:'Continuar',exact:true}).click();
    await f().getByRole('button',{name:'Jugar',exact:true}).click();
    const premiosMostrados=[];
    for(let i=0;i<aprobado.trofeosNuevos.length;i++) {
     const dialogo=f().locator('.metronet-premio[open]');
     await dialogo.waitFor();
     premiosMostrados.push(await dialogo.locator('h3').textContent());
     await dialogo.getByRole('button',{name:'Continuar',exact:true}).click();
    }
    assert.deepEqual(premiosMostrados,aprobado.trofeosNuevos.map(t=>t.nombre),'Cada premio nuevo se presenta una vez en pantalla');
   }
   if(nivel.numero===10) {
    await editor(null);
    assert.equal(await f().evaluate(()=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual.simulacion.modo),'EDICION_LIBRE');
    assert.equal(await f().locator('.metronet-recorrido').count(),0,'Modo Libre no repite el tutorial de campaña');
    console.log('MODO LIBRE: acceso real desde la victoria final PASS');
   }
   assert.deepEqual(errores,[]);assert.deepEqual(fallos,[]);
  }catch(e){
   bloqueo=true; console.log('FALLO ORIGINAL',e,'ERRORES',errores,fallos,'PÁGINAS',pagina.frames().map(frame=>frame.url()));
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
