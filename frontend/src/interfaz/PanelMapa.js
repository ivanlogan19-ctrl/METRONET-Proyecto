// Acota la ventana al espacio real disponible sin redimensionar el lienzo Phaser.
export function ajustarPanelMapa(acceso, panel, { ajustarHorizontal = false } = {}) {
  const ajustar = () => {
    const r = acceso.getBoundingClientRect();
    const debajo = window.innerHeight - r.bottom - 20;
    const encima = r.top - 20;
    const abrirArriba = debajo < 180 && encima > debajo;
    panel.style.top = abrirArriba ? 'auto' : 'calc(100% + 8px)';
    panel.style.bottom = abrirArriba ? 'calc(100% + 8px)' : 'auto';
    panel.style.setProperty('--alto-panel-mapa', `${Math.max(100, abrirArriba ? encima : debajo)}px`);
    if (ajustarHorizontal) {
      const izquierda = Math.max(12, Math.min(r.left, innerWidth - panel.offsetWidth - 12));
      panel.style.left = `${izquierda - acceso.parentElement.getBoundingClientRect().left}px`;
      panel.style.right = 'auto';
    }
  };
  // `toggle` se despacha más tarde: ubicar el panel antes del primer pintado
  // evita que aparezca fuera de la pantalla al abrirlo con clic o teclado.
  const apertura = new MutationObserver(ajustar);
  apertura.observe(acceso.parentElement, { attributes: true, attributeFilter: ['open'] });
  window.addEventListener('resize', ajustar);
  window.addEventListener('scroll', ajustar, true);
  return () => {
    apertura.disconnect();
    window.removeEventListener('resize', ajustar);
    window.removeEventListener('scroll', ajustar, true);
  };
}
