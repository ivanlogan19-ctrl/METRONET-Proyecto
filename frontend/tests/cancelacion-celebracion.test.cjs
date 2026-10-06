const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const codigoEditor = fs.readFileSync(path.join(__dirname, '../src/mapa/controles/EditorRedMetro.js'), 'utf8');
const metodoEditor = codigoEditor.slice(codigoEditor.indexOf('  async evaluarEscenarioGuardado('), codigoEditor.indexOf('  async irASimulacion('));
const codigoSimulacion = fs.readFileSync(path.join(__dirname, '../src/simulacion/simulacion.js'), 'utf8');
const metodoSimulacion = codigoSimulacion.slice(codigoSimulacion.indexOf('async function finalizarEjecucionVisible()'), codigoSimulacion.indexOf('function actualizarMantenimiento()'));
const evaluacion = { completado: true, mensaje: 'Nivel completado', trofeosNuevos: [
  { id: 'corona', obtenido: true }, { id: 'biblioteca', obtenido: true }, { id: 'copa', obtenido: true },
] };
const accion = { siguiente: { idEscenario: 2, estado: 'DISPONIBLE' } };

function diferida() {
  let resolver;
  const promesa = new Promise(resolve => { resolver = resolve; });
  return { promesa, resolver };
}

function prepararEditor({ destino = accion, pausarPremios = false } = {}) {
  const ventana = new EventTarget();
  const navegaciones = [];
  ventana.location = { assign: ruta => navegaciones.push(ruta) };
  const inicioPremios = diferida();
  const finPremios = diferida();
  let evaluarLlamadas = 0;
  const contexto = { window: ventana, AbortController, consultarEstadoAnterior: async () => ({}),
    presentarResultadoNivel: async () => destino,
    celebrarTrofeosNuevos: (premios, { signal }) => {
      if (!premios.length) return Promise.resolve();
      assert.equal(premios.length, 3);
      inicioPremios.resolver(signal);
      return pausarPremios ? Promise.race([finPremios.promesa,
        new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))]) : Promise.resolve();
    },
  };
  const Clase = vm.runInNewContext(`class BajoPrueba { ${metodoEditor} } BajoPrueba`, contexto);
  const editor = new Clase();
  editor.disenoActual = { simulacion: { idDiseno: 55, idEscenario: 1 } };
  editor.idDiseno = () => editor.disenoActual.simulacion.idDiseno;
  editor.solicitarJuego = async ruta => {
    if (ruta.endsWith('/evaluar')) { evaluarLlamadas++; return evaluacion; }
    return { escenarios: [] };
  };
  editor.cargarJuego = async () => {};
  editor.abrirDiseno = async () => {};
  editor.mostrarMensaje = () => {};
  editor.abrirEscenario = async (...args) => { navegaciones.push(args); };
  return { editor, ventana, navegaciones, inicioPremios: inicioPremios.promesa,
    continuar: finPremios.resolver, evaluaciones: () => evaluarLlamadas };
}

