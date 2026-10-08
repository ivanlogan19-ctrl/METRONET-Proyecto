const {test}=require('node:test');
const assert=require('node:assert/strict');
const niveles=require('../src/educacion/recorrido-integral.json');
const puntos=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
const herramientasPorRegla={minimoEstaciones:'estaciones',minimoLineas:'lineas',minimoTramos:'conexiones',minimoMetros:'metros',requiereMetroPorLinea:'metros',requiereSimulacion:'simulacion',aprendizajeSimulacion:'simulacion'};
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
 for(const area of n.reglasExito.areasObjetivo||[]) assert.ok(n.instrucciones.includes(area.nombre));
 if(n.reglasExito.minimoTransbordos) assert.match(n.instrucciones,/transbordo/);
});
test('progresión explícita sin objetivos territoriales adelantados',()=>{
 assert.deepEqual(niveles.slice(0,4).map(n=>[n.reglasExito.minimoEstaciones,n.reglasExito.minimoMetros]),[[2,1],[3,1],[4,1],[4,2]]);
 assert.ok(niveles.slice(0,4).every(n=>!n.reglasExito.puntosInteresObjetivo));
 assert.deepEqual(niveles[1].reglasExito.aprendizajeSimulacion,{velocidad:true});
 assert.deepEqual(niveles[2].reglasExito.aprendizajeSimulacion,{duracion:true});
 assert.deepEqual(niveles[3].reglasExito.aprendizajeSimulacion,{global:true,individual:true});
 assert.deepEqual(niveles[4].reglasExito.puntosInteresObjetivo.map(p=>p.idPunto),[1]);
 assert.equal(niveles[5].reglasExito.puntosInteresObjetivo.length,2);
 assert.equal(niveles[6].reglasExito.minimoLineas,2);
 assert.equal(niveles[6].reglasExito.requiereMetroPorLinea,true);
 assert.deepEqual(niveles[8].reglasExito.aprendizajeSimulacion,{combinacion:true});
 assert.deepEqual(niveles[9].reglasExito.aprendizajeSimulacion,{global:true,individual:true,combinacion:true});
});
