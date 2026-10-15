const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla: abrirBase } = require('./soporte/pantallas.cjs');
// La presentación completa pertenece al nuevo Nivel 1; después solo hay prácticas incrementales.
async function abrirPantalla(navegador,ruta,opciones={}) {
  const vista = await abrirBase(navegador,ruta,{...opciones,responder:async req=>{
    const respuesta=await opciones.responder?.(req);
    if(respuesta) return respuesta;
    if(new URL(req.url()).pathname==='/api/juego/progreso') return {json:{
      escenarios:[{idEscenario:42,numero:1,nombre:'Primer recorrido',cantidadIntentosCampana:1,estado:'COMPLETADO',desbloqueado:true,progreso:100}],numeroCampanaActual:1,nivelesCompletados:1,cantidadNiveles:10,
    }};
  }});
  if (ruta.startsWith('/simulacion.html')) await vista.pagina.getByRole('button', { name: 'Iniciar tutorial', exact: true }).click();
  return vista;
}
let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const width of [1440, 390]) test(`Mapa de la red ${width}: el primer paso conserva el marco visible`, async t => {
  const v=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{viewport:{width,height:900}});
  t.after(()=>v.contexto.close());const p=v.pagina;
  const marca=p.locator('.metronet-recorrido__marca');
  assert.equal(await marca.isVisible(),false,'La marca flotante no debe atravesar el cartel');
  const mapa=p.locator('#visorSimulacion');
  assert.equal(await mapa.evaluate(e=>getComputedStyle(e).outlineWidth),'3px');
  const m=await mapa.boundingBox(), c=await p.locator('.metronet-recorrido').boundingBox();
  assert.ok(c.x>=m.x && c.x+c.width<=m.x+m.width+1,'El cartel permanece dentro del mapa');
  await p.screenshot({path:`/tmp/metronet-marco-mapa-${width}.png`});
  await p.getByRole('button',{name:'Siguiente',exact:true}).click();
  assert.equal(await mapa.evaluate(e=>e.style.outline),'','Al avanzar se limpia el resaltado');
  assert.deepEqual(v.errores,[]);
});

