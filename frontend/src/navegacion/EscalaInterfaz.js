// El marco común conserva la composición del portátil en monitores grandes.
// La escena y sus eventos siguen trabajando en las coordenadas de su documento.
export function adaptarEscalaInterfaz(marco) {
  let densidad = window.devicePixelRatio;
  let anchoExterior = window.outerWidth;
  let altoExterior = window.outerHeight;
  let zoomUsuario = 1;
  let pendiente = false;
  function actualizar() {
    pendiente = false;
    const nuevaDensidad = window.devicePixelRatio;
    // El zoom del navegador cambia la densidad sin redimensionar la ventana.
    // No compensarlo: el usuario debe poder ampliar los textos por su cuenta.
    if (nuevaDensidad !== densidad && window.outerWidth === anchoExterior && window.outerHeight === altoExterior) {
      zoomUsuario *= nuevaDensidad / densidad;
    }
    densidad = nuevaDensidad;
    anchoExterior = window.outerWidth;
    altoExterior = window.outerHeight;
    const escala = Math.max(1, Math.min(window.innerWidth * zoomUsuario / 1470, window.innerHeight * zoomUsuario / 840));
    marco.style.setProperty('--escala-interfaz', String(escala));
  }
  window.addEventListener('resize', () => {
    if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); }
  });
  actualizar();
}
