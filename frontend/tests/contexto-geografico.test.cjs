const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

test('El contorno resaltado sigue el mapa barrial vigente, sin un segundo límite desplazado', () => {
  const carpeta = path.join(__dirname, '../src/mapa/datos');
  const fuente = fs.readFileSync(path.join(carpeta, 'barrios_wgs84.geojson'));
  const contexto = JSON.parse(fs.readFileSync(path.join(carpeta, 'departamentos-contexto.geojson')));
  assert.equal(contexto.fuente.contornoMontevideo.sha256, createHash('sha256').update(fuente).digest('hex'));
  const segmentos = JSON.parse(fuente).features.flatMap(f => f.geometry.coordinates.flatMap(
    anillo => anillo.slice(1).map((b, i) => [anillo[i], b])));
  const anillo = contexto.features.find(f => f.properties.DEPTO === 'MONTEVIDEO').geometry.coordinates[0];
  const distancia = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  for (let i = 0; i < anillo.length; i += Math.ceil(anillo.length / 128)) {
    assert.ok(segmentos.some(([a, b]) => distancia(anillo[i], a, b) < 0.0000001),
      `El vértice ${i} debe pertenecer al borde del mapa existente`);
  }
});

test('Modo libre: alejar y girar conserva el entorno real sin ampliar el territorio construible', async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  const v = await abrirEditor(navegador, { modo: 'EDICION_LIBRE', primeraPasada: false,
    viewport: { width: 1470, height: 800 } });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  await p.getByRole('button', { name: 'Ir a construir', exact: true }).click();
  await p.waitForFunction(() => editorPrueba.escena.capaContextoGeografico?.datos);
  const estado = await p.evaluate(() => {
    const e = editorPrueba.escena, capa = e.capaContextoGeografico;
    e.controlZoom.establecerZoom(0.01);
    e.controlZoom.girarMapa(Math.PI / 4);
    const geo = e.capaBarrios.transformacion;
    const posicion = ([x, y]) => ({ posicionX: (x - geo.minX) / (geo.maxX - geo.minX) * 1000,
      posicionY: (geo.maxY - y) / (geo.maxY - geo.minY) * 620 });
    return { zoom: e.cameras.main.zoom, rotacion: e.cameras.main.rotation,
      fondo: e.cameras.main.backgroundColor.alpha, baseVisible: e.capaMapaBase.grafico.visible,
      departamentos: capa.datos.features.map(f => f.properties.DEPTO),
      fuera: [[-56.4, -34.6], [-56.1, -34.7]].map(p => e.territorioMapa.errorEstacion(posicion(p))),
      dentro: e.territorioMapa.errorEstacion({ posicionX: 750, posicionY: 500 }),
      elementos: capa.contenedor.list.map(objeto => [objeto.scrollFactorX, objeto.scrollFactorY]),
    };
  });
  assert.ok(estado.zoom < 0.8, 'El alejamiento permite ver territorio circundante');
  assert.ok(Math.abs(estado.rotacion - Math.PI / 4) < 1e-10);
  assert.equal(estado.fondo, 255, 'El agua cubre todo el visor incluso al girar');
  assert.equal(estado.baseVisible, false, 'No queda el rectángulo oscuro anterior sobre la geografía');
  for (const nombre of ['CANELONES', 'SAN JOSÉ']) assert.equal(estado.departamentos.filter(n => n === nombre).length, 1);
  assert.ok(estado.fuera.every(Boolean), 'Los departamentos vecinos no habilitan construcción');
  assert.equal(estado.dentro, null);
  assert.ok(estado.elementos.length > 0 && estado.elementos.every(([x, y]) => x === 1 && y === 1));
  await p.screenshot({ path: '/tmp/metronet-contexto-girado.png' });
  await p.evaluate(() => editorPrueba.escena.controlZoom.restaurar());
  await p.screenshot({ path: '/tmp/metronet-contexto-normal.png' });
  await p.locator('.metronet-tutorial > summary').click();
  await p.locator('.metronet-tutorial__repetir').click();
  const tutorial = p.locator('.metronet-recorrido');
  for (let i = 0; await tutorial.locator('h2').textContent() !== 'Mapa de la red' && i < 20; i++) {
    await tutorial.getByRole('button', { name: 'Siguiente', exact: true }).click();
  }
  assert.match(await tutorial.innerText(), /Montevideo es el área donde podés construir/);
  assert.match(await tutorial.innerText(), /al girar, el mapa y tu red se mueven juntos/);
  await p.screenshot({ path: '/tmp/metronet-tutorial-contexto.png' });
  await tutorial.getByRole('button', { name: 'Salir del tutorial', exact: true }).click();
  await p.locator('[data-elegir-herramienta="estaciones"]').click();
  const fuera = await p.evaluate(() => {
    const e = editorPrueba.escena, c = e.cameras.main;
    const mundo = e.capaBarrios.convertirCoordenada([-56.1, -34.7], e.capaBarrios.calcularEscalaMapa());
    const pantalla = c.matrix.transformPoint(mundo.x - c.scrollX, mundo.y - c.scrollY);
    const rectangulo = e.game.canvas.getBoundingClientRect();
    return { x: rectangulo.x + pantalla.x, y: rectangulo.y + pantalla.y };
  });
  const guardados = v.solicitudes.length;
  await p.mouse.click(fuera.x, fuera.y);
  await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(v.solicitudes.length, guardados, 'Un clic sobre Canelones no intenta guardar una estación');

  // La misma escena real de simulación permite comprobar la vuelta a un nivel.
  await p.route('**/src/simulacion/EscenaSimulacion.js*', async ruta => {
    const respuesta = await ruta.fetch();
    await ruta.fulfill({ response: respuesta, body: (await respuesta.text())
      .replace('resolver({ escena: this, destruir });', 'window.escenaPrueba = this; resolver({ escena: this, destruir });') });
  });
  v.diseno.preparadoParaSimular = true;
  v.diseno.simulacion.estado = 'VALIDADO';
  await p.goto(new URL('/simulacion.html?idDiseno=77', p.url()).href);
  await p.getByRole('button', { name: 'Continuar', exact: true }).click();
  await p.waitForFunction(() => window.escenaPrueba?.capaContextoGeografico?.datos);
  for (const dimensiones of [{ width: 1470, height: 800 }, { width: 1280, height: 900 }]) {
    await p.setViewportSize(dimensiones);
    await p.evaluate(() => {
      escenaPrueba.controlZoom.restaurar();
      escenaPrueba.controlZoom.girarMapa(Math.PI / 4);
    });
    const colores = await p.evaluate(async () => {
      const e = escenaPrueba;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const puntos = [[3, 3], [e.scale.width - 4, 3], [3, e.scale.height - 4], [e.scale.width - 4, e.scale.height - 4]];
      const colores = [];
      for (const [x, y] of puntos) colores.push(await new Promise(resolve =>
        e.game.renderer.snapshotPixel(x, y, color => resolve([color.r, color.g, color.b]))));
      return colores;
    });
    assert.ok(colores.every(([r, g, b]) => r + g + b > 50), 'Ninguna esquina queda negra al alejar y rotar');
  }
  await p.screenshot({ path: '/tmp/metronet-contexto-simulacion.png' });
  const nivel = await p.evaluate(() => {
    const e = escenaPrueba;
    e.establecerDiseno({ ...e.disenoActual, simulacion: { ...e.disenoActual.simulacion, modo: 'NIVEL', idEscenario: 42 } });
    return { entorno: e.capaContextoGeografico.contenedor.visible,
      base: e.capaMapaBase.grafico.visible, zoom: e.controlZoom.zoomMinimo };
  });
  assert.deepEqual(nivel, { entorno: false, base: true, zoom: 0.8 }, 'Un nivel recupera su fondo y zoom originales');
  assert.deepEqual(v.errores, []);
});

test('Un nivel no descarga ni muestra la cartografía exterior', async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  const v = await abrirEditor(navegador, { modo: 'NIVEL', primeraPasada: false,
    escenario: { idEscenario: 42, numero: 2, nombre: 'Red inicial', herramientasHabilitadas: {} } });
  t.after(() => v.contexto.close());
  const estado = await v.pagina.evaluate(() => ({
    visible: editorPrueba.escena.capaContextoGeografico.contenedor.visible,
    descargas: performance.getEntriesByType('resource').filter(r => r.name.includes('departamentos-contexto')).length,
    zoom: editorPrueba.escena.controlZoom.zoomMinimo,
  }));
  assert.deepEqual(estado, { visible: false, descargas: 0, zoom: 1 });
  assert.deepEqual(v.errores, []);
});
