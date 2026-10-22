const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

for (const rechazada of [false, true]) test(`Eliminar usuario: ${rechazada ? 'un rechazo conserva la cuenta' : 'la confirmación conserva la posición de la tabla'}`, async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  let eliminados = false, lecturas = 0;
  const usuarios = [7, 8].map(idUsuario => ({ idUsuario, nombre: `Usuario ${idUsuario}`, email: `usuario${idUsuario}@example.test`, rol: 'JUGADOR' }));
  const v = await abrirPantalla(navegador, '/admin.html', { contenedor: true, responder: async r => {
    const ruta = new URL(r.url()).pathname;
    if (ruta === '/api/admin/usuarios') {
      if (++lecturas > 1) await new Promise(resolve => setTimeout(resolve, 300));
      return { json: eliminados ? usuarios.slice(1) : usuarios };
    }
    if (ruta === '/api/admin/usuarios/7' && r.method() === 'DELETE') {
      eliminados = !rechazada;
      return rechazada ? { status: 409, json: { detail: 'No se puede eliminar esta cuenta.' } } : { status: 204 };
    }
  } });
  t.after(() => v.contexto.close());
  const f = v.vista;
  await f.evaluate(() => {
    window.posicionesTabla = [];
    window.medirTabla = true;
    const medir = () => {
      posicionesTabla.push(document.querySelector('#tablaUsuarios').closest('table').getBoundingClientRect().top);
      if (medirTabla) requestAnimationFrame(medir);
    };
    medir();
  });
  await f.locator('[data-eliminar-usuario="7"]').click();
  await f.locator('.metronet-dialogo-sistema button[value="aceptar"]').click();
  if (rechazada) {
    await f.getByText('No se puede eliminar esta cuenta.', { exact: true }).waitFor();
    assert.equal(await f.locator('[data-eliminar-usuario="7"]').count(), 1);
  } else {
    await f.locator('[data-eliminar-usuario="7"]').waitFor({ state: 'detached' });
    const posiciones = await f.evaluate(() => { medirTabla = false; return posicionesTabla; });
    assert.ok(Math.max(...posiciones) - Math.min(...posiciones) < 1, JSON.stringify(posiciones));
  }
  assert.equal(lecturas, 1, 'La respuesta DELETE confirmada evita recargar toda la lista');
  assert.equal(await f.locator('[data-eliminar-usuario="8"]').count(), 1);
  assert.deepEqual(v.errores, []);
});
