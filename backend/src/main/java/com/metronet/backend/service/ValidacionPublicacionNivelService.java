package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.EjecutarSimulacionRequest;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.Savepoint;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import javax.sql.DataSource;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Ensaya exactamente la ruta de evaluación del jugador y revierte todo el ensayo. */
@Service
public class ValidacionPublicacionNivelService {
    private final JdbcTemplate jdbc;
    private final DataSource datos;
    private final ObjectMapper mapper;
    private final JuegoEducativoService juego;
    private final SimulacionService simulaciones;

    public ValidacionPublicacionNivelService(JdbcTemplate jdbc, DataSource datos, ObjectMapper mapper,
        JuegoEducativoService juego, SimulacionService simulaciones) {
        this.jdbc=jdbc; this.datos=datos; this.mapper=mapper; this.juego=juego; this.simulaciones=simulaciones;
    }

    public record Diagnostico(boolean viable, List<CondicionConsignaResponse> condiciones,
        String mensaje, String huella) {}

    @Transactional
    public Diagnostico validar(int idEscenario, int idAdmin, JsonNode contenido, JsonNode red, JsonNode tarjetas) {
        List<String> herramientasFaltantes = herramientasFaltantes(contenido.path("herramientasHabilitadas"),red);
        if (!herramientasFaltantes.isEmpty()) return new Diagnostico(false,List.of(),
            "La referencia requiere herramientas deshabilitadas: " + String.join(", ",herramientasFaltantes),
            huella(contenido,red,tarjetas));
        Connection conexion = DataSourceUtils.getConnection(datos);
        Savepoint punto = null;
        try {
            punto = conexion.setSavepoint("referencia_nivel");
            int diseno = jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno",Integer.class);
            cargarRed(diseno,red);
            int campana = jdbc.queryForObject("SELECT numero_campana_actual FROM usuario WHERE id_usuario=?",Integer.class,idAdmin);
            int intento = jdbc.queryForObject("""
                INSERT INTO intento(id_usuario,id_escenario,id_diseno,numero_campana,estado,progreso)
                VALUES (?,?,?,?,'EN_DESARROLLO',0) RETURNING id_intento
                """,Integer.class,idAdmin,idEscenario,diseno,campana);
            JsonNode desafio = contenido.path("desafio");
            jdbc.update("""
                UPDATE intento_catalogo_v1 SET reglas_exito=CAST(? AS jsonb),
                  herramientas_habilitadas=CAST(? AS jsonb),objetivo=?,instrucciones=? WHERE id_intento=?
                """, contenido.path("reglasExito").toString(),contenido.path("herramientasHabilitadas").toString(),
                desafio.path("objetivo").asText(),desafio.path("instrucciones").asText(),intento);
            JsonNode criterio = contenido.path("criterioUvUt");
            if (criterio.isObject()) {
                int version = jdbc.queryForObject("SELECT COALESCE(MAX(version),0)+1 FROM criterio_uv_ut WHERE id_escenario=?",
                    Integer.class,idEscenario);
                jdbc.update("""
                    INSERT INTO intento_uv_ut(id_intento,version,limite_ut,presupuesto_uv,reglas_exito,
                      herramientas_habilitadas,objetivo,instrucciones)
                    VALUES (?,?,?,?,CAST(? AS jsonb),CAST(? AS jsonb),?,?)
                    """,intento,version,criterio.path("limiteUt").asInt(),criterio.path("presupuestoUv").decimalValue(),
                    contenido.path("reglasExito").toString(),contenido.path("herramientasHabilitadas").toString(),
                    desafio.path("objetivo").asText(),desafio.path("instrucciones").asText());
            }
            JsonNode pasos = red.path("ejecuciones");
            var validacionRed = simulaciones.validarDiseno(idAdmin,diseno);
            if (!validacionRed.valido()) throw invalido(String.join(" ",validacionRed.observaciones()));
            if (pasos.isArray()) for (JsonNode paso : pasos) {
                aplicarPaso(diseno,paso);
                simulaciones.ejecutarSimulacion(idAdmin,diseno,new EjecutarSimulacionRequest(
                    decimal(paso.path("velocidad"),"velocidad visual"),entero(paso.path("duracion"),"duración")));
            }
            Usuario admin = new Usuario(); admin.setIdUsuario(idAdmin); admin.setRol(Rol.ADMIN);
            var consigna = juego.obtenerConsigna(admin,diseno);
            var resultado = juego.evaluarEscenario(idAdmin,diseno);
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
            if (punto != null) {
                try { conexion.rollback(punto); conexion.releaseSavepoint(punto); }
                catch (Exception error) { throw new IllegalStateException("No se pudo revertir el ensayo de referencia",error); }
            }
            DataSourceUtils.releaseConnection(conexion,datos);
        }
    }

