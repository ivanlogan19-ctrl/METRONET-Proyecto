import { gestorMusica } from '../audio/GestorMusica.js';
import { registrarInicioTutorial } from './InicioTutorial.js';
import { registrarIdentificacionPresentada } from './IdentificacionPresentada.js';

// El acceso manual prepara el nivel; una victoria ya realizó el viaje de entrada.
export async function iniciarNivelConTransicion(escenario, iniciar, { preparado = false } = {}) {
  const datos = await prepararNivel(escenario, iniciar, preparado);
  if (datos) {
    registrarInicioTutorial(datos, escenario);
    if (preparado && Number.isInteger(escenario?.numero)) registrarIdentificacionPresentada(datos);
    gestorMusica.establecerContexto('gameplay');
  }
  return datos;
}

async function prepararNivel(escenario, iniciar, preparado) {
  if (preparado || !Number.isInteger(escenario?.numero)) return iniciarSinViaje(iniciar);
  const controlador = new AbortController();
  let viaje = null, cancelar;
  const cancelacion = new Promise(resolve => {
    cancelar = () => { controlador.abort(); resolve(null); };
  });
  window.addEventListener('pagehide', cancelar);
  window.addEventListener('popstate', cancelar);
  const pantalla = import('./PantallaPreparacionNivel.js')
    .then(({ crearPreparacionNivel }) => controlador.signal.aborted ? null : (viaje = crearPreparacionNivel(escenario)))
    .catch(() => null);
  // El request y el viaje comienzan juntos. Cancelar no espera una API pendiente.
  const operacion = Promise.resolve().then(() => iniciar(controlador.signal));
  try {
    const resultado = Promise.all([
      operacion.then(async datos => { (await pantalla)?.marcarDatosListos(); return datos; }),
      pantalla.then(async vista => {
        const continuar = vista ? await vista.finalizada : !controlador.signal.aborted;
        if (!continuar) cancelar();
        return continuar;
      }),
    ]).then(([datos, continuar]) => continuar && !viaje?.cancelada ? datos : null);
    const datos = await Promise.race([resultado, cancelacion]);
    if (datos && viaje?.identificacionPresentada) registrarIdentificacionPresentada(datos);
    return datos;
  } catch (error) {
    if (controlador.signal.aborted) return null;
    throw error;
  } finally {
    window.removeEventListener('pagehide', cancelar);
    window.removeEventListener('popstate', cancelar);
    controlador.abort();
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
