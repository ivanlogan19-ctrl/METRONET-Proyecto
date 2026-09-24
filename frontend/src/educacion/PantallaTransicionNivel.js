import { obtenerContenidoNivel } from './ContenidoPreparacion.js';

function texto(etiqueta, valor, clase = '') {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = valor;
  elemento.className = clase;
  return elemento;
}

export async function mostrarTransicionNivel(anterior, siguiente, { puntaje, final = false, desempeno = null, resumen = null, ranking = null } = {}) {
  const contenido = obtenerContenidoNivel(anterior?.numero);
  const proximo = obtenerContenidoNivel(siguiente?.numero);
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-dialogo-cambios metronet-preparacion metronet-transicion';
  dialogo.setAttribute('aria-labelledby', 'tituloTransicionNivel');
  const cuerpo = document.createElement('section');
  cuerpo.className = 'metronet-dialogo-cambios__contenido metronet-preparacion__contenido';
  const titulo = texto('h2', final ? 'Recorrido completado' : 'Nivel completado');
  titulo.id = 'tituloTransicionNivel';
  titulo.tabIndex = -1;
  cuerpo.append(texto('p', final ? 'Campaña completa' : 'Aprender · Conectar · Avanzar', 'metronet-inicio__etiqueta'), titulo,
    texto('p', anterior?.nombre || `Nivel ${anterior?.numero ?? ''}`));
  if (Number.isFinite(puntaje)) cuerpo.append(texto('p', `Puntaje del intento: ${puntaje}${desempeno ? ` / ${desempeno.puntajeMaximo}` : ""}`, 'metronet-transicion__puntaje'));
  const agregarBloque = (titulo, valor) => {
    if (typeof valor !== 'string' || !valor.trim()) return;
    const bloque = document.createElement('section');
    bloque.className = 'metronet-preparacion__bloque';
    bloque.append(texto('h3', titulo), texto('p', valor));
    cuerpo.append(bloque);
  };
  agregarBloque('Tu resolución', desempeno?.explicacion);
  agregarBloque('Lo que aprendiste', contenido?.transicion?.aprendizaje);
  agregarBloque('Sobre Montevideo y su movilidad', contenido?.transicion?.ciudad);
  // Solo se publica historia revisada y con su fuente; no se infiere del nombre de un POI.
  if (contenido?.historia?.estado === 'VALIDADO' && contenido.historia.fuente) {
    agregarBloque('Contexto histórico', contenido.historia.texto);
    agregarBloque('Fuente', contenido.historia.fuente);
  }
  if (siguiente) {
    agregarBloque('Próximo desafío', `${siguiente.nombre || `Nivel ${siguiente.numero}`}. ${siguiente.objetivo || ''}`);
    agregarBloque('Pista para el próximo nivel', proximo?.preparacion?.consejo);
  } else {
    agregarBloque('Tu recorrido', final
      ? 'Completaste todos los niveles de esta campaña. Podés volver a jugar tus desafíos o explorar Modo Libre desde Escenarios.'
      : 'El resultado quedó registrado. Podés revisar tus avances y volver a jugar desde Escenarios.');
  }
  if (final && Array.isArray(resumen?.escenarios)) {
    const niveles = resumen.escenarios.filter(n => Number.isInteger(n.numero));
    agregarBloque('Desempeño global', `${resumen.nivelesCompletados} / ${resumen.cantidadNiveles} niveles. Mejores resultados acumulados: ${niveles.reduce((s, n) => s + (n.mejorPuntaje ?? 0), 0)} / ${niveles.reduce((s, n) => s + (n.puntajeMaximo ?? 100), 0)} puntos.${ranking?.tuPosicion ? ` Tu posición: ${ranking.tuPosicion}.` : ''}`);
    const lista = document.createElement('ul');
    for (const nivel of niveles) lista.append(texto('li', `Nivel ${nivel.numero}: ${nivel.mejorPuntaje ?? 0} / ${nivel.puntajeMaximo ?? 100} puntos`));
    cuerpo.append(lista);
    const enlace = texto('a', 'Ver mi desempeño y ranking'); enlace.href = '/ranking.html'; cuerpo.append(enlace);
  }
  const acciones = document.createElement('form');
  acciones.method = 'dialog';
  acciones.className = 'metronet-dialogo-cambios__acciones';
  const volver = texto('button', 'Revisar mi red');
  volver.type = 'submit'; volver.value = 'volver';
  const continuar = texto('button', siguiente ? `Continuar con Nivel ${siguiente.numero}` : 'Ver mis escenarios');
  continuar.type = 'submit'; continuar.value = 'continuar';
  continuar.dataset.continuarTransicion = '';
  acciones.append(volver, continuar);
  cuerpo.append(acciones); dialogo.append(cuerpo);
  document.body.append(dialogo);
  try {
    return await new Promise(resolve => {
      dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'continuar'), { once: true });
      dialogo.showModal();
      // En pantallas bajas el foco inicial en el botón desplaza y oculta el título.
      titulo.focus({ preventScroll: true });
      dialogo.scrollTop = 0;
    });
  } finally { dialogo.remove(); }
}
