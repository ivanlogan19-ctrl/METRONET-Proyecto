const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const catalogoRecorrido = require('../src/educacion/recorrido-integral.json');
let navegador;
before(async () => { navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrir(t, { fallaSegunda = false, demoraEjecucion = 0, ids = [1, 2], nivel = false, numeroNivel = 2, nombreLinea = 'Azul', viewport = { width: 1440, height: 900 } } = {}) {
  const idEscenario = 40 + numeroNivel;
  const red = {
    simulacion: { idDiseno: 77, nombre: 'Red operacional', modo: nivel ? 'NIVEL' : 'LIBRE', estado: 'VALIDADO', ...(nivel ? { idEscenario } : {}) },
    estaciones: [{ nombre: 'A', posicionX: 580, posicionY: 470 }, { nombre: 'B', posicionX: 700, posicionY: 460 }],
    lineas: [{ nombre: nombreLinea }], tramos: [{ nombreLinea, estacionA: 'A', estacionB: 'B' }],
    unidadesMetro: ids.map(idTren => ({ idTren, nombreLinea, capacidad: 300, velocidadPromedio: 3 })),
    preparadoParaSimular: true, territorio: { areas: [], errores: [] }, resultados: [],
  };
  const vista = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', { viewport, responder: async req => {
    const path = new URL(req.url()).pathname;
    if (nivel && path === '/api/juego/progreso') return { json: {
      numeroCampanaActual: 1, escenarios: catalogoRecorrido.map(n => ({ ...n, idEscenario: 40 + n.numero,
        estado: 'EN_DESARROLLO', desbloqueado: true, cantidadIntentosCampana: 2 })),
    } };
    if (path === '/api/simulaciones/77') return { json: red };
    if (path.endsWith('/desempeno')) return { json: { puntajeMaximo: 100, redResuelta: true, unidades: [],
      ...(nivel ? { configuracionUvUt: { limiteUt: 6, presupuestoUv: 8 } } : {}) } };
    if (/\/unidades\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop());
      if (fallaSegunda && id === 2) return { status: 503, json: { detail: 'No se pudo guardar la segunda unidad.' } };
      await new Promise(resolve => setTimeout(resolve, 100)); // Escritura pendiente para probar doble envío.
      Object.assign(red.unidadesMetro.find(u => u.idTren === id), req.postDataJSON());
      return { status: 204 };
    }
    if (path.endsWith('/ejecutar')) { await new Promise(r => setTimeout(r, demoraEjecucion)); return { json: { idSimulacion: 1, estado: 'COMPLETADA', ...req.postDataJSON() } }; }
  } });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.locator('#velocidadUnidad').waitFor();
  const recorrido = vista.pagina.locator('.metronet-recorrido[open] [data-recorrido-omitir]');
  if (await recorrido.isVisible()) await recorrido.click();
  return { ...vista, red };
}
async function aplicar(p, valor) {
  await p.locator('#velocidadUnidad').fill(String(valor));
  await p.getByRole('button', { name: 'Aplicar velocidad', exact: true }).click();
  await p.waitForFunction(valor => document.getElementById('mensajeSimulacion').textContent.startsWith(`Velocidad guardada: ${valor}`)
    && !document.querySelector('[data-controles-circulacion]').disabled, valor);
}
async function seleccionarMetro(p, id) {
  const desplegable = p.locator('.simulacion-selector-metros');
  if (!await desplegable.evaluate(e => e.open)) await desplegable.locator('summary').click();
  await desplegable.getByRole('button', { name: id === 'todas' ? 'Todos los metros' : `Metro ${id} · Azul` }).click();
}

