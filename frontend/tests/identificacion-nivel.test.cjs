// Navegador y editor reales; contratos HTTP controlados, sin escribir en PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const escenario = n => ({ ...n, idEscenario:n.numero, estado:'DISPONIBLE', desbloqueado:true });
const libre = { numero:null, idEscenario:111, nombre:'Modo Libre', desbloqueado:true, estado:'DISPONIBLE' };
const progreso = completados => ({ numeroCampanaActual:1, campanaCompletada:completados === niveles.length,
  escenarios:[...niveles.map(n => ({ ...escenario(n), estado:n.numero <= completados ? 'COMPLETADO' : 'DISPONIBLE', completadoEnCampanaActual:n.numero <= completados })), libre] });
function cerrar(t, vista) { t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); }); }

for (const n of niveles) test(`NIVEL ${n.numero}: cartel antes del tutorial y edición; guardar/actualizar no lo repite`, async t => {
  const vista = await abrirEditor(navegador, { escenario:escenario(n), observarIdentificacion:true, ofrecerRecorrido:true }); cerrar(t, vista);
  const p = vista.pagina, cartel = p.locator('.metronet-identificacion[data-fase="identificacion"]');
  await cartel.waitFor();
  assert.equal(await cartel.locator('strong').textContent(), `NIVEL ${n.numero}`);
  assert.equal(await p.locator('#metronet-aplicacion').evaluate(e => e.inert), true);
  assert.equal(await p.locator('.metronet-tutorial').evaluate(e => e.open), false);
  assert.equal(await cartel.locator('button, input, progress, [data-concepto]').count(), 0);
  await cartel.waitFor({state:'detached'});
  assert.equal(await p.locator('#metronet-aplicacion').evaluate(e => e.inert), false);
  if (n.numero === 1) await p.locator('.metronet-tutorial > summary').waitFor();
  else assert.equal(await p.getByRole('button', {name:'Mostrar tutorial', exact:true}).count(), 0);
  await p.evaluate(async () => { await editorPrueba.abrirDiseno(77); });
  assert.equal(await cartel.count(), 0);
  assert.equal(vista.solicitudes.length, 0);
});

test('Detecta cierre real por campaña y catálogo; descarta repetición, acceso admin y progreso incompleto', async t => {
  const v = await abrirPantalla(navegador, '/escenarios.html'); cerrar(t, v);
  const casos = [
    [progreso(niveles.length - 1), progreso(niveles.length), niveles.at(-1).numero, true],
    [progreso(niveles.length), progreso(niveles.length), niveles.at(-1).numero, false],
    [progreso(0), progreso(niveles.length), niveles.at(-1).numero, false],
    [progreso(niveles.length - 1), progreso(niveles.length), 1, false],
    [null, progreso(niveles.length), niveles.at(-1).numero, false],
    [progreso(niveles.length - 1), { ...progreso(niveles.length), numeroCampanaActual:2 }, niveles.at(-1).numero, false],
  ];
  for (const [antes, despues, id, esperado] of casos) {
    assert.equal(await v.pagina.evaluate(async ([a,d,id]) => Boolean((await import('/src/educacion/TransicionNivel.js')).obtenerModoLibreTrasRecorrido(a,d,id)), [antes,despues,id]), esperado);
  }
});

test('Inicio real → loading conservado → NIVEL 1 → oferta de tutorial', async t => {
  const nivel = escenario(niveles[0]);
  const red = {simulacion:{idDiseno:77,idEscenario:nivel.idEscenario,nombre:'Mi primer nivel',modo:'NIVEL',estado:'EN_DISENO'},
    estaciones:[],lineas:[],tramos:[],unidadesMetro:[],preparadoParaSimular:false,territorio:{areas:[],errores:[]}};
  const v = await abrirPantalla(navegador,'/inicio.html',{responder:req => {
    const ruta = new URL(req.url()).pathname;
    if (ruta === '/api/juego/progreso') return {json:{...progreso(0),cantidadNiveles:niveles.length,nivelesCompletados:0}};
    if (ruta === '/api/juego/escenarios') return {json:progreso(0).escenarios};
    if (ruta.endsWith(`/escenarios/${nivel.idEscenario}/iniciar`)) return {json:{idDiseno:77,idEscenario:nivel.idEscenario,idIntento:123,numeroCampana:1,mostrarTutorial:true}};
    if (ruta === '/api/simulaciones') return {json:[red.simulacion]};
    if (ruta === '/api/simulaciones/77') return {json:red};
  }}); cerrar(t,v); const p = v.pagina;
  await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true));
  await p.clock.install();
  await p.getByRole('button',{name:'Jugar',exact:true}).click();
  await p.locator('.metronet-viaje').waitFor();
  assert.equal(await p.locator('.metronet-identificacion').count(),0);
  await p.clock.runFor(9000);
  assert.equal(await p.locator('.metronet-viaje .metronet-cartel-transicion:not([hidden])').count(),0);
  await p.clock.runFor(2100);
  await p.locator('.metronet-viaje .metronet-cartel-transicion:not([hidden])').waitFor();
  assert.equal(await p.locator('.metronet-cartel-transicion strong').textContent(),'NIVEL 1');
  assert.equal(await p.locator('.metronet-tarjeta-educativa').count(),0);
  assert.equal(new URL(p.url()).pathname,'/inicio.html');
  await p.clock.runFor(1100);
  await p.waitForURL('**/?idDiseno=77&idEscenario=1&idIntento=123');
  assert.equal(await p.locator('.metronet-viaje').count(),0);
  await p.locator('.metronet-tutorial > summary').waitFor();
});

