const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const cargar=async ruta=>import(`data:text/javascript;base64,${Buffer.from(await fs.readFile(new URL(ruta,`file://${__filename}`),'utf8')).toString('base64')}`);

test('nombres únicos con huecos, nombres manuales, reservas y más de 99 elementos',async()=>{
 const {siguienteNombre}=await cargar('../src/mapa/controles/NombresRed.js');
 assert.equal(siguienteNombre('Estación',[{nombre:'Estación 01'},{nombre:'Terminal'},{nombre:'Estación 03'}],['Estación 02']),'Estación 04');
 assert.equal(siguienteNombre('Línea',Array.from({length:110},(_,i)=>({nombre:`Línea ${String(i+1).padStart(2,'0')}`}))),'Línea 111');
});
test('una red nueva reinicia la numeración visible sin reiniciar IDs ni renombrar líneas guardadas',async()=>{
 const {numeroMetroEnRed,siguienteNombre}=await cargar('../src/mapa/controles/NombresRed.js');
 const anteriores=[{idTren:206},{idTren:211}];
 assert.equal(numeroMetroEnRed(206,anteriores),1);
 assert.equal(numeroMetroEnRed('211',[...anteriores].reverse()),2);
 assert.equal(numeroMetroEnRed(900,[{idTren:900}]),1);
 assert.equal(numeroMetroEnRed(900,[]),null);
 assert.equal(siguienteNombre('Línea',[]),'Línea 01');
 assert.equal(siguienteNombre('Línea',[{nombre:'Línea 01'}]),'Línea 02');
 assert.deepEqual(anteriores,[{idTren:206},{idTren:211}]);
});
test('paletas ferroviarias independientes y líneas adyacentes distintas sin perder determinismo',async()=>{
 const {PALETA_RED:p,coloresDeLineas}=await cargar('../src/mapa/configuracion/PaletaRed.js');
 const colores=[...p.lineas,...Object.values(p.estaciones),...p.metros,p.transbordo];
 const reservados=[0xffb36b,0x60dec9,0x75b49c,0xf3c86b,0x69cf9a,0xdc82c4,0x7ba8ff,0xf07878,0xb99cff,0xffaa67,0x6cd7f7,0x49c3f2,0x48b4ff];
 assert.equal(new Set(colores).size,colores.length);assert.equal(colores.some(c=>reservados.includes(c)),false);
 const lineas=Array.from({length:8},(_,i)=>({nombre:`Línea ${i+1}`}));
 const asignacion=coloresDeLineas(lineas);assert.equal(new Set(asignacion.values()).size,8);
 assert.deepEqual(coloresDeLineas([...lineas].reverse()),asignacion);
});
test('cada línea conserva un color exclusivo aunque la red supere la paleta inicial',async()=>{
 const {PALETA_RED,coloresDeLineas}=await cargar('../src/mapa/configuracion/PaletaRed.js');
 for(const cantidad of [1,2,8,9,32,256]){
  const lineas=Array.from({length:cantidad},(_,i)=>({nombre:`Línea ${i+1}`}));
  const tramos=lineas.map(l=>({nombreLinea:l.nombre,estacionA:'Central',estacionB:l.nombre}));
  const editor=coloresDeLineas(lineas,tramos);
  const simulacion=coloresDeLineas([...lineas].reverse(),[...tramos].reverse());
  assert.equal(new Set(editor.values()).size,cantidad,`${cantidad} líneas sin colores repetidos`);
  assert.deepEqual(simulacion,editor,'mismo color por nombre al cargar la misma red');
  assert.deepEqual(coloresDeLineas(lineas),editor,'editar conexiones no cambia los colores');
  assert.deepEqual([...editor.values()].slice(0,8),PALETA_RED.lineas.slice(0,cantidad));
  for(const color of editor.values()){
   assert.ok(Number.isInteger(color)&&color>=0&&color<=0xffffff);
   assert.ok(![...Object.values(PALETA_RED.estaciones),...PALETA_RED.metros,PALETA_RED.transbordo].includes(color));
  }
 }
});
test('Retirar una línea vacía no cambia el color de las demás líneas del editor',async()=>{
 const {coloresDeLineas}=await cargar('../src/mapa/configuracion/PaletaRed.js');
 const lineas=[1,2,3,4].map(n=>({nombre:`Línea ${String(n).padStart(2,'0')}`}));
 const antes=coloresDeLineas(lineas);
 const despues=coloresDeLineas(lineas.filter(l=>l.nombre!=='Línea 02'));
 for(const [nombre,color] of despues)assert.equal(color,antes.get(nombre));
});
function cliente(valida,estado='EN_DISENO') {const llamadas=[];return {llamadas,obtener:async()=>({simulacion:{estado}}),solicitar:async(ruta,opciones)=>{llamadas.push([ruta,opciones.method]);return ruta.endsWith('/validacion')?valida:{};}};}
test('guardar borrador conserva avances, simular red inválida no guarda ni ejecuta',async()=>{
 const {prepararDiseno}=await cargar('../src/red/PreparacionDiseno.js');
 const c=cliente({valido:false,preparadoParaSimular:false,observaciones:['Red incompleta']});
 await prepararDiseno(c,7,{guardar:true});assert.deepEqual(c.llamadas.map(l=>l[0]),['/7/validacion','/7/guardar']);
 c.llamadas.length=0;await assert.rejects(prepararDiseno(c,7,{guardar:true,paraSimular:true}),error=>error.codigo==='RED_NO_PREPARADA'&&/Red incompleta/.test(error.message));assert.equal(c.llamadas.length,1);
});
test('completado consulta sin escribir; contexto obsoleto detiene la preparación',async()=>{
 const {prepararDiseno}=await cargar('../src/red/PreparacionDiseno.js');
 const c=cliente({valido:true,preparadoParaSimular:true},'COMPLETADO');
 await prepararDiseno(c,7,{guardar:true,paraSimular:true});assert.deepEqual(c.llamadas,[['/7/validacion','GET']]);
 c.llamadas.length=0;await assert.rejects(prepararDiseno(c,7,{vigente:()=>false}),/diseño activo/);assert.equal(c.llamadas.length,0);
});
test('intención de inicio se consume una vez y no se reutiliza en otra red',async()=>{
 const {solicitarInicioSimulacion,consumirInicioSimulacion}=await cargar('../src/red/PreparacionDiseno.js');
 const memoria=new Map();global.sessionStorage={setItem:(k,v)=>memoria.set(k,v),getItem:k=>memoria.get(k),removeItem:k=>memoria.delete(k)};
 solicitarInicioSimulacion(7);assert.equal(consumirInicioSimulacion(7),true);assert.equal(consumirInicioSimulacion(7),false);
 solicitarInicioSimulacion(7);assert.equal(consumirInicioSimulacion(8),false);assert.equal(consumirInicioSimulacion(7),false);delete global.sessionStorage;
});

test('una red operable puede guardarse y abrir simulación aunque tenga una consigna pendiente por exceso',async()=>{
 const {prepararDiseno}=await cargar('../src/red/PreparacionDiseno.js');
 const c=cliente({valido:true,preparadoParaSimular:true,observaciones:[]});
 c.obtener=async()=>({simulacion:{estado:'EN_DISENO'},consigna:{completado:false,
  condiciones:[{clave:'maximoEstaciones',actual:4,requerido:3,completado:false}]}});
 const preparada=await prepararDiseno(c,7,{guardar:true,paraSimular:true});
 assert.equal(preparada.validacion.preparadoParaSimular,true);
 assert.deepEqual(c.llamadas,[['/7/validacion','POST'],['/7/guardar','POST']]);
});

test('los nombres visibles corresponden al color del mapa sin renombrar las líneas guardadas',async()=>{
 const {coloresDeLineas,nombreVisibleLinea}=await cargar('../src/mapa/configuracion/PaletaRed.js');
 const lineas=Array.from({length:256},(_,i)=>({nombre:`Línea ${i+1}`}));
 const antes=JSON.stringify(lineas);
 const colores=coloresDeLineas(lineas);
 const nombres=[...colores.values()].map(nombreVisibleLinea);
 assert.deepEqual(nombres.slice(0,3),['Línea azul','Línea fucsia','Línea amarilla']);
 assert.equal(new Set(nombres).size,256,'Los tonos adicionales siguen siendo identificables');
 assert.deepEqual([...coloresDeLineas([...lineas].reverse()).values()].map(nombreVisibleLinea),nombres);
 assert.equal(JSON.stringify(lineas),antes);
});
