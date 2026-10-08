const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla: abrirBase } = require('./soporte/pantallas.cjs');
// La presentación completa pertenece al nuevo Nivel 1; después solo hay prácticas incrementales.
async function abrirPantalla(navegador,ruta,opciones={}) {
  return abrirBase(navegador,ruta,{...opciones,responder:async req=>{
    const respuesta=await opciones.responder?.(req);
    if(respuesta) return respuesta;
    if(new URL(req.url()).pathname==='/api/juego/progreso') return {json:{
      escenarios:[{idEscenario:42,numero:1,nombre:'Primer recorrido',cantidadIntentosCampana:1,estado:'COMPLETADO',desbloqueado:true,progreso:100}],numeroCampanaActual:1,nivelesCompletados:1,cantidadNiveles:10,
    }};
  }});
}
let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

// La presentación del Nivel 1 es no bloqueante y no modifica parámetros.
// Las prácticas de los niveles posteriores esperan acciones reales.
for (const width of [1440, 390]) test(`Tutorial visual de simulación ${width}: controles libres, cierre y repetición sin cambiar datos`, async t => {
  let campana = 1, disponible = true, uv = 4;
  const escenario = { idEscenario: 44, numero: 1, nombre: 'Simulación', herramientasHabilitadas: { simulacion: true } };
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
  const valoresIniciales = await p.evaluate(() => ({
    uv: document.querySelector('#velocidadUnidad').value,
    ut: document.querySelector('#duracionSimulacion').value,
    ritmo: document.querySelector('#velocidadSimulacion').value,
  }));
  const acercarMapa = p.getByRole('button', { name: 'Acercar mapa', exact: true });
  await acercarMapa.click();
  await acercarMapa.focus();
  assert.equal(await acercarMapa.evaluate(e => e === document.activeElement), true, 'El teclado alcanza controles externos al tutorial');
  await p.keyboard.press('Enter');
  const posicionInicial = await tutorial.boundingBox();
  await p.evaluate(() => window.scrollBy({ top: 100, behavior: 'instant' }));
  await p.waitForTimeout(100);
  const posicionDesplazada = await tutorial.boundingBox();
  assert.ok(Math.abs(posicionDesplazada.y - posicionInicial.y) <= 150,
    'La tarjeta del mapa no debe saltar de un extremo al otro al desplazar la página');
  await p.evaluate(() => window.scrollBy({ top: 500, behavior: 'instant' }));
  await p.waitForTimeout(100);
  const marca = await p.locator('.metronet-recorrido__marca').evaluate(e => {
    const r = e.getBoundingClientRect();
    return { oculta: e.hidden, izquierda: r.left, arriba: r.top, derecha: r.right, abajo: r.bottom };
  });
  assert.ok(marca.oculta || (marca.izquierda >= 0 && marca.arriba >= 0 && marca.derecha <= width && marca.abajo <= 900),
    'El marco del recorrido debe quedar dentro del viewport visible');
  const tarjetaDesplazada = await tutorial.boundingBox();
  assert.ok(marca.oculta || tarjetaDesplazada.x >= marca.derecha || tarjetaDesplazada.x + tarjetaDesplazada.width <= marca.izquierda
    || tarjetaDesplazada.y >= marca.abajo || tarjetaDesplazada.y + tarjetaDesplazada.height <= marca.arriba,
  'El marco no debe atravesar el texto ni los botones de la tarjeta');
  await p.evaluate(() => {
    const espacio = document.createElement('div'); espacio.id = 'espacioPruebaRecorrido'; espacio.style.height = '1000px'; document.body.append(espacio);
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  });
  await p.waitForTimeout(100);
  assert.equal(await p.locator('.metronet-recorrido__marca').isHidden(), true,
    'El marco debe ocultarse cuando el objetivo sale por completo de pantalla');
  await p.evaluate(() => document.getElementById('espacioPruebaRecorrido').remove());
  await p.setViewportSize({ width, height: 210 });
  const tarjetaBaja = await tutorial.evaluate(e => ({ alto: e.clientHeight, contenido: e.scrollHeight }));
  assert.ok(tarjetaBaja.contenido > tarjetaBaja.alto, 'La tarjeta debe permitir scroll interno en ventanas bajas');
  await p.evaluate(() => {
    window.__qaDetrasTutorial = { clicks: 0, ruedasMapa: 0 };
    document.querySelector('h1')?.addEventListener('click', () => window.__qaDetrasTutorial.clicks++);
    document.querySelector('#visorSimulacion canvas')?.addEventListener('wheel', () => window.__qaDetrasTutorial.ruedasMapa++);
  });
  await tutorial.evaluate(e => { e.scrollTop = 0; });
  const ventanaAntesRueda = await p.evaluate(() => scrollY);
  const tarjetaCorta = await tutorial.boundingBox();
  const cursor = { x: tarjetaCorta.x + tarjetaCorta.width / 2, y: tarjetaCorta.y + tarjetaCorta.height / 2 };
  await p.mouse.move(cursor.x, cursor.y);
  const estadoRueda = await p.evaluate(({ x, y }) => {
    const tarjeta = document.querySelector('.metronet-recorrido');
    const elemento = document.elementFromPoint(x, y);
    return { cursorDentro: elemento === tarjeta || tarjeta.contains(elemento), abierta: tarjeta.open,
      animaciones: tarjeta.getAnimations().filter(animacion => animacion.playState === 'running').length,
      scrollTop: tarjeta.scrollTop, scrollHeight: tarjeta.scrollHeight, clientHeight: tarjeta.clientHeight };
  }, cursor);
  assert.ok(estadoRueda.cursorDentro && estadoRueda.abierta && estadoRueda.scrollHeight > estadoRueda.clientHeight, JSON.stringify(estadoRueda));
  await p.mouse.wheel(0, 150);
  await p.waitForFunction(() => document.querySelector('.metronet-recorrido')?.scrollTop > 0, null, { timeout: 2000 });
  assert.ok(await tutorial.evaluate(e => e.scrollTop) > 0, 'La rueda debe desplazar la tarjeta, no el contenido detrás');
  assert.equal(await p.evaluate(() => scrollY), ventanaAntesRueda, 'La página no se desplaza al leer la tarjeta');
  await tutorial.locator('h2').click();
  assert.deepEqual(await p.evaluate(() => window.__qaDetrasTutorial), { clicks: 0, ruedasMapa: 0 },
    'Clic y rueda sobre la tarjeta no llegan a controles ni títulos detrás');
  await tutorial.getByRole('button',{name:'Siguiente',exact:true}).scrollIntoViewIfNeeded();
  await p.setViewportSize({ width, height: 900 });
  for(let i=0;await tutorial.getAttribute('data-objetivo') !== 'fin' && i<25;i++) {
    const caja = await tutorial.boundingBox();
    assert.ok(caja.x >= 0 && caja.x + caja.width <= width, 'Burbuja dentro del viewport');
    await tutorial.getByRole('button',{name:'Siguiente',exact:true}).click();
  }
  assert.match(await tutorial.innerText(),/¡Listo para simular!/i);
  await tutorial.waitFor({state:'detached',timeout:5000});
  assert.deepEqual(await p.evaluate(() => ({
    uv: document.querySelector('#velocidadUnidad').value,
    ut: document.querySelector('#duracionSimulacion').value,
    ritmo: document.querySelector('#velocidadSimulacion').value,
  })), valoresIniciales, 'Leer el tutorial no cambia UV, horas ni ritmo');
  assert.equal(uv,4);
  assert.equal(v.solicitudes.filter(s => /\/unidades\/\d+|\/ejecutar$/.test(s.path) && s.method !== 'GET').length,0,
    'Leer el tutorial no guarda UV ni inicia simulación');
  await p.locator('#tutorialPantallaSimulacion').click();
  const panelManual = p.locator('.metronet-tutorial-simulacion:popover-open');
  await panelManual.waitFor();
  assert.equal(await panelManual.getByRole('button').count(),1);
  assert.equal(await panelManual.getByRole('button').evaluate(e => getComputedStyle(e).backgroundColor),'rgb(244, 237, 121)');
  await panelManual.getByRole('button',{name:'Recorrer la pantalla'}).click();
  await tutorial.waitFor();
  await tutorial.getByRole('button',{name:'Omitir',exact:true}).click();
  await tutorial.waitFor({state:'detached'});
  assert.equal(await p.evaluate(() => document.activeElement?.id), 'tutorialPantallaSimulacion', 'Omitir devuelve el foco');
  await p.locator('#tutorialPantallaSimulacion').click();
  await p.locator('.metronet-tutorial-simulacion:popover-open').getByRole('button',{name:'Recorrer la pantalla'}).click();
  await tutorial.waitFor();
  await tutorial.getByRole('button',{name:'Siguiente',exact:true}).focus();
  await p.keyboard.press('Escape');
  await tutorial.waitFor({state:'detached'});
  assert.equal(await p.evaluate(() => document.activeElement?.id), 'tutorialPantallaSimulacion', 'Escape devuelve el foco');
  await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(),0,'No repite en el mismo navegador y campaña');
  campana=2; await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  await tutorial.waitFor();
  await tutorial.getByRole('button',{name:'Omitir',exact:true}).click();
  disponible=false; campana=3; await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  await tutorial.waitFor();
  await tutorial.getByRole('button',{name:'Omitir',exact:true}).click();
  await p.locator('#tutorialPantallaSimulacion').click();
  await p.locator('.metronet-tutorial-simulacion:popover-open').getByRole('button',{name:'Recorrer la pantalla'}).click();
  await tutorial.waitFor();
  const ejecucionManual = p.waitForResponse(respuesta => respuesta.url().endsWith('/api/simulaciones/77/ejecutar')
    && respuesta.request().method() === 'POST');
  await p.getByRole('button', { name: 'Iniciar simulación', exact: true }).click();
  await ejecucionManual;
  assert.equal(v.solicitudes.filter(s => s.path.endsWith('/ejecutar')).length, 1,
    'Play ejecuta solamente cuando el usuario lo pulsa durante el tutorial');
  await tutorial.getByRole('button',{name:'Omitir',exact:true}).click();
  await tutorial.waitFor({state:'detached'});
});

