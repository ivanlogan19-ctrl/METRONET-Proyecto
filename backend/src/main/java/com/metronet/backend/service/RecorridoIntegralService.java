package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metronet.backend.dto.EdicionNivelRequest;
import com.metronet.backend.dto.PublicarNivelRequest;
import com.metronet.backend.repository.RecorridoIntegralRepository;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Publicación explícita del recorrido aprobado, usando la validación y el historial existentes. */
@Service
public class RecorridoIntegralService {
    public static final String VERSION = "integral-2026-10-red-progresiva-v5";
    private final AdministracionNivelesService borradores;
    private final PublicacionNivelService publicador;
    private final ObjectMapper mapper;
    private final GeografiaService geografia;
    private final RecorridoIntegralRepository repositorio;

    public RecorridoIntegralService(AdministracionNivelesService borradores, PublicacionNivelService publicador,
        ObjectMapper mapper, GeografiaService geografia, RecorridoIntegralRepository repositorio) {
        this.borradores=borradores; this.publicador=publicador; this.mapper=mapper; this.geografia=geografia; this.repositorio=repositorio;
    }

    @Transactional
    public List<PublicacionNivelService.Publicada> publicar(int idAdmin) throws Exception {
        validarAdministrador(idAdmin);
        JsonNode catalogo = leerCatalogo();
        List<PublicacionNivelService.Publicada> resultado=new ArrayList<>();
        for (JsonNode nivel:catalogo) {
            int numero=nivel.path("numero").asInt();
            var previo=borradores.borrador(numero);
            var vigente=borradores.versiones(numero).getFirst();
            boolean recorridoVigente = VERSION.equals(vigente.contenido().path("desafio").path("recorrido").asText());
            var politica = PoliticaPuntuacion.configuracionNivel(numero);
            if (recorridoVigente && politica.equals(vigente.contenido().path("reglasExito").path("puntuacion"))) continue;
            if (recorridoVigente) {
                // Adopta únicamente la puntuación; conserva la edición publicada y sus referencias.
                // No descarta un borrador ajeno pendiente.
                if (!previo.contenido().equals(vigente.contenido()) || !previo.redReferencia().equals(vigente.redReferencia())
                    || !previo.tarjetas().equals(vigente.tarjetas()))
                    throw new IllegalStateException("Nivel " + numero + ": hay un borrador pendiente; revisalo antes de adoptar la puntuación");
                ObjectNode reglas = vigente.contenido().path("reglasExito").deepCopy();
                reglas.set("puntuacion", politica);
                var c = vigente.contenido();
                var guardado = borradores.guardar(numero, new EdicionNivelRequest(previo.versionBase(), previo.revision(),
                    c.path("desafio"), reglas, c.path("herramientasHabilitadas"), c.path("criterioUvUt"),
                    vigente.redReferencia(), c.path("ayudas"), vigente.tarjetas()), idAdmin);
                resultado.add(publicarValidado(numero, guardado, idAdmin));
                continue;
            }
            ObjectNode desafio=mapper.createObjectNode();
            for (String clave:List.of("nombre","objetivo","instrucciones","dificultad","preparacion","transicion"))
                desafio.set(clave,nivel.path(clave));
            desafio.put("relato",nivel.path("historia").path("texto").asText());
            desafio.put("recorrido",VERSION);
            var ayudas=mapper.createArrayNode();
            ayudas.addObject().put("claveCondicion","simulacionActual").put("texto",nivel.path("preparacion").path("consejo").asText());
            ObjectNode reglas=nivel.path("reglasExito").deepCopy();
            reglas.set("puntuacion", politica);
            var guardado=borradores.guardar(numero,new EdicionNivelRequest(previo.versionBase(),previo.revision(),
                desafio,reglas,nivel.path("herramientasHabilitadas"),mapper.nullNode(),
                referencia(nivel),ayudas,tarjetasActualizadas(previo.tarjetas(), nivel)),idAdmin);
            resultado.add(publicarValidado(numero, guardado, idAdmin));
        }
        return resultado;
    }

