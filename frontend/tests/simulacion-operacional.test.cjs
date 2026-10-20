const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const catalogoRecorrido = require('../src/educacion/recorrido-integral.json');
let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

async function abrir(t, { fallaGuardado = false, segundaLinea = false, redResuelta = true, demoraEjecucion = 0, ids = [1, 2], nivel = false, numeroNivel = 2, nombreLinea = 'Azul', viewport = { width: 1440, height: 900 } } = {}) {
  const idEscenario = 40 + numeroNivel;
  const red = {
    simulacion: { idDiseno: 77, nombre: 'Red operacional', modo: nivel ? 'NIVEL' : 'LIBRE', estado: 'VALIDADO', ...(nivel ? { idEscenario } : {}) },
    estaciones: [{ nombre: 'A', posicionX: 580, posicionY: 470 }, { nombre: 'B', posicionX: 700, posicionY: 460 }],
    lineas: [{ nombre: nombreLinea }], tramos: [{ nombreLinea, estacionA: 'A', estacionB: 'B', distanciaKm: 12 }],
    unidadesMetro: ids.map(idTren => ({ idTren, nombreLinea, capacidad: 300, velocidadPromedio: 3, duracionUt: 4 })),
    preparadoParaSimular: true, territorio: { areas: [], errores: [] }, resultados: [],
  };
  if (segundaLinea) {
    red.lineas.push({ nombre: 'Roja' });
    red.tramos.push({ nombreLinea: 'Roja', estacionA: 'A', estacionB: 'B', distanciaKm: 6 });
    red.unidadesMetro.push({ idTren: 99, nombreLinea: 'Roja', capacidad: 300, velocidadPromedio: 2, duracionUt: 3 });
  }
  const vista = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { viewport, responder: async req => {
    const path = new URL(req.url()).pathname;
    if (nivel && path === '/api/juego/progreso') return { json: {
      numeroCampanaActual: 1, escenarios: catalogoRecorrido.map(n => ({ ...n, idEscenario: 40 + n.numero,
        estado: 'EN_DESARROLLO', desbloqueado: true, cantidadIntentosCampana: 2 })),
    } };
    if (path === '/api/simulaciones/77') return { json: red };
    if (path.endsWith('/desempeno')) return { json: { puntajeMaximo: 100, redResuelta, unidades: [],
      ...(nivel ? { configuracionUvUt: { limiteUt: 6, presupuestoUv: 8 } } : {}) } };
    if (/\/unidades\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop());
      if (fallaGuardado) return { status: 503, json: { detail: 'No se pudo guardar la línea.' } };
      await new Promise(resolve => setTimeout(resolve, 100)); // Escritura pendiente para probar doble envío.
      const cuerpo = req.postDataJSON(), unidad = red.unidadesMetro.find(u => u.idTren === id);
      const distancia = red.tramos.filter(t => t.nombreLinea === unidad.nombreLinea).reduce((n, t) => n + t.distanciaKm, 0);
      const velocidad = cuerpo.parametroReferencia === 'UT' ? distancia / cuerpo.duracionUt : cuerpo.velocidadPromedio;
      const duracion = cuerpo.parametroReferencia === 'UT' ? cuerpo.duracionUt : distancia / velocidad;
      for (const metro of red.unidadesMetro.filter(u => u.nombreLinea === unidad.nombreLinea)) {
        Object.assign(metro, { velocidadPromedio: velocidad, duracionUt: duracion });
      }
      return { status: 204 };
    }
    if (path.endsWith('/ejecutar')) { await new Promise(r => setTimeout(r, demoraEjecucion)); return { json: { idSimulacion: 1, estado: 'COMPLETADA', ...req.postDataJSON() } }; }
  } });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.locator('#velocidadUnidad').waitFor();
  const oferta = vista.pagina.getByRole('button', { name: 'Continuar', exact: true });
  if (await oferta.isVisible()) await oferta.click();
  const recorrido = vista.pagina.locator('.metronet-recorrido[open] [data-recorrido-omitir]');
  if (await recorrido.isVisible()) await recorrido.click();
  return { ...vista, red };
}
async function guardar(p, referencia, valor) {
  const campo = referencia === 'UV' ? '#velocidadUnidad' : '#duracionSimulacion';
  const boton = referencia === 'UV' ? '.simulacion-parametro-velocidad button[type=submit]' : '#aplicarUnidadTiempo';
  await p.locator(campo).fill(String(valor));
  await Promise.all([p.waitForResponse(r => r.request().method() === 'PATCH'), p.locator(boton).click()]);
  await p.locator('#velocidadUnidad:not(:disabled)').waitFor();
}
async function seleccionarLinea(p, id) {
  const menu = p.locator('.simulacion-selector-metros');
  if (!await menu.evaluate(e => e.open)) await menu.locator('summary').click();
  const siguiente = menu.getByRole('button', { name: 'Opciones siguientes', exact: true });
  while (!await menu.locator(`[data-metro="${id}"]`).isVisible() && await siguiente.isEnabled()) {
    await siguiente.click();
  }
  await menu.locator(`[data-metro="${id}"]`).click();
}

