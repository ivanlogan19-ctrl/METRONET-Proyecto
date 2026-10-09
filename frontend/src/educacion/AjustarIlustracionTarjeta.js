// Aprovechar el ancho de la ficha sin recortar el SVG ni desplazar sus acciones
// fuera del diálogo. Solo se mide al abrir, cargar fuentes o cambiar el viewport.
let ajustePendiente = 0;

export function ajustarIlustracionTarjeta() {
  cancelAnimationFrame(ajustePendiente);
  const ajustar = () => {
    ajustePendiente = 0;
    for (const figura of document.querySelectorAll('dialog[open] .metronet-ilustracion-ampliable')) {
      figura.style.maxWidth = '100%';
      if (window.innerWidth < 900) continue;
      const imagen = figura.querySelector('img');
      if (!imagen || imagen.hidden) continue;
      const dialogo = figura.closest('dialog');
      const exceso = dialogo.scrollHeight - dialogo.clientHeight;
      if (exceso <= 1) continue;
      const caja = figura.getBoundingClientRect();
      const proporcion = imagen.width / imagen.height;
      figura.style.maxWidth = `${Math.max(caja.width / 2, caja.width - (exceso + 2) * proporcion)}px`;
    }
  };
  try { ajustePendiente = requestAnimationFrame(ajustar); }
  catch { ajustar(); } // Un fallo de animación no debe impedir abrir la tarjeta.
}

window.addEventListener('resize', ajustarIlustracionTarjeta);
window.addEventListener('pagehide', () => cancelAnimationFrame(ajustePendiente));
document.fonts.ready.then(ajustarIlustracionTarjeta);
