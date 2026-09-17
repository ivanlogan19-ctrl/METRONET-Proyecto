const path = require('node:path');
const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    rollupOptions: {
      input: {
        inicio: path.resolve(__dirname, 'inicio.html'),
        escenarios: path.resolve(__dirname, 'escenarios.html'),
        mapa: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
        recuperarContrasena: path.resolve(__dirname, 'recuperar-contrasena.html'),
        registro: path.resolve(__dirname, 'registro.html'),
        perfil: path.resolve(__dirname, 'perfil.html'),
        privacidad: path.resolve(__dirname, 'privacidad.html'),
        loginAdministrador: path.resolve(__dirname, 'admin-login.html'),
        administracion: path.resolve(__dirname, 'admin.html'),
        simulacion: path.resolve(__dirname, 'simulacion.html')
      }
    }
  }
});
