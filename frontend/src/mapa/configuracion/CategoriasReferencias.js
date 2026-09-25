// Clasificación visual derivada del tipo del catálogo. No altera identidad,
// coordenadas, objetivos educativos ni restricciones geográficas.
export const CATEGORIAS_REFERENCIAS = Object.freeze({
  POI: Object.freeze({ etiqueta: 'POI', descripcion: 'Puntos de interés', simbolo: '●' }),
  ESPACIOS_VERDES: Object.freeze({ etiqueta: 'Espacios verdes', descripcion: 'Parques, plazas y jardines del catálogo; no prohíben construir', simbolo: '●' }),
  INFRAESTRUCTURA: Object.freeze({ etiqueta: 'Infraestructura', descripcion: 'Infraestructura territorial', simbolo: '■' }),
  AGUA: Object.freeze({ etiqueta: 'Hidrografía', descripcion: 'Cursos y cuerpos de agua y referencias costeras del catálogo; no implica una restricción de construcción', simbolo: '≈' }),
});

export function obtenerCategoriaReferencia(punto) {
  const tipo = String(punto?.tipo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/\b(rio|arroyo|curso de agua|lago|laguna|embalse|cuerpo de agua|costa|costero|rambla|playa)\b/.test(tipo)) return 'AGUA';
  if (/\b(parque|plaza|jardin|botanico|espacio verde)\b/.test(tipo)) return 'ESPACIOS_VERDES';
  if (/\b(aeropuerto|aerodromo|puerto|terminal|estacion ferroviaria|centro industrial|faro|instalacion militar|base militar|cuartel)\b/.test(tipo)) return 'INFRAESTRUCTURA';
  return 'POI';
}

export function describirReferencia(punto) {
  const categoria = CATEGORIAS_REFERENCIAS[obtenerCategoriaReferencia(punto)].etiqueta;
  return punto?.tipo ? `${categoria} · ${punto.tipo}` : categoria;
}
