const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('Niveles: una publicación lenta no bloquea las demás ni reemplaza una selección posterior', async t => {
  const navegador = await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL});
  t.after(() => navegador.close());
  let liberar;
  const demora = new Promise(resolve => { liberar = resolve; });
  t.after(() => liberar());
  const escenarios = [1,2,3].map(numero => ({numero,idEscenario:numero,nombre:`Nivel ${numero}`,desbloqueado:true,estado:'DISPONIBLE'}));
  const apertura = abrirPantalla(navegador, '/escenarios.html', {responder:async r => {
    const path = new URL(r.url()).pathname;
    if (path.endsWith('/progreso')) return {json:{escenarios}};
    const numero = Number(path.match(/\/niveles\/(\d+)\/contenido$/)?.[1]);
    if (numero) {
      if (numero === 2) await demora;
      return {json:{numero,version:7,desafio:{nombre:`Publicado ${numero}`,objetivo:`Objetivo ${numero}`},tarjetas:Array.from({length:7},(_,id)=>({id}))}};
    }
  }});
  // El timeout es solo una guarda: la respuesta 2 no se libera hasta comprobar 1 y 3.
  const vista = await Promise.race([apertura, new Promise((_,reject) => {
    const temporizador = setTimeout(() => reject(new Error('Un nivel ajeno bloqueó la pantalla')),7000);
    temporizador.unref(); apertura.finally(() => clearTimeout(temporizador)).catch(()=>{});
  })]);
  t.after(() => vista.contexto.close());
  const p = vista.pagina;
  await p.getByRole('heading',{name:'Nivel 1 · Publicado 1',exact:true}).waitFor();
  await p.locator('[data-seleccionar-escenario="2"]').click();
  assert.equal(await p.locator('.metronet-escenarios-pagina__acciones button').isDisabled(), true);
  await p.locator('[data-seleccionar-escenario="3"]').click();
  await p.getByRole('heading',{name:'Nivel 3 · Publicado 3',exact:true}).waitFor();
  await Promise.all([p.waitForResponse(r => r.url().includes('/niveles/2/contenido')), Promise.resolve().then(liberar)]);
  assert.equal(await p.locator('[data-seleccionar-escenario="3"]').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('.metronet-escenarios-pagina__tarjeta h2').textContent(),'Nivel 3 · Publicado 3');
  assert.deepEqual(vista.errores,[]);
});
