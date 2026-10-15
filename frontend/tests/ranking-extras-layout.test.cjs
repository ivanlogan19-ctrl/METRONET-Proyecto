const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(async()=>browser?.close());
const trofeos=['corona','biblioteca','copa','estacion','camino','extras'].map((id,i)=>({id,nombre:['Corona de platino','Biblioteca completa','Copa de la red','Primera estación','Camino a la cima','Premio oculto'][i],requisito:['Puntuación máxima en los 10 niveles.','Desbloquear las 70 tarjetas de los 10 niveles.','Completar los 10 niveles.','Completar el Nivel 1.','Completar 5 niveles distintos.','???'][i],obtenido:false}));
const jugadores=Array.from({length:19},(_,i)=>({posicion:i+1,jugador:`Jugador ${i+1}`,puntajeTotal:1000-i*10,nivelesCompletados:10,sosVos:i===18}));
const niveles=require('../src/educacion/niveles.json').map(n=>({...n,mejorPuntaje:95,ultimoPuntaje:90,puntajeMaximo:100}));
async function abrir(t,viewport,opciones={}) {
  const p=await abrirPantalla(browser,'/ranking.html',{viewport,administrador:opciones.administrador,responder:req=>{
    const path=new URL(req.url()).pathname;
    if(path.endsWith('/ranking'))return {json:{jugadores:opciones.vacio?[]:jugadores,puntajeTotal:950,puntajeMaximo:1000,tuPosicion:19}};
    if(path.endsWith('/trofeos'))return {json:trofeos};
    if(path.endsWith('/progreso'))return {json:{escenarios:niveles,nivelesCompletados:10,cantidadNiveles:10}};
    if(path.includes('/aprendizaje/extras/'))return {json:{visitadas:[],nuevoTrofeo:null}};
  }});
  t.after(()=>p.contexto.close());t.after(()=>assert.deepEqual(p.errores,[]));
  await p.pagina.locator('.ranking-trofeo').first().waitFor();
  return p;
}
async function sinDesbordes(p,selector) {
  const problemas=await p.locator(selector).evaluate(root=>{
    const caja=root.getBoundingClientRect();
    const problemas=[];
    if(caja.left<0||caja.top<0||caja.right>innerWidth+1||caja.bottom>innerHeight+1)problemas.push('Fuera de pantalla: '+JSON.stringify(caja));
    for(const e of [root,...root.querySelectorAll('*')]) {
      if(!e.getClientRects().length||e.closest('svg')||e.closest('dialog:not([open])'))continue;
      if(e.scrollHeight>e.clientHeight+2&&e.clientHeight>0)problemas.push(`${e.tagName}.${e.className}: alto ${e.scrollHeight}/${e.clientHeight}`);
      if(e.scrollWidth>e.clientWidth+2&&e.clientWidth>0)problemas.push(`${e.tagName}.${e.className}: ancho ${e.scrollWidth}/${e.clientWidth}`);
      if(/^(P|H[1-4]|BUTTON)$/.test(e.tagName)) {
        const r=e.getBoundingClientRect();
        if(r.top<caja.top-1||r.bottom>caja.bottom+1)problemas.push(`${e.tagName}: contenido fuera del marco`);
      }
    }
    return problemas;
  });
  assert.deepEqual(problemas,[]);
}
for(const [width,height] of [[1280,720],[1470,745],[1920,1080]]) {
  test(`Ranking ${width}×${height}: clasificación paginada, trofeos y diez puntajes sin desplazamiento`,async t=>{
    const {pagina:p}=await abrir(t,{width,height});
    await p.locator('.ranking-clasificacion tr').first().waitFor();
    await sinDesbordes(p,'.metronet-ranking');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);
    const vistos=[];
    for(let pagina=1;pagina<=4;pagina++) {
      assert.equal(await p.locator('#paginaRanking').innerText(),`${pagina} / 4`);
      vistos.push(...await p.locator('#clasificacionRanking td:nth-child(2)').allTextContents());
      await sinDesbordes(p,'.metronet-ranking');
      if(pagina<4)await p.locator('#rankingSiguiente').click();
    }
    assert.deepEqual(vistos,jugadores.map(j=>j.jugador));
    assert.equal(await p.locator('#rankingSiguiente').isDisabled(),true);
    await p.locator('#rankingAnterior').click();
    assert.equal(await p.locator('#paginaRanking').innerText(),'3 / 4');
    const trofeo=p.locator('.ranking-trofeo').nth(1);
    await trofeo.focus();await p.keyboard.press('Enter');
    assert.equal(await trofeo.getAttribute('aria-pressed'),'true');
    assert.match(await p.locator('#detalleTrofeo').innerText(),/70 tarjetas/);
    await p.locator('.ranking-trofeo').last().click();
    assert.equal(await p.locator('#detalleTrofeo p').innerText(),'???');
    await p.locator('#verPuntosNivel').click();
    assert.equal(await p.locator('#puntajesPorNivel li').count(),10);
    assert.equal(await p.locator('#puntajesPorNivel li:visible').count(),5);
    await sinDesbordes(p,'.metronet-ranking');
    assert.match(await p.locator('#puntajesPorNivel li:visible').first().innerText(),/Nivel 01/);
    await p.locator('#nivelSiguiente').click();
    assert.equal(await p.locator('#paginaPuntosNivel').innerText(),'2 / 2');
    assert.match(await p.locator('#puntajesPorNivel li:visible').last().innerText(),/Nivel 10/);
    await sinDesbordes(p,'.metronet-ranking');
    if(process.env.METRONET_CAPTURAS && width===1470)await p.screenshot({path:`${process.env.METRONET_CAPTURAS}/puntos-por-nivel.png`});
    await p.locator('#verClasificacion').click();
    assert.equal(await p.locator('#paginaRanking').innerText(),'3 / 4');

  });
  test(`Modo Libre ${width}×${height}: introducción y siete tarjetas completas`,async t=>{
    const {pagina:p,solicitudes}=await abrir(t,{width,height});
    await p.evaluate(async()=>{const {abrirExtras}=await import('/src/educacion/extras/PresentacionExtras.js');void abrirExtras({bienvenida:true});await document.fonts.ready;});
    await p.getByRole('heading',{name:'Planificá una red',exact:true}).waitFor();
    await sinDesbordes(p,'dialog.metronet-extras');
    assert.equal(await p.locator('.metronet-extras__temas li').count(),7);
    if(process.env.METRONET_CAPTURAS && width===1470)await p.screenshot({path:`${process.env.METRONET_CAPTURAS}/introduccion.png`});
    await p.getByRole('button',{name:'Ver las 7 tarjetas',exact:true}).click();
    for(let i=1;i<=7;i++) {
      await p.locator(`.metronet-extras__puntos[aria-label="Tarjeta ${i} de 7"]`).waitFor();
      await sinDesbordes(p,'dialog.metronet-extras');
      assert.equal(await p.getByRole('heading',{name:'Qué ofrece la herramienta',exact:true}).count(),1);
      assert.equal(await p.getByRole('heading',{name:'Cómo aporta a tu red',exact:true}).count(),1);
      assert.equal(await p.getByRole('heading',{name:'Aplicala en el juego',exact:true}).count(),1);
      assert.equal(await p.getByRole('heading',{name:'Qué justificar',exact:true}).count(),1);
      const dibujo=await p.locator('.metronet-extras__imagen').innerHTML();
      assert.equal(dibujo,await p.evaluate(async id=>{const e=document.createElement('div');e.innerHTML=(await import('/src/educacion/extras/TarjetasExtras.js')).ilustracionExtra(id);return e.innerHTML;},i));
      if(process.env.METRONET_CAPTURAS && width===1470)await p.screenshot({path:`${process.env.METRONET_CAPTURAS}/tarjeta-${i}.png`});
      await p.locator('dialog.metronet-extras').getByRole('button',{name:i===7?'Finalizar recorrido':'Siguiente',exact:true}).click();
    }
    await p.locator('dialog.metronet-extras').waitFor({state:'detached'});
    assert.equal(solicitudes.filter(s=>/\/tarjetas\/\d+$/.test(s.path)&&s.method==='PUT').length,7);
  });
}
test('Ranking vacío de administrador conserva la consulta de trofeos',async t=>{
  const {pagina:p}=await abrir(t,{width:1470,height:745},{administrador:true,vacio:true});
  await p.getByText('Sin puntajes registrados. Todavía no hay jugadores clasificados.',{exact:true}).waitFor();
  assert.equal(await p.locator('#rankingAnterior').isDisabled(),true);
  assert.equal(await p.locator('#rankingSiguiente').isDisabled(),true);
  assert.match(await p.locator('#resumenTrofeos').innerText(),/no atribuye premios/);
  assert.equal(await p.locator('#tituloMiDesempeno').isVisible(),false);
  assert.equal(await p.locator('#resumenPuntaje').textContent(),'');
  await sinDesbordes(p,'.metronet-ranking');
  if(process.env.METRONET_CAPTURAS)await p.screenshot({path:`${process.env.METRONET_CAPTURAS}/ranking.png`});
});
