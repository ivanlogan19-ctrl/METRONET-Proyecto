// Entrada acotada de Phaser 4: conserva el motor y sus dos renderers.
// La simulación y el audio de METRONET no utilizan Physics ni Sound de Phaser.
// Inicializar desde la raíz del renderer respeta sus dependencias circulares.
require('phaser-fuente/renderer');
require('phaser-fuente/events/EventEmitter');
require('phaser-fuente/gameobjects/DisplayList');
require('phaser-fuente/gameobjects/UpdateList');
require('phaser-fuente/scene/ScenePlugin');
require('phaser-fuente/cameras/2d/CameraManager');
require('phaser-fuente/input/keyboard/KeyboardPlugin');
require('phaser-fuente/data/DataManagerPlugin');
require('phaser-fuente/input/InputPlugin');
require('phaser-fuente/loader/LoaderPlugin');
require('phaser-fuente/loader/filetypes/JSONFile');
require('phaser-fuente/time/Clock');
require('phaser-fuente/tweens/TweenManager');
require('phaser-fuente/gameobjects/lights/LightsPlugin');
require('phaser-fuente/gameobjects/graphics/GraphicsFactory');
require('phaser-fuente/gameobjects/container/ContainerFactory');
require('phaser-fuente/gameobjects/text/TextFactory');
require('phaser-fuente/gameobjects/shape/rectangle/RectangleFactory');
require('phaser-fuente/gameobjects/shape/polygon/PolygonFactory');
require('phaser-fuente/gameobjects/shape/arc/ArcFactory');
require('phaser-fuente/gameobjects/zone/ZoneFactory');
require('phaser-fuente/gameobjects/image/ImageFactory');

module.exports = {
  ...require('phaser-fuente/const'),
  Game: require('phaser-fuente/core/Game'),
  Scene: require('phaser-fuente/scene/Scene'),
  Scale: require('phaser-fuente/scale'),
  Scenes: { Events: require('phaser-fuente/scene/events') },
  Geom: { Polygon: { Earcut: require('phaser-fuente/geom/polygon/Earcut') } },
  Math: {
    Clamp: require('phaser-fuente/math/Clamp'),
    Linear: require('phaser-fuente/math/Linear'),
    Distance: { Between: require('phaser-fuente/math/distance/DistanceBetween') },
    Angle: { Between: require('phaser-fuente/math/angle/Between') },
  },
};
