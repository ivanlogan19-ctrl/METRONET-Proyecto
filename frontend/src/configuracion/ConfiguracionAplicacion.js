const VELOCIDADES_SIMULACION_VALIDAS = new Set([0.5, 1, 2, 4]);
const CAPACIDAD_MAXIMA_UNIDAD = 2_000;
const VALORES_PREDETERMINADOS = Object.freeze({
  velocidadSimulacion: 1,
  capacidadUnidad: 300,
  modoMantenimiento: 'desactivado',
});

const consultasPendientes = new Map();
const ultimaConfiguracion = new Map();
export const EVENTO_CONFIGURACION = 'metronet:configuracion-actualizada';
export const MENSAJE_MANTENIMIENTO = 'METRONET se encuentra temporalmente en mantenimiento. Las funciones de edición y simulación están momentáneamente deshabilitadas.';

export function estaMantenimientoActivo(sesion) {
  return sesion?.usuario?.rol === 'JUGADOR'
    && ultimaConfiguracion.get(sesion.token)?.modoMantenimiento === 'activado';
}

export function obtenerConfiguracionAplicacion(sesion) {
  if (!sesion?.token) return Promise.resolve({ ...VALORES_PREDETERMINADOS });
  // Header, editor y simulación comparten la consulta mientras está en curso.
  if (!consultasPendientes.has(sesion.token)) {
    consultasPendientes.set(sesion.token, consultarConfiguracion(sesion)
      .finally(() => consultasPendientes.delete(sesion.token)));
  }
  return consultasPendientes.get(sesion.token);
}

async function consultarConfiguracion(sesion) {
  try {
    const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/configuraciones`, {
      headers: { Authorization: `Bearer ${sesion.token}` },
    });
    if (respuesta.ok) {
      const configuracion = normalizarConfiguracion(await respuesta.json());
      ultimaConfiguracion.set(sesion.token, configuracion);
      window.dispatchEvent(new CustomEvent(EVENTO_CONFIGURACION));
      return configuracion;
    }
  } catch {
    // Una falla de consulta no desactiva un mantenimiento ya conocido.
  }
  return ultimaConfiguracion.get(sesion.token) ?? { ...VALORES_PREDETERMINADOS };
}

function normalizarConfiguracion(configuraciones) {
  const valoresPorClave = new Map(
    (Array.isArray(configuraciones) ? configuraciones : [])
      .map((configuracion) => [configuracion?.clave, configuracion?.valor]),
  );
  const velocidadSimulacion = Number(valoresPorClave.get('velocidad_simulacion'));
  const capacidadUnidad = Number(valoresPorClave.get('capacidad_unidad'));
  const modoMantenimiento = String(valoresPorClave.get('modo_mantenimiento') ?? '').trim().toLowerCase();
  return {
    velocidadSimulacion: VELOCIDADES_SIMULACION_VALIDAS.has(velocidadSimulacion)
      ? velocidadSimulacion
      : VALORES_PREDETERMINADOS.velocidadSimulacion,
    capacidadUnidad: Number.isInteger(capacidadUnidad) && capacidadUnidad > 0 && capacidadUnidad <= CAPACIDAD_MAXIMA_UNIDAD
      ? capacidadUnidad
      : VALORES_PREDETERMINADOS.capacidadUnidad,
    modoMantenimiento: modoMantenimiento === 'activado' ? 'activado' : 'desactivado',
  };
}
