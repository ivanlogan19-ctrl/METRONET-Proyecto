const VELOCIDADES_SIMULACION_VALIDAS = new Set([0.5, 1, 2, 4]);
const CAPACIDAD_MAXIMA_UNIDAD = 2_000;
const VALORES_PREDETERMINADOS = Object.freeze({
  velocidadSimulacion: 1,
  capacidadUnidad: 300,
  modoMantenimiento: 'desactivado',
});

export async function obtenerConfiguracionAplicacion(sesion) {
  if (!sesion?.token) return { ...VALORES_PREDETERMINADOS };
  try {
    const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/configuraciones`, {
      headers: { Authorization: `Bearer ${sesion.token}` },
    });
    if (!respuesta.ok) return { ...VALORES_PREDETERMINADOS };
    return normalizarConfiguracion(await respuesta.json());
  } catch {
    return { ...VALORES_PREDETERMINADOS };
  }
}

function normalizarConfiguracion(configuraciones) {
  const valoresPorClave = new Map(
    (Array.isArray(configuraciones) ? configuraciones : [])
      .map((configuracion) => [configuracion?.clave, configuracion?.valor]),
  );
  const velocidadSimulacion = Number(valoresPorClave.get('velocidad_simulacion'));
  const capacidadUnidad = Number(valoresPorClave.get('capacidad_unidad'));
  const modoMantenimiento = String(valoresPorClave.get('modo_mantenimiento') ?? '').toLowerCase();
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
