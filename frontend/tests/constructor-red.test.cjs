// Con Vite activo: node --test tests/constructor-red.test.cjs
// Playwright del entorno o METRONET_PLAYWRIGHT_PATH; METRONET_BROWSER_CHANNEL=chrome usa Chrome instalado.
// Ejecuta el editor y Phaser reales con respuestas REST simuladas, sin escribir en PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function preparar(t, opciones) {
  const resultado = await abrirEditor(navegador, opciones);
  t.after(() => resultado.contexto.close());
  return resultado;
}

async function herramienta(pagina, clave) {
  await pagina.locator(`[data-elegir-herramienta="${clave}"]`).click();
  assert.equal(await pagina.locator(`[data-elegir-herramienta="${clave}"]`).getAttribute('aria-pressed'), 'true');
  assert.equal(await pagina.locator('[data-panel-herramienta]:not([hidden])').count(), 1);
}

async function clicarMapa(pagina, posicionX, posicionY) {
  // La recarga del inspector puede cambiar el viewport después de recibir la API.
  await pagina.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const posicion = await pagina.evaluate(({ posicionX, posicionY }) => {
    const escena = editorPrueba.escena;
    const mundo = escena.capaRedMetro.convertirPosicion(posicionX, posicionY);
    const camara = escena.cameras.main;
    const mapa = document.querySelector('#metronet-mapa canvas').getBoundingClientRect();
    return { x: mapa.x + (mundo.x - camara.worldView.x) * camara.zoom, y: mapa.y + (mundo.y - camara.worldView.y) * camara.zoom };
  }, { posicionX, posicionY });
  await pagina.mouse.click(posicion.x, posicion.y);
}

async function esperarOperacion(pagina) {
  await pagina.waitForFunction(() => editorPrueba.modo === 'normal');
  await pagina.waitForFunction(() => editorPrueba.cambiosPendientes);
}

test('inicio: herramientas agrupadas, un solo panel y acciones de proyecto accesibles', async (t) => {
  const { pagina } = await preparar(t);
  assert.equal(await pagina.locator('[data-elegir-herramienta][aria-pressed="true"]').getAttribute('data-elegir-herramienta'), 'seleccion');
  assert.equal(await pagina.locator('[data-elemento-seleccionado]').isVisible(), false);
  assert.equal(await pagina.locator('[data-contenedor-consigna]').isVisible(), false);
  assert.equal(await pagina.locator('[data-guardar]').isVisible(), true);
  assert.equal(await pagina.locator('[data-ir-simulacion]').isDisabled(), false);
  assert.equal(await pagina.locator('[data-validar]').count(), 0);
  assert.equal(await pagina.locator('[data-elegir-herramienta] svg').count(), 6);
  assert.equal(await pagina.locator('[data-elegir-herramienta=transbordos]').count(), 0);
  for (const clave of ['estaciones', 'lineas', 'conexiones', 'metros', 'escenarios', 'seleccion']) {
    await herramienta(pagina, clave);
  }
  assert.equal(await pagina.locator('[data-selector-diseno]').count(), 0);
  assert.match(await pagina.locator('[data-resumen-diseno]').innerText(), /Red de prueba/);
  assert.equal(await pagina.locator('[data-crear-diseno]').count(), 0);
  assert.equal(await pagina.locator('[data-contenedor-selectores-mapa]').isVisible(), false);
  await pagina.locator('.metronet-poi>summary').click();
  await pagina.getByRole('button', {name:'Barrios / Zonas',exact:true}).click();
  assert.equal(await pagina.locator('[data-contenedor-selectores-mapa]').isVisible(), true);
});

test('cambios repetidos y cancelación limpian el modo y la selección temporal', async (t) => {
  const { pagina, solicitudes } = await preparar(t);
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    await herramienta(pagina, 'lineas');
    await clicarMapa(pagina, 580, 470);
    assert.equal(await pagina.evaluate(() => editorPrueba.estacionesSeleccionadas.length), 1);
    assert.match(await pagina.locator('.metronet-herramientas__ayuda').innerText(), /origen Centro/);
    await herramienta(pagina, 'estaciones');
    assert.deepEqual(await pagina.evaluate(() => [editorPrueba.modo, editorPrueba.capaRedMetro.modo, editorPrueba.estacionesSeleccionadas]), ['crearEstacion', 'crearEstacion', []]);
    if (vuelta % 2) await pagina.locator('[data-cancelar-herramienta]').click();
    else await pagina.keyboard.press('Escape');
    assert.equal(await pagina.evaluate(() => editorPrueba.modo), 'normal');
    assert.equal(await pagina.locator('[data-cancelar-herramienta]').isVisible(), false);
  }
  assert.equal(solicitudes.length, 0);
});

