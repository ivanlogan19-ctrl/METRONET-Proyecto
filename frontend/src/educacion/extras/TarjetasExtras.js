// Material didáctico de las capas existentes; no altera UV, UT ni la simulación.
export const TARJETAS_EXTRAS = Object.freeze([
  { id:1, titulo:'Calles y avenidas', subtitulo:'Reconocé el territorio',
    texto:'Activá las calles y acercá el mapa para reconocer los principales corredores. Usalos como referencia para dibujar tu red.',
    practica:'Trazá una línea que acompañe una avenida y conecte varios barrios.',
    nota:'El metro no tiene que seguir obligatoriamente las calles.' },
  { id:2, titulo:'Densidad de población', subtitulo:'Acercá estaciones a las zonas habitadas',
    texto:'Los tonos violetas muestran la densidad del Censo 2011. Te ayudan a reconocer zonas donde una estación podría ampliar el acceso a la red.',
    practica:'Compará dos ubicaciones antes de colocar una estación.',
    nota:'No representa la población actual ni cuántas personas viajarían.' },
  { id:3, titulo:'Tráfico histórico', subtitulo:'Identificá corredores con actividad',
    texto:'Los colores permiten comparar la intensidad histórica de un mismo tramo según la hora. Usalos para estudiar dónde podría servir una alternativa de metro.',
    practica:'Observá cómo cambia una avenida durante el día.',
    nota:'Rojo no significa necesariamente congestión. No es tráfico en vivo.' },
  { id:4, titulo:'Desplazamientos', subtitulo:'Conectá orígenes y destinos',
    texto:'Las flechas muestran desplazamientos históricos entre zonas. Su dirección y grosor ayudan a reconocer relaciones que tu red podría atender.',
    practica:'Conectá dos sectores unidos por una flecha destacada.',
    nota:'La animación no representa la velocidad real de viaje.' },
  { id:5, titulo:'Horarios', subtitulo:'Mirá cómo cambia la ciudad',
    texto:'Una red puede responder a necesidades diferentes por la mañana y por la tarde. Cambiá la hora y compará el tráfico y los desplazamientos disponibles.',
    practica:'Revisá tu trazado en dos horarios diferentes.',
    nota:'Las fuentes pertenecen a períodos distintos. La población permanece fija.' },
  { id:6, titulo:'Cobertura', subtitulo:'Revisá hasta dónde llega tu red',
    texto:'La cobertura marca un radio de 500 metros alrededor de cada estación. Te ayuda a detectar zonas cercanas a la red y espacios que quedan fuera.',
    practica:'Mové una estación para cubrir otra zona.',
    nota:'El radio se mide en línea recta, no como recorrido peatonal.' },
  { id:7, titulo:'Diseño y simulación', subtitulo:'Poné a prueba tus decisiones',
    texto:'Combiná las capas para elegir el trazado. Después utilizá las distancias, UV y UT para comprobar cuánto recorre cada metro y si alcanza el final.',
    practica:'Conservá la misma red, horario y duración; cambiá la velocidad y compará.',
    nota:'Llegar antes y cubrir mejor el territorio son resultados diferentes.' },
]);

