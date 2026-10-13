const {test}=require('node:test');
const assert=require('node:assert/strict');
const niveles=require('../src/educacion/recorrido-integral.json');
const puntos=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
const herramientasPorRegla={minimoEstaciones:'estaciones',minimoLineas:'lineas',minimoTramos:'conexiones',minimoMetros:'metros',requiereMetroPorLinea:'metros',requiereSimulacion:'simulacion',aprendizajeSimulacion:'simulacion'};
test('los objetivos POI no se repiten entre niveles del recorrido',()=>{
 const usados=new Map();
 for(const nivel of niveles) for(const punto of nivel.reglasExito.puntosInteresObjetivo||[]) {
  assert.equal(usados.has(punto.idPunto),false,`POI ${punto.idPunto} repetido en niveles ${usados.get(punto.idPunto)} y ${nivel.numero}`);
  usados.set(punto.idPunto,nivel.numero);
 }
 assert.equal(usados.size,15);
 assert.deepEqual([...new Set(usados.values())],[6,7,8,9,10]);
});
for(const n of niveles) test(`consistencia del nivel ${n.numero}: reglas, herramientas, referencias y narrativa`,()=>{
 assert.equal(n.reglasExito.requiereSimulacion,true);
 for(const [regla,herramienta] of Object.entries(herramientasPorRegla)) if(n.reglasExito[regla]) assert.equal(n.herramientasHabilitadas[herramienta],true,regla);
 assert.match(n.instrucciones,/Guardá/);
 assert.match(n.instrucciones,/simula|ejecu|ejecut/i);
 assert.ok(n.historia.texto.length>60);
 assert.notEqual(n.historia.texto,n.objetivo);
 for(const p of n.reglasExito.puntosInteresObjetivo||[]) {
  const real=puntos.find(x=>x.id===p.idPunto); assert.ok(real);assert.ok(n.instrucciones.includes(real.nombre));assert.ok(p.radioCobertura>0);
 }
 for(const area of n.reglasExito.areasObjetivo||[]) assert.ok(n.instrucciones.toLocaleUpperCase().includes(area.nombre.toLocaleUpperCase()));
 if(n.reglasExito.minimoTransbordos) assert.match(n.instrucciones,/transbordo/);
});
test('progresión explícita sin objetivos territoriales adelantados',()=>{
 assert.deepEqual(niveles.slice(0,5).map(n=>[n.reglasExito.minimoEstaciones,n.reglasExito.minimoMetros]),[[2,1],[3,1],[4,1],[4,2],[5,2]]);
 assert.ok(niveles.slice(0,5).every(n=>!n.reglasExito.puntosInteresObjetivo));
 assert.deepEqual(niveles[1].reglasExito.aprendizajeSimulacion,{velocidad:true});
 assert.deepEqual(niveles[2].reglasExito.aprendizajeSimulacion,{duracion:true});
 assert.deepEqual(niveles[3].reglasExito.aprendizajeSimulacion,{global:true,individual:true});
 assert.equal(niveles[4].reglasExito.puntosInteresObjetivo,undefined);
 assert.equal(niveles[5].reglasExito.puntosInteresObjetivo.length,3);
 assert.equal(niveles[6].reglasExito.minimoLineas,2);
 assert.equal(niveles[6].reglasExito.minimoTransbordos,1);
 assert.deepEqual(niveles[8].reglasExito.aprendizajeSimulacion,{combinacion:true});
 assert.deepEqual(niveles[9].reglasExito.aprendizajeSimulacion,{combinacion:true});
});

test("N6–N10 tienen tres POI cada uno",()=>niveles.slice(5).forEach(n=>assert.equal(n.reglasExito.puntosInteresObjetivo.length,3)));
