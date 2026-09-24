const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const casos = require('./fixtures/geometria-territorial.json');
const modulo = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(__dirname, '../src/mapa/utilidades/GeometriaTerritorial.js'), 'utf8')).toString('base64'));
for (const caso of casos) test(`geometría compartida: ${caso.nombre}`, async () => {
  const { default: Geometria } = await modulo;
  const g = new Geometria(caso.geometrias);
  for (const { p, dentro } of caso.puntos) assert.equal(g.contiene(p), dentro, JSON.stringify(p));
  for (const { a, b, dentro, intersecta } of caso.segmentos) {
    assert.equal(g.contieneSegmento(a, b), dentro, `pertenencia ${a}→${b}`);
    assert.equal(g.intersectaSegmento(a, b), intersecta, `intersección ${a}→${b}`);
  }
});
