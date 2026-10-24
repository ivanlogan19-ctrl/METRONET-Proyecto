const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
async function abrir(t, opciones) {
  const vista = await abrirEditor(navegador, opciones);
  t.after(() => vista.contexto.close());
  t.after(() => assert.deepEqual(vista.errores, []));
  return vista;
}
async function estacion(p, nombre) {
  await p.evaluate(nombre => editorPrueba.seleccionarElemento({ tipo: 'estacion', valor: editorPrueba.disenoActual.estaciones.find(e => e.nombre === nombre) }), nombre);
}
async function esperar(p) { await p.waitForFunction(() => !editorPrueba.creacionDirecta.pendiente); }

test('Una línea de veinte estaciones conserva todos sus tramos, colores y recorrido', async t => {
  const estaciones = Array.from({ length: 20 }, (_, i) => ({
    nombre: `E${i + 1}`, posicionX: 600 + i * 5, posicionY: 430,
  }));
  const { pagina: p, diseno } = await abrir(t, { modo: 'LIBRE', estaciones,
    lineas: [{ nombre: 'Azul' }],
    tramos: [{ nombreLinea: 'Azul', estacionA: 'E1', estacionB: 'E2' }],
  });
  const color = await p.evaluate(() => editorPrueba.capaRedMetro.colorLinea('Azul'));
  await p.locator('[data-elegir-herramienta=lineas]').click();
  await estacion(p, 'E2');
  for (const siguiente of estaciones.slice(2)) {
    await estacion(p, siguiente.nombre);
    await esperar(p);
  }
  assert.equal(diseno.lineas.length, 1);
  assert.equal(diseno.tramos.length, 19);
  // El servidor aporta las distancias; el doble de edición sólo conserva las escrituras.
  diseno.tramos.forEach(tramo => { tramo.distanciaKm = 0.2; });
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  const resultado = await p.evaluate(async () => {
    const capa = editorPrueba.capaRedMetro;
    const { default: Motor } = await import('/src/simulacion/MotorSimulacion.js');
    return {
      ruta: capa.obtenerRuta('Azul').map(e => e.nombre),
      colores: editorPrueba.disenoActual.estaciones.map(e =>
        [...(capa.lineasPorEstacion.get(e.nombre) ?? [])].map(l => capa.colorLinea(l))),
      rutaSimulada: new Motor(editorPrueba.disenoActual).rutas[0].ruta.map(e => e.nombre),
    };
  });
  assert.deepEqual(resultado.ruta, estaciones.map(e => e.nombre));
  assert.deepEqual(resultado.rutaSimulada, resultado.ruta);
  assert.deepEqual(resultado.colores, estaciones.map(() => [color]));
});

for (const inverso of [false, true]) test(`Conexión existente permite continuar el extremo violeta tras reabrir (${inverso ? 'libre primero' : 'conexión primero'})`, async t => {
  const { pagina: p, diseno, solicitudes } = await abrir(t, { unidadesMetro: [],
    estaciones: [
      { nombre:'E1',posicionX:587.30,posicionY:370.22 }, { nombre:'E2',posicionX:590.26,posicionY:334.57 },
      { nombre:'E3',posicionX:596.76,posicionY:287.96 }, { nombre:'E4',posicionX:643.47,posicionY:332.89 },
      { nombre:'E5',posicionX:532.32,posicionY:340.90 }],
    lineas:[{nombre:'Línea 01'},{nombre:'Línea 02'}], tramos:[
      {nombreLinea:'Línea 01',estacionA:'E2',estacionB:'E1'},
      {nombreLinea:'Línea 01',estacionA:'E3',estacionB:'E2'},
      {nombreLinea:'Línea 02',estacionA:'E4',estacionB:'E2'}],
    conexionesLineas:[{idConexion:8,lineaA:'Línea 02',estacionA:'E2',lineaB:'Línea 01',estacionB:'E2'}] });
  const colores=await p.evaluate(()=>[...editorPrueba.capaRedMetro.coloresLineas.entries()]);
  await p.locator('[data-elegir-herramienta=conexiones]').click();
  for (const nombre of inverso ? ['E5','E2'] : ['E2','E5']) await estacion(p,nombre);
  await esperar(p);
  assert.equal(solicitudes.at(-1)?.ruta,'/api/simulaciones/77/lineas/extender');
  assert.equal(solicitudes.at(-1).datos.nombreLinea,'Línea 02');
  assert.equal(diseno.lineas.length,2);
  assert.equal(diseno.conexionesLineas.length,1);
  assert.equal(diseno.tramos.length,4);
  await p.evaluate(()=>editorPrueba.abrirDiseno(77));
  assert.deepEqual(await p.evaluate(()=>[...editorPrueba.capaRedMetro.coloresLineas.entries()]),colores);
  assert.deepEqual(await p.evaluate(()=>editorPrueba.capaRedMetro.obtenerRuta('Línea 02').map(e=>e.nombre)),['E4','E2','E5']);
});