for (const administrador of [false, true]) test(`Modo Libre directo (${administrador?'ADMIN':'JUGADOR'}): sin celebración`, async t => {
  const v = await abrirPantalla(navegador, '/escenarios.html', {administrador}); cerrar(t, v);
  await v.pagina.clock.install();
  await v.pagina.evaluate(async libre => {
    const {crearIdentificacionNivel} = await import('/src/educacion/IdentificacionNivel.js');
    window.entrada = crearIdentificacionNivel(); window.finEntrada = entrada.mostrar(libre, 77);
  }, libre);
  assert.equal(await v.pagina.locator('.metronet-identificacion strong').textContent(), 'MODO LIBRE');
  assert.equal(await v.pagina.locator('.metronet-identificacion p').count(), 0);
  await v.pagina.clock.runFor(1100);
  assert.equal(await v.pagina.evaluate(() => finEntrada), true);
});

test('Último nivel recién completado: victoria → celebración → Modo Libre; reentrada normal', async t => {
  const ultimo = niveles.at(-1), v = await abrirEditor(navegador, {escenario:escenario(ultimo)}); cerrar(t, v);
  const p = v.pagina;
  let completado = false, inicios = 0;
  await p.evaluate(async () => {
    const sesion = JSON.parse(localStorage.getItem('sesionUsuario')); sesion.usuario.idUsuario = 7;
    localStorage.setItem('sesionUsuario', JSON.stringify(sesion));
    (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true);
  });
  await p.route('**/api/juego/**', async r => {
    const url = new URL(r.request().url()).pathname;
    if (url.endsWith('/evaluar')) { completado = true; return r.fulfill({json:{completado:true,puntaje:95,idSiguienteEscenario:null,mensaje:'Completado'}}); }
    if (url.endsWith('/progreso')) return r.fulfill({json:progreso(niveles.length - (completado ? 0 : 1))});
    if (url.endsWith('/escenarios')) return r.fulfill({json:progreso(niveles.length).escenarios});
    if (url.endsWith('/111/iniciar')) { inicios++; v.diseno.simulacion.idEscenario = 111; v.diseno.simulacion.modo = 'EDICION_LIBRE'; return r.fulfill({json:{idDiseno:77,idEscenario:111,idIntento:201}}); }
    return r.fallback();
  });
  await p.clock.install();
  await p.evaluate(() => { window.resultadoEntrada = editorPrueba.evaluarEscenarioGuardado(77); });
  await p.locator('.metronet-resultado-nivel').getByRole('button', { name: 'Continuar', exact: true }).click();
  await p.locator('.metronet-victoria').waitFor();
  const duracion = await p.evaluate(async () => (await import('/src/educacion/ConfiguracionTransicion.js')).CONFIGURACION_TRANSICION.duracionVisibleMs);
  await p.clock.runFor(duracion + 50);
  await p.locator('.metronet-identificacion[data-fase="identificacion"]').waitFor();
  assert.match(await p.locator('.metronet-identificacion').innerText(), /RECORRIDO COMPLETADO.*ESTÁS LISTO PARA EL MODO LIBRE/s);
  assert.equal(inicios, 1);
  await p.clock.runFor(1100); await p.evaluate(() => resultadoEntrada);
  assert.equal(await p.evaluate(() => editorPrueba.escenarioJuegoActual.numero), null);
  await p.evaluate(() => { window.reentrada = editorPrueba.abrirDiseno(77, {identificar:true}); });
  await p.locator('.metronet-identificacion[data-fase="identificacion"]').waitFor();
  assert.equal(await p.locator('.metronet-identificacion strong').textContent(), 'MODO LIBRE');
  await p.clock.runFor(1100); await p.evaluate(() => reentrada);
});

