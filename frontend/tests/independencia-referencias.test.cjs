// Comprueba la unión real de representaciones Phaser, no solo el estado de los botones.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const CATEGORIAS = ['POI', 'ESPACIOS_VERDES', 'INFRAESTRUCTURA', 'AGUA'];
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function abrir(t, opciones = {}) {
  const vista = await abrirEditor(navegador, { estaciones: [], tramos: [], ...opciones });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.waitForFunction(() => !document.querySelector('.metronet-estado-editor__mensaje [role="status"]')?.textContent);
  await vista.pagina.evaluate(async () => {
    const { obtenerCategoriaReferencia: categoria } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
    window.poi = editorPrueba.escena.capaPuntosInteres;
    const objetos = new WeakMap(); let siguiente = 0;
    const identidad = objeto => { if (!objetos.has(objeto)) objetos.set(objeto, ++siguiente); return objetos.get(objeto); };
    const huella = valores => JSON.stringify(valores).split('').reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 0);
    window.capturarCapas = () => ({
      puntos: poi.representaciones.filter(r => r.contenedor.visible).map(r => ({
        id: r.punto.id, categoria: categoria(r.punto), x: r.contenedor.x, y: r.contenedor.y,
        color: poi.obtenerColorMarcador(r.punto), forma: poi.obtenerFormaMarcador(r.punto),
        grafico: huella(r.contenedor.list[0].commandBuffer), objeto: identidad(r.contenedor),
        grupo: r.contenedor.name, interaccion: identidad(r.areaInteraccion),
        listeners: r.areaInteraccion.listenerCount('pointerdown'),
        etiqueta: r.etiqueta ? { x: r.etiqueta.x, y: r.etiqueta.y, visible: r.etiqueta.visible, texto: r.etiqueta.list[1].text } : null,
      })).sort((a,b) => a.id - b.id),
      barrios: editorPrueba.escena.capaBarrios.graficos.map(r => ({ nombre: r.barrio.nombre, grafico: huella(r.grafico.commandBuffer), objeto: identidad(r.grafico) })),
      indicadores: [...document.querySelectorAll('.metronet-capas-activas > span')].filter(e => !e.hidden).map(e => e.dataset.categoria).sort(),
      objetos: poi.escena.children.list.length,
      listeners: poi.escena.events.listenerCount('update'),
      camara: [poi.escena.cameras.main.scrollX, poi.escena.cameras.main.scrollY, poi.obtenerZoomActual()],
    });
  });
  return vista;
}
async function cuadros(p) { await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }

for (const vista of ['inicial', 'acercada', 'desplazada', 'restaurada']) test(`Capas aditivas: las 16 combinaciones conservan marcadores, objetos y estilos / ${vista}`, async t => {
  const { pagina: p, solicitudes } = await abrir(t);
  if (vista !== 'inicial') {
    await p.evaluate(vista => {
      const c = poi.escena.cameras.main;
      const centro = poi.escena.capaRedMetro.convertirPosicion(vista === 'desplazada' ? 500 : 700, 470);
      c.setZoom(3).centerOn(centro.x, centro.y);
    }, vista);
    await cuadros(p);
    if (vista === 'restaurada') { await p.locator('.metronet-control-zoom-restaurar').click(); await cuadros(p); }
  }
  const resultado = await p.evaluate(categorias => {
    const individuales = categorias.map(c => { poi.establecerCategoriasVisibles([c]); return capturarCapas(); });
    const combinaciones = Array.from({ length: 16 }, (_, mascara) => {
      const activas = categorias.filter((_, i) => mascara & (1 << i));
      poi.establecerCategoriasVisibles(activas);
      return { activas, estado: capturarCapas() };
    });
    return { individuales, combinaciones };
  }, CATEGORIAS);
  for (const { activas, estado } of resultado.combinaciones) {
    const esperado = resultado.individuales.flatMap((e,i) => activas.includes(CATEGORIAS[i]) ? e.puntos : []).sort((a,b) => a.id - b.id);
    assert.deepEqual(estado.puntos, esperado, `Unión exacta para ${activas.join(' + ') || 'ninguna'}`);
    assert.deepEqual(estado.indicadores, [...activas].sort());
    assert.deepEqual(estado.barrios, resultado.individuales[0].barrios);
    assert.deepEqual(estado.camara, resultado.individuales[0].camara);
    assert.equal(estado.objetos, resultado.individuales[0].objetos);
    assert.equal(estado.listeners, resultado.individuales[0].listeners);
  }
  assert.deepEqual(solicitudes, []);
});

