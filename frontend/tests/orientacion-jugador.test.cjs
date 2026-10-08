const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

const escenarios = [
  { idEscenario: 1, numero: 1, nombre: 'Nivel 1 · Red inicial', objetivo: 'Creá una línea.', instrucciones: 'Ubicá dos estaciones y conectalas.', estado: 'COMPLETADO', desbloqueado: true, progreso: 100, cantidadIntentos: 2, puntajeMaximo: 100 },
  { idEscenario: 2, numero: 2, nombre: 'Nivel 2 · Conexiones', objetivo: 'Uní tres estaciones.', instrucciones: 'Agregá dos conexiones.', estado: 'EN_DESARROLLO', desbloqueado: true, progreso: 35, cantidadIntentos: 1, puntajeMaximo: 100 },
  { idEscenario: 3, numero: 3, nombre: 'Nivel 3 · Unidades', objetivo: 'Asigná una unidad.', instrucciones: 'Construí una red válida.', estado: 'BLOQUEADO', desbloqueado: false, progreso: 0, cantidadIntentos: 0, puntajeMaximo: 100 },
  { idEscenario: 4, numero: null, nombre: 'Modo Libre', objetivo: 'Creá tu red.', instrucciones: 'Usá todas las herramientas.', estado: 'BLOQUEADO', desbloqueado: false },
];
const progreso = { escenarios, cantidadNiveles: 3, nivelesCompletados: 1, modoLibreDesbloqueado: false, campanaCompletada: false };

async function abrir(t, ruta, opciones = {}) {
  const { navegadorPrueba = navegador, ...opcionesPantalla } = opciones;
  const vista = await abrirPantalla(navegadorPrueba, ruta, { ...opcionesPantalla, responder: async solicitud => {
    if (new URL(solicitud.url()).pathname === '/api/juego/progreso') return { json: opciones.progreso ?? progreso };
    return opciones.responder?.(solicitud);
  } });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  return vista;
}

test('Inicio ofrece Jugar para un nivel disponible sin intento', async t => {
  const disponible = { ...progreso, escenarios: escenarios.map(escenario => escenario.numero === 2 ? { ...escenario, estado: 'DISPONIBLE', progreso: 0 } : escenario) };
  const { pagina } = await abrir(t, '/inicio.html', { progreso: disponible });
  assert.equal(await pagina.getByRole('button', { name: 'Jugar', exact: true }).count(), 1);
  assert.equal(await pagina.getByRole('button', { name: 'Continuar', exact: true }).count(), 0);
});

for (const [nombre, administrador, estado, etiqueta] of [
  ['jugador con logro histórico tras reinicio', false, 'DISPONIBLE', 'Jugar en Modo Libre'],
  ['administrador', true, 'EN_DESARROLLO', 'Continuar en Modo Libre'],
]) {
  test(`Inicio abre Modo Libre desbloqueado: ${nombre}`, async t => {
    const desbloqueado = { ...progreso, numeroCampanaActual: 2, campanaCompletadaHistoricamente: !administrador,
      modoLibreDesbloqueado: true, escenarios: escenarios.map(escenario => escenario.numero === null ? { ...escenario, estado, desbloqueado: true } : escenario) };
    const { pagina, solicitudes } = await abrir(t, '/inicio.html', { administrador, progreso: desbloqueado, responder: async solicitud => {
      if (new URL(solicitud.url()).pathname === '/api/juego/escenarios/4/iniciar') return { json: { idDiseno: 77, idEscenario: 4, idIntento: 15, numeroCampanaActual: 2 } };
    } });
    await pagina.route('**/?idDiseno=77*', ruta => ruta.fulfill({ contentType: 'text/html', body: '<h1>Editor de destino</h1>' }));
    const boton = pagina.getByRole('button', { name: etiqueta, exact: true });
    assert.equal(await pagina.locator('.metronet-navegacion a[href="/admin.html"]').count() > 0, administrador);
    assert.equal(await boton.isEnabled(), true);
    await boton.click();
    await pagina.waitForURL('**/?idDiseno=77&idEscenario=4&idIntento=15');
    assert.equal(solicitudes.filter(solicitud => solicitud.path === '/api/juego/escenarios/4/iniciar' && solicitud.method === 'POST').length, 1);
  });
}

