const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fuente = nombre => fs.readFileSync(path.join(__dirname, '../src/simulacion/', nombre), 'utf8');
const url = fuente => 'data:text/javascript;base64,' + Buffer.from(fuente).toString('base64');
const cargar = async () => (await import(url(fuente('MotorSimulacion.js')
  .replace('../mapa/configuracion/RecorridosRed.js', url(fuente('../mapa/configuracion/RecorridosRed.js').replace('./PaletaRed.js', url(fuente('../mapa/configuracion/PaletaRed.js')))))
  .replace('./EscalaSimulacion.js', url(fuente('EscalaSimulacion.js')))
  .replace('../mapa/controles/NombresRed.js', url(fuente('../mapa/controles/NombresRed.js')))))).default;
const red = (uv = [4, 6]) => ({
  estaciones: Array.from({ length: 31 }, (_, i) => ({ nombre: `E${i}` })),
  tramos: Array.from({ length: 30 }, (_, i) => ({ distanciaKm: 1, nombreLinea: 'Línea', estacionA: `E${i}`, estacionB: `E${i+1}` })),
  unidadesMetro: uv.map((velocidadPromedio, i) => ({ idTren: i + 1, nombreLinea: 'Línea', velocidadPromedio })),
});
test('Recorre 2 km y luego 10 km según UV × UT, sin repartir tiempo por cantidad de tramos', async () => {
  const Motor = await cargar(), datos = red([4]);
  datos.tramos = datos.tramos.slice(0, 2);
  datos.tramos[0].distanciaKm = 2;
  datos.tramos[1].distanciaKm = 10;
  const motor = new Motor(datos);
  motor.iniciar({duracion:3});
  let unidad = motor.actualizar(3000).unidades[0];
  assert.equal(unidad.distanciaRecorridaKm,4);
  assert.equal(unidad.estacionActual,'E1');
  assert.equal(unidad.progresoTramo,.2);
  assert.equal(unidad.utLlegada,3);
  unidad = motor.actualizar(9000).unidades[0];
  assert.equal(unidad.distanciaRecorridaKm,12);
  assert.equal(unidad.proximaEstacion,null);
  datos.unidadesMetro[0].duracionUt=2;
  const corto = new Motor(datos); corto.iniciar({duracion:3});
  assert.equal(corto.actualizar(18000).unidades[0].distanciaRecorridaKm,8);
  datos.unidadesMetro[0].velocidadPromedio=6;
  const rapido = new Motor(datos); rapido.iniciar({duracion:3});
  assert.equal(rapido.actualizar(18000).unidades[0].distanciaRecorridaKm,12);
});
test('Sin distancias no inventa un kilómetro por tramo', async () => {
  const Motor = await cargar(), datos = red([4]);
  delete datos.tramos[0].distanciaKm;
  assert.equal(new Motor(datos).obtenerEstado().unidades[0].transitable,false);
});
test('La numeración visible pertenece a la red; los IDs persistidos se conservan', async () => {
  const Motor = await cargar(), datos = red();
  datos.unidadesMetro[0].idTren = 206;
  datos.unidadesMetro[1].idTren = 211;
  const motor = new Motor(datos);
  assert.deepEqual(motor.obtenerEstado().unidades.map(u => [u.idTren, u.identificador]), [[206, 'M-1'], [211, 'M-2']]);
  const nueva = red([4]); nueva.unidadesMetro[0].idTren = 900;
  assert.equal(new Motor(nueva).obtenerEstado().unidades[0].identificador, 'M-1');
});
test('UV y UT determinan kilómetros; el ritmo solo acelera la reproducción', async () => {
  const Motor = await cargar(), motor = new Motor(red());
  motor.iniciar({ duracion: 6, velocidad: 1, ahora: 0 });
  const antes = motor.actualizar(4500);
  assert.equal(antes.duracion, 6);
  assert.equal(antes.tiempoTranscurrido, 1.5);
  assert.deepEqual(antes.unidades.map(u => u.velocidadUV), [4, 6]);
  assert.equal(antes.unidades[0].progresoRuta, .2);
  assert.ok(antes.unidades[1].progresoRuta > antes.unidades[0].progresoRuta);
  motor.establecerVelocidad(2, 4500);
  assert.equal(motor.obtenerEstado().progreso, antes.progreso, 'Cambiar ritmo no salta la posición');
  const despues = motor.actualizar(6750);
  assert.equal(despues.tiempoTranscurrido, 3);
  assert.equal(despues.duracion, 6);
  assert.deepEqual(despues.unidades.map(u => u.velocidadUV), [4, 6]);
});
test('Cambiar UV conserva horas/ritmo y cambiar horas conserva UV/ritmo', async () => {
  const Motor = await cargar();
  const ejecutar = (uv, horas) => { const m = new Motor(red([uv])); m.iniciar({ duracion: horas, velocidad: 1 }); return m.actualizar(9000); };
  const base = ejecutar(4, 6), rapida = ejecutar(6, 6), larga = ejecutar(4, 8);
  assert.ok(rapida.unidades[0].progresoRuta > base.unidades[0].progresoRuta);
  assert.equal(rapida.duracion, 6); assert.equal(rapida.velocidad, 1);
  assert.ok(larga.unidades[0].progresoRuta > base.unidades[0].progresoRuta);
  assert.equal(larga.unidades[0].velocidadUV, 4); assert.equal(larga.velocidad, 1);
});
test('Pausa, stop y restart conservan UV, h y ritmo; finalización sin espera real de horas', async () => {
  const Motor = await cargar(), motor = new Motor(red());
  motor.iniciar({ duracion: 8, velocidad: 2, ahora: 0 }); motor.pausar(1000);
  const pausa = motor.actualizar(2000); assert.equal(pausa.estado, 'PAUSADA');
  motor.reanudar(3000); assert.ok(motor.actualizar(3500).progreso > pausa.progreso);
  motor.detener(); assert.equal(motor.obtenerEstado().progreso, 0);
  motor.reiniciar(4000); assert.equal(motor.duracion, 8); assert.equal(motor.velocidad, 2);
  assert.deepEqual(motor.obtenerEstado().unidades.map(u => u.velocidadUV), [4, 6]);
  const fin = motor.actualizar(13000); assert.equal(fin.estado, 'FINALIZADA'); assert.equal(fin.tiempoTranscurrido, 8);
  motor.iniciar({ duracion: 1000000, ahora: 0 }); assert.equal(motor.actualizar(18000).estado, 'FINALIZADA');
});
test('Una red corta termina en su última estación; no teletransporta ni inventa recorridos', async () => {
  const Motor = await cargar(), datos = red(); datos.tramos = datos.tramos.slice(0, 1);
  const motor = new Motor(datos); motor.iniciar({ duracion: 6 });
  const unidad = motor.actualizar(18000).unidades[0];
  assert.equal(unidad.estacionActual, 'E1'); assert.equal(unidad.proximaEstacion, null); assert.equal(unidad.progresoRuta, 1);
});
test('Formateo centralizado y reloj visual acotado', async () => {
  const escala = await import(url(fuente('EscalaSimulacion.js')));
  assert.equal(escala.formatearVelocidad(4), '4 UV'); assert.equal(escala.formatearDuracion(6), '6 h'); assert.equal(escala.formatearRitmo(2), '2×');
  assert.equal(escala.duracionVisual(1), 5000); assert.equal(escala.duracionVisual(6), 18000); assert.equal(escala.duracionVisual(1000), 18000);
});
test('Conexión prolonga A–B hasta C y D; el Metro visita toda la cadena aunque los tramos lleguen desordenados', async () => {
  const Motor = await cargar();
  for (const tramos of [
    [['A','B'],['B','C'],['C','D']],
    [['C','B'],['D','C'],['B','A']],
  ]) {
    const datos = {estaciones:['A','B','C','D'].map(nombre=>({nombre})),
      tramos:tramos.map(([estacionA,estacionB])=>({distanciaKm:1,nombreLinea:'Principal',estacionA,estacionB})),
      unidadesMetro:[{idTren:1,nombreLinea:'Principal',velocidadPromedio:1}]};
    const motor = new Motor(datos);
    assert.equal(motor.rutas[0].ruta.length,4);
    assert.deepEqual(new Set(motor.rutas[0].ruta.map(e=>e.nombre)),new Set(['A','B','C','D']));
    motor.iniciar({duracion:3,ahora:0});
    const visitadas = new Set();
    for(let t=0;t<=18000;t+=50) visitadas.add(motor.actualizar(t).unidades[0].estacionActual);
    assert.deepEqual(visitadas,new Set(['A','B','C','D']));
    assert.equal(motor.obtenerEstado().unidades[0].proximaEstacion,null);
  }
});

