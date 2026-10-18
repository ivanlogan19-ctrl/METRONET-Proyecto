package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarEscenarioRequest;
import com.metronet.backend.dto.ActualizarEstacionRequest;
import com.metronet.backend.dto.ActualizarLineaSimulacionRequest;
import com.metronet.backend.dto.ActualizarTramoRequest;
import com.metronet.backend.dto.ActualizarUnidadMetroRequest;
import com.metronet.backend.dto.CrearEscenarioRequest;
import com.metronet.backend.dto.CrearEstacionSimulacionRequest;
import com.metronet.backend.dto.CrearLineaSimulacionRequest;
import com.metronet.backend.dto.CrearSimulacionRequest;
import com.metronet.backend.dto.CrearUnidadMetroSimulacionRequest;
import com.metronet.backend.dto.EjecutarSimulacionRequest;
import com.metronet.backend.dto.EstacionSimulacionResponse;
import com.metronet.backend.dto.LineaSimulacionResponse;
import com.metronet.backend.dto.ResultadoSimulacionResponse;
import com.metronet.backend.dto.SimulacionDetalleResponse;
import com.metronet.backend.dto.SimulacionResumenResponse;
import com.metronet.backend.dto.TramoSimulacionResponse;
import com.metronet.backend.dto.UnidadMetroSimulacionResponse;
import com.metronet.backend.dto.ValidacionDisenoResponse;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.SimulacionRepository;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SimulacionService {
    private final SimulacionRepository repositorio;
    private final RestriccionesGeograficasService restriccionesGeograficas;
    private final DisenoAdministracionService disenoAdministracionService;
    private final ObjetivosPuntosInteresService objetivosPuntosInteresService;
    private final JuegoEducativoService juegoEducativoService;
    private final CriterioUvUtService criterioUvUt;
    private final DistanciasRedService distancias;
    private final VinculoUvUtLibre vinculoLibre;

    @org.springframework.beans.factory.annotation.Autowired
    public SimulacionService(SimulacionRepository repositorio, DisenoAdministracionService disenoAdministracionService,
        ObjetivosPuntosInteresService objetivosPuntosInteresService, JuegoEducativoService juegoEducativoService,
        RestriccionesGeograficasService restriccionesGeograficas, CriterioUvUtService criterioUvUt, DistanciasRedService distancias, VinculoUvUtLibre vinculoLibre) {
        this.distancias = distancias;
        this.vinculoLibre = vinculoLibre;
        this.repositorio = repositorio;
        this.restriccionesGeograficas = restriccionesGeograficas;
        this.disenoAdministracionService = disenoAdministracionService;
        this.objetivosPuntosInteresService = objetivosPuntosInteresService;
        this.juegoEducativoService = juegoEducativoService;
        this.criterioUvUt = criterioUvUt;
    }

    public List<SimulacionResumenResponse> listarSimulaciones(Integer idUsuario) {
        return repositorio.listarSimulaciones((resultado, fila) -> mapearResumen(resultado), idUsuario);
    }

    @Transactional
    public SimulacionResumenResponse crearSimulacion(Integer idUsuario, Rol rol, CrearSimulacionRequest solicitud) {
        if (rol == Rol.JUGADOR && !juegoEducativoService.tieneModoLibreDesbloqueado(idUsuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Completá todos los niveles de una campaña para desbloquear el Modo Libre");
        }
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para la simulación");
        Integer idDiseno = repositorio.crearDisenoLibre();
        Integer idEscenario = repositorio.crearEscenarioLibre(nombre);

        repositorio.crearIntentoLibre(idUsuario, idEscenario, idDiseno);

        return obtenerResumen(idUsuario, idDiseno);
    }

    @Transactional
    public SimulacionResumenResponse crearEscenario(Integer idUsuario, Integer idDisenoBase, CrearEscenarioRequest solicitud) {
        SimulacionResumenResponse base = obtenerResumen(idUsuario, idDisenoBase);
        if (!"VALIDADO".equals(base.estado())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Validá el diseño antes de crear una actividad de aprendizaje");
        }

        restriccionesGeograficas.validarDiseno(idDisenoBase);
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para la actividad");
        String modo = modoValido(solicitud == null ? null : solicitud.modo());
        String dificultad = dificultadValida(solicitud == null ? null : solicitud.dificultad());
        String objetivo = textoOpcional(solicitud == null ? null : solicitud.objetivo(), "Aplicar los conceptos de diseño de una red de metro.");
        String instrucciones = textoOpcional(solicitud == null ? null : solicitud.instrucciones(), instruccionesPredeterminadas(modo, dificultad));
        Integer numero = "NIVEL".equals(modo)
            ? repositorio.siguienteNumeroEscenario()
            : null;
        Integer idEscenario = repositorio.crearEscenario(nombre, idDisenoBase, objetivo, numero, modo, dificultad, instrucciones);
        Integer idDisenoNuevo = repositorio.crearDisenoNivel();

        repositorio.copiarEstaciones(idDisenoNuevo, idDisenoBase);
        repositorio.copiarLineas(idDisenoNuevo, idDisenoBase);
        repositorio.copiarConexiones(idDisenoNuevo, idDisenoBase);
        repositorio.copiarTramos(idDisenoNuevo, idDisenoBase);
        repositorio.copiarMetros(idDisenoNuevo, idDisenoBase);
        repositorio.crearIntento(idUsuario, idEscenario, idDisenoNuevo);
        return obtenerResumen(idUsuario, idDisenoNuevo);
    }

    public SimulacionDetalleResponse obtenerSimulacion(Integer idUsuario, Integer idDiseno) {
        SimulacionResumenResponse simulacion = obtenerResumen(idUsuario, idDiseno);
        List<EstacionSimulacionResponse> estaciones = repositorio.estaciones((resultado, fila) -> new EstacionSimulacionResponse(
                resultado.getString("nombre"), resultado.getBigDecimal("posicion_x"), resultado.getBigDecimal("posicion_y"), resultado.getBoolean("transbordo")
            ), idDiseno);
        List<LineaSimulacionResponse> lineas = repositorio.lineas((resultado, fila) -> new LineaSimulacionResponse(resultado.getString("nombre")), idDiseno);
        List<TramoSimulacionResponse> tramos = distancias.tramos(idDiseno);
        List<UnidadMetroSimulacionResponse> unidadesMetro = vinculoLibre.resolver(idDiseno, listarUnidades(idDiseno));
        List<ResultadoSimulacionResponse> resultados = listarResultados(idUsuario, idDiseno);
        PreparacionSimulacion preparacion = evaluarPreparacionSimulacion(
            estadoPermiteSimular(simulacion.estado()), unidadesMetro, idDiseno
        );

        return new SimulacionDetalleResponse(
            simulacion, estaciones, lineas, tramos, unidadesMetro, resultados,
            preparacion.preparado(), preparacion.observaciones(), restriccionesGeograficas.obtenerConfiguracion(idDiseno), vinculoLibre.aplica(idDiseno)
        );
    }

    @Transactional
    public EstacionSimulacionResponse crearEstacion(
        Integer idUsuario,
        Integer idDiseno,
        CrearEstacionSimulacionRequest solicitud
    ) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para la estación");
        BigDecimal posicionX = RestriccionesGeograficasService.redondear(solicitud == null ? null : solicitud.posicionX());
        BigDecimal posicionY = RestriccionesGeograficasService.redondear(solicitud == null ? null : solicitud.posicionY());

        if (posicionX == null || posicionY == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí una posición válida para la estación");
        }

        restriccionesGeograficas.validarEstacion(idDiseno, null, posicionX, posicionY);
        if (existeEstacion(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una estación con ese nombre");
        }

        repositorio.crearEstacion(idDiseno, nombre, posicionX, posicionY);
        marcarEnDiseno(idUsuario, idDiseno);
        return new EstacionSimulacionResponse(nombre, posicionX, posicionY, false);
    }

    @Transactional
    public LineaSimulacionResponse crearLinea(
        Integer idUsuario,
        Integer idDiseno,
        CrearLineaSimulacionRequest solicitud
    ) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para la línea");
        List<String> estaciones = solicitud == null || solicitud.estaciones() == null
            ? List.of()
            : solicitud.estaciones().stream().map(valor -> valor == null ? "" : valor.trim()).toList();

        if (estaciones.size() < 2 || new LinkedHashSet<>(estaciones).size() != estaciones.size() || estaciones.stream().anyMatch(String::isBlank)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seleccioná al menos dos estaciones diferentes");
        }

        if (existeLinea(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una línea con ese nombre");
        }

        for (String estacion : estaciones) {
            if (!existeEstacion(idDiseno, estacion)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Una de las estaciones seleccionadas no existe");
            }
        }

        restriccionesGeograficas.validarRecorrido(idDiseno, estaciones);
        repositorio.crearLinea(idDiseno, nombre);
        for (String estacion : estaciones) {
            repositorio.crearConexion(idDiseno, nombre, estacion);
        }
        for (int indice = 1; indice < estaciones.size(); indice++) {
            repositorio.crearTramo(idDiseno, nombre, estaciones.get(indice - 1), estaciones.get(indice));
        }

        marcarEnDiseno(idUsuario, idDiseno);
        return new LineaSimulacionResponse(nombre);
    }

    @Transactional
    public SimulacionResumenResponse guardarDiseno(Integer idUsuario, Integer idDiseno) {
        repositorio.bloquearUsuarioParaGuardar(idUsuario);
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        restriccionesGeograficas.validarDiseno(idDiseno);
        repositorio.guardarDiseno(idUsuario, idDiseno);
        juegoEducativoService.actualizarProgreso(idUsuario, idDiseno);
        return obtenerResumen(idUsuario, idDiseno);
    }

    @Transactional
    public UnidadMetroSimulacionResponse crearUnidadMetro(
        Integer idUsuario,
        Integer idDiseno,
        CrearUnidadMetroSimulacionRequest solicitud
    ) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        String nombreLinea = nombreValido(solicitud == null ? null : solicitud.nombreLinea(), "Elegí la línea de la unidad");
        if (!existeLinea(idDiseno, nombreLinea)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La línea seleccionada no existe");
        if (solicitud.capacidad() == null || solicitud.capacidad() < 1 || solicitud.velocidadPromedio() == null || !ParametrosSimulacion.velocidadValida(solicitud.velocidadPromedio())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una capacidad y velocidad válidas");
        }
        Integer idTren = repositorio.crearUnidad(idDiseno, nombreLinea, solicitud.capacidad(), solicitud.velocidadPromedio());
        marcarEnDiseno(idUsuario, idDiseno);
        if (vinculoLibre.aplica(idDiseno)) return vinculoLibre.resolver(idDiseno, listarUnidades(idDiseno)).stream()
            .filter(u -> u.idTren().equals(idTren)).findFirst().orElseThrow();
        return new UnidadMetroSimulacionResponse(idTren, nombreLinea, solicitud.capacidad(), solicitud.velocidadPromedio());
    }

    @Transactional
    public void eliminarUnidadMetro(Integer idUsuario, Integer idDiseno, Integer idTren) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        if (repositorio.eliminarUnidad(idDiseno, idTren) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la unidad de metro solicitada");
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    @Transactional
    public void actualizarUnidadMetro(Integer idUsuario, Integer idDiseno, Integer idTren, ActualizarUnidadMetroRequest solicitud) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        boolean libre = vinculoLibre.aplica(idDiseno);
        String lineaAnterior = libre ? repositorio.lineaDeUnidad((rs,n) -> rs.getString(1), idDiseno, idTren).stream().findFirst().orElse(null) : null;
        String nombreLinea = nombreValido(solicitud == null ? null : solicitud.nombreLinea(), "Elegí la línea de la unidad");
        if (!existeLinea(idDiseno, nombreLinea)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La línea seleccionada no existe");
        if (solicitud.capacidad() == null || solicitud.capacidad() < 1 || solicitud.velocidadPromedio() == null || !(libre ? VinculoUvUtLibre.velocidadValida(solicitud.velocidadPromedio()) : ParametrosSimulacion.velocidadValida(solicitud.velocidadPromedio()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una capacidad y velocidad válidas");
        }
        if (solicitud.duracionUt() != null && (!VinculoUvUtLibre.tiempoValido(solicitud.duracionUt()) || (!libre && solicitud.duracionUt() != Math.rint(solicitud.duracionUt()))))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, libre ? "UT debe ser positivo y tener hasta ocho decimales" : "UT debe ser un entero mayor que cero");
        String referencia = solicitud.parametroReferencia() != null ? solicitud.parametroReferencia() : solicitud.duracionUt() != null ? "UT" : "UV";
        if (libre && solicitud.parametroReferencia() == null && solicitud.duracionUt() == null) {
            var anteriores = repositorio.velocidadDeUnidad((rs, n) -> new Object[]{rs.getBigDecimal(1), rs.getString(2)}, idDiseno, idTren);
            if (!anteriores.isEmpty() && ((BigDecimal) anteriores.getFirst()[0]).compareTo(solicitud.velocidadPromedio()) == 0)
                referencia = (String) anteriores.getFirst()[1];
        }
        if (libre && !java.util.Set.of("UV", "UT").contains(referencia))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La referencia debe ser UV o UT");
        if (libre && "UT".equals(solicitud.parametroReferencia()) && solicitud.duracionUt() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indicá la duración UT");
        if (repositorio.actualizarUnidad(
            nombreLinea,
            solicitud.capacidad(),
            solicitud.velocidadPromedio(),
            solicitud.duracionUt(),
            idDiseno,
            idTren
        ) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la unidad de metro solicitada");
        }
        if (libre) vinculoLibre.compartir(idDiseno, idTren, referencia, !nombreLinea.equals(lineaAnterior));
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public SimulacionResumenResponse actualizarEscenario(Integer idUsuario, Integer idDiseno, ActualizarEscenarioRequest solicitud) {
        SimulacionResumenResponse resumen = obtenerResumenParaEdicion(idUsuario, idDiseno);
        if (esEscenarioProgresivo(resumen.idEscenario())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No podés editar un nivel progresivo.");
        }
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para la actividad");
        String dificultad = dificultadValida(solicitud == null ? null : solicitud.dificultad());
        String objetivo = textoOpcional(solicitud == null ? null : solicitud.objetivo(), "Aplicar los conceptos de diseño de una red de metro.");
        String instrucciones = textoOpcional(solicitud == null ? null : solicitud.instrucciones(), instruccionesPredeterminadas(resumen.modo(), dificultad));
        repositorio.actualizarEscenario(nombre, dificultad, objetivo, instrucciones, resumen.idEscenario());
        return obtenerResumen(idUsuario, idDiseno);
    }

    @Transactional
    public void eliminarDiseno(Integer idUsuario, Integer idDiseno) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        List<Integer> escenariosNoProgresivos = obtenerEscenariosNoProgresivosRelacionados(idDiseno);
        if (repositorio.eliminarDiseno(idDiseno) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el diseño solicitado");
        }
        eliminarEscenariosSinIntentos(escenariosNoProgresivos);
    }

    @Transactional
    public ResultadoSimulacionResponse ejecutarSimulacion(Integer idUsuario, Integer idDiseno, EjecutarSimulacionRequest solicitud) {
        repositorio.bloquearUsuarioParaSimular(idUsuario);
        SimulacionResumenResponse resumen = obtenerResumen(idUsuario, idDiseno);
        Integer idIntento = repositorio.idIntento(idUsuario, idDiseno);
        boolean uvUt = criterioUvUt.configuracionIntento(idIntento) != null;
        ParametrosSimulacion.validar(solicitud, uvUt, vinculoLibre.aplica(idDiseno));
        vinculoLibre.recalcular(idDiseno);
        ValidacionDisenoResponse estructura = evaluarDiseno(resumen, idDiseno);
        if (!estructura.valido()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.join(" ", estructura.observaciones()));
        }
        List<UnidadMetroSimulacionResponse> unidadesMetro = vinculoLibre.resolver(idDiseno, listarUnidades(idDiseno));
        int unidades = unidadesMetro.size();
        double duracion = unidadesMetro.stream().mapToDouble(u -> u.duracionUt() == null ? solicitud.duracion() : u.duracionUt()).max().orElse(solicitud.duracion());
        PreparacionSimulacion preparacion = evaluarPreparacionSimulacion(
            estadoPermiteSimular(resumen.estado()), unidadesMetro, idDiseno
        );
        if (!preparacion.preparado()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.join(" ", preparacion.observaciones()));
        }
        int lineas = repositorio.contarLineasParaSimular(idDiseno);
        int estaciones = repositorio.contarEstacionesParaSimular(idDiseno);
        int transbordos = repositorio.contarEstacionesCompartidas(idDiseno);
        int puntaje = 0; // Sin criterios de escenario no se asignan puntos por cantidad de elementos.
        String comentarios = "Se operaron " + unidades + " unidad(es) en " + lineas + " línea(s) durante " + duracion
            + " UT." + " La red mantiene " + estaciones + " estaciones y " + transbordos + " punto(s) de transbordo.";
        boolean progresivo = juegoEducativoService.esDisenoProgresivo(idUsuario, idDiseno);
        comentarios += juegoEducativoService.marcaRedSimulada(idDiseno, duracion);
        Integer idSimulacion = repositorio.registrarSimulacion(idIntento, solicitud.velocidad(), duracion, comentarios, puntaje);
        if (!vinculoLibre.aplica(idDiseno)) criterioUvUt.registrar(idIntento, idDiseno, idSimulacion, solicitud.duracion().intValue());
        if (progresivo) {
            juegoEducativoService.registrarPuntuacionSimulacion(idUsuario, idDiseno, idSimulacion);
            var desempeno = juegoEducativoService.obtenerDesempeno(idUsuario, idDiseno);
            if (desempeno != null) puntaje = desempeno.puntaje();
            repositorio.actualizarPuntajeSimulacion(puntaje, idSimulacion);
        }
        String estadoIntento = "COMPLETADO".equals(resumen.estado()) ? "COMPLETADO" : "COMPLETADA";
        repositorio.actualizarEstadoIntento(estadoIntento, puntaje, puntaje, idUsuario, idDiseno);
        juegoEducativoService.actualizarProgreso(idUsuario, idDiseno);
        return obtenerResultado(idSimulacion);
    }

    public List<ResultadoSimulacionResponse> listarResultados(Integer idUsuario, Integer idDiseno) {
        obtenerResumen(idUsuario, idDiseno);
        return repositorio.listarResultados((resultado, fila) -> mapearResultado(resultado), idUsuario, idDiseno);
    }

    @Transactional
    public void actualizarEstacion(Integer idUsuario, Integer idDiseno, String nombreActual, ActualizarEstacionRequest solicitud) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
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
            marcarEnDiseno(idUsuario, idDiseno);
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
        marcarEnDiseno(idUsuario, idDiseno);
    }

    @Transactional
    public void eliminarEstacion(Integer idUsuario, Integer idDiseno, String nombreEstacion) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        if (repositorio.eliminarEstacion(idDiseno, nombreEstacion) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la estación solicitada");
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    @Transactional
    public void actualizarLinea(Integer idUsuario, Integer idDiseno, String nombreActual, ActualizarLineaSimulacionRequest solicitud) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        String nuevoNombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre de línea válido");
        verificarLinea(idDiseno, nombreActual);
        // PATCH sin estaciones renombra sin reconstruir el grafo ni sus identificadores.
        List<String> estaciones = solicitud.estaciones() == null ? null : estacionesValidas(solicitud.estaciones());
        if (estaciones != null) {
            for (String estacion : estaciones) verificarEstacion(idDiseno, estacion);
            restriccionesGeograficas.validarRecorrido(idDiseno, estaciones);
        }

        if (existeLinea(idDiseno, nuevoNombre)) {
            if (!nombreActual.equals(nuevoNombre)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una línea con ese nombre");
            }
        } else {
            repositorio.copiarLinea(nuevoNombre, idDiseno, nombreActual);
            repositorio.renombrarLineaEnConexiones(nuevoNombre, idDiseno, nombreActual);
            repositorio.renombrarLineaEnTramos(nuevoNombre, idDiseno, nombreActual);
            repositorio.renombrarLineaEnMetros(nuevoNombre, idDiseno, nombreActual);
            repositorio.eliminarLineaAnterior(idDiseno, nombreActual);
        }

        if (estaciones == null) {
            marcarEnDiseno(idUsuario, idDiseno);
            return;
        }
        repositorio.eliminarTramosLinea(idDiseno, nuevoNombre);
        repositorio.eliminarConexionesLinea(idDiseno, nuevoNombre);
        for (String estacion : estaciones) {
            repositorio.registrarConexionLinea(idDiseno, nuevoNombre, estacion);
        }
        for (int indice = 1; indice < estaciones.size(); indice++) {
            repositorio.registrarTramoLinea(idDiseno, nuevoNombre, estaciones.get(indice - 1), estaciones.get(indice));
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    @Transactional
    public void eliminarLinea(Integer idUsuario, Integer idDiseno, String nombreLinea) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        if (repositorio.eliminarLinea(idDiseno, nombreLinea) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la línea solicitada");
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    @Transactional
    public void crearTramo(Integer idUsuario, Integer idDiseno, ActualizarTramoRequest solicitud) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        disenoAdministracionService.crearTramo(idDiseno, solicitud);
        marcarEnDiseno(idUsuario, idDiseno);
    }

    @Transactional
    public void actualizarTramo(
        Integer idUsuario,
        Integer idDiseno,
        String nombreLineaActual,
        String estacionAActual,
        String estacionBActual,
        ActualizarTramoRequest solicitud
    ) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        disenoAdministracionService.actualizarTramo(
            idDiseno, nombreLineaActual, estacionAActual, estacionBActual, solicitud
        );
        marcarEnDiseno(idUsuario, idDiseno);
    }

    @Transactional
    public void eliminarTramo(
        Integer idUsuario,
        Integer idDiseno,
        String nombreLinea,
        String estacionA,
        String estacionB
    ) {
        obtenerResumenParaEdicion(idUsuario, idDiseno);
        disenoAdministracionService.eliminarTramo(idDiseno, nombreLinea, estacionA, estacionB);
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public ValidacionDisenoResponse consultarValidacionDiseno(Integer idUsuario, Integer idDiseno) {
        return evaluarDiseno(obtenerResumen(idUsuario, idDiseno), idDiseno);
    }

    @Transactional
    public ValidacionDisenoResponse validarDiseno(Integer idUsuario, Integer idDiseno) {
        SimulacionResumenResponse resumen = obtenerResumenParaEdicion(idUsuario, idDiseno);
        ValidacionDisenoResponse validacion = evaluarDiseno(resumen, idDiseno);
        repositorio.registrarValidacion(estadoLuegoDeValidacion(validacion.valido(), resumen.estado()), idUsuario, idDiseno);
        return validacion;
    }

    private ValidacionDisenoResponse evaluarDiseno(SimulacionResumenResponse resumen, Integer idDiseno) {
        List<String> observaciones = new ArrayList<>();
        Integer cantidadEstaciones = repositorio.contarEstaciones(idDiseno);
        Integer cantidadLineas = repositorio.contarLineas(idDiseno);
        Integer cantidadTramos = repositorio.contarTramos(idDiseno);

        if (cantidadEstaciones == null || cantidadEstaciones < 2) observaciones.add("El diseño debe tener al menos dos estaciones.");
        if (cantidadLineas == null || cantidadLineas < 1) observaciones.add("El diseño debe tener al menos una línea de metro.");
        if (cantidadTramos == null || cantidadTramos < 1) observaciones.add("El diseño debe tener al menos un tramo entre estaciones.");

        List<String> lineasIncompletas = repositorio.lineasIncompletas((resultado, fila) -> resultado.getString("nombre"), idDiseno);
        if (!lineasIncompletas.isEmpty()) observaciones.add("Cada línea debe tener al menos dos estaciones: " + String.join(", ", lineasIncompletas) + ".");

        List<String> estacionesAisladas = repositorio.estacionesAisladas((resultado, fila) -> resultado.getString("nombre"), idDiseno);
        if (!estacionesAisladas.isEmpty()) observaciones.add("Hay estaciones sin línea asociada: " + String.join(", ", estacionesAisladas) + ".");

        observaciones.addAll(restriccionesGeograficas.observarDiseno(idDiseno));

        List<String> conexionesDuplicadas = repositorio.tramosDuplicados((resultado, fila) -> resultado.getString("nombre_linea") + " ("
                + resultado.getString("estacion_a") + " y " + resultado.getString("estacion_b") + ")", idDiseno);
        if (!conexionesDuplicadas.isEmpty()) observaciones.add("Hay conexiones duplicadas: " + String.join(", ", conexionesDuplicadas) + ".");

        validarConectividadLineas(idDiseno, observaciones);
        validarLineasSinRamificaciones(idDiseno, observaciones);

        boolean valido = observaciones.isEmpty();
        PreparacionSimulacion preparacion = evaluarPreparacionSimulacion(valido, listarUnidades(idDiseno), idDiseno);
        return new ValidacionDisenoResponse(valido, observaciones, preparacion.preparado(), preparacion.observaciones());
    }

    private void validarConectividadLineas(Integer idDiseno, List<String> observaciones) {
        List<String> lineas = repositorio.lineasParaConectividad((resultado, fila) -> resultado.getString("nombre"), idDiseno);
        for (String linea : lineas) {
            List<String> estaciones = repositorio.estacionesPorLinea((resultado, fila) -> resultado.getString("nombre_estacion"), idDiseno, linea);
            if (estaciones.size() < 2) continue;
            Map<String, Set<String>> conexiones = new HashMap<>();
            estaciones.forEach((estacion) -> conexiones.put(estacion, new HashSet<>()));
            repositorio.tramosPorLinea((resultado, fila) -> {
                    String estacionA = resultado.getString("nombre_estacion_a");
                    String estacionB = resultado.getString("nombre_estacion_b");
                    conexiones.computeIfAbsent(estacionA, clave -> new HashSet<>()).add(estacionB);
                    conexiones.computeIfAbsent(estacionB, clave -> new HashSet<>()).add(estacionA);
                    return null;
                }, idDiseno, linea);
            Set<String> visitadas = new HashSet<>();
            ArrayDeque<String> pendientes = new ArrayDeque<>();
            pendientes.add(estaciones.getFirst());
            while (!pendientes.isEmpty()) {
                String estacion = pendientes.removeFirst();
                if (!visitadas.add(estacion)) continue;
                conexiones.getOrDefault(estacion, Set.of()).forEach(pendientes::addLast);
            }
            if (visitadas.size() != estaciones.size()) observaciones.add("La línea " + linea + " tiene estaciones o conexiones desconectadas.");
        }
    }

    private void validarLineasSinRamificaciones(Integer idDiseno, List<String> observaciones) {
        List<String> ramificaciones = repositorio.estacionesConRamificaciones((resultado, fila) -> resultado.getString("nombre_linea") + " (" + resultado.getString("nombre_estacion") + ")", idDiseno, idDiseno);
        if (!ramificaciones.isEmpty()) {
            observaciones.add("Hay líneas ramificadas: " + String.join(", ", ramificaciones)
                + ". Dividí cada ramal en otra línea o usá una estación de transbordo.");
        }
    }

    private SimulacionResumenResponse obtenerResumen(Integer idUsuario, Integer idDiseno) {
        List<SimulacionResumenResponse> resultados = repositorio.resumen((resultado, fila) -> mapearResumen(resultado), idUsuario, idDiseno);

        if (resultados.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la simulación solicitada");
        }

        return resultados.getFirst();
    }

    private SimulacionResumenResponse obtenerResumenParaEdicion(Integer idUsuario, Integer idDiseno) {
        SimulacionResumenResponse resumen = obtenerResumen(idUsuario, idDiseno);
        disenoAdministracionService.verificarDisenoEditable(idDiseno);
        vinculoLibre.bloquear(idDiseno);
        return resumen;
    }

    private boolean existeEstacion(Integer idDiseno, String nombre) {
        return Boolean.TRUE.equals(repositorio.existeEstacion(idDiseno, nombre));
    }

    private boolean esEscenarioProgresivo(Integer idEscenario) {
        return Boolean.TRUE.equals(repositorio.esEscenarioProgresivo(idEscenario));
    }

    private List<Integer> obtenerEscenariosNoProgresivosRelacionados(Integer idDiseno) {
        return repositorio.escenariosNoProgresivos((resultado, fila) -> resultado.getInt("id_escenario"), idDiseno, idDiseno);
    }

    private void eliminarEscenariosSinIntentos(List<Integer> idsEscenario) {
        for (Integer idEscenario : idsEscenario) {
            repositorio.eliminarEscenarioSinIntentos(idEscenario, idEscenario);
        }
    }

    private SimulacionResumenResponse mapearResumen(ResultSet resultado) throws SQLException {
        return new SimulacionResumenResponse(
            resultado.getInt("id_diseno"),
            resultado.getInt("id_escenario"),
            resultado.getString("nombre"),
            resultado.getString("estado"),
            resultado.getString("modo"),
            resultado.getString("dificultad"),
            resultado.getString("objetivo"),
            resultado.getString("instrucciones"),
            resultado.getObject("id_diseno_base", Integer.class),
            objetivosPuntosInteresService.obtenerObjetivos(resultado.getString("reglas_exito"))
        );
    }

    private PreparacionSimulacion evaluarPreparacionSimulacion(
        boolean redValidada,
        List<UnidadMetroSimulacionResponse> unidadesMetro,
        Integer idDiseno
    ) {
        List<String> observaciones = new ArrayList<>();
        if (!redValidada) observaciones.add("Validá la red antes de iniciar una simulación.");
        if (redValidada) observaciones.addAll(restriccionesGeograficas.observarDiseno(idDiseno));
        if (unidadesMetro.isEmpty()) {
            observaciones.add("Incorporá al menos una unidad de metro antes de iniciar una simulación.");
        } else {
            List<String> lineasSinRuta = unidadesMetro.stream()
                .map(UnidadMetroSimulacionResponse::nombreLinea)
                .distinct()
                .filter(nombreLinea -> !tieneRutaOperable(idDiseno, nombreLinea))
                .toList();
            if (!lineasSinRuta.isEmpty()) {
                observaciones.add("Las unidades asignadas a " + String.join(", ", lineasSinRuta)
                    + " no tienen una ruta operable. Agregá al menos un tramo a cada línea antes de simular.");
            }
        }
        return new PreparacionSimulacion(observaciones.isEmpty(), List.copyOf(observaciones));
    }

    private boolean tieneRutaOperable(Integer idDiseno, String nombreLinea) {
        return Boolean.TRUE.equals(repositorio.tieneRutaOperable(idDiseno, nombreLinea));
    }

    private boolean estadoPermiteSimular(String estado) {
        return "VALIDADO".equals(estado) || "COMPLETADA".equals(estado) || "COMPLETADO".equals(estado);
    }

    private String estadoLuegoDeValidacion(boolean valido, String estadoActual) {
        if (!valido) return "EN_DISENO";
        if ("COMPLETADO".equals(estadoActual) || "COMPLETADA".equals(estadoActual)) return estadoActual;
        return "VALIDADO";
    }

    private List<UnidadMetroSimulacionResponse> listarUnidades(Integer idDiseno) {
        return repositorio.listarUnidades((resultado, fila) -> new UnidadMetroSimulacionResponse(
                resultado.getInt("id_tren"), resultado.getString("nombre_linea"), resultado.getInt("capacidad"), resultado.getBigDecimal("velocidad_promedio"), (resultado.getBigDecimal("duracion_ut") == null ? null : resultado.getBigDecimal("duracion_ut").doubleValue())
            ), idDiseno);
    }

    private record PreparacionSimulacion(boolean preparado, List<String> observaciones) {}

    private ResultadoSimulacionResponse obtenerResultado(Integer idSimulacion) {
        return repositorio.obtenerResultado((resultado, fila) -> mapearResultado(resultado), idSimulacion);
    }

    private ResultadoSimulacionResponse mapearResultado(ResultSet resultado) throws SQLException {
        var registro = RegistroSimulacionDidactica.leer(resultado.getString("comentarios"));
        var uvUt = criterioUvUt.resultadoDeSimulacion(resultado.getInt("id_simulacion"));
        return new ResultadoSimulacionResponse(
            resultado.getInt("id_simulacion"),
            resultado.getBigDecimal("velocidad"),
            (resultado.getBigDecimal("duracion") == null ? null : resultado.getBigDecimal("duracion").doubleValue()),
            resultado.getString("estado"),
            resultado.getInt("puntaje"),
            PuntuacionService.comentarioVisible(resultado.getString("comentarios")),
            resultado.getTimestamp("fecha_ejecucion").toLocalDateTime(),
            registro != null && registro.esFisica() ? registro.escala()
                : uvUt != null ? "UV_UT_V2" : registro == null ? "HISTORICA" : "UV_H_V1",
            registro == null ? List.of() : registro.unidades(),
            uvUt, registro == null ? null : registro.puntuacion()
        );
    }

    private void verificarEstacion(Integer idDiseno, String nombre) {
        if (!existeEstacion(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la estación solicitada");
        }
    }

    private boolean existeLinea(Integer idDiseno, String nombre) {
        return Boolean.TRUE.equals(repositorio.existeLinea(idDiseno, nombre));
    }

    private void verificarLinea(Integer idDiseno, String nombre) {
        if (!existeLinea(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la línea solicitada");
        }
    }

    private void marcarEnDiseno(Integer idUsuario, Integer idDiseno) {
        vinculoLibre.recalcular(idDiseno);
        repositorio.marcarEnDiseno(idUsuario, idDiseno);
    }

    private List<String> estacionesValidas(List<String> estaciones) {
        List<String> resultado = estaciones == null ? List.of() : estaciones.stream().map(valor -> valor == null ? "" : valor.trim()).toList();
        if (resultado.size() < 2 || new LinkedHashSet<>(resultado).size() != resultado.size() || resultado.stream().anyMatch(String::isBlank)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indicá al menos dos estaciones diferentes para la línea");
        }
        return resultado;
    }

    private String nombreValido(String nombre, String mensaje) {
        if (nombre == null || nombre.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
        }

        return nombre.trim();
    }

    private String modoValido(String modo) {
        if (!"NIVEL".equals(modo) && !"EDICION_LIBRE".equals(modo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí el tipo de actividad");
        }
        return modo;
    }

    private String dificultadValida(String dificultad) {
        if ("Inicial".equals(dificultad) || "Intermedio".equals(dificultad) || "Avanzado".equals(dificultad)) return dificultad;
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí un nivel de dificultad válido");
    }

    private String textoOpcional(String texto, String predeterminado) {
        return texto == null || texto.isBlank() ? predeterminado : texto.trim();
    }

    private String instruccionesPredeterminadas(String modo, String dificultad) {
        if ("NIVEL".equals(modo)) {
            return "Nivel " + dificultad + ": revisá el objetivo, explorá la red y realizá ajustes hasta obtener una red consistente.";
        }
        return "Edición libre: experimentá con estaciones, líneas y transbordos. Podés corregir cada decisión sin afectar el diseño original.";
    }
}