for (const anterior of ['presentado', 'omitido']) test(`Tutorial actualizado: registro anterior ${anterior} no omite el paseo nuevo`, async t => {
  const v = await abrirPantalla(navegador, '/escenarios.html');
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.evaluate(anterior => {
    localStorage.setItem('metronet:tutorial-pantalla-simulacion:v4:7:1:1', anterior);
    localStorage.setItem('metronet:tutorial-pantalla-simulacion:v4:7:1:primera-visita', 'presentado');
    localStorage.setItem('metronet:funciones-ensenadas:v1:7', JSON.stringify(['editor.basico', 'simulacion.inicial', 'simulacion.velocidad']));
  }, anterior);
  await p.goto(new URL('/simulacion.html?idDiseno=77', p.url()).href);
  const tutorial = p.locator('.metronet-recorrido');
  await tutorial.waitFor({ timeout: 5000 });
  assert.equal(await tutorial.locator('h2').textContent(), 'Nueva funcionalidad');
  await tutorial.getByRole('button', { name: 'Iniciar tutorial', exact: true }).click();
  assert.equal(await tutorial.locator('h2').textContent(), 'Mapa de la red');
  await tutorial.getByRole('button', { name: 'Salir del tutorial', exact: true }).click();
  await p.reload();
  await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(), 0, 'La omisión de la versión nueva sí se respeta');
  await p.locator('#tutorialPantallaSimulacion').click();
  await p.getByRole('button', { name: 'Recorrer la pantalla', exact: true }).click();
  await tutorial.waitFor();
  assert.equal(await tutorial.locator('h2').textContent(), 'Mapa de la red');
  assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('metronet:funciones-ensenadas:v1:7'))),
    ['editor.basico', 'simulacion.inicial', 'simulacion.velocidad'], 'No se borra el aprendizaje anterior');
});

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
    return { oculta: e.hidden, recortada: Boolean(e.style.clipPath), izquierda: r.left, arriba: r.top, derecha: r.right, abajo: r.bottom };
  });
  assert.ok(marca.oculta || (marca.izquierda >= 0 && marca.arriba >= 0 && marca.derecha <= width && marca.abajo <= 900),
    'El marco del recorrido debe quedar dentro del viewport visible');
  const tarjetaDesplazada = await tutorial.boundingBox();
  assert.ok(marca.oculta || marca.recortada || tarjetaDesplazada.x >= marca.derecha || tarjetaDesplazada.x + tarjetaDesplazada.width <= marca.izquierda
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
  // Sin el contador, la tarjeta cabe en 210 px; forzar una altura realmente insuficiente.
  await p.setViewportSize({ width, height: 160 });
  const tarjetaBaja = await tutorial.evaluate(e => ({ alto: e.clientHeight, contenido: e.scrollHeight }));
  assert.ok(tarjetaBaja.contenido > tarjetaBaja.alto, 'La tarjeta debe permitir scroll interno en ventanas bajas');
  await p.evaluate(() => {
    window.__qaDetrasTutorial = { clicks: 0, ruedasMapa: 0 };
    document.querySelector('h1')?.addEventListener('click', () => window.__qaDetrasTutorial.clicks++);
    document.querySelector('#visorSimulacion canvas')?.addEventListener('wheel', () => window.__qaDetrasTutorial.ruedasMapa++);
  });
  await tutorial.evaluate(e => { e.scrollTop = 0; });
  const ventanaAntesRueda = await p.evaluate(() => scrollY);
  // El ResizeObserver reposiciona el coach mark: esperar actionability evita usar
  // el centro anterior mientras todavía se acomoda al viewport nuevo.
  await tutorial.locator('h2').hover();
  const encabezado = await tutorial.locator('h2').boundingBox();
  const cursor = { x: encabezado.x + encabezado.width / 2, y: encabezado.y + encabezado.height / 2 };
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
  const titulosVisitados=[];
  for(let i=0;await tutorial.getAttribute('data-objetivo') !== 'fin' && i<25;i++) {
    titulosVisitados.push(await tutorial.locator('h2').textContent());
    const caja = await tutorial.boundingBox();
    assert.ok(caja.x >= 0 && caja.x + caja.width <= width, 'Burbuja dentro del viewport');
    assert.equal(await tutorial.locator('[data-recorrido-progreso]').isVisible(), false);
    assert.doesNotMatch(await tutorial.innerText(), /RECORRIDO\s*\/\/|\d+\s+DE\s+\d+/i);
    await tutorial.getByRole('button',{name:'Siguiente',exact:true}).click();
  }
  assert.ok(titulosVisitados.includes('Detalle de metros'));
  assert.ok(!titulosVisitados.includes('Vista del mapa'));
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
  assert.equal(await panelManual.getByRole('button',{name:'Recorrer la pantalla'}).evaluate(e => getComputedStyle(e).backgroundColor),'rgb(244, 237, 121)');
  await panelManual.getByRole('button',{name:'Recorrer la pantalla'}).click();
  await tutorial.waitFor();
  await tutorial.getByRole('button',{name:'Salir del tutorial',exact:true}).click();
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
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  assert.equal(await tutorial.count(),0,'La nueva campaña vuelve a ofrecerlo y respeta omitir');
  disponible=false; campana=3; await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  assert.equal(await tutorial.count(),0);
  await p.locator('#tutorialPantallaSimulacion').click();
  await p.locator('.metronet-tutorial-simulacion:popover-open').getByRole('button',{name:'Recorrer la pantalla'}).click();
  await tutorial.waitFor();
  const ejecucionManual = p.waitForResponse(respuesta => respuesta.url().endsWith('/api/simulaciones/77/ejecutar')
    && respuesta.request().method() === 'POST');
  await p.getByRole('button', { name: 'Iniciar simulación', exact: true }).click();
  await ejecucionManual;
  assert.equal(v.solicitudes.filter(s => s.path.endsWith('/ejecutar')).length, 1,
    'Play ejecuta solamente cuando el usuario lo pulsa durante el tutorial');
  await tutorial.getByRole('button',{name:'Salir del tutorial',exact:true}).click();
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
    // Comprobar el encabezado real: las coordenadas del diseño anterior ya
    // no corresponden a la tarjeta compacta, y fuera debe poder cerrarse.
    if (width === 390 && height === 210) {
      const titulo = await tutorial.locator('h2').boundingBox();
      const punto = { x: titulo.x + titulo.width / 2, y: titulo.y + titulo.height / 2 };
      assert.equal(await p.evaluate(({x,y}) => Boolean(document.elementFromPoint(x,y)?.closest('.metronet-recorrido')), punto), true);
      await p.mouse.click(punto.x,punto.y);
      assert.equal(v.solicitudes.filter(s => s.method !== 'GET').length, 0,
        'El cartel intercepta los clics sin modificar ni ejecutar la red');
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
  await tutorial.getByRole('button', { name: 'Salir del tutorial', exact: true }).click();
  await tutorial.waitFor({ state: 'detached' });
  assert.equal(await p.evaluate(() => localStorage.getItem('metronet:tutorial-pantalla-simulacion:v5:7:1:1:77')), 'omitido');
  await p.reload();
  await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(), 0);
  await p.locator('#tutorialPantallaSimulacion').click();
  await p.locator('.metronet-tutorial-simulacion:popover-open').getByRole('button',{name:'Recorrer la pantalla'}).click();
  await tutorial.waitFor();
  assert.equal(await tutorial.locator('[data-recorrido-pausar]').count(), 0);
  await tutorial.getByRole('button', { name: 'Salir del tutorial', exact: true }).click();
});

