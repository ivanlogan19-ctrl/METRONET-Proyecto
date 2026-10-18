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
    public static final String VERSION = "integral-2026-10-lineas-automaticas-v4";
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
        if (!Boolean.TRUE.equals(repositorio.esAdministrador(idAdmin)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"La publicación requiere un administrador existente");
        JsonNode catalogo;
        try (var entrada=new ClassPathResource("educacion/recorrido-integral.json").getInputStream()) {
            catalogo=mapper.readTree(entrada);
        }
        validarCatalogo(catalogo);
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
        adaptarIntentosEnCurso();
        return resultado;
    }

    /** Adopción explícita del cambio aprobado en intentos activos del recorrido anterior.
     * Las publicaciones, ejecuciones y campañas completadas conservan su historia. */
    private void adaptarIntentosEnCurso() {
        var intentos = repositorio.intentosEnCurso(VERSION);
        for (var intento : intentos) {
            repositorio.vincularPublicacion(intento.get("id_nivel_publicacion"), intento.get("id_intento"));
            repositorio.actualizarCatalogoIntento(intento.get("id_intento"), intento.get("id_nivel_publicacion"));
        }
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
        int numero=nivel.path("numero").asInt();
        JsonNode reglas=nivel.path("reglasExito");
        ObjectNode red=mapper.createObjectNode();
        var estaciones=red.putArray("estaciones");
        int cantidad=reglas.path("minimoEstaciones").asInt();
        for (int i=0;i<cantidad;i++) estaciones.addObject().put("nombre","E"+i).put("x",620+i*10).put("y",465);
        int indice=0;
        for (JsonNode objetivo:reglas.path("puntosInteresObjetivo")) {
            var punto=geografia.resolverPunto(objetivo.path("idPunto").asInt(),null);
            ((ObjectNode)estaciones.get(indice++)).put("x",geografia.posicionX(punto)).put("y",geografia.posicionY(punto));
        }
        var lineas=red.putArray("lineas"); lineas.addObject().put("nombre","Principal");
        boolean dos=reglas.path("minimoLineas").asInt()>1 || reglas.path("minimoTransbordos").asInt()>0;
        if (dos) lineas.addObject().put("nombre","Enlace");
        var tramos=red.putArray("tramos");
        for (int i=1;i<cantidad;i++) tramos.addObject().put("linea",dos && i==cantidad-1 ? "Enlace":"Principal")
            .put("a","E"+(i-1)).put("b","E"+i);
        var unidades=red.putArray("unidades");
        int metros=reglas.path("minimoMetros").asInt();
        for (int i=0;i<metros;i++) unidades.addObject().put("linea",dos && i==metros-1?"Enlace":"Principal")
            .put("capacidad",300).put("uv",4);
        var ejecuciones=red.putArray("ejecuciones");
        paso(ejecuciones,6,metros,4,4);
        if (numero==2) paso(ejecuciones,6,metros,5,5);
        if (numero==3) { paso(ejecuciones,8,metros,4,4); ((ObjectNode)ejecuciones.get(ejecuciones.size()-1)).put("parametroReferencia","UT"); }
        if (numero==4) { paso(ejecuciones,6,metros,5,5); paso(ejecuciones,8,metros,5,5); ((ObjectNode)ejecuciones.get(ejecuciones.size()-1)).put("parametroReferencia","UT"); }
        if (numero==8) paso(ejecuciones,6,metros,3,4);
        if (numero==9 || numero==10) paso(ejecuciones,8,metros,6,6);
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
            if (puntos.size() != (numero < 6 ? 0 : 3) || (numero >= 6 && !reglas.path("requierePoiIndividuales").asBoolean()))
                throw new IllegalStateException("Nivel " + numero + ": cantidad/evaluación de POI inválida");
            for (var punto : puntos) {
                int id = punto.path("idPunto").asInt();
                if (!usados.add(id) || geografia.resolverPunto(id, null) == null || punto.path("radioCobertura").asDouble() <= 0)
                    throw new IllegalStateException("Nivel " + numero + ": POI inexistente, repetido o radio inválido");
            }
        }
    }

    private void paso(com.fasterxml.jackson.databind.node.ArrayNode ejecuciones,int horas,int cantidad,int primera,int resto) {
        var unidades=ejecuciones.addObject().put("duracion",horas).put("velocidad",1).putArray("unidades");
        for (int i=0;i<cantidad;i++) unidades.addObject().put("uv",i==0?primera:resto);
    }
}
