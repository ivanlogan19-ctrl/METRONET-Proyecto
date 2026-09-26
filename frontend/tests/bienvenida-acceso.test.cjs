// Login y destinos reales; respuestas HTTP controladas, sin crear sesiones en producción.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const sesion = rol => ({ token: 'sesion-local-de-prueba', usuario: { idUsuario: 7, nombre: 'Ana', apellido: 'Prueba', email: 'ana@example.test', rol } });
async function preparar(t, rol = 'JUGADOR', opciones = {}) {
  const ruta = rol === 'ADMIN' ? '/admin-login.html' : '/login.html';
  const vista = await abrirPantalla(navegador, ruta + (opciones.busqueda || ''), {
    ...opciones, responder: async req => {
      if (opciones.responder) { const respuesta = await opciones.responder(req); if (respuesta) return respuesta; }
      if (/\/auth\/login(?:\/admin)?$/.test(new URL(req.url()).pathname)) return { json: sesion(rol) };
      if (/\/auth\/logout/.test(req.url())) return { status: 204 };
      return null;
    },
  });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  const navegaciones = [];
  vista.pagina.on('framenavigated', frame => { if (frame === vista.pagina.mainFrame()) navegaciones.push(new URL(frame.url()).pathname); });
  return { ...vista, navegaciones };
}
async function completar(pagina, rol = 'JUGADOR') {
  await pagina.locator(rol === 'ADMIN' ? '#usuario' : '#email').fill(rol === 'ADMIN' ? 'operador' : 'ana@example.test');
  await pagina.locator('#password').fill('Prueba1!');
}
async function ingresar(pagina, rol = 'JUGADOR') {
  await completar(pagina, rol);
  await pagina.locator(rol === 'ADMIN' ? '#loginAdminButton' : '#loginButton').click();
}
const pantalla = p => p.locator('.metronet-bienvenida[data-fase]');
async function capturar(p, nombre) {
  if (!process.env.METRONET_BIENVENIDA_CAPTURAS) return;
  fs.mkdirSync(process.env.METRONET_BIENVENIDA_CAPTURAS, { recursive: true });
  await p.screenshot({ path: path.join(process.env.METRONET_BIENVENIDA_CAPTURAS, `${nombre}.png`) });
}

