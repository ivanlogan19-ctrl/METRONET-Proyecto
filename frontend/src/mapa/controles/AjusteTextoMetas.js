// Ajusta solo la tipografía; conserva íntegros el texto y el progreso de cada meta.
export function observarTextoMetas(contenedor) {
  let activo = true;
  const ajustar = () => {
    if (!activo) return;
    for (const texto of contenedor.querySelectorAll('.metronet-consigna__lista-breve .metronet-consigna__texto-objetivo')) {
      texto.style.removeProperty('font-size');
      if (!texto.clientWidth) continue;
      const fuente = parseFloat(getComputedStyle(texto).fontSize);
      const rango = document.createRange();
      rango.selectNodeContents(texto);
      const ancho = rango.getBoundingClientRect().width;
      if (ancho > texto.clientWidth) {
        texto.style.fontSize = `${Math.floor(fuente * (texto.clientWidth - 1) / ancho * 10) / 10}px`;
      }
    }
  };
  const observador = new ResizeObserver(ajustar);
  observador.observe(contenedor);
  document.fonts.ready.then(ajustar);
  return () => { activo = false; observador.disconnect(); };
}
