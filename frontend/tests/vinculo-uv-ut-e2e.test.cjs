const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const API=process.env.METRONET_API_PRUEBAS,BASE='http://127.0.0.1:5198';
test('Modo Libre: vínculo automático en controles, servidor, distancias y persistencia',{skip:!API,timeout:210000},async t=>{
 const browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route(/http:\/\/[^/]+:8080\//,route=>route.continue({url:API+new URL(route.request().url()).pathname+new URL(route.request().url()).search}));
 const page=await context.newPage();page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const vista=page.frameLocator('#pantalla-metronet');const frame=()=>page.frames().find(f=>f.parentFrame());
 await page.goto(BASE+'/login.html');await vista.locator('#email').fill('vinculo-browser@example.test');await vista.locator('#password').fill('VinculoQA!7');await vista.locator('#loginButton').click();
 await vista.locator('[data-continuar-bienvenida]').click();await vista.locator('#accionesInicio[aria-busy="false"]').waitFor();
 // Consulta de reglas desde la sesión real: misma navegación y API sin respuestas preparadas.
 await vista.getByRole('link',{name:'Reglas',exact:true}).click();
 await vista.getByRole('heading',{name:'Reglas del juego',exact:true}).waitFor();
 for(const tema of ['Puntuación','Cómo aprobar','Acciones','Modo Libre','Ranking']){
  await vista.getByRole('tab',{name:tema,exact:true}).click();
  assert.equal(await vista.getByRole('tabpanel').count(),1);
  assert.equal(await frame().evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await vista.getByRole('link',{name:'Inicio',exact:true}).click();
 await vista.locator('#accionesInicio[aria-busy="false"]').waitFor();
 const token=await frame().evaluate(()=>JSON.parse(localStorage.getItem('sesionUsuario')).token);
 const headers={Authorization:`Bearer ${token}`};
 async function req(method,path,data,expected=200){const r=await context.request.fetch(API+path,{method,headers,data});assert.equal(r.status(),expected,await r.text());return r.status()===200&&r.headers()['content-type']?.includes('json')?r.json():null;}
 const catalogo=await req('GET','/api/juego/escenarios');
 const libre=catalogo.find(e=>e.numero===null);
 const creada=await req('POST','/api/juego/escenarios/'+libre.idEscenario+'/iniciar',{});const id=creada.idDiseno,ruta='/api/simulaciones/'+id;
 for(const [nombre,x]of[['A',660],['B',670],['C',690],['D',675]])await req('POST',ruta+'/estaciones',{nombre,posicionX:x,posicionY:460});
 await req('POST',ruta+'/lineas',{nombre:'L01',estaciones:['A','B','D']});
 await req('POST',ruta+'/lineas',{nombre:'L02',estaciones:['B','C']});
 const u1=await req('POST',ruta+'/unidades',{nombreLinea:'L01',capacidad:300,velocidadPromedio:4});
 await req('POST',ruta+'/unidades',{nombreLinea:'L02',capacidad:300,velocidadPromedio:4});
 const u3=await req('POST',ruta+'/unidades',{nombreLinea:'L01',capacidad:250,velocidadPromedio:9});
 await req('POST',ruta+'/guardar',{});
 const leer=()=>req('GET',ruta);
 let d=await leer();const km=linea=>d.tramos.filter(t=>t.nombreLinea===linea).reduce((s,t)=>s+t.distanciaKm,0);
 assert.ok(Math.abs(d.unidadesMetro[0].duracionUt-km('L01')/4)<1e-7);
 assert.equal(d.unidadesMetro.find(u=>u.idTren===u3.idTren).velocidadPromedio,4,'Un metro nuevo hereda la configuración de su línea');
 const abrir=async()=>{
  await frame().goto(BASE+'/simulacion.html?idDiseno='+id);
  try { await vista.locator('#velocidadUnidad').waitFor(); } catch(error) { console.log('Errores',errors); console.log((await page.locator('body').innerText()).slice(0,1500)); for(const f of page.frames())console.log(f.url(),(await f.locator('body').innerText()).slice(0,4500)); await page.screenshot({path:'/tmp/metronet-vinculo-error.png'}); throw error; }
  const omitir=vista.getByRole('button',{name:'Comenzar directamente',exact:true});
  if(await omitir.isVisible())await omitir.click();
  await vista.locator('#duracionSimulacion').waitFor();
 };
 await abrir();
 assert.equal(await vista.locator('#unidadCirculacion').inputValue(),String(u1.idTren),'Modo Libre abre con una línea concreta y sus valores calculados');
 assert.equal(await vista.locator('#velocidadUnidad').inputValue(),'4');
 assert.equal(Number(await vista.locator('#duracionSimulacion').inputValue()), Number((km('L01')/4).toFixed(2)));
 assert.equal(await vista.locator('.simulacion-selector-metros__opciones button').count(),3,'Una opción por línea y Todas las líneas');
 assert.equal(await vista.locator('#tituloConfiguracionMetros').textContent(),'Detalle de líneas');
 assert.equal(await vista.locator('.simulacion-configuracion-metros__lista li').count(),2,'Una configuración por línea aunque tenga varios metros');
 const esperarGuardado=async()=>{await vista.getByText('Velocidad y duración guardadas.',{exact:true}).waitFor({state:'attached'});await vista.locator('#velocidadUnidad:not(:disabled)').waitFor();};
 const elegirLinea=async tren=>{
  await vista.locator('.simulacion-selector-metros summary').click();
  await vista.locator('.simulacion-selector-metros__opciones [data-metro="'+tren+'"]').click();
  await frame().waitForFunction(valor=>document.querySelector('#unidadCirculacion')?.value===valor && !document.querySelector('#velocidadUnidad')?.matches(':disabled'),String(tren));
 };
 // Cambiar de línea aplica el parámetro pendiente a la línea de origen, nunca a la de destino.
 await vista.locator('#velocidadUnidad').fill('6');
 await elegirLinea(d.unidadesMetro[1].idTren);
 d=await leer();
 assert.ok(d.unidadesMetro.filter(u=>u.nombreLinea==='L01').every(u=>u.velocidadPromedio===6),'Cambiar de línea conserva la UV elegida');
 assert.equal(await vista.locator('#velocidadUnidad').inputValue(),'4','La línea de destino conserva su velocidad');
 await vista.locator('#duracionSimulacion').fill('2');
 await elegirLinea(u1.idTren);
 d=await leer();
 assert.equal(d.unidadesMetro[1].duracionUt,2,'Cambiar de línea conserva la UT elegida');
 assert.ok(Math.abs(d.unidadesMetro[1].velocidadPromedio-km('L02')/2)<1e-7);
 assert.equal(await vista.locator('#velocidadUnidad').inputValue(),'6');
 // La selección de línea cambia sus dos metros, sin modificar la otra línea.
 await vista.locator('.simulacion-selector-metros summary').click();
 await vista.locator('.simulacion-selector-metros__opciones [data-metro="'+u1.idTren+'"]').click();
 const otroAntes=d.unidadesMetro[1].duracionUt;
 const tiempoInicial=Number(await vista.locator('#duracionSimulacion').inputValue());
 assert.ok(tiempoInicial>0 && tiempoInicial<1,'Recorrido corto con duración fraccionaria');
 await vista.getByRole('button',{name:'Reducir duración',exact:true}).click();
 const tiempoReducido=Number(await vista.locator('#duracionSimulacion').inputValue());
 const velocidadCalculada=Number(await vista.locator('#velocidadUnidad').inputValue());
 assert.ok(tiempoReducido>0 && tiempoReducido<tiempoInicial);
 assert.ok(velocidadCalculada<=9999.99,'Reducir UT no genera una UV imposible de guardar');
 assert.equal(velocidadCalculada, Number((km('L01')/tiempoReducido).toFixed(2)));
 for (const selector of ['#velocidadUnidad', '#duracionSimulacion']) {
  await vista.locator(selector).fill('');
  await vista.locator(selector).pressSequentially('1.25');
  assert.equal(await vista.locator(selector).inputValue(),'1.25','Escribir el separador decimal no lo borra');
 }
 await vista.locator('#duracionSimulacion').fill('1.33928041');
 await vista.getByRole('button',{name:'Aumentar duración',exact:true}).click();
 assert.equal(await vista.locator('#duracionSimulacion').inputValue(),'2.34','Los controles muestran como máximo dos decimales');
 const uvAntesGuardar=await vista.locator('#velocidadUnidad').inputValue();
 await vista.locator('.simulacion-parametro-velocidad button[type="submit"]').click();await esperarGuardado();
 assert.equal(await vista.locator('#velocidadUnidad').inputValue(),uvAntesGuardar,'La UV calculada no cambia al guardar UT');
 d=await leer();assert.ok(d.unidadesMetro.filter(u=>u.nombreLinea==='L01').every(u=>u.duracionUt===2.34));
 assert.equal(d.unidadesMetro[1].duracionUt,otroAntes);
 // Guardar otra vez sin editar no debe convertir el valor calculado en referencia.
 const antesDeRepetir = [await vista.locator('#velocidadUnidad').inputValue(), await vista.locator('#duracionSimulacion').inputValue()];
 for (const selector of ['.simulacion-parametro-velocidad button[type="submit"]', '#aplicarUnidadTiempo']) {
  await vista.locator(selector).click(); await esperarGuardado();
  assert.deepEqual([await vista.locator('#velocidadUnidad').inputValue(), await vista.locator('#duracionSimulacion').inputValue()], antesDeRepetir,
   'Guardar sin editar conserva UV y UT exactamente');
 }
 await vista.locator('#velocidadUnidad').fill('6');
 assert.equal(Number(await vista.locator('#duracionSimulacion').inputValue()), Number((km('L01')/6).toFixed(2)));
 const utAntesGuardar=await vista.locator('#duracionSimulacion').inputValue();
 await vista.locator('.simulacion-parametro-velocidad button[type="submit"]').click();await esperarGuardado();
 assert.equal(await vista.locator('#duracionSimulacion').inputValue(),utAntesGuardar,'La UT calculada no cambia al guardar UV');
 await vista.locator('#aplicarUnidadTiempo').click();await esperarGuardado();
 assert.equal(await vista.locator('#velocidadUnidad').inputValue(),'6','Guardar el campo dependiente no altera la UV elegida');
 d=await leer();assert.equal(d.unidadesMetro.find(u=>u.idTren===u3.idTren).velocidadPromedio,6);assert.equal(d.unidadesMetro[0].velocidadPromedio,6);assert.equal(d.unidadesMetro[1].duracionUt,otroAntes);
 await vista.locator('.simulacion-selector-metros summary').click();
 await vista.locator('.simulacion-selector-metros__opciones [data-metro="todas"]').click();
 await vista.locator('#velocidadUnidad').fill('8');
 assert.equal(await vista.locator('#duracionSimulacion').inputValue(),'','Tiempos distintos por línea: MIXTO');
 await vista.locator('.simulacion-parametro-velocidad button[type="submit"]').click();await esperarGuardado();
 d=await leer();for(const u of d.unidadesMetro)assert.ok(Math.abs(u.duracionUt-km(u.nombreLinea)/8)<1e-7);
 await vista.locator('#duracionSimulacion').fill('1.5');
 assert.equal(await vista.locator('#velocidadUnidad').inputValue(),'','Velocidades distintas para duración común');
 await vista.locator('.simulacion-parametro-velocidad button[type="submit"]').click();await esperarGuardado();
 d=await leer();for(const u of d.unidadesMetro){assert.equal(u.duracionUt,1.5);assert.ok(Math.abs(u.velocidadPromedio-km(u.nombreLinea)/1.5)<1e-7);}
 // De una duración común a tiempos diferentes: Play y Reiniciar guardan el último parámetro.
 await vista.locator('#velocidadUnidad').fill('8');
 assert.equal(await vista.locator('#duracionSimulacion').inputValue(),'');
 assert.equal(await vista.locator('#formularioEjecucion').evaluate(e=>e.checkValidity()),true,'MIXTO calculado no bloquea iniciar');
 await vista.locator('#formularioEjecucion button[type=submit]').click();
 await vista.locator('#detenerSimulacion:not(:disabled)').waitFor();
 let ejecuciones=await req('GET',ruta+'/resultados');
 assert.ok(ejecuciones[0].unidades.every(u=>u.velocidad===8));
 await vista.locator('#detenerSimulacion').click();
 await vista.locator('#velocidadUnidad:not(:disabled)').waitFor();
 await vista.locator('#velocidadUnidad').fill('6');
 await vista.locator('#reiniciarSimulacion').click();
 await vista.locator('#detenerSimulacion:not(:disabled)').waitFor();
 ejecuciones=await req('GET',ruta+'/resultados');
 assert.ok(ejecuciones[0].unidades.every(u=>u.velocidad===6),'Reiniciar aplica UV pendiente con UT distinta por línea');
 await vista.locator('#detenerSimulacion').click();
 await vista.locator('#velocidadUnidad:not(:disabled)').waitFor();
 await vista.locator('#duracionSimulacion').fill('1.5');
 await vista.locator('#aplicarUnidadTiempo').click();await esperarGuardado();
 // Cambiar UT desde el segundo metro de L01 modifica ambos, no L02.
 await req('PATCH',ruta+'/unidades/'+u3.idTren,{nombreLinea:'L01',capacidad:250,velocidadPromedio:4,duracionUt:2,parametroReferencia:'UT'});
 d=await leer();assert.ok(d.unidadesMetro.filter(u=>u.nombreLinea==='L01').every(u=>u.duracionUt===2));
 assert.equal(d.unidadesMetro.find(u=>u.nombreLinea==='L02').duracionUt,1.5);
 // Al cambiar de línea hereda el destino, sin cambiar ni capacidades ni otras líneas.
 await req('PATCH',ruta+'/unidades/'+u3.idTren,{nombreLinea:'L02',capacidad:275,velocidadPromedio:4});
 d=await leer();let movida=d.unidadesMetro.find(u=>u.idTren===u3.idTren);
 assert.equal(movida.duracionUt,1.5);assert.equal(movida.capacidad,275);
 assert.equal(movida.velocidadPromedio,d.unidadesMetro.find(u=>u.nombreLinea==='L02'&&u.idTren!==u3.idTren).velocidadPromedio);
 await req('PATCH',ruta+'/unidades/'+u3.idTren,{nombreLinea:'L01',capacidad:275,velocidadPromedio:4});
 // Dos ediciones simultáneas nunca dejan valores diferentes dentro de la línea.
 await Promise.all([u1,u3].map((u,i)=>req('PATCH',ruta+'/unidades/'+u.idTren,{nombreLinea:'L01',capacidad:300,velocidadPromedio:i?6:8,parametroReferencia:'UV'})));
 d=await leer();assert.equal(d.unidadesMetro[0].velocidadPromedio,d.unidadesMetro[2].velocidadPromedio);
 await req('PATCH',ruta+'/unidades/'+u3.idTren,{nombreLinea:'L01',capacidad:275,velocidadPromedio:4,duracionUt:1.5,parametroReferencia:'UT'});
 const nueva=await req('POST',ruta+'/unidades',{nombreLinea:'L01',capacidad:200,velocidadPromedio:9});
 assert.equal(nueva.duracionUt,1.5,'Crear también hereda la referencia UT');
 assert.equal(nueva.velocidadPromedio,(await leer()).unidadesMetro[0].velocidadPromedio);
 await req('DELETE',ruta+'/unidades/'+nueva.idTren);
 await abrir();assert.equal(await vista.locator('#duracionSimulacion').inputValue(),'1.5');
 // La modificación geográfica conserva UT y recalcula UV, incluso después de recargar.
 d=await leer();const uvAnterior=d.unidadesMetro[0].velocidadPromedio;
 await req('PATCH',ruta+'/estaciones/A',{nombre:'A',posicionX:645,posicionY:460,transbordo:false});
 d=await leer();assert.equal(d.unidadesMetro[0].duracionUt,1.5);assert.ok(d.unidadesMetro[0].velocidadPromedio>uvAnterior);
 await req('POST',ruta+'/guardar',{});await abrir();
 await vista.locator('#formularioEjecucion button[type=submit]').click();
 await vista.locator('#detenerSimulacion:not(:disabled)').waitFor();
 await page.screenshot({path:'/tmp/metronet-vinculo-uvut-simulacion.png'});
 const resultados=await req('GET',ruta+'/resultados');assert.equal(resultados[0].duracion,1.5);
 assert.ok(resultados[0].unidades.every(u=>u.duracionUt===1.5&&Math.abs(u.distanciaRecorridaKm-u.distanciaKm)<1e-7));
 // Contratos de error, sin truncamiento ni cambios parciales de una unidad.
 await req('PATCH',ruta+'/unidades/'+u1.idTren,{nombreLinea:'L01',capacidad:300,velocidadPromedio:4,duracionUt:0,parametroReferencia:'UT'},400);
 await req('PATCH',ruta+'/unidades/'+u1.idTren,{nombreLinea:'L01',capacidad:300,velocidadPromedio:4,parametroReferencia:'OTRO'},400);
 assert.deepEqual(errors,[]);
});