for (const rol of ['JUGADOR', 'ADMIN']) {
  test(`${rol}: una bienvenida después de guardar sesión, un POST y destino original`, async t => {
    const { pagina: p, solicitudes, navegaciones } = await preparar(t, rol);
    const inicio = Date.now();
    await ingresar(p, rol);
    await pantalla(p).waitFor();
    assert.equal(solicitudes.length, 1);
    assert.equal(solicitudes[0].path, rol === 'ADMIN' ? '/auth/login/admin' : '/auth/login');
    assert.deepEqual(solicitudes[0].body, rol === 'ADMIN' ? { usuario: 'operador', password: 'Prueba1!' } : { email: 'ana@example.test', password: 'Prueba1!' });
    assert.equal(await p.evaluate(rol => JSON.parse(localStorage.getItem(rol === 'ADMIN' ? 'sesionAdministrador' : 'sesionUsuario')).usuario.rol, rol), rol);
    await p.waitForFunction(() => document.querySelector('.metronet-bienvenida')?.dataset.fase === 'bienvenida');
    assert.equal(await pantalla(p).getByRole('heading', { name: 'Bienvenido a METRONET' }).isVisible(), true);
    // Decisión del usuario: saludo general hasta disponer de primer acceso por cuenta.
    assert.equal(await p.locator('[data-perfil-bienvenida]').count(), 0);
    assert.doesNotMatch(await pantalla(p).innerText(), /Ana|ADMINISTRADOR|JUGADOR|NETWORK|INITIALIZING/);
    assert.equal(await p.locator('.metronet-viaje, .metronet-victoria, [data-concepto]').count(), 0);
    const logo = await pantalla(p).locator('img').evaluate(img => {
      const s = getComputedStyle(img), r = img.getBoundingClientRect();
      return { src: img.getAttribute('src'), filter: s.filter, transform: s.transform, opacity: s.opacity, mezcla: s.mixBlendMode, ratio: r.width / r.height, natural: img.naturalWidth / img.naturalHeight };
    });
    assert.equal(logo.src, '/assets/logoMETRONET-transparente.png');
    assert.equal(logo.filter, 'none'); assert.equal(logo.transform, 'none'); assert.equal(logo.opacity, '1'); assert.equal(logo.mezcla, 'normal');
    assert.ok(Math.abs(logo.ratio - logo.natural) < .01);
    assert.equal(await pantalla(p).locator('canvas').isVisible(), true);
    assert.equal(await pantalla(p).locator('svg, [role="progressbar"]').count(), 0);
    assert.equal(await pantalla(p).locator('canvas').evaluate(e => getComputedStyle(e).imageRendering), 'pixelated');
    await capturar(p, `bienvenida-${rol.toLowerCase()}`);
    await p.waitForURL(rol === 'ADMIN' ? '**/admin.html' : '**/inicio.html');
    assert.ok(Date.now() - inicio >= 8500, 'La bienvenida espera el final del audio de acceso');
    assert.ok(Date.now() - inicio < 11500);
    assert.deepEqual(navegaciones, [rol === 'ADMIN' ? '/admin.html' : '/inicio.html']);
    assert.equal(solicitudes.filter(s => s.path.startsWith('/auth/login')).length, 1);
    assert.equal(await p.evaluate(() => sessionStorage.getItem('metronet:bienvenida-pendiente')), null);
    assert.equal(await pantalla(p).count(), 0);
  });

  test(`${rol}: credenciales inválidas no muestran bienvenida; permiten corregir`, async t => {
    let incorrectas = true;
    const { pagina: p, solicitudes } = await preparar(t, rol, { responder: req => /\/auth\/login/.test(req.url()) && incorrectas ? { status: 401, json: { detail: 'Credenciales incorrectas.' } } : null });
    await ingresar(p, rol);
    await p.locator('#mensaje.error').waitFor();
    assert.match(await p.locator('#mensaje').innerText(), /Credenciales incorrectas/);
    assert.equal(await pantalla(p).count(), 0);
    assert.equal(await p.locator(rol === 'ADMIN' ? '#loginAdminButton' : '#loginButton').isEnabled(), true);
    assert.equal(await p.evaluate(() => localStorage.getItem('sesionUsuario') || localStorage.getItem('sesionAdministrador')), null);
    incorrectas = false;
    await ingresar(p, rol);
    await pantalla(p).waitFor();
    await p.locator('[data-continuar-bienvenida]').click();
    await p.waitForURL(rol === 'ADMIN' ? '**/admin.html' : '**/inicio.html');
    assert.equal(solicitudes.filter(s => s.path.startsWith('/auth/login')).length, 2);
  });

  test(`${rol}: doble click y submit durante la bienvenida no duplican acceso ni navegación`, async t => {
    const { pagina: p, solicitudes, navegaciones } = await preparar(t, rol, { responder: async req => {
      if (!/\/auth\/login/.test(req.url())) return null;
      await new Promise(r => setTimeout(r, 200)); return { json: sesion(rol) };
    } });
    await completar(p, rol);
    await p.locator(rol === 'ADMIN' ? '#loginAdminButton' : '#loginButton').dblclick();
    await pantalla(p).waitFor();
    await p.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    assert.equal(await pantalla(p).count(), 1);
    await p.keyboard.press('Escape');
    await p.waitForURL(rol === 'ADMIN' ? '**/admin.html' : '**/inicio.html');
    assert.equal(solicitudes.filter(s => s.path.startsWith('/auth/login')).length, 1);
    assert.equal(navegaciones.length, 1);
  });

  test(`${rol}: recargar durante bienvenida conserva sesión y continúa sin repetir el login`, async t => {
    const { pagina: p, solicitudes } = await preparar(t, rol);
    await ingresar(p, rol); await pantalla(p).waitFor();
    await p.reload();
    await p.waitForURL(rol === 'ADMIN' ? '**/admin.html' : '**/inicio.html');
    assert.equal(solicitudes.filter(s => s.path.startsWith('/auth/login')).length, 1);
    assert.equal(await pantalla(p).count(), 0);
  });

  test(`${rol}: logout y nuevo login vuelven a presentar la bienvenida`, async t => {
    const { pagina: p, solicitudes } = await preparar(t, rol);
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      if (rol === 'ADMIN' && new URL(p.url()).pathname === '/login.html') await p.goto(p.url().replace('/login.html', '/admin-login.html'));
      await ingresar(p, rol); await pantalla(p).waitFor();
      await p.locator('[data-continuar-bienvenida]').click();
      await p.waitForURL(rol === 'ADMIN' ? '**/admin.html' : '**/inicio.html');
      if (vuelta === 0) {
        await p.locator('.metronet-navegacion__usuario > summary').click();
        await p.locator('.metronet-navegacion__menu-usuario').getByRole('button', { name: 'Cerrar sesión' }).click();
        await p.waitForURL('**/login.html');
        assert.equal(await p.evaluate(() => localStorage.getItem('sesionUsuario') || localStorage.getItem('sesionAdministrador')), null);
      }
    }
    assert.equal(solicitudes.filter(s => s.path.startsWith('/auth/login')).length, 2);
    assert.equal(solicitudes.filter(s => s.path.startsWith('/auth/logout')).length, 1);
  });
}