// V4: UV y UT están vinculadas por distancia para cada línea en los diez niveles.
for (const n of catalogoRecorrido) test(`Nivel ${n.numero}: aplicar UV/UT permite iniciar, detener y repetir`, async t => {
  const { pagina: p, solicitudes, red } = await abrir(t, { nivel: true, numeroNivel: n.numero });
  assert.equal(await p.locator('.metronet-poi > summary').isVisible(), n.numero >= 6);
  await guardar(p, 'UV', 4);
  assert.equal(await p.locator('#duracionSimulacion').inputValue(), '3');
  await guardar(p, 'UT', 8);
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '1.5');
  for (let i = 0; i < 2; i++) {
    await p.locator('#formularioEjecucion button').click();
    await p.locator('#progresoEjecucion[data-estado=EN_CURSO]').waitFor({ state: 'attached' });
    await p.locator('#detenerSimulacion').click();
    await p.locator('#progresoEjecucion[data-estado=DETENIDA]').waitFor({ state: 'attached' });
    assert.equal(await p.locator('#velocidadUnidad').isEnabled(), true);
    assert.equal(await p.locator('#duracionSimulacion').isEnabled(), true);
  }
  assert.deepEqual(red.unidadesMetro.map(u => [u.velocidadPromedio, u.duracionUt]), [[1.5, 8], [1.5, 8]]);
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 2, 'Una escritura por línea y ajuste');
  assert.deepEqual(solicitudes.filter(s => s.path.endsWith('/ejecutar')).map(s => s.body), [
    { velocidad: 1, duracion: 8 }, { velocidad: 1, duracion: 8 },
  ]);
});

test('UV/UT por línea: agrupa metros, conserva otras líneas y no repite escrituras sin cambios', async t => {
  const { pagina: p, red, solicitudes } = await abrir(t, { segundaLinea: true, ids: [206, 211] });
  assert.equal(await p.locator('#tituloConfiguracionMetros').textContent(), 'Detalle de líneas');
  assert.equal(await p.locator('[data-metro="todas"]').count(), 1);
  await guardar(p, 'UV', 6);
  assert.deepEqual(red.unidadesMetro.map(u => [u.velocidadPromedio, u.duracionUt]), [[6, 2], [6, 2], [2, 3]]);
  assert.ok(solicitudes.some(s => s.path.endsWith('/unidades/206') && s.method === 'PATCH'));
  await p.locator('#aplicarUnidadTiempo').click();
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 1);
  await seleccionarLinea(p, '99');
  await guardar(p, 'UT', 2);
  assert.deepEqual(red.unidadesMetro.map(u => [u.velocidadPromedio, u.duracionUt]), [[6, 2], [6, 2], [3, 2]]);
  assert.equal(await p.locator('.simulacion-configuracion-metros').isVisible(), false);
  await p.locator('.simulacion-selector-metros summary').click();
  assert.deepEqual(await p.locator('.metronet-menu-lineas > button > span').allTextContents(), ['Todas', 'Azul', 'Roja']);
  assert.deepEqual(await p.locator('.metronet-menu-lineas > button > small').allTextContents(), ['6 UV · 2 UT', '3 UV · 2 UT']);
  await p.locator('.simulacion-selector-metros summary').press('Escape');
  assert.equal(await p.locator('.metronet-menu-lineas').isVisible(), false);
});

test('Selector de líneas: teclado, foco y opciones dentro de pantalla', async t => {
  const { pagina: p } = await abrir(t, { segundaLinea: true });
  const menu = p.locator('.simulacion-selector-metros'), acceso = menu.locator('summary');
  await acceso.click();
  assert.equal(await menu.locator('.simulacion-selector-metros__opciones').evaluate(e => {
    const r = e.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  }), true);
  await menu.locator('[data-metro="1"]').click();
  await acceso.focus(); await p.keyboard.press('ArrowDown'); await p.keyboard.press('End'); await p.keyboard.press('Enter');
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '99');
  assert.match(await acceso.innerText(), /Roja/i);
  await acceso.click(); await p.keyboard.press('Escape');
  assert.equal(await menu.evaluate(e => e.open), false);
  assert.equal(await acceso.evaluate(e => e === document.activeElement), true);
});

