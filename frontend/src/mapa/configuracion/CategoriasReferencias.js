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
  const subtipo = obtenerSubcategoriaPoi(punto);
  const categoria = subtipo ? `POI · ${subtipo}` : CATEGORIAS_REFERENCIAS[obtenerCategoriaReferencia(punto)].etiqueta;
  return punto?.tipo && subtipo !== punto.tipo ? `${categoria} · ${punto.tipo}` : categoria;
}

// La pertenencia al buscador es independiente de la capa de representación.
// Infraestructura conserva su toggle; verde e hidrografía siguen siendo territorio.
export function esPoiBuscable(punto) {
  return ['POI', 'INFRAESTRUCTURA'].includes(obtenerCategoriaReferencia(punto));
}

export function obtenerSubcategoriaPoi(punto) {
  if (!esPoiBuscable(punto)) return null;
  if (obtenerCategoriaReferencia(punto) === 'INFRAESTRUCTURA') return 'Infraestructura';
  const tipo = String(punto?.tipo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/hospital/.test(tipo)) return 'Salud';
  if (/universidad|biblioteca/.test(tipo)) return 'Educación';
  if (/deportivo|deportiva|estadio|hipodromo|velodromo/.test(tipo)) return 'Deporte';
  if (/mercado|comercial|feria|bodega|vitivinicola/.test(tipo)) return 'Comercio';
  if (/museo|teatro|cultural|historico|historica|patrimonio|monumento|iglesia|capilla/.test(tipo)) return 'Cultura y patrimonio';
  // Los tipos restantes conservan su denominación real, sin inventar una categoría.
  return punto?.tipo || 'Referencia puntual';
}
