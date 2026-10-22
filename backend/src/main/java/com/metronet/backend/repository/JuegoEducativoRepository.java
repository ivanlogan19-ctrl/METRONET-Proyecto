package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JuegoEducativoRepository {
    private final JdbcTemplate jdbc;

    public JuegoEducativoRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> desafioPublicado(RowMapper<T> mapeador, Long idPublicacion, Integer idEscenario) {
        return jdbc.query("""
                SELECT contenido->'desafio'->>'nombre',contenido->'desafio'->>'dificultad',contenido->'desafio'->>'relato',contenido->'desafio'->>'recorrido'
                FROM nivel_publicacion WHERE id_nivel_publicacion=COALESCE(?,
                  (SELECT id_nivel_publicacion FROM nivel_publicacion WHERE id_escenario=? ORDER BY numero_version DESC LIMIT 1))
                """, mapeador, idPublicacion, idEscenario);
    }

    public Boolean tieneSimulacionEnCampana(Integer idUsuario, int numeroCampana) {
        return jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM simulacion s JOIN intento i ON i.id_intento=s.id_intento
                    JOIN escenario e ON e.id_escenario=i.id_escenario
                    WHERE i.id_usuario=? AND i.numero_campana=? AND e.progresivo=TRUE AND e.modo='NIVEL')
                """, Boolean.class, idUsuario, numeroCampana);
    }

    public Boolean puedeConsultarContenido(Integer idUsuario, int numero) {
        return jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
                WHERE i.id_usuario=? AND i.estado='COMPLETADO' AND e.progresivo=TRUE
                  AND e.modo='NIVEL' AND e.numero=?)
            """, Boolean.class, idUsuario, numero);
    }

    public int reiniciarCampana(Integer idUsuario, int numeroCampana) {
        return jdbc.update("""
            UPDATE usuario
            SET numero_campana_actual = numero_campana_actual + 1
            WHERE id_usuario = ? AND numero_campana_actual = ?
            """, idUsuario, numeroCampana);
    }

    public <T> List<T> ultimaPublicacion(RowMapper<T> mapeador, Integer idEscenario) {
        return jdbc.query("""
                SELECT id_nivel_publicacion,numero_version FROM nivel_publicacion WHERE id_escenario=?
                ORDER BY numero_version DESC LIMIT 1
                """, mapeador, idEscenario);
    }

    public Integer crearDiseno() {
        return jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
    }

    public Integer crearIntentoPublicado(Integer idUsuario, Integer idEscenario, Integer idDiseno, int numeroCampana) {
        return jdbc.queryForObject("""
            INSERT INTO intento (id_usuario, id_escenario, id_diseno, numero_campana, estado, progreso, puntaje)
            VALUES (?, ?, ?, ?, 'EN_DESARROLLO', 0, NULL)
            RETURNING id_intento
            """, Integer.class, idUsuario, idEscenario, idDiseno, numeroCampana);
    }

    public Integer crearIntento(Integer idUsuario, Integer idEscenario, Integer idDiseno, int numeroCampana, Long idPublicacion) {
        return jdbc.queryForObject("""
            INSERT INTO intento (id_usuario, id_escenario, id_diseno, numero_campana, estado, progreso, puntaje,id_nivel_publicacion)
            VALUES (?, ?, ?, ?, 'EN_DESARROLLO', 0, NULL,?) RETURNING id_intento
            """, Integer.class, idUsuario, idEscenario, idDiseno, numeroCampana, idPublicacion);
    }

    public List<Integer> bloquearEscenario(int idEscenario) {
        return jdbc.queryForList("SELECT id_escenario FROM escenario WHERE id_escenario=? FOR SHARE", Integer.class, idEscenario);
    }

    public Boolean tienePublicaciones() {
        return jdbc.queryForObject("""
            SELECT to_regclass('intento')=to_regclass('public.intento')
              AND to_regclass('nivel_publicacion') IS NOT NULL
            """, Boolean.class);
    }

    public Boolean esPostgreSQL() {
        return jdbc.execute((ConnectionCallback<Boolean>)
            conexion -> "PostgreSQL".equals(conexion.getMetaData().getDatabaseProductName()));
    }

    public Integer bloquearUsuario(Integer idUsuario) {
        return jdbc.queryForObject("SELECT id_usuario FROM usuario WHERE id_usuario=? FOR UPDATE", Integer.class, idUsuario);
    }

    public int registrarEvaluacion(
        String estado,
        int progreso,
        Integer puntaje,
        Integer puntajeEnCurso,
        boolean completado,
        java.time.LocalDateTime fechaFinalizacion,
        Integer idIntento
    ) {
        return jdbc.update("""
            UPDATE intento SET estado = ?, progreso = GREATEST(progreso, ?), puntaje = CASE WHEN estado = 'COMPLETADO' THEN GREATEST(COALESCE(puntaje, 0), ?) ELSE ? END,
            fecha_finalizacion = CASE WHEN ? THEN COALESCE(fecha_finalizacion, ?) ELSE fecha_finalizacion END
            WHERE id_intento = ?
            """, estado, progreso, puntaje, puntajeEnCurso, completado, fechaFinalizacion, idIntento);
    }

    public int actualizarPuntajeSimulacion(Integer puntaje, Integer idIntento, String patronComentarios) {
        return jdbc.update("""
                UPDATE simulacion SET puntaje = ?
                WHERE id_simulacion = (SELECT MAX(id_simulacion) FROM simulacion WHERE id_intento = ?)
                  AND comentarios LIKE ?
                """, puntaje, idIntento, patronComentarios);
    }

    public int marcarCampanaCompleta(Integer idUsuario) {
        return jdbc.update("""
                UPDATE usuario SET campana_completada_historicamente = TRUE
                WHERE id_usuario = ?
                """, idUsuario);
    }

    public Integer bloquearUsuarioParaProgreso(Integer idUsuario) {
        return jdbc.queryForObject("SELECT id_usuario FROM usuario WHERE id_usuario=? FOR UPDATE", Integer.class, idUsuario);
    }

    public int actualizarProgreso(int progreso, int puntaje, Integer idIntento) {
        return jdbc.update("""
            UPDATE intento SET progreso = GREATEST(progreso, ?), puntaje = ?
            WHERE id_intento = ?
            """, progreso, puntaje, idIntento);
    }

    public <T> List<T> escenariosProgresivos(RowMapper<T> mapeador) {
        return jdbc.query("""
            SELECT id_escenario, numero, nombre, objetivo, dificultad, instrucciones, modo, reglas_exito::text AS reglas_exito, herramientas_habilitadas::text AS herramientas_habilitadas
            FROM escenario WHERE progresivo = TRUE ORDER BY numero NULLS LAST, id_escenario
            """, mapeador);
    }

    public <T> List<T> progresoUsuario(RowMapper<T> mapeador, Integer idUsuario) {
        return jdbc.query("""
            SELECT numero_campana_actual, campana_completada_historicamente
            FROM usuario WHERE id_usuario = ?
            """, mapeador, idUsuario);
    }

    public <T> List<T> intentoActual(
        boolean tienePublicaciones,
        RowMapper<T> mapeador,
        Integer idUsuario,
        Integer idEscenario,
        int numeroCampana
    ) {
        String columna = tienePublicaciones ? "id_nivel_publicacion" : "NULL::bigint AS id_nivel_publicacion";
        return jdbc.query("""
            SELECT id_intento, id_diseno, estado, progreso, %s
            FROM intento
            WHERE id_usuario = ? AND id_escenario = ? AND numero_campana = ?
            ORDER BY id_intento DESC LIMIT 1
            """.formatted(columna), mapeador, idUsuario, idEscenario, numeroCampana);
    }

    public <T> List<T> intentoPorDiseno(RowMapper<T> mapeador, Integer idUsuario, Integer idDiseno) {
        return jdbc.query("""
            SELECT i.id_intento, i.estado, i.puntaje, i.numero_campana, e.numero, e.modo,
                   COALESCE(v.reglas_exito,h.reglas_exito,e.reglas_exito)::text AS reglas_exito
            FROM intento i JOIN escenario e ON e.id_escenario = i.id_escenario
            LEFT JOIN intento_uv_ut v ON v.id_intento=i.id_intento
            LEFT JOIN intento_catalogo_v1 h ON h.id_intento=i.id_intento
            WHERE i.id_usuario = ? AND i.id_diseno = ? AND e.progresivo = TRUE
            """, mapeador, idUsuario, idDiseno);
    }

    public Integer contarAdministradores(Integer idUsuario) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM usuario WHERE id_usuario = ? AND rol = 'ADMIN'", Integer.class, idUsuario);
    }

    public Integer contarNivelCompletado(Integer idUsuario, int numeroCampana, int numero) {
        return jdbc.queryForObject("""
            SELECT COUNT(*) FROM intento i JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_usuario = ? AND i.numero_campana = ? AND e.progresivo = TRUE
              AND e.numero = ? AND i.estado = 'COMPLETADO'
            """, Integer.class, idUsuario, numeroCampana, numero);
    }

    public <T> List<T> estadisticasIntento(
        RowMapper<T> mapeador,
        Integer idUsuario,
        Integer idEscenario,
        int campana,
        Integer idUsuarioHistorial,
        Integer idEscenarioHistorial
    ) {
        return jdbc.query("""
            SELECT COUNT(*) AS cantidad_intentos, MAX(CASE WHEN i.estado='COMPLETADO' THEN i.puntaje ELSE NULL END) AS mejor_puntaje,
                   (
                       SELECT reciente.puntaje
                       FROM intento reciente
                       WHERE reciente.id_usuario = ? AND reciente.id_escenario = ?
                       ORDER BY reciente.id_intento DESC LIMIT 1
                   ) AS ultimo_puntaje, COUNT(CASE WHEN i.numero_campana = ? THEN 1 END) AS cantidad_campana
            FROM intento i
            WHERE i.id_usuario = ? AND i.id_escenario = ?
            """, mapeador, idUsuario, idEscenario, campana, idUsuarioHistorial, idEscenarioHistorial);
    }

    public <T> List<T> referenciasObjetivo(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT posicion_x, posicion_y FROM estacion WHERE id_diseno = ?
            """, mapeador, idDiseno);
    }

    public Integer contarSimulaciones(Integer idIntento) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM simulacion WHERE id_intento = ?", Integer.class, idIntento);
    }

    public <T> List<T> intentoParaConsigna(boolean administrador, Integer idDiseno,
        Integer idUsuario, RowMapper<T> mapeador) {
        String filtroPropietario = administrador ? "" : " AND i.id_usuario = ?";
        String consulta = """
            SELECT i.id_intento, i.estado, i.puntaje, i.numero_campana, e.numero, e.modo,
                   COALESCE(v.reglas_exito,h.reglas_exito,e.reglas_exito)::text AS reglas_exito
            FROM intento i JOIN escenario e ON e.id_escenario = i.id_escenario
            LEFT JOIN intento_uv_ut v ON v.id_intento=i.id_intento
            LEFT JOIN intento_catalogo_v1 h ON h.id_intento=i.id_intento
            WHERE i.id_diseno = ? AND e.progresivo = TRUE%s
            ORDER BY i.id_intento DESC LIMIT 1
            """.formatted(filtroPropietario);
        return administrador ? jdbc.query(consulta, mapeador, idDiseno)
            : jdbc.query(consulta, mapeador, idDiseno, idUsuario);
    }

    public Integer contarEstaciones(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarLineas(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarTramos(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM tramo WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarMetros(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM metro WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarLineasAtendidas(Integer idDiseno) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) FROM linea l WHERE l.id_diseno=? AND EXISTS
                  (SELECT 1 FROM metro m WHERE m.id_diseno=l.id_diseno AND m.nombre_linea=l.nombre)
                """, Integer.class, idDiseno);
    }
    public <T> List<T> enlacesRecorrido(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT nombre_linea, nombre_estacion_a, nombre_estacion_b FROM tramo WHERE id_diseno = ?
            """, mapeador, idDiseno);
    }

}
