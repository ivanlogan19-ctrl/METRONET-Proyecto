const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let navegador;
before(async()=>{navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(async()=>navegador?.close());
for(const width of [1440,768,390,320]) test(`Simulación ${width}px: panel compartido, búsqueda, ficha y música sin alterar reproducción`,async t=>{
  const {pagina:p,contexto,errores,solicitudes}=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{viewport:{width,height:900}});
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  await p.locator('#visorSimulacion canvas').waitFor();
  const rect=await p.locator('#visorSimulacion canvas').boundingBox();
  assert.ok(rect.height>=300&&rect.width>=270);
  const peticiones=solicitudes.length;
  await p.locator('.metronet-poi>summary').click();
  await p.locator('.metronet-poi__categorias [data-categoria=SALUD]').click();
  assert.equal(await p.locator('.metronet-capas-activas [data-categoria=SALUD]').isVisible(),false);
  await p.locator('.metronet-poi__categorias [data-categoria=SALUD]').click();
  assert.equal(await p.locator('.metronet-capas-activas [data-categoria=SALUD]').isVisible(),true);
  await p.getByRole('button',{name:'Buscar punto de interés'}).click();
  await p.getByRole('searchbox').fill('Hospital de Clínicas');
  await p.locator('.metronet-panel-puntos-lista button').first().click();
  const ficha=p.getByRole('dialog',{name:'Información de Hospital de Clínicas'});
  await ficha.waitFor();assert.match(await ficha.innerText(),/Salud.*Hospital/);
  assert.equal(await ficha.evaluate(e=>e.parentElement.id),'visorSimulacion');
  await ficha.getByRole('button',{name:'Cerrar',exact:true}).click();
  await p.locator('.metronet-hud>summary').click();await p.locator('[data-hud-vista=musica]').click();
  await p.getByRole('checkbox',{name:'Silenciar música'}).check();
  assert.equal(await p.locator('[data-control-musica]').count(),1);
  assert.equal(solicitudes.length,peticiones);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.keyboard.press('Escape');
  const final=await p.locator('#visorSimulacion canvas').boundingBox();
  assert.equal(final.width,rect.width);assert.equal(final.height,rect.height);
});
test('Música accesible también antes de elegir un diseño',async t=>{
  const {pagina:p,contexto,errores}=await abrirPantalla(navegador,'/inicio.html');
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  await p.goto('http://127.0.0.1:5173/simulacion.html');
  await p.locator('.metronet-hud>summary').waitFor();await p.locator('.metronet-hud>summary').click();await p.locator('[data-hud-vista=musica]').click();
  assert.equal(await p.getByRole('slider',{name:'Volumen de música'}).isVisible(),true);
});

test('Carga inicial tardía no mueve el HUD ni pierde el clic de Música',async t=>{
  const {pagina:p,contexto,errores}=await abrirPantalla(navegador,'/inicio.html');
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  let liberar;const espera=new Promise(r=>liberar=r);
  await p.route('**/api/configuraciones',async r=>{await espera;await r.fulfill({json:[],headers:{'access-control-allow-origin':'*'}});});
  try {
    await p.goto('http://127.0.0.1:5173/simulacion.html');
    await p.locator('.metronet-hud>summary').click();await p.locator('[data-hud-vista=musica]').hover();
    await p.mouse.down();liberar();
    await p.waitForFunction(()=>window[Symbol.for('metronet:gestor-musica')].obtenerContexto()==='menu');
    await p.mouse.up();await p.getByRole('slider',{name:'Volumen de música'}).waitFor({state:'visible',timeout:2000});
  } finally { liberar(); }
});
