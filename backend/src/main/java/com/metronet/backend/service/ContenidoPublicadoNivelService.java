package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Lectura del contenido visible sin exponer borradores ni la red privada. */
@Service
public class ContenidoPublicadoNivelService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ContenidoPublicadoNivelService(JdbcTemplate jdbc,ObjectMapper mapper) {
        this.jdbc=jdbc; this.mapper=mapper;
    }

    public record Contenido(long idNivelPublicacion,int numero,int version,JsonNode desafio,
                           JsonNode ayudas,JsonNode tarjetas) {}

    public Contenido actual(int numero) {
        if (numero<1 || numero>10) throw noExiste();
        return jdbc.query("""
            SELECT p.id_nivel_publicacion,e.numero,p.numero_version,p.contenido::text
            FROM escenario e JOIN nivel_publicacion p ON p.id_escenario=e.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?
            ORDER BY p.numero_version DESC LIMIT 1
            """,(r,f)->mapear(r.getLong(1),r.getInt(2),r.getInt(3),r.getString(4)),numero)
            .stream().findFirst().orElseThrow(this::noExiste);
    }

    public Contenido deIntento(int idIntento,int idUsuario) {
        return jdbc.query("""
            SELECT p.id_nivel_publicacion,e.numero,p.numero_version,p.contenido::text
            FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
              JOIN nivel_publicacion p ON p.id_nivel_publicacion=i.id_nivel_publicacion
            WHERE i.id_intento=? AND i.id_usuario=? AND e.progresivo=TRUE AND e.modo='NIVEL'
            """,(r,f)->mapear(r.getLong(1),r.getInt(2),r.getInt(3),r.getString(4)),idIntento,idUsuario)
            .stream().findFirst().orElseThrow(this::noExiste);
    }

    private Contenido mapear(long id,int numero,int version,String json) {
        try {
            JsonNode contenido=mapper.readTree(json);
            ArrayNode tarjetas=mapper.createArrayNode();
            jdbc.query("""
                SELECT id_tarjeta,titulo,texto,aprendizaje,fuente,url_fuente,descripcion_imagen,id_svg_catalogo
                FROM nivel_publicacion_tarjeta WHERE id_nivel_publicacion=? ORDER BY posicion
                """,r->{
                    ObjectNode tarjeta=mapper.createObjectNode();
                    tarjeta.put("id",r.getString(1));tarjeta.put("titulo",r.getString(2));
                    tarjeta.put("texto",r.getString(3));tarjeta.put("aprendizaje",r.getString(4));
                    tarjeta.put("fuente",r.getString(5));tarjeta.put("url",r.getString(6));
                    tarjeta.put("descripcionImagen",r.getString(7));tarjeta.put("imagen",r.getString(8));
                    tarjetas.add(tarjeta);
                },id);
            return new Contenido(id,numero,version,contenido.path("desafio"),contenido.path("ayudas"),tarjetas);
        } catch (Exception error) { throw new IllegalStateException("Publicación de nivel ilegible",error); }
    }

    private ResponseStatusException noExiste() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND,"No existe contenido publicado para ese nivel o intento");
    }
}
