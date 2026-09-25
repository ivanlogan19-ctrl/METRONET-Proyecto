import { crearLogoMetronet } from '../componentes/LogoMetronet.js';
import { crearEscenaFerroviaria } from './EscenaFerroviaria.js';
import './bienvenida.css';

// Exclusiva del login. La escena no decide permisos, destinos ni primer acceso.
export function crearPantallaBienvenida(cobertura, { reducido, continuar, inicio }) {
  cobertura.dataset.fase = reducido ? 'bienvenida' : 'anden';
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
  cobertura.querySelector('[data-marca-bienvenida]').append(marca);
  cobertura.querySelector('[data-continuar-bienvenida]').addEventListener('click', continuar);
  const escena = crearEscenaFerroviaria(cobertura.querySelector('canvas'), { reducido, inicio, alFallar: continuar });
  const temporizadores = [];
  if (!reducido) for (const [demora, fase] of [[1400, 'viaje'], [2800, 'bienvenida'], [4750, 'salida']]) {
    temporizadores.push(setTimeout(() => { cobertura.dataset.fase = fase; }, Math.max(0, demora - (performance.now() - inicio))));
  }
  if (imagen.complete && !imagen.naturalWidth) continuar();
  return { eliminar() { escena.eliminar(); temporizadores.forEach(clearTimeout); imagen.removeEventListener('error', falloImagen); } };
}
