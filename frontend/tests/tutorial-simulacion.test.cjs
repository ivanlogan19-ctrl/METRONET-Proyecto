const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

// Cambio aprobado por el usuario: Tutorial visual no bloqueante; las prácticas UV/UT
// pertenecen al recorrido operativo y no deben ejecutarse al leer estas tarjetas.
for (const width of [1440, 390]) test(`Tutorial visual de simulación ${width}: controles libres, cierre y repetición sin cambiar datos`, async t => {
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
  for(let i=0;i<8;i++) {
    const caja = await tutorial.boundingBox();
    assert.ok(caja.x >= 0 && caja.x + caja.width <= width, 'Burbuja dentro del viewport');
    await tutorial.getByRole('button',{name:'Siguiente',exact:true}).click();
  }
  assert.match(await tutorial.innerText(),/Pantalla lista/i);
  await tutorial.getByRole('button',{name:'Comenzar',exact:true}).click();
  await tutorial.waitFor({state:'detached'});
  assert.deepEqual(await p.evaluate(() => ({
    uv: document.querySelector('#velocidadUnidad').value,
    ut: document.querySelector('#duracionSimulacion').value,
    ritmo: document.querySelector('#velocidadSimulacion').value,
  })), valoresIniciales, 'Leer el tutorial no cambia UV, UT ni ritmo');
  assert.equal(uv,4);
  assert.equal(v.solicitudes.filter(s => /\/unidades\/\d+|\/ejecutar$/.test(s.path) && s.method !== 'GET').length,0,
    'Leer el tutorial no guarda UV ni inicia simulación');
  await p.locator('#tutorialPantallaSimulacion').click();
  await tutorial.waitFor();
  await tutorial.getByRole('button',{name:'Omitir',exact:true}).click();
  await tutorial.waitFor({state:'detached'});
  assert.equal(await p.evaluate(() => document.activeElement?.id), 'tutorialPantallaSimulacion', 'Omitir devuelve el foco');
  await p.locator('#tutorialPantallaSimulacion').click();
  await tutorial.waitFor();
  await tutorial.getByRole('button',{name:'Siguiente',exact:true}).focus();
  await p.keyboard.press('Escape');
  await tutorial.waitFor({state:'detached'});
  assert.equal(await p.evaluate(() => document.activeElement?.id), 'tutorialPantallaSimulacion', 'Escape devuelve el foco');
  await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(),0,'No repite en el mismo navegador y campaña');
  campana=2; await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(),0,'La primera visita se recuerda para el usuario actual');
  disponible=false; campana=3; await p.reload(); await p.locator('#velocidadUnidad').waitFor();
  assert.equal(await tutorial.count(),0,'El tutorial no reaparece automáticamente tras recargas');
  await p.locator('#tutorialPantallaSimulacion').click();
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
  for (let paso = 0; paso < 8; paso++) {
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
  await tutorial.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await tutorial.waitFor({ state: 'detached' });
});

for (const [width, height] of [[390, 210], [390, 900], [1440, 900]]) test(`Tutorial ${width}×${height}: pausa y reanuda el mismo paso y libera controles`, async t => {
  const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { viewport: { width, height }, responder: req => {
    if (new URL(req.url()).pathname.endsWith('/ejecutar')) return { json: { idSimulacion: 1, estado: 'COMPLETADA', escala: 'UV_H_V1', ...req.postDataJSON() } };
  }});
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina, tutorial = p.locator('.metronet-recorrido');
  await tutorial.waitFor();
  const acceso = p.locator('#tutorialPantallaSimulacion');
  for (let paso = 0; paso < 8; paso++) {
    assert.match(await tutorial.locator('[data-recorrido-progreso]').innerText(), new RegExp(`${paso + 1} DE 8`));
    await tutorial.locator('[data-recorrido-pausar]').click();
    assert.equal(await tutorial.evaluate(e => e.open), false);
    assert.equal(await acceso.evaluate(e => document.activeElement === e), true, 'Pausar devuelve el foco al botón Tutorial');
    assert.match(await acceso.getAttribute('aria-description'), new RegExp(`paso ${paso + 1} de 8`));
    if (paso === 0) {
      await p.keyboard.press('Escape');
      assert.equal(await tutorial.evaluate(e => e.isConnected && !e.open), true, 'Escape en pausa no descarta el paso guardado');
    }
    await acceso.scrollIntoViewIfNeeded();
    const controles = await p.evaluate(() => {
      const selectores = ['#volverEdicion', '#tutorialPantallaSimulacion',
        '[data-control-musica] summary', '.simulacion-mandos-camara button', '#formularioEjecucion button', '#aplicarUnidadTiempo'];
      return selectores.flatMap(selector => [...document.querySelectorAll(selector)]).filter(e => !e.disabled).map(e => {
        const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (!r.width || !r.height || x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) return null;
        const frente = document.elementFromPoint(x, y);
        return { control: e.getAttribute('aria-label') || e.id || selector, tapadoPorTutorial: Boolean(frente?.closest('.metronet-recorrido')) };
      }).filter(Boolean);
    });
    assert.ok(controles.length >= 1);
    assert.deepEqual(controles.filter(c => c.tapadoPorTutorial), [], `La tarjeta no intercepta controles al pausar en paso ${paso + 1}`);
    if (paso === 0) {
      await p.evaluate(() => {
        window.__qaAccesosPausados = { volver: 0, musica: 0 };
        for (const [selector, clave] of [['#volverEdicion', 'volver'], ['[data-hud-mapa] summary[aria-label="Música"]', 'musica']])
          document.querySelector(selector)?.addEventListener('click', evento => {
            window.__qaAccesosPausados[clave]++;
            evento.preventDefault(); evento.stopImmediatePropagation();
          }, { capture: true, once: true });
      });
      await p.locator('[data-hud-mapa] summary[aria-label="Música"]').click();
      await p.locator('#volverEdicion').click();
      assert.deepEqual(await p.evaluate(() => window.__qaAccesosPausados), { volver: 1, musica: 1 },
        'Volver y Música reciben clic real tras pausar, sin navegar en esta prueba');
    }
    if (paso === 2 && width === 390 && height === 210) {
      const ejecucion = p.waitForResponse(res => res.url().endsWith('/api/simulaciones/77/ejecutar') && res.request().method() === 'POST');
      await p.getByRole('button', { name: 'Iniciar simulación', exact: true }).scrollIntoViewIfNeeded();
      await p.getByRole('button', { name: 'Iniciar simulación', exact: true }).click();
      assert.equal((await ejecucion).status(), 200, 'Play es real y accesible después de pausar en pantalla baja');
    }
    await acceso.click();
    assert.equal(await tutorial.evaluate(e => e.open), true);
    assert.equal(await acceso.getAttribute('aria-description'), null);
    assert.match(await tutorial.locator('[data-recorrido-progreso]').innerText(), new RegExp(`${paso + 1} DE 8`), 'Retoma el mismo paso');
    await tutorial.getByRole('button', { name: 'Siguiente', exact: true }).click();
  }
  await tutorial.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await tutorial.waitFor({ state: 'detached' });
});
