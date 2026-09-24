// Regresión de las ventanas HTML que reemplazan confirm/prompt del navegador.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
function registrar(t, pantalla) {
  t.after(async () => { await pantalla.contexto.close(); assert.deepEqual(pantalla.errores, []); });
  pantalla.pagina.on('dialog', async dialogo => { await dialogo.dismiss(); assert.fail('No deben abrirse confirmaciones nativas'); });
  return pantalla;
}

test('Escape y Cancelar preservan usuario y foco; aceptar mantiene DELETE y muestra error del servidor', async t => {
  const { pagina, solicitudes } = registrar(t, await abrirPantalla(navegador, '/admin.html'));
  const boton = pagina.locator('[data-eliminar-usuario]').first();
  const dialogo = pagina.locator('.metronet-dialogo-sistema');
  for (const cancelar of ['Escape', 'Cancelar']) {
    await boton.click(); await dialogo.waitFor();
    assert.equal(await dialogo.getByRole('button', { name: 'Cancelar' }).evaluate(e => e === document.activeElement), true);
    await pagina.keyboard.press('Tab');
    assert.equal(await dialogo.getByRole('button', { name: 'Aceptar' }).evaluate(e => e === document.activeElement), true);
    await pagina.keyboard.press('Tab');
    assert.equal(await dialogo.getByRole('button', { name: 'Cancelar' }).evaluate(e => e === document.activeElement), true);
    if (cancelar === 'Escape') await pagina.keyboard.press('Escape');
    else await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await dialogo.waitFor({ state: 'detached' });
    assert.equal(await boton.evaluate(e => e === document.activeElement), true);
    assert.equal(solicitudes.filter(s => s.method === 'DELETE').length, 0);
  }
  await boton.click(); await dialogo.getByRole('button', { name: 'Aceptar' }).click();
  await pagina.locator('#mensajeAdministracion.error').waitFor();
  assert.deepEqual(solicitudes.filter(s => s.method === 'DELETE').map(s => s.path), ['/api/admin/usuarios/7']);
});

test('entrada administrativa con Enter conserva el contrato y Escape no crea otra línea', async t => {
  const diseno = { idDiseno: 77, propietario: 'Ana Prueba', modoEscenario: 'EDICION_LIBRE' };
  const { pagina, solicitudes } = registrar(t, await abrirPantalla(navegador, '/admin.html', {
    viewport: { width: 390, height: 844 },
    responder: request => {
      const path = new URL(request.url()).pathname;
      if (path === '/api/admin/disenos') return { json: [diseno] };
      if (path === '/api/admin/disenos/77') return { json: { diseno, lineas: [], estaciones: [], conexiones: [], tramos: [], unidadesMetro: [] } };
      if (path.endsWith('/lineas')) return { json: {} };
    },
  }));
  await pagina.locator('[data-vista="disenos"]').click();
  await pagina.locator('[data-ver-diseno="77"]').click();
  await pagina.locator('[data-crear-diseno="linea"]').click();
  const dialogo = pagina.locator('.metronet-dialogo-sistema');
  await dialogo.getByLabel('Nombre de la línea:').fill('Azul de prueba');
  const caja = await dialogo.boundingBox(); assert.ok(caja.x >= 0 && caja.x + caja.width <= 390);
  const recarga = pagina.waitForResponse(r => r.url().endsWith('/api/admin/disenos/77') && r.request().method() === 'GET');
  await pagina.keyboard.press('Enter'); await dialogo.waitFor({ state: 'detached' }); await recarga;
  assert.deepEqual(solicitudes.filter(s => s.method === 'POST').map(s => ({ path: s.path, body: s.body })), [
    { path: '/api/admin/disenos/77/lineas', body: { nombre: 'Azul de prueba' } },
  ]);
  await pagina.locator('[data-crear-diseno="linea"]').click(); await pagina.keyboard.press('Escape');
  await dialogo.waitFor({ state: 'detached' });
  assert.equal(solicitudes.filter(s => s.method === 'POST').length, 1);
});

test('ayuda de zoom visible por teclado, dentro del viewport y descartable con Escape', async t => {
  const { pagina } = registrar(t, await abrirEditor(navegador, { viewport: { width: 390, height: 844 } }));
  const boton = pagina.locator('[data-ayuda-sistema="Acercar"]');
  await boton.focus();
  const ayuda = pagina.locator('#metronet-ayuda-sistema'); await ayuda.waitFor();
  assert.equal(await ayuda.textContent(), 'Acercar');
  assert.equal(await boton.getAttribute('title'), null);
  assert.match(await boton.getAttribute('aria-describedby'), /metronet-ayuda-sistema/);
  const caja = await ayuda.boundingBox(); assert.ok(caja.x >= 0 && caja.x + caja.width <= 390);
  await pagina.keyboard.press('Escape'); await ayuda.waitFor({ state: 'hidden' });
  assert.equal(await boton.getAttribute('aria-describedby'), null);
});

