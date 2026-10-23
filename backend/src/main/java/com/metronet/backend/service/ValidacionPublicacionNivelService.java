package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.EjecutarSimulacionRequest;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.ValidacionPublicacionNivelRepository;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Ensaya exactamente la ruta de evaluación del jugador y revierte todo el ensayo. */
@Service
public class ValidacionPublicacionNivelService {
    private final ValidacionPublicacionNivelRepository repositorio;
    private final ObjectMapper mapper;
    private final JuegoEducativoService juego;
    private final SimulacionService simulaciones;

    public ValidacionPublicacionNivelService(ValidacionPublicacionNivelRepository repositorio, ObjectMapper mapper,
        JuegoEducativoService juego, SimulacionService simulaciones) {
        this.repositorio=repositorio; this.mapper=mapper; this.juego=juego; this.simulaciones=simulaciones;
    }

    public record Diagnostico(boolean viable, List<CondicionConsignaResponse> condiciones,
        String mensaje, String huella) {}

    @Transactional
    public Diagnostico validar(int idEscenario, int idAdmin, JsonNode contenido, JsonNode red, JsonNode tarjetas) {
        List<String> herramientasFaltantes = herramientasFaltantes(contenido.path("herramientasHabilitadas"),red);
        if (!herramientasFaltantes.isEmpty()) return new Diagnostico(false,List.of(),
            "La referencia requiere herramientas deshabilitadas: " + String.join(", ",herramientasFaltantes),
            huella(contenido,red,tarjetas));
        var ensayo = repositorio.prepararEnsayo();
        try {
            ensayo.iniciar();
            int diseno = repositorio.crearDiseno();
            cargarRed(diseno,red);
            int campana = repositorio.campanaActual(idAdmin);
            int intento = repositorio.crearIntento(idAdmin, idEscenario, diseno, campana);
            JsonNode desafio = contenido.path("desafio");
            repositorio.actualizarCatalogoIntento(
                contenido.path("reglasExito").toString(),
                contenido.path("herramientasHabilitadas").toString(),
                desafio.path("objetivo").asText(),
                desafio.path("instrucciones").asText(),
                intento
            );
            for (JsonNode c : red.path("conexionesLineas")) {
                var conexion = simulaciones.crearConexionLineas(idAdmin, diseno,
                    new com.metronet.backend.dto.ConexionLineasRequest(texto(c,"lineaA"), texto(c,"estacionA"), texto(c,"lineaB"), texto(c,"estacionB")));
                if (c.path("metro").isObject()) simulaciones.crearUnidadMetro(idAdmin, diseno,
                    new com.metronet.backend.dto.CrearUnidadMetroSimulacionRequest(null,
                        entero(c.path("metro").path("capacidad"), "capacidad"), decimal(c.path("metro").path("uv"), "UV"), conexion.idConexion()));
            }
            JsonNode criterio = contenido.path("criterioUvUt");
            if (criterio.isObject()) {
                int version = repositorio.siguienteVersionCriterio(idEscenario);
                repositorio.crearCriterioIntento(
                    intento,
                    version,
                    criterio.path("limiteUt").asInt(),
                    criterio.path("presupuestoUv").decimalValue(),
                    contenido.path("reglasExito").toString(),
                    contenido.path("herramientasHabilitadas").toString(),
                    desafio.path("objetivo").asText(),
                    desafio.path("instrucciones").asText()
                );
            }
            JsonNode pasos = red.path("ejecuciones");
            var validacionRed = simulaciones.validarDiseno(idAdmin,diseno);
            if (!validacionRed.valido()) throw invalido(String.join(" ",validacionRed.observaciones()));
            if (pasos.isArray()) for (JsonNode paso : pasos) {
                aplicarPaso(diseno,paso);
                simulaciones.ejecutarSimulacion(idAdmin,diseno,new EjecutarSimulacionRequest(
                    decimal(paso.path("velocidad"),"velocidad visual"),decimal(paso.path("duracion"),"duración").doubleValue()));
            }
            Usuario admin = new Usuario(); admin.setIdUsuario(idAdmin); admin.setRol(Rol.ADMIN);
            var consigna = juego.obtenerConsigna(admin,diseno);
            var resultado = juego.evaluarEscenario(idAdmin,diseno);
            if (contenido.path("reglasExito").has("textosMetas")
                && consigna.condiciones().stream().filter(c -> !c.clave().startsWith("poi:")).count() > 5)
                return new Diagnostico(false, consigna.condiciones(), "La evaluación genera más de cinco metas. Revisá las reglas del nivel.", huella(contenido,red,tarjetas));
            boolean viable = resultado.completado();
            String mensaje = viable ? "La red y la secuencia de referencia satisfacen la consigna"
                : "La referencia no satisface: " + consigna.condiciones().stream()
                    .filter(c -> !c.completado()).map(CondicionConsignaResponse::clave).toList();
            return new Diagnostico(viable,consigna.condiciones(),mensaje,huella(contenido,red,tarjetas));
        } catch (ResponseStatusException error) {
            throw error;
        } catch (DataAccessException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Red o ejecución de referencia inválida",error);
        } catch (Exception error) {
            throw new IllegalStateException("No fue posible validar la referencia sin persistir el ensayo",error);
        } finally {
            ensayo.revertir();
        }
    }

