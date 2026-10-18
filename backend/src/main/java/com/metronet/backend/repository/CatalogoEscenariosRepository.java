package com.metronet.backend.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogoEscenariosRepository {
    private final JdbcTemplate jdbc;

    public CatalogoEscenariosRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int actualizarCatalogoAnterior(
        String objetivo,
        String instrucciones,
        String reglasExito,
        int numero,
        String objetivoAnterior,
        String instruccionesAnteriores,
        String instruccionesAlternativas,
        String reglasAnteriores,
        String herramientasHabilitadas
    ) {
        return jdbc.update("""
                        UPDATE escenario SET objetivo=?, instrucciones=?, reglas_exito=CAST(? AS jsonb)
                        WHERE progresivo=TRUE AND numero=? AND objetivo=? AND (instrucciones=? OR instrucciones=?)
                          AND reglas_exito=CAST(? AS jsonb) AND herramientas_habilitadas=CAST(? AS jsonb)
                        """, objetivo, instrucciones, reglasExito, numero, objetivoAnterior, instruccionesAnteriores, instruccionesAlternativas, reglasAnteriores, herramientasHabilitadas);
    }

    public int completarPuntuacion(String reglasExito, int numero, String reglasAnteriores) {
        return jdbc.update("UPDATE escenario SET reglas_exito=CAST(? AS jsonb) WHERE progresivo=TRUE AND numero=? AND reglas_exito=CAST(? AS jsonb)", reglasExito, numero, reglasAnteriores);
    }

    public int crearCriterio(String presupuestoUv, int numero, String objetivo, String instrucciones, String reglasExito, String herramientasHabilitadas) {
        return jdbc.update("""
                    INSERT INTO criterio_uv_ut(id_escenario,version,limite_ut,presupuesto_uv)
                    SELECT id_escenario,1,2,CAST(? AS numeric)
                    FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=?
                      AND objetivo=? AND instrucciones=? AND reglas_exito=CAST(? AS jsonb)
                      AND herramientas_habilitadas=CAST(? AS jsonb)
                      AND NOT EXISTS (SELECT 1 FROM criterio_uv_ut c WHERE c.id_escenario=escenario.id_escenario)
                    """, presupuestoUv, numero, objetivo, instrucciones, reglasExito, herramientasHabilitadas);
    }

    public Boolean esEsquemaPublico() {
        return jdbc.queryForObject("SELECT to_regclass('escenario')=to_regclass('public.escenario')", Boolean.class);
    }

    public Boolean existePublicacion() {
        return jdbc.queryForObject("SELECT to_regclass('public.nivel_publicacion') IS NOT NULL", Boolean.class);
    }

    public Boolean tienePublicacionAdministrada(int numero) {
        return jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM public.nivel_publicacion p JOIN public.escenario e ON e.id_escenario=p.id_escenario
              WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?)
            """, Boolean.class, numero);
    }

    public int actualizarSeedInicialNivel4(
        String objetivo,
        String instrucciones,
        String reglasExito,
        String nombre,
        String dificultad,
        String objetivoAnterior,
        String instruccionesAnteriores,
        String reglasAnteriores,
        String herramientasHabilitadas
    ) {
        return jdbc.update("""
            UPDATE escenario SET objetivo=?, instrucciones=?, reglas_exito=CAST(? AS jsonb)
            WHERE progresivo=TRUE AND modo='NIVEL' AND numero=4 AND nombre=? AND dificultad=?
              AND objetivo=? AND instrucciones=? AND reglas_exito=CAST(? AS jsonb)
              AND herramientas_habilitadas=CAST(? AS jsonb)
            """, objetivo, instrucciones, reglasExito, nombre, dificultad, objetivoAnterior, instruccionesAnteriores, reglasAnteriores, herramientasHabilitadas);
    }

    public int actualizarInstruccionConocida(
        String objetivo,
        String instrucciones,
        int numero,
        String objetivoAnterior,
        String instruccionAnterior,
        String reglasExito,
        String herramientasHabilitadas
    ) {
        return jdbc.update("""
            UPDATE escenario SET objetivo=?, instrucciones=?
            WHERE progresivo=TRUE AND numero=? AND objetivo=? AND instrucciones=?
              AND reglas_exito=CAST(? AS jsonb) AND herramientas_habilitadas=CAST(? AS jsonb)
            """, objetivo, instrucciones, numero, objetivoAnterior, instruccionAnterior, reglasExito, herramientasHabilitadas);
    }

    public int insertarNivel(
        String nombre,
        String objetivo,
        int numero,
        String dificultad,
        String instrucciones,
        String reglasExito,
        String herramientasHabilitadas,
        int numeroExistente
    ) {
        return jdbc.update("""
            INSERT INTO escenario (nombre, objetivo, numero, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
            SELECT ?, ?, ?, 'NIVEL', ?, ?, TRUE, CAST(? AS jsonb), CAST(? AS jsonb)
            WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND numero = ?)
            """, nombre, objetivo, numero, dificultad, instrucciones, reglasExito, herramientasHabilitadas, numeroExistente);
    }

    public int insertarModoLibre() {
        return jdbc.update("""
            INSERT INTO escenario (nombre, objetivo, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
            SELECT 'Modo Libre', 'Diseñá, editá y simulá una red de metro sin consignas obligatorias.', 'EDICION_LIBRE', 'Libre',
                   'Todas las herramientas están disponibles.', TRUE, CAST('{}' AS jsonb),
                   CAST('{"estaciones":true,"lineas":true,"conexiones":true,"metros":true,"simulacion":true}' AS jsonb)
            WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND modo = 'EDICION_LIBRE')
            """);
    }

    public int actualizarReglasConocidasNivel3(String reglasExito, String objetivo, String instrucciones, String reglasAnteriores, String herramientasHabilitadas) {
        return jdbc.update("""
            UPDATE escenario SET reglas_exito=CAST(? AS jsonb)
            WHERE progresivo=TRUE AND numero=3 AND objetivo=? AND instrucciones=?
              AND reglas_exito=CAST(? AS jsonb) AND herramientas_habilitadas=CAST(? AS jsonb)
            """, reglasExito, objetivo, instrucciones, reglasAnteriores, herramientasHabilitadas);
    }

    public int actualizarReglasNivel4(
        String objetivo,
        String instrucciones,
        String reglasAdicionales,
        String reglasAnteriores,
        String reglasAlternativas,
        String herramientasHabilitadas,
        String objetivoAnterior,
        String instruccionesAnteriores,
        String instruccionesAlternativas,
        String objetivoInicial,
        String instruccionesIniciales
    ) {
        return jdbc.update("""
            UPDATE escenario
            SET objetivo = ?,
                instrucciones = ?,
                reglas_exito = COALESCE(reglas_exito, '{}'::jsonb) || CAST(? AS jsonb)
            WHERE progresivo = TRUE AND numero = 4
              AND (reglas_exito = CAST(? AS jsonb) OR reglas_exito = CAST(? AS jsonb))
              AND herramientas_habilitadas = CAST(? AS jsonb)
              AND ((objetivo=? AND (instrucciones=? OR instrucciones=?))
                   OR (objetivo=? AND instrucciones=?))
            """, objetivo, instrucciones, reglasAdicionales, reglasAnteriores, reglasAlternativas, herramientasHabilitadas, objetivoAnterior, instruccionesAnteriores, instruccionesAlternativas, objetivoInicial, instruccionesIniciales);
    }
}
