const {test}=require('node:test');
const assert=require('node:assert/strict');
const niveles=require('../src/educacion/recorrido-integral.json');
const puntos=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
const herramientasPorRegla={minimoEstaciones:'estaciones',minimoLineas:'lineas',minimoTramos:'lineas',minimoConexionesLineas:'conexiones',minimoMetros:'metros',requiereMetroPorLinea:'metros',requiereSimulacion:'simulacion',aprendizajeSimulacion:'simulacion'};
test('los objetivos POI no se repiten entre niveles del recorrido',()=>{
 const usados=new Map();
 for(const nivel of niveles) for(const punto of nivel.reglasExito.puntosInteresObjetivo||[]) {
  assert.equal(usados.has(punto.idPunto),false,`POI ${punto.idPunto} repetido en niveles ${usados.get(punto.idPunto)} y ${nivel.numero}`);
  usados.set(punto.idPunto,nivel.numero);
 }
 assert.equal(usados.size,10);
 assert.deepEqual([...new Set(usados.values())],[6,7,8,9,10]);
});
for(const n of niveles) test(`consistencia del nivel ${n.numero}: reglas, herramientas, referencias y narrativa`,()=>{
 assert.equal(n.reglasExito.requiereSimulacion,true);
 for(const [regla,herramienta] of Object.entries(herramientasPorRegla)) if(n.reglasExito[regla]) assert.equal(n.herramientasHabilitadas[herramienta],true,regla);
 assert.match(n.instrucciones,/Guardá/);
 assert.match(n.instrucciones,/simul[aá]|ejecu|ejecut/i);
 assert.ok(n.historia.texto.length>60);
 assert.notEqual(n.historia.texto,n.objetivo);
 for(const p of n.reglasExito.puntosInteresObjetivo||[]) {
  const real=puntos.find(x=>x.id===p.idPunto); assert.ok(real);assert.ok(p.radioCobertura>0);
 }
 for(const area of n.reglasExito.areasObjetivo||[]) assert.ok(n.instrucciones.toLocaleUpperCase().includes(area.nombre.toLocaleUpperCase()));
 if(n.reglasExito.minimoTransbordos) assert.match(n.instrucciones,/transbordo/);
});
test('progresión aprobada: líneas, estaciones y prácticas sin comparaciones obligatorias',()=>{
 assert.deepEqual(niveles.map(n=>n.reglasExito.minimoEstaciones),[2,3,4,4,6,7,8,9,10,13]);
 assert.deepEqual(niveles.map(n=>n.reglasExito.minimoMetros),[1,2,2,2,3,3,4,4,5,6]);
 assert.deepEqual(niveles.map(n=>n.reglasExito.configuracionRecorrido.estacionesPorLinea),[[2],[3],[2,2],[2,2],[2,2,2],[3,2,2],[3,3,2],[3,3,3],[3,3,2,2],[4,3,3,3]]);
 assert.deepEqual(niveles.slice(5).map(n=>n.reglasExito.configuracionRecorrido.practica),['aumentarUV','aumentarUT','reducirUT','reducirUV','cambiar']);
 for(const n of niveles){
  assert.equal(n.reglasExito.aprendizajeSimulacion,undefined);
  assert.equal(n.reglasExito.minimoTransbordos,undefined);
  assert.equal(Object.keys(n.reglasExito.textosMetas).length,5);
 }
});
test('los POI son exactamente los aprobados y no exigen una línea concreta',()=>{
 assert.deepEqual(niveles.map(n=>(n.reglasExito.puntosInteresObjetivo||[]).map(p=>p.idPunto)),[[],[],[],[],[],[63],[2,25],[88,80],[92,103],[38,57,106]]);
 assert.ok(niveles.every(n=>!n.reglasExito.requiereObjetivosMismaLinea));
});

test('los diez niveles conservan cinco metas y hasta tres POI solo desde el nivel seis',()=>{
 assert.deepEqual(niveles.map(n=>n.numero),[1,2,3,4,5,6,7,8,9,10]);
 for(const n of niveles){
  assert.equal(Object.keys(n.reglasExito.textosMetas).length,5,`Nivel ${n.numero}: cinco metas`);
  const cantidad=(n.reglasExito.puntosInteresObjetivo||[]).length;
  if(n.numero<6) assert.equal(cantidad,0);
  else assert.ok(cantidad>=1 && cantidad<=3,`Nivel ${n.numero}: de uno a tres POI`);
 }
});