test('UT individual limita cada metro y el reloj termina en la mayor duración', async () => {
 const Motor=await cargar(), datos=red([1,1]);
 datos.unidadesMetro[0].duracionUt=2; datos.unidadesMetro[1].duracionUt=8;
 const m=new Motor(datos);m.iniciar({duracion:6,ahora:0});
 const a=m.actualizar(9000); // Mitad de la ventana visual: 4 UT.
 assert.equal(a.duracion,8);assert.equal(a.unidades[0].progresoRuta,2/30);assert.equal(a.unidades[1].progresoRuta,4/30);
 assert.equal(a.unidades[0].tiempoAgotado,true);assert.equal(a.unidades[1].tiempoAgotado,false);
 m.pausar(9000);assert.equal(m.actualizar(24000).tiempoTranscurrido,4);
 m.reanudar(24000);assert.equal(m.actualizar(33000).estado,'FINALIZADA');
 assert.equal(m.obtenerEstado().unidades[0].progresoRuta,2/30);
 assert.equal(m.obtenerEstado().unidades[1].progresoRuta,8/30);
 assert.equal(m.reiniciar(40000).tiempoTranscurrido,0);
 assert.equal(m.obtenerEstado().duracion,8);
});
test('UT ausente conserva el respaldo global de diseños anteriores',async()=>{
 const Motor=await cargar(),datos=red([1,1]);datos.unidadesMetro[0].duracionUt=2;
 const m=new Motor(datos);m.iniciar({duracion:7});m.actualizar(21000);
 assert.deepEqual(m.obtenerEstado().unidades.map(u=>u.duracionUt),[2,7]);
 assert.equal(m.obtenerEstado().duracion,7);
});

