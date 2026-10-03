const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const niveles = require('../src/educacion/niveles.json');
const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
let browser;
before(async () => { browser = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await browser?.close(); });

async function paginaPrueba(t, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.route(`${BASE}/__educacion`, route => route.fulfill({ contentType:'text/html', body:'<link rel="stylesheet" href="/src/estilos/metronet.css"><link rel="stylesheet" href="/src/estilos/retro.css"><main></main>' }));
  await page.goto(`${BASE}/__educacion`);
  await page.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true));
  return page;
}

test('10 niveles tienen seis pares únicos de texto, fuente e imagen local válida', async t => {
  const page = await paginaPrueba(t);
  const result = await page.evaluate(async () => {
    const { tarjetasEducativas } = await import('/src/educacion/TarjetasEducativasNivel.js');
    const rows = [];
    for (const pair of tarjetasEducativas) for (const card of pair) {
      const response = await fetch(card.imagen);
      rows.push({ ...card, ok:response.ok, tipo:response.headers.get('content-type'), svg:response.ok ? await response.text() : '' });
    }
    return { counts:tarjetasEducativas.map(p => p.length), rows };
  });
  assert.deepEqual(result.counts, Array(10).fill(6));
  assert.equal(new Set(result.rows.map(row => row.id)).size, 60);
  assert.equal(new Set(result.rows.map(row => row.imagen)).size, 60);
  for (const card of result.rows) {
    assert.ok(card.titulo && card.texto && card.aprendizaje && card.fuente && card.descripcionImagen);
    assert.match(card.url, /^https:\/\//);
    assert.match(card.imagen, /^\/assets\/educacion\/[a-z0-9-]+\.svg$/);
    assert.equal(card.ok, true, card.imagen);
    assert.match(card.tipo, /image\/svg\+xml/);
    assert.match(card.svg, /ESQUEMA ORIGINAL/);
    assert.doesNotMatch(card.svg, /<script|<foreignObject|(?:href|xlink:href)=["']https?:/i);
  }
});

test('rotación agota las seis tarjetas antes de repetir y persiste al recargar', async t => {
  const page = await paginaPrueba(t);
  const ids = await page.evaluate(async () => {
    const { seleccionarTarjetaEducativa } = await import('/src/educacion/TarjetasEducativasNivel.js');
    return Array.from({ length:6 }, () => seleccionarTarjetaEducativa(3).id);
  });
  assert.equal(new Set(ids).size, 6);
  await page.reload();
  const next = await page.evaluate(async () => (await import('/src/educacion/TarjetasEducativasNivel.js')).seleccionarTarjetaEducativa(3).id);
  assert.equal(next, ids[0]);
  assert.notEqual(next, ids[5]);
});

test('sin almacenamiento, la rotación sigue en memoria sin repetir la tarjeta actual', async t => {
  const page = await paginaPrueba(t);
  const ids = await page.evaluate(async () => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(k) { if (k.startsWith('metronet:educacion:')) throw new Error('Bloqueado'); return get.call(this,k); };
    Storage.prototype.setItem = function(k,v) { if (k.startsWith('metronet:educacion:')) throw new Error('Bloqueado'); return set.call(this,k,v); };
    const { seleccionarTarjetaEducativa } = await import('/src/educacion/TarjetasEducativasNivel.js');
    return Array.from({ length:7 }, () => seleccionarTarjetaEducativa(8).id);
  });
  assert.equal(new Set(ids.slice(0,6)).size, 6);
  assert.equal(ids[6], ids[0]);
  assert.notEqual(ids[6], ids[5]);
});

test('cancelar antes de mostrar no consume; seis visitas vistas rotan y recarga reinicia el ciclo', async t => {
  const page = await paginaPrueba(t);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(async level => {
      const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
      const viaje = crearPreparacionNivel(level);
      viaje.cerrar();
    }, niveles[4]);
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('metronet:educacion:ultimo:5')), null);
  const vistos = [];
  for (let i = 0; i < 6; i++) {
    await page.evaluate(async level => {
      const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
      window.viaje = crearPreparacionNivel(level);
      viaje.marcarDatosListos();
    }, niveles[4]);
    await page.getByRole('button', { name:'Jugar' }).click();
    vistos.push(await page.locator('[data-tarjeta-educativa]').getAttribute('data-tarjeta-educativa'));
    await page.getByRole('button', { name:'Continuar' }).click();
    await page.evaluate(() => viaje.cerrar());
  }
  assert.equal(new Set(vistos).size, 6);
  await page.reload();
  await page.evaluate(async level => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.viaje = crearPreparacionNivel(level);
    viaje.marcarDatosListos();
  }, niveles[4]);
  await page.getByRole('button', { name:'Jugar' }).click();
  assert.equal(await page.locator('[data-tarjeta-educativa]').getAttribute('data-tarjeta-educativa'), vistos[0]);
  await page.evaluate(() => viaje.cerrar());
});

