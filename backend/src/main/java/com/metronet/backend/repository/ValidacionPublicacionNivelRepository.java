package com.metronet.backend.repository;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.util.List;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.stereotype.Repository;

@Repository
public class ValidacionPublicacionNivelRepository {
    private final JdbcTemplate jdbc;
    private final DataSource datos;

    public ValidacionPublicacionNivelRepository(JdbcTemplate jdbc, DataSource datos) {
        this.datos = datos;
        this.jdbc = jdbc;
    }

    public Integer crearDiseno() {
        return jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
    }

    public Integer campanaActual(int idAdmin) {
        return jdbc.queryForObject("SELECT numero_campana_actual FROM usuario WHERE id_usuario=?", Integer.class, idAdmin);
    }

    public Integer crearIntento(int idAdmin, int idEscenario, int diseno, int campana) {
        return jdbc.queryForObject("""
                INSERT INTO intento(id_usuario,id_escenario,id_diseno,numero_campana,estado,progreso)
                VALUES (?,?,?,?,'EN_DESARROLLO',0) RETURNING id_intento
                """, Integer.class, idAdmin, idEscenario, diseno, campana);
    }

    public int actualizarCatalogoIntento(String reglasExito, String herramientasHabilitadas, String objetivo, String instrucciones, int intento) {
        return jdbc.update("""
                UPDATE intento_catalogo_v1 SET reglas_exito=CAST(? AS jsonb),
                  herramientas_habilitadas=CAST(? AS jsonb),objetivo=?,instrucciones=? WHERE id_intento=?
                """, reglasExito, herramientasHabilitadas, objetivo, instrucciones, intento);
    }

    public Integer siguienteVersionCriterio(int idEscenario) {
        return jdbc.queryForObject("SELECT COALESCE(MAX(version),0)+1 FROM criterio_uv_ut WHERE id_escenario=?", Integer.class, idEscenario);
    }

    public int crearCriterioIntento(
        int intento,
        int version,
        int limiteUt,
        BigDecimal presupuestoUv,
        String reglasExito,
        String herramientasHabilitadas,
        String objetivo,
        String instrucciones
    ) {
        return jdbc.update("""
                    INSERT INTO intento_uv_ut(id_intento,version,limite_ut,presupuesto_uv,reglas_exito,
                      herramientas_habilitadas,objetivo,instrucciones)
                    VALUES (?,?,?,?,CAST(? AS jsonb),CAST(? AS jsonb),?,?)
                    """, intento, version, limiteUt, presupuestoUv, reglasExito, herramientasHabilitadas, objetivo, instrucciones);
    }

    public int crearEstacion(int diseno, String nombre, BigDecimal posicionX, BigDecimal posicionY, boolean transbordo) {
        return jdbc.update("""
            INSERT INTO estacion(id_diseno,nombre,posicion_x,posicion_y,transbordo)
            VALUES (?,?,?,?,?)
            """, diseno, nombre, posicionX, posicionY, transbordo);
    }

    public int crearLinea(int diseno, String nombre) {
        return jdbc.update("INSERT INTO linea(id_diseno,nombre) VALUES (?,?)", diseno, nombre);
    }

    public int crearTramo(int diseno, String linea, String a, String b) {
        return jdbc.update("INSERT INTO tramo(id_diseno,nombre_linea,nombre_estacion_a,nombre_estacion_b) VALUES (?,?,?,?)", diseno, linea, a, b);
    }

    public int crearConexionOrigen(int diseno, String linea, String a) {
        return jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (?,?,?) ON CONFLICT DO NOTHING", diseno, linea, a);
    }

    public int crearConexionDestino(int diseno, String linea, String b) {
        return jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (?,?,?) ON CONFLICT DO NOTHING", diseno, linea, b);
    }

    public int crearUnidad(int diseno, String nombreLinea, int capacidad, BigDecimal velocidad) {
        return jdbc.update("""
            INSERT INTO metro(id_diseno,nombre_linea,capacidad,velocidad_promedio) VALUES (?,?,?,?)
            """, diseno, nombreLinea, capacidad, velocidad);
    }

    public List<Integer> unidades(int diseno) {
        return jdbc.queryForList("SELECT id_tren FROM metro WHERE id_diseno=? ORDER BY id_tren", Integer.class, diseno);
    }

    public int actualizarUnidad(BigDecimal velocidad, Object duracionUt, String referencia, Integer idTren) {
        return jdbc.update("UPDATE metro SET velocidad_promedio=?,duracion_ut=?,referencia_uv_ut=? WHERE id_tren=?", velocidad, duracionUt, referencia, idTren);
    }
    public EnsayoReferencia prepararEnsayo() {
        return new EnsayoReferencia(DataSourceUtils.getConnection(datos));
    }

    /** Aísla el ensayo dentro de la transacción vigente, sin confirmar sus escrituras. */
    public final class EnsayoReferencia {
        private final Connection conexion;
        private Savepoint punto;

        private EnsayoReferencia(Connection conexion) {
            this.conexion = conexion;
        }

        public void iniciar() throws SQLException {
            punto = conexion.setSavepoint("referencia_nivel");
        }

        public void revertir() {
            if (punto != null) {
                try {
                    conexion.rollback(punto);
                    conexion.releaseSavepoint(punto);
                } catch (Exception error) {
                    throw new IllegalStateException("No se pudo revertir el ensayo de referencia", error);
                }
            }
            DataSourceUtils.releaseConnection(conexion, datos);
        }
    }
}
