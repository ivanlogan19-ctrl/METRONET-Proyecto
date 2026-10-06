const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
const BASE=process.env.METRONET_URL_PRUEBAS||'http://127.0.0.1:5173';
let navegador;
before(async()=>{navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(async()=>navegador?.close());
for(const width of [1440,768,390,320]) test(`Simulación ${width}px: mapa y música visibles sin buscador POI`,async t=>{
  const {pagina:p,contexto,errores,solicitudes}=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{viewport:{width,height:900}});
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  await p.locator('#visorSimulacion canvas').waitFor();
  const rect=await p.locator('#visorSimulacion canvas').boundingBox();
  assert.ok(rect.height>=300&&rect.width>=270);
  const peticiones=solicitudes.length;
  assert.equal(await p.locator('.metronet-poi>summary').isVisible(),false);
  assert.equal(await p.getByRole('button',{name:'Buscar punto de interés'}).count(),0);
  await p.locator('.metronet-hud>summary').click();
  assert.equal(await p.locator('[data-hud-musica]').isVisible(),true);
  await p.getByRole('checkbox',{name:'Silenciar música'}).focus();await p.keyboard.press('Space');
  assert.equal(await p.getByRole('checkbox',{name:'Silenciar música'}).isChecked(),true);
  await p.locator('[data-control-musica] label').first().click();
  assert.equal(await p.getByRole('checkbox',{name:'Silenciar música'}).isChecked(),false);
  assert.equal(await p.locator('[data-control-musica]').count(),1);
  assert.equal(solicitudes.length,peticiones);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.keyboard.press('Escape');
  const final=await p.locator('#visorSimulacion canvas').boundingBox();
  assert.equal(final.width,rect.width);assert.equal(final.height,rect.height);
});
test('Simulación: tocar un marcador lo selecciona y abre su ficha',async t=>{
  const {pagina:p,contexto,errores}=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{viewport:{width:390,height:844}});
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  await p.route('**/src/simulacion/EscenaSimulacion.js*',async route=>{
    const respuesta=await route.fetch();
    await route.fulfill({response:respuesta,body:(await respuesta.text()).replace(
      'resolver({ escena: this, destruir });',
      'window.escenaPoiPrueba = this; resolver({ escena: this, destruir });',
    )});
  });
  await p.reload();
  await p.waitForFunction(()=>window.escenaPoiPrueba?.capaPuntosInteres?.representaciones?.some(representacion=>representacion.contenedor.visible));
  await p.waitForFunction(()=>{
    const escena=window.escenaPoiPrueba;
    const canvas=escena.game.canvas.getBoundingClientRect();
    const camara=escena.cameras.main;
    return escena.capaPuntosInteres.representaciones.some(representacion=>{
      if(!representacion.contenedor.visible)return false;
      const x=canvas.x+(representacion.posicion.x-camara.worldView.x)*camara.zoom;
      const y=canvas.y+(representacion.posicion.y-camara.worldView.y)*camara.zoom;
      return x>canvas.x+24&&x<canvas.right-24&&y>canvas.y+24&&y<canvas.bottom-24;
    });
  });
  const marcador=await p.evaluate(()=>{
    const escena=window.escenaPoiPrueba;
    const canvas=escena.game.canvas.getBoundingClientRect();
    const camara=escena.cameras.main;
    return escena.capaPuntosInteres.representaciones
      .filter(representacion=>representacion.contenedor.visible)
      .map(representacion=>({
        x:canvas.x+(representacion.posicion.x-camara.worldView.x)*camara.zoom,
        y:canvas.y+(representacion.posicion.y-camara.worldView.y)*camara.zoom,
      }))
      .find(({x,y})=>x>canvas.x+24&&x<canvas.right-24&&y>canvas.y+24&&y<canvas.bottom-24);
  });
  assert.ok(marcador,'Debe haber un marcador visible dentro del mapa');
  await p.mouse.click(marcador.x,marcador.y);
  const ficha=p.getByRole('dialog',{name:/Información de/});
  await ficha.waitFor();
  assert.match(await ficha.innerText(),/REFERENCIA DEL MAPA/);
  assert.equal(await ficha.evaluate(e=>e.parentElement.id),'visorSimulacion');
  const seleccionado=await p.evaluate(()=>window.escenaPoiPrueba.capaPuntosInteres.obtenerResumenPuntos().puntoSeleccionado);
  assert.ok(seleccionado?.nombre,'El marcador tocado debe quedar seleccionado');
  assert.equal(await ficha.getAttribute('aria-label'),`Información de ${seleccionado.nombre}`);
  await ficha.getByRole('button',{name:'Cerrar',exact:true}).click();
  assert.equal(await ficha.count(),0);
});
test('Música accesible también antes de elegir un diseño',async t=>{
  const {pagina:p,contexto,errores}=await abrirPantalla(navegador,'/inicio.html');
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  await p.goto(`${BASE}/simulacion.html`);
  await p.locator('.metronet-hud>summary').waitFor();await p.locator('.metronet-hud>summary').click();
  assert.equal(await p.getByRole('slider',{name:'Volumen de música'}).isVisible(),true);
});

test('Carga inicial tardía no mueve el HUD ni pierde el clic de Música',async t=>{
  const {pagina:p,contexto,errores}=await abrirPantalla(navegador,'/inicio.html');
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  let liberar;const espera=new Promise(r=>liberar=r);
  await p.route('**/api/configuraciones',async r=>{await espera;await r.fulfill({json:[],headers:{'access-control-allow-origin':'*'}});});
  try {
    await p.goto(`${BASE}/simulacion.html`);
    await p.locator('.metronet-hud>summary').hover();
    await p.mouse.down();liberar();
    await p.waitForFunction(()=>window[Symbol.for('metronet:gestor-musica')].obtenerContexto()==='simulacion');
    await p.mouse.up();await p.getByRole('slider',{name:'Volumen de música'}).waitFor({state:'visible',timeout:2000});
  } finally { liberar(); }
});
