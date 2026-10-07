import { CATEGORIAS_PUNTUALES } from './configuracion/CategoriasReferencias.js';

const PREFIJO = 'metronet.categorias-poi-diseno.';

function clave(idDiseno) {
  return `${PREFIJO}${idDiseno}`;
}

export function guardarCategoriasPoi(idDiseno, categorias) {
  if (!Number.isInteger(Number(idDiseno)) || Number(idDiseno) <= 0) return;
  const seleccion = [...new Set(categorias)].filter(categoria => CATEGORIAS_PUNTUALES.includes(categoria));
  try { sessionStorage.setItem(clave(idDiseno), JSON.stringify(seleccion)); } catch { /* La capa sigue utilizable sin almacenamiento. */ }
}

export function leerCategoriasPoi(idDiseno) {
  if (!Number.isInteger(Number(idDiseno)) || Number(idDiseno) <= 0) return [];
  try {
    const guardadas = JSON.parse(sessionStorage.getItem(clave(idDiseno)) ?? '[]');
    return Array.isArray(guardadas) ? guardadas.filter(categoria => CATEGORIAS_PUNTUALES.includes(categoria)) : [];
  } catch { return []; }
}
