const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('La regla mantiene distancias paralelas, separadas y legibles al girar y acercar', async t => {
  const browser = await chromium.launch({ channel: process.env.METRONET_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const v = await abrirPantalla(browser, '/escenarios.html');
  t.after(() => v.contexto.close());
  const resultado = await v.pagina.evaluate(async () => {
    const { default: MedicionDistancias } = await import('/src/mapa/controles/MedicionDistancias.js');
    const contenedor = document.createElement('div');
    contenedor.style.cssText = 'position:fixed;inset:0;width:1000px;height:1000px;background:#091324;z-index:10000';
    contenedor.innerHTML = '<h3 class="metronet-panel-editor-cabecera">Diseño de la red</h3><canvas width="1000" height="1000" style="position:absolute;inset:0;width:1000px;height:1000px"></canvas>';
    document.body.append(contenedor);
    const puntos = [{x:100,y:600},{x:650,y:400},{x:700,y:510},{x:690,y:620},{x:688,y:675}];
    const estaciones = puntos.map((p,i)=>({nombre:String(i),posicionX:p.x,posicionY:p.y}));
    const capa = {
      escena: { events: {on(){},off(){}}, game:{canvas:contenedor.querySelector('canvas')},
        scale:{gameSize:{width:1000,height:1000}}, cameras:{main:{scrollX:0,scrollY:0,matrix:{transformPoint:(x,y)=>({x,y})}}}},
      puntosEstaciones:puntos, unidadesEstaticas:[{x:250,y:545},{x:410,y:487},{x:550,y:436},{x:675,y:455}],
      unidadesSimulacion:new Map(), convertirPosicion:(x,y)=>({x,y}),
    };
    const medicion = new MedicionDistancias(capa);
    medicion.actualizar({simulacion:{modo:'LIBRE',idDiseno:1},estaciones,
      tramos:[27.2,5.5,7.1,2.5].map((distanciaKm,i)=>({nombreLinea:i<3?'Azul':'Rosa',estacionA:String(i),estacionB:String(i+1),distanciaKm}))});
    medicion.boton.click();
    await document.fonts.ready;
    const casos = [];
    for (const giro of [0, Math.PI / 6, Math.PI, 3 * Math.PI / 2]) for (const zoom of [1, .7]) {
      const proyectar = (x,y) => ({x:500+zoom*((x-500)*Math.cos(giro)-(y-500)*Math.sin(giro)),y:500+zoom*((x-500)*Math.sin(giro)+(y-500)*Math.cos(giro))});
      capa.escena.cameras.main.matrix.transformPoint = proyectar;
      medicion.posicionar();
      const etiquetas=medicion.etiquetas.map(({elemento,origen,destino})=>{
        const r=elemento.getBoundingClientRect(), estilo=getComputedStyle(elemento), matriz=new DOMMatrix(estilo.transform);
        const a=proyectar(origen.posicionX,origen.posicionY), b=proyectar(destino.posicionX,destino.posicionY);
        const dx=b.x-a.x,dy=b.y-a.y,largo=Math.hypot(dx,dy);
        const esquinas=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>({
          x:r.x+r.width/2+matriz.a*sx*elemento.offsetWidth/2+matriz.c*sy*elemento.offsetHeight/2,
          y:r.y+r.height/2+matriz.b*sx*elemento.offsetWidth/2+matriz.d*sy*elemento.offsetHeight/2,
        }));
        return {visible:!elemento.hidden,x:r.x,y:r.y,w:r.width,h:r.height,esquinas,
          paralela:Math.abs((matriz.a*dy-matriz.b*dx)/largo)<.00001,
          legible:matriz.a>=-.00001,
          separacion:Math.abs((r.x+r.width/2-a.x)*dy-(r.y+r.height/2-a.y)*dx)/largo-elemento.offsetHeight/2,
          recuadro:estilo.backgroundColor==='rgb(11, 23, 42)' && estilo.borderTopWidth==='1px',fuente:estilo.fontFamily};
      });
      const obstaculos=[...puntos.map(p=>{const s=proyectar(p.x,p.y);return {x:s.x-17,y:s.y-35,w:34,h:48};}),
        ...capa.unidadesEstaticas.map(p=>{const s=proyectar(p.x,p.y);return {x:s.x-25,y:s.y-25,w:50,h:50};})];
      casos.push({etiquetas,total:medicion.total.textContent,obstaculos,giro,zoom});
    }
    return casos;
  });
  const solapa=(a,b)=>{
    const vertices=r=>r.esquinas ?? [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
    const p=vertices(a),q=vertices(b);
    return [p,q].every(poligono=>poligono.every((v,i)=>{
      const siguiente=poligono[(i+1)%4], eje={x:v.y-siguiente.y,y:siguiente.x-v.x};
      const proyectar=lista=>lista.map(pt=>pt.x*eje.x+pt.y*eje.y);
      const pp=proyectar(p),pq=proyectar(q);
      return Math.max(...pp)>Math.min(...pq) && Math.max(...pq)>Math.min(...pp);
    }));
  };
  for (const caso of resultado) {
    assert.equal(caso.total,'Red · 42,3 km');
    assert.equal(caso.etiquetas.filter(e=>e.visible).length,4,JSON.stringify(caso));
    for(const [i,e] of caso.etiquetas.entries()) {
      assert.ok(e.x>=0 && e.y>=0 && e.x+e.w<=1000 && e.y+e.h<=1000);
      assert.ok(![...caso.obstaculos,...caso.etiquetas.slice(i+1)].some(o=>solapa(e,o)));
      assert.ok(e.paralela && e.legible && e.recuadro && e.separacion>=7.5 && e.separacion<=42.5,JSON.stringify(e));
      assert.match(e.fuente,/Silkscreen/);
    }
  }
  await v.pagina.screenshot({path:'/tmp/metronet-medicion-tramos-cercanos.png'});
  assert.deepEqual(v.errores,[]);
});
