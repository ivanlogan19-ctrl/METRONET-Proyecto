// Datos locales para revisar presentación e interacción; todas las llamadas de API se interceptan.
const usuario = { idUsuario: 7, nombre: 'Ana', apellido: 'Prueba', email: 'ana@example.test', rol: 'JUGADOR', fechaCreacion: '2026-01-01T12:00:00' };
const nombres = ['Red inicial', 'Conexiones', 'Unidades de metro', 'Simulación completa'];
const escenarios = nombres.map((nombre, i) => ({
  idEscenario: 41 + i, numero: i + 1, nombre, dificultad: 'Inicial',
  objetivo: 'Conectá estaciones y construí un recorrido continuo dentro de Montevideo.',
  instrucciones: 'Explorá el mapa y revisá las referencias para planificar tu red.',
  estado: i === 0 ? 'COMPLETADO' : i === 1 ? 'DISPONIBLE' : 'BLOQUEADO',
  desbloqueado: i <= 1, progreso: i === 0 ? 100 : 0, herramientasHabilitadas: {},
  completadoEnCampanaActual: i === 0, cantidadIntentos: i === 0 ? 1 : 0,
}));
const progreso = { escenarios, numeroCampanaActual: 1, cantidadNiveles: 4, nivelesCompletados: 1, modoLibreDesbloqueado: false, campanaCompletada: false };
const diseno = {
  simulacion: { idDiseno: 77, idEscenario: 42, nombre: 'Red de Montevideo', dificultad: 'Inicial', modo: 'NIVEL', estado: 'VALIDADO', objetivo: escenarios[1].objetivo, instrucciones: escenarios[1].instrucciones },
  estaciones: [{ nombre: 'Centro', posicionX: 580, posicionY: 470 }, { nombre: 'Parque', posicionX: 700, posicionY: 460 }, { nombre: 'Este', posicionX: 810, posicionY: 480 }],
  lineas: [{ nombre: 'Azul' }],
  tramos: [{ nombreLinea: 'Azul', estacionA: 'Centro', estacionB: 'Parque' }, { nombreLinea: 'Azul', estacionA: 'Parque', estacionB: 'Este' }],
  unidadesMetro: [{ idTren: 1, nombreLinea: 'Azul', capacidad: 300, velocidadPromedio: 40 }],
  preparadoParaSimular: true, observacionesSimulacion: [], resultados: [], territorio: { areas: [], errores: [] },
};

async function abrirPantalla(navegador, ruta, opciones = {}) {
  const contexto = await navegador.newContext({ viewport: opciones.viewport || { width: 1440, height: 1000 }, reducedMotion: opciones.reducedMotion || 'no-preference' });
  // Las pruebas de componentes conservan documentos aislados; la suite del
  // contenedor ejecuta la navegación real sin este reemplazo.
  if (!opciones.contenedor) await contexto.route('**/iniciar-contenedor.js', ruta => ruta.fulfill({ contentType: 'application/javascript', body: '' }));
  const admin = opciones.administrador ?? ruta.startsWith('/admin.html');
  const publica = /login|registro|contrasena|codigo|privacidad/.test(ruta);
  await contexto.addInitScript(({ admin, publica, usuario, contenedor }) => {
    if (contenedor && sessionStorage.getItem("fixture-persistente")) return;
    if (contenedor) sessionStorage.setItem("fixture-persistente", "1");
    if (!publica && !/login|registro|contrasena|codigo|privacidad/.test(location.pathname)) localStorage.setItem(admin ? 'sesionAdministrador' : 'sesionUsuario', JSON.stringify({ token: 'prueba-visual', usuario: { ...usuario, rol: admin ? 'ADMIN' : 'JUGADOR' } }));
    sessionStorage.setItem(`${location.hostname}:recuperacionContrasena`, JSON.stringify({ email: usuario.email, idSolicitud: 99, tokenRecuperacion: 'prueba-local', reenvioDisponibleEn: 0 }));
  }, { admin, publica, usuario, contenedor: opciones.contenedor });
  const pagina = await contexto.newPage();
  const errores = [], solicitudes = [];
  pagina.on('pageerror', error => errores.push(error.message));
  pagina.setDefaultTimeout(15000);
  await pagina.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (!opciones.contenedor && path === '/iniciar-contenedor.js') return route.fulfill({ contentType:'application/javascript', body:'' });
    if (!path.startsWith('/api/') && !path.startsWith('/auth/')) return route.continue();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    solicitudes.push({ path, method: request.method(), body: request.postDataJSON() });
    if (opciones.responder) {
      const respuesta = await opciones.responder(request);
      if (respuesta) return route.fulfill({ ...respuesta, headers: { 'access-control-allow-origin': '*' } });
    }
    let respuesta;
    if (path.startsWith('/auth/perfil')) respuesta = { ...usuario, rol: admin ? 'ADMIN' : 'JUGADOR', ...request.postDataJSON() };
    else if (path === '/api/admin/usuarios') respuesta = [usuario, { ...usuario, idUsuario: 8, nombre: 'Operador', rol: 'ADMIN', email: 'admin@example.test' }];
    else if (path === '/api/configuraciones' || /configuracion|actividad/.test(path)) respuesta = [];
    else if (path.endsWith('/consigna')) respuesta = { estadoGlobal: 'PARCIAL', progreso: 50, condiciones: [{ clave: 'estaciones', descripcion: 'Construir tres estaciones conectadas', actual: 3, requerido: 3, completado: true }], referenciasObjetivo: [] };
    else if (path.startsWith('/api/juego/')) respuesta = progreso;
    else if (path === '/api/simulaciones') respuesta = [diseno.simulacion];
    else if (path === '/api/simulaciones/77') respuesta = diseno;
    else if (path.endsWith('/validacion')) respuesta = {valido:true, preparadoParaSimular:true, observaciones:[], observacionesSimulacion:[]};
    else if (path.endsWith('/guardar')) respuesta = diseno.simulacion;
    else if (path === '/api/admin/disenos') respuesta = [];
    else return route.fulfill({ status: 400, json: { detail: 'Respuesta de prueba: operación no disponible.' }, headers: { 'access-control-allow-origin': '*' } });
    await route.fulfill({ json: respuesta, headers: { 'access-control-allow-origin': '*' } });
  });
  await pagina.goto(`${process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173'}${ruta}`);
  if (opciones.contenedor) await pagina.locator('#pantalla-metronet').waitFor();
  const vista = opciones.contenedor ? await (await pagina.locator('#pantalla-metronet').elementHandle()).contentFrame() : pagina;
  await vista.waitForLoadState('domcontentloaded');
  await vista.evaluate(() => document.fonts.ready);
  if (ruta.startsWith('/simulacion.html')) await vista.locator('#panelSimulacion:not([hidden])').waitFor();
  if (ruta === '/perfil.html') await vista.locator('.perfil-contenedor[aria-busy="false"]').waitFor();
  if (ruta === '/admin.html') await vista.locator('[data-editar-usuario]').first().waitFor();
  if (ruta === '/inicio.html') await vista.locator('.metronet-inicio__tarjeta').first().waitFor();
  if (ruta === '/escenarios.html') await vista.locator('.metronet-escenarios-pagina__tarjeta').first().waitFor();
  return { contexto, pagina, vista, errores, solicitudes };
}

module.exports = { abrirPantalla };
