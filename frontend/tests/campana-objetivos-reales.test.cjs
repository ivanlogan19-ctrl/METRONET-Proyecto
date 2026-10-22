const {test}=require('node:test');
const assert=require('node:assert/strict');
const niveles=require('../src/educacion/recorrido-integral.json');
const puntos=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
const cantidades=['minimoEstaciones','minimoLineas','minimoTramos','minimoMetros','minimoTransbordos','maximoEstaciones'];
for(const n of niveles)test(`N${n.numero}: cinco condiciones reales y POI independientes`,()=>{
 const r=n.reglasExito;
 const total=cantidades.filter(k=>r[k]).length+Object.values(r.aprendizajeSimulacion||{}).filter(Boolean).length+Number(r.requiereSimulacion)+Number(Boolean(r.requiereMetroPorLinea));
 assert.equal(total,5);
 assert.equal(r.puntosInteresObjetivo?.length||0,[0,0,0,0,0,1,2,2,2,3][n.numero-1]);
 assert.ok(!r.areasObjetivo&&!r.requiereObjetivosMismaLinea&&!r.maximoEstaciones,'Sin condiciones adicionales');
 if(n.numero>=6)assert.equal(r.requierePoiIndividuales,true);
 for(const p of r.puntosInteresObjetivo||[]){assert.ok(puntos.some(q=>q.id===p.idPunto));assert.ok(p.radioCobertura>0);}
 for(const h of ['estaciones','lineas','conexiones','metros','simulacion'])assert.equal(n.herramientasHabilitadas[h],true);
});
test('diez POI distintos globalmente',()=>{const ids=niveles.flatMap(n=>(n.reglasExito.puntosInteresObjetivo||[]).map(p=>p.idPunto));assert.equal(ids.length,10);assert.equal(new Set(ids).size,10);});
