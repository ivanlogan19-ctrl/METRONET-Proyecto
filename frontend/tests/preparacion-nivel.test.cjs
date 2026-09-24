// Pruebas de navegador con API simulada; no escriben en PostgreSQL.
// Con Vite activo: node --test tests/preparacion-nivel.test.cjs
// Usa Playwright del entorno (o METRONET_PLAYWRIGHT_PATH), sin dependencias de producción nuevas.
// METRONET_BROWSER_CHANNEL=chrome permite usar Chrome ya instalado.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');

const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
const nombres = ['Red inicial', 'Conexiones', 'Unidades de metro', 'Simulación completa'];
const conceptos = ['Líneas y estaciones', 'Conexiones y recorridos', 'Unidades de metro', 'Cobertura y simulación'];
let navegador;

before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

function nivel(numero, estado = 'DISPONIBLE') {
  return {
    idEscenario: 40 + (numero ?? 5), numero,
    nombre: numero === null ? 'Modo Libre' : `Nivel ${numero} · ${nombres[numero - 1] || 'Sin introducción'}`,
    objetivo: 'Consigna recibida del servidor.', instrucciones: 'Instrucciones del escenario.',
    dificultad: 'Inicial', estado, desbloqueado: estado !== 'BLOQUEADO',
    progreso: estado === 'COMPLETADO' ? 100 : 0, herramientasHabilitadas: {},
    cantidadIntentos: 0, completadoEnCampanaActual: estado === 'COMPLETADO',
  };
}

