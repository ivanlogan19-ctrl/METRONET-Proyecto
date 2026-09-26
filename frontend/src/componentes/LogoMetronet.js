const RUTA_LOGO = '/assets/metronet-logo-pixel.png';

export function crearLogoMetronet({ alt = 'METRONET', clase = '' } = {}) {
  // El favicon utiliza la misma pieza completa, sin una versión recortada.
  if (!document.head.querySelector('link[rel~="icon"]')) {
    const icono = document.createElement('link');
    icono.rel = 'icon';
    icono.type = 'image/png';
    icono.href = RUTA_LOGO;
    document.head.append(icono);
  }
  const contenedor = document.createElement('span');
  contenedor.className = `metronet-logo ${clase}`.trim();
  const imagen = document.createElement('img');
  imagen.className = 'metronet-logo__imagen';
  imagen.src = RUTA_LOGO;
  // Dimensiones reales: el navegador reserva la proporción antes de descargarla.
  imagen.width = 1536;
  imagen.height = 1024;
  imagen.alt = alt;
  contenedor.append(imagen);
  return contenedor;
}

export function inicializarLogosMetronet() {
  document.querySelectorAll('[data-metronet-logo]').forEach((marcador) => {
    if (marcador.dataset.logoInicializado) return;
    marcador.dataset.logoInicializado = 'true';
    marcador.replaceChildren(crearLogoMetronet({ alt: marcador.dataset.logoAlternativo || 'METRONET' }));
  });
}
