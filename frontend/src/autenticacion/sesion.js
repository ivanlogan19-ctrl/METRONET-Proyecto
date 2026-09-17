const CLAVE_USUARIO = 'usuario';
const CLAVE_SESION_USUARIO = 'sesionUsuario';
const CLAVE_SESION_ADMINISTRADOR = 'sesionAdministrador';

function obtenerSesion(clave, rol) {
  try {
    const sesion = JSON.parse(window.localStorage.getItem(clave));
    return sesion?.token && sesion?.usuario?.rol === rol ? sesion : null;
  } catch {
    window.localStorage.removeItem(clave);
    return null;
  }
}

export function obtenerSesionUsuario() {
  return obtenerSesion(CLAVE_SESION_USUARIO, 'JUGADOR');
}

export function obtenerSesionAdministrador() {
  return obtenerSesion(CLAVE_SESION_ADMINISTRADOR, 'ADMIN');
}

export function obtenerSesionActiva() {
  const sesionUsuario = obtenerSesionUsuario();
  const sesionAdministrador = obtenerSesionAdministrador();

  if (sesionUsuario && sesionAdministrador) {
    eliminarSesiones();
    return null;
  }

  return sesionUsuario ?? sesionAdministrador;
}

export function guardarSesionUsuario(sesion) {
  guardarSesion(sesion, CLAVE_SESION_USUARIO, CLAVE_SESION_ADMINISTRADOR);
}

export function guardarSesionAdministrador(sesion) {
  guardarSesion(sesion, CLAVE_SESION_ADMINISTRADOR, CLAVE_SESION_USUARIO);
}

export function eliminarSesiones() {
  window.localStorage.removeItem(CLAVE_USUARIO);
  window.localStorage.removeItem(CLAVE_SESION_USUARIO);
  window.localStorage.removeItem(CLAVE_SESION_ADMINISTRADOR);
}

export function requerirSesion(destino = `${window.location.pathname}${window.location.search}`) {
  const sesion = obtenerSesionActiva();

  if (!sesion) {
    window.location.replace(`/login.html?destino=${encodeURIComponent(destino)}`);
  }

  return sesion;
}

function guardarSesion(sesion, claveDestino, claveAnterior) {
  if (!sesion?.token || !sesion?.usuario) {
    throw new Error('La respuesta de acceso no contiene una sesión válida.');
  }

  const sesionGuardada = { ...sesion, fechaInicio: Date.now() };
  window.localStorage.removeItem(claveAnterior);
  window.localStorage.setItem(CLAVE_USUARIO, JSON.stringify(sesion.usuario));
  window.localStorage.setItem(claveDestino, JSON.stringify(sesionGuardada));
}
