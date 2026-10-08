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

function prepararSimulacion() {
  const ventana = new EventTarget();
  const consulta = diferida();
  const mensajes = [], navegaciones = [];
  const contexto = {
    window: ventana, AbortController, paginaActiva: true,
    ejecucionPendiente: {idDiseno:55, resultado:{idSimulacion:1}},
    disenoActual: {simulacion:{idDiseno:55,idEscenario:1}},
    escenariosGlosario: [{idEscenario:1,numero:1}], consignaActual:{estadoGlobal:'LISTO'},
    resultadoEnCurso:false, estadoMotor:{}, tutorialSimulacion:null,
    actualizarControlesSimulacion() {}, cargarConsignaReal:()=>consulta.promesa,
    actualizarDesempeno:async()=>{}, document:{getElementById:()=>({hidden:true})},
    mostrarMensaje:mensaje=>mensajes.push(mensaje),
    presentarResultadoNivel:()=>navegaciones.push('victoria'),
  };
  const finalizar=vm.runInNewContext(`${metodoSimulacion}; finalizarEjecucionVisible`,contexto);
  return {finalizar,ventana,contexto,mensajes,navegaciones,continuar:consulta.resolver};
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

test('Simulación: Atrás durante la consulta no muestra resultado ni navega',async()=>{
 const c=prepararSimulacion(), fin=c.finalizar();
 c.ventana.dispatchEvent(new Event('popstate'));c.continuar();await fin;
 assert.deepEqual(c.mensajes,[]);assert.deepEqual(c.navegaciones,[]);
 assert.equal(c.contexto.resultadoEnCurso,false);
});
test('Simulación: cambiar de diseño descarta la respuesta tardía',async()=>{
 const c=prepararSimulacion(), fin=c.finalizar();c.contexto.disenoActual.simulacion.idDiseno=99;
 c.continuar();await fin;assert.deepEqual(c.mensajes,[]);
});
test('Simulación: consulta resultados una vez y pide Finalizar red sin victoria automática',async()=>{
 const c=prepararSimulacion(),fin=c.finalizar();await c.finalizar();c.continuar();await fin;
 assert.equal(c.mensajes.length,1);assert.match(c.mensajes[0],/Finalizar red/);
 assert.deepEqual(c.navegaciones,[]);assert.equal(c.contexto.disenoActual.simulacion.estado,undefined);
});
