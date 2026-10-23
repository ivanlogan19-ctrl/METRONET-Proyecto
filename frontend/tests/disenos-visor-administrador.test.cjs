const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

test('Borrar todos deja cero diseños y el siguiente empieza en uno sin reutilizar su ID', async t => {
  let redes = [{ idDiseno: 717, idUsuario: 7, estado: 'GUARDADO' }];
  const v = await abrirPantalla(navegador, '/disenos.html', { administrador: true, responder: req => {
    const path = new URL(req.url()).pathname;
    if (req.method() === 'DELETE' && path === '/api/admin/disenos/717') {
      redes = []; return { status: 204 };
    }
    if (path === '/api/simulaciones') return { json: redes };
    if (path === '/api/juego/escenarios') return { json: [] };
  } });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  await p.locator('[data-diseno="717"]').waitFor();
  assert.match(await p.locator('[data-diseno="717"]').innerText(), /Diseño 1/i);
  await p.getByRole('button', { name: 'Eliminar diseño: Diseño 1', exact: true }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await p.locator('[data-diseno="717"]').waitFor({ state: 'detached' });
  assert.equal(await p.locator('#resumenDisenosCampana').innerText(), '0 diseños');
  redes = [{ idDiseno: 950, idUsuario: 7, estado: 'GUARDADO' }];
  await p.reload();
  await p.locator('[data-diseno="950"]').waitFor();
  assert.match(await p.locator('[data-diseno="950"]').innerText(), /Diseño 1/i);
  assert.match(await p.locator('[data-diseno="950"] a').getAttribute('href'), /idDiseno=950/);
  assert.deepEqual(v.solicitudes.filter(s => s.method === 'DELETE').map(s => s.path), ['/api/admin/disenos/717']);
  assert.deepEqual(v.errores, []);
});

test('Administración renumera al borrar y no expone el identificador de actividad', async t => {
  const crear = idDiseno => ({ idDiseno, idUsuario: 8, propietario: 'Jugador de prueba',
    idEscenario: 7, nombre: 'Primer recorrido', modoEscenario: 'NIVEL' });
  let redes = [crear(714), crear(717)];
  const v = await abrirPantalla(navegador, '/admin.html', { responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/disenos') return { json: redes };
    if (req.method() === 'DELETE' && path.startsWith('/api/admin/disenos/')) {
      redes = redes.filter(d => d.idDiseno !== Number(path.split('/').pop()));
      return { status: 204 };
    }
  } });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  await p.locator('[data-vista="disenos"]').click();
  await p.locator('[data-ver-diseno="717"]').waitFor();
  assert.deepEqual(await p.locator('#listaDisenos h4').allTextContents(), ['Diseño 1', 'Diseño 2']);
  assert.doesNotMatch(await p.locator('#listaDisenos').innerText(), /Actividad #7/);
  assert.match(await p.locator('#listaDisenos').innerText(), /Primer recorrido/);
  for (const id of [714, 717]) {
    await p.locator(`[data-eliminar-diseno="${id}"]`).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await p.locator(`[data-ver-diseno="${id}"]`).waitFor({ state: 'detached' });
    assert.deepEqual(await p.locator('#listaDisenos h4').allTextContents(), id === 714 ? ['Diseño 1'] : []);
  }
  assert.match(await p.locator('#listaDisenos').innerText(), /0 diseños/);
  redes = [crear(950)];
  await p.locator('[data-vista="usuarios"]').click();
  await p.locator('[data-vista="disenos"]').click();
  await p.locator('[data-ver-diseno="950"]').waitFor();
  assert.deepEqual(await p.locator('#listaDisenos h4').allTextContents(), ['Diseño 1']);
  assert.deepEqual(v.errores, []);
});

for (const administrador of [true, false]) test(`Mis diseños consulta solo la cuenta conectada: administrador=${administrador}`, async t => {
  const v = await abrirPantalla(navegador, '/disenos.html', { administrador, responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/simulaciones') return { json: [
      { idDiseno: 77, nombre: 'Red propia', idUsuario: 7 },
      { idDiseno: 88, nombre: 'Red ajena', idUsuario: 8 },
    ] };
    if (path === '/api/juego/escenarios') return { json: [] };
  } });
  t.after(() => v.contexto.close());
  await v.pagina.locator('[data-diseno="77"]').waitFor();
  assert.equal(await v.pagina.locator('[data-diseno="88"]').count(), 0);
  assert.equal(v.solicitudes.some(s => s.path === '/api/admin/disenos'), false);
  assert.deepEqual(v.errores, []);
});

for (const vacio of [false, true]) test(`Administración abre el mapa guardado sin editarlo: vacío=${vacio}`, async t => {
  const red = {
    diseno: { idDiseno: 717, idUsuario: 8, propietario: 'Jugador de prueba', modoEscenario: 'EDICION_LIBRE' },
    estaciones: vacio ? [] : [{ nombre: 'A', posicionX: 500, posicionY: 350 }, { nombre: 'B', posicionX: 680, posicionY: 400 }],
    lineas: vacio ? [] : [{ nombre: 'L1' }],
    tramos: vacio ? [] : [{ nombreLinea: 'L1', estacionA: 'A', estacionB: 'B' }],
    conexiones: [], unidadesMetro: [],
  };
  const v = await abrirPantalla(navegador, '/admin.html', { responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/disenos') return { json: [red.diseno] };
    if (path === '/api/admin/disenos/717') return { json: red };
  } });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  await p.locator('[data-vista="disenos"]').click();
  for (let apertura = 0; apertura < 2; apertura++) {
    await p.locator('[data-ver-diseno="717"]').click();
    const visor = p.getByRole('dialog', { name: 'Diseño 1' });
    await visor.locator('[data-cargado="true"] canvas').waitFor();
    assert.equal(await p.locator('[data-crear-diseno]').count(), 0);
    assert.doesNotMatch(await visor.innerText(), /estaciones|metros|Solo lectura|Cargando mapa/i);
    assert.equal(await visor.getByRole('status').isVisible(), false);
    assert.equal(await visor.getByRole('button', { name: 'Cerrar', exact: true }).getAttribute('data-categoria-accion'), 'peligro');
    await visor.getByRole('button', { name: 'Acercar mapa', exact: true }).click();
    await p.setViewportSize({ width: 1280, height: 720 });
    assert.equal(await visor.evaluate(e => {
      const r = e.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && e.scrollHeight <= e.clientHeight;
    }), true);
    if (!vacio && apertura === 0) await visor.screenshot({ path: '/tmp/metronet-visor-diseno-administrador.png' });
    await visor.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await visor.waitFor({ state: 'detached' });
    assert.equal(await p.locator('canvas').count(), 0);
  }
  assert.equal(v.solicitudes.some(s => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(s.method)), false);
  assert.equal(v.solicitudes.some(s => s.path === '/api/simulaciones/717'), false);
  assert.deepEqual(v.errores, []);
});
