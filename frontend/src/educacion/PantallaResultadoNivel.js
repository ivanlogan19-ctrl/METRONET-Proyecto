import './resultado-nivel.css';

let cerrarResultadoActivo;
const texto = (etiqueta, valor, clase = '') => {
  const nodo = document.createElement(etiqueta);
  nodo.textContent = valor; nodo.className = clase; return nodo;
};

// Solo presenta la evaluación persistida. No deduce penalizaciones ni recalcula puntos.
export function mostrarResultadoNivel(nivel, evaluacion, { signal, mejorPuntajeAnterior } = {}) {
  cerrarResultadoActivo?.();
  if (signal?.aborted) return Promise.resolve(false);
  const focoAnterior = document.activeElement;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-dialogo-cambios metronet-resultado-nivel';
  dialogo.setAttribute('aria-labelledby', 'tituloResultadoNivel');
  const titulo = texto('h2', 'Nivel completado');
  titulo.id = 'tituloResultadoNivel'; titulo.tabIndex = -1;
  const puntos = evaluacion.puntaje, maximo = evaluacion.desempeno?.puntajeMaximo ?? nivel.puntajeMaximo;
  dialogo.append(titulo, texto('p', nivel.nombre || `Nivel ${nivel.numero}`),
    texto('p', Number.isFinite(puntos) ? `Ganaste ${puntos} puntos` : 'Tu resultado quedó registrado.', 'metronet-resultado-nivel__puntos'));
  if (Number.isFinite(puntos) && Number.isFinite(maximo)) {
    const desglose = document.createElement('dl');
    const fila = (nombre, valor) => {
      const item = document.createElement('div'); item.append(texto('dt', nombre), texto('dd', valor)); desglose.append(item);
    };
    fila('Máximo del nivel', maximo);
    if (puntos === maximo) fila('Descuentos aplicados', '0');
    else fila('Diferencia respecto al máximo', maximo - puntos);
    fila('Total obtenido', puntos);
    dialogo.append(desglose);
  }
  dialogo.append(texto('p', evaluacion.desempeno?.explicacion || evaluacion.mensaje || 'Resultado informado por la evaluación del nivel.'));
  if (Number.isFinite(puntos) && Number.isFinite(mejorPuntajeAnterior) && puntos > mejorPuntajeAnterior)
    dialogo.append(texto('p', 'Nuevo récord personal', 'metronet-resultado-nivel__record'));
  const continuar = texto('button', 'Continuar', 'metronet-boton--exito metronet-boton--destacado');
  continuar.type = 'button'; dialogo.append(continuar);
  return new Promise(resolve => {
    let cerrado = false;
    const observador = new MutationObserver(() => { if (!dialogo.isConnected) cancelar(); });
    function cerrar(avanzar = false) {
      if (cerrado) return;
      cerrado = true; observador.disconnect();
      signal?.removeEventListener('abort', cancelar);
      window.removeEventListener('pagehide', cancelar);
      window.removeEventListener('popstate', cancelar);
      dialogo.remove();
      if (cerrarResultadoActivo === cancelar) cerrarResultadoActivo = null;
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
      resolve(avanzar);
    }
    function cancelar() { cerrar(false); }
    continuar.addEventListener('click', () => cerrar(true));
    dialogo.addEventListener('cancel', evento => { evento.preventDefault(); cancelar(); });
    dialogo.addEventListener('close', cancelar);
    signal?.addEventListener('abort', cancelar, { once: true });
    window.addEventListener('pagehide', cancelar);
    window.addEventListener('popstate', cancelar);
    cerrarResultadoActivo = cancelar;
    try {
      document.body.append(dialogo); dialogo.showModal();
      titulo.focus({ preventScroll: true });
      observador.observe(document.body, { childList: true });
    } catch { cerrar(true); } // Un fallo visual no bloquea un resultado ya guardado.
  });
}
