import catalogo from '../educacion/catalogo-svgs-niveles.json';
import nivelesIniciales from '../educacion/niveles.json';
import { crearEditorRedReferenciaNivel } from './EditorRedReferenciaNivel.js';
import { confirmarSistema } from '../componentes/DialogoSistema.js';

const nombres = {
  minimoEstaciones:'Mínimo de estaciones', maximoEstaciones:'Máximo de estaciones', minimoLineas:'Mínimo de líneas',
  minimoTramos:'Mínimo de conexiones', minimoMetros:'Mínimo de unidades', minimoTransbordos:'Mínimo de transbordos',
  transbordosPorConexion:'Contar estaciones compartidas por líneas',
  requiereRedValida:'Regla histórica no evaluada', requiereSimulacion:'Exigir simulación',
  requiereCoberturaPuntosInteres:'Cobertura de lugares objetivo', requiereObjetivosMismaLinea:'Lugares en una misma línea',
  requiereGeografiaValida:'Exigir geografía válida', puntosInteresObjetivo:'Lugares objetivo',
  areasObjetivo:'Barrios y zonas objetivo', aprendizajeSimulacion:'Prácticas de simulación',
  puntuacion:'Puntuación', restriccionesGeograficas:'Restricciones geográficas',
};

const etiqueta = clave => nombres[clave] ?? clave.replace(/([A-Z])/g,' $1').replace(/^./,letra=>letra.toUpperCase());
const nombreCorto = (numero,nombre) => String(nombre??'').replace(new RegExp(`^Nivel\\s+${numero}\\s*[·:–-]\\s*`,'i'),'');
const crear = (tag, texto='', clase='') => {
  const n=document.createElement(tag); n.textContent=texto; if(clase)n.className=clase; return n;
};
const copiar = dato => structuredClone(dato);

