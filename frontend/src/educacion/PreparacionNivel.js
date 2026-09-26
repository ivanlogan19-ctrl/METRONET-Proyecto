import { gestorMusica } from '../audio/GestorMusica.js';

// El acceso manual prepara el nivel; una victoria ya realizó el viaje de entrada.
export async function iniciarNivelConTransicion(escenario, iniciar, { preparado = false } = {}) {
  const liberarMusica = gestorMusica.usarContextoTemporal('loading');
  try { return await prepararNivel(escenario, iniciar, preparado); }
  finally { liberarMusica(); }
}

async function prepararNivel(escenario, iniciar, preparado) {
  if (preparado) return iniciarSinViaje(iniciar);
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

async function iniciarSinViaje(iniciar) {
  const controlador = new AbortController();
  let cancelar;
  const cancelacion = new Promise(resolve => {
    cancelar = () => { controlador.abort(); resolve(null); };
  });
  window.addEventListener('pagehide', cancelar);
  window.addEventListener('popstate', cancelar);
  try {
    const datos = await Promise.race([Promise.resolve().then(() => iniciar(controlador.signal)), cancelacion]);
    return controlador.signal.aborted ? null : datos;
  } catch (error) {
    if (controlador.signal.aborted) return null;
    throw error;
  } finally {
    window.removeEventListener('pagehide', cancelar);
    window.removeEventListener('popstate', cancelar);
  }
}
