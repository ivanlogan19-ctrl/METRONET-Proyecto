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
  const vista = await abrirPantalla(navegador, ruta, { ...opciones, responder: async solicitud => {
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
    assert.match(await pagina.locator('.metronet-inicio__tarjeta--progreso').innerText(), /1 de 3 niveles/);
    assert.equal(await pagina.getByRole('button', { name: 'Continuar', exact: true }).count(), 1);
    assert.equal(await pagina.locator('.metronet-inicio__tarjeta--continuar h2').textContent(), 'Nivel 2 · Conexiones');
    assert.equal(await pagina.locator('.metronet-inicio__accesos a').first().getAttribute('href'), '/escenarios.html');
    assert.equal(await pagina.locator('.metronet-inicio__accesos a').last().getAttribute('href'), '/simulacion.html');
    assert.equal(await pagina.locator('.metronet-inicio__accesos a').nth(1).getAttribute('aria-disabled'), 'true');
    assert.equal(await pagina.getByRole('button', { name: /Modo Libre/ }).count(), 0);
    assert.equal(await pagina.locator('.metronet-navegacion a[href="/admin.html"]').count(), 0);
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });

  test(`Niveles visibles, detalle accesible y bloqueo intacto / ${width}`, async t => {
    const { pagina } = await abrir(t, '/escenarios.html', { viewport: { width, height: 900 } });
    assert.equal(await pagina.locator('#progresoEscenarios').count(), 0);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').count(), 4);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().locator('h2').textContent(), '1 · Red inicial');
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').nth(1).getByRole('button', { name: 'Continuar' }).isEnabled(), true);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').nth(2).getByRole('button', { name: 'Bloqueado' }).isDisabled(), true);
    assert.equal(await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().getByRole('button', { name: 'Volver a jugar' }).isEnabled(), true);
    const detalle = pagina.locator('.metronet-escenarios-pagina__tarjeta').first().locator('details');
    await detalle.locator('summary').focus();
    await pagina.keyboard.press('Enter');
    assert.equal(await detalle.evaluate(elemento => elemento.open), true);
    assert.match(await detalle.innerText(), /Ubicá dos estaciones y conectalas/);
    assert.match(await detalle.innerText(), /Intentos: 2/);
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
}

test('Administración agrupa solo parámetros existentes y guarda mediante API simulada', async t => {
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
  assert.deepEqual(await pagina.locator('.admin-configuracion-grupo > h2').evaluateAll(elementos => elementos.map(elemento => elemento.textContent)), ['Experiencia del jugador', 'Operación']);
  assert.equal(await pagina.locator('.admin-configuracion-item').count(), 2);
  assert.equal(await pagina.locator('#configuracion-capacidad_unidad, [data-guardar-configuracion="capacidad_unidad"]').count(), 0);
  assert.equal(await pagina.locator('#vista-configuracion > h2').count(), 0);
  assert.match(await pagina.locator('.admin-configuracion-grupo').first().innerText(), /jugador puede/);
  await pagina.locator('#configuracion-velocidad_simulacion').selectOption('2');
  await pagina.locator('[data-guardar-configuracion="velocidad_simulacion"]').click();
  await pagina.getByText('Configuración actualizada correctamente.').waitFor();
  assert.equal(valores.get('velocidad_simulacion'), '2');
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
