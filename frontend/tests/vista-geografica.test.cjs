const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ruta = path.join(__dirname, '../src/mapa/VistaGeografica.js');
const modulo = import(`data:text/javascript;base64,${fs.readFileSync(ruta).toString('base64')}`);
const geografia = { minX: -56.43151377, maxX: -56.02364901, minY: -34.93810651, maxY: -34.70181760 };
const original = { longitud: -56.14775748, latitud: -34.88110448, escalaVisible: 13224.13020, rotacion: Math.PI / 12 };

function proyeccion(ancho, alto) {
  const estrecha = ancho < 520;
  const margenX = estrecha ? 18 : 32;
  const margenSuperior = estrecha ? 24 : 32;
  const margenInferior = estrecha ? 28 : 32;
  const disponibleX = Math.max(ancho - margenX * 2, 300);
  const disponibleY = Math.max(alto - margenSuperior - margenInferior, 300);
  const escala = Math.min(disponibleX / (geografia.maxX - geografia.minX), disponibleY / (geografia.maxY - geografia.minY));
  const offsetX = (ancho - (geografia.maxX - geografia.minX) * escala) / 2;
  const offsetY = margenSuperior + (alto - margenSuperior - margenInferior - (geografia.maxY - geografia.minY) * escala) / 2;
  return { escala, offsetX, offsetY,
    anchoMapa: (geografia.maxX - geografia.minX) * escala,
    altoMapa: (geografia.maxY - geografia.minY) * escala };
}

const dimensionesSimulacion = [
  [1539, 626], [1219, 522], [1062, 522], [1004, 445], [937, 417], [349, 362],
];

test('seis tamaños medidos de Simulación conservan centro, escala visible y rotación', async () => {
  const { capturarVistaGeografica, proyectarVistaGeografica } = await modulo;
  for (const [ancho, alto] of dimensionesSimulacion) {
    const transformacion = proyeccion(ancho, alto);
    const destino = proyectarVistaGeografica(original, transformacion, geografia);
    const limites = { minimoX: transformacion.offsetX, minimoY: transformacion.offsetY,
      maximoX: transformacion.offsetX + (geografia.maxX - geografia.minX) * transformacion.escala,
      maximoY: transformacion.offsetY + (geografia.maxY - geografia.minY) * transformacion.escala };
    const capturada = capturarVistaGeografica({ midPoint: { x: destino.x, y: destino.y }, zoom: destino.zoom,
      rotation: destino.rotacion }, limites, geografia);
    assert.ok(Math.abs(capturada.longitud - original.longitud) < 1e-10, `${ancho}x${alto} longitud`);
    assert.ok(Math.abs(capturada.latitud - original.latitud) < 1e-10, `${ancho}x${alto} latitud`);
    assert.ok(Math.abs(capturada.escalaVisible - original.escalaVisible) < 1e-6, `${ancho}x${alto} escala`);
    assert.equal(capturada.rotacion, original.rotacion);
  }
  assert.ok(Math.abs(proyeccion(937, 417).escala - 1493.93382) < 0.001);
  assert.ok(Math.abs(original.escalaVisible / proyeccion(937, 417).escala - 8.852) < 0.002);
});

test('vista temporal se consume una vez y rechaza otro diseño, cuenta o sesión', async () => {
  const { guardarVistaParaNavegacion, consumirVistaParaNavegacion } = await modulo;
  const datos = new Map();
  global.sessionStorage = { setItem: (k,v) => datos.set(k,v), getItem: k => datos.get(k) ?? null,
    removeItem: k => datos.delete(k) };
  const sesion = { token: 'token-a', fechaInicio: 123, usuario: { idUsuario: 7, rol: 'JUGADOR' } };
  assert.equal(guardarVistaParaNavegacion(77, original, sesion, 'simulacion'), true);
  assert.deepEqual(consumirVistaParaNavegacion(77, sesion, 'simulacion'), original);
  assert.equal(consumirVistaParaNavegacion(77, sesion, 'simulacion'), null);
  guardarVistaParaNavegacion(77, original, sesion, 'edicion');
  assert.equal(consumirVistaParaNavegacion(78, sesion, 'edicion'), null);
  guardarVistaParaNavegacion(77, original, sesion, 'edicion');
  assert.equal(consumirVistaParaNavegacion(77, { ...sesion, token: 'token-b' }, 'edicion'), null);
  guardarVistaParaNavegacion(77, original, sesion, 'edicion');
  assert.equal(consumirVistaParaNavegacion(77, { ...sesion, usuario: { idUsuario: 8, rol: 'JUGADOR' } }, 'edicion'), null);
  guardarVistaParaNavegacion(77, original, sesion, 'simulacion');
  assert.equal(consumirVistaParaNavegacion(77, sesion, 'edicion'), null);
});

