const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

test('Nivel 10 V2 muestra UT, presupuesto y marca UV sin reinterpretar el resultado V1', async t => {
  const resultadoUvUt = { version: 1, limiteUt: 2, presupuestoUv: 6.5, utEjecutadas: 2,
    sumaUv: 5.5, completo: true, mejorUv: 5.5, unidades: [
      { idTren: 1, linea: 'Principal', tramos: 9, uv: 4.5, utLlegada: 2, termino: true },
      { idTren: 2, linea: 'Enlace1', tramos: 1, uv: 0.5, utLlegada: 2, termino: true },
      { idTren: 3, linea: 'Enlace2', tramos: 1, uv: 0.5, utLlegada: 2, termino: true },
    ] };
  const red = { simulacion: { idDiseno: 77, idEscenario: 50, nombre: 'Red final', modo: 'NIVEL', estado: 'VALIDADO' },
    estaciones: [{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],
    lineas: [{nombre:'Principal'}], tramos: [{nombreLinea:'Principal',estacionA:'A',estacionB:'B'}],
    unidadesMetro: [{idTren:1,nombreLinea:'Principal',capacidad:300,velocidadPromedio:4.5}],
    preparadoParaSimular: true, territorio: {areas:[],errores:[]}, resultados: [
      {idSimulacion:11,escala:'UV_UT_V2',estado:'COMPLETADA',puntaje:100,duracion:2,velocidad:1,comentarios:'Ejecución V2',resultadoUvUt},
      {idSimulacion:10,escala:'UV_H_V1',estado:'COMPLETADA',puntaje:80,duracion:6,velocidad:1,comentarios:'Ejecución anterior',unidades:[]},
    ] };
  const vista = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { responder: req => {
    const ruta = new URL(req.url()).pathname;
    if (ruta === '/api/simulaciones/77') return { json: red };
    if (ruta.endsWith('/desempeno')) return { json: { puntajeMaximo: 100, redResuelta: true, unidades: [],
      configuracionUvUt: {version:1,limiteUt:2,presupuestoUv:6.5}, resultadoUvUt } };
  }});
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  const p = vista.pagina;
  await p.locator('#resumenCriterioUvUt:visible').waitFor();
  assert.equal(await p.locator('#duracionSimulacion').inputValue(), '2');
  assert.equal(await p.locator('#duracionSimulacion').getAttribute('aria-label'), 'Duración simulada en UT');
  assert.equal(await p.locator('#unidadDuracionSimulacion').textContent(), 'UT');
  assert.match(await p.locator('#resumenCriterioUvUt').textContent(), /6\.5 UV.*Mejor UV.*5\.5/s);
  const historial = await p.locator('#listaResultadosSimulacion').textContent();
  assert.match(historial, /Duración: 2 UT.*5\.5 \/ 6\.5 UV/s);
  assert.match(historial, /Objetivo UV\/UT cumplido/);
  assert.match(historial, /Duración simulada: 6 h/);
  if (process.env.METRONET_CAPTURAS_UVUT) await p.screenshot({path:`${process.env.METRONET_CAPTURAS_UVUT}/simulacion-v2-chrome.png`,fullPage:true});
});

test('Admin previsualiza sin publicar y aplica solo tras la acción explícita', async t => {
  let version = 1;
  const configuracion = () => [{ numero:10, version, limiteUt:2, presupuestoUv:6.5,
    tramosFixture:[9,1,1], uvMinimaFixture:5.5, viable:true, aviso:'Fixture geográfico verificable' }];
  const vista = await abrirPantalla(navegador, '/admin.html', { administrador:true, responder: req => {
    const ruta = new URL(req.url()).pathname;
    if (ruta === '/api/admin/niveles/criterio-uvut') return {json:configuracion()};
    if (ruta.endsWith('/previsualizar')) return {json:{...configuracion()[0],presupuestoUv:req.postDataJSON().presupuestoUv}};
    if (ruta.endsWith('/criterio-uvut/10') && req.method()==='PUT') { version++; return {json:configuracion()[0]}; }
  }});
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  const p = vista.pagina;
  assert.match(await p.locator('[data-vista="disenos"]').textContent(), /Diseños/);
  assert.equal(await p.locator('#vista-disenos h2').textContent(), 'Diseños de jugadores');
  await p.locator('[data-vista="niveles-uvut"]').click();
  await p.getByRole('heading',{name:'Nivel 10 · criterio UV/UT'}).waitFor();
  await p.getByLabel('Presupuesto UV del nivel 10').fill('7');
  const aplicar = p.getByRole('button',{name:'Aplicar a intentos nuevos'});
  assert.equal(await aplicar.isDisabled(), true);
  await p.getByRole('button',{name:'Previsualizar'}).click();
  await p.waitForFunction(() => !document.querySelector('#vista-niveles-uvut .admin-guardar')?.disabled);
  assert.equal(await aplicar.isEnabled(), true);
  await p.waitForFunction(() => getComputedStyle(document.querySelector('#vista-niveles-uvut .admin-guardar')).backgroundColor === 'rgb(72, 180, 255)');
  assert.equal(vista.solicitudes.filter(s=>s.method==='PUT' && s.path.endsWith('/criterio-uvut/10')).length,0);
  if (process.env.METRONET_CAPTURAS_UVUT) await p.screenshot({path:`${process.env.METRONET_CAPTURAS_UVUT}/admin-uvut-chrome.png`,fullPage:true});
  await aplicar.click();
  await p.getByText('Criterio del nivel 10 publicado para intentos nuevos.').waitFor();
  assert.equal(vista.solicitudes.filter(s=>s.method==='PUT' && s.path.endsWith('/criterio-uvut/10')).length,1);
});
