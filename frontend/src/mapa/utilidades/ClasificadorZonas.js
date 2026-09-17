export const ZONAS = [
  'ZONA CENTRO',
  'ZONA ESTE',
  'ZONA NORTE',
  'ZONA OESTE',
  'ZONA OESTE-COSTA',
  'ZONA NOROESTE',
];

const BARRIOS_POR_ZONA = {
  'ZONA CENTRO': [
    'CIUDAD VIEJA',
    'CENTRO',
    'BARRIO SUR',
    'PALERMO',
    'CORDON',
    'PARQUE RODO',
    'PUNTA CARRETAS',
  ],

  'ZONA ESTE': [
    'POCITOS',
    'BUCEO',
    'MALVIN',
    'MALVIN NORTE',
    'PUNTA GORDA',
    'PARQUE BATLLE VILLA DOLORES',
    'UNION',
    'CARRASCO',
    'CARRASCO NORTE',
    'BANADOS DE CARRASCO',
    'PUNTA RIELES BELLA ITALIA',
    'JARDINES DEL HIPODROMO',
    'ITUZAINGO',
    'VILLA ESPANOLA',
    'MARONAS PARQUE GUARANI',
    'FLOR DE MARONAS',
    'LAS CANTERAS',
  ],

  'ZONA NORTE': [
    'BRAZO ORIENTAL',
    'CERRITO',
    'MERCADO MODELO Y BOLIVAR',
    'AIRES PUROS',
    'CASTRO CASTELLANOS',
    'LAS ACACIAS',
    'PIEDRAS BLANCAS',
    'CASAVALLE',
    'MANGA',
    'MANGA TOLEDO CHICO',
    'VILLA GARCIA MANGA RURAL',
  ],

  'ZONA OESTE': [
    'AGUADA',
    'REDUCTO',
    'ATAHUALPA',
    'JACINTO VERA',
    'FIGURITA',
    'LA COMERCIAL',
    'VILLA MUNOZ RETIRO',
    'LARRANAGA',
    'TRES CRUCES',
    'LA BLANQUEADA',
    'PRADO NUEVA SAVONA',
    'PASO DE LAS DURANAS',
    'SAYAGO',
    'BELVEDERE',
  ],

  'ZONA OESTE-COSTA': [
    'LA TEJA',
    'CAPURRO BELLA VISTA',
    'CERRO',
    'CASABO PAJAS BLANCAS',
    'LA PALOMA TOMKINSON',
    'TRES OMBUES PUEBLO VICTORIA',
  ],

  'ZONA NOROESTE': [
    'COLON CENTRO Y NOROESTE',
    'COLON SURESTE ABAYUBA',
    'CONCILIACION',
    'NUEVO PARIS',
    'LEZICA MELILLA',
    'PASO DE LA ARENA',
    'PENAROL LAVALLEJA',
  ],
};

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
