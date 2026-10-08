const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());

for (const contexto of ['editor', 'simulacion']) for (const width of [1440, 390]) {
  test(`Tutorial ${contexto} ${width}: acciones semánticas y títulos sin barra azul`, async t => {
    const opciones = { viewport: { width, height: 900 } };
    const v = contexto === 'editor'
      ? await abrirEditor(navegador, { ...opciones, escenario: { ...niveles[0], idEscenario: 1, desbloqueado: true }, novedadPresentada: true })
      : await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', opciones);
    t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
    const p = v.pagina;
    if (contexto === 'editor') {
      await p.locator('.metronet-recorrido').waitFor();
      await p.keyboard.press('Escape');
      await p.locator('.metronet-tutorial > summary').click();
    } else await p.locator('#tutorialPantallaSimulacion').click();
    const panel = p.locator('.metronet-tutorial__panel:popover-open');
    await panel.waitFor();
    async function tituloSinBarra(titulo) {
      const css = await titulo.evaluate(e => ({ sombra: getComputedStyle(e).boxShadow,
        borde: getComputedStyle(e).borderLeftWidth, antes: getComputedStyle(e, '::before').display,
        despues: getComputedStyle(e, '::after').display, contorno: getComputedStyle(e).webkitTextStrokeWidth }));
      assert.deepEqual(css, { sombra: 'none', borde: '0px', antes: 'none', despues: 'none', contorno: '0px' });
    }
    async function color(boton, token) {
      const css = await boton.evaluate((e, token) => {
        const muestra = document.createElement('span'); muestra.style.backgroundColor = `var(${token})`; e.append(muestra);
        const estilos = getComputedStyle(e), esperado = getComputedStyle(muestra).backgroundColor;
        muestra.remove(); return { actual: estilos.backgroundColor, esperado };
      }, token);
      assert.equal(css.actual, css.esperado);
    }
    await tituloSinBarra(panel.locator('h2'));
    const repetir = panel.getByRole('button', { name: 'Recorrer la pantalla' });
    await color(repetir, '--tutorial-acento');
    await repetir.click();
    const guia = p.locator('.metronet-recorrido');
    await guia.waitFor();
    await tituloSinBarra(guia.locator('h2'));
    const omitir = guia.getByRole('button', { name: 'Omitir', exact: true });
    const siguiente = guia.getByRole('button', { name: 'Siguiente', exact: true });
    await color(omitir, '--danger');
    await color(siguiente, '--success');
    const posicion = await guia.boundingBox();
    assert.ok(posicion.x >= 0 && posicion.x + posicion.width <= width);
    await siguiente.click();
    await tituloSinBarra(guia.locator('h2'));
    await omitir.click();
    await guia.waitFor({ state: 'detached' });
  });
}
