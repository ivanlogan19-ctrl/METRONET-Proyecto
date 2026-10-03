const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

test('Cabecera y simulador comparten la consulta simultánea de progreso', async t => {
  const v = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', {
    responder: async r => {
      if (new URL(r.url()).pathname === '/api/juego/progreso') {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { json: { escenarios: [], modoLibreDesbloqueado: false } };
      }
    },
  });
  t.after(() => v.contexto.close());
  await v.pagina.waitForFunction(() => document.querySelector('audio[data-musica-metronet]')?.getAttribute('src') === '/audio/extra-theme.mp3');
  assert.equal(v.solicitudes.filter(r => r.path === '/api/juego/progreso').length, 1);
  assert.deepEqual(v.errores, []);
});

for (const caso of ['frescura', 'error', 'sesion']) test(`Consulta compartida: ${caso}`, async t => {
  const contexto = await navegador.newContext();
  // Probar esta vista aislada; la navegación persistente tiene su propia suite integral.
  await contexto.route('**/iniciar-contenedor.js', ruta => ruta.fulfill({ contentType:'application/javascript', body:'' }));
  t.after(() => contexto.close());
  const pagina = await contexto.newPage();
  await pagina.goto(`${process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173'}/login.html`);
  const resultado = await pagina.evaluate(async caso => {
    const { consultarJuego } = await import('/src/educacion/ClientePuntuacion.js');
    const guardar = token => localStorage.setItem('sesionUsuario', JSON.stringify({ token, usuario: { rol: 'JUGADOR' } }));
    guardar('cuenta-a');
    let llamadas = 0;
    const pendientes = [];
    const original = window.fetch;
    window.fetch = (_url, opciones) => {
      llamadas++;
      return new Promise(resolve => pendientes.push({ token: opciones.headers.Authorization, resolver: ok => resolve(new Response(JSON.stringify({ version: llamadas }), { status: ok ? 200 : 503 })) }));
    };
    try {
      const primera = consultarJuego('/progreso');
      if (caso === 'sesion') guardar('cuenta-b');
      const segunda = consultarJuego('/progreso');
      const tokens = pendientes.map(p => p.token);
      const respuestas = Promise.allSettled([primera, segunda]);
      for (const p of pendientes.splice(0)) p.resolver(caso !== 'error');
      const estados = (await respuestas).map(r => r.status);
      const iniciales = llamadas;
      const nueva = consultarJuego('/progreso');
      for (const p of pendientes.splice(0)) p.resolver(true);
      const valor = await nueva;
      return { iniciales, llamadas, tokens, estados, version: valor.version };
    } finally { window.fetch = original; }
  }, caso);
  assert.equal(resultado.iniciales, caso === 'sesion' ? 2 : 1);
  assert.equal(resultado.llamadas, caso === 'sesion' ? 3 : 2);
  assert.deepEqual(resultado.estados, caso === 'error' ? ['rejected', 'rejected'] : ['fulfilled', 'fulfilled']);
  assert.equal(resultado.version, resultado.llamadas);
  if (caso === 'sesion') assert.deepEqual(resultado.tokens, ['Bearer cuenta-a', 'Bearer cuenta-b']);
});
