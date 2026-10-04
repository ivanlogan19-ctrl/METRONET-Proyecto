const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '..');
const verificador = path.join(raiz, 'scripts/verificar-assets-niveles.cjs');

test('el paquete incluye diez niveles, 60 tarjetas y SVG íntegros', () => {
  const resultado = spawnSync(process.execPath, [verificador], { encoding: 'utf8' });
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.match(resultado.stdout, /60 tarjetas/);
});

test('un SVG alterado detiene el preflight antes de 018', () => {
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'metronet-assets-'));
  try {
    for (const relativo of ['scripts/verificar-assets-niveles.cjs', 'src/educacion/catalogo-svgs-niveles.json',
      'src/educacion/TarjetasEducativasNivel.js']) {
      fs.mkdirSync(path.dirname(path.join(temporal, relativo)), { recursive: true });
      fs.copyFileSync(path.join(raiz, relativo), path.join(temporal, relativo));
    }
    fs.cpSync(path.join(raiz, 'public/assets/educacion'), path.join(temporal, 'public/assets/educacion'), { recursive: true });
    const catalogo = JSON.parse(fs.readFileSync(path.join(temporal, 'src/educacion/catalogo-svgs-niveles.json')));
    fs.appendFileSync(path.join(temporal, 'public', catalogo[0].tarjetas[0].imagen.slice(1)), '<!-- alterado -->');
    const resultado = spawnSync(process.execPath, [path.join(temporal, 'scripts/verificar-assets-niveles.cjs')], { encoding: 'utf8' });
    assert.notEqual(resultado.status, 0);
    assert.match(resultado.stderr, /SVG modificado/);
  } finally { fs.rmSync(temporal, { recursive: true, force: true }); }
});
