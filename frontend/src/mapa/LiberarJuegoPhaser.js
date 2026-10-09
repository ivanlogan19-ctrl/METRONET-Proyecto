// Phaser.destroy marca el juego para liberar recursos en el siguiente frame.
// Un documento que sale con pagehide puede no recibir ese frame. Completar el
// paso pendiente antes de descargarlo libera escenas, canvas y eventos globales.
// Game.step comprueba pendingDestroy antes de actualizar o renderizar.
export function liberarJuegoPhaser(juego, { sinSiguienteFrame = false } = {}) {
  juego.destroy(true);
  if (sinSiguienteFrame) {
    juego.loop.stop();
    juego.step(0, 0);
  }
}
