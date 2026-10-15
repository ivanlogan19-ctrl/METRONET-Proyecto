import puntosMapa from '../mapa/datos/puntos-interes.json';
import {accionesMetas, metasActivas, valorMeta, cambiarMeta, avisosMetas} from './MetasNivel.mjs';

const puntos = Object.values(puntosMapa.barrios).flatMap(b => b.puntos).sort((a,b) => a.nombre.localeCompare(b.nombre, 'es'));
export function crearEditorMetasNivel(panel, datos, {crear, campo, alCambiar}) {
  const reglas = datos.reglasExito;
  let metaSeleccionada, lugarSeleccionado = 0;
  const guardarCambio = () => { reglas.textosMetas ??= {}; alCambiar(); };
  const boton = (texto, accion, clase = '') => {
    const visible=texto.startsWith('Agregar')?'Agregar':texto.startsWith('Quitar')?'Quitar':texto;
    const b = crear('button', visible, `admin-secundario ${clase}`); b.type = 'button';
    if(visible!==texto)b.setAttribute('aria-label',texto);
    b.addEventListener('click', accion); return b;
  };
  const nombreLugar = objetivo => puntos.find(p => p.id === objetivo.idPunto)?.nombre ?? 'Lugar objetivo';
  function pintar() {
    panel.replaceChildren();
    const metas = metasActivas(reglas), disponibles = accionesMetas.filter(a => !metas.includes(a));
    if (!metas.some(a => a.clave === metaSeleccionada)) metaSeleccionada = metas[0]?.clave;
    const seccion = crear('section', '', 'admin-metas__edicion'); panel.append(seccion);
    seccion.append(crear('h3', `Metas del nivel · ${metas.length}/5`));
    const seleccion = crear('div', '', 'admin-metas__seleccion');seleccion.setAttribute('role','group');seleccion.setAttribute('aria-label','Metas del nivel');seccion.append(seleccion);
    metas.forEach((a,i) => {
      const b=boton(`${i+1} · ${a.nombre}`,()=>{metaSeleccionada=a.clave;pintar();panel.querySelector(`[data-elegir-meta="${a.clave}"]`)?.focus()},'admin-metas__opcion');
      b.dataset.elegirMeta=a.clave;b.setAttribute('aria-pressed',String(a.clave===metaSeleccionada));seleccion.append(b);
    });
    const lista = crear('div', '', 'admin-metas__lista'); seccion.append(lista);
    for (const accion of metas) {
      const fila = crear('div', '', 'admin-metas__fila'); fila.dataset.meta = accion.clave; fila.hidden = accion.clave !== metaSeleccionada;
      fila.append(crear('h4','Editar meta seleccionada'));
      campo(fila, 'Acción que se comprueba', accion.clave, nuevaClave => {
        cambiarMeta(reglas, accion.clave, false);
        const siguiente = accionesMetas.find(a => a.clave === nuevaClave);
        cambiarMeta(reglas, nuevaClave, siguiente.cantidad ?? true); metaSeleccionada=nuevaClave; guardarCambio(); pintar();
      }, {opciones:[accion, ...disponibles].map(a => ({valor:a.clave,texto:a.nombre})),edicion:false});
      fila.querySelector('label').firstChild.textContent='Acción';
      if (accion.cantidad !== undefined) {
        const cantidad = campo(fila, 'Cantidad', valorMeta(reglas, accion.clave), v => {cambiarMeta(reglas, accion.clave, v);guardarCambio();}, {tipo:'number',edicion:false});
        cantidad.min = '1'; cantidad.step = '1';
      }
      const texto=campo(fila, 'Texto de la meta', reglas.textosMetas?.[accion.clave] ?? accion.texto, texto => {
        reglas.textosMetas ??= {}; reglas.textosMetas[accion.clave] = texto; guardarCambio();
      }, {tipo:'text',edicion:false});texto.maxLength=180;texto.parentElement.firstChild.textContent='Texto';
      fila.append(boton('Quitar', () => {cambiarMeta(reglas, accion.clave, false);guardarCambio();pintar();}, 'metronet-boton--peligro'));
      lista.append(fila);
    }
    const agregarZona=crear('div','','admin-metas__agregar');seccion.append(agregarZona);
    let nueva=disponibles[0]?.clave;
    if(metas.length<5)campo(agregarZona,'Nueva meta',nueva,v=>{nueva=v},{opciones:disponibles.map(a=>({valor:a.clave,texto:a.nombre})),edicion:false});
    const agregar=boton('Agregar meta',()=>{
      const a=accionesMetas.find(a=>a.clave===nueva);cambiarMeta(reglas,nueva,a.cantidad??true);metaSeleccionada=nueva;guardarCambio();pintar();
    },'metronet-boton--exito');agregar.disabled=metas.length>=5||!disponibles.length;agregarZona.append(agregar);

    const lugares = crear('section', '', 'admin-metas__lugares'); panel.append(lugares);
    const objetivos = reglas.puntosInteresObjetivo ?? [];
    lugares.append(crear('h3', `Lugares objetivo · ${objetivos.length}/3`));
    lugarSeleccionado=Math.min(lugarSeleccionado,Math.max(0,objetivos.length-1));
    const listaLugares=crear('div','','admin-metas__seleccion');listaLugares.setAttribute('role','group');listaLugares.setAttribute('aria-label','Lugares objetivo');lugares.append(listaLugares);
    objetivos.forEach((o,i)=>{
      const b=boton(nombreLugar(o),()=>{lugarSeleccionado=i;pintar();panel.querySelector(`[data-elegir-lugar="${i}"]`)?.focus()},'admin-metas__opcion');
      b.dataset.elegirLugar=i;b.setAttribute('aria-pressed',String(i===lugarSeleccionado));listaLugares.append(b);
    });
    for (const [indice, objetivo] of objetivos.entries()) {
      const fila = crear('div', '', 'admin-metas__poi'); fila.hidden=indice!==lugarSeleccionado;
      fila.append(crear('h4','Editar lugar objetivo'));
      campo(fila, `Lugar ${indice+1}`, objetivo.idPunto, id => {
        if(reglas.textosMetas)delete reglas.textosMetas[`poi:${objetivo.idPunto}`];
        objetivo.idPunto=Number(id);delete objetivo.nombrePunto;guardarCambio();pintar();
      }, {opciones:puntos.filter(p=>p.id===objetivo.idPunto||!objetivos.some(o=>o.idPunto===p.id)).map(p=>({valor:p.id,texto:p.nombre})),edicion:false});
      const radio=campo(fila,'Radio de cobertura (unidades del mapa)',objetivo.radioCobertura,v=>{objetivo.radioCobertura=v;guardarCambio();},{tipo:'number',edicion:false});radio.min='0.01';radio.parentElement.firstChild.textContent='Radio (u. mapa)';
      const texto=campo(fila,'Texto del lugar',reglas.textosMetas?.[`poi:${objetivo.idPunto}`]??`Conectar ${nombreLugar(objetivo)}`,v=>{
        reglas.textosMetas??={};reglas.textosMetas[`poi:${objetivo.idPunto}`]=v;guardarCambio();
      },{tipo:'text',edicion:false});texto.maxLength=180;texto.parentElement.firstChild.textContent='Texto';
      fila.append(boton('Quitar lugar',()=>{
        if(reglas.textosMetas)delete reglas.textosMetas[`poi:${objetivo.idPunto}`];
        objetivos.splice(indice,1);if(!objetivos.length){delete reglas.puntosInteresObjetivo;delete reglas.requierePoiIndividuales;}
        guardarCambio();pintar();
      },'metronet-boton--peligro'));lugares.append(fila);
    }
    const agregarPoi=boton('Agregar lugar objetivo',()=>{
      const p=puntos.find(p=>!objetivos.some(o=>o.idPunto===p.id));reglas.puntosInteresObjetivo??=[];
      reglas.puntosInteresObjetivo.push({idPunto:p.id,radioCobertura:40});lugarSeleccionado=reglas.puntosInteresObjetivo.length-1;
      reglas.requierePoiIndividuales=true;guardarCambio();pintar();
    },'metronet-boton--exito');agregarPoi.disabled=objetivos.length>=3;lugares.append(agregarPoi);
    if(objetivos.length)campo(lugares,'Exigir cada lugar como objetivo separado',reglas.requierePoiIndividuales??false,v=>{reglas.requierePoiIndividuales=v;guardarCambio();},{edicion:false});
    const vista=crear('div','','admin-metas__vista');lugares.append(vista);
    const avisos=crear('div','','admin-metas__avisos');avisos.setAttribute('role','status');panel.append(avisos);
    const actualizar=()=>{
      avisos.replaceChildren(...avisosMetas(reglas,datos.herramientasHabilitadas).map(t=>crear('p',t)));
      vista.replaceChildren(crear('h4','Así lo ve el jugador'));
      const muestra=crear('div','','admin-metas__muestra');vista.append(muestra);
      const accion=metas.find(a=>a.clave===metaSeleccionada);
      const ejemplos=[];
      if(accion){const cantidad=accion.cantidad===undefined?1:valorMeta(reglas,accion.clave);ejemplos.push([(reglas.textosMetas?.[accion.clave]??accion.texto).replaceAll('{cantidad}',cantidad),cantidad]);}
      const o=objetivos[lugarSeleccionado];if(o&&reglas.requierePoiIndividuales)ejemplos.push([reglas.textosMetas?.[`poi:${o.idPunto}`]??`Conectar ${nombreLugar(o)}`,1]);
      for(const [texto,cantidad] of ejemplos){const fila=crear('div','','admin-metas__ejemplo');fila.append(crear('span',`□ ${texto}`),crear('span',`0/${cantidad}`));muestra.append(fila);}
    };
    panel.oninput=actualizar;panel.onchange=actualizar;actualizar();
  }
  pintar();
}
