// Navegador con API simulada: verifica navegación y no escribe en PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const catalogo = require('../src/educacion/mensajesTransicion.json');
const niveles = require('../src/educacion/niveles.json');
const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
function nivel(numero, estado = 'DISPONIBLE') {
  return { ...niveles.find(n => n.numero === numero), idEscenario: 40 + (numero ?? 11), numero,
    nombre: numero === null ? 'Modo Libre' : `Nivel ${numero}`, objetivo: `Consigna del servidor para el nivel ${numero}.`,
    estado, desbloqueado: estado !== 'BLOQUEADO', progreso: estado === 'COMPLETADO' ? 100 : 0,
    herramientasHabilitadas: {}, cantidadIntentos: 0, completadoEnCampanaActual: estado === 'COMPLETADO' };
}
async function abrir(t, escenarios, ruta = '/escenarios.html', opciones = {}) {
  const contexto = await navegador.newContext({ viewport: opciones.viewport || { width: 1280, height: 900 }, reducedMotion: opciones.reducedMotion || 'no-preference' });
  t.after(() => contexto.close());
  await contexto.addInitScript(() => localStorage.setItem('sesionUsuario', JSON.stringify({ token: 'prueba-local', usuario: { nombre: 'Prueba', rol: 'JUGADOR' } })));
  const pagina = await contexto.newPage();
  const solicitudes = [], errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  t.after(() => assert.deepEqual(errores, []));
  let liberar;
  const esperaApi = new Promise(resolve => { liberar = resolve; });
  await pagina.route('**/api/juego/**', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      solicitudes.push({ ruta: new URL(req.url()).pathname, autorizacion: req.headers().authorization });
      if (opciones.demorarApi) await esperaApi;
      if (opciones.errorApi) return route.fulfill({ status: 403, json: { detail: 'El escenario está bloqueado.' } });
      return route.fulfill({ json: { idEscenario: Number(new URL(req.url()).pathname.split('/').at(-2)), idDiseno: 101, idIntento: 202, estado: 'EN_DESARROLLO' } });
    }
    await route.fulfill({ json: { escenarios, numeroCampanaActual: 1, cantidadNiveles: escenarios.filter(e => e.numero !== null).length,
      nivelesCompletados: escenarios.filter(e => e.estado === 'COMPLETADO').length, modoLibreDesbloqueado: true, campanaCompletada: false } });
  });
  await pagina.route(`${BASE}/?*`, route => route.fulfill({ contentType: 'text/html', body: '<h1>Mapa de prueba</h1>' }));
  await pagina.route(`${BASE}/__prueba-editor`, route => route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/src/estilos/metronet.css"><link rel="stylesheet" href="/src/estilos/retro.css"><main></main>' }));
  if (opciones.falloModulo) await pagina.route('**/educacion/PantallaPreparacionNivel.js*', route => route.abort());
  if (opciones.falloRender) await pagina.addInitScript(() => { HTMLDialogElement.prototype.showModal = () => { throw new Error('Fallo de presentación'); }; });
  if (opciones.sinStorage) await pagina.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(k) { if (k.startsWith('metronet:transicion:')) throw new Error('No disponible'); return get.call(this, k); };
    Storage.prototype.setItem = function(k, v) { if (k.startsWith('metronet:transicion:')) throw new Error('No disponible'); return set.call(this, k, v); };
  });
  await pagina.goto(`${BASE}${ruta}`);
  await pagina.clock.install();
  return { pagina, solicitudes, liberar };
}
async function viajar(pagina) {
  await pagina.locator('.metronet-viaje').waitFor();
  await pagina.clock.runFor(3300);
}
async function destino(pagina, escenario) {
  await pagina.waitForURL(`${BASE}/?idDiseno=101&idEscenario=${escenario.idEscenario}&idIntento=202`);
}
for (const ruta of ['/escenarios.html', '/inicio.html']) {
  test(`${ruta}: entra automáticamente en cada nivel, con API en paralelo y consigna correcta`, async t => {
    for (const numero of [1, 4, 6, 10]) await t.test(`nivel ${numero}`, async t => {
      const escenario = nivel(numero);
      const { pagina, solicitudes } = await abrir(t, [escenario], ruta);
      await pagina.getByRole('button', { name: ruta === '/inicio.html' ? 'Comenzar escenario' : 'Comenzar', exact: true }).click();
      const dialogo = pagina.getByRole('dialog', { name: escenario.nombre, exact: true });
      await dialogo.waitFor();
      await pagina.waitForFunction(() => document.querySelector('[role="progressbar"]'));
      assert.match(await dialogo.locator('.metronet-viaje__consigna').innerText(), new RegExp(escenario.objetivo));
      assert.equal(solicitudes.length, 1);
      assert.ok(Number(await dialogo.getByRole('progressbar').getAttribute('aria-valuenow')) < 100);
      assert.equal(await dialogo.getByRole('button', { name: 'Comenzar nivel' }).count(), 0);
      await viajar(pagina);
      await destino(pagina, escenario);
      assert.deepEqual(solicitudes, [{ ruta: `/api/juego/escenarios/${escenario.idEscenario}/iniciar`, autorizacion: 'Bearer prueba-local' }]);
    });
  });
}
test('API lenta: progreso monótono, 100% visible, mensaje estable y sin navegación prematura', async t => {
  const escenario = nivel(5);
  const { pagina, solicitudes, liberar } = await abrir(t, [escenario], '/escenarios.html', { demorarApi: true });
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  const dialogo = pagina.locator('.metronet-viaje'); await dialogo.waitFor();
  const mensaje = await dialogo.locator('[data-mensaje-id]').innerText();
  assert.equal(solicitudes.length, 1);
  let anterior = -1;
  for (const ms of [750, 750, 750, 750, 300]) {
    await pagina.clock.runFor(ms);
    const actual = Number(await dialogo.getByRole('progressbar').getAttribute('aria-valuenow'));
    assert.ok(actual >= anterior); anterior = actual;
    assert.equal(await dialogo.locator('[data-mensaje-id]').innerText(), mensaje);
  }
  assert.equal(anterior, 100);
  assert.equal(await dialogo.locator('circle.activa').count(), 5);
  assert.match(await dialogo.innerText(), /Esperando la respuesta/);
  assert.equal(new URL(pagina.url()).pathname, '/escenarios.html');
  // También se puede detener el avance cuando la animación ya terminó y falta el servidor.
  await dialogo.getByRole('button', { name: 'Leer sin prisa' }).click();
  liberar();
  await pagina.clock.runFor(100);
  assert.equal(await dialogo.count(), 1);
  await dialogo.getByRole('button', { name: 'Continuar al nivel' }).click();
  await destino(pagina, escenario);
});
test('volver, Escape y doble clic no duplican viajes; cada reingreso cambia el mensaje', async t => {
  const { pagina, solicitudes } = await abrir(t, [nivel(1)]);
  let anterior;
  for (const accion of ['volver', 'escape', 'continuar']) {
    const boton = pagina.getByRole('button', { name: 'Comenzar', exact: true });
    await boton.dblclick();
    const dialogo = pagina.locator('.metronet-viaje'); await dialogo.waitFor();
    assert.equal(await dialogo.count(), 1);
    const id = await dialogo.locator('[data-mensaje-id]').getAttribute('data-mensaje-id');
    assert.notEqual(id, anterior); anterior = id;
    if (accion === 'continuar') await viajar(pagina);
    else {
      if (accion === 'volver') await dialogo.getByRole('button', { name: 'Volver', exact: true }).click();
      else await pagina.keyboard.press('Escape');
      await dialogo.waitFor({ state: 'detached' });
      await pagina.clock.runFor(4000);
      assert.equal(new URL(pagina.url()).pathname, '/escenarios.html');
      assert.equal(await boton.isEnabled(), true);
      assert.equal(await boton.evaluate(b => b === document.activeElement), true);
    }
  }
  await destino(pagina, nivel(1));
  // Cada entrada autoriza un único POST. Volver cancela el viaje, no revierte un intento del servidor.
  assert.equal(solicitudes.length, 3);
});
for (const [estado, accion, endpoint] of [['EN_DESARROLLO', 'Continuar', 'iniciar'], ['COMPLETADO', 'Volver a jugar', 'volver-a-jugar']]) {
  test(`${accion}: conserva endpoint e identificadores`, async t => {
    const escenario = nivel(2, estado), { pagina, solicitudes } = await abrir(t, [escenario]);
    await pagina.getByRole('button', { name: accion, exact: true }).click(); await viajar(pagina); await destino(pagina, escenario);
    assert.equal(solicitudes[0].ruta, `/api/juego/escenarios/${escenario.idEscenario}/${endpoint}`);
  });
}
for (const numero of [99, null]) test(`sin catálogo (${numero ?? 'Modo Libre'}): fallback o acceso directo`, async t => {
  const escenario = nivel(numero), { pagina, solicitudes } = await abrir(t, [escenario]);
  await pagina.getByRole('button', { name: numero === null ? 'Entrar al Modo Libre' : 'Comenzar', exact: true }).click();
  if (numero) { await pagina.getByText('Analizá las conexiones antes de tomar una decisión.').waitFor(); await viajar(pagina); }
  await destino(pagina, escenario); assert.equal(solicitudes.length, 1);
});
for (const fallo of ['falloModulo', 'falloRender', 'sinStorage']) test(`${fallo}: la presentación no bloquea el acceso`, async t => {
  const { pagina, solicitudes } = await abrir(t, [nivel(1)], '/escenarios.html', { [fallo]: true });
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  if (fallo === 'sinStorage') await viajar(pagina);
  await destino(pagina, nivel(1)); assert.equal(solicitudes.length, 1);
});
test('errores de API y niveles bloqueados conservan sus restricciones', async t => {
  const { pagina, solicitudes } = await abrir(t, [nivel(1), nivel(2, 'BLOQUEADO')], '/escenarios.html', { errorApi: true });
  assert.equal(await pagina.getByRole('button', { name: 'Bloqueado', exact: true }).isDisabled(), true);
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await pagina.getByText('El escenario está bloqueado.', { exact: true }).waitFor();
  await pagina.clock.runFor(4000);
  assert.equal(await pagina.locator('.metronet-viaje').count(), 0);
  assert.equal(new URL(pagina.url()).pathname, '/escenarios.html');
  assert.equal(await pagina.getByRole('button', { name: 'Comenzar', exact: true }).isEnabled(), true);
  assert.equal(solicitudes.length, 1);
});
for (const width of [1440, 768, 375]) for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`Responsive ${width}, movimiento ${reducedMotion}: lectura, foco y animación accesibles`, async t => {
    const { pagina } = await abrir(t, [nivel(10)], '/escenarios.html', { viewport: { width, height: 800 }, reducedMotion });
    await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
    const dialogo = pagina.locator('.metronet-viaje'); await dialogo.waitFor();
    assert.equal(await pagina.evaluate(() => document.activeElement.id), 'tituloPreparacionNivel');
    const antes = await dialogo.locator('.metronet-viaje__metro').getAttribute('style');
    await pagina.clock.runFor(1500);
    const despues = await dialogo.locator('.metronet-viaje__metro').getAttribute('style');
    assert.equal(antes === despues, reducedMotion === 'reduce');
    await pagina.waitForFunction(() => getComputedStyle(document.querySelector('.metronet-viaje__consigna')).opacity === '1');
    const medidas = await dialogo.evaluate(d => ({ ancho: d.getBoundingClientRect().width, alto: d.getBoundingClientRect().height, desborde: d.scrollWidth > d.clientWidth, opacidad: getComputedStyle(d.querySelector('.metronet-viaje__consigna')).opacity }));
    assert.ok(medidas.ancho <= width && medidas.alto <= 800); assert.equal(medidas.desborde, false); assert.equal(medidas.opacidad, '1');
    await dialogo.getByRole('button', { name: 'Leer sin prisa' }).click();
    await pagina.clock.runFor(3000);
    assert.equal(await dialogo.getByRole('progressbar').getAttribute('aria-valuenow'), '100');
    await dialogo.getByRole('button', { name: 'Continuar al nivel' }).press('Enter');
    await destino(pagina, nivel(10));
  });
}
test('catálogo: tres mensajes breves por nivel y sin IDs repetidos', () => {
  assert.deepEqual(catalogo.map(n => n.numero), niveles.map(n => n.numero));
  for (const nivel of catalogo) {
    assert.ok(nivel.mensajes.length >= 3);
    assert.equal(new Set(nivel.mensajes.map(m => m.id)).size, nivel.mensajes.length);
    for (const mensaje of nivel.mensajes) { assert.ok(mensaje.texto.length < 170); assert.ok(mensaje.categoria); }
  }
});

