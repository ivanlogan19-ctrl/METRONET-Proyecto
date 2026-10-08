const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const niveles = require('../src/educacion/niveles.json');
const catalogo = require('../src/educacion/catalogo-svgs-niveles.json');

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
  await p.locator('#duracionSimulacion').waitFor();
  assert.equal(await p.locator('#duracionSimulacion').inputValue(), '2');
  assert.equal(await p.locator('#duracionSimulacion').getAttribute('aria-label'), 'Duración simulada en UT');
  assert.equal(await p.locator('#unidadDuracionSimulacion').textContent(), 'UT');
  await p.locator('.simulacion-configuracion-metros__desplegable summary').click();
  assert.match(await p.locator('.simulacion-configuracion-metros__lista').innerText(), /Metro 1 · Principal.*4,5 UV · 2 UT global/s);
  await p.locator('#duracionSimulacion').fill('3');
  await p.locator('#aplicarUnidadTiempo').click();
  await p.locator('.simulacion-configuracion-metros__desplegable summary').click();
  assert.match(await p.locator('.simulacion-configuracion-metros__lista').innerText(), /4,5 UV · 3 UT global/);
  assert.equal(await p.locator('#resumenCriterioUvUt').isVisible(), false);
  assert.equal(await p.locator('#seccionResultados, #listaResultadosSimulacion').count(), 0);
  assert.equal(red.resultados.length, 2, 'El historial recibido permanece en los datos del diseño');
  if (process.env.METRONET_CAPTURAS_UVUT) await p.screenshot({path:`${process.env.METRONET_CAPTURAS_UVUT}/simulacion-v2-chrome.png`,fullPage:true});
});

test('Admin guarda UV/UT en borrador y publica la versión completa tras validar', async t => {
  let version = 1, revision = 1;
  const nivel = niveles[9];
  const tarjetas = catalogo[9].tarjetas.map(t => ({ id:t.id,titulo:t.titulo,texto:t.texto,
    aprendizaje:t.aprendizaje,fuente:t.fuente,urlFuente:t.url,descripcionImagen:t.descripcionImagen,idSvgCatalogo:t.imagen }));
  let contenido = { desafio:{nombre:nivel.nombre,relato:'Relato original',objetivo:nivel.objetivo,
    instrucciones:nivel.instrucciones,dificultad:nivel.dificultad},reglasExito:nivel.reglasExito,
    herramientasHabilitadas:nivel.herramientasHabilitadas,criterioUvUt:{limiteUt:2,presupuestoUv:6.5},ayudas:[] };
  const redReferencia = {estaciones:[],lineas:[],tramos:[],unidades:[],ejecuciones:[]};
  const borrador = () => ({numero:10,versionBase:version,revision,contenido,redReferencia,tarjetas});
  const vista = await abrirPantalla(navegador, '/admin.html', { administrador:true, responder: req => {
    const ruta = new URL(req.url()).pathname;
    if (ruta === '/api/admin/niveles') return {json:[{numero:10,nombre:nivel.nombre,versionPublicada:version,revisionBorrador:revision}]};
    if (ruta.endsWith('/10/borrador')) {
      if (req.method()==='PUT') { const pedido=req.postDataJSON(); revision++; contenido={...contenido,
        desafio:pedido.desafio,reglasExito:pedido.reglasExito,herramientasHabilitadas:pedido.herramientasHabilitadas,
        criterioUvUt:pedido.criterioUvUt,ayudas:pedido.ayudas}; }
      return {json:borrador()};
    }
    if (ruta.endsWith('/10/versiones')) return {json:[]};
    if (ruta.endsWith('/10/previsualizar')) return {json:{numero:10,versionPublicada:version,revisionBorrador:revision,
      contenido,tarjetas,diagnostico:{viable:true,mensaje:'Referencia viable',huella:'qa-huella',condiciones:[]}}};
    if (ruta.endsWith('/10/publicar')) { version++;revision++;return {json:{numero:10,version,versionCriterioUvUt:version,huella:'qa-huella'}}; }
  }});
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  const p = vista.pagina;
  assert.match(await p.locator('[data-vista="disenos"]').textContent(), /Diseños/);
  assert.equal(await p.locator('#vista-disenos h2').textContent(), 'Diseños de jugadores');
  await p.getByRole('button',{name:'Experiencia de juego'}).click();
  await p.getByRole('button',{name:'Editar'}).click();
  assert.equal(await p.getByRole('button',{name:'Quitar Puntuación'}).count(),0);
  assert.equal(await p.getByRole('option',{name:'Puntuación'}).count(),0);
  const primeraTarjeta=p.locator('.admin-niveles__tarjetas details').first();
  await primeraTarjeta.locator('summary').click();
  const fuente=primeraTarjeta.getByLabel('Url Fuente');
  const urlOriginal=await fuente.inputValue();
  await fuente.fill('https:foo');
  await p.getByRole('button',{name:'Guardar borrador'}).click();
  await p.getByText('Cada tarjeta necesita una URL HTTP(S) con host válido para su fuente.').waitFor();
  assert.equal(vista.solicitudes.filter(s=>s.path.endsWith('/10/borrador')&&s.method==='PUT').length,0);
  await fuente.fill(urlOriginal);
  await p.getByLabel('Presupuesto UV').fill('7');
  const publicar = p.getByRole('button',{name:'Publicar versión'});
  assert.equal(await publicar.isDisabled(),true);
  await p.getByRole('button',{name:'Guardar borrador'}).click();
  await p.getByRole('button',{name:'Previsualizar y validar'}).click();
  await p.getByText('Referencia viable').waitFor();
  assert.equal(await publicar.isEnabled(),true);
  assert.equal(vista.solicitudes.filter(s=>s.path.endsWith('/10/publicar')).length,0);
  await publicar.click();
  await p.getByText('Confirmá la revisión editorial de textos, fuentes e imágenes.').waitFor();
  await p.locator('[data-confirmacion-editorial]').check();
  await publicar.click();
  await p.getByText('Nivel 10 publicado como versión 2.').waitFor();
  assert.equal(vista.solicitudes.filter(s=>s.path.endsWith('/10/publicar')).length,1);
  assert.equal(vista.solicitudes.filter(s=>s.path.endsWith('/criterio-uvut/10')).length,0);
});

