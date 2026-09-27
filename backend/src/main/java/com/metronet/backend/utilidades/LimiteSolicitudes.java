package com.metronet.backend.utilidades;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Ventana fija acotada al proceso. No confía en cabeceras de IP del cliente. */
public final class LimiteSolicitudes {
    private static final int MAX_CLAVES = 10000;
    private final Clock reloj;
    private final int maximo;
    private final Duration ventana;
    private final Map<String, Contador> contadores = new HashMap<>();

    public LimiteSolicitudes(Clock reloj, int maximo, Duration ventana) {
        this.reloj = reloj;
        this.maximo = maximo;
        this.ventana = ventana;
    }

    public synchronized void registrar(String clave) {
        Instant ahora = reloj.instant();
        contadores.values().removeIf(contador -> !contador.fin.isAfter(ahora));
        Contador contador = contadores.get(clave);
        if (contador == null) {
            if (contadores.size() >= MAX_CLAVES) rechazar();
            contador = new Contador(ahora.plus(ventana));
            contadores.put(clave, contador);
        }
        if (contador.cantidad >= maximo) rechazar();
        contador.cantidad++;
    }

    public synchronized void limpiar(String clave) { contadores.remove(clave); }

    private void rechazar() {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
            "Demasiados intentos. Esperá unos minutos antes de volver a intentar.");
    }

    private static final class Contador {
        private final Instant fin;
        private int cantidad;
        private Contador(Instant fin) { this.fin = fin; }
    }
}
