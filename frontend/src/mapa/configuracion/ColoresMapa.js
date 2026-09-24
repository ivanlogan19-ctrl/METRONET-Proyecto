// La identidad del HUD se lee de los mismos tokens que utiliza HTML.
// Las paletas de líneas, categorías de POI y geografía siguen en sus capas.
const estilo = getComputedStyle(document.documentElement);
const TOKENS_COLOR = {
  FONDO: '--bg-primary',
  FONDO_SECUNDARIO: '--bg-secondary',
  PANEL: '--panel',
  PANEL_ELEVADO: '--panel-elevated',
  BORDE: '--border',
  BORDE_ACTIVO: '--border-active',
  TEXTO: '--text-primary',
  TEXTO_SECUNDARIO: '--text-secondary',
  DESHABILITADO: '--text-disabled',
  ACTIVO: '--info-active',
  EXITO: '--success',
  ADVERTENCIA: '--warning',
  PELIGRO: '--danger',
};
export const COLORES_INTERFAZ_MAPA = Object.freeze(Object.fromEntries(
  Object.entries(TOKENS_COLOR).map(([nombre, token]) => [nombre, parseInt(estilo.getPropertyValue(token).trim().replace('#', ''), 16)]),
));
export const FUENTES_INTERFAZ_MAPA = Object.freeze({
  LECTURA: estilo.getPropertyValue('--font-ui').trim(),
  SISTEMA: estilo.getPropertyValue('--font-tecnica').trim(),
});
