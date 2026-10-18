// Material didáctico de las capas existentes; no altera UV, UT ni la simulación.
export const TARJETAS_EXTRAS = Object.freeze([
  {
    "id": 1,
    "titulo": "Calles y avenidas",
    "subtitulo": "Orientá el trazado en el territorio",
    "texto": "La capa de calles muestra referencias viales para ubicar estaciones y reconocer corredores entre barrios.",
    "aporte": "Te permite relacionar el trazado con la estructura urbana antes de construir estaciones y conexiones en el editor.",
    "practica": "Activá Calles y acercá el mapa. Identificá una avenida, ubicá estaciones próximas a sectores que querés conectar y compará dos trazados posibles.",
    "justificacion": "Justificá por qué elegiste ese corredor y qué sectores conecta.",
    "nota": "Es una referencia cartográfica: no obliga al metro a seguir las calles ni acredita la viabilidad de una obra."
  },
  {
    "id": 2,
    "titulo": "Densidad de población",
    "subtitulo": "Fundamentá dónde ubicar estaciones",
    "texto": "Los tonos violetas representan la densidad del Censo 2023 y permiten comparar la distribución territorial de la población.",
    "aporte": "Apoya la selección de ubicaciones y la revisión de zonas habitadas que quedan próximas o alejadas de tu red.",
    "practica": "Activá Población y Cobertura. Compará dos ubicaciones de una estación y observá qué áreas quedan dentro de su radio.",
    "justificacion": "Explicá qué cambia en el alcance territorial al mover la estación.",
    "nota": "La densidad histórica no equivale a población actual ni a cantidad de pasajeros del metro."
  },
  {
    "id": 3,
    "titulo": "Tráfico histórico",
    "subtitulo": "Observá la variación de un corredor",
    "texto": "La capa representa la intensidad histórica relativa de cada tramo según la hora seleccionada.",
    "aporte": "Ayuda a formular una alternativa de trazado en corredores con actividad y a contextualizar la red que vas a simular.",
    "practica": "Elegí una avenida y compará su color a las 08:00 y a las 18:00. Usá esa observación para argumentar dónde estudiar una conexión.",
    "justificacion": "Describí la diferencia horaria del mismo tramo; no ordenes avenidas solo por su color.",
    "nota": "Rojo no significa congestión. La escala es relativa a cada tramo y los datos no son de tráfico en vivo."
  },
  {
    "id": 4,
    "titulo": "Desplazamientos",
    "subtitulo": "Relacioná orígenes y destinos",
    "texto": "Las flechas representan flujos históricos entre zonas; su dirección y grosor ayudan a interpretar relaciones territoriales.",
    "aporte": "Apoya la elección de sectores a conectar y la comparación entre un enlace directo y un recorrido que pasa por otras estaciones.",
    "practica": "Seleccioná una hora. Identificá un flujo destacado, ubicá sus zonas de origen y destino y trazá una alternativa que las vincule.",
    "justificacion": "Justificá qué relación territorial atiende tu propuesta y qué recorrido requiere.",
    "nota": "Son flujos históricos de referencia: no son pasajeros simulados. La animación no indica velocidad real de viaje."
  },
  {
    "id": 5,
    "titulo": "Horarios",
    "subtitulo": "Compará escenarios temporales",
    "texto": "El control horario permite observar tráfico y desplazamientos en distintas horas. En simulación se muestra inicio, hora actual y fin.",
    "aporte": "Permite analizar una misma red bajo distintos contextos horarios, sin confundir la hora de las capas con la velocidad del metro.",
    "practica": "En el mapa, compará 08:00 y 18:00. En simulación, fijá una hora de inicio y mantené la red, la velocidad y la duración para observar el contexto.",
    "justificacion": "Separá lo que cambia en las capas históricas de lo que cambia en el movimiento de las unidades.",
    "nota": "La población permanece fija. Las fuentes pertenecen a períodos distintos; cambiar la hora no crea demanda de pasajeros."
  },
  {
    "id": 6,
    "titulo": "Cobertura",
    "subtitulo": "Evaluá la proximidad a las estaciones",
    "texto": "La herramienta dibuja un radio de 500 metros alrededor de cada estación.",
    "aporte": "Permite detectar áreas próximas a la red, vacíos y superposiciones, y orientar la ubicación o el desplazamiento de estaciones.",
    "practica": "Activá Cobertura. Compará dos ubicaciones de una estación y revisá qué zonas se incorporan o dejan de quedar dentro del radio.",
    "justificacion": "Argumentá el equilibrio entre ampliar el área alcanzada y mantener un trazado coherente.",
    "nota": "El radio se mide en línea recta: no representa caminos peatonales, barreras urbanas ni tiempo real de acceso."
  },
  {
    "id": 7,
    "titulo": "Diseño y simulación",
    "subtitulo": "Contrastá una decisión con una prueba",
    "texto": "El editor permite construir estaciones, líneas y conexiones; la simulación permite observar el recorrido de las unidades con velocidad y duración elegidas.",
    "aporte": "Vincula una hipótesis de diseño con una prueba controlada: la cobertura territorial y el desempeño del recorrido se evalúan por separado.",
    "practica": "Guardá la red y ejecutala. Repetí con la misma red, unidades y hora de inicio. Modificá la velocidad de una línea, observá la duración calculada automáticamente y compará el tiempo de recorrido.",
    "justificacion": "Registrá la variable modificada y explicá el resultado usando las distancias y las equivalencias de UV y UT del juego.",
    "nota": "Llegar antes no implica cubrir mejor. La simulación didáctica no certifica demanda, capacidad ni factibilidad de una red real."
  }
]);

