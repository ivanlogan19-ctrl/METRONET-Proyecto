package com.metronet.backend.service;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Premios acumulables calculados desde intentos completados, sin estado duplicado. */
@Service
public class TrofeosService {
    private final JdbcTemplate jdbc;
    private final PuntuacionService puntuacion;

    public TrofeosService(JdbcTemplate jdbc, PuntuacionService puntuacion) {
        this.jdbc = jdbc;
        this.puntuacion = puntuacion;
    }

    public record Trofeo(String id, String nombre, String requisito, String motivo, boolean obtenido) {}
    private record Nivel(int numero, int maximo, boolean completo, Integer mejor) {}

    public List<Trofeo> consultar(Usuario usuario) {
        return consultar(usuario.getIdUsuario(), usuario.getRol() == Rol.ADMIN);
    }

    public List<Trofeo> consultar(Integer idUsuario) {
        boolean admin = jdbc.queryForObject("SELECT rol = 'ADMIN' FROM usuario WHERE id_usuario=?", Boolean.class, idUsuario);
        return consultar(idUsuario, admin);
    }

    private List<Trofeo> consultar(Integer idUsuario, boolean admin) {
        List<Nivel> niveles = jdbc.query("""
            SELECT e.numero,e.reglas_exito::text,MAX(i.id_intento) AS intento_completado,MAX(i.puntaje) AS mejor
            FROM escenario e LEFT JOIN intento i ON i.id_escenario=e.id_escenario
              AND i.id_usuario=? AND i.estado='COMPLETADO'
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10
            GROUP BY e.id_escenario,e.numero,e.reglas_exito ORDER BY e.numero
            """, (r, fila) -> new Nivel(r.getInt(1), puntuacion.maximo(r.getString(2)),
                r.getObject(3) != null, r.getObject(4, Integer.class)), idUsuario);
        Map<Integer, Nivel> porNumero = niveles.stream().collect(Collectors.toMap(Nivel::numero, n -> n, (a, b) -> a));
        long completados = porNumero.values().stream().filter(Nivel::completo).count();
        boolean diez = porNumero.size() == 10 && completados == 10;
        boolean platino = diez && porNumero.values().stream().allMatch(n -> n.mejor() != null && n.mejor() >= n.maximo());
        return List.of(
            trofeo("corona", "Corona de platino", "Puntuación máxima en los 10 niveles.",
                "Alcanzaste la puntuación máxima en cada uno de los diez niveles.", platino, admin),
            trofeo("biblioteca", "Biblioteca completa", "Desbloquear las 70 tarjetas de los 10 niveles.",
                "Completaste los diez niveles y desbloqueaste sus 70 tarjetas.", diez, admin),
            trofeo("copa", "Copa de la red", "Completar los 10 niveles.",
                "Completaste los diez niveles del recorrido.", diez, admin),
            trofeo("estacion", "Primera estación", "Completar el Nivel 1.",
                "Completaste el primer nivel.", porNumero.containsKey(1) && porNumero.get(1).completo(), admin),
            trofeo("camino", "Camino a la cima", "Completar 5 niveles distintos.",
                "Completaste cinco niveles distintos.", completados >= 5, admin));
    }

    private Trofeo trofeo(String id, String nombre, String requisito, String motivo, boolean obtenido, boolean admin) {
        return new Trofeo(id, nombre, requisito, motivo, !admin && obtenido);
    }
}
