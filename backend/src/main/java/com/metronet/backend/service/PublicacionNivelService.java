package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.PublicarNivelRequest;
import com.metronet.backend.dto.EdicionNivelRequest;
import java.util.HashMap;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Único publicador: contenido, proyecciones y criterio UV/UT cambian juntos. */
@Service
public class PublicacionNivelService {
    private final JdbcTemplate jdbc;
    private final AdministracionNivelesService borradores;
    private final ValidacionPublicacionNivelService validacion;
    private final ObjectMapper mapper;
    private final Map<String,String> svgConHuella;

    public PublicacionNivelService(JdbcTemplate jdbc, AdministracionNivelesService borradores,
        ValidacionPublicacionNivelService validacion, ObjectMapper mapper) {
        this.jdbc=jdbc; this.borradores=borradores; this.validacion=validacion; this.mapper=mapper;
        try (var entrada=new ClassPathResource("educacion/catalogo-svgs-niveles.json").getInputStream()) {
            JsonNode catalogo=mapper.readTree(entrada);
            Map<String,String> huellas=new HashMap<>();
            for (JsonNode nivel:catalogo) for (JsonNode tarjeta:nivel.path("tarjetas"))
                huellas.put(tarjeta.path("imagen").asText(),tarjeta.path("sha256").asText());
            svgConHuella=Map.copyOf(huellas);
        } catch (Exception error) { throw new IllegalStateException("Catálogo SVG ilegible",error); }
    }

    public record VistaPrevia(int numero,int versionPublicada,int revisionBorrador,
        JsonNode contenido,JsonNode tarjetas,ValidacionPublicacionNivelService.Diagnostico diagnostico) {}
    public record Publicada(int numero,int version,Integer versionCriterioUvUt,String huella) {}

    /** Compatibilidad del PUT UV/UT: crea una publicación completa con la referencia privada vigente. */
    @Transactional
    public Publicada publicarCriterioUvUt(int numero, AdministracionUvUtService.Cambio cambio, int idAdmin) {
        if (numero < 4 || numero > 10) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No existe el criterio solicitado");
        int id = idEscenario(numero,true);
        Integer versionCriterio = jdbc.queryForObject(
            "SELECT version FROM criterio_uv_ut WHERE id_escenario=? FOR UPDATE", Integer.class,id);
        if (cambio == null || cambio.versionEsperada() == null || !cambio.versionEsperada().equals(versionCriterio))
            throw conflicto("El criterio UV/UT cambió. Actualizá antes de guardar");
        if (cambio.limiteUt() == null || cambio.limiteUt() <= 0 || cambio.presupuestoUv() == null
            || cambio.presupuestoUv().signum() <= 0 || cambio.presupuestoUv().scale() > 2)
            throw invalido("Ingresá UT enteras positivas y presupuesto UV positivo con hasta dos decimales");
        var borrador = borradores.borrador(numero);
        if (borrador.versionBase() != version(id)) throw conflicto("El borrador se basa en otra publicación");
        var criterio = mapper.createObjectNode();
        criterio.put("limiteUt",cambio.limiteUt());
        criterio.put("presupuestoUv",cambio.presupuestoUv());
        var contenido = borrador.contenido();
        var guardado = borradores.guardar(numero,new EdicionNivelRequest(
            borrador.versionBase(),borrador.revision(),contenido.path("desafio"),contenido.path("reglasExito"),
            contenido.path("herramientasHabilitadas"),criterio,borrador.redReferencia(),
            contenido.path("ayudas"),borrador.tarjetas()),idAdmin);
        var vista = previsualizar(numero,idAdmin);
        if (!vista.diagnostico().viable()) throw invalido(vista.diagnostico().mensaje());
        return publicar(numero,new PublicarNivelRequest(guardado.versionBase(),guardado.revision(),
            vista.diagnostico().huella(),true),idAdmin);
    }

    @Transactional
    public VistaPrevia previsualizar(int numero,int idAdmin) {
        int id=idEscenario(numero,false);
        var borrador=borradores.borrador(numero);
        int vigente=version(id);
        if (borrador.versionBase()!=vigente) throw conflicto("La publicación cambió. Actualizá el borrador");
        borradores.validarBorrador(borrador);
        var diagnostico=validacion.validar(id,idAdmin,borrador.contenido(),borrador.redReferencia(),borrador.tarjetas());
        return new VistaPrevia(numero,vigente,borrador.revision(),borrador.contenido(),borrador.tarjetas(),diagnostico);
    }

