// Catálogo real y Phaser real; HTTP interceptado para no modificar datos de cuentas.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function abrir(t, opciones) {
  const vista = await abrirEditor(navegador, opciones);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.evaluate(() => { window.poi = editorPrueba.escena.capaPuntosInteres; });
  return vista;
}

test('Categorías derivadas: todo el catálogo, identidad intacta y tipos sin falsos positivos', async t => {
  const { pagina: p } = await abrir(t);
  const resultado = await p.evaluate(async () => {
    const { obtenerCategoriaReferencia: categoria } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
    const fuente = (await import('/src/mapa/datos/puntos-interes.json')).default;
    const originales = Object.values(fuente.barrios).flatMap(b => b.puntos);
    return {
      total: poi.puntos.length,
      grupos: Object.fromEntries(['POI','INFRAESTRUCTURA','AGUA'].map(c => [c, poi.puntos.filter(p => categoria(p) === c).length])),
      intactos: originales.every(o => poi.puntos.some(p => p.id === o.id && p.nombre === o.nombre && p.tipo === o.tipo && p.latitud === o.latitud && p.longitud === o.longitud)),
      casos: ['Hospital universitario','Patrimonio ferroviario','Museo ferroviario','Edificio histórico','Río','Arroyo','Estación ferroviaria','Puerto'].map(tipo => categoria({ tipo })),
    };
  });
  assert.equal(resultado.total, 121); assert.equal(resultado.intactos, true);
  assert.deepEqual(resultado.grupos, { POI: 105, INFRAESTRUCTURA: 7, AGUA: 9 });
  assert.deepEqual(resultado.casos, ['POI','POI','POI','POI','AGUA','AGUA','INFRAESTRUCTURA','INFRAESTRUCTURA']);
});

test('Filtros compartidos: búsqueda, selección, ondas/cuadrados, objetivos y cero persistencia adicional', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { objetivos: [{ idPunto: 20, radioCobertura: 60 }] });
  await p.getByRole('button', { name: 'Abrir referencias del mapa' }).click();
  const buscar = p.getByRole('searchbox');
  await buscar.fill('Lago del Parque Rivera');
  const lago = p.locator('.metronet-panel-puntos-lista button').first();
  assert.match(await lago.innerText(), /Agua · Lago/);
  await lago.click();
  const ficha = p.getByRole('dialog');
  assert.match(await ficha.innerText(), /Agua · Lago/);
  const geometria = await p.evaluate(() => {
    const seleccionado = poi.puntos.find(p => poi.clavePunto(p) === poi.puntoSeleccionado);
    const puerto = poi.puntos.find(p => p.id === 20);
    return { agua: poi.obtenerFormaMarcador(seleccionado), infraestructura: poi.obtenerFormaMarcador(puerto), colores: [poi.obtenerColorMarcador(seleccionado), poi.obtenerColorMarcador(puerto)] };
  });
  assert.equal(geometria.agua, 'ondas'); assert.equal(geometria.infraestructura, 'cuadrado');
  assert.notEqual(...geometria.colores);
  await ficha.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await p.getByRole('button', { name: 'Abrir referencias del mapa' }).click();
  await p.getByRole('checkbox', { name: 'Agua', exact: true }).uncheck();
  assert.equal(await p.locator('.metronet-panel-puntos-lista button').count(), 0);
  await p.getByRole('checkbox', { name: 'Infraestructura', exact: true }).uncheck();
  await p.getByRole('checkbox', { name: 'POI', exact: true }).uncheck();
  await buscar.fill('Puerto del Buceo');
  assert.equal(await p.locator('.metronet-panel-puntos-lista button').count(), 1);
  const objetivos = await p.evaluate(() => ({
    visible: poi.representaciones.find(r => r.punto.id === 20).contenedor.visible,
    habilitado: poi.representaciones.find(r => r.punto.id === 20).areaInteraccion.input.enabled,
    resultados: poi.obtenerResumenPuntos().puntosBusqueda.map(p => p.id),
  }));
  assert.deepEqual(objetivos, { visible: true, habilitado: true, resultados: [20] });
  const activos = await p.evaluate(() => {
    poi.seleccionarPunto(20, { mostrarInformacion: false });
    return { visibles: poi.representaciones.filter(r => r.contenedor.visible).map(r => r.punto.id), categorias: [...poi.categoriasVisibles] };
  });
  assert.deepEqual(activos, { visibles: [20], categorias: [] }, 'Seleccionar un objetivo no reactiva las categorías ocultas');
  await p.getByRole('checkbox', { name: 'Agua', exact: true }).check();
  await buscar.fill('Lago del Parque Rivera');
  assert.equal(await p.locator('.metronet-panel-puntos-lista button').count(), 1);
  await p.keyboard.press('Escape');
  assert.equal(await buscar.isVisible(), false);
  assert.deepEqual(solicitudes, []);
});

for (const width of [1440, 1024, 768, 390, 320]) test(`Barra geográfica ${width}: distribución, teclado, cámara estable y sin palabras cortadas`, async t => {
  const { pagina: p } = await abrir(t, { viewport: { width, height: 1000 } });
  await p.evaluate(() => document.fonts.ready);
  const barra = p.locator('.metronet-barra-geografica');
  const ref = await p.locator('[data-contenedor-puntos-interes]').boundingBox();
  const territorio = await p.locator('.metronet-territorio-selectores').boundingBox();
  if (width >= 768) assert.ok(Math.abs(ref.y - territorio.y) < 1);
  else assert.ok(territorio.y >= ref.y + ref.height);
  const antes = await p.locator('#metronet-mapa').boundingBox();
  const camara = await p.evaluate(() => { const c = poi.escena.cameras.main; return [c.scrollX, c.scrollY, c.zoom]; });
  for (const id of ['zonas','barrios']) {
    const boton = p.locator(`#metronet-selector-${id} button`).first();
    await boton.focus(); await boton.press('Enter');
    assert.equal(await boton.getAttribute('aria-expanded'), 'true');
    const contenido = p.locator(`#metronet-selector-${id}-contenido`);
    assert.ok(await contenido.isVisible());
    const caja = await contenido.boundingBox();
    assert.ok(caja.x >= 0 && caja.x + caja.width <= width);
    await boton.press('Escape');
    assert.equal(await boton.getAttribute('aria-expanded'), 'false');
  }
  await p.getByRole('button', { name: 'Abrir referencias del mapa' }).click();
  assert.deepEqual(await p.locator('#metronet-mapa').boundingBox(), antes);
  assert.deepEqual(await p.evaluate(() => { const c = poi.escena.cameras.main; return [c.scrollX, c.scrollY, c.zoom]; }), camara);
  await p.keyboard.press('Escape');
  for (const boton of await barra.locator('button:visible').all()) {
    assert.equal(await boton.evaluate(e => e.scrollWidth > e.clientWidth + 1), false, await boton.textContent());
  }
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await p.locator('#metronet-panel-controles [data-contenedor-selectores-mapa]').count(), 0);
});
