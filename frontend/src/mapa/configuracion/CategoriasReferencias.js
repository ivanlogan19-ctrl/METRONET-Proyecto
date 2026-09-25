// Clasificación visual derivada del tipo del catálogo. No altera identidad,
// coordenadas, objetivos educativos ni restricciones geográficas.
export const CATEGORIAS_REFERENCIAS = Object.freeze({
  POI: Object.freeze({ etiqueta: 'POI', descripcion: 'Puntos de interés', simbolo: '●' }),
  INFRAESTRUCTURA: Object.freeze({ etiqueta: 'Infraestructura', descripcion: 'Infraestructura territorial', simbolo: '■' }),
  AGUA: Object.freeze({ etiqueta: 'Agua', descripcion: 'Hidrografía y referencias costeras; no implica una restricción de construcción', simbolo: '≈' }),
});

export function obtenerCategoriaReferencia(punto) {
  const tipo = String(punto?.tipo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/\b(rio|arroyo|curso de agua|lago|laguna|embalse|cuerpo de agua|costa|costero|rambla|playa)\b/.test(tipo)) return 'AGUA';
  if (/\b(aeropuerto|aerodromo|puerto|terminal|estacion ferroviaria|centro industrial|faro|instalacion militar|base militar|cuartel)\b/.test(tipo)) return 'INFRAESTRUCTURA';
  return 'POI';
}

export function describirReferencia(punto) {
  const categoria = CATEGORIAS_REFERENCIAS[obtenerCategoriaReferencia(punto)].etiqueta;
  return punto?.tipo ? `${categoria} · ${punto.tipo}` : categoria;
}
