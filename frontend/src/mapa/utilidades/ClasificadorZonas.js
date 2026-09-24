import BARRIOS_POR_ZONA from '../datos/zonas.json';

export const ZONAS = Object.keys(BARRIOS_POR_ZONA);


export function quitarTildes(texto = '') {
  return String(texto)
    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '')

    .replace(/Ñ/g, 'N')

    .replace(/ñ/g, 'n');
}

export function normalizarBarrio(texto = '') {
  let nombre = String(texto).trim().toUpperCase();

  /*
   * Corrección de caracteres
   * mal codificados.
   */

  nombre = nombre

    .replace(/Ã‘/g, 'Ñ')

    .replace(/Ã/g, 'Ñ')

    .replace(/Ã‘/g, 'Ñ')

    .replace(/Ã“/g, 'Ó')

    .replace(/Ã/g, 'Ó')

    .replace(/Ã‰/g, 'É')

    .replace(/Ã/g, 'É')

    .replace(/Ã/g, 'Á')

    .replace(/Ã/g, 'Í')

    .replace(/Ãš/g, 'Ú');

  /*
   * Normalizamos tildes y Ñ
   * para poder comparar nombres.
   */

  nombre = quitarTildes(nombre);

  /*
   * Unificamos abreviaturas
   * presentes en los datos oficiales.
   */

  nombre = nombre

    .replace(/\bPQUE\b/g, 'PARQUE')

    .replace(/\bPBLO\b/g, 'PUEBLO')

    .replace(/\s+/g, ' ');

  return nombre;
}

export function obtenerZona(nombreBarrio) {
  const barrio = normalizarBarrio(nombreBarrio);

  for (const zona of ZONAS) {
    const barrios = BARRIOS_POR_ZONA[zona];

    const encontrado = barrios.some((nombre) => normalizarBarrio(nombre) === barrio);

    if (encontrado) {
      return zona;
    }
  }

  return null;
}

export function obtenerBarriosDeZona(zona) {
  return [...(BARRIOS_POR_ZONA[zona] ?? [])];
}

export function obtenerZonasDeBarrio(nombreBarrio) {
  const zona = obtenerZona(nombreBarrio);

  return zona ? [zona] : [];
}
