// El contenedor es la fuente de tamaño. Un aviso de posición de Phaser no
// requiere reconstruir geografía, marcadores ni el encuadre de la cámara.
export function observarTamanoMapa(escena, contenedor, actualizar) {
  let ancho = escena.scale.width;
  let alto = escena.scale.height;
  const alRedimensionar = () => {
    const { width, height } = escena.scale;
    if (width === ancho && height === alto) return;
    ancho = width;
    alto = height;
    // Recordar también el tamaño oculto: al reaparecer hay que actualizar,
    // aunque recupere las mismas dimensiones anteriores a la ocultación.
    if (width <= 0 || height <= 0) return;
    actualizar();
  };
  const observador = new ResizeObserver(() => {
    if (contenedor.clientWidth && contenedor.clientHeight && escena.scale.getParentBounds()) escena.scale.refresh();
  });
  escena.scale.on('resize', alRedimensionar);
  observador.observe(contenedor);
  return () => {
    observador.disconnect();
    escena.scale.off('resize', alRedimensionar);
  };
}
