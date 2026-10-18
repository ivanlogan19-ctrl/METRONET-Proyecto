const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');

test('Lugares: búsqueda, capas y guía breve mantienen sus acciones', async () => {
  const browser = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL });
  try {
    const {pagina:p, errores} = await abrirEditor(browser, { primeraPasada:false, viewport:{width:1440,height:900} });
    await p.locator('.metronet-poi > summary').click();
    assert.equal(await p.locator('.metronet-poi__categorias button').count(),8);
    assert.equal(await p.getByRole('searchbox').isVisible(),true);
    await p.mouse.move(800,700);
    await p.locator('.metronet-poi__panel').screenshot({path:'/tmp/metronet-lugares.png'});
    const eye=p.getByRole('button',{name:'Mostrar barrios',exact:true});
    const before=await eye.getAttribute('aria-pressed'); await eye.click();
    assert.notEqual(await eye.getAttribute('aria-pressed'),before); await eye.click();
    await p.getByRole('searchbox').fill('Palacio');
    assert.ok(await p.locator('.metronet-panel-puntos-item').count()>0);
    await p.locator('.metronet-panel-puntos-item').first().click();
    assert.equal(await p.locator('.metronet-poi').evaluate(e=>e.open),false);
    await p.locator('.metronet-poi > summary').click();
    await p.getByRole('searchbox').press('Escape');
    assert.equal(await p.locator('.metronet-poi').evaluate(e=>e.open),false);
    await p.locator('.metronet-tutorial > summary').click();
    await p.getByRole('heading',{name:'Guía rápida'}).waitFor({state:'visible'});
    await p.locator('.metronet-guia-rapida').screenshot({path:'/tmp/metronet-guia.png'});
    assert.equal(await p.getByRole('button',{name:'Consultar ayuda'}).count(),0);
    assert.equal(await p.locator('.metronet-tutorial__completado').count(),0);
    await p.getByRole('button',{name:'Iniciar tutorial',exact:true}).click();
    assert.equal(await p.locator('.metronet-recorrido').count()>0,true);
    await p.evaluate(()=>editorPrueba.panelTutorial.recorrido.terminar(true,true));
    await p.locator('.metronet-tutorial > summary').click();
    assert.equal(await p.locator('.metronet-tutorial__completado').textContent(),'Tutorial completado');
    assert.deepEqual(errores,[]);
  } finally { await browser.close(); }
});
