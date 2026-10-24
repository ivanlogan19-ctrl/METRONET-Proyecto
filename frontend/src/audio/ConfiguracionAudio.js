// Una pista por contexto. Los contextos sin pista quedan disponibles para futuros assets.
const PISTA_CONSTRUCCION = '/audio/construccion-theme.m4a';

export const PISTAS_MUSICA = Object.freeze({
  gameplay: PISTA_CONSTRUCCION,
  inicioNivel: '/audio/inicio-nivel-theme.m4a',
  modoLibre: '/audio/modo-libre-theme.m4a',
  loading: null,
  transition: PISTA_CONSTRUCCION,
  auth: '/audio/portada-theme.m4a',
  educativo: '/audio/educativo-theme.m4a',
  simulacion: '/audio/simulacion-theme.m4a',
  welcome: '/audio/welcome-theme.m4a',
  victory: '/audio/victory-theme.m4a',
  menu: '/audio/menu-theme.m4a',
  admin: '/audio/menu-theme.m4a',
  general: null,
});

export const CONTEXTOS_MUSICA_PUNTUAL = Object.freeze(['welcome', 'inicioNivel', 'victory']);

export const VOLUMEN_MUSICA_INICIAL = 0.35;
export const DURACION_MEZCLA_MS = 800;
export const UMBRAL_CARGA_MUSICAL_MS = 600;
