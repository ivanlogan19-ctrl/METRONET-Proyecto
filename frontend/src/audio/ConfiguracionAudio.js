// Una pista por contexto. Los contextos sin pista quedan disponibles para futuros assets.
export const PISTAS_MUSICA = Object.freeze({
  gameplay: '/audio/gameplay-theme.mp3',
  loading: null,
  transition: null,
  auth: null,
  menu: null,
  admin: null,
  general: null,
});

export const VOLUMEN_MUSICA_INICIAL = 0.35;
export const DURACION_ENTRADA_MS = 250;
