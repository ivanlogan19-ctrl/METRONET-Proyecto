package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** Sirve el último resumen válido y coordina su actualización fuera de las solicitudes del mapa. */
@Service
public class TraficoHistoricoService {
    private static final Logger LOG = LoggerFactory.getLogger(TraficoHistoricoService.class);
    private final ObjectMapper mapper;
    private final Path carpeta;
    private final Clock reloj;
    private final boolean habilitado;
    private final String python;
    private final JsonNode respaldo;

    public TraficoHistoricoService(ObjectMapper mapper, Clock reloj,
            @Value("${metronet.trafico.directorio}") String directorio,
            @Value("${metronet.trafico.actualizacion-habilitada:true}") boolean habilitado,
            @Value("${metronet.trafico.python:python3}") String python) throws IOException {
        this.mapper = mapper;
        this.reloj = reloj.withZone(ZoneId.of("America/Montevideo"));
        this.carpeta = Path.of(directorio).toAbsolutePath();
        this.habilitado = habilitado;
        this.python = python;
        try (var entrada = new ClassPathResource("trafico/trafico-historico.json").getInputStream()) {
            respaldo = mapper.readTree(entrada);
        }
        if (!valido(respaldo)) throw new IOException("Respaldo de tráfico inválido");
    }

    public JsonNode consultar() {
        for (String nombre : List.of("actual.json", "anterior.json")) {
            try {
                Path ruta = carpeta.resolve(nombre);
                if (Files.size(ruta) > 20_000_000) continue;
                JsonNode datos = mapper.readTree(Files.readAllBytes(ruta));
                if (valido(datos) && YearMonth.parse(datos.path("periodo").asText()).isBefore(YearMonth.now(reloj)) && datos.path("periodo").asText().compareTo(respaldo.path("periodo").asText()) >= 0) return datos;
            } catch (IOException | RuntimeException error) {
                // Un archivo ausente/incompleto nunca bloquea el mapa ni elimina el respaldo.
            }
        }
        return respaldo;
    }

    static boolean valido(JsonNode datos) {
        try {
            if (datos == null || datos.path("version").asInt() != 1) return false;
            YearMonth mes = YearMonth.parse(datos.path("periodo").asText());
            JsonNode fechas = datos.path("revision").path("fechas");
            if (!fechas.isArray() || fechas.size() != mes.lengthOfMonth()) return false;
            for (int dia = 1; dia <= mes.lengthOfMonth(); dia++) {
                if (!fechas.get(dia-1).asText().equals(mes.atDay(dia).toString())) return false;
            }
            JsonNode tramos = datos.path("tramos");
            if (!tramos.isArray() || tramos.isEmpty()) return false;
            int validas = 0;
            for (JsonNode tramo : tramos) {
                JsonNode horas = tramo.path("intensidades"), puntos = tramo.path("coordenadas");
                if (!horas.isArray() || horas.size() != 24 || !puntos.isArray() || puntos.size() < 2) return false;
                for (JsonNode valor : horas) {
                    if (valor.isNull()) continue;
                    double v = valor.asDouble();
                    if (!valor.isNumber() || !Double.isFinite(v) || v < 0 || v > 1) return false;
                    validas++;
                }
                for (JsonNode p : puntos) {
                    if (!p.isArray() || p.size() != 2 || !p.get(0).isNumber() || !p.get(1).isNumber()) return false;
                    double x = p.get(0).asDouble(), y = p.get(1).asDouble();
                    if (!(x > -56.5 && x < -55.9 && y > -35 && y < -34.5)) return false;
                }
            }
            return validas >= tramos.size()*12;
        } catch (RuntimeException error) { return false; }
    }

    // Comprueba vencimiento cada hora: red mensual, o diariamente cuando falta la publicación.
    @Scheduled(initialDelay = 30000, fixedDelay = 3600000)
    public synchronized void comprobarActualizacion() {
        if (!habilitado) return;
        try {
            Files.createDirectories(carpeta);
            try (var canal = FileChannel.open(carpeta.resolve("actualizacion.lock"), StandardOpenOption.CREATE, StandardOpenOption.WRITE);
                 var bloqueo = canal.tryLock()) {
                if (bloqueo == null || !corresponde()) return;
                ejecutarActualizador();
            }
        } catch (IOException | RuntimeException error) {
            LOG.warn("No se actualizó el tráfico; se conserva el último período válido ({})", error.getClass().getSimpleName());
        }
    }

    private boolean corresponde() {
        try {
            JsonNode estado = mapper.readTree(Files.readAllBytes(carpeta.resolve("estado.json")));
            return !estado.path("periodo").asText().equals(consultar().path("periodo").asText())
                || !LocalDate.parse(estado.path("proximaComprobacion").asText()).isAfter(LocalDate.now(reloj));
        } catch (IOException | RuntimeException error) { return true; }
    }

    private void ejecutarActualizador() throws IOException {
        Path temporal = Files.createTempDirectory(carpeta, ".ejecucion-");
        Process proceso = null;
        try {
            for (String archivo : List.of("actualizar-trafico.py", "preparar-trafico.py", "calles-montevideo.geojson", "trafico-historico.json")) {
                try (var entrada = new ClassPathResource("trafico/"+archivo).getInputStream()) {
                    Files.copy(entrada, temporal.resolve(archivo));
                }
            }
            proceso = new ProcessBuilder(python, temporal.resolve("actualizar-trafico.py").toString(),
                carpeta.toString(), temporal.resolve("trafico-historico.json").toString(),
                temporal.resolve("calles-montevideo.geojson").toString(), temporal.resolve("preparar-trafico.py").toString(), LocalDate.now(reloj).toString())
                .redirectErrorStream(true).redirectOutput(temporal.resolve("resultado.log").toFile()).start();
            if (!proceso.waitFor(30, TimeUnit.MINUTES)) {
                proceso.destroyForcibly().waitFor();
                throw new IOException("Actualización excedió 30 minutos");
            }
            if (proceso.exitValue() != 0) throw new IOException("El actualizador rechazó la descarga");
            LOG.info("Comprobación de tráfico terminada. Período disponible: {}", consultar().path("periodo").asText());
        } catch (InterruptedException error) {
            if (proceso != null) proceso.destroyForcibly();
            Thread.currentThread().interrupt();
            throw new IOException("Actualización interrumpida", error);
        } finally {
            try (var archivos = Files.walk(temporal)) {
                for (Path archivo : archivos.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(archivo);
            }
        }
    }
}