const estacion = (x,y) => `<circle cx="${x}" cy="${y}" r="10" fill="#091326" stroke="#70e5b1" stroke-width="5"/>`;
const texto = (x,y,t) => `<text x="${x}" y="${y}" text-anchor="middle" fill="#edf5ff" font-size="17">${t}</text>`;
const linea = '<path d="M90 180 220 150 350 200 510 155" fill="none" stroke="#48b4ff" stroke-width="6"/>';
const nodos = estacion(90,180)+estacion(220,150)+estacion(350,200)+estacion(510,155);
const flecha = '<path d="M165 95 Q300 45 440 100" fill="none" stroke="#ffd078" stroke-width="9"/><path d="m420 76 28 28-38 2" fill="#ffd078"/>';
const diagramas = [
  '<path d="M30 105H570M30 225H570M155 35V270M430 35V270" stroke="#426084" stroke-width="22"/><path d="M30 105H570" stroke="#ffd078" stroke-width="3" stroke-dasharray="14 12"/>'+linea+nodos,
  '<path d="M40 50H210V260H40Z" fill="#51416f"/><path d="M240 50H405V260H240Z" fill="#8f74c4"/><path d="M430 50H560V260H430Z" fill="#d7b9f0"/>'+linea+nodos+texto(300,32,'CENSO 2011'),
  '<path d="M50 145H215" stroke="#70e5b1" stroke-width="16"/><path d="M215 145H380" stroke="#ffd078" stroke-width="16"/><path d="M380 145H550" stroke="#ff858d" stroke-width="16"/>'+texto(300,80,'UN MISMO CORREDOR')+texto(130,210,'BAJO')+texto(298,210,'MEDIO')+texto(470,210,'ALTO'),
  '<path d="M45 130H140V245H45ZM465 110H560V230H465Z" fill="#18304d" stroke="#426084" stroke-dasharray="7 5"/>'+linea+nodos+flecha+texto(92,115,'ORIGEN')+texto(510,95,'DESTINO'),
  '<circle cx="160" cy="130" r="65" fill="#132641" stroke="#70e5b1" stroke-width="5"/><path d="M160 85v45l-35 25" fill="none" stroke="#edf5ff" stroke-width="6"/><circle cx="435" cy="130" r="65" fill="#132641" stroke="#ffd078" stroke-width="5"/><path d="M435 85v45h-45" fill="none" stroke="#edf5ff" stroke-width="6"/>'+texto(160,240,'08:00')+texto(435,240,'18:00'),
  '<g fill="#8f74c4" fill-opacity=".25" stroke="#bfa3ed" stroke-width="2" stroke-dasharray="7 5"><circle cx="90" cy="180" r="65"/><circle cx="220" cy="150" r="65"/><circle cx="350" cy="200" r="65"/><circle cx="510" cy="155" r="65"/></g>'+linea+nodos+texto(300,55,'500 m POR ESTACIÓN'),
  '<path d="M80 145H520" stroke="#48b4ff" stroke-width="6"/>'+estacion(80,145)+estacion(520,145)+'<path d="M80 195v15h440v-15" fill="none" stroke="#ffd078" stroke-width="3"/>'+texto(300,90,'12 km')+texto(300,260,'4 UV × 3 UT = 12 km'),
];
export function ilustracionExtra(id) {
  const tarjeta = TARJETAS_EXTRAS[id-1] ?? {titulo:'Herramientas del mapa'};
  const bienvenida = '<g fill="#8f74c4" fill-opacity=".25" stroke="#bfa3ed" stroke-dasharray="7 5"><circle cx="120" cy="165" r="70"/><circle cx="300" cy="165" r="70"/><circle cx="480" cy="215" r="70"/></g><path d="M120 165H300L480 215" stroke="#48b4ff" stroke-width="6" fill="none"/>'+estacion(120,165)+estacion(300,165)+estacion(480,215)+'<path d="M190 100h60l-12-12m12 12-12 12" fill="none" stroke="#ffd078" stroke-width="5"/><circle cx="480" cy="65" r="30" fill="none" stroke="#88d4ee" stroke-width="4"/><path d="M480 42v23h18" fill="none" stroke="#88d4ee" stroke-width="4"/>';
  return `<svg viewBox="0 0 600 300" role="img" aria-label="Esquema didáctico: ${tarjeta.titulo}" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="300" fill="#091326"/><path d="M0 50H600M0 100H600M0 150H600M0 200H600M0 250H600M50 0V300M100 0V300M150 0V300M200 0V300M250 0V300M300 0V300M350 0V300M400 0V300M450 0V300M500 0V300M550 0V300" stroke="#18304d"/>${id===0?bienvenida:diagramas[id-1]}</svg>`;
}
