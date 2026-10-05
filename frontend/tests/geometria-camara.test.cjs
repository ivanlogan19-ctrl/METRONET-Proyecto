const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ruta = `${__dirname}/../src/mapa/controles/ControlZoom.js`;
const codigo = fs.readFileSync(ruta, 'utf8')
  .replace(/^import .*;\s*/m, '')
  .replace('export default class ControlZoom', 'class ControlZoom');
const modulo = { exports: null };
vm.runInNewContext(`${codigo}\nmodule.exports = ControlZoom;`, { module: modulo, document: {} });
const ControlZoom = modulo.exports;

function preparar(rotacion = Math.PI / 4) {
  const camara = {
    x: 0, y: 0, width: 800, height: 600, originX: .5, originY: .5,
    zoom: 2, rotation: rotacion, scrollX: 100, scrollY: 200,
    setZoom(valor) { this.zoom = valor; },
    setRotation(valor) { this.rotation = valor; },
    removeBounds() {},
  };
  const escena = { cameras: { main: camara }, scale: { width: 800, height: 600 } };
  return { camara, control: new ControlZoom(escena) };
}

function mundoBajoCursor(camara, x, y) {
  const dx = x - camara.width / 2;
  const dy = y - camara.height / 2;
  const cos = Math.cos(camara.rotation), sin = Math.sin(camara.rotation);
  return {
    x: camara.scrollX + camara.width / 2 + (dx * cos + dy * sin) / camara.zoom,
    y: camara.scrollY + camara.height / 2 + (dy * cos - dx * sin) / camara.zoom,
  };
}

test('el zoom conserva el punto bajo el cursor con el mapa girado', () => {
  const { camara, control } = preparar();
  const antes = mundoBajoCursor(camara, 610, 350);
  control.establecerZoomEnPunto(4, 610, 350);
  const despues = mundoBajoCursor(camara, 610, 350);
  assert.ok(Math.abs(antes.x - despues.x) < 1e-9);
  assert.ok(Math.abs(antes.y - despues.y) < 1e-9);
});

test('el arrastre horizontal desplaza la cámara según el giro', () => {
  const { camara, control } = preparar(Math.PI / 2);
  control.arrastre = { id: 1, x: 100, y: 100 };
  control.permitirPan = () => true;
  control.punteros.set(1, { x: 120, y: 100, tactil: false });
  control.procesarPunteroMovido({ id: 1, x: 120, y: 100, event: {} });
  assert.ok(Math.abs(camara.scrollX - 100) < 1e-9);
  assert.ok(Math.abs(camara.scrollY - 210) < 1e-9);
});

test('el encuadre reduce zoom cuando el rectángulo gira', () => {
  const { camara, control } = preparar(0);
  control.normalizar = valor => valor;
  const area = { minimoX: 0, maximoX: 400, minimoY: 0, maximoY: 200 };
  const recto = control.obtenerZoomAjustado(area, { margen: 40 });
  camara.rotation = Math.PI / 4;
  const girado = control.obtenerZoomAjustado(area, { margen: 40 });
  assert.ok(girado < recto);
});

test('los límites contienen el centro de cámara con rotación', () => {
  const { camara, control } = preparar(Math.PI / 4);
  control.limitesCamara = { minimoX: 0, maximoX: 2000, minimoY: 0, maximoY: 1800 };
  camara.scrollX = 10000;
  camara.scrollY = -10000;
  control.restringirCamara();
  const medioAncho = (800 * Math.SQRT1_2 + 600 * Math.SQRT1_2) / 4;
  const medioAlto = medioAncho;
  assert.ok(camara.scrollX + 400 <= 2000 - medioAncho + 1e-9);
  assert.ok(camara.scrollY + 300 >= medioAlto - 1e-9);
});

test('el encuadre despeja los mandos interiores sin cambiar el zoom', () => {
  const camara = { width: 400, height: 300, zoom: 1, rotation: 0,
    midPoint: { x: 200, y: 150 },
    centerOn(x, y) { this.midPoint = { x, y }; } };
  const escena = { cameras: { main: camara },
    contenedorMapa: { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) } };
  const control = new ControlZoom(escena);
  control.panelMapa = { getBoundingClientRect: () => ({ left: 270, top: 170, right: 398, bottom: 298 }) };
  control.restringirCamara = () => {};
  control.despejarMandosDeRed({ minimoX: 100, maximoX: 320, minimoY: 100, maximoY: 260 });
  assert.equal(camara.zoom, 1);
  assert.equal(camara.midPoint.x, 280);
  assert.equal(camara.midPoint.y, 150);
});
