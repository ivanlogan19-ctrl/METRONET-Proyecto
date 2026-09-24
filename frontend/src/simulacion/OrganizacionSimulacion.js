// Organización de la vista; no interviene en el motor ni en los datos de la red.
export function inicializarOrganizacionSimulacion(alRedimensionar) {
  const pagina = document.body;
  const panel = document.getElementById('instrumentosSimulacion');
  const ampliar = document.getElementById('ampliarMapa');
  let idVisible = null;

  function establecerAmpliado(ampliado) {
    pagina.classList.toggle('simulacion-mapa-ampliado', ampliado);
    panel.hidden = ampliado;
    ampliar.setAttribute('aria-pressed', String(ampliado));
    ampliar.textContent = ampliado ? 'Restaurar panel' : 'Ampliar mapa';
    requestAnimationFrame(alRedimensionar);
  }

  function abrirSeccion(id) {
    if (panel.hidden) establecerAmpliado(false);
    const seccion = document.getElementById(id);
    seccion.open = true;
    const resumen = seccion.querySelector('summary');
    resumen.focus({ preventScroll: true });
    resumen.scrollIntoView({ block: 'nearest' });
  }

  ampliar.addEventListener('click', () => establecerAmpliado(!panel.hidden));
  document.getElementById('verConsignaCompleta').addEventListener('click', () => abrirSeccion('consignaSimulacion'));
  document.getElementById('duracionSimulacion').addEventListener('invalid', evento => {
    abrirSeccion('seccionConfiguracion');
    // El foco final debe ir al dato inválido, incluso si su sección estaba cerrada.
    queueMicrotask(() => evento.target.focus());
  });

  return {
    abrirSeccion,
    mostrarDiseno(id) {
      document.querySelectorAll('[data-requiere-diseno]').forEach(e => { e.hidden = !id; });
      if (id !== idVisible) document.getElementById('seccionDisenos').open = !id;
      if (!id) establecerAmpliado(false);
      idVisible = id;
    },
  };
}
