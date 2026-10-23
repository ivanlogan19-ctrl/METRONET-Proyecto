import { configurarAccion, configurarAccionPorNombre } from '../interfaz/AccionesInterfaz.js';
import { crearEditorMetasNivel } from './EditorMetasNivel.js';
import catalogo from '../educacion/catalogo-svgs-niveles.json';
import nivelesIniciales from '../educacion/niveles.json';
import { crearEditorRedReferenciaNivel } from './EditorRedReferenciaNivel.js';
import { confirmarSistema } from '../componentes/DialogoSistema.js';
import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';

const nombres = {
  minimoEstaciones:'Mínimo de estaciones', maximoEstaciones:'Máximo de estaciones', minimoLineas:'Mínimo de líneas',
  minimoConexionesLineas:'Conexiones entre líneas', minimoTramos:'Mínimo de tramos', minimoMetros:'Mínimo de unidades', minimoTransbordos:'Mínimo de conexiones entre líneas',
  transbordosPorConexion:'Contar estaciones compartidas por líneas',
  requiereSimulacion:'Exigir simulación',
  requiereCoberturaPuntosInteres:'Cobertura de lugares objetivo', requiereObjetivosMismaLinea:'Lugares en una misma línea',
  requiereGeografiaValida:'Exigir geografía válida', puntosInteresObjetivo:'Lugares objetivo',
  areasObjetivo:'Barrios y zonas objetivo', aprendizajeSimulacion:'Objetivos de simulación',
  puntuacion:'Puntuación', restriccionesGeograficas:'Restricciones geográficas',
};

const etiqueta = clave => nombres[clave] ?? clave.replace(/([A-Z])/g,' $1').replace(/^./,letra=>letra.toUpperCase());
const nombreCorto = (numero,nombre) => String(nombre??'').replace(new RegExp(`^Nivel\\s+${numero}\\s*[·:–-]\\s*`,'i'),'');
const crear = (tag, texto='', clase='') => {
  const n=document.createElement(tag); n.textContent=texto; if(clase)n.className=clase; if(tag==='button')configurarAccionPorNombre(n,{compacto:true}); return n;
};
const copiar = dato => structuredClone(dato);
// Solo la vista de edición adapta el SVG al cuadro; se guarda la ruta original.
const imagenAjustada = ruta => `${ruta}#svgView(preserveAspectRatio(none))`;
// Se conservan en el contrato, pero no se ofrecen como reglas editables.
const reglasNoEditables = new Set(['puntuacion', 'requiereRedValida', 'textosMetas']);
const reglasIniciales = new Map(nivelesIniciales.flatMap(n=>Object.entries(n.reglasExito)));

