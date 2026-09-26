const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const [busqueda, descripcion, cantidad] of [['Salud', 'Hospital', null], ['Educación', 'Biblioteca|Universidad', null], ['Infraestructura', 'Puerto|Terminal|Faro|Estación ferroviaria|Centro industrial', 7]]) {
  test(`Buscador POI encuentra subcategoría ${busqueda} con todas las capas apagadas`, async t => {
    const { contexto, pagina: p, errores, solicitudes } = await abrirEditor(navegador);
    t.after(async () => { await contexto.close(); assert.deepEqual(errores, []); });
    await p.evaluate(() => {
      const mapa = editorPrueba.escena;
      mapa.capaPuntosInteres.establecerCategoriasVisibles([]);
      mapa.panelReferencias.actualizar([]);
    });
    await p.getByRole('button', { name: 'Abrir buscador POI' }).click();
    await p.getByRole('searchbox', { name: 'Buscar POI' }).fill(busqueda);
    const resultados = p.locator('.metronet-panel-puntos-lista button');
    assert.ok(await resultados.count() > 0);
    if (cantidad) assert.equal(await resultados.count(), cantidad);
    for (const resultado of await resultados.all()) assert.match(await resultado.innerText(), new RegExp(`POI · ${busqueda} · (${descripcion})`, 'i'));
    await resultados.first().click();
    assert.match(await p.getByRole('dialog').innerText(), new RegExp(`POI · ${busqueda}`));
    assert.deepEqual(await p.evaluate(() => [...editorPrueba.escena.capaPuntosInteres.categoriasVisibles]), []);
    assert.deepEqual(solicitudes, []);
  });
}