test('Reloj territorial comparte UT máxima e ignora cambios de UV; pausa y reinicio no derivan', async () => {
  const { RelojTerritorial } = await import('../src/simulacion/RelojTerritorial.mjs');
  const Motor = await cargar(), datos = red([1, 2]);
  datos.unidadesMetro[0].duracionUt = 1;
  datos.unidadesMetro[1].duracionUt = 3;
  const motor = new Motor(datos), reloj = new RelojTerritorial(23 * 60 + 30);
  motor.iniciar({duracion:6,ahora:0});
  const estado = motor.actualizar(4500); reloj.sincronizar(estado.tiempoTranscurrido);
  assert.equal(estado.duracion,3); assert.equal(estado.tiempoTranscurrido,1.5);
  assert.equal(reloj.hora,1); assert.deepEqual(estado.unidades.map(u=>u.tiempoAgotado),[true,false]);
  motor.pausar(4500); reloj.sincronizar(motor.actualizar(9000).tiempoTranscurrido); assert.equal(reloj.hora,1);
  motor.reanudar(10000); reloj.sincronizar(motor.actualizar(14500).tiempoTranscurrido); assert.equal(reloj.hora,2);
  motor.reiniciar(15000); reloj.sincronizar(motor.obtenerEstado().tiempoTranscurrido); assert.equal(reloj.hora,23);
  motor.detener(); reloj.sincronizar(motor.obtenerEstado().tiempoTranscurrido); assert.equal(reloj.hora,23);
  datos.unidadesMetro[0].velocidadPromedio=8;
  const rapido=new Motor(datos); rapido.iniciar({duracion:6,ahora:0});
  assert.equal(rapido.actualizar(4500).tiempoTranscurrido,1.5);
});
test('Modo Libre conserva UT fraccionarias y llega en 1,5 UT a 8 UV sobre 12 km', async () => {
  const Motor=await cargar(), datos=red([8]);
  datos.tramos=datos.tramos.slice(0,12);datos.unidadesMetro[0].duracionUt=1.5;
  const motor=new Motor(datos);motor.iniciar({duracion:1.5,ahora:0});
  const mitad=motor.actualizar(2500);
  assert.equal(mitad.duracion,1.5);assert.equal(mitad.unidades[0].distanciaRecorridaKm,6);
  const fin=motor.actualizar(5000);assert.equal(fin.unidades[0].distanciaRecorridaKm,12);
  assert.equal(fin.unidades[0].utLlegada,1.5);
});
test('Vínculo por línea calcula tiempos y velocidades diferentes sin usar el total de la red',async()=>{
  const {calcularVinculo}=await import(url(fuente('VinculoUvUtLibre.js').replace('../mapa/configuracion/RecorridosRed.js', url(fuente('../mapa/configuracion/RecorridosRed.js').replace('./PaletaRed.js', url(fuente('../mapa/configuracion/PaletaRed.js')))))));
  const diseno={tramos:[{nombreLinea:'A',estacionA:'a',estacionB:'b',distanciaKm:12},{nombreLinea:'B',estacionA:'b',estacionB:'c',distanciaKm:18}]};
  const unidades=[{nombreLinea:'A'},{nombreLinea:'B'}];
  assert.deepEqual(calcularVinculo(diseno,unidades,'UV',8).map(u=>u.duracionUt),[1.5,2.25]);
  assert.deepEqual(calcularVinculo(diseno,unidades,'UT',1.5).map(u=>u.velocidadPromedio),[8,12]);
  assert.equal(calcularVinculo({tramos:[]},unidades,'UV',8),null);
  assert.equal(calcularVinculo({tramos:[...diseno.tramos,{nombreLinea:'A',estacionA:'x',estacionB:'y',distanciaKm:3}]},unidades,'UV',8),null);
});

