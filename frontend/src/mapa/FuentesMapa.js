import './estilos/fuentes-mapa.css';
import { iconoRetro } from '../interfaz/IconosRetro.js';
import desplazamientos from './datos/desplazamientos-historicos.json';
import { validarDatosTrafico } from './trafico/ModeloTrafico.mjs';

// Consulta compartida de solo lectura: accesible también a jugadores desde Administración.
export async function mostrarFuentesMapa(contenedor) {
  if (!contenedor) return;
  contenedor.classList.add('metronet-fuentes');
  contenedor.innerHTML = `<article><h3>Calles y avenidas</h3>
    <p>Intendencia de Montevideo · Geomática. Cartografía descargada el 13/10/2026: 27.656 tramos. Las vías menores aparecen al acercar el mapa. Sin actualización automática.</p>
    <a href="https://ckan.montevideo.gub.uy/dataset/vias-de-transito" target="_blank" rel="noopener noreferrer">Fuente y licencia DAG-UY</a></article>
    <article><h3>Tráfico histórico</h3><p data-periodo-trafico role="status">Consultando el período disponible…</p>
    <p>Promedio por hora de todos los días del período. Mínimo 36 muestras en 3 días por hora y carril; ambos sentidos se reúnen en el mismo tramo. Verde: hasta un tercio del máximo horario propio del tramo; amarillo: hasta dos tercios; rojo: por encima. Gris: mediciones insuficientes. No indica congestión ni tráfico en vivo; no se extienden sensores a toda una avenida.</p>
    <p>El servidor comprueba la fuente mensualmente y conserva el último período válido ante fallos o meses incompletos. Al volver a activar la capa se consulta la versión disponible.</p>
    <a href="https://ckan.montevideo.gub.uy/dataset/conteo-vehicular-en-las-principales-avenidas-de-montevideo" target="_blank" rel="noopener noreferrer">Intendencia de Montevideo · DAG-UY</a></article>
    <article><h3>Densidad de población · 2023</h3>
    <p>INE, Censo 2023. Población y superficie de 1.067 segmentos censales oficiales de Montevideo. La densidad se calcula dentro de cada segmento; no describe cada manzana ni proyecta la población a la fecha actual.</p>
    <p>De violeta oscuro a claro: hasta 1.000, 5.000, 10.000, 20.000 y más de 20.000 habitantes/km². Cero residentes pertenece a la primera banda. Esta capa no cambia con el reloj y no tiene actualización automática.</p>
    <a href="https://www.gub.uy/instituto-nacional-estadistica/politicas-y-gestion/unidades-geostadisticas" target="_blank" rel="noopener noreferrer">Población y cartografía: INE · Censo 2023</a></article>
    <article><h3>Desplazamientos históricos · 2016</h3>
    <p>Encuesta Origen-Destino 2016, todos los medios de transporte. Suma de ponderaciones wcal0 por segmento censal de origen, destino y hora de salida. Se muestran hasta los 12 pares con mayor peso de la hora elegida; no es el total de viajes de la ciudad.</p>
    <p>Las flechas indican dirección y su grosor compara el peso entre los pares visibles. La animación es ilustrativa: no representa personas individuales, velocidad, tiempo de viaje, rutas por calles ni desplazamientos en vivo. Los extremos son puntos interiores representativos de sectores censales, nunca domicilios.</p>
    <p data-cobertura-desplazamientos></p>
    <p>Los horarios 24–28 de la encuesta corresponden a la madrugada siguiente. No se inventan flujos para horas ausentes ni se combinan censos de distintos años para estimar movimientos. Sin actualización automática. El reloj compartido selecciona la hora en cada fuente; tráfico y viajes pertenecen a años diferentes.</p>
    <a href="https://catalogodatos.gub.uy/dataset/encuesta-origen-destino-montevideo/resource/f9545ab1-367c-49e5-9157-aa18eb7ce9ac" target="_blank" rel="noopener noreferrer">Encuesta Origen-Destino · Licencia DAG-UY</a></article>`;
  const m = desplazamientos.metadata;
  contenedor.querySelector('[data-cobertura-desplazamientos]').textContent = `${m.incluidos} de ${m.totalRegistros} registros permiten representar viajes entre sectores de Montevideo. Excluidos: ${m.excluidos.fueraDeCoberturaOSinSegmento} fuera de la cobertura cartográfica o sin segmento, ${m.excluidos.dentroDelMismoSegmento} dentro del mismo sector y ${m.excluidos.sinHoraValida} sin hora válida. ${desplazamientos.flujos.length} pares por hora agregados, sobre cartografía censal 2011.`;
  if (contenedor.closest('.metronet-pagina-administracion')) organizarResumenFuentes(contenedor);
  const estado = contenedor.querySelector('[data-periodo-trafico]');
  try {
    const respuesta = await fetch(`${location.protocol}//${location.hostname}:8080/api/trafico/historico`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!respuesta.ok) throw new Error();
    const datos = await respuesta.json();
    if (!validarDatosTrafico(datos)) throw new Error();
    estado.textContent = contenedor.classList.contains('metronet-fuentes--resumen')
      ? datos.periodo.split('-').reverse().join('/')
      : `Período disponible: ${datos.periodo}. ${datos.tramos.length} tramos con sensores asociados.`;
    estado.dataset.consulta = 'disponible';
  } catch { estado.textContent = 'No se pudo consultar el período actual del servidor. Reabrí esta sección para reintentar; no se informa una fecha sin verificar.'; }
}

