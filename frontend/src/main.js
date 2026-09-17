import Phaser from 'phaser';

import MapaScene from './mapa/MapaScene.js';
import { requerirSesion } from './autenticacion/sesion.js';
import { inicializarNavegacion } from './navegacion/NavegacionAplicacion.js';

const sesion = requerirSesion();

const config = {
  type: Phaser.AUTO,

  parent: 'metronet-mapa',

  backgroundColor: '#0B0D0E',

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
    juego.destroy(true);
    juego = null;
  });
}
