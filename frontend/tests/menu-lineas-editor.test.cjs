const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');

for (const numero of [null, ...Array.from({length:10}, (_, i) => i + 1)]) test(`Edición ${numero ?? 'libre'}: selector lateral paginado conserva la red y los iconos`, async t => {
  const navegador = await abrirNavegador(); t.after(() => navegador.close());
  const lineas = Array.from({length:12}, (_, i) => ({nombre:`Línea ${i + 1}`}));
  const escenario = numero ? {idEscenario:numero,numero,nombre:'Red',estado:'EN_DESARROLLO',desbloqueado:true,
    herramientasHabilitadas:{estaciones:true,lineas:true,conexiones:true,metros:true,simulacion:true}} : undefined;
  const v = await abrirEditor(navegador, {escenario,primeraPasada:false,viewport:{width:1470,height:800},lineas,
    tramos:lineas.map(l=>({nombreLinea:l.nombre,estacionA:'Centro',estacionB:'Parque',distanciaKm:12}))});
  t.after(() => v.contexto.close());
  const p=v.pagina;
  const antes = await p.locator('[data-elegir-herramienta] svg').evaluateAll(elementos => elementos.map(e => e.outerHTML));
  await p.locator('.metronet-selector-lineas-editor > button').click();
  await p.waitForFunction(() => document.querySelector('.metronet-selector-lineas-editor [popover]').matches(':popover-open'));
  const limites = await p.locator('.metronet-selector-lineas-editor').evaluate(e => {
    const b=e.querySelector('button').getBoundingClientRect(),m=e.querySelector('[popover]').getBoundingClientRect();
    return {derecha:m.right,acceso:b.left,abajo:m.bottom,arriba:m.top,scroll:document.documentElement.scrollHeight};
  });
  assert.ok(limites.derecha <= limites.acceso && limites.arriba >= 0 && limites.abajo <= 800, JSON.stringify(limites));
  assert.ok(limites.scroll <= 801, JSON.stringify(limites));
  await p.getByRole('button',{name:'Opciones siguientes',exact:true}).click();
  await p.getByRole('button',{name:'Línea 6',exact:true}).click();
  assert.equal(await p.evaluate(() => editorPrueba.creacionDirecta.lineaActiva), 'Línea 6');
  assert.equal(await p.locator('.metronet-selector-lineas-editor > button').getAttribute('aria-expanded'),'false');
  assert.deepEqual(await p.locator('[data-elegir-herramienta] svg').evaluateAll(elementos => elementos.map(e => e.outerHTML)), antes);
  assert.equal(v.solicitudes.length,0,'Seleccionar no escribe ni cambia la red');
  assert.deepEqual(v.errores,[]);
});
