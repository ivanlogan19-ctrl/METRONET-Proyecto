import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RelojTerritorial, mostrarHora, minutosDesdeHora, circuloCobertura } from '../src/simulacion/RelojTerritorial.mjs';
test('horario sigue UT, cruza medianoche y notifica solo al cambiar la franja', () => {
 const r = new RelojTerritorial(23*60+30); let cambios = 0; r.suscribir(() => cambios++);
 r.sincronizar(.25); assert.equal(r.hora,23); assert.equal(cambios,0);
 r.sincronizar(.5); assert.equal(r.hora,0); assert.equal(cambios,1);
 r.sincronizar(1); assert.equal(r.hora,0); assert.equal(cambios,1);
 assert.equal(mostrarHora(r.inicio+60),'00:30 +1d');
 r.sincronizar(0); assert.equal(r.hora,23); assert.equal(cambios,2);
 r.habilitar({},false); r.pausar(); assert.equal(r.hora,23);
 assert.equal(mostrarHora(r.inicio+49*60),'00:30 +3d');
});
test('hora inicial validada y formato de fin', () => {
 assert.equal(minutosDesdeHora('07:30'),450); assert.equal(minutosDesdeHora('24:00'),null);
 assert.equal(minutosDesdeHora('07:60'),null); assert.equal(minutosDesdeHora('x'),null);
 assert.equal(mostrarHora(420+3*60),'10:00');
});
test('cobertura mide 500 metros en todas las direcciones, no píxeles', () => {
 const lon=-56.18, lat=-34.9, rad=Math.PI/180;
 for(const [x,y] of circuloCobertura(lon,lat)) {
  const a=Math.sin((y-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(y*rad)*Math.sin((x-lon)*rad/2)**2;
  assert.ok(Math.abs(6371008.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))-500)<.001);
 }
});
