// Presentación e interacción real en Chrome; contratos REST interceptados, sin datos reales.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function abrir(t, ruta, opciones = {}) {
  const vista = ruta === 'constructor' ? await abrirEditor(navegador, opciones) : await abrirPantalla(navegador, ruta, opciones);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  return vista;
}
async function estilo(elemento) {
  return elemento.evaluate(e => {
    const s = getComputedStyle(e);
    return Object.fromEntries(['backgroundColor', 'color', 'borderTopColor', 'borderTopWidth', 'borderRadius', 'boxShadow', 'fontFamily'].map(k => [k, s[k]]));
  });
}
test('Eliminar y cerrar sesión comparten rojo sólido; cancelar comparte rojo secundario en todas las ventanas', async t => {
  const admin = (await abrir(t, '/admin.html')).pagina;
  const peligro = await estilo(admin.locator('[data-eliminar-usuario]').first());
  await admin.locator('.metronet-navegacion__usuario > summary').click();
  assert.deepEqual(await estilo(admin.locator('.metronet-navegacion__menu-usuario button')), peligro);
  await admin.keyboard.press('Escape');
  await admin.locator('[data-editar-usuario]').first().click();
  const cancelar = await estilo(admin.locator('#cerrarEditorUsuario'));
  assert.equal(cancelar.borderTopColor, peligro.borderTopColor);
  assert.notEqual(cancelar.backgroundColor, peligro.backgroundColor);
  await admin.keyboard.press('Escape');
  await admin.locator('[data-eliminar-usuario]').first().click();
  assert.deepEqual(await estilo(admin.locator('.metronet-dialogo-sistema [value=aceptar]')), peligro);
  assert.deepEqual(await estilo(admin.locator('.metronet-dialogo-sistema [value=cancelar]')), cancelar);
  await admin.keyboard.press('Escape');
  const editor = (await abrir(t, 'constructor')).pagina;
  await editor.evaluate(()=>editorPrueba.seleccionarElemento({tipo:'estacion',valor:editorPrueba.disenoActual.estaciones[0]}));
  await editor.locator('[data-eliminar-estacion]').click();
  assert.deepEqual(await estilo(editor.locator('[data-confirmar-eliminar]')), peligro);
  assert.deepEqual(await estilo(editor.locator('.metronet-dialogo-eliminar [value=cancelar]')), cancelar);
  await editor.keyboard.press('Escape');
  await editor.locator('[data-elegir-herramienta=estaciones]').click();

  assert.deepEqual(await estilo(editor.locator('[data-cancelar-herramienta]')), cancelar);
  await editor.locator('[data-cancelar-herramienta]').click();
});

test('Rol nativo: teclado y guardar conservan JUGADOR ↔ ADMIN y contrato REST', async t => {
  const { pagina: p, solicitudes } = await abrir(t, '/admin.html', {
    responder: req => /\/usuarios\/\d+\/rol$/.test(new URL(req.url()).pathname)
      ? { json: { idUsuario: 7, rol: req.postDataJSON().rol } } : null,
  });
  for (const [id, antes, despues, tecla] of [[7, 'JUGADOR', 'ADMIN', 'a'], [8, 'ADMIN', 'JUGADOR', 'j']]) {
    const selector = p.locator(`#rol-${id}`);
    assert.equal(await selector.inputValue(), antes);
    assert.match(await selector.getAttribute('aria-label'), /Rol de/);
    const css = await estilo(selector);
    assert.match(css.fontFamily, /Silkscreen/);
    assert.equal(css.borderRadius, '0px'); assert.notEqual(css.boxShadow, 'none');
    await selector.focus(); await selector.press(tecla); await selector.press('Tab');
    assert.equal(await selector.inputValue(), despues);
    assert.equal(solicitudes.filter(s => s.path === `/api/admin/usuarios/${id}/rol`).length, 0);
    await Promise.all([p.waitForResponse(r => new URL(r.url()).pathname === `/api/admin/usuarios/${id}/rol`), p.locator(`[data-guardar-rol="${id}"]`).click()]);
    const peticiones = solicitudes.filter(s => s.path === `/api/admin/usuarios/${id}/rol`);
    assert.deepEqual(peticiones, [{ path: `/api/admin/usuarios/${id}/rol`, method: 'PATCH', body: { rol: despues } }]);
  }
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('sesionAdministrador')).usuario.rol), 'ADMIN');
});

