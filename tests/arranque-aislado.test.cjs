const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

for (const fallo of [false, true]) test(`arranque aislado: compilación ${fallo ? 'fallida' : 'correcta'}`, () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'metronet-arranque-prueba-'));
  try {
    for (const carpeta of ['backend/scripts', 'backend/target', 'java/bin', 'temporal'])
      fs.mkdirSync(path.join(raiz, carpeta), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '../backend/scripts/iniciar-local.sh'), path.join(raiz, 'backend/scripts/iniciar-local.sh'));
    fs.writeFileSync(path.join(raiz, 'entorno'), '');
    fs.writeFileSync(path.join(raiz, 'backend/mvnw'), `#!/bin/bash\n${fallo ? 'exit 7' : 'printf original > target/backend-0.0.1-SNAPSHOT.jar'}\n`, { mode: 0o700 });
    fs.writeFileSync(path.join(raiz, 'java/bin/java'), `#!/bin/bash
set -eu
[[ "$1" == -jar && "$3" == --prueba ]]
[[ "$2" != target/backend-0.0.1-SNAPSHOT.jar ]]
[[ "$(cat "$2")" == original ]]
printf recompilado > target/backend-0.0.1-SNAPSHOT.jar
[[ "$(cat "$2")" == original ]]
printf verificado > ../ejecutado
`, { mode: 0o700 });
    const resultado = spawnSync('bash', [path.join(raiz, 'backend/scripts/iniciar-local.sh'), '--prueba'], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, JAVA_HOME: path.join(raiz, 'java'), TMPDIR: path.join(raiz, 'temporal'), METRONET_ARCHIVO_ENTORNO: path.join(raiz, 'entorno') },
    });
    assert.equal(resultado.status, fallo ? 7 : 0, resultado.stderr);
    assert.equal(fs.existsSync(path.join(raiz, 'ejecutado')), !fallo);
    assert.deepEqual(fs.readdirSync(path.join(raiz, 'temporal')), []);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});
