const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const API = process.env.METRONET_API_PRUEBAS;
const BASE = 'http://127.0.0.1:5198';

test('calles y tráfico histórico: controles, edición libre, cámara, POI y persistencia reales', { skip: !API, timeout: 300000 }, async t => {
  const browser = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  // Solo cambia el destino al Spring de prueba; no reemplaza respuestas REST.
  await context.route(/http:\/\/[^/]+:8080\//, route => route.continue({ url: API + new URL(route.request().url()).pathname + new URL(route.request().url()).search }));
  // Instrumentación de lectura para situar clics y observar la cámara real.
  await context.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('let juego = new Phaser.Game(config);', 'let juego = new Phaser.Game(config); window.juegoPrueba = juego;') });
  });
  await context.route('**/src/simulacion/EscenaSimulacion.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('resolver({ escena: this, destruir });', 'window.escenaSimulacionPrueba = this; resolver({ escena: this, destruir });') });
  });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const errores = [], fallos = [];
  let escrituras = 0;
  page.on('request', r => { if (r.url().includes('/api/') && ['POST','PUT','PATCH','DELETE'].includes(r.method())) escrituras++; });
  page.on('pageerror', e => errores.push(e.stack));
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) fallos.push([r.url(), r.status()]); });
  const frame = () => page.frames().find(f => f.parentFrame());
  const leer = fn => frame().evaluate(fn);
  const esperarEditor = async () => {
    await page.waitForFunction(() => document.querySelector('#pantalla-metronet')?.contentWindow?.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro?.disenoActual);
    await frame().waitForFunction(() => !juegoPrueba.scene.getScene('MapaScene').editorRedMetro.identificacion);
  };
  async function login() {
    await page.goto(BASE + '/admin-login.html');
    await page.locator('#pantalla-metronet').waitFor();
    await frame().locator('#usuario').fill('calles-e2e');
    await frame().locator('#password').fill(process.env.METRONET_E2E_CLAVE);
    await frame().locator('#loginAdminButton').click();
    await frame().getByRole('link', { name: 'Niveles', exact: true }).first().click();
  }
  async function mapa(x, y) {
    const punto = await frame().evaluate(({ x, y }) => {
      const escena = juegoPrueba.scene.getScene('MapaScene');
      const p = escena.capaRedMetro.convertirPosicion(x, y), cam = escena.cameras.main;
      const q = cam.matrix.transformPoint(p.x - cam.scrollX, p.y - cam.scrollY);
      const c = escena.game.canvas.getBoundingClientRect();
      return { x: c.left + q.x, y: c.top + q.y };
    }, { x, y });
    const contenedor = await page.locator('#pantalla-metronet').boundingBox();
    await page.mouse.click(contenedor.x + punto.x, contenedor.y + punto.y);
  }
  async function cantidad(tipo, n) {
    await frame().waitForFunction(({ tipo, n }) => juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual[tipo].length === n, { tipo, n });
  }
  async function comprobarMedicion() {
    const resultado = await leer(() => {
      const escena = window.escenaSimulacionPrueba || juegoPrueba.scene.getScene('MapaScene');
      const capa = escena.capaRedMetro;
      const formatear = n => new Intl.NumberFormat('es-UY', {minimumFractionDigits:1, maximumFractionDigits:1}).format(n);
      const tramos = capa.diseno.tramos;
      const etiquetas = [...document.querySelectorAll('.metronet-mediciones__tramo')];
      const overlay = document.querySelector('.metronet-mediciones').getBoundingClientRect();
      const boton = document.querySelector('[data-medicion-distancias]').getBoundingClientRect();
      const cabecera = document.querySelector('[data-medicion-distancias]').parentElement.getBoundingClientRect();
      const visibles = etiquetas.filter(e => !e.hidden).map(e => e.getBoundingClientRect());
      return {
        distancias: etiquetas.map(e => Number(e.dataset.distanciaKm)), reales:tramos.map(t=>t.distanciaKm),
        total:document.querySelector('.metronet-mediciones__total').textContent,
        esperado:`${tramos[0].nombreLinea} · ${formatear(tramos.reduce((s,t)=>s+t.distanciaKm,0))} km`,
        visibles:visibles.length,
        dentro:visibles.every(r=>r.left>=overlay.left && r.right<=overlay.right && r.top>=overlay.top && r.bottom<=overlay.bottom),
        integrado:boton.width<=30 && boton.height<=22 && boton.top>=cabecera.top && boton.bottom<=cabecera.bottom,
        colisiones:visibles.some((a,i)=>visibles.slice(i+1).some(b=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top)),
      };
    });
    assert.deepEqual(resultado.distancias, resultado.reales);
    assert.equal(resultado.total, resultado.esperado);
    assert.ok(resultado.visibles>0 && resultado.dentro && resultado.integrado && !resultado.colisiones, JSON.stringify(resultado));
  }
  const herramienta = clave => frame().locator(`[data-elegir-herramienta="${clave}"]`).click();
  try {
    await login();
    const contextoJugador = await browser.newContext();
    t.after(() => contextoJugador.close());
    await contextoJugador.route(/http:\/\/[^/]+:8080\//, route => route.continue({ url: API + new URL(route.request().url()).pathname + new URL(route.request().url()).search }));
    const paginaJugador = await contextoJugador.newPage();
    paginaJugador.on('pageerror', e => errores.push(e.stack));
    await paginaJugador.goto(BASE + '/login.html');
    await paginaJugador.locator('#pantalla-metronet').waitFor();
    const vistaJugador = paginaJugador.frameLocator('#pantalla-metronet');
    await vistaJugador.locator('#email').fill('fuentes-e2e@example.test');
    await vistaJugador.locator('#password').fill(process.env.METRONET_E2E_CLAVE);
    await vistaJugador.locator('#loginButton').click();
    await vistaJugador.locator('[data-continuar-bienvenida]').click();
    await vistaJugador.getByRole('link', { name: 'Reglas', exact: true }).first().click();
    await vistaJugador.locator('[data-periodo-trafico]').filter({ hasText: 'Período disponible:' }).waitFor();
    assert.match(await vistaJugador.locator('#listaFuentesMapa').innerText(), /2016/);
    await vistaJugador.getByRole('link', { name: 'Administración', exact: true }).first().click();
    await vistaJugador.locator('#vista-unidades:not([hidden])').waitFor();
    assert.deepEqual(await vistaJugador.locator('.admin-enlace').evaluateAll(es => es.map(e => e.dataset.vista)), ['fuentes', 'unidades']);
    const marcoJugador = paginaJugador.frames().find(f => f.parentFrame());
    const tokenJugador = await marcoJugador.evaluate(() => JSON.parse(localStorage.getItem('sesionUsuario')).token);
    assert.equal((await contextoJugador.request.get(API + '/api/admin/usuarios', {headers:{Authorization:`Bearer ${tokenJugador}`}})).status(), 401, 'La sesión de jugador no autoriza una sesión administrativa');
    await vistaJugador.getByRole('button', { name: 'Fuentes del mapa', exact: true }).click();
    await vistaJugador.locator('[data-periodo-trafico]').filter({ hasText: 'Período disponible:' }).waitFor();
    await paginaJugador.screenshot({ path: '/tmp/metronet-fuentes-jugador.png', fullPage: true });
    console.log('Jugador real: solo fuentes y equivalencias; API de gestión rechaza sesión de jugador (401): PASS');
    await marcoJugador.goto(BASE + '/perfil.html');
    await vistaJugador.locator('.perfil-contenedor[aria-busy="false"]').waitFor();
    for (const tamano of [{width:1280,height:720},{width:1440,height:900}]) {
      await paginaJugador.setViewportSize(tamano);
      await paginaJugador.waitForTimeout(600);
      const perfil = await marcoJugador.evaluate(() => ({ alto:innerHeight, scroll:document.documentElement.scrollHeight,
        columnas:[...document.querySelectorAll('.perfil-seccion:not(.perfil-seccion--informacion)')].map(e=>({top:e.getBoundingClientRect().top,left:e.getBoundingClientRect().left})) }));
      assert.ok(perfil.scroll <= perfil.alto+1, JSON.stringify(perfil));
      assert.equal(new Set(perfil.columnas.map(r=>r.top)).size,1);
      assert.ok(await vistaJugador.locator('.perfil-contenedor').evaluate(e => [...e.querySelectorAll('h1,h2,p,label,input,button,dt,dd')].every(n => getComputedStyle(n).fontFamily.includes('Silkscreen'))), 'Toda la tipografía del perfil es pixelada');
      const botones = await vistaJugador.locator('.perfil-acciones button').evaluateAll(es => es.map(e=>e.getBoundingClientRect().bottom));
      assert.ok(Math.max(...botones)-Math.min(...botones)<1, 'Acciones a la misma altura');
      await paginaJugador.screenshot({path:`/tmp/metronet-perfil-${tamano.width}.png`});
    }

    await vistaJugador.locator('#nombre').fill('Perfil QA');
    await vistaJugador.locator('#apellido').fill('Verificado');
    await vistaJugador.locator('#guardarDatosPersonales').click();
    await vistaJugador.getByText('Información personal actualizada correctamente.',{exact:true}).waitFor();
    await marcoJugador.goto(BASE + '/perfil.html');
    await vistaJugador.locator('.perfil-contenedor[aria-busy="false"]').waitFor();
    assert.equal(await vistaJugador.locator('#apellido').inputValue(),'Verificado');
    await vistaJugador.locator('[data-target="contrasenaActual"]').click();
    assert.equal(await vistaJugador.locator('#contrasenaActual').getAttribute('type'),'text');
    await vistaJugador.locator('[data-target="contrasenaActual"]').click();
    assert.equal(await vistaJugador.locator('#contrasenaActual').getAttribute('type'),'password');
    console.log('Perfil real: tipografía, alineación, sin scroll, guardado y recuperación: PASS');
    await frame().getByRole('button', { name: 'Entrar al Modo Libre', exact: true }).click();
    await esperarEditor();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.estado === 'lista');
    await frame().getByRole('heading', { name: 'Bienvenido al Modo Libre', exact: true }).waitFor();
    assert.match(await frame().locator('[data-bienvenida-libre]').innerText(), /Utilizá las herramientas de calles/);
    const bienvenida = await frame().locator('[data-bienvenida-libre]').boundingBox();
    const ventana = await frame().evaluate(() => ({ ancho: innerWidth, alto: innerHeight }));
    assert.ok(Math.abs(bienvenida.x + bienvenida.width / 2 - ventana.ancho / 2) < 2);
    assert.ok(Math.abs(bienvenida.y + bienvenida.height / 2 - ventana.alto / 2) < 2);
    const capasApagadas = async () => {
      assert.deepEqual(await leer(() => {
        const escena = juegoPrueba.scene.getScene('MapaScene');
        return ['capaCalles', 'capaTrafico', 'capaPoblacion', 'capaDesplazamientos'].map(c => escena[c].visible);
      }), [false, false, false, false]);
    };
    await capasApagadas();
    await page.screenshot({ path: '/tmp/metronet-bienvenida-libre-real.png' });
    await frame().getByRole('button', { name: 'Recorrer las funciones', exact: true }).click();
    for (const titulo of ['Calles y avenidas', 'Transparencia', 'Tráfico histórico', 'Horarios', 'Densidad de población', 'Transparencia de población', 'Desplazamientos históricos', 'Animación de desplazamientos', 'Distancias de la red']) {
      await frame().locator('.metronet-recorrido').getByRole('heading', { name: titulo, exact: true }).waitFor();
      await capasApagadas();
      await frame().locator('[data-recorrido-siguiente]').click();
    }
    await frame().locator('.metronet-recorrido').waitFor({ state: 'detached' });
    assert.equal(await frame().locator('dialog[open]').count(), 0);
    const id = await leer(() => juegoPrueba.scene.getScene('MapaScene').editorRedMetro.idDiseno());
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.tramos.length), 27656);
    await capasApagadas();
    await frame().getByRole('button', { name: 'Mostrar calles y avenidas', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.visible), true);
    assert.equal(await leer(() => Boolean(juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.input)), false);
    await frame().getByRole('button', { name: 'Ocultar calles y avenidas', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.visible), false);
    await frame().getByRole('button', { name: 'Mostrar calles y avenidas', exact: true }).click();
    const rango = frame().getByRole('slider', { name: 'Opacidad de calles y avenidas' });
    await rango.fill('35');
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.alpha), 0.35);
    await rango.fill('65');

    // Una descarga defectuosa nunca debe colorear datos inventados ni bloquear construir.
    let fallarTrafico = true;
    await context.route('**/api/trafico/historico', route => {
      if (fallarTrafico) { fallarTrafico = false; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"tramos":[]}' }); }
      return route.fallback();
    });
    await frame().getByRole('button', { name: 'Mostrar tráfico histórico', exact: true }).click();
    await frame().getByRole('button', { name: 'Reintentar carga de tráfico histórico', exact: true }).waitFor();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaTrafico.grafico.visible), false);
    assert.equal(await frame().locator('[data-elegir-herramienta="estaciones"]').isEnabled(), true);
    await frame().getByRole('button', { name: 'Reintentar carga de tráfico histórico', exact: true }).click();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaTrafico.estado === 'lista');
    assert.equal(await leer(() => Boolean(juegoPrueba.scene.getScene('MapaScene').capaTrafico.grafico.input)), false);
    assert.ok(await leer(() => { const s = juegoPrueba.scene.getScene('MapaScene'); return s.capaTrafico.grafico.depth < s.capaRedMetro.grafico.depth; }));
    const horario = frame().getByRole('slider', { name: 'Hora de las capas históricas' });
    await horario.fill('23');
    await frame().getByRole('button', { name: 'Hora siguiente', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaTrafico.hora), 0);
    await frame().getByRole('button', { name: 'Hora anterior', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaTrafico.hora), 23);
    await horario.fill('8');
    await frame().getByRole('button', { name: 'Reproducir horario', exact: true }).click();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaTrafico.hora === 9);
    await frame().getByRole('button', { name: 'Pausar horario', exact: true }).click();
    await page.waitForTimeout(1400);
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaTrafico.hora), 9);
    await horario.fill('8');
    assert.equal(await horario.isVisible(), true);
    assert.equal(await frame().locator('[data-trafico-reloj]').count(), 0);
    assert.equal(await frame().locator('.metronet-calles time, [data-trafico-info], .metronet-calles__fuente').count(), 0);
    await frame().getByRole('button', { name: 'Ocultar tráfico histórico', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.traficoActivo), false);
    await frame().getByRole('button', { name: 'Mostrar tráfico histórico', exact: true }).click();
    console.log('Tráfico: error seguro, reintento, hora 23/00, reproducción, pausa, reloj y fuente: PASS');
    assert.equal(await rango.isVisible(), true);

    // Datos censales reales; un archivo defectuoso falla sin bloquear el editor.
    let fallarPoblacion = true;
    await context.route('**/poblacion-montevideo.geojson*', route => {
      if (fallarPoblacion) { fallarPoblacion = false; return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
      return route.continue();
    });
    await frame().getByRole('button', { name: 'Mostrar densidad de población', exact: true }).click();
    await frame().getByRole('button', { name: 'Reintentar carga de población', exact: true }).waitFor();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaPoblacion.grafico.visible), false);
    assert.equal(await frame().locator('[data-elegir-herramienta="estaciones"]').isEnabled(), true);
    await frame().getByRole('button', { name: 'Reintentar carga de población', exact: true }).click();
    const censoDisponible = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/mapa/datos/poblacion-montevideo.geojson'))).estado !== 'no_disponible';
    assert.equal(censoDisponible, true, 'La aceptación requiere datos censales reales');
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaPoblacion.estado === 'lista');
    assert.ok(await leer(() => { const s = juegoPrueba.scene.getScene('MapaScene'); return s.capaPoblacion.datos.features.length > 13000 && !s.capaPoblacion.grafico.input && s.capaPoblacion.grafico.depth < s.capaCalles.grafico.depth && s.capaBarrios.graficos.every(g => g.grafico.depth > s.capaPoblacion.grafico.depth); }));
    const densidad = frame().getByRole('slider', { name: 'Opacidad de densidad de población' });
    await densidad.fill('40');
    assert.deepEqual(await leer(() => { const s = juegoPrueba.scene.getScene('MapaScene'); return [s.capaPoblacion.grafico.alpha,s.capaCalles.grafico.alpha]; }), [.4,.65]);
    await densidad.fill('65');
    const colores = await leer(() => juegoPrueba.scene.getScene('MapaScene').capaPoblacion.poligonos.map(p=>p.color));
    await horario.fill('18');
    assert.deepEqual(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaPoblacion.poligonos.map(p=>p.color)),colores);
    await horario.fill('8');
    assert.equal(await frame().locator('[data-poblacion-info]').count(), 0);
    await frame().getByRole('button', { name: 'Ocultar densidad de población', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaPoblacion.grafico.visible), false);
    await frame().getByRole('button', { name: 'Mostrar densidad de población', exact: true }).click();
    console.log('Población: datos oficiales, reintento, transparencia independiente, reloj sin efecto y controles: PASS');


    let fallarFlujos = true;
    await context.route('**/desplazamientos-historicos.json*', route => {
      if (fallarFlujos) { fallarFlujos = false; return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
      return route.continue();
    });
    await frame().getByRole('button', { name: 'Mostrar desplazamientos históricos', exact: true }).click();
    await frame().getByRole('button', { name: 'Reintentar carga de desplazamientos', exact: true }).waitFor();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.grafico.visible), false);
    await frame().getByRole('button', { name: 'Reintentar carga de desplazamientos', exact: true }).click();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.estado === 'lista');
    assert.ok(await leer(() => { const s = juegoPrueba.scene.getScene('MapaScene'), c = s.capaDesplazamientos;
      return c.datos.anio === 2016 && c.flujos.length === 12 && !c.grafico.input && c.grafico.depth < s.capaRedMetro.grafico.depth && c.grafico.depth > s.capaTrafico.grafico.depth; }));
    const fase = await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.fase);
    await page.waitForTimeout(200);
    assert.notEqual(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.fase), fase);
    await frame().getByRole('button', { name: 'Pausar flechas', exact: true }).click();
    const quieta = await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.fase);
    await page.waitForTimeout(200);
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.fase), quieta);
    await frame().getByRole('button', { name: 'Animar flechas', exact: true }).click();
    await frame().getByRole('slider', { name: 'Opacidad de desplazamientos', exact: true }).fill('50');
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.grafico.alpha), .5);
    await frame().getByRole('button', { name: 'Ocultar tráfico histórico', exact: true }).click();
    await horario.fill('18');
    assert.ok(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.flujos.every(f => f.hora === 18)));
    await frame().getByRole('button', { name: 'Reproducir horario', exact: true }).click();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.hora === 19);
    await frame().getByRole('button', { name: 'Pausar horario', exact: true }).click();
    await frame().getByRole('button', { name: 'Ocultar desplazamientos históricos', exact: true }).click();
    assert.equal(await horario.isDisabled(), true);
    const oculta = await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.fase);
    await page.waitForTimeout(150);
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaDesplazamientos.fase), oculta);
    await frame().getByRole('button', { name: 'Mostrar desplazamientos históricos', exact: true }).click();
    await horario.fill('8');
    await frame().getByRole('button', { name: 'Mostrar tráfico histórico', exact: true }).click();
    console.log('Desplazamientos: datos reales, error/reintento, animación, pausa, ocultar y reloj independiente del tráfico: PASS');

    await herramienta('estaciones');
    await mapa(580, 470); await cantidad('estaciones', 1);
    await mapa(700, 460); await cantidad('estaciones', 2);
    await mapa(810, 480); await cantidad('estaciones', 3);
    await herramienta('lineas'); await mapa(580, 470); await mapa(700, 460); await cantidad('lineas', 1);
    await herramienta('conexiones'); await mapa(700, 460); await mapa(810, 480); await cantidad('tramos', 2);
    await herramienta('metros'); await mapa(640, 465); await cantidad('unidadesMetro', 1);
    const antesRegla = escrituras;
    await frame().getByRole('button', {name:'Mostrar distancias en kilómetros',exact:true}).click();
    await comprobarMedicion();
    assert.equal(escrituras, antesRegla, 'Mostrar medidas no escribe en el servidor');
    const distanciasAntes = await frame().locator('.metronet-mediciones__tramo').allTextContents();
    await herramienta('seleccion'); await mapa(810, 480);
    await frame().getByRole('button', { name: 'Mover estación seleccionada', exact: true }).click();
    await mapa(800, 470);
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual.estaciones.some(e => Math.abs(e.posicionX - 800) < 3));
    await frame().getByRole('button', { name: 'Guardar diseño', exact: true }).click();
    await frame().waitForFunction(() => !juegoPrueba.scene.getScene('MapaScene').editorRedMetro.cambiosPendientes);
    await comprobarMedicion();
    assert.notDeepEqual(await frame().locator('.metronet-mediciones__tramo').allTextContents(), distanciasAntes, 'Mover una estación actualiza los kilómetros desde PostgreSQL');
    const red = await leer(() => juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual);
    await frame().locator('.metronet-aviso-guardado').waitFor({ state: 'hidden' });
    await densidad.fill('35');
    await frame().getByRole('slider', { name: 'Opacidad de desplazamientos', exact: true }).fill('100');
    await page.mouse.move(5, 5);
    await page.screenshot({ path: '/tmp/metronet-trafico-real.png' });
    await page.screenshot({ path: '/tmp/metronet-desplazamientos-real.png' });
    console.log('Construir, conectar, asignar metro, mover y guardar: PASS');
    assert.deepEqual(await frame().locator('[data-categoria-territorio] > h3').allTextContents(),
      ['Calles', 'Tráfico', 'Población', 'Desplazamientos', 'Horarios']);
    assert.equal(await frame().locator('[data-categoria-territorio=calles] button').count(), 1);
    await frame().getByRole('heading', { name: 'Análisis del territorio', exact: true }).waitFor();
    await frame().getByRole('heading', { name: 'Diseño de la red', exact: true }).waitFor();

    for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await frame().evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const cajas = await leer(() => {
        const mapa = document.querySelector('#metronet-mapa').getBoundingClientRect();
        const panel = document.querySelector('.metronet-lateral-editor').getBoundingClientRect();
        return [Math.abs(mapa.top - panel.top), Math.abs(mapa.bottom - panel.bottom), document.documentElement.scrollHeight <= innerHeight + 1];
      });
      assert.ok(cajas[0] < 2 && cajas[1] < 2 && cajas[2], JSON.stringify(cajas));
      const distribucion = await leer(() => {
        const caja = selector => document.querySelector(selector).getBoundingClientRect();
        const opciones = caja('.metronet-consigna-externa');
        const herramientas = caja('#metronet-panel-controles');
        const filas = [...document.querySelectorAll('#metronet-panel-controles .metronet-editor-bloque')];
        return {
          anchoPanel: caja('.metronet-lateral-editor').width,
          proporcionOpciones: opciones.height / caja('.metronet-lateral-editor').height,
          sinRecorte: [...document.querySelectorAll('.metronet-calles input, .metronet-calles button, .metronet-calles h3, .metronet-calles output')]
            .filter(e => e.getClientRects().length).every(e => {
              const r = e.getBoundingClientRect();
              return r.top >= opciones.top && r.bottom <= opciones.bottom && r.right <= opciones.right;
            }),
          filas: filas.map(fila => {
            const titulo = fila.querySelector('h3').getBoundingClientRect();
            const botones = [...fila.querySelectorAll('button')].filter(e => e.getClientRects().length)
              .map(e => e.getBoundingClientRect());
            return { cantidad: botones.length, enFila: botones.every(b => b.left > titulo.right
              && Math.abs((b.top + b.bottom - titulo.top - titulo.bottom) / 2) < 2),
              compactos: botones.every(b => b.width <= 36.1 && b.height <= 36.1
                && b.right <= herramientas.right && b.bottom <= herramientas.bottom) };
          }),
        };
      });
      assert.ok(distribucion.anchoPanel <= 340.1, JSON.stringify(distribucion));
      assert.ok(distribucion.proporcionOpciones >= .65, JSON.stringify(distribucion));
      assert.ok(distribucion.sinRecorte, JSON.stringify(distribucion));
      assert.deepEqual(distribucion.filas.map(f => f.cantidad), [4, 4, 2]);
      assert.ok(distribucion.filas.every(f => f.enFila && f.compactos), JSON.stringify(distribucion));
      await comprobarMedicion();
      await page.screenshot({ path: `/tmp/metronet-libre-compacto-${viewport.width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await frame().getByRole('button', { name: 'Acercar mapa', exact: true }).click();
    await frame().getByRole('button', { name: 'Acercar mapa', exact: true }).click();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.detalleVisible);
    await page.screenshot({ path: '/tmp/metronet-desplazamientos-zoom.png' });
    const posicionAntesGiro = await frame().locator('.metronet-mediciones__tramo').first().getAttribute('style');
    const girar = frame().getByRole('button', { name: /Girar.*derecha/i });
    await girar.click();
    assert.notEqual(await leer(() => juegoPrueba.scene.getScene('MapaScene').cameras.main.rotation), 0);
    await frame().waitForFunction(antes => document.querySelector('.metronet-mediciones__tramo').getAttribute('style') !== antes, posicionAntesGiro);
    await comprobarMedicion();
    await frame().getByRole('button', {name:'Ocultar distancias en kilómetros',exact:true}).click();
    assert.equal(await frame().locator('.metronet-mediciones').isVisible(),false);
    console.log('Regla en edición: kilómetros reales, actualización al mover, cámara, tres tamaños y ocultar: PASS');
    await frame().locator('.metronet-poi > summary').click();
    await frame().locator('#metronet-selector-barrios .metronet-panel-encabezado').click();
    await frame().locator('#metronet-selector-barrios input[value="AGUADA"]').check();
    await frame().locator('#metronet-selector-zonas .metronet-panel-encabezado').click();
    await frame().locator('#metronet-selector-zonas input').nth(1).check();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.visible), true);
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaTrafico.grafico.visible), true);
    await frame().getByRole('searchbox', { name: 'Buscar punto de interés' }).fill('Palacio');
    await frame().locator('.metronet-panel-puntos-item').first().click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.visible), true);
    await page.screenshot({ path: '/tmp/metronet-calles-poi-real.png' });
    await page.screenshot({ path: '/tmp/metronet-trafico-poi-real.png' });
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaPoblacion.grafico.visible), censoDisponible);
    console.log('Zoom, rotación, barrios, zonas, POI y tres tamaños: PASS');

    // Reingreso con sesión real: las operaciones vuelven desde PostgreSQL.
    await login();
    await frame().getByRole('link', { name: 'Mis diseños', exact: true }).first().click();
    let fallarCartografia = true;
    await context.route('**/calles-montevideo.geojson*', route => {
      if (fallarCartografia) { fallarCartografia = false; return route.abort(); }
      return route.continue();
    });
    const editar = frame().locator(`[data-editar="${id}"], [data-editar-diseno="${id}"], a[href*="idDiseno=${id}"]`).first();
    await editar.click();
    await esperarEditor();
    await frame().getByRole('button', { name: 'Reintentar carga de calles', exact: true }).waitFor();
    assert.equal(await frame().locator('[data-elegir-herramienta="estaciones"]').isEnabled(), true);
    await frame().getByRole('button', { name: 'Reintentar carga de calles', exact: true }).click();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.estado === 'lista');
    const recuperada = await leer(() => juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual);
    for (const clave of ['estaciones', 'lineas', 'tramos', 'unidadesMetro']) assert.deepEqual(recuperada[clave], red[clave]);
    await page.screenshot({ path: '/tmp/metronet-calles-libre-real.png' });
    console.log('Fallo de cartografía no bloqueante y reintento: PASS');
    await frame().getByRole('button', { name: 'Mostrar tráfico histórico', exact: true }).click();
    await frame().getByRole('button', { name: 'Reproducir horario', exact: true }).click();
    await frame().evaluate(() => {
      for (const clave of Object.keys(localStorage)) if (clave.includes('tutorial-pantalla-simulacion')) localStorage.removeItem(clave);
    });
    await frame().locator('[data-ir-simulacion]').click();
    await page.waitForFunction(() => document.querySelector('#pantalla-metronet')?.contentWindow?.location.pathname.endsWith('/simulacion.html'));
    await frame().getByRole('button', { name: 'Iniciar simulación', exact: true }).waitFor();
    assert.equal(await frame().locator('[data-calles-visible]').count(), 0);
    assert.equal(await frame().locator('[data-trafico-visible]').count(), 0);
    assert.equal(await frame().locator('[data-poblacion-visible]').count(), 0);
    assert.equal(await frame().locator('[data-desplazamientos-visible]').count(), 0);
    await page.waitForTimeout(1400);
    await frame().waitForFunction(() => window.escenaSimulacionPrueba?.capasLibre);
    await frame().getByRole('heading', {name:'Simulación de Modo Libre',exact:true}).waitFor();
    await frame().getByRole('button', {name:'Recorrer las funciones',exact:true}).click();
    for (const titulo of ['Distancias de la red', 'Horarios de la simulación', 'Elegir la hora de inicio', 'Calles y avenidas', 'Tráfico sincronizado', 'Densidad de población', 'Desplazamientos sincronizados', 'Cobertura de las estaciones', 'Transparencia de las capas']) {
      await frame().locator('.metronet-recorrido').getByRole('heading',{name:titulo,exact:true}).waitFor();
      const cartel = await frame().locator('.metronet-recorrido').boundingBox();
      const ventana = await frame().evaluate(()=>({width:innerWidth,height:innerHeight}));
      assert.ok(cartel.x>=0 && cartel.y>=0 && cartel.x+cartel.width<=ventana.width+1 && cartel.y+cartel.height<=ventana.height+1);
      assert.equal(await frame().locator('[data-capa-simulacion][aria-pressed="true"]').count(),0);
      await frame().locator('[data-recorrido-siguiente]').click();
    }
    await frame().locator('.metronet-recorrido').waitFor({state:'detached'});
    await frame().getByRole('button',{name:'Mostrar distancias en kilómetros',exact:true}).click();
    await comprobarMedicion();
    assert.deepEqual(await leer(()=>escenaSimulacionPrueba.capaRedMetro.diseno.tramos),red.tramos);
    assert.equal(await frame().locator('[data-capa-simulacion]').count(), 5);
    assert.equal(await frame().locator('[data-capa-simulacion][aria-pressed="true"]').count(), 0);
    for (const capa of ['calles', 'trafico', 'poblacion', 'desplazamientos', 'cobertura']) {
      await frame().locator(`[data-capa-simulacion="${capa}"]`).click();
      await frame().locator(`[data-capa-simulacion="${capa}"][aria-pressed="true"]`).waitFor();
    }
    await frame().getByLabel('Hora de inicio del escenario', { exact: true }).fill('23:30');
    await frame().getByRole('button', {name:'Adelantar inicio una hora', exact:true}).click();
    assert.equal(await frame().getByLabel('Hora de inicio del escenario', {exact:true}).inputValue(), '00:30');
    await frame().getByRole('button', {name:'Atrasar inicio una hora', exact:true}).click();
    assert.equal(await frame().getByLabel('Hora de inicio del escenario', {exact:true}).inputValue(), '23:30');
    await frame().getByLabel('Hora de inicio del escenario', { exact: true }).press('Tab');
    await frame().locator('#duracionSimulacion').fill('3');
    await frame().locator('#aplicarUnidadTiempo').click();
    await frame().waitForFunction(() => escenaSimulacionPrueba.capasLibre.diseno.unidadesMetro.every(u => u.duracionUt === 3));
    await frame().waitForFunction(() => document.querySelector('[data-hora-fin]').textContent === '02:30 +1d');
    for (const tamano of [{width:1280,height:720},{width:1440,height:1000},{width:1920,height:1080}]) {
      await page.setViewportSize(tamano); await page.waitForTimeout(400);
      const geometria = await leer(() => {
        const panel = document.querySelector('#instrumentosSimulacion').getBoundingClientRect();
        const mapa = document.querySelector('.simulacion-lienzo-contenedor').getBoundingClientRect();
        const bloques = [...document.querySelectorAll('.simulacion-acciones-panel,.simulacion-horarios,.simulacion-grupo-metros,.simulacion-grupo-velocidad,#seccionConfiguracion,.simulacion-capas')].map(e => {const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}).sort((a,b)=>a.top-b.top);
        const fuera = [...document.querySelectorAll('#instrumentosSimulacion button,#instrumentosSimulacion input,#instrumentosSimulacion summary')].filter(e => e.getClientRects().length && !e.closest('details:not([open]) :not(summary)')).filter(e => {const r=e.getBoundingClientRect();return r.left<panel.left-1 || r.right>panel.right+1 || r.bottom>panel.bottom+1;}).map(e=>e.outerHTML.slice(0,150));
        return {panel:{top:panel.top,bottom:panel.bottom},mapa:{top:mapa.top,bottom:mapa.bottom},bloques,fuera,alto:innerHeight,scroll:document.documentElement.scrollHeight};
      });
      console.log('Geometría Simulación', tamano, geometria);
      assert.ok(Math.abs(geometria.panel.top-geometria.mapa.top)<2);
      assert.ok(Math.abs(geometria.panel.bottom-geometria.mapa.bottom)<2);
      assert.deepEqual(geometria.fuera, []);
      assert.equal(geometria.bloques[0].bottom-geometria.bloques[0].top,72,'Acciones mantiene su altura compacta aunque crezca la pantalla');
      for (const indice of [3,4]) assert.equal(geometria.bloques[indice].bottom-geometria.bloques[indice].top,72,'UV y UT no se estiran');
      assert.ok(geometria.bloques[1].bottom-geometria.bloques[1].top>=100,'Horarios tiene espacio propio para sus tres relojes');
      assert.ok(geometria.bloques.at(-1).bottom <= geometria.panel.bottom+1, 'Los seis bloques caben dentro del panel');
      assert.ok(geometria.panel.bottom <= geometria.alto+1);
      for(let i=1;i<geometria.bloques.length;i++) assert.ok(geometria.bloques[i].top>=geometria.bloques[i-1].bottom+3);
      await comprobarMedicion();
      await page.screenshot({path:`/tmp/metronet-simulacion-libre-${tamano.width}.png`});
    }
    await page.setViewportSize({width:1440,height:1000});
    const respuestaEjecucion = page.waitForResponse(r=>r.url().endsWith('/ejecutar') && r.request().method()==='POST' && r.ok());
    await frame().getByRole('button', { name: 'Iniciar simulación', exact: true }).click();
    const resultadoFisico = await (await respuestaEjecucion).json();
    assert.equal(resultadoFisico.escala,'UV_KM_UT_V3');
    assert.ok(resultadoFisico.unidades.length>0);
    for (const unidad of resultadoFisico.unidades) {
      assert.ok(unidad.distanciaKm>0);
      assert.ok(Math.abs(unidad.distanciaRecorridaKm-Math.min(unidad.distanciaKm,unidad.velocidad*unidad.duracionUt))<1e-8);
      assert.ok(Math.abs(unidad.utLlegada-unidad.distanciaKm/unidad.velocidad)<1e-8);
    }
    await frame().waitForFunction(() => escenaSimulacionPrueba.motorSimulacion?.obtenerEstado().tiempoTranscurrido > .6);
    await frame().locator('#pausarSimulacion').click();
    await comprobarMedicion();
    const pausado = await leer(() => ({hora:document.querySelector('[data-hora-actual]').textContent, fase:escenaSimulacionPrueba.capasLibre.desplazamientos.fase, reloj:escenaSimulacionPrueba.capasLibre.reloj.hora}));
    assert.match(pausado.hora, /\+1d/); assert.equal(pausado.reloj, 0);
    await page.waitForTimeout(500);
    assert.deepEqual(await leer(() => ({hora:document.querySelector('[data-hora-actual]').textContent, fase:escenaSimulacionPrueba.capasLibre.desplazamientos.fase, reloj:escenaSimulacionPrueba.capasLibre.reloj.hora})), pausado);
    await frame().locator('#reanudarSimulacion').click();
    await frame().waitForFunction(fase => escenaSimulacionPrueba.capasLibre.desplazamientos.fase !== fase, pausado.fase);
    await frame().locator('#detenerSimulacion').click();
    assert.equal(await frame().locator('[data-hora-actual]').innerText(), '23:30');
    assert.equal(await leer(() => escenaSimulacionPrueba.capasLibre.desplazamientos.fase), 0);
    const sinEscrituras = escrituras;
    await frame().getByRole('button',{name:'Ocultar distancias en kilómetros',exact:true}).click();
    assert.equal(await frame().locator('.metronet-mediciones').isVisible(),false);
    assert.equal(escrituras,sinEscrituras);
    console.log('Regla en simulación: mismos kilómetros, ejecución/pausa, tres tamaños y ocultar sin modificar la red: PASS');
    const urlSimulacion = frame().url();
    await frame().goto(urlSimulacion);
    await frame().waitForFunction(() => window.escenaSimulacionPrueba?.capasLibre);
    assert.equal(await frame().getByLabel('Hora de inicio del escenario', {exact:true}).inputValue(), '23:30');
    for (const capa of ['calles','trafico','poblacion','desplazamientos','cobertura']) await frame().locator(`[data-capa-simulacion="${capa}"][aria-pressed="true"]`).waitFor();
    console.log('Simulación real: capas, cobertura, UT persistida, medianoche, pausa, reanudación, parada y preferencias: PASS');
    assert.equal(await frame().locator('.metronet-recorrido').count(), 0, 'El tutorial ya completado no vuelve a ofrecerse al recargar');
    console.log('Bienvenida del editor y tutorial territorial de Simulación completados: PASS');
    await frame().getByRole('link', { name: 'Reglas', exact: true }).first().click();
    await frame().locator('[data-periodo-trafico]').filter({ hasText: 'Período disponible:' }).waitFor();
    assert.match(await frame().locator('#listaFuentesMapa').innerText(), /2016/);
    assert.match(await frame().locator('#listaFuentesMapa').innerText(), /2011/);
    assert.match(await frame().locator('[data-cobertura-desplazamientos]').innerText(), /6253 de 12537/);
    await frame().getByRole('link', { name: 'Administración', exact: true }).first().click();
    await frame().getByRole('button', { name: 'Fuentes del mapa', exact: true }).click();
    await frame().locator('[data-periodo-trafico]').filter({ hasText: 'Período disponible:' }).waitFor();
    assert.equal(await frame().locator('#vista-fuentes button, #vista-fuentes input').count(), 0);
    await page.screenshot({path:'/tmp/metronet-admin-fuentes.png'});
    await frame().getByRole('button', {name:'Unidades y equivalencias',exact:true}).click();
    assert.equal(await frame().locator('#vista-unidades table').count(),2);
    await page.screenshot({path:'/tmp/metronet-admin-equivalencias.png'});
    console.log('Fuentes centralizadas y tabla de equivalencias: PASS');
    assert.deepEqual(errores, []); assert.deepEqual(fallos, []);
    console.log('Red recuperada desde servidor real y PostgreSQL: PASS');
  } catch (e) {
    console.log('DIAGNÓSTICO', errores, fallos, page.frames().map(f => f.url()));
    if (frame()) console.log((await frame().locator('body').innerText()).slice(-3500));
    await page.screenshot({ path: '/tmp/metronet-calles-error.png' });
    throw e;
  }
});
