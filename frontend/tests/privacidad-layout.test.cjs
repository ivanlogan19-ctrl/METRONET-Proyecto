const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => navegador?.close());

for (const [width,height] of [[1280,720],[1470,840],[390,844]]) {
  test(`Consentimiento ${width}x${height}: música sin desplazar logo ni contenido`, async t => {
    const v = await abrirPantalla(navegador, '/privacidad.html', {contenedor:true,viewport:{width,height}});
    t.after(() => v.contexto.close());
    await v.vista.locator('[data-control-musica]').waitFor();
    const medidas = await v.vista.evaluate(() => {
      const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width};};
      return {logo:rect('.auth-card__presentacion'),contenido:rect('.auth-card__contenido'),control:rect('[data-control-musica]'),
        tarjeta:rect('.privacy-card'),volver:rect('.auth-action'),ancho:innerWidth,alto:innerHeight,
        desborde:document.documentElement.scrollWidth>innerWidth};
    });
    await v.pagina.screenshot({path:`/tmp/metronet-privacidad-${process.env.METRONET_BROWSER || 'chrome'}-${width}.png`,fullPage:true});
    assert.equal(medidas.desborde,false);
    assert.ok(medidas.control.x>=medidas.tarjeta.x && medidas.control.right<=medidas.tarjeta.right);
    if(width>=800) {
      assert.ok(medidas.contenido.x>=medidas.logo.right,'El texto debe estar a la derecha del logo');
      assert.ok(medidas.contenido.y<medidas.logo.bottom && medidas.logo.y<medidas.contenido.bottom,'Ambas columnas deben compartir la fila');
      assert.ok(medidas.contenido.width>medidas.logo.width,'El consentimiento debe ocupar la columna amplia');
      assert.ok(medidas.volver.bottom<=medidas.alto,'Volver al registro debe quedar dentro de la pantalla');
    }
    await v.vista.locator('[data-control-musica] summary').click();
    await v.vista.getByLabel('Silenciar música').check();
    await v.pagina.waitForFunction(()=>[...document.querySelectorAll('audio')].every(a=>a.paused || a.volume===0));
    assert.deepEqual(v.errores,[]);
  });
}
