const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
async function abrir(t, width = 1440) {
  const v = await abrirPantalla(navegador, '/inicio.html', { viewport: { width, height: 900 } });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  await v.pagina.evaluate(async () => {
    (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true);
    window.controlResultado = new AbortController();
    const { presentarResultadoNivel } = await import('/src/educacion/TransicionNivel.js');
    window.resultado = presentarResultadoNivel({ escenarios: [
      { idEscenario: 1, numero: 1, nombre: 'Primer recorrido', estado: 'COMPLETADO', puntajeMaximo: 100 },
      { idEscenario: 2, numero: 2, nombre: 'Segundo nivel', desbloqueado: true },
    ] }, 1, { completado: true, puntaje: 100, idSiguienteEscenario: 2,
      desempeno: { puntajeMaximo: 100, explicacion: '4 de 4 criterios satisfechos: 100/100. Todos los criterios están satisfechos.' } },
    { signal: window.controlResultado.signal, mejorPuntajeAnterior: 75 });
  });
  return v;
}
for (const width of [1440, 390]) test(`Resultado ${width}: puntos antes de la animación y sin descuentos inventados`, async t => {
  const { pagina: p, solicitudes } = await abrir(t, width);
  const resultado = p.locator('.metronet-resultado-nivel');
  await resultado.waitFor();
  assert.match(await resultado.innerText(), /Ganaste 100 puntos/);
  assert.match(await resultado.innerText(), /4 de 4 criterios/);
  assert.match(await resultado.innerText(), /Descuentos aplicados\s+0/);
  assert.match(await resultado.innerText(), /Nuevo récord personal/);
  assert.equal(await p.locator('.metronet-victoria').count(), 0);
  assert.equal(await resultado.evaluate(e => e.scrollWidth > e.clientWidth), false);
  await resultado.getByRole('button', { name: 'Continuar', exact: true }).click();
  const animacion = p.locator('.metronet-victoria');
  await animacion.waitFor();
  assert.equal(await resultado.count(), 0);
  assert.equal(await animacion.locator('.metronet-victoria__resultado').count(), 0);
  assert.doesNotMatch(await animacion.innerText(), /Ganaste 100|puntaje obtenido|Descuentos aplicados/);
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => window.resultado), null);
  assert.equal(solicitudes.filter(s => s.method !== 'GET').length, 0);
});
for (const salida of ['Escape', 'abortar']) test(`Resultado: ${salida} cancela sin dejar una transición pendiente`, async t => {
  const { pagina: p } = await abrir(t);
  await p.locator('.metronet-resultado-nivel').waitFor();
  if (salida === 'Escape') await p.keyboard.press('Escape');
  else await p.evaluate(() => window.controlResultado.abort());
  assert.equal(await p.evaluate(() => window.resultado), null);
  assert.equal(await p.locator('.metronet-resultado-nivel, .metronet-victoria').count(), 0);
});
