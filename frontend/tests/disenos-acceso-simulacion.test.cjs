const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

for (const administrador of [false, true]) test(`Acceso al diseño preparado; bloqueos y actualización (${administrador ? 'administrador' : 'jugador'})`, async t => {
  let preparada = true;
  const redes = ['EN_DISENO', 'GUARDADO', 'VALIDADO', 'COMPLETADO', 'VALIDADO', 'VALIDADO', 'VALIDADO'].map((estado, i) => ({
    idDiseno: 77 + i, idUsuario: 7, idEscenario: i === 3 ? 45 : i === 5 ? 43 : 42,
    nombre: `Red ${i}`, estado, modo: i === 3 ? 'EDICION_LIBRE' : 'NIVEL',
  }));
  const v = await abrirPantalla(navegador, '/disenos.html?idDiseno=999&idIntento=999', {
    administrador,
    responder: req => {
      const path = new URL(req.url()).pathname;
      if (path === '/api/admin/disenos' || path === '/api/simulaciones') return { json: redes };
      if (path === '/api/juego/escenarios') return { json: [
        { idEscenario: 42, numero: 2 }, { idEscenario: 43, numero: 3, herramientasHabilitadas: { simulacion: false } },
        { idEscenario: 45, numero: null, desbloqueado: true },
      ] };
      if (path === '/api/simulaciones/83') return { status: 503, json: { detail: 'Sin conexión' } };
      if (/^\/api\/simulaciones\/\d+$/.test(path)) return { json: { preparadoParaSimular: Number(path.split('/').pop()) !== 81 && preparada } };
    },
  });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  await p.locator('#listaMisDisenos[aria-busy="false"]').waitFor({ state: 'attached' });
  for (const id of [77, 78, 81, 82, 83]) assert.equal(await p.locator(`[data-diseno="${id}"] .metronet-disenos__accion--simular`).isDisabled(), true);
  for (const id of [79, 80]) {
    const enlace = p.locator(`[data-diseno="${id}"] a.metronet-disenos__accion--simular`);
    const url = new URL(await enlace.getAttribute('href'), 'http://localhost');
    assert.equal(url.pathname, '/simulacion.html');
    assert.equal(url.searchParams.get('idDiseno'), String(id));
    assert.equal(url.searchParams.get('idEscenario'), id === 80 ? '45' : '42');
    assert.equal(url.searchParams.has('idIntento'), false, 'No arrastrar el intento de otra red');
  }
  assert.equal(v.solicitudes.some(s => s.method === 'POST'), false, 'Consultar no valida ni ejecuta redes');
  preparada = false;
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await p.locator('[data-diseno="79"] button.metronet-disenos__accion--simular').waitFor();
  assert.equal(await p.locator('[data-diseno="80"] .metronet-disenos__accion--simular').isDisabled(), true);
  assert.deepEqual(v.errores, []);
});