    @Transactional
    public Publicada publicar(int numero,PublicarNivelRequest pedido,int idAdmin) {
        int id=idEscenario(numero,true);
        var borrador=borradores.borrador(numero);
        int vigente=version(id);
        if (pedido==null || pedido.versionEsperada()==null || pedido.revisionEsperada()==null
            || pedido.versionEsperada()!=vigente || pedido.revisionEsperada()!=borrador.revision()
            || borrador.versionBase()!=vigente)
            throw conflicto("La versión o el borrador cambió. Hacé otra vista previa");
        if (!Boolean.TRUE.equals(pedido.confirmacionEditorial()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Confirmá la revisión editorial de textos, fuentes e imágenes");
        borradores.validarBorrador(borrador);
        var diagnostico=validacion.validar(id,idAdmin,borrador.contenido(),borrador.redReferencia(),borrador.tarjetas());
        if (!diagnostico.viable()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,diagnostico.mensaje());
        if (pedido.huellaPreview()==null || !pedido.huellaPreview().equals(diagnostico.huella()))
            throw conflicto("La vista previa ya no corresponde al borrador actual");
        JsonNode contenido=borrador.contenido(), desafio=contenido.path("desafio"), tarjetas=borrador.tarjetas();
        if (!tarjetas.isArray() || tarjetas.size()!=7) throw invalido("Cada nivel requiere siete tarjetas");
        Integer versionCriterio=null;
        JsonNode criterio=contenido.path("criterioUvUt");
        if (numero>=4) {
            if (!criterio.isObject() || !criterio.path("limiteUt").isIntegralNumber()
                || !criterio.path("presupuestoUv").isNumber()) throw invalido("Criterio UV/UT inválido");
            versionCriterio=jdbc.queryForObject("SELECT version+1 FROM criterio_uv_ut WHERE id_escenario=? FOR UPDATE",Integer.class,id);
            if (versionCriterio==null) throw invalido("Falta criterio UV/UT de este nivel");
        }
        int siguiente=vigente+1;
        long publicacion=jdbc.queryForObject("""
            INSERT INTO nivel_publicacion(id_escenario,numero_version,version_criterio_uv_ut,contenido,
              red_referencia,huella,autor_id,confirmacion_editorial)
            VALUES (?,?,?,CAST(? AS jsonb),CAST(? AS jsonb),?,?,TRUE) RETURNING id_nivel_publicacion
            """,Long.class,id,siguiente,versionCriterio,contenido.toString(),borrador.redReferencia().toString(),
            diagnostico.huella(),idAdmin);
        for (int i=0;i<7;i++) {
            JsonNode tarjeta=tarjetas.get(i);
            String imagen=tarjeta.path("idSvgCatalogo").asText();
            String hash=svgConHuella.get(imagen);
            if (hash==null) throw invalido("La tarjeta " + (i+1) + " usa un SVG no autorizado");
            jdbc.update("""
                INSERT INTO nivel_publicacion_tarjeta(id_nivel_publicacion,posicion,id_tarjeta,titulo,texto,
                  aprendizaje,fuente,url_fuente,descripcion_imagen,id_svg_catalogo,sha256_svg)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """,publicacion,i+1,tarjeta.path("id").asText(),tarjeta.path("titulo").asText(),
                tarjeta.path("texto").asText(),tarjeta.path("aprendizaje").asText(),tarjeta.path("fuente").asText(),
                tarjeta.path("urlFuente").asText(),tarjeta.path("descripcionImagen").asText(),imagen,hash);
        }
        jdbc.update("""
            UPDATE escenario SET nombre=?,objetivo=?,instrucciones=?,dificultad=?,
              reglas_exito=CAST(? AS jsonb),herramientas_habilitadas=CAST(? AS jsonb)
            WHERE id_escenario=?
            """,desafio.path("nombre").asText(),desafio.path("objetivo").asText(),
            desafio.path("instrucciones").asText(),desafio.path("dificultad").asText(),
            contenido.path("reglasExito").toString(),contenido.path("herramientasHabilitadas").toString(),id);
        if (versionCriterio!=null) jdbc.update("""
            UPDATE criterio_uv_ut SET version=?,limite_ut=?,presupuesto_uv=? WHERE id_escenario=?
            """,versionCriterio,criterio.path("limiteUt").asInt(),criterio.path("presupuestoUv").decimalValue(),id);
        jdbc.update("UPDATE nivel_borrador SET version_base=?,revision=revision+1 WHERE id_escenario=?",
            siguiente,id);
        jdbc.update("""
            INSERT INTO actividad_administrativa(id_administrador,accion,detalle)
            VALUES (?,'PUBLICAR_NIVEL',?)
            """,idAdmin,"Nivel "+numero+" publicado como versión "+siguiente+"; revisión editorial confirmada");
        return new Publicada(numero,siguiente,versionCriterio,diagnostico.huella());
    }

    private int idEscenario(int numero,boolean bloquear) {
        if (numero<1 || numero>10) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No existe el nivel solicitado");
        return jdbc.query("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=?"
            +(bloquear?" FOR UPDATE":" FOR SHARE"),(r,f)->r.getInt(1),numero).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"No existe el nivel solicitado"));
    }
    private int version(int idEscenario) {
        return jdbc.queryForObject("SELECT MAX(numero_version) FROM nivel_publicacion WHERE id_escenario=?",Integer.class,idEscenario);
    }
    private ResponseStatusException conflicto(String mensaje) { return new ResponseStatusException(HttpStatus.CONFLICT,mensaje); }
    private ResponseStatusException invalido(String mensaje) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,mensaje); }
}