test('Los pasos fraccionarios no saltan casi a cero ni pierden precisión al sumar',async()=>{
  const {desplazarValorVinculado}=await import(url(fuente('VinculoUvUtLibre.js').replace('../mapa/configuracion/RecorridosRed.js', url(fuente('../mapa/configuracion/RecorridosRed.js').replace('./PaletaRed.js', url(fuente('../mapa/configuracion/PaletaRed.js')))))));
  assert.equal(desplazarValorVinculado(0.3,-1),0.2);
  assert.equal(desplazarValorVinculado(0.1,-1),0.09);
  assert.equal(desplazarValorVinculado(1.00000001,-1),0.90000001);
  assert.equal(desplazarValorVinculado(1.33928041,1),2.33928041);
  assert.equal(desplazarValorVinculado(0,-1),null);
  assert.equal(desplazarValorVinculado(0,1),0.01);
});

test('Reproducir una selección conserva UV/UT, excluye las otras líneas y bloquea cambios en marcha', async () => {
  const Motor = await cargar(), datos=red([4]);
  datos.unidadesMetro[0].duracionUt=7.5;
  datos.tramos.push({nombreLinea:'Corta',estacionA:'E0',estacionB:'E1',distanciaKm:6});
  datos.unidadesMetro.push({idTren:2,nombreLinea:'Corta',velocidadPromedio:3,duracionUt:2});
  const original=JSON.stringify(datos), motor=new Motor(datos);
  assert.equal(motor.seleccionarLineas(['Corta']).duracion,2);
  motor.iniciar({ahora:0});
  assert.deepEqual(motor.seleccionarLineas(['Línea']).unidades.map(u=>u.nombreLinea),['Corta']);
  const estado=motor.actualizar(motor.duracionVisual);
  assert.equal(estado.estado,'FINALIZADA');
  assert.equal(estado.unidades[0].distanciaRecorridaKm,6);
  motor.seleccionarLineas([]);
  assert.equal(motor.iniciar().estado,'DETENIDA');
  motor.seleccionarLineas(['Línea','Corta']);
  assert.equal(motor.iniciar().duracion,7.5);
  assert.equal(JSON.stringify(datos),original,'La reproducción no modifica el diseño');
});

test('Cada nueva ejecución vuelve desde el extremo alcanzado y respeta las distancias al regresar', async () => {
  const Motor = await cargar(), datos = red([4]);
  datos.tramos = datos.tramos.slice(0, 2);
  datos.tramos[0].distanciaKm = 2;
  datos.tramos[1].distanciaKm = 10;
  datos.unidadesMetro[0].duracionUt = 3;
  const original = JSON.stringify(datos), motor = new Motor(datos);
  motor.iniciar({ ahora: 0 });
  assert.equal(motor.actualizar(9000).unidades[0].estacionActual, 'E2');
  assert.equal(motor.detener().unidades[0].estacionActual, 'E2');
  const regreso = motor.iniciar({ ahora: 10000 }).unidades[0];
  assert.equal(regreso.estacionActual, 'E2');
  assert.equal(regreso.proximaEstacion, 'E1');
  const intermedio = motor.actualizar(13000).unidades[0];
  assert.equal(intermedio.estacionActual, 'E2');
  assert.equal(intermedio.proximaEstacion, 'E1');
  assert.equal(intermedio.progresoTramo, .4, 'El regreso empieza por el tramo de 10 km');
  assert.equal(motor.actualizar(19000).unidades[0].estacionActual, 'E0');
  assert.equal(motor.iniciar({ ahora: 20000 }).unidades[0].proximaEstacion, 'E1');
  assert.equal(JSON.stringify(datos), original);
});

