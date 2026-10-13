import './estilos/fuentes-mapa.css';
import desplazamientos from './datos/desplazamientos-historicos.json';
import { validarDatosTrafico } from './trafico/ModeloTrafico.mjs';

// Consulta compartida de solo lectura: accesible también a jugadores desde Reglas.
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
    <article><h3>Densidad de población · 2011</h3>
    <p>INE, Censo 2011. Residentes divididos por superficie de los polígonos oficiales: 13.621 zonas; 15 sin población asociada se muestran en gris. Cartografía oficial disponible utilizada con autorización; no representa población actual.</p>
    <p>De violeta oscuro a claro: hasta 1.000, 5.000, 10.000, 20.000 y más de 20.000 habitantes/km². Cero residentes pertenece a la primera banda. Esta capa no cambia con el reloj y no tiene actualización automática.</p>
    <a href="https://sit.mvot.gub.uy/arcgis/rest/services/07_EXTERNO/INDICADORES_CENSO/MapServer/6" target="_blank" rel="noopener noreferrer">Población: INE · SIT / MVOT</a>
    <a href="https://dgrn.mgap.gub.uy/Metadatos/ine_zonas_11_metadatos.pdf" target="_blank" rel="noopener noreferrer">Cartografía: INE · MGAP · Uso libre con atribución</a></article>
    <article><h3>Desplazamientos históricos · 2016</h3>
    <p>Encuesta Origen-Destino 2016, todos los medios de transporte. Suma de ponderaciones wcal0 por segmento censal de origen, destino y hora de salida. Se muestran hasta los 12 pares con mayor peso de la hora elegida; no es el total de viajes de la ciudad.</p>
    <p>Las flechas indican dirección y su grosor compara el peso entre los pares visibles. La animación es ilustrativa: no representa personas individuales, velocidad, tiempo de viaje, rutas por calles ni desplazamientos en vivo. Los extremos son puntos interiores representativos de sectores censales, nunca domicilios.</p>
    <p data-cobertura-desplazamientos></p>
    <p>Los horarios 24–28 de la encuesta corresponden a la madrugada siguiente. No se inventan flujos para horas ausentes ni se combinan censos de distintos años para estimar movimientos. Sin actualización automática. El reloj compartido selecciona la hora en cada fuente; tráfico y viajes pertenecen a años diferentes.</p>
    <a href="https://catalogodatos.gub.uy/dataset/encuesta-origen-destino-montevideo/resource/f9545ab1-367c-49e5-9157-aa18eb7ce9ac" target="_blank" rel="noopener noreferrer">Encuesta Origen-Destino · Licencia DAG-UY</a></article>`;
  const m = desplazamientos.metadata;
  contenedor.querySelector('[data-cobertura-desplazamientos]').textContent = `${m.incluidos} de ${m.totalRegistros} registros permiten representar viajes entre sectores de Montevideo. Excluidos: ${m.excluidos.fueraDeCoberturaOSinSegmento} fuera de la cobertura cartográfica o sin segmento, ${m.excluidos.dentroDelMismoSegmento} dentro del mismo sector y ${m.excluidos.sinHoraValida} sin hora válida. ${desplazamientos.flujos.length} pares por hora agregados, sobre cartografía censal 2011.`;
  const estado = contenedor.querySelector('[data-periodo-trafico]');
  try {
    const respuesta = await fetch(`${location.protocol}//${location.hostname}:8080/api/trafico/historico`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!respuesta.ok) throw new Error();
    const datos = await respuesta.json();
    if (!validarDatosTrafico(datos)) throw new Error();
    estado.textContent = `Período disponible: ${datos.periodo}. ${datos.tramos.length} tramos con sensores asociados.`;
  } catch { estado.textContent = 'No se pudo consultar el período actual del servidor. Reabrí esta sección para reintentar; no se informa una fecha sin verificar.'; }
}