for (const width of [390, 1440]) {
  test(`Inicio compacto y rutas reales / ${width}`, async t => {
    const { pagina } = await abrir(t, '/inicio.html', { viewport: { width, height: 900 } });
    assert.equal(await pagina.locator('.metronet-logo__imagen').count(), 1);
    assert.equal(await pagina.locator('.metronet-inicio__paso').count(), 0);
    assert.match(await pagina.locator('.metronet-inicio__tarjeta--progreso').innerText(), /1\/3 niveles completados/);
    assert.equal(await pagina.getByRole('button', { name: 'Continuar', exact: true }).count(), 1);
    assert.equal(await pagina.locator('.metronet-inicio__tarjeta--continuar h2').textContent(), 'Nivel 2 · Conexiones');
    assert.equal(await pagina.locator('.metronet-inicio__accesos a').first().getAttribute('href'), '/escenarios.html');
    assert.equal(await pagina.locator('.metronet-inicio__accesos a').last().getAttribute('href'), '/simulacion.html');
    const accesos = await pagina.locator('.metronet-inicio__accesos a').evaluateAll(enlaces => enlaces.map(enlace => {
      const caja = enlace.getBoundingClientRect();
      return { y: caja.y, width: caja.width, height: caja.height };
    }));
    assert.equal(new Set(accesos.map(acceso => acceso.y)).size, 1);
    assert.ok(Math.max(...accesos.map(acceso => acceso.width)) - Math.min(...accesos.map(acceso => acceso.width)) < 1);
    assert.equal(new Set(accesos.map(acceso => acceso.height)).size, 1);
    assert.equal(await pagina.locator('.metronet-inicio__accesos a').nth(1).getAttribute('aria-disabled'), null);
    assert.equal(await pagina.getByRole('button', { name: /Modo Libre/ }).count(), 0);
    assert.equal(await pagina.locator('.metronet-navegacion a[href="/admin.html"]').count(), 0);
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });

  test(`Niveles compactos sin desplegable y bloqueo intacto / ${width}`, async t => {
    const { pagina } = await abrir(t, '/escenarios.html', { viewport: { width, height: 844 }, responder: solicitud =>
      new URL(solicitud.url()).pathname === '/api/juego/escenarios/1/volver-a-jugar'
        ? { json: { idDiseno: 77, idEscenario: 1, idIntento: 123 } } : null });
    const equipo = pagina.locator('.metronet-escenarios-pagina__equipo');
    assert.match(await pagina.locator('.metronet-escenarios-pagina__encabezado').innerText(), /Ari, Sol y Dani estudian Logística.*red de metro hipotética para Montevideo/);
    const presentacion = await pagina.locator('.metronet-escenarios-pagina__presentacion').boundingBox();
    const encabezado = await pagina.locator('.metronet-escenarios-pagina__encabezado').boundingBox();
    assert.ok(Math.abs((presentacion.x + presentacion.width / 2) - (encabezado.x + encabezado.width / 2)) < 2);
    assert.deepEqual(await equipo.locator('strong').allTextContents(), ['Ari', 'Sol', 'Dani']);
    assert.deepEqual(await equipo.locator('small').allTextContents(), ['Diseño de red', 'Cobertura territorial', 'Simulación operativa']);
    assert.equal(await equipo.locator('img[alt=""]').count(), 3);
    const columnasEquipo = await equipo.evaluate(elemento => getComputedStyle(elemento).gridTemplateColumns.split(' ').length);
    assert.equal(columnasEquipo, 3);
    assert.equal(await pagina.locator('#progresoEscenarios').count(), 0);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').count(), 4);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__personaje img').count(), 3);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().locator('h2').textContent(), 'Nivel 1 · Red inicial');
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').nth(1).getByRole('button', { name: 'Continuar' }).isEnabled(), true);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').nth(2).getByRole('button', { name: 'Bloqueado' }).isDisabled(), true);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().getByRole('button', { name: 'Volver a jugar' }).isEnabled(), true);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta details').count(), 0);
    assert.equal(await pagina.getByText('Ver instrucciones y datos').count(), 0);
    assert.doesNotMatch(await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().innerText(), /Ubicá dos estaciones y conectalas|Intentos: 2/);
    assert.match(await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().innerText(), /Ari define una primera línea/);
    assert.doesNotMatch(await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().innerText(), /Creá una línea/);
    const primeraAccion = pagina.locator('.metronet-escenarios-pagina__tarjeta').first().getByRole('button', { name: 'Volver a jugar' });
    assert.equal(await primeraAccion.isVisible(), true);
    await primeraAccion.scrollIntoViewIfNeeded();
    const cajaAccion = await primeraAccion.boundingBox();
    assert.ok(cajaAccion && cajaAccion.y >= 0 && cajaAccion.y + cajaAccion.height <= 845,
      JSON.stringify({ cajaAccion, scrollY: await pagina.evaluate(() => scrollY) }));
    const reinicio = pagina.waitForRequest(solicitud => new URL(solicitud.url()).pathname === '/api/juego/escenarios/1/volver-a-jugar' && solicitud.method() === 'POST');
    await primeraAccion.click();
    await reinicio;
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
}

