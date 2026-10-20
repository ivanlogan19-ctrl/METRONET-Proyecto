const {test} = require('node:test');
const assert = require('node:assert/strict');
const {abrirNavegador} = require('./soporte/navegador.cjs');
const {abrirPantalla} = require('./soporte/pantallas.cjs');

for (const modo of ['NIVEL','EDICION_LIBRE']) for (const parametro of ['UV','UT']) {
  test(`${modo}: guardar ${parametro} conserva la cabecera y el mapa durante la lectura del servidor`, async t => {
    const navegador = await abrirNavegador(); t.after(() => navegador.close());
    const unidad = {idTren:1,nombreLinea:'Azul',capacidad:300,velocidadPromedio:4,duracionUt:4};
    const red = {
      simulacion:{idDiseno:77,idEscenario:modo==='NIVEL'?42:null,nombre:'Red de prueba',modo,estado:'VALIDADO'},
      estaciones:[{nombre:'A',posicionX:580,posicionY:470},{nombre:'B',posicionX:700,posicionY:460}],
      lineas:[{nombre:'Azul'}],tramos:[{nombreLinea:'Azul',estacionA:'A',estacionB:'B',distanciaKm:16}],
      unidadesMetro:[unidad],preparadoParaSimular:true,territorio:{areas:[],errores:[]},resultados:[],
    };
    let modificado=false, liberar, lectura;
    const espera=new Promise(r=>{liberar=r;}); t.after(()=>liberar());
    const recibida=new Promise(r=>{lectura=r;});
    const v=await abrirPantalla(navegador,'/simulacion.html?idDiseno=77',{viewport:{width:1470,height:800},responder:async req=>{
      const ruta=new URL(req.url()).pathname;
      if(ruta==='/api/simulaciones/77/unidades/1' && req.method()==='PATCH') {
        // El adaptador de Firefox oficial no expone el cuerpo PATCH en la ruta interceptada.
        const datos=req.postDataJSON() ?? await req.frame().evaluate(()=>window.datosGuardadoPrueba);
        if(datos.parametroReferencia==='UT') {unidad.duracionUt=datos.duracionUt;unidad.velocidadPromedio=16/datos.duracionUt;}
        else {unidad.velocidadPromedio=datos.velocidadPromedio;unidad.duracionUt=16/datos.velocidadPromedio;}
        modificado=true;return {json:unidad};
      }
      if(ruta==='/api/simulaciones/77') {if(modificado){lectura();await espera;}return {json:red};}
    }});
    t.after(()=>v.contexto.close());
    const p=v.pagina;
    await p.evaluate(()=>{
      const solicitar=window.fetch;
      window.fetch=(url,opciones)=>{
        if(opciones?.method==='PATCH') window.datosGuardadoPrueba=JSON.parse(opciones.body);
        return solicitar(url,opciones);
      };
    });
    await p.getByRole('button',{name:'Continuar',exact:true}).click();
    await p.locator('.metronet-aprender-acceso').waitFor();
    const medir=()=>p.evaluate(()=>Object.fromEntries(['.simulacion-encabezado','.simulacion-lienzo-contenedor','.metronet-aprender-acceso','.simulacion-accesos-titulo #tutorialPantallaSimulacion','.simulacion-accesos-titulo .metronet-hud > summary'].map(s=>{
      const e=document.querySelector(s),r=e.getBoundingClientRect();return [s,[r.x,r.y,r.width,r.height,e.hidden]];
    })));
    const antes=await medir();
    const reducir=p.getByRole('button',{name:parametro==='UV'?'Reducir velocidad':'Reducir duración',exact:true});
    await reducir.click();
    await reducir.click();
    assert.equal(await p.locator(parametro==='UV'?'#velocidadUnidad':'#duracionSimulacion').inputValue(),'2');
    await p.locator(parametro==='UV'?'.simulacion-parametro-velocidad button[type="submit"]':'#aplicarUnidadTiempo').click();
    await recibida;
    assert.deepEqual(await medir(),antes,'Guardar no debe ocultar Aprender/Extras ni mover la cabecera');
    liberar();
    await p.locator('#velocidadUnidad:not(:disabled)').waitFor();
    assert.deepEqual(await medir(),antes,'Al terminar de guardar se mantiene la misma distribución');
    assert.equal(await p.locator(parametro==='UV'?'#velocidadUnidad':'#duracionSimulacion').inputValue(),'2');
    assert.equal(await p.locator('#unidadCirculacion').inputValue(),'1');
    assert.deepEqual(v.errores,[]);
  });
}
