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
async function estado(p, clave) { await p.locator(`.metronet-assist[data-estado="${clave}"]`).waitFor({ state: 'attached' }); }
async function expandirAyuda(p) {
  const alternar = p.locator('[data-assist-alternar]');
  if (await alternar.isVisible() && await alternar.getAttribute('aria-expanded') === 'false') await alternar.click();
}
async function capturar(p, nombre) {
  if (!process.env.METRONET_CAPTURAS_ASSIST) return;
  fs.mkdirSync(process.env.METRONET_CAPTURAS_ASSIST, { recursive: true });
  await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_ASSIST}/${nombre}.png`, fullPage: true });
}

test('primera estación, corrección de errores, línea: eventos reales del editor y ninguna pista por reloj', async t => {
  const { pagina: p, solicitudes, diseno } = await abrir(t, {
    escenario: escenario(1), estaciones: [], lineas: [], tramos: [],
    consigna: d => consigna([condicion('minimoEstaciones', d.estaciones.length >= 2), condicion('minimoLineas', d.lineas.length > 0)]),
  });
  await estado(p, 'primera-estacion');
  assert.doesNotMatch(await p.locator('[data-estado-editor]').innerText(), /Usá la rueda/);
  await p.locator('[data-assist-pista]').click();
  assert.match(await p.locator('[data-assist-mensaje]').innerText(), /ingresá un nombre/);
  await p.locator('[data-elegir-herramienta=estaciones]').click();
  await p.locator('[data-agregar-estacion]').click();
  await estado(p, 'error-nombre');
  await p.locator('[data-nombre-estacion]').fill('Primera');
  await p.locator('[data-agregar-estacion]').click();
  await estado(p, 'primera-estacion');
  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX: 750, posicionY: 500 }, 'crearEstacion'));
  await estado(p, 'primera-ubicada');
  await p.locator('[data-nombre-estacion]').fill('Segunda');
  await p.locator('[data-agregar-estacion]').click();
  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX: 790, posicionY: 500 }, 'crearEstacion'));
  await estado(p, 'primera-linea');
  await p.locator('[data-elegir-herramienta=lineas]').click();
  await p.locator('[data-nombre-linea]').fill('Recorrido');
  await p.locator('[data-crear-linea]').click();
  await p.evaluate(() => editorPrueba.disenoActual.estaciones.forEach(valor => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor })));
  await estado(p, 'crearLinea-2');
  await p.locator('[data-crear-linea]').click();
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
  await p.locator('.metronet-assist [data-concepto=poi]').click();
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

for (const width of [1440, 768, 390, 320]) test(`ASSIST compacto y referencias utilizables a ${width}px, movimiento reducido`, async t => {
  const { pagina: p } = await abrir(t, { escenario: escenario(4), viewport: { width, height: 1000 }, consigna: () => consigna([condicion('requiereCoberturaPuntosInteres', false)]) });
  await estado(p, 'requiereCoberturaPuntosInteres');
  if (await p.locator('#metronet-panel-controles').evaluate(e => e.classList.contains('metronet-panel-colapsado'))) await p.locator('[data-panel-edicion-toggle]').click();
  if (width <= 620) {
    assert.equal(await p.locator('[data-assist-mensaje]').isVisible(), false);
    assert.ok((await p.locator('.metronet-assist').boundingBox()).height <= 36);
    await capturar(p, `contraido-${width}`);
  }
  await expandirAyuda(p);
  await p.locator('.metronet-assist').scrollIntoViewIfNeeded();
  const geometria = await p.evaluate(() => {
    const a = document.querySelector('.metronet-assist').getBoundingClientRect(), m = document.querySelector('#metronet-mapa').getBoundingClientRect();
    const region = document.querySelector('#metronet-aplicacion').getBoundingClientRect();
    const texto = getComputedStyle(document.querySelector('[data-assist-mensaje] > p'));
    return { alto: a.height, ancho: a.width, solapa: a.left < m.right && a.right > m.left && a.top < Math.min(m.bottom, region.bottom) && a.bottom > Math.max(m.top, region.top), overflow: document.documentElement.scrollWidth > innerWidth, font: texto.fontSize, sombra: texto.textShadow, animacion: texto.animationDuration };
  });
  assert.ok(geometria.alto <= 130, JSON.stringify(geometria));
  assert.equal(geometria.solapa, false); assert.equal(geometria.overflow, false);
  assert.equal(geometria.font, '14px'); assert.equal(geometria.sombra, 'none');
  assert.equal(geometria.animacion, '0.18s');
  await p.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await p.locator('[data-assist-mensaje] > p').evaluate(e => getComputedStyle(e).animationName), 'none');
  await capturar(p, `assist-${width}`);
  await p.locator('.metronet-panel-puntos-titulo').scrollIntoViewIfNeeded();
  assert.equal(await p.locator('.metronet-panel-puntos-titulo').innerText(), 'BUSCAR POI');
  await p.getByRole('button', { name: 'Abrir buscador POI', exact: true }).click();
  await p.getByRole('button', { name: 'Cerrar buscador POI', exact: true }).click();
  assert.deepEqual(await p.locator('.metronet-panel-puntos-cabecera').evaluate(e => {
    const r = e.getBoundingClientRect();
    return [...e.children].filter(c => { const b = c.getBoundingClientRect(); return b.width && (b.left < r.left - 1 || b.right > r.right + 1); }).map(c => c.className);
  }), []);
  await capturar(p, `mapa-${width}`);
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
  await p.locator('[data-crear-tramo]').click();
  await p.evaluate(() => editorPrueba.disenoActual.estaciones.slice(1).forEach(valor => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor })));
  await p.locator('[data-crear-tramo]').click(); await estado(p, 'error-recorrido');
  assert.match(await p.locator('[data-estado-editor]').innerText(), /no admite ramificaciones/);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await p.locator('[data-crear-tramo]').click(); await estado(p, 'listo');
  assert.equal(diseno.tramos.length, 2);
});

test('evaluación parcial conserva la orientación de progreso; una consigna fallida no deja consejos obsoletos', async t => {
  const { pagina: p } = await abrir(t, { escenario: escenario(2), consigna: () => consigna([condicion('minimoEstaciones', true), condicion('minimoTramos', false)]) });
  await p.route('**/api/juego/disenos/77/evaluar', route => route.fulfill({ json: { completado: false, mensaje: 'El objetivo aún tiene condiciones pendientes.' }, headers: { 'access-control-allow-origin': '*' } }));
  await p.locator('[data-validar]').click();
  await p.waitForFunction(() => document.querySelector('[data-estado-editor]').textContent.includes('El objetivo aún tiene condiciones pendientes.'));
  assert.equal(await p.locator('.metronet-assist').getAttribute('data-estado'), 'minimoTramos');
  await p.route('**/api/juego/disenos/77/consigna', route => route.fulfill({ status: 503, json: { detail: 'Consigna no disponible.' }, headers: { 'access-control-allow-origin': '*' } }));
  await p.evaluate(() => editorPrueba.actualizarConsigna()); await estado(p, 'sin-consigna');
  assert.doesNotMatch(await p.locator('[data-assist-mensaje]').innerText(), /faltan conexiones/);
  await p.unroute('**/api/juego/disenos/77/consigna');
  await p.evaluate(() => editorPrueba.actualizarConsigna()); await estado(p, 'minimoTramos');
});

test('Pista y Controles comparten zona, conservan edición y vuelven al progreso más reciente sin nuevas consultas', async t => {
  const { pagina: p } = await abrir(t, {
    escenario: escenario(1), estaciones: [], lineas: [], tramos: [],
    consigna: d => consigna([condicion('minimoEstaciones', d.estaciones.length >= 2), condicion('minimoLineas', d.lineas.length > 0)]),
  });
  await estado(p, 'primera-estacion');
  assert.equal(await p.locator('[data-estado-editor] .metronet-assist').count(), 1);
  assert.equal(await p.locator('#metronet-panel-controles [data-ayuda-contextual]').count(), 0);
  assert.doesNotMatch(await p.locator('[data-assist-mensaje]').innerText(), /Rueda|Arrastrá/);
  const consultas = [];
  p.on('request', req => { if (/\/(api|auth)\//.test(req.url())) consultas.push(req.url()); });
  const mapa = await p.locator('#metronet-mapa').boundingBox();
  await p.locator('[data-assist-pista]').click();
  assert.match(await p.locator('[data-assist-mensaje]').innerText(), /ingresá un nombre/);
  await p.locator('[data-assist-controles]').click();
  assert.equal(await p.locator('[data-assist-pista]').isVisible(), false);
  assert.equal(await p.locator('[data-assist-etiqueta]').innerText(), 'CONTROLES');
  const controles = await p.locator('[data-assist-mensaje]').innerText();
  assert.match(controles, /Arrastrá con Seleccionar.*rueda.*pinza de dos dedos.*herramienta activa/);
  assert.equal(consultas.length, 0);
  assert.deepEqual(await p.locator('#metronet-mapa').boundingBox(), mapa);
  await p.evaluate(() => {
    window.reescriturasControles = 0;
    new MutationObserver(() => reescriturasControles++).observe(document.querySelector('[data-assist-mensaje]'), { childList: true, subtree: true });
  });
  await p.locator('[data-elegir-herramienta=estaciones]').click();
  await p.locator('[data-nombre-estacion]').fill('Primera');
  await p.locator('[data-agregar-estacion]').click();
  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX: 750, posicionY: 500 }, 'crearEstacion'));
  await estado(p, 'primera-ubicada');
  assert.equal(await p.locator('[data-assist-mensaje]').innerText(), controles);
  assert.equal(await p.evaluate(() => reescriturasControles), 0);
  await capturar(p, 'controles');
  const trasCrear = consultas.length;
  await p.locator('[data-assist-controles]').press('Enter');
  assert.equal(await p.locator('[data-assist-controles]').getAttribute('aria-pressed'), 'false');
  assert.match(await p.locator('[data-assist-mensaje]').innerText(), /Ya ubicaste la primera/);
  assert.equal(await p.locator('[data-assist-pista]').getAttribute('aria-pressed'), 'false');
  assert.equal(await p.locator('[data-assist-controles]').evaluate(e => document.activeElement === e), true);
  assert.equal(consultas.length, trasCrear);
  assert.equal(await p.locator('dialog[open], .metronet-notificacion').count(), 0);
  await capturar(p, 'pista-tras-crear');
});

test('un nuevo intento o escenario restablece Pista y retira definiciones anteriores; desmontar detiene actualizaciones', async t => {
  const { pagina: p } = await abrir(t, { escenario: escenario(4), estaciones: [], lineas: [], consigna: () => consigna([condicion('requiereCoberturaPuntosInteres', false)]) });
  await estado(p, 'explorar');
  await p.locator('[data-assist-pista]').click();
  await p.locator('.metronet-assist [data-concepto=poi]').click();
  await p.locator('[data-assist-controles]').click();
  assert.equal(await p.locator('.metronet-glosario-contextual').count(), 0);
  await p.evaluate(() => {
    const ed = editorPrueba;
    ed.disenoActual.simulacion.idDiseno = 78;
    ed.actualizarAyuda();
  });
  assert.equal(await p.locator('.metronet-assist').getAttribute('data-vista'), 'pista');
  await p.locator('[data-assist-controles]').click();
  await p.evaluate(() => {
    editorPrueba.escenarioJuegoActual = { numero: 2, idEscenario: 42, dificultad: 'Inicial', herramientasHabilitadas: { estaciones: true } };
    editorPrueba.consignaActual = { condiciones: [{ clave: 'minimoEstaciones', completado: false }] };
    editorPrueba.actualizarAyuda();
  });
  await estado(p, 'primera-estacion');
  assert.equal(await p.locator('.metronet-assist').getAttribute('data-vista'), 'pista');
  assert.doesNotMatch(await p.locator('[data-assist-mensaje]').innerText(), /referencias objetivo|Rueda/);
  await p.evaluate(() => { editorPrueba.eliminar(); editorPrueba.actualizarAyuda(); });
  assert.equal(await p.locator('.metronet-assist').count(), 0);
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

for (const width of [1440, 768, 390, 320]) test(`glosario legible dentro de la asistencia a ${width}px: definición y cierre accesibles sin tapar el mapa`, async t => {
  const { pagina: p } = await abrir(t, { viewport: { width, height: 844 }, escenario: escenario(4), estaciones: [], lineas: [], consigna: () => consigna([condicion('requiereCoberturaPuntosInteres', false)]) });
  await estado(p, 'explorar');
  await expandirAyuda(p);
  await p.locator('[data-assist-pista]').click();
  const pista = await p.locator('[data-assist-mensaje] > p').innerText();
  await p.locator('.metronet-assist [data-concepto=poi]').click();
  const medidas = await p.locator('[data-assist-mensaje]').evaluate(e => {
    const r = e.getBoundingClientRect(), panel = e.querySelector('.metronet-glosario-contextual');
    const d = panel.querySelector('p'), c = panel.querySelector('button');
    const dentro = nodo => { const b = nodo.getBoundingClientRect(); return b.top >= r.top - 1 && b.bottom <= r.bottom + 1 && b.left >= r.left - 1 && b.right <= r.right + 1; };
    return { definicion: dentro(d), cerrar: dentro(c), anchoTexto: d.clientWidth, alturaTexto: d.getBoundingClientRect().height, alturaLinea: parseFloat(getComputedStyle(d).lineHeight) };
  });
  assert.equal(medidas.definicion, true, JSON.stringify(medidas));
  assert.equal(medidas.cerrar, true, JSON.stringify(medidas));
  assert.ok(medidas.alturaTexto >= medidas.alturaLinea - .5, JSON.stringify(medidas));
  assert.ok(medidas.anchoTexto >= 160, JSON.stringify(medidas));
  const hud = await p.locator('[data-estado-editor]').boundingBox();
  const areaMapa = await p.locator('#metronet-aplicacion').boundingBox();
  assert.ok(hud.y + hud.height <= areaMapa.y, 'El glosario permanece fuera del mapa');
  assert.ok(hud.height <= 180, 'La definición larga tiene lectura acotada con scroll');
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await p.locator('.metronet-glosario-contextual > p').focus();
  await p.keyboard.press('End');
  await capturar(p, `glosario-${width}`);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.metronet-glosario-contextual').count(), 0);
  assert.equal(await p.locator('[data-assist-mensaje] > p').innerText(), pista);
  assert.equal(await p.locator('.metronet-assist [data-concepto=poi]').evaluate(e => e === document.activeElement), true);
});
