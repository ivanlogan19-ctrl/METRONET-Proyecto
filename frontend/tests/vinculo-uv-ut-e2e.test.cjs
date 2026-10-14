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
 const token=await frame().evaluate(()=>JSON.parse(localStorage.getItem('sesionUsuario')).token);
 const headers={Authorization:`Bearer ${token}`};
 async function req(method,path,data,expected=200){const r=await context.request.fetch(API+path,{method,headers,data});assert.equal(r.status(),expected,await r.text());return r.status()===200&&r.headers()['content-type']?.includes('json')?r.json():null;}
 const creada=await req('POST','/api/simulaciones',{nombre:'Vinculo de prueba'});const id=creada.idDiseno,ruta='/api/simulaciones/'+id;
 for(const [nombre,x]of[['A',660],['B',670],['C',690]])await req('POST',ruta+'/estaciones',{nombre,posicionX:x,posicionY:460});
 await req('POST',ruta+'/lineas',{nombre:'L01',estaciones:['A','B']});
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
 assert.equal(await vista.locator('.simulacion-selector-metros__opciones button').count(),3,'Una opción por línea y Todas las líneas');
 assert.equal(await vista.locator('#tituloConfiguracionMetros').textContent(),'Detalle de líneas');
 assert.equal(await vista.locator('.simulacion-configuracion-metros__lista li').count(),2,'Una configuración por línea aunque tenga varios metros');
 const esperarGuardado=async()=>{await vista.getByText('Velocidad y duración guardadas.',{exact:true}).waitFor({state:'attached'});await vista.locator('#velocidadUnidad:not(:disabled)').waitFor();};
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
 assert.ok(Math.abs(velocidadCalculada*tiempoReducido-km('L01'))<1e-6);
 await vista.locator('#duracionSimulacion').fill('1.33928041');
 await vista.getByRole('button',{name:'Aumentar duración',exact:true}).click();
 assert.equal(await vista.locator('#duracionSimulacion').inputValue(),'2.33928041','El paso conserva los ocho decimales válidos');
 await vista.locator('.simulacion-parametro-velocidad button[type="submit"]').click();await esperarGuardado();
 d=await leer();assert.ok(d.unidadesMetro.filter(u=>u.nombreLinea==='L01').every(u=>u.duracionUt===2.33928041));
 assert.equal(d.unidadesMetro[1].duracionUt,otroAntes);
 await vista.locator('#velocidadUnidad').fill('6');
 assert.ok(Math.abs(Number(await vista.locator('#duracionSimulacion').inputValue())-km('L01')/6)<1e-7);
 await vista.locator('.simulacion-parametro-velocidad button[type="submit"]').click();await esperarGuardado();
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
