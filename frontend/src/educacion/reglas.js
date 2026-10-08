import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';

// Presentación de las reglas vigentes de PuntuacionService y JuegoEducativoService.
// Esta pantalla no calcula ni registra puntajes.
if (requerirSesion('/reglas.html')) inicializarNavegacion({ actual: 'reglas' });