test('Inicio conserva tres accesos legibles a 320 px', async t => {
  const navegadorTactil = { newContext: opciones => navegador.newContext({ ...opciones, hasTouch: true }) };
  const { pagina } = await abrir(t, '/inicio.html', { viewport: { width: 320, height: 740 }, navegadorPrueba: navegadorTactil });
  const accesos = await pagina.locator('.metronet-inicio__accesos a').evaluateAll(enlaces => enlaces.map(enlace => ({
    texto: enlace.textContent.trim(), y: enlace.getBoundingClientRect().y,
    visible: enlace.getBoundingClientRect().width > 0 && enlace.getBoundingClientRect().height > 0,
    textoDentroDePantalla: (() => { const rango = document.createRange(); rango.selectNodeContents(enlace); return rango.getBoundingClientRect().right <= innerWidth; })(),
    textoSinRecorte: (() => {
      const rango = document.createRange(); rango.selectNodeContents(enlace);
      const derecha = rango.getBoundingClientRect().right;
      for (let nodo = enlace; nodo; nodo = nodo.parentElement) {
        if (/hidden|clip/.test(getComputedStyle(nodo).overflowX) && derecha > nodo.getBoundingClientRect().right + 1) return false;
      }
      return true;
    })(),
  })));
  assert.equal(accesos.length, 3);
  assert.equal(new Set(accesos.map(acceso => acceso.y)).size, 1);
  assert.deepEqual(accesos.map(acceso => acceso.texto), ['Niveles', 'Mis diseños', 'Simulaciones']);
  assert.ok(accesos.every(acceso => acceso.visible && acceso.textoDentroDePantalla && acceso.textoSinRecorte), JSON.stringify(accesos));
  assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await pagina.route('**/simulacion.html', ruta => ruta.fulfill({ contentType: 'text/html', body: '<h1>Simulaciones</h1>' }));
  await pagina.getByRole('link', { name: 'Simulaciones' }).tap();
  await pagina.waitForURL('**/simulacion.html');
});

