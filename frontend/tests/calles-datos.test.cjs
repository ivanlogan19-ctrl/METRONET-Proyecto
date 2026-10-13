const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const datos = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/mapa/datos/calles-montevideo.geojson')));

test('cada tramo cartográfico tiene al menos dos puntos válidos en Montevideo', () => {
  assert.ok(datos.features.length > 3000);
  for (const f of datos.features) {
    assert.equal(f.geometry.type, 'MultiLineString');
    for (const linea of f.geometry.coordinates) {
      assert.ok(linea.length >= 2, `Geometría vacía: ${f.properties.nombre}`);
      for (const [lon, lat] of linea) {
        assert.ok(Number.isFinite(lon) && lon > -56.7 && lon < -55.9);
        assert.ok(Number.isFinite(lat) && lat > -35 && lat < -34.4);
      }
    }
  }
});

test('la capa conserva vías reales, nombres y separación entre principales y detalle', () => {
  assert.ok(datos.features.some(f => f.properties.nombre.includes('18 DE JULIO')));
  assert.ok(datos.features.some(f => f.properties.tipo === 'BULEVAR'));
  assert.ok(datos.features.some(f => f.properties.tipo === 'RAMBLA'));
  for (const f of datos.features) {
    assert.notEqual(f.properties.tipo, 'PROYECTADA');
    assert.equal(f.properties.principal, ['AVENIDA','BULEVAR','RAMBLA','RUTA NACIONAL'].includes(f.properties.tipo));
  }
});