// Complementa el recorrido E2E con PostgreSQL: comprueba el ciclo de controles
// de cada nivel sin modificar partidas ni puntajes de usuarios reales.
for (const n of catalogoRecorrido) test(`Nivel ${n.numero}: aplicar UV/UT permite Play, detener y volver a ejecutar`, async t => {
  const { pagina: p, solicitudes, red } = await abrir(t, { nivel: true, numeroNivel: n.numero });
  await aplicar(p, 4);
  await p.locator('#duracionSimulacion').fill('8');
  await p.locator('#aplicarUnidadTiempo').click();
  const play = p.locator('#formularioEjecucion button[type=submit]');
  for (let i = 0; i < 2; i++) {
    assert.equal(await play.isEnabled(), true);
    await play.click();
    await p.locator('#progresoEjecucion[data-estado=EN_CURSO]').waitFor({ state: 'attached' });
    await p.locator('#detenerSimulacion').click();
    await p.locator('#progresoEjecucion[data-estado=DETENIDA]').waitFor({ state: 'attached' });
    assert.equal(await play.getAttribute('aria-busy'), 'false');
    assert.equal(await p.locator('#velocidadUnidad').isEnabled(), true);
    assert.equal(await p.locator('#duracionSimulacion').isEnabled(), true);
  }
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [4, 4]);
  assert.equal(await p.locator('#duracionSimulacion').inputValue(), '8');
  assert.deepEqual(solicitudes.filter(s => s.path.endsWith('/ejecutar')).map(s => s.body), [
    { velocidad: 1, duracion: 8 }, { velocidad: 1, duracion: 8 },
  ]);
});

test('Feedback UV visible: selección, valor aplicado y unidad elegida', async t => {
  const { pagina: p, red } = await abrir(t);
  assert.equal(await p.locator('#tituloConfiguracionMetros').textContent(), 'UT / UV por Metro');
  const configuracion = p.locator('.simulacion-configuracion-metros__desplegable');
  assert.equal(await configuracion.locator('summary').isVisible(), true);
  assert.equal(await configuracion.locator('li').first().isVisible(), false);
  await configuracion.locator('summary').click();
  assert.equal(await configuracion.locator('li').first().isVisible(), true);
  assert.deepEqual(await p.locator('.simulacion-configuracion-metros__lista li').allTextContents(), [
    'Metro 1Línea AzulUV actual3 UVUT actual6 h', 'Metro 2Línea AzulUV actual3 UVUT actual6 h',
  ]);
  await configuracion.locator('summary').press('Escape');
  assert.equal(await configuracion.locator('li').first().isVisible(), false);
  await configuracion.locator('summary').click();
  await seleccionarMetro(p, '1');
  await aplicar(p, 2);
  assert.equal(await p.locator('.simulacion-selector-metros > summary').isVisible(), true);
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '1');
  assert.equal(await p.locator('#velocidadUnidad').isVisible(), true);
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '2');
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [2, 3]);
  assert.deepEqual(await p.locator('.simulacion-configuracion-metros__lista li').allTextContents(), [
    'Metro 1Línea AzulUV actual2 UVUT actual6 h', 'Metro 2Línea AzulUV actual3 UVUT actual6 h',
  ]);
  await p.locator('#duracionSimulacion').fill('4');
  await p.locator('#aplicarUnidadTiempo').click();
  assert.deepEqual(await p.locator('.simulacion-configuracion-metros__lista li').allTextContents(), [
    'Metro 1Línea AzulUV actual2 UVUT actual4 h', 'Metro 2Línea AzulUV actual3 UVUT actual4 h',
  ]);
});

test('Aplicar UT confirma con el mismo gesto breve que UV, sin carteles ni texto nuevo', async t => {
  const { pagina: p, red, solicitudes } = await abrir(t, { nivel: true });
  const boton = p.locator('#aplicarUnidadTiempo');
  const nombre = await boton.getAttribute('aria-label');
  const mensaje = await p.locator('#mensajeSimulacion').textContent();
  await p.locator('#duracionSimulacion').fill('4');
  await boton.click();
  const gesto = await boton.evaluate(e => {
    const animaciones = e.getAnimations().filter(a => a.id === 'aplicar-parametro');
    return { cantidad: animaciones.length, duracion: animaciones[0]?.effect.getTiming().duration,
      transform: getComputedStyle(e).transform };
  });
  assert.equal(gesto.cantidad, 1);
  assert.ok(gesto.duracion > 0 && gesto.duracion <= 300);
  assert.equal(gesto.transform, 'none');
  assert.equal(await boton.getAttribute('aria-label'), nombre);
  assert.equal(await p.locator('#mensajeSimulacion').textContent(), mensaje);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await boton.evaluate(e => { e.click(); e.click(); });
  assert.equal(await boton.evaluate(e => e.getAnimations().filter(a => a.id === 'aplicar-parametro').length), 1);
  await boton.evaluate(e => Promise.all(e.getAnimations().filter(a => a.id === 'aplicar-parametro').map(a => a.finished)));
  assert.equal(await boton.evaluate(e => e.getAnimations().filter(a => a.id === 'aplicar-parametro').length), 0);
  assert.match(await p.locator('.simulacion-configuracion-metros__lista').textContent(), /4 UT/);
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [3, 3]);
  assert.equal(solicitudes.some(s => ['POST', 'PATCH', 'PUT'].includes(s.method)), false);
  await p.locator('#duracionSimulacion').fill('0');
  await boton.click();
  assert.equal(await boton.evaluate(e => e.getAnimations().filter(a => a.id === 'aplicar-parametro').length), 0);
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.locator('#duracionSimulacion').fill('5');
  await boton.focus();
  await p.keyboard.press('Enter');
  assert.equal(await boton.evaluate(e => getComputedStyle(e).transform), 'none');
  assert.match(await p.locator('.simulacion-configuracion-metros__lista').textContent(), /5 UT/);
});

