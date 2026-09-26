const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const datos = () => [
  { idDiseno: 77, idUsuario: 7, nombre: 'Red propia', propietario: 'Ana Prueba', estado: 'GUARDADO', idEscenario: 45 },
  { idDiseno: 88, idUsuario: 8, nombre: 'Nivel completado', propietario: 'Otro Jugador', estado: 'COMPLETADO', idEscenario: 1 },
];
async function abrir(t, opciones = {}) {
  let redes = datos();
  const v = await abrirPantalla(navegador, '/disenos.html', {
    administrador: opciones.administrador ?? true,
    viewport: opciones.viewport,
    responder: async req => {
      const path = new URL(req.url()).pathname;
      const especial = await opciones.responder?.(req, redes);
      if (especial) return especial;
      if (path === '/api/admin/disenos' || path === '/api/simulaciones') return { json: redes };
      if (path === '/api/juego/escenarios') return { json: [{ idEscenario: 45, numero: null, desbloqueado: true }, { idEscenario: 1, numero: 1 }] };
      if (req.method() === 'DELETE') { redes = redes.filter(d => d.idDiseno !== Number(path.split('/').pop())); return { status: 204 }; }
    },
  });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  await v.pagina.locator('#listaMisDisenos[aria-busy=false]').waitFor({ state: 'attached' });
  return { ...v, quitar: id => { redes = redes.filter(d => d.idDiseno !== id); } };
}
async function confirmar(pagina, nombre) {
  await pagina.getByRole('button', { name: `Eliminar diseño: ${nombre}`, exact: true }).click();
  await pagina.locator('dialog').getByRole('button', { name: 'Eliminar diseño', exact: true }).click();
}

for (const width of [1440, 320]) test(`ADMIN ${width}: propietarios, borrado propio/ajeno/completado y persistencia al recargar`, async t => {
  const v = await abrir(t, { viewport: { width, height: 900 } }); const p = v.pagina;
  assert.equal(await p.locator('[data-diseno]').count(), 2);
  assert.match(await p.locator('[data-diseno="88"]').innerText(), /Otro Jugador/);
  assert.equal(await p.locator('[data-diseno="88"] a').count(), 0);
  assert.equal(await p.locator('[data-diseno="77"] a').count(), 2);
  assert.equal(await p.locator('#crearDiseno').isVisible(), true);
  await p.getByRole('searchbox', { name: 'Buscar diseños' }).fill('otro');
  assert.equal(await p.locator('[data-diseno]').count(), 1);
  await p.getByRole('button', { name: 'Eliminar diseño: Nivel completado' }).click();
  assert.match(await p.locator('#nombreEliminarDiseno').innerText(), /Otro Jugador/);
  assert.match(await p.locator('#alcanceEliminarDiseno').innerText(), /intento, puntaje y resultados/);
  await p.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(v.solicitudes.filter(s => s.method === 'DELETE').length, 0);
  await confirmar(p, 'Nivel completado'); await p.getByText('Diseño eliminado.', { exact: true }).waitFor();
  assert.equal(await p.locator('[data-diseno="88"]').count(), 0);
  await p.locator('#buscarDisenos').fill('');
  await p.reload(); await p.locator('#listaMisDisenos[aria-busy=false]').waitFor({ state: 'attached' });
  assert.equal(await p.locator('[data-diseno="88"]').count(), 0);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (width === 1440) await p.screenshot({ path: '/tmp/metronet-disenos-admin.png', fullPage: true });
  await confirmar(p, 'Red propia'); await p.getByText('Diseño eliminado.', { exact: true }).waitFor();
  assert.equal(await p.locator('[data-diseno]').count(), 0);
  assert.deepEqual(v.solicitudes.filter(s => s.method === 'DELETE').map(s => s.path), ['/api/admin/disenos/88', '/api/admin/disenos/77']);
});

test('Jugador: conserva endpoint propio y protección de niveles', async t => {
  const v = await abrir(t, { administrador: false }); const p = v.pagina;
  assert.equal(await p.getByRole('button', { name: 'Eliminar diseño: Nivel completado' }).isDisabled(), true);
  await confirmar(p, 'Red propia'); await p.getByText('Diseño eliminado.', { exact: true }).waitFor();
  assert.equal(v.solicitudes.some(s => s.path.startsWith('/api/admin/disenos')), false);
  assert.deepEqual(v.solicitudes.filter(s => s.method === 'DELETE').map(s => s.path), ['/api/simulaciones/77']);
});