function prepararSimulacion({ destino = accion, pausarPremios = false } = {}) {
  const ventana = new EventTarget();
  const navegaciones = [];
  ventana.location = { protocol: 'http:', hostname: '127.0.0.1', assign: ruta => navegaciones.push(ruta) };
  const inicioPremios = diferida();
  const finPremios = diferida();
  const botones = new Map();
  let inicios = 0;
  const contexto = {
    window: ventana, AbortController, sesion: { token: 'ficticio' },
    ejecucionPendiente: { idDiseno: 55, resultado: { puntaje: 100, idSimulacion: 1 } },
    disenoActual: { simulacion: { idDiseno: 55, idEscenario: 1 }, resultados: [] },
    resultadoEnCurso: false, estadoMotor: {}, tutorialSimulacion: null, actualizarControlesSimulacion() {},
    consultarEstadoAnterior: async () => ({}), evaluarEscenarioProgresivo: async () => evaluacion,
    actualizarPantalla() {}, cargarConsignaReal: async () => {}, actualizarDesempeno: async () => {},
    document: { getElementById(id) { if (!botones.has(id)) botones.set(id, { hidden: true }); return botones.get(id); } },
    mostrarMensaje() {}, fetch: async () => ({ ok: true, json: async () => ({ escenarios: [] }) }),
    presentarResultadoNivel: async () => destino,
    celebrarTrofeosNuevos: (premios, { signal }) => {
      if (!premios.length) return Promise.resolve();
      assert.equal(premios.length, 3);
      inicioPremios.resolver(signal);
      return pausarPremios ? Promise.race([finPremios.promesa,
        new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))]) : Promise.resolve();
    },
    iniciarNivelConTransicion: async () => { inicios++; return { idDiseno: 56 }; },
    registrarEntradaRecorrido() {}, establecerContextoEnRuta: () => '/siguiente',
  };
  const finalizar = vm.runInNewContext(`${metodoSimulacion}; finalizarEjecucionVisible`, contexto);
  return { finalizar, ventana, navegaciones, inicioPremios: inicioPremios.promesa,
    continuar: finPremios.resolver,
    cambiarDiseno: id => { contexto.disenoActual.simulacion.idDiseno = id; }, inicios: () => inicios };
}

test('Editor: Atrás durante el trofeo no inicia el siguiente nivel', async () => {
  const caso = prepararEditor({ pausarPremios: true });
  const terminado = caso.editor.evaluarEscenarioGuardado(55);
  await caso.inicioPremios;
  caso.ventana.dispatchEvent(new Event('popstate'));
  await terminado;
  assert.deepEqual(caso.navegaciones, []);
  assert.equal(caso.evaluaciones(), 1);
});

test('Editor: otra navegación durante el trofeo no es reemplazada', async () => {
  const caso = prepararEditor();
  const terminado = caso.editor.evaluarEscenarioGuardado(55);
  await caso.inicioPremios;
  caso.editor.disenoActual.simulacion.idDiseno = 99;
  await terminado;
  assert.deepEqual(caso.navegaciones, []);
});

test('Editor: varios premios continúan una sola vez y doble clic no reevalúa', async () => {
  const caso = prepararEditor({ pausarPremios: true });
  const terminado = caso.editor.evaluarEscenarioGuardado(55);
  await caso.inicioPremios;
  await caso.editor.evaluarEscenarioGuardado(55);
  assert.equal(caso.evaluaciones(), 1);
  caso.continuar();
  await terminado;
  assert.equal(caso.navegaciones.length, 1);
});

test('Simulación: Atrás durante el trofeo no inicia ni navega', async () => {
  const caso = prepararSimulacion({ pausarPremios: true });
  const terminado = caso.finalizar();
  await caso.inicioPremios;
  caso.ventana.dispatchEvent(new Event('popstate'));
  await terminado;
  assert.equal(caso.inicios(), 0);
  assert.deepEqual(caso.navegaciones, []);
});

test('Simulación: cambiar de diseño durante el trofeo no pisa la navegación nueva', async () => {
  const caso = prepararSimulacion();
  const terminado = caso.finalizar();
  await caso.inicioPremios;
  caso.cambiarDiseno(99);
  await terminado;
  assert.equal(caso.inicios(), 0);
  assert.deepEqual(caso.navegaciones, []);
});

test('Simulación: varios premios permiten continuar una sola vez', async () => {
  const caso = prepararSimulacion();
  await caso.finalizar();
  assert.equal(caso.inicios(), 1);
  assert.deepEqual(caso.navegaciones, ['/siguiente']);
});

test('Simulación: cancelar un premio también impide destino alternativo', async () => {
  const caso = prepararSimulacion({ destino: { destino: '/escenarios.html' }, pausarPremios: true });
  const terminado = caso.finalizar();
  await caso.inicioPremios;
  caso.ventana.dispatchEvent(new Event('popstate'));
  await terminado;
  assert.deepEqual(caso.navegaciones, []);
});