test('Toggles por UI: distintos órdenes y repeticiones no reconstruyen capas ajenas ni duplican indicadores', async t => {
  const { pagina: p } = await abrir(t);
  await p.evaluate(() => poi.establecerCategoriasVisibles([]));
  let referencia;
  for (const orden of [CATEGORIAS, [...CATEGORIAS].reverse(), ['ESPACIOS_VERDES','AGUA','POI','INFRAESTRUCTURA']]) {
    for (const c of orden) await p.locator(`.metronet-referencias-controles [data-categoria="${c}"]`).click();
    const estado = await p.evaluate(() => capturarCapas());
    if (referencia) assert.deepEqual(estado, referencia);
    else referencia = estado;
    for (const c of [...orden].reverse()) {
      const anteriores = (await p.evaluate(() => capturarCapas())).puntos.filter(p => p.categoria !== c);
      await p.locator(`.metronet-referencias-controles [data-categoria="${c}"]`).click();
      assert.deepEqual((await p.evaluate(() => capturarCapas())).puntos, anteriores);
    }
    assert.equal(await p.locator('.metronet-capas-activas > span').count(), 4);
    assert.equal(await p.locator('.metronet-capas-activas > span:visible').count(), 0);
  }
});

test('Buscar, seleccionar y cerrar POI conserva las otras categorías y sus objetivos', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { objetivos: [{ idPunto: 85, radioCobertura: 60 }] });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  for (const activas of [CATEGORIAS, ['ESPACIOS_VERDES','INFRAESTRUCTURA','AGUA'], ['POI','AGUA'], ['POI','ESPACIOS_VERDES']]) {
    await p.evaluate(c => poi.establecerCategoriasVisibles(c), activas);
    const antes = await p.evaluate(() => capturarCapas());
    await p.getByRole('button', { name: 'Abrir buscador POI' }).click();
    await p.getByRole('searchbox', { name: 'Buscar POI' }).fill('Palacio Legislativo');
    await p.locator('.metronet-panel-puntos-lista button').first().click();
    await p.getByRole('dialog', { name: 'Información de Palacio Legislativo' }).waitFor();
    // La búsqueda enfoca legítimamente el POI; comparar con la misma cámara aísla el estado de capas.
    await p.evaluate(([x,y,z]) => { const c = poi.escena.cameras.main; c.panEffect.reset(); c.setZoom(z).setScroll(x,y); }, antes.camara);
    await cuadros(p);
    await p.evaluate(() => poi.actualizarVisibilidad());
    let despues = await p.evaluate(() => capturarCapas());
    assert.deepEqual(despues.puntos.filter(r => r.categoria !== 'POI'), antes.puntos.filter(r => r.categoria !== 'POI'));
    assert.deepEqual(despues.indicadores, antes.indicadores);
    await p.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await p.getByRole('button', { name: 'Abrir buscador POI' }).click();
    await p.getByRole('searchbox').fill(''); await p.keyboard.press('Escape');
    despues = await p.evaluate(() => capturarCapas());
    assert.deepEqual(despues.puntos.filter(r => r.categoria !== 'POI'), antes.puntos.filter(r => r.categoria !== 'POI'));
    assert.equal(await p.evaluate(() => poi.puntoBuscado), null);
  }
  assert.deepEqual(solicitudes, []);
});

for (const seleccion of ['barrio', 'zona']) test(`Territorio ${seleccion}: Hidrografía y todas las capas conservan el resaltado`, async t => {
  const { pagina: p } = await abrir(t);
  await p.evaluate(seleccion => {
    const s = editorPrueba.escena;
    if (seleccion === 'barrio') s.selectorBarrios.seleccionarBarrio('AGUADA');
    else s.selectorZonas.seleccionarZona('ZONA ESTE');
  }, seleccion);
  await cuadros(p);
  const base = await p.evaluate(() => capturarCapas());
  for (const activas of [[], ['AGUA'], CATEGORIAS, ['ESPACIOS_VERDES','AGUA'], []]) {
    await p.evaluate(c => poi.establecerCategoriasVisibles(c), activas);
    const despues = await p.evaluate(() => capturarCapas());
    assert.deepEqual(despues.barrios, base.barrios);
    assert.deepEqual(despues.camara, base.camara);
  }
  await p.evaluate(seleccion => {
    const s = editorPrueba.escena;
    if (seleccion === 'barrio') s.selectorBarrios.deseleccionarBarrio('AGUADA');
    else s.selectorZonas.deseleccionarZona('ZONA ESTE');
  }, seleccion);
  assert.deepEqual(await p.evaluate(() => [...poi.categoriasVisibles]), []);
});
