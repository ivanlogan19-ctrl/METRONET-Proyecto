package com.metronet.backend.service;

import com.metronet.backend.dto.EjecutarSimulacionRequest;
import com.metronet.backend.dto.ValidacionDisenoResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.DatosDemostrativosRepository;
import com.metronet.backend.repository.UsuarioRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DatosDemostrativosService {
    private static final String CORREO_JUGADOR = "usuario.prueba@metronet.test";
    private static final String CORREO_ADMINISTRADOR = "admin.prueba@metronet.test";
    private static final String IDENTIFICADOR_ADMINISTRADOR = "administrador.prueba";
    private static final String NOMBRE_ESCENARIO = "Red Demo - Usuario Prueba";
    private static final String NOMBRE_LINEA = "Línea Demostrativa";
    private static final String ESTACION_CENTRAL = "Estación Central";
    private static final String ESTACION_PARQUE = "Estación Parque";
    private static final String ESTACION_TERMINAL = "Estación Terminal";
    private static final String NOMBRE_LINEA_NIVEL_UNO = "Línea Inicial Demo";
    private static final String ESTACION_INICIO_NIVEL_UNO = "Estación Inicio";
    private static final String ESTACION_FIN_NIVEL_UNO = "Estación Fin";
    private final UsuarioRepository usuarioRepository;
    private final DatosDemostrativosRepository repositorio;
    private final PasswordEncoder codificadorContrasena;
    private final SimulacionService simulacionService;
    private final JuegoEducativoService juegoEducativoService;

    public DatosDemostrativosService(
        UsuarioRepository usuarioRepository,
        DatosDemostrativosRepository repositorio,
        PasswordEncoder codificadorContrasena,
        SimulacionService simulacionService,
        JuegoEducativoService juegoEducativoService
    ) {
        this.usuarioRepository = usuarioRepository;
        this.repositorio = repositorio;
        this.codificadorContrasena = codificadorContrasena;
        this.simulacionService = simulacionService;
        this.juegoEducativoService = juegoEducativoService;
    }

    @Transactional
    public void crearOActualizarDatosDemostrativos(String contrasenaJugador, String contrasenaAdministrador) {
        validarContrasena(contrasenaJugador, "jugador");
        validarContrasena(contrasenaAdministrador, "administrador");
        Usuario jugador = crearOActualizarJugador(contrasenaJugador);
        crearOActualizarAdministrador(contrasenaAdministrador);
        Integer idEscenario = crearOActualizarEscenario();
        IntentoDemostrativo intento = crearOActualizarIntento(jugador.getIdUsuario(), idEscenario);
        reconstruirRedDemostrativa(intento);
        validarYEjecutarSimulacionDemostrativa(jugador.getIdUsuario(), intento.idDiseno());
        crearOActualizarNivelUnoCompletado(jugador.getIdUsuario());
    }

    private Usuario crearOActualizarJugador(String contrasena) {
        Usuario jugador = usuarioRepository.findByEmailIgnoreCase(CORREO_JUGADOR).orElseGet(Usuario::new);
        jugador.setNombre("Usuario");
        jugador.setApellido("Prueba");
        jugador.setEmail(CORREO_JUGADOR);
        jugador.setPassword(codificadorContrasena.encode(contrasena));
        jugador.setRol(Rol.JUGADOR);
        jugador.setIdentificadorAdministrador(null);
        jugador.setAceptaDatos(true);
        jugador.setFechaConsentimiento(LocalDateTime.now());
        return usuarioRepository.saveAndFlush(jugador);
    }

    private Usuario crearOActualizarAdministrador(String contrasena) {
        Usuario administrador = usuarioRepository.findByEmailIgnoreCase(CORREO_ADMINISTRADOR).orElseGet(Usuario::new);
        usuarioRepository.findByIdentificadorAdministradorIgnoreCase(IDENTIFICADOR_ADMINISTRADOR)
            .filter(candidato -> candidato.getIdUsuario() != null && !candidato.getIdUsuario().equals(administrador.getIdUsuario()))
            .ifPresent(candidato -> {
                throw new IllegalStateException("El identificador de administrador demostrativo ya pertenece a otra cuenta");
            });
        administrador.setNombre("Admin");
        administrador.setApellido("Prueba");
        administrador.setEmail(CORREO_ADMINISTRADOR);
        administrador.setPassword(codificadorContrasena.encode(contrasena));
        administrador.setRol(Rol.ADMIN);
        administrador.setIdentificadorAdministrador(IDENTIFICADOR_ADMINISTRADOR);
        administrador.setAceptaDatos(true);
        administrador.setFechaConsentimiento(LocalDateTime.now());
        return usuarioRepository.saveAndFlush(administrador);
    }

    private Integer crearOActualizarEscenario() {
        List<Integer> escenarios = repositorio.escenarioLibre((resultado, fila) -> resultado.getInt("id_escenario"), NOMBRE_ESCENARIO);
        if (escenarios.isEmpty()) {
            return repositorio.crearEscenarioLibre(
                NOMBRE_ESCENARIO,
                "Explorá una red de metro demostrativa con tres estaciones, una línea y una unidad en circulación.",
                "Revisá la red, sus conexiones y el resultado de la simulación guardada."
            );
        }
        Integer idEscenario = escenarios.getFirst();
        repositorio.actualizarEscenarioLibre(
            "Explorá una red de metro demostrativa con tres estaciones, una línea y una unidad en circulación.",
            "Revisá la red, sus conexiones y el resultado de la simulación guardada.",
            idEscenario
        );
        return idEscenario;
    }

    private IntentoDemostrativo crearOActualizarIntento(Integer idJugador, Integer idEscenario) {
        List<IntentoDemostrativo> intentos = repositorio.intentoLibre((resultado, fila) -> new IntentoDemostrativo(
                resultado.getInt("id_intento"), resultado.getInt("id_diseno")
            ), idJugador, idEscenario);
        if (intentos.isEmpty()) {
            Integer idDiseno = repositorio.crearDisenoLibre();
            Integer idIntento = repositorio.crearIntentoLibre(idJugador, idEscenario, idDiseno);
            return new IntentoDemostrativo(idIntento, idDiseno);
        }
        IntentoDemostrativo intento = intentos.getFirst();
        for (IntentoDemostrativo duplicado : intentos.subList(1, intentos.size())) {
            repositorio.eliminarDisenoLibre(duplicado.idDiseno());
        }
        repositorio.reiniciarIntentoLibre(intento.idIntento());
        return intento;
    }

    private void reconstruirRedDemostrativa(IntentoDemostrativo intento) {
        repositorio.eliminarSimulacionesLibres(intento.idIntento());
        repositorio.eliminarMetrosLibres(intento.idDiseno());
        repositorio.eliminarTramosLibres(intento.idDiseno());
        repositorio.eliminarConexionesLibres(intento.idDiseno());
        repositorio.eliminarLineasLibres(intento.idDiseno());
        repositorio.eliminarEstacionesLibres(intento.idDiseno());
        insertarEstaciones(intento.idDiseno());
        repositorio.crearLineaLibre(intento.idDiseno(), NOMBRE_LINEA);
        insertarConexiones(intento.idDiseno());
        insertarTramos(intento.idDiseno());
        repositorio.crearMetroLibre(intento.idDiseno(), NOMBRE_LINEA);
    }

    private void validarYEjecutarSimulacionDemostrativa(Integer idJugador, Integer idDiseno) {
        ValidacionDisenoResponse validacion = simulacionService.validarDiseno(idJugador, idDiseno);
        if (!validacion.valido() || !validacion.preparadoParaSimular()) {
            throw new IllegalStateException("La red demostrativa no superó las validaciones de simulación");
        }
        simulacionService.ejecutarSimulacion(
            idJugador,
            idDiseno,
            new EjecutarSimulacionRequest(new BigDecimal("1.00"), 120)
        );
    }

    private void crearOActualizarNivelUnoCompletado(Integer idJugador) {
        Integer idEscenarioNivelUno = repositorio.escenarioNivelUno((resultado, fila) -> resultado.getInt("id_escenario")).stream().findFirst()
            .orElseThrow(() -> new IllegalStateException("No existe el Nivel 1 del catálogo educativo"));
        IntentoDemostrativo intento = crearOActualizarIntentoNivelUno(idJugador, idEscenarioNivelUno);
        reconstruirRedNivelUno(idJugador, intento);
    }

    private IntentoDemostrativo crearOActualizarIntentoNivelUno(Integer idJugador, Integer idEscenario) {
        List<IntentoDemostrativo> intentos = repositorio.intentoNivelUno((resultado, fila) -> new IntentoDemostrativo(
                resultado.getInt("id_intento"), resultado.getInt("id_diseno")
            ), idJugador, idEscenario);
        if (intentos.isEmpty()) {
            Integer idDiseno = repositorio.crearDisenoNivelUno();
            Integer idIntento = repositorio.crearIntentoNivelUno(idJugador, idEscenario, idDiseno);
            return new IntentoDemostrativo(idIntento, idDiseno);
        }
        IntentoDemostrativo intento = intentos.getFirst();
        for (IntentoDemostrativo duplicado : intentos.subList(1, intentos.size())) {
            repositorio.eliminarDisenoNivelUno(duplicado.idDiseno());
        }
        repositorio.reiniciarIntentoNivelUno(intento.idIntento());
        return intento;
    }

    private void reconstruirRedNivelUno(Integer idJugador, IntentoDemostrativo intento) {
        repositorio.eliminarSimulacionesNivelUno(intento.idIntento());
        repositorio.eliminarMetrosNivelUno(intento.idDiseno());
        repositorio.eliminarTramosNivelUno(intento.idDiseno());
        repositorio.eliminarConexionesNivelUno(intento.idDiseno());
        repositorio.eliminarLineasNivelUno(intento.idDiseno());
        repositorio.eliminarEstacionesNivelUno(intento.idDiseno());
        insertarEstacion(
            intento.idDiseno(), ESTACION_INICIO_NIVEL_UNO, new BigDecimal("420"), new BigDecimal("300"), false
        );
        insertarEstacion(
            intento.idDiseno(), ESTACION_FIN_NIVEL_UNO, new BigDecimal("560"), new BigDecimal("300"), false
        );
        repositorio.crearLineaNivelUno(intento.idDiseno(), NOMBRE_LINEA_NIVEL_UNO);
        repositorio.crearConexionOrigen(intento.idDiseno(), NOMBRE_LINEA_NIVEL_UNO, ESTACION_INICIO_NIVEL_UNO);
        repositorio.crearConexionDestino(intento.idDiseno(), NOMBRE_LINEA_NIVEL_UNO, ESTACION_FIN_NIVEL_UNO);
        repositorio.crearTramoNivelUno(intento.idDiseno(), NOMBRE_LINEA_NIVEL_UNO, ESTACION_INICIO_NIVEL_UNO, ESTACION_FIN_NIVEL_UNO);
        ValidacionDisenoResponse validacion = simulacionService.validarDiseno(
            idJugador,
            intento.idDiseno()
        );
        if (!validacion.valido()) {
            throw new IllegalStateException("La red demostrativa del Nivel 1 no superó las validaciones");
        }
        juegoEducativoService.evaluarEscenario(idJugador, intento.idDiseno());
    }

    private void insertarEstaciones(Integer idDiseno) {
        insertarEstacion(idDiseno, ESTACION_CENTRAL, new BigDecimal("470"), new BigDecimal("340"), true);
        insertarEstacion(idDiseno, ESTACION_PARQUE, new BigDecimal("590"), new BigDecimal("340"), false);
        insertarEstacion(idDiseno, ESTACION_TERMINAL, new BigDecimal("710"), new BigDecimal("340"), false);
    }

    private void insertarEstacion(Integer idDiseno, String nombre, BigDecimal posicionX, BigDecimal posicionY, boolean transbordo) {
        repositorio.insertarEstacion(idDiseno, nombre, posicionX, posicionY, transbordo);
    }

    private void insertarConexiones(Integer idDiseno) {
        insertarConexion(idDiseno, ESTACION_CENTRAL);
        insertarConexion(idDiseno, ESTACION_PARQUE);
        insertarConexion(idDiseno, ESTACION_TERMINAL);
    }

    private void insertarConexion(Integer idDiseno, String nombreEstacion) {
        repositorio.insertarConexion(idDiseno, NOMBRE_LINEA, nombreEstacion);
    }

    private void insertarTramos(Integer idDiseno) {
        insertarTramo(idDiseno, ESTACION_CENTRAL, ESTACION_PARQUE);
        insertarTramo(idDiseno, ESTACION_PARQUE, ESTACION_TERMINAL);
    }

    private void insertarTramo(Integer idDiseno, String estacionA, String estacionB) {
        repositorio.insertarTramo(idDiseno, NOMBRE_LINEA, estacionA, estacionB);
    }

    private void validarContrasena(String contrasena, String tipoCuenta) {
        boolean esValida = contrasena != null
            && contrasena.length() >= 6
            && contrasena.matches(".*[A-Z].*")
            && contrasena.matches(".*[^A-Za-z0-9].*");
        if (!esValida) {
            throw new IllegalStateException(
                "La contraseña de datos demostrativos para " + tipoCuenta
                    + " debe tener al menos 6 caracteres, una mayúscula y un carácter especial"
            );
        }
    }

    private record IntentoDemostrativo(Integer idIntento, Integer idDiseno) {
    }
}
