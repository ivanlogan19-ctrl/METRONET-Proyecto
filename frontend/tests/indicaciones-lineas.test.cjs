const {test}=require('node:test');
const assert=require('node:assert/strict');
const catalogo=require('../src/educacion/recorrido-integral.json');
const cargar=()=>import('../src/educacion/IndicacionesLineas.mjs');

test('Entrada y metas comparten indicaciones para cada nivel con varias líneas',async()=>{
 const {condicionesParaIndicaciones,indicacionesLineas}=await cargar();
 for(const nivel of catalogo){
  const condiciones=condicionesParaIndicaciones(nivel.reglasExito);
  const antes=indicacionesLineas(condiciones);
  const dentro=indicacionesLineas(condiciones,[{nombre:'Norte'},{nombre:'Sur'}]);
  if(nivel.numero<3){assert.deepEqual(antes,[]);continue;}
  assert.ok(antes.length>0,`Nivel ${nivel.numero}`);
  assert.deepEqual(antes.map(g=>g.clave),dentro.map(g=>g.clave));
  for(const grupo of dentro){assert.ok(grupo.filas.some(f=>f.startsWith('Norte:')));assert.ok(grupo.filas.some(f=>f.startsWith('Sur:')));}
 }
});
test('La práctica histórica individual conserva sus alternativas por línea',async()=>{
 const {condicionesParaIndicaciones,indicacionesLineas}=await cargar();
 const grupos=indicacionesLineas(condicionesParaIndicaciones({minimoLineas:2,aprendizajeSimulacion:{individual:true}}),[{nombre:'Centro'},{nombre:'Costa'}]);
 const practica=grupos.find(g=>g.clave.endsWith(':individual'));
 assert.match(practica.titulo,/sólo una línea/);
 assert.match(practica.titulo,/conservá las otras/);
 assert.deepEqual(practica.filas,['Centro: cambiar manualmente UV y simular.','Costa: cambiar manualmente UV y simular.']);
 assert.ok(!grupos.some(g=>g.clave==='requiereMetroPorLinea'),'No convertir el total de metros en una obligación por línea');
});
test('Usa nombres reales y distingue líneas pendientes sin inventar sus nombres',async()=>{
 const {indicacionesLineas}=await cargar();
 const condiciones=[{clave:'minimoLineas',requerido:2}];
 const filas=indicacionesLineas(condiciones,[{nombre:'Línea 02'}])[0].filas;
 assert.deepEqual(filas,['Línea 2: creada.','Línea 1: construí su recorrido.']);
 assert.deepEqual(indicacionesLineas(condiciones,[{nombre:'Nueva Norte'},{nombre:'Sur'}])[0].filas,['Nueva Norte: creada.','Sur: creada.']);
});
test('Las reglas publicadas personalizadas gobiernan el detalle, no el número del nivel',async()=>{
 const {condicionesParaIndicaciones,indicacionesLineas}=await cargar();
 const reglas={minimoLineas:3,requiereMetroPorLinea:true};
 const copia=structuredClone(reglas);
 const grupos=indicacionesLineas(condicionesParaIndicaciones(reglas));
 assert.equal(grupos[0].filas.length,3);
 assert.equal(grupos[1].filas.length,3);
 assert.deepEqual(reglas,copia);
 assert.deepEqual(indicacionesLineas(condicionesParaIndicaciones()),[]);
});

test('Los pedidos por línea ocupan las metas existentes sin alterar contadores ni estrellas',async()=>{
 const {metasConLineas}=await cargar();
 const condiciones=[
  {clave:'minimoEstaciones',texto:'Ubicar 7 estaciones',actual:0,requerido:7,completado:false},
  {clave:'minimoMetros',texto:'Asignar 3 metros',actual:3,requerido:3,completado:true},
  {clave:'minimoTransbordos',texto:'Compartir una estación',actual:0,requerido:1,completado:false},
  {clave:'aprendizajeSimulacion:combinacion',texto:'Comparar dos ejecuciones',actual:0,requerido:1,completado:false},
  {clave:'simulacionActual',texto:'Simular red actual',actual:0,requerido:1,completado:false},
 ];
 const copia=structuredClone(condiciones);
 const metas=metasConLineas(condiciones);
 assert.equal(metas.length,5);
 assert.equal(metas[2].texto,'Línea 1 y Línea 2: 1 transbordo');
 assert.equal(metas[3].texto,'Línea 1 o Línea 2: comparar UV/UT');
 assert.deepEqual(metas.map(({texto,...estado})=>estado),condiciones.map(({texto,...estado})=>estado));
 assert.deepEqual(condiciones,copia);
});
