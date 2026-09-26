const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const [busqueda, descripcion, cantidad] of [['Salud', 'Hospital', null], ['Cultura', 'Museo|Teatro|Centro cultural|Monumento|Iglesia|Capilla|Biblioteca', null], ['Infraestructura', 'Puerto|Terminal|Faro|Estación ferroviaria|Centro industrial|Estadio|Hipódromo|Velódromo|Arena deportiva|Edificio emblemático', 8]]) {
  test(`Buscador POI encuentra subcategoría ${busqueda} con todas las capas apagadas`, async t => {
    const { contexto, pagina: p, errores, solicitudes } = await abrirEditor(navegador);
    t.after(async () => { await contexto.close(); assert.deepEqual(errores, []); });
    await p.evaluate(() => {
      const mapa = editorPrueba.escena;
      mapa.capaPuntosInteres.establecerCategoriasVisibles([]);
      mapa.panelReferencias.actualizar([]);
    });
    await p.locator('.metronet-poi>summary').click();
    await p.getByRole('button', { name: 'Buscar punto de interés' }).click();
    await p.getByRole('searchbox', { name: 'Buscar punto de interés' }).fill(busqueda);
    const resultados = p.locator('.metronet-panel-puntos-lista button');
    assert.ok(await resultados.count() > 0);
    if (cantidad) assert.equal(await resultados.count(), cantidad);
    for (const resultado of await resultados.all()) assert.match(await resultado.innerText(), new RegExp(`(${descripcion})`, 'i'));
    await resultados.first().click();
    assert.match(await p.getByRole('dialog').innerText(), new RegExp(busqueda,'i'));
    assert.deepEqual(await p.evaluate(() => [...editorPrueba.escena.capaPuntosInteres.categoriasVisibles]), []);
    assert.deepEqual(solicitudes, []);
  });
}