test('Una línea amarilla con curva conserva su recorrido y color con un único metro', async t => {
  const { pagina: p, diseno } = await abrir(t, { unidadesMetro: [], lineas: [{ nombre: 'Línea 01' }, { nombre: 'Línea 02' }, { nombre: 'Línea 03' }],
    estaciones: [
      { nombre: 'A', posicionX: 620, posicionY: 430 }, { nombre: 'B', posicionX: 650, posicionY: 430 },
      { nombre: 'C', posicionX: 650, posicionY: 400 },
    ], tramos: [
      { nombreLinea: 'Línea 03', estacionA: 'A', estacionB: 'B', distanciaKm: 1 },
      { nombreLinea: 'Línea 03', estacionA: 'B', estacionB: 'C', distanciaKm: 2 },
    ] });
  await p.locator('[data-elegir-herramienta=metros]').click();
  await estacion(p, 'A'); await esperar(p);
  const antes = await p.evaluate(() => ({ color: editorPrueba.capaRedMetro.colorLinea('Línea 03'),
    ruta: editorPrueba.capaRedMetro.obtenerRuta('Línea 03').map(e => e.nombre) }));
  diseno.lineas = diseno.lineas.filter(l => l.nombre !== 'Línea 02');
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  const despues = await p.evaluate(() => ({ color: editorPrueba.capaRedMetro.colorLinea('Línea 03'),
    ruta: editorPrueba.capaRedMetro.obtenerRuta('Línea 03').map(e => e.nombre), metros: editorPrueba.disenoActual.unidadesMetro.length }));
  assert.equal(antes.color, 0xffe637);
  assert.deepEqual(despues, { ...antes, metros: 1 });
  assert.deepEqual(despues.ruta, ['A', 'B', 'C']);
});

test('Línea extiende dos veces sin cambiar identidad, color ni ruta al reabrir', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { estaciones: [
    { nombre: 'Centro', posicionX: 580, posicionY: 470 }, { nombre: 'Parque', posicionX: 700, posicionY: 460 },
    { nombre: 'Este', posicionX: 780, posicionY: 480 }, { nombre: 'Final', posicionX: 810, posicionY: 480 },
  ] });
  const color = await p.evaluate(() => editorPrueba.capaRedMetro.colorLinea('Azul'));
  await p.locator('[data-elegir-herramienta=lineas]').click();
  await estacion(p, 'Parque'); await estacion(p, 'Este'); await esperar(p);
  await estacion(p, 'Final'); await esperar(p);
  assert.equal(await p.evaluate(() => editorPrueba.disenoActual.lineas.length), 1);
  assert.deepEqual(solicitudes.map(s => s.ruta.split('/').slice(-2).join('/')), ['lineas/extender', 'lineas/extender']);
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  assert.equal(await p.evaluate(() => editorPrueba.capaRedMetro.colorLinea('Azul')), color);
  assert.equal(await p.evaluate(() => editorPrueba.disenoActual.tramos.length), 3);
});

