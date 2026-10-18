const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('Administración: Usuarios no descarga el editor de niveles y abrirlo conserva sus acciones', async t => {
  const navegador = await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL});
  t.after(()=>navegador.close());
  const v = await abrirPantalla(navegador, '/admin.html', {responder:r=>new URL(r.url()).pathname==='/api/admin/niveles'
    ? {json:[{numero:1,nombre:'Primer recorrido'}]} : null});
  t.after(()=>v.contexto.close());
  const p = v.pagina;
  const descargas = () => p.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/AdministracionNiveles.js')).length);
  assert.equal(await descargas(),0,'Usuarios no necesita descargar el editor, sus mapas ni su catálogo');
  await p.locator('[data-vista="niveles"]').click();
  await p.locator('[data-editar-nivel="1"]').waitFor();
  assert.equal(await descargas(),1);
  await p.locator('[data-vista="usuarios"]').click();
  await p.locator('[data-vista="niveles"]').click();
  await p.locator('[data-editar-nivel="1"]').waitFor();
  assert.equal(await descargas(),1,'El módulo cargado se reutiliza');
  assert.deepEqual(v.errores,[]);
});
