const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const width of [1440, 390]) test(`Tutorial de simulación ${width}: acciones reales, repetición, campaña nueva y estado del servidor`, async t => {
  let campana = 1, disponible = true, uv = 4;
  const escenario = { idEscenario: 44, numero: 4, nombre: 'Simulación', herramientasHabilitadas: { simulacion: true } };
  const red = { simulacion: { idDiseno: 77, idEscenario: 44, nombre: 'Red', modo: 'NIVEL', estado: 'VALIDADO' },
    estaciones: [{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],
    lineas:[{nombre:'Línea'}], tramos:[{nombreLinea:'Línea',estacionA:'A',estacionB:'B'}],
    resultados: [], preparadoParaSimular:true, territorio:{areas:[],errores:[]} };
  const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { viewport: { width, height: 900 }, responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/juego/progreso') return {json:{escenarios:[escenario],numeroCampanaActual:campana,tutorialSimulacionDisponible:disponible}};
    if (path === '/api/simulaciones/77') return {json:{...red, unidadesMetro:[{idTren:1,nombreLinea:'Línea',capacidad:300,velocidadPromedio:uv}]}};
    if (path.endsWith('/desempeno')) return {json:{puntajeMaximo:100,redResuelta:true,unidades:[]}};
    if (path.endsWith('/unidades/1')) { uv=req.postDataJSON().velocidadPromedio; return {status:204}; }
    if (path.endsWith('/ejecutar')) return {json:{idSimulacion:1,estado:'COMPLETADA',escala:'UV_H_V1',...req.postDataJSON()}};
  }});
  t.after(async()=>{ await v.contexto.close(); assert.deepEqual(v.errores,[]); });
  const p=v.pagina, tutorial=p.locator('.metronet-recorrido');
  await tutorial.waitFor();
  assert.equal(await tutorial.evaluate(e=>e.matches(':modal')),false,'Los controles deben seguir utilizables');
  for(let i=0;i<7;i++) {
    const caja = await tutorial.boundingBox();
    assert.ok(caja.x >= 0 && caja.x + caja.width <= width, 'Burbuja dentro del viewport');
    await tutorial.getByRole('button',{name:'Siguiente',exact:true}).click();
  }
  assert.match(await tutorial.innerText(),/Probá las UV/i);
  assert.equal(await tutorial.getByRole('button',{name:'Siguiente',exact:true}).isVisible(),false);
  await p.getByRole('button',{name:'Aplicar velocidad',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('#mensajeSimulacion').textContent.startsWith('Velocidad guardada'));
  assert.match(await tutorial.innerText(),/Probá las UV/i,'Guardar el mismo valor no avanza');
  await p.locator('#velocidadUnidad').fill('5');
  await p.getByRole('button',{name:'Aplicar velocidad',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('.metronet-recorrido h2')?.textContent==='Probá las horas');
  await p.locator('[data-paso-horas="1"]').click();
  await p.waitForFunction(()=>document.querySelector('.metronet-recorrido h2')?.textContent==='Poné la red en marcha');
  await p.getByRole('button',{name:'Iniciar simulación',exact:true}).click();
  await tutorial.waitFor({state:'detached'});
  assert.equal(uv,5); assert.equal(await p.locator('#duracionSimulacion').inputValue(),'7');
  await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(),0,'No repite en el mismo navegador y campaña');
  campana=2; await p.reload(); await tutorial.waitFor();
  await tutorial.getByRole('button',{name:'Omitir',exact:true}).click();
  disponible=false; campana=3; await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(),0,'El historial del servidor tiene prioridad aunque cambie la clave local');
});
