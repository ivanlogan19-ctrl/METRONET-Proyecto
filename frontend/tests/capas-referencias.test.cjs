// Catálogo y Phaser reales; API interceptada para no modificar cuentas ni diseños.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const CATEGORIAS = ['POI', 'ESPACIOS_VERDES', 'INFRAESTRUCTURA', 'AGUA'];
const ETIQUETAS = ['POI', 'Espacios verdes', 'Infraestructura', 'Hidrografía'];
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function abrir(t, opciones) {
  const vista = await abrirEditor(navegador, opciones);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.evaluate(() => { window.poi = editorPrueba.escena.capaPuntosInteres; });
  return vista;
}
async function establecer(p, mascara) {
  for (let i = 0; i < ETIQUETAS.length; i++) {
    const boton = p.getByRole('button', { name: ETIQUETAS[i], exact: true });
    if ((await boton.getAttribute('aria-pressed') === 'true') !== Boolean(mascara & (1 << i))) await boton.click();
  }
}

test('Cuatro categorías derivadas del catálogo; espacios verdes separados y coordenadas intactas', async t => {
  const { pagina: p } = await abrir(t);
  const resultado = await p.evaluate(async () => {
    const { obtenerCategoriaReferencia: categoria } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
    const fuente = (await import('/src/mapa/datos/puntos-interes.json')).default;
    const originales = Object.values(fuente.barrios).flatMap(b => b.puntos);
    return {
      grupos: Object.fromEntries(['POI', 'ESPACIOS_VERDES', 'INFRAESTRUCTURA', 'AGUA'].map(c => [c, poi.puntos.filter(p => categoria(p) === c).length])),
      intactos: originales.every(o => poi.puntos.some(p => p.id === o.id && p.nombre === o.nombre && p.tipo === o.tipo && p.latitud === o.latitud && p.longitud === o.longitud)),
      casos: ['Hospital universitario', 'Patrimonio ferroviario', 'Museo ferroviario', 'Espacio público', 'Parque', 'Plaza mirador', 'Jardín histórico', 'Río', 'Arroyo', 'Estación ferroviaria', 'Puerto'].map(tipo => categoria({ tipo })),
      colores: [1, 85, 20, 29].map(id => poi.obtenerColorMarcador(poi.puntos.find(p => p.id === id))),
    };
  });
  assert.equal(resultado.intactos, true);
  assert.deepEqual(resultado.grupos, { POI: 73, ESPACIOS_VERDES: 32, INFRAESTRUCTURA: 7, AGUA: 9 });
  assert.deepEqual(resultado.casos, ['POI','POI','POI','POI','ESPACIOS_VERDES','ESPACIOS_VERDES','ESPACIOS_VERDES','AGUA','AGUA','INFRAESTRUCTURA','INFRAESTRUCTURA']);
  assert.equal(new Set(resultado.colores).size, 4);
  assert.equal(resultado.colores[1], 0x75b49c);
});

test('Dieciséis combinaciones repetidas: marcadores, indicadores y cámara independientes sin duplicados', async t => {
  const { pagina: p, solicitudes } = await abrir(t);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => !document.querySelector('.metronet-estado-editor__mensaje [role="status"]')?.textContent);
  await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const inicial = await p.evaluate(() => ({
    objetos: poi.escena.children.list.length,
    visibles: poi.representaciones.filter(r => r.contenedor.visible).map(r => r.punto.id).sort(),
    camara: [poi.escena.cameras.main.scrollX, poi.escena.cameras.main.scrollY, poi.escena.cameras.main.zoom],
  }));
  for (let vuelta = 0; vuelta < 2; vuelta++) for (let mascara = 0; mascara < 16; mascara++) {
    await establecer(p, mascara);
    const estado = await p.evaluate(async () => {
      const { obtenerCategoriaReferencia: categoria } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
      return {
        categorias: [...poi.categoriasVisibles].sort(),
        objetos: poi.escena.children.list.length,
        formasAdicionales: editorPrueba.escena.capaTerritorial.grafico.commandBuffer.length,
        indebidos: poi.representaciones.filter(r => !poi.categoriasVisibles.has(categoria(r.punto)) && (r.contenedor.visible || r.areaInteraccion.input.enabled)).length,
        visibles: poi.representaciones.filter(r => r.contenedor.visible).map(r => r.punto.id).sort(),
        etiquetas: poi.representaciones.filter(r => r.etiqueta?.visible).length,
        camara: [poi.escena.cameras.main.scrollX, poi.escena.cameras.main.scrollY, poi.escena.cameras.main.zoom],
        catalogo: poi.obtenerResumenPuntos().puntosBusqueda.length,
      };
    });
    const esperadas = CATEGORIAS.filter((_, i) => mascara & (1 << i)).sort();
    assert.deepEqual(estado.categorias, esperadas);
    assert.deepEqual(await p.locator('.metronet-capas-activas > span:visible').evaluateAll(es => es.map(e => e.dataset.categoria).sort()), esperadas);
    assert.equal(await p.locator('.metronet-capas-activas > span').count(), 4);
    assert.equal(estado.formasAdicionales, 0, 'Los verdes usan los mismos marcadores individuales que infraestructura');
    assert.equal(estado.indebidos, 0); assert.equal(estado.etiquetas, 0); assert.equal(estado.catalogo, 80);
    assert.equal(estado.objetos, inicial.objetos); assert.deepEqual(estado.camara, inicial.camara);
    if (mascara === 15) assert.deepEqual(estado.visibles, inicial.visibles);
  }
  assert.deepEqual(solicitudes, []);
});