for (const motivo of ['escape','pagehide','popstate','desmontar','reemplazar']) test(`Interrupción ${motivo}: sin cartel ni bloqueo residual`, async t => {
  const v = await abrirPantalla(navegador, '/escenarios.html'); cerrar(t,v); const p = v.pagina;
  await p.clock.install();
  await p.evaluate(async () => {
    const {crearIdentificacionNivel} = await import('/src/educacion/IdentificacionNivel.js');
    window.crearEntrada = crearIdentificacionNivel; window.entrada = crearEntrada(document.querySelector('main'));
    window.finalEntrada = entrada.mostrar({numero:1},77);
  });
  if (motivo === 'escape') await p.keyboard.press('Escape');
  else await p.evaluate(m => {
    if (m === 'desmontar') document.querySelector('.metronet-identificacion').remove();
    else if (m === 'reemplazar') { const nueva = crearEntrada(document.querySelector('main')); nueva.cancelar(); }
    else dispatchEvent(new Event(m));
  }, motivo);
  assert.equal(await p.evaluate(() => finalEntrada), motivo === 'escape');
  await p.clock.runFor(3000);
  assert.equal(await p.locator('.metronet-identificacion').count(), 0);
  assert.equal(await p.locator('main').evaluate(e => e.inert), false);
});

test('Simular y finalizar el último nivel desde Edición: celebración de un solo uso', async t => {
  const ultimo = niveles.at(-1).numero;
  let completado = false;
  const red = { simulacion:{idDiseno:77,idEscenario:ultimo,nombre:'Red integral',modo:'NIVEL',estado:'VALIDADO'},
    estaciones:[{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],
    lineas:[{nombre:'Azul'}],tramos:[{nombreLinea:'Azul',estacionA:'A',estacionB:'B'}],
    unidadesMetro:[{idTren:1,nombreLinea:'Azul',capacidad:300,velocidadPromedio:40}],preparadoParaSimular:true,
    resultados:[],territorio:{areas:[],errores:[]} };
  const libreDiseno = { ...red, simulacion:{idDiseno:200,idEscenario:111,nombre:'Mi red libre',modo:'EDICION_LIBRE',estado:'EN_DISENO'} };
  const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { responder:req => {
    const ruta = new URL(req.url()).pathname;
    if (ruta === '/api/juego/progreso') return {json:progreso(niveles.length - (completado ? 0 : 1))};
    if (ruta === '/api/juego/escenarios') return {json:progreso(niveles.length).escenarios};
    if (ruta === '/api/simulaciones') return {json:[red.simulacion,libreDiseno.simulacion]};
    if (ruta === '/api/simulaciones/77') return {json:red};
    if (ruta === '/api/simulaciones/200') return {json:libreDiseno};
    if (ruta === '/api/simulaciones/77/guardar') return {json:red.simulacion};
    if (ruta.endsWith('/ejecutar')) return {json:{idSimulacion:1,puntaje:0,estado:'COMPLETADA',duracion:10,velocidad:4}};
    if (ruta.endsWith('/evaluar')) { completado = true; return {json:{completado:true,puntaje:100,idSiguienteEscenario:null,mensaje:'Nivel completado'}}; }
    if (ruta.endsWith('/111/iniciar')) return {json:{idDiseno:200,idEscenario:111,idIntento:900}};
  } }); cerrar(t,v);
  const p = v.pagina;
  await p.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true));

  await p.locator('#duracionSimulacion').fill('1');
  await p.locator('#formularioEjecucion button[type="submit"]').click();
  await p.waitForFunction(() => document.querySelector('#mensajeSimulacion')?.textContent.includes('Simulación terminada.'), null, {timeout:45000});
  assert.equal(v.solicitudes.filter(s => s.path.endsWith('/evaluar')).length, 0);
  assert.equal(await p.locator('.metronet-resultado-nivel').count(), 0);
  await p.locator('#volverEdicion').click();
  await p.locator('.metronet-identificacion').waitFor({state:'detached'});
  await p.locator('[data-finalizar-red]').click();
  await p.locator('.metronet-resultado-nivel').getByRole('button', { name: 'Continuar', exact: true }).click();
  await p.locator('.metronet-victoria').waitFor();
  await p.waitForURL('**/?idDiseno=200&idEscenario=111&idIntento=900');
  await p.locator('.metronet-identificacion[data-fase="identificacion"]').waitFor();
  assert.match(await p.locator('.metronet-identificacion').innerText(), /RECORRIDO COMPLETADO/);
  assert.equal(v.solicitudes.filter(s => s.path.endsWith('/111/iniciar')).length,1);
  await p.locator('.metronet-identificacion').waitFor({state:'detached'});
  await p.reload(); await p.locator('.metronet-identificacion[data-fase="identificacion"]').waitFor();
  assert.equal(await p.locator('.metronet-identificacion strong').textContent(),'MODO LIBRE');
});