test('Reiniciar la campaña vuelve a ofrecer el tutorial de Simulación', async t => {
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
  const clave = 'metronet:tutorial-pantalla-simulacion:v5:7:1:1:77';
  assert.equal(await p.evaluate(clave => localStorage.getItem(clave), clave), 'presentado');
  await p.goto(`${new URL(p.url()).origin}/escenarios.html`);
  await p.locator('#botonReiniciarRecorrido:not([hidden])').click();
  await p.locator('[data-confirmar-reinicio]').click();
  await p.waitForFunction(() => document.getElementById('mensajeEscenarios')?.textContent.includes('reinició'));
  assert.equal(await p.evaluate(clave => localStorage.getItem(clave), clave), 'presentado');
  await p.goto(`${new URL(p.url()).origin}/simulacion.html?idDiseno=77`);
  await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await guia.locator('h2').textContent(),'Nueva funcionalidad');
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  await p.locator('#tutorialPantallaSimulacion').click();
  await p.getByRole('button',{name:'Recorrer la pantalla',exact:true}).click();
  await guia.waitFor();
  assert.equal(await guia.getAttribute('data-objetivo'), '#visorSimulacion');
});

test('Primera visita a simulación: tutorial automático desde cualquier nivel', async () => {
  for (const numero of [1,2,3,4,5,6,7,8,9,10]) {
    const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { responder: req => {
      if (new URL(req.url()).pathname === '/api/juego/progreso') return {json:{
        escenarios:[{idEscenario:42,numero,nombre:`Nivel ${numero}`,cantidadIntentosCampana:1,desbloqueado:true}],
        numeroCampanaActual:1,
      }};
    }});
    try {
      const p = v.pagina;
      await p.waitForFunction(() => document.querySelector('#velocidadUnidad')?.value === '40');
      const corresponde = true;
      if (corresponde) await p.locator('.metronet-recorrido').waitFor();
      assert.equal(await p.locator('.metronet-recorrido').count(), corresponde ? 1 : 0, `Nivel ${numero}`);
      if (corresponde) {
        assert.equal(await p.locator('.metronet-recorrido h2').textContent(),'Mapa de la red');
        assert.equal(await p.locator('[data-recorrido-siguiente]').evaluate(e=>e.getBoundingClientRect().width),24);
        await p.getByRole('button',{name:'Salir del tutorial',exact:true}).click();
        await p.reload();
        await p.waitForFunction(() => document.querySelector('#velocidadUnidad')?.value === '40');
        assert.equal(await p.locator('.metronet-recorrido').count(),0, `No repetir en nivel ${numero}`);
      }
      assert.equal(v.solicitudes.filter(s=>s.method !== 'GET').length,0);
      assert.deepEqual(v.errores,[]);
    } finally { await v.contexto.close(); }
  }
});