test('música y preparación preceden la tarjeta; Continuar abre el nivel en el mismo diálogo', async t => {
  const page = await paginaPrueba(t);
  await page.evaluate(async level => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.viaje = crearPreparacionNivel(level);
    window.terminada = false;
    viaje.finalizada.then(() => { window.terminada = true; });
    viaje.marcarDatosListos();
  }, niveles[0]);
  const dialog = page.locator('.metronet-viaje');
  assert.equal(await page.locator('dialog[open]').count(), 1);
  assert.equal(await dialog.locator('.metronet-viaje__contenido').isVisible(), true);
  assert.equal(await dialog.locator('.metronet-tarjeta-educativa').count(), 0);
  assert.equal(await dialog.getAttribute('aria-labelledby'), 'tituloPreparacionNivel');
  await dialog.getByRole('button', { name:'Jugar' }).click();
  assert.equal(await dialog.locator('.metronet-tarjeta-educativa').isVisible(), true);
  assert.equal(await dialog.locator('.metronet-viaje__contenido').isVisible(), false);
  assert.equal(await dialog.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '100');
  assert.equal(await page.evaluate(() => window.terminada), false);
  const titleId = await dialog.getAttribute('aria-labelledby');
  assert.match(titleId, /^tituloTarjetaEducativa/);
  const textoEducativo = await dialog.locator('.metronet-tarjeta-educativa').innerText();
  assert.doesNotMatch(textoEducativo, /NIVEL 1|CONSIGNA|PRÓXIMO DESAFÍO|PUNTOS/i);
  assert.equal(textoEducativo.includes(niveles[0].objetivo), false);
  const img = await dialog.locator('.metronet-tarjeta-educativa img').evaluate(i => ({ naturalWidth:i.naturalWidth, alt:i.alt }));
  assert.equal(img.naturalWidth, 720);
  assert.match(img.alt, /^Esquema original/);
  assert.equal(await dialog.getByRole('button').count(), 1);
  await dialog.getByRole('button', { name:'Continuar' }).click();
  assert.equal(await dialog.locator('.metronet-tarjeta-educativa').count(), 0);
  assert.equal(await page.evaluate(() => window.terminada), true);
  await page.evaluate(() => viaje.cerrar());
  await dialog.waitFor({ state:'detached' });
});

test('al terminar la música naturalmente, el cartel se retira y la tarjeta queda visible', async t => {
  const page = await paginaPrueba(t);
  await page.clock.install();
  await page.evaluate(async level => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.viaje = crearPreparacionNivel(level);
    viaje.marcarDatosListos();
  }, niveles[2]);
  await page.clock.runFor(15000);
  const dialog = page.locator('.metronet-viaje');
  assert.equal(await dialog.locator('.metronet-tarjeta-educativa').isVisible(), true);
  assert.equal(await dialog.locator('.metronet-cartel-transicion').count(), 0);
  assert.equal(await dialog.evaluate(d => getComputedStyle(d.querySelector('.metronet-tarjeta-educativa')).display), 'grid');
  assert.equal(await dialog.getByRole('button', { name:'Continuar' }).isVisible(), true);
  await page.evaluate(() => viaje.cerrar());
});