for (const [busqueda, destino] of [['?destino=%2Fperfil.html', '/perfil.html'], ['?destino=https%3A%2F%2Fexample.test', '/inicio.html'], ['?destino=%2F%2Fejemplo.test', '/inicio.html']]) {
  test(`jugador conserva resolución previa de destino ${busqueda}`, async t => {
    const { pagina: p } = await preparar(t, 'JUGADOR', { busqueda });
    await ingresar(p); await pantalla(p).waitFor();
    await p.locator('[data-continuar-bienvenida]').click();
    await p.waitForURL(url => url.pathname === destino);
  });
}

test('acceso de jugador no habilita la página de administración', async t => {
  const { pagina: p, solicitudes } = await preparar(t, 'JUGADOR', { busqueda: '?destino=%2Fadmin.html' });
  await ingresar(p); await pantalla(p).waitFor();
  await p.locator('[data-continuar-bienvenida]').click();
  await p.waitForURL('**/admin-login.html');
  assert.equal(solicitudes.some(s => s.path.startsWith('/api/admin/')), false);
});

for (const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1920,height:1080}]) {
  test(`presentación y controles completos en ${viewport.width}×${viewport.height}`, async t => {
    const { pagina: p } = await preparar(t, 'JUGADOR', { viewport });
    await ingresar(p); await pantalla(p).waitFor();
    await p.waitForFunction(() => document.querySelector('.metronet-bienvenida')?.dataset.fase === 'bienvenida');
    for (const elemento of [pantalla(p).getByRole('heading'), pantalla(p).locator('img'), pantalla(p).locator('canvas'), p.locator('[data-continuar-bienvenida]')]) {
      const r = await elemento.boundingBox();
      assert.ok(r.x >= 0 && r.y >= 0 && r.x+r.width <= viewport.width+1 && r.y+r.height <= viewport.height+1, JSON.stringify(r));
    }
    assert.equal(await pantalla(p).evaluate(e => e.scrollWidth > e.clientWidth), false);
    assert.equal(await pantalla(p).evaluate(e => e.scrollHeight > e.clientHeight), false);
    const logo = await pantalla(p).locator('img').boundingBox();
    const titulo = await pantalla(p).getByRole('heading').boundingBox();
    const via = await p.locator('.metronet-bienvenida__anden').boundingBox();
    assert.ok(Math.max(logo.y + logo.height, titulo.y + titulo.height) <= via.y, 'Vía y metro debajo de la marca y saludo');
    await capturar(p, `bienvenida-${viewport.width}x${viewport.height}`);
    await p.keyboard.press('Tab');
    assert.equal(await p.locator('[data-continuar-bienvenida]').evaluate(e => e === document.activeElement), true);
    await p.keyboard.press('Enter');
    await p.waitForURL('**/inicio.html');
  });
}

test('movimiento reducido: bienvenida estática, sin barrido y sincronizada con su audio', async t => {
  const { pagina: p } = await preparar(t, 'JUGADOR', { reducedMotion: 'reduce' });
  const inicio = Date.now();
  await ingresar(p); await pantalla(p).waitFor();
  assert.equal(await pantalla(p).getAttribute('data-movimiento-reducido'), 'true');
  assert.equal(await pantalla(p).getByRole('heading').isVisible(), true);
  assert.equal(await pantalla(p).evaluate(e => e.getAnimations({ subtree: true }).length), 0);
  const imagenInicial = await pantalla(p).locator('canvas').evaluate(e => e.toDataURL());
  await p.waitForTimeout(250);
  assert.equal(await pantalla(p).locator('canvas').evaluate(e => e.toDataURL()), imagenInicial);
  await capturar(p, 'movimiento-reducido');
  await p.waitForURL('**/inicio.html');
  assert.ok(Date.now() - inicio >= 8500 && Date.now() - inicio < 11500);
});

