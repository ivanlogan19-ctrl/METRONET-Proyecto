import { crearDibujoEntradaModoLibre } from './DibujoEntradaModoLibre.js';
import '../../interfaz/pestanas.css';
import './entrada-modo-libre.css';

export function crearEntradaModoLibre(dialogo, alTerminar) {
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 450;
  canvas.setAttribute('aria-hidden', 'true');
  const titulo = document.createElement('h2');
  titulo.id = 'tituloExtras';
  titulo.textContent = 'Modo libre';
  titulo.className = 'metronet-entrada-libre__accesible';
  const continuar = document.createElement('button');
  continuar.type = 'button';
  continuar.dataset.continuarBienvenida = '';
  continuar.textContent = 'Continuar →';
  dialogo.classList.add('metronet-extras--entrada');
  dialogo.replaceChildren(titulo, canvas, continuar);
  let cuadro, anterior = null, tiempo = 0, terminada = false;
  function cambiarVisibilidad() { anterior = null; }
  function eliminar() {
    terminada = true;
    cancelAnimationFrame(cuadro);
    document.removeEventListener('visibilitychange', cambiarVisibilidad);
    continuar.removeEventListener('click', finalizar);
    dialogo.removeEventListener('cancel', omitir);
    dialogo.classList.remove('metronet-extras--entrada');
  }
  function finalizar() {
    if (terminada) return;
    eliminar();
    alTerminar();
  }
  function omitir(evento) {
    evento.preventDefault();
    finalizar();
  }
  continuar.addEventListener('click', finalizar);
  dialogo.addEventListener('cancel', omitir);
  continuar.focus({ preventScroll: true });
  try {
    const dibujar = crearDibujoEntradaModoLibre(canvas);
    dibujar(0);
    document.addEventListener('visibilitychange', cambiarVisibilidad);
    function actualizar(ahora) {
      if (terminada) return;
      if (!document.hidden && anterior !== null) tiempo += ahora - anterior;
      anterior = document.hidden ? null : ahora;
      dibujar(tiempo);
      if (tiempo >= 4200) { finalizar(); return; }
      cuadro = requestAnimationFrame(actualizar);
    }
    cuadro = requestAnimationFrame(actualizar);
  } catch { finalizar(); }
  return eliminar;
}
