const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
const catalogo=require('../src/educacion/catalogo-svgs-niveles.json');
const recorrido=require('../src/educacion/recorrido-integral.json');
const reglas=require('../src/educacion/niveles.json');
let browser;
before(async()=>{browser=await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL})});
after(async()=>{await browser?.close()});
const escenarios=recorrido.map((n,i)=>({idEscenario:n.numero,numero:n.numero,nombre:n.nombre,objetivo:reglas[i].objetivo,
  estado:i===2?'EN_DISENO':i<2?'COMPLETADO':i===9?'BLOQUEADO':'DISPONIBLE',desbloqueado:i!==9,herramientasHabilitadas:{}}));
escenarios.push({idEscenario:11,numero:null,nombre:'Modo Libre',estado:'DISPONIBLE',desbloqueado:true});
function responder(req){const p=new URL(req.url()).pathname;
  if(p==='/api/juego/progreso')return {json:{escenarios,nivelesCompletados:2,modoLibreDesbloqueado:true}};
  if(p==='/api/juego/aprendizaje')return {json:catalogo.map((n,i)=>({numero:n.numero,desbloqueado:i!==9,contenido:{desafio:{nombre:recorrido[i].nombre},tarjetas:n.tarjetas}}))};
  if(p.includes('/aprendizaje/extras'))return {json:{desbloqueado:true,visitadas:[1,2,3,4,5,6,7]}};
  if(p.endsWith('/contenido'))return {status:404,json:{}};
}
async function abrir(t,ruta,viewport){const v=await abrirPantalla(browser,ruta,{viewport,responder,administrador:true,reducedMotion:'reduce'});t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[])});return v.pagina;}
async function cabe(p,viewport){const m=await p.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}));assert(m.w<=viewport.width+1,`Ancho ${m.w}/${viewport.width}`);assert(m.h<=viewport.height+1,`Alto ${m.h}/${viewport.height}`);}
for(const viewport of [{width:1280,height:720},{width:1470,height:745},{width:1920,height:1080}]){
  test(`Inicio: encabezado centrado, estados y colores a ${viewport.width}`,async t=>{
    const p=await abrir(t,'/inicio.html',viewport);await p.locator('#accionesInicio[aria-busy="false"]').waitFor();await cabe(p,viewport);
    assert.equal(await p.locator('.metronet-inicio__tarjeta').count(),2);
    const medidas=await p.evaluate(()=>{const a=document.querySelector('#accionesInicio').getBoundingClientRect(),h=document.querySelector('#tituloInicio').getBoundingClientRect(),s=document.querySelector('.metronet-inicio__saludo p').getBoundingClientRect();return {centro:a.x+a.width/2,titulo:h.x+h.width/2,subtitulo:s.x+s.width/2};});
    assert(Math.abs(medidas.centro-medidas.titulo)<1);assert(Math.abs(medidas.centro-medidas.subtitulo)<1);
    assert.equal(await p.locator('.metronet-inicio__nivel-actual').textContent(),'Nivel 3');
    const color=async loc=>loc.evaluate(e=>getComputedStyle(e).backgroundColor);
    assert.equal(await color(p.locator('#continuarNivelInicio')),'rgb(255, 218, 50)');
    assert.equal(await color(p.locator('.metronet-inicio__tarjeta--crear button')),'rgb(72, 232, 96)');
    assert.equal(await color(p.locator('.metronet-inicio__tarjeta-pie a').first()),'rgb(32, 56, 88)');
    assert.equal(await p.locator('.metronet-navegacion__enlace:visible').count(),7);
    if(viewport.width===1470)await p.screenshot({path:'/tmp/metronet-inicio-final.png'});
  });
  test(`Niveles: diez selecciones, bloqueo y reinicio visibles a ${viewport.width}`,async t=>{
    const p=await abrir(t,'/escenarios.html',viewport);assert.equal(await p.locator('[data-seleccionar-escenario]').count(),11);
    for(const e of escenarios){await p.locator(`[data-seleccionar-escenario="${e.idEscenario}"]`).click();await cabe(p,viewport);assert.equal(await p.locator('.metronet-escenarios-pagina__tarjeta').count(),1);const boton=p.locator('.metronet-escenarios-pagina__acciones button');assert.equal(await boton.isDisabled(),!e.desbloqueado);assert.equal(await boton.textContent(),!e.desbloqueado?'Bloqueado':e.estado==='EN_DISENO'?'Continuar':e.estado==='COMPLETADO'?'Repetir':'Iniciar');}
    const reiniciar=p.getByRole('button',{name:'Reiniciar recorrido',exact:true});assert(await reiniciar.isVisible());const rect=await reiniciar.boundingBox();assert(rect.y+rect.height<=viewport.height);
    await reiniciar.click();assert(await p.getByRole('dialog').isVisible());await p.getByRole('button',{name:'Cancelar',exact:true}).click();assert(!(await p.getByRole('dialog').isVisible()));
    await p.locator('[data-seleccionar-escenario="3"]').click();if(viewport.width===1470)await p.screenshot({path:'/tmp/metronet-niveles-final.png'});
  });
  test(`Aprendizaje: siete tarjetas por nivel, bloqueo y extras a ${viewport.width}`,async t=>{
    const p=await abrir(t,'/aprendizaje.html',viewport);await p.locator('#nivelesAprendizaje[aria-busy="false"]').waitFor();
    for(let n=1;n<=10;n++){await p.locator(`#selectorAprendizaje [data-nivel="${n}"]`).click();await cabe(p,viewport);assert.equal(await p.locator('.metronet-aprendizaje__nivel:visible').count(),1);assert.equal(await p.locator('.metronet-aprendizaje__tarjeta:visible').count(),n===10?0:7);}
    await p.locator('#selectorAprendizaje [data-nivel="1"]').click();await p.locator('.metronet-aprendizaje__tarjeta:visible').first().click();
    assert.equal(await p.locator('#tarjetaAprendizaje img').getAttribute('src'),catalogo[0].tarjetas[0].imagen);
    const volver=p.getByRole('button',{name:'Volver a las tarjetas'});assert.equal(await volver.evaluate(e=>getComputedStyle(e).backgroundColor),await p.locator('#selectorAprendizaje [aria-pressed="true"]').evaluate(e=>getComputedStyle(e).backgroundColor));await volver.click();
    await p.locator('#selectorAprendizaje [data-nivel="libre"]').click();await cabe(p,viewport);assert.equal(await p.locator('.metronet-aprendizaje__tarjeta:visible').count(),7);
    assert.equal(await p.locator('.metronet-aprendizaje__recorrida').first().evaluate(e=>getComputedStyle(e).writingMode),'vertical-rl');
    await p.locator('#extrasAprendizaje button').last().click();const botones=await p.locator('.metronet-extras footer button').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().toJSON()));assert(botones[1].x-botones[0].right>=24);assert(botones[2].x-botones[1].right>=24);await p.getByRole('button',{name:'Cerrar',exact:true}).click();
    await p.locator('#selectorAprendizaje [data-nivel="1"]').click();if(viewport.width===1470)await p.screenshot({path:'/tmp/metronet-aprendizaje-final.png'});
  });
}
test('Perfil: el botón amarillo no conserva el panel de fondo',async t=>{const p=await abrir(t,'/perfil.html',{width:1470,height:745});const s=await p.locator('.perfil-volver').evaluate(e=>({fondo:getComputedStyle(e).backgroundColor,borde:getComputedStyle(e).borderTopWidth}));assert.deepEqual(s,{fondo:'rgba(0, 0, 0, 0)',borde:'0px'});});
