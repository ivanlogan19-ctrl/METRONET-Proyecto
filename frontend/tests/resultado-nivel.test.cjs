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
  // La importación de la transición es asíncrona: esperar su diálogo antes de
  // cancelarlo y abrir el siguiente evita que el montaje anterior llegue tarde.
  await v.pagina.locator('.metronet-resultado-nivel[open]').waitFor();
  return v;
}
for (const width of [1440, 390]) test(`Resultado ${width}: puntos antes de la animación y sin descuentos inventados`, async t => {
  const { pagina: p, solicitudes } = await abrir(t, width);
  const resultado = p.locator('.metronet-resultado-nivel');
  await resultado.waitFor();
  assert.match(await resultado.innerText(), /Ganaste\s+100\s+puntos/);
  await resultado.getByText('Regla original de este intento', { exact: true }).click();
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
for (const width of [1440, 390]) test(`Descuentos ${width}: muestra motivos del servidor y total antes de continuar`, async t => {
  const { pagina: p } = await abrir(t, width);
  await p.evaluate(async () => {
    window.controlResultado.abort();
    await window.resultado;
    const { mostrarResultadoNivel } = await import('/src/educacion/PantallaResultadoNivel.js');
    window.resultadoDescuentos = mostrarResultadoNivel({ nombre: 'Conectar lugares', puntajeMaximo: 100 }, {
      puntaje: 80, desempeno: { puntajeMaximo: 100, explicacion: 'Toda la consigna está cumplida.',
        desglosePuntuacion: { version: 'puntuacion-progreso-v1', puntosBase: 100, practicasGratuitas: 2,
          descuentoPorEjecucion: 10, descuentoMaximo: 40, puntajeMinimoAprobacion: 60,
          totalDescontado: 20, total: 80, descuentos: [
            { idSimulacion: 307, numeroEjecucion: 3, puntos: 10, motivos: ['Cubrir POI solicitado', 'Asignar Metro a cada línea'] },
            { idSimulacion: 308, numeroEjecucion: 4, puntos: 10, motivos: ['Cubrir POI solicitado'] },
          ] }
      }
    });
  });
  const dialogo = p.locator('.metronet-resultado-nivel');
  assert.match(await dialogo.innerText(), /Ganaste\s+80\s+puntos/);
  assert.match(await dialogo.innerText(), /Ejecución 3.*Sin nuevos avances/s);
  await dialogo.locator('summary').first().click();
  assert.match(await dialogo.innerText(), /Cubrir POI solicitado/);
  assert.match(await dialogo.innerText(), /Asignar Metro a cada línea/);
  assert.deepEqual(await dialogo.locator('dd').allTextContents(), ['100', '−10', '−10', '80']);
  assert.equal(await dialogo.evaluate(e => e.scrollWidth > e.clientWidth), false);
  assert.match(await dialogo.innerText(), /Toda la consigna cumplida/);
  await p.screenshot({ path: `/tmp/metronet-puntos-${width}.png` });
  await dialogo.getByRole('button', { name: 'Continuar', exact: true }).click();
  assert.equal(await p.evaluate(() => window.resultadoDescuentos), true);
});

test('Tope de descuentos en pantalla pequeña: cuenta completa, desplazamiento y teclado accesibles', async t => {
  const { pagina: p } = await abrir(t, 320);
  await p.setViewportSize({ width: 320, height: 568 });
  await p.evaluate(async () => {
    window.controlResultado.abort();
    await window.resultado;
    const { mostrarResultadoNivel } = await import('/src/educacion/PantallaResultadoNivel.js');
    window.resultadoDescuentos = mostrarResultadoNivel({ numero: 10, nombre: 'Una red para Montevideo', puntajeMaximo: 100 }, {
      puntaje: 60, desempeno: { puntajeMaximo: 100, desglosePuntuacion: {
        puntosBase: 100, practicasGratuitas: 4, descuentoMaximo: 40, puntajeMinimoAprobacion: 60,
        totalDescontado: 40, total: 60, descuentos: Array.from({ length: 4 }, (_, i) => ({
          numeroEjecucion: i + 5, puntos: 10,
          motivos: ['Cubrir los puntos de interés de la consigna', 'Conectar todas las estaciones en un recorrido continuo'],
        })),
      } },
    });
  });
  const dialogo = p.locator('.metronet-resultado-nivel');
  assert.deepEqual(await dialogo.locator('dd').allTextContents(), ['100', '−10', '−10', '−10', '−10', '60']);
  assert.match(await dialogo.innerText(), /Tope alcanzado: 40 puntos de descuento/);
  assert.equal(await dialogo.evaluate(e => e.scrollWidth > e.clientWidth), false);
  const caja = await dialogo.boundingBox();
  assert.ok(caja.x >= 0 && caja.y >= 0 && caja.x + caja.width <= 320 && caja.y + caja.height <= 568);
  for (let i = 0; i < 5; i++) await p.keyboard.press('Tab');
  const continuar = dialogo.getByRole('button', { name: 'Continuar', exact: true });
  assert.equal(await continuar.evaluate(e => document.activeElement === e), true);
  await p.screenshot({ path: '/tmp/metronet-puntos-tope-320.png' });
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(() => window.resultadoDescuentos), true);
});
