const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const codigo = fs.readFileSync(`${__dirname}/../src/mapa/capas/CapaRedMetro.js`, 'utf8')
  .replace(/^import .*;\s*/gm, '')
  .replace('export default class CapaRedMetro', 'class CapaRedMetro');
const modulo = { exports: null };
vm.runInNewContext(`${codigo}\nmodule.exports = CapaRedMetro;`, {
  module: modulo,
  COLORES_INTERFAZ_MAPA: { TEXTO: 0xffffff, FONDO: 0x000000 },
  FUENTES_INTERFAZ_MAPA: { SISTEMA: 'monospace' },
  colorMetro: () => 0xe99238,
  Phaser: { Math: {
    Clamp: (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor)),
    Linear: (origen, destino, avance) => origen + (destino - origen) * avance,
    Distance: { Between: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay) },
    Angle: { Between: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax) },
  } },
});
const CapaRedMetro = modulo.exports;

function crearGrafico() {
  const grafico = { operaciones: [] };
  for (const metodo of ['fillStyle', 'fillEllipse', 'fillRect', 'lineStyle', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle']) {
    grafico[metodo] = (...argumentos) => {
      grafico.operaciones.push([metodo, ...argumentos]);
      return grafico;
    };
  }
  return grafico;
}

function preparar(origen, destino, rotacion = 0) {
  const camara = { zoom: 2, rotation: rotacion };
  const escena = { cameras: { main: camara }, add: {
    graphics: crearGrafico,
    container(x, y) {
      return { x, y, rotation: 0, scaleX: 1, scaleY: 1, list: [],
        setDepth(valor) { this.depth = valor; return this; },
        add(hijo) { this.list.push(hijo); return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setRotation(valor) { this.rotation = valor; return this; },
        setScale(valor) { this.scaleX = this.scaleY = valor; return this; },
      };
    },
  } };
  const capa = new CapaRedMetro(escena, { capaBarrios: {
    calcularEscalaMapa: () => ({ offsetX: 0, offsetY: 0, anchoMapa: 1000, altoMapa: 620 }),
  } });
  capa.diseno = {
    estaciones: [
      { nombre: 'A', posicionX: origen[0], posicionY: origen[1] },
      { nombre: 'B', posicionX: destino[0], posicionY: destino[1] },
    ],
    tramos: [{ nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B' }],
    unidadesMetro: [{ idTren: 1, nombreLinea: 'Azul' }],
  };
  return { capa, camara };
}

function representar(capa, modo, progreso = 0.5) {
  if (modo === 'editor') {
    capa.dibujarUnidad(capa.diseno.unidadesMetro[0], 0);
    capa.actualizarEscalaElementosGraficos(true);
    return capa.unidadesEstaticas.at(-1);
  }
  capa.mostrarUnidadesEstaticas = false;
  capa.actualizarRepresentacionSimulacion([
    { idTren: 1, nombreLinea: 'Azul', transitable: true, progresoRuta: progreso },
  ]);
  return capa.unidadesSimulacion.get('1');
}

function comprobarDerecho(tren, camara, anguloRuta, contexto) {
  // El metro sigue paralelo a su tramo, pero no queda cabeza abajo en
  // pantalla. En un tramo vertical, techo y ruedas quedan a la misma altura.
  const anguloPantalla = tren.rotation + camara.rotation;
  assert.ok(Math.abs(Math.sin(tren.rotation - anguloRuta)) < 1e-10, `${contexto}: metro fuera del ángulo de la vía`);
  assert.ok(Math.cos(anguloPantalla) >= -1e-10, `${contexto}: metro invertido`);
  const operaciones = tren.list[0].operaciones;
  const techo = operaciones.find(([metodo, x, y]) => metodo === 'fillRect' && x === -17 && y === -9);
  const rueda = operaciones.find(([metodo, x, y]) => metodo === 'fillRect' && x === -13 && y === 8);
  assert.ok(techo && rueda, 'se conserva el dibujo con cuerpo y ruedas');
  assert.ok((rueda[2] - techo[2]) * Math.cos(anguloPantalla) >= -1e-10);
}

function comprobarPosicion(tren, origen, destino, progreso) {
  assert.ok(Math.abs(tren.x - (origen[0] + (destino[0] - origen[0]) * progreso)) < 1e-9);
  assert.ok(Math.abs(tren.y - (origen[1] + (destino[1] - origen[1]) * progreso)) < 1e-9);
}

const recorridos = {
  horizontales: [
    [[100, 200], [700, 200]],
    [[700, 200], [100, 200]],
  ],
  diagonales: [
    [[100, 100], [700, 500]],
    [[700, 500], [100, 100]],
    [[100, 500], [700, 100]],
    [[700, 100], [100, 500]],
    [[400, 100], [400, 500]],
    [[400, 500], [400, 100]],
  ],
};

for (const modo of ['editor', 'simulacion']) {
  for (const [geometria, casos] of Object.entries(recorridos)) {
    test(`${modo}: metro derecho en tramos ${geometria} en ambos sentidos, sin alterar el recorrido`, () => {
      for (const [origen, destino] of casos) {
        const { capa, camara } = preparar(origen, destino);
        const disenoInicial = JSON.stringify(capa.diseno);
        const ruta = capa.obtenerRuta('Azul');
        const anguloInicial = capa.obtenerPuntoEnRuta(ruta, 0.5).angulo;
        let trenAnterior;
        for (const progreso of modo === 'editor' ? [0.5] : [0.25, 0.75, 0.5]) {
          const tren = representar(capa, modo, progreso);
          comprobarDerecho(tren, camara, Math.atan2(destino[1] - origen[1], destino[0] - origen[0]), `${origen} → ${destino}, ${progreso}`);
          comprobarPosicion(tren, origen, destino, progreso);
          if (trenAnterior) assert.equal(tren, trenAnterior, 'la animación conserva el mismo dibujo');
          trenAnterior = tren;
        }
        assert.equal(JSON.stringify(capa.diseno), disenoInicial);
        assert.equal(capa.obtenerPuntoEnRuta(ruta, 0.5).angulo, anguloInicial);
      }
    });
  }

  test(`${modo}: metro derecho al crearlo y girar la cámara sin cambiar zoom ni posición`, () => {
    const origen = [700, 500], destino = [100, 100];
    const anguloRuta = Math.atan2(-400, -600);
    const { capa, camara } = preparar(origen, destino, Math.PI / 6);
    const tren = representar(capa, modo);
    const dibujoInicial = JSON.stringify(tren.list[0].operaciones);
    comprobarDerecho(tren, camara, anguloRuta, 'cámara inicialmente girada');
    for (const rotacion of [Math.PI, -Math.PI / 2, 0, Math.PI / 4]) {
      camara.rotation = rotacion;
      capa.manejadorPostUpdate();
      comprobarDerecho(tren, camara, anguloRuta, `giro a ${rotacion}`);
      comprobarPosicion(tren, origen, destino, 0.5);
      assert.equal(tren.scaleX, 0.5);
      assert.equal(tren.scaleY, 0.5);
      assert.equal(JSON.stringify(tren.list[0].operaciones), dibujoInicial);
    }
  });
}

test('El dibujo acompaña los kilómetros del motor y el reloj, aunque la escala visual de los tramos difiera', async () => {
  const url = codigo => 'data:text/javascript;base64,' + Buffer.from(codigo).toString('base64');
  const fuente = ruta => fs.readFileSync(`${__dirname}/../src/${ruta}`, 'utf8');
  const { default: Motor } = await import(url(fuente('simulacion/MotorSimulacion.js')
    .replace('./EscalaSimulacion.js', url(fuente('simulacion/EscalaSimulacion.js')))
    .replace('../mapa/controles/NombresRed.js', url(fuente('mapa/controles/NombresRed.js')))));
  const { capa } = preparar([100, 200], [200, 200]);
  capa.diseno.estaciones.push({ nombre: 'C', posicionX: 300, posicionY: 200 });
  capa.diseno.tramos[0].distanciaKm = 2;
  capa.diseno.tramos.push({ nombreLinea: 'Azul', estacionA: 'B', estacionB: 'C', distanciaKm: 10 });
  Object.assign(capa.diseno.unidadesMetro[0], { velocidadPromedio: 4, duracionUt: 3 });
  const motor = new Motor(capa.diseno);
  motor.iniciar({ duracion: 3, ahora: 0 });
  capa.mostrarUnidadesEstaticas = false;
  function comprobar(estado, horas, x) {
    assert.equal(estado.tiempoTranscurrido, horas);
    assert.equal(estado.unidades[0].distanciaRecorridaKm, horas * 4);
    capa.actualizarRepresentacionSimulacion(estado.unidades);
    assert.ok(Math.abs(capa.unidadesSimulacion.get('1').x - x) < 1e-9,
      `A las ${horas} UT el tren debe estar en x=${x}, está en ${capa.unidadesSimulacion.get('1').x}`);
  }
  comprobar(motor.actualizar(1500), .5, 200);
  comprobar(motor.pausar(3000), 1, 220);
  comprobar(motor.actualizar(12000), 1, 220);
  motor.reanudar(12000);
  comprobar(motor.actualizar(15000), 2, 260);
  const fin = motor.actualizar(18000);
  comprobar(fin, 3, 300);
  assert.equal(fin.estado, 'FINALIZADA');
  comprobar(motor.reiniciar(20000), 0, 100);
});
