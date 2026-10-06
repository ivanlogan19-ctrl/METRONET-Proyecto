const { test } = require('node:test');
const assert = require('node:assert/strict');
const niveles = require('../src/educacion/niveles.json');

test('los diez niveles solo piden elementos y prácticas con herramientas habilitadas', () => {
  assert.deepEqual(niveles.map(nivel => nivel.numero), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const herramientasPorRegla = {
    minimoEstaciones: 'estaciones', minimoLineas: 'lineas', minimoTramos: 'conexiones',
    minimoMetros: 'metros', requiereSimulacion: 'simulacion',
    requiereCoberturaPuntosInteres: 'estaciones', requiereObjetivosMismaLinea: 'conexiones',
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
      assert.match(nivel.instrucciones, /Conectá|Hacé que/);
      assert.doesNotMatch(nivel.instrucciones, /Permite transbordo|marc[aá] como transbordo/i);
    }
    if (reglas.requiereCoberturaPuntosInteres) assert.ok(reglas.puntosInteresObjetivo.length > 0);
    assert.ok(nivel.objetivo && nivel.instrucciones, `Nivel ${nivel.numero}: textos de consigna`);
  }
});

test('los desafíos de comparación indican la selección y el cambio que evalúa el servidor', () => {
  for (const numero of [8, 10]) {
    const nivel = niveles[numero - 1];
    assert.equal(nivel.reglasExito.aprendizajeSimulacion.individual, true);
    assert.equal(nivel.reglasExito.aprendizajeSimulacion.global, true);
    assert.match(nivel.instrucciones, /Todos los metros/);
    assert.match(nivel.instrucciones, /una misma UV nueva/);
    assert.match(nivel.instrucciones, /a todos los metros/);
    assert.match(nivel.instrucciones, /mismas horas/);
  }
  assert.match(niveles[9].instrucciones, /Por último cambiá UV y horas y ejecutá otra vez/);
  assert.equal(niveles[9].reglasExito.aprendizajeSimulacion.combinacion, true);
});

test('la dificultad incorpora herramientas y criterios sin retroceder en el recorrido', () => {
  assert.equal(niveles[2].reglasExito.requiereRedValida, true);
  assert.match(niveles[2].instrucciones, /sin estaciones aisladas/);
  for (let indice = 1; indice < niveles.length; indice++) {
    const anterior = niveles[indice - 1], actual = niveles[indice];
    for (const [herramienta, habilitada] of Object.entries(anterior.herramientasHabilitadas)) {
      if (habilitada) assert.equal(actual.herramientasHabilitadas[herramienta], true,
        `Nivel ${actual.numero}: la herramienta ${herramienta} ya estaba introducida`);
    }
    for (const regla of ['minimoEstaciones', 'minimoLineas', 'minimoTramos', 'minimoMetros', 'minimoTransbordos']) {
      assert.ok((actual.reglasExito[regla] ?? 0) >= (anterior.reglasExito[regla] ?? 0),
        `Nivel ${actual.numero}: ${regla} no retrocede`);
    }
    const radioAnterior = anterior.reglasExito.puntosInteresObjetivo?.[0]?.radioCobertura;
    const radioActual = actual.reglasExito.puntosInteresObjetivo?.[0]?.radioCobertura;
    if (radioAnterior && radioActual) assert.ok(radioActual <= radioAnterior);
  }
});