    /** Actualización editorial explícita: publica relatos sin cambiar reglas ni partidas anteriores. */
    @Transactional
    public List<PublicacionNivelService.Publicada> publicarRelatos(int idAdmin) throws Exception {
        validarAdministrador(idAdmin);
        List<PublicacionNivelService.Publicada> resultado = new ArrayList<>();
        for (JsonNode nivel : leerCatalogo()) {
            int numero = nivel.path("numero").asInt();
            var vigente = borradores.versiones(numero).getFirst();
            var c = vigente.contenido();
            if (!VERSION.equals(c.path("desafio").path("recorrido").asText()))
                throw new IllegalStateException("Nivel " + numero + ": el relato requiere el recorrido vigente");
            ObjectNode desafio = c.path("desafio").deepCopy();
            String relato = nivel.path("historia").path("texto").asText();
            desafio.put("relato", relato);
            desafio.withObject("preparacion").put("contexto", relato);
            desafio.withObject("transicion").put("ciudad", relato);
            if (desafio.equals(c.path("desafio"))) continue;
            var previo = borradores.borrador(numero);
            if (!previo.contenido().equals(c) || !previo.redReferencia().equals(vigente.redReferencia())
                || !previo.tarjetas().equals(vigente.tarjetas()))
                throw new IllegalStateException("Nivel " + numero + ": hay un borrador pendiente; se conserva sin publicar");
            var guardado = borradores.guardar(numero, new EdicionNivelRequest(previo.versionBase(), previo.revision(),
                desafio, c.path("reglasExito"), c.path("herramientasHabilitadas"), c.path("criterioUvUt"),
                vigente.redReferencia(), c.path("ayudas"), vigente.tarjetas()), idAdmin);
            resultado.add(publicarValidado(numero, guardado, idAdmin));
        }
        return resultado;
    }

