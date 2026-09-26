const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
for (const tipo of ['tutorial', 'ficha']) test(`Los clics de ${tipo} no atraviesan el panel hacia Phaser`, async t => {
  const { pagina: p, contexto, solicitudes } = await abrirEditor(navegador, tipo === 'tutorial' ? { estaciones: [], lineas: [], tramos: [],
    escenario: { ...niveles[0], idEscenario: 1, desbloqueado: true, estado: 'EN_DESARROLLO' } } : {});
  t.after(() => contexto.close());
  if (tipo === 'ficha') {
    await p.evaluate(() => editorPrueba.escena.capaPuntosInteres.seleccionarPunto(1, { enfocar: true, duracion: 0 }));
    for (let i = 0; i < 3; i++) {
      await p.locator('.metronet-control-zoom-boton').first().click();
      await p.locator('.metronet-control-zoom-boton').nth(1).click();
    }
  }
  await p.evaluate(() => { window.pulsosMapa = 0; editorPrueba.escena.input.on('pointerdown', () => pulsosMapa++); });
  if (tipo === 'tutorial') {
    await p.locator('.metronet-hud>summary').click();
    await p.locator('.metronet-tutorial>summary').click();
    await p.locator('.metronet-tutorial>summary').click();
  } else {
    await p.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    assert.equal(await p.evaluate(() => editorPrueba.escena.capaPuntosInteres.puntoSeleccionado), null);
  }
  assert.equal(await p.evaluate(() => pulsosMapa), 0);
  assert.deepEqual(solicitudes, []);
});
