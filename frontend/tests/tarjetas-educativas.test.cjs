const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const niveles = require('../src/educacion/niveles.json');
const catalogoPublicado = require('../src/educacion/catalogo-svgs-niveles.json');
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

test('10 niveles tienen siete tarjetas únicas de texto, fuente e imagen local válida', async t => {
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
  assert.deepEqual(result.counts, Array(10).fill(7));
  assert.equal(new Set(result.rows.map(row => row.id)).size, 70);
  assert.equal(new Set(result.rows.map(row => row.imagen)).size, 70);
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

test('las 70 imágenes mantienen el encuadre 720:246 al renderizarse', async t => {
  const page = await paginaPrueba(t);
  await page.addStyleTag({ url: '/src/educacion/tarjeta-educativa-nivel.css' });
  const tarjetas = catalogoPublicado.flatMap(nivel => nivel.tarjetas);
  const resultado = await page.evaluate(async tarjetas => {
    const filas = [];
    for (const tarjeta of tarjetas) {
      const contenido = await (await fetch(tarjeta.imagen)).text();
      const svg = new DOMParser().parseFromString(contenido, 'image/svg+xml').documentElement;
      const figura = document.createElement('figure');
      figura.className = 'metronet-tarjeta-educativa__figura';
      figura.style.width = '300px';
      const imagen = document.createElement('img');
      imagen.src = tarjeta.imagen;
      imagen.width = 720;
      imagen.height = 246;
      figura.append(imagen);
      document.querySelector('main').append(figura);
      await imagen.decode();
      const caja = imagen.getBoundingClientRect();
      filas.push({ id: tarjeta.id, viewBox: svg.getAttribute('viewBox'),
        ancho: caja.width, alto: caja.height, natural: imagen.naturalWidth });
      figura.remove();
    }
    return filas;
  }, tarjetas);
  assert.equal(resultado.length, 70);
  assert.equal(new Set(resultado.map(fila => fila.id)).size, 70);
  for (const fila of resultado) {
    assert.equal(fila.viewBox, '0 0 720 246', fila.id);
    assert.ok(fila.natural > 0, fila.id);
    assert.ok(fila.ancho > 290 && fila.ancho <= 300, JSON.stringify(fila));
    assert.ok(Math.abs(fila.ancho / fila.alto - 720 / 246) < 0.01, fila.id);
  }
});

test('contenido en caché reactiva las tarjetas de cada versión de la versión del nivel elegido', async t => {
  const page = await paginaPrueba(t);
  const tarjetas = catalogoPublicado[0].tarjetas;
  let consultasActuales = 0;
  await page.evaluate(() => localStorage.setItem('sesionUsuario', JSON.stringify({
    token:'qa-local',usuario:{idUsuario:17,rol:'JUGADOR'},
  })));
  await page.route('**/api/juego/**/contenido', route => {
    if (route.request().url().includes('/intentos/82/')) return route.fulfill({status:404});
    const anterior = route.request().url().includes('/intentos/81/');
    if (!anterior) consultasActuales++;
    return route.fulfill({ contentType:'application/json', body:JSON.stringify({
      numero:1,version:anterior?1:2,desafio:{nombre:'Nivel 1'},ayudas:[],
      tarjetas:(anterior ? tarjetas.slice(0,6) : tarjetas).map(t => ({...t,id:`${anterior?'vieja':'nueva'}-${t.id}`})),
    }) });
  });
  const resultado = await page.evaluate(async () => {
    const contenido = await import('/src/educacion/ContenidoPublicadoNivel.js');
    const { tarjetasDisponibles } = await import('/src/educacion/TarjetasEducativasNivel.js');
    await contenido.cargarContenidoPublicado(1);
    const actual = tarjetasDisponibles(1)[0].id;
    await contenido.cargarContenidoPublicado(1,{idIntento:81});
    const anterior = tarjetasDisponibles(1)[0].id;
    await contenido.cargarContenidoPublicado(1);
    const restaurada = tarjetasDisponibles(1)[0].id;
    await contenido.cargarContenidoPublicado(1,{idIntento:81});
    const intentoEnCache = tarjetasDisponibles(1)[0].id;
    try { await contenido.cargarContenidoPublicado(1,{idIntento:82}); } catch {}
    return {actual,anterior,restaurada,intentoEnCache,legada:tarjetasDisponibles(1)[0].id};
  });
  assert.match(resultado.actual,/^nueva-/);
  assert.match(resultado.anterior,/^vieja-/);
  assert.equal(resultado.restaurada,resultado.actual);
  assert.equal(resultado.intentoEnCache,resultado.anterior);
  assert.equal(resultado.legada,'1-1');
  assert.equal(consultasActuales,2,'La publicación vigente se vuelve a consultar antes de iniciar');
});

test('selección aleatoria agota las siete tarjetas antes de repetir y persiste al recargar', async t => {
  const page = await paginaPrueba(t);
  const ids = await page.evaluate(async () => {
    const { seleccionarTarjetaEducativa } = await import('/src/educacion/TarjetasEducativasNivel.js');
    const original = Math.random;
    let sorteos = 0;
    Math.random = () => { sorteos++; return .75; };
    try { return { tarjetas:Array.from({ length:7 }, () => seleccionarTarjetaEducativa(3).id), sorteos }; }
    finally { Math.random = original; }
  });
  assert.equal(ids.sorteos,7);
  const visitadas = ids.tarjetas;
  assert.equal(new Set(visitadas).size, 7);
  await page.reload();
  const next = await page.evaluate(async () => (await import('/src/educacion/TarjetasEducativasNivel.js')).seleccionarTarjetaEducativa(3).id);
  assert.ok(visitadas.includes(next));
  assert.notEqual(next, visitadas[5]);
  const nuevas = await page.evaluate(async () => {
    const { seleccionarTarjetaEducativa } = await import('/src/educacion/TarjetasEducativasNivel.js');
    return Array.from({length:6},()=>seleccionarTarjetaEducativa(3).id);
  });
  assert.equal(new Set([next,...nuevas]).size,7);
});

test('sin almacenamiento, la rotación sigue en memoria sin repetir la tarjeta actual', async t => {
  const page = await paginaPrueba(t);
  const ids = await page.evaluate(async () => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(k) { if (k.startsWith('metronet:educacion:')) throw new Error('Bloqueado'); return get.call(this,k); };
    Storage.prototype.setItem = function(k,v) { if (k.startsWith('metronet:educacion:')) throw new Error('Bloqueado'); return set.call(this,k,v); };
    const { seleccionarTarjetaEducativa } = await import('/src/educacion/TarjetasEducativasNivel.js');
    return Array.from({ length:8 }, () => seleccionarTarjetaEducativa(8).id);
  });
  assert.equal(new Set(ids.slice(0,7)).size, 7);
  assert.ok(ids.slice(0,7).includes(ids[7]));
  assert.notEqual(ids[7], ids[6]);
});

test('cancelar antes de mostrar no consume; siete visitas agotan el ciclo y recarga conserva progreso', async t => {
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
  for (let i = 0; i < 7; i++) {
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
  assert.equal(new Set(vistos).size, 7);
  await page.reload();
  await page.evaluate(async level => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    window.viaje = crearPreparacionNivel(level);
    viaje.marcarDatosListos();
  }, niveles[4]);
  await page.getByRole('button', { name:'Jugar' }).click();
  const siguiente = await page.locator('[data-tarjeta-educativa]').getAttribute('data-tarjeta-educativa');
  assert.ok(vistos.includes(siguiente));
  assert.notEqual(siguiente,vistos[5]);
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
  const img = await dialog.locator('.metronet-tarjeta-educativa img').evaluate(async i => {
    await i.decode();
    const rect = i.getBoundingClientRect();
    return { naturalWidth:i.naturalWidth, ancho:rect.width, alto:rect.height, alt:i.alt };
  });
  assert.ok(img.naturalWidth > 0);
  assert.ok(img.ancho > 0 && Math.abs(img.ancho / img.alto - 720 / 246) < 0.01);
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

test('Aprender recorre las siete tarjetas del nivel sin alterar la siguiente entrada', async t => {
  const page = await paginaPrueba(t);
  await page.evaluate(async level => {
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    const intro = crearPreparacionNivel(level);
    window.tarjetaIntro = (await import('/src/educacion/TarjetasEducativasNivel.js')).seleccionarTarjetaEducativa(level.numero).id;
    window.cicloAntesDeAprender = localStorage.getItem('metronet:educacion:usadas:1');
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
  const dialogo = page.locator('dialog[open]');
  assert.equal(await dialogo.getByRole('button').count(), 2);
  const inicial = await page.evaluate(() => window.tarjetaIntro);
  const ids = [inicial];
  const imagenes = [await dialogo.locator('img').getAttribute('src')];
  for (let i = 0; i < 7; i++) {
    await dialogo.getByRole('button', {name:'Siguiente tarjeta'}).click();
    assert.equal(await dialogo.getByRole('button', {name:'Siguiente tarjeta'}).evaluate(e => e === document.activeElement), true);
    assert.equal(await dialogo.getAttribute('aria-labelledby'), await dialogo.locator('h2').getAttribute('id'));
    if (i < 6) {
      ids.push(await dialogo.locator('[data-tarjeta-educativa]').getAttribute('data-tarjeta-educativa'));
      imagenes.push(await dialogo.locator('img').getAttribute('src'));
    }
  }
  assert.equal(new Set(ids).size,7);
  assert.equal(new Set(imagenes).size,7);
  assert.equal(await dialogo.locator('[data-tarjeta-educativa]').getAttribute('data-tarjeta-educativa'),inicial);
  assert.equal(await page.evaluate(() => localStorage.getItem('metronet:educacion:usadas:1')),await page.evaluate(() => window.cicloAntesDeAprender));
  await page.getByRole('button', { name:'Volver', exact:true }).click();
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await page.locator('.metronet-hud > summary').evaluate(e => e === document.activeElement), true);
  await page.locator('.metronet-hud > summary').click();
  await page.getByRole('button', { name:'Tarjeta educativa del nivel' }).evaluate(button => button.click());
  assert.equal(await page.locator('[data-tarjeta-educativa]').getAttribute('data-tarjeta-educativa'),inicial);
  await page.getByRole('button', { name:'Volver', exact:true }).click();
  const siguiente = await page.evaluate(async () => (await import('/src/educacion/TarjetasEducativasNivel.js')).seleccionarTarjetaEducativa(1).id);
  assert.notEqual(siguiente,inicial);
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