test('crear estaciones, líneas y conexiones directamente conserva contratos y herramienta activa', async (t) => {
  const { pagina, solicitudes } = await preparar(t);
  await herramienta(pagina, 'estaciones');
  assert.equal(await pagina.locator('[data-nombre-estacion]').count(), 0);
  await clicarMapa(pagina, 750, 500);
  await pagina.waitForFunction(() => editorPrueba.disenoActual.estaciones.some(e => e.nombre === 'Estación 01'));
  await pagina.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente);
  assert.equal(solicitudes[0].datos.nombre, 'Estación 01');
  assert.ok(Math.abs(solicitudes[0].datos.posicionX - 750) <= 1);
  assert.equal(await pagina.evaluate(() => editorPrueba.modo), 'crearEstacion');
  await clicarMapa(pagina, 760, 480);
  await pagina.waitForFunction(() => editorPrueba.disenoActual.estaciones.some(e => e.nombre === 'Estación 02'));
  await pagina.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente);
  await herramienta(pagina, 'lineas');
  await clicarMapa(pagina, 580, 470);
  assert.equal(solicitudes.length, 2);
  await clicarMapa(pagina, 810, 480);
  await pagina.waitForFunction(() => editorPrueba.disenoActual.lineas.some(l => l.nombre === 'Línea 01'));
  await pagina.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente);
  assert.deepEqual(solicitudes[2].datos, { nombre:'Línea 01', estaciones:['Centro','Este'] });
  assert.equal(await pagina.evaluate(() => editorPrueba.creacionDirecta.lineaActiva), 'Línea 01');
  await herramienta(pagina, 'conexiones');
  await pagina.locator('[data-linea-conexion]').selectOption('Azul');
  await clicarMapa(pagina, 700, 460);
  await clicarMapa(pagina, 810, 480);
  await pagina.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente && editorPrueba.disenoActual.tramos.length === 3);
  assert.deepEqual(solicitudes[3].datos, { nombreLinea:'Azul', estacionA:'Parque', estacionB:'Este' });
  assert.deepEqual(await pagina.evaluate(() => editorPrueba.estacionesSeleccionadas), ['Este']);
  await clicarMapa(pagina, 750, 500);
  await pagina.waitForFunction(() => editorPrueba.disenoActual.tramos.length === 4);
  assert.deepEqual(solicitudes[4].datos, { nombreLinea:'Azul', estacionA:'Este', estacionB:'Estación 01' });
});

test('selección contextual, edición de transbordo, reubicación y eliminación conservan sus acciones', async (t) => {
  const { pagina, solicitudes } = await preparar(t);
  await clicarMapa(pagina, 810, 480);
  assert.equal(await pagina.locator('[data-elemento-seleccionado]').isVisible(), true);
  assert.equal(await pagina.locator('[data-editar-estacion]').isVisible(), true);
  assert.equal(await pagina.locator('[data-nombre-estacion]').isVisible(), false);
  await pagina.locator('[data-editar-estacion]').click();
  await pagina.getByLabel('Nombre de la estación', { exact: true }).fill('Este nuevo');
  await pagina.getByLabel('Permite transbordo').check();
  await pagina.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await pagina.waitForFunction(() => editorPrueba.disenoActual.estaciones.some((e) => e.nombre === 'Este nuevo'));
  assert.equal(solicitudes[0].metodo, 'PATCH');
  assert.equal(solicitudes[0].datos.transbordo, true);
  await clicarMapa(pagina, 810, 480);
  await pagina.locator('[data-reubicar-estacion]').click();
  assert.match(await pagina.locator('.metronet-herramientas__ayuda').innerText(), /nueva posición/);
  await clicarMapa(pagina, 790, 490);
  await esperarOperacion(pagina);
  assert.equal(solicitudes[1].ruta, '/api/simulaciones/77/estaciones/Este%20nuevo');
  // El modo vuelve a normal antes del GET de recarga; esperar la posición persistida y su nuevo encuadre.
  await pagina.waitForFunction(() => editorPrueba.disenoActual.estaciones.some(e =>
    e.nombre === 'Este nuevo' && Math.abs(e.posicionX - 790) <= 1 && Math.abs(e.posicionY - 490) <= 1));
  await pagina.evaluate(() => new Promise(resolve => juegoPrueba.events.once('postrender', resolve)));
  await clicarMapa(pagina, 790, 490);
  await pagina.locator('[data-eliminar-estacion]').click();
  await pagina.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(solicitudes.length, 2);
  await pagina.locator('[data-eliminar-estacion]').click();
  await pagina.locator('[data-confirmar-eliminar]').click();
  await pagina.waitForFunction(() => !editorPrueba.disenoActual.estaciones.some((e) => e.nombre === 'Este nuevo'));
  assert.equal(solicitudes[2].metodo, 'DELETE');
  assert.equal(await pagina.locator('[data-elemento-seleccionado]').isVisible(), false);
});

