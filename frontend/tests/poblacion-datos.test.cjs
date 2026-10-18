const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const modelo = () => import('../src/mapa/poblacion/ModeloPoblacion.mjs');
test('densidad distingue faltantes y cero; divide por área oficial', async () => {
 const { densidadPoblacion, colorPoblacion, COLOR_SIN_DATOS, BANDAS_POBLACION } = await modelo();
 assert.equal(densidadPoblacion({ poblacion: 100, areaKm2: .02 }), 5000);
 for (const p of [{poblacion:null,areaKm2:1},{poblacion:10,areaKm2:0},{poblacion:10,areaKm2:null}]) assert.equal(colorPoblacion(p),COLOR_SIN_DATOS);
 assert.equal(colorPoblacion({poblacion:0,areaKm2:1}),BANDAS_POBLACION[0].color);
 for (const [p,i] of [[1000,0],[1001,1],[5000,1],[5001,2],[10000,2],[10001,3],[20000,3],[20001,4]]) assert.equal(colorPoblacion({poblacion:p,areaKm2:1}), BANDAS_POBLACION[i].color);
});
test('rechaza archivos incompletos o sin cartografía, sin fabricar colores', async () => {
 const { validarPoblacion } = await modelo();
 const datos = JSON.parse(fs.readFileSync('frontend/src/mapa/datos/poblacion-montevideo.geojson'));
 validarPoblacion(datos);
 assert.equal(datos.metadata.anio, 2023);
 assert.equal(datos.features.length, 1067);
 assert.equal(datos.features.filter(f => f.properties.poblacion === null).length, 0);
 assert.equal(datos.features.reduce((s, f) => s + f.properties.poblacion, 0), 1279409);
 assert.equal(datos.metadata.poblacionSinGeometria.length, 0);
 assert.equal(datos.metadata.unidadTerritorial, 'segmento censal');
 assert.match(datos.metadata.sha256, /^[a-f0-9]{64}$/);
 assert.throws(()=>validarPoblacion({estado:'no_disponible'}));
 const f = {properties:{id:1,poblacion:100,areaKm2:.02},geometry:{type:'Polygon',coordinates:[[[-56,-35],[-56.01,-35],[-56,-35.01],[-56,-35]]]}};
 const muestra = {type:'FeatureCollection',metadata:{anio:2011,totalFuente:1,sinGeometria:[]},features:[f]};
 validarPoblacion(muestra);
 assert.throws(()=>validarPoblacion({...muestra,features:[]}));
 assert.throws(()=>validarPoblacion({...muestra,features:[f,f]}));
 f.properties.poblacion = -1;
 assert.throws(()=>validarPoblacion(muestra));
});

test('el modelo admite el censo 2023 y rechaza años sin soporte', async () => {
 const { validarPoblacion } = await modelo();
 const f = {properties:{id:1,poblacion:100,areaKm2:.02},geometry:{type:'Polygon',coordinates:[[[-56,-35],[-56.01,-35],[-56,-35.01],[-56,-35]]]}};
 const datos = {type:'FeatureCollection',metadata:{anio:2023,totalFuente:1,sinGeometria:[]},features:[f]};
 assert.equal(validarPoblacion(datos), datos);
 assert.throws(() => validarPoblacion({...datos, metadata:{...datos.metadata,anio:2025}}));
});