test('Línea extiende desde una estación nueva hacia el extremo existente sin crear otra línea', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { estaciones: [
    { nombre: 'Centro', posicionX: 580, posicionY: 470 }, { nombre: 'Parque', posicionX: 700, posicionY: 460 },
    { nombre: 'Este', posicionX: 780, posicionY: 480 }, { nombre: 'Final', posicionX: 810, posicionY: 480 },
  ] });
  const color = await p.evaluate(() => editorPrueba.capaRedMetro.colorLinea('Azul'));
  await p.locator('[data-elegir-herramienta=lineas]').click();
  await estacion(p, 'Este'); await estacion(p, 'Parque'); await esperar(p);
  assert.equal(solicitudes[0].ruta, '/api/simulaciones/77/lineas/extender');
  assert.equal(solicitudes[0].datos.nombreLinea, 'Azul');
  assert.equal(solicitudes[0].datos.estacionA, 'Parque');
  assert.equal(solicitudes[0].datos.estacionB, 'Este');
  await estacion(p, 'Final'); await esperar(p);
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  assert.equal(await p.evaluate(() => editorPrueba.disenoActual.lineas.length), 1);
  assert.equal(await p.evaluate(() => editorPrueba.capaRedMetro.colorLinea('Azul')), color);
  assert.deepEqual(await p.evaluate(() => editorPrueba.capaRedMetro.obtenerRuta('Azul').map(e => e.nombre)), ['Centro', 'Parque', 'Este', 'Final']);
  assert.equal(await p.evaluate(() => editorPrueba.disenoActual.conexionesLineas.length), 0);
});

test('Conexión prolonga la primera línea conservando estaciones y tramos', async t => {
  const { pagina: p, diseno } = await abrir(t, { estaciones: [
    { nombre: 'Centro', posicionX: 580, posicionY: 470 }, { nombre: 'Parque', posicionX: 700, posicionY: 460 },
    { nombre: 'Este', posicionX: 780, posicionY: 480 }, { nombre: 'Final', posicionX: 810, posicionY: 480 },
  ], lineas: [{ nombre: 'Azul' }, { nombre: 'Verde' }], tramos: [
    { nombreLinea: 'Azul', estacionA: 'Centro', estacionB: 'Parque' },
    { nombreLinea: 'Verde', estacionA: 'Este', estacionB: 'Final' },
  ] });
  const tramos = structuredClone(diseno.tramos);
  const estaciones = structuredClone(diseno.estaciones);
  await p.locator('[data-elegir-herramienta=conexiones]').click();
  await estacion(p, 'Parque'); await estacion(p, 'Este'); await esperar(p);
  assert.equal(diseno.conexionesLineas.length, 1);
  assert.deepEqual(diseno.estaciones, estaciones);
  assert.equal(diseno.tramos.length, 3);
  assert.deepEqual(diseno.tramos.slice(0, 2), tramos);
  assert.deepEqual(diseno.tramos[2], { nombreLinea: 'Azul', estacionA: 'Parque', estacionB: 'Este' });
  assert.deepEqual(diseno.tramos[1], tramos[1]);
  assert.equal(diseno.estaciones.length, 4);
  assert.equal(diseno.conexionesLineas[0].estacionA, 'Este');
  assert.equal(diseno.conexionesLineas[0].estacionB, 'Este');
  assert.equal(await p.evaluate(() => editorPrueba.capaRedMetro.esTransbordo(editorPrueba.disenoActual.estaciones.find(e => e.nombre === 'Este'))), true);
  assert.equal(await p.evaluate(() => editorPrueba.capaRedMetro.esTransbordo(editorPrueba.disenoActual.estaciones.find(e => e.nombre === 'Centro'))), false);
  await p.evaluate(async () => { await editorPrueba.abrirDiseno(77); editorPrueba.restablecerModo(); editorPrueba.seleccionarElemento({ tipo: 'conexionLinea', valor: editorPrueba.disenoActual.conexionesLineas[0] }); });
  await p.locator('[data-accion-edicion=eliminar]').click();
  await p.locator('[data-confirmar-eliminar]').click();
  await p.waitForFunction(() => editorPrueba.disenoActual.conexionesLineas.length === 0);
  assert.deepEqual(diseno.tramos[1], tramos[1]);
  assert.equal(diseno.tramos.length, 3);
});


