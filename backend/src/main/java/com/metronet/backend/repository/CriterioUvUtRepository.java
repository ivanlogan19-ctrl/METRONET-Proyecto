package com.metronet.backend.repository;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class CriterioUvUtRepository {
    private final JdbcTemplate jdbc;

    public CriterioUvUtRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> configuracionIntento(RowMapper<T> mapeador, int idIntento) {
        return jdbc.query("SELECT version,limite_ut,presupuesto_uv FROM intento_uv_ut WHERE id_intento=?", mapeador, idIntento);
    }

    public Boolean tieneCriterioPublicado(int idIntento) {
        return jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM intento i JOIN nivel_publicacion p ON p.id_nivel_publicacion=i.id_nivel_publicacion
              WHERE i.id_intento=? AND p.version_criterio_uv_ut IS NULL)
            """, Boolean.class, idIntento);
    }

    public int iniciarIntento(int idIntento, int idEscenario) {
        return jdbc.update("""
            INSERT INTO intento_uv_ut(id_intento,version,limite_ut,presupuesto_uv,reglas_exito,herramientas_habilitadas,objetivo,instrucciones)
            SELECT ?,c.version,c.limite_ut,c.presupuesto_uv,e.reglas_exito,e.herramientas_habilitadas,
              e.objetivo,regexp_replace(e.instrucciones, '\\mhoras?\\M', 'UT', 'gi') ||
              ' Completá todos los recorridos en hasta ' || c.limite_ut || ' UT con un máximo de ' || c.presupuesto_uv || ' UV asignadas.'
            FROM criterio_uv_ut c JOIN escenario e ON e.id_escenario=c.id_escenario
            WHERE c.id_escenario=? AND e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 4 AND 10
            """, idIntento, idEscenario);
    }

    public <T> List<T> presentacionIntento(RowMapper<T> mapeador, Integer idIntento) {
        return jdbc.query("SELECT objetivo,instrucciones,herramientas_habilitadas::text FROM intento_uv_ut WHERE id_intento=?", mapeador, idIntento);
    }

    public <T> List<T> presentacionCatalogo(RowMapper<T> mapeador, Integer idIntento) {
        return jdbc.query("SELECT objetivo,instrucciones,herramientas_habilitadas::text FROM intento_catalogo_v1 WHERE id_intento=?", mapeador, idIntento);
    }

    public Boolean tieneVersionCriterio(int idEscenario) {
        return jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM nivel_publicacion p WHERE p.id_escenario=? AND p.version_criterio_uv_ut IS NULL
              AND p.numero_version=(SELECT MAX(numero_version) FROM nivel_publicacion WHERE id_escenario=p.id_escenario))
            """, Boolean.class, idEscenario);
    }

    public <T> List<T> criterioEscenario(RowMapper<T> mapeador, int idEscenario) {
        return jdbc.query("SELECT limite_ut,presupuesto_uv FROM criterio_uv_ut WHERE id_escenario=?", mapeador, idEscenario);
    }

    public Boolean esPostgreSQL() {
        return jdbc.execute((ConnectionCallback<Boolean>)
            conexion -> "PostgreSQL".equals(conexion.getMetaData().getDatabaseProductName()));
    }

    public Boolean tienePublicaciones() {
        return jdbc.queryForObject("""
            SELECT to_regclass('intento')=to_regclass('public.intento')
              AND to_regclass('nivel_publicacion') IS NOT NULL
            """, Boolean.class);
    }

    public <T> List<T> unidades(RowMapper<T> mapeador, int idDiseno) {
        return jdbc.query("SELECT id_tren,nombre_linea,velocidad_promedio,duracion_ut FROM metro WHERE id_diseno=? ORDER BY id_tren", mapeador, idDiseno);
    }

    public int registrarResultado(
        int idSimulacion,
        int version,
        String problema,
        String ejecucion,
        int limiteUt,
        BigDecimal presupuestoUv,
        int tiempoTotal,
        BigDecimal suma,
        boolean completo,
        String unidades
    ) {
        return jdbc.update("""
                INSERT INTO resultado_uv_ut(id_simulacion,version,huella_problema,huella_ejecucion,limite_ut,presupuesto_uv,ut_ejecutadas,suma_uv,completo,unidades)
                VALUES (?,?,?,?,?,?,?,?,?,CAST(? AS jsonb))
                """, idSimulacion, version, problema, ejecucion, limiteUt, presupuestoUv, tiempoTotal, suma, completo, unidades);
    }

    public <T> List<T> ultimaSimulacion(RowMapper<T> mapeador, int idIntento) {
        return jdbc.query("SELECT id_simulacion FROM simulacion WHERE id_intento=? ORDER BY id_simulacion DESC LIMIT 1", mapeador, idIntento);
    }

    public <T> List<T> ultimoResultado(RowMapper<T> mapeador, int idIntento, String problema, int idIntentoActual) {
        return jdbc.query("""
            SELECT r.version,r.huella_problema,r.huella_ejecucion,r.limite_ut,r.presupuesto_uv,r.ut_ejecutadas,r.suma_uv,r.completo,r.unidades::text,
              (SELECT MIN(r2.suma_uv) FROM resultado_uv_ut r2 JOIN simulacion s2 ON s2.id_simulacion=r2.id_simulacion
               WHERE s2.id_intento=? AND r2.huella_problema=? AND r2.completo=TRUE AND r2.version=r.version) mejor_uv
            FROM resultado_uv_ut r JOIN simulacion s ON s.id_simulacion=r.id_simulacion
            WHERE s.id_intento=? ORDER BY s.id_simulacion DESC LIMIT 1
            """, mapeador, idIntento, problema, idIntentoActual);
    }

    public <T> List<T> resultadoDeSimulacion(RowMapper<T> mapeador, int idSimulacion) {
        return jdbc.query("""
            SELECT r.version,r.huella_problema,r.huella_ejecucion,r.limite_ut,r.presupuesto_uv,r.ut_ejecutadas,r.suma_uv,r.completo,r.unidades::text,
              (SELECT MIN(r2.suma_uv) FROM resultado_uv_ut r2 JOIN simulacion s2 ON s2.id_simulacion=r2.id_simulacion
               WHERE s2.id_intento=s.id_intento AND r2.huella_problema=r.huella_problema AND r2.completo=TRUE AND r2.version=r.version) mejor_uv
            FROM resultado_uv_ut r JOIN simulacion s ON s.id_simulacion=r.id_simulacion
            WHERE r.id_simulacion=?
            """, mapeador, idSimulacion);
    }

    public <T> List<T> datosSimulacion(RowMapper<T> mapeador, int idSimulacion) {
        return jdbc.query("SELECT s.id_intento,i.id_diseno,s.comentarios FROM simulacion s JOIN intento i USING(id_intento) WHERE s.id_simulacion=?", mapeador, idSimulacion);
    }

    public List<String> lineas(int idDiseno) {
        return jdbc.queryForList("SELECT nombre FROM linea WHERE id_diseno=?", String.class, idDiseno);
    }

    public <T> List<T> tramos(RowMapper<T> mapeador, int idDiseno) {
        return jdbc.query("SELECT nombre_linea,nombre_estacion_a,nombre_estacion_b FROM tramo WHERE id_diseno=?", mapeador, idDiseno);
    }
}
