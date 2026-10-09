import Phaser from 'phaser';
import { liberarJuegoPhaser } from './mapa/LiberarJuegoPhaser.js';
import { COLORES_INTERFAZ_MAPA } from './mapa/configuracion/ColoresMapa.js';

import MapaScene from './mapa/MapaScene.js';
import { requerirSesion } from './autenticacion/sesion.js';
import { inicializarNavegacion } from './navegacion/NavegacionAplicacion.js';

const sesion = requerirSesion();

const config = {
  type: Phaser.AUTO,

  parent: 'metronet-mapa',

  backgroundColor: COLORES_INTERFAZ_MAPA.FONDO,

  scale: {
    mode: Phaser.Scale.RESIZE,

    width: '100%',

    height: '100%',
  },

  scene: [MapaScene],
};

if (sesion) {
  inicializarNavegacion({ actual: 'edicion', etapa: 'edicion' });
  let juego = new Phaser.Game(config);
  window.addEventListener('pagehide', (evento) => {
    if (evento.persisted || !juego) return;
    liberarJuegoPhaser(juego, { sinSiguienteFrame: true });
    juego = null;
  });
}
