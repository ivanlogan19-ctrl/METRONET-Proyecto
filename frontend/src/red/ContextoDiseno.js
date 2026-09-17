const CLAVES_CONTEXTO = ['idDiseno', 'idEscenario', 'idIntento'];

function obtenerIdentificador(parametros, clave) {
  const valor = Number(parametros.get(clave));
  return Number.isInteger(valor) && valor > 0 ? valor : null;
}

export function obtenerContextoRuta() {
  const parametros = new URLSearchParams(window.location.search);
  return Object.fromEntries(CLAVES_CONTEXTO.map((clave) => [clave, obtenerIdentificador(parametros, clave)]));
}

export function obtenerIdDisenoDeRuta() {
  return obtenerContextoRuta().idDiseno;
}

export function establecerContextoEnRuta(ruta, contexto = obtenerContextoRuta()) {
  const url = new URL(ruta, window.location.origin);
  CLAVES_CONTEXTO.forEach((clave) => {
    const valor = Number(contexto[clave]);
    if (Number.isInteger(valor) && valor > 0) url.searchParams.set(clave, String(valor));
    else url.searchParams.delete(clave);
  });
  return `${url.pathname}${url.search}${url.hash}`;
}

export function establecerIdDisenoEnRuta(ruta, idDiseno, contexto = obtenerContextoRuta()) {
  return establecerContextoEnRuta(ruta, { ...contexto, idDiseno });
}

export function actualizarRutaEdicion(idDiseno, contexto = obtenerContextoRuta()) {
  window.history.replaceState({}, '', establecerIdDisenoEnRuta('/', idDiseno, contexto));
}
