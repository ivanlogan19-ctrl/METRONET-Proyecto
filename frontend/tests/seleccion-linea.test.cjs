const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const modo of ['NIVEL', 'LIBRE', 'EDICION_LIBRE']) test(`${modo}: configuración por línea y aplicación conjunta con cálculo independiente por distancia`, async t => {
  const red = {
    vinculoUvUtPorLinea: true,
    simulacion: { idDiseno:77, idEscenario:42, nombre:'Red', modo, estado:'VALIDADO' },
    estaciones: ['A','B','C','D'].map((nombre,i)=>({nombre,posicionX:580+i*40,posicionY:470})),
    lineas: ['L1','L2','L3'].map(nombre=>({nombre})),
    tramos: [12,24,36].map((distanciaKm,i)=>({nombreLinea:`L${i+1}`,estacionA:['A','B','C'][i],estacionB:['B','C','D'][i],distanciaKm})),
    unidadesMetro: [1,2,3,4].map((idTren,i)=>({idTren,nombreLinea:`L${Math.min(i+1,3)}`,capacidad:300,velocidadPromedio:4,duracionUt:[3,6,9,9][i]})),
    preparadoParaSimular:true, resultados:[], territorio:{areas:[],errores:[]},
  };
  const v=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{responder:async req=>{
    const ruta=new URL(req.url()).pathname;
    if(req.method()==='PATCH' && /\/unidades\/\d+$/.test(ruta)) {
      // El adaptador de Firefox oficial no expone el cuerpo PATCH interceptado.
      const datos=req.postDataJSON() ?? await req.frame().evaluate(()=>window.datosGuardadoPrueba);
      v.solicitudes.at(-1).body=datos;
      const km=red.tramos.filter(tramo=>tramo.nombreLinea===datos.nombreLinea).reduce((total,tramo)=>total+tramo.distanciaKm,0);
      for(const unidad of red.unidadesMetro.filter(u=>u.nombreLinea===datos.nombreLinea)) {
        unidad.velocidadPromedio=datos.parametroReferencia==='UT'?km/datos.duracionUt:datos.velocidadPromedio;
        unidad.duracionUt=datos.parametroReferencia==='UT'?datos.duracionUt:km/datos.velocidadPromedio;
      }
      return {status:204};
    }
    if(ruta==='/api/simulaciones/77')return {json:red};
    if(ruta.endsWith('/desempeno'))return {json:{puntajeMaximo:100,redResuelta:true,unidades:[]}};
  }});
  t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
  const p=v.pagina;
  await p.evaluate(()=>{
    const solicitar=window.fetch;
    window.fetch=(url,opciones)=>{
      if(opciones?.method==='PATCH') window.datosGuardadoPrueba=JSON.parse(opciones.body);
      return solicitar(url,opciones);
    };
  });
  await p.locator('#velocidadUnidad').waitFor();
  const omitir=p.getByRole('button',{name:'Continuar',exact:true});
  if(await omitir.isVisible())await omitir.click();
  assert.deepEqual(await p.locator('#unidadCirculacion option').allTextContents(),['Todas','Línea azul','Línea fucsia','Línea amarilla']);
  assert.equal(await p.locator('[data-metro="todas"]').count(),1);
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
  await elegir('todas');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(),'');
  await p.getByRole('button',{name:'Aumentar velocidad',exact:true}).click();
  assert.equal(await p.locator('#velocidadUnidad').inputValue(),'1','Desde valores distintos se puede proponer una UV común');
  assert.equal(await p.locator('#duracionSimulacion').getAttribute('placeholder'),'Por línea');
  await guardar('.simulacion-parametro-velocidad button[type=submit]');
  assert.equal(await p.locator('#unidadCirculacion').inputValue(),'todas');
  assert.deepEqual(red.unidadesMetro.map(u=>u.velocidadPromedio), [1,1,1,1]);
  assert.deepEqual(red.unidadesMetro.map(u=>u.duracionUt), [12,24,36,36]);
  assert.equal(await p.locator('#duracionSimulacion').inputValue(),'','La UT depende de cada distancia');
  await p.getByRole('button',{name:'Aumentar duración',exact:true}).click();
  assert.equal(await p.locator('#duracionSimulacion').inputValue(),'1');
  assert.equal(await p.locator('#velocidadUnidad').getAttribute('placeholder'),'Por línea');
  // El botón de guardar UV también confirma la última edición (UT), sin imponer ambas.
  await guardar('.simulacion-parametro-velocidad button[type=submit]');
  assert.deepEqual(red.unidadesMetro.map(u=>u.duracionUt), [1,1,1,1]);
  assert.deepEqual(red.unidadesMetro.map(u=>u.velocidadPromedio), [12,24,36,36]);
  const conjuntas=v.solicitudes.filter(s=>s.method==='PATCH').slice(2);
  assert.deepEqual(conjuntas.map(s=>s.body.parametroReferencia),['UV','UV','UV','UT','UT','UT']);
  assert.deepEqual(conjuntas.map(s=>s.body.nombreLinea),['L1','L2','L3','L1','L2','L3']);
  await p.reload();await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await p.locator('#unidadCirculacion').inputValue(),'1');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(),'12');
});
