const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');

for (const modo of ['NIVEL', 'EDICION_LIBRE']) for (const zoom of [false, true]) {
  test(`${modo}: agregar estaciones conserva las existentes y el encuadre ${zoom ? 'con zoom' : 'sin zoom'}`, async t => {
    const navegador = await abrirNavegador();
    t.after(() => navegador.close());
    const vista = await abrirEditor(navegador, { modo, viewport: { width: 1470, height: 800 }, primeraPasada: false,
      ...(modo === 'NIVEL' ? { escenario: { idEscenario: 2, numero: 2, nombre: 'Ampliar red',
        dificultad: 'Inicial', herramientasHabilitadas: { estaciones: true, lineas: true, metros: true, conexiones: true, simulacion: true } } } : {}) });
    t.after(() => vista.contexto.close());
    const p = vista.pagina;
    if (modo === 'EDICION_LIBRE') await p.getByRole('button', { name: 'Ir a construir', exact: true }).click();
    await p.locator('[data-elegir-herramienta="estaciones"]').click();
    await p.evaluate(zoom => {
      const e = editorPrueba.escena;
      if (zoom) e.controlZoom.establecerZoom(e.cameras.main.zoom * 1.4);
    }, zoom);
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const antes = structuredClone(vista.diseno.estaciones);
    await p.evaluate(() => {
      const e = editorPrueba.escena, nombres = editorPrueba.disenoActual.estaciones.map(s => s.nombre);
      const medir = () => {
        const c = e.cameras.main, r = e.game.canvas.getBoundingClientRect();
        return nombres.map(nombre => {
          const s = editorPrueba.disenoActual.estaciones.find(s => s.nombre === nombre);
          const punto = e.capaRedMetro.convertirPosicion(s.posicionX, s.posicionY);
          return [nombre, r.x + (punto.x - c.worldView.x) * c.zoom,
            r.y + (punto.y - c.worldView.y) * c.zoom];
        });
      };
      window.posicionesIniciales = medir();
      window.saltosEstaciones = [];
      const observar = () => {
        const posiciones = medir();
        if (posiciones.some((s, i) => Math.abs(s[1] - posicionesIniciales[i][1]) > 0.5
          || Math.abs(s[2] - posicionesIniciales[i][2]) > 0.5)) window.saltosEstaciones.push(posiciones);
        window.observadorEstaciones = requestAnimationFrame(observar);
      };
      window.observadorEstaciones = requestAnimationFrame(observar);
    });
    for (const x of [750, 770]) {
      const punto = await p.evaluate(x => {
        const e = editorPrueba.escena, c = e.cameras.main;
        const punto = e.capaRedMetro.convertirPosicion(x, 480), r = e.game.canvas.getBoundingClientRect();
        return { x: r.x + (punto.x - c.worldView.x) * c.zoom, y: r.y + (punto.y - c.worldView.y) * c.zoom };
      }, x);
      const cantidad = vista.diseno.estaciones.length;
      await p.mouse.move(punto.x, punto.y);
      await p.mouse.down();
      // Un clic real puede oscilar unos píxeles sin convertirse en arrastre.
      await p.mouse.move(punto.x + 3, punto.y + 2, { steps: 3 });
      await p.mouse.up();
      await p.waitForFunction(cantidad => editorPrueba.disenoActual.estaciones.length === cantidad + 1, cantidad);
      await p.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente);
    }
    const saltos = await p.evaluate(() => {
      cancelAnimationFrame(window.observadorEstaciones);
      return window.saltosEstaciones;
    });
    assert.deepEqual(vista.diseno.estaciones.slice(0, antes.length), antes, 'Las coordenadas guardadas no cambian');
    assert.deepEqual(saltos, [], 'Agregar una estación no desplaza las existentes en pantalla');
    assert.deepEqual(vista.errores, []);
  });
}
