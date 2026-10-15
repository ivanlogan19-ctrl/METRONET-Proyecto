const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');

let navegador;
const base = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

test('Administración confirma y borra una entrada o todo el registro', async t => {
  const contexto = await navegador.newContext({ reducedMotion: 'reduce' });
  t.after(() => contexto.close());
  await contexto.route('**/iniciar-contenedor.js', ruta => ruta.fulfill({ contentType: 'application/javascript', body: '' }));
  await contexto.addInitScript(() => {
    localStorage.setItem('sesionAdministrador', JSON.stringify({
      token: 'sesion-aislada-de-prueba',
      usuario: { idUsuario: 900, nombre: 'Alex', apellido: 'Prueba', rol: 'ADMIN' },
    }));
    localStorage.setItem('metronet:musica:preferencias', JSON.stringify({ silenciado: true }));
  });
  const actividades = [
    { idActividad: 501, fecha: '2026-10-06T11:30:00Z', administrador: 'Alex', accion: 'Publicación', detalle: 'Nivel 1' },
    { idActividad: 502, fecha: '2026-10-06T12:15:00Z', administrador: 'Alex', accion: 'Rol', detalle: 'Usuario 7' },
  ];
  const eliminaciones = [];
  await contexto.route('**/api/**', ruta => {
    const { pathname } = new URL(ruta.request().url());
    const metodo = ruta.request().method();
    if (metodo === 'OPTIONS') return ruta.fulfill({ status: 204 });
    if (pathname === '/api/admin/usuarios') return ruta.fulfill({ json: [] });
    if (pathname === '/api/admin/actividades' && metodo === 'GET') return ruta.fulfill({ json: actividades });
    if (pathname.startsWith('/api/admin/actividades') && metodo === 'DELETE') {
      eliminaciones.push(pathname);
      if (pathname === '/api/admin/actividades') actividades.length = 0;
      else {
        const id = Number(pathname.split('/').at(-1));
        const indice = actividades.findIndex(actividad => actividad.idActividad === id);
        if (indice >= 0) actividades.splice(indice, 1);
      }
      return ruta.fulfill({ status: 204, body: '' });
    }
    return ruta.fulfill({ json: [] });
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', error => errores.push(error.message));
  t.after(() => assert.deepEqual(errores, []));
  await pagina.goto(`${base}/admin.html?documento=1`);
  await pagina.getByRole('button', { name: 'Actividad', exact: true }).click();
  await pagina.locator('[data-borrar-actividad="501"]').waitFor();
  await pagina.locator('[data-borrar-actividad="501"]').click();
  assert.equal(await pagina.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).getAttribute('data-categoria-accion'), 'principal');
  await pagina.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  assert.deepEqual(eliminaciones, []);
  await pagina.locator('[data-borrar-actividad="501"]').click();
  await pagina.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  await pagina.locator('[data-borrar-actividad="501"]').waitFor({ state: 'detached' });
  assert.equal(await pagina.getByText('Entrada de actividad borrada.').count(), 0);
  assert.deepEqual(eliminaciones, ['/api/admin/actividades/501']);
  await pagina.getByRole('button', { name: 'Eliminar todo' }).click();
  assert.equal(await pagina.getByRole('dialog').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(120, 30, 50)');
  await pagina.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  await pagina.locator('#mensajeActividad').filter({ hasText: 'Todavía no hay actividad registrada.' }).waitFor();
  assert.equal(await pagina.getByText('Registro de actividad borrado.').count(), 0);
  assert.deepEqual(eliminaciones, ['/api/admin/actividades/501', '/api/admin/actividades']);
  assert.equal(await pagina.getByRole('button', { name: 'Eliminar todo' }).isDisabled(), true);
});
