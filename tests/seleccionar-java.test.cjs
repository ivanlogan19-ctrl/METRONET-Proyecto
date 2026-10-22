const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('el arranque descarta Java 21, conserva JDK 25 y rechaza instalaciones incompatibles', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'metronet-java-'));
  try {
    for (const version of [21, 25]) {
      const bin = path.join(raiz, String(version), 'bin');
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(bin, 'java'), `#!/bin/bash\nprintf 'openjdk version "${version}.0.1"\\n'\n`, { mode: 0o700 });
      fs.writeFileSync(path.join(bin, 'javac'), '#!/bin/bash\nexit 0\n', { mode: 0o700 });
    }
    const seleccionar = (...versiones) => spawnSync('bash', ['-c',
      'source "$1"; shift; seleccionarJava "$@" || exit $?; printf "%s" "$JAVA_HOME"',
      'prueba', path.join(__dirname, '../backend/scripts/seleccionar-java.sh'),
      ...versiones.map(v => path.join(raiz, String(v)))], { encoding: 'utf8' });
    for (const orden of [[21, 25], [25, 21]]) {
      const resultado = seleccionar(...orden);
      assert.equal(resultado.status, 0, resultado.stderr);
      assert.equal(resultado.stdout, path.join(raiz, '25'));
    }
    assert.equal(seleccionar(21).status, 1);
    assert.match(seleccionar(21).stderr, /requiere JDK 25/);
    fs.unlinkSync(path.join(raiz, '25/bin/javac'));
    assert.equal(seleccionar(25).status, 1, 'Un JRE sin compilador no permite arrancar');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});
