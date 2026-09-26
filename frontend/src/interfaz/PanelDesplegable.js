// Ventana anclada a un <details>, fuera del flujo y del recorte de su panel padre.
export function anclarPanelDesplegable(detalle, panel) {
  const acceso = detalle.querySelector('summary');
  panel.setAttribute('popover', 'manual');
  panel.classList.add('metronet-panel-superpuesto');
  acceso.setAttribute('aria-expanded', 'false');
  const posicionar = () => {
    if (!detalle.open) return;
    const r = acceso.getBoundingClientRect();
    const debajo = innerHeight - r.bottom - 16;
    const encima = r.top - 16;
    const arriba = debajo < 200 && encima > debajo;
    panel.style.width = `${Math.min(360, innerWidth - 24)}px`;
    panel.style.left = `${Math.max(12, Math.min(r.left, innerWidth - panel.offsetWidth - 12))}px`;
    panel.style.top = arriba ? 'auto' : `${r.bottom + 6}px`;
    panel.style.bottom = arriba ? `${innerHeight - r.top + 6}px` : 'auto';
    panel.style.maxHeight = `${Math.max(100, arriba ? encima : debajo)}px`;
  };
  const alternar = () => {
    acceso.setAttribute('aria-expanded', String(detalle.open));
    if (detalle.open && detalle.isConnected) { panel.showPopover(); posicionar(); }
    else if (panel.matches(':popover-open')) panel.hidePopover();
  };
  const cerrarFuera = e => { if (!detalle.contains(e.target)) detalle.open = false; };
  const cerrarEscape = e => {
    if (e.key !== 'Escape' || !detalle.open) return;
    e.stopPropagation(); detalle.open = false; acceso.focus({ preventScroll: true });
  };
  detalle.addEventListener('toggle', alternar);
  detalle.addEventListener('keydown', cerrarEscape);
  document.addEventListener('pointerdown', cerrarFuera);
  window.addEventListener('resize', posicionar);
  window.addEventListener('scroll', posicionar, true);
  return () => {
    detalle.removeEventListener('toggle', alternar);
    detalle.removeEventListener('keydown', cerrarEscape);
    document.removeEventListener('pointerdown', cerrarFuera);
    window.removeEventListener('resize', posicionar);
    window.removeEventListener('scroll', posicionar, true);
    if (panel.matches(':popover-open')) panel.hidePopover();
  };
}
