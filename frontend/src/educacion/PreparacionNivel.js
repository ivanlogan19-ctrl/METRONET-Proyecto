// El resultado anterior conserva su confirmación. El viaje de entrada avanza solo.
export async function iniciarNivelConTransicion(escenario, iniciar, { anterior = null, preparado = false } = {}) {
  if (anterior && !preparado) {
    let continuar = true;
    try {
      const { mostrarTransicionNivel } = await import('./PantallaTransicionNivel.js');
      continuar = await mostrarTransicionNivel(anterior, escenario, { puntaje: anterior.ultimoPuntaje });
    } catch { /* Un fallo de presentación no bloquea el acceso. */ }
    if (!continuar) return null;
  }
  // Modo Libre no tiene introducción propia. Los niveles sin mensajes usan el genérico.
  if (!Number.isInteger(escenario?.numero)) return iniciar();
  let viaje = null;
  const pantalla = import('./PantallaPreparacionNivel.js')
    .then(({ crearPreparacionNivel }) => (viaje = crearPreparacionNivel(escenario)))
    .catch(() => null);
  // Iniciar el request enseguida: el porcentaje nunca representa su progreso.
  const operacion = Promise.resolve().then(iniciar);
  try {
    const [datos, continuar] = await Promise.all([
      operacion.then(async datos => { (await pantalla)?.marcarDatosListos(); return datos; }),
      pantalla.then(vista => vista ? vista.finalizada : true),
    ]);
    return continuar && !viaje?.cancelada ? datos : null;
  } finally {
    // También limpia en errores de red, render, cancelación o navegación.
    (await pantalla)?.cerrar();
  }
}
