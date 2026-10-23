package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarConexionRequest;
import com.metronet.backend.dto.ActualizarEstacionRequest;
import com.metronet.backend.dto.ActualizarLineaRequest;
import com.metronet.backend.dto.ActualizarTramoRequest;
import com.metronet.backend.dto.ActualizarUnidadMetroRequest;
import com.metronet.backend.dto.ConexionResponse;
import com.metronet.backend.dto.CrearConexionRequest;
import com.metronet.backend.dto.CrearEstacionAdministracionRequest;
import com.metronet.backend.dto.CrearLineaAdministracionRequest;
import com.metronet.backend.dto.DisenoDetalleResponse;
import com.metronet.backend.dto.DisenoResumenResponse;
import com.metronet.backend.dto.EstacionResponse;
import com.metronet.backend.dto.LineaMetroResponse;
import com.metronet.backend.dto.TramoResponse;
import com.metronet.backend.dto.UnidadMetroResponse;
import com.metronet.backend.repository.DisenoAdministracionRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DisenoAdministracionService {
    private final DisenoAdministracionRepository repositorio;
    private final com.metronet.backend.repository.ConexionesLineasRepository conexionesLineas;
    private final RestriccionesGeograficasService restriccionesGeograficas;

    public DisenoAdministracionService(
        DisenoAdministracionRepository repositorio,
        RestriccionesGeograficasService restriccionesGeograficas,
        com.metronet.backend.repository.ConexionesLineasRepository conexionesLineas
    ) {
        this.repositorio = repositorio;
        this.conexionesLineas = conexionesLineas;
        this.restriccionesGeograficas = restriccionesGeograficas;
    }

    public List<DisenoResumenResponse> listarDisenos() {
        return repositorio.listarDisenos((resultado, fila) -> new DisenoResumenResponse(
                resultado.getInt("id_diseno"),
                resultado.getString("propietario"),
                resultado.getString("email"),
                (Integer) resultado.getObject("id_escenario"),
                resultado.getString("modo"),
                resultado.getString("estado"),
                resultado.getString("nombre"),
                resultado.getObject("id_usuario", Integer.class)
            ));
    }

    public DisenoDetalleResponse obtenerDiseno(Integer idDiseno) {
        DisenoResumenResponse diseno = listarDisenos().stream()
            .filter(candidato -> candidato.idDiseno().equals(idDiseno))
            .findFirst()
            .orElseThrow(() -> noEncontrado("No existe el diseño solicitado"));

        List<LineaMetroResponse> lineas = repositorio.lineas((resultado, fila) -> new LineaMetroResponse(resultado.getString("nombre"), resultado.getBoolean("modificable")), idDiseno);
        List<EstacionResponse> estaciones = repositorio.estaciones((resultado, fila) -> new EstacionResponse(
                resultado.getString("nombre"),
                resultado.getBigDecimal("posicion_x"),
                resultado.getBigDecimal("posicion_y"),
                resultado.getBoolean("transbordo"),
                resultado.getBoolean("modificable")
            ), idDiseno);
        List<ConexionResponse> conexiones = repositorio.conexiones((resultado, fila) -> new ConexionResponse(
                resultado.getString("nombre_linea"), resultado.getString("nombre_estacion")
            ), idDiseno);
        List<TramoResponse> tramos = repositorio.tramos((resultado, fila) -> new TramoResponse(
                resultado.getString("nombre_linea"),
                resultado.getString("nombre_estacion_a"),
                resultado.getString("nombre_estacion_b")
            ), idDiseno);
        List<UnidadMetroResponse> unidadesMetro = repositorio.unidades((resultado, fila) -> new UnidadMetroResponse(
                resultado.getInt("id_tren"),
                resultado.getString("nombre_linea"),
                resultado.getInt("capacidad"),
                resultado.getBigDecimal("velocidad_promedio")
            ), idDiseno);

        return new DisenoDetalleResponse(diseno, lineas, estaciones, conexiones, tramos, unidadesMetro, conexionesLineas.listar(idDiseno));
    }

    @Transactional
    public void eliminarDiseno(Integer idDiseno) {
        Boolean existeDiseno = repositorio.existeDiseno(idDiseno);
        if (!Boolean.TRUE.equals(existeDiseno)) {
            throw noEncontrado("No existe el diseño solicitado");
        }
        List<Integer> escenariosNoProgresivos = obtenerEscenariosNoProgresivosRelacionados(idDiseno);
        // Serializar con la finalización antes de separar los logros de la red.
        repositorio.bloquearIntentosDelDiseno(idDiseno);
        repositorio.conservarIntentosCompletados(idDiseno);
        if (repositorio.eliminarDiseno(idDiseno) == 0) {
            throw noEncontrado("No existe el diseño solicitado");
        }
        eliminarEscenariosSinIntentos(escenariosNoProgresivos);
    }

    public void verificarDisenoEditable(Integer idDiseno) {
        Boolean logroProtegido = repositorio.tieneIntentoCompleto(idDiseno);
        if (Boolean.TRUE.equals(logroProtegido)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "El diseño pertenece a un nivel completado y quedó bloqueado para conservar el logro."
            );
        }
    }

    private List<Integer> obtenerEscenariosNoProgresivosRelacionados(Integer idDiseno) {
        return repositorio.escenariosNoProgresivos((resultado, fila) -> resultado.getInt("id_escenario"), idDiseno, idDiseno);
    }

    private void eliminarEscenariosSinIntentos(List<Integer> idsEscenario) {
        for (Integer idEscenario : idsEscenario) {
            repositorio.eliminarEscenarioSinIntentos(idEscenario, idEscenario);
        }
    }

    public void crearLinea(Integer idDiseno, CrearLineaAdministracionRequest solicitud) {
        verificarDisenoEditable(idDiseno);
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre de línea válido");

        if (existeLinea(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una línea con ese nombre");
        }

        repositorio.crearLinea(idDiseno, nombre);
    }

    @Transactional
    public void crearEstacion(Integer idDiseno, CrearEstacionAdministracionRequest solicitud) {
        verificarDisenoEditable(idDiseno);
        if (solicitud == null || solicitud.posicionX() == null || solicitud.posicionY() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una posición válida para la estación");
        }

        solicitud = new CrearEstacionAdministracionRequest(solicitud.nombre(), RestriccionesGeograficasService.redondear(solicitud.posicionX()),
            RestriccionesGeograficasService.redondear(solicitud.posicionY()), solicitud.transbordo());
        restriccionesGeograficas.validarEstacion(idDiseno, null, solicitud.posicionX(), solicitud.posicionY());
        String nombre = nombreValido(solicitud.nombre(), "Ingresá un nombre de estación válido");

        if (existeEstacion(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una estación con ese nombre");
        }

        repositorio.crearEstacion(idDiseno, nombre, solicitud.posicionX(), solicitud.posicionY(), Boolean.TRUE.equals(solicitud.transbordo()));
    }

    public void crearConexion(Integer idDiseno, CrearConexionRequest solicitud) {
        verificarDisenoEditable(idDiseno);
        if (solicitud == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una conexión válida");
        }

        String nombreLinea = nombreValido(solicitud.nombreLinea(), "Seleccioná una línea válida");
        String nombreEstacion = nombreValido(solicitud.nombreEstacion(), "Seleccioná una estación válida");
        verificarLinea(idDiseno, nombreLinea);
        verificarEstacion(idDiseno, nombreEstacion);

        if (Boolean.TRUE.equals(repositorio.existeConexion(idDiseno, nombreLinea, nombreEstacion))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La conexión ya existe");
        }

        repositorio.crearConexion(idDiseno, nombreLinea, nombreEstacion);
    }

    @Transactional
    public void crearTramo(Integer idDiseno, ActualizarTramoRequest solicitud) {
        verificarDisenoEditable(idDiseno);
        DatosTramo tramo = validarTramo(idDiseno, solicitud);
        if (existeTramo(idDiseno, tramo.nombreLinea(), tramo.estacionA(), tramo.estacionB())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La conexión entre esas estaciones ya existe en la línea");
        }
        repositorio.crearTramo(idDiseno, tramo.nombreLinea(), tramo.estacionA(), tramo.estacionB());
        asegurarConexion(idDiseno, tramo.nombreLinea(), tramo.estacionA());
        asegurarConexion(idDiseno, tramo.nombreLinea(), tramo.estacionB());
    }

    @Transactional
    public void actualizarTramo(
        Integer idDiseno,
        String nombreLineaActual,
        String estacionAActual,
        String estacionBActual,
        ActualizarTramoRequest solicitud
    ) {
        verificarDisenoEditable(idDiseno);
        DatosTramo tramo = validarTramo(idDiseno, solicitud);
        if (!representaMismoTramo(
            nombreLineaActual,
            estacionAActual,
            estacionBActual,
            tramo.nombreLinea(),
            tramo.estacionA(),
            tramo.estacionB()
        ) && existeTramo(idDiseno, tramo.nombreLinea(), tramo.estacionA(), tramo.estacionB())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La conexión entre esas estaciones ya existe en la línea");
        }
        if (repositorio.actualizarTramo(
            tramo.nombreLinea(),
            tramo.estacionA(),
            tramo.estacionB(),
            idDiseno,
            nombreLineaActual,
            estacionAActual,
            estacionBActual
        ) == 0) {
            throw noEncontrado("No existe el tramo solicitado");
        }
        asegurarConexion(idDiseno, tramo.nombreLinea(), tramo.estacionA());
        asegurarConexion(idDiseno, tramo.nombreLinea(), tramo.estacionB());
        quitarConexionSinTramos(idDiseno, nombreLineaActual, estacionAActual);
        quitarConexionSinTramos(idDiseno, nombreLineaActual, estacionBActual);
        conexionesLineas.limpiarSinRecorrido(idDiseno);
    }

    @Transactional
    public void eliminarTramo(Integer idDiseno, String nombreLinea, String estacionA, String estacionB) {
        verificarDisenoEditable(idDiseno);
        if (repositorio.eliminarTramo(idDiseno, nombreLinea, estacionA, estacionB) == 0) {
            throw noEncontrado("No existe el tramo solicitado");
        }
        quitarConexionSinTramos(idDiseno, nombreLinea, estacionA);
        quitarConexionSinTramos(idDiseno, nombreLinea, estacionB);
        conexionesLineas.limpiarSinRecorrido(idDiseno);
    }

    public UnidadMetroResponse crearUnidadMetro(Integer idDiseno, ActualizarUnidadMetroRequest solicitud) {
        verificarDisenoEditable(idDiseno);
        DatosUnidadMetro unidad = validarUnidadMetro(idDiseno, solicitud);
        Integer idTren = repositorio.crearUnidad(idDiseno, unidad.nombreLinea(), unidad.capacidad(), unidad.velocidadPromedio());
        return new UnidadMetroResponse(idTren, unidad.nombreLinea(), unidad.capacidad(), unidad.velocidadPromedio());
    }

    public void actualizarUnidadMetro(Integer idDiseno, Integer idTren, ActualizarUnidadMetroRequest solicitud) {
        verificarDisenoEditable(idDiseno);
        DatosUnidadMetro unidad = validarUnidadMetro(idDiseno, solicitud);
        if (repositorio.actualizarUnidad(unidad.nombreLinea(), unidad.capacidad(), unidad.velocidadPromedio(), idDiseno, idTren) == 0) {
            throw noEncontrado("No existe la unidad de metro solicitada");
        }
    }

    public void eliminarUnidadMetro(Integer idDiseno, Integer idTren) {
        verificarDisenoEditable(idDiseno);
        if (repositorio.eliminarUnidad(idDiseno, idTren) == 0) {
            throw noEncontrado("No existe la unidad de metro solicitada");
        }
    }

    @Transactional
    public void actualizarLinea(Integer idDiseno, String nombreActual, ActualizarLineaRequest solicitud) {
        verificarDisenoEditable(idDiseno);
        String nuevoNombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre de línea válido");
        verificarLinea(idDiseno, nombreActual);

        if (nombreActual.equals(nuevoNombre)) {
            return;
        }

        if (existeLinea(idDiseno, nuevoNombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una línea con ese nombre");
        }

        repositorio.copiarLinea(nuevoNombre, idDiseno, nombreActual);
        repositorio.renombrarLineaEnConexiones(nuevoNombre, idDiseno, nombreActual);
        repositorio.renombrarLineaEnTramos(nuevoNombre, idDiseno, nombreActual);
        repositorio.renombrarLineaEnUnidades(nuevoNombre, idDiseno, nombreActual);
        repositorio.eliminarLineaAnterior(idDiseno, nombreActual);
    }

    public void eliminarLinea(Integer idDiseno, String nombreLinea) {
        verificarDisenoEditable(idDiseno);
        if (repositorio.eliminarLinea(idDiseno, nombreLinea) == 0) {
            throw noEncontrado("No existe la línea solicitada");
        }
    }

    @Transactional
    public void actualizarEstacion(Integer idDiseno, String nombreActual, ActualizarEstacionRequest solicitud) {
        verificarDisenoEditable(idDiseno);
        if (solicitud == null || solicitud.posicionX() == null || solicitud.posicionY() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una posición válida para la estación");
        }

        solicitud = new ActualizarEstacionRequest(solicitud.nombre(), RestriccionesGeograficasService.redondear(solicitud.posicionX()),
            RestriccionesGeograficasService.redondear(solicitud.posicionY()), solicitud.transbordo());
        String nuevoNombre = nombreValido(solicitud.nombre(), "Ingresá un nombre de estación válido");
        verificarEstacion(idDiseno, nombreActual);
        restriccionesGeograficas.validarEstacion(idDiseno, nombreActual, solicitud.posicionX(), solicitud.posicionY());

        if (nombreActual.equals(nuevoNombre)) {
            repositorio.actualizarPosicionEstacion(solicitud.posicionX(), solicitud.posicionY(), solicitud.transbordo(), idDiseno, nombreActual);
            return;
        }

        if (existeEstacion(idDiseno, nuevoNombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una estación con ese nombre");
        }

        repositorio.copiarEstacion(nuevoNombre, solicitud.posicionX(), solicitud.posicionY(), solicitud.transbordo(), idDiseno, nombreActual);
        repositorio.renombrarEstacionEnConexiones(nuevoNombre, idDiseno, nombreActual);
        repositorio.renombrarEstacionOrigen(nuevoNombre, idDiseno, nombreActual);
        repositorio.renombrarEstacionDestino(nuevoNombre, idDiseno, nombreActual);
        repositorio.eliminarEstacionAnterior(idDiseno, nombreActual);
    }

    public void eliminarEstacion(Integer idDiseno, String nombreEstacion) {
        verificarDisenoEditable(idDiseno);
        if (repositorio.eliminarEstacion(idDiseno, nombreEstacion) == 0) {
            throw noEncontrado("No existe la estación solicitada");
        }
    }

    public void actualizarConexion(
        Integer idDiseno,
        String nombreLineaActual,
        String nombreEstacionActual,
        ActualizarConexionRequest solicitud
    ) {
        verificarDisenoEditable(idDiseno);
        if (solicitud == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una conexión válida");
        }

        String nombreLinea = nombreValido(solicitud.nombreLinea(), "Seleccioná una línea válida");
        String nombreEstacion = nombreValido(solicitud.nombreEstacion(), "Seleccioná una estación válida");
        verificarLinea(idDiseno, nombreLinea);
        verificarEstacion(idDiseno, nombreEstacion);

        if (repositorio.actualizarConexion(nombreLinea, nombreEstacion, idDiseno, nombreLineaActual, nombreEstacionActual) == 0) {
            throw noEncontrado("No existe la conexión solicitada");
        }
    }

    public void eliminarConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        verificarDisenoEditable(idDiseno);
        if (repositorio.eliminarConexion(idDiseno, nombreLinea, nombreEstacion) == 0) {
            throw noEncontrado("No existe la conexión solicitada");
        }
    }

    private DatosTramo validarTramo(Integer idDiseno, ActualizarTramoRequest solicitud) {
        if (solicitud == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un tramo válido");
        }

        String nombreLinea = nombreValido(solicitud.nombreLinea(), "Seleccioná una línea válida");
        String estacionA = nombreValido(solicitud.estacionA(), "Seleccioná la estación de origen");
        String estacionB = nombreValido(solicitud.estacionB(), "Seleccioná la estación de destino");

        if (estacionA.equals(estacionB)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Las estaciones del tramo deben ser diferentes");
        }

        verificarLinea(idDiseno, nombreLinea);
        verificarEstacion(idDiseno, estacionA);
        verificarEstacion(idDiseno, estacionB);
        restriccionesGeograficas.validarRecorrido(idDiseno, List.of(estacionA, estacionB));
        return new DatosTramo(nombreLinea, estacionA, estacionB);
    }

    private DatosUnidadMetro validarUnidadMetro(Integer idDiseno, ActualizarUnidadMetroRequest solicitud) {
        if (solicitud == null || solicitud.capacidad() == null || solicitud.velocidadPromedio() == null
            || solicitud.capacidad() <= 0 || !ParametrosSimulacion.velocidadValida(solicitud.velocidadPromedio())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá capacidad y velocidad válidas para la unidad");
        }

        String nombreLinea = nombreValido(solicitud.nombreLinea(), "Seleccioná una línea válida");
        verificarLinea(idDiseno, nombreLinea);
        return new DatosUnidadMetro(nombreLinea, solicitud.capacidad(), solicitud.velocidadPromedio());
    }

    private void asegurarConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        if (!Boolean.TRUE.equals(repositorio.comprobarConexion(idDiseno, nombreLinea, nombreEstacion))) {
            repositorio.registrarConexion(idDiseno, nombreLinea, nombreEstacion);
        }
    }

    private void quitarConexionSinTramos(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        repositorio.quitarConexionSinTramos(idDiseno, nombreLinea, nombreEstacion);
    }

    private boolean existeTramo(Integer idDiseno, String nombreLinea, String estacionA, String estacionB) {
        return Boolean.TRUE.equals(repositorio.existeTramo(idDiseno, nombreLinea, estacionA, estacionB, estacionB, estacionA));
    }

    private boolean representaMismoTramo(
        String lineaActual,
        String estacionAActual,
        String estacionBActual,
        String nuevaLinea,
        String nuevaEstacionA,
        String nuevaEstacionB
    ) {
        return lineaActual.equals(nuevaLinea) && (
            estacionAActual.equals(nuevaEstacionA) && estacionBActual.equals(nuevaEstacionB)
                || estacionAActual.equals(nuevaEstacionB) && estacionBActual.equals(nuevaEstacionA)
        );
    }

    private void verificarLinea(Integer idDiseno, String nombreLinea) {
        if (!existeLinea(idDiseno, nombreLinea)) {
            throw noEncontrado("No existe la línea solicitada");
        }
    }

    private void verificarEstacion(Integer idDiseno, String nombreEstacion) {
        if (!existeEstacion(idDiseno, nombreEstacion)) {
            throw noEncontrado("No existe la estación solicitada");
        }
    }

    private boolean existeLinea(Integer idDiseno, String nombreLinea) {
        return Boolean.TRUE.equals(repositorio.existeLinea(idDiseno, nombreLinea));
    }

    private boolean existeEstacion(Integer idDiseno, String nombreEstacion) {
        return Boolean.TRUE.equals(repositorio.existeEstacion(idDiseno, nombreEstacion));
    }

    private String nombreValido(String nombre, String mensaje) {
        if (nombre == null || nombre.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
        }

        return nombre.trim();
    }

    private ResponseStatusException noEncontrado(String mensaje) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, mensaje);
    }

    private record DatosTramo(String nombreLinea, String estacionA, String estacionB) {}

    private record DatosUnidadMetro(String nombreLinea, Integer capacidad, java.math.BigDecimal velocidadPromedio) {}
}
