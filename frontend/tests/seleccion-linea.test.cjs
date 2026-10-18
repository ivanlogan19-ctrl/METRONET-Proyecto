const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const modo of ['NIVEL', 'LIBRE', 'EDICION_LIBRE']) test(`${modo}: tres líneas independientes, sin selección conjunta y guardado por línea`, async t => {
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
    if(ruta.match(/\/unidades\/\d+$/) && req.method()==='PATCH') {
      const datos=req.postDataJSON();
      const km=red.tramos.find(t=>t.nombreLinea===datos.nombreLinea).distanciaKm;
      for(const u of red.unidadesMetro.filter(u=>u.nombreLinea===datos.nombreLinea)) {
        u.velocidadPromedio=datos.parametroReferencia==='UT'?km/datos.duracionUt:datos.velocidadPromedio;
        u.duracionUt=datos.parametroReferencia==='UT'?datos.duracionUt:km/datos.velocidadPromedio;
      }
      return {json:{}};
    }
    if(ruta==='/api/simulaciones/77')return {json:red};
    if(ruta.endsWith('/desempeno'))return {json:{puntajeMaximo:100,redResuelta:true,unidades:[]}};
  }});
  t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
  const p=v.pagina;
  await p.locator('#velocidadUnidad').waitFor();
  const omitir=p.getByRole('button',{name:'Continuar',exact:true});
  if(await omitir.isVisible())await omitir.click();
  assert.deepEqual(await p.locator('#unidadCirculacion option').allTextContents(),['L1','L2','L3']);
  assert.equal(await p.locator('[data-metro="todas"]').count(),0);
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
  await p.locator('#velocidadUnidad').fill('12');
  assert.equal(await p.locator('#duracionSimulacion').inputValue(),'3');
  await guardar('.simulacion-parametro-velocidad button[type=submit]');
  assert.deepEqual(red.unidadesMetro.map(u=>u.velocidadPromedio),[4,4,12,12]);
  assert.equal(await p.locator('#unidadCirculacion').inputValue(),'3');
  await elegir(2);
  await p.locator('#duracionSimulacion').fill('2');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(),'12');
  await guardar('#aplicarUnidadTiempo');
  assert.deepEqual(red.unidadesMetro.map(u=>u.duracionUt),[3,2,3,3]);
  const cambios=v.solicitudes.filter(s=>s.method==='PATCH');
  assert.deepEqual(cambios.map(s=>s.body.nombreLinea),['L3','L2'],'Una sola petición por línea, aunque tenga varios metros');
  await p.reload();await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await p.locator('#unidadCirculacion').inputValue(),'1');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(),'4');
});
