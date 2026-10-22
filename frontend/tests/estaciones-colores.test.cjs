const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');

for (const modo of ['NIVEL', 'EDICION_LIBRE']) {
  test(`${modo}: estaciones conservan el color de su vía y distinguen una conexión compartida`, async t => {
    const navegador = await abrirNavegador();
    t.after(() => navegador.close());
    const v = await abrirEditor(navegador, { modo, primeraPasada: false });
    t.after(() => v.contexto.close());
    const p = v.pagina;
    if (modo === 'EDICION_LIBRE') await p.getByRole('button', { name: 'Ir a construir', exact: true }).click();
    const resultado = await p.evaluate(async () => {
      const { PALETA_RED } = await import('/src/mapa/configuracion/PaletaRed.js');
      const capa = editorPrueba.capaRedMetro;
      const observar = nombre => {
        const colores = [], poligonos = [];
        const linea = capa.grafico.lineStyle, poligono = capa.grafico.strokePoints;
        capa.grafico.lineStyle = function (ancho, color, ...resto) {
          colores.push(color); return linea.call(this, ancho, color, ...resto);
        };
        capa.grafico.strokePoints = function (puntos, ...resto) {
          poligonos.push(puntos.length); return poligono.call(this, puntos, ...resto);
        };
        capa.dibujarEstacion(capa.diseno.estaciones.find(e => e.nombre === nombre), 0);
        capa.grafico.lineStyle = linea; capa.grafico.strokePoints = poligono;
        return { colores, poligonos };
      };
      const azul = capa.colorLinea('Azul');
      const normal = observar('Centro'), aislada = observar('Este');
      capa.estacionesSeleccionadas = ['Centro'];
      const seleccionada = observar('Centro');
      capa.estacionesSeleccionadas = [];
      const diseno = structuredClone(capa.diseno);
      diseno.lineas.push({ nombre: 'Otra' });
      diseno.tramos.push({ nombreLinea: 'Otra', estacionA: 'Parque', estacionB: 'Este' });
      capa.establecerDiseno(diseno);
      const compartida = observar('Parque'), segunda = observar('Este');
      const otroColor = capa.colorLinea('Otra');
      diseno.tramos.pop();
      capa.establecerDiseno(diseno);
      const desconectada = observar('Parque');
      return { azul, otroColor, neutral: PALETA_RED.estaciones.normal,
        normal, aislada, seleccionada, compartida, segunda, desconectada };
    });
    assert.ok(resultado.normal.colores.includes(resultado.azul), 'La estación usa el color real del tramo');
    assert.ok(resultado.seleccionada.colores.includes(resultado.azul), 'Seleccionar no borra el color de su línea');
    assert.ok(resultado.aislada.colores.includes(resultado.neutral), 'Una estación sin línea queda neutra');
    assert.ok(resultado.segunda.colores.includes(resultado.otroColor), 'La segunda línea no hereda el primer color');
    assert.deepEqual(resultado.normal.poligonos, []);
    assert.ok(resultado.compartida.poligonos.includes(8), 'La estación compartida se distingue por un contorno octagonal');
    assert.deepEqual(resultado.desconectada.poligonos, [], 'Quitar la conexión recupera la forma de estación simple');
    await p.evaluate(() => {
      const capa = editorPrueba.capaRedMetro, diseno = structuredClone(capa.diseno);
      diseno.tramos.push({ nombreLinea: 'Otra', estacionA: 'Parque', estacionB: 'Este' });
      capa.establecerDiseno(diseno);
      const centro = capa.convertirPosicion(700, 470);
      capa.escena.cameras.main.setZoom(2).centerOn(centro.x, centro.y);
    });
    await p.screenshot({ path: `/tmp/metronet-estaciones-colores-${modo}.png` });
    assert.deepEqual(v.errores, []);
  });
}

for (const modo of ['NIVEL', 'EDICION_LIBRE']) test(`${modo}: el cruce visual gira y escala sin modificar la red, también en simulación`, async t => {
  const navegador = await abrirNavegador();
  t.after(() => navegador.close());
  const v = await abrirEditor(navegador, { modo, primeraPasada: false,
    estaciones: [
      { nombre: 'Centro', posicionX: 600, posicionY: 430 }, { nombre: 'Parque', posicionX: 800, posicionY: 500 },
      { nombre: 'Oeste', posicionX: 600, posicionY: 500 }, { nombre: 'Este', posicionX: 800, posicionY: 430 },
    ],
    lineas: [{ nombre: 'Azul' }, { nombre: 'Roja' }],
    tramos: [{ nombreLinea: 'Azul', estacionA: 'Centro', estacionB: 'Parque' },
      { nombreLinea: 'Roja', estacionA: 'Oeste', estacionB: 'Este' }],
  });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  if (modo === 'EDICION_LIBRE') await p.getByRole('button', { name: 'Ir a construir', exact: true }).click();
  const original = JSON.stringify(v.diseno);
  const marcas = await p.evaluate(() => {
    const capa = editorPrueba.capaRedMetro;
    const centro = capa.convertirPosicion(700, 465);
    capa.escena.cameras.main.setZoom(2).setRotation(Math.PI / 4);
    capa.actualizarEscalaElementosGraficos(true);
    const marca = capa.marcadoresCruces[0];
    const resultado = { cantidad: capa.marcadoresCruces.length, error: Math.hypot(marca.x - centro.x, marca.y - centro.y),
      escala: marca.scaleX, interactivo: Boolean(marca.input), compartidas: capa.diseno.estaciones.filter(e => capa.esTransbordo(e)).length };
    capa.dibujar();
    resultado.destruida = !marca.scene;
    resultado.trasRedibujar = capa.marcadoresCruces.length;
    return resultado;
  });
  assert.deepEqual(marcas, { cantidad: 1, error: 0, escala: .5, interactivo: false, compartidas: 0, destruida: true, trasRedibujar: 1 });
  assert.equal(JSON.stringify(v.diseno), original, 'El rombo no guarda ni crea datos');
  await p.route('**/src/simulacion/EscenaSimulacion.js*', async ruta => {
    const respuesta = await ruta.fetch();
    await ruta.fulfill({ response: respuesta, body: (await respuesta.text()).replace(
      'resolver({ escena: this, destruir });', 'window.escenaPrueba = this; resolver({ escena: this, destruir });') });
  });
  v.diseno.preparadoParaSimular = true;
  v.diseno.simulacion.estado = 'VALIDADO';
  await p.goto(new URL('/simulacion.html?idDiseno=77', p.url()).href);
  await p.waitForFunction(() => window.escenaPrueba?.capaRedMetro?.marcadoresCruces.length === 1);
  assert.deepEqual(await p.evaluate(() => ({ estaciones: escenaPrueba.capaRedMetro.diseno.estaciones.length,
    tramos: escenaPrueba.capaRedMetro.diseno.tramos.length })), { estaciones: 4, tramos: 2 });
  assert.deepEqual(v.errores, []);
});
