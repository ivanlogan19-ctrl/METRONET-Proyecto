const path = require('node:path');
const { defineConfig } = require('vite');
const { headers, politicaMeta } = require('./seguridad-http.cjs');
const phaser = require('./build/configuracion-phaser.cjs');

const ENTRADA_AUDIO = '/src/audio/ReanudacionTemprana.js';

module.exports = defineConfig({
  resolve: { alias: phaser.alias },
  optimizeDeps: { include: ['phaser'], esbuildOptions: { plugins: [phaser.desarrollo] } },
  server: { headers },
  preview: { headers },
  plugins: [phaser.produccion, {
    name: 'metronet-politica-contenido',
    transformIndexHtml: {
      order: 'post',
      // También protege HTML servido por un host estático sin configuración de cabeceras.
      handler: html => html.replace(/(<meta charset="[^"]+"\s*\/?>)/i,
        `$1\n  <meta http-equiv="Content-Security-Policy" content="${politicaMeta}">`),
    },
  }, {
    name: 'metronet-primer-render',
    apply: 'build',
    // Vite genera una nueva etiqueta para la entrada y descarta blocking.
    // Restaurarlo evita capturar la nueva página antes de montar su cabecera.
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace(/<script type="module"(?![^>]*\b(?:async|blocking)\b)/g, '<script type="module" blocking="render"'),
    },
  }, {
    name: 'metronet-audio-temprano',
    apply: 'build',
    // Vite reúne los scripts de cada HTML en una entrada diferida. Conservar
    // esta entrada independiente y asíncrona también en la versión publicada.
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        if (!html.includes(ENTRADA_AUDIO)) return html;
        const entrada = Object.values(bundle).find(archivo => archivo.type === 'chunk' && archivo.name === 'reanudacionMusica');
        if (!entrada) throw new Error('No se generó la entrada de reanudación musical.');
        return html.replace(ENTRADA_AUDIO, `/${entrada.fileName}`);
      },
    },
  }],
  build: {
    commonjsOptions: { include: [/node_modules/, /phaser-metronet\.cjs$/] },
    rollupOptions: {
      input: {
        reanudacionMusica: path.resolve(__dirname, `.${ENTRADA_AUDIO}`),
        inicio: path.resolve(__dirname, 'inicio.html'),
        escenarios: path.resolve(__dirname, 'escenarios.html'),
        ranking: path.resolve(__dirname, 'ranking.html'),
        disenos: path.resolve(__dirname, 'disenos.html'),
        mapa: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
        recuperarContrasena: path.resolve(__dirname, 'recuperar-contrasena.html'),
        verificarCodigo: path.resolve(__dirname, 'verificar-codigo.html'),
        nuevaContrasena: path.resolve(__dirname, 'nueva-contrasena.html'),
        registro: path.resolve(__dirname, 'registro.html'),
        perfil: path.resolve(__dirname, 'perfil.html'),
        privacidad: path.resolve(__dirname, 'privacidad.html'),
        loginAdministrador: path.resolve(__dirname, 'admin-login.html'),
        administracion: path.resolve(__dirname, 'admin.html'),
        simulacion: path.resolve(__dirname, 'simulacion.html')
      },
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id, contexto) {
          const moduloPhaser = phaser.separarModulos(id, contexto);
          if (moduloPhaser) return moduloPhaser;
          // El audio temprano no debe descargar ni ejecutar controles, CSS de
          // pantalla o Phaser antes de poder reproducir una pista ya iniciada.
          if (['/src/audio/GestorMusica.js', '/src/audio/ConfiguracionAudio.js', '/src/autenticacion/sesion.js']
            .some(ruta => id.endsWith(ruta))) return 'gestor-musica';
        },
      },
    }
  }
});
