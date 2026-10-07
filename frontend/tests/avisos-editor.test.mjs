import test from 'node:test';
import assert from 'node:assert/strict';
import { esAvisoRutinarioEditor } from '../src/mapa/controles/AvisosEditor.mjs';

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