const estacion = (x,y) => `<circle cx="${x}" cy="${y}" r="10" fill="#091326" stroke="#70e5b1" stroke-width="5"/>`;
const texto = (x,y,t) => `<text x="${x}" y="${y}" text-anchor="middle" fill="#edf5ff" font-size="17">${t}</text>`;
const LINEA = '<path d="M90 180 220 150 350 200 510 155" fill="none" stroke="#48b4ff" stroke-width="6"/>';
const NODOS = estacion(90,180)+estacion(220,150)+estacion(350,200)+estacion(510,155);
const FLECHA = '<path d="M165 95 Q300 45 440 100" fill="none" stroke="#ffd078" stroke-width="9"/><path d="m420 76 28 28-38 2" fill="#ffd078"/>';
const DIAGRAMAS = [
  '<path d="M30 105H570M30 225H570M155 35V270M430 35V270" stroke="#426084" stroke-width="22"/><path d="M30 105H570" stroke="#ffd078" stroke-width="3" stroke-dasharray="14 12"/>'+LINEA+NODOS,
  '<path d="M40 50H210V260H40Z" fill="#51416f"/><path d="M240 50H405V260H240Z" fill="#8f74c4"/><path d="M430 50H560V260H430Z" fill="#d7b9f0"/>'+LINEA+NODOS+texto(300,32,'CENSO 2023'),
  '<path d="M50 145H215" stroke="#70e5b1" stroke-width="16"/><path d="M215 145H380" stroke="#ffd078" stroke-width="16"/><path d="M380 145H550" stroke="#ff858d" stroke-width="16"/>'+texto(300,80,'UN MISMO CORREDOR')+texto(130,210,'BAJO')+texto(298,210,'MEDIO')+texto(470,210,'ALTO'),
  '<path d="M45 130H140V245H45ZM465 110H560V230H465Z" fill="#18304d" stroke="#426084" stroke-dasharray="7 5"/>'+LINEA+NODOS+FLECHA+texto(92,115,'ORIGEN')+texto(510,95,'DESTINO'),
  '<circle cx="160" cy="130" r="65" fill="#132641" stroke="#70e5b1" stroke-width="5"/><path d="M160 85v45l-35 25" fill="none" stroke="#edf5ff" stroke-width="6"/><circle cx="435" cy="130" r="65" fill="#132641" stroke="#ffd078" stroke-width="5"/><path d="M435 85v45h-45" fill="none" stroke="#edf5ff" stroke-width="6"/>'+texto(160,240,'08:00')+texto(435,240,'18:00'),
  '<g fill="#8f74c4" fill-opacity=".25" stroke="#bfa3ed" stroke-width="2" stroke-dasharray="7 5"><circle cx="90" cy="180" r="65"/><circle cx="220" cy="150" r="65"/><circle cx="350" cy="200" r="65"/><circle cx="510" cy="155" r="65"/></g>'+LINEA+NODOS+texto(300,55,'500 m POR ESTACIÓN'),
  '<path d="M80 145H520" stroke="#48b4ff" stroke-width="6"/>'+estacion(80,145)+estacion(520,145)+'<path d="M80 195v15h440v-15" fill="none" stroke="#ffd078" stroke-width="3"/>'+texto(300,90,'12 km')+texto(300,260,'4 UV × 3 UT = 12 km'),
];
export function ilustracionExtra(id) {
  const tarjeta = TARJETAS_EXTRAS[id-1] ?? {titulo:'Herramientas del mapa'};
  const bienvenida = '<g fill="#8f74c4" fill-opacity=".25" stroke="#bfa3ed" stroke-dasharray="7 5"><circle cx="120" cy="165" r="70"/><circle cx="300" cy="165" r="70"/><circle cx="480" cy="215" r="70"/></g><path d="M120 165H300L480 215" stroke="#48b4ff" stroke-width="6" fill="none"/>'+estacion(120,165)+estacion(300,165)+estacion(480,215)+'<path d="M190 100h60l-12-12m12 12-12 12" fill="none" stroke="#ffd078" stroke-width="5"/><circle cx="480" cy="65" r="30" fill="none" stroke="#88d4ee" stroke-width="4"/><path d="M480 42v23h18" fill="none" stroke="#88d4ee" stroke-width="4"/>';
  return `<svg viewBox="0 0 600 300" role="img" aria-label="Esquema didáctico: ${tarjeta.titulo}" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="300" fill="#091326"/><path d="M0 50H600M0 100H600M0 150H600M0 200H600M0 250H600M50 0V300M100 0V300M150 0V300M200 0V300M250 0V300M300 0V300M350 0V300M400 0V300M450 0V300M500 0V300M550 0V300" stroke="#18304d"/>${id===0?bienvenida:DIAGRAMAS[id-1]}</svg>`;
}