async function cargarControlZoom() {
  const helper = `data:text/javascript;base64,${fs.readFileSync(ruta).toString('base64')}`;
  const fuente = fs.readFileSync(path.join(__dirname, '../src/mapa/controles/ControlZoom.js'), 'utf8')
    .replace("import '../estilos/control-zoom.css';", '')
    .replace("from '../VistaGeografica.js'", `from '${helper}'`);
  global.document = { body: {} };
  return (await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`)).default;
}
function crearControl(ControlZoom, ancho, alto, zoomMinimo, zoomMaximo) {
  const transformacion = proyeccion(ancho, alto);
  const estado = { transformacion };
  const camara = {
    width: ancho, height: alto, originX: .5, originY: .5, zoom: 1, rotation: 0,
    scrollX: 0, scrollY: 0, useBounds: false,
    get midPoint() { return { x: this.scrollX + this.width / 2, y: this.scrollY + this.height / 2 }; },
    get displayWidth() { return this.width / this.zoom; },
    get displayHeight() { return this.height / this.zoom; },
    setZoom(n) { this.zoom = n; }, setRotation(n) { this.rotation = n; },
    setBounds(x,y,width,height) { this.bounds = {x,y,width,height}; this.useBounds = true; },
    removeBounds() { this.useBounds = false; },
    clampX(x) { const b=this.bounds,d=this.displayWidth,low=b.x+(d-this.width)/2; return Math.max(low,Math.min(Math.max(low,low+b.width-d),x)); },
    clampY(y) { const b=this.bounds,d=this.displayHeight,low=b.y+(d-this.height)/2; return Math.max(low,Math.min(Math.max(low,low+b.height-d),y)); },
    centerOn(x,y) { this.scrollX=x-this.width/2; this.scrollY=y-this.height/2;
      if(this.useBounds) {this.scrollX=this.clampX(this.scrollX);this.scrollY=this.clampY(this.scrollY);} },
  };
  const escena = { scale: { width: ancho, height: alto }, cameras: { main: camara } };
  const capaBarrios = {
    transformacion: geografia,
    calcularEscalaMapa: () => estado.transformacion,
    convertirCoordenada: ([longitud, latitud], mapa) => ({
      x: mapa.offsetX + (longitud - geografia.minX) * mapa.escala,
      y: mapa.offsetY + (geografia.maxY - latitud) * mapa.escala,
    }),
  };
  const control = new ControlZoom(escena, { capaBarrios, zoomMinimo, zoomMaximo });
  control.actualizarLimitesCamara();
  return { control, escena, camara, estado };
}

test('ControlZoom transfiere el rango geográfico y conserva vista en seis resize reales', async () => {
  const ControlZoom = await cargarControlZoom();
  const editor = crearControl(ControlZoom, 908, 506, 1, 8);
  assert.equal(editor.control.aplicarVistaGeografica(original), true);
  const origen = editor.control.capturarVistaParaNavegacion();
  assert.ok(origen.escalaVisibleMaxima > origen.escalaVisible);
  const sim = crearControl(ControlZoom, 937, 417, .8, 4);
  assert.equal(sim.control.obtenerZoomMaximoPermitido(), 4);
  assert.equal(sim.control.aplicarVistaGeografica(origen), true);
  assert.ok(Math.abs(sim.camara.zoom - 8.852) < .003);
  assert.ok(sim.control.obtenerZoomMaximoPermitido() > sim.camara.zoom);
  for (const [ancho, alto] of dimensionesSimulacion) {
    const antes = sim.control.capturarVista();
    sim.escena.scale.width = ancho; sim.escena.scale.height = alto;
    sim.camara.width = ancho; sim.camara.height = alto;
    sim.estado.transformacion = proyeccion(ancho, alto);
    sim.control.restaurarVistaTrasRedimension(antes);
    const despues = sim.control.capturarVistaParaNavegacion();
    assert.ok(Math.abs(despues.longitud - origen.longitud) < 1e-9, `${ancho}x${alto}: longitud`);
    assert.ok(Math.abs(despues.latitud - origen.latitud) < 1e-9, `${ancho}x${alto}: latitud`);
    assert.ok(Math.abs(despues.escalaVisible - origen.escalaVisible) < 1e-6, `${ancho}x${alto}: escala`);
    assert.equal(despues.rotacion, origen.rotacion);
    assert.ok(sim.control.obtenerZoomMaximoPermitido() >= sim.camara.zoom);
  }
});

test('la cámara sin rotación conserva un centro cercano al borde al reducir el canvas', async () => {
  const ControlZoom = await cargarControlZoom();
  const editor = crearControl(ControlZoom, 908, 506, 1, 8);
  const borde = { ...original, longitud: geografia.maxX - .003, latitud: geografia.minY + .003, rotacion: 0 };
  assert.equal(editor.control.aplicarVistaGeografica(borde), true);
  const fuente = editor.control.capturarVistaParaNavegacion();
  const sim = crearControl(ControlZoom, 937, 417, .8, 4);
  assert.equal(sim.control.aplicarVistaGeografica(fuente), true);
  sim.escena.scale.width = 349; sim.escena.scale.height = 362;
  const vistaAnterior = sim.control.capturarVista();
  sim.camara.width = 349; sim.camara.height = 362;
  sim.estado.transformacion = proyeccion(349, 362);
  sim.control.restaurarVistaTrasRedimension(vistaAnterior);
  const despues = sim.control.capturarVistaParaNavegacion();
  assert.ok(Math.abs(despues.longitud - fuente.longitud) < 1e-9);
  assert.ok(Math.abs(despues.latitud - fuente.latitud) < 1e-9);
  assert.ok(Math.abs(despues.escalaVisible - fuente.escalaVisible) < 1e-6);
});

// El mapa completo debe quedar centrado aun cuando es más angosto que el canvas.
test('el inicio centra Montevideo dentro del lienzo sin alterar el zoom', async () => {
  const ControlZoom = await cargarControlZoom();
  for (const [ancho, alto] of [[1539, 626], [1219, 522], [349, 362]]) {
    const { control, camara, estado } = crearControl(ControlZoom, ancho, alto, 1, 8);
    camara.setRotation(Math.PI / 6);
    control.restaurar();
    const mapa = estado.transformacion;
    assert.ok(Math.abs(camara.midPoint.x - (mapa.offsetX + mapa.anchoMapa / 2)) < 1, `${ancho}x${alto}: centro horizontal`);
    assert.ok(Math.abs(camara.midPoint.y - (mapa.offsetY + mapa.altoMapa / 2)) < 1, `${ancho}x${alto}: centro vertical`);
    assert.equal(camara.zoom, 1);
    assert.equal(camara.rotation, 0);
  }
});

test('el mapa inicial conserva el encuadre de apertura al cambiar el tamaño del cuadro', async () => {
  const ControlZoom = await cargarControlZoom();
  const { control, escena, camara, estado } = crearControl(ControlZoom, 908, 506, 1, 8);
  control.restaurar();
  const vistaInicial = control.capturarVista();
  escena.scale.width = 1539;
  escena.scale.height = 626;
  camara.width = 1539;
  camara.height = 626;
  estado.transformacion = proyeccion(1539, 626);
  control.restaurarVistaTrasRedimension(vistaInicial);
  const mapa = estado.transformacion;
  assert.ok(Math.abs(camara.midPoint.x - (mapa.offsetX + mapa.anchoMapa / 2)) < 1);
  assert.ok(Math.abs(camara.midPoint.y - (mapa.offsetY + mapa.altoMapa / 2)) < 1);
  assert.equal(camara.zoom, 1);
});
