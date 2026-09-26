// Acota la ventana al espacio real disponible sin redimensionar el lienzo Phaser.
export function ajustarPanelMapa(acceso, panel) {
  const ajustar = () => {
    const r = acceso.getBoundingClientRect();
    const debajo = window.innerHeight - r.bottom - 20;
    const encima = r.top - 20;
    const abrirArriba = debajo < 180 && encima > debajo;
    panel.style.top = abrirArriba ? 'auto' : 'calc(100% + 8px)';
    panel.style.bottom = abrirArriba ? 'calc(100% + 8px)' : 'auto';
    panel.style.setProperty('--alto-panel-mapa', `${Math.max(100, abrirArriba ? encima : debajo)}px`);
  };
  acceso.parentElement.addEventListener('toggle', ajustar);
  window.addEventListener('resize', ajustar);
  window.addEventListener('scroll', ajustar, true);
  return () => {
    acceso.parentElement?.removeEventListener('toggle', ajustar);
    window.removeEventListener('resize', ajustar);
    window.removeEventListener('scroll', ajustar, true);
  };
}
