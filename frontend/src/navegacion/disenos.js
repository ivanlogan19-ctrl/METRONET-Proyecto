import ClienteDisenos from '../red/ClienteDisenos.js';
import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion, navegarConCambiosPendientes } from './NavegacionAplicacion.js';
import { consultarJuego } from '../educacion/ClientePuntuacion.js';
import { establecerIdDisenoEnRuta, obtenerContextoRuta } from '../red/ContextoDiseno.js';
import { configurarBotonIcono } from '../interfaz/IconosRetro.js';

const sesion = requerirSesion();
if (sesion) iniciar();

function iniciar() {
  inicializarNavegacion({ actual:'disenos' });
  const cliente = new ClienteDisenos(sesion);
  const lista = document.getElementById('listaMisDisenos');
  const mensaje = document.getElementById('mensajeDisenos');
  const formulario = document.getElementById('crearDiseno');
  const buscar = document.getElementById('buscarDisenos');
  const reintentar = document.getElementById('reintentarDisenos');
  const dialogo = document.getElementById('confirmarEliminarDiseno');
  let disenos = [], escenarios = [], catalogoDisponible = false, cargando = false, operacion = false;
  const estados = { EN_DISENO:'En diseño', GUARDADO:'Guardado', VALIDADO:'Validado', COMPLETADO:'Completado', COMPLETADA:'Completada' };
  const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const textoEstado = d => estados[d.estado] ?? d.estado ?? '';
  const protegido = d => !catalogoDisponible || escenarios.some(e=>e.idEscenario===d.idEscenario && Number.isInteger(e.numero));
  const ruta = (d, destino) => {
    const anterior = obtenerContextoRuta();
    return establecerIdDisenoEnRuta(destino, d.idDiseno, anterior.idDiseno === d.idDiseno ? anterior : { idEscenario:d.idEscenario });
  };
  function renderizar() {
    const visibles = disenos.filter(d=>normalizar(`${d.nombre} ${textoEstado(d)}`).includes(normalizar(buscar.value)));
    lista.replaceChildren(...visibles.map(d=>{
      const fila = document.createElement('li'); fila.dataset.diseno = d.idDiseno;
      const identidad = document.createElement('div');
      const nombre = document.createElement('strong'); nombre.textContent = d.nombre;
      const estado = document.createElement('small'); estado.textContent = `${textoEstado(d)}${protegido(d) && catalogoDisponible ? ' · Escenario educativo' : ''}`;
      identidad.append(nombre, estado);
      const acciones = document.createElement('div'); acciones.className = 'metronet-disenos__acciones';
      for (const [icono,etiqueta,destino] of [['editar','Abrir diseño','/'],['play','Simular diseño','/simulacion.html']]) {
        const enlace = document.createElement('a'); enlace.className = 'metronet-boton'; enlace.href = ruta(d,destino);
        configurarBotonIcono(enlace,icono,`${etiqueta}: ${d.nombre}`); acciones.append(enlace);
      }
      const eliminar = document.createElement('button'); eliminar.type='button';
      configurarBotonIcono(eliminar,'eliminar',`Eliminar diseño: ${d.nombre}`);
      eliminar.classList.add('metronet-boton--peligro'); eliminar.disabled=protegido(d)||operacion;
      eliminar.addEventListener('click',()=>confirmarEliminar(d));acciones.append(eliminar);
      fila.append(identidad,acciones);return fila;
    }));
    mensaje.textContent = visibles.length ? `${visibles.length} diseños disponibles.` : disenos.length ? 'No hay diseños que coincidan con la búsqueda.' : 'Todavía no hay diseños guardados.';
  }
  async function cargar() {
    if(cargando)return; cargando=true;lista.setAttribute('aria-busy','true');reintentar.hidden=true;
    const [redes,juego] = await Promise.allSettled([cliente.listar(),consultarJuego('/escenarios')]);
    catalogoDisponible=juego.status==='fulfilled'&&Array.isArray(juego.value);
    escenarios=catalogoDisponible?juego.value:[];
    formulario.hidden=!escenarios.some(e=>e.numero===null&&e.desbloqueado);
    document.getElementById('disenosCreacionEstado').textContent = !catalogoDisponible ? 'No se pudo consultar la disponibilidad del Modo Libre. Podés abrir tus diseños; volvé a cargar para gestionar su creación o eliminación.' : formulario.hidden ? 'La creación de redes nuevas está disponible al desbloquear el Modo Libre.' : '';
    if(redes.status==='fulfilled'){disenos=redes.value;renderizar();}
    else mensaje.textContent=redes.reason.message;
    reintentar.hidden=redes.status==='fulfilled'&&catalogoDisponible;
    cargando=false;lista.setAttribute('aria-busy','false');
  }
  async function confirmarEliminar(diseno) {
    if(operacion||dialogo.open||protegido(diseno))return;
    document.getElementById('nombreEliminarDiseno').textContent=`¿Eliminar «${diseno.nombre}»?`;
    dialogo.returnValue='cancelar';dialogo.showModal();
    dialogo.addEventListener('close',async()=>{
      if(dialogo.returnValue!=='eliminar')return;
      operacion=true;renderizar();
      try{await cliente.solicitar(`/${diseno.idDiseno}`,{method:'DELETE'});disenos=disenos.filter(d=>d.idDiseno!==diseno.idDiseno);renderizar();mensaje.textContent='Diseño eliminado.';}
      catch(error){mensaje.textContent=error.message;}
      finally{operacion=false;lista.querySelectorAll('button').forEach(b=>{const d=disenos.find(d=>String(d.idDiseno)===b.closest('li').dataset.diseno);b.disabled=protegido(d);});}
    },{once:true});
  }
  formulario.addEventListener('submit',async evento=>{
    evento.preventDefault();if(operacion||formulario.hidden||!formulario.reportValidity())return;
    const nombre=formulario.elements.nombre.value.trim();if(!nombre){mensaje.textContent='Ingresá un nombre para la nueva red.';return;}
    operacion=true;formulario.querySelector('button').disabled=true;
    try{const diseno=await cliente.solicitar('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre})});await navegarConCambiosPendientes(ruta(diseno,'/'));}
    catch(error){mensaje.textContent=error.message;}
    finally{operacion=false;formulario.querySelector('button').disabled=false;}
  });
  buscar.addEventListener('input',renderizar);reintentar.addEventListener('click',cargar);void cargar();
}