test('recarga: se reinicia el viaje y se evita el último mensaje de la misma sesión', async t => {
  const { pagina } = await abrir(t, [nivel(6)]);
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  const dato = pagina.locator('[data-mensaje-id]'); await dato.waitFor();
  const anterior = await dato.getAttribute('data-mensaje-id');
  await pagina.reload();
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await dato.waitFor();
  assert.notEqual(await dato.getAttribute('data-mensaje-id'), anterior);
  assert.ok(Number(await pagina.getByRole('progressbar', { name: 'Progreso del viaje visual' }).getAttribute('aria-valuenow')) < 50);
  await viajar(pagina); await destino(pagina, nivel(6));
});
test('editor: preparación manual, viaje y repetición conservan IDs y cambios hasta abrir la red', async t => {
  const escenarios = [nivel(1, 'COMPLETADO'), nivel(2)];
  const { pagina, solicitudes } = await abrir(t, escenarios, '/__prueba-editor');
  await pagina.evaluate(async escenarios => {
    const { default: Editor } = await import('/src/mapa/controles/EditorRedMetro.js');
    window.editorPrueba = new Editor(null);
    editorPrueba.escenariosJuego = escenarios; editorPrueba.cambiosPendientes = true;
    editorPrueba.cargarJuego = async () => {};
    editorPrueba.cargarDisenos = async id => { window.disenoAbierto = id; };
    editorPrueba.mostrarMensaje = () => {};
    document.querySelector('main').append(editorPrueba.crearAccionContinuarEscenario(escenarios[1]));
  }, escenarios);
  await pagina.getByRole('button', { name: 'Continuar con Nivel 2' }).dblclick();
  await pagina.getByRole('button', { name: 'Volver', exact: true }).click();
  await pagina.waitForFunction(() => !editorPrueba.aperturaEscenarioEnCurso);
  assert.equal(solicitudes.length, 1);
  assert.equal(await pagina.evaluate(() => editorPrueba.cambiosPendientes), true);
  await pagina.getByRole('button', { name: 'Continuar con Nivel 2' }).click();
  await pagina.locator('.metronet-viaje').waitFor();
  assert.equal(solicitudes.length, 2);
  assert.equal(await pagina.evaluate(() => editorPrueba.cambiosPendientes), true);
  await viajar(pagina);
  await pagina.waitForFunction(() => window.disenoAbierto === 101 && !editorPrueba.aperturaEscenarioEnCurso);
  assert.equal(new URL(pagina.url()).searchParams.get('idEscenario'), '42');
  assert.equal(await pagina.evaluate(() => editorPrueba.cambiosPendientes), false);
  await pagina.evaluate(() => { void editorPrueba.volverAJugar(41); });
  await viajar(pagina);
  await pagina.waitForFunction(() => !editorPrueba.aperturaEscenarioEnCurso);
  assert.deepEqual(solicitudes.map(s => s.ruta), ['/api/juego/escenarios/42/iniciar', '/api/juego/escenarios/42/iniciar', '/api/juego/escenarios/41/volver-a-jugar']);
});
test('desmontaje, ruta, reinicio y salida cancelan frames y timers sin actualizaciones tardías', async t => {
  const { pagina } = await abrir(t, [nivel(1)], '/__prueba-editor');
  await pagina.evaluate(async () => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.crearViaje = () => crearPreparacionNivel({ numero: 1, nombre: 'Nivel 1', objetivo: 'Construí tu red.' });
    const raf = window.requestAnimationFrame, caf = window.cancelAnimationFrame;
    const timeout = window.setTimeout, clear = window.clearTimeout;
    window.framesViaje = new Set(); window.timersViaje = new Set();
    window.requestAnimationFrame = cb => { const id = raf(t => { framesViaje.delete(id); cb(t); }); framesViaje.add(id); return id; };
    window.cancelAnimationFrame = id => { framesViaje.delete(id); caf(id); };
    window.setTimeout = (cb, ms, ...args) => { const id = timeout(() => { timersViaje.delete(id); cb(...args); }, ms); timersViaje.add(id); return id; };
    window.clearTimeout = id => { timersViaje.delete(id); clear(id); };
  });
  for (const modo of ['desmontaje', 'popstate', 'pagehide', 'reinicio', 'pausaFinal']) {
    await pagina.evaluate(() => { window.viajePrueba = crearViaje(); window.elementoViejo = document.querySelector('.metronet-viaje'); });
    await pagina.clock.runFor(modo === 'pausaFinal' ? 3050 : 300);
    await pagina.evaluate(modo => {
      if (modo === 'desmontaje') elementoViejo.remove();
      else if (modo === 'reinicio') { const nuevo = crearViaje(); nuevo.cerrar(); }
      else if (modo === 'pausaFinal') viajePrueba.cerrar();
      else window.dispatchEvent(new Event(modo));
    }, modo);
    assert.equal(await pagina.evaluate(() => viajePrueba.finalizada), false);
    const porcentaje = await pagina.evaluate(() => elementoViejo.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'));
    await pagina.clock.runFor(4000);
    assert.equal(await pagina.locator('.metronet-viaje').count(), 0);
    assert.equal(await pagina.evaluate(() => elementoViejo.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')), porcentaje);
    assert.deepEqual(await pagina.evaluate(() => ({ frames: framesViaje.size, timers: timersViaje.size })), { frames: 0, timers: 0 });
  }
});
