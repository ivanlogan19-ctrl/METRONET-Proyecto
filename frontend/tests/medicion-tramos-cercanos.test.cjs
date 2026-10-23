const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');

test('El cuadro conserva totales, colores, paginación y fuente pixelada sin etiquetas sobre las vías', async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  const lineas = Array.from({length:6}, (_,i) => ({nombre:`Línea 0${i+1}`}));
  const v = await abrirEditor(navegador, {modo:'LIBRE',lineas,
    estaciones:[{nombre:'A',posicionX:620,posicionY:430},{nombre:'B',posicionX:680,posicionY:430}],
    tramos:lineas.map((l,i) => ({nombreLinea:l.nombre,estacionA:'A',estacionB:'B',distanciaKm:i+1.5}))});
  t.after(() => v.contexto.close());
  const p = v.pagina;
  await p.locator('[data-medicion-distancias]').click();
  await p.evaluate(() => document.fonts.ready);
  assert.equal(await p.locator('.metronet-mediciones__titulo').textContent(), 'Distancia total');
  assert.equal(await p.locator('.metronet-mediciones__subtitulo').count(), 0);
  assert.equal(await p.locator('.metronet-mediciones__tramo').count(), 0);
  assert.equal(await p.locator('.metronet-mediciones__fila').count(), 5);
  const anterior = p.locator('.metronet-mediciones').getByRole('button',{name:'Anterior',exact:true});
  const siguiente = p.locator('.metronet-mediciones').getByRole('button',{name:'Siguiente',exact:true});
  assert.equal(await anterior.isDisabled(), true);
  await siguiente.click();
  assert.equal(await p.locator('.metronet-mediciones__fila').count(), 1);
  assert.equal(await p.locator('.metronet-mediciones__fila b').textContent(), '6,5 km');
  assert.equal(await siguiente.isDisabled(), true);
  await anterior.click();
  const estilo = await p.locator('.metronet-mediciones__total').evaluate(e => ({
    fuente:getComputedStyle(e).fontFamily, alineacion:getComputedStyle(e.querySelector('strong')).textAlign,
    colores:[...e.querySelectorAll('.metronet-mediciones__fila i')].map(c => c.style.background),
    dentro:e.getBoundingClientRect().right <= e.parentElement.getBoundingClientRect().right,
  }));
  assert.match(estilo.fuente,/Silkscreen/);
  assert.equal(estilo.alineacion,'center');
  assert.equal(new Set(estilo.colores).size,5);
  assert.ok(estilo.dentro);
  await p.screenshot({path:`/tmp/metronet-distancia-editor-${process.env.METRONET_BROWSER || 'chromium'}.png`});
  await p.locator('[data-medicion-distancias]').click();
  assert.equal(await p.locator('.metronet-mediciones').isVisible(),false);
  assert.deepEqual(v.errores,[]);
});
