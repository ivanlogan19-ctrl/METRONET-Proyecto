const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const cargar=async ruta=>import(`data:text/javascript;base64,${Buffer.from(await fs.readFile(new URL(ruta,`file://${__filename}`),'utf8')).toString('base64')}`);

test('nombres únicos con huecos, nombres manuales, reservas y más de 99 elementos',async()=>{
 const {siguienteNombre}=await cargar('../src/mapa/controles/NombresRed.js');
 assert.equal(siguienteNombre('Estación',[{nombre:'Estación 01'},{nombre:'Terminal'},{nombre:'Estación 03'}],['Estación 02']),'Estación 04');
 assert.equal(siguienteNombre('Línea',Array.from({length:110},(_,i)=>({nombre:`Línea ${String(i+1).padStart(2,'0')}`}))),'Línea 111');
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