for (const [width, height] of [[390, 210], [390, 900], [1440, 900]]) test(`Tutorial ${width}×${height}: la tarjeta recibe clics sin accionar controles detrás`, async t => {
  const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { viewport: { width, height } });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina, tutorial = p.locator('.metronet-recorrido');
  await tutorial.waitFor();
  const datosAntes = await p.evaluate(() => {
    window.__qaControlesDetras = 0;
    for (const selector of ['#formularioEjecucion button', '#pausarSimulacion', '#detenerSimulacion',
      '#reiniciarSimulacion', '#aplicarUnidadTiempo', '#volverEdicion', '#velocidadUnidad', '#duracionSimulacion']) {
      document.querySelector(selector)?.addEventListener('pointerdown', () => window.__qaControlesDetras++);
    }
    return {
      uv: document.querySelector('#velocidadUnidad').value,
      ut: document.querySelector('#duracionSimulacion').value,
      ritmo: document.querySelector('#velocidadSimulacion').value,
      estado: document.querySelector('#estadoTiempoReal').textContent,
    };
  });
  const urlInicial = p.url();
  for (let paso = 0; await tutorial.getAttribute('data-objetivo') !== 'fin' && paso < 25; paso++) {
    await tutorial.locator('h2').scrollIntoViewIfNeeded();
    await tutorial.locator('h2').click();
    const caja = await tutorial.boundingBox();
    const borde = { x: caja.x + 6, y: caja.y + 6 };
    assert.equal(await p.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.metronet-recorrido')), borde), true,
      `El fondo de la tarjeta recibe el puntero en el paso ${paso + 1}`);
    await p.mouse.click(borde.x, borde.y);
    if (paso === 2 && width === 390 && height === 210) {
      const puntoRegresion = { x: 121.5, y: 160.8 };
      assert.equal(await p.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.metronet-recorrido')), puntoRegresion), true,
        'El punto que antes activó Play queda dentro de la tarjeta');
      await p.mouse.click(puntoRegresion.x, puntoRegresion.y);
      assert.equal(v.solicitudes.filter(s => ['/validacion', '/guardar', '/ejecutar'].some(final => s.path.endsWith(final))).length, 0,
        'Clic en Acciones no inicia validación, guardado ni ejecución');
    }
    await tutorial.getByRole('button', { name: 'Siguiente', exact: true }).click();
  }
  assert.equal(await p.evaluate(() => window.__qaControlesDetras), 0);
  assert.equal(v.solicitudes.filter(s => s.method !== 'GET').length, 0);
  assert.equal(p.url(), urlInicial);
  assert.deepEqual(await p.evaluate(() => ({
    uv: document.querySelector('#velocidadUnidad').value,
    ut: document.querySelector('#duracionSimulacion').value,
    ritmo: document.querySelector('#velocidadSimulacion').value,
    estado: document.querySelector('#estadoTiempoReal').textContent,
  })), datosAntes);
  await tutorial.waitFor({ state: 'detached', timeout:5000 });
});

