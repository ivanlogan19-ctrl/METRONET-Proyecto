package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.metronet.backend.dto.EdicionNivelRequest;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Borradores privados y versiones de los diez niveles; publicar exige validar la red. */
@Service
public class AdministracionNivelesService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final List<JsonNode> catalogo;
    private final Set<String> imagenes;
    private final Set<String> clavesRegla;
    private final Set<String> clavesHerramienta;

    public AdministracionNivelesService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        try (var entrada = new ClassPathResource("educacion/catalogo-svgs-niveles.json").getInputStream();
             var reglas = new ClassPathResource("educacion/niveles.json").getInputStream()) {
            JsonNode banco = mapper.readTree(entrada);
            JsonNode niveles = mapper.readTree(reglas);
            catalogo = StreamSupport.stream(banco.spliterator(), false).toList();
            imagenes = StreamSupport.stream(banco.spliterator(), false)
                .flatMap(n -> StreamSupport.stream(n.path("tarjetas").spliterator(), false))
                .map(t -> t.path("imagen").asText()).collect(Collectors.toUnmodifiableSet());
            Set<String> reglasConocidas = new HashSet<>();
            Set<String> herramientasConocidas = new HashSet<>();
            niveles.forEach(n -> {
                n.path("reglasExito").fieldNames().forEachRemaining(reglasConocidas::add);
                n.path("herramientasHabilitadas").fieldNames().forEachRemaining(herramientasConocidas::add);
            });
            reglasConocidas.add("requiereMetroPorLinea");
            clavesRegla = Set.copyOf(reglasConocidas);
            clavesHerramienta = Set.copyOf(herramientasConocidas);
        } catch (Exception error) {
            throw new IllegalStateException("No se pudo cargar el catálogo empaquetado de niveles", error);
        }
    }

    public record Resumen(int numero, String nombre, int versionPublicada, int revisionBorrador) {}
    public record Borrador(int numero, int versionBase, int revision, JsonNode contenido,
                           JsonNode redReferencia, JsonNode tarjetas) {}
    public record Version(int numero, int version, Integer versionCriterioUvUt, JsonNode contenido,
                          JsonNode redReferencia, JsonNode tarjetas, String huella, String publicadoEn) {}

    public List<Resumen> listar() {
        return jdbc.query("""
            SELECT e.numero,e.nombre,p.numero_version,b.revision FROM escenario e
            JOIN LATERAL (SELECT numero_version FROM nivel_publicacion WHERE id_escenario=e.id_escenario
              ORDER BY numero_version DESC LIMIT 1) p ON TRUE
            JOIN nivel_borrador b ON b.id_escenario=e.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10 ORDER BY e.numero
            """, (r, fila) -> new Resumen(r.getInt(1),r.getString(2),r.getInt(3),r.getInt(4)));
    }

    public Borrador borrador(int numero) {
        return jdbc.query("""
            SELECT b.version_base,b.revision,b.contenido::text,b.red_referencia::text,b.tarjetas::text
            FROM nivel_borrador b JOIN escenario e ON e.id_escenario=b.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?
            """, (r, fila) -> new Borrador(numero,r.getInt(1),r.getInt(2),json(r.getString(3)),
                json(r.getString(4)),json(r.getString(5))), numero).stream().findFirst().orElseThrow(() -> noExiste());
    }

    public void validarBorrador(Borrador borrador) {
        JsonNode contenido = borrador.contenido();
        validar(borrador.numero(),new EdicionNivelRequest(borrador.versionBase(),borrador.revision(),
            contenido.path("desafio"),contenido.path("reglasExito"),contenido.path("herramientasHabilitadas"),
            contenido.path("criterioUvUt"),borrador.redReferencia(),contenido.path("ayudas"),borrador.tarjetas()));
    }

    @Transactional
    public Borrador guardar(int numero, EdicionNivelRequest edicion, Integer idAdmin) {
        int id = idEscenario(numero, true);
        Borrador previo = borrador(numero);
        int vigente = versionVigente(id);
        if (edicion == null || edicion.versionBase() == null || edicion.revisionEsperada() == null
            || edicion.versionBase() != vigente || edicion.revisionEsperada() != previo.revision())
            throw conflicto("El borrador o la publicación cambió. Recargá antes de guardar");
        validar(numero, edicion);
        if (!Objects.equals(edicion.reglasExito().path("puntuacion"),
                previo.contenido().path("reglasExito").path("puntuacion"))
            && !PoliticaPuntuacion.configuracionNivel(numero).equals(edicion.reglasExito().path("puntuacion")))
            throw invalido("Solo se permite conservar la puntuación histórica o adoptar la política aprobada para este nivel");
        ObjectNode contenido = mapper.createObjectNode();
        contenido.set("desafio", edicion.desafio());
        contenido.set("reglasExito", edicion.reglasExito());
        contenido.set("herramientasHabilitadas", edicion.herramientasHabilitadas());
        contenido.set("criterioUvUt", edicion.criterioUvUt());
        contenido.set("ayudas", edicion.ayudas());
        int filas = jdbc.update("""
            UPDATE nivel_borrador SET contenido=CAST(? AS jsonb),red_referencia=CAST(? AS jsonb),
              tarjetas=CAST(? AS jsonb),revision=revision+1,autor_id=?,actualizado_en=clock_timestamp()
            WHERE id_escenario=? AND revision=? AND version_base=?
            """, contenido.toString(), edicion.redReferencia().toString(), edicion.tarjetas().toString(),
            idAdmin, id, previo.revision(), vigente);
        if (filas != 1) throw conflicto("El borrador cambió mientras lo editabas");
        return borrador(numero);
    }

    public List<Version> versiones(int numero) {
        idEscenario(numero, false);
        return jdbc.query("""
            SELECT p.numero_version,p.version_criterio_uv_ut,p.contenido::text,p.red_referencia::text,
              p.huella,p.publicado_en::text,p.id_nivel_publicacion
            FROM nivel_publicacion p JOIN escenario e ON e.id_escenario=p.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=? ORDER BY p.numero_version DESC
            """, (r, fila) -> new Version(numero,r.getInt(1),r.getObject(2,Integer.class),json(r.getString(3)),
                json(r.getString(4)),tarjetas(r.getLong(7)),r.getString(5),r.getString(6)), numero);
    }

    @Transactional
    public Borrador prepararReversion(int numero, int version, Integer idAdmin) {
        int id = idEscenario(numero, true);
        Version origen = versiones(numero).stream().filter(v -> v.version() == version).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"No existe esa versión del nivel"));
        Borrador previo = borrador(numero);
        int vigente = versionVigente(id);
        JsonNode redReferencia = origen.redReferencia();
        if (!referenciaConstruida(redReferencia)) redReferencia = versiones(numero).stream()
            .filter(v -> v.version() != version && referenciaConstruida(v.redReferencia()))
            .map(Version::redReferencia).findFirst()
            .orElseThrow(() -> conflicto("Esta versión no conserva una red de referencia con estaciones, líneas y conexiones; publicá una referencia antes de preparar la reversión"));
        int filas = jdbc.update("""
            UPDATE nivel_borrador SET version_base=?,revision=revision+1,contenido=CAST(? AS jsonb),
              red_referencia=CAST(? AS jsonb),tarjetas=CAST(? AS jsonb),autor_id=?,actualizado_en=clock_timestamp()
            WHERE id_escenario=? AND revision=?
            """, vigente,origen.contenido().toString(),redReferencia.toString(),
            tarjetasParaNuevoBorrador(numero, origen.tarjetas()).toString(),idAdmin,id,previo.revision());
        if (filas != 1) throw conflicto("El borrador cambió mientras preparabas la reversión");
        return borrador(numero);
    }

    /** Una reversión de v1 conserva sus seis textos históricos y añade solo la tarjeta nueva. */
    private JsonNode tarjetasParaNuevoBorrador(int numero, JsonNode historicas) {
        if (historicas.size() != 6) return historicas;
        ArrayNode tarjetas = historicas.deepCopy();
        JsonNode septima = catalogo.get(numero - 1).path("tarjetas").get(6);
        ObjectNode nueva = mapper.createObjectNode();
        nueva.put("id", septima.path("id").asText());
        for (String campo : List.of("titulo", "texto", "aprendizaje", "fuente", "descripcionImagen"))
            nueva.put(campo, septima.path(campo).asText());
        nueva.put("urlFuente", septima.path("url").asText());
        nueva.put("idSvgCatalogo", septima.path("imagen").asText());
        tarjetas.add(nueva);
        return tarjetas;
    }

    private boolean referenciaConstruida(JsonNode red) {
        return red.path("estaciones").size() >= 2 && !red.path("lineas").isEmpty()
            && !red.path("tramos").isEmpty();
    }

    private JsonNode tarjetas(long idPublicacion) {
        var resultado = mapper.createArrayNode();
        jdbc.query("""
            SELECT id_tarjeta,titulo,texto,aprendizaje,fuente,url_fuente,descripcion_imagen,id_svg_catalogo
            FROM nivel_publicacion_tarjeta WHERE id_nivel_publicacion=? ORDER BY posicion
            """, r -> {
                ObjectNode tarjeta = mapper.createObjectNode();
                for (String[] campo : new String[][] {{"id","id_tarjeta"},{"titulo","titulo"},{"texto","texto"},
                    {"aprendizaje","aprendizaje"},{"fuente","fuente"},{"urlFuente","url_fuente"},
                    {"descripcionImagen","descripcion_imagen"},{"idSvgCatalogo","id_svg_catalogo"}})
                    tarjeta.put(campo[0],r.getString(campo[1]));
                resultado.add(tarjeta);
            }, idPublicacion);
        return resultado;
    }

    private int idEscenario(int numero, boolean bloquear) {
        if (numero < 1 || numero > 10) throw noExiste();
        String sql = "SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=?"
            + (bloquear ? " FOR UPDATE" : "");
        return jdbc.query(sql,(r,fila) -> r.getInt(1),numero).stream().findFirst().orElseThrow(() -> noExiste());
    }

    private int versionVigente(int idEscenario) {
        return jdbc.queryForObject("SELECT MAX(numero_version) FROM nivel_publicacion WHERE id_escenario=?",
            Integer.class,idEscenario);
    }

    private void validar(int numero, EdicionNivelRequest edicion) {
        JsonNode desafio = edicion.desafio();
        if (desafio == null || !desafio.isObject()) throw invalido("Falta el desafío");
        for (String campo : List.of("nombre","relato","objetivo","instrucciones","dificultad"))
            texto(desafio.path(campo),campo, campo.equals("nombre") ? 100 : campo.equals("dificultad") ? 20 : 4000);
        if (edicion.reglasExito() == null || edicion.herramientasHabilitadas() == null
            || !edicion.reglasExito().isObject() || !edicion.herramientasHabilitadas().isObject())
            throw invalido("Reglas y herramientas deben ser objetos");
        edicion.reglasExito().fieldNames().forEachRemaining(clave -> {
            if (!clavesRegla.contains(clave)) throw invalido("Regla no soportada por el motor: " + clave);
            JsonNode valor=edicion.reglasExito().path(clave);
            if (clave.startsWith("minimo") || clave.equals("maximoEstaciones")) {
                if (!valor.isIntegralNumber() || valor.asInt()<=0) throw invalido("La regla " + clave + " requiere un entero positivo");
            } else if (clave.startsWith("requiere") || clave.equals("transbordosPorConexion")) {
                if (!valor.isBoolean()) throw invalido("La regla " + clave + " debe estar activada o desactivada");
            } else if (clave.equals("aprendizajeSimulacion")) {
                if (!valor.isObject()) throw invalido("Prácticas de simulación inválidas");
                valor.fields().forEachRemaining(par -> {
                    if (!Set.of("velocidad","duracion","individual","global","combinacion").contains(par.getKey())
                        || !par.getValue().isBoolean()) throw invalido("Práctica de simulación no soportada: " + par.getKey());
                });
            } else if (clave.equals("puntuacion")) {
                if (valor.has("version")) {
                    if (!PoliticaPuntuacion.configuracionNivel(numero).equals(valor))
                        throw invalido("La puntuación debe coincidir con la política aprobada y sus prácticas por nivel");
                    return;
                }
                if (!valor.isObject() || valor.size()!=6) throw invalido("Configuración de puntuación incompleta");
                for (String campo : List.of("maximo","pesoResolucion","pesoEficiencia","pesoVelocidad","estacionesReferencia","tramosReferencia"))
                    if (!valor.path(campo).isNumber() || valor.path(campo).decimalValue().signum()<0)
                        throw invalido("Puntuación inválida: " + campo);
            } else if (clave.equals("puntosInteresObjetivo")) {
                if (!valor.isArray() || valor.isEmpty()) throw invalido("Seleccioná lugares objetivo");
                for (JsonNode punto : valor) if (!punto.path("idPunto").isIntegralNumber()
                    || punto.path("idPunto").asInt()<1 || !punto.path("radioCobertura").isNumber()
                    || punto.path("radioCobertura").decimalValue().signum()<=0)
                    throw invalido("Lugar objetivo o radio inválido");
            } else if (clave.equals("areasObjetivo")) {
                if (!valor.isArray() || valor.isEmpty()) throw invalido("Seleccioná barrios o zonas objetivo");
                for (JsonNode area : valor) if (!Set.of("barrio","zona").contains(area.path("tipo").asText())
                    || !area.path("nombre").isTextual() || area.path("nombre").asText().isBlank()
                    || !area.path("minimoEstaciones").isIntegralNumber() || area.path("minimoEstaciones").asInt()<1)
                    throw invalido("Área objetivo inválida");
            }
        });
        if (edicion.reglasExito().has("maximoEstaciones") && edicion.reglasExito().has("minimoEstaciones")
            && edicion.reglasExito().path("maximoEstaciones").asInt()<edicion.reglasExito().path("minimoEstaciones").asInt())
            throw invalido("El máximo de estaciones debe permitir cumplir el mínimo");
        if (edicion.reglasExito().path("transbordosPorConexion").asBoolean(false)
            && (!edicion.reglasExito().has("minimoTransbordos")
                || !edicion.herramientasHabilitadas().path("lineas").asBoolean(false)
                || !edicion.herramientasHabilitadas().path("conexiones").asBoolean(false)))
            throw invalido("Transbordos por conexión requiere un mínimo, líneas y conexiones habilitadas");
        edicion.herramientasHabilitadas().fieldNames().forEachRemaining(clave -> {
            if (!clavesHerramienta.contains(clave) || !edicion.herramientasHabilitadas().path(clave).isBoolean())
                throw invalido("Herramienta no soportada: " + clave);
        });
        JsonNode criterio = edicion.criterioUvUt();
        if (numero <= 3 && criterio != null && !criterio.isNull()) throw invalido("UV/UT solo aplica a niveles 4–10");
        if (criterio != null && !criterio.isNull() && (!criterio.isObject()
            || !criterio.path("limiteUt").isIntegralNumber() || criterio.path("limiteUt").asInt() < 1
            || !criterio.path("presupuestoUv").isNumber() || criterio.path("presupuestoUv").decimalValue().signum() <= 0))
            throw invalido("UV/UT requiere límite y presupuesto positivos");
        JsonNode red = edicion.redReferencia();
        if (red == null || !red.isObject()) throw invalido("Falta la red de referencia privada");
        for (String tipo : List.of("estaciones","lineas","tramos","unidades"))
            if (!red.path(tipo).isArray()) throw invalido("La red requiere " + tipo + " como lista");
        if (red.has("ejecuciones") && !red.path("ejecuciones").isArray())
            throw invalido("Las ejecuciones de referencia deben ser una lista");
        if (edicion.ayudas() == null || !edicion.ayudas().isArray()) throw invalido("Ayudas inválidas");
        Set<String> ayudasVistas=new HashSet<>();
        for (JsonNode ayuda:edicion.ayudas()) {
            if (!ayuda.isObject()) throw invalido("Ayuda inválida");
            String clave=texto(ayuda.path("claveCondicion"),"clave de ayuda",100);
            if (!clavesRegla.contains(clave) && !clave.matches("areaObjetivo:[0-9]+|aprendizajeSimulacion:(velocidad|duracion|individual|global|combinacion)|criterioUvUt|simulacionActual|listo|completado"))
                throw invalido("Condición de ayuda no soportada: " + clave);
            if (!ayudasVistas.add(clave)) throw invalido("Ayuda repetida para " + clave);
            texto(ayuda.path("texto"),"texto de ayuda",4000);
            if (ayuda.hasNonNull("pista") && !ayuda.path("pista").asText().isBlank())
                texto(ayuda.path("pista"),"pista de ayuda",4000);
        }
        if (edicion.tarjetas() == null || !edicion.tarjetas().isArray() || edicion.tarjetas().size() != 7)
            throw invalido("Cada nivel necesita exactamente siete tarjetas");
        Set<String> ids = new HashSet<>();
        for (int i=0; i<7; i++) {
            JsonNode tarjeta = edicion.tarjetas().get(i);
            if (tarjeta == null || !tarjeta.isObject()) throw invalido("Tarjeta inválida en posición " + (i+1));
            String id = texto(tarjeta.path("id"),"ID de tarjeta",100);
            if (!id.equals(catalogo.get(numero-1).path("tarjetas").get(i).path("id").asText()) || !ids.add(id))
                throw invalido("La tarjeta " + (i+1) + " debe conservar su ID");
            for (String campo : List.of("titulo","texto","aprendizaje","fuente","descripcionImagen"))
                texto(tarjeta.path(campo),campo,4000);
            String url = texto(tarjeta.path("urlFuente"),"URL de fuente",1000);
            try {
                URI fuente = new URI(url);
                if (!url.matches("(?i)^https?://.*") || !Set.of("http","https").contains(fuente.getScheme().toLowerCase())
                    || fuente.getHost() == null || fuente.getHost().isBlank() || fuente.getRawUserInfo() != null
                    || fuente.getPort() > 65535)
                    throw invalido("La fuente debe tener una URL HTTP(S) con host válido");
            }
            catch (java.net.URISyntaxException error) { throw invalido("URL de fuente inválida"); }
            if (!imagenes.contains(texto(tarjeta.path("idSvgCatalogo"),"SVG",200)))
                throw invalido("Imagen fuera del catálogo SVG local");
        }
    }

    private String texto(JsonNode valor, String campo, int maximo) {
        if (!valor.isTextual() || valor.asText().isBlank() || valor.asText().length() > maximo
            || valor.asText().contains("<") || valor.asText().contains(">"))
            throw invalido("Texto inválido en " + campo);
        return valor.asText();
    }

    private JsonNode json(String texto) {
        try { return mapper.readTree(texto); }
        catch (Exception error) { throw new IllegalStateException("Contenido de nivel ilegible",error); }
    }
    private ResponseStatusException invalido(String mensaje) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,mensaje); }
    private ResponseStatusException conflicto(String mensaje) { return new ResponseStatusException(HttpStatus.CONFLICT,mensaje); }
    private ResponseStatusException noExiste() { return new ResponseStatusException(HttpStatus.NOT_FOUND,"No existe el nivel solicitado"); }
}
