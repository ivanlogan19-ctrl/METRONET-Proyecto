import { TARJETAS_EXTRAS, ilustracionExtra } from './TarjetasExtras.js';
import { solicitarExtras } from './ClienteExtras.js';
import { celebrarTrofeosNuevos } from '../CelebracionTrofeos.js';
import './extras.css';

let abierta = null;
const nodo = (tag,texto='',clase='') => { const e=document.createElement(tag); e.textContent=texto; e.className=clase; return e; };
const boton = (texto,accion,clase='') => { const e=nodo('button',texto,clase); e.type='button'; e.addEventListener('click',accion); return e; };
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
      estadoTexto.textContent='Guardando recorrido…';
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
      } finally {ocupado=false;}
    }
    function mostrarTarjeta() {
      const tarjeta=TARJETAS_EXTRAS[indice];
      const encabezado=nodo('header'); encabezado.append(nodo('span','Aprendizaje · Extras'),nodo('span',`${indice+1} / 7`));
      const cuerpo=nodo('div','','metronet-extras__cuerpo');
      const textos=nodo('section','','metronet-extras__texto');
      const practica=nodo('div','','metronet-extras__practica'); practica.append(nodo('strong','Probá'),nodo('p',tarjeta.practica));
      textos.append(titulo(tarjeta.titulo),nodo('p',tarjeta.subtitulo,'metronet-extras__subtitulo'),nodo('p',tarjeta.texto),practica,nodo('p',tarjeta.nota,'metronet-extras__nota'));
      cuerpo.append(figura(tarjeta.id),textos);
      const pie=nodo('footer');
      const anterior=boton('← Anterior',()=>avanzar(indice-1)); anterior.disabled=indice===0;
      const puntos=nodo('div','','metronet-extras__puntos'); puntos.setAttribute('aria-label',`Tarjeta ${indice+1} de 7`);
      TARJETAS_EXTRAS.forEach((_,i)=>{const e=nodo('span'); if(i===indice)e.setAttribute('aria-current','step');puntos.append(e);});
      pie.append(anterior,puntos,boton(indice===6?'Finalizar recorrido':'Siguiente →',()=>avanzar(indice+1),'metronet-boton--exito'));
      const estado=nodo('p','','metronet-extras__estado'); estado.dataset.extrasEstado='';estado.setAttribute('role','status');
      dialogo.replaceChildren(encabezado,cuerpo,pie,boton(bienvenida?'Saltar e ir a construir':'Cerrar tarjetas',cerrar,'metronet-extras__saltar'),estado);
      enfocar();
    }
    function mostrarBienvenida() {
      const vista=nodo('section','','metronet-extras__bienvenida');
      const pie=nodo('footer');pie.append(boton('Ver las 7 tarjetas',()=>elegirBienvenida(true),'metronet-boton--exito'),boton('Ir a construir',()=>elegirBienvenida(false)));
      vista.append(nodo('p','Modo Libre','metronet-extras__subtitulo'),titulo('Tu próxima red empieza acá'),
        nodo('p','Ya aprendiste a diseñar, construir y simular. Ahora utilizá las herramientas del mapa para planificar tu propia red de metro.'),
        figura(0),nodo('p','7 nuevas tarjetas desbloqueadas','metronet-extras__desbloqueo'),
        nodo('p','También podés consultarlas después en Aprendizaje · Extras.','metronet-extras__nota'),pie);
      dialogo.replaceChildren(vista);enfocar();
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
