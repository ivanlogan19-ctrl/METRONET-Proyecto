import { gestorMusica } from './GestorMusica.js';

// Entrada pequeña e independiente del código de interfaz/Phaser. Los HTML
// conservan su navegación normal; solo se acorta la espera para recuperar audio.
try {
  gestorMusica.reanudarAlCargarDocumento(document.documentElement.dataset.contextoMusical);
} catch {
  // Un fallo de almacenamiento o audio no puede bloquear la página. Su entrada
  // habitual conserva la inicialización y los controles del mismo gestor.
}
