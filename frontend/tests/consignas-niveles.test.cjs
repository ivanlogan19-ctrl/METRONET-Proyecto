const { test } = require('node:test');
const assert = require('node:assert/strict');
const niveles = require('../src/educacion/niveles.json');

test('los diez niveles solo piden elementos y prácticas con herramientas habilitadas', () => {
  assert.deepEqual(niveles.map(nivel => nivel.numero), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const herramientasPorRegla = {
    minimoEstaciones: 'estaciones', minimoLineas: 'lineas', minimoTramos: 'conexiones',
    minimoMetros: 'metros', requiereSimulacion: 'simulacion',
    requiereCoberturaPuntosInteres: 'estaciones', requiereObjetivosMismaLinea: 'lineas',
    minimoTransbordos: 'lineas', aprendizajeSimulacion: 'simulacion',
  };
  for (const nivel of niveles) {
    const { reglasExito: reglas, herramientasHabilitadas: herramientas } = nivel;
    for (const [clave, herramienta] of Object.entries(herramientasPorRegla)) {
      if (reglas[clave]) assert.equal(herramientas[herramienta], true, `Nivel ${nivel.numero}: ${clave} requiere ${herramienta}`);
    }
    if (reglas.maximoEstaciones) assert.ok(reglas.maximoEstaciones >= reglas.minimoEstaciones);
    if (reglas.minimoTransbordos) {
      assert.ok(reglas.minimoLineas >= 2);
      assert.equal(reglas.transbordosPorConexion, true);
      assert.equal(herramientas.conexiones, true);
      assert.match(nivel.instrucciones, /estaci[oó]n(?:es)? compartida|transbordos/i);
      assert.doesNotMatch(nivel.instrucciones, /Permite transbordo|marc[aá] como transbordo/i);
    }
    if (reglas.requiereCoberturaPuntosInteres) assert.ok(reglas.puntosInteresObjetivo.length > 0);
    assert.ok(nivel.objetivo && nivel.instrucciones, `Nivel ${nivel.numero}: textos de consigna`);
  }
});

test('los desafíos de comparación indican la selección y el cambio que evalúa el servidor', () => {
  assert.equal(niveles[6].reglasExito.aprendizajeSimulacion.individual, true);
  for (const numero of [8, 10]) {
    const nivel = niveles[numero - 1];
    assert.equal(nivel.reglasExito.aprendizajeSimulacion.global, true);
    assert.match(nivel.instrucciones, /UV/);
  }
  assert.match(niveles[9].instrucciones, /UV y UT/);
  assert.equal(niveles[9].reglasExito.aprendizajeSimulacion.combinacion, true);
  assert.equal(niveles[8].reglasExito.aprendizajeSimulacion.combinacion, true);
});

test('la dificultad incorpora herramientas y criterios sin retroceder en el recorrido', () => {
  assert.ok(niveles.every(nivel => !('requiereRedValida' in nivel.reglasExito)));
  for (const [indice, maximo] of [3,4,4,4,5,6,7,9].entries()) {
    const nivel = niveles[indice];
    assert.equal(nivel.reglasExito.maximoEstaciones,maximo);
    assert.match(nivel.objetivo,new RegExp(`\\b${maximo} estaciones`));
    assert.match(nivel.instrucciones,new RegExp(`No superes ${maximo} estaciones`));
  }
  for (const [numero, minimo] of [[9,7],[10,9]]) {
    const nivel = niveles[numero-1];
    assert.equal(nivel.reglasExito.minimoTramos,minimo);
    assert.match(nivel.objetivo,new RegExp(`Creá al menos ${minimo} conexiones`));
    assert.match(nivel.instrucciones,new RegExp(`Construí al menos ${minimo} conexiones`));
  }
  assert.match(niveles[2].instrucciones, /línea continua/);
  for (let indice = 1; indice < niveles.length; indice++) {
    const anterior = niveles[indice - 1], actual = niveles[indice];
    for (const [herramienta, habilitada] of Object.entries(anterior.herramientasHabilitadas)) {
      if (habilitada) assert.equal(actual.herramientasHabilitadas[herramienta], true,
        `Nivel ${actual.numero}: la herramienta ${herramienta} ya estaba introducida`);
    }
    for (const regla of ['minimoEstaciones', 'minimoTransbordos']) {
      assert.ok((actual.reglasExito[regla] ?? 0) >= (anterior.reglasExito[regla] ?? 0),
        `Nivel ${actual.numero}: ${regla} no retrocede`);
    }
    const radioAnterior = anterior.reglasExito.puntosInteresObjetivo?.[0]?.radioCobertura;
    const radioActual = actual.reglasExito.puntosInteresObjetivo?.[0]?.radioCobertura;
    if (indice >= 5 && radioAnterior && radioActual) assert.ok(radioActual <= radioAnterior);
  }
});
