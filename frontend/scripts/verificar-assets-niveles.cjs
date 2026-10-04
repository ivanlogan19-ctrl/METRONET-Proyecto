#!/usr/bin/env node
// Ejecutar antes de 018: PostgreSQL no puede verificar archivos del frontend.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const raiz = path.resolve(__dirname, '..');
const manifiesto = JSON.parse(fs.readFileSync(path.join(raiz, 'src/educacion/catalogo-svgs-niveles.json'), 'utf8'));

async function verificar() {
  const backend = path.resolve(raiz, '../backend/src/main/resources/educacion');
  if (fs.existsSync(backend)) {
    const frontal = fs.readFileSync(path.join(raiz, 'src/educacion/catalogo-svgs-niveles.json'));
    if (!frontal.equals(fs.readFileSync(path.join(backend, 'catalogo-svgs-niveles.json'))))
      throw new Error('El catálogo SVG del backend difiere del frontend');
    const niveles = fs.readFileSync(path.join(raiz, 'src/educacion/niveles.json'));
    if (!niveles.equals(fs.readFileSync(path.join(backend, 'niveles.json'))))
      throw new Error('El catálogo de niveles del backend difiere del frontend');
  }
  const fuente = fs.readFileSync(path.join(raiz, 'src/educacion/TarjetasEducativasNivel.js'), 'utf8');
  const modulo = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);
  const actuales = modulo.tarjetasEducativas;
  if (manifiesto.length !== 10 || actuales.length !== 10) throw new Error('Deben existir diez niveles');
  const ids = new Set();
  for (const [indice, nivel] of manifiesto.entries()) {
    if (nivel.numero !== indice + 1 || nivel.tarjetas.length !== 7 || actuales[indice].length !== 7)
      throw new Error(`El nivel ${indice + 1} debe tener siete tarjetas`);
    for (const [posicion, tarjeta] of nivel.tarjetas.entries()) {
      const actual = actuales[indice][posicion];
      if (!tarjeta.id || ids.has(tarjeta.id)) throw new Error(`ID duplicado o vacío: ${tarjeta.id}`);
      ids.add(tarjeta.id);
      for (const campo of ['id', 'imagen', 'titulo', 'texto', 'aprendizaje', 'fuente', 'url', 'descripcionImagen']) {
        if (tarjeta[campo] !== actual[campo]) throw new Error(`El campo ${campo} de ${tarjeta.id} difiere del banco inicial`);
      }
      if (!/^\/assets\/educacion\/[a-z0-9-]+\.svg$/.test(tarjeta.imagen))
        throw new Error(`SVG fuera del catálogo local: ${tarjeta.id}`);
      const archivo = path.join(raiz, 'public', tarjeta.imagen.slice(1));
      const huella = crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');
      if (huella !== tarjeta.sha256) throw new Error(`SVG modificado: ${tarjeta.id}`);
    }
  }
  if (ids.size !== 70) throw new Error('Deben existir 70 IDs únicos');
  process.stdout.write('Preflight SVG: 10 niveles, 70 tarjetas e imágenes verificadas.\n');
}

verificar().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