test('redimensionar durante el recorrido mantiene el lienzo nítido y el destino', async t => {
  const { pagina: p, navegaciones } = await preparar(t);
  await ingresar(p); await pantalla(p).waitFor();
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await p.setViewportSize(viewport);
    await p.waitForFunction(() => {
      const c = document.querySelector('.metronet-bienvenida canvas');
      return c && c.clientWidth <= c.parentElement.clientWidth;
    });
    assert.equal(await pantalla(p).evaluate(e => e.scrollWidth > e.clientWidth || e.scrollHeight > e.clientHeight), false);
    assert.equal(await pantalla(p).locator('canvas').evaluate(e => e.getContext('2d').imageSmoothingEnabled), false);
  }
  await p.locator('[data-continuar-bienvenida]').click();
  await p.waitForURL('**/inicio.html');
  assert.deepEqual(navegaciones, ['/inicio.html']);
});

for (const fallo of ['modulo', 'css', 'logo', 'render', 'canvas', 'dibujo', 'frames', 'animaciones', 'storage']) {
  test(`fallo visual ${fallo}: acceso y sesión permanecen válidos`, async t => {
    const { pagina: p } = await preparar(t);
    if (fallo === 'modulo') await p.route('**/PantallaBienvenida.js*', route => route.abort());
    if (fallo === 'css') await p.route('**/bienvenida.css*', route => route.abort());
    let fallosLogo = 0;
    if (fallo === 'logo') {
      await p.route('**/assets/logoMETRONET-transparente.png*', route => { fallosLogo++; return route.abort(); });
      await p.reload();
    }
    if (fallo === 'render') await p.route('**/PantallaBienvenida.js*', route => route.fulfill({ contentType: 'application/javascript', body: 'export function crearPantallaBienvenida(){throw new Error("Fallo visual simulado");}' }));
    if (fallo === 'canvas') await p.evaluate(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    if (fallo === 'dibujo') await p.evaluate(() => {
      const original = CanvasRenderingContext2D.prototype.fillRect;
      let llamadas = 0;
      CanvasRenderingContext2D.prototype.fillRect = function (...args) {
        if (++llamadas > 100) throw new Error('Fallo durante un cuadro');
        return original.apply(this, args);
      };
    });
    if (fallo === 'frames') await p.evaluate(() => { window.requestAnimationFrame = () => 0; });
    if (fallo === 'animaciones') await p.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
    if (fallo === 'storage') await p.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) { if (this === sessionStorage) throw new Error('Sin almacenamiento temporal'); return original.apply(this, args); };
    });
    await ingresar(p);
    await p.waitForURL('**/inicio.html', { timeout: 11500 });
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('sesionUsuario')).usuario.rol), 'JUGADOR');
    if (fallo === 'logo') assert.ok(fallosLogo > 0);
  });
}

test('import visual lento no extiende la espera y no vuelve a mostrar login', async t => {
  const { pagina: p, navegaciones } = await preparar(t);
  await p.route('**/PantallaBienvenida.js*', async route => { await new Promise(r => setTimeout(r, 12000)); await route.abort().catch(() => {}); });
  const inicio = Date.now();
  await ingresar(p);
  await p.locator('.metronet-bienvenida').waitFor();
  assert.equal(await p.locator('.auth-page').evaluate(e => e.inert), true);
  await p.waitForURL('**/inicio.html', { timeout: 11500 });
  assert.ok(Date.now() - inicio < 11500);
  assert.deepEqual(navegaciones, ['/inicio.html']);
});

test('salir rápidamente cancela navegación pendiente; no redirige desde otra pantalla', async t => {
  const { pagina: p, navegaciones } = await preparar(t);
  await ingresar(p); await pantalla(p).waitFor();
  await p.goto(p.url().replace('/login.html', '/privacidad.html'));
  await p.waitForTimeout(5500);
  assert.equal(new URL(p.url()).pathname, '/privacidad.html');
  assert.deepEqual(navegaciones, ['/privacidad.html']);
});