test('Metro y línea comparten tinta clara y las opciones del selector quedan centradas', async t => {
  const { pagina: p } = await abrir(t, { nombreLinea: 'Línea 01' });
  await p.locator('.simulacion-selector-metros > summary').click();
  const opciones = await p.locator('.simulacion-selector-metros__opciones button').evaluateAll(es => es.map(e => getComputedStyle(e).textAlign));
  assert.ok(opciones.every(a => a === 'center'));
  await p.locator('.simulacion-selector-metros__opciones button').last().click();
  await p.locator('.simulacion-configuracion-metros summary').click();
  const colores = await p.locator('.simulacion-configuracion-metros__lista li').evaluateAll(es => es.map(e => ({
    metro: getComputedStyle(e.querySelector('strong')).color,
    linea: getComputedStyle(e.querySelector('[data-linea-metro]')).color,
  })));
  for (const c of colores) { assert.equal(c.metro, c.linea); assert.equal(c.metro, 'rgb(255, 251, 214)'); }
});

test('Menú de metros: opciones estiladas, teclado y selección sincronizada', async t => {
  const { pagina: p } = await abrir(t);
  const desplegable = p.locator('.simulacion-selector-metros');
  const acceso = desplegable.locator('summary');
  await acceso.click();
  await p.waitForFunction(() => document.querySelector('.simulacion-selector-metros > summary').getAttribute('aria-expanded') === 'true');
  assert.equal(await acceso.getAttribute('aria-expanded'), 'true');
  const cajas = await p.evaluate(() => {
    const menu = document.querySelector('.simulacion-selector-metros__opciones').getBoundingClientRect();
    return { dentro: menu.left >= 0 && menu.right <= innerWidth && menu.top >= 0 && menu.bottom <= innerHeight };
  });
  assert.equal(cajas.dentro, true);
  await desplegable.getByRole('button', { name: 'Metro 1 · Azul' }).click();
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '1');
  assert.match(await acceso.innerText(), /Metro 1/i);
  await acceso.focus();
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('End');
  await p.keyboard.press('Enter');
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '2');
  await acceso.click();
  await p.keyboard.press('Escape');
  assert.equal(await desplegable.evaluate(e => e.open), false);
  assert.equal(await acceso.evaluate(e => e === document.activeElement), true);
});

test('Velocidad global e individual: persiste cada unidad y representa MIXTO sin escrituras adicionales', async t => {
  const { pagina: p, red, solicitudes } = await abrir(t);
  assert.equal(await p.locator('#velocidadUnidad').count(), 1);
  assert.equal(await p.locator('#unidadCirculacion option[value="todas"]').textContent(), 'Todos los metros');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '3');
  await aplicar(p, 5);
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [5, 5]);
  await seleccionarMetro(p, '1');
  await aplicar(p, 2);
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [2, 5]);
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '1');
  assert.match(await p.locator('#seccionMetricas').innerText(), /M-1.*Azul/s);
  await seleccionarMetro(p, 'todas');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '');
  assert.equal(await p.locator('[data-velocidad-mixta]').isVisible(), true);
  assert.equal(await p.locator('#seccionMetricas').isVisible(), false);
  const antes = solicitudes.filter(s => s.method === 'PATCH').length;
  assert.equal(await p.locator('[data-paso-ritmo="-1"]').isVisible(), false);
  assert.equal(await p.locator('[data-paso-ritmo="1"]').isVisible(), false);
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, antes);
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [2, 5]);
});

