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
  if(nivel.numero<5){assert.deepEqual(antes,[]);continue;}
  assert.ok(antes.length>0,`Nivel ${nivel.numero}`);
  assert.deepEqual(antes.map(g=>g.clave),dentro.map(g=>g.clave));
  for(const grupo of dentro){assert.ok(grupo.filas.some(f=>f.startsWith('Norte:')));assert.ok(grupo.filas.some(f=>f.startsWith('Sur:')));}
 }
});
test('N8 ofrece alternativas explícitas; no exige modificar las dos líneas',async()=>{
 const {condicionesParaIndicaciones,indicacionesLineas}=await cargar();
 const grupos=indicacionesLineas(condicionesParaIndicaciones(catalogo[7].reglasExito),[{nombre:'Centro'},{nombre:'Costa'}]);
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