test('Fallo al guardar: no duplica solicitudes y conserva los datos persistidos', async t => {
  const { pagina: p, red, solicitudes } = await abrir(t, { fallaGuardado: true });
  await p.locator('#velocidadUnidad').fill('6');
  await p.locator('.simulacion-parametro-velocidad').evaluate(f => { f.requestSubmit(); f.requestSubmit(); });
  await p.locator('#mensajeSimulacion.error').filter({ hasText: '0 de 1' }).waitFor();
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 1);
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [3, 3]);
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '3');
  assert.equal(await p.locator('#velocidadUnidad').isEnabled(), true);
});

test('Preflight guarda la edición, evita doble ejecución y bloquea cambios durante marcha y pausa', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { demoraEjecucion: 250 });
  await p.locator('#duracionSimulacion').fill('8');
  await p.locator('#formularioEjecucion').evaluate(f => { f.requestSubmit(); f.requestSubmit(); });
  await p.locator('#pausarSimulacion:not([hidden])').waitFor();
  assert.equal(solicitudes.filter(s => s.path.endsWith('/ejecutar')).length, 1);
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 1);
  assert.equal(await p.locator('#velocidadUnidad').isDisabled(), true);
  await p.locator('#pausarSimulacion').click();
  assert.equal(await p.locator('#duracionSimulacion').isDisabled(), true);
  assert.equal(await p.locator('#unidadCirculacion').isEnabled(), true);
  await p.locator('#reanudarSimulacion').click();
  await p.locator('#detenerSimulacion').click();
  assert.equal(await p.locator('#velocidadUnidad').isEnabled(), true);
  await p.locator('#duracionSimulacion').fill('6');
  await p.locator('#reiniciarSimulacion').click();
  await p.locator('#pausarSimulacion:not([hidden])').waitFor();
  assert.deepEqual(solicitudes.filter(s => s.path.endsWith('/ejecutar')).map(s => s.body), [
    { velocidad: 1, duracion: 8 }, { velocidad: 1, duracion: 6 },
  ]);
  assert.ok(solicitudes.some(s => s.path.endsWith('/validacion') && s.method === 'POST'));
  assert.ok(solicitudes.some(s => s.path.endsWith('/guardar') && s.method === 'POST'));
});

test('Objetivos pendientes permiten ajustar UV y UT sin bloquear su resolución', async t => {
  const { pagina: p, red } = await abrir(t, { nivel: true, redResuelta: false });
  await guardar(p, 'UV', 5);
  assert.deepEqual(red.unidadesMetro.map(u => [u.velocidadPromedio, u.duracionUt]), [[5, 2.4], [5, 2.4]]);
  assert.equal(await p.locator('#duracionSimulacion').isEnabled(), true);
});

for (const width of [1440, 390]) test(`Ficha por línea a ${width}px: nombre, nivel y valores legibles`, async t => {
  const { pagina: p } = await abrir(t, { nivel: true, nombreLinea: 'Línea 01', viewport: { width, height: 900 } });
  const menu = p.locator('.simulacion-configuracion-metros__desplegable');
  await menu.locator('summary').click();
  assert.equal(await menu.locator('[data-nivel-configuracion]').innerText(), 'Nivel 2');
  assert.equal(await menu.locator('[data-nivel-configuracion]').evaluate(e => getComputedStyle(e).textAlign), 'center');
  assert.deepEqual(await menu.locator('li strong').allTextContents(), ['Línea 01']);
  assert.deepEqual(await menu.locator('li dt').allTextContents(), ['UV actual', 'UT actual']);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const caja = await menu.locator('.simulacion-configuracion-metros__lista').boundingBox();
  assert.ok(caja.x >= 0 && caja.x + caja.width <= width);
});