test('Selectores de administración y editor comparten estilo; disabled y foco permanecen visibles', async t => {
  const p = (await abrir(t, '/admin.html')).pagina;
  const rol = await estilo(p.locator('#rol-7'));
  assert.deepEqual(await estilo(p.locator('#filtroRolUsuarios')), rol);
  const e = (await abrir(t, 'constructor')).pagina;
  await e.locator('[data-elegir-herramienta=conexiones]').click();
  assert.deepEqual(await estilo(e.locator('[data-linea-conexion]')), rol);
  await p.locator('#filtroUsuarios').focus(); await p.keyboard.press('Tab');
  assert.equal(await p.locator('#filtroRolUsuarios').evaluate(e => e === document.activeElement), true);
  assert.equal(await p.locator('#filtroRolUsuarios').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
});

for (const width of [1440, 390, 320]) test(`Escenarios ${width}: diez filas, selección por foco y estados reales sin desbordes`, async t => {
  const escenarios = niveles.map((n, i) => ({ ...n, idEscenario: 41 + i, estado: i === 0 ? 'COMPLETADO' : i === 1 ? 'EN_DESARROLLO' : i === 2 ? 'DISPONIBLE' : 'BLOQUEADO', desbloqueado: i < 3, progreso: i === 0 ? 100 : 0 }));
  const { pagina: p, solicitudes } = await abrir(t, '/escenarios.html', { viewport: { width, height: 900 }, responder: req => new URL(req.url()).pathname.startsWith('/api/juego/') ? { json: { escenarios, cantidadNiveles: 10, nivelesCompletados: 1 } } : null });
  assert.equal(await p.locator('.metronet-escenarios-pagina__tarjeta').count(), 10);
  for (const estado of ['completado', 'actual', 'disponible', 'bloqueado']) assert.ok(await p.locator(`.metronet-escenarios-pagina__tarjeta--${estado}`).count());
  const boton = p.getByRole('button', { name: 'Continuar', exact: true });
  const fila = p.locator('.metronet-escenarios-pagina__tarjeta--actual');
  const antes = await estilo(fila); await boton.focus();
  assert.notEqual((await estilo(fila)).backgroundColor, antes.backgroundColor);
  assert.equal(await boton.evaluate(e => e === document.activeElement), true);
  assert.equal(await p.locator('.metronet-escenarios-pagina__tarjeta--bloqueado button').first().isDisabled(), true);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  assert.equal(solicitudes.filter(s => s.method !== 'GET').length, 0);
});

test('Disclosure y checkbox siguen siendo nativos y operables con teclado', async t => {
  const p = (await abrir(t, '/registro.html')).pagina;
  const check = p.locator('#aceptaDatos');
  await check.focus(); await check.press('Space'); assert.equal(await check.isChecked(), true);
  await check.press('Space'); assert.equal(await check.isChecked(), false);
  const inicio = (await abrir(t, '/inicio.html')).pagina;
  const summary = inicio.locator('.metronet-navegacion__usuario > summary');
  await summary.focus(); await summary.press('Enter');
  assert.equal(await inicio.locator('.metronet-navegacion__usuario').getAttribute('open'), '');
  await inicio.keyboard.press('Escape');
  assert.equal(await inicio.locator('.metronet-navegacion__usuario').getAttribute('open'), null);
  assert.equal(await summary.evaluate(e => e === document.activeElement), true);
});

test('Lista larga de usuarios: foco en la última fila y selector junto al borde sin desborde de página', async t => {
  const usuarios = Array.from({ length: 32 }, (_, i) => ({ idUsuario: i + 7, nombre: `Persona ${i + 1}`, apellido: 'Prueba', email: `persona${i}@example.test`, rol: i % 2 ? 'ADMIN' : 'JUGADOR' }));
  const { pagina: p } = await abrir(t, '/admin.html', { viewport: { width: 390, height: 844 }, responder: req => new URL(req.url()).pathname === '/api/admin/usuarios' ? { json: usuarios } : null });
  assert.equal(await p.locator('[data-guardar-rol]').count(), 32);
  const ultimo = p.locator('#rol-38');
  await ultimo.scrollIntoViewIfNeeded(); await ultimo.focus(); await ultimo.press('j'); await ultimo.press('Tab');
  assert.equal(await ultimo.inputValue(), 'JUGADOR');
  assert.equal(await p.locator('[data-guardar-rol="38"]').evaluate(e => document.activeElement === e), true);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
});

test('Touch de 320 px: mandos del mapa accesibles sin solaparse y Pista utilizable', async t => {
  const tactil = { newContext: opciones => navegador.newContext({ ...opciones, hasTouch: true }) };
  const { pagina: p, contexto, errores } = await abrirEditor(tactil, { viewport: { width: 320, height: 844 }, escenario: { ...niveles[0], idEscenario: 41 } });
  t.after(async () => { await contexto.close(); assert.deepEqual(errores, []); });
  const cabecera = p.locator('.metronet-barra-geografica');
  const limite = await p.locator('#metronet-mapa').boundingBox();
  const botones = await cabecera.locator('button:visible, summary:visible').evaluateAll(elementos => elementos.map(e => e.getBoundingClientRect().toJSON()));
  for (const r of botones) { assert.ok(r.width >= 44 && r.height >= 44); assert.ok(r.left >= limite.x && r.right <= limite.x + limite.width); }
  for (let i = 0; i < botones.length; i++) for (let j = i + 1; j < botones.length; j++) {
    const a = botones[i], b = botones[j];
    assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, 'Los mandos no se superponen');
  }
  await p.locator('.metronet-hud>summary').tap();
  await p.locator('[data-hud-vista=controles]').tap();
  assert.equal(await p.locator('.metronet-hud').getAttribute('data-vista'), 'controles');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
});


test('Encabezados desplegables conservan marco de control y apertura nativa', async t => {
  for (const [ruta, selector] of [['constructor', '.metronet-editor-acceso-teclado > summary'], ['/simulacion.html?idDiseno=77', '.simulacion-seccion > summary']]) {
    const p = (await abrir(t, ruta)).pagina;
    if (ruta === 'constructor') { await p.locator('.metronet-hud>summary').click(); await p.locator('[data-hud-vista=controles]').click(); }
    const summary = p.locator(selector).first();
    const css = await estilo(summary);
    assert.equal(css.borderTopWidth, '1px'); assert.notEqual(css.boxShadow, 'none');
    await summary.focus(); await summary.press('Enter');
    assert.equal(await summary.evaluate(e => e.parentElement.open), true);
  }
});
