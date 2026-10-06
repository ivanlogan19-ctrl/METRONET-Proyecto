import { crearLogoMetronet } from '../componentes/LogoMetronet.js';
import { crearEscenaFerroviaria } from './EscenaFerroviaria.js';
import './bienvenida.css';

// Exclusiva del login. La escena no decide permisos, destinos ni primer acceso.
export function crearPantallaBienvenida(cobertura, { reducido, continuar, inicio, obtenerTiempo = () => performance.now() - inicio, duracionSalida = 450, sinSalida = false }) {
  cobertura.dataset.fase = reducido ? 'bienvenida' : 'anden';
  cobertura.style.setProperty('--bienvenida-duracion-salida', `${duracionSalida}ms`);
  cobertura.innerHTML = `
    <div class="metronet-bienvenida__marco" aria-hidden="true"></div>
    <main class="metronet-bienvenida__centro">
      <h1 class="metronet-bienvenida__intro">Bienvenido a</h1>
      <div data-marca-bienvenida></div>
    </main>
    <div class="metronet-bienvenida__anden" aria-hidden="true">
      <div class="metronet-bienvenida__escena"><canvas class="metronet-bienvenida__ferrocarril"></canvas></div>
    </div>
    <footer class="metronet-bienvenida__pie">
      <button type="button" data-continuar-bienvenida>Continuar →</button>
    </footer>
    <div class="metronet-bienvenida__salida" aria-hidden="true"></div>`;
  const marca = crearLogoMetronet({ alt: 'Logo oficial de METRONET' });
  const imagen = marca.querySelector('img');
  const falloImagen = () => continuar();
  imagen.addEventListener('error', falloImagen, { once: true });
  const marcaEnEscena = cobertura.querySelector('[data-marca-bienvenida]');
  const intro = cobertura.querySelector('.metronet-bienvenida__intro');
  intro.style.opacity = reducido ? '0' : '1';
  intro.style.visibility = reducido ? 'hidden' : 'visible';
  marcaEnEscena.style.opacity = reducido ? '1' : '0';
  marcaEnEscena.style.transform = reducido ? 'none' : 'translateY(20px)';
  marcaEnEscena.append(marca);
  cobertura.querySelector('[data-continuar-bienvenida]').addEventListener('click', continuar);
  const escena = crearEscenaFerroviaria(cobertura.querySelector('canvas'), { reducido, inicio, obtenerTiempo, alFallar: continuar });
  let frame;
  function actualizarFase() {
    const tiempo = obtenerTiempo();
    const avanceIntro = Math.max(0, Math.min(1, (tiempo - 850) / 450));
    intro.style.opacity = String(1 - avanceIntro);
    intro.style.visibility = avanceIntro >= 1 ? 'hidden' : 'visible';
    const avanceLogo = Math.max(0, Math.min(1, (tiempo - 1500) / 1100));
    const suavizado = 1 - (1 - avanceLogo) ** 3;
    marcaEnEscena.style.opacity = String(suavizado);
    marcaEnEscena.style.transform = `translateY(${Math.round((1 - suavizado) * 20)}px)`;
    cobertura.dataset.fase = tiempo >= 4750 && !sinSalida ? 'salida' : tiempo >= 2800 ? 'bienvenida' : tiempo >= 1400 ? 'viaje' : 'anden';
    if (tiempo < 4750) frame = requestAnimationFrame(actualizarFase);
  }
  if (!reducido) actualizarFase();
  if (imagen.complete && !imagen.naturalWidth) continuar();
  return { eliminar() { escena.eliminar(); cancelAnimationFrame(frame); imagen.removeEventListener('error', falloImagen); } };
}
