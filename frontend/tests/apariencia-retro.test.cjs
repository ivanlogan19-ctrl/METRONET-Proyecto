const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function preparar(t, ruta, opciones) {
  const p = await abrirPantalla(navegador, ruta, opciones);
  t.after(() => p.contexto.close());
  t.after(() => assert.deepEqual(p.errores, []));
  return p;
}
async function comprobarMarcaYAnchura(pagina, esperaLogo = true) {
  // Medir la marca después de la entrada breve de página, sin temporizador fijo.
  await pagina.evaluate(() => Promise.allSettled(document.body.getAnimations().map(a => a.finished)));
  const resultado = await pagina.evaluate(() => {
    const logos = [...document.querySelectorAll('.metronet-logo__imagen')].filter(e => e.getBoundingClientRect().width > 0);
    return {
      desborde: document.documentElement.scrollWidth > innerWidth + 1,
      logos: logos.map(img => {
        const r = img.getBoundingClientRect();
        let intacto = true;
        for (let e = img; e; e = e.parentElement) {
          const c = getComputedStyle(e);
          intacto &&= c.filter === 'none' && c.transform === 'none' && c.mixBlendMode === 'normal' && c.opacity === '1';
        }
        return { cargado: img.complete && img.naturalWidth > 0, intacto, proporcion: Math.abs(r.width / r.height - img.naturalWidth / img.naturalHeight) < .01, src: new URL(img.currentSrc).pathname };
      }),
    };
  });
  assert.equal(resultado.desborde, false);
  assert.equal(resultado.logos.length, esperaLogo ? 1 : 0);
  if (!esperaLogo) assert.equal(await pagina.locator('.metronet-navegacion').count(), 1);
  for (const logo of resultado.logos) {
    assert.equal(logo.cargado && logo.intacto && logo.proporcion, true, JSON.stringify(logo));
    assert.equal(logo.src, '/assets/metronet-logo-pixel.png');
  }
}
const rutas = ['/login.html', '/registro.html', '/recuperar-contrasena.html', '/verificar-codigo.html', '/nueva-contrasena.html', '/admin-login.html', '/privacidad.html', '/inicio.html', '/escenarios.html', '/perfil.html', '/admin.html', '/simulacion.html?idDiseno=77'];
const rutasSinLogo = new Set(['/escenarios.html', '/perfil.html', '/admin.html', '/simulacion.html']);
for (const width of [1440, 390]) {
  for (const ruta of rutas) test(`presentación ${width}px: ${ruta}, marca y navegación aprobadas sin desbordes`, async t => {
    const { pagina } = await preparar(t, ruta, { viewport: { width, height: 1000 } });
    assert.equal(new URL(pagina.url()).pathname, ruta.split('?')[0]);
    await comprobarMarcaYAnchura(pagina, !rutasSinLogo.has(ruta.split('?')[0]));
  });
  test(`Constructor ${width}px conserva navegación, mapa y controles`, async t => {
    const { pagina, contexto, errores } = await abrirEditor(navegador, { viewport: { width, height: 1000 } });
    t.after(() => contexto.close());
    await pagina.evaluate(() => document.fonts.ready);
    if (width < 620) await pagina.locator('[data-panel-edicion-toggle]').click();
    await pagina.locator('[data-elegir-herramienta="estaciones"]').click();

    await comprobarMarcaYAnchura(pagina, false);
    assert.deepEqual(errores, []);
  });
}

test('acceso conserva teclado, visibilidad de contraseña, carga y error', async t => {
  let resolver;
  const pendiente = new Promise(r => { resolver = r; });
  const { pagina } = await preparar(t, '/login.html', { responder: async req => {
    if (new URL(req.url()).pathname !== '/auth/login') return null;
    await pendiente;
    return { status: 400, json: { detail: 'Credenciales de prueba inválidas.' } };
  } });
  await pagina.locator('#email').fill('ana@example.test');
  await pagina.keyboard.press('Tab');
  assert.equal(await pagina.locator('#password').evaluate(e => e === document.activeElement), true);
  assert.notEqual(await pagina.locator('#password').evaluate(e => getComputedStyle(e).outlineStyle), 'none');
  await pagina.locator('#password').fill('Prueba123!');
  await pagina.locator('.metronet-logo__imagen').waitFor();
  await pagina.getByRole('button', { name: 'Mostrar', exact: true }).click();
  assert.equal(await pagina.locator('#password').getAttribute('type'), 'text');
  await pagina.locator('#loginButton').click();
  await pagina.locator('#loginButton.cargando').waitFor();
  assert.equal(await pagina.locator('#loginButton').isDisabled(), true);
  resolver();
  await pagina.locator('#mensaje.error').waitFor();
  assert.equal(await pagina.locator('#loginButton').isEnabled(), true);
});

test('perfil y modal administrativo conservan edición, cierre y mensajes', async t => {
  const { pagina, solicitudes } = await preparar(t, '/perfil.html');
  await pagina.locator('#nombre').fill('Ana Editada');
  await pagina.locator('#guardarDatosPersonales').click();
  await pagina.getByText('Información personal actualizada correctamente.').waitFor();
  assert.ok(solicitudes.some(r => r.method === 'PATCH' && r.body.nombre === 'Ana Editada'));
  const admin = await preparar(t, '/admin.html');
  await admin.pagina.locator('[data-editar-usuario]').first().click();
  await admin.pagina.locator('#editorUsuario[open]').waitFor();
  await admin.pagina.locator('#editorNombre').fill('Ana');
  await admin.pagina.keyboard.press('Escape');
  assert.equal(await admin.pagina.locator('#editorUsuario').getAttribute('open'), null);
});

test('movimiento reducido suprime feedback animado y las notificaciones siguen siendo cerrables', async t => {
  const { pagina } = await preparar(t, '/inicio.html', { reducedMotion: 'reduce' });
  await pagina.evaluate(async () => { const { mostrarNotificacion } = await import('/src/componentes/NotificacionesMetronet.js'); mostrarNotificacion('Diseño guardado', 'exito'); });
  const aviso = pagina.locator('.metronet-notificacion');
  assert.equal(await aviso.evaluate(e => getComputedStyle(e).animationName), 'none');
  await aviso.getByRole('button', { name: 'Cerrar notificación' }).click();
  assert.equal(await aviso.count(), 0);
});

test('el formulario sigue utilizable si la fuente decorativa no carga', async t => {
  const contexto = await navegador.newContext({ viewport: { width: 320, height: 800 } });
  // Probar esta vista aislada; la navegación persistente tiene su propia suite integral.
  await contexto.route('**/iniciar-contenedor.js', ruta => ruta.fulfill({ contentType:'application/javascript', body:'' }));
  t.after(() => contexto.close());
  const pagina = await contexto.newPage();
  await pagina.route('**/assets/fonts/**', route => route.abort());
  await pagina.goto(`${process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173'}/login.html`);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.locator('#email').fill('ana@example.test');
  await pagina.locator('#password').fill('Prueba123!');
  assert.equal(await pagina.locator('#loginButton').isEnabled(), true);
  await comprobarMarcaYAnchura(pagina);
  assert.equal(await pagina.getByRole('heading', { name: 'Iniciar sesión' }).isVisible(), true);
});
