import { configurarAccion, configurarAccionPorNombre } from '../../interfaz/AccionesInterfaz.js';
import { TARJETAS_EXTRAS, ilustracionExtra } from './TarjetasExtras.js';
import { solicitarExtras } from './ClienteExtras.js';
import { celebrarTrofeosNuevos } from '../CelebracionTrofeos.js';
import './extras.css';

let abierta = null;
const nodo = (tag,texto='',clase='') => { const e=document.createElement(tag); e.textContent=texto; e.className=clase; return e; };
const boton = (texto,accion,clase='') => { const e=nodo('button',texto,clase); e.type='button'; configurarAccionPorNombre(e); if(!e.dataset.accionUi)configurarAccion(e,texto==='Ir a construir'?'abrir':'continuar',{conservarTexto:true}); e.addEventListener('click',accion); return e; };
const figura = id => { const e=nodo('div','','metronet-extras__imagen'); e.innerHTML=ilustracionExtra(id); return e; };

export async function ofrecerExtras({signal,idDiseno,idUsuario}={}) {
  await solicitarExtras('/ingreso','POST',signal);
  if (signal?.aborted) return;
  // La oferta pertenece a esta red; las visitas y el premio siguen perteneciendo a la cuenta.
  const clave=idDiseno && idUsuario ? `metronet:extras-bienvenida:v1:${idUsuario}:${idDiseno}` : null;
  try { if(clave && localStorage.getItem(clave)) return; } catch { /* Preferencia opcional. */ }
  const registrar=()=>{try { if(clave)localStorage.setItem(clave,'ofrecida'); } catch { /* No bloquear el juego. */ }};
  await abrirExtras({bienvenida:true,signal,alElegirBienvenida:registrar});
}

