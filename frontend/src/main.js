import Phaser from 'phaser';
import MapaScene from './mapa/MapaScene';

const config = {
    type: Phaser.AUTO,

    width: window.innerWidth,
    height: window.innerHeight,

    backgroundColor: '#0B2545',

    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

    scene: [MapaScene]
};

new Phaser.Game(config);