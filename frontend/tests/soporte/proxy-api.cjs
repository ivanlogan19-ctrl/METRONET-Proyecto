const http = require('node:http');

// Mantener las peticiones del navegador intactas, incluido el cuerpo de POST.
// Solo se usa contra el backend efímero de la prueba integral.
async function abrirProxyApi(destino) {
  const servidor = http.createServer((entrada, salida) => {
    const url = new URL(entrada.url, destino);
    const solicitud = http.request(url, {
      method: entrada.method,
      headers: { ...entrada.headers, host: url.host },
    }, respuesta => {
      salida.writeHead(respuesta.statusCode, respuesta.headers);
      respuesta.pipe(salida);
    });
    solicitud.on('error', () => {
      if (!salida.headersSent) salida.writeHead(502);
      salida.end();
    });
    entrada.pipe(solicitud);
  });
  await new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(8080, '127.0.0.1', resolver);
  });
  return () => new Promise((resolver, rechazar) => {
    servidor.close(error => error ? rechazar(error) : resolver());
    servidor.closeAllConnections();
  });
}

module.exports = { abrirProxyApi };
