const playwright = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');

async function abrirNavegador(opciones = {}) {
  const motor = process.env.METRONET_BROWSER || 'chromium';
  if (!['chromium', 'firefox', 'webkit'].includes(motor)) {
    throw new Error(`Navegador de prueba no admitido: ${motor}`);
  }
  const configuracion = { headless: true, ...opciones };
  // Silenciar la salida de las pruebas sin modificar el audio configurado en el juego.
  if (motor === 'chromium') {
    configuracion.args = [...(configuracion.args || []), '--mute-audio'];
  } else if (motor === 'firefox') {
    configuracion.firefoxUserPrefs = {
      ...configuracion.firefoxUserPrefs,
      'media.volume_scale': '0.0',
    };
  }
  if (process.env.METRONET_BROWSER_EXECUTABLE) {
    configuracion.executablePath = process.env.METRONET_BROWSER_EXECUTABLE;
  }
  if (process.env.METRONET_BROWSER_CHANNEL) {
    configuracion.channel = process.env.METRONET_BROWSER_CHANNEL;
  }
  if (motor !== 'chromium') {
    if (motor !== 'firefox' || !configuracion.channel?.startsWith('moz-firefox')) {
      delete configuracion.channel;
    }
    // Estos argumentos controlan políticas exclusivas de Chromium.
    if (configuracion.args) {
      configuracion.args = configuracion.args.filter(argumento => !argumento.startsWith('--autoplay-policy='));
    }
  }
  return playwright[motor].launch(configuracion);
}

module.exports = { abrirNavegador };
