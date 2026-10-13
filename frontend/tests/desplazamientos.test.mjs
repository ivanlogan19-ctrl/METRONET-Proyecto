import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validarDesplazamientos, flujosPorHora, puntoCurva } from '../src/mapa/desplazamientos/ModeloDesplazamientos.mjs';
import RelojCapas from '../src/mapa/desplazamientos/RelojCapas.mjs';
const datos = JSON.parse(fs.readFileSync(new URL('../src/mapa/datos/desplazamientos-historicos.json', import.meta.url)));
test('datos oficiales: consistencia, cobertura y exclusiones explícitas', () => {
  assert.equal(validarDesplazamientos(datos), true);
  assert.equal(datos.flujos.length, 5368);
  assert.equal(datos.flujos.reduce((n,f)=>n+f.muestra,0), datos.metadata.incluidos);
  assert.equal(datos.metadata.incluidos + Object.values(datos.metadata.excluidos).reduce((a,b)=>a+b,0), datos.metadata.totalRegistros);
  assert.ok(Math.abs(datos.flujos.reduce((n,f)=>n+f.viajes,0)-datos.metadata.totalEstimado)<.001);
  assert.equal(validarDesplazamientos({...datos,flujos:[{...datos.flujos[0],viajes:NaN}]}),false);
  assert.equal(validarDesplazamientos({...datos,flujos:[datos.flujos[0],datos.flujos[0]]}),false);
  assert.equal(validarDesplazamientos({...datos,flujos:[{...datos.flujos[0],hora:24}]}),false);
});
test('solo pares de la hora seleccionada, ordenados por peso, sin inventar viajes', () => {
  for(let h=0;h<24;h++) {
    const flujos=flujosPorHora(datos,h);
    assert.ok(flujos.length<=12); assert.ok(flujos.every(f=>f.hora===h));
    assert.ok(flujos.every((f,i)=>i===0||flujos[i-1].viajes>=f.viajes));
  }
  assert.deepEqual(flujosPorHora({...datos,flujos:[]},8),[]);
  assert.notDeepEqual(flujosPorHora(datos,8),flujosPorHora(datos,18));
});
test('curva va del origen al destino y separa sentidos opuestos', () => {
  const a={x:0,y:0},b={x:100,y:0};
  assert.deepEqual(puntoCurva(a,b,0),a);assert.deepEqual(puntoCurva(a,b,1),b);
  assert.ok(puntoCurva(a,b,.5).y>0);assert.ok(puntoCurva(b,a,.5).y<0);
});
test('reloj compartido: rollover, capas independientes y limpieza', () => {
  const reloj=new RelojCapas();let avisos=0;const salir=reloj.suscribir(()=>avisos++);
  reloj.cambiarHora(24);assert.equal(reloj.hora,0);reloj.cambiarHora(-1);assert.equal(reloj.hora,23);
  reloj.cambiarHora(NaN);assert.equal(reloj.hora,23);
  reloj.reproducir();assert.equal(reloj.temporizador,null);
  reloj.habilitar('trafico',true);reloj.habilitar('flujos',true);reloj.reproducir();
  assert.ok(reloj.temporizador);reloj.habilitar('trafico',false);assert.ok(reloj.temporizador);
  reloj.habilitar('flujos',false);assert.equal(reloj.temporizador,null);
  assert.ok(avisos>0);salir();reloj.eliminar();assert.equal(reloj.oyentes.size,0);
});
