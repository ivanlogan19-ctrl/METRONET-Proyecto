import { obtenerSesionActiva } from '../autenticacion/sesion.js';

const CLAVE = 'metronet:inicio-tutorial';
let entradaLocal = null;

// Transporta la decisión del servicio sobre el intento recién creado. No es
// persistencia de progreso: la campaña y los intentos siguen siendo del servidor.
export function registrarInicioTutorial(inicio, escenario) {
  entradaLocal = inicio?.mostrarTutorial === true && Number.isInteger(escenario?.numero)
    ? { idDiseno: inicio.idDiseno, idEscenario: inicio.idEscenario, idIntento: inicio.idIntento,
      numeroCampana: inicio.numeroCampana, idUsuario: obtenerSesionActiva()?.usuario?.idUsuario, creada: Date.now() }
    : null;
  try {
    if (entradaLocal) sessionStorage.setItem(CLAVE, JSON.stringify(entradaLocal));
    else sessionStorage.removeItem(CLAVE);
  } catch { /* Si no hay almacenamiento, solo se ofrece en el mismo documento. */ }
}

export function consumirInicioTutorial(diseno, escenario) {
  const local = Boolean(entradaLocal);
  let entrada = entradaLocal;
  entradaLocal = null;
  try { entrada ??= JSON.parse(sessionStorage.getItem(CLAVE)); sessionStorage.removeItem(CLAVE); } catch { /* Ayuda manual disponible. */ }
  const tipo = performance.getEntriesByType('navigation')[0]?.type;
  return Boolean(Number.isInteger(escenario?.numero) && entrada
    && entrada.idDiseno === diseno?.simulacion?.idDiseno && entrada.idEscenario === escenario.idEscenario
    && Number.isInteger(entrada.numeroCampana) && entrada.numeroCampana > 0
    && entrada.idUsuario != null && entrada.idUsuario === obtenerSesionActiva()?.usuario?.idUsuario
    && Date.now() - entrada.creada >= 0 && Date.now() - entrada.creada < 300000
    && (local || !['reload', 'back_forward'].includes(tipo)));
}