test('Escritura global parcial: informa lo persistido y recarga valores reales sin duplicar solicitudes', async t => {
  const { pagina: p, red, solicitudes } = await abrir(t, { fallaSegunda: true });
  await p.locator('#velocidadUnidad').fill('60');
  await p.locator('.simulacion-parametro-velocidad').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await p.locator('#mensajeSimulacion.error').filter({ hasText: '1 de 2' }).waitFor();
  assert.deepEqual(red.unidadesMetro.map(u => u.velocidadPromedio), [60, 3]);
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 2);
  assert.equal(await p.locator('[data-velocidad-mixta]').isVisible(), true);
  assert.equal(await p.locator('#velocidadUnidad').isEnabled(), true);
  await seleccionarMetro(p, '2');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '3');
});

test('Ejecución: validación automática, horas simuladas y selección sin permitir escrituras en marcha o pausa', async t => {
  const { pagina: p, solicitudes } = await abrir(t);
  await p.locator('#duracionSimulacion').fill('0');
  await p.locator('#formularioEjecucion button').click();
  assert.equal(solicitudes.some(s => s.path.endsWith('/ejecutar')), false);
  await p.locator('#duracionSimulacion').fill('60');
  assert.equal(await p.locator('[data-paso-ritmo="1"]').isVisible(), false);
  await p.locator('#formularioEjecucion button').click();
  await p.locator('#pausarSimulacion:not([hidden])').waitFor();
  assert.equal(await p.locator('#velocidadUnidad').isDisabled(), true);
  await seleccionarMetro(p, '1');
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '1');
  await p.locator('#pausarSimulacion').click();
  assert.equal(await p.locator('#velocidadUnidad').isDisabled(), true);
  assert.equal(await p.locator('#unidadCirculacion').isEnabled(), true);
  await p.locator('#detenerSimulacion').click();
  assert.equal(await p.locator('#velocidadUnidad').isEnabled(), true);
  assert.deepEqual(solicitudes.find(s => s.path.endsWith('/ejecutar')).body, { velocidad: 1, duracion: 60 });
  assert.ok(solicitudes.some(s => s.path.endsWith('/validacion') && s.method === 'POST'));
  assert.ok(solicitudes.some(s => s.path.endsWith('/guardar') && s.method === 'POST'));
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 0);
});

