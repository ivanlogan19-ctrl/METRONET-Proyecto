// Cada documento posee sus suscripciones y contextos temporales; el contenedor
// posee los Audio. Descargar una vista libera callbacks sin pausar la pista.
export function crearClienteMusicaPersistente(gestor) {
  let activa = true, contexto = null;
  const oyentes = new Map(), temporales = new Set();
  const cliente = {
    establecerContexto(valor) {
      if (!activa) return;
      // "general" al montar editor/simulador significa contexto aún sin decidir.
      if (valor === 'general' && contexto === null) return;
      contexto = valor;
      gestor.establecerContexto(valor);
    },
    reanudarAlCargarDocumento() { /* El reproductor ya pertenece al contenedor. */ },
    usarContextoTemporal(valor, opciones) {
      if (!activa) return () => {};
      const liberar = gestor.usarContextoTemporal(valor, opciones);
      temporales.add(liberar);
      return () => { if (temporales.delete(liberar)) liberar(activa); };
    },
    suscribir(oyente) {
      if (!activa) return () => {};
      oyentes.set(oyente, gestor.suscribir(oyente));
      return () => { oyentes.get(oyente)?.(); oyentes.delete(oyente); };
    },
    obtenerEstado: () => gestor.obtenerEstado(),
    obtenerContexto: () => gestor.obtenerContexto(),
    establecerVolumen: valor => { if (activa) gestor.establecerVolumen(valor); },
    establecerSilencio: valor => { if (activa) gestor.establecerSilencio(valor); },
    activar: () => { if (activa) gestor.activar(); },
  };
  window.addEventListener('pagehide', () => {
    activa = false;
    for (const quitar of oyentes.values()) quitar();
    for (const liberar of temporales) liberar(false);
    temporales.clear();
  });
  window.addEventListener('pageshow', evento => {
    if (!evento.persisted) return;
    activa = true;
    if (contexto !== null) gestor.establecerContexto(contexto);
    for (const oyente of oyentes.keys()) oyentes.set(oyente, gestor.suscribir(oyente));
  });
  window.addEventListener('metronet:sesion-cerrada', () => gestor.cerrarSesion());
  const activar = evento => {
    if (activa && evento.isTrusted && gestor.obtenerEstado().esperandoGesto
      && !evento.target.closest?.('[data-control-musica]')) gestor.activar();
  };
  document.addEventListener('pointerdown', activar);
  document.addEventListener('keydown', activar);
  return cliente;
}
