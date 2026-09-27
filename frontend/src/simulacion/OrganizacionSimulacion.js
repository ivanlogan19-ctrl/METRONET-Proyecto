import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
// Organización de la vista; no interviene en el motor ni en los datos de la red.
export function inicializarOrganizacionSimulacion() {
  const pagina = document.body;
  const panel = document.getElementById('instrumentosSimulacion');
  const ampliar = document.getElementById('ampliarMapa');
  let idVisible = null;

  function establecerAmpliado(ampliado) {
    pagina.classList.toggle('simulacion-mapa-ampliado', ampliado);
    panel.hidden = ampliado;
    ampliar.setAttribute('aria-pressed', String(ampliado));
    configurarBotonIcono(ampliar, ampliado ? 'desplegar' : 'plegar', ampliado ? 'Mostrar panel' : 'Ocultar panel');
    ampliar.setAttribute('aria-expanded', String(!ampliado));
  }

  function abrirSeccion(id) {
    if (panel.hidden) establecerAmpliado(false);
    const seccion = document.getElementById(id);
    if (seccion.tagName === 'DETAILS') seccion.open = true;
    const control = seccion.querySelector('summary, input, select');
    control?.focus({ preventScroll: true });
    control?.scrollIntoView({ block: 'nearest' });
  }

  configurarBotonIcono(ampliar, 'plegar', 'Ocultar panel');
  ampliar.addEventListener('click', () => establecerAmpliado(!panel.hidden));
  document.getElementById('duracionSimulacion').addEventListener('invalid', evento => {
    abrirSeccion('seccionConfiguracion');
    // El foco final debe ir al dato inválido, incluso si su sección estaba cerrada.
    queueMicrotask(() => evento.target.focus());
  });

  return {
    abrirSeccion,
    mostrarDiseno(id) {
      document.querySelectorAll('[data-requiere-diseno]').forEach(e => { e.hidden = !id; });
      if (id !== idVisible) establecerAmpliado(!id);
      idVisible = id;
    },
  };
}
