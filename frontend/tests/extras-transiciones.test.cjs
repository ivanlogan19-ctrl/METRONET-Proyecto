// Regresión visual del componente con los estilos reales del editor y API controlada.
// La persistencia y el orden Extras/premio/tutorial se cubren en extras-modo-libre-e2e.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5198';
const titulos = ['Calles y avenidas', 'Densidad de población', 'Tráfico histórico', 'Desplazamientos', 'Horarios', 'Cobertura', 'Diseño y simulación'];
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrir(t, viewport) {
  const contexto = await navegador.newContext({ viewport });
  t.after(() => contexto.close());
  await contexto.addInitScript(() => localStorage.setItem('sesionUsuario', JSON.stringify({ token: 'prueba-local', usuario: { idUsuario: 7, rol: 'JUGADOR' } })));
  const pagina = await contexto.newPage();
  pagina.setDefaultTimeout(10000);
  const errores = [], pendientes = [], visitas = [];
  pagina.on('pageerror', error => errores.push(error.message));
  t.after(() => assert.deepEqual(errores, []));
  await pagina.route(`${BASE}/__extras-transiciones`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="es"><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/src/mapa/estilos/layout-editor.css">
    <link rel="stylesheet" href="/src/estilos/metronet.css">
    <link rel="stylesheet" href="/src/estilos/retro.css">
    <link rel="stylesheet" href="/src/mapa/estilos/editor-red.css">
    </head><body class="metronet-pagina-editor"><div id="fondo" style="position:fixed;inset:0;background:white;color:black;font-size:50px">Cargando…</div></body></html>` }));
  await pagina.route('**/api/juego/aprendizaje/extras/**', async route => {
    const req = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (/\/tarjetas\/\d+$/.test(req.url())) {
      const status = await new Promise(resolve => pendientes.push(resolve));
      if (status === 200) visitas.push(Number(new URL(req.url()).pathname.split('/').at(-1)));
      return route.fulfill({ status, headers, json: { visitadas: visitas, nuevoTrofeo: null } });
    }
    return route.fulfill({ headers, json: { visitadas: visitas, nuevoTrofeo: null } });
  });
  await pagina.goto(`${BASE}/__extras-transiciones`);
  await pagina.evaluate(async () => {
    const { abrirExtras } = await import('/src/educacion/extras/PresentacionExtras.js');
    window.extrasCerrados = false;
    void abrirExtras().then(() => { window.extrasCerrados = true; });
    await document.fonts.ready;
  });
  await pagina.getByRole('heading', { name: titulos[0], exact: true }).waitFor();
  return { pagina, pendientes, visitas };
}

async function medir(pagina) {
  return pagina.locator('dialog.metronet-extras').evaluate(dialogo => {
    const caja = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return {
      cuadro: caja(dialogo), encabezado: caja(dialogo.querySelector('header')),
      pie: caja(dialogo.querySelector('footer')), anterior: caja(dialogo.querySelector('footer button:first-child')),
      siguiente: caja(dialogo.querySelector('footer button:last-child')), cerrar: caja(dialogo.querySelector('.metronet-extras__saltar')),
    };
  });
}

function estable(actual, inicial, etapa) {
  for (const [elemento, caja] of Object.entries(inicial)) for (const [eje, valor] of Object.entries(caja)) {
    assert.ok(Math.abs(actual[elemento][eje] - valor) <= 1,
      `${etapa}: ${elemento}.${eje} saltó de ${valor} a ${actual[elemento][eje]}`);
  }
}

async function sinRecortes(pagina) {
  const dialogo = pagina.locator('.metronet-extras');
  const resultado = await dialogo.evaluate(d => {
    const r = d.getBoundingClientRect();
    const texto = d.querySelector('.metronet-extras__texto');
    const imagen = d.querySelector('.metronet-extras__imagen');
    return {
      enPantalla: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      sinDesbordeDelMarco: d.scrollHeight <= d.clientHeight + 1,
      sinDesbordeHorizontal: [d, texto, imagen, ...d.querySelectorAll('p, button')].every(e => e.scrollWidth <= e.clientWidth + 1),
      fuente: [...d.querySelectorAll('*')].every(e => getComputedStyle(e).fontFamily.includes('Silkscreen')),
    };
  });
  assert.deepEqual(resultado, { enPantalla: true, sinDesbordeDelMarco: true, sinDesbordeHorizontal: true, fuente: true });
  // Cada texto y dibujo debe poder verse completo, también dentro del scroll móvil.
  for (const elemento of await dialogo.locator('.metronet-extras__imagen, .metronet-extras__texto h2, .metronet-extras__texto p').all()) {
    await elemento.scrollIntoViewIfNeeded();
    assert.ok(await elemento.evaluate(e => {
      const r = e.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) return false;
      for (let p = e.parentElement; p; p = p.parentElement) {
        if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowY)) continue;
        const limite = p.getBoundingClientRect();
        if (r.top < limite.top - 1 || r.bottom > limite.bottom + 1) return false;
      }
      return true;
    }), 'Cada ilustración y párrafo debe quedar visible completo al desplazarlo');
  }
  for (const boton of await dialogo.locator('button').all()) {
    await boton.scrollIntoViewIfNeeded();
    assert.ok(await boton.evaluate(e => {
      const r = e.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth &&
        document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === e;
    }), 'Botón visible, completo y alcanzable');
  }
}

for (const [width, height] of [[1440, 900], [1280, 720], [390, 844]]) {
  test(`Extras ${width}×${height}: siete tarjetas, regreso y guardado lento conservan cuadro y controles`, { timeout: 60000 }, async t => {
    const { pagina, pendientes, visitas } = await abrir(t, { width, height });
    const inicial = await medir(pagina);
    for (const destino of [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0]) {
      const origen = titulos.indexOf(await pagina.locator('#tituloExtras').textContent());
      await pagina.getByRole('button', { name: destino > origen ? 'Siguiente →' : '← Anterior', exact: true }).click();
      await pagina.getByText('Guardando recorrido…', { exact: true }).waitFor();
      // La petición permanece sin resolver durante varios frames visibles.
      await pagina.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      estable(await medir(pagina), inicial, `${origen + 1} → ${destino + 1}, guardando`);
      assert.equal(await pagina.locator('#tituloExtras').textContent(), titulos[origen]);
      assert.equal(pendientes.length, 1, 'Una sola escritura pendiente');
      pendientes.shift()(200);
      await pagina.getByRole('heading', { name: titulos[destino], exact: true }).waitFor();
      estable(await medir(pagina), inicial, `tarjeta ${destino + 1}`);
      await sinRecortes(pagina);
      estable(await medir(pagina), inicial, `tarjeta ${destino + 1} tras leer`);
    }
    assert.equal(visitas.length, 12);
    await pagina.getByRole('button', { name: 'Cerrar tarjetas', exact: true }).click();
    await pagina.waitForFunction(() => window.extrasCerrados);
  });
}

test('Extras: fondo opaco incluso con contenido de carga detrás', async t => {
  const { pagina } = await abrir(t, { width: 1440, height: 900 });
  const antes = await pagina.screenshot();
  await pagina.locator('#fondo').evaluate(e => { e.style.background = 'magenta'; e.textContent = 'Otra carga visible detrás'; });
  const despues = await pagina.screenshot();
  assert.ok(antes.equals(despues), 'Cambiar Cargando y su fondo no debe alterar ningún píxel de Extras');
});

test('Extras: el error conserva el cuadro, permite reintentar y cerrar mientras guarda', async t => {
  const { pagina, pendientes } = await abrir(t, { width: 1280, height: 720 });
  const inicial = await medir(pagina);
  await pagina.getByRole('button', { name: 'Siguiente →', exact: true }).click();
  await pagina.getByText('Guardando recorrido…', { exact: true }).waitFor();
  pendientes.shift()(500);
  await pagina.locator('[data-extras-estado]').getByText(/reintentar/).waitFor();
  estable(await medir(pagina), inicial, 'error de guardado');
  assert.ok(await pagina.locator('[data-extras-estado]').evaluate(e => e.scrollHeight <= e.clientHeight + 1), 'El mensaje de reintento se ve completo');
  await pagina.getByRole('button', { name: 'Siguiente →', exact: true }).click();
  await pagina.getByText('Guardando recorrido…', { exact: true }).waitFor();
  pendientes.shift()(200);
  await pagina.getByRole('heading', { name: titulos[1], exact: true }).waitFor();
  await pagina.getByRole('button', { name: 'Siguiente →', exact: true }).click();
  await pagina.getByText('Guardando recorrido…', { exact: true }).waitFor();
  await pagina.getByRole('button', { name: 'Cerrar tarjetas', exact: true }).click();
  await pagina.waitForFunction(() => window.extrasCerrados);
  pendientes.shift()(200);
  assert.equal(await pagina.locator('.metronet-extras').count(), 0);
});
