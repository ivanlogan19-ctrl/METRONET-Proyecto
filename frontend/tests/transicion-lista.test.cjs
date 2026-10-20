const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('Cambio de pantalla: no expone el contenido parcial y conserva música e historial', { timeout: 30000 }, async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  const v = await abrirPantalla(navegador, '/inicio.html', {contenedor:true});
  t.after(() => v.contexto.close());
  const p = v.pagina, f = v.vista;
  await p.evaluate(() => { window.audioInicial = document.querySelector('audio'); });
  let liberar, recibida;
  const espera = new Promise(r => { liberar = r; });
  const peticion = new Promise(r => { recibida = r; });
  t.after(liberar);
  await p.route('**/api/simulaciones', async ruta => {
    recibida(); await espera;
    await ruta.fulfill({json:[],headers:{'access-control-allow-origin':'*'}});
  });
  await f.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Mis diseños',exact:true}).click();
  await peticion;
  assert.equal(await f.getByRole('heading',{name:'Mis diseños',exact:true}).isVisible(),false,
    'El encabezado y las listas vacías no deben aparecer como una pantalla terminada');
  await p.getByRole('status').filter({hasText:'Preparando pantalla'}).waitFor({timeout:3000});
  assert.equal(await p.locator('#pantalla-metronet').evaluate(e => e.inert), true);
  // El documento cubierto debe seguir dibujando: Firefox frena los iframe con visibility:hidden.
  const cuadros = await f.evaluate(() => new Promise(resolve => {
    let cantidad = 0;
    const limite = setTimeout(() => resolve(cantidad), 400);
    function contar() { if (++cantidad === 3) { clearTimeout(limite); resolve(cantidad); } else requestAnimationFrame(contar); }
    requestAnimationFrame(contar);
  }));
  assert.equal(cuadros, 3, 'La cobertura no debe suspender el dibujo del destino');
  liberar();
  await f.locator('#listaMisDisenos[aria-busy="false"]').waitFor({state:'attached'});
  await f.getByRole('heading',{name:'Mis diseños',exact:true}).waitFor();
  assert.equal(await f.evaluate(()=>getComputedStyle(document.body).animationName),'none');
  await p.getByRole('status').filter({hasText:'Preparando pantalla'}).waitFor({state:'hidden'});
  assert.equal(await p.evaluate(()=>window.audioInicial === document.querySelector('audio')),true);
  await p.goBack();
  await f.locator('.metronet-inicio__tarjeta').first().waitFor();
  assert.deepEqual(v.errores,[]);
});

for (const fallo of [false, true]) test(`Entrada al editor: espera la red y libera la pantalla ante ${fallo ? 'un error' : 'datos válidos'}`, {timeout:30000}, async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  const v = await abrirPantalla(navegador, '/inicio.html', {contenedor:true,
    responder:r=>new URL(r.url()).pathname==='/api/juego/escenarios'?{json:[]}:null});
  t.after(() => v.contexto.close());
  const p = v.pagina, f = v.vista;
  let liberar, recibida;
  const espera = new Promise(r => { liberar = r; });
  const peticion = new Promise(r => { recibida = r; });
  t.after(liberar);
  await p.route('**/api/simulaciones/77', async ruta => {
    recibida(); await espera;
    if (fallo) await ruta.fulfill({status:503,json:{detail:'Red temporalmente no disponible'},headers:{'access-control-allow-origin':'*'}});
    else await ruta.fallback();
  });
  await f.evaluate(()=>location.assign('/?idDiseno=77'));
  await peticion;
  assert.equal(await f.locator('#metronet-aplicacion').isVisible(),false);
  await p.getByRole('status').filter({hasText:'Preparando pantalla'}).waitFor();
  liberar();
  await p.getByRole('status').filter({hasText:'Preparando pantalla'}).waitFor({state:'hidden'});
  if (fallo) await f.getByRole('alert').filter({hasText:'Red temporalmente no disponible'}).waitFor();
  else await f.locator('[data-editor-activo]:not([hidden])').waitFor({state:'visible'});
  await f.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Inicio',exact:true}).click();
  await f.locator('.metronet-inicio__tarjeta').first().waitFor();
  assert.deepEqual(v.errores,[]);
});

test('Destino HTML lento: la salida aceptada cubre la vista anterior sin interrumpir el audio', {timeout:30000}, async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  const v = await abrirPantalla(navegador, '/inicio.html', {contenedor:true});
  t.after(() => v.contexto.close());
  const p = v.pagina, f = v.vista;
  let liberar, recibida;
  const espera = new Promise(r => { liberar = r; });
  const peticion = new Promise(r => { recibida = r; });
  t.after(liberar);
  await p.route('**/reglas.html', async ruta => { recibida(); await espera; await ruta.continue(); });
  await f.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Reglas',exact:true}).click({noWaitAfter:true});
  await peticion;
  await p.getByRole('status').filter({hasText:'Preparando pantalla'}).waitFor({timeout:3000});
  assert.equal(await f.locator('.metronet-inicio__tarjeta').first().isVisible(),false);
  liberar();
  await f.getByRole('heading',{name:'Reglas del juego',exact:true}).waitFor();
  await p.getByRole('status').filter({hasText:'Preparando pantalla'}).waitFor({state:'hidden'});
  assert.deepEqual(v.errores,[]);
});

test('Editor: la lectura de la red empieza sin esperar el catálogo de niveles', {timeout:15000}, async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  const v = await abrirPantalla(navegador, '/inicio.html', {contenedor:true});
  t.after(() => v.contexto.close());
  let liberar;
  const espera = new Promise(r => { liberar = r; });
  t.after(liberar);
  await v.pagina.route('**/api/juego/escenarios', async ruta => {
    await espera;
    await ruta.fulfill({json:[],headers:{'access-control-allow-origin':'*'}});
  });
  const lectura = v.pagina.waitForRequest(r=>new URL(r.url()).pathname==='/api/simulaciones/77',{timeout:2500});
  await v.vista.evaluate(()=>location.assign('/?idDiseno=77'));
  await lectura;
  liberar();
  await v.vista.locator('[data-editor-activo]:not([hidden])').waitFor({state:'visible'});
  assert.deepEqual(v.errores,[]);
});