    private void validarAdministrador(int idAdmin) {
        if (!Boolean.TRUE.equals(repositorio.esAdministrador(idAdmin)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"La publicación requiere un administrador existente");
    }

    private JsonNode leerCatalogo() throws Exception {
        JsonNode catalogo;
        try (var entrada=new ClassPathResource("educacion/recorrido-integral.json").getInputStream()) {
            catalogo=mapper.readTree(entrada);
        }
        validarCatalogo(catalogo);
        return catalogo;
    }

    private JsonNode tarjetasActualizadas(JsonNode anteriores, JsonNode nivel) {
        JsonNode tarjetas = anteriores.deepCopy();
        ((ObjectNode) tarjetas.get(tarjetas.size()-1)).put("aprendizaje", nivel.path("transicion").path("aprendizaje").asText());
        return tarjetas;
    }

    private PublicacionNivelService.Publicada publicarValidado(int numero, AdministracionNivelesService.Borrador guardado, int idAdmin) {
        var vista = publicador.previsualizar(numero, idAdmin);
        if (!vista.diagnostico().viable()) throw new IllegalStateException("Nivel " + numero + ": " + vista.diagnostico().mensaje());
        return publicador.publicar(numero, new PublicarNivelRequest(guardado.versionBase(), guardado.revision(),
            vista.diagnostico().huella(), true), idAdmin);
    }

    // Referencia privada para el ensayo de publicación. Nunca se entrega al jugador ni inicia su diseño.
    private JsonNode referencia(JsonNode nivel) {
        int numero = nivel.path("numero").asInt();
        JsonNode reglas = nivel.path("reglasExito");
        ObjectNode red = mapper.createObjectNode();
        var estaciones = red.putArray("estaciones");
        var lineas = red.putArray("lineas");
        var tramos = red.putArray("tramos");
        var cantidades = reglas.path("configuracionRecorrido").path("estacionesPorLinea");
        var puntos = reglas.path("puntosInteresObjetivo");
        double centroX = numero < 4 ? 650 : 610, centroY = numero < 4 ? 465 : 380;
        estaciones.addObject().put("nombre", "Centro").put("x", centroX).put("y", centroY);
        for (int linea = 0; linea < cantidades.size(); linea++) {
            String nombre = "Línea " + (linea + 1);
            lineas.addObject().put("nombre", nombre);
            double x = numero < 4 ? 620 + linea * 50 : 650 + linea * 45;
            double y = numero < 4 ? 465 + linea * 30 : 465 - linea * 45;
            if (linea < puntos.size()) {
                var punto = geografia.resolverPunto(puntos.get(linea).path("idPunto").asInt(), null);
                x = geografia.posicionX(punto).doubleValue(); y = geografia.posicionY(punto).doubleValue();
                // Los hitos costeros se cubren desde tierra, sin colocar estaciones sobre la costa.
                double distancia = Math.hypot(centroX - x, centroY - y);
                x += (centroX - x) * 12 / distancia; y += (centroY - y) * 12 / distancia;
            }
            String anterior = "Centro";
            double origenX = centroX, origenY = centroY;
            if (numero == 3 && linea == 1) {
                anterior = "Centro2"; origenX = 700; origenY = 495;
                estaciones.addObject().put("nombre", anterior).put("x", origenX).put("y", origenY);
            }
            int cantidad = cantidades.get(linea).asInt();
            for (int indice = 1; indice < cantidad; indice++) {
                String estacion = "E" + linea + "_" + indice;
                double fraccion = (double) indice / (cantidad - 1);
                double estacionX = origenX + (x - origenX) * fraccion;
                double estacionY = origenY + (y - origenY) * fraccion;
                // La llegada a Ciudad Vieja bordea el puerto por tierra.
                if (numero == 10 && linea == 0 && indice == 2) { estacionX = 610; estacionY = 520; }
                estaciones.addObject().put("nombre", estacion).put("x", estacionX).put("y", estacionY);
                tramos.addObject().put("linea", nombre).put("a", anterior).put("b", estacion);
                anterior = estacion;
            }
        }
        var unidades = red.putArray("unidades");
        int metros = reglas.path("minimoMetros").asInt();
        for (int indice = 0; indice < metros; indice++) unidades.addObject()
            .put("linea", "Línea " + (indice % cantidades.size() + 1)).put("capacidad", 300).put("uv", 1);
        var ejecucion = red.putArray("ejecuciones").addObject().put("velocidad", 1)
            .put("duracion", numero == 7 ? 100 : numero == 8 ? 0.5 : 6)
            .put("parametroReferencia", numero == 7 || numero == 8 ? "UT" : "UV");
        var valores = ejecucion.putArray("unidades");
        double uv = numero == 6 || numero == 10 ? 2 : numero == 9 ? 0.5 : 1;
        for (int indice = 0; indice < metros; indice++) valores.addObject().put("uv", uv);
        return red;
    }

    private void validarCatalogo(JsonNode catalogo) {
        if (!catalogo.isArray() || catalogo.size() != 10) throw new IllegalStateException("Se requieren diez niveles");
        var usados = new java.util.HashSet<Integer>();
        for (int indice = 0; indice < 10; indice++) {
            var nivel = catalogo.get(indice);
            int numero = indice + 1;
            var reglas = nivel.path("reglasExito");
            if (nivel.path("numero").asInt() != numero) throw new IllegalStateException("Secuencia de niveles inválida");
            int objetivos = 0;
            for (String clave : List.of("minimoEstaciones", "minimoLineas", "minimoTramos", "minimoMetros", "minimoTransbordos"))
                if (reglas.path(clave).asInt() > 0) objetivos++;
            for (JsonNode practica : reglas.path("aprendizajeSimulacion")) if (practica.asBoolean()) objetivos++;
            if (reglas.path("requiereSimulacion").asBoolean()) objetivos++;
            if (objetivos != 5 || !reglas.path("requiereSimulacion").asBoolean())
                throw new IllegalStateException("Nivel " + numero + ": se requieren cinco objetivos y Simulación");
            for (String herramienta : List.of("estaciones", "lineas", "conexiones", "metros", "simulacion"))
                if (!nivel.path("herramientasHabilitadas").path(herramienta).asBoolean())
                    throw new IllegalStateException("Nivel " + numero + ": herramienta requerida no habilitada: " + herramienta);
            var puntos = reglas.path("puntosInteresObjetivo");
            if (puntos.size() != (numero < 6 ? 0 : numero == 6 ? 1 : numero == 10 ? 3 : 2) || (numero >= 6 && !reglas.path("requierePoiIndividuales").asBoolean()))
                throw new IllegalStateException("Nivel " + numero + ": cantidad/evaluación de POI inválida");
            for (var punto : puntos) {
                int id = punto.path("idPunto").asInt();
                if (!usados.add(id) || geografia.resolverPunto(id, null) == null || punto.path("radioCobertura").asDouble() <= 0)
                    throw new IllegalStateException("Nivel " + numero + ": POI inexistente, repetido o radio inválido");
            }
        }
    }

}
