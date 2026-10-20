const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const modo of ['NIVEL', 'LIBRE', 'EDICION_LIBRE']) test(`${modo}: configuración por línea y aplicación conjunta solo en modo libre`, async t => {
  const red = {
    vinculoUvUtPorLinea: true,
    simulacion: { idDiseno:77, idEscenario:42, nombre:'Red', modo, estado:'VALIDADO' },
    estaciones: ['A','B','C','D'].map((nombre,i)=>({nombre,posicionX:580+i*40,posicionY:470})),
    lineas: ['L1','L2','L3'].map(nombre=>({nombre})),
    tramos: [12,24,36].map((distanciaKm,i)=>({nombreLinea:`L${i+1}`,estacionA:['A','B','C'][i],estacionB:['B','C','D'][i],distanciaKm})),
    unidadesMetro: [1,2,3,4].map((idTren,i)=>({idTren,nombreLinea:`L${Math.min(i+1,3)}`,capacidad:300,velocidadPromedio:4,duracionUt:[3,6,9,9][i]})),
    preparadoParaSimular:true, resultados:[], territorio:{areas:[],errores:[]},
  };
  const v=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{responder:req=>{
    const ruta=new URL(req.url()).pathname;
    if(ruta==='/api/simulaciones/77')return {json:red};
    if(ruta.endsWith('/desempeno'))return {json:{puntajeMaximo:100,redResuelta:true,unidades:[]}};
  }});
  t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
  const p=v.pagina;
  // Recibir el cuerpo HTTP real: Firefox BiDi no lo expone en request.postDataJSON().
  const servidor = http.createServer(async (entrada, salida) => {
    salida.setHeader('Access-Control-Allow-Origin', entrada.headers.origin || '*');
    salida.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    salida.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
    if (entrada.method === 'OPTIONS') { salida.writeHead(204); salida.end(); return; }
    let cuerpo = ''; for await (const parte of entrada) cuerpo += parte;
    const datos = JSON.parse(cuerpo);
    v.solicitudes.push({path:entrada.url,method:entrada.method,body:datos});
    const km = red.tramos.find(tramo => tramo.nombreLinea === datos.nombreLinea).distanciaKm;
    for (const unidad of red.unidadesMetro.filter(u => u.nombreLinea === datos.nombreLinea)) {
      unidad.velocidadPromedio = datos.parametroReferencia === 'UT' ? km / datos.duracionUt : datos.velocidadPromedio;
      unidad.duracionUt = datos.parametroReferencia === 'UT' ? datos.duracionUt : km / datos.velocidadPromedio;
    }
    salida.writeHead(204); salida.end();
  });
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(Number(process.env.METRONET_PRUEBA_API_PUERTO || 0), '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await p.route(/\/api\/simulaciones\/77\/unidades\/\d+$/, ruta => {
    const url = new URL(ruta.request().url());
    return ruta.continue(Number(url.port) === servidor.address().port ? {} : {
      url:`http://127.0.0.1:${servidor.address().port}${url.pathname}`,
    });
  });
  await p.locator('#velocidadUnidad').waitFor();
  const omitir=p.getByRole('button',{name:'Continuar',exact:true});
  if(await omitir.isVisible())await omitir.click();
  assert.deepEqual(await p.locator('#unidadCirculacion option').allTextContents(),modo === 'NIVEL' ? ['L1','L2','L3'] : ['Todas','L1','L2','L3']);
  assert.equal(await p.locator('[data-metro="todas"]').count(),modo === 'NIVEL' ? 0 : 1);
  assert.equal(await p.locator('#unidadCirculacion').inputValue(),'1');
  assert.equal(await p.locator('#duracionSimulacion').inputValue(),'3');
  const elegir=async id=>{
    await p.locator('.simulacion-selector-metros > summary').click();
    await p.locator(`.simulacion-selector-metros__opciones [data-metro="${id}"]`).click();
    await p.waitForFunction(id=>document.querySelector('#unidadCirculacion')?.value===id&&!document.querySelector('#velocidadUnidad').matches(':disabled'),String(id));
  };
  const guardar=async selector=>{
    const respuesta=p.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/unidades/'));
    await p.locator(selector).click();await respuesta;
    await p.waitForFunction(()=>!document.querySelector('#velocidadUnidad').matches(':disabled'));
  };
  await elegir(3);
  await p.locator('#velocidadUnidad').fill('');
  await p.locator('#velocidadUnidad').fill('12');
  assert.equal(await p.locator('#duracionSimulacion').inputValue(),'3');
  await guardar('.simulacion-parametro-velocidad button[type=submit]');
  assert.deepEqual(red.unidadesMetro.map(u=>u.velocidadPromedio),[4,4,12,12]);
  assert.equal(await p.locator('#unidadCirculacion').inputValue(),'3');
  await elegir(2);
  await p.locator('#duracionSimulacion').fill('');
  await p.locator('#duracionSimulacion').fill('2');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(),'12');
  await guardar('#aplicarUnidadTiempo');
  assert.deepEqual(red.unidadesMetro.map(u=>u.duracionUt),[3,2,3,3]);
  const cambios=v.solicitudes.filter(s=>s.method==='PATCH');
  assert.deepEqual(cambios.map(s=>s.body.nombreLinea),['L3','L2'],'Una sola petición por línea, aunque tenga varios metros');
  if (modo !== 'NIVEL') {
    await elegir('todas');
    await p.locator('#velocidadUnidad').fill('');
    await p.locator('#velocidadUnidad').fill('6');
    assert.equal(await p.locator('#duracionSimulacion').inputValue(), '', 'distancias distintas mantienen UT distintas');
    await guardar('.simulacion-parametro-velocidad button[type=submit]');
    assert.deepEqual(red.unidadesMetro.map(u=>u.velocidadPromedio), [6,6,6,6]);
    assert.deepEqual(red.unidadesMetro.map(u=>u.duracionUt), [2,4,6,6]);
  }
  await p.reload();await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await p.locator('#unidadCirculacion').inputValue(),'1');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(),modo === 'NIVEL' ? '4' : '6');
});