test('Estación compartida: sólo las líneas aparecen en reloj, configuración y distancias', async t => {
  const { pagina: p, solicitudes } = await abrir(t, { modo: 'LIBRE', estaciones: [
    { nombre: 'A', posicionX: 600, posicionY: 430 }, { nombre: 'B', posicionX: 630, posicionY: 430 },
    { nombre: 'C', posicionX: 660, posicionY: 430 },
  ], lineas: [{ nombre: 'Azul' }, { nombre: 'Verde' }], tramos: [
    { nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B', distanciaKm: 1.2 },
    { nombreLinea: 'Verde', estacionA: 'B', estacionB: 'C', distanciaKm: 2.3 },
  ], conexionesLineas: [{ idConexion: 8, lineaA: 'Azul', estacionA: 'B', lineaB: 'Verde', estacionB: 'B' }] });
  await p.locator('[data-elegir-herramienta=metros]').click();
  await estacion(p, 'B');
  await p.locator('[data-linea-superpuesta="Verde"]').click();
  await esperar(p);
  assert.equal(solicitudes.at(-1).datos.nombreLinea, 'Verde');
  assert.equal(solicitudes.at(-1).datos.idConexion, undefined);
  const resultado = await p.evaluate(async () => {
    const { default: Motor } = await import('/src/simulacion/MotorSimulacion.js');
    const { default: Selector } = await import('/src/simulacion/SelectorLineasReproduccion.js');
    const motor = new Motor(editorPrueba.disenoActual);
    const selector = new Selector(editorPrueba.disenoActual, () => {});
    const resultado = { rutas: motor.rutas.map(r => r.ruta.map(e => e.nombre)), texto: selector.elemento.textContent,
      conexiones: selector.elemento.querySelectorAll('[data-linea-reproducir^="@conexion:"]').length };
    selector.elemento.remove(); return resultado;
  });
  assert.deepEqual(resultado.rutas, [['A', 'B'], ['B', 'C']]);
  assert.equal(resultado.conexiones, 0);
  assert.doesNotMatch(resultado.texto, /conexión/i);
  await p.locator('[data-medicion-distancias]').click();
  assert.equal(await p.locator('.metronet-mediciones__fila').count(), 2);
});

test('Varias líneas coincidentes se eligen en el mapa sin carteles en Herramientas', async t => {
  const { pagina: p, diseno } = await abrir(t, { estaciones: [
    {nombre:'Centro',posicionX:630,posicionY:430},{nombre:'A',posicionX:600,posicionY:430},
    {nombre:'B',posicionX:660,posicionY:430},{nombre:'C',posicionX:630,posicionY:460},
  ], lineas:[{nombre:'Azul'},{nombre:'Verde'},{nombre:'Roja'}],tramos:[
    {nombreLinea:'Azul',estacionA:'A',estacionB:'Centro'},
    {nombreLinea:'Verde',estacionA:'B',estacionB:'Centro'},
    {nombreLinea:'Roja',estacionA:'C',estacionB:'Centro'},
  ] });
  await p.locator('[data-elegir-herramienta=conexiones]').click();
  await estacion(p,'Centro');
  assert.equal(await p.locator('[data-opciones-construccion]').count(),0);
  for (const nombre of ['Azul','Roja']) await p.evaluate(nombre=>editorPrueba.seleccionarElemento({
    tipo:'tramo',valor:editorPrueba.disenoActual.tramos.find(t=>t.nombreLinea===nombre),
  }),nombre);
  await esperar(p);
  assert.equal(diseno.conexionesLineas.length,1);
  assert.deepEqual(new Set([diseno.conexionesLineas[0].lineaA,diseno.conexionesLineas[0].lineaB]),new Set(['Azul','Roja']));
  assert.equal(diseno.tramos.length,3);
});

for (const modo of ['LIBRE', 'NIVEL']) test(`Conexión: izquierda, centro azul, derecha conserva dos líneas completas en ${modo}`, async t => {
  const { pagina: p, diseno, solicitudes } = await abrir(t, { modo, unidadesMetro: [],
    estaciones: [
      {nombre:'Arriba',posicionX:650,posicionY:400},{nombre:'Centro',posicionX:650,posicionY:430},
      {nombre:'Abajo',posicionX:650,posicionY:460},{nombre:'Izquierda',posicionX:620,posicionY:430},
      {nombre:'Derecha',posicionX:680,posicionY:430}],
    lineas:[{nombre:'Azul'}], tramos:[
      {nombreLinea:'Azul',estacionA:'Arriba',estacionB:'Centro'},
      {nombreLinea:'Azul',estacionA:'Centro',estacionB:'Abajo'}] });
  await p.locator('[data-elegir-herramienta=conexiones]').click();
  await estacion(p,'Izquierda'); await estacion(p,'Centro'); await esperar(p);
  assert.equal(diseno.lineas.length,2);
  assert.equal(diseno.conexionesLineas.length,1);
  await estacion(p,'Derecha'); await esperar(p);
  assert.equal(diseno.estaciones.length,5);
  assert.equal(diseno.lineas.length,2);
  assert.equal(diseno.tramos.length,4);
  assert.equal(solicitudes.at(-1).ruta,'/api/simulaciones/77/lineas/extender');
  await p.evaluate(()=>editorPrueba.abrirDiseno(77));
  assert.deepEqual(await p.evaluate(()=>editorPrueba.capaRedMetro.obtenerRuta('Azul').map(e=>e.nombre)),['Arriba','Centro','Abajo']);
  assert.deepEqual(await p.evaluate(()=>editorPrueba.capaRedMetro.obtenerRuta('Línea 01').map(e=>e.nombre)),['Izquierda','Centro','Derecha']);
  const colores=await p.evaluate(()=>[...editorPrueba.capaRedMetro.coloresLineas.values()]);
  assert.equal(new Set(colores).size,2);
});

test('Tres líneas permiten conectar cada par sin perder estaciones ni identidad', async t => {
  const lineas = ['Azul','Amarilla','Rosa'].map(nombre => ({nombre}));
  const {pagina:p,diseno,solicitudes} = await abrir(t, {modo:'LIBRE',lineas,unidadesMetro:[],
    estaciones:Array.from({length:6},(_,i) => ({nombre:`E${i}`,posicionX:610+Math.floor(i/2)*30,posicionY:400+(i%2)*40})),
    tramos:lineas.map((l,i) => ({nombreLinea:l.nombre,estacionA:`E${i*2}`,estacionB:`E${i*2+1}`}))});
  const estaciones = structuredClone(diseno.estaciones);
  const colores = await p.evaluate(() => [...editorPrueba.capaRedMetro.coloresLineas.entries()]);
  await p.locator('[data-elegir-herramienta=conexiones]').click();
  for (const [a,b] of [['E1','E3'],['E2','E4'],['E5','E0']]) {
    await estacion(p,a); await estacion(p,b); await esperar(p);
  }
  assert.deepEqual(solicitudes.filter(s => s.ruta.endsWith('/conexiones-lineas')).map(s => [s.datos.lineaA,s.datos.lineaB]),
    [['Azul','Amarilla'],['Amarilla','Rosa'],['Rosa','Azul']]);
  await p.evaluate(() => editorPrueba.abrirDiseno(77));
  assert.equal(diseno.conexionesLineas.length,3);
  assert.equal(diseno.tramos.length,6);
  assert.deepEqual(diseno.estaciones,estaciones);
  assert.deepEqual(await p.evaluate(() => [...editorPrueba.capaRedMetro.coloresLineas.entries()]),colores);
});
