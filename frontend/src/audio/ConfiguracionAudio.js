// Una pista por contexto. Los contextos sin pista quedan disponibles para futuros assets.
export const PISTAS_MUSICA = Object.freeze({
  gameplay: '/audio/extra-theme.mp3',
  inicioNivel: '/audio/victory-theme.mp3',
  loading: null,
  transition: '/audio/extra-theme.mp3',
  auth: '/audio/portada-theme.mp3',
  educativo: '/audio/educativo-theme.mp3',
  simulacion: '/audio/simulacion-theme.mp3',
  welcome: '/audio/welcome-theme.mp3',
  victory: '/audio/victory-theme.mp3',
  menu: '/audio/menu-theme.mp3',
  admin: '/audio/menu-theme.mp3',
  general: null,
});

export const CONTEXTOS_MUSICA_PUNTUAL = Object.freeze(['welcome', 'inicioNivel', 'victory']);

export const VOLUMEN_MUSICA_INICIAL = 0.35;
export const DURACION_MEZCLA_MS = 180;
export const UMBRAL_CARGA_MUSICAL_MS = 600;
