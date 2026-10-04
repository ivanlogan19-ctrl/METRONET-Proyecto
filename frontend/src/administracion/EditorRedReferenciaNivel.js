const NS = 'http://www.w3.org/2000/svg';
const ANCHO = 1000;
const ALTO = 620;

function nodo(nombre, atributos = {}) {
  const elemento = document.createElementNS(NS, nombre);
  for (const [clave, valor] of Object.entries(atributos)) elemento.setAttribute(clave, String(valor));
  return elemento;
}

function anillos(geometria) {
  if (geometria?.type === 'Polygon') return geometria.coordinates;
  if (geometria?.type === 'MultiPolygon') return geometria.coordinates.flat();
  return [];
}

// Comparte el GeoJSON y la escala 1000 × 620 utilizados por el mapa del jugador.
export function crearEditorRedReferenciaNivel(contenedor, red, alCambiar) {
  const svg = nodo('svg', { viewBox: `0 0 ${ANCHO} ${ALTO}`, role: 'img',
    'aria-label': 'Mapa de referencia privado. Hacé clic para ubicar estaciones.' });
  svg.classList.add('admin-red-referencia__mapa');
  const modos = document.createElement('select');
  modos.setAttribute('aria-label', 'Acción del mapa de referencia');
  for (const [valor, texto] of [['estacion','Agregar estación'],['tramo','Conectar estaciones'],['mover','Mover estación']]) {
    const opcion = document.createElement('option'); opcion.value = valor; opcion.textContent = texto; modos.append(opcion);
  }
  const linea = document.createElement('select'); linea.setAttribute('aria-label', 'Línea de referencia activa');
  const estado = document.createElement('p'); estado.setAttribute('role','status');
  estado.className = 'admin-red-referencia__estado';
  const controles = document.createElement('div'); controles.className = 'admin-red-referencia__controles';
  controles.append(modos,linea);
  contenedor.replaceChildren(controles,svg,estado);
  let barrios = null, transformar = null, seleccion = null;

  function coordenadas(evento) {
    const punto = svg.createSVGPoint(); punto.x = evento.clientX; punto.y = evento.clientY;
    const matriz = svg.getScreenCTM();
    if (!matriz) return null;
    const local = punto.matrixTransform(matriz.inverse());
    return { x: Math.max(0,Math.min(ANCHO,Math.round(local.x))),
      y: Math.max(0,Math.min(ALTO,Math.round(local.y))) };
  }

  function refrescarLineas() {
    const anterior = linea.value;
    linea.replaceChildren();
    if (!(red.lineas ?? []).length) {
      const vacia=document.createElement('option'); vacia.value=''; vacia.textContent='Agregá una línea para conectar';
      linea.append(vacia);
    }
    for (const l of red.lineas ?? []) {
      const opcion=document.createElement('option'); opcion.value=l.nombre; opcion.textContent=l.nombre; linea.append(opcion);
    }
    if ([...(red.lineas ?? [])].some(l => l.nombre === anterior)) linea.value = anterior;
    linea.disabled = !(red.lineas ?? []).length;
  }

  function pintar() {
    refrescarLineas();
    svg.replaceChildren();
    svg.append(nodo('rect',{x:0,y:0,width:ANCHO,height:ALTO,fill:'#0a1425'}));
    if (barrios && transformar) {
      for (const barrio of barrios.features) {
        for (const anillo of anillos(barrio.geometry)) {
          const puntos=anillo.map(p => transformar(p));
          const d=puntos.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')+' Z';
          svg.append(nodo('path',{d,fill:'#162d40',stroke:'#397187','stroke-width':0.7,'pointer-events':'none'}));
        }
      }
    }
    const estaciones = new Map((red.estaciones ?? []).map(e => [e.nombre,e]));
    for (const tramo of red.tramos ?? []) {
      const a=estaciones.get(tramo.a), b=estaciones.get(tramo.b);
      if (a && b) svg.append(nodo('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,
        stroke:'#ffcb53','stroke-width':4,'stroke-linecap':'round','pointer-events':'none'}));
    }
    for (const estacion of red.estaciones ?? []) {
      const grupo=nodo('g',{tabindex:0,role:'button','aria-label':`Estación ${estacion.nombre}`});
      grupo.dataset.estacion=estacion.nombre;
      grupo.append(nodo('circle',{cx:estacion.x,cy:estacion.y,r:9,fill:seleccion===estacion.nombre?'#fff1ac':'#f6f3e7',
        stroke:'#1b2337','stroke-width':2}));
      const rotulo=nodo('text',{x:Number(estacion.x)+12,y:Number(estacion.y)-10,fill:'#fff',
        'font-size':15,'paint-order':'stroke',stroke:'#101a29','stroke-width':3});
      rotulo.textContent=estacion.nombre; grupo.append(rotulo);
      grupo.addEventListener('click',evento=>{
        evento.stopPropagation();
        if (modos.value==='tramo') {
          if (!linea.value) { estado.textContent='Primero agregá una línea.'; return; }
          if (!seleccion) { seleccion=estacion.nombre; estado.textContent=`Elegí otra estación para conectar desde ${seleccion}.`; }
          else if (seleccion!==estacion.nombre) {
            red.tramos.push({linea:linea.value,a:seleccion,b:estacion.nombre});
            seleccion=null; estado.textContent='Conexión agregada; guardá el borrador para conservarla.'; alCambiar();
          }
        } else if (modos.value==='mover') {
          seleccion=estacion.nombre; estado.textContent=`Elegí en el mapa la nueva posición de ${seleccion}.`;
        }
        pintar();
      });
      grupo.addEventListener('keydown',evento=>{
        const paso={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[evento.key];
        if (!paso) return;
        evento.preventDefault(); estacion.x=Math.max(0,Math.min(ANCHO,Number(estacion.x)+paso[0]*5));
        estacion.y=Math.max(0,Math.min(ALTO,Number(estacion.y)+paso[1]*5));
        alCambiar(); pintar();
        [...svg.querySelectorAll('[data-estacion]')]
          .find(n => n.dataset.estacion === estacion.nombre)?.focus({preventScroll:true});
      });
      svg.append(grupo);
    }
  }

  svg.addEventListener('click',evento=>{
    const punto=coordenadas(evento); if (!punto) return;
    if (modos.value==='estacion') {
      let indice=1; while (red.estaciones.some(e=>e.nombre===`E${indice}`)) indice++;
      red.estaciones.push({nombre:`E${indice}`,...punto,transbordo:false});
      estado.textContent=`Estación E${indice} agregada. Ajustá nombre y coordenadas si hace falta.`;
      alCambiar();
    } else if (modos.value==='mover' && seleccion) {
      Object.assign(red.estaciones.find(e=>e.nombre===seleccion) ?? {},punto);
      estado.textContent=`Estación ${seleccion} movida.`; seleccion=null; alCambiar();
    }
    pintar();
  });
  modos.addEventListener('change',()=>{ seleccion=null; pintar(); });
  fetch(new URL('../mapa/datos/barrios_wgs84.geojson', import.meta.url))
    .then(r=>r.json()).then(datos=>{
      barrios=datos;
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for (const feature of datos.features) for (const anillo of anillos(feature.geometry))
        for (const [x,y] of anillo) {
          minX=Math.min(minX,x); maxX=Math.max(maxX,x);
          minY=Math.min(minY,y); maxY=Math.max(maxY,y);
        }
      transformar=([lon,lat])=>({x:(lon-minX)/(maxX-minX)*ANCHO,y:(maxY-lat)/(maxY-minY)*ALTO});
      pintar();
    }).catch(()=>{ estado.textContent='No se pudo cargar el contorno territorial. Podés editar las coordenadas de la red.'; });
  pintar();
  return { actualizar:pintar };
}
