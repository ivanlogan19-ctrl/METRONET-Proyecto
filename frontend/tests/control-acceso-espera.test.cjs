const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function cargar(fetch) {
 const clases=new Set();
 const entorno={fetch,AbortSignal,obtenerSesionUsuario:()=>({usuario:{idUsuario:1}}),
  location:{protocol:'http:',hostname:'localhost',pathname:'/inicio.html'},
  document:{documentElement:{classList:{add:c=>clases.add(c),remove:c=>clases.delete(c)}}}};
 const fuente=fs.readFileSync(`${__dirname}/../src/configuracion/ControlAccesoMantenimiento.js`,'utf8')
  .replace(/^import .*;$/gm,'').replaceAll('export ','');
 vm.createContext(entorno);vm.runInContext(fuente,entorno);
 return {entorno,clases};
}

test('Una consulta de mantenimiento pendiente no oculta indefinidamente la pantalla',async()=>{
 let senal;
 const {entorno,clases}=cargar((_url,opciones)=>{
  senal=opciones.signal;
  return new Promise((_resolver,rechazar)=>senal?.addEventListener('abort',()=>rechazar(senal.reason),{once:true}));
 });
 const comprobacion=entorno.comprobarAccesoJugador();
 assert.ok(senal instanceof AbortSignal,'La consulta debe poder cancelarse por tiempo');
 assert.equal(clases.has('metronet-comprobando-acceso'),true);
 await Promise.race([comprobacion,new Promise((_r,rechazar)=>setTimeout(()=>rechazar(new Error('La pantalla sigue bloqueada')),4000))]);
 assert.equal(senal.aborted,true);
 assert.equal(clases.size,0);
});

test('Una respuesta disponible conserva la consulta y libera la pantalla',async()=>{
 const {entorno,clases}=cargar(async()=>({ok:true,json:async()=>({mantenimiento:false})}));
 await entorno.comprobarAccesoJugador();
 assert.equal(clases.size,0);
});
