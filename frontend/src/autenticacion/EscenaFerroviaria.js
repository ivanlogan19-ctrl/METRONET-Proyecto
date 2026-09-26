// Pixel art original de METRONET, dibujado en una retícula entera. No utiliza
// sprites externos, SVG, interpolación, partículas ni datos de la simulación.
const ALTO = 96;
const CUADRO_MS = 1000 / 24;
const INICIO_TREN = 1400;
const FIN_TREN = 4700;
const C = Object.freeze({ fondo: '#060c1c', tunel: '#020611', marco: '#26415d', acero: '#afc1db', luz: '#edf5ff', azul: '#299fee', ventana: '#76c7ff', sombra: '#132641', ambar: '#ffd078', verde: '#70e5b1' });

function pintarVagon(ctx, x, y, cabina, cuadro) {
  const r = (dx, dy, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x + dx, y + dy, w, h); };
  r(4, 0, 44, 3, C.marco); r(2, 3, 48, 24, C.acero);
  r(0, 7, 2, 18, C.marco); r(50, cabina ? 7 : 4, 3, cabina ? 19 : 22, C.acero);
  r(4, 3, 42, 2, C.luz); r(2, 20, 51, 6, C.azul); r(2, 26, 51, 2, C.marco);
  for (const ventana of [5, 15, 34, 44]) {
    r(ventana, 7, 7, 10, C.sombra); r(ventana + 1, 8, 5, 7, C.ventana);
    r(ventana + 1, 8, 5, 1, C.luz);
  }
  r(24, 5, 8, 21, C.marco); r(25, 7, 6, 9, C.ventana); r(28, 5, 1, 21, C.acero);
  r(7, 28, 39, 3, C.sombra);
  for (const rueda of [8, 39]) {
    r(rueda, 29, 7, 5, C.tunel); r(rueda + 1, 29, 5, 4, C.acero);
    const [dx, dy] = [[1, 1], [3, 0], [4, 2], [2, 3]][cuadro];
    r(rueda + dx, 29 + dy, 2, 1, C.sombra);
  }
  if (cabina) { r(51, 17, 3, 3, C.ambar); r(47, 2, 2, 3, C.acero); }
  else r(53, 24, 4, 2, C.marco);
}

export function crearEscenaFerroviaria(canvas, { reducido, inicio, alFallar, obtenerTiempo = () => performance.now() - inicio }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('La escena ferroviaria no está disponible.');
  let ancho = 0, frame, ultimoCuadro = -Infinity, eliminada = false;
  const r = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };

  function dibujar(tiempo) {
    r(0, 0, ancho, ALTO, C.fondo);
    r(0, 87, ancho, 9, C.tunel);
    // La vía se construye en bloques; no es una barra de carga de backend.
    const avanceVia = reducido ? 1 : Math.max(0, Math.min(1, (tiempo - 500) / 800));
    const limiteVia = Math.ceil(ancho * avanceVia / 12) * 12;
    for (let x = 0; x < limiteVia; x += 12) r(x, 72, 5, 15, C.marco);
    if (limiteVia) {
      r(0, 73, limiteVia, 2, C.acero); r(0, 75, limiteVia, 1, C.sombra);
      r(0, 82, limiteVia, 2, C.acero); r(0, 84, limiteVia, 1, C.sombra);
    }
    const senal = ancho - 48;
    r(senal + 3, 31, 2, 41, C.marco); r(senal, 23, 9, 18, C.acero); r(senal + 1, 24, 7, 16, C.tunel);
    r(senal + 3, 27, 3, 3, !reducido && tiempo < INICIO_TREN ? C.ambar : C.sombra);
    r(senal + 3, 34, 3, 3, reducido || tiempo >= INICIO_TREN ? C.verde : C.sombra);
    const vagones = ancho >= 300 ? 3 : 2;
    const largo = vagones * 58 - 4;
    const avance = (tiempo - INICIO_TREN) / (FIN_TREN - INICIO_TREN);
    const x = reducido ? Math.floor((ancho - largo) / 2) : Math.floor(-largo + avance * (ancho + largo));
    if (reducido || (avance >= 0 && avance <= 1)) {
      const cuadro = reducido ? 0 : Math.floor(tiempo / 125) % 4;
      for (let i = 0; i < vagones; i++) pintarVagon(ctx, x + i * 58, 40, i === vagones - 1, cuadro);
    }
    // Portales en primer plano: el metro entra y sale por debajo de la marca.
    for (const lado of [0, ancho - 20]) {
      r(lado, 33, 20, 54, C.marco); r(lado + 2, 29, 16, 4, C.marco);
      r(lado + 4, 25, 12, 4, C.marco); r(lado + 3, 38, 14, 49, C.tunel);
      r(lado + 5, 35, 10, 3, C.tunel); r(lado, 87, 20, 2, C.azul);
    }
  }

  function redimensionar() {
    const disponible = Math.max(1, Math.floor(canvas.parentElement.clientWidth));
    const escalaPorAncho = disponible >= 1100 ? 4 : disponible >= 500 ? 3 : 2;
    const escalaPorAlto = window.innerHeight <= 520 ? 1 : window.innerHeight <= 740 ? 2 : 4;
    const escala = Math.min(escalaPorAncho, escalaPorAlto);
    ancho = Math.max(1, Math.floor(disponible / escala));
    canvas.width = ancho; canvas.height = ALTO;
    canvas.style.width = `${ancho * escala}px`;
    canvas.style.height = `${ALTO * escala}px`;
    ctx.imageSmoothingEnabled = false;
    dibujar(obtenerTiempo());
  }
  function eliminar() {
    eliminada = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', alRedimensionar);
  }
  function alRedimensionar() { try { redimensionar(); } catch { eliminar(); alFallar(); } }
  function animar(ahora) {
    if (eliminada) return;
    try {
      const tiempo = obtenerTiempo();
      if (ahora - ultimoCuadro >= CUADRO_MS) {
        dibujar(tiempo);
        ultimoCuadro = ahora;
      }
      if (tiempo < FIN_TREN) frame = requestAnimationFrame(animar);
    } catch { eliminar(); alFallar(); }
  }
  redimensionar();
  window.addEventListener('resize', alRedimensionar);
  if (!reducido) frame = requestAnimationFrame(animar);
  return { eliminar };
}