// Administración utiliza las fichas aprobadas; El catálogo conserva la metodología completa.
function organizarResumenFuentes(contenedor) {
  contenedor.classList.add('metronet-fuentes--resumen');
  const fichas = [
    { icono: 'calles', titulo: 'Calles y avenidas', datos: [['Fuente', 'Intendencia de Montevideo'], ['Cartografía', '13/10/2026'], ['Actualización', 'Manual']], resumen: 'Las calles menores aparecen al acercar el mapa.' },
    { icono: 'trafico', titulo: 'Tráfico histórico', datos: [['Período', null], ['Actualización', 'Mensual']], resumen: 'Intensidad relativa por tramo y hora. No indica congestión ni tráfico en vivo.', colores: ['#65cba4', '#f1ce6d', '#ef797d', '#657a91'], etiquetas: ['Bajo', 'Medio', 'Alto', 'Sin datos'] },
    { icono: 'poblacion', titulo: 'Densidad de población', datos: [['Fuente', 'INE · Censo 2023'], ['Actualización', 'Sin actualización automática']], resumen: 'Habitantes por km². No representa la población actual.', colores: ['#403454', '#625084', '#866bad', '#ac8acf', '#d4aff0'] },
    { icono: 'desplazamientos', titulo: 'Desplazamientos', datos: [['Fuente', 'Encuesta Origen-Destino'], ['Año', '2016']], resumen: 'Flujos históricos por horario. Las flechas muestran dirección y peso relativo; la animación es ilustrativa.' },
  ];
  [...contenedor.children].forEach((articulo, indice) => {
    const ficha = fichas[indice];
    articulo.dataset.fuente = ficha.icono;
    const titulo = articulo.querySelector('h3');
    titulo.textContent = ficha.titulo;
    titulo.insertAdjacentHTML('afterbegin', iconoRetro(ficha.icono));
    const enlace = articulo.querySelector('a');
    enlace.textContent = 'Consultar fuente';
    enlace.setAttribute('aria-label', `Consultar fuente de ${ficha.titulo.toLowerCase()}`);
    const periodo = articulo.querySelector('[data-periodo-trafico]');
    const datos = document.createElement('dl');
    datos.className = 'metronet-fuentes__datos';
    for (const [etiqueta, valor] of ficha.datos) {
      const nombre = document.createElement('dt'), contenido = document.createElement('dd');
      nombre.textContent = etiqueta;
      if (valor === null) contenido.append(periodo);
      else contenido.textContent = valor;
      datos.append(nombre, contenido);
    }
    const resumen = document.createElement('p'); resumen.className = 'metronet-fuentes__resumen'; resumen.textContent = ficha.resumen;
    const pie = document.createElement('footer'); pie.className = 'metronet-fuentes__enlaces'; pie.append(enlace);
    articulo.replaceChildren(titulo, datos);
    if (ficha.colores) {
      const leyenda = document.createElement('div'); leyenda.className = 'metronet-fuentes__leyenda';
      for (const [i, color] of ficha.colores.entries()) {
        const grupo = document.createElement('span'); grupo.className = 'metronet-fuentes__color';
        const muestra = document.createElement('span'); muestra.className = 'metronet-fuentes__muestra'; muestra.style.backgroundColor = color; muestra.setAttribute('aria-hidden', 'true'); grupo.append(muestra);
        if (ficha.etiquetas) grupo.append(document.createTextNode(ficha.etiquetas[i]));
        leyenda.append(grupo);
      }
      if (!ficha.etiquetas) {
        leyenda.classList.add('metronet-fuentes__leyenda--densidad');
        const extremos = document.createElement('span'); extremos.className = 'metronet-fuentes__extremos'; extremos.innerHTML = '<span>Baja</span><span>Alta</span>'; leyenda.append(extremos);
        leyenda.setAttribute('aria-label', 'Densidad de menor a mayor, de violeta oscuro a claro, como en el mapa');
      }
      articulo.append(leyenda);
    }
    articulo.append(resumen, pie);
  });
}
