package com.metronet.backend.configuracion;

import com.metronet.backend.service.JuegoEducativoService;
import org.springframework.jdbc.core.JdbcTemplate;

/** Acciones reales de comparación para las redes de prueba; nunca se usa en datos de aplicación. */
final class ComparacionesSimulacionFixture {
    static void registrar(JdbcTemplate jdbc, JuegoEducativoService juego, int diseno, int horas) {
        jdbc.update("INSERT INTO simulacion(id_intento,duracion,comentarios) VALUES (?,?,?)", diseno, horas, juego.marcaRedSimulada(diseno));
    }
    static void practicar(JdbcTemplate jdbc, JuegoEducativoService juego, int diseno) {
        registrar(jdbc, juego, diseno, 6);
        jdbc.update("UPDATE metro SET velocidad_promedio=velocidad_promedio+1 WHERE id_diseno=?", diseno);
        registrar(jdbc, juego, diseno, 6);
        registrar(jdbc, juego, diseno, 8);
        jdbc.update("UPDATE metro SET velocidad_promedio=velocidad_promedio+1 WHERE id_diseno=? AND id_tren=(SELECT MIN(id_tren) FROM metro WHERE id_diseno=?)", diseno, diseno);
        registrar(jdbc, juego, diseno, 8);
        jdbc.update("UPDATE metro SET velocidad_promedio=8 WHERE id_diseno=?", diseno);
        registrar(jdbc, juego, diseno, 8);
        jdbc.update("UPDATE metro SET velocidad_promedio=9 WHERE id_diseno=?", diseno);
        registrar(jdbc, juego, diseno, 9);
    }
}