    private List<String> herramientasFaltantes(JsonNode herramientas, JsonNode red) {
        List<String> faltantes = new ArrayList<>();
        if (!red.path("estaciones").isEmpty() && !herramientas.path("estaciones").asBoolean())
            faltantes.add("Estaciones");
        if (!red.path("lineas").isEmpty() && !herramientas.path("lineas").asBoolean())
            faltantes.add("Líneas");
        Set<String> primeraConexionPorLinea = new HashSet<>();
        boolean extensiones = false;
        for (JsonNode tramo : red.path("tramos"))
            if (!primeraConexionPorLinea.add(tramo.path("linea").asText())) extensiones = true;
        if (extensiones && !herramientas.path("conexiones").asBoolean())
            faltantes.add("Conexiones");
        if (!red.path("unidades").isEmpty() && !herramientas.path("metros").asBoolean())
            faltantes.add("Metros");
        if (!red.path("ejecuciones").isEmpty() && !herramientas.path("simulacion").asBoolean())
            faltantes.add("Simulación");
        return faltantes;
    }

    private void cargarRed(int diseno, JsonNode red) {
        for (JsonNode estacion : red.path("estaciones")) jdbc.update("""
            INSERT INTO estacion(id_diseno,nombre,posicion_x,posicion_y,transbordo)
            VALUES (?,?,?,?,?)
            """,diseno,texto(estacion,"nombre"),coordenada(estacion.path("x"),"x"),
            coordenada(estacion.path("y"),"y"),estacion.path("transbordo").asBoolean(false));
        for (JsonNode linea : red.path("lineas"))
            jdbc.update("INSERT INTO linea(id_diseno,nombre) VALUES (?,?)",diseno,texto(linea,"nombre"));
        for (JsonNode tramo : red.path("tramos")) {
            String linea = texto(tramo,"linea"), a=texto(tramo,"a"), b=texto(tramo,"b");
            jdbc.update("INSERT INTO tramo(id_diseno,nombre_linea,nombre_estacion_a,nombre_estacion_b) VALUES (?,?,?,?)",
                diseno,linea,a,b);
            jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (?,?,?) ON CONFLICT DO NOTHING",
                diseno,linea,a);
            jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (?,?,?) ON CONFLICT DO NOTHING",
                diseno,linea,b);
        }
        for (JsonNode unidad : red.path("unidades")) jdbc.update("""
            INSERT INTO metro(id_diseno,nombre_linea,capacidad,velocidad_promedio) VALUES (?,?,?,?)
            """,diseno,texto(unidad,"linea"),entero(unidad.path("capacidad"),"capacidad"),
            decimal(unidad.path("uv"),"UV"));
    }

    private void aplicarPaso(int diseno, JsonNode paso) {
        JsonNode unidades = paso.path("unidades");
        if (!unidades.isArray()) throw invalido("Cada ejecución debe indicar UV por unidad");
        List<Integer> ids = jdbc.queryForList("SELECT id_tren FROM metro WHERE id_diseno=? ORDER BY id_tren",Integer.class,diseno);
        if (unidades.size() != ids.size()) throw invalido("La ejecución debe incluir todas las unidades");
        for (int i=0;i<ids.size();i++) jdbc.update("UPDATE metro SET velocidad_promedio=? WHERE id_tren=?",
            decimal(unidades.get(i).path("uv"),"UV"),ids.get(i));
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