async function abrir(t, escenarios, ruta = '/escenarios.html', opciones = {}) {
  const contexto = await navegador.newContext({ viewport: opciones.viewport || { width: 1280, height: 900 } });
  t.after(() => contexto.close());
  await contexto.addInitScript(() => {
    localStorage.setItem('sesionUsuario', JSON.stringify({ token: 'prueba-local', usuario: { nombre: 'Prueba', rol: 'JUGADOR' } }));
  });
  const pagina = await contexto.newPage();
  const solicitudes = [];
  await pagina.route('**/api/juego/**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      solicitudes.push({ ruta: new URL(request.url()).pathname, autorizacion: request.headers().authorization });
      if (opciones.errorApi) return route.fulfill({ status: 403, json: { detail: 'El escenario está bloqueado.' } });
      const idEscenario = Number(new URL(request.url()).pathname.split('/').at(-2));
      return route.fulfill({ json: { idEscenario, idDiseno: 101, idIntento: 202, estado: 'EN_DESARROLLO' } });
    }
    await route.fulfill({ json: {
      escenarios, numeroCampanaActual: 1, cantidadNiveles: escenarios.filter((e) => e.numero !== null).length,
      nivelesCompletados: escenarios.filter((e) => e.estado === 'COMPLETADO').length,
      modoLibreDesbloqueado: true, campanaCompletada: false, campanaCompletadaHistoricamente: true,
    } });
  });
  // La llegada al mapa comprueba el contrato de navegación sin cargar Phaser ni una base real.
  await pagina.route(`${BASE}/?*`, (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Mapa de prueba</h1>' }));
  await pagina.route(`${BASE}/__prueba-editor`, (route) => route.fulfill({
    contentType: 'text/html', body: '<link rel="stylesheet" href="/src/estilos/metronet.css"><main></main>',
  }));
  if (opciones.falloModulo) await pagina.route('**/educacion/PantallaPreparacionNivel.js*', (route) => route.abort());
  if (opciones.falloRender) await pagina.addInitScript(() => {
    HTMLDialogElement.prototype.showModal = () => { throw new Error('Fallo exclusivo de introducción'); };
  });
  await pagina.goto(`${BASE}${ruta}`);
  return { pagina, solicitudes };
}

async function comprobarDestino(pagina, escenario) {
  await pagina.waitForURL(`${BASE}/?idDiseno=101&idEscenario=${escenario.idEscenario}&idIntento=202`);
}

for (const ruta of ['/escenarios.html', '/inicio.html']) {
  test(`${ruta}: presenta cada nivel antes del POST y conserva su destino`, async (t) => {
    for (let numero = 1; numero <= 4; numero += 1) {
      await t.test(`nivel ${numero}`, async (t) => {
        const escenario = nivel(numero);
        const { pagina, solicitudes } = await abrir(t, [escenario], ruta);
        await pagina.getByRole('button', { name: ruta === '/inicio.html' ? 'Comenzar escenario' : 'Comenzar', exact: true }).click();
        const dialogo = pagina.getByRole('dialog', { name: escenario.nombre });
        await dialogo.waitFor();
        assert.match(await dialogo.innerText(), new RegExp(conceptos[numero - 1]));
        assert.equal(solicitudes.length, 0);
        assert.equal(await dialogo.getByRole('progressbar').count(), 0);
        assert.equal(await dialogo.getByRole('button', { name: 'Comenzar nivel' }).isEnabled(), true);
        await dialogo.getByRole('button', { name: 'Comenzar nivel' }).click();
        await comprobarDestino(pagina, escenario);
        assert.deepEqual(solicitudes, [{ ruta: `/api/juego/escenarios/${escenario.idEscenario}/iniciar`, autorizacion: 'Bearer prueba-local' }]);
      });
    }
  });
}

test('volver, Escape y reingreso no crean intentos ni dejan diálogos o bloqueos', async (t) => {
  const escenario = nivel(1);
  const { pagina, solicitudes } = await abrir(t, [escenario]);
  const abrirNivel = pagina.getByRole('button', { name: 'Comenzar', exact: true });
  for (const accion of ['volver', 'escape', 'comenzar']) {
    await abrirNivel.dblclick();
    const dialogo = pagina.getByRole('dialog', { name: escenario.nombre });
    await dialogo.waitFor();
    assert.equal(await pagina.locator('.metronet-preparacion').count(), 1);
    assert.equal(solicitudes.length, 0);
    if (accion === 'comenzar') {
      await dialogo.getByRole('button', { name: 'Comenzar nivel' }).click();
    } else {
      if (accion === 'volver') await dialogo.getByRole('button', { name: 'Volver', exact: true }).click();
      else await pagina.keyboard.press('Escape');
      await pagina.locator('.metronet-preparacion').waitFor({ state: 'detached' });
      assert.equal(await abrirNivel.isEnabled(), true);
      assert.equal(await abrirNivel.evaluate((elemento) => elemento === document.activeElement), true);
    }
  }
  await comprobarDestino(pagina, escenario);
  assert.equal(solicitudes.length, 1);
});

for (const [estado, accion, endpoint] of [
  ['EN_DESARROLLO', 'Continuar', 'iniciar'], ['COMPLETADO', 'Volver a jugar', 'volver-a-jugar'],
]) {
  test(`${accion} conserva la operación existente después de la introducción`, async (t) => {
    const escenario = nivel(2, estado);
    const { pagina, solicitudes } = await abrir(t, [escenario]);
    await pagina.getByRole('button', { name: accion, exact: true }).click();
    await pagina.getByRole('button', { name: 'Comenzar nivel' }).click();
    await comprobarDestino(pagina, escenario);
    assert.equal(solicitudes[0].ruta, `/api/juego/escenarios/${escenario.idEscenario}/${endpoint}`);
  });
}

for (const numero of [99, null]) {
  test(`sin contenido (${numero ?? 'Modo Libre'}) inicia directamente`, async (t) => {
    const escenario = nivel(numero);
    const { pagina, solicitudes } = await abrir(t, [escenario]);
    await pagina.getByRole('button', { name: numero === null ? 'Entrar al Modo Libre' : 'Comenzar', exact: true }).click();
    await comprobarDestino(pagina, escenario);
    assert.equal(solicitudes.length, 1);
  });
}

for (const fallo of ['falloModulo', 'falloRender']) {
  test(`${fallo}: un error exclusivo de la introducción no bloquea el escenario`, async (t) => {
    const escenario = nivel(1);
    const { pagina, solicitudes } = await abrir(t, [escenario], '/escenarios.html', { [fallo]: true });
    await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await comprobarDestino(pagina, escenario);
    assert.equal(solicitudes.length, 1);
  });
}

test('los niveles bloqueados y los errores de backend conservan sus restricciones', async (t) => {
  const { pagina, solicitudes } = await abrir(t, [nivel(1), nivel(2, 'BLOQUEADO')], '/escenarios.html', { errorApi: true });
  assert.equal(await pagina.getByRole('button', { name: 'Bloqueado', exact: true }).isDisabled(), true);
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await pagina.getByRole('button', { name: 'Comenzar nivel' }).click();
  await pagina.getByText('El escenario está bloqueado.', { exact: true }).waitFor();
  assert.equal(new URL(pagina.url()).pathname, '/escenarios.html');
  assert.equal(await pagina.getByRole('button', { name: 'Comenzar', exact: true }).isEnabled(), true);
  assert.equal(solicitudes.length, 1);
});

test('editor: progresión y repetición mantienen IDs, carga del diseño y exclusión de doble inicio', async (t) => {
  const escenarios = [nivel(1, 'COMPLETADO'), nivel(2)];
  const { pagina, solicitudes } = await abrir(t, escenarios, '/__prueba-editor');
  await pagina.evaluate(async (escenarios) => {
    const { default: Editor } = await import('/src/mapa/controles/EditorRedMetro.js');
    window.editorPrueba = new Editor(null);
    editorPrueba.escenariosJuego = escenarios;
    editorPrueba.cambiosPendientes = true;
    editorPrueba.cargarJuego = async () => {};
    editorPrueba.cargarDisenos = async (id) => { window.disenoAbierto = id; };
    editorPrueba.mostrarMensaje = () => {};
    const siguiente = editorPrueba.obtenerSiguienteEscenarioDesbloqueado(escenarios[0]);
    document.querySelector('main').append(editorPrueba.crearAccionContinuarEscenario(siguiente));
  }, escenarios);
  await pagina.getByRole('button', { name: 'Continuar con Nivel 2' }).dblclick();
  await pagina.getByRole('dialog', { name: 'Nivel completado', exact: true }).waitFor();
  assert.equal(solicitudes.length, 0);
  assert.equal(await pagina.evaluate(() => editorPrueba.cambiosPendientes), true);
  await pagina.getByRole('button', { name: 'Revisar mi red', exact: true }).click();
  await pagina.waitForFunction(() => !editorPrueba.aperturaEscenarioEnCurso);
  assert.equal(await pagina.evaluate(() => editorPrueba.cambiosPendientes), true);
  await pagina.getByRole('button', { name: 'Continuar con Nivel 2' }).click();
  await pagina.locator('[data-continuar-transicion]').click();
  await pagina.waitForFunction(() => window.disenoAbierto === 101 && !editorPrueba.aperturaEscenarioEnCurso);
  assert.equal(new URL(pagina.url()).searchParams.get('idEscenario'), '42');
  assert.equal(await pagina.evaluate(() => editorPrueba.cambiosPendientes), false);
  await pagina.evaluate(() => { void editorPrueba.volverAJugar(41); });
  await pagina.getByRole('dialog', { name: escenarios[0].nombre }).waitFor();
  await pagina.getByRole('button', { name: 'Comenzar nivel' }).click();
  await pagina.waitForFunction(() => !editorPrueba.aperturaEscenarioEnCurso);
  assert.deepEqual(solicitudes.map((s) => s.ruta), ['/api/juego/escenarios/42/iniciar', '/api/juego/escenarios/41/volver-a-jugar']);
});

test('pantalla móvil: contenido legible, teclado y acciones dentro del diálogo', async (t) => {
  const { pagina } = await abrir(t, [nivel(4)], '/escenarios.html', { viewport: { width: 375, height: 667 } });
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await pagina.getByRole('dialog', { name: nivel(4).nombre }).waitFor();
  const medidas = await pagina.locator('.metronet-preparacion').evaluate((dialogo) => ({
    ancho: dialogo.getBoundingClientRect().width, alto: dialogo.getBoundingClientRect().height,
    desbordeHorizontal: dialogo.scrollWidth > dialogo.clientWidth,
    foco: document.activeElement.textContent,
  }));
  assert.ok(medidas.ancho <= 375 && medidas.alto <= 667);
  assert.equal(medidas.desbordeHorizontal, false);
  assert.equal(medidas.foco, 'Comenzar nivel');
  await pagina.keyboard.press('Shift+Tab');
  assert.equal(await pagina.evaluate(() => document.activeElement.textContent), 'Volver');
  await pagina.keyboard.press('Enter');
  await pagina.locator('.metronet-preparacion').waitFor({ state: 'detached' });
});