for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [768, 900], [390, 844], [320, 740]]) {
  test(`Panel operacional ${width}×${height}: controles compactos y sin duplicaciones`, async t => {
    const { pagina: p } = await abrir(t, { viewport: { width, height } });
    assert.equal(await p.locator('#consignaSimulacion, #objetivoConsigna, #puntuacionSimulacion').count(), 0);
    assert.equal(await p.locator('#seccionResultados, #listaResultadosSimulacion').count(), 0);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const distribucion = await p.evaluate(() => {
      const panel = document.getElementById('instrumentosSimulacion').getBoundingClientRect();
      const bloques = ['.simulacion-acciones-panel', '.simulacion-grupo-metros', '.simulacion-grupo-velocidad', '#seccionConfiguracion']
        .map(selector => document.querySelector(selector).getBoundingClientRect());
      const titulo = document.querySelector('.simulacion-grupo-velocidad > .simulacion-seccion-titulo');
      return {
        dentro: bloques.every(rect => rect.left >= panel.left && rect.right <= panel.right)
          && bloques[0].top >= panel.top && bloques.at(-1).bottom <= panel.bottom,
        ordenados: bloques.every((rect, indice) => indice === 0 || rect.top >= bloques[indice - 1].bottom),
        tituloEnLinea: titulo.scrollWidth <= titulo.clientWidth + 1,
        sobrante: panel.bottom - bloques.at(-1).bottom,
        espacios: bloques.slice(1).map((rect, indice) => rect.top - bloques[indice].bottom),
      };
    });
    assert.equal(distribucion.dentro, true);
    assert.equal(distribucion.ordenados, true);
    assert.equal(distribucion.tituloEnLinea, true);
    if (width > 1050) {
      assert.ok(distribucion.sobrante <= 2, `Espacio libre al pie: ${distribucion.sobrante}`);
      assert.ok(distribucion.espacios[0] <= 10);
      assert.ok(distribucion.espacios[2] <= 10);
      assert.ok(distribucion.espacios[1] >= distribucion.espacios[0]);
    }
    const mapa = await p.locator('#visorSimulacion').boundingBox();
    const panel = await p.locator('#instrumentosSimulacion').boundingBox();
    if (width > 1050) { assert.ok(panel.x >= mapa.x + mapa.width); assert.ok(panel.width >= 220 && panel.width <= 232); }
    else assert.ok(panel.y > mapa.y + mapa.height);
    await seleccionarMetro(p, '2');
    await p.locator('#velocidadUnidad').focus();
    assert.equal(await p.locator('#velocidadUnidad').evaluate(e => e === document.activeElement), true);
    assert.equal(await p.locator('#duracionSimulacion').getAttribute('min'), '1');
    if (process.env.METRONET_CAPTURAS_SIMULACION) await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_SIMULACION}/operacional-${width}.png`, fullPage: true });
  });
}


test('Parámetros coherentes durante preflight y reinicio con nuevas horas', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { demoraEjecucion: 250 });
  await p.getByRole('button', { name: 'Iniciar simulación', exact: true }).click();
  assert.equal(await p.locator('#duracionSimulacion').isDisabled(), true);
  assert.equal(await p.locator('[data-paso-ritmo="1"]').isDisabled(), true);
  await p.locator('#formularioEjecucion').evaluate(f => f.requestSubmit());
  await p.locator('#pausarSimulacion:not([hidden])').waitFor();
  assert.equal(solicitudes.filter(s => s.path.endsWith('/ejecutar')).length, 1);
  assert.equal(await p.locator('[data-paso-ritmo="1"]').isVisible(), false);
  assert.equal(await p.locator('#duracionSimulacion').inputValue(), '6');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '3');
  await p.locator('#detenerSimulacion').click();
  await p.locator('#duracionSimulacion').fill('8');
  await p.locator('#reiniciarSimulacion').click();
  await p.locator('#pausarSimulacion:not([hidden])').waitFor();
  assert.deepEqual(solicitudes.filter(s => s.path.endsWith('/ejecutar')).map(s => s.body), [{ velocidad: 1, duracion: 6 }, { velocidad: 1, duracion: 8 }]);
  assert.equal(await p.locator('#duracionSimulacion').inputValue(), '8');
  assert.equal(await p.locator('#velocidadUnidad').inputValue(), '3');
});


test('Numeración local y ficha clara por nivel sin usar el ID persistido como nombre', async t => {
  const { pagina: p, solicitudes, red } = await abrir(t, { ids: [206, 211], nivel: true });
  const menu = p.locator('.simulacion-configuracion-metros__desplegable');
  await menu.locator('summary').click();
  assert.equal(await menu.locator('[data-nivel-configuracion]').innerText(), 'Nivel 2');
  assert.deepEqual(await menu.locator('li').allTextContents(), [
    'Metro 1Línea AzulUV actual3 UVUT actual6 UT', 'Metro 2Línea AzulUV actual3 UVUT actual6 UT',
  ]);
  await menu.locator('summary').press('Escape');
  await p.locator('.simulacion-selector-metros > summary').click();
  await p.getByRole('button', { name: 'Metro 1 · Azul', exact: true }).click();
  assert.equal(await p.locator('#unidadCirculacion').inputValue(), '206');
  await aplicar(p, 4);
  assert.deepEqual(red.unidadesMetro.map(u => [u.idTren,u.velocidadPromedio]), [[206,4],[211,3]]);
  assert.ok(solicitudes.some(s => s.method === 'PATCH' && s.path.endsWith('/unidades/206')));
  assert.deepEqual(await p.locator('.simulacion-configuracion-metros__lista li').allTextContents(), [
    'Metro 1Línea AzulUV actual4 UVUT actual6 UT', 'Metro 2Línea AzulUV actual3 UVUT actual6 UT',
  ]);
});

test('Separación uniforme, números centrados sin spinner y acciones con colores semánticos', async t => {
  const { pagina: p } = await abrir(t);
  const medidas = await p.evaluate(() => {
    const separacion = selector => {
      const bloque = document.querySelector(selector);
      return bloque.querySelector('summary').getBoundingClientRect().top - bloque.querySelector('h3').getBoundingClientRect().bottom;
    };
    return { metros: separacion('.simulacion-grupo-metros'), ficha: separacion('.simulacion-configuracion-metros'),
      campos: [...document.querySelectorAll('#velocidadUnidad, #duracionSimulacion')].map(e => {
        const css = getComputedStyle(e);
        return { alineacion: css.textAlign, izquierda: css.paddingLeft, derecha: css.paddingRight, apariencia: css.appearance };
      }) };
  });
  assert.ok(medidas.ficha >= 4);
  assert.equal(medidas.ficha, medidas.metros);
  for (const campo of medidas.campos) {
    assert.equal(campo.alineacion, 'center');
    assert.equal(campo.izquierda, campo.derecha);
    assert.equal(campo.apariencia, 'textfield');
  }
  const velocidad = Number(await p.locator('#velocidadUnidad').inputValue());
  await p.getByRole('button', { name: 'Aumentar velocidad', exact: true }).click();
  assert.equal(Number(await p.locator('#velocidadUnidad').inputValue()), velocidad + 1);
  await p.getByRole('button', { name: 'Reducir velocidad', exact: true }).click();
  assert.equal(Number(await p.locator('#velocidadUnidad').inputValue()), velocidad);
  const duracion = Number(await p.locator('#duracionSimulacion').inputValue());
  await p.getByRole('button', { name: 'Aumentar duración', exact: true }).click();
  assert.equal(Number(await p.locator('#duracionSimulacion').inputValue()), duracion + 1);
  await p.getByRole('button', { name: 'Reducir duración', exact: true }).click();
  assert.equal(Number(await p.locator('#duracionSimulacion').inputValue()), duracion);
  async function color(selector, token) {
    await p.mouse.move(1, 1);
    await p.waitForFunction(({ selector, token }) => {
      const boton = document.querySelector(selector), muestra = document.createElement('span');
      muestra.style.backgroundColor = `var(${token})`; boton.parentElement.append(muestra);
      const coincide = getComputedStyle(boton).backgroundColor === getComputedStyle(muestra).backgroundColor;
      muestra.remove(); return coincide;
    }, { selector, token });
    const colores = await p.locator(selector).evaluate((boton, variable) => {
      const muestra = document.createElement('span');
      muestra.style.backgroundColor = `var(${variable})`;
      boton.parentElement.append(muestra);
      const valor = { actual: getComputedStyle(boton).backgroundColor, esperado: getComputedStyle(muestra).backgroundColor };
      muestra.remove(); return valor;
    }, token);
    assert.equal(colores.actual, colores.esperado);
  }
  await color('#formularioEjecucion button', '--success');
  await p.locator('#duracionSimulacion').fill('60');
  await p.locator('#formularioEjecucion button').click();
  await p.locator('#pausarSimulacion:not([hidden])').waitFor();
  await color('#detenerSimulacion', '--danger');
  await color('#reiniciarSimulacion', '--warning');
  await p.locator('#detenerSimulacion').click();
  assert.equal(await p.locator('#detenerSimulacion').isDisabled(), true);
  await color('#formularioEjecucion button', '--success');
});

for (const width of [1440, 390]) test(`Ficha por Metro a ${width}px: nivel centrado y línea sin etiqueta duplicada`, async t => {
  const { pagina: p } = await abrir(t, { nivel: true, nombreLinea: 'Línea 01', viewport: { width, height: 900 } });
  const menu = p.locator('.simulacion-configuracion-metros__desplegable');
  await menu.locator('summary').click();
  assert.equal(await menu.locator('[data-nivel-configuracion]').innerText(), 'Nivel 2');
  assert.equal(await menu.locator('[data-nivel-configuracion]').evaluate(e => getComputedStyle(e).textAlign), 'center');
  assert.deepEqual(await menu.locator('[data-linea-metro]').allTextContents(), ['Línea 01', 'Línea 01']);
  assert.deepEqual(await menu.locator('li').first().locator('dt').allTextContents(), ['UV actual', 'UT actual']);
  assert.equal((await menu.locator('li').first().innerText()).match(/Línea/g).length, 1);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const caja = await menu.locator('.simulacion-configuracion-metros__lista').boundingBox();
  assert.ok(caja.x >= 0 && caja.x + caja.width <= width);
  if (process.env.METRONET_CAPTURAS_FICHA) await p.screenshot({ path: `${process.env.METRONET_CAPTURAS_FICHA}/metronet-ficha-${width}.png` });
});
