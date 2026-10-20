const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');

for (const numero of [null, ...Array.from({length:10}, (_, i) => i + 1)]) test(`Edición ${numero ?? 'libre'}: herramientas sin selector de configuración y accesos uniformes`, async t => {
  const navegador = await abrirNavegador(); t.after(() => navegador.close());
  const lineas = Array.from({length:12}, (_, i) => ({nombre:`Línea ${i + 1}`}));
  const escenario = numero ? {idEscenario:numero,numero,nombre:'Red',estado:'EN_DESARROLLO',desbloqueado:true,
    herramientasHabilitadas:{estaciones:true,lineas:true,conexiones:true,metros:true,simulacion:true}} : undefined;
  const v = await abrirEditor(navegador, {escenario,modo:numero ? 'NIVEL' : 'EDICION_LIBRE',primeraPasada:false,viewport:{width:1470,height:800},lineas,
    tramos:lineas.map(l=>({nombreLinea:l.nombre,estacionA:'Centro',estacionB:'Parque',distanciaKm:12}))});
  t.after(() => v.contexto.close());
  const p=v.pagina;
  if (!numero) {
    await p.getByRole('button',{name:'Ir a construir',exact:true}).click();
    await p.locator('dialog.metronet-extras').waitFor({state:'hidden'});
  }
  assert.equal(await p.locator('.metronet-selector-lineas-editor').count(),0);
  assert.equal(await p.getByRole('button',{name:'Línea a configurar',exact:true}).count(),0);
  const medidas = await p.locator('.metronet-barra-geografica :is(.metronet-aprender-acceso, .metronet-extras-acceso, .metronet-tutorial > summary, .metronet-hud > summary, .metronet-poi > summary)').evaluateAll(es => es.filter(e => !e.hidden && e.getBoundingClientRect().width > 0).map(e => {
    const r=e.getBoundingClientRect();return {nombre:e.getAttribute('aria-label'),ancho:r.width,alto:r.height};
  }));
  assert.ok(medidas.length >= 3);
  for(const medida of medidas) assert.deepEqual([medida.ancho,medida.alto],[32,32],JSON.stringify(medida));
  if (!numero) {
    const acciones = await p.locator('.metronet-editor-finalizar .metronet-editor-bloque__botones').evaluate(e => {
      const a=e.querySelector('[data-guardar]').getBoundingClientRect();
      const b=e.querySelector('[data-ir-simulacion]').getBoundingClientRect();
      const fila=e.getBoundingClientRect();
      return {anchoA:a.width,anchoB:b.width,desnivel:a.top-b.top,inicio:a.left-fila.left,fin:fila.right-b.right};
    });
    assert.ok(acciones.anchoA > 60 && Math.abs(acciones.anchoA-acciones.anchoB)<1,JSON.stringify(acciones));
    assert.ok([acciones.desnivel,acciones.inicio,acciones.fin].every(n=>Math.abs(n)<1),JSON.stringify(acciones));
    await p.locator('[data-medicion-distancias]').click();
    assert.equal(await p.locator('[data-medicion-distancias]').getAttribute('aria-pressed'),'true');
  }
  assert.equal(v.solicitudes.filter(s => s.ruta.startsWith('/api/simulaciones')).length,0,'La regla conserva la red sin escrituras');
  assert.deepEqual(v.errores,[]);
});