test('Ayuda reabre la tarjeta actual, recupera foco y no apila diálogos', async t => {
  const page = await paginaPrueba(t);
  await page.evaluate(async level => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    const intro = crearPreparacionNivel(level);
    window.tarjetaIntro = (await import('/src/educacion/TarjetasEducativasNivel.js')).tarjetaEducativaActual(level.numero).id;
    intro.cerrar();
    const { default: PanelAyuda } = await import('/src/educacion/PanelAyudaContextual.js');
    const contenedor = document.createElement('div'); document.body.append(contenedor);
    window.ayudaPrueba = new PanelAyuda(contenedor);
    ayudaPrueba.actualizar({ escenario:level });
  }, niveles[0]);
  await page.locator('.metronet-hud > summary').click();
  await page.getByRole('button', { name:'Tarjeta educativa del nivel' }).evaluate(button => button.click());
  assert.equal(await page.locator('dialog[open]').count(), 1);
  assert.equal(await page.locator('.metronet-hud').getAttribute('open'), null);
  assert.equal(await page.locator('[data-tarjeta-educativa]').getAttribute('data-tarjeta-educativa'), await page.evaluate(() => window.tarjetaIntro));
  assert.equal(await page.locator('dialog[open]').getByRole('button').count(), 1);
  await page.getByRole('button', { name:'Volver', exact:true }).click();
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await page.locator('.metronet-hud > summary').evaluate(e => e === document.activeElement), true);
  await page.evaluate(() => ayudaPrueba.eliminar());
});

test('tras la victoria, la tarjeta aparece antes de abrir el editor sin repetir la música de entrada', async t => {
  const page = await paginaPrueba(t);
  await page.evaluate(async level => {
    const { iniciarNivelConTransicion } = await import('/src/educacion/PreparacionNivel.js');
    window.editorAbierto = false;
    window.entradaPreparada = iniciarNivelConTransicion(level, async () => {
      window.editorAbierto = true;
      return { idDiseno: 101, idEscenario: 42, idIntento: 202 };
    }, { preparado: true });
  }, niveles[1]);
  const tarjeta = page.locator('dialog[open] .metronet-tarjeta-educativa');
  await tarjeta.waitFor();
  assert.equal(await page.locator('.metronet-viaje__contenido').count(), 0);
  assert.equal(await page.evaluate(() => window.editorAbierto), false);
  await tarjeta.getByRole('button', { name:'Continuar' }).click();
  assert.equal(await page.evaluate(() => window.editorAbierto), true);
  assert.equal(await page.locator('dialog[open]').count(), 0);
});

for (const width of [320, 375, 1440]) test(`tarjeta ${width}px: controles visibles, imagen proporcionada y sin desborde horizontal`, async t => {
  const page = await paginaPrueba(t, { width, height:800 });
  await page.evaluate(async level => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.viaje = crearPreparacionNivel(level);
    viaje.marcarDatosListos();
  }, niveles[9]);
  await page.getByRole('button', { name:'Jugar' }).click();
  const measured = await page.locator('.metronet-viaje').evaluate(d => {
    const box = d.getBoundingClientRect(), img = d.querySelector('img'), action = d.querySelector('.metronet-tarjeta-educativa__acciones button').getBoundingClientRect();
    return { width:box.width, height:box.height, scrollWidth:d.scrollWidth, clientWidth:d.clientWidth,
      ratio:img.getBoundingClientRect().width/img.getBoundingClientRect().height, actionWidth:action.width, actionHeight:action.height };
  });
  assert.ok(measured.width <= width && measured.height <= 800);
  assert.ok(measured.scrollWidth <= measured.clientWidth);
  assert.ok(Math.abs(measured.ratio - 720/246) < .05);
  assert.ok(measured.actionWidth >= 100 && measured.actionHeight >= 40);
  await page.evaluate(() => viaje.cerrar());
});