test('Capas territoriales visibles desde el mapa inicial sin red ni zoom; ninguna categoría activa queda desplazada', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { estaciones: [], tramos: [] });
  await p.waitForFunction(() => !document.querySelector('.metronet-estado-editor__mensaje [role="status"]')?.textContent);
  for (const categorias of [['AGUA'], ['ESPACIOS_VERDES'], ['INFRAESTRUCTURA'], CATEGORIAS]) {
    const estado = await p.evaluate(async categorias => {
      const { obtenerCategoriaReferencia: categoria } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
      poi.establecerCategoriasVisibles(categorias);
      const visibles = poi.representaciones.filter(r => r.contenedor.visible);
      return {
        zoom: poi.obtenerZoomActual(),
        seleccion: poi.haySeleccionGeografica(),
        categorias: [...new Set(visibles.map(r => categoria(r.punto)))].sort(),
        cantidad: visibles.length,
        cantidadesPorCategoria: Object.fromEntries(categorias.map(c => [c, visibles.filter(r => categoria(r.punto) === c).length])),
        etiquetas: visibles.filter(r => r.etiqueta?.visible).length,
        interacciones: visibles.every(r => r.areaInteraccion.input.enabled),
        superposiciones: visibles.some((r, i) => visibles.slice(i + 1).some(otro => (
          categoria(r.punto) === categoria(otro.punto)
          && Math.abs(r.posicion.x - otro.posicion.x) < 36 && Math.abs(r.posicion.y - otro.posicion.y) < 36
        ))),
      };
    }, categorias);
    assert.equal(estado.zoom, 1);
    assert.equal(estado.seleccion, false);
    assert.deepEqual(estado.categorias, categorias.filter(c => c !== 'POI').sort());
    assert.ok(estado.cantidad > 0 && Object.values(estado.cantidadesPorCategoria).every(n => n <= 8), JSON.stringify(estado));
    assert.equal(estado.etiquetas, 0);
    assert.equal(estado.interacciones, true);
    assert.equal(estado.superposiciones, false, 'La separación se calcula dentro de cada categoría, sin ocultar otras capas');
  }
  assert.deepEqual(solicitudes, []);
});

test('Solo POI tiene búsqueda; cerrar la ficha mantiene el punto y borrar la consulta lo retira', async t => {
  const { pagina: p, solicitudes } = await abrir(t);
  await establecer(p, 0);
  await p.getByRole('button', { name: 'Abrir buscador POI' }).click();
  const buscar = p.getByRole('searchbox', { name: 'Buscar POI' });
  assert.equal(await p.getByRole('searchbox').count(), 1);
  for (const [nombre, id] of [['Parque Rodó', 85], ['Lago del Parque Rivera', 29]]) {
    await buscar.fill(nombre);
    assert.equal(await p.locator(`.metronet-panel-puntos-lista button[data-id-punto="${id}"]`).count(), 0);
    assert.equal(await p.locator('.metronet-panel-puntos-lista button:not([data-categoria="POI"])').count(), 0);
  }
  for (const nombre of ['Palacio Legislativo', 'Hospital de Clínicas', 'Puerto del Buceo', 'Terminal y Shopping Tres Cruces']) {
    await buscar.fill(nombre);
    await p.locator('.metronet-panel-puntos-lista button').first().click();
    await p.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    const estado = await p.evaluate(() => ({
      buscado: poi.puntoBuscado, seleccionado: poi.puntoSeleccionado,
      visibles: poi.representaciones.filter(r => r.contenedor.visible).map(r => poi.clavePunto(r.punto)),
      etiquetas: poi.representaciones.filter(r => r.etiqueta?.visible).length,
      categorias: [...poi.categoriasVisibles],
    }));
    assert.deepEqual(estado.visibles, [estado.buscado]); assert.ok(estado.buscado);
    assert.equal(estado.seleccionado, null); assert.equal(estado.etiquetas, 1); assert.deepEqual(estado.categorias, []);
    await p.getByRole('button', { name: 'Hidrografía', exact: true }).click();
    await p.getByRole('button', { name: 'Hidrografía', exact: true }).click();
    assert.equal(await p.evaluate(() => poi.puntoBuscado), estado.buscado);
    await p.getByRole('button', { name: 'Abrir buscador POI' }).click();
    assert.equal(await buscar.inputValue(), nombre);
    await buscar.fill('');
    assert.equal(await p.evaluate(() => poi.puntoBuscado), null);
    assert.equal(await p.evaluate(() => poi.representaciones.filter(r => r.contenedor.visible).length), 0);
  }
  await p.keyboard.press('Escape');
  assert.equal(await buscar.isVisible(), false);
  assert.deepEqual(solicitudes, []);
});