for (const [width, height] of [[390, 210], [390, 900], [1440, 900]]) test(`Tutorial ${width}×${height}: Omitir no deja pausa ni vuelve al recargar`, async t => {
  const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { viewport: { width, height } });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina, tutorial = p.locator('.metronet-recorrido');
  await tutorial.waitFor();
  assert.equal(await tutorial.locator('[data-recorrido-pausar]').count(), 0);
  await tutorial.getByRole('button', { name: 'Omitir', exact: true }).click();
  await tutorial.waitFor({ state: 'detached' });
  assert.equal(await p.evaluate(() => localStorage.getItem('metronet:tutorial-pantalla-simulacion:v4:7:1:1')), 'omitido');
  await p.reload();
  await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(), 0);
  await p.locator('#tutorialPantallaSimulacion').click();
  await p.locator('.metronet-tutorial-simulacion:popover-open').getByRole('button',{name:'Recorrer la pantalla'}).click();
  await tutorial.waitFor();
  assert.equal(await tutorial.locator('[data-recorrido-pausar]').count(), 0);
  await tutorial.getByRole('button', { name: 'Omitir', exact: true }).click();
});

test('Reiniciar la campaña vuelve a ofrecer el recorrido de Simulación completado', async t => {
  let campana = 1;
  const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { responder: req => {
    const ruta = new URL(req.url()).pathname;
    if (ruta === '/api/juego/progreso' && campana === 2) return { json: {
      escenarios: [{ idEscenario:42, numero:1, nombre:'Primer recorrido', estado:'DISPONIBLE', desbloqueado:true, progreso:0 }],
      numeroCampanaActual:2, nivelesCompletados:0, modoLibreDesbloqueado:false,
    } };
    if (ruta === '/api/juego/recorrido/reiniciar') { campana = 2; return { json: {
      escenarios: [{ idEscenario: 41, numero: 1, nombre: 'Red inicial', estado: 'DISPONIBLE', desbloqueado: true, progreso: 0 }],
      numeroCampanaActual: 2, nivelesCompletados: 0, modoLibreDesbloqueado: false,
    } }; }
  } });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina, guia = p.locator('.metronet-recorrido');
  await guia.waitFor();
  while (await guia.getAttribute('data-objetivo') !== 'fin') await guia.locator('[data-recorrido-siguiente]').click();
  assert.equal(await guia.locator('h2').textContent(), '¡Listo para simular!');
  await guia.waitFor({state:'detached',timeout:5000});
  const clave = 'metronet:tutorial-pantalla-simulacion:v4:7:1:1';
  assert.equal(await p.evaluate(clave => localStorage.getItem(clave), clave), 'presentado');
  await p.goto(`${new URL(p.url()).origin}/escenarios.html`);
  await p.locator('#botonReiniciarRecorrido:not([hidden])').click();
  await p.locator('[data-confirmar-reinicio]').click();
  await p.waitForFunction(() => document.getElementById('mensajeEscenarios')?.textContent.includes('reinició'));
  assert.equal(await p.evaluate(clave => localStorage.getItem(clave), clave), 'presentado');
  await p.goto(`${new URL(p.url()).origin}/simulacion.html?idDiseno=77`);
  await guia.waitFor();
  assert.equal(await guia.getAttribute('data-objetivo'), '#visorSimulacion');
});
