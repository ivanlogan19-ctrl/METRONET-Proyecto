const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrir(t, viewport) {
  let redes = Array.from({length:14}, (_, i) => ({idDiseno:i+1, idUsuario:7, idEscenario:i < 7 ? 42 : 45,
    nombre:`${i < 7 ? 'Nivel' : 'Red libre'} ${i+1} · Extender y cambiar velocidad`, estado:'VALIDADO', propietario:'Ana Prueba'}));
  const v = await abrirPantalla(navegador, '/disenos.html', {administrador:true, viewport, responder:req => {
    const path = new URL(req.url()).pathname;
    if (req.method() === 'DELETE') { redes = redes.filter(d => d.idDiseno !== Number(path.split('/').pop())); return {status:204}; }
    if (path === '/api/admin/disenos') return {json:redes};
    if (path === '/api/juego/escenarios') return {json:[{idEscenario:42,numero:2},{idEscenario:45,numero:null,desbloqueado:true}]};
    if (/^\/api\/simulaciones\/\d+$/.test(path)) return {json:{preparadoParaSimular:true}};
  }});
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  await v.pagina.locator('#listaMisDisenos[aria-busy=false]').waitFor({state:'attached'});
  return v;
}

for (const [width,height,cantidad] of [[1470,830,6],[1280,720,6],[390,844,2]]) test(`Grilla ${width}: páginas y categorías accesibles sin desplazamiento`, async t => {
  const {pagina:p} = await abrir(t,{width,height});
  assert.equal(await p.locator('#listaMisDisenos > li').count(),cantidad);
  assert.equal(await p.locator('#tituloDisenos').evaluate(e => getComputedStyle(e).textAlign),'center');
  assert.equal(await p.locator('.metronet-disenos__barrera').count(),0);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight),false);
  await p.locator('#paginaDisenosSiguiente').click();
  assert.equal(await p.locator('#listaMisDisenos > li').first().getAttribute('data-diseno'),String(cantidad+1));
  await p.locator('#pestanaDisenosLibres').click();
  assert.equal(await p.locator('#listaDisenosLibres > li').first().getAttribute('data-diseno'),'8');
  assert.equal(await p.locator('#irDisenoLibre').isEnabled(),true);
  await p.locator('#pestanaDisenosLibres').press('ArrowLeft');
  assert.equal(await p.locator('#pestanaDisenosCampana').getAttribute('aria-selected'),'true');
  assert.equal(await p.locator('#listaMisDisenos > li').first().getAttribute('data-diseno'),String(cantidad+1));
  if(width===1470) { await p.locator('#paginaDisenosAnterior').click(); await p.screenshot({path:'/tmp/mis-disenos-aplicado.png'}); }
});

test('Eliminar el último diseño de una página vuelve a la página disponible; cancelar conserva la red', async t => {
  const {pagina:p,solicitudes} = await abrir(t,{width:1470,height:830});
  await p.locator('#paginaDisenosSiguiente').click();
  await p.locator('[data-diseno="7"] button.metronet-boton--peligro').click();
  await p.locator('dialog button[value=cancelar]').click();
  assert.equal(solicitudes.filter(s=>s.method==='DELETE').length,0);
  await p.locator('[data-diseno="7"] button.metronet-boton--peligro').click();
  await p.locator('dialog button[value=eliminar]').click();
  await p.locator('[data-diseno="7"]').waitFor({state:'detached'});
  assert.equal(await p.locator('#paginaDisenosActual').innerText(),'Página 1 de 1');
  assert.equal(await p.locator('#listaMisDisenos > li').count(),6);
  assert.deepEqual(solicitudes.filter(s=>s.method==='DELETE').map(s=>s.path),['/api/admin/disenos/7']);
});

test('Administración: categorías sin imágenes, mismos colores activos que Reglas y cambio de módulo', async t => {
  const v = await abrirPantalla(navegador,'/admin.html',{viewport:{width:1470,height:830}});
  t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});
  const p=v.pagina;
  assert.equal(await p.locator('.admin-menu-grupo').count(),3);
  assert.equal(await p.locator('.admin-menu :is(img,svg)').count(),0);
  await p.locator('[data-vista=configuracion]').click();
  assert.equal(await p.locator('[data-vista=configuracion]').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('[data-vista=usuarios]').getAttribute('aria-pressed'),'false');
  assert.equal(await p.locator('#tituloVista').textContent(),'Configuración');
  await p.waitForFunction(() => getComputedStyle(document.querySelector('[data-vista=configuracion]')).backgroundColor === 'rgb(72, 180, 255)');
  const color=await p.locator('[data-vista=configuracion]').evaluate(e=>getComputedStyle(e).backgroundColor);
  await p.locator('[data-vista=usuarios]').click();
  assert.ok(await p.locator('.admin-navegacion').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));
  await p.waitForFunction(() => getComputedStyle(document.querySelector('[data-vista=usuarios]')).backgroundColor === 'rgb(72, 180, 255)');
  await p.screenshot({path:'/tmp/admin-menu-aplicado.png'});
  const reglas=await abrirPantalla(navegador,'/reglas.html');
  try { assert.equal(color,await reglas.pagina.locator('.metronet-pestanas [aria-selected=true]').evaluate(e=>getComputedStyle(e).backgroundColor)); }
  finally {await reglas.contexto.close();}
});
