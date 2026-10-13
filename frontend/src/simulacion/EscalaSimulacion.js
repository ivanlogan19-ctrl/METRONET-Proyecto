// Escala física adoptada: 1 UV = 1 km/UT; 1 UT = 1 hora del escenario.
// La reproducción visual sigue acelerada y no representa una espera real.
export const RITMOS = Object.freeze([0.5, 1, 2, 4]);
export const VELOCIDAD_INICIAL = 4;
export const HORAS_INICIALES = 6;
const MILISEGUNDOS_POR_HORA = 3000;
const VENTANA_MINIMA_MS = 5000;
const VENTANA_MAXIMA_MS = 18000;
const FORMATO = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 });
const numero = valor => FORMATO.format(Number(valor));
export const formatearVelocidad = valor => `${numero(valor)} UV`;
export const formatearDuracion = valor => `${numero(valor)} h`;
export const formatearRitmo = valor => `${numero(valor)}×`;
export const duracionVisual = horas => Math.min(VENTANA_MAXIMA_MS, Math.max(VENTANA_MINIMA_MS, horas * MILISEGUNDOS_POR_HORA));
// Kilómetros disponibles; el motor limita el avance al final del trazado.
export const avanceEnKilometros = (uv, ut) => uv * ut;
export const normalizarHoras = valor => Number.isInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : HORAS_INICIALES;
