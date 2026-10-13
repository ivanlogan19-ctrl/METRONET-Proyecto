const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
const niveles=require('../src/educacion/recorrido-integral.json');
test('Selección usa nombres y relatos publicados de los diez niveles, y describe Modo Libre desbloqueado',async t=>{
 const navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});t.after(()=>navegador.close());
 const escenarios=niveles.map(n=>({...n,nombre:'Nombre antiguo',idEscenario:n.numero,estado:'DISPONIBLE',desbloqueado:true}));
 escenarios.push({numero:null,idEscenario:11,nombre:'Modo Libre',desbloqueado:true,estado:'DISPONIBLE'});
 const v=await abrirPantalla(navegador,'/escenarios.html',{responder:r=>{
  const path=new URL(r.url()).pathname;
  if(path==='/api/juego/progreso') return {json:{escenarios,modoLibreDesbloqueado:true}};
  const numero=path.match(/\/niveles\/(\d+)\/contenido$/)?.[1];
  if(numero){const n=niveles[Number(numero)-1];return {json:{numero:n.numero,version:2,desafio:{nombre:n.nombre,relato:n.historia.texto},tarjetas:Array.from({length:7},(_,i)=>({id:`tarjeta-${i}`}))}};}
 }});
 t.after(()=>v.contexto.close());const p=v.pagina;
 await p.getByRole('heading',{name:niveles[9].nombre,exact:true}).waitFor();
 for(const n of niveles){
  const tarjeta=p.getByRole('article').filter({has:p.getByRole('heading',{name:n.nombre,exact:true})});
  assert.equal(await tarjeta.locator('.metronet-escenarios-pagina__relato').innerText(),n.historia.texto);
 }
 const libre=p.getByRole('article').filter({has:p.getByRole('heading',{name:'Modo Libre',exact:true})});
 assert.match(await libre.innerText(),/sin consignas obligatorias/);
 assert.doesNotMatch(await libre.innerText(),/para desbloquear/);
 assert.deepEqual(v.errores,[]);
});