for (const width of [1920,1440,1366,1280,768,390,320]) test(`Cartel ${width}px: responsive, reduced-motion y audio sin reinicio`, async t => {
  const v = await abrirPantalla(navegador, '/escenarios.html', {viewport:{width,height:width<500?568:900}, reducedMotion:'reduce'}); cerrar(t,v);
  const p = v.pagina; await p.clock.install();
  await p.evaluate(async () => {
    const {gestorMusica} = await import('/src/audio/GestorMusica.js');
    gestorMusica.establecerContexto('gameplay');
    const audio = document.querySelector('audio[data-musica-metronet]'); window.audioPrevio = audio;
    if (audio) audio.currentTime = .5;
    const {crearIdentificacionNivel} = await import('/src/educacion/IdentificacionNivel.js');
    window.entrada = crearIdentificacionNivel(); window.fin = entrada.mostrar({numero:10},77);
  });
  const medidas = await p.locator('.metronet-identificacion__cartel').evaluate(e => ({r:e.getBoundingClientRect().toJSON(), animacion:getComputedStyle(e).animationName}));
  assert.equal(medidas.animacion,'none'); assert.ok(medidas.r.x>=0 && medidas.r.right<=width);
  assert.equal(await p.evaluate(() => document.querySelector('audio[data-musica-metronet]') === audioPrevio), true);
  assert.equal(await p.evaluate(() => audioPrevio?.getAttribute('src')), '/audio/simulacion-theme.mp3');
  assert.ok(await p.evaluate(() => !audioPrevio || audioPrevio.currentTime >= .5));
  await p.clock.runFor(1100); assert.equal(await p.evaluate(() => fin),true);
  await p.evaluate(async () => {
    const m = await import('/src/educacion/IdentificacionNivel.js');
    m.registrarEntradaRecorrido({idDiseno:77,idEscenario:111});
    window.especial = m.crearIdentificacionNivel(); window.finEspecial = especial.mostrar({numero:null,idEscenario:111},77);
  });
  const limites = await p.locator('.metronet-identificacion__cartel').evaluate(e => ({r:e.getBoundingClientRect().toJSON(),overflow:e.scrollWidth>e.clientWidth+1}));
  assert.ok(limites.r.right<=width && limites.r.x>=0); assert.equal(limites.overflow,false);
  await p.clock.runFor(1100); assert.equal(await p.evaluate(() => finEspecial),true);
});

test('Recargar no repite un evento pendiente; completar después de recargar sí permite un evento nuevo', async t => {
  const v = await abrirPantalla(navegador,'/escenarios.html'); cerrar(t,v); const p = v.pagina;
  await p.evaluate(async () => (await import('/src/educacion/IdentificacionNivel.js')).registrarEntradaRecorrido({idDiseno:77,idEscenario:111}));
  // Conservar PerformanceNavigationTiming real para distinguir reload de navigate.
  await p.reload();
  await p.evaluate(async () => {
    window.identificar = await import('/src/educacion/IdentificacionNivel.js');
    window.entrada = identificar.crearIdentificacionNivel(); window.fin = entrada.mostrar({numero:null,idEscenario:111},77);
  });
  assert.equal(await p.locator('.metronet-identificacion strong').textContent(),'MODO LIBRE');
  await p.evaluate(() => fin);
  await p.evaluate(() => {
    identificar.registrarEntradaRecorrido({idDiseno:77,idEscenario:111});
    window.nueva = identificar.crearIdentificacionNivel(); window.finNueva = nueva.mostrar({numero:null,idEscenario:111},77);
  });
  assert.equal(await p.locator('.metronet-identificacion strong').textContent(),'RECORRIDO COMPLETADO');
  await p.evaluate(() => finNueva);
});
