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
  const recorrido = vista.pagina.locator('.metronet-recorrido[open] [data-recorrido-omitir]');
  if (await recorrido.isVisible()) await recorrido.click();
  return vista;
}
async function estadoMotorAyuda(p, clave) {
  await p.waitForFunction(esperada => document.querySelector('.metronet-hud')?.dataset.estado === esperada, clave);
  assert.equal(await p.locator('.metronet-hud').getAttribute('data-estado'), clave);
}
async function capturar(p, nombre) {
  if (!process.env.METRONET_CAPTURAS_ASSIST) return;
  fs.mkdirSync(process.env.METRONET_CAPTURAS_ASSIST, { recursive: true });
  await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_ASSIST}/${nombre}.png`, fullPage: true });
}

test('Editor de nivel conserva Aprender y Música sin la vista Pista anterior', async t => {
  const { pagina: p } = await abrir(t, { escenario: escenario(1) });
  assert.equal(await p.locator('.metronet-aprender-acceso').isVisible(), true);
  assert.equal(await p.locator('[data-hud-vista=pista]').count(), 0);
  assert.equal(await p.locator('.metronet-hud').getAttribute('data-vista'), 'musica');
  await p.locator('.metronet-hud>summary').click();
  assert.equal(await p.locator('[data-hud-musica]').isVisible(), true);
});

test('primera estación, nombre automático y línea actualizan el motor sin temporizadores', async t => {
  const { pagina: p, solicitudes, diseno } = await abrir(t, {
    escenario: escenario(1), estaciones: [], lineas: [], tramos: [],
    consigna: d => consigna([condicion('minimoEstaciones', d.estaciones.length >= 2), condicion('minimoLineas', d.lineas.length > 0)]),
  });
  await estadoMotorAyuda(p, 'primera-estacion');
  assert.doesNotMatch(await p.locator('[data-estado-editor]').innerText(), /Usá la rueda/);
  assert.equal(await p.locator('.metronet-aprender-acceso').isVisible(), true);
  assert.equal(await p.locator('.metronet-tutorial__panel').isVisible(), false);
  await p.locator('[data-elegir-herramienta=estaciones]').click();

  await estadoMotorAyuda(p, 'primera-estacion');
  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX: 750, posicionY: 500 }, 'crearEstacion'));
  await estadoMotorAyuda(p, 'primera-ubicada');

  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX: 790, posicionY: 500 }, 'crearEstacion'));
  await estadoMotorAyuda(p, 'primera-linea');
  await p.locator('[data-elegir-herramienta=lineas]').click();

  await p.evaluate(() => editorPrueba.disenoActual.estaciones.forEach(valor => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor })));
  await estadoMotorAyuda(p, 'listo');
  assert.equal(diseno.lineas.length, 1);
  assert.deepEqual(diseno.estaciones.map(e => e.nombre), ['Estación 01', 'Estación 02']);
  assert.equal(diseno.lineas[0].nombre, 'Línea 01');
  assert.deepEqual(solicitudes.map(s => s.ruta.split('/').at(-1)), ['estaciones', 'estaciones', 'lineas']);
  await p.evaluate(() => { window.cambiosAssist = 0; new MutationObserver(() => cambiosAssist++).observe(document.querySelector('[data-assist-mensaje]'), { childList: true, subtree: true }); });
  await p.clock.install(); await p.clock.fastForward(30000);
  assert.equal(await p.evaluate(() => cambiosAssist), 0);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await capturar(p, 'nivel-1-listo');
});

for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10]) test(`Nivel ${n}: consigna pendiente, completada y nuevo intento actualizan el motor`, async t => {
  const clave = n === 2 ? 'minimoTramos' : n === 3 ? 'minimoMetros' : n >= 7 ? 'minimoTransbordos' : 'requiereCoberturaPuntosInteres';
  let respuesta = consigna([condicion('minimoEstaciones', true), condicion(clave, false)]);
  const { pagina: p, diseno } = await abrir(t, { escenario: escenario(n), consigna: () => respuesta });
  await estadoMotorAyuda(p, clave);
  assert.equal(await p.locator('.metronet-aprender-acceso').isVisible(), true);
  respuesta = { ...consigna([condicion('minimoEstaciones', true), condicion(clave, true)]), estadoGlobal: 'COMPLETADO' };
  await p.evaluate(() => editorPrueba.actualizarConsigna());
  await estadoMotorAyuda(p, 'completado');
  diseno.estaciones = []; diseno.lineas = [];
  respuesta = consigna([condicion('minimoEstaciones', false), condicion('minimoLineas', false)]);
  if (n >= 4) respuesta.condiciones.push(condicion('requiereCoberturaPuntosInteres', false));
  if (niveles[n - 1].reglasExito.requiereGeografiaValida) respuesta.condiciones.push(condicion('requiereGeografiaValida', false));
  if (niveles[n - 1].reglasExito.maximoEstaciones) respuesta.condiciones.push({ ...condicion('maximoEstaciones', false), requerido: niveles[n - 1].reglasExito.maximoEstaciones });
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  await estadoMotorAyuda(p, n >= 4 ? 'explorar' : 'primera-estacion');
  assert.match(await p.locator('.metronet-consigna__lista-breve li').first().getAttribute('aria-label'),
    n >= 9 ? /0 de 2\. Pendiente/ : /0 de 1\. Pendiente/);
  assert.equal(await p.locator('.metronet-aprender-acceso').isVisible(), true);
});

test('POI, error de conexión y respuesta obsoleta no dejan estados anteriores en el motor', async t => {
  let respuesta = consigna([condicion('requiereCoberturaPuntosInteres', false)]);
  const { pagina: p } = await abrir(t, { escenario: escenario(4), estaciones: [], lineas: [], consigna: () => respuesta });
  await estadoMotorAyuda(p, 'explorar');
  await p.evaluate(() => editorPrueba.escena.capaPuntosInteres.seleccionarPunto(editorPrueba.escena.capaPuntosInteres.puntos[0], { mostrarInformacion: false }));
  await estadoMotorAyuda(p, 'referencia-elegida');
  assert.equal(await p.locator('[data-hud-vista=pista]').count(), 0);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await p.evaluate(() => editorPrueba.mostrarError({ message: 'Las estaciones no pertenecen a la línea.', estadoHttp: 400 }));
  await estadoMotorAyuda(p, 'error-recorrido');
  await p.locator('[data-elegir-herramienta=lineas]').click();
  await estadoMotorAyuda(p, 'referencia-elegida');
  await p.route('**/api/juego/disenos/77/consigna', async route => {
    await p.waitForFunction(() => window.resolverAyuda);
    await route.fulfill({ json: { ...respuesta, estadoGlobal: 'COMPLETADO', condiciones: [condicion('requiereCoberturaPuntosInteres', true)] } });
  });
  await p.evaluate(() => { window.consultaAyuda = editorPrueba.actualizarConsigna(); });
  await estadoMotorAyuda(p, 'sin-consigna');
  await p.evaluate(() => {
    editorPrueba.disenoActual.simulacion.idDiseno = 78;
    editorPrueba.escenarioJuegoActual = { numero: null, modo: 'EDICION_LIBRE' };
    editorPrueba.prepararConsigna();
    window.resolverAyuda = true;
  });
  await p.evaluate(() => window.consultaAyuda);
  await estadoMotorAyuda(p, 'sin-escenario');
  assert.doesNotMatch(await p.locator('[data-assist-mensaje]').textContent(), /referencia|cobertura/);
});

test('simulación: Tutorial, circulación, pausa y repetición sin consultas extra', async t => {
  const vista = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { responder: req => {
    if (req.url().endsWith('/progreso')) return { json: { escenarios: [{ ...escenario(4), idEscenario: 42 }] } };
    if (req.url().endsWith('/consigna')) return { json: consigna([condicion('requiereRedValida', true), condicion('requiereSimulacion', false)]) };
    if (req.url().endsWith('/ejecutar')) return { json: { idSimulacion: 1, estado: 'COMPLETADA', puntaje: 0, ...req.postDataJSON() } };
  } });
  t.after(() => vista.contexto.close()); t.after(() => assert.deepEqual(vista.errores, []));
  const p = vista.pagina;
  await estadoMotorAyuda(p, 'simular');
  assert.equal(await p.locator('#tutorialPantallaSimulacion').isVisible(), true);
  assert.equal(await p.locator('.metronet-aprender-acceso').isVisible(), false);
  const iniciales = vista.solicitudes.filter(s => s.path.endsWith('/consigna')).length;
  await p.locator('#formularioEjecucion button[type=submit]').click();
  await estadoMotorAyuda(p, 'circulacion-EN_CURSO');
  const antes = vista.solicitudes.filter(s => s.path.endsWith('/consigna')).length;
  assert.equal(antes, iniciales + 1, 'La ejecución existente recarga el diseño y su consigna una vez');
  await p.locator('#pausarSimulacion').click(); await estadoMotorAyuda(p, 'circulacion-PAUSADA');
  await p.locator('#reanudarSimulacion').click(); await estadoMotorAyuda(p, 'circulacion-EN_CURSO');
  await p.locator('#detenerSimulacion').click(); await estadoMotorAyuda(p, 'simular');
  await p.locator('#reiniciarSimulacion').click(); await estadoMotorAyuda(p, 'circulacion-EN_CURSO');
  assert.equal(vista.solicitudes.filter(s => s.path.endsWith('/consigna')).length, antes);
  await capturar(p, 'simulacion');
});

test('conexión rechazada y reintento actualizan el motor sin bloquear el Editor', async t => {
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
  await p.evaluate(() => editorPrueba.seleccionarElemento({
    tipo: 'tramo', valor: editorPrueba.disenoActual.tramos[0],
  }));
  assert.equal(await p.evaluate(() => editorPrueba.creacionDirecta.lineaActiva), 'Azul');
  await p.evaluate(() => editorPrueba.disenoActual.estaciones.slice(1).forEach(valor => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor })));
  await p.waitForFunction(() => document.querySelector('[data-estado-editor]').textContent.includes('no admite ramificaciones'));
  assert.match(await p.locator('[data-estado-editor]').innerText(), /no admite ramificaciones/);
  await estadoMotorAyuda(p, 'error-recorrido');
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await p.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente);
  await p.evaluate(() => editorPrueba.seleccionarElemento({tipo:'estacion',valor:editorPrueba.disenoActual.estaciones[2]})); await estadoMotorAyuda(p, 'listo');
  assert.equal(diseno.tramos.length, 2);
});

test('evaluación parcial conserva progreso y una consigna fallida limpia el motor', async t => {
  const { pagina: p } = await abrir(t, { escenario: escenario(2), consigna: () => consigna([condicion('minimoEstaciones', true), condicion('minimoTramos', false)]) });
  await p.route('**/api/juego/disenos/77/evaluar', route => route.fulfill({ json: { completado: false, mensaje: 'El objetivo aún tiene condiciones pendientes.' }, headers: { 'access-control-allow-origin': '*' } }));
  await p.locator('[data-guardar]').click();
  await p.waitForFunction(() => !editorPrueba.finalizacionEnCurso);
  assert.doesNotMatch(await p.locator('[data-estado-editor]').innerText(), /El objetivo aún tiene condiciones pendientes/);
  assert.equal(await p.locator('.metronet-assist').getAttribute('data-estado'), 'minimoTramos');
  await p.route('**/api/juego/disenos/77/consigna', route => route.fulfill({ status: 503, json: { detail: 'Consigna no disponible.' }, headers: { 'access-control-allow-origin': '*' } }));
  await p.evaluate(() => editorPrueba.actualizarConsigna()); await estadoMotorAyuda(p, 'sin-consigna');
  assert.doesNotMatch(await p.locator('[data-assist-mensaje]').textContent(), /faltan conexiones/);
  await p.unroute('**/api/juego/disenos/77/consigna');
  await p.evaluate(() => editorPrueba.actualizarConsigna()); await estadoMotorAyuda(p, 'minimoTramos');
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

for (const width of [1440, 768, 390, 320]) test(`Aprender se abre con teclado a ${width}px y movimiento reducido`, async t => {
  const {pagina:p} = await abrir(t, {
    viewport:{width,height:844}, escenario:escenario(4), primeraPasada:false,
    cerrarTarjetaAutomatica:false, estaciones:[], lineas:[],
    consigna:()=>consigna([condicion('requiereCoberturaPuntosInteres',false)]),
  });
  await p.emulateMedia({reducedMotion:'reduce'});
  await estadoMotorAyuda(p,'explorar');
  const aprender = p.locator('.metronet-aprender-acceso');
  assert.equal(await aprender.isVisible(),true);
  const acceso=await aprender.boundingBox();
  assert.ok(acceso.x>=0&&acceso.x+acceso.width<=width&&acceso.y>=0&&acceso.y+acceso.height<=844,
    JSON.stringify({ width, acceso, scrollY: await p.evaluate(() => scrollY),
      altoPagina: await p.evaluate(() => document.documentElement.scrollHeight),
      padres: await aprender.evaluate(e => { const a=[]; for(let p=e.parentElement;p&&a.length<5;p=p.parentElement) {
        const r=p.getBoundingClientRect(); a.push({clase:p.className,y:r.y,h:r.height,estilo:getComputedStyle(p).transform}); }
        return a; }) }));
  await aprender.focus();
  assert.equal(await aprender.evaluate(e=>e===document.activeElement),true);
  await p.keyboard.press('Enter');
  const tarjeta=p.locator('dialog[open] .metronet-tarjeta-educativa');
  await tarjeta.waitFor({state:'visible'});
  const rect=await p.locator('dialog[open]').boundingBox();
  assert.ok(rect.x>=0&&rect.x+rect.width<=width&&rect.y>=0&&rect.y+rect.height<=844);
  assert.equal(await tarjeta.evaluate(e=>getComputedStyle(e).animationName),'none');
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('dialog[open]').count(),0);
});
