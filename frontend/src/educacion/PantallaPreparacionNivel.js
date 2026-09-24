import { obtenerContenidoPreparacion } from './ContenidoPreparacion.js';

const BLOQUES_OPCIONALES = [
  ['contexto', 'En este nivel'],
  ['consejo', 'Consejo para empezar'],
  ['historia', 'Contexto histórico'],
  ['sociedad', 'Contexto social'],
];

function tieneTexto(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function crearTexto(etiqueta, texto, clase = '') {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = texto;
  elemento.className = clase;
  return elemento;
}

export async function mostrarPreparacionNivel(escenario) {
  let dialogo;
  try {
    const contenido = obtenerContenidoPreparacion(escenario);
    if (!contenido || !Object.values(contenido).some(tieneTexto)) return true;

    dialogo = document.createElement('dialog');
    dialogo.className = 'metronet-dialogo-cambios metronet-preparacion';
    dialogo.setAttribute('aria-labelledby', 'tituloPreparacionNivel');
    const cuerpo = document.createElement('section');
    cuerpo.className = 'metronet-dialogo-cambios__contenido metronet-preparacion__contenido';
    const titulo = crearTexto('h2', escenario.nombre || `Nivel ${escenario.numero}`);
    titulo.id = 'tituloPreparacionNivel';

    const recorrido = document.createElement('div');
    recorrido.className = 'metronet-preparacion__recorrido';
    recorrido.setAttribute('aria-hidden', 'true');
    for (let estacion = 0; estacion < 3; estacion += 1) recorrido.append(document.createElement('span'));

    cuerpo.append(
      crearTexto('p', 'Preparando nivel', 'metronet-inicio__etiqueta'),
      titulo,
      recorrido,
      crearTexto('p', 'Conocé las ideas que vas a usar. Comenzá cuando quieras.'),
    );
    if (tieneTexto(contenido.concepto)) cuerpo.append(crearTexto('h3', contenido.concepto));
    if (tieneTexto(contenido.explicacion)) cuerpo.append(crearTexto('p', contenido.explicacion));
    for (const [clave, etiqueta] of BLOQUES_OPCIONALES) {
      if (!tieneTexto(contenido[clave])) continue;
      const bloque = document.createElement('section');
      bloque.className = `metronet-preparacion__bloque metronet-preparacion__bloque--${clave}`;
      bloque.append(crearTexto('h3', etiqueta), crearTexto('p', contenido[clave]));
      cuerpo.append(bloque);
    }

    const acciones = document.createElement('form');
    acciones.method = 'dialog';
    acciones.className = 'metronet-dialogo-cambios__acciones';
    const volver = crearTexto('button', 'Volver');
    volver.type = 'submit';
    volver.value = 'volver';
    const comenzar = crearTexto('button', 'Comenzar nivel');
    comenzar.type = 'submit';
    comenzar.value = 'comenzar';
    comenzar.dataset.comenzarNivel = '';
    comenzar.autofocus = true;
    acciones.append(volver, comenzar);
    cuerpo.append(acciones);
    dialogo.append(cuerpo);
    document.body.append(dialogo);

    return await new Promise((resolver) => {
      dialogo.addEventListener('close', () => resolver(dialogo.returnValue === 'comenzar'), { once: true });
      dialogo.showModal();
    });
  } finally {
    // También libera la pantalla si falla el renderizado o showModal.
    dialogo?.remove();
  }
}
