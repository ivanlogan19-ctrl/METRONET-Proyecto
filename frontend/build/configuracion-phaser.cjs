const fs = require('node:fs/promises');
const path = require('node:path');
const raiz = path.dirname(require.resolve('phaser/package.json'));
// Son los interruptores de compilación utilizados por el propio Phaser.
const opciones = { CANVAS_RENDERER: true, WEBGL_RENDERER: true, WEBGL_DEBUG: false,
  FEATURE_SOUND: false, PLUGIN_CAMERA3D: false, PLUGIN_FBINSTANT: false };
const configurar = fuente => fuente.replace(/\btypeof (CANVAS_RENDERER|WEBGL_RENDERER|WEBGL_DEBUG|FEATURE_SOUND|PLUGIN_CAMERA3D|PLUGIN_FBINSTANT)\b/g,
  (_, clave) => String(opciones[clave]));
let grupos = null;
function dependenciasDe(patron, contexto) {
  const pendientes = [...contexto.getModuleIds()].filter(id => patron.test(id));
  const incluidos = new Set();
  while (pendientes.length) {
    const id = pendientes.pop();
    if (incluidos.has(id)) continue;
    incluidos.add(id);
    pendientes.push(...(contexto.getModuleInfo(id)?.importedIds ?? []));
  }
  return incluidos;
}
module.exports = {
  separarModulos(id, contexto) {
    if (!id.includes('/node_modules/phaser/src/')) return;
    // Conservar cada grupo junto a sus dependencias reales evita ciclos entre
    // chunks; por carpetas solamente, Device/CanvasPool terminan en el núcleo.
    grupos ??= {
      geometria: dependenciasDe(/\/phaser\/src\/(geom|math|curves|utils)\//, contexto),
      render: dependenciasDe(/\/phaser\/src\/renderer\//, contexto),
    };
    if (grupos.geometria.has(id)) return 'phaser-geometria';
    if (grupos.render.has(id)) return 'phaser-render';
    return 'phaser-nucleo';
  },
  alias: [
    { find: /^phaser$/, replacement: path.join(__dirname, 'phaser-metronet.cjs') },
    { find: 'phaser-fuente', replacement: path.join(raiz, 'src') },
  ],
  // Misma selección en desarrollo (esbuild) y producción (Rollup).
  desarrollo: { name: 'metronet-phaser', setup(build) {
    build.onLoad({ filter: /[\\/]phaser[\\/]src[\\/].*\.js$/ }, async ({ path: archivo }) => ({
      contents: configurar(await fs.readFile(archivo, 'utf8')), loader: 'js',
    }));
  } },
  produccion: { name: 'metronet-phaser', enforce: 'pre', buildStart() { grupos = null; }, transform(fuente, id) {
    if (id.startsWith(path.join(raiz, 'src') + path.sep)) return { code: configurar(fuente), map: null };
  } },
};