test('líneas y unidades mantienen selección, edición, eliminación y acceso a guardado y validación', async (t) => {
  const { pagina, solicitudes } = await preparar(t);
  await herramienta(pagina, 'lineas');
  await pagina.locator('[data-seleccionar-linea-directa="Azul"]').click();
  assert.equal(await pagina.locator('[data-editar-linea]').isVisible(), true);
  assert.equal(await pagina.locator('[data-eliminar-linea]').isVisible(), true);
  await pagina.locator('[data-quitar-seleccion]').click();
  assert.equal(await pagina.locator('[data-elemento-seleccionado]').isVisible(), false);
  await herramienta(pagina, 'metros');
  await pagina.locator('[data-seleccionar-unidad="1"]').click();
  assert.equal(await pagina.locator('[data-editar-unidad]').isVisible(), true);
  assert.equal(await pagina.locator('[data-eliminar-unidad]').isVisible(), true);
  await herramienta(pagina, 'metros');
  await clicarMapa(pagina, 640, 465);
  await pagina.waitForFunction(() => editorPrueba.disenoActual.unidadesMetro.length === 2);
  await pagina.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente);
  assert.deepEqual(solicitudes[0].datos, { nombreLinea:'Azul', capacidad:300, velocidadPromedio:4 });
  await pagina.locator('[data-guardar]').click();
  await pagina.waitForFunction(() => !editorPrueba.finalizacionEnCurso && !editorPrueba.cambiosPendientes);
  assert.deepEqual(solicitudes.slice(1).map(s => s.ruta), ['/api/simulaciones/77/validacion', '/api/simulaciones/77/guardar']);
  assert.equal(await pagina.locator('[data-ir-simulacion]').isEnabled(), true);
});

test('las herramientas no habilitadas por el nivel permanecen deshabilitadas', async (t) => {
  const escenario = { idEscenario: 41, numero: 1, nombre: 'Nivel 1', estado: 'EN_DESARROLLO', desbloqueado: true, progreso: 0, objetivo: 'Creá una red', instrucciones: 'Ubicá estaciones', herramientasHabilitadas: { estaciones: true, lineas: true, conexiones: false, metros: false, simulacion: false } };
  const { pagina } = await preparar(t, { escenario });
  assert.equal(await pagina.locator('[data-elegir-herramienta="conexiones"]').isDisabled(), true);
  assert.equal(await pagina.locator('[data-elegir-herramienta="metros"]').isDisabled(), true);
  assert.equal(await pagina.locator('[data-elegir-herramienta="escenarios"]').isVisible(), false);
  assert.equal(await pagina.locator('[data-eliminar-diseno]').isVisible(), false);
  await clicarMapa(pagina, 810, 480);
  assert.equal(await pagina.locator('[data-editar-estacion]').count(), 1);
  assert.equal(await pagina.locator('[data-ir-simulacion]').isDisabled(), true);
  assert.equal(await pagina.locator('[data-quitar-seleccion]').isVisible(), true);
});

