const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
function progreso(completados = 4) {
  return { numeroCampanaActual: 1, cantidadNiveles: 10, nivelesCompletados: completados,
    campanaCompletada: completados === 10, modoLibreDesbloqueado: completados === 10,
    escenarios: niveles.map(n => ({ ...n, idEscenario: 100 + n.numero,
      estado: n.numero <= completados ? 'COMPLETADO' : n.numero === completados + 1 ? 'DISPONIBLE' : 'BLOQUEADO',
      desbloqueado: n.numero <= completados + 1, progreso: n.numero <= completados ? 100 : 0,
      completadoEnCampanaActual: n.numero <= completados, cantidadIntentos: n.numero <= completados ? 1 : 0,
      ultimoPuntaje: n.numero <= completados ? 100 : null,
    })) };
}
async function abrir(t, ruta = '/escenarios.html', opciones = {}) {
  const resumen = opciones.progreso ?? progreso();
  const resultado = await abrirPantalla(navegador, ruta, { ...opciones, responder: async req => {
    if (opciones.responder) { const r = await opciones.responder(req); if (r) return r; }
    if (new URL(req.url()).pathname.startsWith('/api/juego/') && !req.url().endsWith('/consigna')) {
      if (req.method() === 'POST') return { json: { idDiseno: 200, idIntento: 300, idEscenario: Number(req.url().split('/').at(-2)), estado: 'EN_DESARROLLO' } };
      return { json: resumen };
    }
  } });
  t.after(() => resultado.contexto.close());
  t.after(() => assert.deepEqual(resultado.errores, []));
  await resultado.pagina.route('**/?idDiseno=200*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Constructor de destino</h1>' }));
  return resultado;
}
for (const width of [1440, 768, 390]) {
  test(`Administración ${width}: una marca estructural y navegación conservada`, async t => {
    const { pagina } = await abrir(t, '/admin.html', { viewport: { width, height: 900 } });
    assert.equal(await pagina.locator('.metronet-logo__imagen').count(), 1);
    assert.equal(await pagina.locator('.admin-menu [data-metronet-logo]').count(), 0);
    await pagina.locator('[data-vista="configuracion"]').click();
    await pagina.locator('#vista-configuracion.activa').waitFor();
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  });
  test(`Campaña y transición ${width}: diez niveles, contenido contextual y controles accesibles`, async t => {
    const { pagina, solicitudes } = await abrir(t, '/escenarios.html', { viewport: { width, height: 900 } });
    assert.equal(await pagina.locator('#progresoEscenarios > li').count(), 10);
    assert.match(await pagina.locator('#descripcionProgresoEscenarios').innerText(), /4 de 10/);
    await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
    const dialogo = pagina.getByRole('dialog', { name: niveles[4].nombre, exact: true });
    await dialogo.waitFor();
    assert.equal(await pagina.locator('.metronet-victoria').count(), 0);
    assert.match(await dialogo.innerText(), /Nivel 5.*Lugares y barrios/i);
    assert.equal(await dialogo.evaluate(d => d.scrollWidth > d.clientWidth), false);
    assert.equal(await pagina.evaluate(() => document.activeElement.id), 'tituloPreparacionNivel');
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await pagina.waitForURL('**/?idDiseno=200&idEscenario=105&idIntento=300');
    assert.equal(solicitudes.filter(r => r.method === 'POST').length, 1);
  });
}
for (const completados of [0, 5, 8, 9]) {
  test(`Acceso al nivel ${completados + 1}: preparación/transición y destino real`, async t => {
    const { pagina } = await abrir(t, '/escenarios.html', { progreso: progreso(completados) });
    await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await pagina.waitForURL(`**/?idDiseno=200&idEscenario=${101 + completados}&idIntento=300`);
  });
}
test('Cancelación, recarga, repetición y reanudación no adelantan ni duplican intentos', async t => {
  const resumen = progreso(9);
  const { pagina, solicitudes } = await abrir(t, '/escenarios.html', { progreso: resumen });
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await pagina.getByRole('dialog').waitFor();
  await pagina.keyboard.press('Escape');
  await pagina.getByRole('dialog').waitFor({ state: 'detached' });
  await pagina.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Comenzar' && !b.disabled));
  assert.equal(await pagina.getByRole('button', { name: 'Comenzar', exact: true }).isEnabled(), true);
  await pagina.reload();
  assert.match(await pagina.locator('#descripcionProgresoEscenarios').innerText(), /9 de 10/);
  assert.equal(solicitudes.filter(r => r.method === 'POST').length, 1);
  await pagina.getByRole('button', { name: 'Volver a jugar', exact: true }).first().click();
  await pagina.getByRole('dialog', { name: niveles[0].nombre }).waitFor();
  await pagina.keyboard.press('Escape');
  resumen.escenarios[9].estado = 'EN_DESARROLLO';
  await pagina.reload();
  await pagina.getByRole('button', { name: 'Continuar', exact: true }).click();
  await pagina.getByRole('dialog', { name: niveles[9].nombre }).waitFor();
  await pagina.waitForURL('**/?idDiseno=200&idEscenario=110&idIntento=300');
});
test('Resultado del nivel 10 muestra final válido y no solicita un nivel 11', async t => {
  const resumen = progreso(10);
  const { pagina, solicitudes } = await abrir(t, '/escenarios.html', { progreso: resumen });
  assert.match(await pagina.locator('#descripcionProgresoEscenarios').innerText(), /Campaña completada.*10 de 10/);
  await pagina.evaluate(async resumen => {
    const { presentarResultadoNivel } = await import('/src/educacion/TransicionNivel.js');
    window.resultadoTransicion = presentarResultadoNivel(resumen, 110, { completado: true, puntaje: 100, idSiguienteEscenario: null });
  }, resumen);
  await pagina.getByRole('dialog', { name: 'Nivel final completado', exact: true }).waitFor();
  assert.equal(await pagina.getByText('Continuar con Nivel 11').count(), 0);
  await pagina.getByRole('button', { name: 'Ver desempeño y ranking' }).waitFor();
  await pagina.getByRole('button', { name: 'Seleccionar nivel' }).click();
  assert.deepEqual(await pagina.evaluate(() => window.resultadoTransicion), { destino: '/escenarios.html' });
  assert.equal(solicitudes.filter(r => r.method === 'POST').length, 0);
});
test('Sin datos educativos usa una transición genérica; fallo de módulo no bloquea navegación', async t => {
  const { pagina } = await abrir(t);
  await pagina.evaluate(async () => {
    const { mostrarTransicionNivel } = await import('/src/educacion/PantallaTransicionNivel.js');
    window.transicionDesconocida = mostrarTransicionNivel({ numero: 97, nombre: 'Desafío externo' }, { numero: 98, nombre: 'Siguiente externo' });
  });
  assert.match(await pagina.getByRole('dialog').innerText(), /Siguiente externo/);
  assert.equal(await pagina.evaluate(() => window.transicionDesconocida), 'siguiente');
  await pagina.route('**/educacion/PantallaTransicionNivel.js*', route => route.abort());
  await pagina.reload();
  await pagina.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await pagina.waitForURL('**/?idDiseno=200&idEscenario=105&idIntento=300');
});
test('Un progreso mal formado produce estado recuperable sin errores de JavaScript', async t => {
  const contexto = await navegador.newContext(); t.after(() => contexto.close());
  await contexto.addInitScript(() => localStorage.setItem('sesionUsuario', JSON.stringify({ token: 'prueba', usuario: { nombre: 'Prueba', rol: 'JUGADOR' } })));
  const pagina = await contexto.newPage(); const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.route('**/api/juego/**', route => route.fulfill({ json: { escenarios: null } }));
  await pagina.goto('http://127.0.0.1:5173/escenarios.html');
  await pagina.getByText('Escenarios no disponibles', { exact: true }).waitFor();
  assert.deepEqual(errores, []);
});
for (const numero of [4, 10]) test(`Simulación real en Phaser: completar nivel ${numero} abre la transición y conserva su destino`, async t => {
  const red = {
    simulacion: { idDiseno: 77, idEscenario: 100 + numero, nombre: niveles[numero - 1].nombre, modo: 'NIVEL', estado: 'VALIDADO', objetivo: niveles[numero - 1].objetivo },
    estaciones: [{ nombre: 'A', posicionX: 580, posicionY: 470 }, { nombre: 'B', posicionX: 700, posicionY: 460 }],
    lineas: [{ nombre: 'Azul' }], tramos: [{ nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B' }],
    unidadesMetro: [{ idTren: 1, nombreLinea: 'Azul', capacidad: 300, velocidadPromedio: 40 }],
    preparadoParaSimular: true, observacionesSimulacion: [], resultados: [], territorio: { areas: [], errores: [] },
  };
  const { pagina, solicitudes } = await abrir(t, '/simulacion.html?idDiseno=77', {
    progreso: progreso(numero),
    responder: async req => {
      const path = new URL(req.url()).pathname;
      if (path === '/api/simulaciones') return { json: [red.simulacion] };
      if (path === '/api/simulaciones/77') return { json: red };
      if (path.endsWith('/ejecutar')) return { json: { idSimulacion: 1, puntaje: 85, estado: 'COMPLETADA', duracion: 10, velocidad: 4 } };
      if (path.endsWith('/evaluar')) return { json: { completado: true, puntaje: 100, progreso: 100, idSiguienteEscenario: numero === 10 ? null : 105, mensaje: 'Nivel completado' } };
    },
  });
  await pagina.locator('#seccionConfiguracion > summary').click();
  await pagina.locator('#duracionSimulacion').fill('10');
  await pagina.locator('[data-velocidad="4"]').click();
  await pagina.locator('#formularioEjecucion button[type="submit"]').click();
  await pagina.getByRole('dialog', { name: numero === 10 ? 'Nivel final completado' : 'Nivel completado', exact: true }).waitFor();
  assert.equal(solicitudes.filter(s => s.path.endsWith('/evaluar')).length, 1);
  assert.equal(await pagina.locator('.metronet-viaje').count(), 0);
  if (numero === 10) {
    await pagina.getByRole('button', { name: 'Ver desempeño y ranking' }).waitFor();
    await pagina.getByRole('button', { name: 'Seleccionar nivel' }).click();
    await pagina.waitForURL('**/escenarios.html');
    assert.match(await pagina.locator('#descripcionProgresoEscenarios').innerText(), /10 de 10/);
    assert.equal(solicitudes.filter(s => /escenarios\/\d+\/iniciar/.test(s.path)).length, 0);
  } else await pagina.waitForURL('**/?idDiseno=200&idEscenario=105&idIntento=300');
});
