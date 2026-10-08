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
  const detalle = evaluacion.desempeno?.desglosePuntuacion;
  const puntos = evaluacion.puntaje, maximo = evaluacion.desempeno?.puntajeMaximo ?? nivel.puntajeMaximo;
  const cabecera = texto('header', '', 'metronet-resultado-nivel__cabecera');
  const titulo = texto('h2', 'Nivel completado');
  titulo.id = 'tituloResultadoNivel'; titulo.tabIndex = -1;
  cabecera.append(texto('p', nivel.numero ? `RESULTADO // NIVEL ${String(nivel.numero).padStart(2, '0')}` : 'RESULTADO DEL RECORRIDO', 'metronet-resultado-nivel__etiqueta'),
    titulo, texto('p', nivel.nombre || 'Tu red', 'metronet-resultado-nivel__nivel'));
  const premio = texto('section', '', 'metronet-resultado-nivel__premio');
  const marcador = texto('p', '', 'metronet-resultado-nivel__puntos');
  if (Number.isFinite(puntos)) {
    marcador.append(texto('span', 'Ganaste'), texto('strong', puntos), texto('span', 'puntos'));
  } else marcador.textContent = 'Tu resultado quedó registrado.';
  premio.append(marcador, texto('p', 'Toda la consigna cumplida', 'metronet-resultado-nivel__aprobado'));
  if (Number.isFinite(puntos) && Number.isFinite(mejorPuntajeAnterior) && puntos > mejorPuntajeAnterior)
    premio.append(texto('p', 'Nuevo récord personal', 'metronet-resultado-nivel__record'));
  dialogo.append(cabecera, premio);
  const cuenta = texto('section', '', 'metronet-resultado-nivel__cuenta');
  if (Number.isFinite(puntos) && Number.isFinite(maximo)) {
    const encabezado = texto('h3', 'Tu cuenta de puntos');
    encabezado.id = 'cuentaResultadoNivel';
    const desglose = document.createElement('dl');
    desglose.setAttribute('aria-labelledby', encabezado.id);
    cuenta.append(encabezado);
    const fila = (nombre, valor, clase = '') => {
      const item = texto('div', '', clase); item.append(texto('dt', nombre), texto('dd', valor)); desglose.append(item);
    };
    if (detalle) {
      fila('Puntos iniciales', detalle.puntosBase);
      for (const descuento of detalle.descuentos) {
        const item = texto('div', '', 'metronet-resultado-nivel__descuento');
        const motivo = texto('dt', '');
        const pendientes = document.createElement('details');
        const resumen = texto('summary', `Ejecución ${descuento.numeroEjecucion}`);
        resumen.append(texto('span', 'Sin nuevos avances'));
        pendientes.append(resumen, texto('p', `En esa ejecución faltaba: ${descuento.motivos.join('; ')}.`));
        motivo.append(pendientes);
        item.append(motivo, texto('dd', `−${descuento.puntos}`)); desglose.append(item);
      }
      if (!detalle.descuentos.length) fila('Descuentos aplicados', '0');
      fila('Total obtenido', detalle.total, 'metronet-resultado-nivel__total');
      cuenta.append(desglose);
      if (detalle.descuentos.length)
        cuenta.append(texto('p', 'Abrí cada ejecución para ver qué faltaba.', 'metronet-resultado-nivel__nota'));
      if (detalle.totalDescontado >= detalle.descuentoMaximo)
        cuenta.append(texto('p', `Tope alcanzado: ${detalle.descuentoMaximo} puntos de descuento. No se restó más.`, 'metronet-resultado-nivel__nota'));
    } else {
      fila('Máximo del nivel', maximo);
      fila(puntos === maximo ? 'Descuentos aplicados' : 'Diferencia respecto al máximo', maximo - puntos);
      fila('Total obtenido', puntos, 'metronet-resultado-nivel__total');
      cuenta.append(desglose);
      const historial = document.createElement('details');
      historial.className = 'metronet-resultado-nivel__historial';
      historial.append(texto('summary', 'Regla original de este intento'), texto('p',
        `Puntuación por condiciones cumplidas, sin descuentos. ${evaluacion.desempeno?.explicacion || evaluacion.mensaje || ''}`));
      cuenta.append(historial);
    }
  }
  dialogo.append(cuenta);
  const pie = texto('footer', '', 'metronet-resultado-nivel__acciones');
  const continuar = texto('button', 'Continuar', 'metronet-boton--exito metronet-boton--destacado');
  continuar.type = 'button'; pie.append(continuar); dialogo.append(pie);
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
