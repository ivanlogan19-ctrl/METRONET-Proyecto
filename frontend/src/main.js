import Phaser from 'phaser';

import MapaScene from './mapa/MapaScene.js';


const config = {

    type:
        Phaser.AUTO,

    width:
        window.innerWidth,

    height:
        window.innerHeight,

    backgroundColor:
        '#000000',

    scale: {

        mode:
            Phaser.Scale.RESIZE,

        width:
            '100%',

        height:
            '100%'
    },

    scene: [
        MapaScene
    ]
};


new Phaser.Game(
    config
);