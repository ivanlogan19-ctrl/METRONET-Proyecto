// Navegador y Phaser reales; respuestas de API controladas, sin modificar PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const niveles = require('../src/educacion/niveles.json');
const fs = require('node:fs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const etiquetas = { minimoEstaciones: 'Estaciones de la red', minimoLineas: 'Líneas de la red', minimoTramos: 'Conexiones del recorrido', minimoMetros: 'Unidades asignadas', minimoTransbordos: 'Transbordos entre líneas', requiereCoberturaPuntosInteres: 'Atender las referencias objetivo', requiereRedValida: 'Red consistente', requiereSimulacion: 'Simular la red actual' };
const condicion = (clave, completado) => ({ clave, completado, texto: etiquetas[clave] ?? 'Condición del escenario', actual: completado ? 1 : 0, requerido: 1 });
const consigna = condiciones => ({ estadoGlobal: 'PARCIAL', progreso: 0, condiciones, referenciasObjetivo: [] });
const escenario = n => ({ ...niveles[n - 1], idEscenario: n + 40, estado: 'INICIADO', desbloqueado: true });
async function abrir(t, opciones = {}) {
  const vista = await abrirEditor(navegador, opciones);
  t.after(() => vista.contexto.close());
  t.after(() => assert.deepEqual(vista.errores, []));
  await vista.pagina.waitForFunction(() => editorPrueba.estadoConsigna !== 'cargando');
  return vista;
}
async function estado(p, clave) {
  await p.locator(`.metronet-assist[data-estado="${clave}"]`).waitFor({ state: 'attached' });
  await expandirAyuda(p);
}
async function expandirAyuda(p) {
  if (!await p.locator('.metronet-hud').evaluate(e=>e.open)) await p.locator('.metronet-hud>summary').click();
  if (await p.locator('.metronet-hud').getAttribute('data-vista') !== 'pista') await p.locator('[data-hud-vista="pista"]').click();
}
async function capturar(p, nombre) {
  if (!process.env.METRONET_CAPTURAS_ASSIST) return;
  fs.mkdirSync(process.env.METRONET_CAPTURAS_ASSIST, { recursive: true });
  await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_ASSIST}/${nombre}.png`, fullPage: true });
}

test('primera estación, nombre automático, línea: eventos reales del editor y ninguna pista por reloj', async t => {
  const { pagina: p, solicitudes, diseno } = await abrir(t, {
    escenario: escenario(1), estaciones: [], lineas: [], tramos: [],
    consigna: d => consigna([condicion('minimoEstaciones', d.estaciones.length >= 2), condicion('minimoLineas', d.lineas.length > 0)]),
  });
  await estado(p, 'primera-estacion');
  assert.doesNotMatch(await p.locator('[data-estado-editor]').innerText(), /Usá la rueda/);
  await p.locator('[data-assist-pista]').click();
  assert.match(await p.locator('[data-assist-mensaje]').innerText(), /necesidad del escenario/);
  assert.match(await p.locator('.metronet-tutorial').innerText(), /nombre se genera automáticamente/);
  await p.locator('[data-elegir-herramienta=estaciones]').click();

  await estado(p, 'primera-estacion');
  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX: 750, posicionY: 500 }, 'crearEstacion'));
  await estado(p, 'primera-ubicada');

  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX: 790, posicionY: 500 }, 'crearEstacion'));
  await estado(p, 'primera-linea');
  await p.locator('[data-elegir-herramienta=lineas]').click();

  await p.evaluate(() => editorPrueba.disenoActual.estaciones.forEach(valor => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor })));
  await estado(p, 'listo');
  assert.equal(diseno.lineas.length, 1);
  assert.deepEqual(solicitudes.map(s => s.ruta.split('/').at(-1)), ['estaciones', 'estaciones', 'lineas']);
  await p.evaluate(() => { window.cambiosAssist = 0; new MutationObserver(() => cambiosAssist++).observe(document.querySelector('[data-assist-mensaje]'), { childList: true, subtree: true }); });
  await p.clock.install(); await p.clock.fastForward(30000);
  assert.equal(await p.evaluate(() => cambiosAssist), 0);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await capturar(p, 'nivel-1-listo');
});

for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10]) test(`Nivel ${n}: condición real pendiente, cumplida y nuevo intento`, async t => {
  const clave = n === 2 ? 'minimoTramos' : n === 3 ? 'minimoMetros' : n >= 7 ? 'minimoTransbordos' : 'requiereCoberturaPuntosInteres';
  let respuesta = consigna([condicion('minimoEstaciones', true), condicion(clave, false)]);
  const { pagina: p, diseno } = await abrir(t, { escenario: escenario(n), consigna: () => respuesta });
  await estado(p, clave);
  respuesta = { ...consigna([condicion('minimoEstaciones', true), condicion(clave, true)]), estadoGlobal: 'COMPLETADO' };
  await p.evaluate(() => editorPrueba.actualizarConsigna());
  await estado(p, 'completado');
  diseno.estaciones = []; diseno.lineas = [];
  respuesta = consigna([condicion('minimoEstaciones', false), condicion('minimoLineas', false)]);
  if (n >= 4) respuesta.condiciones.push(condicion('requiereCoberturaPuntosInteres', false));
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  await estado(p, n >= 4 ? 'explorar' : 'primera-estacion');
  assert.equal(await p.locator('[data-assist-pista]').getAttribute('aria-pressed'), 'false');
});

test('POI, glosario en contexto, error de conexión y respuesta obsoleta tras cambiar escenario', async t => {
  let respuesta = consigna([condicion('requiereCoberturaPuntosInteres', false)]);
  const { pagina: p } = await abrir(t, { escenario: escenario(4), estaciones: [], lineas: [], consigna: () => respuesta });
  await estado(p, 'explorar');
  await p.evaluate(() => editorPrueba.escena.capaPuntosInteres.seleccionarPunto(editorPrueba.escena.capaPuntosInteres.puntos[0], { mostrarInformacion: false }));
  await estado(p, 'referencia-elegida');
  await p.locator('[data-assist-pista]').click();
  await p.locator('[data-assist-mensaje] [data-concepto=poi]').click();
  assert.equal(await p.locator('.metronet-assist .metronet-glosario-contextual').isVisible(), true);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await p.evaluate(() => editorPrueba.mostrarError({ message: 'Las estaciones no pertenecen a la línea.', estadoHttp: 400 }));
  await estado(p, 'error-recorrido');
  assert.equal(await p.locator('.metronet-glosario-contextual').count(), 0);
  await p.locator('[data-elegir-herramienta=lineas]').click();
  await estado(p, 'referencia-elegida');
  await p.route('**/api/juego/disenos/77/consigna', async route => {
    await p.waitForFunction(() => window.resolverAyuda);
    await route.fulfill({ json: { ...respuesta, estadoGlobal: 'COMPLETADO', condiciones: [condicion('requiereCoberturaPuntosInteres', true)] } });
  });
  await p.evaluate(() => { window.consultaAyuda = editorPrueba.actualizarConsigna(); });
  await estado(p, 'sin-consigna');
  await p.evaluate(() => {
    editorPrueba.disenoActual.simulacion.idDiseno = 78;
    editorPrueba.escenarioJuegoActual = { numero: null, modo: 'EDICION_LIBRE' };
    editorPrueba.prepararConsigna();
    window.resolverAyuda = true;
  });
  await p.evaluate(() => window.consultaAyuda);
  await estado(p, 'sin-escenario');
  assert.doesNotMatch(await p.locator('[data-assist-mensaje]').innerText(), /referencia|cobertura/);
});

test('simulación: listo, circulación, pausa y repetición sin nuevas consultas de ayuda', async t => {
  const vista = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { responder: req => {
    if (req.url().endsWith('/progreso')) return { json: { escenarios: [{ ...escenario(4), idEscenario: 42 }] } };
    if (req.url().endsWith('/consigna')) return { json: consigna([condicion('requiereRedValida', true), condicion('requiereSimulacion', false)]) };
    if (req.url().endsWith('/ejecutar')) return { json: { idSimulacion: 1, estado: 'COMPLETADA', puntaje: 0, ...req.postDataJSON() } };
  } });
  t.after(() => vista.contexto.close()); t.after(() => assert.deepEqual(vista.errores, []));
  const p = vista.pagina;
  await estado(p, 'simular');
  const iniciales = vista.solicitudes.filter(s => s.path.endsWith('/consigna')).length;
  await p.locator('#formularioEjecucion button[type=submit]').click();
  await estado(p, 'circulacion-EN_CURSO');
  const antes = vista.solicitudes.filter(s => s.path.endsWith('/consigna')).length;
  assert.equal(antes, iniciales + 1, 'La ejecución existente recarga el diseño y su consigna una vez');
  await p.locator('#pausarSimulacion').click(); await estado(p, 'circulacion-PAUSADA');
  await p.locator('#reanudarSimulacion').click(); await estado(p, 'circulacion-EN_CURSO');
  await p.locator('#detenerSimulacion').click(); await estado(p, 'simular');
  await p.locator('#reiniciarSimulacion').click(); await estado(p, 'circulacion-EN_CURSO');
  assert.equal(vista.solicitudes.filter(s => s.path.endsWith('/consigna')).length, antes);
  await capturar(p, 'simulacion');
});

test('conexión rechazada por la API y reintento válido cambian la ayuda sin bloquear el editor', async t => {
  const { pagina: p, diseno } = await abrir(t, { escenario: escenario(2), consigna: d => consigna([condicion('minimoEstaciones', true), condicion('minimoTramos', d.tramos.length >= 2)]) });
  let rechazada = false;
  await p.route('**/api/simulaciones/77/tramos', async route => {
    if (route.request().method() === 'POST' && !rechazada) {
      rechazada = true;
      return route.fulfill({ status: 400, json: { detail: 'El recorrido no admite ramificaciones.' }, headers: { 'access-control-allow-origin': '*' } });
    }
    return route.fallback();
  });
  await p.locator('[data-elegir-herramienta=conexiones]').click();
  await p.locator('[data-linea-conexion]').selectOption('Azul');
  await p.evaluate(() => editorPrueba.disenoActual.estaciones.slice(1).forEach(valor => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor })));
  await estado(p, 'error-recorrido');
  assert.match(await p.locator('[data-estado-editor]').innerText(), /no admite ramificaciones/);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await p.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente);
  await p.evaluate(() => editorPrueba.seleccionarElemento({tipo:'estacion',valor:editorPrueba.disenoActual.estaciones[2]})); await estado(p, 'listo');
  assert.equal(diseno.tramos.length, 2);
});

test('evaluación parcial conserva la orientación de progreso; una consigna fallida no deja consejos obsoletos', async t => {
  const { pagina: p } = await abrir(t, { escenario: escenario(2), consigna: () => consigna([condicion('minimoEstaciones', true), condicion('minimoTramos', false)]) });
  await p.route('**/api/juego/disenos/77/evaluar', route => route.fulfill({ json: { completado: false, mensaje: 'El objetivo aún tiene condiciones pendientes.' }, headers: { 'access-control-allow-origin': '*' } }));
  await p.locator('[data-guardar]').click();
  await p.waitForFunction(() => document.querySelector('[data-estado-editor]').textContent.includes('El objetivo aún tiene condiciones pendientes.'));
  assert.equal(await p.locator('.metronet-assist').getAttribute('data-estado'), 'minimoTramos');
  await p.route('**/api/juego/disenos/77/consigna', route => route.fulfill({ status: 503, json: { detail: 'Consigna no disponible.' }, headers: { 'access-control-allow-origin': '*' } }));
  await p.evaluate(() => editorPrueba.actualizarConsigna()); await estado(p, 'sin-consigna');
  assert.doesNotMatch(await p.locator('[data-assist-mensaje]').innerText(), /faltan conexiones/);
  await p.unroute('**/api/juego/disenos/77/consigna');
  await p.evaluate(() => editorPrueba.actualizarConsigna()); await estado(p, 'minimoTramos');
});

test('ocultar y volver a mostrar la ayuda de simulación restaura el texto aunque sea idéntico', async t => {
  const { pagina: p } = await abrir(t, { escenario: escenario(2) });
  const contenido = await p.evaluate(async () => {
    const { default: Panel } = await import('/src/educacion/PanelAyudaContextual.js');
    const contenedor = document.createElement('div'); document.body.append(contenedor);
    const panel = new Panel(contenedor);
    const contexto = { diseno: editorPrueba.disenoActual, escenario: editorPrueba.escenarioJuegoActual,
      estadoConsigna: 'disponible', consigna: { condiciones: [{ clave: 'requiereSimulacion', completado: false }] }, pantalla: 'simulacion' };
    panel.actualizar(contexto); const antes = panel.mensaje.textContent;
    panel.actualizar({}); panel.actualizar(contexto); const despues = panel.mensaje.textContent;
    panel.eliminar(); contenedor.remove(); return { antes, despues };
  });
  assert.ok(contenido.antes.length > 0);
  assert.equal(contenido.despues, contenido.antes);
});

for (const width of [1440, 768, 390, 320]) test(`Glosario bajo demanda a ${width}px y movimiento reducido`, async t => {
  const {pagina:p} = await abrir(t, { viewport:{width,height:844}, escenario:escenario(4), estaciones:[], lineas:[], consigna:()=>consigna([condicion('requiereCoberturaPuntosInteres',false)]) });
  await p.emulateMedia({reducedMotion:'reduce'});
  await estado(p,'explorar');
  await p.locator('[data-assist-pista]').click();
  await p.locator('[data-assist-mensaje] [data-concepto=poi]').click();
  assert.equal(await p.locator('.metronet-glosario-contextual').isVisible(),true);
  await p.locator('.metronet-glosario-contextual button').scrollIntoViewIfNeeded();
  const rect=await p.locator('.metronet-hud__panel').boundingBox();
  assert.ok(rect.x>=0&&rect.x+rect.width<=width&&rect.y+rect.height<=844);
  assert.equal(await p.locator('[data-assist-mensaje]>p').evaluate(e=>getComputedStyle(e).textShadow),'none');
  assert.equal(await p.locator('[data-assist-mensaje]>p').evaluate(e=>getComputedStyle(e).animationName),'none');
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.metronet-glosario-contextual').count(),0);
  assert.equal(await p.locator('dialog[open]').count(),0);
});
