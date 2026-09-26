const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const escenario = n => ({ ...niveles[n - 1], idEscenario: n, desbloqueado: true, estado: 'EN_DESARROLLO', progreso: 0 });
async function abrir(t, n = 1, opciones = {}) {
  const vista = await abrirEditor(navegador, { escenario: escenario(n), estaciones: [], lineas: [], tramos: [], ...opciones });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  return vista;
}

test('La progresión introduce herramientas por configuración, sin repetirlas en los diez niveles', async t => {
  const { pagina } = await abrir(t);
  const resultado = await pagina.evaluate(async niveles => {
    const { herramientasIntroducidas } = await import('/src/educacion/TutorialInicial.js');
    return niveles.map(n => herramientasIntroducidas(n, niveles));
  }, niveles);
  assert.deepEqual(resultado, [['estaciones', 'lineas'], ['conexiones'], ['metros'], ['simulacion'], [], [], [], [], [], []]);
  const reorganizado = await pagina.evaluate(async () => {
    const { herramientasIntroducidas } = await import('/src/educacion/TutorialInicial.js');
    const a = { numero: 1, herramientasHabilitadas: { estaciones: true, lineas: true, metros: true } };
    const b = { numero: 2, herramientasHabilitadas: { estaciones: true, lineas: true, metros: true, conexiones: true } };
    return herramientasIntroducidas(b, [a, b]);
  });
  assert.deepEqual(reorganizado, ['conexiones']);
});

test('Crear una estación avanza; cambiar herramienta o un error no completan el tutorial; minimizar permite seguir editando', async t => {
  const { pagina: p, solicitudes } = await abrir(t);
  const panel = p.locator('.metronet-tutorial');
  assert.equal(await panel.getAttribute('data-paso'), 'estaciones');
  await p.locator('[data-elegir-herramienta="lineas"]').click();
  assert.equal(await panel.getAttribute('data-paso'), 'estaciones');
  await p.evaluate(() => editorPrueba.mostrarMensaje('La ubicación no es válida.', 'error'));
  assert.equal(await panel.getAttribute('data-paso'), 'estaciones');
  await p.locator('.metronet-hud>summary').click();
  await p.getByRole('button', { name:'Tutorial', exact:true }).click();
  await p.getByRole('button', { name:'Tutorial', exact:true }).click();
  assert.equal(await panel.locator('[data-tutorial-contenido]').isVisible(), false);
  await p.locator('[data-elegir-herramienta="estaciones"]').click();

  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX: 750, posicionY: 500 }, 'crearEstacion'));
  assert.equal(await panel.getAttribute('data-paso'), 'lineas');
  assert.equal(await panel.locator('[data-tutorial-contenido]').isVisible(), false);
  await p.locator('.metronet-hud>summary').click();
  assert.match(await panel.innerText(), /dos estaciones/);
  await p.evaluate(() => {
    editorPrueba.disenoActual.lineas.push({ nombre: 'Azul' });
    editorPrueba.actualizarAyuda();
  });
  assert.equal(await panel.getAttribute('data-paso'), 'manual');
  // Consultar controles/pistas/tutorial no realiza operaciones de puntuación.
  assert.ok(solicitudes.every(s => s.ruta.endsWith('/estaciones')));
});

test('Conexión avanza solo tras confirmación, y un intento nuevo restablece su tutorial', async t => {
  const { pagina: p } = await abrir(t, 2);
  const panel = p.locator('.metronet-tutorial');
  assert.equal(await panel.getAttribute('data-paso'), 'conexiones');
  await p.evaluate(() => { editorPrueba.panelTutorial.registrarUso('conexiones'); editorPrueba.actualizarAyuda(); });
  assert.equal(await panel.getAttribute('data-paso'), 'manual');
  await p.evaluate(() => { editorPrueba.disenoActual.simulacion.idDiseno = 88; editorPrueba.actualizarAyuda(); });
  assert.equal(await panel.getAttribute('data-paso'), 'conexiones');
  assert.equal(await panel.getAttribute('data-paso'), 'conexiones');
});

test('Pista razona sobre el recorrido mientras el tutorial explica los controles', async t => {
  const { pagina: p } = await abrir(t);
  const ayuda = await p.evaluate(async () => {
    const { obtenerAyudaContextual } = await import('/src/educacion/AyudaContextual.js');
    return obtenerAyudaContextual({
      diseno: { estaciones: [{ nombre: 'A' }, { nombre: 'B' }], lineas: [] },
      escenario: { numero: 1, dificultad: 'Inicial' }, tutorialActivo: true,
      modo: 'crearLinea', seleccionadas: ['A', 'B'], estadoConsigna: 'disponible',
      consigna: { condiciones: [{ clave: 'minimoLineas', completado: false }] },
    });
  });
  assert.match(ayuda.texto, /orden/);
  assert.doesNotMatch(ayuda.pista, /pulsá|botón|confirmá/i);
});

for (const n of [3, 4, 5, 10]) test(`Tutorial apropiado para escenario ${n}`, async t => {
  const { pagina: p } = await abrir(t, n);
  if (n === 3) { // La red del helper incluye una unidad existente: no repetir lo aprendido.
    assert.equal(await p.locator('.metronet-tutorial').isVisible(), false);
    await p.evaluate(() => {
      editorPrueba.disenoActual.simulacion.idDiseno = 88;
      editorPrueba.disenoActual.unidadesMetro = [];
      editorPrueba.actualizarAyuda();
    });
    assert.equal(await p.locator('.metronet-tutorial').getAttribute('data-paso'), 'metros');
  } else if (n === 4) assert.equal(await p.locator('.metronet-tutorial').getAttribute('data-paso'), 'simulacion');
  else assert.equal(await p.locator('.metronet-tutorial').isVisible(), false);
});

for (const width of [1440, 768, 390, 320]) test(`Tutorial a demanda y accesible en ${width}px`, async t => {
  const { pagina: p } = await abrir(t, 1, { viewport: { width, height: 900 } });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await p.locator('.metronet-tutorial').isVisible(), false);
  await p.locator('.metronet-hud>summary').click();
  await p.getByRole('button', {name:'Tutorial',exact:true}).focus();
  await p.keyboard.press('Enter');
  assert.equal(await p.locator('.metronet-tutorial').isVisible(), true);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await p.locator('[data-hud-tutorial]').evaluate(e=>getComputedStyle(e).animationName),'none');
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.metronet-tutorial').isVisible(), false);
});