test('Las selecciones de líneas y conexiones conservan sus extremos de forma independiente', async () => {
  const Motor = await cargar();
  const datos = {
    estaciones: ['A', 'B', 'C', 'D'].map(nombre => ({ nombre })),
    tramos: [
      { nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B', distanciaKm: 2 },
      { nombreLinea: 'Roja', estacionA: 'C', estacionB: 'D', distanciaKm: 2 },
    ],
    conexionesLineas: [{ idConexion: 5, estacionA: 'B', estacionB: 'C', distanciaKm: 2 }],
    unidadesMetro: ['Azul', 'Roja', '@conexion:5'].map((nombreLinea, i) => ({ idTren: i + 1, nombreLinea, velocidadPromedio: 1, duracionUt: 2 })),
  };
  const motor = new Motor(datos);
  motor.seleccionarLineas(['Azul', '@conexion:5']);
  motor.iniciar({ ahora: 0 });
  assert.deepEqual(motor.actualizar(6000).unidades.map(u => u.estacionActual), ['B', 'C']);
  motor.seleccionarLineas(['Roja']);
  assert.equal(motor.iniciar({ ahora: 10000 }).unidades[0].estacionActual, 'C');
  motor.actualizar(16000);
  motor.seleccionarLineas(['Azul', 'Roja', '@conexion:5']);
  assert.deepEqual(motor.iniciar({ ahora: 20000 }).unidades.map(u => [u.estacionActual, u.proximaEstacion]), [['B', 'A'], ['D', 'C'], ['C', 'B']]);
  assert.deepEqual(motor.actualizar(26000).unidades.map(u => u.estacionActual), ['A', 'C', 'B']);
});

test('Recargar el mismo diseño y ajustar UV/UT conserva el extremo; cambiar geometría lo invalida', async () => {
  const Motor = await cargar(), datos = red([2]);
  datos.tramos = datos.tramos.slice(0, 1);
  datos.unidadesMetro[0].duracionUt = .5;
  const motor = new Motor(datos);
  motor.iniciar({ ahora: 0 }); motor.actualizar(5000);
  const guardado = structuredClone(datos);
  guardado.unidadesMetro[0].velocidadPromedio = 4;
  guardado.unidadesMetro[0].duracionUt = .25;
  const recargado = new Motor(guardado, motor);
  assert.equal(recargado.obtenerEstado().unidades[0].estacionActual, 'E1');
  assert.equal(recargado.iniciar().unidades[0].proximaEstacion, 'E0');
  assert.equal(recargado.actualizar(5000).unidades[0].estacionActual, 'E0');
  guardado.tramos.push({ nombreLinea: 'Línea', estacionA: 'E1', estacionB: 'E2', distanciaKm: 1 });
  assert.equal(new Motor(guardado, motor).obtenerEstado().unidades[0].estacionActual, 'E0');
});

test('La suma decimal de tramos no impide reconocer la llegada y el regreso', async () => {
  const Motor = await cargar(), datos = red([1]);
  datos.tramos = datos.tramos.slice(0, 2);
  datos.tramos[0].distanciaKm = .1;
  datos.tramos[1].distanciaKm = .2;
  datos.unidadesMetro[0].duracionUt = .3;
  const motor = new Motor(datos);
  motor.iniciar();
  assert.equal(motor.actualizar(5000).unidades[0].proximaEstacion, null);
  assert.equal(motor.reiniciar(10000).unidades[0].estacionActual, 'E2');
});

test('Movimiento visual: solo se destaca durante la marcha, no en pausa ni después de llegar', async () => {
  const Motor = await cargar(), datos = red([10, 5]);
  const motor = new Motor(datos);
  assert.equal(motor.obtenerEstado().unidades[0].enMovimiento, false);
  assert.ok(motor.iniciar({duracion:6, ahora:0}).unidades.every(u => u.enMovimiento));
  assert.ok(motor.pausar(1000).unidades.every(u => !u.enMovimiento));
  assert.ok(motor.reanudar(1000).unidades.every(u => u.enMovimiento));
  const intermedio = motor.actualizar(motor.duracionVisual * 0.75);
  assert.equal(intermedio.unidades[0].enMovimiento, false, 'El primero ya llegó');
  assert.equal(intermedio.unidades[1].enMovimiento, true, 'El segundo sigue circulando');
  assert.ok(motor.actualizar(motor.duracionVisual).unidades.every(u => !u.enMovimiento));
});
