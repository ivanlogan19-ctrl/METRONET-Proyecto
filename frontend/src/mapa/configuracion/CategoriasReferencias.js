// Taxonomía de presentación. No modifica el catálogo ni las reglas educativas.
const categoria = (etiqueta, icono, color, descripcion = etiqueta) => Object.freeze({etiqueta, icono, color, descripcion});
export const CATEGORIAS_REFERENCIAS = Object.freeze({
  BARRIOS_ZONAS: categoria('Barrios / Zonas', 'territorio', 0x8caccf),
  AGUA: categoria('Hidrografía', 'agua', 0x53dccd, 'Referencias hídricas del catálogo; no prohíben construir'),
  ESPACIOS_VERDES: categoria('Zonas verdes', 'verde', 0x75b49c, 'Parques, plazas y jardines del catálogo; no prohíben construir'),
  INFRAESTRUCTURA: categoria('Grandes infraestructuras', 'infraestructura', 0xffb675),
  CULTURA: categoria('Cultura', 'cultura', 0xdc82c4),
  SALUD: categoria('Salud', 'salud', 0xf07878),
  COMERCIO: categoria('Comercio', 'comercio', 0xe4cb81),
  PATRIMONIO: categoria('Patrimonio', 'patrimonio', 0xb99cff),
  INSTITUCIONAL: categoria('Intendencia / CCZ', 'institucional', 0x9ad5ed),
  OTROS: categoria('Otros', 'otros', 0xa5b2bd, 'Referencias cuyo tipo no pertenece a las categorías anteriores'),
});
export const CATEGORIAS_PUNTUALES = Object.freeze(Object.keys(CATEGORIAS_REFERENCIAS).filter(c => c !== 'BARRIOS_ZONAS' && c !== 'OTROS'));
const TIPOS = {
  AGUA: ['Rambla','Lago','Playa','Espacio costero','Río','Arroyo','Curso de agua','Laguna','Costa'],
  ESPACIOS_VERDES: ['Plaza','Parque','Parque deportivo','Plazoleta','Jardín histórico','Jardín botánico','Plaza mirador'],
  INFRAESTRUCTURA: ['Puerto','Centro industrial','Estación ferroviaria','Terminal','Terminal y centro comercial','Faro','Aeropuerto','Aeródromo','Estadio','Hipódromo','Velódromo','Arena deportiva'],
  CULTURA: ['Museo','Museo ferroviario','Teatro','Centro cultural','Monumento','Monumento histórico','Monumento urbano','Iglesia','Iglesia histórica','Capilla histórica','Biblioteca'],
  SALUD: ['Hospital','Hospital universitario','Hospital histórico','Sanatorio','Policlínica','Centro de salud'],
  COMERCIO: ['Mercado','Mercado histórico','Feria','Centro comercial histórico','Bodega histórica','Complejo empresarial'],
  PATRIMONIO: ['Patrimonio histórico','Patrimonio cultural','Patrimonio vitivinícola','Patrimonio ferroviario','Edificio histórico','Estadio histórico','Avenida histórica'],
  INSTITUCIONAL: ['Intendencia','Centro Comunal Zonal'],
};
const normalizar = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const POR_TIPO = new Map(Object.entries(TIPOS).flatMap(([c,tipos])=>tipos.map(t=>[normalizar(t),c])));
export function obtenerCategoriaReferencia(punto) {
  if (punto?.categoria && punto.categoria in CATEGORIAS_REFERENCIAS) return punto.categoria;
  // El catálogo identifica expresamente este mirador dentro del edificio municipal.
  if (String(punto?.id) === '33' && normalizar(punto.descripcion).includes('edificio de la intendencia de montevideo')) return 'INSTITUCIONAL';
  const porTipo = POR_TIPO.get(normalizar(punto?.tipo));
  if (porTipo) return porTipo;
  // Evidencia explícita del catálogo, sin deducir usos por el nombre del lugar.
  if (normalizar(punto?.tipo) === 'universidad' && normalizar(punto.descripcion).includes('edificio historico')) return 'PATRIMONIO';
  if (normalizar(punto?.tipo) === 'edificio emblematico' && normalizar(punto.descripcion).includes('administracion nacional de telecomunicaciones')) return 'INFRAESTRUCTURA';
  return 'OTROS';
}
export const colorReferencia = categoria => CATEGORIAS_REFERENCIAS[categoria]?.color ?? CATEGORIAS_REFERENCIAS.OTROS.color;
export const colorCssReferencia = categoria => `#${colorReferencia(categoria).toString(16).padStart(6,'0')}`;
export function describirReferencia(punto) {
  const categoria = obtenerCategoriaReferencia(punto);
  if (categoria === 'OTROS') return punto?.tipo || 'Referencia del catálogo';
  const c = CATEGORIAS_REFERENCIAS[categoria].etiqueta;
  return punto?.tipo && c !== punto.tipo ? `${c} · ${punto.tipo}` : c;
}
export function esPoiBuscable(punto) { return Boolean(punto?.nombre); }
export function obtenerSubcategoriaPoi(punto) { return obtenerCategoriaReferencia(punto) === 'OTROS' ? punto?.tipo || 'Referencia del catálogo' : CATEGORIAS_REFERENCIAS[obtenerCategoriaReferencia(punto)].etiqueta; }
