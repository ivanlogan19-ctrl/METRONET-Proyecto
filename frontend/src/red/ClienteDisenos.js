import { eliminarSesiones, obtenerSesionActiva } from '../autenticacion/sesion.js';

export { obtenerSesionActiva };

export default class ClienteDisenos {
  constructor(sesion) {
    this.sesion = sesion;
  }

  obtenerRuta(ruta = '') {
    return `${window.location.protocol}//${window.location.hostname}:8080/api/simulaciones${ruta}`;
  }

  async solicitar(ruta = '', opciones = {}) {
    const respuesta = await fetch(this.obtenerRuta(ruta), {
      ...opciones,
      headers: {
        Authorization: `Bearer ${this.sesion.token}`,
        ...(opciones.headers ?? {}),
      },
    });
    if (respuesta.ok) {
      if (respuesta.status === 204) return null;
      const contenido = await respuesta.text();
      return contenido.trim() ? JSON.parse(contenido) : null;
    }
    if (respuesta.status === 401) {
      eliminarSesiones();
      window.location.replace(`/login.html?destino=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
      throw new Error('La sesión venció. Iniciá sesión nuevamente.');
    }
    let mensaje = 'No fue posible completar la acción.';
    try {
      mensaje = (await respuesta.json()).detail ?? mensaje;
    } catch {
      // La respuesta no incluyó un detalle legible.
    }
    throw new Error(mensaje);
  }

  listar() { return this.solicitar(); }
  obtener(idDiseno) { return this.solicitar(`/${idDiseno}`); }
  validar(idDiseno) { return this.solicitar(`/${idDiseno}/validacion`, { method: 'POST' }); }
  ejecutar(idDiseno, datos) {
    return this.solicitar(`/${idDiseno}/ejecutar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  }
}
