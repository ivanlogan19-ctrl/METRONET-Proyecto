const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirEditor}=require('./soporte/editor.cjs');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(()=>browser?.close());
for (const pantalla of ['nivel','libre','simulacion']) for(const width of [1440,390]) {
 test(`POI compacto ${pantalla} ${width}: búsqueda, capas, listas simultáneas y páginas conservan selección`,async t=>{
  const opciones={viewport:{width,height:900},primeraPasada:false,novedadPresentada:true};
  if(pantalla==='nivel') {
   opciones.escenario={...require('../src/educacion/recorrido-integral.json')[5],idEscenario:6};
   opciones.consigna=()=>({condiciones:[],referenciasObjetivo:opciones.escenario.reglasExito.puntosInteresObjetivo.map(p=>({...p,nombre:`Referencia ${p.idPunto}`}))});
  }

  if(pantalla==='simulacion') opciones.responder=async req=>new URL(req.url()).pathname==='/api/juego/progreso'?{json:{escenarios:[{...require('../src/educacion/recorrido-integral.json')[5],idEscenario:42,desbloqueado:true}]}}:undefined;
  const v=pantalla==='simulacion' ? await abrirPantalla(browser,'/simulacion.html?idDiseno=77',opciones) : await abrirEditor(browser,opciones);
  t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
  const p=v.pagina;
  if(pantalla==='simulacion') await p.getByRole('button',{name:'Comenzar directamente',exact:true}).click();
  else if(await p.locator('.metronet-recorrido').count()) await p.keyboard.press('Escape');
  await p.locator('.metronet-poi>summary').click();
  await p.getByRole('searchbox').waitFor({state:'visible'});
  assert.equal(await p.locator('.metronet-poi__categorias button').count(),8);
  assert.equal(await p.locator('.metronet-poi__panel > header h2').textContent(),'Puntos de interés del mapa');
  assert.equal(await p.locator('.metronet-poi__panel > header button').count(),0);
  assert.equal(await p.locator('.metronet-poi__panel > header h2').evaluate(e=>getComputedStyle(e).textAlign),'center');
  assert.deepEqual(await p.getByRole('searchbox').evaluate(e=>{const s=getComputedStyle(e);return [s.textAlign,s.paddingLeft===s.paddingRight];}),['center',true]);
  const cerrado=await p.locator('.metronet-poi__panel').boundingBox();
  assert.ok(cerrado.width<=360 && cerrado.height<220,JSON.stringify(cerrado));
  await p.locator('.metronet-poi > summary').click();
  assert.equal(await p.locator('.metronet-poi').evaluate(e=>e.open),false);
  await p.locator('.metronet-poi > summary').click();
  await p.locator('body').click({position:{x:1,y:1}});
  assert.equal(await p.locator('.metronet-poi').evaluate(e=>e.open),false);
  await p.locator('.metronet-poi > summary').click();

  assert.equal(await p.getByRole('searchbox').getAttribute('placeholder'),'Buscar punto de interés');
  const capas=p.locator('[data-capa-geografica="barrios"]');
  const activa=await capas.getAttribute('aria-pressed');await capas.click();
  assert.notEqual(await capas.getAttribute('aria-pressed'),activa);await capas.click();
  await p.locator('#metronet-selector-barrios .metronet-panel-encabezado').click();
  await p.locator('#metronet-selector-zonas .metronet-panel-encabezado').click();
  const barrios=p.locator('#metronet-selector-barrios'),zonas=p.locator('#metronet-selector-zonas');
  assert.equal(await barrios.locator('.metronet-panel-contenido').isVisible(),true);
  assert.equal(await zonas.locator('.metronet-panel-contenido').isVisible(),true);
  await barrios.locator('input[value="AGUADA"]').check();
  await zonas.locator('input').first().check();
  const nombres=new Set();
  while(true) {
    const visibles=await barrios.locator('label:not([hidden]) input').evaluateAll(inputs=>inputs.map(e=>e.value));
    assert.ok(visibles.length<=6);
    visibles.filter(Boolean).forEach(x=>nombres.add(x));
    if(await p.getByRole('button',{name:'Barrios siguientes',exact:true}).isDisabled()) break;
    await p.getByRole('button',{name:'Barrios siguientes',exact:true}).click();
  }
  assert.equal(await p.getByRole('button',{name:'Barrios siguientes',exact:true}).evaluate(e=>e.getBoundingClientRect().width),20);
  const flechas=await p.locator('.metronet-poi__paginacion').evaluate(e=>{
    const r=e.getBoundingClientRect(),bs=[...e.querySelectorAll('button')].map(b=>b.getBoundingClientRect()),svg=e.querySelector('svg').getBoundingClientRect();
    return {pequena:svg.width===8&&svg.height===8,extremos:bs[0].left-r.left<10&&r.right-bs[1].right<10};
  });
  assert.deepEqual(flechas,{pequena:true,extremos:true});
  assert.ok(nombres.size>=60,'Todas las opciones del catálogo son accesibles');
  while(!await p.getByRole('button',{name:'Barrios anteriores',exact:true}).isDisabled()) await p.getByRole('button',{name:'Barrios anteriores',exact:true}).click();
  assert.equal(await barrios.locator('input[value="AGUADA"]').isChecked(),true);
  assert.equal(await zonas.locator('input').first().isChecked(),true);
  const medidas=await p.locator('.metronet-poi__panel').evaluate(panel=>{
    const r=panel.getBoundingClientRect();
    const [a,b]=[...panel.querySelectorAll('.metronet-poi__selector-cabecera')].map(e=>e.getBoundingClientRect());
    const campo=panel.querySelector('input[role="searchbox"]').getBoundingClientRect();
    const lupa=panel.querySelector('.metronet-panel-puntos-alternar').getBoundingClientRect();
    return {alineados:Math.abs(a.top-b.top)<1&&Math.abs(a.width-b.width)<1,lupaDentro:lupa.left>=campo.left&&lupa.right<=campo.right,dentro:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,scroll:panel.scrollHeight>panel.clientHeight+1};
  });
  assert.deepEqual(medidas,{alineados:true,lupaDentro:true,dentro:true,scroll:false});
  await p.mouse.move(width-5,5);
  if(width===1440) await p.locator('.metronet-poi__panel').screenshot({path:`/tmp/poi-${pantalla}-abierto.png`});
  await p.getByRole('searchbox').fill('Palacio');
  await p.locator('.metronet-panel-puntos-item').first().waitFor();
  await p.locator('.metronet-panel-puntos-item').first().click();
  assert.equal(await p.locator('.metronet-poi').evaluate(e=>e.open),false);
  assert.equal(v.solicitudes.filter(s=>s.method!=='GET').length,0);
 });
}
