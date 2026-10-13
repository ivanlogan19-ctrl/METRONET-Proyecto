import test from 'node:test';
import assert from 'node:assert/strict';
import { objetivosCompactos } from '../src/mapa/ObjetivosCompactos.mjs';

test('reúne metas territoriales y pruebas sin declarar cumplido un grupo incompleto', () => {
  const base = [
    { clave: 'minimoEstaciones', texto: 'Ubicar 10 estaciones', completado: true },
    { clave: 'areaObjetivo:0', texto: 'Estación en AGUADA', completado: true },
    { clave: 'areaObjetivo:1', texto: 'Estación en CERRITO', completado: false },
    { clave: 'aprendizajeSimulacion:individual', texto: 'Cambiar solo un metro', completado: true },
    { clave: 'aprendizajeSimulacion:combinacion', texto: 'Cambiar UV y UT', completado: false },
  ];
  const compacto = objetivosCompactos(base, 10);
  assert.equal(compacto.length, 3);
  assert.deepEqual(compacto.map(({ actual, requerido, completado }) => [actual, requerido, completado]).slice(1),
    [[1, 2, false], [1, 2, false]]);
  assert.match(compacto[1].detalle, /AGUADA[\s\S]*CERRITO/);
  assert.match(compacto[2].detalle, /solo un metro[\s\S]*UV y UT/);
  assert.strictEqual(objetivosCompactos(base, 4), base);
});

test('N5–N10 conservan las condiciones vigentes sin conectividad global', () => {
  const condicion = (clave, texto = clave, requerido = 1, completado = true) =>
    ({ clave, texto, requerido, completado });
  for (const nivel of [5, 6, 7, 8, 9, 10]) {
    const base = [
      condicion('minimoEstaciones', `${nivel >= 9 ? 8 : nivel === 5 ? 4 : 6} estaciones`, nivel >= 9 ? 8 : 6),
      ...(nivel >= 7 ? [condicion('minimoLineas', `${nivel >= 8 ? 3 : 2} líneas`, nivel >= 8 ? 3 : 2)] : []),
      condicion('minimoMetros', 'Metros asignados'),
      condicion('requiereGeografiaValida', 'Red dentro del territorio permitido'),
      condicion('areaObjetivo:0', 'Estación en ZONA ESTE', 1, false),
      condicion('requiereObjetivosMismaLinea', 'POI en una misma línea continua'),
      ...(nivel >= 7 ? [condicion('minimoTransbordos', `${nivel >= 8 ? 2 : 1} transbordos`, nivel >= 8 ? 2 : 1)] : []),
      ...(nivel >= 9 ? [condicion('maximoEstaciones', 'Máximo 9 estaciones', 9)] : []),
      ...((nivel === 6 || nivel === 10)
        ? [condicion('aprendizajeSimulacion:velocidad', 'Cambiar UV'), condicion('aprendizajeSimulacion:duracion', 'Cambiar UT')]
        : [condicion('aprendizajeSimulacion:individual', 'Cambiar UV de un metro')]),
      condicion('criterioUvUt', 'Criterio UV/UT'),
    ];
    const visibles = objetivosCompactos(base, nivel);
    assert.equal(visibles.length, nivel <= 6 ? 6 : 7, `N${nivel}`);
    assert.equal(visibles.find(({ clave }) => clave === 'coberturaAgrupada').completado, false);
    assert.ok(visibles.every(({ clave }) => clave !== 'requiereRedValida'));
    const clavesExpandidas = visibles.flatMap(({ clave, detalle }) => detalle
      ? base.filter(({ texto }) => detalle.split('\n').includes(texto)).map(({ clave: original }) => original)
      : [clave]);
    assert.deepEqual(new Set(clavesExpandidas), new Set(base.map(({ clave }) => clave)), `N${nivel}: ninguna condición oculta`);
  }
});

test('Cada nivel agrupa cinco metas y ninguna estrella se adelanta al cumplimiento de sus requisitos',()=>{
  const bases=['minimoEstaciones','minimoLineas','minimoTramos','minimoMetros','simulacionActual'];
  for(let n=1;n<=10;n++) {
    const claves=[...bases,...(n>=5?['requiereObjetivosMismaLinea']:[]),...(n>=7?['minimoTransbordos','requiereMetroPorLinea']:[]),...(n===8?['areaObjetivo:0']:[]),...(n===10?['aprendizajeSimulacion:global','aprendizajeSimulacion:individual','aprendizajeSimulacion:combinacion']:[])];
    const condiciones=claves.map(clave=>({clave,texto:clave,actual:1,requerido:1,completado:true}));
    assert.equal(objetivosCompactos(condiciones,n).length,5);
    assert.ok(objetivosCompactos(condiciones,n).every(c=>c.completado));
    for(const clave of claves){
      const faltante=condiciones.map(c=>({...c,completado:c.clave!==clave}));
      const visibles=objetivosCompactos(faltante,n);
      assert.equal(visibles.length,5);
      assert.equal(visibles.filter(c=>!c.completado).length,1,`N${n}: ${clave}`);
    }
  }
});
