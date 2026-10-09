import test from 'node:test';
import assert from 'node:assert/strict';
import { esAvisoRutinarioEditor, resumirAdvertenciaEditor } from '../src/mapa/controles/AvisosEditor.mjs';

test('oculta los avisos rutinarios y mantiene fallos reales', () => {
  for (const [texto, tipo] of [
    ['Diseño guardado. La red todavía está en construcción: Cada línea debe tener dos estaciones.', 'info'],
    ['Línea creada.', 'exito'],
    ['Progreso 45%. Revisá la consigna.', 'advertencia'],
    ['3 de 10 criterios satisfechos: 30/100.', 'advertencia'],
  ]) assert.equal(esAvisoRutinarioEditor(texto, tipo), true, texto);
  for (const [texto, tipo] of [
    ['No se pudo guardar. Reintentá la operación.', 'error'],
    ['No se pudo guardar la red.', 'advertencia'],
    ['Seleccioná dos estaciones válidas para conectarlas.', 'advertencia'],
    ['La estación está fuera del territorio permitido.', 'advertencia'],
  ]) assert.equal(esAvisoRutinarioEditor(texto, tipo), false, texto);
});

test('resume restricciones geográficas sin perder la orientación ni el área afectada', () => {
  for (const [texto, titulo, mensaje] of [
    ['La conexión sale del territorio válido del mapa. Elegí otras estaciones o agregá una estación intermedia dentro del territorio.',
      'Conexión fuera del mapa', 'Elegí otras estaciones o agregá una estación intermedia dentro del territorio.'],
    ['La estación debe quedar dentro del territorio de Montevideo representado en el mapa.',
      'Estación fuera del mapa', 'Elegí una ubicación dentro del territorio de Montevideo.'],
    ['No se permiten estaciones en AGUADA según la consigna.',
      'Ubicación restringida', 'La consigna no permite estaciones en AGUADA. Elegí otra ubicación.'],
    ['La conexión atraviesa AGUADA, donde la consigna prohíbe tramos.',
      'Conexión restringida', 'La consigna no permite tramos en AGUADA. Buscá otro recorrido.'],
    ['Área territorial sin geometría: Prueba',
      'Referencia no disponible', 'No se puede comprobar el territorio de Prueba. Revisá la configuración del escenario.'],
  ]) assert.deepEqual(resumirAdvertenciaEditor(texto), { titulo, mensaje });
});

test('conserva el motivo de las demás advertencias sin inventar instrucciones', () => {
  const texto = 'La conexión no es válida. Revisá sus extremos.';
  assert.deepEqual(resumirAdvertenciaEditor(texto), { titulo: 'Revisá esta acción', mensaje: texto });
});
