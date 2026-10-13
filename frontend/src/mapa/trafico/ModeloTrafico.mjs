export const COLORES_TRAFICO = Object.freeze({ baja: 0x62c89b, media: 0xf2c563, alta: 0xf07878, sinDatos: 0x62758c });

export function nivelIntensidad(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 1) return 'sinDatos';
  return valor <= 1/3 ? 'baja' : valor <= 2/3 ? 'media' : 'alta';
}

export function normalizarHora(valor) {
  if (!Number.isFinite(Number(valor))) return null;
  return ((Math.trunc(Number(valor)) % 24) + 24) % 24;
}

export function validarDatosTrafico(datos) {
  return datos?.version === 1 && /^\d{4}-(0[1-9]|1[0-2])$/.test(datos.periodo)
    && Array.isArray(datos.tramos) && datos.tramos.length > 0 && datos.tramos.every(t =>
      Array.isArray(t.intensidades) && t.intensidades.length === 24
      && t.intensidades.every(v => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1))
      && Array.isArray(t.coordenadas) && t.coordenadas.length >= 2
      && t.coordenadas.every(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
        && p[0] > -56.5 && p[0] < -55.9 && p[1] > -35 && p[1] < -34.5));
}
