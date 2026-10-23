const {test}=require('node:test');
const assert=require('node:assert/strict');
const {abrirNavegador}=require('./soporte/navegador.cjs');
const {abrirEditor}=require('./soporte/editor.cjs');

test('La regla, UV/UT y el motor suman la línea completa a través de conexiones',async t=>{
 const navegador=await abrirNavegador();t.after(()=>navegador.close());
 const coordenadas=[[605.53,357.22],[438.81,309.29],[514.19,319.73],[548.33,253.29],[468.52,364.82],[703.08,311.11],[660.22,403.50],[749.49,330.09],[710.77,416.47]];
 const segmentos=[[[1,3,3.75318647],[3,2,2.84116248]],[[4,3,3.08925849],[3,5,2.55766915]],[[9,8,3.93407676],[8,6,1.90589855]],[[6,7,4.22785359],[7,1,2.82665650]]];
 const lineas=segmentos.map((_,i)=>({nombre:`Línea 0${i+1}`}));
 const totales=segmentos.map(s=>s.reduce((total,t)=>total+t[2],0));
 const v=await abrirEditor(navegador,{modo:'LIBRE',lineas,
  estaciones:coordenadas.map(([posicionX,posicionY],i)=>({nombre:`E${i+1}`,posicionX,posicionY})),
  tramos:segmentos.flatMap((s,i)=>s.map(([a,b,distanciaKm])=>({nombreLinea:lineas[i].nombre,estacionA:`E${a}`,estacionB:`E${b}`,distanciaKm}))),
  unidadesMetro:lineas.map((l,i)=>({idTren:i+1,nombreLinea:l.nombre,capacidad:300,velocidadPromedio:1,duracionUt:totales[i]})),
  conexionesLineas:[[1,0,3],[2,3,6],[3,0,1]].map(([a,b,e],i)=>({idConexion:i+1,lineaA:lineas[a].nombre,lineaB:lineas[b].nombre,estacionA:`E${e}`,estacionB:`E${e}`}))});
 t.after(()=>v.contexto.close());
 await v.pagina.locator('[data-medicion-distancias]').click();
 const resultado=await v.pagina.evaluate(async()=>{
  const {calcularVinculo}=await import('/src/simulacion/VinculoUvUtLibre.js');
  const {default:Motor}=await import('/src/simulacion/MotorSimulacion.js');
  const red=editorPrueba.disenoActual;
  return {etiquetas:document.querySelectorAll('.metronet-mediciones__tramo').length,
   filas:[...document.querySelectorAll('.metronet-mediciones__fila b')].map(e=>e.textContent),
   uv:calcularVinculo(red,red.unidadesMetro,'UV',2),ut:calcularVinculo(red,red.unidadesMetro,'UT',3),
   rutas:new Motor(red).rutas.map(r=>({nombre:r.nombreLinea,estaciones:r.ruta.length,km:r.ruta.slice(1).reduce((s,e)=>s+e.distanciaDesdeAnteriorKm,0)}))};
 });
 assert.equal(resultado.etiquetas,0);
 assert.equal(resultado.filas.length,4);
 for(let i=0;i<4;i++){
  assert.equal(resultado.filas[i],`${new Intl.NumberFormat('es-UY',{minimumFractionDigits:1,maximumFractionDigits:1}).format(totales[i])} km`);
  assert.ok(Math.abs(resultado.uv[i].duracionUt-totales[i]/2)<1e-7);
  assert.ok(Math.abs(resultado.ut[i].velocidadPromedio-totales[i]/3)<1e-7);
  const ruta=resultado.rutas.find(r=>r.nombre===lineas[i].nombre);
  assert.equal(ruta.estaciones,3);assert.ok(Math.abs(ruta.km-totales[i])<1e-7);
 }
 assert.deepEqual(v.errores,[]);
});
