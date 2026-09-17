import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';

const sesion = requerirSesion('/inicio.html');

if (sesion) inicializar();

async function inicializar() {
  inicializarNavegacion({ actual: 'inicio' });
  const acciones = document.getElementById('accionesInicio');
  const escenarios = await obtenerEscenarios();
  const modoLibre = escenarios.find((escenario) => escenario.numero === null);
  acciones.append(
    crearAccion('Continuar escenarios', 'Elegí un nivel y retomá tu progreso de aprendizaje.', '/escenarios.html', 'principal'),
    crearAccion('Mis diseños', 'Abrí, editá, guardá o validá una red de metro existente.', '/', 'normal'),
    crearAccion('Simulaciones', 'Consultá y ejecutá simulaciones sobre diseños validados.', '/simulacion.html', 'normal'),
    crearAccion('Modo libre', modoLibre?.desbloqueado ? 'Creá una red sin restricciones de nivel.' : 'Se desbloquea al completar los escenarios de aprendizaje.', '/', modoLibre?.desbloqueado ? 'normal' : 'bloqueada', !modoLibre?.desbloqueado),
  );
}

async function obtenerEscenarios() {
  try {
    const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego/escenarios`, {
      headers: { Authorization: `Bearer ${sesion.token}` },
    });
    if (!respuesta.ok) throw new Error();
    return respuesta.json();
  } catch {
    document.getElementById('mensajeInicio').textContent = 'No fue posible consultar el progreso de escenarios. Podés continuar con tus diseños guardados.';
    return [];
  }
}

function crearAccion(titulo, descripcion, ruta, variante, deshabilitada = false) {
  const tarjeta = document.createElement(deshabilitada ? 'article' : 'a');
  tarjeta.className = `metronet-inicio__accion ${variante}`;
  if (!deshabilitada) tarjeta.href = ruta;
  else tarjeta.setAttribute('aria-disabled', 'true');
  tarjeta.innerHTML = `<h2>${titulo}</h2><p>${descripcion}</p><span>${deshabilitada ? 'Bloqueado' : 'Abrir →'}</span>`;
  return tarjeta;
}
