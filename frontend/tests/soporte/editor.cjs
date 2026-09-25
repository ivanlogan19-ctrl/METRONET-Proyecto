const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';

async function abrirEditor(navegador, opciones = {}) {
  const contexto = await navegador.newContext({ viewport: opciones.viewport || { width: 1440, height: 1000 } });
  await contexto.addInitScript(() => localStorage.setItem('sesionUsuario', JSON.stringify({ token: 'prueba-local', usuario: { nombre: 'Prueba', rol: 'JUGADOR' } })));
  const pagina = await contexto.newPage();
  pagina.setDefaultTimeout(15000);
  const errores = [];
  pagina.on('pageerror', (error) => errores.push(error.message));
  const solicitudes = [];
  const diseno = {
    simulacion: { idDiseno: 77, idEscenario: opciones.escenario?.idEscenario ?? null, nombre: 'Red de prueba', estado: 'EN_DISENO', puntosInteresObjetivo: opciones.objetivos || [] },
    estaciones: [
      { nombre: 'Centro', posicionX: 580, posicionY: 470, transbordo: false },
      { nombre: 'Parque', posicionX: 700, posicionY: 460, transbordo: false },
      { nombre: 'Este', posicionX: 810, posicionY: 480, transbordo: false },
    ],
    lineas: [{ nombre: 'Azul' }],
    tramos: [{ nombreLinea: 'Azul', estacionA: 'Centro', estacionB: 'Parque' }],
    unidadesMetro: [{ idTren: 1, nombreLinea: 'Azul', capacidad: 300, velocidadPromedio: 40 }],
    preparadoParaSimular: false, observacionesSimulacion: [],
  };
  if (opciones.estaciones) diseno.estaciones = opciones.estaciones;
  if (opciones.tramos) diseno.tramos = opciones.tramos;
  if (opciones.lineas) diseno.lineas = opciones.lineas;
  diseno.territorio = opciones.territorio || { areas: [], errores: [] };
  await pagina.route('**/src/main.js*', async (route) => {
    const respuesta = await route.fetch();
    const fuente = await respuesta.text();
    // Expone la escena únicamente en el navegador de prueba.
    await route.fulfill({ response: respuesta, body: fuente.replace('let juego = new Phaser.Game(config);', 'let juego = new Phaser.Game(config); window.juegoPrueba = juego;') });
  });
  await pagina.route('**/api/**', async (route) => {
    const request = route.request();
    const ruta = new URL(request.url()).pathname;
    const metodo = request.method();
    if (metodo === 'OPTIONS') return route.fulfill({ status: 204 });
    const datos = request.postData() ? JSON.parse(request.postData()) : null;
    if (metodo !== 'GET') solicitudes.push({ ruta, metodo, datos });
    let respuesta = {};
    if (ruta === '/api/configuraciones') respuesta = [];
    else if (ruta === '/api/juego/escenarios') respuesta = opciones.escenario ? [opciones.escenario] : [{ idEscenario: 45, numero: null, nombre: 'Modo Libre', estado: 'DISPONIBLE', desbloqueado: true, progreso: 0 }];
    else if (ruta.endsWith('/consigna')) respuesta = opciones.consigna?.(diseno) ?? { estadoGlobal: 'PARCIAL', progreso: 0, condiciones: [], referenciasObjetivo: [] };
    else if (ruta === '/api/simulaciones') respuesta = [{ idDiseno: 77, nombre: diseno.simulacion.nombre, estado: diseno.simulacion.estado }];
    else if (ruta === '/api/simulaciones/77') respuesta = diseno;
    else if (ruta.endsWith('/estaciones') && metodo === 'POST') diseno.estaciones.push(datos);
    else if (ruta.includes('/estaciones/') && metodo === 'PATCH') {
      const nombre = decodeURIComponent(ruta.split('/').at(-1));
      Object.assign(diseno.estaciones.find((e) => e.nombre === nombre), datos);
    } else if (ruta.includes('/estaciones/') && metodo === 'DELETE') diseno.estaciones = diseno.estaciones.filter((e) => e.nombre !== decodeURIComponent(ruta.split('/').at(-1)));
    else if (ruta.endsWith('/lineas') && metodo === 'POST') diseno.lineas.push({ nombre: datos.nombre });
    else if (ruta.includes('/lineas/') && metodo === 'PATCH') {
      const nombre = decodeURIComponent(ruta.split('/').at(-1));
      diseno.lineas.find((l) => l.nombre === nombre).nombre = datos.nombre;
      [...diseno.tramos, ...diseno.unidadesMetro].filter((e) => e.nombreLinea === nombre).forEach((e) => { e.nombreLinea = datos.nombre; });
    } else if (ruta.includes('/lineas/') && metodo === 'DELETE') diseno.lineas = diseno.lineas.filter((l) => l.nombre !== decodeURIComponent(ruta.split('/').at(-1)));
    else if (ruta.endsWith('/tramos') && metodo === 'POST') diseno.tramos.push(datos);
    else if (ruta.endsWith('/tramos') && metodo === 'PATCH') Object.assign(diseno.tramos[0], datos);
    else if (ruta.endsWith('/tramos') && metodo === 'DELETE') diseno.tramos.shift();
    else if (ruta.endsWith('/unidades') && metodo === 'POST') diseno.unidadesMetro.push({ idTren: 2, ...datos });
    else if (ruta.includes('/unidades/') && metodo === 'PATCH') Object.assign(diseno.unidadesMetro.find((u) => u.idTren === Number(ruta.split('/').at(-1))), datos);
    else if (ruta.includes('/unidades/') && metodo === 'DELETE') diseno.unidadesMetro = diseno.unidadesMetro.filter((u) => u.idTren !== Number(ruta.split('/').at(-1)));
    else if (ruta.endsWith('/guardar')) diseno.simulacion.estado = 'GUARDADO';
    else if (ruta.endsWith('/validacion')) {
      diseno.preparadoParaSimular = true;
      diseno.simulacion.estado = 'VALIDADO';
      respuesta = { valido: true, preparadoParaSimular: true, observaciones: [] };
    }
    await route.fulfill({ json: respuesta, headers: { 'access-control-allow-origin': '*' } });
  });
  await pagina.goto(`${BASE}/?idDiseno=77`);
  try {
    await pagina.waitForFunction(() => window.juegoPrueba?.scene?.getScene('MapaScene')?.editorRedMetro?.disenoActual?.simulacion?.idDiseno === 77);
  } catch (error) {
    throw new Error(`${error.message}\nErrores de página: ${errores.join('; ')}\n${await pagina.locator('body').innerText()}`);
  }
  await pagina.evaluate(() => { window.editorPrueba = juegoPrueba.scene.getScene('MapaScene').editorRedMetro; });
  return { contexto, pagina, solicitudes, diseno, errores };
}

module.exports = { abrirEditor };
