package com.metronet.backend.controller;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ManejadorExcepcionesApi {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> manejarRespuesta(ResponseStatusException excepcion) {
        String detalle = excepcion.getReason() == null ? "No fue posible completar la solicitud." : excepcion.getReason();
        return ResponseEntity.status(excepcion.getStatusCode()).body(Map.of("detail", detalle));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> manejarDatosInvalidos(IllegalArgumentException excepcion) {
        return respuesta(HttpStatus.BAD_REQUEST, excepcion.getMessage());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, DataIntegrityViolationException.class})
    public ResponseEntity<Map<String, String>> manejarConflicto(Exception excepcion) {
        if (excepcion instanceof DataIntegrityViolationException) {
            return respuesta(HttpStatus.CONFLICT, "No fue posible guardar los datos porque ya existe un registro equivalente.");
        }

        return respuesta(HttpStatus.BAD_REQUEST, "Los datos enviados no son válidos.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> manejarErrorInesperado(Exception excepcion) {
        return respuesta(HttpStatus.INTERNAL_SERVER_ERROR, "No fue posible completar la solicitud.");
    }

    private ResponseEntity<Map<String, String>> respuesta(HttpStatus estado, String detalle) {
        String mensaje = detalle == null || detalle.isBlank() ? "No fue posible completar la solicitud." : detalle;
        return ResponseEntity.status(estado).body(Map.of("detail", mensaje));
    }
}
