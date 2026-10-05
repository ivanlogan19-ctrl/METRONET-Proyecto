const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Elemento {
  constructor() {
    this.children = [];
    this.textContent = '';
    this.hidden = false;
    this.classList = { toggle() {}, remove() {} };
  }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute() {}
  addEventListener() {}
}

test('un fallo de trofeos conserva Ranking y su reintento recupera solo premios', async () => {
  const elementos = new Map();
  const documento = {
    getElementById(id) {
      if (!elementos.has(id)) elementos.set(id, new Elemento());
      return elementos.get(id);
    },
    createElement() { return new Elemento(); },
  };
  let fallaTrofeos = true;
  const llamadas = [];
  const trofeos = ['corona', 'biblioteca', 'copa', 'estacion', 'camino']
    .map(id => ({ id, nombre: id, requisito: 'Requisito', motivo: 'Logro', obtenido: id === 'estacion' }));
  const consultarJuego = ruta => {
    llamadas.push(ruta);
    if (ruta === '/trofeos') return fallaTrofeos ? Promise.reject(new Error('Servicio de premios caído')) : Promise.resolve(trofeos);
    if (ruta === '/ranking') return Promise.resolve({ jugadores: [{ posicion: 1, jugador: 'Jugador 17', puntajeTotal: 100, nivelesCompletados: 1, sosVos: true }], puntajeTotal: 100, puntajeMaximo: 1000, tuPosicion: 1 });
    return Promise.resolve({ escenarios: [{ numero: 1, nombre: 'Nivel 1', mejorPuntaje: 100, puntajeMaximo: 100 }], nivelesCompletados: 1, cantidadNiveles: 10 });
  };
  const origen = fs.readFileSync(path.join(__dirname, '../src/educacion/ranking.js'), 'utf8');
  const arte = fs.readFileSync(path.join(__dirname, '../src/educacion/IconosTrofeos.js'), 'utf8');
  const codigo = origen.replace(/^import .*;\s*$/gm, '').replace('if (sesion) {', 'if (false) {');
  const contexto = vm.createContext({ document: documento, consultarJuego,
    requerirSesion: () => ({ usuario: { rol: 'JUGADOR' } }), inicializarNavegacion() {} });
  vm.runInContext(arte.replace('export const iconosTrofeos', 'var iconosTrofeos'), contexto);
  vm.runInContext(codigo, contexto);

  await Promise.all([contexto.cargar(), contexto.cargarTrofeos()]);
  assert.equal(documento.getElementById('clasificacionRanking').children.length, 1);
  assert.equal(documento.getElementById('estadoRanking').hidden, true);
  assert.equal(documento.getElementById('reintentarRanking').hidden, true);
  assert.match(documento.getElementById('resumenTrofeos').textContent, /No fue posible/);
  assert.equal(documento.getElementById('reintentarTrofeos').hidden, false);

  fallaTrofeos = false;
  await contexto.cargarTrofeos();
  assert.equal(documento.getElementById('galeriaTrofeos').children.length, 5);
  assert.equal(documento.getElementById('resumenTrofeos').textContent, '1 de 5 trofeos obtenidos');
  assert.equal(documento.getElementById('reintentarTrofeos').hidden, true);
  assert.equal(documento.getElementById('clasificacionRanking').children.length, 1);
  assert.equal(llamadas.filter(ruta => ruta === '/ranking').length, 1);
});
