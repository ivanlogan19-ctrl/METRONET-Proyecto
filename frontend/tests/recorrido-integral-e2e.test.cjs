const {test}=require('node:test');
const assert=require('node:assert/strict');
const niveles=require('../src/educacion/recorrido-integral.json');
const politica=require('../src/educacion/puntuacion-progreso.json');
const puntosEsperados=Array(10).fill(100);
const premiosFinales=['corona','biblioteca','copa'];
const { abrirNavegador } = require('./soporte/navegador.cjs');
const BASE=process.env.METRONET_URL_PRUEBAS||'http://127.0.0.1:5198';
const API=process.env.METRONET_API_PRUEBAS;

test('campaña integral real: login → diez niveles → Modo Libre', {skip:!API,timeout:1100000}, async t=>{
 let navegador,contexto,pagina;
 const errores=[],fallos=[],evaluaciones=[];
 const solicitudesPendientes=new Set(),fallosRed=[];
 t.after(async()=>{await contexto?.unrouteAll({behavior:'wait'});await navegador?.close();});
 async function abrirSesion() {
  solicitudesPendientes.clear();
  navegador=await abrirNavegador({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});
  contexto=await navegador.newContext({viewport:{width:1440,height:1000}});
  const servidorEfimero=API!=='http://127.0.0.1:8080';
  if(servidorEfimero && (process.env.METRONET_BROWSER||'chromium')==='chromium') {
   await contexto.grantPermissions(['local-network-access'],{origin:BASE});
  }
  // La campaña verifica una versión fija: conserva las utilidades CSS de Vite
  // pero no abre el canal de recarga de desarrollo durante las reaperturas.
  await contexto.route('**/@vite/client',async ruta=>{
   const respuesta=await ruta.fetch(),contenido=await respuesta.text();
   const conexion='transport.connect(createHMRHandler(handleMessage));';
   assert.ok(contenido.includes(conexion),'Reconocer el arranque del canal de desarrollo');
   await ruta.fulfill({response:respuesta,body:contenido.replace(conexion,'')});
  });
  // Conserva la política del producto, autorizando únicamente el servidor
  // efímero de esta prueba tanto en la cabecera como en la etiqueta HTML.
  if(servidorEfimero) await contexto.route(url=>url.origin===new URL(BASE).origin && (url.pathname==='/' || url.pathname.endsWith('.html')),async ruta=>{
   const respuesta=await ruta.fetch();
   const cabeceras=respuesta.headers();
   const adaptar=texto=>texto.replaceAll('http://127.0.0.1:8080',API)
    .replaceAll('ws://127.0.0.1:5173',BASE.replace('http:','ws:'));
   cabeceras['content-security-policy']=adaptar(cabeceras['content-security-policy']);
   const contenido=(await respuesta.text()).replace(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi,adaptar);
   await ruta.fulfill({response:respuesta,headers:cabeceras,body:contenido});
  });
  // Cambia solo el destino del backend de prueba. El navegador envía HTTP real,
  // conserva los cuerpos POST y comprueba CORS también en Firefox oficial.
  if(servidorEfimero) await contexto.addInitScript(api=>{
   const original=window.fetch.bind(window);
   window.fetch=(entrada,opciones)=>{
    const url=new URL(entrada instanceof Request?entrada.url:String(entrada),location.href);
    if(url.hostname==='127.0.0.1' && url.port==='8080') {
     const destino=api+url.pathname+url.search;
     entrada=entrada instanceof Request?new Request(destino,entrada):destino;
    }
    return original(entrada,opciones);
   };
  },API);
  pagina=await contexto.newPage();pagina.setDefaultTimeout(20000);
  pagina.on('request',solicitud=>solicitudesPendientes.add(solicitud));
  pagina.on('requestfinished',solicitud=>solicitudesPendientes.delete(solicitud));
  pagina.on('requestfailed',solicitud=>{
   solicitudesPendientes.delete(solicitud);
   fallosRed.push({url:solicitud.url(),error:solicitud.failure()?.errorText});
  });
  pagina.on('pageerror',e=>errores.push(e.message));
  pagina.on('response',async r=>{
   if(/\/(?:api|auth)\//.test(r.url())&&r.status()>=400) fallos.push([new URL(r.url()).pathname,r.status()]);
   if(r.url().endsWith('/evaluar')&&r.ok()) evaluaciones.push(await r.json());
  });
  await contexto.route('**/src/main.js*',async route=>{
   const respuesta=await route.fetch();
   await route.fulfill({response:respuesta,body:(await respuesta.text()).replace('let juego = new Phaser.Game(config);','let juego = new Phaser.Game(config); window.juegoPrueba = juego;')});
  });
  await contexto.route('**/src/simulacion/simulacion.js*',async route=>{
   const respuesta=await route.fetch();
   await route.fulfill({response:respuesta,body:(await respuesta.text())+'\nwindow.leerEstadoPrueba=()=>({tutorial:tutorialSimulacion?.indice,estado:estadoMotor?.estado,resultadoEnCurso});'});
  });
 }
 await abrirSesion();
 await pagina.goto(BASE+'/login.html');
 await pagina.locator('#pantalla-metronet').waitFor();
 const f=()=>pagina.frames().find(frame=>frame.parentFrame());
 await f().locator('#email').fill(process.env.METRONET_E2E_EMAIL);
 await f().locator('#password').fill(process.env.METRONET_E2E_CLAVE);
 await f().locator('#loginButton').click();
 try {
  await pagina.waitForFunction(()=>document.querySelector('#pantalla-metronet')?.contentWindow?.document.querySelector('[data-continuar-bienvenida], #accionesInicio'));
 } catch(error) {
  console.log('LOGIN QA',errores,fallos,pagina.frames().map(frame=>frame.url()));
  for(const frame of pagina.frames())console.log((await frame.locator('body').innerText()).slice(-3000));
  throw error;
 }
 const bienvenidaInicial=f().locator('[data-continuar-bienvenida]');
 if(await bienvenidaInicial.isVisible())await bienvenidaInicial.click();
 await f().locator('#accionesInicio[aria-busy="false"]').waitFor();
 await f().getByRole('link',{name:'Niveles',exact:true}).first().click();
 await f().getByRole('button',{name:'Iniciar',exact:true}).click();
 await f().getByRole('button',{name:'Iniciar nivel',exact:true}).click();

 async function presentaciones() {
  for(let i=0;i<35;i++) {
   const frame=f();
   const tarjeta=frame.locator('dialog[open] .metronet-tarjeta-educativa__acciones button');
   const siguiente=frame.locator('.metronet-recorrido [data-recorrido-siguiente]:visible');
   const oferta=frame.getByRole('button',{name:'Continuar',exact:true});
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
 async function escribirNumero(selector,valor) {
  const campo=f().locator(selector);
  // Firefox oficial requiere borrar por teclado: fill puede anexar decimales.
  await campo.click();await campo.press('ControlOrMeta+A');await campo.press('Backspace');
  await campo.pressSequentially(String(valor));
  assert.equal(await campo.inputValue(),String(valor),'El control conserva el número introducido');
 }
 async function aplicarUv(valor){
  await presentaciones();
  await f().locator('.simulacion-selector-metros > summary').click();
  await f().locator('.simulacion-selector-metros__opciones button').first().click();
  await escribirNumero('#velocidadUnidad',valor);
  const guardado=pagina.waitForResponse(r=>r.url().includes('/unidades/')&&r.request().method()==='PATCH'&&r.ok());
  await f().locator('.simulacion-parametro-velocidad button[type="submit"]').click();await guardado;
  await f().locator('.simulacion-parametro-velocidad button[type="submit"]').waitFor();
  await f().waitForFunction(()=>!document.querySelector('#velocidadUnidad')?.disabled);
 }
 async function horas(valor){
  await escribirNumero('#duracionSimulacion',valor);
  const guardado=pagina.waitForResponse(r=>r.url().includes('/unidades/')&&r.request().method()==='PATCH'&&r.ok());
  await f().locator('#aplicarUnidadTiempo').click();await guardado;
  await f().waitForFunction(()=>!document.querySelector('#duracionSimulacion')?.disabled);
 }
 async function leerAvance(){
  return f().evaluate(async()=>{
   const {consultarJuego}=await import('/src/educacion/ClientePuntuacion.js');
   const id=Number(new URLSearchParams(location.search).get('idDiseno'));
   const [consigna,desempeno,progreso]=await Promise.all([
    consultarJuego(`/disenos/${id}/consigna`),consultarJuego(`/disenos/${id}/desempeno`),consultarJuego('/progreso')]);
   return {consigna,listo:consigna.estadoGlobal==='LISTO',puntaje:desempeno.puntaje,desempeno,progreso};
  });
 }
 async function fotografiaRed() {
  return f().evaluate(()=>{
   const e=juegoPrueba.scene.getScene('MapaScene').editorRedMetro,d=e.disenoActual;
   return {id:e.idDiseno(),estaciones:d.estaciones,lineas:d.lineas,tramos:d.tramos,metros:d.unidadesMetro};
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
  const esperados=completados===10?[...premiosFinales,'estacion','camino']:completados>=5?['estacion','camino']:completados>=1?['estacion']:[];
  assert.deepEqual(coleccion.trofeos.filter(t=>t.obtenido).map(t=>t.id),esperados);
 }
 async function ejecutar(){
  await presentaciones();
  const previas=evaluaciones.length;
  const resultado=pagina.waitForResponse(r=>r.url().endsWith('/ejecutar')&&r.request().method()==='POST'&&r.ok(),{timeout:45000});
  await f().getByRole('button',{name:'Iniciar simulación',exact:true}).click();
  await resultado;
  // El motor admite hasta 18 s visuales a ritmo 0,5×: esperar su final real.
  await f().waitForFunction(()=>window.leerEstadoPrueba?.().estado==='FINALIZADA'&&!window.leerEstadoPrueba().resultadoEnCurso,null,{timeout:45000});
  assert.equal(evaluaciones.length,previas,'Simular no solicita aprobación');
  assert.equal(await f().locator('.metronet-resultado-nivel, .metronet-victoria').count(),0);
  const e=await leerAvance();
  console.log('EJECUCIÓN',JSON.stringify({lista:e.listo,puntaje:e.puntaje}));
  await presentaciones();return e;
 }
 const referencias=JSON.parse(require('node:fs').readFileSync(process.env.METRONET_E2E_REFERENCIAS,'utf8'));
 const puntos=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
 let bloqueo=false;
 for(const nivel of niveles) { if(bloqueo) break; await t.test(`Nivel ${nivel.numero}: construir, guardar, simular, cerrar, reabrir y finalizar`,async()=>{
  try {
   await editor(nivel.numero);
   assert.equal(await f().evaluate(()=>juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual.estaciones.length),0);
   const red=referencias[nivel.numero-1];
   const posiciones=red.estaciones.map(e=>[e.x,e.y]);
   const porNombre=Object.fromEntries(red.estaciones.map(e=>[e.nombre,[e.x,e.y]]));
   const objetivos=nivel.reglasExito.puntosInteresObjetivo||[];

   if(objetivos.length){
    await f().locator('.metronet-poi > summary').click();
    await f().locator('.metronet-panel-puntos-alternar').click();
    await f().getByRole('searchbox',{name:'Buscar punto de interés'}).fill(puntos.find(p=>p.id===objetivos[0].idPunto).nombre);
    await f().locator('.metronet-panel-puntos-lista button').filter({hasText:puntos.find(p=>p.id===objetivos[0].idPunto).nombre}).first().click();
    await presentaciones();
   }
   await herramienta('estaciones');
   for(let i=0;i<posiciones.length;i++){await mapa(...posiciones[i]);await cuenta('estaciones',i+1);}
   let tramos=0;
   for(const [indice,linea] of red.lineas.entries()) {
    const recorrido=red.tramos.filter(t=>t.linea===linea.nombre);
    await herramienta('lineas');await mapa(...porNombre[recorrido[0].a]);await mapa(...porNombre[recorrido[0].b]);await cuenta('lineas',indice+1);tramos++;
    if(recorrido.length>1) {
     await herramienta('conexiones');await mapa(...porNombre[recorrido[0].b]);
     for(const t of recorrido.slice(1)){await mapa(...porNombre[t.b]);await cuenta('tramos',++tramos);}
    }
   }
   await herramienta('metros');
   for(const [indice,unidad] of red.unidades.entries()) {
    const tramo=red.tramos.find(t=>t.linea===unidad.linea);
    const a=porNombre[tramo.a],b=porNombre[tramo.b];
    await mapa((a[0]+b[0])/2,(a[1]+b[1])/2);await cuenta('unidadesMetro',indice+1);
   }
   const evaluacionesAntes=evaluaciones.length;
   const guardado=pagina.waitForResponse(r=>r.url().endsWith('/guardar')&&r.request().method()==='POST'&&r.ok());
   await f().locator('[data-guardar]').click();await guardado;
   await f().waitForFunction(()=>!juegoPrueba.scene.getScene('MapaScene').editorRedMetro.finalizacionEnCurso);
   const avanceGuardado=await leerAvance();
   assert.equal(evaluaciones.length,evaluacionesAntes,'Guardar no solicita aprobación');
   assert.equal(avanceGuardado.consigna.condiciones.length,5+objetivos.length,'Cinco objetivos reales más los POI aprobados');
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
   // El usuario cambia un solo control antes de su primera simulación.
   const practica=nivel.reglasExito.configuracionRecorrido.practica;
   if(practica==='aumentarUV'||practica==='cambiar') await aplicarUv(2);
   if(practica==='reducirUV') await aplicarUv(0.5);
   if(practica==='aumentarUT') await horas(100);
   if(practica==='reducirUT') await horas(0.5);
   const resultado=await ejecutar(),esperado=puntosEsperados[nivel.numero-1];
   assert.equal(resultado.consigna.progreso,100);
   assert.equal(resultado.listo,true);assert.equal(resultado.puntaje,esperado);
   assert.equal(resultado.progreso.nivelesCompletados,nivel.numero-1,'Ni Guardar ni Simular aprueban');
   assert.equal(resultado.progreso.modoLibreDesbloqueado,false);
   if(nivel.numero<10) assert.equal(resultado.progreso.escenarios.find(e=>e.numero===nivel.numero+1).desbloqueado,false);
   await f().locator('#volverEdicion').click();await editor();
   const antesDeCerrar=await fotografiaRed();
   await contexto.unrouteAll({behavior:'wait'});
   await navegador.close();
   await abrirSesion();
   await pagina.goto(BASE+'/login.html');
   await pagina.locator('#pantalla-metronet').waitFor();
   await f().locator('#email').fill(process.env.METRONET_E2E_EMAIL);
   await f().locator('#password').fill(process.env.METRONET_E2E_CLAVE);
   await f().locator('#loginButton').click();
   await pagina.waitForFunction(()=>document.querySelector('#pantalla-metronet')?.contentWindow?.document.querySelector('[data-continuar-bienvenida], #accionesInicio[aria-busy="false"]'));
   const bienvenida=f().locator('[data-continuar-bienvenida]');
   if(await bienvenida.isVisible())await bienvenida.click();
   await f().locator('#accionesInicio[aria-busy="false"]').waitFor();
   await f().getByRole('link',{name:'Mis diseños',exact:true}).first().click();
   await f().locator(`[data-diseno="${antesDeCerrar.id}"]`).getByRole('link',{name:/^Abrir diseño:/}).click();
   await editor(nivel.numero);
   assert.deepEqual(await fotografiaRed(),antesDeCerrar,'Cerrar todo el navegador y volver a entrar conserva la red guardada');
   const recuperado=await leerAvance();
   assert.equal(recuperado.progreso.nivelesCompletados,nivel.numero-1,'Reabrir no aprueba ni duplica el intento');
   assert.equal(recuperado.puntaje,resultado.puntaje,'El puntaje se recupera de la base');
   assert.deepEqual(recuperado.consigna.condiciones,resultado.consigna.condiciones,'Metas y POI completados se conservan');
   assert.deepEqual(recuperado.desempeno.desglosePuntuacion,resultado.desempeno.desglosePuntuacion,'Simulaciones y descuentos se conservan');
   console.log(`PERSISTENCIA NIVEL ${nivel.numero}: navegador cerrado, sesión nueva, mismo diseño, estaciones, líneas, conexiones, metros, UV/UT, metas y puntaje PASS`);
   await f().locator('[data-guardar]').click();
   await f().waitForFunction(()=>!juegoPrueba.scene.getScene('MapaScene').editorRedMetro.finalizacionEnCurso);
   assert.equal((await leerAvance()).progreso.nivelesCompletados,nivel.numero-1,'Guardar una red lista tampoco aprueba');
   await comprobarColeccion(nivel.numero-1);
   const cierre=pagina.waitForResponse(r=>r.url().endsWith('/evaluar')&&r.request().method()==='POST'&&r.ok());
   await f().getByRole('button',{name:'Finalizar red',exact:true}).click();
   const aprobado=await(await cierre).json();
   assert.equal(aprobado.completado,true);assert.equal(aprobado.puntaje,esperado);
   assert.equal(aprobado.modoLibreDesbloqueado,nivel.numero===10);
   const nuevosEsperados=nivel.numero===1?['estacion']:nivel.numero===5?['camino']:nivel.numero===10?premiosFinales:[];
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
    if(esperado===60) await pagina.screenshot({path:`/tmp/metronet-aprobado-60-nivel-${nivel.numero}.png`});
    assert.equal(await f().locator('.metronet-victoria').count(),0);
    await puntos.getByRole('button',{name:'Continuar',exact:true}).click();
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
   console.log('RED PENDIENTE',[...solicitudesPendientes].map(s=>s.url()),'FALLOS DE RED',fallosRed.slice(-20));
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
