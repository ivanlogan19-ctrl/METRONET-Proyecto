const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');

test('Las flechas animan sin reconstruir las curvas; hora y escala invalidan su geometría', async t => {
  const browser = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto((process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173') + '/login.html');
  const resultado = await page.evaluate(async () => {
    const { default: Capa } = await import('/src/mapa/capas/CapaDesplazamientos.js');
    const { default: Reloj } = await import('/src/mapa/desplazamientos/RelojCapas.mjs');
    const datos = await (await fetch('/src/mapa/datos/desplazamientos-historicos.json')).json();
    const curvas = [], flechas = [];
    const grafico = {
      visible: true, setDepth() { return this; }, setVisible(v) { this.visible = v; return this; },
      setAlpha() { return this; }, clear() {}, lineStyle() {}, fillStyle() {}, destroy() {},
      strokePoints(p) { curvas.push(p); }, fillTriangle(...p) { flechas.push(p); },
    };
    const escena = { add: { graphics: () => grafico }, cameras: { main: { zoom: 1 } }, events: { on() {}, off() {} } };
    let escala = 1;
    const barrios = { calcularEscalaMapa: () => escala, convertirCoordenada: ([x,y], e) => ({ x: x*e, y: y*e }) };
    const reloj = new Reloj(); reloj.cambiarHora(8);
    const capa = new Capa(escena, barrios, reloj);
    try {
      capa.datos = datos; capa.estado = 'lista'; capa.visible = true; capa.establecerDisponible(true); curvas.length = 0; flechas.length = 0; capa.redibujar();
      const n = capa.flujos.length, base = curvas.slice(0, n*2), inicio = flechas[0];
      curvas.length = 0; flechas.length = 0;
      for (let i=0; i<60; i++) capa.avanzar(16);
      const reutilizadas = curvas.every((p,i) => p === base[i % (n*2)]);
      const seMueven = JSON.stringify(inicio) !== JSON.stringify(flechas.at(-n));
      curvas.length = 0; reloj.cambiarHora(18);
      const horaCambia = JSON.stringify(curvas[0]) !== JSON.stringify(base[0]);
      const hora = curvas[0]; curvas.length = 0; escala = 2; capa.redibujar();
      const escalaCambia = curvas[0].every((p,i) => p.x === hora[i].x*2 && p.y === hora[i].y*2);
      return { n, reutilizadas, seMueven, horaCambia, escalaCambia };
    } finally { capa.eliminar(); reloj.eliminar(); }
  });
  assert.ok(resultado.n > 0);
  assert.equal(resultado.seMueven, true);
  assert.equal(resultado.horaCambia, true);
  assert.equal(resultado.escalaCambia, true);
  assert.equal(resultado.reutilizadas, true, 'La animación debe reutilizar la geometría mientras la hora y escala no cambian');
});