for (const [tipo, coleccion, respuestas, rutaEsperada] of [
  ['linea', 'lineas', ['Violeta'], '/api/simulaciones/77/lineas/Azul'],
  ['tramo', 'tramos', ['Azul', 'Centro', 'Este'], '/api/simulaciones/77/tramos'],
  ['unidad', 'unidadesMetro', ['Azul', '60'], '/api/simulaciones/77/unidades/1'],
]) {
  test(`acciones contextuales de ${tipo}: modificar y eliminar mantienen los contratos existentes`, async (t) => {
    const { pagina, solicitudes } = await preparar(t);
    const seleccionar = () => pagina.evaluate(({ tipo, coleccion }) => {
      editorPrueba.seleccionarElemento({ tipo, valor: editorPrueba.disenoActual[coleccion][0] });
    }, { tipo, coleccion });
    await seleccionar();
    await pagina.locator(`[data-editar-${tipo}]`).click();
    if (tipo === 'unidad') assert.equal(await pagina.locator('[data-editar-elemento]').getByLabel('Capacidad', { exact: true }).count(), 0);
    for (const [indice, respuesta] of respuestas.entries()) {
      const campo = pagina.locator('[data-editar-elemento] input, [data-editar-elemento] select').nth(indice);
      if (await campo.evaluate(e => e.tagName === 'SELECT')) await campo.selectOption(respuesta);
      else await campo.fill(respuesta);
    }
    assert.equal(await pagina.locator('dialog[open]').count(), 0);
    await pagina.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await pagina.waitForFunction((tipo) => {
      const diseno = editorPrueba.disenoActual;
      return tipo === 'linea' ? diseno.lineas[0].nombre === 'Violeta'
        : tipo === 'tramo' ? diseno.tramos[0].estacionB === 'Este'
          : diseno.unidadesMetro[0].velocidadPromedio === 60;
    }, tipo);
    assert.equal(solicitudes[0].metodo, 'PATCH');
    assert.equal(solicitudes[0].ruta, rutaEsperada);
    if (tipo === 'linea') assert.deepEqual(solicitudes[0].datos, { nombre: 'Violeta' });
    if (tipo === 'tramo') assert.deepEqual(solicitudes[0].datos, { nombreLinea: 'Azul', estacionA: 'Centro', estacionB: 'Este' });
    if (tipo === 'unidad') {
      assert.deepEqual(solicitudes[0].datos, { nombreLinea: 'Azul', capacidad: 300, velocidadPromedio: 60 });
      assert.equal(await pagina.evaluate(() => editorPrueba.disenoActual.unidadesMetro[0].capacidad), 300);
    }
    await seleccionar();
    await pagina.locator(`[data-eliminar-${tipo}]`).click();
    await pagina.locator('[data-confirmar-eliminar]').click();
    await pagina.waitForFunction((coleccion) => editorPrueba.disenoActual[coleccion].length === 0, coleccion);
    assert.equal(solicitudes[1].metodo, 'DELETE');
    assert.equal(await pagina.locator('[data-elemento-seleccionado]').isVisible(), false);
  });
}

test('unidad histórica conserva capacidad al editar UV y recargar el diseño', async t => {
  const { pagina, solicitudes, diseno } = await preparar(t);
  diseno.unidadesMetro[0].capacidad = 450;
  await pagina.reload();
  await pagina.waitForFunction(() => window.juegoPrueba?.scene?.getScene('MapaScene')?.editorRedMetro?.disenoActual?.unidadesMetro?.[0]?.capacidad === 450);
  await pagina.evaluate(() => {
    window.editorPrueba = juegoPrueba.scene.getScene('MapaScene').editorRedMetro;
    editorPrueba.seleccionarElemento({ tipo: 'unidad', valor: editorPrueba.disenoActual.unidadesMetro[0] });
  });
  await pagina.locator('[data-editar-unidad]').click();
  assert.equal(await pagina.locator('[data-editar-elemento]').getByLabel('Capacidad', { exact: true }).count(), 0);
  await pagina.locator('[data-editar-elemento]').getByLabel('Velocidad promedio (UV)', { exact: true }).fill('55');
  await pagina.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await pagina.waitForFunction(() => editorPrueba.disenoActual.unidadesMetro[0].velocidadPromedio === 55);
  assert.deepEqual(solicitudes.at(-1).datos, { nombreLinea: 'Azul', capacidad: 450, velocidadPromedio: 55 });
  await pagina.reload();
  await pagina.waitForFunction(() => window.juegoPrueba?.scene?.getScene('MapaScene')?.editorRedMetro?.disenoActual?.unidadesMetro?.[0]?.velocidadPromedio === 55);
  assert.equal(await pagina.evaluate(() => {
    const unidad = juegoPrueba.scene.getScene('MapaScene').editorRedMetro.disenoActual.unidadesMetro[0];
    return unidad.capacidad;
  }), 450);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 375, height: 667 }]) {
  test(`distribución sin desbordes ni superposición del panel y el mapa: ${viewport.width}px`, async (t) => {
    const { pagina } = await preparar(t, { viewport });
    if (viewport.width <= 620) await pagina.locator('[data-panel-edicion-toggle]').click();
    for (const clave of ['seleccion', 'estaciones', 'lineas', 'metros', 'escenarios']) {
      await herramienta(pagina, clave);
      const medidas = await pagina.evaluate(() => {
        const mapa = document.getElementById('metronet-mapa').getBoundingClientRect();
        const panel = document.getElementById('metronet-panel-controles').getBoundingClientRect();
        return {
          desborde: document.documentElement.scrollWidth > innerWidth,
          superposicion: mapa.right > panel.left && mapa.left < panel.right && mapa.bottom > panel.top && mapa.top < panel.bottom,
          cortados: [...document.querySelectorAll('.metronet-herramientas button, .metronet-herramientas input, .metronet-herramientas select')].filter((e) => e.checkVisibility()).some((e) => e.getBoundingClientRect().right > panel.right || e.getBoundingClientRect().left < panel.left),
        };
      });
      assert.deepEqual(medidas, { desborde: false, superposicion: false, cortados: false }, clave);
    }
  });
}
