import { crearLogoMetronet } from '../componentes/LogoMetronet.js';
import { crearEscenaFerroviaria } from './EscenaFerroviaria.js';
import './bienvenida.css';

// Exclusiva del login. La escena no decide permisos, destinos ni primer acceso.
export function crearPantallaBienvenida(cobertura, { reducido, continuar, inicio, obtenerTiempo = () => performance.now() - inicio, duracionSalida = 450 }) {
  cobertura.dataset.fase = reducido ? 'bienvenida' : 'anden';
  cobertura.style.setProperty('--bienvenida-duracion-salida', `${duracionSalida}ms`);
  cobertura.innerHTML = `
    <div class="metronet-bienvenida__marco" aria-hidden="true"></div>
    <header class="metronet-bienvenida__cabecera">
      <span>METRONET <span class="metronet-bienvenida__separador">//</span> LAST TRAIN 198X</span>
      <span class="metronet-bienvenida__senal">ACCESO CONCEDIDO</span>
    </header>
    <main class="metronet-bienvenida__centro">
      <div data-marca-bienvenida></div>
      <div class="metronet-bienvenida__saludo">
        <p class="metronet-bienvenida__etiqueta">PRÓXIMA PARADA</p>
        <h1>Bienvenido a METRONET</h1>
        <p class="metronet-bienvenida__lema">DISEÑÁ · CONECTÁ · SIMULÁ</p>
      </div>
    </main>
    <div class="metronet-bienvenida__anden" aria-hidden="true">
      <div class="metronet-bienvenida__rotulo"><span>VÍA 01</span><span>→ METRONET</span></div>
      <div class="metronet-bienvenida__escena"><canvas class="metronet-bienvenida__ferrocarril"></canvas></div>
    </div>
    <footer class="metronet-bienvenida__pie">
      <p><span class="metronet-bienvenida__indicador" aria-hidden="true"></span> TU RED EMPIEZA ACÁ</p>
      <button type="button" data-continuar-bienvenida>Continuar →</button>
    </footer>
    <div class="metronet-bienvenida__salida" aria-hidden="true"></div>`;
  const marca = crearLogoMetronet({ alt: 'Logo oficial de METRONET' });
  const imagen = marca.querySelector('img');
  const falloImagen = () => continuar();
  imagen.addEventListener('error', falloImagen, { once: true });
  const marcaEnEscena = cobertura.querySelector('[data-marca-bienvenida]');
  marcaEnEscena.style.opacity = reducido ? '1' : '0';
  marcaEnEscena.style.transform = reducido ? 'none' : 'translateY(20px)';
  marcaEnEscena.append(marca);
  cobertura.querySelector('[data-continuar-bienvenida]').addEventListener('click', continuar);
  const escena = crearEscenaFerroviaria(cobertura.querySelector('canvas'), { reducido, inicio, obtenerTiempo, alFallar: continuar });
  let frame;
  function actualizarFase() {
    const tiempo = obtenerTiempo();
    const avanceLogo = Math.max(0, Math.min(1, (tiempo - 450) / 1800));
    const suavizado = 1 - (1 - avanceLogo) ** 3;
    marcaEnEscena.style.opacity = String(suavizado);
    marcaEnEscena.style.transform = `translateY(${Math.round((1 - suavizado) * 20)}px)`;
    cobertura.dataset.fase = tiempo >= 4750 ? 'salida' : tiempo >= 2800 ? 'bienvenida' : tiempo >= 1400 ? 'viaje' : 'anden';
    if (tiempo < 4750) frame = requestAnimationFrame(actualizarFase);
  }
  if (!reducido) actualizarFase();
  if (imagen.complete && !imagen.naturalWidth) continuar();
  return { eliminar() { escena.eliminar(); cancelAnimationFrame(frame); imagen.removeEventListener('error', falloImagen); } };
}
