const {test}=require('node:test');
const assert=require('node:assert/strict');
const niveles=require('../src/educacion/recorrido-integral.json');
const cargar=()=>import('../src/administracion/MetasNivel.mjs');
test('Los diez niveles exponen cinco metas editables',async()=>{
 const {metasActivas}=await cargar();for(const n of niveles)assert.equal(metasActivas(n.reglasExito).length,5,`Nivel ${n.numero}`);
});
test('Cambiar acción modifica su regla real y retira la anterior sin tocar las demás',async()=>{
 const {cambiarMeta,metasActivas}=await cargar(),r=structuredClone(niveles[0].reglasExito);
 cambiarMeta(r,'minimoTramos',false);cambiarMeta(r,'aprendizajeSimulacion:velocidad',true);
 assert.equal(r.minimoTramos,undefined);assert.equal(r.aprendizajeSimulacion.velocidad,true);assert.equal(r.minimoEstaciones,2);assert.equal(metasActivas(r).length,5);
});
test('Avisa herramientas incompatibles sin confundir Línea con extender Conexión',async()=>{
 const {avisosMetas}=await cargar(),r=structuredClone(niveles[0].reglasExito),h={...niveles[0].herramientasHabilitadas,conexiones:false};
 assert.equal(avisosMetas(r,h).length,0);r.minimoTramos=2;assert.match(avisosMetas(r,h).join(' '),/Conexiones/);
 h.estaciones=false;assert.match(avisosMetas(r,h).join(' '),/Estaciones/);
});
test('La presentación por línea respeta el texto editorial validado',async()=>{
 const {metasConLineas}=await import('../src/educacion/IndicacionesLineas.mjs');
 const c={clave:'minimoLineas',requerido:2,actual:0,completado:false,texto:'Construí 2 recorridos',textoPersonalizado:true};
 assert.deepEqual(metasConLineas([c]),[c]);
});