test('encabezados equivalentes y selectores mantienen tipografía y geometría entre rutas', async t => {
  let referencia;
  for (const ruta of ['/login.html', '/perfil.html', '/admin.html', '/escenarios.html', '/ranking.html']) {
    const { pagina } = registrar(t, await abrirPantalla(navegador, ruta));
    const estilo = await pagina.locator('h1').first().evaluate(e => {
      const s = getComputedStyle(e); return [s.fontFamily, s.fontSize, s.fontWeight, s.letterSpacing, s.lineHeight];
    });
    referencia ??= estilo; assert.deepEqual(estilo, referencia, ruta);
    if (ruta === '/admin.html') {
      const select = await pagina.locator('select').first().evaluate(e => { const s = getComputedStyle(e); return { appearance: s.appearance, image: s.backgroundImage, radius: s.borderRadius }; });
      assert.equal(select.appearance, 'none'); assert.match(select.image, /linear-gradient/); assert.equal(select.radius, '0px');
    }
  }
});

test('campos por rol respetan hidden y el error de guardar queda dentro del modal', async t => {
  const { pagina } = registrar(t, await abrirPantalla(navegador, '/admin.html'));
  await pagina.locator('[data-editar-usuario]').first().click();
  assert.equal(await pagina.locator('#campoIdentificadorAdministrador').isVisible(), false);
  await pagina.locator('#editorUsuario button[type="submit"]').click();
  await pagina.locator('#editorUsuario #mensajeEditorUsuario.error').waitFor();
  assert.equal(await pagina.locator('#editorUsuario').isVisible(), true);
  await pagina.keyboard.press('Escape');
  await pagina.locator('[data-editar-usuario]').nth(1).click();
  assert.equal(await pagina.locator('#campoIdentificadorAdministrador').isVisible(), true);
});

test('restricciones HTML bloquean la simulación y presentan un aviso dentro del sistema', async t => {
  const { pagina, solicitudes } = registrar(t, await abrirPantalla(navegador, '/simulacion.html?idDiseno=77'));
  await pagina.locator('#duracionSimulacion').fill('1');
  await pagina.locator('#formularioEjecucion button[type="submit"]').click();
  await pagina.locator('.metronet-notificacion--error').waitFor();
  assert.equal(await pagina.locator('#duracionSimulacion').evaluate(e => e.validity.rangeUnderflow && e === document.activeElement), true);
  assert.equal(solicitudes.some(s => s.path.endsWith('/ejecutar')), false);
});

for (const width of [1440, 768, 390]) test(`cabecera de referencias ${width}: zoom dentro del mapa y ayuda visible con teclado`, async t => {
  const { pagina } = registrar(t, await abrirEditor(navegador, { viewport: { width, height: 1000 } }));
  await pagina.evaluate(() => document.fonts.ready);
  const panel = pagina.locator('.metronet-panel-puntos-interes');
  const caja = await panel.boundingBox();
  for (const boton of await panel.locator('button').all()) {
    const rect = await boton.boundingBox();
    assert.ok(rect.x >= caja.x && rect.x + rect.width <= caja.x + caja.width, 'Control visible sin desplazar el mapa');
  }
  await pagina.locator('[data-ayuda-sistema="Acercar"]').focus();
  await pagina.locator('#metronet-ayuda-sistema').waitFor();
  assert.equal(await pagina.locator('#metronet-mapa').evaluate(e => e.scrollLeft), 0);
  if (width === 390) {
    const admin = registrar(t, await abrirPantalla(navegador, '/admin.html', { viewport: { width, height: 1000 } }));
    await admin.pagina.locator('#filtroUsuarios').fill('Sin coincidencias');
    const vacio = await admin.pagina.locator('td.metronet-vacio').boundingBox();
    assert.ok(vacio.x >= 0 && vacio.x + vacio.width <= width, 'El estado vacío no requiere desplazamiento horizontal');
    const tabla = await admin.pagina.locator('table:has(td.metronet-vacio)').boundingBox();
    assert.ok(vacio.width >= tabla.width * .95, 'La celda vacía ocupa todas las columnas, salvo bordes colapsados');
  }
});