test('404 retira el registro que otro administrador ya eliminó; 500 lo conserva', async t => {
  let codigo = 500;
  const v = await abrir(t, { responder: req => req.method() === 'DELETE' ? { status: codigo, json: { detail: 'Error de prueba' } } : null }); const p = v.pagina;
  await confirmar(p, 'Red propia'); await p.getByText('Error de prueba', { exact: true }).waitFor();
  assert.equal(await p.locator('[data-diseno="77"]').count(), 1);
  assert.equal(await p.getByRole('button', { name: 'Eliminar diseño: Red propia' }).isDisabled(), false);
  codigo = 404; await confirmar(p, 'Red propia'); await p.getByText('Este diseño ya no existe. Se actualizó la lista.', { exact: true }).waitFor();
  assert.equal(await p.locator('[data-diseno="77"]').count(), 0);
});

test('Regreso por historial y retorno a pestaña refrescan diseños eliminados externamente', async t => {
  const v = await abrir(t); const p = v.pagina;
  v.quitar(88);
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await p.locator('[data-diseno="88"]').waitFor({ state: 'detached' });
  v.quitar(77);
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.locator('[data-diseno="77"]').waitFor({ state: 'detached' });
  assert.equal(await p.locator('[data-diseno]').count(), 0);
});

test('Una carga antigua no resucita un diseño borrado y el doble submit no duplica DELETE', async t => {
  let liberar, avisar; let lectura = 0;
  const pendiente = new Promise(resolve => { avisar = resolve; });
  const v = await abrir(t, { responder: async (req, redes) => {
    if (new URL(req.url()).pathname === '/api/admin/disenos' && ++lectura === 2) {
      const copia = structuredClone(redes); avisar(); await new Promise(resolve => { liberar = resolve; }); return { json: copia };
    }
  } }); const p = v.pagina;
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await pendiente;
  await p.getByRole('button', { name: 'Eliminar diseño: Red propia' }).click();
  await p.locator('dialog button[value="eliminar"]').evaluate(b => { b.click(); b.click(); });
  await p.getByText('Diseño eliminado.', { exact: true }).waitFor();
  liberar(); await p.locator('#listaMisDisenos[aria-busy=false]').waitFor({ state: 'attached' });
  assert.equal(await p.locator('[data-diseno="77"]').count(), 0);
  assert.equal(v.solicitudes.filter(s => s.method === 'DELETE').length, 1);
});

test('Error de listado administrativo muestra reintento sin reemplazarlo por permisos de jugador', async t => {
  let falla = true;
  const v = await abrir(t, { responder: req => new URL(req.url()).pathname === '/api/admin/disenos' && falla ? { status: 503, json: { detail: 'Servicio no disponible' } } : null }); const p = v.pagina;
  assert.equal(await p.locator('[data-diseno]').count(), 0);
  assert.equal(await p.getByRole('button', { name: 'Volver a cargar' }).isVisible(), true);
  falla = false; await p.getByRole('button', { name: 'Volver a cargar' }).click(); await p.locator('[data-diseno="88"]').waitFor();
  assert.equal(v.solicitudes.some(s => s.path === '/api/simulaciones'), false);
});

test('Administración: misma advertencia y retirada inmediata sin depender de otra carga', async t => {
  let redes = datos();
  const v = await abrirPantalla(navegador, '/admin.html', { responder: req => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/disenos') return { json: redes };
    if (path === '/api/admin/disenos/88' && req.method() === 'DELETE') { redes = redes.filter(d => d.idDiseno !== 88); return { status: 204 }; }
  } });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  const p = v.pagina;
  await p.locator('[data-vista="disenos"]').click();
  await p.locator('[data-eliminar-diseno="88"]').click();
  assert.match(await p.locator('dialog[open]').innerText(), /intento, puntaje y resultados/);
  await p.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await p.getByText('Diseño eliminado correctamente.', { exact: true }).waitFor();
  assert.equal(await p.locator('[data-eliminar-diseno="88"]').count(), 0);
  assert.equal(await p.locator('[data-eliminar-diseno="77"]').count(), 1);
});
