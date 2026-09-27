// Escala de representación, sin equivalencia con velocidades o viajes reales.
export const RITMOS = Object.freeze([0.5, 1, 2, 4]);
export const VELOCIDAD_INICIAL = 4;
export const HORAS_INICIALES = 6;
const MILISEGUNDOS_POR_HORA = 3000;
const VENTANA_MINIMA_MS = 5000;
const VENTANA_MAXIMA_MS = 18000;
const TRAMOS_POR_UV_HORA = 1;
const FORMATO = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 });
const numero = valor => FORMATO.format(Number(valor));
export const formatearVelocidad = valor => `${numero(valor)} UV`;
export const formatearDuracion = valor => `${numero(valor)} h`;
export const formatearRitmo = valor => `${numero(valor)}×`;
export const duracionVisual = horas => Math.min(VENTANA_MAXIMA_MS, Math.max(VENTANA_MINIMA_MS, horas * MILISEGUNDOS_POR_HORA));
// Cada tramo es un paso lógico; su longitud geográfica no convierte UV a km/h.
export const avanceEnTramos = (uv, horas) => uv * horas * TRAMOS_POR_UV_HORA;
export const normalizarHoras = valor => Number.isInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : HORAS_INICIALES;