export function abrirExtras({bienvenida=false,indiceInicial=0,signal,alActualizar,alElegirBienvenida}={}) {
  if (signal?.aborted) return Promise.resolve();
  if (abierta) return abierta;
  abierta=new Promise(resolve => {
    const foco=document.activeElement;
    const dialogo=nodo('dialog','','metronet-extras');
    dialogo.setAttribute('aria-labelledby','tituloExtras');
    let indice=Math.max(0,Math.min(6,indiceInicial)), cerrado=false, ocupado=false;
    const peticiones=new AbortController();
    let registro=bienvenida ? Promise.resolve() : null;
    async function asegurarIngreso() {
      registro ??= solicitarExtras('/ingreso','POST',peticiones.signal);
      try { await registro; } catch(error) { registro=null; throw error; }
    }
    function cerrar() {
      if(cerrado) return;
      cerrado=true; peticiones.abort();
      signal?.removeEventListener('abort',cerrar);
      window.removeEventListener('pagehide',cerrar);
      window.removeEventListener('popstate',cerrar);
      dialogo.remove(); abierta=null;
      if(foco?.isConnected) foco.focus({preventScroll:true});
      resolve();
    }
    function titulo(texto) {const e=nodo('h2',texto); e.id='tituloExtras';e.tabIndex=-1;return e;}
    function enfocar() { dialogo.querySelector('h2').focus({preventScroll:true}); dialogo.scrollTop=0; }
    async function elegirBienvenida(ver) {
      // El fallo de guardado no impide construir ni consultar el material.
      try { await solicitarExtras('/bienvenida','PUT',peticiones.signal); } catch { /* Puede volver a ofrecerse si no se pudo guardar. */ }
      if(cerrado) return;
      alElegirBienvenida?.();
      if(ver) mostrarTarjeta(); else cerrar();
    }
    async function avanzar(destino) {
      if(ocupado) return;
      ocupado=true;
      const estadoTexto=dialogo.querySelector('[data-extras-estado]');
      estadoTexto.textContent='';
      dialogo.setAttribute('aria-busy','true');
      try {
        await asegurarIngreso();
        const estado=await solicitarExtras(`/tarjetas/${TARJETAS_EXTRAS[indice].id}`,'PUT',
          AbortSignal.any([peticiones.signal,AbortSignal.timeout(10000)]));
        if(cerrado) return;
        alActualizar?.(estado);
        if(destino>6) {
          // Terminar también la celebración antes de ofrecer el tutorial del mapa.
          if(estado.nuevoTrofeo) {
            dialogo.close();
            await celebrarTrofeosNuevos([estado.nuevoTrofeo],{signal:peticiones.signal});
          }
          cerrar();
        } else {
          indice=destino;mostrarTarjeta();
          if(estado.nuevoTrofeo) await celebrarTrofeosNuevos([estado.nuevoTrofeo],{signal:peticiones.signal});
        }
      } catch(error) {
        if(!cerrado) estadoTexto.textContent=error.message.replace(/[.\s]+$/, '')+'. Volvé a pulsar para reintentar o salí sin guardar.';
      } finally {ocupado=false;dialogo.removeAttribute('aria-busy');}
    }
    function bloque(tituloBloque, contenido, clase='') {
      const seccion=nodo('section','',clase);
      seccion.append(nodo('h3',tituloBloque),nodo('p',contenido));
      return seccion;
    }
    function mostrarTarjeta() {
      dialogo.classList.add('metronet-extras--tarjetas');
      const tarjeta=TARJETAS_EXTRAS[indice];
      const encabezado=nodo('header');
      const rotulo=nodo('div','','metronet-extras__encabezado');
      rotulo.append(nodo('span','Modo Libre · Herramientas para planificar'),titulo(tarjeta.titulo));
      const puntos=nodo('div','','metronet-extras__puntos');
      puntos.setAttribute('aria-label',`Tarjeta ${indice+1} de 7`);
      TARJETAS_EXTRAS.forEach((_,i)=>{
        const e=nodo('span');
        if(i<=indice)e.className='metronet-extras__paso-recorrido';
        if(i===indice)e.setAttribute('aria-current','step');
        puntos.append(e);
      });
      encabezado.append(rotulo,puntos,nodo('span',`${indice+1} / 7`));
      const cuerpo=nodo('div','','metronet-extras__cuerpo');
      const visual=nodo('section','','metronet-extras__visual');
      visual.append(figura(tarjeta.id),nodo('h3',tarjeta.subtitulo,'metronet-extras__subtitulo'),
        bloque('Qué justificar',tarjeta.justificacion,'metronet-extras__decision'));
      const textos=nodo('section','','metronet-extras__texto');
      textos.append(bloque('Qué ofrece la herramienta',tarjeta.texto),
        bloque('Cómo aporta a tu red',tarjeta.aporte),
        bloque('Aplicala en el juego',tarjeta.practica,'metronet-extras__practica'),
        nodo('p',tarjeta.nota,'metronet-extras__nota'));
      cuerpo.append(visual,textos);
      const pie=nodo('footer');
      const anterior=boton('Anterior',()=>avanzar(indice-1),'metronet-extras__anterior'); anterior.disabled=indice===0;
      const acciones=nodo('div','','metronet-extras__acciones');
      acciones.append(anterior,boton('Cerrar',cerrar,'metronet-extras__saltar metronet-boton--peligro'),
        boton(indice===6?'Finalizar recorrido':'Siguiente',()=>avanzar(indice+1),'metronet-boton--exito'));
      pie.append(nodo('small','Podés volver a consultarla en Aprendizaje · Modo Libre.'),acciones);
      const estado=nodo('p','','metronet-extras__estado'); estado.dataset.extrasEstado='';estado.setAttribute('role','status');
      dialogo.replaceChildren(encabezado,cuerpo,pie,estado);
      enfocar();
    }
    function mostrarBienvenida() {
      const encabezado=nodo('header');
      const rotulo=nodo('div','','metronet-extras__encabezado');
      rotulo.append(nodo('span','Modo Libre'),titulo('Planificá una red'));
      encabezado.append(rotulo,nodo('span','7 herramientas · Una propuesta propia'));
      const vista=nodo('div','','metronet-extras__bienvenida');
      const explicacion=nodo('section');
      explicacion.append(nodo('h3','Del territorio a la simulación'),nodo('p','Ahora podés combinar información del mapa con las herramientas de construcción y simulación para fundamentar tu propia red de metro.'));
      const fases=nodo('ol','','metronet-extras__fases');
      for(const [nombre,descripcion] of [
        ['Observá','Reconocé corredores, población y desplazamientos. Definí qué zonas querés conectar.'],
        ['Construí','Ubicá estaciones, trazá líneas y conexiones y revisá su cobertura territorial.'],
        ['Contrastá','Ejecutá la red, modificá una variable y explicá qué cambia en el recorrido.'],
      ]) { const fase=nodo('li');fase.append(nodo('strong',nombre),nodo('p',descripcion));fases.append(fase); }
      explicacion.append(fases,nodo('p','Las capas aportan referencias para decidir. No calculan por sí solas la demanda ni garantizan la viabilidad de una red real.','metronet-extras__nota'));
      const temas=nodo('ol','','metronet-extras__temas');
      temas.setAttribute('aria-label','Las siete herramientas');
      TARJETAS_EXTRAS.forEach(t=>{const tema=nodo('li');tema.append(nodo('b',String(t.id).padStart(2,'0')),nodo('span',t.titulo));temas.append(tema);});
      vista.append(explicacion,temas);
      const pie=nodo('footer');
      const acciones=nodo('div','','metronet-extras__acciones');
      acciones.append(boton('Ir a construir',()=>elegirBienvenida(false),'metronet-extras__anterior'),boton('Ver las 7 tarjetas',()=>elegirBienvenida(true),'metronet-boton--exito metronet-extras__ver-tarjetas'));
      pie.append(nodo('small','Consultalas cuando quieras en Aprendizaje · Modo Libre.'),acciones);
      dialogo.replaceChildren(encabezado,vista,pie);enfocar();
    }
    dialogo.addEventListener('cancel',e=>{e.preventDefault();cerrar();});
    for(const evento of ['pointerdown','mousedown','touchstart']) dialogo.addEventListener(evento,e=>e.stopPropagation());
    signal?.addEventListener('abort',cerrar,{once:true});
    window.addEventListener('pagehide',cerrar,{once:true});window.addEventListener('popstate',cerrar,{once:true});
    document.body.append(dialogo);dialogo.showModal();
    if(bienvenida)mostrarBienvenida();else {
      mostrarTarjeta();
      asegurarIngreso().catch(error=>{ if(!cerrado) dialogo.querySelector('[data-extras-estado]').textContent=error.message; });
    }
  });
  return abierta;
}
