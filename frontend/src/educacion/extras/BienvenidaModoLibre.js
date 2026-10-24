import { iconoRetro } from '../../interfaz/IconosRetro.js';
import './bienvenida-modo-libre.css';

const TEMAS = [
  ['calles', 'Calles y avenidas', '#79caff'],
  ['poblacion', 'Densidad\nde\npoblación', '#c7a6ff'],
  ['trafico', 'Tráfico histórico', '#ffd078'],
  ['desplazamientos', 'Desplazamientos', '#63dbdb'],
  ['relojTrafico', 'Horarios', '#ffad73'],
  ['cobertura', 'Cobertura', '#f3a6c6'],
  ['tarjetasExtras', 'Diseño y simulación', '#b7c8e5'],
];
const FASES = [
  ['Observá', 'Explorá el territorio y sus capas. Elegí qué zonas conectar.'],
  ['Construí', 'Trazá líneas, ubicá estaciones y conectá tu red.'],
  ['Simulá', 'Probá recorridos y horarios. Ajustá velocidad o duración.'],
];
const nodo = (tipo, texto = '') => Object.assign(document.createElement(tipo), { textContent: texto });

export function crearBienvenidaModoLibre(titulo, construir, tarjetas) {
  const encabezado = nodo('header');
  encabezado.className = 'metronet-libre__cabecera';
  encabezado.append(titulo, nodo('p', 'Nuevas herramientas para llevar tu red a la próxima estación.'));
  const fases = nodo('ol');
  fases.className = 'metronet-libre__fases';
  FASES.forEach(([nombre, descripcion], indice) => {
    const fase = nodo('li');
    fase.append(nodo('h3', `0${indice + 1} · ${nombre}`), nodo('p', descripcion));
    fases.append(fase);
  });
  const temas = nodo('ol');
  temas.className = 'metronet-extras__temas metronet-libre__temas';
  temas.setAttribute('aria-label', 'Las siete herramientas');
  TEMAS.forEach(([icono, nombre, color]) => {
    const tema = nodo('li');
    tema.style.setProperty('--color-tema', color);
    tema.innerHTML = iconoRetro(icono);
    tema.append(nodo('span', nombre));
    temas.append(tema);
  });
  const pie = nodo('footer');
  pie.className = 'metronet-libre__pie';
  pie.append(construir, tarjetas);
  return [encabezado, fases, temas, pie];
}