export function crearAdministracionNiveles({ contenedor, mensaje, token, urlServidor, errorRespuesta }) {
  let lista=[], actual=null, mapa=null, operando=false;
  const plantillasListas=new WeakMap();
  const anunciar=(texto,tipo='')=>{ mensaje.textContent=tipo==='exito'?'':texto; mensaje.className=`admin-mensaje ${tipo}`; };

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
    contenedor.closest('.admin-vista')?.classList.toggle('admin-vista--editando',Boolean(actual));
    if(actual) {
      const editor=crear('div','','admin-niveles__editor');editor.dataset.editorNivel='';
      contenedor.replaceChildren(editor);pintarEditor();return;
    }
    const tarjetas=crear('ol','','admin-niveles__lista');
    tarjetas.setAttribute('aria-label','Niveles de la experiencia de juego');
    tarjetas.setAttribute('role','list');
    for(const nivel of [...lista].sort((a,b)=>a.numero-b.numero)) {
      const tarjeta=crear('li','','admin-niveles__tarjeta');
      tarjeta.append(crear('span',String(nivel.numero).padStart(2,'0'),'admin-niveles__numero'));
      const nombre=crear('span',nombreCorto(nivel.numero,nivel.nombre),'admin-niveles__nombre');
      nombre.id=`nombre-nivel-${nivel.numero}`;tarjeta.append(nombre);
      const boton=crear('button','Editar','admin-secundario metronet-boton--advertencia'); boton.type='button';
      configurarAccion(boton,'editar');
      boton.dataset.editarNivel=String(nivel.numero);
      boton.setAttribute('aria-describedby',nombre.id);
      boton.addEventListener('click',()=>abrir(nivel.numero));tarjeta.append(boton);
      tarjetas.append(tarjeta);
    }
    contenedor.replaceChildren(tarjetas);
  }

  async function volverALosNiveles() {
    if(!actual||operando)return;
    operando=true;
    try {
      if(actual.sucio&&!await confirmarSistema('Tenés cambios sin guardar. ¿Descartarlos y volver a la lista de niveles?'))return;
      const numero=actual.numero;
      lista=await pedir('');
      actual=null;mapa=null;pintarLista();anunciar('');
      contenedor.querySelector(`[data-editar-nivel="${numero}"]`)?.focus();
    } catch(error){anunciar(error.message,'error')}
    finally{operando=false}
  }

  async function abrir(numero) {
    if(operando) return;
    operando=true; anunciar(`Cargando nivel ${numero}…`);
    try {
      const [borrador,versiones]=await Promise.all([pedir(`/${numero}/borrador`),pedir(`/${numero}/versiones`)]);
      const contenido=borrador.contenido;
      actual={numero,borrador,versiones,vista:null,sucio:false,edicion:0,confirmacionEditorial:false,seccionActiva:'desafio',tarjetaActiva:0,datos:{
        desafio:copiar(contenido.desafio),reglasExito:copiar(contenido.reglasExito),
        herramientasHabilitadas:copiar(contenido.herramientasHabilitadas),
        criterioUvUt:contenido.criterioUvUt?copiar(contenido.criterioUvUt):null,
        redReferencia:copiar(borrador.redReferencia),ayudas:copiar(contenido.ayudas ?? []),
        tarjetas:copiar(borrador.tarjetas),
      }};
      for(const clave of ['estaciones','lineas','tramos','conexionesLineas','unidades','ejecuciones'])
        actual.datos.redReferencia[clave] ??= [];
      pintarLista(); anunciar('');
      contenedor.closest('.admin-contenido')?.scrollIntoView({block:'start'});
    } catch(error){ anunciar(error.message,'error'); }
    finally { operando=false; }
  }

  function marcarSucio() {
    if(!actual)return;
    actual.sucio=true; actual.vista=null; actual.edicion++; actual.confirmacionEditorial=false;
    const confirmacion=contenedor.querySelector('[data-confirmacion-editorial]');if(confirmacion)confirmacion.checked=false;
    const boton=contenedor.querySelector('[data-publicar-nivel]'); if(boton) boton.disabled=true;
    const indicador=contenedor.querySelector('[data-estado-borrador]');
    if(indicador) actualizarEstadoBorrador(indicador);
    const vista=contenedor.querySelector('[data-vista-previa]');
    if(vista)pintarEsperaVista(vista,'Guardá y previsualizá nuevamente para revisar los cambios.');
  }

  function actualizarEstadoBorrador(indicador) {
    const texto=actual.sucio?'Cambios sin guardar':'Borrador guardado';
    indicador.title=`Guardar cambios del nivel · ${texto}`;
    indicador.classList.toggle('admin-niveles__estado--pendiente',actual.sucio);
    indicador.querySelector('.admin-niveles__estado-texto').textContent=texto;
  }

  function campo(parent,nombre,valor,alCambiar,{tipo,opciones,edicion=true}={}) {
    const label=crear('label',nombre,'admin-niveles__campo');
    let input;
    if(opciones) {
      input=crear('select');
      const seleccion=crear('button');seleccion.type='button';seleccion.append(crear('selectedcontent'));
      input.append(seleccion);
      for(const opcion of opciones) {const o=crear('option',opcion.texto??opcion.valor);o.value=opcion.valor;input.append(o)}
      input.value=String(valor ?? '');
    } else if(typeof valor==='boolean'||tipo==='checkbox') {
      input=crear('input'); input.type='checkbox'; input.checked=Boolean(valor);
    } else if(tipo==='multiline'||(!tipo&&String(valor??'').length>130)) {
      input=crear('textarea'); input.rows=2; input.value=valor??'';
    } else {
      input=crear('input'); input.type=typeof valor==='number'||tipo==='number'?'number':'text';
      if(input.type==='number') input.step='any'; input.value=valor??'';
    }
    input.setAttribute('aria-label',nombre);
    input.addEventListener(input.type==='checkbox'||opciones?'change':'input',()=>{
      alCambiar(input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value);
      if(edicion)marcarSucio();
    });
    label.classList.toggle('admin-niveles__campo--casilla',input.type==='checkbox');
    label.classList.toggle('admin-niveles__campo--texto',input.tagName==='TEXTAREA');
    label.append(input); parent.append(label); return input;
  }

  function editarValor(parent,nombre,valor,actualizar,{alEditar=marcarSucio,repintar=pintarEditor}={}) {
    const opcionesEdicion={alEditar,repintar};
    if(Array.isArray(valor)) {
      const grupo=crear('fieldset','','admin-niveles__lista-valores'); grupo.append(crear('legend',etiqueta(nombre)));
      const lugares=nombre==='puntosInteresObjetivo';
      const listaCompacta=lugares||nombre==='areasObjetivo';
      if(lugares)grupo.classList.add('admin-niveles__lista-valores--lugares');
      if(nombre==='areasObjetivo')grupo.classList.add('admin-niveles__lista-valores--areas');
      if(listaCompacta)grupo.classList.add('admin-niveles__lista-valores--compacta');
      if(valor.length)plantillasListas.set(valor,copiar(valor[0]));
      const plantilla=plantillasListas.get(valor)??reglasIniciales.get(nombre)?.[0];
      let activo=0;
      const seleccionar=campo(grupo,'Elemento',0,nuevo=>{activo=Number(nuevo);mostrar()},
        {opciones:valor.map((_,i)=>({valor:i,texto:`${i+1} / ${valor.length}`})),edicion:false});
      const filas=[];
      const mostrar=()=>filas.forEach((fila,i)=>{fila.hidden=i!==activo});
      valor.forEach((item,i)=>{
        const fila=crear('div','','admin-niveles__item-valores');
        editarValor(fila,'valor',item,nuevo=>{valor[i]=nuevo;actualizar(valor)},opcionesEdicion);
        if(nombre==='areasObjetivo') {
          const minimo=fila.querySelector('[aria-label="Mínimo de estaciones"]');
          if(minimo)minimo.parentElement.firstChild.textContent='Mín. estaciones';
        }
        grupo.append(fila);filas.push(fila);
      });
      const acciones=crear('div','','admin-niveles__acciones-lista');
      const quitar=crear('button','Quitar','admin-secundario metronet-boton--peligro metronet-boton--destacado');quitar.type='button';
      if(listaCompacta){configurarBotonIcono(quitar,'eliminar',lugares?'Quitar lugar seleccionado':'Quitar zona seleccionada');configurarAccion(quitar,'quitar',{icono:true});}
      quitar.disabled=!valor.length;
      quitar.addEventListener('click',()=>{valor.splice(activo,1);actualizar(valor);alEditar();repintar()});
      acciones.append(quitar);
      if(plantilla!==undefined) {
        const agregar=crear('button','Agregar','admin-secundario metronet-boton--exito metronet-boton--destacado');agregar.type='button';
        agregar.setAttribute('aria-label',`Agregar ${etiqueta(nombre).toLowerCase()}`);
        if(listaCompacta){configurarBotonIcono(agregar,'sumar',lugares?'Agregar lugares objetivo':'Agregar barrios y zonas objetivo');configurarAccion(agregar,'agregar',{icono:true});}
        agregar.addEventListener('click',()=>{valor.push(copiar(valor.at(-1)??plantilla));actualizar(valor);alEditar();repintar()});
        acciones.append(agregar);
      }
      grupo.append(acciones);
      seleccionar.disabled=!valor.length;mostrar();parent.append(grupo);return;
    }
    if(valor && typeof valor==='object') {
      const grupo=crear('fieldset','','admin-niveles__objeto-valores');grupo.append(crear('legend',etiqueta(nombre)));
      for(const [clave,item] of Object.entries(valor)) editarValor(grupo,clave,item,nuevo=>{valor[clave]=nuevo;actualizar(valor)},opcionesEdicion);
      parent.append(grupo);return;
    }
    campo(parent,etiqueta(nombre),valor,nuevo=>{actualizar(nuevo);alEditar()},{edicion:false});
  }

  function pintarEditor() {
    if(!actual)return;
    const {numero,datos,borrador}=actual;
    const editor=contenedor.querySelector('[data-editor-nivel]');
    editor.replaceChildren();
    const cabecera=crear('header','','admin-niveles__cabecera');
    cabecera.append(crear('h2',`Nivel ${numero} · ${nombreCorto(numero,datos.desafio.nombre)}`));
    const utilidades=crear('div','','admin-niveles__utilidades');
    const avisoPublicacion=crear('p','Cambios sin publicar','admin-niveles__alcance-publicacion');
    avisoPublicacion.title='Guardá, previsualizá y publicá para aplicar todos los cambios.';
    cabecera.append(avisoPublicacion);
    const cambios=crear('div','','admin-niveles__cambios');
    cambios.setAttribute('role','group');cambios.setAttribute('aria-label','Cambios del nivel');
    const estado=crear('button','','admin-secundario admin-niveles__estado');estado.type='button';
    estado.dataset.estadoBorrador='';
    configurarBotonIcono(estado,'guardar','Guardar cambios del nivel');configurarAccion(estado,'guardar',{conservarTexto:true});
    estado.append(crear('span','Guardar'));estado.classList.add('admin-niveles__accion-texto');
    const textoEstado=crear('span','','admin-niveles__estado-texto');textoEstado.setAttribute('role','status');
    estado.append(textoEstado);actualizarEstadoBorrador(estado);
    estado.addEventListener('click',guardarBorrador);
    const publicar=crear('button','','admin-secundario admin-niveles__publicar');publicar.type='button';publicar.dataset.publicarNivel='';
    configurarBotonIcono(publicar,'publicar','Publicar versión');configurarAccion(publicar,'publicar',{conservarTexto:true});
    publicar.append(crear('span','Publicar'));publicar.classList.add('admin-niveles__accion-texto');
    publicar.disabled=!actual.vista?.diagnostico?.viable || actual.sucio;
    publicar.addEventListener('click',publicarNivel);
    const previsualizar=crear('button','','admin-secundario');previsualizar.type='button';
    configurarBotonIcono(previsualizar,'play','Previsualizar');configurarAccion(previsualizar,'previsualizar',{conservarTexto:true});
    previsualizar.append(crear('span','Previsualizar'));previsualizar.classList.add('admin-niveles__accion-texto','admin-niveles__previsualizar');
    previsualizar.addEventListener('click',previsualizarNivel);
    cambios.append(estado,previsualizar,publicar);
    utilidades.append(cambios);
    const salir=crear('button','','admin-secundario admin-niveles__salir');salir.type='button';
    configurarBotonIcono(salir,'puertaSalida','Volver a los niveles para editar');configurarAccion(salir,'salir',{conservarTexto:true});
    salir.append(crear('span','Salir'));salir.classList.add('admin-niveles__accion-texto');
    salir.addEventListener('click',volverALosNiveles);
    const salida=crear('div','','admin-niveles__accion-salida');salida.append(salir);
    utilidades.append(salida);cabecera.append(utilidades);
    editor.append(cabecera);

    const acciones=crear('div','','admin-niveles__acciones');
    const confirmar=crear('label','Revisé las afirmaciones, fuentes e imágenes de las siete tarjetas.');
    const casilla=crear('input');casilla.type='checkbox';casilla.dataset.confirmacionEditorial='';confirmar.prepend(casilla);
    casilla.checked=actual.confirmacionEditorial;
    casilla.addEventListener('change',()=>{actual.confirmacionEditorial=casilla.checked});
    acciones.append(confirmar);

    const pestanas=crear('div','','admin-niveles__pestanas metronet-pestanas');
    pestanas.setAttribute('role','tablist');pestanas.setAttribute('aria-label','Secciones del nivel');
    const paneles=crear('div','','admin-niveles__paneles');
    editor.append(pestanas,paneles);
    const panel=(clave,titulo)=>{
      const boton=crear('button',titulo);boton.type='button';boton.dataset.seccionNivel=clave;
      boton.id=`nivel-${numero}-pestana-${clave}`;boton.setAttribute('role','tab');
      const contenido=crear('section','',`admin-niveles__seccion admin-niveles__panel admin-niveles__panel--${clave}`);
      contenido.id=`nivel-${numero}-panel-${clave}`;contenido.dataset.panelNivel=clave;
      contenido.setAttribute('role','tabpanel');contenido.setAttribute('aria-labelledby',boton.id);
      boton.setAttribute('aria-controls',contenido.id);
      boton.addEventListener('click',()=>mostrarSeccion(clave));
      pestanas.append(boton);paneles.append(contenido);return contenido;
    };
    pestanas.addEventListener('keydown',evento=>{
      const botones=[...pestanas.querySelectorAll('[role="tab"]')];
      const indice=botones.indexOf(document.activeElement);
      if(indice<0)return;
      const siguiente={ArrowRight:(indice+1)%botones.length,ArrowLeft:(indice+botones.length-1)%botones.length,
        Home:0,End:botones.length-1}[evento.key];
      if(siguiente===undefined)return;
      const clave=botones[siguiente].dataset.seccionNivel;
      evento.preventDefault();mostrarSeccion(clave);
      contenedor.querySelector(`[data-seccion-nivel="${clave}"]`)?.focus();
    });

    const desafio=panel('desafio','Desafío');
    const datosBreves=crear('div','','admin-niveles__datos-breves');desafio.append(datosBreves);
    for(const clave of ['nombre','dificultad','relato','objetivo','instrucciones']) {
      const opcionesDificultad=[{valor:'Inicial',texto:'Inicial'},{valor:'Intermedio',texto:'Media'},{valor:'Avanzado',texto:'Avanzada'}];
      const valorActual=clave==='dificultad'
        ? ({Media:'Intermedio',Avanzada:'Avanzado'}[datos.desafio[clave]]??datos.desafio[clave])
        : datos.desafio[clave];
      if(clave==='dificultad' && valorActual && !opcionesDificultad.some(o=>o.valor===valorActual))opcionesDificultad.push({valor:valorActual,texto:valorActual});
      const entrada=campo(['nombre','dificultad'].includes(clave)?datosBreves:desafio,etiqueta(clave),valorActual,valor=>{datos.desafio[clave]=valor},
        clave==='dificultad'?{opciones:opcionesDificultad}:{tipo:['relato','objetivo','instrucciones'].includes(clave)?'multiline':'text'});
      entrada.parentElement.dataset.campoDesafio=clave;
    }



    const metas=panel('metas','Metas y POI');
    crearEditorMetasNivel(metas,datos,{crear,campo,alCambiar:marcarSucio});

    const reglas=panel('reglas','Reglas');
    const condiciones=crear('div','','admin-niveles__condiciones');
    const opciones=crear('div','','admin-niveles__opciones');reglas.append(condiciones);
    const grupoReglas=(titulo,clase)=>{
      const seccion=crear('section','','admin-niveles__grupo-reglas');
      seccion.setAttribute('aria-label',titulo);
      seccion.append(crear('h3',titulo));
      const cuerpo=crear('div','',clase);seccion.append(cuerpo);condiciones.append(seccion);
      return cuerpo;
    };
    const listadoReglas=grupoReglas('Cantidades de la red','admin-niveles__reglas');
    const reglasCondicion=grupoReglas('Condiciones de funcionamiento','admin-niveles__reglas admin-niveles__reglas--condiciones');
    const detallesReglas=crear('div','','admin-niveles__reglas-detalle');
    const reglasCompuestas=[];
    const conocidas=reglasIniciales;
    for(const [clave,valor] of Object.entries(datos.reglasExito)) {
      if(reglasNoEditables.has(clave))continue;
      const fila=crear('div','','admin-niveles__regla');
      fila.dataset.reglaNivel=clave;
      const pictograma={minimoLineas:'lineas',minimoMetros:'metros',minimoConexionesLineas:'conexiones',minimoTramos:'lineas',minimoTransbordos:'conexiones',minimoEstaciones:'estaciones'}[clave];
      if(pictograma){const icono=crear('span','','admin-niveles__icono-cantidad');icono.innerHTML=iconoRetro(pictograma);fila.append(icono);}
      const compuesta=valor && typeof valor==='object';
      if(compuesta)fila.classList.add('admin-niveles__regla--compuesta');
      if(typeof valor==='boolean')fila.classList.add('admin-niveles__regla--casilla');
      editarValor(fila,clave,valor,nuevo=>{datos.reglasExito[clave]=nuevo});
      if(clave==='minimoTransbordos')fila.querySelector('label').firstChild.textContent='Mín. conexiones entre líneas';
      if(clave==='transbordosPorConexion')fila.querySelector('label').firstChild.textContent='Estaciones compartidas';
      const quitar=crear('button','','admin-secundario admin-niveles__quitar-regla'); quitar.type='button';
      configurarBotonIcono(quitar,'eliminar',clave==='puntosInteresObjetivo'?'Quitar toda la regla de lugares objetivo':`Quitar ${etiqueta(clave)}`);
      configurarAccion(quitar,'quitar',{icono:true});
      quitar.addEventListener('click',()=>{delete datos.reglasExito[clave];marcarSucio();pintarEditor()});
      fila.append(quitar);
      if(compuesta) {
        reglasCompuestas.push(clave);
        detallesReglas.append(fila);
      } else (typeof valor==='boolean'?reglasCondicion:listadoReglas).append(fila);
    }
    for(const cuerpo of [listadoReglas,reglasCondicion])cuerpo.parentElement.hidden=!cuerpo.children.length;
    const opcionesRegla=[...conocidas.keys()].filter(clave=>!reglasNoEditables.has(clave)&&!(clave in datos.reglasExito))
      .map(clave=>({valor:clave,texto:etiqueta(clave)}));
    const nuevaRegla=crear('div','','admin-niveles__agregar-regla');
    let valorRegla;
    const agregarRegla=campo(nuevaRegla,'Regla admitida para agregar',opcionesRegla[0]?.valor,()=>prepararRegla(),
      {opciones:opcionesRegla,edicion:false});
    agregarRegla.parentElement.firstChild.textContent='';
    const valoresRegla=crear('div','','admin-niveles__valor-nueva-regla');
    const pintarValorRegla=()=>{
      nuevaRegla.querySelector(':scope > .admin-niveles__acciones-lista')?.remove();
      nuevaRegla.dataset.regla=agregarRegla.value;
      valoresRegla.replaceChildren();
      valoresRegla.dataset.tipo=Array.isArray(valorRegla)?'lista':typeof valorRegla;
      if(agregarRegla.value)editarValor(valoresRegla,agregarRegla.value,valorRegla,nuevo=>{valorRegla=nuevo},
        {alEditar:()=>{},repintar:pintarValorRegla});
      // El selector identifica la regla; el campo sólo necesita explicar su valor.
      const campoSimple=valoresRegla.querySelector(':scope > label');
      if(campoSimple)campoSimple.firstChild.textContent=typeof valorRegla==='boolean'
        ?(agregarRegla.value==='transbordosPorConexion'?'Entre líneas':'Activar condición')
        :typeof valorRegla==='number'?'Cantidad':campoSimple.firstChild.textContent;
      if(['areasObjetivo','puntosInteresObjetivo'].includes(agregarRegla.value)) {
        const acciones=valoresRegla.querySelector('.admin-niveles__acciones-lista');
        nuevaRegla.append(acciones);
      }
    };
    const prepararRegla=()=>{valorRegla=copiar(conocidas.get(agregarRegla.value));pintarValorRegla()};
    prepararRegla();
    const botonAgregar=crear('button','Agregar','admin-secundario metronet-boton--exito metronet-boton--destacado');botonAgregar.type='button';botonAgregar.setAttribute('aria-label','Agregar regla admitida');
    botonAgregar.disabled=!agregarRegla.options.length;
    botonAgregar.addEventListener('click',()=>{
      const clave=agregarRegla.value;datos.reglasExito[clave]=copiar(valorRegla);actual.reglaAbierta=clave;marcarSucio();pintarEditor();
    });
    nuevaRegla.hidden=!agregarRegla.options.length;
    opciones.hidden=nuevaRegla.hidden;
    nuevaRegla.append(valoresRegla,botonAgregar);opciones.append(nuevaRegla);
    const herramientas=crear('section','','admin-niveles__herramientas');
    herramientas.setAttribute('aria-label','Herramientas habilitadas');
    herramientas.append(crear('h3','Herramientas habilitadas'));
    for(const [clave,valor] of Object.entries(datos.herramientasHabilitadas)) {
      const control=campo(herramientas,etiqueta(clave),valor,nuevo=>{datos.herramientasHabilitadas[clave]=nuevo});
      const icono=crear('span','','admin-niveles__icono-herramienta');icono.innerHTML=iconoRetro(clave==='simulacion'?'play':clave);control.after(icono);
    }
    condiciones.append(herramientas);

    // Las reglas configuradas y las nuevas comparten el espacio de edición.
    // Elegir una regla reemplaza el formulario visible, sin apilar desplegables.
    const espacioReglas=crear('section','','admin-niveles__espacio-reglas');
    const encabezadoReglas=crear('div','','admin-niveles__encabezado-reglas');
    const tituloReglas=crear('h3');encabezadoReglas.append(tituloReglas);
    const elegidas=reglasCompuestas.map(clave=>({valor:clave,texto:etiqueta(clave)}));
    if(opcionesRegla.length)elegidas.push({valor:'nueva',texto:'Agregar regla'});
    const seleccionInicial=reglasCompuestas.includes(actual.reglaAbierta)?actual.reglaAbierta
      :opcionesRegla.length?'nueva':reglasCompuestas[0];
    const elegirRegla=campo(encabezadoReglas,'Regla del nivel',seleccionInicial,clave=>{
      actual.reglaAbierta=clave;mostrarRegla();
    },{opciones:elegidas,edicion:false});
    elegirRegla.parentElement.firstChild.textContent='';
    elegirRegla.parentElement.hidden=elegidas.length<2;
    const mostrarRegla=()=>{
      const nueva=elegirRegla.value==='nueva';
      tituloReglas.textContent=nueva?'Regla admitida para agregar':'Objetivos específicos';
      opciones.hidden=!nueva;detallesReglas.hidden=nueva;
      for(const fila of detallesReglas.children)fila.hidden=fila.dataset.reglaNivel!==elegirRegla.value;
    };
    espacioReglas.append(encabezadoReglas,detallesReglas,opciones);
    espacioReglas.hidden=!elegidas.length;reglas.append(espacioReglas);mostrarRegla();


    const red=panel('red','Red de referencia');
    const redTrabajo=crear('div','','admin-niveles__red-trabajo');
    const visor=crear('div','','admin-red-referencia');redTrabajo.append(visor);
    mapa=crearEditorRedReferenciaNivel(visor,datos.redReferencia,()=>{marcarSucio();pintarTablasRed()});
    const tablas=crear('div','','admin-niveles__tablas-red');tablas.dataset.tablasRed='';redTrabajo.append(tablas);
    red.append(redTrabajo);

    const educacion=panel('tarjetas','Tarjetas');
    const cabeceraTarjeta=crear('div','','admin-niveles__selector-tarjeta');educacion.append(cabeceraTarjeta);
    const selectorTarjeta=campo(cabeceraTarjeta,'Tarjeta de aprendizaje',actual.tarjetaActiva,valor=>{
      actual.tarjetaActiva=Number(valor);
      mostrarTarjeta();
    },{opciones:datos.tarjetas.map((tarjeta,i)=>({valor:i,texto:`${i+1} · ${tarjeta.titulo}`})),edicion:false});
    selectorTarjeta.dataset.selectorTarjeta='';
    const pasos=crear('div','','admin-niveles__pasos-tarjeta');
    for(const [texto,paso,icono] of [['Anterior',-1,'horaAnterior'],['Siguiente',1,'horaSiguiente']]) {
      const b=crear('button');b.type='button';configurarBotonIcono(b,icono,texto);configurarAccion(b,paso<0?'anterior':'siguiente',{icono:true});b.dataset.pasoTarjeta=paso;
      b.dataset.categoriaAccion='secundaria';
      b.addEventListener('click',()=>{actual.tarjetaActiva=Math.max(0,Math.min(datos.tarjetas.length-1,actual.tarjetaActiva+paso));mostrarTarjeta()});pasos.append(b);
    }
    cabeceraTarjeta.append(pasos);
    const tituloTarjeta=campo(cabeceraTarjeta,'Título',datos.tarjetas[actual.tarjetaActiva].titulo,valor=>{
      datos.tarjetas[actual.tarjetaActiva].titulo=valor;
      selectorTarjeta.options[actual.tarjetaActiva].textContent=`${actual.tarjetaActiva+1} · ${valor}`;
    },{tipo:'text'});
    tituloTarjeta.dataset.tituloTarjeta='';
    const tarjetas=crear('div','','admin-niveles__tarjetas');
    datos.tarjetas.forEach((tarjeta,i)=>{
      const ficha=crear('div','','admin-niveles__ficha');ficha.dataset.tarjetaNivel=String(i);
      for(const clave of ['texto','aprendizaje','fuente','urlFuente','descripcionImagen']) {
        const input=campo(ficha,etiqueta(clave),tarjeta[clave],valor=>{
          tarjeta[clave]=valor;
          if(clave==='descripcionImagen')ficha.querySelector('img').alt=valor;
        }, {tipo:['texto','aprendizaje','descripcionImagen'].includes(clave)?'multiline':'text'});
        input.parentElement.dataset.campoTarjeta=clave;
      }
      const ilustracion=crear('div','','admin-niveles__ilustracion');
      const imagen=crear('img');imagen.src=imagenAjustada(tarjeta.idSvgCatalogo);imagen.alt=tarjeta.descripcionImagen;
      const opciones=catalogo.flatMap(n=>n.tarjetas.map(t=>({valor:t.imagen,texto:`Nivel ${n.numero} · ${t.titulo}`})));
      campo(ilustracion,'Elegir imagen del catálogo',tarjeta.idSvgCatalogo,valor=>{
        tarjeta.idSvgCatalogo=valor;imagen.src=imagenAjustada(valor);
      },{opciones});
      ilustracion.append(imagen);ficha.append(ilustracion);
      tarjetas.append(ficha);
    });
    // Las ayudas recibidas se preservan al guardar, sin exponer el editor de pistas retirado.
    educacion.append(tarjetas,acciones);mostrarTarjeta();

    const vista=panel('vista','Vista previa');vista.classList.add('admin-niveles__vista');vista.dataset.vistaPrevia='';
    pintarEsperaVista(vista,'Guardá el borrador y usá «Previsualizar» para revisar el resultado.');
    const historial=panel('historial','Historial');
    const limpieza=crear('div','','admin-niveles__limpieza');
    const borrar=crear('button','Borrar historial','metronet-boton--peligro');borrar.type='button';
    configurarAccion(borrar,'eliminar',{compacto:true,conservarTexto:true});
    borrar.disabled=actual.versiones.length<2;
    borrar.addEventListener('click',borrarHistorialSinUso);limpieza.append(borrar);historial.append(limpieza);
    if(!actual.versiones.length)historial.append(crear('p','Todavía no hay versiones publicadas.'));
    const paginaHistorial=Math.min(actual.paginaHistorial??0,Math.max(0,Math.ceil(actual.versiones.length/4)-1));
    actual.paginaHistorial=paginaHistorial;
    actual.versiones.slice(paginaHistorial*4,paginaHistorial*4+4).forEach(version=>{
      const fila=crear('div','','admin-niveles__version');fila.append(crear('span',`Versión ${version.version} · ${version.publicadoEn}`));
      historial.append(fila);
    });
    if(actual.versiones.length>4) {
      const paginas=crear('div','','admin-niveles__paginas');
      for(const [texto,paso] of [['Anterior',-1],['Siguiente',1]]) {
        const boton=crear('button','','admin-niveles__pagina');boton.type='button';
        configurarBotonIcono(boton,'plegar',texto);
        boton.style.setProperty('--giro-flecha',paso<0?'-90deg':'90deg');
        boton.disabled=paginaHistorial+paso<0||(paginaHistorial+paso)*4>=actual.versiones.length;
        boton.addEventListener('click',()=>{actual.paginaHistorial=paginaHistorial+paso;pintarEditor()});paginas.append(boton);
      }
      paginas.append(crear('span',`${paginaHistorial+1} / ${Math.ceil(actual.versiones.length/4)}`));historial.append(paginas);
    }
    pintarTablasRed(); if(actual.vista) pintarVista(actual.vista);
    mostrarSeccion(actual.seccionActiva);
  }

  function mostrarSeccion(clave) {
    if(actual.seccionActiva==='metas'&&clave!=='metas'){actual.seccionActiva=clave;pintarEditor();return}
    actual.seccionActiva=clave;
    if(clave==='metas')crearEditorMetasNivel(contenedor.querySelector('[data-panel-nivel="metas"]'),actual.datos,
      {crear,campo,alCambiar:marcarSucio});
    for(const boton of contenedor.querySelectorAll('[data-seccion-nivel]')) {
      const activo=boton.dataset.seccionNivel===clave;
      boton.setAttribute('aria-selected',String(activo));boton.tabIndex=activo?0:-1;
    }
    for(const panel of contenedor.querySelectorAll('[data-panel-nivel]'))panel.hidden=panel.dataset.panelNivel!==clave;
    const paneles=contenedor.querySelector('.admin-niveles__paneles');if(paneles)paneles.scrollTop=0;
  }

  function mostrarTarjeta() {
    const selector=contenedor.querySelector('[data-selector-tarjeta]');if(selector)selector.value=String(actual.tarjetaActiva);
    for(const b of contenedor.querySelectorAll('[data-paso-tarjeta]'))b.disabled=actual.tarjetaActiva+Number(b.dataset.pasoTarjeta)<0||actual.tarjetaActiva+Number(b.dataset.pasoTarjeta)>=actual.datos.tarjetas.length;
    for(const ficha of contenedor.querySelectorAll('[data-tarjeta-nivel]'))
      ficha.hidden=Number(ficha.dataset.tarjetaNivel)!==actual.tarjetaActiva;
    const titulo=contenedor.querySelector('[data-titulo-tarjeta]');
    if(titulo)titulo.value=actual.datos.tarjetas[actual.tarjetaActiva].titulo;
  }

  function pintarTablasRed() {
    const tablas=contenedor.querySelector('[data-tablas-red]'); if(!tablas||!actual)return;
    tablas.replaceChildren(crear('h3','Elemento seleccionado'));
    const red=actual.datos.redReferencia;
    const plantillas={
      estaciones:()=>({nombre:`E${red.estaciones.length+1}`,x:660,y:460,transbordo:false}),
      lineas:()=>({nombre:`Línea ${red.lineas.length+1}`}),
      tramos:()=>({linea:red.lineas[0]?.nombre??'',a:red.estaciones[0]?.nombre??'',b:red.estaciones[1]?.nombre??''}),
      conexionesLineas:()=>({lineaA:red.lineas[0]?.nombre??'',estacionA:'',lineaB:red.lineas[1]?.nombre??'',estacionB:''}),
      unidades:()=>({linea:red.lineas[0]?.nombre??'',capacidad:300,uv:1}),
      ejecuciones:()=>({duracion:2,velocidad:1,unidades:red.unidades.map(u=>({uv:u.uv}))}),
    };
    const titulos={estaciones:'Estaciones',lineas:'Líneas',tramos:'Tramos de línea',conexionesLineas:'Conexiones entre líneas',unidades:'Unidades',ejecuciones:'Ejecuciones de prueba'};
    const tipo=actual.redTipo??'estaciones';
    campo(tablas,'Elementos de referencia',tipo,valor=>{
      actual.redTipo=valor;actual.redIndice=0;pintarTablasRed();
    },{opciones:Object.entries(titulos).map(([valor,texto])=>({valor,texto})),edicion:false});
    actual.redIndice=Math.min(actual.redIndice??0,Math.max(0,red[tipo].length-1));
    if(red[tipo].length) {
      campo(tablas,'Elemento de referencia',actual.redIndice,valor=>{
        actual.redIndice=Number(valor);pintarTablasRed();
      },{opciones:red[tipo].map((item,i)=>({valor:i,texto:`${i+1} · ${item.nombre??item.linea??titulos[tipo]}`})),edicion:false});
      const i=actual.redIndice,item=red[tipo][i];
      const fila=crear('div','','admin-niveles__grupo');
        for(const [clave,valor] of Object.entries(item)) {
          const antes=fila.children.length;editarValor(fila,clave,valor,nuevo=>{item[clave]=nuevo;mapa?.actualizar()});
          if(fila.children[antes])fila.children[antes].dataset.campoReferencia=clave;
        }
        const quitar=crear('button','Quitar','admin-secundario metronet-boton--peligro');quitar.type='button';
        quitar.addEventListener('click',()=>{red[tipo].splice(i,1);marcarSucio();pintarTablasRed();mapa?.actualizar()});
        const aplicar=crear('button','Aplicar','admin-secundario metronet-boton--advertencia');aplicar.type='button';
        aplicar.addEventListener('click',()=>{mapa?.actualizar();pintarTablasRed()});
        const accionesElemento=crear('div','','admin-niveles__acciones-elemento');accionesElemento.append(aplicar,quitar);fila.append(accionesElemento);tablas.append(fila);
    } else tablas.append(crear('p',`Todavía no hay ${titulos[tipo].toLowerCase()}.`));
      const agregar=crear('button','Agregar','admin-secundario metronet-boton--exito');agregar.type='button';agregar.setAttribute('aria-label',`Agregar ${titulos[tipo].toLowerCase()}`);
      agregar.addEventListener('click',()=>{red[tipo].push(plantillas[tipo]());actual.redIndice=red[tipo].length-1;marcarSucio();pintarTablasRed();mapa?.actualizar()});
      tablas.append(agregar);
  }

  async function guardarBorrador() {
    if(!actual||operando)return;
    if(actual.datos.tarjetas.some(tarjeta=>!urlFuenteValida(tarjeta.urlFuente))) {
      anunciar('Cada tarjeta necesita una URL HTTP(S) con host válido para su fuente.','error');return;
    }
    operando=true;anunciar('Guardando borrador…');
    const botonGuardar=contenedor.querySelector('[data-estado-borrador]');
    botonGuardar.disabled=true;botonGuardar.setAttribute('aria-busy','true');
    try {
      const {borrador,datos,numero,edicion}=actual;
      const guardado=await pedir(`/${numero}/borrador`,{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...datos,versionBase:borrador.versionBase,revisionEsperada:borrador.revision})});
      actual.borrador=guardado;actual.sucio=actual.edicion!==edicion;actual.vista=null;pintarEditor();
      anunciar(actual.sucio?'Hay cambios posteriores sin guardar.':'');
    } catch(error){anunciar(error.message,'error')} finally {
      operando=false;botonGuardar.disabled=false;botonGuardar.removeAttribute('aria-busy');
    }
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
    const edicion=actual.edicion;
    try {
      const vista=await pedir(`/${actual.numero}/previsualizar`,{method:'POST'});
      if(actual.edicion!==edicion){anunciar('Guardá y previsualizá nuevamente para revisar los cambios.');return}
      actual.vista=vista;
      pintarVista(actual.vista);mostrarSeccion('vista');
      contenedor.querySelector('[data-publicar-nivel]').disabled=!actual.vista.diagnostico.viable;
      anunciar(actual.vista.diagnostico.mensaje,actual.vista.diagnostico.viable?'':'error');
    } catch(error){actual.vista=null;anunciar(error.message,'error')}
    finally {operando=false}
  }

  function pintarEsperaVista(panel,texto) {
    panel.classList.add('admin-niveles__vista--vacia');
    panel.replaceChildren(crear('p',texto,'admin-niveles__aviso-vista'));
  }

  function pintarVista(vista) {
    const panel=contenedor.querySelector('[data-vista-previa]');if(!panel)return;
    panel.classList.remove('admin-niveles__vista--vacia');
    panel.replaceChildren();
    const cuerpo=crear('div','','admin-niveles__vista-contenido');
    const mostrar=valor=>{
      cuerpo.replaceChildren();
      const d=vista.contenido.desafio;
      if(valor==='consigna') {
        cuerpo.className='admin-niveles__vista-contenido admin-niveles__vista-consigna';
        for(const [nombre,texto] of [['Relato',d.relato],['Objetivo',d.objetivo],['Instrucciones',d.instrucciones]]) {
          const bloque=crear('div');bloque.append(crear('h3',nombre),crear('p',texto));cuerpo.append(bloque);
        }
      } else if(valor==='validacion') {
        cuerpo.className='admin-niveles__vista-contenido';
        const lista=crear('ul');
        for(const condicion of vista.diagnostico.condiciones)
          lista.append(crear('li',`${condicion.completado?'Cumplido':'Pendiente'} · ${condicion.texto}`));
        cuerpo.append(lista);
      } else {
        cuerpo.className='admin-niveles__vista-contenido admin-niveles__vista-tarjeta';
        const tarjeta=vista.tarjetas[Number(valor)],imagen=crear('img');
        imagen.src=tarjeta.idSvgCatalogo;imagen.alt=tarjeta.descripcionImagen;
        const texto=crear('div');texto.append(crear('h3',tarjeta.titulo),crear('p',tarjeta.texto),
          crear('p',tarjeta.aprendizaje),crear('p',`${tarjeta.fuente} · ${tarjeta.urlFuente}`));
        cuerpo.append(imagen,texto);
      }
    };
    campo(panel,'Contenido de la vista previa','consigna',mostrar,{edicion:false,opciones:[
      {valor:'consigna',texto:'Consigna'}, {valor:'validacion',texto:'Resultado de la validación'},
      ...vista.tarjetas.map((tarjeta,i)=>({valor:i,texto:`Tarjeta ${i+1} · ${tarjeta.titulo}`})),
    ]});
    panel.append(cuerpo);mostrar('consigna');
  }

  async function publicarNivel() {
    if(!actual?.vista?.diagnostico?.viable||actual.sucio||operando)return;
    if(!contenedor.querySelector('[data-confirmacion-editorial]').checked) {
      anunciar('En Tarjetas, confirmá la revisión de textos, fuentes e imágenes.','error');return;
    }
    operando=true;anunciar('Publicando la versión completa…');
    try {
      const vista=actual.vista;
      const publicada=await pedir(`/${actual.numero}/publicar`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({versionEsperada:vista.versionPublicada,revisionEsperada:vista.revisionBorrador,
          huellaPreview:vista.diagnostico.huella,confirmacionEditorial:true})});
      const numero=actual.numero;
      lista=await pedir('');pintarLista();operando=false;await abrir(numero);
      anunciar('');
    } catch(error){anunciar(error.message,'error')}finally{operando=false}
  }

  async function borrarHistorialSinUso() {
    if(!actual||operando)return;
    operando=true;
    try {
      const numero=actual.numero;
      const versionEsperada=Math.max(...actual.versiones.map(v=>v.version));
      if(!await confirmarSistema(`¿Eliminar todas las versiones antiguas sin uso del nivel ${numero}? Se conservarán la versión vigente, la del borrador y las vinculadas a partidas. Esta acción no se puede deshacer.`,{cancelarSeguro:true,peligro:true}))return;
      const resultado=await pedir(`/${numero}/versiones/sin-uso?versionEsperada=${versionEsperada}`,{method:'DELETE'});
      actual.versiones=await pedir(`/${numero}/versiones`);
      pintarEditor();
      anunciar(resultado.versionesEliminadas.length
        ?`Se eliminaron ${resultado.versionesEliminadas.length} versiones sin uso. Se conservaron ${resultado.versionesConservadas}.`
        :'No hay versiones antiguas sin uso para eliminar.','exito');
    } catch(error){anunciar(error.message,'error')}
    finally{operando=false}
  }

  return { cargar };
}
