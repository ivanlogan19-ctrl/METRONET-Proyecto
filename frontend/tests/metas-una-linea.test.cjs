const {test}=require('node:test');
const assert=require('node:assert/strict');
const {abrirNavegador}=require('./soporte/navegador.cjs');
const {abrirEditor}=require('./soporte/editor.cjs');

test('Las metas conservan su oración completa en una línea al cambiar el tamaño de la pantalla',async t=>{
  const navegador=await abrirNavegador();t.after(()=>navegador.close());
  const textos=['Construir al menos 2 estaciones','Crear al menos 1 línea','Construir al menos 1 conexión','Asignar al menos 1 unidad de metro','Completar una simulación con la red actual'];
  const v=await abrirEditor(navegador,{modo:'NIVEL',primeraPasada:false,
    escenario:{idEscenario:1,numero:1,nombre:'Primer recorrido',recorrido:'integral-2026-10',estado:'EN_DESARROLLO',desbloqueado:true,herramientasHabilitadas:{estaciones:true,lineas:true,conexiones:true,metros:true,simulacion:true}},
    consigna:()=>({estadoGlobal:'PARCIAL',progreso:20,condiciones:textos.map((texto,i)=>({clave:`meta${i}`,texto,actual:i===0?1:0,requerido:1,completado:i===0})),referenciasObjetivo:[]})
  });t.after(()=>v.contexto.close());
  const p=v.pagina;
  for(const [width,height] of [[1470,800],[1280,720],[1920,1080],[1470,800]]) {
    await p.setViewportSize({width,height});
    await p.evaluate(()=>document.fonts.ready);
    await p.waitForFunction(()=>[...document.querySelectorAll('.metronet-consigna__lista-breve .metronet-consigna__texto-objetivo')].every(e=>{
      const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();
      return b.width<=e.clientWidth+1&&b.height<=parseFloat(getComputedStyle(e).lineHeight)+1;
    }));
    const metas=p.locator('.metronet-consigna__lista-breve .metronet-consigna__texto-objetivo');
    assert.deepEqual(await metas.allTextContents(),textos);
    const fuentes=await metas.evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));
    assert.ok(fuentes.every(f=>f>=8),JSON.stringify({width,fuentes}));
    if(width===1470)await p.screenshot({path:'/tmp/metronet-metas-una-linea.png'});
  }
  assert.deepEqual(v.errores,[]);
});
