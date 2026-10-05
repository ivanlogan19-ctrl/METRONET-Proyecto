// Una vista se expresa en grados y píxeles de canvas por grado. El zoom de
// Phaser y las coordenadas de mundo dependen del tamaño de cada escena.
const CLAVE_NAVEGACION = 'metronet:vista-geografica-navegacion';
const VIGENCIA_MS = 5 * 60 * 1000;

export function capturarVistaGeografica(camara, limites, geografia, rotacion = camara?.rotation) {
  const anchoGeografico = geografia?.maxX - geografia?.minX;
  const altoGeografico = geografia?.maxY - geografia?.minY;
  const anchoMapa = limites?.maximoX - limites?.minimoX;
  const altoMapa = limites?.maximoY - limites?.minimoY;
  const escala = anchoMapa / anchoGeografico;
  if (!camara || !Number.isFinite(escala) || escala <= 0 ||
      !Number.isFinite(altoGeografico) || altoGeografico <= 0 ||
      !Number.isFinite(altoMapa) || altoMapa <= 0) return null;

  const centroX = camara.midPoint.x;
  const centroY = camara.midPoint.y;
  const vista = {
    longitud: geografia.minX + (centroX - limites.minimoX) / escala,
    latitud: geografia.maxY - (centroY - limites.minimoY) / escala,
    escalaVisible: camara.zoom * escala,
    rotacion,
  };
  return vistaGeograficaValida(vista) ? vista : null;
}

export function proyectarVistaGeografica(vista, transformacion, geografia) {
  if (!vistaGeograficaValida(vista) || !Number.isFinite(transformacion?.escala) ||
      transformacion.escala <= 0 || !geografia) return null;
  return {
    x: transformacion.offsetX + (vista.longitud - geografia.minX) * transformacion.escala,
    y: transformacion.offsetY + (geografia.maxY - vista.latitud) * transformacion.escala,
    zoom: vista.escalaVisible / transformacion.escala,
    rotacion: vista.rotacion,
  };
}

export function vistaGeograficaValida(vista) {
  return ['longitud', 'latitud', 'escalaVisible', 'rotacion']
    .every(clave => Number.isFinite(vista?.[clave])) && vista.escalaVisible > 0 &&
    ['escalaVisibleMinima', 'escalaVisibleMaxima'].every(clave =>
      vista?.[clave] === undefined || (Number.isFinite(vista[clave]) && vista[clave] > 0));
}

function identidadSesion(sesion) {
  if (!sesion?.token || !sesion?.usuario) return null;
  const usuario = sesion.usuario;
  // La huella distingue nuevas sesiones sin copiar el token a sessionStorage.
  let huella = 2166136261;
  for (const caracter of sesion.token) huella = Math.imul(huella ^ caracter.charCodeAt(0), 16777619);
  return `${usuario.rol}:${usuario.idUsuario ?? usuario.idAdministrador ?? usuario.identificadorAdministrador}:${sesion.fechaInicio ?? ''}:${huella >>> 0}`;
}

export function guardarVistaParaNavegacion(idDiseno, vista, sesion, destino) {
  const identidad = identidadSesion(sesion);
  if (!idDiseno || !identidad || !vistaGeograficaValida(vista)) return false;
  try {
    sessionStorage.setItem(CLAVE_NAVEGACION, JSON.stringify({
      idDiseno: String(idDiseno), identidad, destino, vista, creada: Date.now(),
    }));
    return true;
  } catch { return false; }
}

export function consumirVistaParaNavegacion(idDiseno, sesion, destino) {
  let registro;
  try {
    registro = JSON.parse(sessionStorage.getItem(CLAVE_NAVEGACION));
    sessionStorage.removeItem(CLAVE_NAVEGACION);
  } catch { return null; }
  if (registro?.idDiseno !== String(idDiseno) || registro.identidad !== identidadSesion(sesion) ||
      registro.destino !== destino || !Number.isFinite(registro.creada) ||
      Date.now() - registro.creada > VIGENCIA_MS || Date.now() < registro.creada ||
      !vistaGeograficaValida(registro.vista)) return null;
  return registro.vista;
}
