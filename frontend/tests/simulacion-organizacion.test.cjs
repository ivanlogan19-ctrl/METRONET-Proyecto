// Phaser real; API interceptada, sin escrituras en la base de datos.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function abrir(t, width = 1440, responder) {
  const vista = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', {
    viewport: { width, height: width === 390 ? 844 : 1000 },
    responder: async req => {
      const personalizada = await responder?.(req);
      if (personalizada) return personalizada;
      if (req.url().endsWith('/ejecutar')) return { json: { idSimulacion: 1, estado: 'COMPLETADA', puntaje: 0, ...req.postDataJSON() } };
    },
  });
  t.after(() => vista.contexto.close());
  t.after(() => assert.deepEqual(vista.errores, []));
  await vista.pagina.route('**/src/simulacion/EscenaSimulacion.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('resolver({ escena: this, destruir });', 'window.escenaOrganizacion = this; resolver({ escena: this, destruir });') });
  });
  await vista.pagina.reload();
  await vista.pagina.waitForFunction(() => window.escenaOrganizacion?.disenoActual);
  await vista.pagina.locator('#desempenoNivel fieldset').waitFor({ state: 'attached' });
  await cuadros(vista.pagina);
  return vista;
}
async function cuadros(p, n = 5) {
  await p.evaluate(n => new Promise(resolve => {
    const juego = escenaOrganizacion.game;
    const contar = () => { if (--n === 0) { juego.events.off('postrender', contar); resolve(); } };
    juego.events.on('postrender', contar);
  }), n);
}
async function geometria(p) {
  return p.evaluate(() => {
    const r = document.getElementById('visorSimulacion').getBoundingClientRect(), s = escenaOrganizacion;
    return { width: r.width, height: r.height, x: r.x + scrollX, y: r.y + scrollY, zoom: s.cameras.main.zoom, scrollX: s.cameras.main.scrollX, scrollY: s.cameras.main.scrollY };
  });
}
test('Seleccionar metro en mapa o selector sincroniza la ficha y conserva cámara', async t => {
  const { pagina: p } = await abrir(t);
  await p.evaluate(() => { const c = escenaOrganizacion.cameras.main; c.setZoom(c.zoom * 1.15); c.scrollX += 20; c.scrollY += 12; });
  await cuadros(p);
  const antes = await geometria(p);
  await p.evaluate(() => escenaOrganizacion.seleccionarElementoRed({ tipo: 'unidad', valor: escenaOrganizacion.disenoActual.unidadesMetro[0] }));
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '1');
  assert.match(await p.locator('#seccionMetricas').innerText(), /M-1.*Azul/s);
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '40');
  await p.locator('#unidadCirculacion').selectOption('todas');
  assert.equal(await p.locator('#seccionMetricas').isVisible(), false);
  assert.equal(await p.evaluate(() => escenaOrganizacion.idUnidadSeleccionada), null);
  await cuadros(p);
  assert.deepEqual(await geometria(p), antes);
});
for (const width of [1440, 768, 390]) test(`Organización ${width}: mapa dominante y panel estable con simulación activa`, async t => {
  const { pagina: p, solicitudes } = await abrir(t, width);
  const inicial = await geometria(p);
  assert.ok(inicial.height >= 340);
  assert.ok(inicial.width / width > (width > 1050 ? .72 : .9));
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await p.locator('#instrumentosSimulacion').isVisible(), true);
  assert.equal(await p.locator('#ampliarMapa').isVisible(), false);
  assert.equal(await p.locator('#seccionResultados').isVisible(), true);
  assert.deepEqual(await geometria(p), inicial);
  await p.locator('#formularioEjecucion button[type=submit]').click();
  await p.waitForFunction(() => escenaOrganizacion.motorSimulacion.estado === 'EN_CURSO');
  await cuadros(p);
  const solicitudesPrevias = solicitudes.length;
  const unidadesAntes = await p.evaluate(() => [...escenaOrganizacion.capaRedMetro.unidadesSimulacion.values()].map(u => ({ x: u.x, y: u.y })));
  await cuadros(p, 20);
  assert.equal(await p.locator('#instrumentosSimulacion').isVisible(), true);
  assert.deepEqual(await geometria(p), inicial);
  assert.equal(await p.evaluate(() => escenaOrganizacion.motorSimulacion.estado), 'EN_CURSO');
  await p.waitForFunction(antes => JSON.stringify([...escenaOrganizacion.capaRedMetro.unidadesSimulacion.values()].map(u => ({ x: u.x, y: u.y }))) !== JSON.stringify(antes), unidadesAntes, { timeout: 8000 });
  await p.locator('#pausarSimulacion').click();
  assert.equal(await p.evaluate(() => document.activeElement.id), 'reanudarSimulacion');
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'pausarSimulacion');
  await p.keyboard.press('Enter');
  await cuadros(p, 20);
  assert.equal(await p.evaluate(() => escenaOrganizacion.motorSimulacion.estado), 'PAUSADA');
  const restaurada = await geometria(p);
  assert.equal(restaurada.width, inicial.width); assert.equal(restaurada.height, inicial.height);
  assert.equal(solicitudes.length, solicitudesPrevias, 'Cambiar la vista no debe generar llamadas a la API');
  assert.equal(await p.locator('#objetivoConsigna, #consignaSimulacion').count(), 0);
  assert.equal(await p.locator('#duracionSimulacion').isVisible(), true);
});
test('Validación de horas con panel visible: enfoca el campo sin ejecutar', async t => {
  const { pagina: p, solicitudes } = await abrir(t, 390);
  await p.locator('#duracionSimulacion').evaluate(e => { e.value = '0'; });
  await p.locator('#formularioEjecucion button[type=submit]').click();
  await p.locator('.metronet-notificacion--error').waitFor();
  assert.equal(await p.locator('#seccionConfiguracion').isVisible(), true);
  assert.equal(await p.locator('#duracionSimulacion').evaluate(e => e === document.activeElement), true);
  assert.equal(solicitudes.some(s => s.path.endsWith('/ejecutar')), false);
});
test('Los errores permanecen bajo los mandos y los resultados se abren bajo demanda', async t => {
  const { pagina: p } = await abrir(t, 1440, req => req.url().endsWith('/ejecutar') ? { status: 503, json: { detail: 'Servicio temporalmente no disponible.' } } : null);
  await p.locator('#formularioEjecucion button[type=submit]').click();
  await p.locator('#mensajeSimulacion.error').waitFor();
  assert.match(await p.locator('#mensajeSimulacion').innerText(), /Servicio temporalmente/);
  const mensaje = await p.locator('#mensajeSimulacion').boundingBox();
  const mandos = await p.locator('.simulacion-mandos').boundingBox();
  assert.ok(mensaje.y >= mandos.y + mandos.height, 'El aviso no debe tapar los controles');
  assert.ok(mensaje.y >= 0 && mensaje.y + mensaje.height <= 1000, 'El error debe quedar a la vista');
  assert.equal(await p.locator('#instrumentosSimulacion').isVisible(), true);
  assert.equal(await p.locator('#seccionResultados').isVisible(), true);
  assert.equal(await p.locator('#verResultadosSimulacion').isVisible(), false);
});
test('Sin diseño en la URL, Mis diseños conserva la apertura sin duplicar el selector', async t => {
  const { pagina:p } = await abrir(t);
  await p.route('**/api/juego/progreso', route => route.fulfill({json:{modoLibreDesbloqueado:true,escenarios:[]},headers:{'access-control-allow-origin':'*'}}));
  await p.goto(`${BASE}/simulacion.html`);
  await p.locator('#estadoVacio').waitFor();
  assert.equal(await p.locator('#listaDisenos').count(),0);
  await p.locator('#estadoVacio').getByRole('link',{name:'Mis diseños'}).click();
  await p.getByRole('link',{name:'Simular diseño: Red de Montevideo'}).click();
  await p.locator('#panelSimulacion').waitFor();
});

for (const width of [320, 360]) test(`Móvil estrecho ${width}: controles completos, sin recortes ni saltos al iniciar`, async t => {
  const { pagina: p } = await abrir(t, width);
  const antes = await geometria(p);
  await p.locator('#formularioEjecucion button[type=submit]').click();
  await p.waitForFunction(() => escenaOrganizacion.motorSimulacion.estado === 'EN_CURSO');
  await cuadros(p);
  assert.deepEqual(await geometria(p), antes);
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.simulacion-visor-mapa button, .simulacion-banda-estado dd')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width && (r.x < 0 || r.right > innerWidth || e.scrollWidth > e.clientWidth + 1);
  }).map(e => e.textContent)), []);
  const captura = process.env.METRONET_CAPTURAS_SIMULACION;
  if (captura) await p.screenshot({ path: `${captura}/movil-${width}.png`, fullPage: true });
});
