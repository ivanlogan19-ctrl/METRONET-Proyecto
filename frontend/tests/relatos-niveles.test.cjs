const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const niveles = require('../src/educacion/recorrido-integral.json');
const tarjetas = require('../src/educacion/catalogo-svgs-niveles.json');

test('Diez capítulos breves conservan la narración separada de las instrucciones', () => {
  const protagonistas = ['Ari', 'Sol', 'Dani', 'Sol', 'Ari', 'Sol', 'Ari', 'Dani', 'Sol', 'Dani'];
  for (const [indice, nivel] of niveles.entries()) {
    const relato = nivel.historia.texto;
    assert.ok(relato.includes(protagonistas[indice]));
    assert.ok(relato.length <= 280, `Capítulo ${nivel.numero}: evitar párrafos extensos`);
    assert.doesNotMatch(relato, /\b(?:Construí|Ubicá|Asigná|Guardá|Ejecutá|Pulsá|Ajustá|Volvé|UV|UT)\b/);
    assert.equal(nivel.preparacion.contexto, relato);
    assert.equal(nivel.transicion.ciudad, relato);
    assert.notEqual(nivel.objetivo, relato);
    assert.match(nivel.instrucciones, /Finalizar red/);
  }
  assert.match(niveles[0].historia.texto, /proyecto de Logística/);
  assert.match(niveles[9].historia.texto, /presentación junto a Ari y Sol/);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 1470, height: 800 }]) {
  test(`Los diez relatos y sus desafíos se leen completos a ${viewport.width}×${viewport.height}`, async t => {
    const navegador = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL });
    t.after(() => navegador.close());
    const escenarios = niveles.map(n => ({ ...n, relato: 'Relato anterior a la publicación.', idEscenario: n.numero,
      estado: 'DISPONIBLE', desbloqueado: true }));
    const v = await abrirPantalla(navegador, '/escenarios.html', { viewport, responder: req => {
      const ruta = new URL(req.url()).pathname;
      if (ruta === '/api/juego/progreso') return { json: { escenarios, cantidadNiveles: 10, nivelesCompletados: 0 } };
      if (ruta.endsWith('/contenido')) {
        const nivel = niveles.find(n => ruta.includes(`/niveles/${n.numero}/`));
        if (nivel) return { json: { numero: nivel.numero, version: 2,
          tarjetas: tarjetas[nivel.numero - 1].tarjetas, desafio: { ...nivel, relato: nivel.historia.texto } } };
      }
    } });
    t.after(() => v.contexto.close());
    for (const nivel of niveles) {
      await v.pagina.locator(`[data-seleccionar-escenario="${nivel.numero}"]`).click();
      const tarjeta = v.pagina.locator('.metronet-escenarios-pagina__tarjeta');
      await v.pagina.waitForFunction(relato => document.querySelector('.metronet-escenarios-pagina__relato')?.textContent === relato,
        nivel.historia.texto);
      assert.equal(await tarjeta.locator('.metronet-escenarios-pagina__relato').innerText(), nivel.historia.texto);
      assert.equal(await tarjeta.locator('.metronet-escenarios-pagina__objetivo p').innerText(), nivel.objetivo);
      const medidas = await tarjeta.evaluate(elemento => {
        const cajas = [...elemento.querySelectorAll('p, button')].map(e => {
          const r = e.getBoundingClientRect();
          return { texto: e.textContent, alto: e.clientHeight, contenido: e.scrollHeight,
            ancho: e.clientWidth, contenidoAncho: e.scrollWidth, superior: r.top, inferior: r.bottom };
        });
        return { cajas, alto: document.documentElement.scrollHeight, ancho: document.documentElement.scrollWidth };
      });
      assert.ok(medidas.alto <= viewport.height + 1 && medidas.ancho <= viewport.width + 1, JSON.stringify(medidas));
      for (const caja of medidas.cajas) assert.ok(caja.contenido <= caja.alto + 1
        && caja.contenidoAncho <= caja.ancho + 1 && caja.superior >= 0 && caja.inferior <= viewport.height + 1, JSON.stringify(caja));
    }
    if (viewport.width === 1470) await v.pagina.screenshot({ path: '/tmp/metronet-relato-nivel-10.png' });
    assert.deepEqual(v.errores, []);
  });
}
