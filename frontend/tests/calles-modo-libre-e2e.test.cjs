const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const API = process.env.METRONET_API_PRUEBAS;
const BASE = 'http://127.0.0.1:5198';

test('calles y tráfico histórico: controles, edición libre, cámara, POI y persistencia reales', { skip: !API, timeout: 300000 }, async t => {
  const browser = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  // Solo cambia el destino al Spring de prueba; no reemplaza respuestas REST.
  await context.route(/http:\/\/[^/]+:8080\//, route => route.continue({ url: API + new URL(route.request().url()).pathname + new URL(route.request().url()).search }));
  // Instrumentación de lectura para situar clics y observar la cámara real.
  await context.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('let juego = new Phaser.Game(config);', 'let juego = new Phaser.Game(config); window.juegoPrueba = juego;') });
  });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const errores = [], fallos = [];
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
  const herramienta = clave => frame().locator(`[data-elegir-herramienta="${clave}"]`).click();
  try {
    await login();
    await frame().getByRole('button', { name: 'Entrar al Modo Libre', exact: true }).click();
    await esperarEditor();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.estado === 'lista');
    await frame().getByRole('button', { name: 'Hacer el tutorial', exact: true }).click();
    for (const titulo of ['Calles y avenidas', 'Transparencia', 'Tráfico histórico', 'Horario del tráfico', 'Datos y cobertura', 'Densidad de población', 'Transparencia de población', 'Fuente de población', 'Explorá la ciudad']) {
      await frame().getByRole('heading', { name: titulo, exact: true }).waitFor();
      await frame().locator('[data-recorrido-siguiente]').click();
    }
    await frame().locator('.metronet-recorrido').waitFor({ state: 'detached' });
    assert.equal(await frame().locator('dialog[open]').count(), 0);
    const id = await leer(() => juegoPrueba.scene.getScene('MapaScene').editorRedMetro.idDiseno());
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.tramos.length), 27656);
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.visible), true);
    assert.equal(await leer(() => Boolean(juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.input)), false);
    await frame().getByRole('button', { name: 'Ocultar calles y avenidas', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.visible), false);
    await frame().getByRole('button', { name: 'Mostrar calles y avenidas', exact: true }).click();
    const rango = frame().getByRole('slider', { name: 'Opacidad de calles y avenidas' });
    await rango.fill('35');
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.grafico.alpha), 0.35);
    await rango.fill('65');
    await frame().getByRole('button', { name: 'Ajustar transparencia de calles' }).click();

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
    const horario = frame().getByRole('slider', { name: 'Hora del tráfico histórico' });
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
    await frame().getByRole('button', { name: 'Mostrar u ocultar horario del tráfico histórico' }).click();
    assert.equal(await horario.isVisible(), false);
    await frame().getByRole('button', { name: 'Mostrar u ocultar horario del tráfico histórico' }).click();
    await frame().getByRole('button', { name: 'Fuente y significado del tráfico histórico' }).click();
    await frame().locator('#fuente-trafico').waitFor();
    assert.match(await frame().locator('#fuente-trafico').innerText(), /09\/2026.*407/);
    await frame().locator('body').press('Escape');
    assert.equal(await frame().locator('#fuente-trafico').isVisible(), false);
    await frame().getByRole('button', { name: 'Ocultar tráfico histórico', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.traficoActivo), false);
    await frame().getByRole('button', { name: 'Mostrar tráfico histórico', exact: true }).click();
    console.log('Tráfico: error seguro, reintento, hora 23/00, reproducción, pausa, reloj y fuente: PASS');
    assert.equal(await rango.isVisible(), false);
    await frame().getByRole('button', { name: 'Ajustar transparencia de calles' }).click();

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
    await frame().getByRole('button', { name: 'Fuente y significado de la densidad de población' }).click();
    await frame().locator('#fuente-poblacion').waitFor();
    assert.match(await frame().locator('#fuente-poblacion').innerText(), /histórica de 2011/);
    assert.equal(await frame().locator('.metronet-poblacion time').innerText(), '2011');
    await frame().locator('body').press('Escape');
    assert.equal(await frame().locator('#fuente-poblacion').isVisible(), false);
    await frame().getByRole('button', { name: 'Ocultar densidad de población', exact: true }).click();
    assert.equal(await leer(() => juegoPrueba.scene.getScene('MapaScene').capaPoblacion.grafico.visible), false);
    await frame().getByRole('button', { name: 'Mostrar densidad de población', exact: true }).click();
    console.log('Población: datos oficiales, reintento, transparencia independiente, reloj sin efecto y controles: PASS');


    await herramienta('estaciones');
    await mapa(580, 470); await cantidad('estaciones', 1);
    await mapa(700, 460); await cantidad('estaciones', 2);
    await mapa(810, 480); await cantidad('estaciones', 3);
    await herramienta('lineas'); await mapa(580, 470); await mapa(700, 460); await cantidad('lineas', 1);
    await herramienta('conexiones'); await mapa(700, 460); await mapa(810, 480); await cantidad('tramos', 2);
    await herramienta('metros'); await mapa(640, 465); await cantidad('unidadesMetro', 1);
    await herramienta('seleccion'); await mapa(810, 480);
    await frame().getByRole('button', { name: 'Mover estación seleccionada', exact: true }).click();
    await mapa(800, 470);
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual.estaciones.some(e => Math.abs(e.posicionX - 800) < 3));
    await frame().getByRole('button', { name: 'Guardar diseño', exact: true }).click();
    await frame().waitForFunction(() => !juegoPrueba.scene.getScene('MapaScene').editorRedMetro.cambiosPendientes);
    const red = await leer(() => juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual);
    await frame().locator('.metronet-aviso-guardado').waitFor({ state: 'hidden' });
    await page.screenshot({ path: '/tmp/metronet-trafico-real.png' });
    await page.screenshot({ path: '/tmp/metronet-poblacion-real.png' });
    console.log('Construir, conectar, asignar metro, mover y guardar: PASS');

    for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await frame().evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const cajas = await leer(() => {
        const mapa = document.querySelector('#metronet-mapa').getBoundingClientRect();
        const panel = document.querySelector('.metronet-lateral-editor').getBoundingClientRect();
        return [Math.abs(mapa.top - panel.top), Math.abs(mapa.bottom - panel.bottom), document.documentElement.scrollHeight <= innerHeight + 1];
      });
      assert.ok(cajas[0] < 2 && cajas[1] < 2 && cajas[2], JSON.stringify(cajas));
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await frame().getByRole('button', { name: 'Acercar mapa', exact: true }).click();
    await frame().getByRole('button', { name: 'Acercar mapa', exact: true }).click();
    await frame().waitForFunction(() => juegoPrueba.scene.getScene('MapaScene').capaCalles.detalleVisible);
    const girar = frame().getByRole('button', { name: /Girar.*derecha/i });
    await girar.click();
    assert.notEqual(await leer(() => juegoPrueba.scene.getScene('MapaScene').cameras.main.rotation), 0);
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
    await frame().locator('[data-ir-simulacion]').click();
    await page.waitForFunction(() => document.querySelector('#pantalla-metronet')?.contentWindow?.location.pathname.endsWith('/simulacion.html'));
    await frame().getByRole('button', { name: 'Iniciar simulación', exact: true }).waitFor();
    assert.equal(await frame().locator('[data-calles-visible]').count(), 0);
    assert.equal(await frame().locator('[data-trafico-visible]').count(), 0);
    assert.equal(await frame().locator('[data-poblacion-visible]').count(), 0);
    await page.waitForTimeout(1400);
    console.log('Capa acotada al editor: PASS');
    assert.deepEqual(errores, []); assert.deepEqual(fallos, []);
    console.log('Red recuperada desde servidor real y PostgreSQL: PASS');
  } catch (e) {
    console.log('DIAGNÓSTICO', errores, fallos, page.frames().map(f => f.url()));
    if (frame()) console.log((await frame().locator('body').innerText()).slice(-3500));
    await page.screenshot({ path: '/tmp/metronet-calles-error.png' });
    throw e;
  }
});