test('vía, metro pixelado hacia la derecha y salida de túnel sin alterar el logo', async t => {
  const { pagina: p } = await preparar(t);
  await ingresar(p); await pantalla(p).waitFor();
  await p.waitForTimeout(650);
  await capturar(p, '01-via-en-construccion');
  await p.waitForFunction(() => document.querySelector('.metronet-bienvenida')?.dataset.fase === 'viaje');
  await p.waitForTimeout(350);
  const inspeccionarTren = () => p.locator('canvas').evaluate(canvas => {
    const ctx = canvas.getContext('2d');
    const fila = ctx.getImageData(0, 62, canvas.width, 1).data;
    const posiciones = [];
    for (let x = 0; x < canvas.width; x++) if (fila[x*4] === 41 && fila[x*4+1] === 159 && fila[x*4+2] === 238) posiciones.push(x);
    return { extremo: Math.max(...posiciones), ancho: canvas.width };
  });
  const entrando = await inspeccionarTren();
  assert.ok(entrando.extremo > 0 && entrando.extremo < entrando.ancho / 2);
  await capturar(p, '02-metro-entrando');
  await p.waitForTimeout(1150);
  const pasando = await inspeccionarTren();
  assert.ok(pasando.extremo > entrando.extremo + 40, 'El metro avanza de izquierda a derecha');
  const pixeles = await p.locator('canvas').evaluate(canvas => {
    const ctx = canvas.getContext('2d'), datos = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colores = new Set();
    for (let i = 0; i < datos.length; i += 4) colores.add(Array.from(datos.slice(i, i+4)).join(','));
    return { colores: [...colores], escala: canvas.clientWidth / canvas.width, suavizado: ctx.imageSmoothingEnabled,
      riel: [...ctx.getImageData(22, 82, 1, 1).data], luz: [...ctx.getImageData(canvas.width-45, 34, 1, 1).data] };
  });
  assert.ok(pixeles.colores.length <= 10, 'Paleta limitada sin interpolación ni gradientes');
  assert.equal(pixeles.escala, Math.floor(pixeles.escala));
  assert.equal(pixeles.suavizado, false);
  assert.deepEqual(pixeles.riel, [175,193,219,255]);
  assert.deepEqual(pixeles.luz, [112,229,177,255]);
  await capturar(p, '03-metro-y-bienvenida');
  await p.waitForFunction(() => document.querySelector('.metronet-bienvenida')?.dataset.fase === 'salida');
  assert.equal(await p.locator('.metronet-bienvenida__salida').evaluate(e => getComputedStyle(e).animationName), 'bienvenida-tunel');
  assert.deepEqual(await pantalla(p).locator('img').evaluate(e => {
    const s = getComputedStyle(e); return [s.opacity, s.filter, s.transform, s.animationName, s.imageRendering];
  }), ['1', 'none', 'none', 'none', 'auto']);
  await p.waitForTimeout(150);
  await capturar(p, '04-salida-tunel');
  await p.waitForURL('**/inicio.html');
});

for (const nombre of [undefined, null, '', 'Ana', '<img src=x onerror=alert(1)>']) {
  test(`saludo general acordado, sin inferir primer acceso ni mostrar nombre ${JSON.stringify(nombre)}`, async t => {
    const { pagina: p } = await preparar(t, 'JUGADOR', { responder: req => {
      if (!/\/auth\/login/.test(req.url())) return null;
      const respuesta = sesion('JUGADOR'); respuesta.usuario.nombre = nombre;
      return { json: respuesta };
    } });
    await ingresar(p); await pantalla(p).waitFor();
    assert.equal(await pantalla(p).getByRole('heading').innerText(), 'BIENVENIDO A METRONET');
    assert.doesNotMatch(await pantalla(p).innerText(), /null|undefined|Ana|onerror|JUGADOR/);
    const claves = await p.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
    assert.deepEqual(claves.filter(k => /bienvenida/.test(k)), ['metronet:bienvenida-pendiente']);
    await p.locator('[data-continuar-bienvenida]').click();
    await p.waitForURL('**/inicio.html');
  });
}