for (const width of [320, 390, 1440]) {
  test(`Niveles justifica la introducción y preserva lectura a ${width} px`, async t => {
    const { pagina } = await abrir(t, '/escenarios.html', { viewport: { width, height: width === 320 ? 740 : 844 }, responder: solicitud =>
      new URL(solicitud.url()).pathname === '/api/juego/escenarios/1/volver-a-jugar'
        ? { json: { idDiseno: 77, idEscenario: 1, idIntento: 123 } } : null });
    const estilo = await pagina.evaluate(() => {
      const intro = document.querySelector('.metronet-escenarios-pagina__presentacion p');
      const relato = document.querySelector('.metronet-escenarios-pagina__relato');
      const titulo = document.querySelector('#tituloEscenarios').getBoundingClientRect();
      const bloque = document.querySelector('.metronet-escenarios-pagina__presentacion').getBoundingClientRect();
      return { intro: getComputedStyle(intro).textAlign, ultima: getComputedStyle(intro).textAlignLast,
        guiones: getComputedStyle(intro).hyphens, relato: getComputedStyle(relato).textAlign,
        diferenciaCentros: Math.abs((titulo.x + titulo.width / 2) - (bloque.x + bloque.width / 2)),
        desborde: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(estilo.intro, 'justify');
    assert.equal(estilo.ultima, 'left');
    assert.equal(estilo.guiones, 'auto');
    assert.equal(estilo.relato, width <= 620 ? 'left' : 'justify');
    assert.ok(estilo.diferenciaCentros < 2);
    assert.equal(estilo.desborde, false);
    if (width === 390) {
      const accion = pagina.locator('.metronet-escenarios-pagina__tarjeta').first().getByRole('button', { name: 'Volver a jugar' });
      assert.equal(await accion.isEnabled(), true);
      await accion.focus();
      assert.equal(await accion.evaluate(elemento => elemento === document.activeElement), true);
      const cajaAccion = await accion.boundingBox();
      assert.ok(cajaAccion && cajaAccion.y >= 0 && cajaAccion.y + cajaAccion.height <= 845,
        JSON.stringify({ cajaAccion, scrollY: await pagina.evaluate(() => scrollY) }));
      const reinicio = pagina.waitForRequest(solicitud => new URL(solicitud.url()).pathname === '/api/juego/escenarios/1/volver-a-jugar' && solicitud.method() === 'POST');
      await pagina.keyboard.press('Enter');
      await reinicio;
    }
  });
}

test('Privacidad nombra niveles y actividades propias sin alterar los demás datos descritos', async t => {
  const { pagina } = await abrir(t, '/privacidad.html');
  const texto = await pagina.locator('.privacy-notice').innerText();
  assert.match(texto, /diseños de redes, niveles y actividades propias, intentos y resultados de simulaciones/);
  assert.doesNotMatch(texto, /escenarios/i);
});

test('Los diez niveles cuentan capítulos distintos y dejan la misión técnica para el editor', async t => {
  const niveles = require('../src/educacion/niveles.json');
  const campana = { ...progreso, escenarios: niveles.map(nivel => ({
    ...nivel, idEscenario: nivel.numero, desbloqueado: nivel.numero === 1,
    estado: nivel.numero === 1 ? 'DISPONIBLE' : 'BLOQUEADO', progreso: 0,
  })), cantidadNiveles: 10, nivelesCompletados: 0 };
  const { pagina } = await abrir(t, '/escenarios.html', { progreso: campana });
  const tarjetas = pagina.locator('.metronet-escenarios-pagina__tarjeta');
  assert.equal(await tarjetas.count(), 10);
  const relatos = await tarjetas.locator('.metronet-escenarios-pagina__relato').allTextContents();
  assert.equal(new Set(relatos).size, 10);
  const imagenes = tarjetas.locator('.metronet-escenarios-pagina__personaje img');
  await pagina.waitForFunction(() => [...document.querySelectorAll('.metronet-escenarios-pagina__personaje img')].every(imagen => imagen.complete && imagen.naturalWidth === 32));
  assert.equal(await imagenes.count(), 10);
  assert.deepEqual(new Set(await imagenes.evaluateAll(nodos => nodos.map(nodo => new URL(nodo.src).pathname))),
    new Set(['/assets/personajes/ari.svg', '/assets/personajes/sol.svg', '/assets/personajes/dani.svg']));
  assert.equal(await imagenes.first().getAttribute('alt'), '');
  assert.match(await tarjetas.first().locator('.metronet-escenarios-pagina__personaje').innerText(), /Ari · Diseño de red/);
  assert.match(await tarjetas.nth(1).locator('.metronet-escenarios-pagina__personaje').innerText(), /Sol · Cobertura/);
  assert.match(relatos[0], /Ari.*Sol.*Dani/);
  assert.match(relatos[9], /presentación final.*red hipotética/);
  for (const [indice, relato] of relatos.entries()) {
    assert.notEqual(relato, niveles[indice].objetivo);
    assert.notEqual(relato, niveles[indice].instrucciones);
  }
  assert.equal(await tarjetas.first().getByRole('button', { name: 'Comenzar' }).isEnabled(), true);
  assert.equal(await tarjetas.nth(1).getByRole('button', { name: 'Bloqueado' }).isDisabled(), true);
});

test('Administración muestra solo mantenimiento y lo guarda mediante API simulada', async t => {
  const valores = new Map([['capacidad_unidad', '300'], ['velocidad_simulacion', '1'], ['modo_mantenimiento', 'desactivado']]);
  const { pagina, solicitudes } = await abrir(t, '/admin.html', { responder: async solicitud => {
    const ruta = new URL(solicitud.url()).pathname;
    if (ruta === '/api/admin/configuracion') return { json: [...valores].map(([clave, valor]) => ({ clave, valor, descripcion: clave })) };
    if (ruta.startsWith('/api/admin/configuracion/')) {
      const clave = ruta.split('/').at(-1), valor = solicitud.postDataJSON().valor;
      valores.set(clave, valor);
      return { json: { clave, valor } };
    }
  } });
  await pagina.locator('[data-vista="configuracion"]').click();
  await pagina.locator('.admin-configuracion-item').first().waitFor();
  assert.equal(await pagina.locator('#tituloVista').textContent(), 'Modo de mantenimiento');
  assert.equal(await pagina.locator('.admin-configuracion-grupo > h2, .admin-configuracion-grupo > p').count(), 0);
  assert.equal(await pagina.locator('.admin-configuracion-item').count(), 1);
  assert.equal(await pagina.locator('.admin-configuracion-item--mantenimiento h3').count(), 0);
  assert.equal(await pagina.locator('.admin-configuracion-item--mantenimiento p').evaluate(elemento => getComputedStyle(elemento).textAlign), 'justify');
  assert.equal(await pagina.locator('#configuracion-modo_mantenimiento').evaluate(elemento => getComputedStyle(elemento).textAlignLast), 'center');
  assert.equal(await pagina.locator('#configuracion-capacidad_unidad, [data-guardar-configuracion="capacidad_unidad"]').count(), 0);
  assert.equal(await pagina.locator('#configuracion-velocidad_simulacion, [data-guardar-configuracion="velocidad_simulacion"]').count(), 0);
  assert.equal(await pagina.locator('#vista-configuracion > h2').count(), 0);
  await pagina.locator('#configuracion-modo_mantenimiento').selectOption('activado');
  await pagina.locator('[data-guardar-configuracion="modo_mantenimiento"]').click();
  await pagina.getByText('Configuración actualizada correctamente.').waitFor();
  assert.equal(valores.get('modo_mantenimiento'), 'activado');
  assert.equal(valores.get('velocidad_simulacion'), '1');
  assert.equal(valores.get('capacidad_unidad'), '300');
  assert.equal(solicitudes.filter(s => s.method === 'PATCH').length, 1);
  assert.equal(solicitudes.some(s => s.path.endsWith('/capacidad_unidad')), false);
});

test('Administración oculta capacidad de unidades y conserva el dato interno al editar', async t => {
  const diseno = { idDiseno: 77, propietario: 'Ana Prueba', correoPropietario: 'ana@example.test', modoEscenario: 'EDICION_LIBRE' };
  const detalle = { diseno, lineas: [{ nombre: 'Azul', modificable: true }], estaciones: [], conexiones: [], tramos: [],
    unidadesMetro: [{ idTren: 5, nombreLinea: 'Azul', capacidad: 450, velocidadPromedio: 60 }] };
  const { pagina, solicitudes } = await abrir(t, '/admin.html', { responder: async solicitud => {
    const ruta = new URL(solicitud.url()).pathname;
    if (ruta === '/api/admin/disenos') return { json: [diseno] };
    if (ruta === '/api/admin/disenos/77' && solicitud.method() === 'GET') return { json: detalle };
    if (ruta === '/api/admin/disenos/77/unidades/5' && solicitud.method() === 'PATCH') {
      detalle.unidadesMetro[0].velocidadPromedio = solicitud.postDataJSON().velocidadPromedio;
      return { json: {} };
    }
    if (ruta === '/api/admin/disenos/77/unidades' && solicitud.method() === 'POST') return { json: {} };
  } });
  await pagina.locator('[data-vista="disenos"]').click();
  await pagina.locator('[data-ver-diseno="77"]').click();
  await pagina.locator('[data-accion-diseno="editar-unidad"]').waitFor();
  assert.doesNotMatch(await pagina.locator('#detalleDiseno').innerText(), /capacidad|pasajeros/i);
  await pagina.locator('[data-accion-diseno="editar-unidad"]').click();
  let dialogo = pagina.locator('.metronet-dialogo-sistema');
  await dialogo.waitFor();
  await dialogo.getByLabel('Línea asignada:').fill('Azul');
  await dialogo.getByRole('button', { name: 'Aceptar' }).click();
  dialogo = pagina.locator('.metronet-dialogo-sistema');
  await dialogo.getByLabel('Velocidad promedio (UV):').fill('75');
  const respuestaEdicion = pagina.waitForResponse(respuesta => respuesta.request().method() === 'PATCH' && respuesta.url().endsWith('/unidades/5'));
  await dialogo.getByRole('button', { name: 'Aceptar' }).click();
  await respuestaEdicion;
  const edicion = solicitudes.find(s => s.path === '/api/admin/disenos/77/unidades/5' && s.method === 'PATCH');
  assert.ok(edicion);
  assert.deepEqual(edicion.body, { nombreLinea: 'Azul', capacidad: 450, velocidadPromedio: 75 });
  assert.doesNotMatch(solicitudes.map(s => s.path).join(' '), /capacidad_unidad/);

  await pagina.locator('[data-crear-diseno="unidad"]').click();
  dialogo = pagina.locator('.metronet-dialogo-sistema');
  await dialogo.getByLabel('Nombre de la línea asignada:').fill('Azul');
  await dialogo.getByRole('button', { name: 'Aceptar' }).click();
  dialogo = pagina.locator('.metronet-dialogo-sistema');
  await dialogo.getByLabel('Velocidad (UV):').fill('80');
  const respuestaCreacion = pagina.waitForResponse(respuesta => respuesta.request().method() === 'POST' && respuesta.url().endsWith('/unidades'));
  await dialogo.getByRole('button', { name: 'Aceptar' }).click();
  await respuestaCreacion;
  const creacion = solicitudes.find(s => s.path === '/api/admin/disenos/77/unidades' && s.method === 'POST');
  assert.deepEqual(creacion.body, { nombreLinea: 'Azul', capacidad: 300, velocidadPromedio: 80 });
});
