package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class TraficoHistoricoServiceTest {
    @TempDir Path carpeta;
    ObjectMapper mapper = new ObjectMapper();
    TraficoHistoricoService servicio() throws Exception {
        return new TraficoHistoricoService(mapper, Clock.fixed(Instant.parse("2026-11-02T12:00:00Z"), ZoneOffset.UTC), carpeta.toString(), false, "python3");
    }
    @Test void respaldoInicialYActualizacionSinReiniciar() throws Exception {
        var s = servicio();
        ObjectNode datos = (ObjectNode)s.consultar().deepCopy();
        assertEquals("2026-09", datos.path("periodo").asText());
        datos.put("actualizadoEl", "2026-10-13");
        Files.writeString(carpeta.resolve("actual.json"), datos.toString());
        assertEquals("2026-10-13", s.consultar().path("actualizadoEl").asText());
        assertEquals(s.consultar(), servicio().consultar());
    }
    @Test void corrupcionRecuperaAnteriorSinBloquearMapa() throws Exception {
        var s = servicio();
        ObjectNode datos = (ObjectNode)s.consultar().deepCopy();
        datos.put("actualizadoEl", "2026-10-12");
        Files.writeString(carpeta.resolve("anterior.json"), datos.toString());
        Files.writeString(carpeta.resolve("actual.json"), "{incompleto");
        assertEquals("2026-10-12", s.consultar().path("actualizadoEl").asText());
        Files.writeString(carpeta.resolve("anterior.json"), "{}");
        assertEquals("2026-09", s.consultar().path("periodo").asText());
    }
    @Test void validaTodasLasHorasGeometriaYMesCompleto() throws Exception {
        ObjectNode datos = (ObjectNode)servicio().consultar().deepCopy();
        assertTrue(TraficoHistoricoService.valido(datos));
        ((ObjectNode)datos.path("tramos").get(0)).putArray("intensidades").add(1);
        assertFalse(TraficoHistoricoService.valido(datos));
        datos = (ObjectNode)servicio().consultar().deepCopy();
        ((ObjectNode)datos.path("revision")).putArray("fechas");
        assertFalse(TraficoHistoricoService.valido(datos));
    }
    @Test void deshabilitadoNoCreaArchivosNiDescarga() throws Exception {
        servicio().comprobarActualizacion();
        try (var archivos = Files.list(carpeta)) { assertEquals(0,archivos.count()); }
    }
}