    private List<String> herramientasFaltantes(JsonNode herramientas, JsonNode red) {
        List<String> faltantes = new ArrayList<>();
        if (!red.path("estaciones").isEmpty() && !herramientas.path("estaciones").asBoolean())
            faltantes.add("Estaciones");
        if (!red.path("lineas").isEmpty() && !herramientas.path("lineas").asBoolean())
            faltantes.add("Líneas");
        if (!red.path("conexionesLineas").isMissingNode() && !red.path("conexionesLineas").isEmpty()
            && !herramientas.path("conexiones").asBoolean()) faltantes.add("Conexiones");
        if (!red.path("unidades").isEmpty() && !herramientas.path("metros").asBoolean())
            faltantes.add("Metros");
        if (!red.path("ejecuciones").isEmpty() && !herramientas.path("simulacion").asBoolean())
            faltantes.add("Simulación");
        return faltantes;
    }

    private void cargarRed(int diseno, JsonNode red) {
        for (JsonNode estacion : red.path("estaciones")) repositorio.crearEstacion(
            diseno,
            texto(estacion,"nombre"),
            coordenada(estacion.path("x"),"x"),
            coordenada(estacion.path("y"),"y"),
            estacion.path("transbordo").asBoolean(false)
        );
        for (JsonNode linea : red.path("lineas"))
            repositorio.crearLinea(diseno, texto(linea,"nombre"));
        for (JsonNode tramo : red.path("tramos")) {
            String linea = texto(tramo,"linea"), a=texto(tramo,"a"), b=texto(tramo,"b");
            repositorio.crearTramo(diseno, linea, a, b);
            repositorio.crearConexionOrigen(diseno, linea, a);
            repositorio.crearConexionDestino(diseno, linea, b);
        }
        for (JsonNode unidad : red.path("unidades")) repositorio.crearUnidad(
            diseno,
            texto(unidad,"linea"),
            entero(unidad.path("capacidad"),"capacidad"),
            decimal(unidad.path("uv"),"UV")
        );
    }

    private void aplicarPaso(int diseno, JsonNode paso) {
        JsonNode unidades = paso.path("unidades");
        if (!unidades.isArray()) throw invalido("Cada ejecución debe indicar UV por unidad");
        List<Integer> ids = repositorio.unidades(diseno);
        if (unidades.size() != ids.size()) throw invalido("La ejecución debe incluir todas las unidades");
        String referencia = paso.path("parametroReferencia").asText("UV");
        if (!java.util.Set.of("UV", "UT").contains(referencia)) throw invalido("Referencia UV/UT inválida");
        for (int i=0;i<ids.size();i++) repositorio.actualizarUnidad(
            decimal(unidades.get(i).path("uv"),"UV"),
            "UT".equals(referencia) ? decimal(paso.path("duracion"),"UT") : null,
            referencia,
            ids.get(i)
        );
    }

    private String texto(JsonNode nodo,String campo) {
        String texto = nodo.path(campo).asText("");
        if (texto.isBlank() || texto.length()>100 || texto.contains("<") || texto.contains(">"))
            throw invalido("Campo inválido: " + campo);
        return texto;
    }
    private int entero(JsonNode nodo,String campo) {
        if (!nodo.isIntegralNumber() || nodo.asInt()<1) throw invalido("Valor inválido: " + campo);
        return nodo.asInt();
    }
    private BigDecimal decimal(JsonNode nodo,String campo) {
        if (!nodo.isNumber() || nodo.decimalValue().signum()<=0) throw invalido("Valor inválido: " + campo);
        return nodo.decimalValue();
    }
    private BigDecimal coordenada(JsonNode nodo,String campo) {
        if (!nodo.isNumber()) throw invalido("Coordenada inválida: " + campo);
        return nodo.decimalValue();
    }
    private ResponseStatusException invalido(String mensaje) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,mensaje); }

    public String huella(JsonNode contenido,JsonNode red,JsonNode tarjetas) {
        try {
            byte[] datos=(contenido.toString()+"\n"+red.toString()+"\n"+tarjetas.toString()).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(datos));
        } catch (Exception error) { throw new IllegalStateException("No fue posible calcular la huella",error); }
    }
}
