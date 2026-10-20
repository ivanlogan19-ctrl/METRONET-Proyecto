const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('Mis diseños aparece sin esperar redes lentas y verifica solo la página visible', {timeout:20000}, async t => {
  const navegador=await abrirNavegador(); t.after(()=>navegador.close());
  let liberar;
  const espera=new Promise(r=>{liberar=r;}); t.after(liberar);
  const consultas=[];
  const redes=Array.from({length:30},(_,i)=>({idDiseno:i+100,idEscenario:41,nombre:`Red ${i}`,modo:'NIVEL',estado:'VALIDADO'}));
  const v=await abrirPantalla(navegador,'/disenos.html',{contenedor:true,responder:async req=>{
    const ruta=new URL(req.url()).pathname;
    if(ruta==='/api/simulaciones')return {json:redes};
    if(ruta==='/api/juego/escenarios')return {json:[{idEscenario:41,numero:1}]};
    if(/^\/api\/simulaciones\/\d+$/.test(ruta)){
      consultas.push(Number(ruta.split('/').pop()));await espera;
      return {json:{preparadoParaSimular:true}};
    }
  }});
  t.after(()=>v.contexto.close());
  const p=v.vista;
  await v.pagina.locator('#carga-pantalla').waitFor({state:'hidden',timeout:1500});
  assert.equal(await p.locator('#listaMisDisenos [data-diseno]').count(),6);
  assert.equal(await p.locator('#listaMisDisenos button.metronet-disenos__accion--simular:disabled').count(),6);
  await p.waitForFunction(()=>document.querySelectorAll('#listaMisDisenos [data-diseno]').length===6);
  assert.ok(consultas.length<=6,JSON.stringify(consultas));
  liberar();
  await p.locator('[data-diseno="100"] a.metronet-disenos__accion--simular').waitFor();
  await p.locator('#paginaDisenosSiguiente').click();
  await p.locator('[data-diseno="106"] a.metronet-disenos__accion--simular').waitFor();
  assert.ok(consultas.length<=12,JSON.stringify(consultas));
  assert.deepEqual(v.errores,[]);
});
