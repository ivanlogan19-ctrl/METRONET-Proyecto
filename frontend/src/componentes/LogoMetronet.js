const RUTA_LOGO = '/assets/logoMETRONET-transparente.png';

export function crearLogoMetronet({ alt = 'Logo de METRONET', clase = '' } = {}) {
  const contenedor = document.createElement('span');
  contenedor.className = `metronet-logo ${clase}`.trim();
  const imagen = document.createElement('img');
  imagen.className = 'metronet-logo__imagen';
  imagen.src = RUTA_LOGO;
  imagen.alt = alt;
  contenedor.append(imagen);
  return contenedor;
}

export function inicializarLogosMetronet() {
  document.querySelectorAll('[data-metronet-logo]').forEach((marcador) => {
    if (marcador.dataset.logoInicializado) return;
    marcador.dataset.logoInicializado = 'true';
    marcador.replaceChildren(crearLogoMetronet({ alt: marcador.dataset.logoAlternativo || 'Logo de METRONET' }));
  });
}
