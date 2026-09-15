const path = require('node:path');
const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    rollupOptions: {
      input: {
        mapa: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
        registro: path.resolve(__dirname, 'registro.html'),
        perfil: path.resolve(__dirname, 'perfil.html'),
        privacidad: path.resolve(__dirname, 'privacidad.html'),
        loginAdministrador: path.resolve(__dirname, 'admin-login.html'),
        administracion: path.resolve(__dirname, 'admin.html')
      }
    }
  }
});
