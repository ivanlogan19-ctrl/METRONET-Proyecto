const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');

let navegador;
before(async () => { navegador = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

const camara = pagina => pagina.evaluate(() => {
  const escena = juegoPrueba.scene.getScene('MapaScene');
  const c = escena.cameras.main, lienzo = juegoPrueba.canvas;
  return { scrollX:c.scrollX, scrollY:c.scrollY, zoom:c.zoom, width:c.width, height:c.height,
    cssWidth:lienzo.getBoundingClientRect().width, cssHeight:lienzo.getBoundingClientRect().height,
    backingWidth:lienzo.width, backingHeight:lienzo.height };
});

test('Guardar confirma persistencia con box verde centrado durante dos segundos sin mover cámara', async t => {
  const { pagina, contexto, errores } = await abrirEditor(navegador,{ viewport:{width:1280,height:720} });
  t.after(async () => { await contexto.close(); assert.deepEqual(errores,[]); });
  const antes = await camara(pagina);
  let continuar;
  const barrera = new Promise(resolve => { continuar = resolve; });
  await pagina.route('**/api/simulaciones/77/guardar', async ruta => { await barrera; await ruta.fallback(); });
  const solicitud = pagina.waitForRequest(r => r.url().endsWith('/api/simulaciones/77/guardar'));
  const clic = pagina.locator('[data-guardar]').click();
  await solicitud;
  assert.equal(await pagina.locator('.metronet-aviso-guardado').count(),0);
  continuar();
  await clic;
  const aviso = pagina.locator('.metronet-aviso-guardado');
  await aviso.waitFor();
  assert.equal(await aviso.innerText(),'Diseño guardado');
  const estilo = await aviso.evaluate(e => {
    const r=e.getBoundingClientRect();
    return { centroX:(r.left+r.right)/2, centroY:(r.top+r.bottom)/2,
      pointer:getComputedStyle(e).pointerEvents, fondo:getComputedStyle(e).backgroundColor };
  });
  assert.ok(Math.abs(estilo.centroX-640)<2 && Math.abs(estilo.centroY-360)<2,JSON.stringify(estilo));
  assert.equal(estilo.pointer,'none');
  assert.equal(estilo.fondo,'rgb(21, 91, 64)');
  assert.deepEqual(await camara(pagina),antes);
  await aviso.waitFor({state:'detached',timeout:4000});
  assert.deepEqual(await camara(pagina),antes);
});

test('Guardar fallido no anuncia éxito; una segunda confirmación renueva el mismo aviso', async t => {
  const { pagina, contexto, errores } = await abrirEditor(navegador);
  t.after(async () => { await contexto.close(); assert.deepEqual(errores,[]); });
  await pagina.route('**/api/simulaciones/77/guardar', ruta => ruta.fulfill({status:503,json:{message:'No se pudo guardar'}}));
  await pagina.locator('[data-guardar]').click();
  await pagina.waitForFunction(() => !editorPrueba.finalizacionEnCurso);
  assert.equal(await pagina.locator('.metronet-aviso-guardado').count(),0);
  await pagina.unroute('**/api/simulaciones/77/guardar');
  await pagina.locator('[data-guardar]').click();
  const aviso = pagina.locator('.metronet-aviso-guardado');
  await aviso.waitFor();
  await pagina.waitForTimeout(1100);
  await pagina.locator('[data-guardar]').click();
  await aviso.waitFor();
  assert.equal(await aviso.count(),1);
  await pagina.waitForTimeout(1100);
  assert.equal(await aviso.count(),1,'El primer timer no retira el aviso renovado');
  await aviso.waitFor({state:'detached',timeout:3000});
});