for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [768, 900], [390, 844], [320, 740]]) {
  test(`Panel operacional ${width}×${height}: controles compactos y sin duplicaciones`, async t => {
    const { pagina: p } = await abrir(t, { viewport: { width, height } });
    assert.equal(await p.locator('#consignaSimulacion, #objetivoConsigna, #puntuacionSimulacion').count(), 0);
    assert.equal(await p.locator('#seccionResultados, #listaResultadosSimulacion').count(), 0);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const distribucion = await p.evaluate(() => {
      const panel = document.getElementById('instrumentosSimulacion').getBoundingClientRect();
      const bloques = ['.simulacion-acciones-panel', '.simulacion-reproduccion', '.simulacion-grupo-metros', '.simulacion-grupo-velocidad', '#seccionConfiguracion', '.simulacion-capas']
        .map(selector => document.querySelector(selector).getBoundingClientRect());
      const titulo = document.querySelector('.simulacion-grupo-velocidad > .simulacion-seccion-titulo');
      return {
        limites: { panel: panel.toJSON(), bloques: bloques.map(r => r.toJSON()) },
        dentro: bloques.every(rect => rect.left >= panel.left && rect.right <= panel.right)
          && bloques[0].top >= panel.top && bloques.at(-1).bottom <= panel.bottom,
        ordenados: bloques.every((rect, indice) => indice === 0 || rect.top >= bloques[indice - 1].bottom),
        tituloEnLinea: titulo.scrollWidth <= titulo.clientWidth + 1,
        sobrante: panel.bottom - bloques.at(-1).bottom,
        espacios: bloques.slice(1).map((rect, indice) => rect.top - bloques[indice].bottom),
      };
    });
    assert.equal(distribucion.dentro, true, JSON.stringify(distribucion.limites));
    assert.equal(distribucion.ordenados, true);
    assert.equal(distribucion.tituloEnLinea, true);
    if (width > 1050) {
      assert.ok(distribucion.sobrante <= 2, `Espacio libre al pie: ${distribucion.sobrante}`);
      assert.ok(distribucion.espacios.every(espacio => espacio >= 4), JSON.stringify(distribucion));
    }
    for (const selector of ['.simulacion-parametro-velocidad .simulacion-parametro-valor', '#seccionConfiguracion .simulacion-parametro-valor']) {
      const filas = await p.locator(selector).evaluate(e => [...e.querySelectorAll('input, button')].map(c => c.getBoundingClientRect().top));
      assert.ok(Math.max(...filas) - Math.min(...filas) <= 1, 'Valor y acciones deben compartir una fila');
      const altos = await p.locator(selector).evaluate(e => [...e.querySelectorAll('input, button')].map(c => c.getBoundingClientRect().height));
      assert.ok(altos.every(alto => alto === altos[0] && alto >= 26 && alto <= 40), JSON.stringify(altos));
    }
    const iconosGuardado = await p.locator('.simulacion-parametro-valor .metronet-boton-icono > .metronet-icono').evaluateAll(iconos => iconos.map(icono => {
      const rect = icono.getBoundingClientRect(), boton = icono.parentElement.getBoundingClientRect();
      return { ancho: rect.width, alto: rect.height, desvioX: Math.abs(rect.x + rect.width / 2 - boton.x - boton.width / 2), desvioY: Math.abs(rect.y + rect.height / 2 - boton.y - boton.height / 2) };
    }));
    assert.equal(iconosGuardado.length, 2);
    assert.ok(iconosGuardado.every(icono => icono.ancho >= 16 && icono.ancho <= 18 && icono.alto === icono.ancho && icono.desvioX <= 1 && icono.desvioY <= 1), JSON.stringify(iconosGuardado));
    const centrado = await p.evaluate(() => {
      const grupo = document.querySelector('.simulacion-grupo-metros');
      const r = e => e.getBoundingClientRect();
      const cabecera = r(grupo.querySelector('h3'));
      const menus = [...grupo.querySelectorAll('summary')].filter(e => e.getClientRects().length).map(r);
      const borde = Number.parseFloat(getComputedStyle(grupo).borderBottomWidth);
      const espacios = [menus[0].top - cabecera.bottom, r(grupo).bottom - borde - menus.at(-1).bottom];
      const etiquetas = [...grupo.querySelectorAll('summary')].filter(e => e.getClientRects().length).map(menu => {
        const texto = r(menu.querySelector('span')), box = r(menu);
        return Math.abs((texto.left + texto.right) / 2 - (box.left + box.right) / 2);
      });
      const parametros = ['.simulacion-grupo-velocidad', '#seccionConfiguracion'].map(selector => {
        const bloque = document.querySelector(selector), rect = r(bloque), titulo = r(bloque.querySelector('h3'));
        const fila = r(bloque.querySelector('.simulacion-parametro-valor'));
        const bordeInferior = Number.parseFloat(getComputedStyle(bloque).borderBottomWidth);
        return Math.abs((fila.top + fila.bottom) / 2 - (titulo.bottom + rect.bottom - bordeInferior) / 2);
      });
      return { espacios, etiquetas, parametros };
    });
    assert.ok(centrado.etiquetas.every(desvio => desvio <= 1), JSON.stringify(centrado));
    const mapa = await p.locator('#visorSimulacion').boundingBox();
    const panel = await p.locator('#instrumentosSimulacion').boundingBox();
    if (width > 1050) {
      assert.ok(panel.x >= mapa.x + mapa.width);
      assert.ok(Math.abs(panel.y - mapa.y) <= 1);
      assert.ok(Math.abs(panel.height - mapa.height) <= 1, 'El panel debe ocupar todo el alto del mapa');
    }
    else assert.ok(panel.y > mapa.y + mapa.height);
    await seleccionarLinea(p, '1');
    await p.locator('#velocidadUnidad').focus();
    assert.equal(await p.locator('#velocidadUnidad').evaluate(e => e === document.activeElement), true);
    assert.equal(await p.locator('#duracionSimulacion').getAttribute('min'), '0');
    if (process.env.METRONET_CAPTURAS_SIMULACION) await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_SIMULACION}/operacional-${width}.png`, fullPage: true });
  });
}
