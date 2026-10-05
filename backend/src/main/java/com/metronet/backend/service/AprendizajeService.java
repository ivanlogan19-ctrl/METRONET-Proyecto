package com.metronet.backend.service;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import java.util.List;
import java.util.HashSet;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Consulta de tarjetas desbloqueadas a partir de logros persistidos en cualquier campaña. */
@Service
public class AprendizajeService {
    private final JdbcTemplate jdbc;
    private final ContenidoPublicadoNivelService contenido;

    public AprendizajeService(JdbcTemplate jdbc, ContenidoPublicadoNivelService contenido) {
        this.jdbc = jdbc;
        this.contenido = contenido;
    }

    public record Nivel(int numero, boolean desbloqueado, ContenidoPublicadoNivelService.Contenido contenido) {}

    public List<Nivel> niveles(Usuario usuario) {
        Set<Integer> completados = new HashSet<>(jdbc.query("""
            SELECT DISTINCT e.numero FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
            WHERE i.id_usuario=? AND i.estado='COMPLETADO' AND e.progresivo=TRUE
              AND e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10
            """, (r, fila) -> r.getInt(1), usuario.getIdUsuario()));
        boolean administrador = usuario.getRol() == Rol.ADMIN;
        return java.util.stream.IntStream.rangeClosed(1, 10).mapToObj(numero -> {
            boolean desbloqueado = administrador || completados.contains(numero);
            return new Nivel(numero, desbloqueado, desbloqueado ? contenido.actual(numero) : null);
        }).toList();
    }

    public ContenidoPublicadoNivelService.Contenido contenido(int numero, Usuario usuario) {
        if (numero < 1 || numero > 10) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (usuario.getRol() != Rol.ADMIN && !Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
                WHERE i.id_usuario=? AND i.estado='COMPLETADO' AND e.progresivo=TRUE
                  AND e.modo='NIVEL' AND e.numero=?)
            """, Boolean.class, usuario.getIdUsuario(), numero))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Completá el nivel para consultar sus tarjetas");
        }
        return contenido.actual(numero);
    }
}