test('Admin protege cambios sin guardar antes de preparar la reversión inicial', async t => {
  const nivel=niveles[0];
  const tarjetas=catalogo[0].tarjetas.map(t=>({id:t.id,titulo:t.titulo,texto:t.texto,
    aprendizaje:t.aprendizaje,fuente:t.fuente,urlFuente:t.url,descripcionImagen:t.descripcionImagen,idSvgCatalogo:t.imagen}));
  const inicial={desafio:{nombre:nivel.nombre,relato:'Relato inicial',objetivo:nivel.objetivo,
    instrucciones:nivel.instrucciones,dificultad:nivel.dificultad},reglasExito:nivel.reglasExito,
    herramientasHabilitadas:nivel.herramientasHabilitadas,criterioUvUt:null,ayudas:[]};
  const redVacia={estaciones:[],lineas:[],tramos:[],unidades:[],ejecuciones:[]};
  const redPublicada={estaciones:[{nombre:'A',x:660,y:460},{nombre:'B',x:665,y:460}],
    lineas:[{nombre:'Principal'}],tramos:[{linea:'Principal',a:'A',b:'B'}],unidades:[],ejecuciones:[]};
  let contenido=structuredClone(inicial),revision=1;
  const borrador=()=>({numero:1,versionBase:2,revision,contenido,redReferencia:redPublicada,tarjetas});
  const versiones=[{version:2,publicadoEn:'2026-10-04',contenido,redReferencia:redPublicada,tarjetas},
    {version:1,publicadoEn:'2026-10-03',contenido:inicial,redReferencia:redVacia,tarjetas}];
  const vista=await abrirPantalla(navegador,'/admin.html',{administrador:true,responder:req=>{
    const ruta=new URL(req.url()).pathname;
    if(ruta==='/api/admin/niveles')return {json:[{numero:1,nombre:nivel.nombre,versionPublicada:2,revisionBorrador:revision}]};
    if(ruta.endsWith('/1/borrador'))return {json:borrador()};
    if(ruta.endsWith('/1/versiones'))return {json:versiones};
    if(ruta.endsWith('/1/versiones/1/preparar-reversion')&&req.method()==='POST'){
      revision++;contenido=structuredClone(inicial);return {json:borrador()};
    }
  }});
  t.after(async()=>{await vista.contexto.close();assert.deepEqual(vista.errores,[])});
  const p=vista.pagina;
  await p.getByRole('button',{name:'Experiencia de juego'}).click();
  await p.getByRole('button',{name:'Editar'}).click();
  const nombre=p.locator('[data-editor-nivel] .admin-niveles__seccion').first().getByLabel('Nombre',{exact:true}).first();
  await nombre.fill('Cambio sin guardar');
  const revertir=p.getByRole('button',{name:'Preparar reversión'}).last();
  assert.equal(await revertir.isEnabled(),true,'La V1 puede usar la red de V2');
  await revertir.click();
  await p.getByRole('dialog',{name:'Confirmar acción'}).getByRole('button',{name:'Cancelar'}).click();
  assert.equal(vista.solicitudes.filter(s=>s.path.endsWith('/preparar-reversion')).length,0);
  assert.equal(await nombre.inputValue(),'Cambio sin guardar');
  await revertir.click();
  await p.getByRole('dialog',{name:'Confirmar acción'}).getByRole('button',{name:'Aceptar'}).click();
  await p.getByText(/Se conservó una referencia publicada reciente/).waitFor();
  assert.equal(vista.solicitudes.filter(s=>s.path.endsWith('/preparar-reversion')).length,1);
});