test('Objetivos territoriales siguen disponibles con categorías apagadas, sin entrar en el buscador POI', async t => {
  const { pagina: p } = await abrir(t, { objetivos: [{ idPunto: 85, radioCobertura: 60 }, { idPunto: 20, radioCobertura: 60 }] });
  await establecer(p, 0);
  const estado = await p.evaluate(() => ({
    visibles: poi.representaciones.filter(r => r.contenedor.visible).map(r => r.punto.id).sort(),
    catalogo: poi.obtenerResumenPuntos().puntosBusqueda.map(p => p.id),
  }));
  assert.deepEqual(estado.visibles, [20, 85]);
  assert.equal(estado.catalogo.includes(20), true);
  assert.equal(estado.catalogo.includes(85), false);
  await p.evaluate(() => poi.seleccionarPunto(20));
  assert.match(await p.getByRole('dialog').innerText(), /Infraestructura · Puerto/);
});

for (const width of [1440, 1024, 768, 390, 320]) test(`Layout ${width}: cuatro capas alineadas, búsqueda separada, Territorio sin doble relieve`, async t => {
  const { pagina: p } = await abrir(t, { viewport: { width, height: 1000 } });
  await p.evaluate(() => document.fonts.ready);
  const capas = p.locator('.metronet-referencias-territoriales');
  assert.equal(await capas.getByRole('searchbox').count(), 0);
  assert.equal(await capas.getByRole('button').count(), 4);
  assert.equal(await p.getByRole('heading', { name: 'Referencias territoriales', exact: true }).count(), 1);
  const medidas = await p.locator('.metronet-referencias-controles button, .metronet-territorio-selectores .metronet-panel-encabezado').evaluateAll(botones => botones.map(b => {
    const r = b.getBoundingClientRect(), c = getComputedStyle(b);
    return { alto: r.height, y: r.y, x: r.x, ancho: r.width, padding: c.padding, lineHeight: c.lineHeight, sombra: c.boxShadow, desborda: b.scrollWidth > b.clientWidth };
  }));
  assert.equal(medidas.length, 6);
  assert.equal(new Set(medidas.map(c => c.alto)).size, 1, JSON.stringify(medidas));
  assert.equal(new Set(medidas.map(c => c.padding)).size, 1);
  assert.equal(new Set(medidas.map(c => c.lineHeight)).size, 1);
  assert.ok(medidas.every(c => !c.desborda && c.x >= 0 && c.x + c.ancho <= width));
  if (width === 1440) assert.equal(new Set(medidas.slice(0, 4).map(c => c.y)).size, 1);
  for (const frame of await p.locator('.metronet-territorio-selectores .metronet-panel-dinamico').all()) {
    assert.deepEqual(await frame.evaluate(e => ({ borde: getComputedStyle(e).borderWidth, sombra: getComputedStyle(e).boxShadow })), { borde: '0px', sombra: 'none' });
  }
  for (const id of ['zonas', 'barrios']) {
    const boton = p.locator(`#metronet-selector-${id} button`).first();
    await boton.focus(); await boton.press('Enter');
    assert.equal(await boton.getAttribute('aria-expanded'), 'true');
    await boton.press('Escape'); assert.equal(await boton.getAttribute('aria-expanded'), 'false');
  }
  const mapa = await p.locator('#metronet-mapa').boundingBox();
  await p.getByRole('button', { name: 'Abrir buscador POI' }).click();
  assert.deepEqual(await p.locator('#metronet-mapa').boundingBox(), mapa);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await p.locator('.metronet-capas-activas').evaluate(e => getComputedStyle(e).pointerEvents), 'none');
});

test('Recarga, limpieza de búsqueda y cambio de diseño no dejan indicadores o selecciones duplicados', async t => {
  const { pagina: p } = await abrir(t);
  await p.getByRole('button', { name: 'Abrir buscador POI' }).click();
  await p.getByRole('searchbox').fill('Palacio Legislativo');
  await p.locator('.metronet-panel-puntos-lista button').first().click();
  await p.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  assert.equal(await p.evaluate(() => poi.puntoBuscado), 'id:1', 'Recargar el mismo diseño conserva la búsqueda');
  await p.evaluate(() => { editorPrueba.disenoActual.simulacion.idDiseno = 78; return editorPrueba.abrirDiseno(77); });
  assert.equal(await p.evaluate(() => poi.puntoBuscado), null, 'Cambiar de diseño limpia la búsqueda anterior');
  await p.reload();
  await p.waitForFunction(() => window.juegoPrueba?.scene?.getScene('MapaScene')?.editorRedMetro?.disenoActual?.simulacion?.idDiseno === 77);
  assert.equal(await p.locator('.metronet-capas-activas').count(), 1);
  assert.equal(await p.locator('.metronet-capas-activas > span:visible').count(), 4);
  assert.equal(await p.locator('.metronet-referencias-controles [aria-pressed=true]').count(), 4);
});