export function crearAdministracionNiveles({ contenedor, mensaje, token, urlServidor, errorRespuesta }) {
  let lista=[], actual=null, mapa=null, operando=false;
  const anunciar=(texto,tipo='')=>{ mensaje.textContent=texto; mensaje.className=`admin-mensaje ${tipo}`; };

  async function pedir(ruta,opciones={}) {
    const respuesta=await fetch(`${urlServidor()}/api/admin/niveles${ruta}`,{
      ...opciones, headers:{Authorization:`Bearer ${token}`,...opciones.headers},
    });
    if(!respuesta.ok) throw new Error(await errorRespuesta(respuesta,'No se pudo actualizar el nivel.'));
    return respuesta.json();
  }

  async function cargar() {
    anunciar('Cargando los diez niveles…');
    try { lista=await pedir(''); pintarLista(); anunciar(''); }
    catch(error){ anunciar(error.message,'error'); }
  }

  function pintarLista() {
    const tabla=crear('div','','admin-niveles__lista');
    for(const nivel of lista) {
      const fila=crear('article','','admin-niveles__fila');
      fila.append(crear('strong',`Nivel ${nivel.numero} · ${nombreCorto(nivel.numero,nivel.nombre)}`),
        crear('span',`Publicada v${nivel.versionPublicada} · Borrador revisión ${nivel.revisionBorrador}`));
      const boton=crear('button','Editar','admin-secundario'); boton.type='button';
      boton.addEventListener('click',()=>abrir(nivel.numero)); fila.append(boton); tabla.append(fila);
    }
    const editor=contenedor.querySelector('[data-editor-nivel]') ?? crear('div','','admin-niveles__editor');
    editor.dataset.editorNivel='';
    if(actual) {
      const cambiar=crear('details','','admin-niveles__cambiar');
      cambiar.append(crear('summary','Cambiar de nivel'),tabla);
      contenedor.replaceChildren(editor,cambiar);
    } else contenedor.replaceChildren(tabla,editor);
    if(actual) pintarEditor();
  }

  async function abrir(numero) {
    if(operando) return;
    operando=true; anunciar(`Cargando nivel ${numero}…`);
    try {
      const [borrador,versiones]=await Promise.all([pedir(`/${numero}/borrador`),pedir(`/${numero}/versiones`)]);
      const contenido=borrador.contenido;
      actual={numero,borrador,versiones,vista:null,sucio:false,datos:{
        desafio:copiar(contenido.desafio),reglasExito:copiar(contenido.reglasExito),
        herramientasHabilitadas:copiar(contenido.herramientasHabilitadas),
        criterioUvUt:contenido.criterioUvUt?copiar(contenido.criterioUvUt):null,
        redReferencia:copiar(borrador.redReferencia),ayudas:copiar(contenido.ayudas ?? []),
        tarjetas:copiar(borrador.tarjetas),
      }};
      for(const clave of ['estaciones','lineas','tramos','unidades','ejecuciones'])
        actual.datos.redReferencia[clave] ??= [];
      pintarLista(); anunciar(`Editando nivel ${numero}. Guardá el borrador antes de previsualizar.`);
      contenedor.querySelector('[data-editor-nivel]')?.scrollIntoView({block:'start'});
    } catch(error){ anunciar(error.message,'error'); }
    finally { operando=false; }
  }

  function marcarSucio() {
    if(!actual)return;
    actual.sucio=true; actual.vista=null;
    const boton=contenedor.querySelector('[data-publicar-nivel]'); if(boton) boton.disabled=true;
    const indicador=contenedor.querySelector('[data-estado-borrador]');
    if(indicador) indicador.textContent='Cambios sin guardar';
    const vista=contenedor.querySelector('[data-vista-previa]');
    if(vista) { vista.hidden=true; vista.replaceChildren(); }
  }

  function campo(parent,nombre,valor,alCambiar,{tipo,opciones}={}) {
    const label=crear('label',nombre,'admin-niveles__campo');
    let input;
    if(opciones) {
      input=crear('select');
      for(const opcion of opciones) {const o=crear('option',opcion.texto??opcion.valor);o.value=opcion.valor;input.append(o)}
      input.value=String(valor ?? '');
    } else if(typeof valor==='boolean'||tipo==='checkbox') {
      input=crear('input'); input.type='checkbox'; input.checked=Boolean(valor);
    } else if(tipo==='multiline'||String(valor??'').length>130) {
      input=crear('textarea'); input.rows=tipo==='multiline'?4:3; input.value=valor??'';
    } else {
      input=crear('input'); input.type=typeof valor==='number'||tipo==='number'?'number':'text';
      if(input.type==='number') input.step='any'; input.value=valor??'';
    }
    input.addEventListener(input.type==='checkbox'||opciones?'change':'input',()=>{
      alCambiar(input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value);
      marcarSucio();
    });
    label.append(input); parent.append(label); return input;
  }

  function editarValor(parent,nombre,valor,actualizar) {
    if(Array.isArray(valor)) {
      const grupo=crear('fieldset'); grupo.append(crear('legend',etiqueta(nombre)));
      valor.forEach((item,i)=>{
        const fila=crear('div','','admin-niveles__grupo');
        fila.append(crear('strong',`${etiqueta(nombre)} ${i+1}`));
        editarValor(fila,'valor',item,nuevo=>{valor[i]=nuevo;actualizar(valor)});
        const quitar=crear('button','Quitar','admin-secundario');quitar.type='button';
        quitar.addEventListener('click',()=>{valor.splice(i,1);actualizar(valor);marcarSucio();pintarEditor()});
        fila.append(quitar);grupo.append(fila);
      });
      if(valor.length) {
        const agregar=crear('button',`Agregar ${etiqueta(nombre).toLowerCase()}`,'admin-secundario');agregar.type='button';
        agregar.addEventListener('click',()=>{valor.push(copiar(valor.at(-1)));actualizar(valor);marcarSucio();pintarEditor()});
        grupo.append(agregar);
      }
      parent.append(grupo);return;
    }
    if(valor && typeof valor==='object') {
      const grupo=crear('fieldset');grupo.append(crear('legend',etiqueta(nombre)));
      for(const [clave,item] of Object.entries(valor)) editarValor(grupo,clave,item,nuevo=>{valor[clave]=nuevo;actualizar(valor)});
      parent.append(grupo);return;
    }
    campo(parent,etiqueta(nombre),valor,actualizar);
  }

  function seccion(titulo) {
    const detalles=crear('details','','admin-niveles__seccion');
    detalles.append(crear('summary',titulo));detalles.open=true;return detalles;
  }

  function pintarEditor() {
    if(!actual)return;
    const {numero,datos,borrador}=actual;
    const editor=contenedor.querySelector('[data-editor-nivel]');
    editor.replaceChildren();
    const cabecera=crear('header','','admin-niveles__cabecera');
    cabecera.append(crear('h2',`Nivel ${numero} · ${nombreCorto(numero,datos.desafio.nombre)}`),
      crear('p',`Versión base ${borrador.versionBase} · Revisión ${borrador.revision}`));
    const estado=crear('p',actual.sucio?'Cambios sin guardar':'Borrador guardado','admin-niveles__estado');
    estado.dataset.estadoBorrador='';editor.append(cabecera);

    const acciones=crear('div','','admin-niveles__acciones');
    const guardar=crear('button','Guardar borrador','admin-guardar'); guardar.type='button';guardar.addEventListener('click',guardarBorrador);
    const previsualizar=crear('button','Previsualizar y validar','admin-secundario');previsualizar.type='button';
    previsualizar.addEventListener('click',previsualizarNivel);
    const confirmar=crear('label','Revisé las afirmaciones, fuentes e imágenes de las siete tarjetas.');
    const casilla=crear('input');casilla.type='checkbox';casilla.dataset.confirmacionEditorial='';confirmar.prepend(casilla);
    const publicar=crear('button','Publicar versión','admin-guardar');publicar.type='button';publicar.dataset.publicarNivel='';
    publicar.disabled=!actual.vista?.diagnostico?.viable || actual.sucio;
    publicar.addEventListener('click',publicarNivel);
    acciones.append(estado,guardar,previsualizar,confirmar,publicar);editor.append(acciones);

    const desafio=seccion('1. Desafío');
    for(const clave of ['nombre','relato','objetivo','instrucciones','dificultad'])
      campo(desafio,etiqueta(clave),datos.desafio[clave],valor=>{datos.desafio[clave]=valor},
        {tipo:['relato','objetivo','instrucciones'].includes(clave)?'multiline':undefined});
    editor.append(desafio);

    const reglas=seccion('2. Reglas y herramientas');
    const conocidas=new Map(nivelesIniciales.flatMap(n=>Object.entries(n.reglasExito)));
    for(const [clave,valor] of Object.entries(datos.reglasExito)) {
      if(clave==='puntuacion')continue;
      const fila=crear('div','','admin-niveles__regla');
      editarValor(fila,clave,valor,nuevo=>{datos.reglasExito[clave]=nuevo});
      const quitar=crear('button',`Quitar ${etiqueta(clave)}`,'admin-secundario'); quitar.type='button';
      quitar.addEventListener('click',()=>{delete datos.reglasExito[clave];marcarSucio();pintarEditor()});
      fila.append(quitar);reglas.append(fila);
    }
    const agregarRegla=crear('select'); agregarRegla.setAttribute('aria-label','Regla admitida para agregar');
    for(const [clave] of conocidas) if(clave!=='puntuacion'&&!(clave in datos.reglasExito)) {
      const opcion=crear('option',etiqueta(clave));opcion.value=clave;agregarRegla.append(opcion);
    }
    const botonAgregar=crear('button','Agregar regla admitida','admin-secundario');botonAgregar.type='button';
    botonAgregar.disabled=!agregarRegla.options.length;
    botonAgregar.addEventListener('click',()=>{
      const clave=agregarRegla.value;datos.reglasExito[clave]=copiar(conocidas.get(clave));marcarSucio();pintarEditor();
    });
    reglas.append(agregarRegla,botonAgregar);
    const herramientas=crear('fieldset');herramientas.append(crear('legend','Herramientas habilitadas'));
    for(const [clave,valor] of Object.entries(datos.herramientasHabilitadas))
      campo(herramientas,etiqueta(clave),valor,nuevo=>{datos.herramientasHabilitadas[clave]=nuevo});
    reglas.append(herramientas);
    editor.append(reglas);

    const red=seccion('3. Red de referencia');
    red.append(crear('p','Ubicá estaciones en el mapa, uní sus recorridos y describí las unidades. La referencia comprueba una solución; revisá también su valor pedagógico.'));
    const redTrabajo=crear('div','','admin-niveles__red-trabajo');
    const visor=crear('div','','admin-red-referencia');redTrabajo.append(visor);
    mapa=crearEditorRedReferenciaNivel(visor,datos.redReferencia,()=>{marcarSucio();pintarTablasRed()});
    const tablas=crear('div','','admin-niveles__tablas-red');tablas.dataset.tablasRed='';redTrabajo.append(tablas);
    red.append(redTrabajo);
    editor.append(red);

    if(numero>=4) {
      const criterio=seccion('4. Tiempo UT y presupuesto UV');
      for(const clave of ['limiteUt','presupuestoUv'])
        campo(criterio,clave==='limiteUt'?'Límite UT':'Presupuesto UV',datos.criterioUvUt?.[clave],
          valor=>{datos.criterioUvUt??={};datos.criterioUvUt[clave]=valor},{tipo:'number'});
      editor.append(criterio);
    }

    const educacion=seccion(numero>=4?'5. Tarjetas y ayudas':'4. Tarjetas y ayudas');
    educacion.append(crear('p','Cada nivel conserva siete tarjetas con su ID. Revisá juntos texto, fuente e imagen antes de publicar.'));
    const tarjetas=crear('div','','admin-niveles__tarjetas');
    datos.tarjetas.forEach((tarjeta,i)=>{
      const panel=seccion(`Tarjeta ${i+1} · ${tarjeta.id}`);panel.open=false;
      for(const clave of ['titulo','texto','aprendizaje','fuente','urlFuente','descripcionImagen'])
        campo(panel,etiqueta(clave),tarjeta[clave],valor=>{tarjeta[clave]=valor},
          {tipo:['texto','aprendizaje','descripcionImagen'].includes(clave)?'multiline':undefined});
      const opciones=catalogo.flatMap(n=>n.tarjetas).map(t=>({valor:t.imagen,texto:`${t.id} · ${t.titulo}`}));
      campo(panel,'Imagen SVG local',tarjeta.idSvgCatalogo,valor=>{tarjeta.idSvgCatalogo=valor},{opciones});
      tarjetas.append(panel);
    });
    educacion.append(tarjetas,crear('h3','Pistas por condición'));
    const ayudas=crear('div','','admin-niveles__ayudas');
    datos.ayudas.forEach((ayuda,i)=>{
      const fila=crear('div','','admin-niveles__grupo');
      for(const clave of ['claveCondicion','texto','pista'])
        campo(fila,etiqueta(clave),ayuda[clave]??'',valor=>{ayuda[clave]=valor},{tipo:clave==='claveCondicion'?undefined:'multiline'});
      const quitar=crear('button','Quitar pista','admin-secundario');quitar.type='button';
      quitar.addEventListener('click',()=>{datos.ayudas.splice(i,1);marcarSucio();pintarEditor()});
      fila.append(quitar);ayudas.append(fila);
    });
    const agregarAyuda=crear('button','Agregar pista','admin-secundario');agregarAyuda.type='button';
    agregarAyuda.addEventListener('click',()=>{datos.ayudas.push({claveCondicion:'minimoEstaciones',texto:'',pista:''});marcarSucio();pintarEditor()});
    educacion.append(ayudas,agregarAyuda);editor.append(educacion);

    const vista=crear('div','','admin-niveles__vista');vista.dataset.vistaPrevia='';vista.hidden=!actual.vista;editor.append(vista);
    const historial=crear('section','','admin-niveles__historial');historial.append(crear('h3','Historial y reversión'));
    actual.versiones.forEach(version=>{
      const fila=crear('div','','admin-niveles__fila');fila.append(crear('span',`Versión ${version.version} · ${version.publicadoEn}`));
      const boton=crear('button','Preparar reversión','admin-secundario');boton.type='button';
      if(!referenciaConstruida(version.redReferencia)
        && !actual.versiones.some(otra=>otra.version!==version.version&&referenciaConstruida(otra.redReferencia))) {
        boton.disabled=true;
        boton.title='Publicá primero una red de referencia para poder preparar esta reversión.';
      }
      boton.addEventListener('click',()=>prepararReversion(version.version));fila.append(boton);historial.append(fila);
    });editor.append(historial);
    pintarTablasRed(); if(actual.vista) pintarVista(actual.vista);
  }

  function referenciaConstruida(red) {
    return red?.estaciones?.length>=2&&red?.lineas?.length>0&&red?.tramos?.length>0;
  }

  function pintarTablasRed() {
    const tablas=contenedor.querySelector('[data-tablas-red]'); if(!tablas||!actual)return;
    tablas.replaceChildren();
    const red=actual.datos.redReferencia;
    const plantillas={
      estaciones:()=>({nombre:`E${red.estaciones.length+1}`,x:660,y:460,transbordo:false}),
      lineas:()=>({nombre:`Línea ${red.lineas.length+1}`}),
      tramos:()=>({linea:red.lineas[0]?.nombre??'',a:red.estaciones[0]?.nombre??'',b:red.estaciones[1]?.nombre??''}),
      unidades:()=>({linea:red.lineas[0]?.nombre??'',capacidad:300,uv:1}),
      ejecuciones:()=>({duracion:2,velocidad:1,unidades:red.unidades.map(u=>({uv:u.uv}))}),
    };
    const titulos={estaciones:'Estaciones',lineas:'Líneas',tramos:'Conexiones',unidades:'Unidades',ejecuciones:'Ejecuciones de prueba'};
    for(const [tipo,plantilla] of Object.entries(plantillas)) {
      const panel=seccion(titulos[tipo]);panel.open=false;
      red[tipo].forEach((item,i)=>{
        const fila=crear('div','','admin-niveles__grupo');fila.append(crear('strong',`${titulos[tipo]} ${i+1}`));
        for(const [clave,valor] of Object.entries(item)) editarValor(fila,clave,valor,nuevo=>{item[clave]=nuevo;mapa?.actualizar()});
        const quitar=crear('button','Quitar','admin-secundario');quitar.type='button';
        quitar.addEventListener('click',()=>{red[tipo].splice(i,1);marcarSucio();pintarTablasRed();mapa?.actualizar()});
        fila.append(quitar);panel.append(fila);
      });
      const agregar=crear('button',`Agregar ${titulos[tipo].toLowerCase()}`,'admin-secundario');agregar.type='button';
      agregar.addEventListener('click',()=>{red[tipo].push(plantilla());marcarSucio();pintarTablasRed();mapa?.actualizar()});
      panel.append(agregar);tablas.append(panel);
    }
  }

  async function guardarBorrador() {
    if(!actual||operando)return;
    if(actual.datos.tarjetas.some(tarjeta=>!urlFuenteValida(tarjeta.urlFuente))) {
      anunciar('Cada tarjeta necesita una URL HTTP(S) con host válido para su fuente.','error');return;
    }
    operando=true;anunciar('Guardando borrador…');
    try {
      const {borrador,datos,numero}=actual;
      const guardado=await pedir(`/${numero}/borrador`,{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...datos,versionBase:borrador.versionBase,revisionEsperada:borrador.revision})});
      actual.borrador=guardado;actual.sucio=false;actual.vista=null;pintarEditor();
      anunciar(`Borrador del nivel ${numero} guardado, revisión ${guardado.revision}.`);
    } catch(error){anunciar(error.message,'error')} finally {operando=false}
  }

  function urlFuenteValida(valor) {
    if(typeof valor!=='string'||!/^https?:\/\//i.test(valor))return false;
    try {const url=new URL(valor);return ['http:','https:'].includes(url.protocol)&&Boolean(url.hostname)&&!url.username&&!url.password}
    catch {return false}
  }

  async function previsualizarNivel() {
    if(!actual||operando)return;
    if(actual.sucio){anunciar('Guardá el borrador antes de previsualizar.','error');return}
    operando=true;anunciar('Comprobando la red y las ejecuciones con las reglas del jugador…');
    try {actual.vista=await pedir(`/${actual.numero}/previsualizar`,{method:'POST'});
      pintarVista(actual.vista);
      contenedor.querySelector('[data-publicar-nivel]').disabled=!actual.vista.diagnostico.viable;
      anunciar(actual.vista.diagnostico.mensaje,actual.vista.diagnostico.viable?'':'error');
    } catch(error){actual.vista=null;anunciar(error.message,'error')}
    finally {operando=false}
  }

  function pintarVista(vista) {
    const panel=contenedor.querySelector('[data-vista-previa]');if(!panel)return;
    panel.hidden=false;
    panel.replaceChildren(crear('h3','Vista previa para Inicio, Niveles, preparación y Ayuda'));
    const d=vista.contenido.desafio;
    panel.append(crear('h4',d.nombre),crear('p',d.relato),crear('p',d.objetivo),crear('p',d.instrucciones));
    panel.append(crear('strong',`Nivel ${vista.numero} · ${d.dificultad} · ${vista.tarjetas.length} tarjetas`));
    const lista=crear('ul');
    for(const condicion of vista.diagnostico.condiciones)
      lista.append(crear('li',`${condicion.completado?'✓':'Pendiente'} · ${condicion.texto}`));
    panel.append(lista);
    for(const tarjeta of vista.tarjetas) {
      const figura=crear('figure');const imagen=crear('img');imagen.src=tarjeta.idSvgCatalogo;
      imagen.alt=tarjeta.descripcionImagen;imagen.loading='lazy';
      figura.append(imagen,crear('figcaption',`${tarjeta.titulo} · ${tarjeta.fuente} · ${tarjeta.urlFuente}`));
      panel.append(figura);
    }
  }

  async function publicarNivel() {
    if(!actual?.vista?.diagnostico?.viable||actual.sucio||operando)return;
    if(!contenedor.querySelector('[data-confirmacion-editorial]').checked) {
      anunciar('Confirmá la revisión editorial de textos, fuentes e imágenes.','error');return;
    }
    operando=true;anunciar('Publicando la versión completa…');
    try {
      const vista=actual.vista;
      const publicada=await pedir(`/${actual.numero}/publicar`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({versionEsperada:vista.versionPublicada,revisionEsperada:vista.revisionBorrador,
          huellaPreview:vista.diagnostico.huella,confirmacionEditorial:true})});
      const numero=actual.numero;
      lista=await pedir('');pintarLista();operando=false;await abrir(numero);
      anunciar(`Nivel ${numero} publicado como versión ${publicada.version}. Los intentos anteriores conservan su versión.`);
    } catch(error){anunciar(error.message,'error')}finally{operando=false}
  }

  async function prepararReversion(version) {
    if(!actual||operando)return;
    const numero=actual.numero;
    if(actual.sucio && !await confirmarSistema('Tenés cambios sin guardar. ¿Descartarlos para preparar la reversión?'))return;
    if(!actual||actual.numero!==numero||operando)return;
    const origen=actual.versiones.find(item=>item.version===version);
    const referenciaReutilizada=origen&&!referenciaConstruida(origen.redReferencia);
    operando=true;
    try {
      await pedir(`/${numero}/versiones/${version}/preparar-reversion`,{method:'POST'});
      operando=false;await abrir(numero);
      anunciar(`Versión ${version} copiada al borrador.${referenciaReutilizada?' Se conservó una referencia publicada reciente.':''} Revisá y previsualizá antes de publicar.`);
    } catch(error){anunciar(error.message,'error')}finally{operando=false}
  }

  return { cargar };
}