for (const modo of ['LIBRE', 'EDICION_LIBRE']) test(`Simulación ${modo}: ofrece funciones nuevas, respeta la omisión y conserva ayuda manual`, async t => {
  const v = await abrirBase(navegador, '/simulacion.html?idDiseno=77', { responder: req => {
    if (/^\/api\/simulaciones\/(77|78)$/.test(new URL(req.url()).pathname)) return { json: {
      simulacion: { idDiseno: Number(new URL(req.url()).pathname.split('/').at(-1)), idEscenario: 42, nombre: 'Modo libre', modo, estado: 'VALIDADO' },
      estaciones: [], lineas: [], tramos: [], unidadesMetro: [], resultados: [],
      preparadoParaSimular: false, territorio: { areas: [], errores: [] },
    } };
  } });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  await p.getByRole('heading', { name: 'Modo libre', exact: true }).waitFor();
  await p.getByRole('heading', { name: 'Simulación de Modo Libre', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Recorrer las funciones', exact: true }).click();
  for (const titulo of ['Elegir línea', 'Velocidad y tiempo vinculados', 'Tiempos fraccionarios', 'Distancias de la red', 'Horarios de la simulación', 'Elegir la hora de inicio', 'Calles y avenidas', 'Tráfico sincronizado', 'Densidad de población', 'Desplazamientos sincronizados', 'Cobertura de las estaciones', 'Transparencia de las capas']) {
    await p.locator('.metronet-recorrido').getByRole('heading', { name: titulo, exact: true }).waitFor();
    assert.equal(await p.locator('[data-capa-simulacion][aria-pressed="true"]').count(), 0, 'La guía no activa capas');
    await p.locator('[data-recorrido-siguiente]').click();
  }
  await p.locator('.metronet-recorrido').waitFor({ state: 'detached' });
  await p.reload();
  await p.locator('.simulacion-horarios').waitFor();
  await p.waitForTimeout(400);
  assert.equal(await p.locator('.metronet-recorrido').count(), 0);
  assert.deepEqual(await p.evaluate(() => Object.keys(localStorage).filter(c => c.includes('tutorial-pantalla-simulacion'))), []);
  await p.locator('#tutorialPantallaSimulacion').click();
  await p.getByRole('button', { name: 'Recorrer la pantalla', exact: true }).click();
  await p.locator('.metronet-recorrido').getByRole('heading', { name: 'Elegir línea', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Salir del tutorial', exact: true }).click();
  await p.goto(new URL('/simulacion.html?idDiseno=78', p.url()).href);
  await p.getByRole('heading', { name: 'Simulación de Modo Libre', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Continuar', exact: true }).click();
  await p.reload();
  await p.locator('.simulacion-horarios').waitFor();
  await p.waitForTimeout(400);
  assert.equal(await p.locator('.metronet-recorrido').count(), 0);
  assert.equal(v.solicitudes.filter(s => s.method !== 'GET').length, 0);
  assert.deepEqual(v.errores, []);
});

test('Regla: total por línea, teclado y distancias ausentes sin valores inventados', async t => {
  let modo = 'LIBRE', distancia = 3.5;
  const v = await abrirBase(navegador, '/simulacion.html?idDiseno=77', { responder: req => {
    if (new URL(req.url()).pathname === '/api/simulaciones/77') return {json: {
      simulacion:{idDiseno:77,idEscenario:42,nombre:'Modo libre',modo,estado:'VALIDADO'},
      estaciones:[{nombre:'A',posicionX:400,posicionY:420},{nombre:'B',posicionX:570,posicionY:440},{nombre:'C',posicionX:770,posicionY:410}],
      lineas:[{nombre:'Línea 01'},{nombre:'Línea 02'}],
      tramos:[{nombreLinea:'Línea 01',estacionA:'A',estacionB:'B',distanciaKm:2.4},{nombreLinea:'Línea 02',estacionA:'B',estacionB:'C',distanciaKm:distancia}],
      unidadesMetro:[{idTren:1,nombreLinea:'Línea 01',capacidad:300,velocidadPromedio:4,duracionUt:2},{idTren:2,nombreLinea:'Línea 02',capacidad:300,velocidadPromedio:4,duracionUt:2}],
      preparadoParaSimular:true,observacionesSimulacion:[],resultados:[],territorio:{areas:[],errores:[]},
    }};
  }});
  t.after(()=>v.contexto.close());
  const p=v.pagina;
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  const regla=p.locator('[data-medicion-distancias]');
  // La regla muestra la distancia de la línea seleccionada.
  await regla.focus(); await p.keyboard.press('Enter');
  await p.waitForFunction(()=>document.querySelector('.metronet-mediciones__total').textContent==='Línea 01 · 2,4 km');
  await p.locator('.simulacion-selector-metros > summary').click();
  await p.locator('button[data-metro="2"]').click();
  await p.waitForFunction(()=>document.querySelector('.metronet-mediciones__total').textContent==='Línea 02 · 3,5 km');
  await regla.focus(); await p.keyboard.press('Space');
  assert.equal(await p.locator('.metronet-mediciones').isVisible(),false);
  distancia=null;
  await p.reload();
  await p.locator('.simulacion-selector-metros > summary').click();
  await p.locator('button[data-metro="2"]').click();
  await p.getByRole('button',{name:'Mostrar distancias en kilómetros',exact:true}).click();
  assert.equal(await p.locator('.metronet-mediciones__tramo').count(),1);
  assert.equal(await p.locator('.metronet-mediciones__total').isVisible(),false,'No sumar una red incompleta');
  await p.locator('.simulacion-selector-metros > summary').click();
  await p.locator('button[data-metro="1"]').click();
  await p.waitForFunction(()=>document.querySelector('.metronet-mediciones__total').textContent==='Línea 01 · 2,4 km');
  modo='NIVEL'; await p.reload();
  await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await p.locator('[data-medicion-distancias],.metronet-mediciones').count(),0);
  assert.equal(v.solicitudes.filter(s=>s.method!=='GET').length,0);
  assert.deepEqual(v.errores,[]);
});
