const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirEditor}=require('./soporte/editor.cjs');
const niveles=require('../src/educacion/recorrido-integral.json');
const puntos=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
let browser;
before(async()=>{browser=await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL,headless:true});});
after(()=>browser?.close());
function consigna(n){
 const r=n.reglasExito, condiciones=[];
 const agregar=(clave,texto,requerido=1)=>condiciones.push({clave,texto,requerido,actual:0,completado:false});
 for(const [clave,nombre] of [['minimoEstaciones','estaciones'],['minimoLineas','líneas'],['minimoTramos','conexiones'],['minimoMetros','metros']]) if(r[clave]) agregar(clave,`Crear al menos ${r[clave]} ${nombre}`,r[clave]);
 if(r.requiereObjetivosMismaLinea) agregar('requiereObjetivosMismaLinea','Conectar los POI objetivo mediante un recorrido continuo de una misma línea');
 if(r.minimoTransbordos) agregar('minimoTransbordos','Conectar al menos una estación compartida por dos líneas');
 if(r.requiereMetroPorLinea) agregar('requiereMetroPorLinea','Asignar al menos un Metro a cada línea');
 if(r.areasObjetivo) agregar('areaObjetivo:0','Estación en AGUADA');
 for(const practica of Object.keys(r.aprendizajeSimulacion||{})) agregar(`aprendizajeSimulacion:${practica}`,`Comparar ${practica}`);
 for(const poi of r.puntosInteresObjetivo||[]) agregar(`poi:${poi.idPunto}`,`Conectar ${puntos.find(p=>p.id===poi.idPunto).nombre}`);
 agregar('simulacionActual','Simular la red y UV actuales');
 return {condiciones,estadoGlobal:'PARCIAL',referenciasObjetivo:(r.puntosInteresObjetivo||[]).map(o=>({...o,nombrePunto:puntos.find(p=>p.id===o.idPunto).nombre,cubierto:false}))};
}
for(const [width,height] of [[1440,900],[1280,720],[390,844]]) for(const nivel of niveles) test(`N${nivel.numero} ${width}×${height}: cinco metas, lugares y límites iguales`,async t=>{
 const v=await abrirEditor(browser,{escenario:{...nivel,idEscenario:nivel.numero,recorrido:'integral-2026-10-lineas-automaticas-v4'},primeraPasada:false,novedadPresentada:true,viewport:{width,height},consigna:()=>consigna(nivel)});
 t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[]);});const p=v.pagina;
 assert.equal(await p.locator('.metronet-consigna__lista-breve > li').count(),5);
 assert.equal(await p.locator('.metronet-consigna__lista-referencias > li').count(),nivel.numero<6?0:3);
 assert.equal(await p.locator('.metronet-barra-geografica .metronet-poi > summary').isVisible(),nivel.numero>=6);
 const medidas=await p.evaluate(()=>{
   const mapa=document.querySelector('#metronet-mapa').getBoundingClientRect(),lateral=document.querySelector('.metronet-lateral-editor').getBoundingClientRect();
   const recortados=[...document.querySelectorAll('.metronet-lateral-editor li,.metronet-editor-bloque')].filter(e=>{const r=e.getBoundingClientRect();return r.top<mapa.top-1||r.bottom>mapa.bottom+1||e.scrollHeight>e.clientHeight+2;}).map(e=>e.textContent);
   return {alineado:Math.abs(mapa.top-lateral.top)<1&&Math.abs(mapa.bottom-lateral.bottom)<1,dentro:mapa.bottom<=innerHeight&&mapa.left>=0&&lateral.right<=innerWidth,scroll:document.documentElement.scrollHeight>innerHeight+1,recortados};
 });
 assert.deepEqual(medidas,{alineado:true,dentro:true,scroll:false,recortados:[]});
 if(width===1440&&[1,5,8,10].includes(nivel.numero)) await p.screenshot({path:`/tmp/metronet-nivel-${nivel.numero}-actualizado.png`});
});

for(const nivel of niveles) test(`N${nivel.numero}: crear una estación conserva las metas mientras se actualizan`,async t=>{
 const v=await abrirEditor(browser,{escenario:{...nivel,idEscenario:nivel.numero,recorrido:'integral-2026-10-lineas-automaticas-v4'},viewport:{width:1280,height:720},consigna:()=>consigna(nivel)});
 t.after(()=>v.contexto.close());const p=v.pagina;
 const medir=()=>p.evaluate(()=>{
  const caja=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  return {mapa:caja('#metronet-mapa'),objetivos:caja('.metronet-objetivos-panel'),herramientas:caja('#metronet-panel-controles'),textos:[...document.querySelectorAll('.metronet-consigna__texto-objetivo')].map(e=>e.textContent)};
 });
 const antes=await medir();
 let responder;const espera=new Promise(resolve=>{responder=resolve;});
 await p.route('**/consigna',async route=>{await espera;const datos=consigna(nivel);datos.condiciones[0].completado=true;datos.condiciones[0].actual=datos.condiciones[0].requerido;await route.fulfill({json:datos});});
 t.after(responder);
 await p.locator('[data-elegir-herramienta=estaciones]').click();
 const punto=await p.evaluate(()=>{const e=editorPrueba.escena,m=e.capaRedMetro.convertirPosicion(750,500),c=e.cameras.main,r=document.querySelector('#metronet-mapa canvas').getBoundingClientRect();return {x:r.x+(m.x-c.worldView.x)*c.zoom,y:r.y+(m.y-c.worldView.y)*c.zoom};});
 await p.mouse.click(punto.x,punto.y);
 await p.waitForFunction(()=>editorPrueba.estadoConsigna==='cargando');
 assert.deepEqual(await medir(),antes,'Las metas y los POI no se sustituyen por la historia del nivel ni desplazan el panel');
 responder();await p.waitForFunction(()=>editorPrueba.estadoConsigna==='disponible');
 assert.equal(await p.locator('.metronet-consigna__lista-breve .es-estrella').count(),1);
 assert.deepEqual(await medir(),antes);
 assert.deepEqual(v.errores,[]);
});
